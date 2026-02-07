import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { saveUserPreferences, loadUserPreferences } from "../utils/storage";
import {
  fetchTaskBlocks,
  getBlocksForPalette,
  FRAMEWORKS,
} from "../services/tasksFromFirestore";

const frameworkLabels = {
  airflow: "Airflow",
  argo: "Argo",
};

const frameworkIcons = {
  airflow: "account_tree",
  argo: "hub",
};

// Orden de categorías: Favoritos primero, luego el resto (orden estable)
const categoryOrderByFramework = {
  airflow: ["common", "airflow", "util", "google_cloud", "database", "transfer", "python", "sql", "sensors", "others"],
  argo: ["common", "argo", "steps", "workflow", "others"],
};

const categoryLabels = {
  common: "Favoritos",
  airflow: "Airflow",
  argo: "Argo",
  util: "Utilidades",
  google_cloud: "Google Cloud",
  database: "Databases",
  transfer: "SFTP / Transfer",
  python: "Python",
  sql: "SQL",
  sensors: "Sensors",
  others: "Otros",
  steps: "Steps",
  workflow: "Workflow",
};

const categoryIcons = {
  common: "star",
  airflow: "account_tree",
  argo: "hub",
  util: "extension",
  google_cloud: "cloud",
  database: "storage",
  transfer: "swap_horiz",
  python: "code",
  sql: "table_rows",
  sensors: "sensors",
  others: "more_horiz",
  steps: "play_arrow",
  workflow: "account_tree",
};

// Colores por tipo de operador (compatibles con DagFlowNode)
const operatorBorderColors = {
  DAG: "border-l-indigo-500",
  ArgoWorkflow: "border-l-violet-500",
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
  ShortCircuitOperator: "border-l-amber-500",
};

const operatorHoverBgColors = {
  DAG: "hover:bg-indigo-50",
  ArgoWorkflow: "hover:bg-violet-50",
  BashOperator: "hover:bg-emerald-50",
  PythonOperator: "hover:bg-blue-50",
  PostgresOperator: "hover:bg-cyan-50",
  BigQueryOperator: "hover:bg-purple-50",
  DummyOperator: "hover:bg-gray-50",
  BranchPythonOperator: "hover:bg-yellow-50",
};

const operatorIconColors = {
  DAG: "text-indigo-500 group-hover:text-indigo-600",
  ArgoWorkflow: "text-violet-500 group-hover:text-violet-600",
  BashOperator: "text-emerald-500 group-hover:text-emerald-600",
  PythonOperator: "text-blue-500 group-hover:text-blue-600",
  DummyOperator: "text-gray-500 group-hover:text-gray-600",
  BranchPythonOperator: "text-yellow-500 group-hover:text-yellow-600",
};

const defaultExpandedCategories = { common: true };

export default function BlockPalette() {
  const [selectedFramework, setSelectedFramework] = useState(() => {
    const prefs = loadUserPreferences();
    return prefs?.selectedFramework ?? "airflow";
  });
  const [allBlocks, setAllBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState(() => {
    const prefs = loadUserPreferences();
    return prefs?.expandedCategories ?? defaultExpandedCategories;
  });

  // Cargar bloques desde Firestore (API)
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchTaskBlocks()
      .then((blocks) => {
        if (!cancelled) setAllBlocks(blocks);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Error al cargar bloques");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    saveUserPreferences({ selectedFramework, expandedCategories });
  }, [selectedFramework, expandedCategories]);

  const paletteData = getBlocksForPalette(allBlocks, selectedFramework);
  const categoryOrder = categoryOrderByFramework[selectedFramework] ?? Object.keys(categoryLabels);
  const orderedCategories = [
    ...categoryOrder.filter((c) => paletteData[c]?.length),
    ...Object.keys(paletteData).filter((c) => !categoryOrder.includes(c)),
  ];

  const toggleCategory = (category) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const handleDragStart = (e, block) => {
    e.dataTransfer.setData("block", JSON.stringify(block));
  };

  return (
    <div className="w-full bg-slate-50 h-full flex flex-col border-r border-gray-200">
      {/* Header con selector de framework (solo uno a la vez) */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <h3 className="font-semibold text-sm text-slate-700 mb-3">Bloques de Tareas</h3>
        <div className="flex rounded-lg bg-slate-100 p-1 gap-0">
          {FRAMEWORKS.map((fw) => (
            <button
              key={fw}
              type="button"
              onClick={() => setSelectedFramework(fw)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-medium transition-all ${
                selectedFramework === fw
                  ? "bg-white text-slate-800 shadow shadow-slate-200"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <span className="material-symbols-outlined text-base">
                {frameworkIcons[fw]}
              </span>
              {frameworkLabels[fw]}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-2">Arrastra para agregar al flujo</p>
      </div>

      {/* Contenido: una sección (framework) a la vez */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {loading && (
          <div className="flex items-center justify-center py-8 text-slate-500 text-sm">
            Cargando bloques…
          </div>
        )}
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm">
            {error}
          </div>
        )}
        {!loading && !error && orderedCategories.length === 0 && (
          <div className="text-slate-500 text-sm py-4 px-2">
            No hay bloques para {frameworkLabels[selectedFramework]}. Configura tasks en Firestore con{" "}
            <code className="bg-slate-200 px-1 rounded">framework: "{selectedFramework}"</code>.
          </div>
        )}
        {!loading && !error &&
          orderedCategories.map((category) => {
            const blocks = paletteData[category] || [];
            const isExpanded = expandedCategories[category] ?? (category === "common");

            if (blocks.length === 0) return null;

            return (
              <div key={`${selectedFramework}-${category}`} className="mb-2">
                <button
                  type="button"
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-base">
                      {categoryIcons[category] ?? "folder"}
                    </span>
                    <span>{categoryLabels[category] ?? category}</span>
                    <span className="text-xs text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded">
                      {blocks.length}
                    </span>
                  </div>
                  <span
                    className={`material-symbols-outlined text-xs transition-transform duration-200 ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                  >
                    expand_more
                  </span>
                </button>
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
                          const borderColor =
                            operatorBorderColors[block.type] ?? "border-l-slate-500";
                          const hoverBg =
                            operatorHoverBgColors[block.type] ?? "hover:bg-slate-50";
                          const iconColor =
                            operatorIconColors[block.type] ?? "text-slate-500 group-hover:text-slate-600";
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
                                <span
                                  className={`material-symbols-outlined text-base ${iconColor}`}
                                >
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
