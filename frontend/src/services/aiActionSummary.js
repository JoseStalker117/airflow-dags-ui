const ACTION_LABELS = {
  add_node: "Agregar nodo",
  update_node: "Actualizar nodo",
  delete_node: "Eliminar nodo",
  connect_nodes: "Conectar",
  disconnect_nodes: "Desconectar",
  replace_flow: "Reemplazar flow",
  clear_flow: "Vaciar flow",
};

export const DESTRUCTIVE_ACTION_TYPES = new Set(["clear_flow", "replace_flow"]);

export function isDestructiveAiAction(action) {
  return DESTRUCTIVE_ACTION_TYPES.has(String(action?.type || "").trim());
}

function nodeLabelFromPayload(payload = {}) {
  const node = payload.node || payload;
  const data = node?.data || {};
  return data.task_id || data.label || node?.id || "sin nombre";
}

function operatorFromPayload(payload = {}) {
  const node = payload.node || payload;
  return node?.data?.type || node?.operatorType || "task";
}

export function summarizeAiAction(action) {
  const type = String(action?.type || "").trim();
  const payload = action?.payload && typeof action.payload === "object" ? action.payload : {};
  const label = ACTION_LABELS[type] || type;

  switch (type) {
    case "add_node":
      return {
        type,
        label,
        detail: `${operatorFromPayload(payload)} «${nodeLabelFromPayload(payload)}»`,
        destructive: false,
      };
    case "update_node": {
      const nodeId = payload.nodeId || "?";
      const params = payload.data?.parameters || payload.parameters || {};
      const paramKeys = Object.keys(params);
      const paramHint = paramKeys.length ? `: ${paramKeys.join(", ")}` : "";
      return {
        type,
        label,
        detail: `${nodeId}${paramHint}`,
        destructive: false,
      };
    }
    case "delete_node":
      return {
        type,
        label,
        detail: String(payload.nodeId || "?"),
        destructive: true,
      };
    case "connect_nodes":
      return {
        type,
        label,
        detail: `${payload.source || "?"} → ${payload.target || "?"}`,
        destructive: false,
      };
    case "disconnect_nodes":
      return {
        type,
        label,
        detail: payload.edgeId
          ? `arista ${payload.edgeId}`
          : `${payload.source || "?"} → ${payload.target || "?"}`,
        destructive: false,
      };
    case "replace_flow": {
      const nodeCount = Array.isArray(payload.nodes) ? payload.nodes.length : 0;
      const edgeCount = Array.isArray(payload.edges) ? payload.edges.length : 0;
      return {
        type,
        label,
        detail: `${nodeCount} nodo(s), ${edgeCount} conexión(es)`,
        destructive: true,
      };
    }
    case "clear_flow":
      return {
        type,
        label,
        detail: "Se eliminarán todos los nodos y conexiones",
        destructive: true,
      };
    default:
      return { type, label, detail: "", destructive: false };
  }
}

export function summarizeAiActions(actions = []) {
  const list = Array.isArray(actions) ? actions : [];
  const items = list.map(summarizeAiAction);
  const destructive = items.some((item) => item.destructive || isDestructiveAiAction({ type: item.type }));
  return {
    count: items.length,
    items,
    destructive,
    title: items.length === 1
      ? "1 cambio propuesto"
      : `${items.length} cambios propuestos`,
  };
}
