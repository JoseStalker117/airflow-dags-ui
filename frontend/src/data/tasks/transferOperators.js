/**
 * Transfer Operators - Operadores para transferencias FTP y SFTP
 * Airflow 2.4.0
 * Categoría: Transferencia
 */
export const transferOperators = [
  {
    id: "sftp_transfer",
    label: "SFTP Transfer",
    type: "SFTPOperator",
    icon: "cloud_sync",
    category: "transfer",
    description: "Transfiere archivos vía SFTP (Secure File Transfer Protocol)",
    parameters: {
      local_filepath: {
        type: "string",
        required: false,
        default: "",
        description: "Ruta del archivo local (para operación 'get')"
      },
      remote_filepath: {
        type: "string",
        required: false,
        default: "",
        description: "Ruta del archivo remoto"
      },
      operation: {
        type: "string",
        required: true,
        default: "put",
        enum: ["put", "get"],
        description: "Operación: 'put' (subir local->remoto) o 'get' (bajar remoto->local)"
      },
      sftp_conn_id: {
        type: "string",
        required: true,
        default: "sftp_default",
        description: "ID de conexión SFTP"
      },
      confirm: {
        type: "boolean",
        required: false,
        default: true,
        description: "Confirmar antes de sobrescribir archivos existentes"
      }
    }
  },
  {
    id: "ftp_transfer",
    label: "FTP Transfer",
    type: "FTPOperation",
    icon: "swap_horiz",
    category: "transfer",
    description: "Transfiere archivos vía FTP (File Transfer Protocol)",
    parameters: {
      ftp_conn_id: {
        type: "string",
        required: true,
        default: "ftp_default",
        description: "ID de conexión FTP"
      },
      local_filepath: {
        type: "string",
        required: false,
        default: "",
        description: "Ruta del archivo local"
      },
      remote_filepath: {
        type: "string",
        required: false,
        default: "",
        description: "Ruta del archivo remoto"
      },
      operation: {
        type: "string",
        required: true,
        default: "put",
        enum: ["put", "get", "delete", "list", "mkdir", "rmdir"],
        description: "Operación FTP a realizar"
      }
    }
  }
];
