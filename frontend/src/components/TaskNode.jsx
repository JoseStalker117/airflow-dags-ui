import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function TaskNode({ node, index, onUpdate, onDelete }) {
  const [showParams, setShowParams] = useState(false);
  const [taskName, setTaskName] = useState(node.task_id || `task_${index + 1}`);

  // Obtener icono y color según el tipo de operador
  const getOperatorInfo = (type) => {
    const operatorStyles = {
      BashOperator: { icon: "terminal", color: "emerald" },
      PythonOperator: { icon: "code", color: "blue" },
      PythonVirtualenvOperator: { icon: "workspace", color: "indigo" },
      PostgresOperator: { icon: "storage", color: "cyan" },
      BigQueryOperator: { icon: "cloud", color: "purple" },
      SQLExecuteQueryOperator: { icon: "database", color: "teal" },
      LocalFilesystemToS3Operator: { icon: "upload_file", color: "orange" },
      S3ToS3Operator: { icon: "file_copy", color: "amber" },
      SFTPOperator: { icon: "cloud_sync", color: "sky" },
      GCSToBigQueryOperator: { icon: "cloud_upload", color: "violet" },
      FileSensor: { icon: "sensors", color: "pink" },
      S3KeySensor: { icon: "cloud_done", color: "rose" },
      SqlSensor: { icon: "data_check", color: "green" },
      HttpSensor: { icon: "http", color: "red" },
      DummyOperator: { icon: "radio_button_unchecked", color: "gray" },
      BranchPythonOperator: { icon: "call_split", color: "yellow" },
      ShortCircuitOperator: { icon: "electric_bolt", color: "amber" }
    };

    return operatorStyles[type] || { icon: "widgets", color: "slate" };
  };

  const operatorInfo = getOperatorInfo(node.type);
  const colorClasses = {
    emerald: "bg-emerald-500",
    blue: "bg-blue-500",
    indigo: "bg-indigo-500",
    cyan: "bg-cyan-500",
    purple: "bg-purple-500",
    teal: "bg-teal-500",
    orange: "bg-orange-500",
    amber: "bg-amber-500",
    sky: "bg-sky-500",
    violet: "bg-violet-500",
    pink: "bg-pink-500",
    rose: "bg-rose-500",
    green: "bg-green-500",
    red: "bg-red-500",
    gray: "bg-gray-500",
    yellow: "bg-yellow-500",
    slate: "bg-slate-500"
  };

  const borderColorClasses = {
    emerald: "border-emerald-300",
    blue: "border-blue-300",
    indigo: "border-indigo-300",
    cyan: "border-cyan-300",
    purple: "border-purple-300",
    teal: "border-teal-300",
    orange: "border-orange-300",
    amber: "border-amber-300",
    sky: "border-sky-300",
    violet: "border-violet-300",
    pink: "border-pink-300",
    rose: "border-rose-300",
    green: "border-green-300",
    red: "border-red-300",
    gray: "border-gray-300",
    yellow: "border-yellow-300",
    slate: "border-slate-300"
  };

  // Contar parámetros configurados
  const paramCount = node.parameters ? Object.keys(node.parameters).filter(
    key => node.parameters[key] !== undefined && node.parameters[key] !== ""
  ).length : 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={`bg-white rounded-lg shadow-md border-2 ${borderColorClasses[operatorInfo.color]} 
                  hover:shadow-lg transition-all relative`}
    >
      {/* Header principal */}
      <div className="p-4 flex items-start gap-3">
        {/* Icono del operador */}
        <div className={`${colorClasses[operatorInfo.color]} rounded-lg p-2 flex-shrink-0`}>
          <span className="material-symbols-outlined text-white text-lg">
            {operatorInfo.icon}
          </span>
        </div>

        {/* Información principal */}
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={taskName}
            onChange={(e) => {
              setTaskName(e.target.value);
              if (onUpdate) {
                onUpdate({ ...node, task_id: e.target.value });
              }
            }}
            className="font-semibold text-base text-slate-800 bg-transparent border-none 
                     focus:outline-none focus:ring-2 focus:ring-blue-400 rounded px-1 w-full"
            placeholder={`task_${index + 1}`}
          />
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-slate-500 font-mono">{node.type}</span>
            {paramCount > 0 && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                {paramCount} {paramCount === 1 ? "parámetro" : "parámetros"}
              </span>
            )}
          </div>
        </div>

        {/* Botones de acción */}
        <div className="flex gap-1 flex-shrink-0">
          <button
            onClick={() => setShowParams(!showParams)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              showParams
                ? "bg-blue-100 text-blue-700"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
            title="Ver/Editar parámetros"
          >
            <span className="material-symbols-outlined text-sm align-middle">
              {showParams ? "expand_less" : "expand_more"}
            </span>
            Parámetros
          </button>
          {onDelete && (
            <button
              onClick={() => onDelete(node.id)}
              className="px-2 py-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"
              title="Eliminar tarea"
            >
              <span className="material-symbols-outlined text-sm">delete</span>
            </button>
          )}
        </div>
      </div>

      {/* Panel de parámetros expandible */}
      <AnimatePresence>
        {showParams && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-gray-200 bg-slate-50"
          >
            <div className="p-4 space-y-3">
              {node.description && (
                <div className="text-xs text-slate-600 italic mb-2">
                  {node.description}
                </div>
              )}
              
              {node.parameters && Object.keys(node.parameters).length > 0 ? (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-700 mb-2">
                    Parámetros configurados:
                  </div>
                  {Object.entries(node.parameters).map(([key, value]) => {
                    if (value === undefined || value === "") return null;
                    
                    return (
                      <div key={key} className="bg-white rounded p-2 border border-gray-200 p-2">
                        <div className="text-xs font-mono text-slate-500">{key}:</div>
                        <div className="text-sm text-slate-700 mt-1">
                          {typeof value === "object" 
                            ? JSON.stringify(value, null, 2)
                            : String(value)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-sm text-slate-500 italic">
                  No hay parámetros configurados. Usa valores por defecto.
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
