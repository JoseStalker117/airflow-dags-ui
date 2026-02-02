from functools import wraps
from flask import request, jsonify
from config.firebase import verify_jwt_token, get_user_profile

def require_auth(f):
    """Decorator para requerir autenticación"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'No autorizado'}), 401
        
        token = auth_header.split('Bearer ')[1]
        payload = verify_jwt_token(token)
        
        if not payload:
            return jsonify({'error': 'Token inválido o expirado'}), 401
        
        # Añadir datos del usuario al request
        request.uid = payload['uid']
        request.user_email = payload['email']
        request.is_admin = payload.get('admin', False)
        return f(*args, **kwargs)
    
    return decorated_function

def require_admin(f):
    """Decorator para requerir permisos de admin"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'No autorizado'}), 401
        
        token = auth_header.split('Bearer ')[1]
        payload = verify_jwt_token(token)
        
        if not payload:
            return jsonify({'error': 'Token inválido o expirado'}), 401
        
        # Verificar permisos de admin desde Firestore (más seguro)
        profile = get_user_profile(payload['uid'])
        if not profile or not profile.get('admin', False):
            return jsonify({'error': 'Se requieren permisos de administrador'}), 403
        
        request.uid = payload['uid']
        request.user_email = payload['email']
        request.is_admin = True
        return f(*args, **kwargs)
    
    return decorated_function