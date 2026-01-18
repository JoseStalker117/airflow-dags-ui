/**
 * Google Cloud Platform Operators - Operadores de GCP para Airflow 2.4.0
 * Categoría: Google Cloud
 */
export const googleCloudOperators = [
  {
    id: "bigquery_operator",
    label: "BigQuery",
    type: "BigQueryOperator",
    icon: "cloud",
    category: "google_cloud",
    description: "Ejecuta consultas SQL en Google BigQuery",
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
        description: "Usar SQL legacy (por defecto usa Standard SQL)"
      },
      destination_dataset_table: {
        type: "string",
        required: false,
        default: "",
        description: "Tabla destino (formato: project.dataset.table)"
      },
      write_disposition: {
        type: "string",
        required: false,
        default: "WRITE_EMPTY",
        enum: ["WRITE_EMPTY", "WRITE_TRUNCATE", "WRITE_APPEND"],
        description: "Acción a tomar si la tabla existe"
      }
    }
  },
  {
    id: "gcs_to_bigquery",
    label: "GCS to BigQuery",
    type: "GCSToBigQueryOperator",
    icon: "cloud_upload",
    category: "google_cloud",
    description: "Carga datos de Google Cloud Storage a BigQuery",
    parameters: {
      bucket: {
        type: "string",
        required: true,
        default: "",
        description: "Nombre del bucket de GCS"
      },
      source_objects: {
        type: "array",
        required: true,
        default: [],
        description: "Lista de objetos en GCS (ej: ['data/file.csv'])"
      },
      destination_project_dataset_table: {
        type: "string",
        required: true,
        default: "",
        description: "Tabla destino en BigQuery (formato: project.dataset.table)"
      },
      source_format: {
        type: "string",
        required: false,
        default: "CSV",
        enum: ["CSV", "JSON", "AVRO", "PARQUET", "ORC"],
        description: "Formato del archivo origen"
      },
      write_disposition: {
        type: "string",
        required: false,
        default: "WRITE_EMPTY",
        enum: ["WRITE_EMPTY", "WRITE_TRUNCATE", "WRITE_APPEND"],
        description: "Acción a tomar si la tabla existe"
      }
    }
  },
  {
    id: "bigquery_to_gcs",
    label: "BigQuery to GCS",
    type: "BigQueryToGCSOperator",
    icon: "cloud_download",
    category: "google_cloud",
    description: "Exporta datos de BigQuery a Google Cloud Storage",
    parameters: {
      source_project_dataset_table: {
        type: "string",
        required: true,
        default: "",
        description: "Tabla origen en BigQuery (formato: project.dataset.table)"
      },
      destination_cloud_storage_uris: {
        type: "array",
        required: true,
        default: [],
        description: "URIs de destino en GCS (ej: ['gs://bucket/file.csv'])"
      },
      export_format: {
        type: "string",
        required: false,
        default: "CSV",
        enum: ["CSV", "JSON", "AVRO", "PARQUET"],
        description: "Formato de exportación"
      },
      gcp_conn_id: {
        type: "string",
        required: true,
        default: "google_cloud_default",
        description: "ID de conexión GCP"
      }
    }
  },
  {
    id: "gcs_copy",
    label: "GCS Copy",
    type: "GCSToGCSOperator",
    icon: "file_copy",
    category: "google_cloud",
    description: "Copia objetos dentro de Google Cloud Storage",
    parameters: {
      source_bucket: {
        type: "string",
        required: true,
        default: "",
        description: "Bucket origen"
      },
      source_object: {
        type: "string",
        required: true,
        default: "",
        description: "Objeto origen (puede contener wildcards *)"
      },
      destination_bucket: {
        type: "string",
        required: true,
        default: "",
        description: "Bucket destino"
      },
      destination_object: {
        type: "string",
        required: false,
        default: "",
        description: "Objeto destino (opcional, por defecto mismo nombre)"
      },
      gcp_conn_id: {
        type: "string",
        required: true,
        default: "google_cloud_default",
        description: "ID de conexión GCP"
      }
    }
  }
];
