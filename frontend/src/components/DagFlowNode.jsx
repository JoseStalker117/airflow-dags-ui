import { Handle, Position } from "reactflow";
import { useState } from "react";

/**
 * Nodo personalizado para el canvas de React Flow
 * Mantiene los colores de borde y estilo del TaskNode original
 */
export default function DagFlowNode({ data }) {
  const [taskName, setTaskName] = useState(data.task_id || data.label);

  // Obtener icono y color según el tipo de operador (igual que TaskNode)
  const getOperatorInfo = (type) => {
    const operatorStyles = {
      DAG: { icon: "account_tree", color: "indigo" },
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

  const operatorInfo = getOperatorInfo(data.type);

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

  const paramCount = data.parameters ? Object.keys(data.parameters).filter(
    key => data.parameters[key] !== undefined && data.parameters[key] !== ""
  ).length : 0;

  // Determinar si es un operador de branch
  const isBranch = data.type === "BranchPythonOperator";
  // Determinar si es un nodo DAG (contenedor)
  const isDAG = data.type === "DAG";

  return (
    <div className={`bg-white rounded-lg shadow-lg border-2 ${borderColorClasses[operatorInfo.color]} 
                    hover:shadow-xl transition-all ${isDAG ? 'min-w-[400px] min-h-[300px]' : 'min-w-[220px]'}
                    ${isDAG ? 'bg-gradient-to-br from-indigo-50 to-purple-50' : ''}`}>
      {/* Handle superior (entrada) - NO se muestra para nodos DAG */}
      {!isDAG && (
        <Handle 
          type="target" 
          position={Position.Top} 
          className="w-4 h-4 !bg-slate-500 hover:!bg-blue-500 !border-2 !border-white transition-colors"
          style={{ width: '16px', height: '16px', borderRadius: '50%' }}
        />
      )}

      {/* Contenido del nodo */}
      <div className={`p-3 ${isDAG ? 'pb-6' : ''}`}>
        {isDAG ? (
          /* Header especial para DAG */
          <div className="border-b-2 border-indigo-200 pb-3 mb-3">
            <div className="flex items-start gap-2">
              <div className={`${colorClasses[operatorInfo.color]} rounded-lg p-2 flex-shrink-0`}>
                <span className="material-symbols-outlined text-white text-lg">
                  {operatorInfo.icon}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  value={taskName}
                  onChange={(e) => {
                    setTaskName(e.target.value);
                    if (data.onUpdate) {
                      data.onUpdate({ ...data, task_id: e.target.value });
                    }
                  }}
                  className="font-bold text-lg text-indigo-900 bg-transparent border-none 
                           focus:outline-none focus:ring-1 focus:ring-indigo-400 rounded px-1 w-full"
                  placeholder={data.label}
                />
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-indigo-600 font-mono truncate">{data.type}</span>
                </div>
              </div>
              {data.onDelete && (
                <button
                  onClick={() => data.onDelete(data.id)}
                  className="text-red-500 hover:bg-red-50 rounded p-1 transition-colors flex-shrink-0"
                  title="Eliminar DAG"
                >
                  <span className="material-symbols-outlined text-xs">close</span>
                </button>
              )}
            </div>
            {paramCount > 0 && (
              <div className="mt-2 text-xs text-indigo-600">
                <span className="font-medium">{paramCount}</span> {paramCount === 1 ? "parámetro configurado" : "parámetros configurados"}
              </div>
            )}
          </div>
        ) : (
          /* Contenido normal para otros nodos */
          <div className="flex items-start gap-2">
            {/* Icono del operador */}
            <div className={`${colorClasses[operatorInfo.color]} rounded-lg p-1.5 flex-shrink-0`}>
              <span className="material-symbols-outlined text-white text-sm">
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
                  if (data.onUpdate) {
                    data.onUpdate({ ...data, task_id: e.target.value });
                  }
                }}
                className="font-semibold text-sm text-slate-800 bg-transparent border-none 
                         focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 w-full"
                placeholder={data.label}
              />
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-slate-500 font-mono truncate">{data.type}</span>
              </div>
              {paramCount > 0 && (
                <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full mt-1 inline-block">
                  {paramCount} {paramCount === 1 ? "param" : "params"}
                </span>
              )}
            </div>

            {/* Botón eliminar */}
            {data.onDelete && (
              <button
                onClick={() => data.onDelete(data.id)}
                className="text-red-500 hover:bg-red-50 rounded p-1 transition-colors flex-shrink-0"
                title="Eliminar tarea"
              >
                <span className="material-symbols-outlined text-xs">close</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Handle inferior (salida) - NO se muestra para nodos DAG */}
      {!isDAG && (
        isBranch ? (
          <div className="flex justify-center gap-2 pb-2 px-2">
            <Handle 
              type="source" 
              position={Position.Bottom} 
              id="true"
              className="!bg-green-500 hover:!bg-green-600 !border-2 !border-white transition-colors"
              style={{ width: '16px', height: '16px', borderRadius: '50%', left: '40%' }}
            />
            <Handle 
              type="source" 
              position={Position.Bottom} 
              id="false"
              className="!bg-red-500 hover:!bg-red-600 !border-2 !border-white transition-colors"
              style={{ width: '16px', height: '16px', borderRadius: '50%', left: '60%' }}
            />
          </div>
        ) : (
          <Handle 
            type="source" 
            position={Position.Bottom} 
            className="!bg-slate-500 hover:!bg-blue-500 !border-2 !border-white transition-colors"
            style={{ width: '16px', height: '16px', borderRadius: '50%' }}
          />
        )
      )}
    </div>
  );
}
