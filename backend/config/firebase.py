import os, jwt
from datetime import datetime, timedelta
import firebase_admin
from firebase_admin import credentials, firestore, auth
from dotenv import load_dotenv
from pathlib import Path

load_dotenv()

# Base del proyecto (backend/)
BASE_DIR = Path(__file__).resolve().parent.parent

raw_path = os.getenv("FIREBASE_CREDENTIALS_PATH")
if not raw_path:
    raise RuntimeError("FIREBASE_CREDENTIALS_PATH no está definido")

cred_path = Path(raw_path)

# Si viene como relativa (./...), resolverla contra BASE_DIR
if not cred_path.is_absolute():
    cred_path = BASE_DIR / cred_path

if not cred_path.exists():
    raise FileNotFoundError(f"No se encontró el archivo Firebase: {cred_path}")

cred = credentials.Certificate(str(cred_path))
firebase_admin.initialize_app(cred)

# Cliente de Firestore
db = firestore.client()

# Configuración JWT
JWT_SECRET = os.getenv('JWT_SECRET_KEY')
JWT_ALGORITHM = os.getenv('JWT_ALGORITHM', 'HS256')

def create_jwt_token(uid, email, is_admin=False, is_anonymous=False):
    """Genera un token JWT personalizado"""
    payload = {
        'uid': uid,
        'email': email,
        'admin': is_admin,
        'isAnonymous': is_anonymous,
        'exp': datetime.utcnow() + timedelta(days=7),  # Token válido por 7 días
        'iat': datetime.utcnow()
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_jwt_token(token):
    """Verifica y decodifica un token JWT"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

def get_user_profile(uid):
    """Obtiene el perfil del usuario desde Firestore"""
    try:
        user_ref = db.collection('user').document(uid)
        user_doc = user_ref.get()
        
        if user_doc.exists:
            return user_doc.to_dict()
        return None
    except Exception as e:
        print(f"Error obteniendo perfil: {e}")
        return None

def create_user_document(uid, email=None, is_anonymous=False):
    """Crea o actualiza el documento del usuario en Firestore"""
    try:
        user_ref = db.collection('user').document(uid)
        user_doc = user_ref.get()
        
        if not user_doc.exists:
            # Crear nuevo usuario
            user_data = {
                'email': email or 'anonymous',
                'displayName': email.split('@')[0] if email else 'Usuario Anónimo',
                'admin': False,
                'isAnonymous': is_anonymous,
                'createdAt': datetime.utcnow().isoformat(),
                'lastLogin': datetime.utcnow().isoformat(),
                'preferences': {
                    'theme': 'dark',
                    'defaultPlatform': 'airflow',
                    'autoSaveInterval': 30
                }
            }
            user_ref.set(user_data)
            return user_data
        else:
            # Actualizar último login
            user_ref.update({
                'lastLogin': datetime.utcnow().isoformat()
            })
            return user_doc.to_dict()
    except Exception as e:
        print(f"Error creando documento: {e}")
        return None