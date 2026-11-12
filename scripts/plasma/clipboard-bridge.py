#!/usr/bin/env python3
# Python 3 / Termux native / Chrome Android -> Firefox KDE Plasma :3 clipboard.
"""Loopback-only clipboard bridge. No Termux:API and no extra dependencies."""
import json
import os
import subprocess
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HOST = "127.0.0.1"
PORT = 18087
MAX_BYTES = 512 * 1024

PAGE = """<!doctype html><html lang="pt-BR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Klaus OS · Colar prompt</title>
<style>
:root{color-scheme:dark;font-family:system-ui,sans-serif}
body{margin:0;background:#08111d;color:#eaf7ff;padding:24px 14px}
main{max-width:650px;margin:25px auto;background:#132338;border:1px solid #38516e;border-radius:18px;padding:24px}
h1{font-size:23px;margin:0 0 8px}p{line-height:1.5;color:#adc7df}
textarea{width:100%;box-sizing:border-box;min-height:260px;background:#091723;border:1px solid #496783;border-radius:10px;color:#fff;font:14px/1.6 monospace;padding:12px}
button{border:0;border-radius:10px;background:#26d5c3;padding:14px 22px;font-size:15px;font-weight:800;color:#062234;cursor:pointer;margin-top:14px;width:100%}
#notice{min-height:32px;margin-top:14px;color:#78e4cb}small{color:#adc7df}
</style></head><body><main><h1>⚡ Klaus OS · Colar instantâneo</h1>
<p>Copie seu prompt no Android, cole aqui e toque em <b>Enviar ao Klaus OS</b>. No Firefox do AVNC, pressione <b>Ctrl+V</b>.</p>
<textarea id="prompt" placeholder="Cole o prompt completo aqui..." spellcheck="false"></textarea>
<button id="send">📋 Enviar ao Klaus OS</button><p id="notice" role="status"></p>
<small>Funciona só neste celular · Não envia para a internet · Não salva prompts · Não inicia geração</small>
</main><script>
const box=document.querySelector('#prompt'),notice=document.querySelector('#notice');
document.querySelector('#send').addEventListener('click',async()=>{
if(!box.value){notice.textContent='Cole um prompt primeiro.';return}
notice.textContent='Transferindo...';
try{
 const r=await fetch('/clipboard',{method:'POST',headers:{'Content-Type':'text/plain; charset=utf-8'},body:box.value});
 const data=await r.json();
 if(!r.ok)throw Error(data.error||'Falha ao transferir');
 notice.textContent='✅ '+data.characters+' caracteres prontos. Volte ao Firefox e aperte Ctrl+V.';
}catch(e){notice.textContent='❌ '+e.message}
});
</script></body></html>"""


class Handler(BaseHTTPRequestHandler):
    server_version = "KlausClipboard/1.0"

    def log_message(self, pattern, *args):
        # Only method, endpoint and status, never clipboard content.
        print("[Klaus Clipboard] " + pattern % args, flush=True)

    def reply(self, code, body, content_type):
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Content-Security-Policy", "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'none'")
        self.end_headers()
        self.wfile.write(body)

    def message(self, code, **data):
        self.reply(code, json.dumps(data, ensure_ascii=False).encode("utf-8"),
                   "application/json; charset=utf-8")

    def do_GET(self):
        if self.path != "/":
            self.send_error(404)
            return
        self.reply(200, PAGE.encode("utf-8"), "text/html; charset=utf-8")

    def do_POST(self):
        if self.path != "/clipboard":
            self.message(404, error="Rota inválida")
            return
        if self.headers.get("Origin") not in (
            "http://127.0.0.1:" + str(PORT), "http://localhost:" + str(PORT)
        ):
            self.message(403, error="Origem bloqueada")
            return
        if not self.headers.get("Content-Type", "").lower().startswith("text/plain"):
            self.message(415, error="Tipo de conteúdo inválido")
            return
        try:
            size = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self.message(400, error="Tamanho inválido")
            return
        if not (0 < size <= MAX_BYTES):
            self.message(413, error="O limite é 512 KB")
            return
        raw = self.rfile.read(size)
        if len(raw) != size:
            self.message(400, error="Envio incompleto")
            return
        try:
            content = raw.decode("utf-8")
        except UnicodeDecodeError:
            self.message(400, error="O texto precisa ser UTF-8")
            return
        if not content.strip():
            self.message(400, error="Texto vazio")
            return
        env = dict(os.environ, DISPLAY=":3",
                   XAUTHORITY=os.path.expanduser("~/.Xauthority"))
        try:
            result = subprocess.run(
                ["xclip", "-selection", "clipboard", "-in"],
                input=raw, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE,
                env=env, timeout=8, check=False
            )
        except (OSError, subprocess.TimeoutExpired) as exc:
            self.message(503, error="O xclip não respondeu: " + type(exc).__name__)
            return
        if result.returncode != 0:
            self.message(503, error="Clipboard KDE :3 indisponível. Confira o Klaus OS.")
            return
        self.message(200, characters=len(content))


def main():
    try:
        server = ThreadingHTTPServer((HOST, PORT), Handler)
    except OSError as exc:
        sys.exit("[Klaus Clipboard] Porta indisponível: " + str(exc))
    print("[Klaus Clipboard] Abra no Chrome Android: http://127.0.0.1:18087", flush=True)
    print("[Klaus Clipboard] Ctrl+C para encerrar só a ponte. Firefox não será tocado.", flush=True)
    try:
        server.serve_forever(poll_interval=0.3)
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
