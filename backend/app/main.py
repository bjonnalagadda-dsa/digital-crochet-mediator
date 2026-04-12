import re
import fitz
from fastapi import FastAPI, UploadFile, File, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from .stitch_library import lookup_stitch

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

TERM_RE = re.compile(
    r"\b(ch|sc|dc|hdc|tr|sl\s*st|rnd|round|row|rows|st|sts|inc|dec|tog|rep|repeat|sc2tog|hdc2tog|dc2tog|tr2tog|yo|sk|blo|flo)\b",
    re.IGNORECASE,
)

STEP_RE = re.compile(r"^(round|rnd|row|rows)\s*\d+[:\)]", re.IGNORECASE)

# ── Wizard of Oz WebSocket manager ──────────────────────────────────────────

class ConnectionManager:
    def __init__(self):
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket):
        self.active.remove(ws)

    async def broadcast(self, message: str):
        dead = []
        for ws in self.active:
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.active.remove(ws)


manager = ConnectionManager()


@app.websocket("/ws/control")
async def ws_control(websocket: WebSocket):
    """Phone clients connect here to receive next/previous commands."""
    await manager.connect(websocket)
    try:
        while True:
            # Keep alive — we don't expect messages from the phone
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)


@app.get("/control", response_class=HTMLResponse)
async def control_page():
    """Researcher control page — open this on your laptop browser."""
    return HTMLResponse(content=CONTROL_PAGE_HTML)


@app.post("/control/next")
async def send_next():
    await manager.broadcast("next")
    return {"sent": "next", "clients": len(manager.active)}


@app.post("/control/previous")
async def send_previous():
    await manager.broadcast("previous")
    return {"sent": "previous", "clients": len(manager.active)}


# ── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/parse-file")
async def parse_file(file: UploadFile = File(...)):
    data = await file.read()
    doc = fitz.open(stream=data, filetype="pdf")
    text = "\n".join([page.get_text() for page in doc])

    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]

    # Unique terms across full document
    found_terms = []
    for m in TERM_RE.finditer(text):
        term = re.sub(r"\s+", " ", m.group(0).lower().strip())
        found_terms.append(term)

    unique_terms = sorted(set(found_terms))

    # Add backend stitch metadata
    stitch_details = []
    for term in unique_terms:
        info = lookup_stitch(term)
        if info:
            stitch_details.append({
                "term": term,
                "title": info["title"],
                "definition": info["definition"],
                "tutorial_url": info["tutorial_url"],
            })
        else:
            stitch_details.append({
                "term": term,
                "title": term.upper(),
                "definition": "Definition not added yet.",
                "tutorial_url": "",
            })

    # Step extraction
    steps = []
    for ln in lines:
        if STEP_RE.search(ln):
            step_terms = []
            for m in TERM_RE.finditer(ln):
                term = re.sub(r"\s+", " ", m.group(0).lower().strip())
                step_terms.append(term)

            step_terms = sorted(set(step_terms))

            steps.append({
                "text": ln,
                "terms": step_terms,
                "term_details": [
                    {
                        "term": t,
                        **(
                            lookup_stitch(t)
                            if lookup_stitch(t)
                            else {
                                "title": t.upper(),
                                "definition": "Definition not added yet.",
                                "tutorial_url": "",
                            }
                        ),
                    }
                    for t in step_terms
                ],
            })

    return {
        "filename": file.filename,
        "unique_terms": unique_terms,
        "stitch_details": stitch_details,
        "steps": steps[:50],
        "text_preview": text[:800],
    }


# ── Researcher control page HTML ─────────────────────────────────────────────

CONTROL_PAGE_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Crochet Mediator — Researcher Control</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: system-ui, sans-serif;
    background: #0b1220;
    color: white;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 32px;
    padding: 24px;
  }
  h1 { font-size: 1.4rem; font-weight: 800; color: #2ec4b6; }
  #status {
    font-size: 0.9rem;
    padding: 8px 16px;
    border-radius: 20px;
    background: rgba(255,255,255,0.07);
    color: rgba(255,255,255,0.5);
  }
  #status.connected { background: rgba(46,196,182,0.15); color: #2ec4b6; }
  .btn-row { display: flex; gap: 20px; }
  button {
    font-size: 1.5rem;
    font-weight: 800;
    padding: 28px 56px;
    border: none;
    border-radius: 16px;
    cursor: pointer;
    transition: transform 0.1s, opacity 0.1s;
    user-select: none;
  }
  button:active { transform: scale(0.95); opacity: 0.85; }
  #btn-prev { background: rgba(46,196,182,0.15); color: #2ec4b6; border: 2px solid rgba(46,196,182,0.4); }
  #btn-next { background: #2ec4b6; color: #0b1220; }
  #log {
    width: 100%;
    max-width: 420px;
    background: rgba(255,255,255,0.04);
    border-radius: 12px;
    padding: 14px;
    font-size: 0.8rem;
    color: rgba(255,255,255,0.4);
    height: 120px;
    overflow-y: auto;
    font-family: monospace;
  }
  .hint { font-size: 0.78rem; color: rgba(255,255,255,0.3); text-align: center; line-height: 1.5; }
</style>
</head>
<body>
<h1>Researcher Control Panel</h1>
<div id="status">Connecting…</div>

<div class="btn-row">
  <button id="btn-prev" onclick="send('previous')">&#8592; Back</button>
  <button id="btn-next" onclick="send('next')">Next &#8594;</button>
</div>

<div id="log"></div>
<p class="hint">Keep this page open on your laptop.<br>Participant's phone will navigate when you click.</p>

<script>
  var apiBase = window.location.origin;
  var logEl = document.getElementById('log');
  var statusEl = document.getElementById('status');
  var clientCount = 0;

  function log(msg) {
    var line = document.createElement('div');
    line.textContent = new Date().toLocaleTimeString() + '  ' + msg;
    logEl.prepend(line);
  }

  // Poll /health to show connection indicator
  function checkHealth() {
    fetch(apiBase + '/health')
      .then(function(r) { return r.json(); })
      .then(function() {
        statusEl.textContent = 'Backend connected';
        statusEl.className = 'connected';
      })
      .catch(function() {
        statusEl.textContent = 'Backend unreachable';
        statusEl.className = '';
      });
  }
  checkHealth();
  setInterval(checkHealth, 5000);

  function send(cmd) {
    fetch(apiBase + '/control/' + cmd, { method: 'POST' })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        log('Sent "' + cmd + '" → ' + data.clients + ' phone(s) connected');
      })
      .catch(function(err) {
        log('ERROR: ' + err.message);
      });
  }

  // Keyboard shortcuts: ArrowLeft = previous, ArrowRight/Space = next
  document.addEventListener('keydown', function(e) {
    if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); send('next'); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); send('previous'); }
  });
</script>
</body>
</html>"""
