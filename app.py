from flask import Flask, request, render_template, jsonify, redirect
from flask_cors import CORS
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from flasgger import Swagger
from importlib.metadata import version, PackageNotFoundError
import os

app = Flask(__name__, static_folder='static', template_folder='templates')
analyzer = SentimentIntensityAnalyzer()
# Allow Cross-Origin requests during development (e.g., page served from port 5500)
CORS(app)


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
            "version": "1.0.0",
        }
    },
)


def analyze_text(text: str) -> dict:
    """Analyze text and return label, emoji, and raw scores.

    Returns a dict with keys: label, emoji, scores (pos/neu/neg/compound)
    """
    if not text:
        return {"label": "Neutral", "emoji": "😐", "scores": {"pos": 0.0, "neu": 0.0, "neg": 0.0, "compound": 0.0}}

    scores = analyzer.polarity_scores(text)
    compound = scores.get("compound", 0.0)
    if compound >= 0.05:
        label, emoji = "Positive", "😊"
    elif compound <= -0.05:
        label, emoji = "Negative", "😞"
    else:
        label, emoji = "Neutral", "😐"

    return {"label": label, "emoji": emoji, "scores": scores}


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/analyze', methods=['POST'])
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
        return jsonify(result)


@app.route('/analyze_file', methods=['POST'])
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
    return jsonify(result)


@app.route('/health')
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


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)