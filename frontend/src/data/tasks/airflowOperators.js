/**
 * Airflow Native Operators - Operadores nativos de Airflow 2.4.0
 * Incluye: Bash, Python, Sensors
 */
import { bashOperators } from "./bashOperators";

export const airflowOperators = [
  // Bash Operators
  ...bashOperators,
  
  // Python Operators
  {
    id: "python_operator_full",
    label: "Python Function",
    type: "PythonOperator",
    icon: "functions",
    category: "airflow",
    description: "Ejecuta una función Python con soporte completo de parámetros",
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
    category: "airflow",
    description: "Ejecuta Python en un entorno virtual aislado",
    parameters: {
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
        description: "Lista de paquetes a instalar en el venv (ej: ['pandas==1.3.0', 'numpy'])"
      },
      python_version: {
        type: "string",
        required: false,
        default: "3",
        description: "Versión de Python (3, 3.7, 3.8, etc.)"
      }
    }
  },
  
  // Sensors (más comunes)
  {
    id: "file_sensor",
    label: "File Sensor",
    type: "FileSensor",
    icon: "sensors",
    category: "airflow",
    description: "Espera hasta que un archivo o directorio exista en el sistema de archivos",
    parameters: {
      filepath: {
        type: "string",
        required: true,
        default: "",
        description: "Ruta del archivo o directorio a monitorear"
      },
      fs_conn_id: {
        type: "string",
        required: false,
        default: "fs_default",
        description: "ID de conexión del sistema de archivos"
      },
      poke_interval: {
        type: "integer",
        required: false,
        default: 60,
        description: "Intervalo entre verificaciones (segundos)"
      },
      timeout: {
        type: "integer",
        required: false,
        default: 60 * 60 * 24 * 7,
        description: "Tiempo máximo de espera (segundos)"
      }
    }
  },
  {
    id: "sql_sensor",
    label: "SQL Sensor",
    type: "SqlSensor",
    icon: "data_check",
    category: "airflow",
    description: "Espera hasta que una consulta SQL retorne resultados",
    parameters: {
      sql: {
        type: "string",
        required: true,
        default: "",
        description: "Consulta SQL a ejecutar (debe retornar al menos una fila)"
      },
      conn_id: {
        type: "string",
        required: true,
        default: "postgres_default",
        description: "ID de conexión de base de datos"
      },
      poke_interval: {
        type: "integer",
        required: false,
        default: 60,
        description: "Intervalo entre verificaciones (segundos)"
      },
      timeout: {
        type: "integer",
        required: false,
        default: 60 * 60 * 24 * 7,
        description: "Tiempo máximo de espera (segundos)"
      }
    }
  },
  {
    id: "http_sensor",
    label: "HTTP Sensor",
    type: "HttpSensor",
    icon: "http",
    category: "airflow",
    description: "Espera hasta que un endpoint HTTP esté disponible o retorne el código esperado",
    parameters: {
      http_conn_id: {
        type: "string",
        required: true,
        default: "http_default",
        description: "ID de conexión HTTP"
      },
      endpoint: {
        type: "string",
        required: true,
        default: "",
        description: "Endpoint HTTP a verificar (ej: '/api/health')"
      },
      method: {
        type: "string",
        required: false,
        default: "GET",
        enum: ["GET", "POST", "PUT", "DELETE"],
        description: "Método HTTP"
      },
      expected_response: {
        type: "integer",
        required: false,
        default: 200,
        description: "Código de respuesta esperado"
      },
      poke_interval: {
        type: "integer",
        required: false,
        default: 60,
        description: "Intervalo entre verificaciones (segundos)"
      }
    }
  }
];
