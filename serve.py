# Servidor local sem cache: python3 serve.py
import http.server, socketserver
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
socketserver.TCPServer.allow_reuse_address = True
with socketserver.ThreadingTCPServer(('', 5173), H) as s:
    print('http://localhost:5173'); s.serve_forever()
