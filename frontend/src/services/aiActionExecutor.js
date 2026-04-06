const DEFAULT_NODE_WIDTH = 280;
const DEFAULT_NODE_HEIGHT = 100;

function generateNodeId() {
  return `ai_node_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function generateEdgeId(source, target) {
  return `e_${source}_${target}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function createNodeFromPayload(payload = {}, fallbackIndex = 0) {
  if (payload?.id && payload?.data) {
    return payload;
  }

  const nodeId = String(payload?.id || "").trim() || generateNodeId();
  const nodeType = payload?.type || "dagNode";
  const posX = Number.isFinite(Number(payload?.position?.x))
    ? Number(payload.position.x)
    : 80 + (fallbackIndex % 4) * (DEFAULT_NODE_WIDTH + 24);
  const posY = Number.isFinite(Number(payload?.position?.y))
    ? Number(payload.position.y)
    : 120 + Math.floor(fallbackIndex / 4) * (DEFAULT_NODE_HEIGHT + 24);
  const taskLabel = payload?.task_id || payload?.label || `task_${fallbackIndex + 1}`;

  return {
    id: nodeId,
    type: nodeType,
    position: { x: posX, y: posY },
    data: {
      id: nodeId,
      label: taskLabel,
      task_id: taskLabel,
      type: payload?.operatorType || payload?.data?.type || payload?.type || "PythonOperator",
      icon: payload?.icon || payload?.data?.icon || "extension",
      category: payload?.category || payload?.data?.category || "others",
      description: payload?.description || payload?.data?.description || "",
      framework: payload?.framework || payload?.data?.framework,
      platform: payload?.platform || payload?.data?.platform,
      parameterDefinitions: payload?.parameterDefinitions || payload?.data?.parameterDefinitions || {},
      parameters: payload?.parameters || payload?.data?.parameters || {},
      showParameters: true,
    },
  };
}

export function applyAiActions(currentNodes = [], currentEdges = [], actions = []) {
  let nodes = Array.isArray(currentNodes) ? [...currentNodes] : [];
  let edges = Array.isArray(currentEdges) ? [...currentEdges] : [];

  const list = Array.isArray(actions) ? actions : [];
  list.forEach((action, index) => {
    const type = String(action?.type || "").trim();
    const payload = action?.payload && typeof action.payload === "object" ? action.payload : {};

    if (type === "replace_flow") {
      nodes = Array.isArray(payload.nodes) ? payload.nodes : [];
      edges = Array.isArray(payload.edges) ? payload.edges : [];
      return;
    }

    if (type === "clear_flow") {
      nodes = [];
      edges = [];
      return;
    }

    if (type === "add_node") {
      const node = createNodeFromPayload(payload.node || payload, nodes.length + index);
      if (!nodes.some((n) => n.id === node.id)) {
        nodes.push(node);
      }
      return;
    }

    if (type === "update_node") {
      const nodeId = String(payload.nodeId || "").trim();
      if (!nodeId) return;
      nodes = nodes.map((node) => {
        if (node.id !== nodeId) return node;
        return {
          ...node,
          position: payload.position ? { ...node.position, ...payload.position } : node.position,
          data: payload.data ? { ...node.data, ...payload.data } : node.data,
        };
      });
      return;
    }

    if (type === "delete_node") {
      const nodeId = String(payload.nodeId || "").trim();
      if (!nodeId) return;
      nodes = nodes.filter((node) => node.id !== nodeId);
      edges = edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId);
      return;
    }

    if (type === "connect_nodes") {
      const source = String(payload.source || "").trim();
      const target = String(payload.target || "").trim();
      if (!source || !target) return;
      const edgeExists = edges.some(
        (edge) => edge.source === source && edge.target === target && edge.sourceHandle === payload.sourceHandle,
      );
      if (edgeExists) return;
      edges.push({
        id: generateEdgeId(source, target),
        source,
        target,
        sourceHandle: payload.sourceHandle || null,
        targetHandle: payload.targetHandle || null,
        type: "smoothstep",
        animated: true,
        style: { stroke: "#64748b", strokeWidth: 2 },
      });
      return;
    }

    if (type === "disconnect_nodes") {
      const edgeId = String(payload.edgeId || "").trim();
      if (edgeId) {
        edges = edges.filter((edge) => edge.id !== edgeId);
        return;
      }
      const source = String(payload.source || "").trim();
      const target = String(payload.target || "").trim();
      if (!source || !target) return;
      edges = edges.filter((edge) => !(edge.source === source && edge.target === target));
    }
  });

  return { nodes, edges };
}

