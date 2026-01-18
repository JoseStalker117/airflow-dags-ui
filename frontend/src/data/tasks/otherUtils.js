/**
 * OtherUtils - Otras funciones de utilidad
 */

export const otherUtils = [
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
        description: "ID único de la tarea (task_id)",
      },
      filepath: {
        type: "string",
        required: true,
        default: "",
        description: "Ruta del archivo a monitorear",
      },
      fs_conn_id: {
        type: "string",
        required: false,
        default: "fs_default",
        description: "ID de conexión del sistema de archivos",
      },
      poke_interval: {
        type: "integer",
        required: false,
        default: 60,
        description: "Intervalo entre verificaciones (segundos)",
      },
      timeout: {
        type: "integer",
        required: false,
        default: 60 * 60 * 24 * 7,
        description: "Tiempo máximo de espera (segundos)",
      },
    },
  },
];
