import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { taskAPI } from "../services/api";

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

const taskIdParameter = {
  key: "task_id",
  type: "string",
  defaultValue: "task_1",
  description: "ID único de la tarea",
};

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
    return [taskIdParameter, ...rows];
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

  if (!parameters.task_id) {
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
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [frameworkFilter, setFrameworkFilter] = useState("all");
  const [showInactive, setShowInactive] = useState(true);

  const [formMode, setFormMode] = useState("create");
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [form, setForm] = useState(defaultTask);
  const [parameterRows, setParameterRows] = useState([taskIdParameter]);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        includeInactive: showInactive ? "true" : "false",
      };
      if (frameworkFilter !== "all") {
        params.framework = frameworkFilter;
      }
      const { data } = await taskAPI.getAllAdmin({ params });
      setTasks(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "No se pudieron cargar las tasks");
    } finally {
      setLoading(false);
    }
  }, [frameworkFilter, showInactive]);

  useEffect(() => {
    if (!isOpen) return;
    fetchTasks();
  }, [isOpen, fetchTasks]);

  const visibleTasks = useMemo(() => {
    return [...tasks].sort((a, b) => String(a.id || "").localeCompare(String(b.id || "")));
  }, [tasks]);

  const resetForm = () => {
    setFormMode("create");
    setEditingTaskId(null);
    setForm(defaultTask);
    setParameterRows([taskIdParameter]);
    setError(null);
  };

  const startEdit = (task) => {
    setFormMode("edit");
    setEditingTaskId(task.id);
    setForm(normalizeToTask(task));
    setParameterRows(normalizeToRows(task.parameters));
    setError(null);
  };

  const updateParameter = (index, patch) => {
    setParameterRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );
  };

  const addParameter = () => {
    setParameterRows((prev) => [...prev, { ...defaultParameter }]);
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
      if (formMode === "create") {
        resetForm();
      }
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
      if (editingTaskId === taskId) {
        resetForm();
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || "No se pudo desactivar la task");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <div onClick={onClose} className="fixed inset-0 bg-slate-900/40 z-[3200]" />

          <div className="fixed inset-0 z-[3300] p-2 sm:p-4 lg:p-6">
            <div className="h-full bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800">Panel Admin de Tasks</h2>
                  <p className="text-xs text-slate-500">
                    CRUD de tasks en Firestore. Campos principales y parameters.task_id son obligatorios.
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-md hover:bg-gray-100 text-slate-600"
                  type="button"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center gap-3">
                <label className="text-xs text-slate-600">
                  Framework:
                  <select
                    value={frameworkFilter}
                    onChange={(e) => setFrameworkFilter(e.target.value)}
                    className="ml-2 border border-gray-300 rounded px-2 py-1 text-xs"
                  >
                    <option value="all">Todos</option>
                    <option value="airflow">Airflow</option>
                    <option value="argo">Argo</option>
                  </select>
                </label>
                <label className="text-xs text-slate-600 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showInactive}
                    onChange={(e) => setShowInactive(e.target.checked)}
                  />
                  Mostrar inactivas
                </label>
                <button
                  type="button"
                  onClick={fetchTasks}
                  className="text-xs px-3 py-1.5 rounded bg-slate-100 text-slate-700 hover:bg-slate-200"
                >
                  Refrescar
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs px-3 py-1.5 rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
                >
                  Nueva task
                </button>
              </div>

              {error && (
                <div className="mx-4 mt-3 px-3 py-2 rounded border border-red-200 bg-red-50 text-red-700 text-sm">
                  {error}
                </div>
              )}

              <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[360px_1fr]">
                <div className="border-r border-gray-100 overflow-y-auto">
                  {loading ? (
                    <div className="p-4 text-sm text-slate-500">Cargando tasks...</div>
                  ) : (
                    <div className="p-2 space-y-2">
                      {visibleTasks.map((task) => (
                        <div
                          key={task.id}
                          className={`rounded border p-3 ${
                            editingTaskId === task.id
                              ? "border-blue-300 bg-blue-50"
                              : "border-gray-200 bg-white"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-800 truncate">{task.id}</p>
                              <p className="text-xs text-slate-500 truncate">{task.name}</p>
                              <p className="text-[11px] text-slate-400">
                                {task.framework} · {task.type}
                              </p>
                            </div>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded ${
                                task.isActive === false
                                  ? "bg-red-100 text-red-700"
                                  : "bg-green-100 text-green-700"
                              }`}
                            >
                              {task.isActive === false ? "inactiva" : "activa"}
                            </span>
                          </div>
                          <div className="flex gap-2 mt-2">
                            <button
                              type="button"
                              onClick={() => startEdit(task)}
                              className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(task.id)}
                              className="text-xs px-2 py-1 rounded bg-red-100 text-red-700"
                            >
                              Desactivar
                            </button>
                          </div>
                        </div>
                      ))}
                      {!visibleTasks.length && (
                        <div className="p-4 text-sm text-slate-500">No hay tasks para el filtro actual.</div>
                      )}
                    </div>
                  )}
                </div>

                <div className="overflow-y-auto p-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {REQUIRED_FIELDS.map((field) => {
                      const isId = field === "id";
                      const isFramework = field === "framework";
                      return (
                        <label key={field} className="text-sm text-slate-700">
                          <span className="block text-xs font-semibold mb-1">
                            {field} <span className="text-red-500">*</span>
                          </span>
                          {isFramework ? (
                            <select
                              value={form.framework}
                              onChange={(e) =>
                                setForm((prev) => ({
                                  ...prev,
                                  framework: e.target.value,
                                  platform: e.target.value,
                                }))
                              }
                              className="w-full border border-gray-300 rounded px-3 py-2"
                            >
                              <option value="airflow">airflow</option>
                              <option value="argo">argo</option>
                            </select>
                          ) : (
                            <input
                              value={form[field] || ""}
                              disabled={isId && formMode === "edit"}
                              onChange={(e) =>
                                setForm((prev) => ({ ...prev, [field]: e.target.value }))
                              }
                              className="w-full border border-gray-300 rounded px-3 py-2 disabled:bg-gray-100"
                            />
                          )}
                        </label>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <label className="text-sm text-slate-700">
                      <span className="block text-xs font-semibold mb-1">importLiteral</span>
                      <input
                        value={form.importLiteral || ""}
                        onChange={(e) => setForm((prev) => ({ ...prev, importLiteral: e.target.value }))}
                        className="w-full border border-gray-300 rounded px-3 py-2"
                      />
                    </label>
                    <label className="text-sm text-slate-700 flex items-center gap-2 mt-6">
                      <input
                        type="checkbox"
                        checked={!!form.isDefaultFavorite}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, isDefaultFavorite: e.target.checked }))
                        }
                      />
                      Favorito por defecto
                    </label>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold text-slate-700">Parameters</h3>
                      <button
                        type="button"
                        onClick={addParameter}
                        className="text-xs px-3 py-1.5 rounded bg-slate-100 text-slate-700"
                      >
                        Añadir parámetro
                      </button>
                    </div>
                    <div className="space-y-2">
                      {parameterRows.map((row, index) => {
                        const isTaskId = row.key === "task_id";
                        return (
                          <div
                            key={`${row.key || "row"}-${index}`}
                            className="grid grid-cols-1 md:grid-cols-[1fr_140px_1fr_1.3fr_auto] gap-2 border border-gray-200 rounded p-2"
                          >
                            <input
                              placeholder="key"
                              value={row.key}
                              disabled={isTaskId}
                              onChange={(e) => updateParameter(index, { key: e.target.value })}
                              className="border border-gray-300 rounded px-2 py-1.5 disabled:bg-gray-100"
                            />
                            <select
                              value={row.type}
                              onChange={(e) => updateParameter(index, { type: e.target.value })}
                              className="border border-gray-300 rounded px-2 py-1.5"
                            >
                              <option value="string">string</option>
                              <option value="integer">integer</option>
                              <option value="boolean">boolean</option>
                              <option value="array">array</option>
                              <option value="object">object</option>
                              <option value="number">number</option>
                            </select>
                            <input
                              placeholder="default"
                              value={row.defaultValue}
                              onChange={(e) =>
                                updateParameter(index, { defaultValue: e.target.value })
                              }
                              className="border border-gray-300 rounded px-2 py-1.5"
                            />
                            <input
                              placeholder="description"
                              value={row.description}
                              onChange={(e) =>
                                updateParameter(index, { description: e.target.value })
                              }
                              className="border border-gray-300 rounded px-2 py-1.5"
                            />
                            <button
                              type="button"
                              disabled={isTaskId}
                              onClick={() => removeParameter(index)}
                              className="px-2 py-1.5 rounded bg-red-100 text-red-700 disabled:opacity-50"
                            >
                              <span className="material-symbols-outlined text-base">delete</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={saving}
                      className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                      {formMode === "create" ? "Crear task" : "Actualizar task"}
                    </button>
                    <button
                      type="button"
                      onClick={resetForm}
                      className="px-4 py-2 rounded bg-slate-100 text-slate-700"
                    >
                      Limpiar
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
