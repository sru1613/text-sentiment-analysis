# Text Sentiment Analysis — Flask App

Small Flask application that analyzes typed text or uploaded `.txt` files and returns a sentiment label (Positive / Neutral / Negative) with an emoji plus VADER scores (pos/neu/neg/compound). The frontend displays the result and a Chart.js bar chart.

Now includes advanced features for TYCS:
- CSV batch analysis endpoint (`/analyze_csv`) with optional CSV download
- SQLite history of recent analyses and `/history` endpoint
- Basic rate limiting per IP with Flask-Limiter
- Swagger API docs at `/api/docs`

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
- POST `/analyze` — Body: `{ "text": "I am happy" }`
- POST `/analyze_file` — Multipart field `file` (.txt)
- POST `/analyze_csv` — Multipart field `file` (.csv with a column named `text`)
  - Add `?format=csv` query to get a CSV file response
- GET `/history?limit=10` — Recent items from SQLite
- GET `/health` — Healthcheck with versions
- API Docs: http://127.0.0.1:5000/api/docs

## Frontend
- `templates/index.html` — UI (now with CSV & History sections)
- `static/main.js` — Fetch + Chart.js rendering and new CSV/history logic
- `static/styles.css` — Styling

## Troubleshooting
- If rate limit is hit, server returns 429 Too Many Requests. Wait a minute and retry.
- CORS errors: ensure server is running and `flask-cors` installed.

## License
For coursework/demo use.
