import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  getOperatorNodeStyle,
  NODE_COLOR_CLASSES,
  NODE_BORDER_COLOR_CLASSES,
} from "../config/taskUiConfig";

export default function TaskNode({ node, index, onUpdate, onDelete }) {
  const [showParams, setShowParams] = useState(false);
  const [taskName, setTaskName] = useState(node.task_id || `task_${index + 1}`);

  const operatorInfo = getOperatorNodeStyle(node.type);

  // Contar parámetros configurados
  const paramCount = node.parameters ? Object.keys(node.parameters).filter(
    key => node.parameters[key] !== undefined && node.parameters[key] !== ""
  ).length : 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={`bg-white rounded-lg shadow-md border-2 ${NODE_BORDER_COLOR_CLASSES[operatorInfo.color]} 
                  hover:shadow-lg transition-all relative`}
    >
      {/* Header principal */}
      <div className="p-4 flex items-start gap-3">
        {/* Icono del operador */}
        <div className={`${NODE_COLOR_CLASSES[operatorInfo.color]} rounded-lg p-2 flex-shrink-0`}>
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
