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
2. Option A (Windows one-liner): run the quick start line above
   
	Option B (recommended PowerShell helper):
	```powershell
	./start.ps1          # stable mode (run_server.py)
	./start.ps1 -Dev     # dev autoreload (app.py)
	```
3. (If first run) Register at `/register`
4. Log in and explore: Analyze text, Chat, Batch CSV, History, Export PDF
5. Change accent/theme & background/noise toggles in Settings
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

## 🌗 Light Theme
Optional light theme toggling adjusts color tokens for readability; no background image is used (pure gradient + subtle radial accents).

## 🧪 Running Tests
Basic sanity tests are in `tests/`.
```powershell
pytest -q
```
Or just run a single file:
```powershell
pytest tests/test_basic.py -q
```

## 🧾 Environment Variables
| Var | Purpose | Default |
|-----|---------|---------|
| SECRET_KEY | Flask session secret | dev-secret-change-me |
| PORT | Override port when running `app.py` | 5000 |

## 🔐 Security Summary
See CSP section below. Avoid inline scripts; add new external JS files under `static/`.

### Removed Background Image
Earlier versions used a large hero background image with progressive loading. This has been removed for a cleaner look and simpler deployment (only gradients + lightweight decorative radial layers remain).

### CSP & Source Maps
The CSP now allows `connect-src https://cdn.jsdelivr.net` so the browser can request Chart.js source maps without console warnings. This doesn’t broaden execution permissions—only fetch connections. If you don’t care about source maps in production, you can revert `connect-src` back to `'self'`.

## 📄 License
Coursework / demo use.

---
This app sets a strict Content Security Policy via an `@after_request` hook:
Maintained for learning & experimentation.

## 🧭 Comprehensive Client / Deployment Guide

This section is a full, copy‑paste friendly guide you can hand to any teammate or client so they can install, run, understand, customize, secure, deploy, and maintain the platform with minimal back‑and‑forth.

### 1. Overview
The application is a Flask monolith with:
- REST-ish JSON endpoints (analysis, chat, batch CSV, PDF export, settings, history)
- Server-rendered multi-page UI (Jinja templates)
- Frontend enhancements in plain JS (no framework) + Chart.js (CDN)
- SQLite persistence (users, settings, analyses)
- Light/dark + accent themes (CSS variables)
- Rate limiting (Flask-Limiter, in-memory by default)

### 2. Tech Stack
| Layer | Technology |
|-------|------------|
| Language | Python 3.10+ |
| Web Framework | Flask |
| Sentiment | VADER (nltk-free packaged) + simple rule model |
| Keywords | YAKE (optional, if installed) |
| Word Cloud | `wordcloud` (optional) |
| PDF | ReportLab (lazy-loaded) |
| DB | SQLite (file: `data/app.db`) |
| Auth | Session cookies + hashed passwords (Werkzeug) |
| Rate Limits | Flask-Limiter |
| Docs | Flasgger (Swagger UI at `/api/docs`) |
| Frontend | HTML + CSS + vanilla JS + Chart.js |

Optional libs gracefully degrade: if YAKE / wordcloud / reportlab are missing, related features return None / error objects without crashing core sentiment.

### 3. Directory Structure (Key Parts)
```
app.py              # Main Flask app
run_server.py       # Stable (non-reloader) runner
static/             # JS, CSS assets
templates/          # Jinja pages (home, analyze, chat, etc.)
data/app.db         # SQLite DB created on first run
tests/              # Basic pytest sanity tests
start.ps1           # Windows helper script
requirements.txt    # Python dependencies
```

### 4. Installation & First Run
#### Windows (PowerShell)
```powershell
git clone <repo-url> sentiment-app
cd sentiment-app
python -m venv .venv
. .\.venv\Scripts\Activate
pip install -r requirements.txt
python run_server.py
```
Visit: http://127.0.0.1:5000

#### macOS / Linux
```bash
git clone <repo-url> sentiment-app
cd sentiment-app
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python run_server.py
```

#### Development (auto reload)
```powershell
python app.py
```

### 5. Environment Variables
| Variable | Purpose | Example |
|----------|---------|---------|
| SECRET_KEY | Session signing secret | export SECRET_KEY='change-me' |
| PORT | Override dev port (app.py path) | PORT=8080 |

### 6. Database Schema (Simplified)
Tables:
1. `users(id, email, password_hash, created_at)`
2. `user_settings(user_id PK, default_tone, default_model, accent_theme, background_image_enabled, noise_enabled)` *(image-related flags now unused but harmless)*
3. `analyses(id, source, text_snippet, label, pos, neu, neg, compound, filename, created_at, user_id)`

To inspect locally:
```bash
sqlite3 data/app.db ".tables"
```

### 7. Authentication Flow
1. Register at `/register` (email + password)
2. Login at `/login` (sets session cookie)
3. Protected UI pages (history, settings) redirect to login if not authenticated
4. Settings changes persist accent, tone, model, toggles.

### 8. Core API Endpoints (Quick Reference)
| Method | Path | Description |
|--------|------|-------------|
| POST | /analyze | Analyze raw text JSON `{text, model?}` |
| POST | /analyze_file | Multipart .txt file upload |
| POST | /analyze_csv | CSV with `text` column; `?format=csv` for download |
| POST | /chat | Chat message `{message, tone?}` |
| POST | /export_pdf | Generate PDF for supplied text |
| GET | /history | Recent analyses (auth optional; user-specific if logged) |
| GET/POST | /settings | Get or update user settings (auth) |
| GET | /api/docs | Swagger UI |
| GET | /health | Health JSON |

Example (curl text analysis):
```bash
curl -X POST http://127.0.0.1:5000/analyze -H "Content-Type: application/json" -d '{"text":"Great day"}'
```

### 9. Frontend Notes
- No build step required.
- Chart.js loaded via jsDelivr (CSP allows only that host + self).
- Theme + accent manipulated via `data-accent` attribute.
- Score bars animate via CSS + JS intersection observer (auto present in main.js).

### 10. Customization Cheatsheet
| Goal | Where | How |
|------|-------|-----|
| Add new sentiment model | `analyze_text` in `app.py` | Extend `_resolve_model`, branch logic |
| Add new page | `templates/`, route in `app.py` | Create template + `@app.route` |
| Change accent palette | `static/styles.css` | Modify CSS variables under `:root` or accent selectors |
| Restrict history length | `get_history` | Adjust `limit` or enforce new cap |
| Add new API auth | Wrap routes | Use `@login_required`-style decorator (custom) |

### 11. Deployment (Production)
Do NOT use the Flask dev server in production.

Minimal Gunicorn (Linux):
```bash
pip install gunicorn
gunicorn -w 3 -b 0.0.0.0:8000 app:app
```

Waitress (Windows friendly):
```powershell
pip install waitress
python -c "from waitress import serve; from app import app; serve(app, host='0.0.0.0', port=8000)"
```

Reverse proxy (Nginx) example snippet:
```
location / {
	proxy_pass http://127.0.0.1:8000;
	proxy_set_header Host $host;
	proxy_set_header X-Forwarded-For $remote_addr;
}
```

### 12. (Optional) Docker Skeleton
```
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
ENV SECRET_KEY=change-me
EXPOSE 8000
CMD ["gunicorn","-w","3","-b","0.0.0.0:8000","app:app"]
```

### 13. Scaling & Persistence Considerations
| Aspect | Dev (Now) | Production Recommendation |
|--------|-----------|---------------------------|
| DB | SQLite file | PostgreSQL / MySQL (via SQLAlchemy refactor) |
| Rate Limits | In-memory | Redis storage backend |
| Sessions | Signed cookie | Server-side or Redis if size grows |
| Static Assets | Served by Flask | CDN or reverse proxy caching |
| Logging | Console prints | Structured logs + rotation |

### 14. Security Checklist
- [x] CSP (restrictive)
- [x] No inline scripts
- [x] Passwords hashed (Werkzeug)
- [x] No user-supplied eval
- [ ] SECRET_KEY set in production
- [ ] HTTPS via reverse proxy / load balancer
- [ ] Add proper session cookie flags (Secure, SameSite=Strict in production config)
- [ ] Consider account lockout / email verification for brute force mitigation

### 15. Performance Tips
- Convert heavy libraries to lazy import if rarely used (wordcloud already partial)
- Enable Gzip / Brotli at the proxy layer
- Use persistent rate limit storage to avoid resets between processes
- Preload critical CSS if splitting in future

### 16. Troubleshooting (Extended)
| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| 404 on /api/docs | Flasgger not initialized | Ensure swagger config block intact in `app.py` |
| 500 on /export_pdf | ReportLab missing | `pip install reportlab` |
| Missing keywords | YAKE not installed | `pip install yake` |
| Word cloud blank | `wordcloud` missing or text too short | Install lib / longer text |
| Repeated 429 | Rate limit in effect | Wait or raise limits in Limiter config |
| Session not persisting | SECRET_KEY changing each run | Set stable env var |
| High memory on large CSV | Entire file loaded | Stream & paginate (future enhancement) |

### 17. Extending Chat Intents
Add checks in `/chat` route (search for sections like `is_greeting`, `is_sad`). Follow existing pattern: define boolean, adjust response branch, provide `intent` & `suggestions`.

### 18. Data Removal / Reset
To clear all analyses & users (dev only):
```bash
rm -f data/app.db
python run_server.py   # regenerates schema
```

### 19. Known Non-Critical Warnings
| Warning | Why | Safe to Ignore in Dev |
|---------|-----|-----------------------|
| Flask-Limiter in-memory storage | Default config | Yes (not for production) |

### 20. Future Enhancements (Roadmap Ideas)
- JWT or OAuth2 token API mode
- Replace SQLite with SQLAlchemy ORM + migrations
- Add per-user API keys & usage analytics
- Add background task queue (Celery / RQ) for large CSV batches
- Add caching for repeated identical analyses
- Frontend packaging (ESBuild/Vite) if complexity grows

---
If you follow the steps above, you should have a working local or production deployment with clear levers for customization. Reach out (or open an issue) if a step is unclear.
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
