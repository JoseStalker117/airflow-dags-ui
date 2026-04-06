from datetime import datetime

from flask import Blueprint, jsonify, request

from config.firebase import db
from middleware.auth import require_admin

categories_bp = Blueprint("categories", __name__)

CATEGORY_REQUIRED_FIELDS = ["id", "label"]
VALID_FRAMEWORKS = {"all", "airflow", "argo"}


def normalize_category_payload(data):
    if not isinstance(data, dict):
        raise ValueError("Payload inválido")

    missing = [
        field
        for field in CATEGORY_REQUIRED_FIELDS
        if field not in data or str(data.get(field, "")).strip() == ""
    ]
    if missing:
        raise ValueError(f"Campos requeridos: {', '.join(missing)}")

    framework = str(data.get("framework", "all")).strip().lower()
    if framework not in VALID_FRAMEWORKS:
        raise ValueError('framework debe ser "all", "airflow" o "argo"')

    try:
        order = int(data.get("order", 999))
    except (TypeError, ValueError):
        raise ValueError("order debe ser un número entero")

    return {
        "id": str(data.get("id", "")).strip(),
        "label": str(data.get("label", "")).strip(),
        "framework": framework,
        "icon": str(data.get("icon", "folder")).strip() or "folder",
        "colorKey": str(data.get("colorKey", "slate")).strip() or "slate",
        "order": order,
        "showInDefaultFavorites": bool(data.get("showInDefaultFavorites", False)),
        "isActive": data.get("isActive", True) is not False,
    }


@categories_bp.route("/categories", methods=["GET"])
def get_categories():
    """Obtiene categorías activas. Query: ?framework=airflow|argo"""
    try:
        framework = request.args.get("framework")
        docs = db.collection("categories").where("isActive", "==", True).stream()

        categories = []
        for doc in docs:
            category = doc.to_dict()
            category["id"] = doc.id
            if framework in ("airflow", "argo"):
                if category.get("framework", "all") not in ("all", framework):
                    continue
            categories.append(category)

        categories.sort(
            key=lambda item: (
                int(item.get("order", 999)),
                str(item.get("label") or item.get("id") or "").lower(),
            )
        )
        return jsonify(categories), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@categories_bp.route("/admin/categories", methods=["GET"])
@require_admin
def get_categories_admin():
    """Obtiene categorías para administración. Query: ?framework=all|airflow|argo&includeInactive=true|false"""
    try:
        framework = request.args.get("framework")
        include_inactive = request.args.get("includeInactive", "true").lower() == "true"
        query = db.collection("categories")
        if not include_inactive:
            query = query.where("isActive", "==", True)

        docs = query.stream()
        categories = []
        for doc in docs:
            category = doc.to_dict()
            category["id"] = doc.id
            if framework in VALID_FRAMEWORKS and framework != "all":
                if category.get("framework", "all") not in ("all", framework):
                    continue
            categories.append(category)

        categories.sort(
            key=lambda item: (
                int(item.get("order", 999)),
                str(item.get("label") or item.get("id") or "").lower(),
            )
        )
        return jsonify(categories), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@categories_bp.route("/categories/<category_id>", methods=["POST"])
@require_admin
def create_category(category_id):
    """Crea categoría con ID explícito"""
    try:
        payload = normalize_category_payload({**(request.json or {}), "id": category_id})
        doc_ref = db.collection("categories").document(payload["id"])
        if doc_ref.get().exists:
            return jsonify({"error": "Ya existe una categoría con ese ID"}), 409

        now = datetime.utcnow().isoformat()
        doc_ref.set(
            {
                **payload,
                "metadata": {
                    "createdAt": now,
                    "updatedAt": now,
                    "createdBy": request.uid,
                },
            }
        )
        return jsonify({"id": payload["id"], "message": "Categoría creada exitosamente"}), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@categories_bp.route("/categories/<category_id>", methods=["PUT"])
@require_admin
def update_category(category_id):
    """Actualiza categoría"""
    try:
        doc_ref = db.collection("categories").document(category_id)
        if not doc_ref.get().exists:
            return jsonify({"error": "Categoría no encontrada"}), 404

        payload = normalize_category_payload({**(request.json or {}), "id": category_id})
        payload.pop("id", None)
        payload["metadata.updatedAt"] = datetime.utcnow().isoformat()
        doc_ref.update(payload)
        return jsonify({"message": "Categoría actualizada exitosamente"}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@categories_bp.route("/categories/<category_id>", methods=["DELETE"])
@require_admin
def delete_category(category_id):
    """Desactiva categoría (soft delete)"""
    try:
        doc_ref = db.collection("categories").document(category_id)
        if not doc_ref.get().exists:
            return jsonify({"error": "Categoría no encontrada"}), 404
        doc_ref.update(
            {
                "isActive": False,
                "metadata.updatedAt": datetime.utcnow().isoformat(),
            }
        )
        return jsonify({"message": "Categoría desactivada exitosamente"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
