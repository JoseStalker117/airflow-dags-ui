from datetime import datetime

from flask import Blueprint, jsonify, request

from config.firebase import db
from middleware.auth import require_admin

styles_bp = Blueprint("styles", __name__)

STYLE_REQUIRED_FIELDS = ["id"]


def normalize_style_payload(data):
    if not isinstance(data, dict):
        raise ValueError("Payload inválido")

    missing = [
        field
        for field in STYLE_REQUIRED_FIELDS
        if field not in data or str(data.get(field, "")).strip() == ""
    ]
    if missing:
        raise ValueError(f"Campos requeridos: {', '.join(missing)}")

    try:
        order = int(data.get("order", 999))
    except (TypeError, ValueError):
        raise ValueError("order debe ser un número entero")

    return {
        "id": str(data.get("id", "")).strip(),
        "label": str(data.get("label", "")).strip() or str(data.get("id", "")).strip(),
        "chip": str(data.get("chip", "")).strip(),
        "card": str(data.get("card", "")).strip(),
        "hex": str(data.get("hex", "")).strip(),
        "order": order,
        "isActive": data.get("isActive", True) is not False,
    }


@styles_bp.route("/styles", methods=["GET"])
def get_styles():
    """Obtiene estilos activos."""
    try:
        docs = db.collection("styles").where("isActive", "==", True).stream()
        styles = []
        for doc in docs:
            style = doc.to_dict()
            style["id"] = doc.id
            styles.append(style)

        styles.sort(
            key=lambda item: (
                int(item.get("order", 999)),
                str(item.get("label") or item.get("id") or "").lower(),
            )
        )
        return jsonify(styles), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@styles_bp.route("/admin/styles", methods=["GET"])
@require_admin
def get_styles_admin():
    """Obtiene estilos para administración. Query: ?includeInactive=true|false"""
    try:
        include_inactive = request.args.get("includeInactive", "true").lower() == "true"
        query = db.collection("styles")
        if not include_inactive:
            query = query.where("isActive", "==", True)

        docs = query.stream()
        styles = []
        for doc in docs:
            style = doc.to_dict()
            style["id"] = doc.id
            styles.append(style)

        styles.sort(
            key=lambda item: (
                int(item.get("order", 999)),
                str(item.get("label") or item.get("id") or "").lower(),
            )
        )
        return jsonify(styles), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@styles_bp.route("/styles/<style_id>", methods=["POST"])
@require_admin
def create_style(style_id):
    """Crea estilo con ID explícito."""
    try:
        payload = normalize_style_payload({**(request.json or {}), "id": style_id})
        doc_ref = db.collection("styles").document(payload["id"])
        if doc_ref.get().exists:
            return jsonify({"error": "Ya existe un estilo con ese ID"}), 409

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
        return jsonify({"id": payload["id"], "message": "Estilo creado exitosamente"}), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@styles_bp.route("/styles/<style_id>", methods=["PUT"])
@require_admin
def update_style(style_id):
    """Actualiza estilo."""
    try:
        doc_ref = db.collection("styles").document(style_id)
        if not doc_ref.get().exists:
            return jsonify({"error": "Estilo no encontrado"}), 404

        payload = normalize_style_payload({**(request.json or {}), "id": style_id})
        payload.pop("id", None)
        payload["metadata.updatedAt"] = datetime.utcnow().isoformat()
        doc_ref.update(payload)
        return jsonify({"message": "Estilo actualizado exitosamente"}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@styles_bp.route("/styles/<style_id>", methods=["DELETE"])
@require_admin
def delete_style(style_id):
    """Desactiva estilo (soft delete)."""
    try:
        doc_ref = db.collection("styles").document(style_id)
        if not doc_ref.get().exists:
            return jsonify({"error": "Estilo no encontrado"}), 404
        doc_ref.update(
            {
                "isActive": False,
                "metadata.updatedAt": datetime.utcnow().isoformat(),
            }
        )
        return jsonify({"message": "Estilo desactivado exitosamente"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

