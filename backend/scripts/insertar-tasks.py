"""
Script para poblar la colección 'tasks' en Firestore.
- Elimina todos los documentos existentes
- Inserta tasks desde backend/scripts/airflow.json y backend/scripts/argo.json
"""

import sys
import json
from pathlib import Path

# Añadir backend al path para importar config
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from config.firebase import db

COLLECTION = "tasks"  # Usa "tasks" (plural) según el esquema actual
SCRIPTS_DIR = Path(__file__).resolve().parent


def load_json(path: Path):
    if not path.exists():
        print(f"⚠️  No existe: {path.name}")
        return {}
    raw = path.read_text(encoding="utf-8").strip()
    if not raw:
        print(f"⚠️  Archivo vacío: {path.name}")
        return {}
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError as e:
        print(f"⚠️  JSON inválido en {path.name}: {e}")
        return {}


def load_tasks_from_sources():
    """
    Carga tasks desde airflow.json y argo.json.

    Formatos soportados:
    - {"tasks": [...]}
    - [...] (array directo)
    """
    airflow_path = SCRIPTS_DIR / "airflow.json"
    argo_path = SCRIPTS_DIR / "argo.json"

    airflow_doc = load_json(airflow_path)
    argo_doc = load_json(argo_path)

    airflow_tasks = airflow_doc.get("tasks", [])
    argo_tasks = argo_doc.get("tasks", [])

    if isinstance(airflow_tasks, list) and isinstance(argo_tasks, list):
        return airflow_tasks + argo_tasks

    # Compatibilidad con array directo
    if isinstance(airflow_doc, list):
        airflow_tasks = airflow_doc
    else:
        airflow_tasks = []

    if isinstance(argo_doc, list):
        argo_tasks = argo_doc
    else:
        argo_tasks = []

    return airflow_tasks + argo_tasks


def delete_collection(collection_name):
    """
    Elimina todos los documentos de una colección.
    ADVERTENCIA: Esta operación no se puede deshacer.
    """
    print(f"🗑️  Eliminando colección '{collection_name}'...")

    collection_ref = db.collection(collection_name)
    docs = collection_ref.stream()

    deleted_count = 0
    batch = db.batch()
    batch_count = 0

    for doc in docs:
        batch.delete(doc.reference)
        batch_count += 1
        deleted_count += 1

        # Firestore permite máximo 500 operaciones por batch
        if batch_count >= 500:
            batch.commit()
            batch = db.batch()
            batch_count = 0

    if batch_count > 0:
        batch.commit()

    print(f"   ✓ Eliminados {deleted_count} documentos")
    return deleted_count


def insert_tasks(tasks):
    """
    Inserta tasks en Firestore usando 'id' como document ID.
    """
    print(f"\n📝 Insertando {len(tasks)} tasks...")
    collection_ref = db.collection(COLLECTION)

    created_count = 0
    error_count = 0

    for task in tasks:
        try:
            task = dict(task)

            doc_id = task.get("id", task.get("type"))
            if not doc_id:
                raise ValueError("La task no contiene 'id' ni 'type'")

            # Firestore no acepta el campo 'id' dentro del documento
            task_data = {k: v for k, v in task.items() if k != "id"}

            collection_ref.document(doc_id).set(task_data)
            print(f"   ✓ {task.get('name', doc_id)} ({doc_id})")
            created_count += 1
        except Exception as e:
            print(f"   ✗ Error en {task.get('name', 'Unknown')}: {e}")
            error_count += 1

    print("\n📊 Resumen:")
    print(f"   - Creadas: {created_count}")
    print(f"   - Errores: {error_count}")
    print(f"   - Total: {len(tasks)}")
    return created_count, error_count


def main():
    tasks = load_tasks_from_sources()

    print("=" * 60)
    print("🔥 POBLACIÓN DE FIRESTORE - COLECCIÓN 'TASKS'")
    print("=" * 60)

    print("\n⚠️  ADVERTENCIA: Este script eliminará TODOS los documentos")
    print(f"   de la colección '{COLLECTION}' y los reemplazará con")
    print(f"   {len(tasks)} tasks cargadas desde JSON.")

    confirmation = input("\n¿Deseas continuar? (escribe 'SI' para confirmar): ")
    if confirmation.strip().upper() != "SI":
        print("\n❌ Operación cancelada.")
        return

    deleted = delete_collection(COLLECTION)
    created, errors = insert_tasks(tasks)

    print("\n" + "=" * 60)
    if errors == 0:
        print("✅ PROCESO COMPLETADO EXITOSAMENTE")
    else:
        print(f"⚠️  PROCESO COMPLETADO CON {errors} ERRORES")
    print("=" * 60)

    print("\nEstadísticas:")
    print(f"  • Documentos eliminados: {deleted}")
    print(f"  • Documentos creados: {created}")
    print(f"  • Errores: {errors}")

    airflow_count = sum(1 for t in tasks if t.get("framework") == "airflow")
    argo_count = sum(1 for t in tasks if t.get("framework") == "argo")
    print("\nDistribución por framework:")
    print(f"  • Airflow: {airflow_count} tasks")
    print(f"  • Argo: {argo_count} tasks")

    favorites = [t.get("name", t.get("id", "")) for t in tasks if t.get("isDefaultFavorite")]
    print(f"\nTasks marcadas como favoritas ({len(favorites)}):")
    for fav in favorites:
        print(f"  • {fav}")


if __name__ == "__main__":
    main()
