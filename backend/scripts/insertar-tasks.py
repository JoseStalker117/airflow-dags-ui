"""
Script para poblar la colección 'tasks' en Firestore
- Elimina todos los documentos existentes
- Inserta las tasks de ejemplo con estructura completa
"""

import sys
from pathlib import Path

# Añadir backend al path para importar config
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from config.firebase import db

COLLECTION = "tasks"  # Nota: usa "tasks" (plural) según tu esquema

# ========== TASKS DE EJEMPLO ==========

INITIAL_TASKS = [
    # ========== AIRFLOW ==========
    
    # DAG Principal
    {
        "id": "DAG",
        "name": "DAG",
        "type": "DAG",
        "icon": "account_tree",
        "category": "airflow",
        "description": "Contenedor principal de flujo de Airflow",
        "framework": "airflow",
        "platform": "airflow",
        "template": "dag",
        "isDefaultFavorite": True,
        "isActive": True,
        "parameters": {
            "dag_id": {
                "type": "string",
                "default": "my_dag",
                "description": "Identificador único del DAG"
            },
            "schedule": {
                "type": "string",
                "default": "@daily",
                "description": "Expresión cron o preset (@daily, @hourly, etc.)"
            },
            "start_date": {
                "type": "string",
                "default": "2024-01-01",
                "description": "Fecha de inicio (YYYY-MM-DD)"
            },
            "catchup": {
                "type": "boolean",
                "default": False,
                "description": "Ejecutar tareas pasadas"
            },
            "tags": {
                "type": "array",
                "default": [],
                "description": "Etiquetas del DAG"
            },
            "description": {
                "type": "string",
                "default": "",
                "description": "Descripción del DAG"
            }
        }
    },

    # Operadores Básicos (Utility)
    {
        "id": "BashOperator",
        "name": "Bash Operator",
        "type": "BashOperator",
        "icon": "terminal",
        "category": "util",
        "description": "Ejecuta comandos bash en el sistema",
        "framework": "airflow",
        "platform": "airflow",
        "template": "bash_operator",
        "isDefaultFavorite": True,
        "isActive": True,
        "parameters": {
            "task_id": {
                "type": "string",
                "default": "bash_task",
                "description": "ID único de la tarea"
            },
            "bash_command": {
                "type": "string",
                "default": "echo 'Hello World'",
                "description": "Comando bash a ejecutar"
            },
            "retries": {
                "type": "integer",
                "default": 3,
                "description": "Número de reintentos"
            },
            "retry_delay": {
                "type": "integer",
                "default": 300,
                "description": "Segundos entre reintentos"
            },
            "env": {
                "type": "object",
                "default": {},
                "description": "Variables de entorno"
            }
        }
    },

    {
        "id": "PythonOperator",
        "name": "Python Operator",
        "type": "PythonOperator",
        "icon": "code",
        "category": "util",
        "description": "Ejecuta funciones Python",
        "framework": "airflow",
        "platform": "airflow",
        "template": "python_operator",
        "isDefaultFavorite": True,
        "isActive": True,
        "parameters": {
            "task_id": {
                "type": "string",
                "default": "python_task",
                "description": "ID único de la tarea"
            },
            "python_callable": {
                "type": "string",
                "default": "my_function",
                "description": "Nombre de la función"
            },
            "op_kwargs": {
                "type": "object",
                "default": {},
                "description": "Argumentos de la función"
            },
            "retries": {
                "type": "integer",
                "default": 3
            }
        }
    },

    {
        "id": "PythonVirtualenvOperator",
        "name": "Python Virtualenv Operator",
        "type": "PythonVirtualenvOperator",
        "icon": "workspace",
        "category": "util",
        "description": "Ejecuta Python en virtualenv aislado",
        "framework": "airflow",
        "platform": "airflow",
        "template": "python_virtualenv_operator",
        "isDefaultFavorite": False,
        "isActive": True,
        "parameters": {
            "task_id": {
                "type": "string",
                "default": "venv_task"
            },
            "python_callable": {
                "type": "string",
                "default": "my_function"
            },
            "requirements": {
                "type": "array",
                "default": [],
                "description": "Paquetes pip requeridos"
            },
            "python_version": {
                "type": "string",
                "default": "3.8"
            }
        }
    },

    {
        "id": "DummyOperator",
        "name": "Dummy Operator",
        "type": "DummyOperator",
        "icon": "radio_button_unchecked",
        "category": "util",
        "description": "Placeholder sin operación",
        "framework": "airflow",
        "platform": "airflow",
        "template": "dummy_operator",
        "isDefaultFavorite": False,
        "isActive": True,
        "parameters": {
            "task_id": {
                "type": "string",
                "default": "dummy_task"
            }
        }
    },

    # Base de Datos
    {
        "id": "PostgresOperator",
        "name": "Postgres Operator",
        "type": "PostgresOperator",
        "icon": "storage",
        "category": "util",
        "description": "Ejecuta consultas SQL en PostgreSQL",
        "framework": "airflow",
        "platform": "airflow",
        "template": "postgres_operator",
        "isDefaultFavorite": False,
        "isActive": True,
        "parameters": {
            "task_id": {
                "type": "string",
                "default": "postgres_task"
            },
            "sql": {
                "type": "string",
                "default": "SELECT 1;",
                "description": "Query SQL"
            },
            "postgres_conn_id": {
                "type": "string",
                "default": "postgres_default",
                "description": "ID de conexión"
            }
        }
    },

    {
        "id": "BigQueryOperator",
        "name": "BigQuery Operator",
        "type": "BigQueryOperator",
        "icon": "cloud",
        "category": "util",
        "description": "Ejecuta consultas en BigQuery",
        "framework": "airflow",
        "platform": "airflow",
        "template": "bigquery_operator",
        "isDefaultFavorite": False,
        "isActive": True,
        "parameters": {
            "task_id": {
                "type": "string",
                "default": "bigquery_task"
            },
            "sql": {
                "type": "string",
                "default": "SELECT 1;",
                "description": "Query SQL"
            },
            "use_legacy_sql": {
                "type": "boolean",
                "default": False
            },
            "gcp_conn_id": {
                "type": "string",
                "default": "google_cloud_default"
            }
        }
    },

    {
        "id": "SQLExecuteQueryOperator",
        "name": "SQL Execute Query Operator",
        "type": "SQLExecuteQueryOperator",
        "icon": "database",
        "category": "util",
        "description": "Ejecuta queries SQL genéricas",
        "framework": "airflow",
        "platform": "airflow",
        "template": "sql_execute_query_operator",
        "isDefaultFavorite": False,
        "isActive": True,
        "parameters": {
            "task_id": {
                "type": "string",
                "default": "sql_task"
            },
            "sql": {
                "type": "string",
                "default": "SELECT 1;"
            },
            "conn_id": {
                "type": "string",
                "default": "default"
            }
        }
    },

    # Transferencias
    {
        "id": "LocalFilesystemToS3Operator",
        "name": "Local to S3 Operator",
        "type": "LocalFilesystemToS3Operator",
        "icon": "upload_file",
        "category": "transfers",
        "description": "Sube archivos locales a S3",
        "framework": "airflow",
        "platform": "airflow",
        "template": "local_to_s3_operator",
        "isDefaultFavorite": False,
        "isActive": True,
        "parameters": {
            "task_id": {
                "type": "string",
                "default": "upload_to_s3"
            },
            "filename": {
                "type": "string",
                "default": "/path/to/file.csv"
            },
            "dest_key": {
                "type": "string",
                "default": "s3://bucket/path/file.csv"
            },
            "aws_conn_id": {
                "type": "string",
                "default": "aws_default"
            }
        }
    },

    {
        "id": "S3ToS3Operator",
        "name": "S3 to S3 Operator",
        "type": "S3ToS3Operator",
        "icon": "file_copy",
        "category": "transfers",
        "description": "Copia archivos entre buckets S3",
        "framework": "airflow",
        "platform": "airflow",
        "template": "s3_to_s3_operator",
        "isDefaultFavorite": False,
        "isActive": True,
        "parameters": {
            "task_id": {
                "type": "string",
                "default": "s3_copy"
            },
            "source_key": {
                "type": "string",
                "default": "s3://source-bucket/file.csv"
            },
            "dest_key": {
                "type": "string",
                "default": "s3://dest-bucket/file.csv"
            }
        }
    },

    {
        "id": "SFTPOperator",
        "name": "SFTP Operator",
        "type": "SFTPOperator",
        "icon": "cloud_sync",
        "category": "transfers",
        "description": "Transferencia SFTP",
        "framework": "airflow",
        "platform": "airflow",
        "template": "sftp_operator",
        "isDefaultFavorite": False,
        "isActive": True,
        "parameters": {
            "task_id": {
                "type": "string",
                "default": "sftp_task"
            },
            "local_filepath": {
                "type": "string",
                "default": "/local/file.csv"
            },
            "remote_filepath": {
                "type": "string",
                "default": "/remote/file.csv"
            },
            "operation": {
                "type": "string",
                "default": "put",
                "description": "put o get"
            }
        }
    },

    {
        "id": "GCSToBigQueryOperator",
        "name": "GCS to BigQuery Operator",
        "type": "GCSToBigQueryOperator",
        "icon": "cloud_upload",
        "category": "transfers",
        "description": "Carga datos de GCS a BigQuery",
        "framework": "airflow",
        "platform": "airflow",
        "template": "gcs_to_bigquery_operator",
        "isDefaultFavorite": False,
        "isActive": True,
        "parameters": {
            "task_id": {
                "type": "string",
                "default": "gcs_to_bq"
            },
            "bucket": {
                "type": "string",
                "default": "my-bucket"
            },
            "source_objects": {
                "type": "array",
                "default": ["data/*.csv"]
            },
            "destination_table": {
                "type": "string",
                "default": "project.dataset.table"
            }
        }
    },

    # Sensores
    {
        "id": "FileSensor",
        "name": "File Sensor",
        "type": "FileSensor",
        "icon": "sensors",
        "category": "sensors",
        "description": "Espera a que exista un archivo",
        "framework": "airflow",
        "platform": "airflow",
        "template": "file_sensor",
        "isDefaultFavorite": False,
        "isActive": True,
        "parameters": {
            "task_id": {
                "type": "string",
                "default": "wait_for_file"
            },
            "filepath": {
                "type": "string",
                "default": "/path/to/file.csv"
            },
            "poke_interval": {
                "type": "integer",
                "default": 60,
                "description": "Segundos entre verificaciones"
            },
            "timeout": {
                "type": "integer",
                "default": 3600,
                "description": "Timeout en segundos"
            }
        }
    },

    {
        "id": "S3KeySensor",
        "name": "S3 Key Sensor",
        "type": "S3KeySensor",
        "icon": "cloud_done",
        "category": "sensors",
        "description": "Espera a que exista un objeto S3",
        "framework": "airflow",
        "platform": "airflow",
        "template": "s3_key_sensor",
        "isDefaultFavorite": False,
        "isActive": True,
        "parameters": {
            "task_id": {
                "type": "string",
                "default": "wait_for_s3"
            },
            "bucket_key": {
                "type": "string",
                "default": "s3://bucket/path/file.csv"
            },
            "aws_conn_id": {
                "type": "string",
                "default": "aws_default"
            },
            "poke_interval": {
                "type": "integer",
                "default": 60
            }
        }
    },

    {
        "id": "SqlSensor",
        "name": "SQL Sensor",
        "type": "SqlSensor",
        "icon": "data_check",
        "category": "sensors",
        "description": "Espera condición SQL",
        "framework": "airflow",
        "platform": "airflow",
        "template": "sql_sensor",
        "isDefaultFavorite": False,
        "isActive": True,
        "parameters": {
            "task_id": {
                "type": "string",
                "default": "wait_for_data"
            },
            "sql": {
                "type": "string",
                "default": "SELECT COUNT(*) FROM table WHERE ready = true"
            },
            "conn_id": {
                "type": "string",
                "default": "default"
            }
        }
    },

    {
        "id": "HttpSensor",
        "name": "HTTP Sensor",
        "type": "HttpSensor",
        "icon": "http",
        "category": "sensors",
        "description": "Espera respuesta HTTP",
        "framework": "airflow",
        "platform": "airflow",
        "template": "http_sensor",
        "isDefaultFavorite": False,
        "isActive": True,
        "parameters": {
            "task_id": {
                "type": "string",
                "default": "wait_for_endpoint"
            },
            "endpoint": {
                "type": "string",
                "default": "/api/status"
            },
            "http_conn_id": {
                "type": "string",
                "default": "http_default"
            }
        }
    },

    # Operadores de Control de Flujo
    {
        "id": "BranchPythonOperator",
        "name": "Branch Python Operator",
        "type": "BranchPythonOperator",
        "icon": "call_split",
        "category": "util",
        "description": "Ramificación condicional",
        "framework": "airflow",
        "platform": "airflow",
        "template": "branch_python_operator",
        "isDefaultFavorite": False,
        "isActive": True,
        "parameters": {
            "task_id": {
                "type": "string",
                "default": "branch_task"
            },
            "python_callable": {
                "type": "string",
                "default": "branch_function",
                "description": "Función que retorna task_id"
            }
        }
    },

    {
        "id": "ShortCircuitOperator",
        "name": "Short Circuit Operator",
        "type": "ShortCircuitOperator",
        "icon": "electric_bolt",
        "category": "util",
        "description": "Corto circuito condicional",
        "framework": "airflow",
        "platform": "airflow",
        "template": "short_circuit_operator",
        "isDefaultFavorite": False,
        "isActive": True,
        "parameters": {
            "task_id": {
                "type": "string",
                "default": "check_condition"
            },
            "python_callable": {
                "type": "string",
                "default": "condition_function"
            }
        }
    },

    # ========== ARGO ==========

    {
        "id": "ArgoWorkflow",
        "name": "Argo Workflow",
        "type": "ArgoWorkflow",
        "icon": "hub",
        "category": "argo",
        "description": "Workflow principal de Argo",
        "framework": "argo",
        "platform": "argo",
        "template": "argo_workflow",
        "isDefaultFavorite": True,
        "isActive": True,
        "parameters": {
            "name": {
                "type": "string",
                "default": "my-workflow",
                "description": "Nombre del workflow"
            },
            "namespace": {
                "type": "string",
                "default": "default"
            },
            "serviceAccountName": {
                "type": "string",
                "default": "default"
            },
            "entrypoint": {
                "type": "string",
                "default": "main",
                "description": "Template de entrada"
            }
        }
    }
]


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
    
    # Commit del último batch si quedaron operaciones
    if batch_count > 0:
        batch.commit()
    
    print(f"   ✓ Eliminados {deleted_count} documentos")
    return deleted_count


def insert_tasks(tasks):
    """
    Inserta las tasks en Firestore usando el campo 'id' como document ID.
    """
    print(f"\n📝 Insertando {len(tasks)} tasks...")
    
    collection_ref = db.collection(COLLECTION)
    
    created_count = 0
    error_count = 0
    
    for task in tasks:
        try:
            # Usar el campo 'id' como document ID
            doc_id = task.get("id", task["type"])
            
            # Firestore no acepta el campo 'id' en el documento,
            # así que lo removemos antes de insertar
            task_data = {k: v for k, v in task.items() if k != "id"}
            
            collection_ref.document(doc_id).set(task_data)
            print(f"   ✓ {task['name']} ({doc_id})")
            created_count += 1
            
        except Exception as e:
            print(f"   ✗ Error en {task.get('name', 'Unknown')}: {e}")
            error_count += 1
    
    print(f"\n📊 Resumen:")
    print(f"   - Creadas: {created_count}")
    print(f"   - Errores: {error_count}")
    print(f"   - Total: {len(tasks)}")
    
    return created_count, error_count


def main():
    """
    Función principal que ejecuta el proceso completo.
    """
    print("=" * 60)
    print("🔥 POBLACIÓN DE FIRESTORE - COLECCIÓN 'TASKS'")
    print("=" * 60)
    
    # Confirmación de seguridad
    print(f"\n⚠️  ADVERTENCIA: Este script eliminará TODOS los documentos")
    print(f"   de la colección '{COLLECTION}' y los reemplazará con")
    print(f"   {len(INITIAL_TASKS)} tasks de ejemplo.")
    
    confirmation = input("\n¿Deseas continuar? (escribe 'SI' para confirmar): ")
    
    if confirmation.strip().upper() != "SI":
        print("\n❌ Operación cancelada.")
        return
    
    # Eliminar colección existente
    deleted = delete_collection(COLLECTION)
    
    # Insertar nuevas tasks
    created, errors = insert_tasks(INITIAL_TASKS)
    
    print("\n" + "=" * 60)
    if errors == 0:
        print("✅ PROCESO COMPLETADO EXITOSAMENTE")
    else:
        print(f"⚠️  PROCESO COMPLETADO CON {errors} ERRORES")
    print("=" * 60)
    
    # Resumen final
    print(f"\nEstadísticas:")
    print(f"  • Documentos eliminados: {deleted}")
    print(f"  • Documentos creados: {created}")
    print(f"  • Errores: {errors}")
    
    # Mostrar distribución por framework
    airflow_count = sum(1 for t in INITIAL_TASKS if t["framework"] == "airflow")
    argo_count = sum(1 for t in INITIAL_TASKS if t["framework"] == "argo")
    
    print(f"\nDistribución por framework:")
    print(f"  • Airflow: {airflow_count} tasks")
    print(f"  • Argo: {argo_count} tasks")
    
    # Mostrar favoritos
    favorites = [t["name"] for t in INITIAL_TASKS if t.get("isDefaultFavorite")]
    print(f"\nTasks marcadas como favoritas ({len(favorites)}):")
    for fav in favorites:
        print(f"  • {fav}")


if __name__ == "__main__":
    main()