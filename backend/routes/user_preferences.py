from datetime import datetime

from flask import Blueprint, jsonify, request

from config.firebase import db
from middleware.auth import require_auth

user_preferences_bp = Blueprint("user_preferences", __name__)

PREFERENCES_DOC_ID = "palette"


def _normalize_favorite_ids(raw_value):
    if raw_value is None:
        return []
    if not isinstance(raw_value, list):
        raise ValueError("favoriteTaskIds debe ser un arreglo")

    normalized = []
    for item in raw_value:
        task_id = str(item or "").strip()
        if not task_id:
            continue
        normalized.append(task_id)

    # Mantener orden y remover duplicados
    deduped = []
    seen = set()
    for task_id in normalized:
        if task_id in seen:
            continue
        seen.add(task_id)
        deduped.append(task_id)
    return deduped


def _preferences_doc_ref(uid):
    return db.collection("user").document(uid).collection("preferences").document(PREFERENCES_DOC_ID)


@user_preferences_bp.route("/user/preferences", methods=["GET"])
@require_auth
def get_user_preferences():
    """Obtiene preferencias del usuario para la paleta."""
    try:
        doc = _preferences_doc_ref(request.uid).get()
        if not doc.exists:
            return jsonify(
                {
                    "favoriteTaskIds": [],
                    "hasCustomFavorites": False,
                    "source": "server-default",
                }
            ), 200

        data = doc.to_dict() or {}
        favorite_ids = _normalize_favorite_ids(data.get("favoriteTaskIds", []))
        return jsonify(
            {
                "favoriteTaskIds": favorite_ids,
                "hasCustomFavorites": True,
                "source": "user-preferences",
                "updatedAt": data.get("updatedAt"),
            }
        ), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@user_preferences_bp.route("/user/preferences", methods=["PUT"])
@require_auth
def update_user_preferences():
    """Actualiza preferencias del usuario para la paleta."""
    try:
        payload = request.json or {}
        favorite_ids = _normalize_favorite_ids(payload.get("favoriteTaskIds"))
        now = datetime.utcnow().isoformat()

        _preferences_doc_ref(request.uid).set(
            {
                "favoriteTaskIds": favorite_ids,
                "updatedAt": now,
            },
            merge=True,
        )

        return jsonify(
            {
                "message": "Preferencias actualizadas",
                "favoriteTaskIds": favorite_ids,
                "hasCustomFavorites": True,
                "updatedAt": now,
            }
        ), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

