/**
 * Utilidades para localStorage
 * Maneja persistencia del canvas (nodos, edges) y preferencias del usuario
 */

const STORAGE_KEYS = {
  DAG_CANVAS: "dag_construct_canvas",
  USER_PREFERENCES: "dag_construct_preferences"
};

/** Deep-clone para objetos serializables (evita referencias y funciones) */
const deepSerialize = (obj) => {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(deepSerialize);
  const out = {};
  for (const key of Object.keys(obj)) {
    const v = obj[key];
    if (typeof v === "function") continue;
    out[key] = deepSerialize(v);
  }
  return out;
};

/**
 * Guarda el estado del canvas (nodos y edges) en localStorage.
 * Incluye contenido de paneles: parameters, parameterDefinitions, showParameters.
 * @param {Array|Object} nodesOrPayload - Array de nodos o objeto { nodes, edges }
 * @param {Array} [edges] - Array de edges (opcional si el primer arg es { nodes, edges })
 */
export const saveCanvasState = (nodesOrPayload, edges) => {
  try {
    const nodes = Array.isArray(nodesOrPayload)
      ? nodesOrPayload
      : (nodesOrPayload?.nodes ?? []);
    const edgesList = Array.isArray(edges)
      ? edges
      : (nodesOrPayload?.edges ?? []);
    // Serializar nodos sin funciones (onUpdate, onDelete); incluir todo el contenido de paneles
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
        parameters: deepSerialize(node.data.parameters || {}),
        parameterDefinitions: deepSerialize(node.data.parameterDefinitions || {}),
        showParameters: Boolean(node.data.showParameters),
        // Excluir onUpdate y onDelete (funciones no serializables)
      }
    }));

    const canvasData = {
      nodes: serializableNodes,
      edges: edgesList.map(edge => ({
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
 * Construye el payload del canvas listo para enviar al backend (misma forma que se persiste).
 * Incluye nodos con parameters, parameterDefinitions y edges.
 * @param {Array} nodes - Array de nodos (ej. initialNodes)
 * @param {Array} edges - Array de edges
 * @returns {Object} { nodes, edges } serializable para API
 */
export const getCanvasPayloadForBackend = (nodes, edges) => {
  if (!nodes || !edges) return { nodes: [], edges: [] };
  const serializableNodes = nodes.map(node => ({
    id: node.id,
    type: node.type,
    position: node.position,
    data: {
      id: node.data?.id,
      label: node.data?.label,
      type: node.data?.type,
      icon: node.data?.icon,
      category: node.data?.category,
      description: node.data?.description,
      task_id: node.data?.task_id,
      parameters: deepSerialize(node.data?.parameters || {}),
      parameterDefinitions: deepSerialize(node.data?.parameterDefinitions || {}),
    }
  }));
  const edgesList = edges.map(edge => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    type: edge.type,
    style: edge.style,
    markerEnd: edge.markerEnd
  }));
  return { nodes: serializableNodes, edges: edgesList };
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
