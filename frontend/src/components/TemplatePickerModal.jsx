import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { templateAPI } from "../services/api";

export default function TemplatePickerModal({
  isOpen,
  onClose,
  onSelect,
}) {
  const [selectedFramework, setSelectedFramework] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchTemplates = useCallback(async () => {
    if (!selectedFramework) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await templateAPI.getAll({
        params: { framework: selectedFramework },
      });
      setTemplates(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "No se pudieron cargar las plantillas");
    } finally {
      setLoading(false);
    }
  }, [selectedFramework]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedFramework(null);
      setTemplates([]);
      setError(null);
      setSearchTerm("");
      return;
    }
    if (!selectedFramework) return;
    fetchTemplates();
  }, [fetchTemplates, isOpen, selectedFramework]);

  const filteredTemplates = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return templates.filter((template) => {
      if (!query) return true;
      return [template.id, template.name, template.description]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [searchTerm, templates]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <div onClick={onClose} className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-[3200]" />
          <div className="fixed inset-0 z-[3300] p-4 sm:p-6 flex items-center justify-center">
            <div className="w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl flex flex-col">
              <div className="border-b border-slate-200 px-5 py-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Plantillas</h2>
                  <p className="text-sm text-slate-500">
                    {!selectedFramework
                      ? "Selecciona un framework para ver plantillas activas."
                      : `Framework seleccionado: ${selectedFramework}.`}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="h-9 w-9 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100"
                  type="button"
                >
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-slate-50">
                {!selectedFramework && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedFramework("airflow")}
                      className="rounded-2xl border border-slate-200 bg-white p-5 text-left hover:border-blue-300 hover:bg-blue-50 transition"
                    >
                      <h3 className="text-base font-semibold text-slate-900">Airflow</h3>
                      <p className="mt-1 text-sm text-slate-500">Ver templates activos de Airflow.</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedFramework("argo")}
                      className="rounded-2xl border border-slate-200 bg-white p-5 text-left hover:border-blue-300 hover:bg-blue-50 transition"
                    >
                      <h3 className="text-base font-semibold text-slate-900">Argo</h3>
                      <p className="mt-1 text-sm text-slate-500">Ver templates activos de Argo.</p>
                    </button>
                  </div>
                )}

                {selectedFramework && (
                  <>
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFramework(null);
                          setTemplates([]);
                          setError(null);
                          setSearchTerm("");
                        }}
                        className="rounded-lg bg-slate-100 text-slate-700 text-sm px-3 py-2 hover:bg-slate-200"
                      >
                        Volver
                      </button>
                      <input
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar template"
                        className="flex-1 min-w-[220px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                      />
                      <button
                        type="button"
                        onClick={fetchTemplates}
                        className="rounded-lg bg-slate-100 text-slate-700 text-sm px-3 py-2 hover:bg-slate-200"
                      >
                        Refrescar
                      </button>
                    </div>

                    {loading && <div className="text-sm text-slate-500">Cargando plantillas...</div>}
                    {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

                    {!loading &&
                      !error &&
                      filteredTemplates.map((template) => (
                        <button
                          key={template.id}
                          type="button"
                          onClick={() => onSelect?.(template)}
                          className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left hover:border-blue-300 hover:bg-blue-50 transition"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h3 className="text-sm font-semibold text-slate-900 truncate">
                                {template.name || template.id}
                              </h3>
                              <p className="text-xs text-slate-500 truncate">{template.id}</p>
                            </div>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                              {template.framework}
                            </span>
                          </div>
                          {template.description && (
                            <p className="mt-2 text-sm text-slate-600">{template.description}</p>
                          )}
                          <p className="mt-3 text-xs text-slate-500">
                            {template.nodes?.length || 0} nodos · {template.edges?.length || 0} conexiones
                          </p>
                        </button>
                      ))}

                    {!loading && !error && filteredTemplates.length === 0 && (
                      <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-500">
                        No hay plantillas activas disponibles para este framework.
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
