# Servidor do app: arquivos do site (sem cache) + API de contas, faixas e progressões.
#   python3 serve.py                      -> http://localhost:5173
#   python3 serve.py importar <pasta> [e-mail]   -> copia os áudios da pasta (subpasta = ritmo)
#   HOST=0.0.0.0 python3 serve.py         -> aceita acesso de outros aparelhos da rede (cuidado)
#   BRACO_LOGIN=1 python3 serve.py        -> liga contas com e-mail e senha (para vender / várias pessoas).
#                                            Sem isso, modo simples: sem login, tudo guardado neste computador.
import http.server, json, os, re, socketserver, sys
from http.cookies import SimpleCookie
from urllib.parse import urlsplit, parse_qs, unquote
import backend as B

PORTA = int(os.environ.get('PORT', 5173))
HOST = os.environ.get('HOST', '127.0.0.1')
LOGIN = os.environ.get('BRACO_LOGIN') == '1'
CADASTRO_ABERTO = os.environ.get('BRACO_CADASTRO') == '1'
COOKIE = 'braco_sessao'
ESTATICOS = {'.html', '.js', '.css', '.svg', '.png', '.webmanifest', '.ico', '.json', '.txt'}
limite = B.Limite()


class H(http.server.SimpleHTTPRequestHandler):
    server_version = 'Braco'
    sys_version = ''

    def __init__(self, *a, **k):
        super().__init__(*a, directory=B.RAIZ, **k)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()

    def log_message(self, fmt, *args):
        if args and '/api/' in str(args[0]):
            super().log_message(fmt, *args)

    # ---------- arquivos do site: só os tipos do app, nunca dados/, .git, .py, banco ----------
    def send_head(self):
        p = unquote(urlsplit(self.path).path)
        partes = [x for x in p.split('/') if x]
        if partes and (partes[0] in ('dados', 'test', 'docs', 'node_modules') or any(x.startswith('.') for x in partes)):
            self.send_error(404); return None
        if p != '/' and not p.endswith('/') and os.path.splitext(p)[1].lower() not in ESTATICOS:
            self.send_error(404); return None
        return super().send_head()

    def list_directory(self, path):  # nunca lista o conteúdo das pastas
        self.send_error(404); return None

    # ---------- utilidades ----------
    def _token(self):
        c = SimpleCookie(self.headers.get('Cookie', ''))
        return c[COOKIE].value if COOKIE in c else None

    def _json(self, status, dados, cookie=None):
        corpo = json.dumps(dados, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(corpo)))
        if cookie is not None:
            self.send_header('Set-Cookie', cookie)
        self.end_headers()
        self.wfile.write(corpo)

    def _cookie(self, token, idade):
        seguro = '; Secure' if self.headers.get('X-Forwarded-Proto') == 'https' else ''
        return f'{COOKIE}={token}; Path=/; HttpOnly; SameSite=Strict; Max-Age={idade}{seguro}'

    def _corpo_json(self):
        n = int(self.headers.get('Content-Length') or 0)
        if n > B.MAX_PROGS + 1024:
            raise B.Erro(413, 'Pedido grande demais.')
        try:
            return json.loads(self.rfile.read(n) or b'{}')
        except ValueError:
            raise B.Erro(400, 'Pedido inválido.')

    def _usuario(self, db):
        if not LOGIN:
            return B.usuario_local(db)
        u = B.usuario_da_sessao(db, self._token())
        if not u:
            raise B.Erro(401, 'Entre na sua conta.')
        return u

    def _ip(self):
        return self.client_address[0]

    # ---------- roteamento ----------
    def do_GET(self):
        if self.path.startswith('/api/'):
            return self._api('GET')
        return super().do_GET()

    def do_HEAD(self):
        if self.path.startswith('/api/'):
            self.send_error(405); return
        return super().do_HEAD()

    def do_POST(self): self._api('POST')
    def do_PUT(self): self._api('PUT')
    def do_PATCH(self): self._api('PATCH')
    def do_DELETE(self): self._api('DELETE')

    def _api(self, metodo):
        url = urlsplit(self.path)
        rota, q = url.path, parse_qs(url.query)
        db = None
        try:
            # proteção contra outro site mandando pedidos com o cookie: exige o cabeçalho do app
            if metodo != 'GET' and self.headers.get('X-Braco') != '1':
                raise B.Erro(403, 'Pedido recusado.')
            db = B.conectar()
            self._rota(db, metodo, rota, q)
        except B.Erro as e:
            self._json(e.status, {'erro': e.msg})
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception as e:  # nunca mostra detalhes internos para quem pediu
            self.log_error('erro interno: %r', e)
            self._json(500, {'erro': 'Algo deu errado no servidor.'})
        finally:
            if db is not None:
                db.close()

    def _rota(self, db, metodo, rota, q):
        m = re.fullmatch(r'/api/faixas/(\d+)(/audio)?', rota)
        if rota == '/api/estado' and metodo == 'GET':
            if not LOGIN:
                return self._json(200, {'usuario': B.usuario_local(db), 'cadastro': False, 'login': False})
            return self._json(200, {'usuario': B.usuario_da_sessao(db, self._token()),
                                    'cadastro': CADASTRO_ABERTO or not B.tem_usuarios(db), 'login': True})
        if not LOGIN and rota in ('/api/cadastro', '/api/entrar', '/api/sair', '/api/senha'):
            raise B.Erro(404, 'As contas estão desligadas neste computador.')
        if rota == '/api/cadastro' and metodo == 'POST':
            d = self._corpo_json()
            B.cadastrar(db, d.get('nome'), d.get('email'), d.get('senha'), aberto=CADASTRO_ABERTO)
            return self._entrar(db, d)
        if rota == '/api/entrar' and metodo == 'POST':
            return self._entrar(db, self._corpo_json())
        if rota == '/api/sair' and metodo == 'POST':
            B.sair(db, self._token())
            return self._json(200, {'ok': True}, cookie=self._cookie('', 0))
        if rota == '/api/senha' and metodo == 'POST':
            u, d = self._usuario(db), self._corpo_json()
            B.trocar_senha(db, u['id'], d.get('atual'), d.get('nova'))
            return self._json(200, {'ok': True}, cookie=self._cookie('', 0))

        u = self._usuario(db)  # daqui para baixo, só com conta
        if rota == '/api/faixas' and metodo == 'GET':
            return self._json(200, B.listar_faixas(db, u['id'], (q.get('ritmo') or [''])[0], (q.get('q') or [''])[0]))
        if rota == '/api/faixas' and metodo == 'POST':
            n = int(self.headers.get('Content-Length') or 0)
            g = lambda k: (q.get(k) or [None])[0]
            f = B.guardar_faixa(db, u['id'], g('arquivo'), self.rfile.read, n, ritmo=g('ritmo') or '', nome=g('nome'), tom=g('tom'), bpm=g('bpm'))
            return self._json(201, f)
        if m and m.group(2) and metodo == 'GET':
            return self._audio(*B.caminho_faixa(db, u['id'], int(m.group(1))))
        if m and not m.group(2) and metodo == 'PATCH':
            return self._json(200, B.mudar_faixa(db, u['id'], int(m.group(1)), self._corpo_json()))
        if m and not m.group(2) and metodo == 'DELETE':
            B.apagar_faixa(db, u['id'], int(m.group(1)))
            return self._json(200, {'ok': True})
        if rota == '/api/progressoes' and metodo == 'GET':
            return self._json(200, B.ler_progressoes(db, u['id']))
        if rota == '/api/progressoes' and metodo == 'PUT':
            return self._json(200, {'atualizado': B.gravar_progressoes(db, u['id'], self._corpo_json().get('progressoes'))})
        raise B.Erro(404, 'Não encontrado.')

    def _entrar(self, db, d):
        ip = self._ip()
        if limite.bloqueado(ip):
            raise B.Erro(429, 'Muitas tentativas erradas. Espere 10 minutos e tente de novo.')
        try:
            token, u = B.entrar(db, d.get('email'), d.get('senha'))
        except B.Erro:
            limite.erro(ip)
            raise
        limite.limpar(ip)
        return self._json(200, {'usuario': u}, cookie=self._cookie(token, B.SESSAO_DIAS * 86400))

    # áudio com suporte a Range: o Safari só toca e deixa avançar a música assim
    def _audio(self, caminho, mime):
        if not os.path.exists(caminho):
            raise B.Erro(404, 'O arquivo desta faixa sumiu do disco.')
        total = os.path.getsize(caminho)
        ini, fim, parcial = 0, total - 1, False
        r = re.fullmatch(r'bytes=(\d*)-(\d*)', self.headers.get('Range', '').strip())
        if r and (r.group(1) or r.group(2)):
            if r.group(1):
                ini = int(r.group(1)); fim = min(int(r.group(2)), total - 1) if r.group(2) else total - 1
            else:
                ini = max(0, total - int(r.group(2)))
            if ini > fim or ini >= total:
                self.send_response(416); self.send_header('Content-Range', f'bytes */{total}'); self.end_headers(); return
            parcial = True
        self.send_response(206 if parcial else 200)
        self.send_header('Content-Type', mime)
        self.send_header('Accept-Ranges', 'bytes')
        self.send_header('Content-Length', str(fim - ini + 1))
        if parcial:
            self.send_header('Content-Range', f'bytes {ini}-{fim}/{total}')
        self.end_headers()
        with open(caminho, 'rb') as f:
            f.seek(ini)
            resta = fim - ini + 1
            while resta > 0:
                bloco = f.read(min(resta, 1 << 16))
                if not bloco:
                    break
                self.wfile.write(bloco)
                resta -= len(bloco)


def importar(pasta, email=None):
    db = B.conectar()
    try:
        u = db.execute('SELECT * FROM usuarios WHERE email = ?', (email.lower(),)).fetchone() if email else B.usuario_local(db)
        if not u:
            sys.exit(f'Nenhuma conta com o e-mail {email}.')
        if not os.path.isdir(pasta):
            sys.exit(f'Pasta não encontrada: {pasta}')
        print(f'Importando de {pasta}…')
        feitos, pulados = B.importar_pasta(db, u['id'], pasta)
        print(f'Pronto: {feitos} faixa(s) nova(s), {pulados} já existiam.')
    finally:
        db.close()


if __name__ == '__main__':
    if len(sys.argv) >= 3 and sys.argv[1] == 'importar':
        importar(sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None)
        sys.exit(0)
    B.conectar().close()
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    socketserver.ThreadingTCPServer.daemon_threads = True
    with socketserver.ThreadingTCPServer((HOST, PORTA), H) as s:
        print(f'http://localhost:{PORTA}' + ('' if HOST == '127.0.0.1' else f'  (aberto na rede em {HOST})'))
        s.serve_forever()
