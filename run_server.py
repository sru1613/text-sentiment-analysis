from app import app

if __name__ == "__main__":
    # Production-like simple runner (no reloader, no debug, bound only to localhost for safety)
    app.run(host="127.0.0.1", port=5000, debug=False)
