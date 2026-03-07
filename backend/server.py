import os
from pathlib import Path
from flask import Flask, redirect, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
from routes.auth import auth_bp
from routes.tasks import tasks_bp

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
DIST_DIR = BASE_DIR / "dist"

app = Flask(__name__, static_folder=str(DIST_DIR), static_url_path="")
allowed_origins_raw = os.getenv("CORS_ALLOWED_ORIGINS", "*")
allowed_origins = [o.strip() for o in allowed_origins_raw.split(",") if o.strip()]
CORS(app, origins=allowed_origins if allowed_origins else "*")

# Registrar blueprints
app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(tasks_bp, url_prefix='/api')

@app.route('/', methods=['GET'])
def main():
    return redirect("/splash", code=302)

@app.route('/health', methods=['GET'])
def health_check():
    return {'status': 'ok'}, 200

# Alias legacy/cortos para auth bajo /api/*
@app.route('/api/login', methods=['GET', 'POST', 'OPTIONS'])
def api_login_alias():
    return redirect('/api/auth/login', code=307)

@app.route('/api/login/anonymous', methods=['POST', 'OPTIONS'])
def api_login_anonymous_alias():
    return redirect('/api/auth/login/anonymous', code=307)

@app.route('/api/register', methods=['POST', 'OPTIONS'])
def api_register_alias():
    return redirect('/api/auth/register', code=307)

@app.route('/api/me', methods=['GET', 'OPTIONS'])
def api_me_alias():
    return redirect('/api/auth/me', code=307)

@app.route('/api/logout', methods=['POST', 'OPTIONS'])
def api_logout_alias():
    return redirect('/api/auth/logout', code=307)

def serve_spa_index():
    if DIST_DIR.exists():
        return send_from_directory(app.static_folder, "index.html")
    return {'error': 'Frontend dist no disponible'}, 404

@app.route('/splash', methods=['GET'])
def splash():
    return serve_spa_index()

@app.route('/login', methods=['GET'])
def login_page():
    return serve_spa_index()

@app.route('/home', methods=['GET'])
def home_page():
    return serve_spa_index()

@app.route('/<path:path>', methods=['GET'])
def serve_react(path):
    # Mantener APIs fuera del fallback SPA.
    if path.startswith("api/"):
        return {'error': 'Not Found'}, 404

    requested = DIST_DIR / path
    if requested.exists() and requested.is_file():
        return send_from_directory(app.static_folder, path)

    return serve_spa_index()

if __name__ == '__main__':
    host = os.getenv("FLASK_HOST", "0.0.0.0")
    port = int(os.getenv("FLASK_PORT", "5000"))
    debug = os.getenv("FLASK_DEBUG", "true").lower() in ("1", "true", "yes", "on")

    app.run(
        host=host,
        port=port,
        debug=debug
    )
