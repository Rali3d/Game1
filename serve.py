"""Tiny dev server for Fieldborn: like `python3 -m http.server`, but tells the browser to check for
changes on every load (so edited files always show up) and copes with many parallel requests.
Usage: python3 serve.py [port]"""
import http.server
import os
import socketserver
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
os.chdir(os.path.dirname(os.path.abspath(__file__)))


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')  # revalidate every time
        super().end_headers()


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True
    request_queue_size = 128  # the default (5) drops connections when the game loads its models


print(f'Fieldborn running at http://localhost:{PORT}')
Server(('127.0.0.1', PORT), NoCacheHandler).serve_forever()
