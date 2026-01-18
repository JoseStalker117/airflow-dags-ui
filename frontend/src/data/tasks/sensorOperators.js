/**
 * Sensor Operators - Operadores sensores para esperar condiciones
 */
export const sensorOperators = [
  {
    id: "file_sensor",
    label: "File Sensor",
    type: "FileSensor",
    icon: "sensors",
    category: "sensor",
    description: "Espera hasta que un archivo exista",
    parameters: {
      task_id: {
        type: "string",
        required: true,
        default: "File Sensor",
        description: "ID único de la tarea (task_id)"
      },
      filepath: {
        type: "string",
        required: true,
        default: "",
        description: "Ruta del archivo a monitorear"
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
    id: "s3_key_sensor",
    label: "S3 Key Sensor",
    type: "S3KeySensor",
    icon: "cloud_done",
    category: "sensor",
    description: "Espera hasta que una clave S3 exista",
    parameters: {
      task_id: {
        type: "string",
        required: true,
        default: "S3 Key Sensor",
        description: "ID único de la tarea (task_id)"
      },
      bucket_key: {
        type: "string",
        required: true,
        default: "",
        description: "Clave S3 a monitorear"
      },
      bucket_name: {
        type: "string",
        required: true,
        default: "",
        description: "Nombre del bucket S3"
      },
      aws_conn_id: {
        type: "string",
        required: false,
        default: "aws_default",
        description: "ID de conexión AWS"
      },
      poke_interval: {
        type: "integer",
        required: false,
        default: 60,
        description: "Intervalo entre verificaciones"
      }
    }
  },
  {
    id: "sql_sensor",
    label: "SQL Sensor",
    type: "SqlSensor",
    icon: "data_check",
    category: "sensor",
    description: "Espera hasta que una consulta SQL retorne resultados",
    parameters: {
      task_id: {
        type: "string",
        required: true,
        default: "SQL Sensor",
        description: "ID único de la tarea (task_id)"
      },
      sql: {
        type: "string",
        required: true,
        default: "",
        description: "Consulta SQL a ejecutar"
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
        description: "Intervalo entre verificaciones"
      }
    }
  },
  {
    id: "http_sensor",
    label: "HTTP Sensor",
    type: "HttpSensor",
    icon: "http",
    category: "sensor",
    description: "Espera hasta que un endpoint HTTP esté disponible",
    parameters: {
      task_id: {
        type: "string",
        required: true,
        default: "HTTP Sensor",
        description: "ID único de la tarea (task_id)"
      },
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
        description: "Endpoint HTTP a verificar"
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
      }
    }
  }
];
