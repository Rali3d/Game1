"""Tiny dev server for Fieldborn: like `python3 -m http.server`, but tells the browser not to cache,
so edited files always reload. Usage: python3 serve.py [port]"""
import http.server
import os
import socketserver
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
os.chdir(os.path.dirname(os.path.abspath(__file__)))


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


print(f'Fieldborn running at http://localhost:{PORT}')
Server(('127.0.0.1', PORT), NoCacheHandler).serve_forever()
