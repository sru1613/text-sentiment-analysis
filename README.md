# Text Sentiment Analysis — Local Run Guide

This repository contains a small Flask web app that analyzes a single text input or a plain `.txt` file and returns a sentiment label (Positive / Neutral / Negative) with an emoji plus numeric VADER scores (pos / neu / neg / compound). The UI shows the results and a Chart.js visualization.

Purpose: provide a simple, local demo so Shrusthi (or any teammate) can run the project on Windows and test text/file sentiment analysis.

Contents of this README:
- Quick prerequisites
- Clone and run (PowerShell commands)
- How the app works (endpoints & UI)
- Notes about CORS and serving the page
- Troubleshooting & common fixes
- File map

---

## Prerequisites
- Windows with PowerShell (these instructions use PowerShell syntax).
- Python 3.8+ installed and available on PATH.

## Quick setup and run (PowerShell)

1. Open PowerShell and clone the repo (if not already cloned):

```powershell
git clone https://github.com/sru1613/text-sentiment-analysis.git
cd "text-sentiment-analysis"
```

2. Create and activate a virtual environment, then install dependencies:

```powershell
python -m venv .venv
. .\.venv\Scripts\Activate
pip install --upgrade pip
pip install -r requirements.txt
```

3. Start the Flask app (development server):

```powershell
python app.py
```

4. Open the UI in your browser:

Open http://127.0.0.1:5000

Alternatively, you can serve the `templates/index.html` file with a static dev server (for example Live Server in VS Code) at port 5500 — but note the app includes CORS headers so the frontend can call the backend on port 5000.

---

## How it works
- Backend: `app.py` — Flask application using `vaderSentiment` to compute polarity scores.
	- POST `/analyze` expects JSON { "text": "..." } and returns { label, emoji, scores }.
	- POST `/analyze_file` expects a form file field named `file` (.txt preferred) and returns the same results plus `meta` (chars).

- Frontend:
	- `templates/index.html` — main UI
	- `static/main.js` — sends fetch requests to the backend and renders the Chart.js bar chart
	- `static/styles.css` — styling and layout

---

## Using the UI
- Type or paste text into the textarea and press "Analyze Text".
- Choose a `.txt` file and press "Analyze File" to analyze the entire file.
- Results: a label with emoji, numeric scores, and a small bar chart of pos/neu/neg.

## API examples (curl)

Analyze text (JSON):

```powershell
curl -X POST http://127.0.0.1:5000/analyze -H "Content-Type: application/json" -d '{"text":"I am very happy"}'
```

Analyze file (multipart):

```powershell
curl -X POST http://127.0.0.1:5000/analyze_file -F "file=@C:\path\to\file.txt"
```

---

## CORS and serving the page
- If you open `index.html` from a static server at a different origin (for example http://127.0.0.1:5500), the browser will perform a cross-origin request to the backend at port 5000. The app already enables CORS for development using `flask-cors`, so that should succeed.
- If you see errors like `Access to fetch ... blocked by CORS policy`, make sure:
	1. The Flask app is running (python app.py).
 2. `flask-cors` is installed in the virtualenv (`pip install flask-cors`).

---

## Troubleshooting (common errors)
- "ModuleNotFoundError: No module named 'vaderSentiment'": activate the virtualenv and run `pip install -r requirements.txt`.
- "POST ... 405 Method Not Allowed": usually caused by sending the request to the static server (port 5500) instead of the Flask backend (5000). Open the app at http://127.0.0.1:5000 or ensure `static/main.js` points to http://127.0.0.1:5000.
- "Failed to fetch / ERR_CONNECTION_REFUSED": the backend isn't running — start it with `python app.py`.
- Unexpected JSON parse errors in the browser console: the frontend now checks for non-200 responses and shows details in the UI; check the server logs in the terminal for stack traces.

If you need to debug the Flask server, watch the terminal where `python app.py` runs — Flask prints incoming requests and exceptions.

---

## File map (important files)
- `app.py` — Flask backend, endpoints and analyzer logic.
- `requirements.txt` — pinned runtime deps: Flask, vaderSentiment, flask-cors
- `templates/index.html` — frontend UI
- `static/main.js` — frontend logic + Chart.js integration
- `static/styles.css` — styles and layout

---

## Notes and next steps
- VADER is a rules-based sentiment tool and works well for short conversational text. If you want a transformer-based model (BERT) for higher accuracy, I can add an optional path that uses Hugging Face Transformers (will add larger dependencies and hardware considerations).
- If you want to package this into a Docker image or add unit tests, tell me which and I will add them.

---

If Shrusthi has trouble running these steps, paste the terminal output here and I'll diagnose further.

