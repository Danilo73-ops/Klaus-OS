#!/usr/bin/env python3
# Python 3 / Termux native / Chrome Android -> Firefox KDE Plasma :3 clipboard.
"""Loopback-only clipboard bridge. No Termux:API and no extra dependencies."""
import json
import os
import subprocess
import sys
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HOST = "127.0.0.1"
PORT = 18087
MAX_BYTES = 512 * 1024

PAGE = """<!doctype html><html lang="pt-BR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Klaus OS · Colar prompts</title>
<style>
:root{color-scheme:dark;font-family:system-ui,sans-serif}
body{margin:0;background:#08111d;color:#eaf7ff;padding:20px 14px}
main{max-width:660px;margin:16px auto;background:#132338;border:1px solid #38516e;border-radius:18px;padding:24px}
h1{font-size:23px;margin:0 0 8px}h2{font-size:17px;margin:22px 0 10px}
p{line-height:1.5;color:#adc7df}textarea{width:100%;box-sizing:border-box;min-height:165px;background:#091723;border:1px solid #496783;border-radius:10px;color:#fff;font:14px/1.6 monospace;padding:12px}
button,.file{border:0;border-radius:10px;background:#26d5c3;padding:13px 14px;font-size:14px;font-weight:750;color:#062234;cursor:pointer}
button:disabled{opacity:.4;cursor:default}
.secondary{background:#304a66;color:#fff}
.row{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
.row button,.row .file{flex:1}
.file input{display:none}#notice{min-height:32px;margin-top:14px;color:#78e4cb}
#queueStatus{font-weight:700;color:#bfe7ff}#currentTitle{color:#fff;overflow-wrap:anywhere}
small{color:#adc7df}hr{border:0;border-top:1px solid #38516e;margin:24px 0}
</style></head><body><main><h1>⚡ Klaus OS · Clipboard instantâneo</h1>
<p>Transfere textos do Chrome Android para o Firefox no AVNC, sem digitar letra por letra.</p>
<h2>📦 Importar vários prompts de uma vez</h2>
<p>Escolha um arquivo .json/.txt (até 25 prompts) ou cole o lote no campo abaixo.</p>
<div class="row"><label class="file">📂 Selecionar .json ou .txt
<input id="batchFile" type="file" accept=".txt,.json,text/plain,application/json"></label></div>
<textarea id="batchText" placeholder="PROMPT 01 — ...&#10;&#10;PROMPT 02 — ...&#10;&#10;PROMPT 03 — ..." spellcheck="false"></textarea>
<div class="row"><button id="loadBatch" class="secondary">Carregar lote do campo</button></div>
<p id="queueStatus" aria-live="polite">Nenhum lote carregado.</p>
<div id="queueControls" hidden>
<p id="currentTitle"></p>
<div class="row">
<button id="previousPrompt" class="secondary">◀ Anterior</button>
<button id="sendCurrent">📋 Enviar atual</button>
<button id="nextPrompt">Próximo + enviar ▶</button>
</div>
<p>O botão <b>Próximo + enviar</b> transfere o seguinte para o clipboard e avança apenas após sucesso. Depois, dê Ctrl+V no Firefox.</p>
</div>
<hr>
<h2>✍️ Enviar um prompt avulso</h2>
<textarea id="prompt" placeholder="Cole um prompt único..." spellcheck="false"></textarea>
<div class="row"><button id="send">📋 Enviar ao Klaus OS</button></div>
<p id="notice" role="status"></p>
<small>Somente 127.0.0.1 · A fila fica salva apenas neste navegador · Sem Termux:API · Não clica em Gerar nem consome créditos</small>
</main><script src="/app.js"></script></body></html>"""


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
        self.send_header("Content-Security-Policy", "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'none'")
        self.end_headers()
        self.wfile.write(body)

    def message(self, code, **data):
        self.reply(code, json.dumps(data, ensure_ascii=False).encode("utf-8"),
                   "application/json; charset=utf-8")

    def do_GET(self):
        if self.path == "/":
            self.reply(200, PAGE.encode("utf-8"), "text/html; charset=utf-8")
            return
        if self.path == "/app.js":
            try:
                content = Path(__file__).with_name("clipboard-bridge-ui.js").read_bytes()
            except OSError:
                self.message(503, error="Arquivo de interface ausente. Atualize Klaus-OS.")
                return
            self.reply(200, content, "text/javascript; charset=utf-8")
            return
        self.send_error(404)

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
                input=raw, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
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
