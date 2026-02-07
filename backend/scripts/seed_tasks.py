"""
Seed de la colección 'task' en Firestore.
Ejecutar desde la raíz del backend: python -m scripts.seed_tasks

Los bloques del palette se leen desde Firestore; este script inserta
documentos mínimos para Airflow y Argo para que la app funcione.
No reemplaza los JSON del frontend: esos ya no se usan; todo viene de Firestore.
"""

import sys
from pathlib import Path

# Añadir backend al path para importar config
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from config.firebase import db

COLLECTION = "task"


def seed_airflow():
    """Inserta tasks de ejemplo para framework Airflow."""
    docs = [
        {
            "name": "WITH DAG",
            "type": "DAG",
            "icon": "account_tree",
            "category": "airflow",
            "description": "Objeto DAG de Airflow (schedule, tags, etc.).",
            "framework": "airflow",
            "platform": "airflow",
            "template": "dag",
            "parameters": {
                "dag_id": {"type": "string", "required": True, "default": "my_dag"},
                "schedule_interval": {"type": "string", "required": False, "default": "@daily"},
                "tags": {"type": "array", "required": False, "default": ["consumption"]},
            },
            "isDefaultFavorite": False,
            "isActive": True,
        },
        {
            "name": "Bash Command",
            "type": "BashOperator",
            "icon": "terminal",
            "category": "util",
            "description": "Ejecuta comandos Bash.",
            "framework": "airflow",
            "platform": "airflow",
            "template": "bash",
            "parameters": {
                "task_id": {"type": "string", "required": True, "default": "bash_task"},
                "bash_command": {"type": "string", "required": True},
            },
            "isDefaultFavorite": True,
            "isActive": True,
        },
        {
            "name": "Python Function",
            "type": "PythonOperator",
            "icon": "functions",
            "category": "python",
            "description": "Ejecuta una función Python.",
            "framework": "airflow",
            "platform": "airflow",
            "template": "python",
            "parameters": {
                "task_id": {"type": "string", "required": True, "default": "python_task"},
                "python_callable": {"type": "string", "required": True},
            },
            "isDefaultFavorite": True,
            "isActive": True,
        },
        {
            "name": "Dummy Task",
            "type": "DummyOperator",
            "icon": "circle",
            "category": "util",
            "description": "Operador que no hace nada.",
            "framework": "airflow",
            "platform": "airflow",
            "template": "dummy",
            "parameters": {
                "task_id": {"type": "string", "required": True, "default": "dummy_task"},
            },
            "isDefaultFavorite": False,
            "isActive": True,
        },
    ]
    ref = db.collection(COLLECTION)
    for d in docs:
        ref.add(d)
    print(f"  Airflow: {len(docs)} tasks insertadas.")


def seed_argo():
    """Inserta tasks de ejemplo para framework Argo."""
    docs = [
        {
            "name": "Workflow",
            "type": "ArgoWorkflow",
            "icon": "hub",
            "category": "argo",
            "description": "Definición de Workflow en Argo.",
            "framework": "argo",
            "platform": "argo",
            "template": "workflow",
            "parameters": {
                "name": {"type": "string", "required": True, "default": "my-workflow"},
            },
            "isDefaultFavorite": False,
            "isActive": True,
        },
        {
            "name": "Step",
            "type": "ArgoStep",
            "icon": "play_arrow",
            "category": "steps",
            "description": "Paso de un workflow Argo.",
            "framework": "argo",
            "platform": "argo",
            "template": "step",
            "parameters": {
                "name": {"type": "string", "required": True, "default": "step1"},
            },
            "isDefaultFavorite": True,
            "isActive": True,
        },
    ]
    ref = db.collection(COLLECTION)
    for d in docs:
        ref.add(d)
    print(f"  Argo: {len(docs)} tasks insertadas.")


def main():
    print("Seed de colección 'task' en Firestore...")
    seed_airflow()
    seed_argo()
    print("Listo.")


if __name__ == "__main__":
    main()
