import { MarkerType } from "reactflow";

/**
 * Reconecta un nodo insertándolo ANTES del nodo objetivo.
 */
export const reconnectAbove = (movedNodeId, targetNode, edges, nodes) => {
  const incomingToTarget = edges.find((e) => e.target === targetNode.id);
  let newEdges = edges.filter(
    (e) => e.source !== movedNodeId && e.target !== movedNodeId,
  );

  if (incomingToTarget) {
    newEdges = newEdges.filter((e) => e.id !== incomingToTarget.id);

    const sourceNodeData = nodes.find((n) => n.id === incomingToTarget.source);
    const isFromDAG =
      sourceNodeData?.data?.type === "DAG" ||
      sourceNodeData?.data?.type === "ArgoWorkflow";
    const isFromBranch = sourceNodeData?.data?.type === "BranchPythonOperator";

    let strokeColor = "#64748b";
    if (isFromDAG) strokeColor = "#6366f1";
    else if (isFromBranch) {
      strokeColor =
        incomingToTarget.sourceHandle === "true"
          ? "#22c55e"
          : incomingToTarget.sourceHandle === "false"
            ? "#ef4444"
            : "#64748b";
    }

    newEdges.push({
      id: `e${incomingToTarget.source}-${incomingToTarget.sourceHandle || ""}-${movedNodeId}`,
      source: incomingToTarget.source,
      sourceHandle: incomingToTarget.sourceHandle,
      target: movedNodeId,
      type: "smoothstep",
      animated: true,
      style: { stroke: strokeColor, strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: strokeColor },
    });
  }

  newEdges.push({
    id: `e${movedNodeId}-${targetNode.id}`,
    source: movedNodeId,
    target: targetNode.id,
    type: "smoothstep",
    animated: true,
    style: { stroke: "#64748b", strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#64748b" },
  });

  return newEdges;
};

/**
 * Reconecta un nodo insertándolo DESPUÉS del nodo objetivo.
 */
export const reconnectBelow = (movedNodeId, targetNode, edges) => {
  const isTargetBranch = targetNode.data?.type === "BranchPythonOperator";
  if (isTargetBranch) return edges;

  let newEdges = edges.filter(
    (e) => e.source !== movedNodeId && e.target !== movedNodeId,
  );

  const outgoingFromTarget = edges.find((e) => e.source === targetNode.id);

  if (outgoingFromTarget) {
    newEdges = newEdges.filter((e) => e.id !== outgoingFromTarget.id);

    newEdges.push({
      id: `e${movedNodeId}-${outgoingFromTarget.target}`,
      source: movedNodeId,
      target: outgoingFromTarget.target,
      type: "smoothstep",
      animated: true,
      style: { stroke: "#64748b", strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: "#64748b" },
    });
  }

  const isTargetDAG =
    targetNode.data?.type === "DAG" || targetNode.data?.type === "ArgoWorkflow";
  const strokeColor = isTargetDAG ? "#6366f1" : "#64748b";

  newEdges.push({
    id: `e${targetNode.id}-${movedNodeId}`,
    source: targetNode.id,
    target: movedNodeId,
    type: "smoothstep",
    animated: true,
    style: { stroke: strokeColor, strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: strokeColor },
  });

  return newEdges;
};

/**
 * Reconecta un nodo en una rama de BranchPythonOperator.
 */
export const reconnectBranch = (movedNodeId, targetNode, branch, edges) => {
  const handleId = branch === "true" ? "true" : "false";
  const strokeColor = branch === "true" ? "#22c55e" : "#ef4444";

  let newEdges = edges.filter(
    (e) => e.source !== movedNodeId && e.target !== movedNodeId,
  );

  const existingBranchEdge = edges.find(
    (e) => e.source === targetNode.id && e.sourceHandle === handleId,
  );

  if (existingBranchEdge) {
    newEdges = newEdges.filter((e) => e.id !== existingBranchEdge.id);

    newEdges.push({
      id: `e${movedNodeId}-${existingBranchEdge.target}`,
      source: movedNodeId,
      target: existingBranchEdge.target,
      type: "smoothstep",
      animated: true,
      style: { stroke: "#64748b", strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: "#64748b" },
    });
  }

  newEdges.push({
    id: `e${targetNode.id}-${handleId}-${movedNodeId}`,
    source: targetNode.id,
    sourceHandle: handleId,
    target: movedNodeId,
    type: "smoothstep",
    animated: true,
    style: { stroke: strokeColor, strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: strokeColor },
  });

  return newEdges;
};

/**
 * Limpia las conexiones de un nodo que está siendo movido.
 */
export const cleanupMovedNodeConnections = (movedNodeId, edges) => {
  const incoming = edges.find((e) => e.target === movedNodeId);
  const outgoing = edges.find((e) => e.source === movedNodeId);

  let cleanedEdges = edges.filter(
    (e) => e.source !== movedNodeId && e.target !== movedNodeId,
  );

  if (incoming && outgoing && incoming.source !== outgoing.target) {
    const connectionExists = cleanedEdges.some(
      (e) =>
        e.source === incoming.source &&
        e.target === outgoing.target &&
        e.sourceHandle === incoming.sourceHandle,
    );

    if (!connectionExists) {
      cleanedEdges.push({
        id: `e${incoming.source}-${incoming.sourceHandle || ""}-${outgoing.target}`,
        source: incoming.source,
        sourceHandle: incoming.sourceHandle,
        target: outgoing.target,
        type: "smoothstep",
        animated: true,
        style: incoming.style || { stroke: "#64748b", strokeWidth: 2 },
        markerEnd: incoming.markerEnd || {
          type: MarkerType.ArrowClosed,
          color: "#64748b",
        },
      });
    }
  }

  return cleanedEdges;
};
