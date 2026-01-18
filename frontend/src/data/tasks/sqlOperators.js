/**
 * SQL Operators - Operadores para ejecutar consultas SQL
 */
export const sqlOperators = [
  {
    id: "sql_execute",
    label: "SQL Execute",
    type: "SQLExecuteQueryOperator",
    icon: "database",
    category: "sql",
    description: "Ejecuta una consulta SQL",
    parameters: {
      sql: {
        type: "string",
        required: true,
        default: "SELECT 1",
        description: "Consulta SQL a ejecutar"
      },
      conn_id: {
        type: "string",
        required: true,
        default: "postgres_default",
        description: "ID de la conexión de base de datos"
      },
      parameters: {
        type: "object",
        required: false,
        default: {},
        description: "Parámetros para la consulta SQL"
      },
      autocommit: {
        type: "boolean",
        required: false,
        default: false,
        description: "Ejecutar en modo autocommit"
      }
    }
  },
  {
    id: "postgres_operator",
    label: "PostgreSQL",
    type: "PostgresOperator",
    icon: "storage",
    category: "sql",
    description: "Ejecuta SQL en PostgreSQL",
    parameters: {
      sql: {
        type: "string",
        required: true,
        default: "",
        description: "Consulta SQL"
      },
      postgres_conn_id: {
        type: "string",
        required: true,
        default: "postgres_default",
        description: "ID de conexión PostgreSQL"
      },
      parameters: {
        type: "object",
        required: false,
        default: {},
        description: "Parámetros SQL"
      }
    }
  },
  {
    id: "bigquery_operator",
    label: "BigQuery",
    type: "BigQueryOperator",
    icon: "cloud",
    category: "sql",
    description: "Ejecuta consultas en BigQuery",
    parameters: {
      sql: {
        type: "string",
        required: true,
        default: "",
        description: "Consulta SQL de BigQuery"
      },
      gcp_conn_id: {
        type: "string",
        required: true,
        default: "google_cloud_default",
        description: "ID de conexión GCP"
      },
      use_legacy_sql: {
        type: "boolean",
        required: false,
        default: false,
        description: "Usar SQL legacy"
      },
      destination_dataset_table: {
        type: "string",
        required: false,
        default: "",
        description: "Tabla destino (dataset.tablename)"
      }
    }
  }
];
