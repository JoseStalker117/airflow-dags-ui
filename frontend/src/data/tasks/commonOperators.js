/**
 * Common Operators - Operadores más usados de Airflow 2.4.0
 * Categoría: Comunes
 */
export const commonOperators = [
  {
    id: "dag_definition",
    label: "DAG Definition",
    type: "DAG",
    icon: "account_tree",
    category: "common",
    description: "Define un DAG de Airflow con sus argumentos (schedule, tags, email, etc.). Todas las tareas irán dentro de este DAG.",
    parameters: {
      dag_id: {
        type: "string",
        required: true,
        default: "my_dag",
        description: "ID único del DAG (obligatorio)"
      },
      description: {
        type: "string",
        required: false,
        default: "",
        description: "Descripción del DAG"
      },
      schedule_interval: {
        type: "string",
        required: false,
        default: "@daily",
        description: "Intervalo de ejecución (ej: '@daily', '@hourly', '0 0 * * *', None)"
      },
      tags: {
        type: "array",
        required: false,
        default: [],
        description: "Tags para categorizar el DAG (ej: ['production', 'data-pipeline'])"
      },
      default_args: {
        type: "object",
        required: false,
        default: {
          owner: "airflow",
          email: "",
          retries: 1,
          retry_delay: "timedelta(minutes=5)"
        },
        description: "Argumentos por defecto para todas las tareas del DAG"
      },
      catchup: {
        type: "boolean",
        required: false,
        default: false,
        description: "Ejecutar ejecuciones pasadas automáticamente (catchup)"
      },
      max_active_runs: {
        type: "integer",
        required: false,
        default: 1,
        description: "Número máximo de ejecuciones activas simultáneas"
      },
      concurrency: {
        type: "integer",
        required: false,
        default: 16,
        description: "Número máximo de tareas que pueden ejecutarse simultáneamente"
      }
    }
  },
  {
    id: "dummy_operator",
    label: "Dummy",
    type: "DummyOperator",
    icon: "radio_button_unchecked",
    category: "common",
    description: "Operador dummy que no hace nada (útil para testing y orquestación)",
    parameters: {}
  },
  {
    id: "branch_operator",
    label: "Branch",
    type: "BranchPythonOperator",
    icon: "call_split",
    category: "common",
    description: "Ejecuta diferentes tareas basado en una condición Python",
    parameters: {
      python_callable: {
        type: "string",
        required: true,
        default: "def branch_func(**context):\n    return 'task_a'  # o 'task_b'",
        description: "Función Python que retorna el task_id a ejecutar"
      },
      follow_task_ids_if_true: {
        type: "array",
        required: false,
        default: [],
        description: "Task IDs a ejecutar si la condición es True"
      },
      follow_task_ids_if_false: {
        type: "array",
        required: false,
        default: [],
        description: "Task IDs a ejecutar si la condición es False"
      }
    }
  },
  {
    id: "short_circuit",
    label: "Short Circuit",
    type: "ShortCircuitOperator",
    icon: "electric_bolt",
    category: "common",
    description: "Detiene la ejecución downstream si la condición es False",
    parameters: {
      python_callable: {
        type: "string",
        required: true,
        default: "def check_condition(**context):\n    return True  # True = continuar, False = parar",
        description: "Función que retorna True/False para continuar/detener"
      }
    }
  },
  {
    id: "python_operator",
    label: "Python",
    type: "PythonOperator",
    icon: "functions",
    category: "common",
    description: "Ejecuta una función Python (operador más usado)",
    parameters: {
      python_callable: {
        type: "string",
        required: true,
        default: "def my_function(**context):\n    print('Hello from Airflow')\n    return 'success'",
        description: "Código de la función Python a ejecutar"
      },
      op_kwargs: {
        type: "object",
        required: false,
        default: {},
        description: "Argumentos pasados a la función callable"
      },
      op_args: {
        type: "array",
        required: false,
        default: [],
        description: "Lista de argumentos posicionales"
      },
      do_xcom_push: {
        type: "boolean",
        required: false,
        default: true,
        description: "Habilitar XCom push (retornar datos)"
      }
    }
  }
];
