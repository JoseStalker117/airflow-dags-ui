import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { taskAPI } from "../services/api";
import {
  ICON_OPTIONS,
  CATEGORY_CARD_STYLES,
  FRAMEWORK_OPTIONS,
  CATEGORY_OPTIONS,
  CATEGORY_LABELS,
} from "../config/taskUiConfig";

const REQUIRED_FIELDS = [
  "id",
  "name",
  "type",
  "icon",
  "category",
  "description",
  "framework",
  "platform",
  "template",
];
const ROOT_TASK_TYPES = new Set(["DAG", "ArgoWorkflow"]);

const FIELD_CONFIG = {
  id: {
    label: "ID técnico",
    hint: "Identificador único del documento en Firestore. No usar espacios.",
    placeholder: "BashOperatorCustom",
  },
  name: {
    label: "Nombre visible",
    hint: "Nombre que verá el usuario en la paleta de tareas.",
    placeholder: "Bash Operator Custom",
  },
  type: {
    label: "Tipo de operador",
    hint: "Clase del operador para exportación.",
    placeholder: "BashOperator",
  },
  icon: {
    label: "Ícono",
    hint: "Nombre de material symbol.",
    placeholder: "terminal",
  },
  category: {
    label: "Categoría",
    hint: "Grupo visual en la paleta.",
    placeholder: "util",
  },
  description: {
    label: "Descripción",
    hint: "Texto breve de ayuda para el usuario final.",
    placeholder: "Ejecuta un comando bash.",
  },
  framework: {
    label: "Framework",
    hint: "airflow o argo.",
  },
  platform: {
    label: "Plataforma",
    hint: "Normalmente igual al framework.",
    placeholder: "airflow",
  },
  template: {
    label: "Template",
    hint: "Nombre interno del template.",
    placeholder: "bash_operator",
  },
};

const defaultTask = {
  id: "",
  name: "",
  type: "",
  icon: "extension",
  category: "util",
  description: "",
  framework: "airflow",
  platform: "airflow",
  template: "",
  importLiteral: "",
  isDefaultFavorite: false,
  isActive: true,
};

const defaultParameter = {
  key: "",
  type: "string",
  defaultValue: "",
  description: "",
};

const buildParameterRow = (overrides = {}) => ({
  rowId: overrides.rowId || "",
  key: overrides.key ?? "",
  type: overrides.type ?? "string",
  defaultValue: overrides.defaultValue ?? "",
  description: overrides.description ?? "",
});

const normalizeToRows = (parameters) => {
  const rows = Object.entries(parameters || {}).map(([key, value]) => ({
    key,
    type: value?.type || "string",
    defaultValue:
      value?.default === undefined || value?.default === null ? "" : String(value.default),
    description: value?.description || "",
  }));
  const hasTaskId = rows.some((r) => r.key === "task_id");
  if (!hasTaskId) {
    return [
      { key: "task_id", type: "string", defaultValue: "task_1", description: "ID único de la tarea" },
      ...rows,
    ];
  }
  return rows;
};

const normalizeToTask = (task) => ({
  id: task?.id || "",
  name: task?.name || "",
  type: task?.type || "",
  icon: task?.icon || "extension",
  category: task?.category || "util",
  description: task?.description || "",
  framework: task?.framework || "airflow",
  platform: task?.platform || task?.framework || "airflow",
  template: task?.template || "",
  importLiteral: task?.importLiteral || "",
  isDefaultFavorite: !!task?.isDefaultFavorite,
  isActive: task?.isActive !== false,
});

const buildPayload = (form, parameterRows) => {
  const missing = REQUIRED_FIELDS.filter((field) => !String(form[field] || "").trim());
  if (missing.length > 0) {
    throw new Error(`Faltan campos obligatorios: ${missing.join(", ")}`);
  }

  const parameters = {};
  for (const row of parameterRows) {
    const key = String(row.key || "").trim();
    if (!key) continue;
    if (parameters[key]) {
      throw new Error(`Parámetro duplicado: ${key}`);
    }
    parameters[key] = {
      type: row.type || "string",
      default: row.defaultValue,
      description: row.description || "",
    };
  }

  const requiresTaskId = !ROOT_TASK_TYPES.has(form.type);
  if (requiresTaskId && !parameters.task_id) {
    throw new Error("El parámetro task_id es obligatorio");
  }

  return {
    ...form,
    framework: form.framework || "airflow",
    platform: form.platform || form.framework || "airflow",
    isActive: form.isActive !== false,
    parameters,
  };
};

export default function AdminTasksPanel({ isOpen, onClose, onSaved }) {
  const parameterRowIdRef = useRef(1);
  const nextParameterRowId = useCallback(() => {
    const id = `param_row_${parameterRowIdRef.current}`;
    parameterRowIdRef.current += 1;
    return id;
  }, []);

  const createTaskIdParameterRow = useCallback(
    () =>
      buildParameterRow({
        rowId: nextParameterRowId(),
        key: "task_id",
        type: "string",
        defaultValue: "task_1",
        description: "ID único de la tarea",
      }),
    [nextParameterRowId],
  );

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [frameworkFilter, setFrameworkFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const [formMode, setFormMode] = useState("create");
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [form, setForm] = useState(defaultTask);
  const [parameterRows, setParameterRows] = useState([createTaskIdParameterRow()]);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Cargar una sola vez todas las tasks (activas/inactivas) y filtrar localmente
      // para reducir consumo de lecturas en Firestore.
      const { data } = await taskAPI.getAllAdmin();
      setTasks(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "No se pudieron cargar las tasks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    fetchTasks();
  }, [isOpen, fetchTasks]);

  const filteredTasks = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const filtered = tasks.filter((task) => {
      if (frameworkFilter !== "all" && String(task.framework || "") !== frameworkFilter) return false;
      if (statusFilter === "active" && task.isActive === false) return false;
      if (statusFilter === "inactive" && task.isActive !== false) return false;
      if (categoryFilter !== "all" && String(task.category || "") !== categoryFilter) return false;
      if (!normalizedSearch) return true;

      const searchable = [
        task.id,
        task.name,
        task.type,
        task.category,
        task.framework,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return searchable.includes(normalizedSearch);
    });

    return [...filtered].sort((a, b) => String(a.id || "").localeCompare(String(b.id || "")));
  }, [tasks, searchTerm, frameworkFilter, statusFilter, categoryFilter]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const active = tasks.filter((t) => t.isActive !== false).length;
    const inactive = total - active;
    return { total, active, inactive };
  }, [tasks]);

  const hasActiveFilters =
    frameworkFilter !== "all" ||
    statusFilter !== "all" ||
    categoryFilter !== "all" ||
    searchTerm.trim() !== "";

  const resetForm = () => {
    setFormMode("create");
    setEditingTaskId(null);
    setForm(defaultTask);
    setParameterRows([createTaskIdParameterRow()]);
    setError(null);
  };

  const startEdit = (task) => {
    setFormMode("edit");
    setEditingTaskId(task.id);
    setForm(normalizeToTask(task));
    setParameterRows(
      normalizeToRows(task.parameters).map((row) =>
        buildParameterRow({
          ...row,
          rowId: nextParameterRowId(),
        }),
      ),
    );
    setError(null);
  };

  const updateParameter = (index, patch) => {
    setParameterRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const addParameter = () => {
    setParameterRows((prev) => [
      ...prev,
      buildParameterRow({ ...defaultParameter, rowId: nextParameterRowId() }),
    ]);
  };

  const removeParameter = (index) => {
    setParameterRows((prev) => {
      const row = prev[index];
      if (row?.key === "task_id") return prev;
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = buildPayload(form, parameterRows);
      if (formMode === "create") {
        await taskAPI.create(payload);
      } else {
        await taskAPI.update(editingTaskId, payload);
      }
      await fetchTasks();
      onSaved?.();
      if (formMode === "create") resetForm();
    } catch (err) {
      setError(err.response?.data?.error || err.message || "No se pudo guardar la task");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (taskId) => {
    if (!window.confirm(`¿Desactivar task "${taskId}"?`)) return;
    setSaving(true);
    setError(null);
    try {
      await taskAPI.delete(taskId);
      await fetchTasks();
      onSaved?.();
      if (editingTaskId === taskId) resetForm();
    } catch (err) {
      setError(err.response?.data?.error || err.message || "No se pudo desactivar la task");
    } finally {
      setSaving(false);
    }
  };

  const clearFilters = () => {
    setFrameworkFilter("all");
    setStatusFilter("all");
    setCategoryFilter("all");
    setSearchTerm("");
  };

  const categoryOptions = useMemo(() => {
    const dynamic = [...new Set(tasks.map((t) => t.category).filter(Boolean))].map((value) => ({
      value,
      label: CATEGORY_LABELS[value] || value,
    }));
    const merged = [...CATEGORY_OPTIONS, ...dynamic];
    const unique = merged.filter(
      (option, index, arr) => arr.findIndex((item) => item.value === option.value) === index,
    );
    return unique.sort((a, b) => String(a.label).localeCompare(String(b.label)));
  }, [tasks]);

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
                    <h2 className="text-lg font-semibold text-slate-900">Administrador de Tasks</h2>
                    <p className="text-xs sm:text-sm text-slate-500">
                      Gestiona tareas de Airflow/Argo con filtros, agrupación y edición guiada.
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
                  <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                    Total: {stats.total}
                  </span>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
                    Activas: {stats.active}
                  </span>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-rose-100 text-rose-700">
                    Inactivas: {stats.inactive}
                  </span>
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
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="material-symbols-outlined text-sm text-slate-500">hub</span>
                          <select
                            value={frameworkFilter}
                            onChange={(e) => setFrameworkFilter(e.target.value)}
                            className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200"
                            title="Filtrar por framework"
                          >
                            <option value="all">Framework</option>
                            {FRAMEWORK_OPTIONS.map((framework) => (
                              <option key={framework.value} value={framework.value}>
                                {framework.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="material-symbols-outlined text-sm text-slate-500">toggle_on</span>
                          <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200"
                            title="Filtrar por estado"
                          >
                            <option value="all">Estado</option>
                            <option value="active">Activas</option>
                            <option value="inactive">Inactivas</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="material-symbols-outlined text-sm text-slate-500">category</span>
                          <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200"
                            title="Filtrar por categoría"
                          >
                            <option value="all">Categoría</option>
                            {categoryOptions.map((category) => (
                              <option key={category.value} value={category.value}>
                                {category.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="mt-2 flex items-center gap-2">
                        <div className="relative flex-1 min-w-0">
                          {/* <span className="material-symbols-outlined pointer-events-none text-sm text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2">
                            search
                          </span> */}
                          <input
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Buscar por ID, nombre o tipo"
                            className="w-full min-w-0 rounded-md border border-slate-300 bg-white pl-9 pr-2 py-1.5 text-xs leading-5 focus:outline-none focus:ring-2 focus:ring-blue-200"
                            title="Buscar por id, nombre o tipo"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={clearFilters}
                          disabled={!hasActiveFilters}
                          className="shrink-0 rounded-md border border-slate-300 bg-white text-slate-600 text-xs px-2.5 py-1.5 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Limpiar filtros"
                        >
                          Limpiar
                        </button>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Mostrando {filteredTasks.length} de {stats.total} tasks
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={fetchTasks}
                        className="rounded-lg bg-slate-100 text-slate-700 text-xs px-3 py-2 hover:bg-slate-200"
                      >
                        Refrescar
                      </button>
                      <button
                        type="button"
                        onClick={resetForm}
                        className="rounded-lg bg-blue-600 text-white text-xs px-3 py-2 hover:bg-blue-700"
                      >
                        Nueva task
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4">
                    {loading && <div className="text-sm text-slate-500">Cargando tasks...</div>}

                    {!loading &&
                      filteredTasks.map((task) => (
                        <article
                          key={task.id}
                          className={`rounded-xl border p-3 transition ${
                            editingTaskId === task.id
                              ? "border-blue-300 bg-blue-50"
                              : "border-slate-200 hover:bg-slate-100"
                          } border-l-4 ${
                            CATEGORY_CARD_STYLES[task.category] || CATEGORY_CARD_STYLES.others
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900 truncate">{task.id}</p>
                              <p className="text-xs text-slate-600 truncate">{task.name}</p>
                              <p className="text-[11px] text-slate-500 truncate">
                                {task.framework} · {CATEGORY_LABELS[task.category] || task.category} · {task.type}
                              </p>
                            </div>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full ${
                                task.isActive === false
                                  ? "bg-rose-100 text-rose-700"
                                  : "bg-emerald-100 text-emerald-700"
                              }`}
                            >
                              {task.isActive === false ? "inactiva" : "activa"}
                            </span>
                          </div>
                          <div className="mt-2 flex gap-2">
                            <button
                              type="button"
                              onClick={() => startEdit(task)}
                              className="text-xs px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(task.id)}
                              className="text-xs px-2.5 py-1.5 rounded-lg bg-rose-100 text-rose-700 hover:bg-rose-200"
                            >
                              Desactivar
                            </button>
                          </div>
                        </article>
                      ))}

                    {!loading && filteredTasks.length === 0 && (
                      <div className="text-sm text-slate-500">No hay tasks con los filtros seleccionados.</div>
                    )}
                  </div>
                </div>

                <div className="min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                    <h3 className="text-base font-semibold text-slate-900">
                      {formMode === "create" ? "Crear nueva task" : `Editando: ${editingTaskId}`}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Define el tipo de task y su configuración base.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                        <h4 className="text-sm font-semibold text-slate-800 mb-2">1) Identificación y clasificación</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <label className="text-sm text-slate-700">
                          <span className="font-medium">{FIELD_CONFIG.id.label} <span className="text-rose-500">*</span></span>
                          <p className="text-xs text-slate-500 mt-0.5">{FIELD_CONFIG.id.hint}</p>
                          <input
                            value={form.id || ""}
                            disabled={formMode === "edit"}
                            onChange={(e) => setForm((prev) => ({ ...prev, id: e.target.value }))}
                            placeholder={FIELD_CONFIG.id.placeholder}
                            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 disabled:bg-slate-100"
                          />
                        </label>

                        <label className="text-sm text-slate-700">
                          <span className="font-medium">{FIELD_CONFIG.name.label} <span className="text-rose-500">*</span></span>
                          <p className="text-xs text-slate-500 mt-0.5">{FIELD_CONFIG.name.hint}</p>
                          <input
                            value={form.name || ""}
                            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                            placeholder={FIELD_CONFIG.name.placeholder}
                            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                          />
                        </label>

                        <label className="text-sm text-slate-700">
                          <span className="font-medium">{FIELD_CONFIG.category.label} <span className="text-rose-500">*</span></span>
                          <p className="text-xs text-slate-500 mt-0.5">{FIELD_CONFIG.category.hint}</p>
                          <select
                            value={form.category || ""}
                            onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                          >
                            {categoryOptions.map((category) => (
                              <option key={`form-${category.value}`} value={category.value}>
                                {category.label}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="text-sm text-slate-700">
                          <span className="font-medium">{FIELD_CONFIG.framework.label} <span className="text-rose-500">*</span></span>
                          <p className="text-xs text-slate-500 mt-0.5">{FIELD_CONFIG.framework.hint}</p>
                          <select
                            value={form.framework}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                framework: e.target.value,
                                platform: e.target.value,
                              }))
                            }
                            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                          >
                            {FRAMEWORK_OPTIONS.map((framework) => (
                              <option key={`form-${framework.value}`} value={framework.value}>
                                {framework.value}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="text-sm text-slate-700">
                          <span className="font-medium">{FIELD_CONFIG.platform.label} <span className="text-rose-500">*</span></span>
                          <p className="text-xs text-slate-500 mt-0.5">{FIELD_CONFIG.platform.hint}</p>
                          <input
                            value={form.platform || ""}
                            onChange={(e) => setForm((prev) => ({ ...prev, platform: e.target.value }))}
                            placeholder={FIELD_CONFIG.platform.placeholder}
                            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                          />
                        </label>

                        <label className="text-sm text-slate-700 flex items-start gap-2 md:col-span-2">
                          <input
                            type="checkbox"
                            checked={!!form.isDefaultFavorite}
                            onChange={(e) =>
                              setForm((prev) => ({ ...prev, isDefaultFavorite: e.target.checked }))
                            }
                            className="mt-1"
                          />
                          <span>
                            <span className="font-medium">Favorito por defecto</span>
                            <p className="text-xs text-slate-500">Muestra la task en sección de favoritos.</p>
                          </span>
                        </label>

                        <div className="text-sm text-slate-700 md:col-span-2">
                          <span className="font-medium">{FIELD_CONFIG.icon.label} <span className="text-rose-500">*</span></span>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Selecciona un icono visual o escribe uno manualmente.
                          </p>

                          <div className="mt-1.5 grid grid-cols-7 gap-1.5">
                            {ICON_OPTIONS.map((iconName) => {
                              const isSelected = form.icon === iconName;
                              return (
                                <button
                                  key={iconName}
                                  type="button"
                                  onClick={() => setForm((prev) => ({ ...prev, icon: iconName }))}
                                  className={`h-10 rounded-lg border flex items-center justify-center transition ${
                                    isSelected
                                      ? "border-blue-500 bg-blue-50 text-blue-700"
                                      : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
                                  }`}
                                  title={iconName}
                                >
                                  <span className="material-symbols-outlined text-lg">{iconName}</span>
                                </button>
                              );
                            })}
                          </div>

                          <div className="mt-2 flex items-center gap-2">
                            <input
                              value={form.icon || ""}
                              onChange={(e) => setForm((prev) => ({ ...prev, icon: e.target.value }))}
                              placeholder={FIELD_CONFIG.icon.placeholder}
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                            />
                            <span className="h-10 w-10 rounded-lg border border-slate-300 bg-white flex items-center justify-center text-slate-700">
                              <span className="material-symbols-outlined text-lg">
                                {form.icon || "extension"}
                              </span>
                            </span>
                          </div>
                        </div>
                        </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                        <h4 className="text-sm font-semibold text-slate-800 mb-2">2) Configuración del operador</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <label className="text-sm text-slate-700">
                          <span className="font-medium">{FIELD_CONFIG.template.label} <span className="text-rose-500">*</span></span>
                          <p className="text-xs text-slate-500 mt-0.5">{FIELD_CONFIG.template.hint}</p>
                          <input
                            value={form.template || ""}
                            onChange={(e) => setForm((prev) => ({ ...prev, template: e.target.value }))}
                            placeholder={FIELD_CONFIG.template.placeholder}
                            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                          />
                        </label>

                        <label className="text-sm text-slate-700">
                          <span className="font-medium">{FIELD_CONFIG.type.label} <span className="text-rose-500">*</span></span>
                          <p className="text-xs text-slate-500 mt-0.5">{FIELD_CONFIG.type.hint}</p>
                          <input
                            value={form.type || ""}
                            onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}
                            placeholder={FIELD_CONFIG.type.placeholder}
                            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                          />
                        </label>

                        <label className="text-sm text-slate-700 md:col-span-2">
                          <span className="font-medium">{FIELD_CONFIG.description.label} <span className="text-rose-500">*</span></span>
                          <p className="text-xs text-slate-500 mt-0.5">{FIELD_CONFIG.description.hint}</p>
                          <input
                            value={form.description || ""}
                            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                            placeholder={FIELD_CONFIG.description.placeholder}
                            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                          />
                        </label>

                        <label className="text-sm text-slate-700 md:col-span-2">
                          <span className="font-medium">Import literal</span>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Import exacto de Python usado al exportar.
                          </p>
                          <input
                            value={form.importLiteral || ""}
                            onChange={(e) => setForm((prev) => ({ ...prev, importLiteral: e.target.value }))}
                            placeholder="from airflow.operators.bash import BashOperator"
                            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                          />
                        </label>

                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900">Parámetros de ejecución</h4>
                        <p className="text-xs text-slate-500">
                          `task_id` es obligatorio para tasks normales. En nodos raíz (`DAG`/`ArgoWorkflow`) es opcional.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={addParameter}
                        className="text-xs px-3 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200"
                      >
                        Añadir parámetro
                      </button>
                    </div>

                    <div className="mt-3 space-y-3">
                      {parameterRows.map((row, index) => {
                        const isTaskId = row.key === "task_id";
                        return (
                          <div
                            key={row.rowId || `${row.key || "row"}-${index}`}
                            className="rounded-xl border border-slate-200 p-3 bg-slate-50"
                          >
                            <div className="overflow-x-auto">
                              <div className="min-w-[920px] grid grid-cols-[1.2fr_140px_1fr_1.4fr_42px] gap-2 items-end">
                                <label className="text-xs text-slate-600">
                                Nombre del parámetro <span className="text-rose-500">*</span>
                                <input
                                  placeholder="retries"
                                  value={row.key}
                                  disabled={isTaskId}
                                  onChange={(e) => updateParameter(index, { key: e.target.value })}
                                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 disabled:bg-slate-100"
                                />
                                </label>
                                <label className="text-xs text-slate-600">
                                Tipo <span className="text-rose-500">*</span>
                                <select
                                  value={row.type}
                                  onChange={(e) => updateParameter(index, { type: e.target.value })}
                                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2"
                                >
                                  <option value="string">string</option>
                                  <option value="integer">integer</option>
                                  <option value="boolean">boolean</option>
                                  <option value="array">array</option>
                                  <option value="object">object</option>
                                  <option value="number">number</option>
                                </select>
                                </label>
                                <label className="text-xs text-slate-600">
                                Valor por defecto
                                <input
                                  placeholder="3"
                                  value={row.defaultValue}
                                  onChange={(e) => updateParameter(index, { defaultValue: e.target.value })}
                                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2"
                                />
                                </label>
                                <label className="text-xs text-slate-600">
                                Hint / descripción
                                <input
                                  placeholder="Número de reintentos"
                                  value={row.description}
                                  onChange={(e) => updateParameter(index, { description: e.target.value })}
                                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2"
                                />
                                </label>
                                <button
                                  type="button"
                                  disabled={isTaskId}
                                  onClick={() => removeParameter(index)}
                                  className="h-10 w-10 rounded-lg px-2 bg-rose-100 text-rose-700 disabled:opacity-50"
                                  title="Eliminar parámetro"
                                >
                                  <span className="material-symbols-outlined text-base">delete</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={saving}
                      className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                      {formMode === "create" ? "Guardar nueva task" : "Guardar cambios"}
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
