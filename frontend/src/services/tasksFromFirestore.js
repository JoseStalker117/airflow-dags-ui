/**
 * Servicio para obtener bloques de tareas desde Firestore (vía API).
 * Reemplaza la lectura desde JSON estático; los cambios en cloud se reflejan para todos los usuarios.
 */

import { taskAPI } from './api';

const FRAMEWORKS = ['airflow', 'argo'];
const TASKS_CACHE_TTL_MS = 60 * 1000 * 10; // 60s
const tasksCache = new Map();
const TASKS_LS_PREFIX = "dagger_cache_tasks_v1_";

function readTasksLocalCache(cacheKey) {
  try {
    const raw = localStorage.getItem(`${TASKS_LS_PREFIX}${cacheKey}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeTasksLocalCache(cacheKey, payload) {
  try {
    localStorage.setItem(`${TASKS_LS_PREFIX}${cacheKey}`, JSON.stringify(payload));
  } catch {
    // noop
  }
}

function clearTasksLocalCache(cacheKey = null) {
  try {
    if (cacheKey) {
      localStorage.removeItem(`${TASKS_LS_PREFIX}${cacheKey}`);
      return;
    }
    ["all", ...FRAMEWORKS].forEach((fw) => {
      localStorage.removeItem(`${TASKS_LS_PREFIX}${fw}`);
    });
  } catch {
    // noop
  }
}

/**
 * Convierte un documento de task de Firestore al formato de bloque del palette/canvas.
 * @param {Object} doc - { id, ...taskData } desde la API
 * @returns {Object} block shape: { id, label, type, icon, category, description, parameters, framework, isDefaultFavorite }
 */
export function taskDocToBlock(doc) {
  return {
    id: doc.id,
    label: doc.name ?? doc.label ?? doc.id,
    type: doc.type ?? 'PythonOperator',
    icon: doc.icon ?? 'extension',
    category: doc.category ?? 'others',
    description: doc.description ?? '',
    
    // ⭐ CAMBIO IMPORTANTE: Renombrar a parameterDefinitions
    parameterDefinitions: doc.parameters ?? {},
    importLiteral: doc.importLiteral ?? null,
    imports: doc.imports ?? null,
    operatorImport: doc.operatorImport ?? null,
    
    framework: doc.framework ?? 'airflow',
    platform: doc.platform ?? doc.framework ?? 'airflow',
    template: doc.template ?? doc.type ?? 'default',
    isDefaultFavorite: doc.isDefaultFavorite ?? false,
    isActive: doc.isActive ?? true,
  };
}

/**
 * Obtiene todas las tasks activas desde la API (Firestore).
 * @param {string} [framework] - 'airflow' | 'argo' para filtrar
 * @returns {Promise<Object[]>} array de bloques en formato palette
 */
export async function fetchTaskBlocks(framework = null, options = {}) {
  const { forceRefresh = false } = options;
  const cacheKey = framework && FRAMEWORKS.includes(framework) ? framework : 'all';
  const now = Date.now();
  const cached = tasksCache.get(cacheKey);

  if (!forceRefresh && cached && cached.expiresAt > now) {
    return cached.data;
  }

  if (!forceRefresh) {
    const stored = readTasksLocalCache(cacheKey);
    if (stored?.expiresAt > now && Array.isArray(stored?.data)) {
      tasksCache.set(cacheKey, stored);
      return stored.data;
    }
  }

  const config = framework && FRAMEWORKS.includes(framework) ? { params: { framework } } : {};
  const { data } = await taskAPI.getAll(config);
  const mapped = Array.isArray(data) ? data.map(taskDocToBlock) : [];
  const nextCache = { data: mapped, expiresAt: now + TASKS_CACHE_TTL_MS };
  tasksCache.set(cacheKey, nextCache);
  writeTasksLocalCache(cacheKey, nextCache);
  return mapped;
}

export function invalidateTaskBlocksCache() {
  tasksCache.clear();
  clearTasksLocalCache();
}

/**
 * Agrupa bloques por framework y luego por categoría.
 * Incluye sección "Favoritos" (common) por framework con isDefaultFavorite.
 * @param {Object[]} blocks - bloques desde fetchTaskBlocks
 * @returns {Object} { airflow: { common: [], util: [], ... }, argo: { common: [], ... } }
 */
export function groupBlocksByFrameworkAndCategory(blocks, options = {}) {
  const {
    categoryMetaMap = {},
    userFavoriteTaskIds = [],
    hasCustomFavorites = false,
  } = options;
  const userFavoriteSet = new Set(
    (Array.isArray(userFavoriteTaskIds) ? userFavoriteTaskIds : [])
      .map((id) => String(id || "").trim())
      .filter(Boolean),
  );
  const grouped = { airflow: {}, argo: {} };
  FRAMEWORKS.forEach((fw) => {
    grouped[fw].common = []; // Favoritos
  });

  blocks.forEach((block) => {
    const fw = block.framework && FRAMEWORKS.includes(block.framework) ? block.framework : 'airflow';
    if (!grouped[fw][fw]) grouped[fw][fw] = [];
    const cat = block.category || 'others';
    if (!grouped[fw][cat]) grouped[fw][cat] = [];
    grouped[fw][cat].push(block);
    if (hasCustomFavorites) {
      if (userFavoriteSet.has(String(block.id || "").trim())) {
        grouped[fw].common.push({ ...block });
      }
    } else {
      const categoryMeta = categoryMetaMap[cat];
      const favoriteByCategory = !!categoryMeta?.showInDefaultFavorites;
      if (block.isDefaultFavorite || favoriteByCategory) grouped[fw].common.push({ ...block });
    }
  });

  return grouped;
}

/**
 * Obtiene bloques para el palette según framework seleccionado.
 * @param {Object[]} allBlocks - resultado de fetchTaskBlocks()
 * @param {string} framework - 'airflow' | 'argo'
 * @returns {Object} { categoryKey: blocks[] } con categoryKey incluyendo 'common' (Favoritos)
 */
export function getBlocksForPalette(allBlocks, framework, options = {}) {
  const grouped = groupBlocksByFrameworkAndCategory(allBlocks, options);
  const fw = FRAMEWORKS.includes(framework) ? framework : 'airflow';
  return grouped[fw] || {};
}

export { FRAMEWORKS };
