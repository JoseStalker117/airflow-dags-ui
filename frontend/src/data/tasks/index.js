/**
 * Índice de todos los bloques de tareas disponibles
 * Airflow 2.4.0
 * Nueva estructura de categorías según jerarquía definida
 */

import { commonOperators } from "./commonOperators";
import { airflowOperators } from "./airflowOperators";
import { googleCloudOperators } from "./googleCloudOperators";
import { databaseOperators } from "./databaseOperators";
import { transferOperators } from "./transferOperators";

// Exportar todos los bloques como un array plano
export const allTaskBlocks = [
  ...commonOperators,
  ...airflowOperators,
  ...googleCloudOperators,
  ...databaseOperators,
  ...transferOperators
];

// Exportar agrupados por categoría (orden de visualización)
export const taskBlocksByCategory = {
  common: commonOperators,
  airflow: airflowOperators,
  google_cloud: googleCloudOperators,
  database: databaseOperators,
  transfer: transferOperators
};

// Exportar por tipo de operador
export const taskBlocksByType = allTaskBlocks.reduce((acc, block) => {
  const type = block.type;
  if (!acc[type]) {
    acc[type] = [];
  }
  acc[type].push(block);
  return acc;
}, {});

// Función helper para obtener un bloque por ID
export const getTaskBlockById = (id) => {
  return allTaskBlocks.find(block => block.id === id);
};

// Función helper para obtener bloques por categoría
export const getTaskBlocksByCategory = (category) => {
  return taskBlocksByCategory[category] || [];
};

// Función helper para obtener bloques por tipo
export const getTaskBlocksByType = (type) => {
  return taskBlocksByType[type] || [];
};

// Exportar todas las categorías disponibles (en orden de visualización)
export const availableCategories = Object.keys(taskBlocksByCategory);

// Exportar todos los tipos de operadores disponibles
export const availableTypes = Object.keys(taskBlocksByType);

// Exportar por separado también
export {
  commonOperators,
  airflowOperators,
  googleCloudOperators,
  databaseOperators,
  transferOperators
};
