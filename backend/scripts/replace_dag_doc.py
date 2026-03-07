"""
Reemplaza el documento tasks/DAG en Firestore usando la definición
del nodo raíz DAG encontrada en backend/scripts/airflow.json.

Uso:
  python -m scripts.replace_dag_doc
"""

from __future__ import annotations

import json
from pathlib import Path

from config.firebase import db


def load_root_dag_task() -> dict:
    scripts_dir = Path(__file__).resolve().parent
    airflow_json_path = scripts_dir / "airflow.json"

    with airflow_json_path.open("r", encoding="utf-8") as f:
        payload = json.load(f)

    # Soporta dos formatos:
    # 1) {"tasks": [ ... ]}
    # 2) { ...task DAG... }
    if isinstance(payload, dict) and isinstance(payload.get("tasks"), list):
        dag_task = next((task for task in payload["tasks"] if task.get("id") == "DAG"), None)
        if dag_task:
            return dag_task

    if isinstance(payload, dict) and payload.get("id") == "DAG":
        return payload

    raise RuntimeError(
        "No se encontró el nodo con id='DAG' en airflow.json (formato esperado: {'tasks': [...]} o task directo)."
    )


def replace_dag_doc() -> None:
    dag_task = load_root_dag_task()
    db.collection("tasks").document("DAG").set(dag_task)
    print("OK: documento tasks/DAG reemplazado correctamente")


if __name__ == "__main__":
    replace_dag_doc()
