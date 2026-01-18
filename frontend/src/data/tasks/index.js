/**
 * Índice de todos los bloques de tareas disponibles
 * Airflow 2.4.0
 * Nueva estructura de categorías según jerarquía definida
 */

import { airflowOperators } from "./airflowOperators";
import { commonOperators } from "./commonOperators";
import { databaseOperators } from "./databaseOperators";
import { googleCloudOperators } from "./googleCloudOperators";
import { pythonOperators } from "./pythonOperators";
import { sqlOperators } from "./sqlOperators";
import { transferOperators } from "./transferOperators";
import { otherUtils } from "./otherUtils";

// Exportar todos los bloques como un array plano
export const allTaskBlocks = [
  ...commonOperators,
  ...airflowOperators,
  ...googleCloudOperators,
  ...databaseOperators,
  ...transferOperators,
  ...pythonOperators,
  ...sqlOperators,
  ...otherUtils,
];

// Exportar agrupados por categoría (orden de visualización)
export const taskBlocksByCategory = {
  common: commonOperators,
  airflow: airflowOperators,
  google_cloud: googleCloudOperators,
  database: databaseOperators,
  transfer: transferOperators,
  python: pythonOperators,
  sql: sqlOperators,
  others: otherUtils,
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
  return allTaskBlocks.find((block) => block.id === id);
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
  transferOperators,
  pythonOperators,
  sqlOperators,
  otherUtils,
};
