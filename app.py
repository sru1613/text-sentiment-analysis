from flask import Flask, request, render_template, jsonify, make_response
from flask_cors import CORS
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from flasgger import Swagger
from importlib.metadata import version
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from typing import Optional
import os
import sqlite3
from datetime import datetime
import io
import csv

app = Flask(__name__, static_folder='static', template_folder='templates')
analyzer = SentimentIntensityAnalyzer()
# Allow Cross-Origin requests during development (e.g., page served from port 5500)
CORS(app)

# Rate limiting (per client IP)
limiter = Limiter(key_func=get_remote_address, app=app, default_limits=["10 per minute", "200 per day"]) 


def _pkg_version(name: str) -> str:
    try:
        return version(name)
    except Exception:
        return "unknown"


# Swagger configuration (serves UI at /api/docs)
swagger = Swagger(
    app,
    config={
        "headers": [],
        "specs": [
            {
                "endpoint": "apispec_1",
                "route": "/api/spec.json",
                "rule_filter": lambda rule: True,
                "model_filter": lambda tag: True,
            }
        ],
        "static_url_path": "/flasgger_static",
        "swagger_ui": True,
        "specs_route": "/api/docs",
    },
    template={
        "info": {
            "title": "Text Sentiment Analysis API",
            "description": "Endpoints for analyzing text or files and getting sentiment scores.",
            "version": "1.1.0",
        }
    },
)

# ---------- Persistence (SQLite) ----------
DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
DB_PATH = os.path.join(DATA_DIR, 'app.db')

def init_db():
    os.makedirs(DATA_DIR, exist_ok=True)
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS analyses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source TEXT NOT NULL,
                text_snippet TEXT,
                label TEXT,
                pos REAL,
                neu REAL,
                neg REAL,
                compound REAL,
                filename TEXT,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.commit()


def insert_analysis(source: str, text: str, result: dict, filename: Optional[str] = None):
    snippet = (text or "")[:200]
    scores = result.get("scores", {})
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            INSERT INTO analyses (source, text_snippet, label, pos, neu, neg, compound, filename, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                source,
                snippet,
                result.get("label"),
                scores.get("pos"),
                scores.get("neu"),
                scores.get("neg"),
                scores.get("compound"),
                filename,
                datetime.utcnow().isoformat(timespec="seconds") + "Z",
            ),
        )
        conn.commit()


def get_history(limit: int = 10):
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cur = conn.execute(
            "SELECT id, source, text_snippet, label, pos, neu, neg, compound, filename, created_at FROM analyses ORDER BY id DESC LIMIT ?",
            (limit,),
        )
        return [dict(row) for row in cur.fetchall()]


# ---------- Core analysis ----------

def analyze_text(text: str) -> dict:
    """Analyze text and return label, emoji, and raw scores.

    Returns a dict with keys: label, emoji, scores (pos/neu/neg/compound)
    """
    if not text:
        return {"label": "Neutral", "emoji": "\U0001F610", "scores": {"pos": 0.0, "neu": 0.0, "neg": 0.0, "compound": 0.0}}

    scores = analyzer.polarity_scores(text)
    compound = scores.get("compound", 0.0)
    if compound >= 0.05:
        label, emoji = "Positive", "\U0001F60A"
    elif compound <= -0.05:
        label, emoji = "Negative", "\U0001F61E"
    else:
        label, emoji = "Neutral", "\U0001F610"

    return {"label": label, "emoji": emoji, "scores": scores}


@app.route('/')
@limiter.exempt
def index():
    return render_template('index.html')


@app.route('/analyze', methods=['POST'])
@limiter.limit("20/minute")
def analyze():
    """
    Analyze text sentiment
    ---
    consumes:
      - application/json
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            text:
              type: string
              example: I love this product!
    responses:
      200:
        description: Analysis result
        schema:
          type: object
          properties:
            label:
              type: string
            emoji:
              type: string
            scores:
              type: object
              properties:
                pos: { type: number }
                neu: { type: number }
                neg: { type: number }
                compound: { type: number }
    """
    data = request.get_json(force=True, silent=True) or {}
    text = data.get('text', '')
    result = analyze_text(text)
    try:
        insert_analysis("text", text, result)
    except Exception:
        # Avoid breaking response due to DB issues
        pass
    return jsonify(result)


@app.route('/analyze_file', methods=['POST'])
@limiter.limit("10/minute")
def analyze_file():
    """
    Analyze sentiment of an uploaded text file
    ---
    consumes:
      - multipart/form-data
    parameters:
      - in: formData
        name: file
        type: file
        required: true
        description: Plain text file (.txt)
    responses:
      200:
        description: Analysis result
    """
    if 'file' not in request.files:
        return jsonify({'error': 'no file uploaded'}), 400
    f = request.files['file']
    try:
        raw = f.read()
        try:
            text = raw.decode('utf-8')
        except Exception:
            text = raw.decode('latin-1', errors='ignore')
    except Exception:
        return jsonify({'error': 'could not read file'}), 400

    result = analyze_text(text)
    # add a summary length
    result['meta'] = {'chars': len(text)}
    try:
        insert_analysis("file", text, result, filename=getattr(f, 'filename', None))
    except Exception:
        pass
    return jsonify(result)


@app.route('/analyze_csv', methods=['POST'])
@limiter.limit("5/minute")
def analyze_csv():
    """
    Analyze a CSV file with a 'text' column. Returns JSON array or CSV if `?format=csv`.
    """
    if 'file' not in request.files:
        return jsonify({'error': 'no file uploaded'}), 400
    f = request.files['file']
    try:
        raw = f.read()
        try:
            content = raw.decode('utf-8')
        except Exception:
            content = raw.decode('latin-1', errors='ignore')
    except Exception:
        return jsonify({'error': 'could not read file'}), 400

    reader = csv.DictReader(io.StringIO(content))
    if 'text' not in (reader.fieldnames or []):
        return jsonify({'error': "CSV must have a 'text' column"}), 400

    rows = []
    for row in reader:
        text = row.get('text', '') or ''
        res = analyze_text(text)
        out = {
            **row,
            'label': res['label'],
            'pos': res['scores']['pos'],
            'neu': res['scores']['neu'],
            'neg': res['scores']['neg'],
            'compound': res['scores']['compound'],
        }
        rows.append(out)
        try:
            insert_analysis("csv", text, res, filename=getattr(f, 'filename', None))
        except Exception:
            pass

    if (request.args.get('format') or '').lower() == 'csv':
        output = io.StringIO()
        if rows:
            fieldnames = list(rows[0].keys())
        else:
            base_fields = list(reader.fieldnames or [])
            for extra in ['label','pos','neu','neg','compound']:
                if extra not in base_fields:
                    base_fields.append(extra)
            fieldnames = base_fields
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        for r in rows:
            writer.writerow(r)
        resp = make_response(output.getvalue())
        resp.headers['Content-Type'] = 'text/csv'
        resp.headers['Content-Disposition'] = 'attachment; filename="analysis_results.csv"'
        return resp

    return jsonify({'count': len(rows), 'results': rows[:50]})  # return preview (up to 50)


@app.route('/history', methods=['GET'])
@limiter.limit("30/minute")
def history():
    try:
        limit = int(request.args.get('limit', '10'))
    except Exception:
        limit = 10
    limit = max(1, min(limit, 100))
    try:
        items = get_history(limit=limit)
    except Exception:
        items = []
    return jsonify({'items': items, 'limit': limit})


@app.route('/health')
@limiter.exempt
def health():
    """Simple healthcheck endpoint."""
    return jsonify(
        {
            "status": "ok",
            "service": "text-sentiment-analysis",
            "versions": {
                "flask": _pkg_version("Flask"),
                "vaderSentiment": _pkg_version("vaderSentiment"),
                "flasgger": _pkg_version("flasgger"),
            },
        }
    )


# Initialize DB on startup
init_db()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
