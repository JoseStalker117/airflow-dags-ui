from datetime import datetime

from flask import Blueprint, jsonify, request

from config.firebase import db
from middleware.auth import require_admin

templates_bp = Blueprint("templates", __name__)

TEMPLATE_REQUIRED_FIELDS = [
    "id",
    "name",
    "framework",
    "nodes",
    "edges",
]


def normalize_template_payload(data):
    if not isinstance(data, dict):
        raise ValueError("Payload inválido")

    missing = [
        field
        for field in TEMPLATE_REQUIRED_FIELDS
        if field not in data or data.get(field) in (None, "")
    ]
    if missing:
        raise ValueError(f"Campos requeridos: {', '.join(missing)}")

    framework = data.get("framework")
    if framework not in ("airflow", "argo"):
        raise ValueError('framework debe ser "airflow" o "argo"')

    nodes = data.get("nodes")
    edges = data.get("edges")
    if not isinstance(nodes, list):
        raise ValueError("nodes debe ser un arreglo")
    if not isinstance(edges, list):
        raise ValueError("edges debe ser un arreglo")

    return {
        "id": str(data.get("id", "")).strip(),
        "name": str(data.get("name", "")).strip(),
        "description": str(data.get("description", "")).strip(),
        "framework": framework,
        "nodes": nodes,
        "edges": edges,
        "isActive": data.get("isActive", True) is not False,
    }


@templates_bp.route("/templates", methods=["GET"])
def get_templates():
    """Obtiene plantillas activas. Query: ?framework=airflow|argo"""
    try:
        framework = request.args.get("framework")
        query = db.collection("templates").where("isActive", "==", True)
        if framework in ("airflow", "argo"):
            query = query.where("framework", "==", framework)

        docs = query.stream()
        templates = []
        for doc in docs:
            data = doc.to_dict()
            data["id"] = doc.id
            templates.append(data)

        templates.sort(key=lambda item: str(item.get("name") or item.get("id") or "").lower())
        return jsonify(templates), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@templates_bp.route("/admin/templates", methods=["GET"])
@require_admin
def get_templates_admin():
    """Obtiene plantillas para administración. Query: ?framework=airflow|argo&includeInactive=true|false"""
    try:
        framework = request.args.get("framework")
        include_inactive = request.args.get("includeInactive", "true").lower() == "true"

        query = db.collection("templates")
        if not include_inactive:
            query = query.where("isActive", "==", True)
        if framework in ("airflow", "argo"):
            query = query.where("framework", "==", framework)

        docs = query.stream()
        templates = []
        for doc in docs:
            data = doc.to_dict()
            data["id"] = doc.id
            templates.append(data)

        templates.sort(key=lambda item: str(item.get("name") or item.get("id") or "").lower())
        return jsonify(templates), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@templates_bp.route("/templates/<template_id>", methods=["GET"])
def get_template(template_id):
    """Obtiene una plantilla activa por ID"""
    try:
        doc = db.collection("templates").document(template_id).get()
        if not doc.exists:
            return jsonify({"error": "Plantilla no encontrada"}), 404

        data = doc.to_dict()
        if data.get("isActive", True) is False:
            return jsonify({"error": "Plantilla no encontrada"}), 404

        data["id"] = doc.id
        return jsonify(data), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@templates_bp.route("/templates", methods=["POST"])
@require_admin
def create_template():
    """Crea una nueva plantilla"""
    try:
        payload = normalize_template_payload(request.json or {})
        template_id = payload["id"]

        doc_ref = db.collection("templates").document(template_id)
        if doc_ref.get().exists:
            return jsonify({"error": "Ya existe una plantilla con ese ID"}), 409

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

        return jsonify({"id": template_id, "message": "Plantilla creada exitosamente"}), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@templates_bp.route("/templates/<template_id>", methods=["PUT"])
@require_admin
def update_template(template_id):
    """Actualiza una plantilla existente"""
    try:
        doc_ref = db.collection("templates").document(template_id)
        if not doc_ref.get().exists:
            return jsonify({"error": "Plantilla no encontrada"}), 404

        payload = normalize_template_payload({**(request.json or {}), "id": template_id})
        payload.pop("id", None)
        payload["metadata.updatedAt"] = datetime.utcnow().isoformat()

        doc_ref.update(payload)
        return jsonify({"message": "Plantilla actualizada exitosamente"}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@templates_bp.route("/templates/<template_id>", methods=["DELETE"])
@require_admin
def delete_template(template_id):
    """Desactiva una plantilla (soft delete)"""
    try:
        doc_ref = db.collection("templates").document(template_id)
        if not doc_ref.get().exists:
            return jsonify({"error": "Plantilla no encontrada"}), 404

        doc_ref.update(
            {
                "isActive": False,
                "metadata.updatedAt": datetime.utcnow().isoformat(),
            }
        )
        return jsonify({"message": "Plantilla desactivada exitosamente"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
