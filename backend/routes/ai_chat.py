import json
import os
from typing import Any, Dict, List

import requests
from flask import Blueprint, jsonify, request

from middleware.auth import require_auth

ai_chat_bp = Blueprint("ai_chat", __name__)

DEFAULT_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

SYSTEM_PROMPT = """
Eres un asistente de DAGGER (Flask + React + React Flow) y tu trabajo es ayudar a editar el flow.

Reglas:
1) Responde SIEMPRE en JSON válido con esta estructura exacta:
{
  "assistantMessage": "texto breve para el usuario",
  "actions": [
    {
      "type": "add_node|update_node|delete_node|connect_nodes|disconnect_nodes|replace_flow|clear_flow",
      "payload": {}
    }
  ]
}
2) No incluyas markdown, ni texto fuera del JSON.
3) Si no hay cambios a aplicar, responde actions: [].
4) Si la intención es destructiva (reemplazar o borrar múltiples nodos), descríbelo claramente en assistantMessage.
5) Usa payloads concretos y consistentes con React Flow:
  - replace_flow.payload: { "nodes": [], "edges": [] }
  - add_node.payload: { "node": {...} }
  - update_node.payload: { "nodeId": "...", "data": {...}, "position": {... opcional} }
  - delete_node.payload: { "nodeId": "..." }
  - connect_nodes.payload: { "source": "...", "target": "...", "sourceHandle": null, "targetHandle": null }
  - disconnect_nodes.payload: { "edgeId": "..." } o { "source": "...", "target": "..." }
  - clear_flow.payload: {}
6) Respeta frameworks: no mezclar Airflow y Argo en un mismo flow.
7) Usa task_id legible en nodos nuevos si viene contexto suficiente.
""".strip()


def _extract_json_object(raw_text: str) -> Dict[str, Any]:
    if not raw_text:
        return {}

    raw_text = raw_text.strip()
    try:
        parsed = json.loads(raw_text)
        if isinstance(parsed, dict):
            return parsed
    except Exception:
        pass

    start = raw_text.find("{")
    end = raw_text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return {}

    snippet = raw_text[start : end + 1]
    try:
        parsed = json.loads(snippet)
        if isinstance(parsed, dict):
            return parsed
    except Exception:
        return {}
    return {}


def _normalize_ai_response(parsed: Dict[str, Any]) -> Dict[str, Any]:
    actions = parsed.get("actions", [])
    if not isinstance(actions, list):
        actions = []

    normalized_actions: List[Dict[str, Any]] = []
    for action in actions:
        if not isinstance(action, dict):
            continue
        action_type = str(action.get("type", "")).strip()
        payload = action.get("payload", {})
        if not action_type:
            continue
        if not isinstance(payload, dict):
            payload = {}
        normalized_actions.append({"type": action_type, "payload": payload})

    return {
        "assistantMessage": str(parsed.get("assistantMessage", "")).strip(),
        "actions": normalized_actions,
    }


def _call_gemini(api_key: str, model: str, user_message: str, context: Dict[str, Any]) -> Dict[str, Any]:
    url = GEMINI_API_URL.format(model=model)
    request_body = {
        "system_instruction": {
            "parts": [{"text": SYSTEM_PROMPT}],
        },
        "contents": [
            {
                "role": "user",
                "parts": [
                    {
                        "text": json.dumps(
                            {
                                "message": user_message,
                                "context": context,
                            },
                            ensure_ascii=False,
                        )
                    }
                ],
            }
        ],
        "generationConfig": {
            "temperature": 0.2,
            "topP": 0.9,
            "maxOutputTokens": 2048,
            "responseMimeType": "application/json",
        },
    }

    response = requests.post(
        f"{url}?key={api_key}",
        json=request_body,
        timeout=30,
    )
    if response.status_code != 200:
        raise RuntimeError(f"Gemini error {response.status_code}: {response.text[:500]}")

    data = response.json()
    candidates = data.get("candidates", [])
    if not candidates:
        return {"assistantMessage": "No se recibió respuesta del modelo.", "actions": []}

    parts = (
        candidates[0]
        .get("content", {})
        .get("parts", [])
    )
    raw_text = ""
    if parts and isinstance(parts[0], dict):
        raw_text = parts[0].get("text", "") or ""

    parsed = _extract_json_object(raw_text)
    normalized = _normalize_ai_response(parsed)
    if not normalized["assistantMessage"] and not normalized["actions"]:
        return {
            "assistantMessage": "No pude interpretar una acción válida. Intenta con más detalle.",
            "actions": [],
        }
    return normalized


@ai_chat_bp.route("/ai/chat", methods=["POST"])
@require_auth
def ai_chat():
    try:
        payload = request.json or {}
        user_message = str(payload.get("message", "")).strip()
        context = payload.get("context", {})
        if not isinstance(context, dict):
            context = {}

        if not user_message:
            return jsonify({"error": "message es requerido"}), 400

        api_key = os.getenv("GEMINI_API_KEY", "").strip()
        model = str(payload.get("model") or DEFAULT_MODEL).strip() or DEFAULT_MODEL

        if not api_key:
            return jsonify(
                {
                    "assistantMessage": (
                        "El chat IA está en modo configuración. Falta GEMINI_API_KEY en backend."
                    ),
                    "actions": [],
                    "meta": {"provider": "gemini", "model": model, "configured": False},
                }
            ), 200

        ai_response = _call_gemini(api_key, model, user_message, context)
        return jsonify(
            {
                **ai_response,
                "meta": {"provider": "gemini", "model": model, "configured": True},
            }
        ), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

