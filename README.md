<div align="center">

# Text Sentiment Analysis Platform

Multi‑page Flask application for analyzing text sentiment, chatting with an empathetic bot, batch CSV processing, keyword extraction, word‑cloud generation, PDF report export, and per‑user persisted settings.

</div>

## ✨ Features
- Text analysis (VADER + simple rule model) with emoji, bar chart & animated score bars
- Language detection, YAKE keyword extraction, word cloud (PNG inline)
- Batch CSV analysis + downloadable enriched CSV
- PDF report export (scores, keywords, wordcloud)
- Auth (register/login) + per‑user history & settings (tone, model, accent)
- Chatbot with sentiment + intent responses, typing indicator, quick reply chips
- History table (sortable + searchable)
- Drag & drop CSV zone, accent theme picker (blue/purple/cyan), dark/light toggle
- Swagger/OpenAPI docs at `/api/docs` & health at `/health`
- Rate limiting (Flask-Limiter)

## 🔧 Prerequisites
- Python 3.10+ recommended (works on 3.8+)
- PowerShell (Windows) or any POSIX shell

## 🏁 Quick Start (One Line)
```powershell
python -m venv .venv; . .\.venv\Scripts\Activate; pip install -r requirements.txt; python run_server.py
```
Open http://127.0.0.1:5000

Dev (with auto reload):
```powershell
python app.py
```

### Linux/macOS (expanded)
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python run_server.py
```

## 📁 Key Files
| File | Purpose |
|------|---------|
| `app.py` | Core Flask app (routes, analysis, chat, PDF) |
| `run_server.py` | Stable runner (no reloader) |
| `static/main.js` | Frontend logic (analysis, chat, CSV, history) |
| `static/styles.css` | Theme + components |
| `templates/` | Jinja HTML pages |
| `data/app.db` | SQLite database (auto-created) |

## 🧠 Chatbot
Intent detection (stress, sleep, focus, motivation, etc.), sentiment bars under each message, adaptive typing delay, tone modes: listening / coaching.

## 📝 PDF Export
`POST /export_pdf` with JSON `{ text, model }` returns a downloadable PDF summarizing the analysis.

## 🧪 API Summary
`POST /analyze`, `POST /analyze_file`, `POST /analyze_csv?format=csv`, `POST /chat`, `POST /export_pdf`, `GET /history`, `GET /settings`, `POST /settings`, `GET /api/docs`, `GET /health`.

## 🚀 Deployment Notes
- Use a production WSGI server (gunicorn, waitress, uwsgi)
- Set `SECRET_KEY` env var
- Configure persistent rate limit storage (Redis) for Flask-Limiter

## 👤 Handover Steps (Shrusthi)
1. Clone repo
2. Run the quick start one-liner
3. Visit `/register` then log in
4. Analyze text, try chat, upload CSV, view history, export PDF
5. Change accent/theme in Settings; verify persistence

## 🧹 Simplifications
- Guarded canvas usage (fixes `getContext` null error)
- Chat logic only initializes if chat DOM exists
- Separate `run_server.py` for stable launches

## 🛠 Troubleshooting
| Issue | Fix |
|-------|-----|
| Null getContext error | Update to latest `static/main.js` (canvas guard added) |
| 429 Too Many Requests | Wait for limit window; lower request rate |
| Missing wordcloud | Ensure `wordcloud` lib installed & text not empty |
| PDF error | Confirm `reportlab` installed |
| No keywords | Very short text – try longer input |

## 📄 License
Coursework / demo use.

---
Maintained for learning & experimentation.
\n+## 🔒 Security Notes (CSP)
This app sets a strict Content Security Policy via an `@after_request` hook:

```
default-src 'self';
script-src 'self' https://cdn.jsdelivr.net;
style-src 'self' 'unsafe-inline';
img-src 'self' data:;
font-src 'self';
connect-src 'self';
object-src 'none';
base-uri 'self';
frame-ancestors 'self';
```

Why:
- Blocks inline `<script>` blocks (we externalized scripts: `base_init.js`, `settings.js`, `main.js`).
- Disallows `eval` / `new Function` by omission of `unsafe-eval`.
- Permits Chart.js from jsDelivr CDN only.

If you need another CDN (example: unpkg):
1. Edit `script-src` to include the host.
2. Prefer Subresource Integrity (SRI) when adding 3rd‑party scripts.

If you add inline styles, keep `style-src 'unsafe-inline'` or migrate them to CSS files to remove it for stricter posture.

Never add `unsafe-inline` for scripts unless absolutely necessary; instead move logic to external `.js` files.

### Extending CSP
To enable API calls to another domain:
`connect-src 'self' https://api.example.com;`

To embed images from a CDN:
`img-src 'self' data: https://images.example.com;`

---
