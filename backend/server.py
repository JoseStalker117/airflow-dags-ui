from flask import Flask, send_from_directory
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DIST_DIR = os.path.join(BASE_DIR, "dist")

app = Flask(__name__, static_folder=DIST_DIR, static_url_path="")

@app.route("/")
def serve_react():
    return send_from_directory(DIST_DIR, "index.html")

@app.route("/<path:path>")
def serve_static(path):
    file_path = os.path.join(DIST_DIR, path)
    if os.path.exists(file_path):
        return send_from_directory(DIST_DIR, path)
    else:
        return send_from_directory(DIST_DIR, "index.html")

# ejemplo API
@app.route("/api/status")
def status():
    return {"status": "ok", "server": "flask"}

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
