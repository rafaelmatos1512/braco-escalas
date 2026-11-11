import http.client, json, os, shutil, struct, sys, tempfile, threading, unittest, wave

TMP = tempfile.mkdtemp(prefix='braco-teste-')
os.environ['BRACO_DADOS'] = TMP
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import backend as B  # noqa: E402
B.ITERACOES = 1000  # testes rápidos (em produção: 600 mil)
import serve  # noqa: E402
import socketserver  # noqa: E402


def tearDownModule():
    shutil.rmtree(TMP, ignore_errors=True)


class Funcoes(unittest.TestCase):
    def setUp(self):
        self.db = B.conectar()
        for t in ('sessoes', 'faixas', 'progressoes', 'usuarios'):
            self.db.execute(f'DELETE FROM {t}')
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def test_senha_com_hash_e_sal(self):
        h = B.hash_senha('segredo123')
        self.assertTrue(h.startswith('pbkdf2_sha256$'))
        self.assertNotIn('segredo123', h)
        self.assertNotEqual(h, B.hash_senha('segredo123'))  # sal diferente
        self.assertTrue(B.confere_senha('segredo123', h))
        self.assertFalse(B.confere_senha('errada', h))
        self.assertFalse(B.confere_senha('x', 'lixo'))

    def test_so_a_primeira_conta_sem_cadastro_aberto(self):
        B.cadastrar(self.db, 'Vô', 'Vo@Email.com', 'senha1234')
        with self.assertRaises(B.Erro) as e:
            B.cadastrar(self.db, 'Outro', 'outro@email.com', 'senha1234')
        self.assertEqual(e.exception.status, 403)
        B.cadastrar(self.db, 'Outro', 'outro@email.com', 'senha1234', aberto=True)

    def test_validacao_do_cadastro(self):
        for nome, email, senha in [('', 'a@b.com', 'senha1234'), ('A', 'sem-arroba', 'senha1234'), ('A', 'a@b.com', 'curta')]:
            with self.assertRaises(B.Erro):
                B.cadastrar(self.db, nome, email, senha)

    def test_entrar_sessao_e_sair(self):
        B.cadastrar(self.db, 'Vô', 'vo@email.com', 'senha1234')
        with self.assertRaises(B.Erro):
            B.entrar(self.db, 'vo@email.com', 'errada')
        with self.assertRaises(B.Erro):
            B.entrar(self.db, 'nao@existe.com', 'senha1234')
        token, u = B.entrar(self.db, 'VO@email.com ', 'senha1234')
        self.assertEqual(B.usuario_da_sessao(self.db, token)['nome'], 'Vô')
        self.assertIsNone(self.db.execute('SELECT 1 FROM sessoes WHERE token = ?', (token,)).fetchone())  # guarda só o hash
        B.sair(self.db, token)
        self.assertIsNone(B.usuario_da_sessao(self.db, token))

    def test_trocar_senha_derruba_as_sessoes(self):
        uid = B.cadastrar(self.db, 'Vô', 'vo@email.com', 'senha1234')
        token, _ = B.entrar(self.db, 'vo@email.com', 'senha1234')
        with self.assertRaises(B.Erro):
            B.trocar_senha(self.db, uid, 'errada', 'novasenha1')
        B.trocar_senha(self.db, uid, 'senha1234', 'novasenha1')
        self.assertIsNone(B.usuario_da_sessao(self.db, token))
        B.entrar(self.db, 'vo@email.com', 'novasenha1')

    def test_limite_de_tentativas(self):
        lim = B.Limite(maximo=3, janela=60)
        for _ in range(3):
            self.assertFalse(lim.bloqueado('ip'))
            lim.erro('ip')
        self.assertTrue(lim.bloqueado('ip'))
        lim.limpar('ip')
        self.assertFalse(lim.bloqueado('ip'))

    def test_dados_do_nome_do_arquivo(self):
        self.assertEqual(B.dados_do_nome('Blues em A 90bpm.mp3'), ('Blues em A 90bpm', 'A', 90))
        self.assertEqual(B.dados_do_nome('slow_blues_in_Em_70_BPM.wav')[1:], ('Em', 70))
        self.assertEqual(B.dados_do_nome('Rock Backing Track (F#m) 120 bpm.m4a')[1:], ('F#m', 120))
        self.assertEqual(B.dados_do_nome('Key of Bb - Jazz.mp3')[1], 'Bb')
        self.assertEqual(B.dados_do_nome('A Blues Jam.mp3')[1:], ('', None))
        self.assertEqual(B.dados_do_nome('E Minor Blues Backing Track.mp3')[1], 'Em')
        self.assertEqual(B.dados_do_nome('Funk Am groove.mp3')[1], 'Am')  # "A" solto no começo não é tom

    def test_faixas_de_cada_um(self):
        a = B.cadastrar(self.db, 'A', 'a@a.com', 'senha1234')
        b = B.cadastrar(self.db, 'B', 'b@b.com', 'senha1234', aberto=True)
        dado = b'ID3' + b'\0' * 100
        f = B.guardar_faixa(self.db, a, 'Rock em E 120bpm.mp3', _leitor(dado), len(dado), pasta='Rock')
        self.assertEqual((f['pasta'], f['tom'], f['bpm'], f['origem'], f['original']), ('Rock', 'E', 120, 'Rock em E 120bpm.mp3', len(dado)))
        caminho, mime = B.caminho_faixa(self.db, a, f['id'])
        self.assertEqual(mime, 'audio/mpeg')
        self.assertTrue(caminho.startswith(os.path.join(TMP, 'faixas', str(a))))
        self.assertNotIn('Rock', os.path.basename(caminho))  # nome no disco é gerado
        with self.assertRaises(B.Erro):
            B.caminho_faixa(self.db, b, f['id'])  # a faixa de A não aparece para B
        self.assertEqual(B.listar_faixas(self.db, b)['faixas'], [])
        lst = B.listar_faixas(self.db, a, pasta='Rock')
        self.assertEqual([x['id'] for x in lst['faixas']], [f['id']])
        self.assertEqual(lst['pastas'], ['Rock'])
        self.assertEqual(B.mudar_faixa(self.db, a, f['id'], {'tom': 'Am', 'bpm': '95', 'nome': 'Minha'})['tom'], 'Am')
        with self.assertRaises(B.Erro):
            B.mudar_faixa(self.db, a, f['id'], {'tom': 'H#'})
        B.apagar_faixa(self.db, a, f['id'])
        self.assertFalse(os.path.exists(caminho))

    def test_recusa_arquivo_que_nao_e_audio(self):
        a = B.cadastrar(self.db, 'A', 'a@a.com', 'senha1234')
        for nome in ('virus.exe', 'pagina.html', 'semextensao'):
            with self.assertRaises(B.Erro):
                B.guardar_faixa(self.db, a, nome, _leitor(b'x'), 1)

    def test_modo_simples_e_depois_ligar_o_login(self):
        u = B.usuario_local(self.db)
        self.assertEqual(B.usuario_local(self.db)['id'], u['id'])  # sempre a mesma conta local
        self.assertFalse(B.tem_usuarios(self.db))  # a conta local não fecha o cadastro
        B.gravar_progressoes(self.db, u['id'], [{'name': 'Minha'}])
        uid = B.cadastrar(self.db, 'Vô', 'vo@e.com', 'senha1234')  # ligou o login: o 1º cadastro fica com o que já existia
        self.assertEqual(uid, u['id'])
        self.assertEqual(B.ler_progressoes(self.db, uid)['progressoes'], [{'name': 'Minha'}])
        B.entrar(self.db, 'vo@e.com', 'senha1234')
        self.assertTrue(B.tem_usuarios(self.db))

    def test_progressoes(self):
        a = B.cadastrar(self.db, 'A', 'a@a.com', 'senha1234')
        self.assertIsNone(B.ler_progressoes(self.db, a)['progressoes'])
        B.gravar_progressoes(self.db, a, [{'name': 'X', 'key': 0, 'mode': 'maior', 'items': []}])
        self.assertEqual(B.ler_progressoes(self.db, a)['progressoes'][0]['name'], 'X')
        with self.assertRaises(B.Erro):
            B.gravar_progressoes(self.db, a, {'nao': 'lista'})

    def test_importar_pasta_mantem_as_subpastas(self):
        a = B.cadastrar(self.db, 'A', 'a@a.com', 'senha1234')
        pen = tempfile.mkdtemp(dir=TMP)
        os.makedirs(os.path.join(pen, 'A maior', 'Blues'))
        os.makedirs(os.path.join(pen, 'System Volume Information'))
        open(os.path.join(pen, 'A maior', 'Blues', 'Shuffle em A 90bpm.mp3'), 'wb').write(b'ID3abc')
        open(os.path.join(pen, 'A maior', 'Blues', 'leia.txt'), 'w').write('não é áudio')
        open(os.path.join(pen, 'System Volume Information', 'x.mp3'), 'wb').write(b'ID3')
        open(os.path.join(pen, 'solta.mp3'), 'wb').write(b'ID3abc')
        self.assertEqual(B.importar_pasta(self.db, a, pen, avisar=lambda m: None), (2, 0))
        self.assertEqual(B.importar_pasta(self.db, a, pen, avisar=lambda m: None), (0, 2))  # não duplica
        self.assertEqual(B.listar_faixas(self.db, a)['pastas'], ['A maior', 'A maior/Blues'])  # inclui a de cima
        self.assertEqual(B.importar_pasta(self.db, a, pen, destino='Pen', avisar=lambda m: None), (2, 0))
        self.assertIn('Pen/A maior/Blues', B.listar_faixas(self.db, a)['pastas'])

    def test_pasta_limpa(self):
        self.assertEqual(B._pasta(' A maior \\ Blues/ '), 'A maior/Blues')
        self.assertEqual(B._pasta('../../etc/./x'), 'etc/x')
        self.assertEqual(B._pasta(None), '')
        with self.assertRaises(B.Erro):
            B._pasta('/'.join('abcdefg'))

    def test_repetida_nao_duplica(self):
        a = B.usuario_local(self.db)['id']
        f1 = B.guardar_faixa(self.db, a, 'x.mp3', _leitor(b'ID3abc'), 6, pasta='P')
        f2 = B.guardar_faixa(self.db, a, 'x.mp3', _leitor(b'ID3abc'), 6, pasta='P')
        self.assertEqual((f2['id'], f2.get('repetida')), (f1['id'], True))
        self.assertNotEqual(B.guardar_faixa(self.db, a, 'x.mp3', _leitor(b'ID3abc'), 6, pasta='Q')['id'], f1['id'])

    def test_mover_e_apagar_pasta(self):
        a = B.usuario_local(self.db)['id']
        ids = [B.guardar_faixa(self.db, a, n, _leitor(b'ID3abc'), 6, pasta=p)['id']
               for n, p in (('1.mp3', 'A maior'), ('2.mp3', 'A maior/Blues'), ('3.mp3', 'A maiores'), ('4.mp3', 'E menor'))]
        self.assertEqual(B.mover_pasta(self.db, a, 'A maior', 'Tons/Lá maior'), 2)  # 'A maiores' fica onde está
        self.assertEqual(B.listar_faixas(self.db, a)['pastas'], ['A maiores', 'E menor', 'Tons', 'Tons/Lá maior', 'Tons/Lá maior/Blues'])
        self.assertEqual(len(B.listar_faixas(self.db, a, pasta='Tons')['faixas']), 2)
        with self.assertRaises(B.Erro):
            B.mover_pasta(self.db, a, 'Tons', 'Tons/Dentro')
        caminho = B.caminho_faixa(self.db, a, ids[1])[0]
        self.assertEqual(B.apagar_pasta(self.db, a, 'Tons'), 2)
        self.assertFalse(os.path.exists(caminho))
        self.assertEqual([x['id'] for x in B.listar_faixas(self.db, a)['faixas']], [ids[2], ids[3]])
        self.assertEqual(B.mudar_faixa(self.db, a, ids[3], {'pasta': 'E menor/Pop'})['pasta'], 'E menor/Pop')

    @unittest.skipUnless(B.ffmpeg(), 'ffmpeg não instalado')
    def test_wav_vira_m4a(self):
        a = B.usuario_local(self.db)['id']
        caminho = os.path.join(TMP, 'tom.wav')
        with wave.open(caminho, 'wb') as w:  # 2 s de onda, 44,1 kHz, 16 bits
            w.setnchannels(2); w.setsampwidth(2); w.setframerate(44100)
            w.writeframes(b''.join(struct.pack('<hh', v, v) for v in ((i * 300) % 20000 - 10000 for i in range(88200))))
        tam = os.path.getsize(caminho)
        with open(caminho, 'rb') as fh:
            f = B.guardar_faixa(self.db, a, 'Blues em A.wav', fh.read, tam, pasta='A')
        disco, mime = B.caminho_faixa(self.db, a, f['id'])
        self.assertEqual((mime, os.path.splitext(disco)[1], f['original'], f['origem']), ('audio/mp4', '.m4a', tam, 'Blues em A.wav'))
        self.assertLess(f['tamanho'], tam / 5)
        self.assertFalse([x for x in os.listdir(os.path.dirname(disco)) if x.endswith('.wav')])  # o WAV não fica

    def test_migra_banco_antigo_com_ritmo(self):
        import sqlite3
        pasta = tempfile.mkdtemp(dir=TMP)
        velho = sqlite3.connect(os.path.join(pasta, 'app.db'))
        velho.executescript(B.ESQUEMA.split('CREATE TABLE IF NOT EXISTS faixas')[0] + """
CREATE TABLE faixas (id INTEGER PRIMARY KEY, usuario INTEGER NOT NULL, nome TEXT NOT NULL, ritmo TEXT NOT NULL DEFAULT '',
  tom TEXT NOT NULL DEFAULT '', bpm INTEGER, arquivo TEXT NOT NULL, mime TEXT NOT NULL, tamanho INTEGER NOT NULL,
  criado TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
INSERT INTO usuarios (nome, email, senha) VALUES ('Eu', 'local@braco.local', 'x');
INSERT INTO faixas (usuario, nome, ritmo, arquivo, mime, tamanho) VALUES (1, 'Velha', 'Blues', 'a.mp3', 'audio/mpeg', 3);""")
        velho.commit(); velho.close()
        antes, B.DADOS = B.DADOS, pasta
        try:
            db = B.conectar()
            self.assertEqual([(f['nome'], f['pasta']) for f in B.listar_faixas(db, 1)['faixas']], [('Velha', 'Blues')])
            B.guardar_faixa(db, 1, 'nova.mp3', _leitor(b'ID3'), 3, pasta='Rock')
            db.close()
        finally:
            B.DADOS = antes


def _leitor(dado):
    pos = [0]
    def ler(n):
        b = dado[pos[0]:pos[0] + n]; pos[0] += len(b); return b
    return ler


class Servidor(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        db = B.conectar()
        for t in ('sessoes', 'faixas', 'progressoes', 'usuarios'):
            db.execute(f'DELETE FROM {t}')
        db.commit(); db.close()
        serve.limite = B.Limite()
        serve.LOGIN = True  # estes testes são do modo com contas
        socketserver.TCPServer.allow_reuse_address = True
        cls.srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), serve.H)
        cls.porta = cls.srv.server_address[1]
        threading.Thread(target=cls.srv.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.srv.shutdown(); cls.srv.server_close()

    def req(self, metodo, rota, corpo=None, cookie=None, app=True, extra=None):
        c = http.client.HTTPConnection('127.0.0.1', self.porta, timeout=10)
        h = dict(extra or {})
        if app: h['X-Braco'] = '1'
        if cookie: h['Cookie'] = cookie
        if isinstance(corpo, dict):
            corpo = json.dumps(corpo).encode(); h['Content-Type'] = 'application/json'
        c.request(metodo, rota, body=corpo, headers=h)
        r = c.getresponse(); dados = r.read(); c.close()
        return r, dados

    def test_fluxo_completo(self):
        r, d = self.req('GET', '/api/estado')
        d = json.loads(d); d.pop('comprime')
        self.assertEqual(d, {'usuario': None, 'cadastro': True, 'login': True})
        r, _ = self.req('GET', '/api/faixas')
        self.assertEqual(r.status, 401)
        # sem o cabeçalho do app, pedido que muda dados é recusado (proteção contra outro site)
        r, _ = self.req('POST', '/api/cadastro', {'nome': 'Vô', 'email': 'vo@e.com', 'senha': 'senha1234'}, app=False)
        self.assertEqual(r.status, 403)
        r, d = self.req('POST', '/api/cadastro', {'nome': 'Vô', 'email': 'vo@e.com', 'senha': 'senha1234'})
        self.assertEqual(r.status, 200, d)
        ck = r.getheader('Set-Cookie')
        self.assertIn('HttpOnly', ck); self.assertIn('SameSite=Strict', ck)
        cookie = ck.split(';')[0]
        self.assertFalse(json.loads(self.req('GET', '/api/estado')[1])['cadastro'])  # fechou depois da 1ª conta

        audio = b'ID3' + bytes(range(256)) * 40
        r, d = self.req('POST', '/api/faixas?arquivo=Blues%20em%20A%2090bpm.mp3&pasta=A%20maior%2FBlues', audio, cookie=cookie)
        self.assertEqual(r.status, 201, d)
        fid = json.loads(d)['id']
        r, d = self.req('GET', f'/api/faixas/{fid}/audio', cookie=cookie)
        self.assertEqual((r.status, d, r.getheader('Accept-Ranges')), (200, audio, 'bytes'))
        r, d = self.req('GET', f'/api/faixas/{fid}/audio', cookie=cookie, extra={'Range': 'bytes=10-19'})
        self.assertEqual((r.status, d, r.getheader('Content-Range')), (206, audio[10:20], f'bytes 10-19/{len(audio)}'))
        r, d = self.req('GET', f'/api/faixas/{fid}/audio', cookie=cookie, extra={'Range': 'bytes=-5'})
        self.assertEqual(d, audio[-5:])
        r, _ = self.req('GET', f'/api/faixas/{fid}/audio', cookie=cookie, extra={'Range': f'bytes={len(audio) + 5}-'})
        self.assertEqual(r.status, 416)
        r, _ = self.req('GET', f'/api/faixas/{fid}/audio')
        self.assertEqual(r.status, 401)  # sem conta, sem áudio

        r, d = self.req('PUT', '/api/progressoes', {'progressoes': [{'name': 'A'}]}, cookie=cookie)
        self.assertEqual(r.status, 200)
        self.assertEqual(json.loads(self.req('GET', '/api/progressoes', cookie=cookie)[1])['progressoes'], [{'name': 'A'}])

        r, _ = self.req('POST', '/api/sair', {}, cookie=cookie)
        self.assertIn('Max-Age=0', r.getheader('Set-Cookie'))
        self.assertEqual(self.req('GET', '/api/faixas', cookie=cookie)[0].status, 401)

    def test_arquivos_protegidos_e_site(self):
        self.assertEqual(self.req('GET', '/')[0].status, 200)
        r, _ = self.req('GET', '/app.js')
        self.assertEqual((r.status, r.getheader('Content-Type')), (200, 'text/javascript; charset=utf-8'))  # mesmo no Windows
        for rota in ('/dados/app.db', '/backend.py', '/serve.py', '/.git/config', '/CLAUDE.md', '/test/test_backend.py', '/icons/', '/%2e%2e/etc/passwd'):
            self.assertEqual(self.req('GET', rota)[0].status, 404, rota)

    def test_limite_de_tentativas_no_servidor(self):
        db = B.conectar()
        if not B.tem_usuarios(db):
            B.cadastrar(db, 'X', 'x@e.com', 'senha1234')
        db.close()
        serve.limite = B.Limite(maximo=2, janela=60)
        for _ in range(2):
            self.assertEqual(self.req('POST', '/api/entrar', {'email': 'x@e.com', 'senha': 'errada'})[0].status, 401)
        self.assertEqual(self.req('POST', '/api/entrar', {'email': 'x@e.com', 'senha': 'errada'})[0].status, 429)
        serve.limite = B.Limite()


class ServidorSimples(unittest.TestCase):
    """Sem BRACO_LOGIN: nada de conta nem senha, tudo funciona direto."""
    @classmethod
    def setUpClass(cls):
        db = B.conectar()
        for t in ('sessoes', 'faixas', 'progressoes', 'usuarios'):
            db.execute(f'DELETE FROM {t}')
        db.commit(); db.close()
        cls.antes, serve.LOGIN = serve.LOGIN, False
        cls.srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), serve.H)
        cls.porta = cls.srv.server_address[1]
        threading.Thread(target=cls.srv.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.srv.shutdown(); cls.srv.server_close(); serve.LOGIN = cls.antes

    req = Servidor.req

    def test_sem_login(self):
        d = json.loads(self.req('GET', '/api/estado')[1])
        self.assertFalse(d['login']); self.assertTrue(d['usuario'])
        r, d = self.req('POST', '/api/faixas?arquivo=Blues%20em%20A.mp3&pasta=Tons%2FBlues', b'ID3abc')
        self.assertEqual(r.status, 201, d)
        r, d = self.req('POST', '/api/faixas?arquivo=Blues%20em%20A.mp3&pasta=Tons%2FBlues', b'ID3abc')
        self.assertEqual((r.status, json.loads(d)['repetida']), (200, True))  # mesmo arquivo de novo não duplica
        self.assertEqual(len(json.loads(self.req('GET', '/api/faixas')[1])['faixas']), 1)
        r, d = self.req('POST', '/api/pastas/mover', {'de': 'Tons', 'para': 'Meus tons'})
        self.assertEqual(json.loads(d), {'mudaram': 1})
        self.assertEqual(json.loads(self.req('GET', '/api/faixas')[1])['pastas'], ['Meus tons', 'Meus tons/Blues'])
        self.assertEqual(json.loads(self.req('POST', '/api/pastas/apagar', {'pasta': 'Meus tons'})[1]), {'apagadas': 1})
        self.assertEqual(self.req('POST', '/api/entrar', {'email': 'a@a.com', 'senha': 'x'})[0].status, 404)
        self.assertEqual(self.req('POST', '/api/faixas?arquivo=x.mp3', b'ID3', app=False)[0].status, 403)  # proteção continua


if __name__ == '__main__':
    unittest.main()
