/**
 * SQL Operators - Operadores para ejecutar consultas SQL
 */
export const sqlOperators = [
  { // Descarga AWS
    id: "S3DownloadOperator",
    favoritos: false,
    label: "Descarga AWS",
    type: "AWS",
    icon: "storage",
    category: "sql",
    description: "Descargar archivo de Amazon Services",
    parameters: {
      task_id: {
        type: "string",
        required: true,
        default: "descarga-aws",
        description: "ID único de la tarea (task_id)",
      },
      aws_conn_id: {
        type: "string",
        required: true,
        default: "default",
        description: "Variable de conexión AWS",
      },
      bucket_name: {
        type: "string",
        required: true,
        default: "bucket_name",
        description: "Bucket o directorio de descarga",
      },
      s3_key: {
        type: "string",
        required: true,
        default: "cortes/febrero/dir_batch.txt",
        description: "Direccion de archivo a descargar",
      },
      local_filepath: {
        type: "string",
        required: true,
        default: "/home/airflow/out/respuestas/local_batch.txt",
        description: "Ruta local de descarga",
      },
    },
  },
  { // Descarga Blop
    id: "AzureBlobDownloadOperator",
    favoritos: false,
    label: "AzureBlobDownloadOperator",
    type: "Azure",
    icon: "storage",
    category: "sql",
    description: "Ejecuta SQL en PostgreSQL",
    parameters: {
      task_id: {
        type: "string",
        required: true,
        default: "descarga-azure",
        description: "ID único de la tarea (task_id)",
      },
      sas_url: {
        type: "string",
        required: true,
        default: "blob_azure",
        description: "URL de Azure.",
      },
      container_name: {
        type: "string",
        required: true,
        default: "lake",
        description: "Nombre del contenedor.",
      },
      blob_names: {
        type: "string",
        required: true,
        default: "sd_archivos_azure",
        description: "Directorio/archivo a descargar",
      },
      download_path: {
        type: "string",
        required: true,
        default: "/opt/airflow/out/azure/",
        description: "Directorio local de descarga",
      },
    },
  },
];
