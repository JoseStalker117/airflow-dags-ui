/**
 * PythonOperator - Ejecuta funciones Python
 */
export const pythonOperators = [
  {
    id: "python_callable",
    label: "Python Function",
    type: "PythonOperator",
    icon: "functions",
    category: "python",
    description: "Ejecuta una función Python",
    parameters: {
      task_id: {
        type: "string",
        required: true,
        default: "Python Function",
        description: "ID único de la tarea (task_id)"
      },
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
      templates_dict: {
        type: "object",
        required: false,
        default: {},
        description: "Diccionario de templates"
      }
    }
  },
  {
    id: "python_virtualenv",
    label: "Python VirtualEnv",
    type: "PythonVirtualenvOperator",
    icon: "workspace",
    category: "python",
    description: "Ejecuta Python en un entorno virtual",
    parameters: {
      task_id: {
        type: "string",
        required: true,
        default: "Python VirtualEnv",
        description: "ID único de la tarea (task_id)"
      },
      python_callable: {
        type: "string",
        required: true,
        default: "",
        description: "Función Python a ejecutar"
      },
      requirements: {
        type: "array",
        required: false,
        default: [],
        description: "Lista de paquetes a instalar en el venv"
      },
      python_version: {
        type: "string",
        required: false,
        default: "3",
        description: "Versión de Python (3, 3.7, 3.8, etc.)"
      }
    }
  }
];
