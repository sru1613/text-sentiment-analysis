from flask import Flask, request, render_template, jsonify
from flask_cors import CORS
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
import os

app = Flask(__name__, static_folder='static', template_folder='templates')
analyzer = SentimentIntensityAnalyzer()
# Allow Cross-Origin requests during development (e.g., page served from port 5500)
CORS(app)


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
    data = request.get_json(force=True, silent=True) or {}
    text = data.get('text', '')
    result = analyze_text(text)
    return jsonify(result)


@app.route('/analyze_file', methods=['POST'])
def analyze_file():
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


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
