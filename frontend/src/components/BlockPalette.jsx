import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { taskBlocksByCategory } from "../data/tasks";
import { saveUserPreferences, loadUserPreferences } from "../utils/storage";

const categoryLabels = {
  common: "Favoritos",
  airflow: "Airflow",
  google_cloud: "Google Cloud",
  database: "Databases",
  transfer: "Operadores SFTP",
  python: "Operador Python",
  sql: "Otros SQL",
  others: "Utilidades"
};

const categoryIcons = {
  common: "widgets",
  airflow: "account_tree",
  google_cloud: "cloud",
  database: "storage",
  transfer: "swap_horiz",
  python: "code",
  sql: "table_rows",
  others: "extension",
};

// Orden de categorías según la jerarquía definida
const categoryOrder = Object.keys(categoryLabels);

// Colores de borde izquierdo según el tipo de operador (mismo esquema que DagFlowNode)
const operatorBorderColors = {
  DAG: "border-l-indigo-500",
  BashOperator: "border-l-emerald-500",
  PythonOperator: "border-l-blue-500",
  PythonVirtualenvOperator: "border-l-indigo-500",
  PostgresOperator: "border-l-cyan-500",
  BigQueryOperator: "border-l-purple-500",
  SQLExecuteQueryOperator: "border-l-teal-500",
  LocalFilesystemToS3Operator: "border-l-orange-500",
  S3ToS3Operator: "border-l-amber-500",
  SFTPOperator: "border-l-sky-500",
  GCSToBigQueryOperator: "border-l-violet-500",
  FileSensor: "border-l-pink-500",
  S3KeySensor: "border-l-rose-500",
  SqlSensor: "border-l-green-500",
  HttpSensor: "border-l-red-500",
  DummyOperator: "border-l-gray-500",
  BranchPythonOperator: "border-l-yellow-500",
  ShortCircuitOperator: "border-l-amber-500"
};

// Colores de fondo hover según el tipo de operador
const operatorHoverBgColors = {
  DAG: "hover:bg-indigo-50",
  BashOperator: "hover:bg-emerald-50",
  PythonOperator: "hover:bg-blue-50",
  PythonVirtualenvOperator: "hover:bg-indigo-50",
  PostgresOperator: "hover:bg-cyan-50",
  BigQueryOperator: "hover:bg-purple-50",
  SQLExecuteQueryOperator: "hover:bg-teal-50",
  LocalFilesystemToS3Operator: "hover:bg-orange-50",
  S3ToS3Operator: "hover:bg-amber-50",
  SFTPOperator: "hover:bg-sky-50",
  GCSToBigQueryOperator: "hover:bg-violet-50",
  FileSensor: "hover:bg-pink-50",
  S3KeySensor: "hover:bg-rose-50",
  SqlSensor: "hover:bg-green-50",
  HttpSensor: "hover:bg-red-50",
  DummyOperator: "hover:bg-gray-50",
  BranchPythonOperator: "hover:bg-yellow-50",
  ShortCircuitOperator: "hover:bg-amber-50"
};

// Colores del icono según el tipo de operador
const operatorIconColors = {
  DAG: "text-indigo-500 group-hover:text-indigo-600",
  BashOperator: "text-emerald-500 group-hover:text-emerald-600",
  PythonOperator: "text-blue-500 group-hover:text-blue-600",
  PythonVirtualenvOperator: "text-indigo-500 group-hover:text-indigo-600",
  PostgresOperator: "text-cyan-500 group-hover:text-cyan-600",
  BigQueryOperator: "text-purple-500 group-hover:text-purple-600",
  SQLExecuteQueryOperator: "text-teal-500 group-hover:text-teal-600",
  LocalFilesystemToS3Operator: "text-orange-500 group-hover:text-orange-600",
  S3ToS3Operator: "text-amber-500 group-hover:text-amber-600",
  SFTPOperator: "text-sky-500 group-hover:text-sky-600",
  GCSToBigQueryOperator: "text-violet-500 group-hover:text-violet-600",
  FileSensor: "text-pink-500 group-hover:text-pink-600",
  S3KeySensor: "text-rose-500 group-hover:text-rose-600",
  SqlSensor: "text-green-500 group-hover:text-green-600",
  HttpSensor: "text-red-500 group-hover:text-red-600",
  DummyOperator: "text-gray-500 group-hover:text-gray-600",
  BranchPythonOperator: "text-yellow-500 group-hover:text-yellow-600",
  ShortCircuitOperator: "text-amber-500 group-hover:text-amber-600"
};

// Estado por defecto de categorías expandidas
const defaultExpandedCategories = {
  common: true,
  airflow: false,
  google_cloud: false,
  database: false,
  transfer: false,
  python: false,
  sql: false,
};

export default function BlockPalette() {
  // Cargar preferencias guardadas al iniciar
  const [expandedCategories, setExpandedCategories] = useState(() => {
    const savedPreferences = loadUserPreferences();
    return savedPreferences?.expandedCategories || defaultExpandedCategories;
  });

  // Guardar preferencias cuando cambien
  useEffect(() => {
    saveUserPreferences({ expandedCategories });
  }, [expandedCategories]);

  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const handleDragStart = (e, block) => {
    e.dataTransfer.setData("block", JSON.stringify(block));
  };

  return (
    <div className="w-full bg-slate-50 h-full flex flex-col border-r border-gray-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <h3 className="font-semibold text-sm text-slate-700">Bloques de Tareas</h3>
        <p className="text-xs text-slate-500 mt-1">Arrastra para agregar al DAG</p>
      </div>

      {/* Lista de categorías */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {categoryOrder.map((category) => {
          const blocks = taskBlocksByCategory[category];
          const isExpanded = expandedCategories[category];

          if (!blocks || blocks.length === 0) return null;

          return (
            <div key={category} className="mb-2">
              {/* Botón de categoría */}
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">
                    {categoryIcons[category]}
                  </span>
                  <span>{categoryLabels[category]}</span>
                  <span className="text-xs text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded">
                    {blocks.length}
                  </span>
                </div>
                <span className={`material-symbols-outlined text-xs transition-transform duration-200 ${
                  isExpanded ? "rotate-180" : ""
                }`}>
                  expand_more
                </span>
              </button>

              {/* Bloques de la categoría */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="ml-4 mt-1 space-y-1 pb-2">
                      {blocks.map((block) => {
                        const borderColor = operatorBorderColors[block.type] || "border-l-slate-500";
                        const hoverBg = operatorHoverBgColors[block.type] || "hover:bg-slate-50";
                        const iconColor = operatorIconColors[block.type] || "text-slate-500 group-hover:text-slate-600";
                        
                        return (
                          <div
                            key={block.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, block)}
                            className={`bg-white p-3 rounded-md shadow-sm cursor-grab active:cursor-grabbing 
                                       hover:shadow-md border-l-4 ${borderColor} ${hoverBg}
                                       border border-gray-100 hover:border-gray-200
                                       transition-all group`}
                            title={block.description}
                          >
                            <div className="flex items-start gap-2">
                              <span className={`material-symbols-outlined text-base ${iconColor}`}>
                                {block.icon}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm text-slate-700 group-hover:text-slate-800">
                                  {block.label}
                                </div>
                                <div className="text-xs text-slate-500 mt-0.5 font-mono">
                                  {block.type}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
