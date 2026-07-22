import json
import os
import time
from typing import Any, Dict, List, Optional, Tuple

import requests
from flask import Blueprint, jsonify, request

from middleware.auth import require_auth

ai_chat_bp = Blueprint("ai_chat", __name__)

DEFAULT_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
ALLOWED_ACTION_TYPES = {
    "add_node",
    "update_node",
    "delete_node",
    "connect_nodes",
    "disconnect_nodes",
    "replace_flow",
    "clear_flow",
}
ROOT_TYPES = {"DAG", "ArgoWorkflow"}

SYSTEM_PROMPT = """
Eres un asistente de DAGGER (Flask + React + React Flow). Editas el flow del canvas.

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
2) No incluyas markdown ni texto fuera del JSON.
3) Si no hay cambios a aplicar, responde actions: [].
4) Si la intención es destructiva, descríbelo claramente en assistantMessage.
5) Payloads concretos:
  - replace_flow.payload: { "nodes": [], "edges": [] }
  - add_node.payload: { "node": { "id": "unico", "type": "dagNode", "position": {"x":0,"y":0}, "data": { "type": "PythonOperator", "label": "...", "task_id": "...", "parameters": {} } } }
  - update_node.payload: { "nodeId": "...", "data": { "parameters": { "clave": "valor" } }, "position": {... opcional} }
  - delete_node.payload: { "nodeId": "..." }
  - connect_nodes.payload: { "source": "...", "target": "...", "sourceHandle": null, "targetHandle": null }
  - disconnect_nodes.payload: { "edgeId": "..." } o { "source": "...", "target": "..." }
  - clear_flow.payload: {}
6) El tipo visual de todo nodo es `dagNode`. El operador va en `data.type` (ej. PythonOperator, DAG, ArgoWorkflow).
7) Usa IDs existentes del context.flow para editar, borrar o conectar.
   En nodos nuevos usa un id único y data con: type, label, task_id, framework y parameters opcionales.
   Prefiere type/label de context.app.availableTasks para que el cliente herede parameterDefinitions editables.
8) Para modificar parámetros internos de una task existente usa update_node:
   { "type": "update_node", "payload": { "nodeId": "...", "data": { "parameters": { "task_id": "nuevo_nombre", "python_callable": "..." } } } }
   Solo cambia las claves necesarias; el cliente hace merge con los parameters actuales.
   Consulta data.parameters y data.parameterSchema del nodo en el context.
9) Respeta context.app.frameworkHint. No mezcles Airflow y Argo, no crees más de una raíz DAG/ArgoWorkflow y no generes ciclos.
10) replace_flow y clear_flow sólo si el usuario lo pide explícitamente.
11) Prefiere acciones mínimas (add/update/connect) en lugar de replace_flow.
12) Si el usuario pide conectar un nodo nuevo, incluye add_node y luego connect_nodes en el mismo actions[].
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
        if action_type not in ALLOWED_ACTION_TYPES:
            continue
        if not isinstance(payload, dict):
            payload = {}
        normalized_actions.append({"type": action_type, "payload": payload})

    return {
        "assistantMessage": str(parsed.get("assistantMessage", "")).strip(),
        "actions": normalized_actions,
    }


def _node_framework(node: Dict[str, Any]) -> Optional[str]:
    data = node.get("data") if isinstance(node.get("data"), dict) else {}
    for key in ("framework", "platform"):
        value = str(data.get(key, "")).strip().lower()
        if value in {"airflow", "argo"}:
            return value
    node_type = str(data.get("type", "")).strip()
    if node_type == "DAG":
        return "airflow"
    if node_type == "ArgoWorkflow":
        return "argo"
    return None


def _would_create_cycle(source: str, target: str, edges: List[Dict[str, Any]]) -> bool:
    if source == target:
        return True
    adjacency: Dict[str, List[str]] = {}
    for edge in edges:
        edge_source, edge_target = str(edge.get("source", "")), str(edge.get("target", ""))
        if edge_source and edge_target:
            adjacency.setdefault(edge_source, []).append(edge_target)
    pending, visited = [target], set()
    while pending:
        current = pending.pop()
        if current == source:
            return True
        if current not in visited:
            visited.add(current)
            pending.extend(adjacency.get(current, []))
    return False


def _is_valid_flow(nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]]) -> bool:
    ids = [str(node.get("id", "")).strip() for node in nodes if isinstance(node, dict)]
    if len(ids) != len(nodes) or not all(ids) or len(ids) != len(set(ids)):
        return False
    if sum(str((node.get("data") or {}).get("type", "")) in ROOT_TYPES for node in nodes) > 1:
        return False
    frameworks = {
        fw for fw in (_node_framework(node) for node in nodes) if fw in {"airflow", "argo"}
    }
    if len(frameworks) > 1:
        return False
    known_ids, checked_edges = set(ids), []
    for edge in edges:
        if not isinstance(edge, dict):
            return False
        source, target = str(edge.get("source", "")), str(edge.get("target", ""))
        if source not in known_ids or target not in known_ids or _would_create_cycle(source, target, checked_edges):
            return False
        checked_edges.append(edge)
    return True


def _context_framework_hint(context: Dict[str, Any]) -> Optional[str]:
    app = context.get("app") if isinstance(context.get("app"), dict) else {}
    hint = str(app.get("frameworkHint") or "").strip().lower()
    return hint if hint in {"airflow", "argo"} else None


def _ensure_node_id(
    node: Dict[str, Any],
    existing_ids: set,
    framework_hint: Optional[str] = None,
) -> Dict[str, Any]:
    normalized = dict(node)
    node_id = str(normalized.get("id", "")).strip()
    if not node_id:
        node_id = f"ai_node_{int(time.time() * 1000)}_{len(existing_ids)}"
        normalized["id"] = node_id
    data = normalized.get("data") if isinstance(normalized.get("data"), dict) else {}
    data = {**data, "id": data.get("id") or node_id}
    if not data.get("type"):
        data["type"] = "PythonOperator"
    if not data.get("label"):
        data["label"] = data.get("task_id") or node_id
    if not data.get("task_id"):
        data["task_id"] = data.get("label") or node_id
    fw = _node_framework({"data": data}) or framework_hint
    if fw:
        data.setdefault("framework", fw)
        data.setdefault("platform", fw)
    normalized["type"] = "dagNode"
    normalized["data"] = data
    if not isinstance(normalized.get("position"), dict):
        normalized["position"] = {"x": 80, "y": 120}
    return normalized


def _validate_actions_for_flow(
    actions: List[Dict[str, Any]], context: Dict[str, Any]
) -> Tuple[List[Dict[str, Any]], int]:
    flow = context.get("flow", {}) if isinstance(context.get("flow"), dict) else {}
    nodes = [node for node in flow.get("nodes", []) if isinstance(node, dict)]
    edges = [edge for edge in flow.get("edges", []) if isinstance(edge, dict)]
    framework_hint = _context_framework_hint(context) or next(
        (fw for fw in (_node_framework(node) for node in nodes) if fw),
        None,
    )
    accepted: List[Dict[str, Any]] = []
    rejected = 0

    for action in actions:
        action_type, payload = action["type"], dict(action["payload"])
        candidate_nodes, candidate_edges = list(nodes), list(edges)
        ids = {str(node.get("id", "")) for node in nodes}
        accepted_action = {"type": action_type, "payload": payload}

        if action_type == "clear_flow":
            candidate_nodes, candidate_edges = [], []
        elif action_type == "replace_flow":
            raw_nodes, raw_edges = payload.get("nodes"), payload.get("edges")
            if not isinstance(raw_nodes, list) or not isinstance(raw_edges, list):
                rejected += 1
                continue
            seen = set()
            normalized_nodes = []
            invalid_replace = False
            for raw in raw_nodes:
                if not isinstance(raw, dict):
                    invalid_replace = True
                    break
                node = _ensure_node_id(raw, seen, framework_hint)
                if node["id"] in seen:
                    invalid_replace = True
                    break
                seen.add(node["id"])
                normalized_nodes.append(node)
            if invalid_replace:
                rejected += 1
                continue
            candidate_nodes = normalized_nodes
            candidate_edges = [edge for edge in raw_edges if isinstance(edge, dict)]
            accepted_action["payload"] = {"nodes": candidate_nodes, "edges": candidate_edges}
        elif action_type == "add_node":
            raw_node = payload.get("node", payload)
            if not isinstance(raw_node, dict):
                rejected += 1
                continue
            node = _ensure_node_id(raw_node, ids, framework_hint)
            if node["id"] in ids:
                rejected += 1
                continue
            candidate_nodes.append(node)
            accepted_action["payload"] = {"node": node}
        elif action_type == "update_node":
            node_id = str(payload.get("nodeId", "")).strip()
            data = payload.get("data", {})
            position = payload.get("position")
            top_parameters = payload.get("parameters")
            if node_id not in ids:
                rejected += 1
                continue
            if data is not None and not isinstance(data, dict):
                rejected += 1
                continue
            if not isinstance(data, dict):
                data = {}
            if isinstance(top_parameters, dict):
                data = {
                    **data,
                    "parameters": {
                        **(data.get("parameters") if isinstance(data.get("parameters"), dict) else {}),
                        **top_parameters,
                    },
                }
            if not data and not isinstance(position, dict):
                rejected += 1
                continue
            candidate_nodes = []
            for node in nodes:
                if str(node.get("id")) != node_id:
                    candidate_nodes.append(node)
                    continue
                updated = dict(node)
                if isinstance(position, dict):
                    updated["position"] = {**(node.get("position") or {}), **position}
                if data:
                    current_data = dict(node.get("data") or {})
                    merged = {**current_data, **data}
                    if isinstance(data.get("parameters"), dict):
                        merged["parameters"] = {
                            **(current_data.get("parameters") or {}),
                            **data["parameters"],
                        }
                        if data["parameters"].get("task_id") not in (None, ""):
                            merged["task_id"] = data["parameters"]["task_id"]
                    updated["data"] = merged
                    accepted_action["payload"] = {
                        "nodeId": node_id,
                        "data": data,
                        **({"position": position} if isinstance(position, dict) else {}),
                    }
                candidate_nodes.append(updated)
        elif action_type == "delete_node":
            node_id = str(payload.get("nodeId", "")).strip()
            if node_id not in ids:
                rejected += 1
                continue
            candidate_nodes = [node for node in nodes if str(node.get("id")) != node_id]
            candidate_edges = [
                edge
                for edge in edges
                if edge.get("source") != node_id and edge.get("target") != node_id
            ]
        elif action_type == "connect_nodes":
            source = str(payload.get("source", "")).strip()
            target = str(payload.get("target", "")).strip()
            if source not in ids or target not in ids or _would_create_cycle(source, target, edges):
                rejected += 1
                continue
            duplicate = any(
                str(edge.get("source")) == source and str(edge.get("target")) == target
                for edge in edges
            )
            if duplicate:
                rejected += 1
                continue
            candidate_edges.append(
                {
                    "source": source,
                    "target": target,
                    "sourceHandle": payload.get("sourceHandle"),
                    "targetHandle": payload.get("targetHandle"),
                }
            )
        elif action_type == "disconnect_nodes":
            edge_id = str(payload.get("edgeId", "")).strip()
            if edge_id:
                if not any(str(edge.get("id", "")) == edge_id for edge in edges):
                    rejected += 1
                    continue
                candidate_edges = [edge for edge in edges if str(edge.get("id")) != edge_id]
            else:
                source = str(payload.get("source", "")).strip()
                target = str(payload.get("target", "")).strip()
                if source not in ids or target not in ids:
                    rejected += 1
                    continue
                matched = [
                    edge
                    for edge in edges
                    if edge.get("source") == source and edge.get("target") == target
                ]
                if not matched:
                    rejected += 1
                    continue
                candidate_edges = [
                    edge
                    for edge in edges
                    if not (edge.get("source") == source and edge.get("target") == target)
                ]
        else:
            rejected += 1
            continue

        if (not candidate_nodes and not candidate_edges) or _is_valid_flow(candidate_nodes, candidate_edges):
            accepted.append(accepted_action)
            nodes, edges = candidate_nodes, candidate_edges
        else:
            rejected += 1

    return accepted, rejected


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
            "maxOutputTokens": 4096,
            "responseMimeType": "application/json",
        },
    }

    response = requests.post(
        f"{url}?key={api_key}",
        json=request_body,
        timeout=45,
    )
    if response.status_code != 200:
        raise RuntimeError(f"Gemini error {response.status_code}: {response.text[:500]}")

    data = response.json()
    candidates = data.get("candidates", [])
    if not candidates:
        return {"assistantMessage": "No se recibió respuesta del modelo.", "actions": []}

    parts = candidates[0].get("content", {}).get("parts", [])
    raw_text = ""
    if parts and isinstance(parts[0], dict):
        raw_text = parts[0].get("text", "") or ""

    parsed = _extract_json_object(raw_text)
    normalized = _normalize_ai_response(parsed)
    accepted, rejected = _validate_actions_for_flow(normalized["actions"], context)
    normalized["actions"] = accepted

    if not normalized["assistantMessage"]:
        if accepted:
            normalized["assistantMessage"] = f"Listo: preparé {len(accepted)} acción(es) para el flow."
        else:
            normalized["assistantMessage"] = "No pude interpretar una acción válida. Intenta con más detalle."
    elif rejected > 0 and accepted:
        normalized["assistantMessage"] += (
            f" ({rejected} acción(es) inválida(s) fueron descartadas)"
        )
    elif rejected > 0 and not accepted:
        normalized["assistantMessage"] = (
            "Entendí la solicitud, pero ninguna acción fue válida para el flow actual. "
            "Revisa IDs, frameworks o posibles ciclos."
        )

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
