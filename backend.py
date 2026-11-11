"""Backend do Braço e Escalas: contas, sessões, faixas de áudio (backing tracks) e progressões.

Só biblioteca padrão do Python (3.9+): sqlite3 para o banco, pbkdf2 para senhas.
Os arquivos de áudio ficam em disco (DADOS/faixas/<usuario>/), nunca dentro do banco.
"""
import hashlib, hmac, json, os, re, secrets, shutil, sqlite3, subprocess, threading, time

RAIZ = os.path.dirname(os.path.abspath(__file__))
DADOS = os.environ.get('BRACO_DADOS', os.path.join(RAIZ, 'dados'))

SESSAO_DIAS = 30
ITERACOES = 600_000
MAX_FAIXA = 600 * 1024 * 1024  # 600 MB por arquivo (WAV de pen drive passa de 100 MB)
AUDIO = {'.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.wav': 'audio/wav',
         '.ogg': 'audio/ogg', '.oga': 'audio/ogg', '.flac': 'audio/flac', '.aif': 'audio/aiff', '.aiff': 'audio/aiff'}
CAMPOS_FAIXA = ('id', 'nome', 'pasta', 'tom', 'bpm', 'tamanho', 'origem', 'original', 'criado')
# formatos sem compressão: viram AAC (.m4a) ao guardar, se o ffmpeg estiver instalado (WAV de 64 MB -> uns 4 MB)
SEM_COMPRESSAO = {'.wav', '.flac', '.aif', '.aiff'}
KBPS = int(os.environ.get('BRACO_KBPS', 128))


class Erro(Exception):
    """Erro que vira resposta HTTP com mensagem para o usuário."""
    def __init__(self, status, msg):
        super().__init__(msg)
        self.status, self.msg = status, msg


# ---------- banco ----------
ESQUEMA = """
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY, nome TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  senha TEXT NOT NULL, criado TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS sessoes (
  token TEXT PRIMARY KEY, usuario INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE, expira INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS faixas (
  id INTEGER PRIMARY KEY, usuario INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nome TEXT NOT NULL, pasta TEXT NOT NULL DEFAULT '', tom TEXT NOT NULL DEFAULT '', bpm INTEGER,
  arquivo TEXT NOT NULL, mime TEXT NOT NULL, tamanho INTEGER NOT NULL,
  origem TEXT NOT NULL DEFAULT '', original INTEGER, criado TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS progressoes (
  usuario INTEGER PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE, dados TEXT NOT NULL, atualizado INTEGER NOT NULL);
"""
_iniciado = set()
_lock_ini = threading.Lock()


def conectar():
    os.makedirs(DADOS, exist_ok=True)
    caminho = os.path.join(DADOS, 'app.db')
    db = sqlite3.connect(caminho, timeout=10)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA foreign_keys = ON')
    with _lock_ini:
        if caminho not in _iniciado:
            db.execute('PRAGMA journal_mode = WAL')
            db.executescript(ESQUEMA)
            _migrar(db)
            _iniciado.add(caminho)
    return db


def _migrar(db):
    """Banco de versão anterior: 'ritmo' virou 'pasta'; guarda o nome e o tamanho do arquivo de origem."""
    cols = {r[1] for r in db.execute('PRAGMA table_info(faixas)')}
    if 'pasta' not in cols:
        db.execute("ALTER TABLE faixas ADD COLUMN pasta TEXT NOT NULL DEFAULT ''")
        if 'ritmo' in cols:
            db.execute('UPDATE faixas SET pasta = ritmo')
    if 'origem' not in cols:
        db.execute("ALTER TABLE faixas ADD COLUMN origem TEXT NOT NULL DEFAULT ''")
    if 'original' not in cols:
        db.execute('ALTER TABLE faixas ADD COLUMN original INTEGER')
    db.execute('CREATE INDEX IF NOT EXISTS faixas_pasta ON faixas(usuario, pasta)')
    db.commit()


# ---------- senhas e sessões ----------
def hash_senha(senha, sal=None, it=ITERACOES):
    sal = sal or secrets.token_hex(16)
    h = hashlib.pbkdf2_hmac('sha256', senha.encode(), bytes.fromhex(sal), it).hex()
    return f'pbkdf2_sha256${it}${sal}${h}'


def confere_senha(senha, guardada):
    try:
        alg, it, sal, h = guardada.split('$')
        if alg != 'pbkdf2_sha256':
            return False
        return hmac.compare_digest(hash_senha(senha, sal, int(it)), guardada)
    except (ValueError, TypeError):
        return False


_SENHA_FALSA = hash_senha('senha-que-nao-existe')  # mesma demora quando o e-mail não existe


def _tok(token):
    return hashlib.sha256(token.encode()).hexdigest()  # o banco guarda só o hash do token


# modo simples (sem login): tudo fica numa conta local, criada sozinha. Quando o login for ligado,
# o primeiro cadastro assume essa conta, e as gravações e progressões continuam lá.
LOCAL_EMAIL = 'local@braco.local'


def usuario_local(db):
    u = db.execute('SELECT * FROM usuarios ORDER BY id LIMIT 1').fetchone()
    if not u:
        db.execute('INSERT INTO usuarios (nome, email, senha) VALUES (?, ?, ?)', ('Eu', LOCAL_EMAIL, hash_senha(secrets.token_hex(16))))
        db.commit()
        u = db.execute('SELECT * FROM usuarios ORDER BY id LIMIT 1').fetchone()
    return publico(u)


def tem_usuarios(db):
    """Há conta de verdade (com e-mail e senha escolhidos)? A conta local do modo simples não conta."""
    return db.execute('SELECT 1 FROM usuarios WHERE email != ? LIMIT 1', (LOCAL_EMAIL,)).fetchone() is not None


def cadastrar(db, nome, email, senha, aberto=False):
    """Cria a conta. Sem `aberto`, só a primeira conta pode ser criada (app de uma pessoa por enquanto)."""
    nome, email = (nome or '').strip(), (email or '').strip().lower()
    if tem_usuarios(db) and not aberto:
        raise Erro(403, 'O cadastro está fechado. Entre com a conta que já existe.')
    if not nome or len(nome) > 80:
        raise Erro(400, 'Escreva seu nome.')
    if not re.fullmatch(r'[^@\s]+@[^@\s]+\.[^@\s]+', email) or len(email) > 200:
        raise Erro(400, 'Esse e-mail não parece certo.')
    if len(senha or '') < 8:
        raise Erro(400, 'A senha precisa ter pelo menos 8 letras ou números.')
    local = db.execute('SELECT id FROM usuarios WHERE email = ?', (LOCAL_EMAIL,)).fetchone()
    try:
        if local and not tem_usuarios(db):  # primeiro cadastro fica com o que já foi guardado no modo simples
            db.execute('UPDATE usuarios SET nome = ?, email = ?, senha = ? WHERE id = ?', (nome, email, hash_senha(senha), local['id']))
            uid = local['id']
        else:
            uid = db.execute('INSERT INTO usuarios (nome, email, senha) VALUES (?, ?, ?)', (nome, email, hash_senha(senha))).lastrowid
    except sqlite3.IntegrityError:
        raise Erro(409, 'Já existe uma conta com esse e-mail.')
    db.commit()
    return uid


def entrar(db, email, senha):
    """Confere e-mail e senha; devolve (token, usuario)."""
    u = db.execute('SELECT * FROM usuarios WHERE email = ?', ((email or '').strip().lower(),)).fetchone()
    ok = confere_senha(senha or '', u['senha'] if u else _SENHA_FALSA)
    if not u or not ok:
        raise Erro(401, 'E-mail ou senha errados.')
    token = secrets.token_urlsafe(32)
    agora = int(time.time())
    db.execute('DELETE FROM sessoes WHERE expira < ?', (agora,))
    db.execute('INSERT INTO sessoes VALUES (?, ?, ?)', (_tok(token), u['id'], agora + SESSAO_DIAS * 86400))
    db.commit()
    return token, publico(u)


def sair(db, token):
    if token:
        db.execute('DELETE FROM sessoes WHERE token = ?', (_tok(token),))
        db.commit()


def usuario_da_sessao(db, token):
    if not token:
        return None
    u = db.execute('SELECT u.* FROM sessoes s JOIN usuarios u ON u.id = s.usuario WHERE s.token = ? AND s.expira > ?',
                   (_tok(token), int(time.time()))).fetchone()
    return publico(u) if u else None


def publico(u):
    return {'id': u['id'], 'nome': u['nome'], 'email': u['email']}


def trocar_senha(db, uid, atual, nova):
    u = db.execute('SELECT senha FROM usuarios WHERE id = ?', (uid,)).fetchone()
    if not u or not confere_senha(atual or '', u['senha']):
        raise Erro(401, 'A senha atual está errada.')
    if len(nova or '') < 8:
        raise Erro(400, 'A senha nova precisa ter pelo menos 8 letras ou números.')
    db.execute('UPDATE usuarios SET senha = ? WHERE id = ?', (hash_senha(nova), uid))
    db.execute('DELETE FROM sessoes WHERE usuario = ?', (uid,))  # sai dos outros aparelhos
    db.commit()


class Limite:
    """Limite de tentativas de entrar: N erros por chave (IP) numa janela de tempo."""
    def __init__(self, maximo=8, janela=600):
        self.maximo, self.janela, self.erros, self.lock = maximo, janela, {}, threading.Lock()

    def bloqueado(self, chave):
        agora = time.time()
        with self.lock:
            v = [t for t in self.erros.get(chave, []) if agora - t < self.janela]
            self.erros[chave] = v
            return len(v) >= self.maximo

    def erro(self, chave):
        with self.lock:
            self.erros.setdefault(chave, []).append(time.time())

    def limpar(self, chave):
        with self.lock:
            self.erros.pop(chave, None)


# ---------- faixas ----------
NOTAS = r'[A-G](?:#|b|♯|♭)?'
_TOM_CHAVE = re.compile(r'(?:\b(?:em|in|tom|key(?:\s+of)?)\s+)(' + NOTAS + r')\s*(m(?:in(?:or)?)?|menor|maior|major)?(?![a-z])', re.I)
# solto: entre parênteses/colchetes, ou com acidente/menor (F#, Bb, Am). Uma letra sozinha ("A Blues") não conta.
_TOM_SOLTO = re.compile(r'[\(\[](' + NOTAS + r')(m|min|minor)?[\)\]]|(?<![\w#])([A-G](?:#|b|♯|♭))(m|min|minor)?(?![\w#])|(?<![\w#])([A-G])(m|min|minor)(?![\w#])')
_TOM_PALAVRA = re.compile(r'(?<![\w#])([A-G](?:#|b)?)\s+(minor|major|menor|maior)\b', re.I)  # 'E Minor Blues'
_BPM = re.compile(r'(\d{2,3})\s*bpm', re.I)


def dados_do_nome(arquivo):
    """Lê nome, tom e andamento do nome do arquivo: 'Blues em A 90bpm.mp3' -> ('Blues em A 90bpm', 'A', 90)."""
    base = re.sub(r'\s+', ' ', os.path.splitext(os.path.basename(arquivo or ''))[0].replace('_', ' ')).strip()
    nome = base or 'Faixa'
    bpm = None
    m = _BPM.search(base)
    if m and 40 <= int(m.group(1)) <= 260:
        bpm = int(m.group(1))
    tom = ''
    m = _TOM_CHAVE.search(base) or _TOM_PALAVRA.search(base) or _TOM_SOLTO.search(base)
    if m:
        g = [x for x in m.groups()]
        i = next(k for k in range(0, len(g), 2) if g[k])  # o par (nota, menor) que casou
        nota, suf = g[i], g[i + 1]
        nota = nota[0].upper() + nota[1:].replace('♯', '#').replace('♭', 'b')
        menor = suf and suf.lower() in ('m', 'min', 'minor', 'menor')
        tom = nota + ('m' if menor else '')
    return nome[:120], tom, bpm


def _limpa(texto, maximo):
    return re.sub(r'[\x00-\x1f]', '', str(texto or '')).strip()[:maximo]


def _bpm(v):
    if v in (None, ''):
        return None
    try:
        v = int(v)
    except (TypeError, ValueError):
        raise Erro(400, 'O andamento precisa ser um número.')
    if not 30 <= v <= 300:
        raise Erro(400, 'O andamento precisa estar entre 30 e 300.')
    return v


def _tom(v):
    v = _limpa(v, 4)
    if v and not re.fullmatch(r'[A-G](#|b)?m?', v):
        raise Erro(400, 'Tom inválido. Use, por exemplo, A, F# ou Em.')
    return v


def _pasta(v):
    """Caminho de pasta limpo, sempre com '/': ' A maior / Blues/' -> 'A maior/Blues'. Sem '..', no máximo 6 níveis."""
    partes = [_limpa(x, 60) for x in re.split(r'[\\/]+', str(v or ''))]
    partes = [x for x in partes if x and x not in ('.', '..')]
    if len(partes) > 6:
        raise Erro(400, 'Pastas demais, uma dentro da outra (no máximo 6).')
    return '/'.join(partes)


def pasta_usuario(uid):
    p = os.path.join(DADOS, 'faixas', str(int(uid)))
    os.makedirs(p, exist_ok=True)
    return p


def ffmpeg():
    """Caminho do ffmpeg (para diminuir WAV), ou None. Procura em BRACO_FFMPEG, na pasta ferramentas/ do app e no PATH."""
    for c in (os.environ.get('BRACO_FFMPEG'), os.path.join(RAIZ, 'ferramentas', 'ffmpeg.exe'),
              os.path.join(RAIZ, 'ferramentas', 'ffmpeg'), shutil.which('ffmpeg')):
        if c and os.path.isfile(c):
            return c
    return None


def comprimir(origem, destino):
    """Converte para AAC (.m4a). Devolve True se deu certo; se não, quem chamou fica com o original."""
    exe = ffmpeg()
    if not exe:
        return False
    cmd = [exe, '-nostdin', '-hide_banner', '-loglevel', 'error', '-y', '-i', origem, '-vn', '-map_metadata', '-1',
           '-c:a', 'aac', '-b:a', f'{KBPS}k', '-movflags', '+faststart', destino]
    try:
        r = subprocess.run(cmd, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=900,
                           creationflags=0x08000000 if os.name == 'nt' else 0)  # no Windows, sem abrir janela preta
        ok = r.returncode == 0 and os.path.exists(destino) and os.path.getsize(destino) > 0
    except (OSError, subprocess.SubprocessError):
        ok = False
    if not ok and os.path.exists(destino):
        os.remove(destino)
    return ok


def ja_existe(db, uid, pasta, origem, original):
    """Mesmo arquivo (nome e tamanho de origem) já guardado nessa pasta? Evita duplicar ao importar de novo."""
    r = db.execute('SELECT id FROM faixas WHERE usuario = ? AND pasta = ? AND origem = ? AND original = ?',
                   (uid, pasta, origem, original)).fetchone()
    return r['id'] if r else None


def guardar_faixa(db, uid, nome_arquivo, ler, tamanho, pasta='', nome=None, tom=None, bpm=None):
    """Grava o áudio em disco (nome gerado, nunca o do usuário) e registra no banco. WAV/FLAC/AIFF viram .m4a.
    `ler(n)` devolve os próximos n bytes; `tamanho` é o total esperado. Devolve a faixa, com 'repetida' se já existia."""
    origem = os.path.basename(str(nome_arquivo or '').replace('\\', '/'))[:200]
    ext = os.path.splitext(origem)[1].lower()
    if ext not in AUDIO:
        raise Erro(415, 'Esse arquivo não é de áudio. Use MP3, M4A, WAV, OGG, AAC, FLAC ou AIFF.')
    if not 0 < tamanho <= MAX_FAIXA:
        raise Erro(413, 'Arquivo vazio ou grande demais (máximo de 600 MB).')
    pasta = _pasta(pasta)
    tom = _tom(tom) if tom else None
    bpm = _bpm(bpm) if bpm not in (None, '') else None
    velho = ja_existe(db, uid, pasta, origem, tamanho)
    if velho:
        resta = tamanho  # descarta o que veio, para a conexão terminar limpa
        while resta:
            b = ler(min(resta, 1 << 20))
            if not b:
                break
            resta -= len(b)
        return dict(faixa(db, uid, velho), repetida=True)
    n0, t0, b0 = dados_do_nome(origem)
    base = secrets.token_hex(12)
    bruto = os.path.join(pasta_usuario(uid), base + ext)
    final, final_ext = bruto, ext
    try:
        with open(bruto, 'wb') as f:
            resta = tamanho
            while resta:
                bloco = ler(min(resta, 1 << 20))
                if not bloco:
                    raise Erro(400, 'O envio do arquivo foi interrompido.')
                f.write(bloco)
                resta -= len(bloco)
        if ext in SEM_COMPRESSAO:
            leve = os.path.join(pasta_usuario(uid), base + '.m4a')
            if comprimir(bruto, leve):
                os.remove(bruto)
                final, final_ext = leve, '.m4a'
        cur = db.execute('INSERT INTO faixas (usuario, nome, pasta, tom, bpm, arquivo, mime, tamanho, origem, original) VALUES (?,?,?,?,?,?,?,?,?,?)',
                         (uid, _limpa(nome, 120) or n0, pasta, tom if tom is not None else t0, bpm if bpm is not None else b0,
                          os.path.basename(final), AUDIO[final_ext], os.path.getsize(final), origem, tamanho))
        db.commit()
    except BaseException:
        for c in {bruto, final}:
            if os.path.exists(c):
                os.remove(c)
        raise
    return faixa(db, uid, cur.lastrowid)


def faixa(db, uid, fid, interno=False):
    r = db.execute('SELECT * FROM faixas WHERE id = ? AND usuario = ?', (fid, uid)).fetchone()
    if not r:
        raise Erro(404, 'Faixa não encontrada.')
    return dict(r) if interno else {k: r[k] for k in CAMPOS_FAIXA}


def listar_faixas(db, uid, pasta=None, busca=None):
    """Faixas (de uma pasta e das de dentro dela, se `pasta`) e a lista de todas as pastas."""
    sql, args = 'SELECT * FROM faixas WHERE usuario = ?', [uid]
    if pasta:
        p = _pasta(pasta)
        sql += " AND (pasta = ? OR substr(pasta, 1, ?) = ?)"; args += [p, len(p) + 1, p + '/']
    if busca:
        sql += " AND (nome LIKE ? ESCAPE '\\' OR pasta LIKE ? ESCAPE '\\')"
        q = '%' + re.sub(r'([%_\\])', r'\\\1', busca) + '%'
        args += [q, q]
    rows = db.execute(sql + ' ORDER BY pasta COLLATE NOCASE, nome COLLATE NOCASE', args).fetchall()
    pastas = set()
    for (p,) in db.execute('SELECT DISTINCT pasta FROM faixas WHERE usuario = ?', (uid,)):
        partes = p.split('/') if p else []
        pastas.update('/'.join(partes[:i]) for i in range(1, len(partes) + 1))  # inclui as pastas de cima
    return {'faixas': [{k: r[k] for k in CAMPOS_FAIXA} for r in rows], 'pastas': sorted(pastas, key=str.lower)}


def mudar_faixa(db, uid, fid, dados):
    faixa(db, uid, fid)
    campos, args = [], []
    if 'nome' in dados:
        nome = _limpa(dados['nome'], 120)
        if not nome:
            raise Erro(400, 'Escreva um nome para a faixa.')
        campos.append('nome = ?'); args.append(nome)
    if 'pasta' in dados:
        campos.append('pasta = ?'); args.append(_pasta(dados['pasta']))
    if 'tom' in dados:
        campos.append('tom = ?'); args.append(_tom(dados['tom']))
    if 'bpm' in dados:
        campos.append('bpm = ?'); args.append(_bpm(dados['bpm']))
    if campos:
        db.execute(f"UPDATE faixas SET {', '.join(campos)} WHERE id = ? AND usuario = ?", args + [fid, uid])
        db.commit()
    return faixa(db, uid, fid)


def _da_pasta(db, uid, pasta):
    """Faixas que estão na pasta ou em pastas dentro dela."""
    return db.execute("SELECT * FROM faixas WHERE usuario = ? AND (pasta = ? OR substr(pasta, 1, ?) = ?)",
                      (uid, pasta, len(pasta) + 1, pasta + '/')).fetchall()


def mover_pasta(db, uid, de, para):
    """Muda o nome ou o lugar de uma pasta (e de tudo o que está dentro). Devolve quantas faixas mudaram."""
    de, para = _pasta(de), _pasta(para)
    if not de:
        raise Erro(400, 'Escolha a pasta.')
    if not para:
        raise Erro(400, 'Escreva o nome da pasta.')
    if para == de:
        return 0
    if para.lower().startswith(de.lower() + '/'):
        raise Erro(400, 'Não dá para pôr uma pasta dentro dela mesma.')
    rows = _da_pasta(db, uid, de)
    for r in rows:
        nova = para + r['pasta'][len(de):]
        if nova.count('/') > 5:
            raise Erro(400, 'Pastas demais, uma dentro da outra (no máximo 6).')
        db.execute('UPDATE faixas SET pasta = ? WHERE id = ?', (nova, r['id']))
    db.commit()
    return len(rows)


def apagar_pasta(db, uid, pasta):
    """Apaga a pasta e tudo o que está dentro (faixas e arquivos). Devolve quantas faixas saíram."""
    pasta = _pasta(pasta)
    if not pasta:
        raise Erro(400, 'Escolha a pasta.')
    rows = _da_pasta(db, uid, pasta)
    for r in rows:
        apagar_faixa(db, uid, r['id'])
    return len(rows)


def apagar_faixa(db, uid, fid):
    f = faixa(db, uid, fid, interno=True)
    db.execute('DELETE FROM faixas WHERE id = ? AND usuario = ?', (fid, uid))
    db.commit()
    caminho = os.path.join(pasta_usuario(uid), f['arquivo'])
    if os.path.exists(caminho):
        os.remove(caminho)


def caminho_faixa(db, uid, fid):
    f = faixa(db, uid, fid, interno=True)
    return os.path.join(pasta_usuario(uid), f['arquivo']), f['mime']


# ---------- progressões ----------
MAX_PROGS = 2 * 1024 * 1024


def ler_progressoes(db, uid):
    r = db.execute('SELECT dados, atualizado FROM progressoes WHERE usuario = ?', (uid,)).fetchone()
    return {'progressoes': json.loads(r['dados']) if r else None, 'atualizado': r['atualizado'] if r else 0}


def gravar_progressoes(db, uid, lista):
    if not isinstance(lista, list) or len(lista) > 500:
        raise Erro(400, 'Lista de progressões inválida.')
    dados = json.dumps(lista, ensure_ascii=False)
    if len(dados) > MAX_PROGS:
        raise Erro(413, 'Progressões demais para guardar.')
    agora = int(time.time() * 1000)
    db.execute('INSERT INTO progressoes VALUES (?, ?, ?) ON CONFLICT(usuario) DO UPDATE SET dados = excluded.dados, atualizado = excluded.atualizado',
               (uid, dados, agora))
    db.commit()
    return agora


# ---------- importar uma pasta (pen drive, HD) ----------
def importar_pasta(db, uid, pasta, destino='', avisar=print):
    """Copia todos os áudios de `pasta` para o app, mantendo as subpastas: pen/A maior/Blues/x.wav -> pasta 'A maior/Blues'.
    `destino` é a pasta do app onde tudo entra. Pula o que já foi importado (mesmo arquivo na mesma pasta)."""
    pasta = os.path.abspath(pasta)
    feitos = pulados = 0
    for raiz, dirs, arquivos in os.walk(pasta):
        dirs[:] = sorted(d for d in dirs if not d.startswith('.') and d != 'System Volume Information')
        rel = os.path.relpath(raiz, pasta)
        alvo = _pasta(destino + '/' + ('' if rel == '.' else rel.replace(os.sep, '/')))
        for nome in sorted(arquivos):
            if nome.startswith('.') or os.path.splitext(nome)[1].lower() not in AUDIO:
                continue
            caminho = os.path.join(raiz, nome)
            tamanho = os.path.getsize(caminho)
            if ja_existe(db, uid, alvo, nome[:200], tamanho):
                pulados += 1
                continue
            try:
                with open(caminho, 'rb') as f:
                    guardar_faixa(db, uid, nome, f.read, tamanho, pasta=alvo)
                feitos += 1
                avisar(f'  + {alvo or "(fora das pastas)"} / {nome}')
            except Erro as e:
                avisar(f'  ! {nome}: {e.msg}')
    return feitos, pulados
