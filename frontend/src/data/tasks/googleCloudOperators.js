/**
 * Google Cloud Platform Operators - Operadores de GCP para Airflow 2.4.0
 * Categoría: Google Cloud
 */
export const googleCloudOperators = [
  {
    id: "bq_check",
    label: "Check Query",
    favoritos: false,
    type: "BigQueryCheckOperator",
    icon: "✔️",
    category: "bigquery",
    description:
      "Verifica que el resultado de una consulta cumpla una condición.",
    parameters: {
      task_id: {
        type: "string",
        required: true,
        default: "check_query",
        description: "ID único de la tarea",
      },
      sql: {
        type: "string",
        required: true,
        description: "Consulta SQL para evaluar",
      },
    },
  },
  {
    id: "bq_insert_job",
    label: "Insert Job",
    favoritos: false,
    type: "BigQueryInsertJobOperator",
    icon: "🧠",
    category: "bigquery",
    description: "Ejecuta un job en BigQuery, típicamente consultas SQL.",
    parameters: {
      task_id: {
        type: "string",
        required: true,
        default: "insert_job",
        description: "ID único de la tarea",
      },
      configuration: {
        type: "object",
        required: true,
        description: "Configuración del job (p. ej. query SQL)",
      },
    },
  },
];
