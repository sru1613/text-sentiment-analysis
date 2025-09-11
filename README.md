# Text Sentiment Analysis — Flask App

Small Flask application that analyzes typed text or uploaded `.txt` files and returns a sentiment label (Positive / Neutral / Negative) with an emoji plus VADER scores (pos/neu/neg/compound). The frontend displays the result and a Chart.js bar chart.

## Prerequisites
- Python 3.8+
- Windows PowerShell (commands below use PowerShell)

## Quick start (local)

```powershell
cd "E:\Project sentiment analysis"
python -m venv .venv
. .\.venv\Scripts\Activate
pip install -r requirements.txt
python app.py
```

Open http://127.0.0.1:5000 in your browser.

## Endpoints
- POST `/analyze` — Body: `{ "text": "I am happy" }` — Returns label, emoji and scores.
- POST `/analyze_file` — Multipart field `file` (.txt) — Returns label, emoji, scores, `meta.chars`.
- GET `/health` — Healthcheck with versions.
- API Docs: http://127.0.0.1:5000/api/docs

## Frontend
- `templates/index.html` — UI
- `static/main.js` — Fetch + Chart.js rendering
- `static/styles.css` — Styling

## GitHub Pages (static UI)
GitHub Pages can host only the static frontend. To use it:
1. Build a `docs/` folder in the repo root that contains a copy of `index.html` and the `static` folder with relative paths (already provided in this project under `docs/`).
2. In repo settings, enable GitHub Pages to serve from the `main` branch `/docs` folder.
3. Ensure the backend is running publicly (e.g., on Render/Fly/Railway). Set `window.BACKEND_ORIGIN` in `docs/index.html` (or adjust `docs/static/main.js`) to point to your backend URL.

## Troubleshooting
- CORS errors when using a different origin (e.g., GitHub Pages): make sure backend allows CORS and is reachable from the internet.
- `ModuleNotFoundError` for packages: activate `.venv` and run `pip install -r requirements.txt`.
- Blank page on GitHub Pages: check browser devtools Network tab that `static/styles.css` and `static/main.js` are loading (relative paths), and verify backend URL is correct in `docs/static/main.js`.

## License
For coursework/demo use.
