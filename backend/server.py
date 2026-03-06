import os
from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv
from routes.auth import auth_bp
from routes.tasks import tasks_bp

load_dotenv()

app = Flask(__name__)
allowed_origins_raw = os.getenv("CORS_ALLOWED_ORIGINS", "*")
allowed_origins = [o.strip() for o in allowed_origins_raw.split(",") if o.strip()]
CORS(app, origins=allowed_origins if allowed_origins else "*")

# Registrar blueprints
app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(tasks_bp, url_prefix='/api')

@app.route('/', methods=['GET'])
def main():
    return {'status': 'ok'}, 200

@app.route('/health', methods=['GET'])
def health_check():
    return {'status': 'ok'}, 200

if __name__ == '__main__':
    host = os.getenv("FLASK_HOST", "0.0.0.0")
    port = int(os.getenv("FLASK_PORT", "5000"))
    debug = os.getenv("FLASK_DEBUG", "true").lower() in ("1", "true", "yes", "on")

    app.run(
        host=host,
        port=port,
        debug=debug
    )
