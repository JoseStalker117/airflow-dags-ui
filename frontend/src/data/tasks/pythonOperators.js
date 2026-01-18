/**
 * PythonOperator - Ejecuta funciones Python
 */
export const pythonOperators = [
  {
    id: "branch_operator",
    label: "Branch",
    type: "BranchPythonOperator",
    favoritos: true,
    icon: "call_split",
    category: "common",
    description: "Ejecuta diferentes tareas basado en una condición Python",
    parameters: {
      task_id: {
        type: "string",
        required: true,
        default: "python_branch_task",
        description: "ID único de la tarea (task_id)",
      },
      python_callable: {
        type: "string",
        required: true,
        default:
          "def branch_func(**context):\n    return 'task_a'  # o 'task_b'",
        description: "Función Python que retorna el task_id a ejecutar",
      },
      follow_task_ids_if_true: {
        type: "array",
        required: false,
        default: [],
        description: "Task IDs a ejecutar si la condición es True",
      },
      follow_task_ids_if_false: {
        type: "array",
        required: false,
        default: [],
        description: "Task IDs a ejecutar si la condición es False",
      },
    },
  },
  {
    id: "python_operator",
    label: "Python Function",
    favoritos: false,
    type: "PythonOperator",
    icon: "functions",
    category: "util",
    description:
      "Ejecuta una función Python con soporte completo de parámetros.",
    parameters: {
      task_id: {
        type: "string",
        required: true,
        default: "python_task",
        description: "ID único de la tarea (task_id)",
      },
      python_callable: {
        type: "function",
        required: true,
        description: "Función Python a ejecutar",
      },
      op_kwargs: {
        type: "object",
        required: false,
        description: "Diccionario de argumentos para pasar a la función",
      },
    },
  },
  {
    id: "shortcircuit_operator",
    label: "Short Circuit",
    favoritos: false,
    type: "ShortCircuitOperator",
    icon: "⏸",
    category: "util",
    description:
      "Evalúa una condición y detiene downstream tasks si la condición es falsa.",
    parameters: {
      task_id: {
        type: "string",
        required: true,
        default: "shortcircuit_task",
        description: "ID único de la tarea (task_id)",
      },
      python_callable: {
        type: "function",
        required: true,
        description:
          "Función que retorna True o False para continuar la ejecución",
      },
    },
  },
];
