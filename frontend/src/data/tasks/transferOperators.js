/**
 * Transfer Operators - Operadores para transferencias FTP y SFTP
 * Airflow 2.4.0
 * Categoría: Transferencia
 */
export const transferOperators = [
  {
    id: "sftp_transfer",
    label: "SFTP Transfer",
    favoritos: false,
    type: "SFTPOperator",
    icon: "📁",
    category: "sftp",
    description:
      "Transfiere archivos hacia/desde el servidor SFTP (PUT, GET o DELETE).",
    parameters: {
      task_id: {
        type: "string",
        required: true,
        default: "sftp_transfer",
        description: "ID único de la tarea",
      },
      ssh_conn_id: {
        type: "string",
        required: false,
        description: "ID de conexión SSH/SFTP",
      },
      remote_host: {
        type: "string",
        required: false,
        description: "Host remoto (si no se define en la conexión)",
      },
      local_filepath: {
        type: "string",
        required: false,
        description: "Ruta local de archivo(s) a transferir",
      },
      remote_filepath: {
        type: "string",
        required: true,
        description: "Ruta remota de archivo(s) a transferir",
      },
      operation: {
        type: "string",
        required: false,
        default: "put",
        description: "Tipo de operación: 'put', 'get' o 'delete'",
      },
      create_intermediate_dirs: {
        type: "boolean",
        required: false,
        description: "Crear carpetas remotas si no existen",
      },
      confirm: {
        type: "boolean",
        required: false,
        description: "Confirmar cada archivo transferido",
      },
    },
  },
  {
    id: "sftp_sensor",
    label: "SFTP Sensor",
    favoritos: false,
    type: "SFTPSensor",
    icon: "⏱",
    category: "sftp",
    description:
      "Espera a que aparezca un archivo o directorio en el servidor SFTP.",
    parameters: {
      task_id: {
        type: "string",
        required: true,
        default: "sftp_sensor",
        description: "ID único de la tarea",
      },
      path: {
        type: "string",
        required: true,
        description: "Ruta remota a monitorear",
      },
      file_pattern: {
        type: "string",
        required: false,
        description: "Patrón de archivo a buscar (fnmatch)",
      },
      sftp_conn_id: {
        type: "string",
        required: false,
        description: "ID de conexión Airflow para SFTP",
      },
      newer_than: {
        type: "string",
        required: false,
        description: "Fecha mínima para considerar archivo nuevo",
      },
    },
  },
];
