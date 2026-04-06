import { categoryAPI, styleAPI } from "./api";

const CATEGORY_CACHE_TTL_MS = 60 * 1000 * 5;
let categoriesCache = null;
let stylesCache = null;
const LS_KEYS = {
  categories: "dagger_cache_categories_v1",
  styles: "dagger_cache_styles_v1",
};

export const COLOR_KEY_OPTIONS = [
  "slate",
  "gray",
  "red",
  "orange",
  "amber",
  "yellow",
  "lime",
  "green",
  "emerald",
  "teal",
  "cyan",
  "sky",
  "blue",
  "indigo",
  "violet",
  "purple",
  "fuchsia",
  "pink",
  "rose",
];

const DEFAULT_COLOR_KEY_TO_STYLE = {
  slate: { chip: "border-slate-300 bg-slate-50 text-slate-700", card: "border-l-slate-500 bg-slate-50/50" },
  gray: { chip: "border-gray-300 bg-gray-50 text-gray-700", card: "border-l-gray-500 bg-gray-50/50" },
  red: { chip: "border-red-300 bg-red-50 text-red-700", card: "border-l-red-500 bg-red-50/35" },
  orange: { chip: "border-orange-300 bg-orange-50 text-orange-700", card: "border-l-orange-500 bg-orange-50/35" },
  amber: { chip: "border-amber-300 bg-amber-50 text-amber-700", card: "border-l-amber-500 bg-amber-50/35" },
  yellow: { chip: "border-yellow-300 bg-yellow-50 text-yellow-700", card: "border-l-yellow-500 bg-yellow-50/35" },
  lime: { chip: "border-lime-300 bg-lime-50 text-lime-700", card: "border-l-lime-500 bg-lime-50/35" },
  green: { chip: "border-green-300 bg-green-50 text-green-700", card: "border-l-green-500 bg-green-50/35" },
  emerald: { chip: "border-emerald-300 bg-emerald-50 text-emerald-700", card: "border-l-emerald-500 bg-emerald-50/35" },
  teal: { chip: "border-teal-300 bg-teal-50 text-teal-700", card: "border-l-teal-500 bg-teal-50/35" },
  cyan: { chip: "border-cyan-300 bg-cyan-50 text-cyan-700", card: "border-l-cyan-500 bg-cyan-50/35" },
  sky: { chip: "border-sky-300 bg-sky-50 text-sky-700", card: "border-l-sky-500 bg-sky-50/35" },
  blue: { chip: "border-blue-300 bg-blue-50 text-blue-700", card: "border-l-blue-500 bg-blue-50/35" },
  indigo: { chip: "border-indigo-300 bg-indigo-50 text-indigo-700", card: "border-l-indigo-500 bg-indigo-50/35" },
  violet: { chip: "border-violet-300 bg-violet-50 text-violet-700", card: "border-l-violet-500 bg-violet-50/35" },
  purple: { chip: "border-purple-300 bg-purple-50 text-purple-700", card: "border-l-purple-500 bg-purple-50/35" },
  fuchsia: { chip: "border-fuchsia-300 bg-fuchsia-50 text-fuchsia-700", card: "border-l-fuchsia-500 bg-fuchsia-50/35" },
  pink: { chip: "border-pink-300 bg-pink-50 text-pink-700", card: "border-l-pink-500 bg-pink-50/35" },
  rose: { chip: "border-rose-300 bg-rose-50 text-rose-700", card: "border-l-rose-500 bg-rose-50/35" },
};

const DEFAULT_COLOR_KEY_TO_HEX = {
  slate: "#64748b",
  gray: "#6b7280",
  red: "#ef4444",
  orange: "#f97316",
  amber: "#f59e0b",
  yellow: "#eab308",
  lime: "#84cc16",
  green: "#22c55e",
  emerald: "#10b981",
  teal: "#14b8a6",
  cyan: "#06b6d4",
  sky: "#0ea5e9",
  blue: "#3b82f6",
  indigo: "#6366f1",
  violet: "#8b5cf6",
  purple: "#a855f7",
  fuchsia: "#d946ef",
  pink: "#ec4899",
  rose: "#f43f5e",
};

let colorKeyToStyle = { ...DEFAULT_COLOR_KEY_TO_STYLE };
let colorKeyToHex = { ...DEFAULT_COLOR_KEY_TO_HEX };

const defaultCategories = [
  { id: "common", label: "Favoritos", framework: "all", icon: "star", colorKey: "amber", order: 0, showInDefaultFavorites: false, isActive: true },
  { id: "airflow", label: "Airflow", framework: "airflow", icon: "account_tree", colorKey: "blue", order: 10, showInDefaultFavorites: false, isActive: true },
  { id: "argo", label: "Argo", framework: "argo", icon: "hub", colorKey: "indigo", order: 10, showInDefaultFavorites: false, isActive: true },
  { id: "util", label: "Utilidades", framework: "all", icon: "extension", colorKey: "emerald", order: 20, showInDefaultFavorites: false, isActive: true },
  { id: "google_cloud", label: "Google Cloud", framework: "all", icon: "cloud", colorKey: "sky", order: 30, showInDefaultFavorites: false, isActive: true },
  { id: "database", label: "Databases", framework: "all", icon: "storage", colorKey: "teal", order: 40, showInDefaultFavorites: false, isActive: true },
  { id: "transfer", label: "SFTP / Transfer", framework: "all", icon: "swap_horiz", colorKey: "orange", order: 50, showInDefaultFavorites: false, isActive: true },
  { id: "python", label: "Python", framework: "airflow", icon: "code", colorKey: "violet", order: 60, showInDefaultFavorites: false, isActive: true },
  { id: "sql", label: "SQL", framework: "airflow", icon: "table_rows", colorKey: "cyan", order: 70, showInDefaultFavorites: false, isActive: true },
  { id: "sensors", label: "Sensors", framework: "airflow", icon: "sensors", colorKey: "pink", order: 80, showInDefaultFavorites: false, isActive: true },
  { id: "steps", label: "Steps", framework: "argo", icon: "play_arrow", colorKey: "lime", order: 60, showInDefaultFavorites: false, isActive: true },
  { id: "workflow", label: "Workflow", framework: "argo", icon: "account_tree", colorKey: "fuchsia", order: 70, showInDefaultFavorites: false, isActive: true },
  { id: "others", label: "Otros", framework: "all", icon: "more_horiz", colorKey: "slate", order: 999, showInDefaultFavorites: false, isActive: true },
];

function readLocalCache(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeLocalCache(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // noop: localStorage puede no estar disponible o lleno
  }
}

function clearLocalCache(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // noop
  }
}

export async function fetchCategories(options = {}) {
  const { forceRefresh = false } = options;
  const now = Date.now();
  if (!forceRefresh && categoriesCache && categoriesCache.expiresAt > now) {
    return categoriesCache.data;
  }

  if (!forceRefresh) {
    const stored = readLocalCache(LS_KEYS.categories);
    if (stored?.expiresAt > now && Array.isArray(stored?.data)) {
      categoriesCache = stored;
      return stored.data;
    }
  }

  try {
    await fetchStyles({ forceRefresh });
    const { data } = await categoryAPI.getAll();
    const normalized = Array.isArray(data) && data.length > 0 ? data : defaultCategories;
    const nextCache = {
      data: normalized,
      expiresAt: now + CATEGORY_CACHE_TTL_MS,
    };
    categoriesCache = nextCache;
    writeLocalCache(LS_KEYS.categories, nextCache);
    return normalized;
  } catch {
    return defaultCategories;
  }
}

export async function fetchCategoriesAdmin() {
  await fetchStyles();
  const { data } = await categoryAPI.getAllAdmin();
  const normalized = Array.isArray(data) ? data : [];
  return normalized;
}

export function invalidateCategoriesCache() {
  categoriesCache = null;
  clearLocalCache(LS_KEYS.categories);
}

export function buildCategoryMetaMap(categories = []) {
  const map = {};
  categories.forEach((category) => {
    if (!category?.id) return;
    map[category.id] = category;
  });
  return map;
}

export function getCategoriesForFramework(categories = [], framework = "airflow") {
  return categories
    .filter((category) => category?.isActive !== false)
    .filter((category) => ["all", framework].includes(category.framework || "all"))
    .sort(
      (a, b) =>
        Number(a?.order ?? 999) - Number(b?.order ?? 999) ||
        String(a?.label || a?.id || "").localeCompare(String(b?.label || b?.id || "")),
    );
}

export function getCategoryCardClass(categoryId, categoryMetaMap = {}) {
  const colorKey = categoryMetaMap[categoryId]?.colorKey || "slate";
  return (colorKeyToStyle[colorKey] || colorKeyToStyle.slate || DEFAULT_COLOR_KEY_TO_STYLE.slate).card;
}

export function getCategoryChipClass(categoryId, categoryMetaMap = {}) {
  const colorKey = categoryMetaMap[categoryId]?.colorKey || "slate";
  return (colorKeyToStyle[colorKey] || colorKeyToStyle.slate || DEFAULT_COLOR_KEY_TO_STYLE.slate).chip;
}

export function getColorHexByKey(colorKey = "slate") {
  return colorKeyToHex[colorKey] || colorKeyToHex.slate || DEFAULT_COLOR_KEY_TO_HEX.slate;
}

export function getCategoryColorKey(categoryId, categoryMetaMap = {}) {
  return categoryMetaMap[categoryId]?.colorKey || "slate";
}

export function getCategoryColorHex(categoryId, categoryMetaMap = {}) {
  const colorKey = getCategoryColorKey(categoryId, categoryMetaMap);
  return getColorHexByKey(colorKey);
}

function normalizeStylePalette(styles = []) {
  if (!Array.isArray(styles) || styles.length === 0) {
    return {
      styleMap: { ...DEFAULT_COLOR_KEY_TO_STYLE },
      hexMap: { ...DEFAULT_COLOR_KEY_TO_HEX },
    };
  }

  const styleMap = { ...DEFAULT_COLOR_KEY_TO_STYLE };
  const hexMap = { ...DEFAULT_COLOR_KEY_TO_HEX };

  styles.forEach((item) => {
    const id = String(item?.id || "").trim();
    if (!id) return;
    const chip = String(item?.chip || "").trim();
    const card = String(item?.card || "").trim();
    const hex = String(item?.hex || "").trim();

    if (chip || card) {
      styleMap[id] = {
        chip: chip || (styleMap[id]?.chip || DEFAULT_COLOR_KEY_TO_STYLE.slate.chip),
        card: card || (styleMap[id]?.card || DEFAULT_COLOR_KEY_TO_STYLE.slate.card),
      };
    }
    if (hex) {
      hexMap[id] = hex;
    }
  });

  return { styleMap, hexMap };
}

function applyStylePalette(stylePalette) {
  const nextStyles = stylePalette?.styleMap || DEFAULT_COLOR_KEY_TO_STYLE;
  const nextHex = stylePalette?.hexMap || DEFAULT_COLOR_KEY_TO_HEX;
  colorKeyToStyle = { ...nextStyles };
  colorKeyToHex = { ...nextHex };
}

export async function fetchStyles(options = {}) {
  const { forceRefresh = false } = options;
  const now = Date.now();

  if (!forceRefresh && stylesCache && stylesCache.expiresAt > now) {
    applyStylePalette(stylesCache.palette);
    return stylesCache.data;
  }

  if (!forceRefresh) {
    const stored = readLocalCache(LS_KEYS.styles);
    if (stored?.expiresAt > now && stored?.palette) {
      stylesCache = stored;
      applyStylePalette(stored.palette);
      return Array.isArray(stored.data) ? stored.data : [];
    }
  }

  try {
    const { data } = await styleAPI.getAll();
    const normalized = Array.isArray(data) ? data : [];
    const palette = normalizeStylePalette(normalized);
    const nextCache = {
      data: normalized,
      palette,
      expiresAt: now + CATEGORY_CACHE_TTL_MS,
    };
    stylesCache = nextCache;
    applyStylePalette(nextCache.palette);
    writeLocalCache(LS_KEYS.styles, nextCache);
    return normalized;
  } catch {
    const fallbackCache = {
      data: [],
      palette: normalizeStylePalette([]),
      expiresAt: now + CATEGORY_CACHE_TTL_MS,
    };
    stylesCache = fallbackCache;
    applyStylePalette(fallbackCache.palette);
    writeLocalCache(LS_KEYS.styles, fallbackCache);
    return [];
  }
}

export function invalidateStylesCache() {
  stylesCache = null;
  clearLocalCache(LS_KEYS.styles);
  applyStylePalette(normalizeStylePalette([]));
}
