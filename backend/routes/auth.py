from flask import Blueprint, request, jsonify
from firebase_admin import auth
from config.firebase import create_jwt_token, create_user_document, get_user_profile, verify_jwt_token
from middleware.auth import require_auth

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/register', methods=['POST'])
def register():
    """Registro con email y contraseña"""
    try:
        data = request.json
        email = data.get('email')
        password = data.get('password')
        
        if not email or not password:
            return jsonify({'error': 'Email y contraseña requeridos'}), 400
        
        if len(password) < 6:
            return jsonify({'error': 'La contraseña debe tener al menos 6 caracteres'}), 400
        
        # Crear usuario en Firebase Auth
        user = auth.create_user(
            email=email,
            password=password
        )
        
        # Crear documento en Firestore
        user_data = create_user_document(user.uid, email, is_anonymous=False)
        
        if not user_data:
            return jsonify({'error': 'Error creando perfil de usuario'}), 500
        
        # Generar JWT
        token = create_jwt_token(
            uid=user.uid,
            email=email,
            is_admin=user_data.get('admin', False),
            is_anonymous=False
        )
        
        return jsonify({
            'token': token,
            'user': {
                'uid': user.uid,
                'email': email,
                'displayName': user_data.get('displayName'),
                'admin': user_data.get('admin', False),
                'isAnonymous': False
            }
        }), 201
        
    except auth.EmailAlreadyExistsError:
        return jsonify({'error': 'Este email ya está registrado'}), 400
    except Exception as e:
        print(f"Error en registro: {e}")
        return jsonify({'error': 'Error al crear la cuenta'}), 500

@auth_bp.route('/login', methods=['POST'])
def login():
    """Login con email y contraseña"""
    try:
        data = request.json
        email = data.get('email')
        password = data.get('password')
        
        if not email or not password:
            return jsonify({'error': 'Email y contraseña requeridos'}), 400
        
        # Verificar usuario en Firebase Auth
        # Nota: Firebase Admin SDK no puede verificar contraseñas directamente
        # Necesitamos usar la REST API de Firebase
        import requests
        
        firebase_api_key = "TU_WEB_API_KEY"  # Debes agregarlo al .env
        url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={firebase_api_key}"
        
        payload = {
            "email": email,
            "password": password,
            "returnSecureToken": True
        }
        
        response = requests.post(url, json=payload)
        
        if response.status_code != 200:
            return jsonify({'error': 'Credenciales incorrectas'}), 401
        
        firebase_data = response.json()
        uid = firebase_data['localId']
        
        # Crear o actualizar documento en Firestore
        user_data = create_user_document(uid, email, is_anonymous=False)
        
        # Generar JWT propio
        token = create_jwt_token(
            uid=uid,
            email=email,
            is_admin=user_data.get('admin', False),
            is_anonymous=False
        )
        
        return jsonify({
            'token': token,
            'user': {
                'uid': uid,
                'email': email,
                'displayName': user_data.get('displayName'),
                'admin': user_data.get('admin', False),
                'isAnonymous': False
            }
        }), 200
        
    except Exception as e:
        print(f"Error en login: {e}")
        return jsonify({'error': 'Error al iniciar sesión'}), 500

@auth_bp.route('/login/anonymous', methods=['POST'])
def login_anonymous():
    """Login anónimo. No se registra usuario en Firebase Auth ni en Firestore."""
    try:
        import uuid
        # No crear usuario en Firebase Auth; solo generar identidad local
        anonymous_uid = f"anon_{uuid.uuid4().hex[:16]}"
        
        token = create_jwt_token(
            uid=anonymous_uid,
            email='anonymous',
            is_admin=False,
            is_anonymous=True
        )
        
        return jsonify({
            'token': token,
            'user': {
                'uid': anonymous_uid,
                'email': 'anonymous',
                'displayName': 'Usuario Anónimo',
                'admin': False,
                'isAnonymous': True
            }
        }), 201
        
    except Exception as e:
        print(f"Error en login anónimo: {e}")
        return jsonify({'error': 'Error al acceder como invitado'}), 500

@auth_bp.route('/me', methods=['GET'])
@require_auth
def get_current_user():
    """Obtiene información del usuario actual. Usuarios anónimos no tienen documento en Firestore."""
    try:
        # Usuarios anónimos no tienen perfil en Firestore; responder desde el token
        if getattr(request, 'is_anonymous', False):
            return jsonify({
                'uid': request.uid,
                'email': 'anonymous',
                'displayName': 'Usuario Anónimo',
                'admin': False,
                'isAnonymous': True,
                'preferences': {},
                'createdAt': None,
                'lastLogin': None
            }), 200

        profile = get_user_profile(request.uid)
        
        if not profile:
            return jsonify({'error': 'Usuario no encontrado'}), 404
        
        return jsonify({
            'uid': request.uid,
            'email': profile.get('email'),
            'displayName': profile.get('displayName'),
            'admin': profile.get('admin', False),
            'isAnonymous': profile.get('isAnonymous', False),
            'preferences': profile.get('preferences', {}),
            'createdAt': profile.get('createdAt'),
            'lastLogin': profile.get('lastLogin')
        }), 200
        
    except Exception as e:
        print(f"Error obteniendo usuario: {e}")
        return jsonify({'error': 'Error al obtener información del usuario'}), 500

@auth_bp.route('/logout', methods=['POST'])
@require_auth
def logout():
    """Logout (invalidación del token en cliente)"""
    # En JWT, el logout se maneja del lado del cliente eliminando el token
    # Aquí podríamos agregar el token a una blacklist si fuera necesario
    return jsonify({'message': 'Sesión cerrada exitosamente'}), 200