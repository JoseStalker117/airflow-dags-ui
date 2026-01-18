/**
 * Utilidades para localStorage
 * Maneja persistencia del canvas (nodos, edges) y preferencias del usuario
 */

const STORAGE_KEYS = {
  DAG_CANVAS: "dag_construct_canvas",
  USER_PREFERENCES: "dag_construct_preferences"
};

/**
 * Guarda el estado del canvas (nodos y edges) en localStorage
 * @param {Array} nodes - Array de nodos del canvas
 * @param {Array} edges - Array de edges del canvas
 */
export const saveCanvasState = (nodes, edges) => {
  try {
    // Serializar nodos sin funciones (onUpdate, onDelete)
    const serializableNodes = nodes.map(node => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: {
        id: node.data.id,
        label: node.data.label,
        type: node.data.type,
        icon: node.data.icon,
        category: node.data.category,
        description: node.data.description,
        task_id: node.data.task_id,
        parameters: node.data.parameters
        // Excluir onUpdate y onDelete (funciones no serializables)
      }
    }));

    const canvasData = {
      nodes: serializableNodes,
      edges: edges.map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
        type: edge.type,
        style: edge.style,
        markerEnd: edge.markerEnd
      })),
      timestamp: new Date().toISOString()
    };

    localStorage.setItem(STORAGE_KEYS.DAG_CANVAS, JSON.stringify(canvasData));
    return true;
  } catch (error) {
    console.error("Error guardando estado del canvas:", error);
    return false;
  }
};

/**
 * Carga el estado del canvas desde localStorage
 * @returns {Object|null} Objeto con nodes y edges, o null si no hay datos
 */
export const loadCanvasState = () => {
  try {
    const savedData = localStorage.getItem(STORAGE_KEYS.DAG_CANVAS);
    if (!savedData) return null;

    const canvasData = JSON.parse(savedData);
    return {
      nodes: canvasData.nodes || [],
      edges: canvasData.edges || [],
      timestamp: canvasData.timestamp
    };
  } catch (error) {
    console.error("Error cargando estado del canvas:", error);
    return null;
  }
};

/**
 * Limpia el estado del canvas guardado
 */
export const clearCanvasState = () => {
  try {
    localStorage.removeItem(STORAGE_KEYS.DAG_CANVAS);
    return true;
  } catch (error) {
    console.error("Error limpiando estado del canvas:", error);
    return false;
  }
};

/**
 * Guarda las preferencias del usuario
 * @param {Object} preferences - Objeto con las preferencias
 */
export const saveUserPreferences = (preferences) => {
  try {
    const existingPreferences = loadUserPreferences() || {};
    const updatedPreferences = {
      ...existingPreferences,
      ...preferences,
      lastUpdated: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEYS.USER_PREFERENCES, JSON.stringify(updatedPreferences));
    return true;
  } catch (error) {
    console.error("Error guardando preferencias del usuario:", error);
    return false;
  }
};

/**
 * Carga las preferencias del usuario
 * @returns {Object|null} Objeto con las preferencias o null si no hay datos
 */
export const loadUserPreferences = () => {
  try {
    const savedPreferences = localStorage.getItem(STORAGE_KEYS.USER_PREFERENCES);
    if (!savedPreferences) return null;

    return JSON.parse(savedPreferences);
  } catch (error) {
    console.error("Error cargando preferencias del usuario:", error);
    return null;
  }
};

/**
 * Limpia todas las preferencias del usuario
 */
export const clearUserPreferences = () => {
  try {
    localStorage.removeItem(STORAGE_KEYS.USER_PREFERENCES);
    return true;
  } catch (error) {
    console.error("Error limpiando preferencias del usuario:", error);
    return false;
  }
};

/**
 * Limpia todo el almacenamiento de la aplicación
 */
export const clearAllStorage = () => {
  clearCanvasState();
  clearUserPreferences();
};
