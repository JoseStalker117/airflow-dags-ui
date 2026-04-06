import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { saveUserPreferences, loadUserPreferences } from "../utils/storage";
import { useAuth } from "../context/AuthContext";
import {
  fetchTaskBlocks,
  getBlocksForPalette,
  FRAMEWORKS,
} from "../services/tasksFromFirestore";
import {
  FRAMEWORK_UI,
} from "../config/taskUiConfig";
import {
  fetchCategories,
  buildCategoryMetaMap,
  getCategoriesForFramework,
  getCategoryChipClass,
  getCategoryCardClass,
  getCategoryColorHex,
} from "../services/categoriesService";
import {
  fetchUserPreferences,
  saveUserFavorites,
} from "../services/userPreferencesService";

const defaultExpandedCategories = { common: true };

export default function BlockPalette() {
  const { currentUser } = useAuth();
  const [selectedFramework, setSelectedFramework] = useState(() => {
    const prefs = loadUserPreferences();
    return prefs?.selectedFramework ?? "airflow";
  });
  const [allBlocks, setAllBlocks] = useState([]);
  const [allCategories, setAllCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState(() => {
    const prefs = loadUserPreferences();
    return prefs?.expandedCategories ?? defaultExpandedCategories;
  });
  const [userFavoriteTaskIds, setUserFavoriteTaskIds] = useState([]);
  const [hasCustomFavorites, setHasCustomFavorites] = useState(false);

  // Cargar bloques desde Firestore (API)
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchTaskBlocks()
      .then(async (blocks) => {
        if (!cancelled) setAllBlocks(blocks);
        const categories = await fetchCategories();
        if (!cancelled) setAllCategories(categories);
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

  const categoryMetaMap = buildCategoryMetaMap(allCategories);
  const defaultFavoriteTaskIds = Array.from(
    new Set(
      (allBlocks || [])
        .filter((block) => {
          const cat = block.category || "others";
          return !!block.isDefaultFavorite || !!categoryMetaMap[cat]?.showInDefaultFavorites;
        })
        .map((block) => String(block.id || "").trim())
        .filter(Boolean),
    ),
  );
  const paletteData = getBlocksForPalette(allBlocks, selectedFramework, {
    categoryMetaMap,
    userFavoriteTaskIds,
    hasCustomFavorites,
  });
  const categoryOrderBase = getCategoriesForFramework(allCategories, selectedFramework).map((item) => item.id);
  const categoryOrder = ["common", ...categoryOrderBase.filter((item) => item !== "common")];
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

  useEffect(() => {
    let cancelled = false;
    const uid = currentUser?.uid;
    if (!uid) {
      setUserFavoriteTaskIds([]);
      setHasCustomFavorites(false);
      return;
    }

    fetchUserPreferences(uid)
      .then((prefs) => {
        if (cancelled) return;
        setUserFavoriteTaskIds(Array.isArray(prefs?.favoriteTaskIds) ? prefs.favoriteTaskIds : []);
        setHasCustomFavorites(!!prefs?.hasCustomFavorites);
      })
      .catch(() => {
        if (cancelled) return;
        setUserFavoriteTaskIds([]);
        setHasCustomFavorites(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentUser?.uid]);

  const handleToggleFavorite = async (event, block) => {
    event.preventDefault();
    event.stopPropagation();

    if (!currentUser?.uid) return;

    const taskId = String(block?.id || "").trim();
    if (!taskId) return;

    const prevIds = hasCustomFavorites ? userFavoriteTaskIds : defaultFavoriteTaskIds;
    const exists = prevIds.includes(taskId);
    const nextIds = exists
      ? prevIds.filter((id) => id !== taskId)
      : [...prevIds, taskId];
    const prevCustomFavorites = hasCustomFavorites;

    setUserFavoriteTaskIds(nextIds);
    setHasCustomFavorites(true);

    try {
      await saveUserFavorites(currentUser?.uid, nextIds);
    } catch {
      setUserFavoriteTaskIds(prevIds);
      setHasCustomFavorites(prevCustomFavorites);
    }
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
                {FRAMEWORK_UI[fw]?.icon}
              </span>
              {FRAMEWORK_UI[fw]?.label || fw}
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
            No hay bloques para {FRAMEWORK_UI[selectedFramework]?.label || selectedFramework}. Configura tasks en Firestore con{" "}
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
                      {categoryMetaMap[category]?.icon ?? (category === "common" ? "star" : "folder")}
                    </span>
                    <span>{categoryMetaMap[category]?.label ?? (category === "common" ? "Favoritos" : category)}</span>
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded border ${getCategoryChipClass(
                        category,
                        categoryMetaMap,
                      )}`}
                    >
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
                          const taskCategory = block.category || category || "others";
                          const taskCardStyle = getCategoryCardClass(taskCategory, categoryMetaMap);
                          const taskAccentColor = getCategoryColorHex(taskCategory, categoryMetaMap);
                          const taskId = String(block?.id || "").trim();
                          const isFavFromUser = userFavoriteTaskIds.includes(taskId);
                          const isFavDefault = !!block.isDefaultFavorite || !!categoryMetaMap[taskCategory]?.showInDefaultFavorites;
                          const isFavorite = hasCustomFavorites ? isFavFromUser : isFavDefault;
                          return (
                            <div
                              key={block.id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, block)}
                              className={`bg-white p-3 rounded-md shadow-sm cursor-grab active:cursor-grabbing
                                         hover:shadow-md border-l-4 ${taskCardStyle}
                                         border border-gray-100 hover:border-gray-200
                                         transition-all group`}
                              title={block.description}
                            >
                              <div className="flex items-start gap-2">
                                <span
                                  className="material-symbols-outlined text-base"
                                  style={{ color: taskAccentColor }}
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
                                <button
                                  type="button"
                                  onClick={(event) => handleToggleFavorite(event, block)}
                                  className={`h-7 w-7 rounded-md border flex items-center justify-center transition ${
                                    isFavorite
                                      ? "border-amber-300 bg-amber-50 text-amber-600"
                                      : "border-slate-300 bg-white text-slate-400 hover:bg-slate-100"
                                  }`}
                                  title={isFavorite ? "Quitar de favoritos" : "Agregar a favoritos"}
                                >
                                  <span className="material-symbols-outlined text-[16px]">
                                    {isFavorite ? "star" : "star_outline"}
                                  </span>
                                </button>
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
