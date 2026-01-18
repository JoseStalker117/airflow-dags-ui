/**
 * Airflow Native Operators - Operadores nativos de Airflow 2.4.0
 * Incluye: Bash, Python, Sensors
 */

export const airflowOperators = [
  { // Dummy Task
    id: "dummy_operator",
    label: "Dummy Task",
    favoritos: false,
    type: "DummyOperator",
    icon: "circle",
    category: "util",
    description:
      "Un operador que no hace nada, útil para marcar puntos en el DAG o testing.",
    parameters: {
      task_id: {
        type: "string",
        required: true,
        default: "dummy_task",
        description: "ID único de la tarea (task_id)",
      },
    },
  },
  { // Bash Operator
    id: "bash_operator",
    label: "Bash Command",
    favoritos: true,
    type: "BashOperator",
    icon: "terminal",
    category: "util",
    description: "Ejecuta comandos de Bash en el sistema.",
    parameters: {
      task_id: {
        type: "string",
        required: true,
        default: "bash_task",
        description: "ID único de la tarea (task_id)",
      },
      bash_command: {
        type: "string",
        required: true,
        description: "Comando Bash a ejecutar",
      },
    },
  },
  { // Empty Operator
    id: "empty_operator",
    label: "Empty Task",
    favoritos: false,
    type: "EmptyOperator",
    icon: "circle",
    category: "util",
    description:
      "Similar a DummyOperator, útil para marcar inicio o fin de un DAG.",
    parameters: {
      task_id: {
        type: "string",
        required: true,
        default: "empty_task",
        description: "ID único de la tarea (task_id)",
      },
    },
  },
  { // Trigger DAG
    id: "trigger_dag_operator",
    label: "Trigger DAG",
    favoritos: false,
    type: "TriggerDagRunOperator",
    icon: "repeat",
    category: "util",
    description: "Permite disparar otro DAG desde este DAG.",
    parameters: {
      task_id: {
        type: "string",
        required: true,
        default: "trigger_task",
        description: "ID único de la tarea (task_id)",
      },
      trigger_dag_id: {
        type: "string",
        required: true,
        description: "ID del DAG que se quiere disparar",
      },
    },
  },
];
