import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { templateAPI } from "../services/api";
import {
  fetchCategories,
  buildCategoryMetaMap,
  getCategoryChipClass,
} from "../services/categoriesService";

const defaultForm = {
  id: "",
  name: "",
  description: "",
  framework: "airflow",
  nodes: [],
  edges: [],
  isActive: true,
};

const inferFrameworkFromFlow = (nodes = []) => {
  const root = nodes.find((node) =>
    ["DAG", "ArgoWorkflow"].includes(node?.data?.type),
  );
  if (root?.data?.type === "DAG") return "airflow";
  if (root?.data?.type === "ArgoWorkflow") return "argo";

  const first = nodes.find(Boolean);
  if (first?.data?.framework === "airflow" || first?.data?.platform === "airflow") return "airflow";
  if (first?.data?.framework === "argo" || first?.data?.platform === "argo") return "argo";
  return null;
};

const normalizeTemplate = (template) => ({
  id: template?.id || "",
  name: template?.name || "",
  description: template?.description || "",
  framework: template?.framework || "airflow",
  nodes: Array.isArray(template?.nodes) ? template.nodes : [],
  edges: Array.isArray(template?.edges) ? template.edges : [],
  isActive: template?.isActive !== false,
});

const getTemplateNodeTitle = (node, index) =>
  node?.data?.task_id ||
  node?.data?.label ||
  node?.data?.name ||
  node?.id ||
  `task_${index + 1}`;

const TOPBAR_TEMPLATES_CACHE_KEY = "dagger_cache_templates_topbar_v1";

export default function AdminTemplatesPanel({
  isOpen,
  onClose,
  onSaved,
  getCanvasData,
}) {
  const [templates, setTemplates] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [frameworkFilter, setFrameworkFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [formMode, setFormMode] = useState("create");
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [form, setForm] = useState(defaultForm);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await templateAPI.getAllAdmin();
      setTemplates(Array.isArray(data) ? data : []);
      const categoriesData = await fetchCategories();
      setCategories(Array.isArray(categoriesData) ? categoriesData : []);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "No se pudieron cargar las plantillas");
    } finally {
      setLoading(false);
    }
  }, []);
  const categoryMetaMap = useMemo(() => buildCategoryMetaMap(categories), [categories]);

  useEffect(() => {
    if (!isOpen) return;
    fetchTemplates();
  }, [isOpen, fetchTemplates]);

  const stats = useMemo(() => {
    const total = templates.length;
    const active = templates.filter((item) => item.isActive !== false).length;
    return { total, active, inactive: total - active };
  }, [templates]);

  const filteredTemplates = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return templates
      .filter((template) => {
        if (frameworkFilter !== "all" && template.framework !== frameworkFilter) return false;
        if (statusFilter === "active" && template.isActive === false) return false;
        if (statusFilter === "inactive" && template.isActive !== false) return false;
        if (!query) return true;
        return [template.id, template.name, template.description, template.framework]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort((a, b) => String(a.name || a.id || "").localeCompare(String(b.name || b.id || "")));
  }, [templates, frameworkFilter, searchTerm, statusFilter]);

  const resetForm = useCallback(() => {
    setFormMode("create");
    setEditingTemplateId(null);
    setForm(defaultForm);
    setError(null);
  }, []);

  const startEdit = useCallback((template) => {
    setFormMode("edit");
    setEditingTemplateId(template.id);
    setForm(normalizeTemplate(template));
    setError(null);
  }, []);

  const captureCurrentFlow = useCallback(() => {
    const payload = getCanvasData?.() || { nodes: [], edges: [] };
    const nodes = Array.isArray(payload.nodes) ? payload.nodes : [];
    const edges = Array.isArray(payload.edges) ? payload.edges : [];

    if (!nodes.length) {
      setError("El flow actual está vacío. Agrega nodos antes de guardar la plantilla.");
      return;
    }

    const inferredFramework = inferFrameworkFromFlow(nodes);
    setForm((prev) => ({
      ...prev,
      framework: inferredFramework || prev.framework || "airflow",
      nodes,
      edges,
    }));
    setError(null);
  }, [getCanvasData]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      if (!String(form.id || "").trim()) throw new Error("El ID es obligatorio");
      if (!String(form.name || "").trim()) throw new Error("El nombre es obligatorio");
      if (!Array.isArray(form.nodes) || form.nodes.length === 0) {
        throw new Error("Debes capturar un flow para la plantilla");
      }

      const payload = {
        id: String(form.id).trim(),
        name: String(form.name).trim(),
        description: String(form.description || "").trim(),
        framework: form.framework || "airflow",
        nodes: form.nodes,
        edges: Array.isArray(form.edges) ? form.edges : [],
        isActive: form.isActive !== false,
      };

      if (formMode === "create") {
        await templateAPI.create(payload);
      } else {
        await templateAPI.update(editingTemplateId, payload);
      }
      localStorage.removeItem(TOPBAR_TEMPLATES_CACHE_KEY);

      await fetchTemplates();
      onSaved?.();
      if (formMode === "create") resetForm();
    } catch (err) {
      setError(err.response?.data?.error || err.message || "No se pudo guardar la plantilla");
    } finally {
      setSaving(false);
    }
  }, [editingTemplateId, fetchTemplates, form, formMode, onSaved, resetForm]);

  const handleDelete = useCallback(
    async (templateId) => {
      if (!window.confirm(`¿Desactivar plantilla "${templateId}"?`)) return;
      setSaving(true);
      setError(null);
      try {
        await templateAPI.delete(templateId);
        localStorage.removeItem(TOPBAR_TEMPLATES_CACHE_KEY);
        await fetchTemplates();
        onSaved?.();
        if (editingTemplateId === templateId) resetForm();
      } catch (err) {
        setError(err.response?.data?.error || err.message || "No se pudo desactivar la plantilla");
      } finally {
        setSaving(false);
      }
    },
    [editingTemplateId, fetchTemplates, onSaved, resetForm],
  );

  const updateTemplateNodeName = useCallback((index, value) => {
    setForm((prev) => {
      const nextNodes = [...(prev.nodes || [])];
      if (!nextNodes[index]) return prev;
      const node = nextNodes[index];
      nextNodes[index] = {
        ...node,
        data: {
          ...(node.data || {}),
          task_id: value,
          label: value,
        },
      };
      return { ...prev, nodes: nextNodes };
    });
  }, []);

  const moveTemplateNode = useCallback((index, direction) => {
    setForm((prev) => {
      const nodes = [...(prev.nodes || [])];
      const targetIndex = direction === "left" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= nodes.length) return prev;
      const temp = nodes[index];
      nodes[index] = nodes[targetIndex];
      nodes[targetIndex] = temp;
      return { ...prev, nodes };
    });
  }, []);

  const removeTemplateNode = useCallback((index) => {
    setForm((prev) => {
      const nodes = [...(prev.nodes || [])];
      const nodeToRemove = nodes[index];
      if (!nodeToRemove) return prev;

      const nextNodes = nodes.filter((_, i) => i !== index);
      const nextEdges = (prev.edges || []).filter(
        (edge) => edge.source !== nodeToRemove.id && edge.target !== nodeToRemove.id,
      );

      return { ...prev, nodes: nextNodes, edges: nextEdges };
    });
  }, []);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <div onClick={onClose} className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-[3200]" />

          <div className="fixed inset-0 z-[3300] p-2 sm:p-4 lg:p-6">
            <div className="h-full rounded-2xl border border-slate-200 bg-slate-50 shadow-2xl overflow-hidden flex flex-col">
              <div className="bg-white border-b border-slate-200 px-4 py-3 sm:px-5 sm:py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Administrador de Plantillas</h2>
                    <p className="text-xs sm:text-sm text-slate-500">
                      Guarda flows reutilizables de Airflow o Argo a partir del canvas actual.
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

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">Total: {stats.total}</span>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">Activas: {stats.active}</span>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-rose-100 text-rose-700">Inactivas: {stats.inactive}</span>
                </div>
              </div>

              {error && (
                <div className="mx-4 mt-3 sm:mx-5 px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm">
                  {error}
                </div>
              )}

              <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[360px_1fr]">
                <div className="border-r border-slate-200 bg-white min-h-0 flex flex-col">
                  <div className="p-3 sm:p-4 border-b border-slate-200 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <select
                        value={frameworkFilter}
                        onChange={(e) => setFrameworkFilter(e.target.value)}
                        className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200"
                      >
                        <option value="all">Framework</option>
                        <option value="airflow">Airflow</option>
                        <option value="argo">Argo</option>
                      </select>
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200"
                      >
                        <option value="all">Estado</option>
                        <option value="active">Activas</option>
                        <option value="inactive">Inactivas</option>
                      </select>
                      <button
                        type="button"
                        onClick={fetchTemplates}
                        className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-100"
                      >
                        Refrescar
                      </button>
                    </div>

                    <input
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Buscar por ID, nombre o descripción"
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={resetForm}
                        className="rounded-lg bg-blue-600 text-white text-xs px-3 py-2 hover:bg-blue-700"
                      >
                        Nueva plantilla
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
                    {loading && <div className="text-sm text-slate-500">Cargando plantillas...</div>}

                    {!loading &&
                      filteredTemplates.map((template) => (
                        <article
                          key={template.id}
                          className={`rounded-xl border p-3 transition ${
                            editingTemplateId === template.id
                              ? "border-blue-300 bg-blue-50"
                              : "border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900 truncate">{template.name || template.id}</p>
                              <p className="text-xs text-slate-600 truncate">{template.id}</p>
                              <p className="text-[11px] text-slate-500 truncate">
                                {template.framework} · {template.nodes?.length || 0} nodos · {template.edges?.length || 0} conexiones
                              </p>
                            </div>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                              template.isActive === false
                                ? "bg-rose-100 text-rose-700"
                                : "bg-emerald-100 text-emerald-700"
                            }`}>
                              {template.isActive === false ? "inactiva" : "activa"}
                            </span>
                          </div>
                          {template.description && (
                            <p className="mt-2 text-xs text-slate-500 line-clamp-2">{template.description}</p>
                          )}
                          <div className="mt-3 flex gap-2">
                            <button
                              type="button"
                              onClick={() => startEdit(template)}
                              className="text-xs px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(template.id)}
                              className="text-xs px-2.5 py-1.5 rounded-lg bg-rose-100 text-rose-700 hover:bg-rose-200"
                            >
                              Desactivar
                            </button>
                          </div>
                        </article>
                      ))}

                    {!loading && filteredTemplates.length === 0 && (
                      <div className="text-sm text-slate-500">No hay plantillas con los filtros seleccionados.</div>
                    )}
                  </div>
                </div>

                <div className="min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                    <h3 className="text-base font-semibold text-slate-900">
                      {formMode === "create" ? "Crear nueva plantilla" : `Editando: ${editingTemplateId}`}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Captura el flow actual y guárdalo como plantilla reutilizable.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <label className="text-sm text-slate-700 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                      <span className="font-medium">ID técnico</span>
                      <p className="text-xs text-slate-500 mt-0.5">Identificador único en Firestore.</p>
                      <input
                        value={form.id}
                        disabled={formMode === "edit"}
                        onChange={(e) => setForm((prev) => ({ ...prev, id: e.target.value }))}
                        placeholder="airflow_base_template"
                        className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 disabled:bg-slate-100"
                      />
                    </label>

                    <label className="text-sm text-slate-700 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                      <span className="font-medium">Nombre</span>
                      <p className="text-xs text-slate-500 mt-0.5">Texto visible para selección en la topbar.</p>
                      <input
                        value={form.name}
                        onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                        placeholder="Pipeline base Airflow"
                        className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                      />
                    </label>

                    <label className="text-sm text-slate-700 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                      <span className="font-medium">Framework</span>
                      <p className="text-xs text-slate-500 mt-0.5">Se infiere del flow capturado, pero puedes ajustarlo.</p>
                      <select
                        value={form.framework}
                        onChange={(e) => setForm((prev) => ({ ...prev, framework: e.target.value }))}
                        className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                      >
                        <option value="airflow">airflow</option>
                        <option value="argo">argo</option>
                      </select>
                    </label>

                    <label className="text-sm text-slate-700 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                      <span className="font-medium">Estado</span>
                      <p className="text-xs text-slate-500 mt-0.5">Las plantillas inactivas no aparecerán en Archivo.</p>
                      <select
                        value={form.isActive === false ? "inactive" : "active"}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, isActive: e.target.value !== "inactive" }))
                        }
                        className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                      >
                        <option value="active">Activa</option>
                        <option value="inactive">Inactiva</option>
                      </select>
                    </label>
                  </div>

                  <label className="text-sm text-slate-700 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 block">
                    <span className="font-medium">Descripción</span>
                    <p className="text-xs text-slate-500 mt-0.5">Ayuda breve para que el usuario sepa cuándo usarla.</p>
                    <textarea
                      value={form.description}
                      onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                      placeholder="Template base con nodo raíz, validación y export."
                      rows={3}
                      className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                    />
                  </label>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900">Flow capturado</h4>
                        <p className="text-xs text-slate-500">
                          Nodos: {form.nodes?.length || 0} · Conexiones: {form.edges?.length || 0}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={captureCurrentFlow}
                        className="rounded-lg bg-slate-100 text-slate-700 text-xs px-3 py-2 hover:bg-slate-200"
                      >
                        Usar flow actual
                      </button>
                    </div>

                    <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-600">
                      La plantilla se guarda con los `nodes` y `edges` serializados del canvas actual.
                    </div>

                    <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-700">Editor compacto de tasks</span>
                        <span className="text-[11px] text-slate-500">
                          Edita nombre, orden y limpieza rápida
                        </span>
                      </div>

                      <div className="mt-2 overflow-x-auto whitespace-nowrap">
                        {(!Array.isArray(form.nodes) || form.nodes.length === 0) && (
                          <div className="text-xs text-slate-500">No hay tasks para visualizar.</div>
                        )}

                        {Array.isArray(form.nodes) &&
                          form.nodes.map((node, index) => (
                            <span key={`${node?.id || "node"}-${index}`} className="inline-flex items-center">
                              <span
                                className={`inline-flex flex-col gap-1 rounded-lg border p-2 min-w-[190px] ${getCategoryChipClass(
                                  node?.data?.category || "others",
                                  categoryMetaMap,
                                )}`}
                              >
                                <span className="text-[10px] text-slate-500 truncate">
                                  {node?.data?.type || "Task"} · {node?.id || "sin_id"}
                                </span>
                                <input
                                  value={getTemplateNodeTitle(node, index)}
                                  onChange={(e) => updateTemplateNodeName(index, e.target.value)}
                                  className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
                                  placeholder={`task_${index + 1}`}
                                />
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => moveTemplateNode(index, "left")}
                                    className="rounded border border-slate-300 px-1.5 py-0.5 text-[10px] text-slate-600 hover:bg-slate-100"
                                    title="Mover a la izquierda"
                                  >
                                    ◀
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => moveTemplateNode(index, "right")}
                                    className="rounded border border-slate-300 px-1.5 py-0.5 text-[10px] text-slate-600 hover:bg-slate-100"
                                    title="Mover a la derecha"
                                  >
                                    ▶
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeTemplateNode(index)}
                                    className="rounded border border-rose-300 px-1.5 py-0.5 text-[10px] text-rose-600 hover:bg-rose-50"
                                    title="Eliminar task del template"
                                  >
                                    Eliminar
                                  </button>
                                </div>
                              </span>
                              {index < form.nodes.length - 1 && (
                                <span className="material-symbols-outlined text-[16px] text-slate-400 mx-1">
                                  arrow_forward
                                </span>
                              )}
                            </span>
                          ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={saving}
                      className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                      {formMode === "create" ? "Guardar plantilla" : "Guardar cambios"}
                    </button>
                    <button
                      type="button"
                      onClick={resetForm}
                      className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200"
                    >
                      Limpiar formulario
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
