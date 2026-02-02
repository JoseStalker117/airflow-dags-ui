from flask import Flask
from flask_cors import CORS
from routes.auth import auth_bp
from routes.tasks import tasks_bp

app = Flask(__name__)
CORS(app)

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
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=True
    )
