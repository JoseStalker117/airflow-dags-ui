import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { taskBlocksByCategory } from "../data/tasks";
import { saveUserPreferences, loadUserPreferences } from "../utils/storage";

const categoryLabels = {
  common: "Comunes",
  airflow: "Airflow",
  google_cloud: "Google Cloud",
  database: "Databases",
  transfer: "Transferencia"
};

const categoryIcons = {
  common: "widgets",
  airflow: "account_tree",
  google_cloud: "cloud",
  database: "storage",
  transfer: "swap_horiz"
};

// Orden de categorías según la jerarquía definida
const categoryOrder = Object.keys(categoryLabels);

// Estado por defecto de categorías expandidas
const defaultExpandedCategories = {
  common: true,
  airflow: false,
  google_cloud: false,
  database: false,
  transfer: false
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
                      {blocks.map((block) => (
                        <div
                          key={block.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, block)}
                          className="bg-white p-3 rounded-md shadow-sm cursor-grab active:cursor-grabbing 
                                     hover:shadow-md hover:bg-blue-50 border border-transparent hover:border-blue-200
                                     transition-all group"
                          title={block.description}
                        >
                          <div className="flex items-start gap-2">
                            <span className="material-symbols-outlined text-base text-slate-500 group-hover:text-blue-600">
                              {block.icon}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm text-slate-700 group-hover:text-blue-700">
                                {block.label}
                              </div>
                              <div className="text-xs text-slate-500 mt-0.5 font-mono">
                                {block.type}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
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
