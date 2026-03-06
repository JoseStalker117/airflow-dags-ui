// Ordenar nodos: tipos DAG/ArgoWorkflow primero (para layout), luego el resto
export const sortNodesWithDAGFirst = (nodes) => {
  const dagNodes = nodes.filter(
    (n) => n.data?.type === "DAG" || n.data?.type === "ArgoWorkflow",
  );
  const taskNodes = nodes.filter(
    (n) => !n.data || (n.data.type !== "DAG" && n.data.type !== "ArgoWorkflow"),
  );
  return [...dagNodes, ...taskNodes];
};

/**
 * Detecta si agregar una arista crearía un ciclo en el grafo.
 */
export const wouldCreateCycle = (sourceId, targetId, edges) => {
  if (sourceId === targetId) return true;

  const visited = new Set();
  const queue = [targetId];

  while (queue.length > 0) {
    const current = queue.shift();

    if (current === sourceId) return true;
    if (visited.has(current)) continue;

    visited.add(current);

    const outgoing = edges.filter((e) => e.source === current);
    outgoing.forEach((e) => {
      if (!visited.has(e.target)) {
        queue.push(e.target);
      }
    });
  }

  return false;
};

/**
 * Valida la integridad del DAG.
 */
export const validateDAG = (nodes, edges) => {
  const dagNodes = nodes.filter(
    (n) => n.data?.type === "DAG" || n.data?.type === "ArgoWorkflow",
  );

  // Detectar ciclos
  const cycles = [];
  edges.forEach((edge) => {
    const restEdges = edges.filter((e) => e.id !== edge.id);
    if (wouldCreateCycle(edge.target, edge.source, restEdges)) {
      cycles.push(edge);
    }
  });

  // Encontrar nodos huérfanos (sin conexiones)
  const connectedNodes = new Set();
  edges.forEach((e) => {
    connectedNodes.add(e.source);
    connectedNodes.add(e.target);
  });

  const isDAGLike = (n) =>
    n.data?.type === "DAG" || n.data?.type === "ArgoWorkflow";
  const orphanNodes = nodes.filter(
    (n) => !connectedNodes.has(n.id) && !isDAGLike(n),
  );

  return {
    isValid: cycles.length === 0,
    hasCycles: cycles.length > 0,
    cycleEdges: cycles,
    hasOrphanNodes: orphanNodes.length > 0,
    orphanNodes,
    hasMultipleDAGs: dagNodes.length > 1,
    dagCount: dagNodes.length,
  };
};
