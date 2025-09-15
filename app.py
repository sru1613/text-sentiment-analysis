from flask import Flask, request, render_template, jsonify, make_response, redirect, url_for, session, g, flash, send_file
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
from langdetect import detect as lang_detect
import base64

try:
    import yake
except Exception:
    yake = None

try:
    from wordcloud import WordCloud
except Exception:
    WordCloud = None

# reportlab is imported lazily inside the /export_pdf endpoint

app = Flask(__name__, static_folder='static', template_folder='templates')
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-change-me')
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

def _column_exists(conn, table: str, col: str) -> bool:
    cur = conn.execute(f"PRAGMA table_info({table})")
    return any(r[1] == col for r in cur.fetchall())


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
                created_at TEXT NOT NULL,
                user_id INTEGER
            )
            """
        )
        # Create users table
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        # Settings per user
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS user_settings (
                user_id INTEGER PRIMARY KEY,
                default_tone TEXT,
                default_model TEXT,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
            """
        )
        # Backfill user_id column if db existed without it
        if not _column_exists(conn, 'analyses', 'user_id'):
            try:
                conn.execute("ALTER TABLE analyses ADD COLUMN user_id INTEGER")
            except Exception:
                pass
        conn.commit()


def insert_analysis(source: str, text: str, result: dict, filename: Optional[str] = None, user_id: Optional[int] = None):
    snippet = (text or "")[:200]
    scores = result.get("scores", {})
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            INSERT INTO analyses (source, text_snippet, label, pos, neu, neg, compound, filename, created_at, user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                user_id,
            ),
        )
        conn.commit()


def get_history(limit: int = 10, user_id: Optional[int] = None):
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        if user_id:
            cur = conn.execute(
                "SELECT id, source, text_snippet, label, pos, neu, neg, compound, filename, created_at FROM analyses WHERE user_id = ? ORDER BY id DESC LIMIT ?",
                (user_id, limit),
            )
        else:
            cur = conn.execute(
                "SELECT id, source, text_snippet, label, pos, neu, neg, compound, filename, created_at FROM analyses ORDER BY id DESC LIMIT ?",
                (limit,),
            )
        return [dict(row) for row in cur.fetchall()]


# ---------- Auth helpers ----------
from werkzeug.security import generate_password_hash, check_password_hash


def current_user_id() -> Optional[int]:
    return session.get('user_id')


@app.before_request
def load_current_user():
    g.user_id = session.get('user_id')


# ---------- Core analysis ----------

def _extract_keywords(text: str, max_k: int = 6):
    if not text or not yake:
        return []
    kw = yake.KeywordExtractor(lan='en', top=max_k)
    try:
        items = kw.extract_keywords(text)
        return [w for w, score in items]
    except Exception:
        return []


def _wordcloud_b64(text: str) -> Optional[str]:
    if not text or not WordCloud:
        return None
    try:
        wc = WordCloud(width=480, height=280, background_color='white', mode='RGBA')
        img = wc.generate(text).to_image()
        buf = io.BytesIO()
        img.save(buf, format='PNG')
        return base64.b64encode(buf.getvalue()).decode('utf-8')
    except Exception:
        return None


def analyze_text(text: str, model: str = 'vader') -> dict:
    """Analyze text and return label, emoji, and raw scores.

    Returns a dict with keys: label, emoji, scores (pos/neu/neg/compound)
    """
    if not text:
        return {"label": "Neutral", "emoji": "\U0001F610", "scores": {"pos": 0.0, "neu": 0.0, "neg": 0.0, "compound": 0.0}}
    # Language detection (best effort)
    try:
        lang = lang_detect(text)
    except Exception:
        lang = 'en'

    if model == 'rule':
        # Simple demo rule-based: keywords tilt sentiment
        low = text.lower()
        pos_words = sum(w in low for w in ['great','good','love','excellent','happy','awesome'])
        neg_words = sum(w in low for w in ['bad','sad','angry','terrible','hate','awful'])
        compound = max(-1.0, min(1.0, (pos_words - neg_words) * 0.2))
        scores = {
            'pos': max(0.0, compound),
            'neu': max(0.0, 1.0 - abs(compound)),
            'neg': max(0.0, -compound),
            'compound': compound
        }
    else:
        scores = analyzer.polarity_scores(text)
    compound = scores.get("compound", 0.0)
    if compound >= 0.05:
        label, emoji = "Positive", "\U0001F60A"
    elif compound <= -0.05:
        label, emoji = "Negative", "\U0001F61E"
    else:
        label, emoji = "Neutral", "\U0001F610"

    result = {"label": label, "emoji": emoji, "scores": scores, "lang": lang}
    # Enrichments
    result["keywords"] = _extract_keywords(text)
    wc = _wordcloud_b64(text)
    if wc:
        result["wordcloud_png_b64"] = wc
    return result


def _resolve_model(requested: Optional[str]) -> str:
    m = (requested or '').strip().lower()
    if m in ('vader', 'rule'):
        return m
    # if user has a default
    uid = g.get('user_id') or None
    if uid:
        try:
            with sqlite3.connect(DB_PATH) as conn:
                cur = conn.execute("SELECT default_model FROM user_settings WHERE user_id=?", (uid,))
                row = cur.fetchone()
                if row and row[0]:
                    dm = (row[0] or '').strip().lower()
                    if dm in ('vader','rule'):
                        return dm
        except Exception:
            pass
    return 'vader'


@app.route('/')
@limiter.exempt
def index():
    return render_template('home.html')


# ---------- Pages ----------

@app.route('/ui/analyze', methods=['GET'])
@limiter.exempt
def analyze_page():
    return render_template('analyze.html')


@app.route('/ui/batch', methods=['GET'])
@limiter.exempt
def batch_page():
    return render_template('batch.html')


@app.route('/ui/history', methods=['GET'])
@limiter.exempt
def history_page():
    if not current_user_id():
        return redirect(url_for('login'))
    return render_template('history.html')


@app.route('/ui/chat', methods=['GET'])
@limiter.exempt
def chat_page():
    return render_template('chat.html')


@app.route('/ui/settings', methods=['GET'])
@limiter.exempt
def settings_page():
    if not current_user_id():
        return redirect(url_for('login'))
    # Load current settings
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cur = conn.execute("SELECT default_tone, default_model FROM user_settings WHERE user_id=?", (current_user_id(),))
        row = cur.fetchone()
    return render_template('settings.html', settings=dict(row) if row else {})


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
    model = _resolve_model(data.get('model'))
    result = analyze_text(text, model=model)
    try:
        insert_analysis("text", text, result, user_id=current_user_id())
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

    model = _resolve_model(request.args.get('model'))
    result = analyze_text(text, model=model)
    # add a summary length
    result['meta'] = {'chars': len(text)}
    try:
        insert_analysis("file", text, result, filename=getattr(f, 'filename', None), user_id=current_user_id())
    except Exception:
        pass
    return jsonify(result)


@app.route('/export_pdf', methods=['POST'])
@limiter.limit("10/minute")
def export_pdf():
    """Generate a simple PDF report for a given text analysis."""
    # Import reportlab locally
    try:
        from reportlab.pdfgen import canvas as _canvas
        from reportlab.lib.pagesizes import letter as _letter
        from reportlab.lib.units import inch as _inch
        from reportlab.lib.utils import ImageReader as _ImageReader
    except Exception:
        return jsonify({'error': 'PDF utilities unavailable'}), 500
    data = request.get_json(force=True, silent=True) or {}
    text = (data.get('text') or '').strip()
    model = (data.get('model') or 'vader').lower()
    if not text:
        return jsonify({'error': 'text required'}), 400
    res = analyze_text(text, model=model)

    buf = io.BytesIO()
    c = _canvas.Canvas(buf, pagesize=_letter)
    width, height = _letter

    # Title
    c.setFont("Helvetica-Bold", 16)
    c.drawString(72, height - 72, "Sentiment Analysis Report")
    c.setFont("Helvetica", 10)
    c.drawString(72, height - 90, f"Generated: {datetime.utcnow().isoformat(timespec='seconds')}Z")
    c.drawString(72, height - 105, f"Model: {model.upper()}")

    # Text snippet
    snippet = (text[:300] + ('…' if len(text) > 300 else ''))
    c.setFont("Helvetica", 11)
    c.drawString(72, height - 130, "Text snippet:")
    text_obj = c.beginText(72, height - 145)
    text_obj.setFont("Helvetica", 10)
    for line in snippet.splitlines() or [snippet]:
        text_obj.textLine(line)
    c.drawText(text_obj)

    # Scores
    y = height - 230
    c.setFont("Helvetica-Bold", 12)
    c.drawString(72, y, f"Result: {res.get('label')} {res.get('emoji','')}")
    y -= 16
    sc = res.get('scores', {})
    c.setFont("Helvetica", 11)
    c.drawString(72, y, f"Positive: {sc.get('pos',0):.3f}  Neutral: {sc.get('neu',0):.3f}  Negative: {sc.get('neg',0):.3f}  Compound: {sc.get('compound',0):.3f}")

    # Keywords
    y -= 24
    kws = res.get('keywords') or []
    if kws:
        c.setFont("Helvetica-Bold", 12)
        c.drawString(72, y, "Top Keywords:")
        y -= 14
        c.setFont("Helvetica", 11)
        for k in kws[:10]:
            c.drawString(90, y, f"• {k}")
            y -= 14

    # Wordcloud image if available
    wc_b64 = res.get('wordcloud_png_b64')
    if wc_b64:
        try:
            img_bytes = base64.b64decode(wc_b64)
            img = _ImageReader(io.BytesIO(img_bytes))
            img_w, img_h = img.getSize()
            max_w = width - 2*_inch
            scale = min(1.0, max_w / img_w)
            draw_w = img_w * scale
            draw_h = img_h * scale
            y_img = max(72, y - draw_h - 10)
            c.drawImage(img, 72, y_img, width=draw_w, height=draw_h, mask='auto')
        except Exception:
            pass

    c.showPage()
    c.save()
    buf.seek(0)
    return send_file(buf, mimetype='application/pdf', as_attachment=True, download_name='sentiment_report.pdf')


@app.route('/chat', methods=['POST'])
@limiter.limit("30/minute")
def chat():
    """
    Human-like chatbot that mirrors sentiment and common intents with friendly, varied replies.
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
            message:
              type: string
              example: I am excited today!
    responses:
      200:
        description: Chat reply with sentiment analysis
        schema:
          type: object
          properties:
            reply:
              type: string
            sentiment:
              type: object
    """
    import random

    data = request.get_json(force=True, silent=True) or {}
    message = (data.get('message') or '').strip()
    tone = (data.get('tone') or 'listening').lower()
    if not message:
        return jsonify({"reply": "Please share something so I can respond.", "sentiment": analyze_text("")})

    sentiment = analyze_text(message)
    label = sentiment.get('label')
    compound = sentiment.get('scores', {}).get('compound', 0.0)

    m = message.lower()
    # Intent detection
    is_greeting = any(m.startswith(g) for g in ["hi", "hello", "hey"]) or any(
        phrase in m for phrase in ["good morning", "good afternoon", "good evening", "namaste", "hola"]
    )
    asks_help = any(k in m for k in ["help", "what can you do", "features", "how to use", "instructions"])
    says_thanks = any(k in m for k in ["thanks", "thank you", "thx", "tysm"]) 
    lost_keys = any(k in m for k in ["lost my keys", "lost the keys", "can't find my keys", "cant find my keys"]) or (
        ("lost" in m and "keys" in m)
    )
    is_angry = any(k in m for k in ["angry", "mad", "furious", "pissed"])
    is_sad = any(k in m for k in ["sad", "down", "depressed", "unhappy", "upset"]) or compound <= -0.4
    is_happy = any(k in m for k in ["happy", "glad", "excited", "thrilled"]) or compound >= 0.6
    is_stressed = any(k in m for k in ["stressed", "anxious", "overwhelmed", "nervous"]) 
    is_tired = any(k in m for k in ["tired", "exhausted", "sleepy", "fatigued"]) 
    cant_sleep = any(k in m for k in ["can't sleep", "cant sleep", "insomnia", "can't fall asleep", "cant fall asleep"]) 
    exam_stress = any(k in m for k in ["exam", "test", "finals"]) and any(k in m for k in ["stress", "worried", "scared", "anxious"]) 
    focus_issue = any(k in m for k in ["can't focus", "cant focus", "procrastinating", "procrastination", "distracted"]) 
    relationship = any(k in m for k in ["relationship", "breakup", "fight with", "argued with", "argument"]) 
    motivation = any(k in m for k in ["unmotivated", "no motivation", "demotivated"]) 
    finances = any(k in m for k in ["money", "broke", "bills", "debt"]) 
    device_issue = any(k in m for k in ["phone not working", "laptop not working", "wifi down", "internet not working"]) 
    bored = any(k in m for k in ["bored", "nothing to do"]) 

    def choose(options):
        return random.choice(options)

    if is_greeting:
        reply = choose([
            "Hello! 👋 How are you feeling today?",
            "Hey there! 👋 What’s on your mind?",
            "Hi! 😊 Want to chat or analyze some text?",
        ])
    elif asks_help:
        reply = (
            "I can analyze the sentiment of your text (positive/neutral/negative), "
            "process .txt/.csv files, show charts, and keep a recent history. Try typing some text, uploading a file, or ask me anything."
        )
    elif says_thanks:
        reply = choose([
            "You're welcome! 😊",
            "Anytime! Happy to help. 🙌",
            "No problem at all. If you need more, I’m here."
        ])
    elif lost_keys:
        reply = choose([
            "Losing keys is so frustrating. Try retracing your steps from the last time you used them—check bags, pockets, and surfaces near the door.",
            "That’s annoying. If you have a spare, use it for now. Otherwise, check places keys often hide: under mail, sofa cushions, jacket pockets, or the car.",
            "I get it. Take a breath, then check the usual spots: entryway, kitchen counter, desk, bathroom shelf, and yesterday’s clothes."
        ])
    elif is_angry:
        reply = choose([
            "It sounds like you’re really angry. Want to vent a bit? I’m listening.",
            "That’s a tough feeling. Taking a few deep breaths can help—do you want to talk about what triggered it?",
            "I hear your frustration. If it’s helpful, we can break it down together. What happened first?"
        ])
    elif is_sad:
        reply = choose([
            "I’m really sorry you’re feeling down. Do you want to tell me more about what’s going on?",
            "That sounds hard. You’re not alone—I’m here with you. What do you think might help, even a little?",
            "Thanks for sharing that—it’s not easy. Do you want comfort, advice, or just someone to listen?"
        ])
    elif is_happy:
        reply = choose([
            "I love that for you! 🎉 What made you feel this way?",
            "That’s awesome! 😊 Want to share what happened?",
            "Yay! Keep it going—what’s the good news?"
        ])
    elif cant_sleep:
        reply = choose([
            "Sorry you’re dealing with that. Try a simple wind-down: dim lights, put the phone away, breathe in 4, hold 7, out 8 for 3–5 rounds. If thoughts race, jot them on paper—tell your brain you’ll revisit them tomorrow.",
            "Falling asleep can be tough. Maybe try a body scan: slowly relax each muscle group from toes to head. A warm shower or chamomile tea could help too.",
            "If you can’t sleep, step out of bed for a few minutes and read something light. Keep the room cool and dark. We can also try a short breathing exercise if you want."
        ])
    elif exam_stress:
        reply = choose([
            "Exams are stressful. Let’s break it down: list topics, estimate time per topic, and plan short focused blocks (25m study, 5m break). What subject first?",
            "You’ve got this. Review high-yield topics, practice past questions, and rest the night before. Want to create a tiny plan for today?",
            "Stress is normal before exams. Pick 3 key areas to revise, do a quick active recall session, then a 10-minute walk. Ready to pick the first area?"
        ])
    elif focus_issue:
        reply = choose([
            "Focus is hard when the task feels big. Try a 10-minute starter: set a timer, remove distractions, and do just the first small step. What’s the smallest next action?",
            "Let’s try the 25/5 method: 25 minutes on, 5 off. Put the phone away, pick one task, and start. I can help you define the first step.",
            "Procrastination often hides uncertainty. Write: What’s my goal? What’s the next concrete step? Then start with a 2-minute action."
        ])
    elif relationship:
        reply = choose([
            "Relationship conflicts hurt. If you want, we can draft a message that uses ‘I’ statements and focuses on how you feel, not blame.",
            "Breakups and fights are rough. Give yourself space to feel it. When you’re ready, think about what you need most—clarity, closure, or a pause.",
            "If there was an argument, consider timing and tone for a follow-up chat. Start with listening, then share your side calmly. I can help you prepare."
        ])
    elif motivation:
        reply = choose([
            "Motivation comes after action. Pick a tiny step—like opening the doc or putting on shoes—and do it for 2 minutes. Momentum will help.",
            "Be kind to yourself. Energy fluctuates. What’s one gentle, useful step you can manage right now?",
            "Try pairing something you enjoy (music, tea) with a small task. Reward completion with a break. What’s one task we can do?"
        ])
    elif finances:
        reply = choose([
            "Money stress is heavy. First, list fixed bills, then optional spends. Can we find one small cut and one small income idea?",
            "Consider a simple budget: needs, wants, savings. Even tracking for a week can reveal helpful patterns.",
            "You’re not alone. If it’s urgent, consider talking to someone you trust or a counselor. We can also look at a basic plan together."
        ])
    elif device_issue:
        reply = choose([
            "Try basics: reboot the device/router, check cables, forget and reconnect Wi‑Fi, and test with another device. What error do you see?",
            "If it’s the phone/laptop, try a restart and update. For Wi‑Fi, power-cycle the router (unplug 30s). Let me know what changes.",
            "We can troubleshoot step by step—tell me the device and the exact issue you see."
        ])
    elif bored:
        reply = choose([
            "Want ideas? Quick walk, 10 pushups, doodle, tidy a drawer, message a friend, or try learning a 5‑minute skill on YouTube.",
            "Boredom can be a nudge. Is there something small you’ve been putting off? We can pick one and do it now.",
            "Try changing the environment: different room, new playlist, fresh air. What sounds good?"
        ])
    elif is_stressed:
        reply = choose([
            "That’s a lot to carry. Try a 4-7-8 breath with me? In for 4, hold 7, out 8. Want to try?",
            "I hear you. Sometimes writing a quick list of what’s urgent vs. important helps. Want help breaking it down?",
            "Stress can pile up fast. A short walk or water break might help—what’s one small thing you can do right now?"
        ])
    elif is_tired:
        reply = choose([
            "You sound drained. If you can, a short rest or even 5 minutes with your eyes closed can help.",
            "Your body’s asking for a break. Hydrate, stretch, maybe step away for a few minutes?",
            "Fatigue hits hard. What’s one gentle thing you can do for yourself right now?"
        ])
    else:
        # Fallback based on sentiment label
        if label == 'Positive':
            reply = choose([
                "That’s great to hear! Want to share a bit more?",
                "Nice! What’s the highlight?",
                "Love that energy—tell me more!"
            ])
        elif label == 'Negative':
            reply = choose([
                "I’m sorry you’re feeling this way. I’m here to listen—what happened?",
                "That sounds rough. Want to talk it through?",
                "I hear you. Do you want comfort, advice, or just space to vent?"
            ])
        else:
            reply = choose([
                "I’m here for you. Tell me more or ask me to analyze something specific.",
                "Got it. What would you like to explore next?",
                "I’m listening. Want to dive deeper or switch topics?"
            ])

    # Light tone adjustment
    if tone == 'coaching':
        # If the message is neutral or negative and not specific, nudge towards action
        if any(p in reply.lower() for p in ['tell me more', 'want to talk', 'i’m here']):
            reply += " If you’d like, we can also pick one small next step together."
    elif tone == 'listening':
        # Add a gentle reflective ending
        if any(p in reply.lower() for p in ['you’re', 'i’m sorry', 'that’s']):
            reply += " I’m here with you."

    # Determine a compact intent label and suggestions for dynamic chips
    if is_greeting:
        intent = 'greeting'
        suggestions = ["Show features", "Analyze my text"]
    elif asks_help:
        intent = 'help'
        suggestions = ["Analyze my text", "Upload CSV", "Show history"]
    elif says_thanks:
        intent = 'gratitude'
        suggestions = ["You're welcome"]
    elif lost_keys:
        intent = 'lost_keys'
        suggestions = ["Retrace steps", "Check usual spots"]
    elif is_angry:
        intent = 'anger'
        suggestions = ["Vent a bit", "Break it down"]
    elif is_sad:
        intent = 'sadness'
        suggestions = ["Comfort", "Advice", "Just listen"]
    elif is_happy:
        intent = 'happiness'
        suggestions = ["Share the highlight"]
    elif cant_sleep:
        intent = 'sleep'
        suggestions = ["Do breathing", "Body scan", "Wind-down tips"]
    elif exam_stress:
        intent = 'exam_stress'
        suggestions = ["Make a mini plan", "Pick first topic"]
    elif focus_issue:
        intent = 'focus'
        suggestions = ["Start 10-minute timer", "25/5 Pomodoro"]
    elif relationship:
        intent = 'relationship'
        suggestions = ["Draft a message", "Plan a calm chat"]
    elif motivation:
        intent = 'motivation'
        suggestions = ["Tiny first step", "Pair reward"]
    elif finances:
        intent = 'finances'
        suggestions = ["List bills", "Simple budget"]
    elif device_issue:
        intent = 'device_issue'
        suggestions = ["Reboot router", "Reconnect Wi‑Fi"]
    elif bored:
        intent = 'boredom'
        suggestions = ["Try a quick activity"]
    elif is_stressed:
        intent = 'stress'
        suggestions = ["Do breathing", "Urgent vs important"]
    else:
        intent = (label or 'Neutral').lower()
        suggestions = ["Tell me more"]

    return jsonify({
        "reply": reply,
        "sentiment": sentiment,
        "tone": tone,
        "intent": intent,
        "suggestions": suggestions
    })


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
    model = _resolve_model(request.args.get('model'))
    for row in reader:
        text = row.get('text', '') or ''
        res = analyze_text(text, model=model)
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
            insert_analysis("csv", text, res, filename=getattr(f, 'filename', None), user_id=current_user_id())
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
        items = get_history(limit=limit, user_id=current_user_id())
    except Exception:
        items = []
    return jsonify({'items': items, 'limit': limit})


@app.route('/settings', methods=['GET', 'POST'])
def settings_api():
    if not current_user_id():
        return jsonify({'error': 'auth required'}), 401
    uid = current_user_id()
    if request.method == 'GET':
        with sqlite3.connect(DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            cur = conn.execute("SELECT default_tone, default_model FROM user_settings WHERE user_id=?", (uid,))
            row = cur.fetchone()
        return jsonify({'settings': dict(row) if row else {}})
    data = request.form or request.get_json(silent=True) or {}
    tone = (data.get('default_tone') or '').strip() or None
    model = (data.get('default_model') or '').strip() or None
    with sqlite3.connect(DB_PATH) as conn:
        cur = conn.execute("SELECT 1 FROM user_settings WHERE user_id=?", (uid,)).fetchone()
        if cur:
            conn.execute("UPDATE user_settings SET default_tone=?, default_model=? WHERE user_id=?", (tone, model, uid))
        else:
            conn.execute("INSERT INTO user_settings (user_id, default_tone, default_model) VALUES (?, ?, ?)", (uid, tone, model))
        conn.commit()
    return jsonify({'ok': True})


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


# ---------- Auth routes ----------

@app.route('/register', methods=['GET', 'POST'])
@limiter.limit("10/hour")
def register():
    if request.method == 'GET':
        return render_template('register.html')
    data = request.form or request.get_json(silent=True) or {}
    email = (data.get('email') or '').strip().lower()
    password = (data.get('password') or '')
    if not email or not password:
        flash('Email and password required', 'error')
        return render_template('register.html'), 400
    pw_hash = generate_password_hash(password)
    try:
        with sqlite3.connect(DB_PATH) as conn:
            conn.execute(
                "INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)",
                (email, pw_hash, datetime.utcnow().isoformat(timespec='seconds') + 'Z')
            )
            conn.commit()
        flash('Registration successful. Please log in.', 'success')
        return redirect(url_for('login'))
    except sqlite3.IntegrityError:
        flash('Email already registered', 'error')
        return render_template('register.html'), 400


@app.route('/login', methods=['GET', 'POST'])
@limiter.limit("30/hour")
def login():
    if request.method == 'GET':
        return render_template('login.html')
    data = request.form or request.get_json(silent=True) or {}
    email = (data.get('email') or '').strip().lower()
    password = (data.get('password') or '')
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cur = conn.execute("SELECT id, email, password_hash FROM users WHERE email = ?", (email,))
        row = cur.fetchone()
    if not row or not check_password_hash(row['password_hash'], password):
        flash('Invalid email or password', 'error')
        return render_template('login.html'), 401
    session['user_id'] = row['id']
    flash('Logged in successfully', 'success')
    return redirect(url_for('analyze_page'))


@app.route('/logout')
def logout():
    session.pop('user_id', None)
    flash('Logged out', 'success')
    return redirect(url_for('login'))

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
