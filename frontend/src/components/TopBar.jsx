import { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { getTopbarGroups } from "../data/topbarFunctions";
import { useAuth } from "../context/AuthContext";
import { templateAPI } from "../services/api";
import {
  fetchCategories,
  buildCategoryMetaMap,
  getCategoryChipClass,
} from "../services/categoriesService";

const TEMPLATES_CACHE_KEY = "dagger_cache_templates_topbar_v1";
const TEMPLATES_CACHE_TTL_MS = 5 * 60 * 1000;

const readTemplatesCache = () => {
  try {
    const raw = localStorage.getItem(TEMPLATES_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.expiresAt <= Date.now()) return null;
    return parsed.data;
  } catch {
    return null;
  }
};

const writeTemplatesCache = (data) => {
  try {
    localStorage.setItem(
      TEMPLATES_CACHE_KEY,
      JSON.stringify({
        data,
        expiresAt: Date.now() + TEMPLATES_CACHE_TTL_MS,
      }),
    );
  } catch {
    // noop
  }
};

export default function TopBar({ onAction, onTemplateSelect, isAdmin = false }) {
  const [activeGroup, setActiveGroup] = useState(null);
  const [templateCascadeOpen, setTemplateCascadeOpen] = useState(false);
  const [selectedTemplateFramework, setSelectedTemplateFramework] = useState(null);
  const [hoveredTemplateId, setHoveredTemplateId] = useState(null);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState(null);
  const [templatesByFramework, setTemplatesByFramework] = useState({
    airflow: [],
    argo: [],
  });
  const [categories, setCategories] = useState([]);
  const groupRefs = useRef({});
  const navigate = useNavigate();
  const topbarGroups = getTopbarGroups({ isAdmin });
  const { currentUser, signOut } = useAuth();
  const isAnonymousSession = !currentUser || currentUser?.isAnonymous;

  const userDisplayName =
    isAnonymousSession
      ? "Anónimo"
      : currentUser?.displayName ||
    currentUser?.email?.split("@")[0] ||
    currentUser?.email ||
    "Usuario";

  const categoryMetaMap = useMemo(() => buildCategoryMetaMap(categories), [categories]);

  const getMenuPosition = (groupId) => {
    const anchor = groupRefs.current[groupId];
    if (!anchor) return { top: 56, left: 8 };

    const rect = anchor.getBoundingClientRect();
    return {
      top: rect.bottom,
      left: Math.max(8, rect.left),
    };
  };

  // Cerrar menú al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (activeGroup && groupRefs.current[activeGroup]) {
        if (!groupRefs.current[activeGroup].contains(event.target)) {
          setActiveGroup(null);
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [activeGroup]);

  useEffect(() => {
    let cancelled = false;
    fetchCategories()
      .then((items) => {
        if (!cancelled) {
          setCategories(Array.isArray(items) ? items : []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCategories([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleGroupClick = (groupId) => {
    const willClose = activeGroup === groupId;
    setActiveGroup(willClose ? null : groupId);
    setTemplateCascadeOpen(false);
    setSelectedTemplateFramework(null);
    setHoveredTemplateId(null);
    setTemplatesError(null);
  };

  const handleFunctionClick = (action) => {
    onAction(action);
    setActiveGroup(null);
  };

  const loadTemplates = async (options = {}) => {
    const { forceRefresh = false } = options;
    setTemplatesLoading(true);
    setTemplatesError(null);
    try {
      const cached = !forceRefresh ? readTemplatesCache() : null;
      if (cached?.airflow || cached?.argo) {
        setTemplatesByFramework({
          airflow: Array.isArray(cached.airflow) ? cached.airflow : [],
          argo: Array.isArray(cached.argo) ? cached.argo : [],
        });
        setTemplatesLoading(false);
        return;
      }

      const [airflowRes, argoRes] = await Promise.all([
        templateAPI.getAll({ params: { framework: "airflow" } }),
        templateAPI.getAll({ params: { framework: "argo" } }),
      ]);
      const nextTemplates = {
        airflow: Array.isArray(airflowRes.data) ? airflowRes.data : [],
        argo: Array.isArray(argoRes.data) ? argoRes.data : [],
      };
      setTemplatesByFramework(nextTemplates);
      writeTemplatesCache(nextTemplates);
    } catch (error) {
      setTemplatesError(
        error?.response?.data?.error || error?.message || "No se pudieron cargar las plantillas",
      );
    } finally {
      setTemplatesLoading(false);
    }
  };

  const handleOpenTemplatesCascade = async () => {
    setTemplateCascadeOpen(true);
    setSelectedTemplateFramework(null);
    setHoveredTemplateId(null);
    if (!templatesByFramework.airflow.length && !templatesByFramework.argo.length) {
      await loadTemplates();
    }
  };

  const handleTemplateClick = async (template) => {
    await onTemplateSelect?.(template);
    setTemplateCascadeOpen(false);
    setSelectedTemplateFramework(null);
    setHoveredTemplateId(null);
    setActiveGroup(null);
  };

  const currentFrameworkTemplates = selectedTemplateFramework
    ? (templatesByFramework[selectedTemplateFramework] || [])
    : [];
  const hoveredTemplate =
    currentFrameworkTemplates.find((template) => template.id === hoveredTemplateId) || null;
  const hoveredTemplateNodes = Array.isArray(hoveredTemplate?.nodes) ? hoveredTemplate.nodes : [];

  const handleAuthAction = async () => {
    setActiveGroup(null);

    if (isAnonymousSession) {
      await signOut();
      navigate("/login", { replace: true });
      return;
    }

    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <motion.div
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="sticky top-0 bg-white border-b border-gray-200 shadow-sm z-[120] flex-shrink-0"
    >
      {/* Barra principal de grupos */}
      <div className="flex items-center justify-between gap-3 px-2 py-2 border-b border-gray-100">
        <div className="flex items-center gap-1 overflow-x-auto whitespace-nowrap min-w-0">
          {topbarGroups.map((group) => (
            <div key={group.id} ref={(el) => (groupRefs.current[group.id] = el)} className="relative">
              <button
                onClick={() => handleGroupClick(group.id)}
                className={`
                  flex items-center gap-2 px-3 sm:px-4 py-2 rounded-t-md text-xs sm:text-sm font-medium
                  transition-all duration-200 min-w-[88px] sm:min-w-[100px]
                  ${activeGroup === group.id
                    ? "bg-blue-50 text-blue-700 border-t-2 border-x border-blue-300 border-b-2 border-b-transparent"
                    : "text-slate-700 hover:bg-gray-50 hover:text-slate-900"
                  }
                `}
              >
                <span className="material-symbols-outlined text-base">
                  {group.icon}
                </span>
                <span>{group.label}</span>
                <span className={`material-symbols-outlined text-xs transition-transform duration-200 ${
                  activeGroup === group.id ? "rotate-180" : ""
                }`}>
                  expand_more
                </span>
              </button>

              <AnimatePresence>
                {activeGroup === group.id && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="fixed mt-0 bg-white border border-blue-300 border-t-0 rounded-b-md shadow-lg min-w-[220px] max-w-[90vw] z-[220]"
                    style={getMenuPosition(group.id)}
                  >
                    <div className="py-1">
                      {group.functions.map((fn) => {
                        if (fn.action !== "openTemplates") {
                          return (
                            <button
                              key={fn.id}
                              onClick={() => handleFunctionClick(fn.action)}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors text-left"
                            >
                              <span className="material-symbols-outlined text-lg text-slate-500">
                                {fn.icon}
                              </span>
                              <div className="flex-1 flex items-center justify-between">
                                <span className="font-medium">{fn.label}</span>
                                {fn.shortcut && (
                                  <span className="text-xs text-slate-400 font-mono bg-gray-100 px-2 py-0.5 rounded">
                                    {fn.shortcut}
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        }

                        return (
                          <div key={fn.id} className="relative">
                            <button
                              onClick={handleOpenTemplatesCascade}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors text-left"
                            >
                              <span className="material-symbols-outlined text-lg text-slate-500">
                                {fn.icon}
                              </span>
                              <div className="flex-1 flex items-center justify-between">
                                <span className="font-medium">{fn.label}</span>
                                <span className="material-symbols-outlined text-base text-slate-400">
                                  chevron_right
                                </span>
                              </div>
                            </button>

                            {templateCascadeOpen && (
                              <div className="absolute left-full top-0 ml-1 min-w-[200px] bg-white border border-blue-300 rounded-md shadow-lg py-1 z-[230]">
                                <button
                                  onClick={() => setSelectedTemplateFramework("airflow")}
                                  className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left transition-colors ${
                                    selectedTemplateFramework === "airflow"
                                      ? "bg-blue-50 text-blue-700"
                                      : "text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                                  }`}
                                >
                                  <span>Airflow</span>
                                  <span className="material-symbols-outlined text-sm">chevron_right</span>
                                </button>
                                <button
                                  onClick={() => setSelectedTemplateFramework("argo")}
                                  className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left transition-colors ${
                                    selectedTemplateFramework === "argo"
                                      ? "bg-blue-50 text-blue-700"
                                      : "text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                                  }`}
                                >
                                  <span>Argo</span>
                                  <span className="material-symbols-outlined text-sm">chevron_right</span>
                                </button>
                                <button
                                  onClick={() => loadTemplates({ forceRefresh: true })}
                                  className="w-full px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 text-left"
                                >
                                  Refrescar plantillas
                                </button>

                                {selectedTemplateFramework && (
                                  <div className="absolute left-full top-0 ml-1 min-w-[280px] max-h-[360px] overflow-y-auto bg-white border border-blue-300 rounded-md shadow-lg py-1 z-[240]">
                                    {templatesLoading && (
                                      <div className="px-3 py-2 text-sm text-slate-500">Cargando...</div>
                                    )}
                                    {templatesError && !templatesLoading && (
                                      <div className="px-3 py-2 text-sm text-rose-600">{templatesError}</div>
                                    )}
                                    {!templatesLoading &&
                                      !templatesError &&
                                      currentFrameworkTemplates.map((template) => (
                                        <div
                                          key={template.id}
                                          className="relative"
                                          onMouseEnter={() => setHoveredTemplateId(template.id)}
                                          onMouseLeave={() => setHoveredTemplateId(null)}
                                        >
                                          <button
                                            onClick={() => handleTemplateClick(template)}
                                            className="w-full px-3 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 text-left"
                                          >
                                            <div className="font-medium truncate">
                                              {template.name || template.id}
                                            </div>
                                            <div className="text-xs text-slate-500 truncate">{template.id}</div>
                                          </button>
                                        </div>
                                      ))}
                                    {!templatesLoading &&
                                      !templatesError &&
                                      currentFrameworkTemplates.length === 0 && (
                                        <div className="px-3 py-2 text-sm text-slate-500">
                                          No hay plantillas activas.
                                        </div>
                                      )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>

        {hoveredTemplate && templateCascadeOpen && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 w-[420px] max-w-[86vw] bg-white border border-slate-300 rounded-lg shadow-xl p-3 z-[260]">
            <div className="text-xs font-semibold text-slate-700 truncate">
              Pasos de plantilla
            </div>
            <div className="text-[11px] text-slate-500 truncate mb-2">
              {hoveredTemplate.name || hoveredTemplate.id}
            </div>
            <div className="overflow-x-auto whitespace-nowrap rounded-md border border-slate-200 bg-slate-50 px-2 py-2">
              {hoveredTemplateNodes.length === 0 && (
                <span className="text-xs text-slate-500">Sin tasks</span>
              )}
              {hoveredTemplateNodes.map((node, index) => {
                const nodeLabel =
                  node?.data?.task_id ||
                  node?.data?.label ||
                  node?.data?.name ||
                  node?.id ||
                  `task_${index + 1}`;
                const nodeCategory = node?.data?.category || "others";
                const categoryStyle = getCategoryChipClass(nodeCategory, categoryMetaMap);
                return (
                  <span
                    key={`${hoveredTemplate.id}-${node?.id || nodeLabel}-${index}`}
                    className="inline-flex items-center"
                  >
                    <span className={`inline-flex items-center rounded-md border px-2 py-1 text-[11px] ${categoryStyle}`}>
                      {nodeLabel}
                    </span>
                    {index < hoveredTemplateNodes.length - 1 && (
                      <span className="material-symbols-outlined text-[14px] text-slate-400 mx-1">
                        arrow_forward
                      </span>
                    )}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 sm:gap-3 shrink-0 pl-2 border-l border-slate-200">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600">
              <span className="material-symbols-outlined text-[20px]">
                account_circle
              </span>
            </div>
            <span className="hidden sm:block max-w-[160px] truncate text-sm font-medium text-slate-700">
              {userDisplayName}
            </span>
          </div>

          <button
            type="button"
            onClick={handleAuthAction}
            className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs sm:text-sm font-medium text-rose-700 transition-colors hover:bg-rose-100"
          >
            <span className="material-symbols-outlined text-base">
              {isAnonymousSession ? "login" : "logout"}
            </span>
            <span className="hidden sm:inline">
              {isAnonymousSession ? "Iniciar sesión" : "Cerrar sesión"}
            </span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}
