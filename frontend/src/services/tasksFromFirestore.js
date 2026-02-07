/**
 * Servicio para obtener bloques de tareas desde Firestore (vía API).
 * Reemplaza la lectura desde JSON estático; los cambios en cloud se reflejan para todos los usuarios.
 */

import { taskAPI } from './api';

const FRAMEWORKS = ['airflow', 'argo'];

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
    parameters: doc.parameters ?? {},
    framework: doc.framework ?? 'airflow',
    isDefaultFavorite: doc.isDefaultFavorite ?? false,
  };
}

/**
 * Obtiene todas las tasks activas desde la API (Firestore).
 * @param {string} [framework] - 'airflow' | 'argo' para filtrar
 * @returns {Promise<Object[]>} array de bloques en formato palette
 */
export async function fetchTaskBlocks(framework = null) {
  const config = framework && FRAMEWORKS.includes(framework) ? { params: { framework } } : {};
  const { data } = await taskAPI.getAll(config);
  return Array.isArray(data) ? data.map(taskDocToBlock) : [];
}

/**
 * Agrupa bloques por framework y luego por categoría.
 * Incluye sección "Favoritos" (common) por framework con isDefaultFavorite.
 * @param {Object[]} blocks - bloques desde fetchTaskBlocks
 * @returns {Object} { airflow: { common: [], util: [], ... }, argo: { common: [], ... } }
 */
export function groupBlocksByFrameworkAndCategory(blocks) {
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
    if (block.isDefaultFavorite) grouped[fw].common.push({ ...block });
  });

  return grouped;
}

/**
 * Obtiene bloques para el palette según framework seleccionado.
 * @param {Object[]} allBlocks - resultado de fetchTaskBlocks()
 * @param {string} framework - 'airflow' | 'argo'
 * @returns {Object} { categoryKey: blocks[] } con categoryKey incluyendo 'common' (Favoritos)
 */
export function getBlocksForPalette(allBlocks, framework) {
  const grouped = groupBlocksByFrameworkAndCategory(allBlocks);
  const fw = FRAMEWORKS.includes(framework) ? framework : 'airflow';
  return grouped[fw] || {};
}

export { FRAMEWORKS };
