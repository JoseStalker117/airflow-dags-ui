import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { categoryAPI, taskAPI } from "../services/api";
import {
  COLOR_KEY_OPTIONS,
  getCategoryChipClass,
  getColorHexByKey,
  invalidateCategoriesCache,
} from "../services/categoriesService";

const defaultCategory = {
  id: "",
  label: "",
  framework: "all",
  icon: "folder",
  colorKey: "slate",
  order: 999,
  showInDefaultFavorites: false,
  isActive: true,
};

const frameworkOptions = [
  { value: "all", label: "Global (all)" },
  { value: "airflow", label: "Airflow" },
  { value: "argo", label: "Argo" },
];

const CATEGORY_ICON_OPTIONS = [
  "folder",
  "star",
  "account_tree",
  "hub",
  "extension",
  "cloud",
  "storage",
  "swap_horiz",
  "code",
  "table_rows",
  "sensors",
  "play_arrow",
  "more_horiz",
  "category",
  "settings",
  "bolt",
];

export default function AdminCategoriesPanel({ isOpen, onClose, onSaved }) {
  const [categories, setCategories] = useState([]);
  const [persistedCategoryIds, setPersistedCategoryIds] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [formMode, setFormMode] = useState("create");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(defaultCategory);
  const selectedColorHex = useMemo(() => getColorHexByKey(form.colorKey || "slate"), [form.colorKey]);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [categoriesRes, tasksRes] = await Promise.all([
        categoryAPI.getAllAdmin(),
        taskAPI.getAllAdmin(),
      ]);

      const persisted = Array.isArray(categoriesRes.data) ? categoriesRes.data : [];
      const persistedIds = new Set(persisted.map((item) => item.id));
      setPersistedCategoryIds(persistedIds);

      const tasks = Array.isArray(tasksRes.data) ? tasksRes.data : [];
      const inferredFromTasks = [...new Set(tasks.map((task) => task.category).filter(Boolean))]
        .filter((categoryId) => !persistedIds.has(categoryId))
        .map((categoryId, index) => ({
          id: categoryId,
          label: categoryId,
          framework: "all",
          icon: "folder",
          colorKey: "slate",
          order: 900 + index,
          showInDefaultFavorites: false,
          isActive: true,
          _inferred: true,
        }));

      setCategories([...persisted, ...inferredFromTasks]);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "No se pudieron cargar las categorías");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    fetchCategories();
  }, [fetchCategories, isOpen]);

  const filteredCategories = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return categories.filter((item) => {
      if (!query) return true;
      return [item.id, item.label, item.framework, item.icon]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [categories, searchTerm]);

  const resetForm = useCallback(() => {
    setFormMode("create");
    setEditingId(null);
    setForm(defaultCategory);
    setError(null);
  }, []);

  const startEdit = useCallback((category) => {
    const categoryExistsInCollection = persistedCategoryIds.has(category.id);
    setFormMode(categoryExistsInCollection ? "edit" : "create");
    setEditingId(categoryExistsInCollection ? category.id : null);
    setForm({
      id: category.id || "",
      label: category.label || "",
      framework: category.framework || "all",
      icon: category.icon || "folder",
      colorKey: category.colorKey || "slate",
      order: Number(category.order ?? 999),
      showInDefaultFavorites: !!category.showInDefaultFavorites,
      isActive: category.isActive !== false,
    });
    setError(null);
  }, [persistedCategoryIds]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      if (!String(form.id || "").trim()) throw new Error("El ID es obligatorio");
      if (!String(form.label || "").trim()) throw new Error("El nombre es obligatorio");

      const payload = {
        id: String(form.id).trim(),
        label: String(form.label).trim(),
        framework: form.framework || "all",
        icon: String(form.icon || "folder").trim() || "folder",
        colorKey: form.colorKey || "slate",
        order: Number.isFinite(Number(form.order)) ? Number(form.order) : 999,
        showInDefaultFavorites: !!form.showInDefaultFavorites,
        isActive: form.isActive !== false,
      };

      if (formMode === "create") {
        await categoryAPI.create(payload.id, payload);
      } else {
        await categoryAPI.update(editingId, payload);
      }

      invalidateCategoriesCache();
      await fetchCategories();
      onSaved?.();
      if (formMode === "create") resetForm();
    } catch (err) {
      setError(err.response?.data?.error || err.message || "No se pudo guardar la categoría");
    } finally {
      setSaving(false);
    }
  }, [editingId, fetchCategories, form, formMode, onSaved, resetForm]);

  const handleDelete = useCallback(
    async (categoryId) => {
      if (!window.confirm(`¿Desactivar categoría "${categoryId}"?`)) return;
      setSaving(true);
      setError(null);
      try {
        await categoryAPI.delete(categoryId);
        invalidateCategoriesCache();
        await fetchCategories();
        onSaved?.();
        if (editingId === categoryId) resetForm();
      } catch (err) {
        setError(err.response?.data?.error || err.message || "No se pudo desactivar la categoría");
      } finally {
        setSaving(false);
      }
    },
    [editingId, fetchCategories, onSaved, resetForm],
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <div onClick={onClose} className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-[3200]" />
          <div className="fixed inset-0 z-[3300] p-2 sm:p-4 lg:p-6">
            <div className="h-full rounded-2xl border border-slate-200 bg-slate-50 shadow-2xl overflow-hidden flex flex-col">
              <div className="bg-white border-b border-slate-200 px-4 py-3 sm:px-5 sm:py-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Organizar Categorías</h2>
                  <p className="text-xs sm:text-sm text-slate-500">
                    Crea secciones, define icono, color, orden y favoritos por defecto.
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

              {error && (
                <div className="mx-4 mt-3 sm:mx-5 px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm">
                  {error}
                </div>
              )}

              <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[360px_1fr]">
                <div className="border-r border-slate-200 bg-white min-h-0 flex flex-col">
                  <div className="p-3 sm:p-4 border-b border-slate-200 space-y-3">
                    <input
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Buscar categorías"
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={fetchCategories}
                        className="rounded-lg bg-slate-100 text-slate-700 text-xs px-3 py-2 hover:bg-slate-200"
                      >
                        Refrescar
                      </button>
                      <button
                        type="button"
                        onClick={resetForm}
                        className="rounded-lg bg-blue-600 text-white text-xs px-3 py-2 hover:bg-blue-700"
                      >
                        Nueva categoría
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
                    {loading && <div className="text-sm text-slate-500">Cargando categorías...</div>}

                    {!loading &&
                      filteredCategories.map((category) => (
                        <article
                          key={category.id}
                          className={`rounded-xl border p-3 transition ${
                            editingId === category.id
                              ? "border-blue-300 bg-blue-50"
                              : "border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-base text-slate-600">
                                  {category.icon || "folder"}
                                </span>
                                <p className="text-sm font-semibold text-slate-900 truncate">
                                  {category.label || category.id}
                                </p>
                              </div>
                              <p className="text-xs text-slate-600 truncate">{category.id}</p>
                              <div className="mt-1">
                                <span
                                  className={`text-[11px] px-2 py-0.5 rounded border ${getCategoryChipClass(
                                    category.id,
                                    { [category.id]: category },
                                  )}`}
                                >
                                  {category.framework || "all"} · order {category.order ?? 999}
                                </span>
                                {!!category._inferred && (
                                  <span className="ml-1 text-[10px] px-2 py-0.5 rounded bg-amber-100 text-amber-700">
                                    detectada en tasks
                                  </span>
                                )}
                              </div>
                            </div>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full ${
                                category.isActive === false
                                  ? "bg-rose-100 text-rose-700"
                                  : "bg-emerald-100 text-emerald-700"
                              }`}
                            >
                              {category.isActive === false ? "inactiva" : "activa"}
                            </span>
                          </div>
                          <div className="mt-2 flex gap-2">
                            <button
                              type="button"
                              onClick={() => startEdit(category)}
                              className="text-xs px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(category.id)}
                              className="text-xs px-2.5 py-1.5 rounded-lg bg-rose-100 text-rose-700 hover:bg-rose-200"
                            >
                              Desactivar
                            </button>
                          </div>
                        </article>
                      ))}
                  </div>
                </div>

                <div className="min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                    <h3 className="text-base font-semibold text-slate-900">
                      {formMode === "create" ? "Crear nueva categoría" : `Editando: ${editingId}`}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Esta configuración se reflejará en paleta, filtros y estilos por categoría.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <label className="text-sm text-slate-700 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                      <span className="font-medium">ID técnico</span>
                      <input
                        value={form.id}
                        disabled={formMode === "edit"}
                        onChange={(e) => setForm((prev) => ({ ...prev, id: e.target.value }))}
                        placeholder="mi_categoria"
                        className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 disabled:bg-slate-100"
                      />
                    </label>

                    <label className="text-sm text-slate-700 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                      <span className="font-medium">Nombre visible</span>
                      <input
                        value={form.label}
                        onChange={(e) => setForm((prev) => ({ ...prev, label: e.target.value }))}
                        placeholder="Mi sección"
                        className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                      />
                    </label>

                    <label className="text-sm text-slate-700 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                      <span className="font-medium">Framework</span>
                      <select
                        value={form.framework}
                        onChange={(e) => setForm((prev) => ({ ...prev, framework: e.target.value }))}
                        className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                      >
                        {frameworkOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="text-sm text-slate-700 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                      <span className="font-medium">Orden</span>
                      <input
                        type="number"
                        value={form.order}
                        onChange={(e) => setForm((prev) => ({ ...prev, order: e.target.value }))}
                        className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                      />
                    </label>

                    <div className="text-sm text-slate-700 rounded-xl border border-slate-200 bg-slate-50/70 p-3 lg:col-span-2">
                      <span className="font-medium">Icono</span>
                      <p className="text-xs text-slate-500 mt-0.5">Selecciona un icono visual o escribe uno manual.</p>
                      <div className="mt-2 grid grid-cols-8 sm:grid-cols-10 gap-1.5">
                        {CATEGORY_ICON_OPTIONS.map((iconName) => {
                          const selected = form.icon === iconName;
                          return (
                            <button
                              key={iconName}
                              type="button"
                              onClick={() => setForm((prev) => ({ ...prev, icon: iconName }))}
                              className={`h-9 rounded-lg border flex items-center justify-center transition ${
                                selected
                                  ? "border-blue-500 bg-blue-50 text-blue-700"
                                  : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
                              }`}
                              title={iconName}
                            >
                              <span className="material-symbols-outlined text-[18px]">{iconName}</span>
                            </button>
                          );
                        })}
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          value={form.icon}
                          onChange={(e) => setForm((prev) => ({ ...prev, icon: e.target.value }))}
                          placeholder="folder"
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                        />
                        <span className="h-10 w-10 rounded-lg border border-slate-300 bg-white flex items-center justify-center text-slate-700">
                          <span className="material-symbols-outlined text-lg">{form.icon || "folder"}</span>
                        </span>
                      </div>
                    </div>

                    <div className="text-sm text-slate-700 rounded-xl border border-slate-200 bg-slate-50/70 p-3 lg:col-span-2">
                      <span className="font-medium">Color</span>
                      <p className="text-xs text-slate-500 mt-0.5">Usa la paleta para seleccionar el color de la categoría.</p>
                      <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2">
                        {COLOR_KEY_OPTIONS.map((color) => {
                          const isSelected = form.colorKey === color;
                          const colorHex = getColorHexByKey(color);
                          return (
                            <button
                              key={color}
                              type="button"
                              onClick={() => setForm((prev) => ({ ...prev, colorKey: color }))}
                              className={`rounded-lg border px-2 py-1.5 flex items-center gap-2 text-xs text-left transition ${
                                isSelected
                                  ? "border-blue-500 bg-blue-50 text-blue-700"
                                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                              }`}
                              title={color}
                            >
                              <span
                                className="w-4 h-4 rounded-full border border-white shadow-sm"
                                style={{ backgroundColor: colorHex }}
                              />
                              <span className="truncate">{color}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
                    <label className="text-sm text-slate-700 flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={!!form.showInDefaultFavorites}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, showInDefaultFavorites: e.target.checked }))
                        }
                        className="mt-1"
                      />
                      <span>
                        <span className="font-medium">Favoritos por defecto</span>
                        <p className="text-xs text-slate-500">
                          Incluye automáticamente tasks de esta categoría en la sección de favoritos.
                        </p>
                      </span>
                    </label>

                    <label className="text-sm text-slate-700 flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={!!form.isActive}
                        onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                        className="mt-1"
                      />
                      <span>
                        <span className="font-medium">Categoría activa</span>
                        <p className="text-xs text-slate-500">
                          Solo categorías activas se muestran en la paleta de usuarios.
                        </p>
                      </span>
                    </label>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <span className="text-xs text-slate-500">Vista rápida de color</span>
                    <div className="mt-2 flex items-center gap-2">
                      <span
                        className="inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded border border-slate-200 bg-white text-slate-600"
                      >
                        <span
                          className="w-3 h-3 rounded-full border border-white shadow-sm"
                          style={{ backgroundColor: selectedColorHex }}
                        />
                        {form.colorKey || "slate"} · {selectedColorHex}
                      </span>
                      <span
                        className={`text-xs px-2 py-1 rounded border ${getCategoryChipClass(
                          form.id || "others",
                          { [form.id || "others"]: form },
                        )}`}
                      >
                        {form.label || form.id || "Nueva categoría"}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={saving}
                      className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                      {formMode === "create" ? "Guardar categoría" : "Guardar cambios"}
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
