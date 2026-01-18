/**
 * BashOperator - Ejecuta comandos bash
 */
export const bashOperators = [
  {
    id: "bash_basic",
    label: "Bash Command",
    type: "BashOperator",
    icon: "terminal",
    category: "bash",
    description: "Ejecuta un comando bash simple",
    parameters: {
      task_id: {
        type: "string",
        required: true,
        default: "Bash Command",
        description: "ID único de la tarea (task_id)"
      },
      bash_command: {
        type: "string",
        required: true,
        default: "echo 'Hello from Airflow'",
        description: "Comando bash a ejecutar"
      },
      env: {
        type: "object",
        required: false,
        default: {},
        description: "Variables de entorno adicionales"
      },
      cwd: {
        type: "string",
        required: false,
        default: "",
        description: "Directorio de trabajo"
      }
    }
  },
  {
    id: "bash_script",
    label: "Bash Script",
    type: "BashOperator",
    icon: "code",
    category: "bash",
    description: "Ejecuta un script bash",
    parameters: {
      task_id: {
        type: "string",
        required: true,
        default: "Bash Script",
        description: "ID único de la tarea (task_id)"
      },
      bash_command: {
        type: "string",
        required: true,
        default: "",
        description: "Contenido del script bash o ruta al script"
      },
      env: {
        type: "object",
        required: false,
        default: {},
        description: "Variables de entorno"
      }
    }
  }
];
