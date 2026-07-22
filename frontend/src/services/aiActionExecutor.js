import { wouldCreateCycle } from "../components/dagCanvas/graphValidation";
import {
  buildParametersFromDefinitions,
  findTaskBlock,
} from "./tasksFromFirestore";

const DEFAULT_NODE_WIDTH = 280;
const DEFAULT_NODE_HEIGHT = 100;
const ROOT_TYPES = new Set(["DAG", "ArgoWorkflow"]);
const ALLOWED_ACTIONS = new Set([
  "add_node", "update_node", "delete_node", "connect_nodes",
  "disconnect_nodes", "replace_flow", "clear_flow",
]);

function generateNodeId() {
  return `ai_node_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function generateEdgeId(source, target) {
  return `e_${source}_${target}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function resolveFramework(data = {}, fallback = {}) {
  const value =
    data.framework ||
    data.platform ||
    fallback.framework ||
    fallback.platform ||
    null;
  if (value === "airflow" || value === "argo") return value;
  if (data.type === "DAG" || fallback.type === "DAG") return "airflow";
  if (data.type === "ArgoWorkflow" || fallback.type === "ArgoWorkflow") return "argo";
  return value;
}

function fallbackParameterDefinitions(taskLabel) {
  return {
    task_id: {
      type: "string",
      required: true,
      default: taskLabel,
      description: "ID único de la tarea (task_id)",
    },
  };
}

function resolveTaskTemplate(raw = {}, incomingData = {}, taskBlocks = [], flowFramework = null) {
  const operatorType =
    incomingData.type ||
    raw?.operatorType ||
    raw?.operator_type ||
    raw?.type ||
    null;
  const framework = resolveFramework(incomingData, raw) || flowFramework;
  return findTaskBlock(taskBlocks, {
    catalogId: incomingData.catalogId || incomingData.taskCatalogId || raw?.catalogId || raw?.id,
    label: incomingData.label || raw?.label,
    type: operatorType,
    framework,
  });
}

function createNodeFromPayload(payload = {}, fallbackIndex = 0, options = {}) {
  const { taskBlocks = [], flowFramework = null } = options;
  const raw = payload?.node && typeof payload.node === "object" ? payload.node : payload;
  const incomingData = raw?.data && typeof raw.data === "object" ? raw.data : {};
  const template = resolveTaskTemplate(raw, incomingData, taskBlocks, flowFramework);

  const nodeId = String(raw?.id || incomingData?.id || "").trim() || generateNodeId();
  const posX = Number.isFinite(Number(raw?.position?.x))
    ? Number(raw.position.x)
    : 80 + (fallbackIndex % 4) * (DEFAULT_NODE_WIDTH + 24);
  const posY = Number.isFinite(Number(raw?.position?.y))
    ? Number(raw.position.y)
    : 120 + Math.floor(fallbackIndex / 4) * (DEFAULT_NODE_HEIGHT + 24);

  const operatorType =
    incomingData.type ||
    template?.type ||
    raw?.operatorType ||
    raw?.operator_type ||
    "PythonOperator";

  const requestedTaskId =
    incomingData.task_id ||
    incomingData.parameters?.task_id ||
    raw?.task_id ||
    null;

  const taskLabel =
    requestedTaskId ||
    incomingData.label ||
    template?.parameterDefinitions?.task_id?.default ||
    template?.label ||
    raw?.label ||
    `task_${fallbackIndex + 1}`;

  const framework =
    resolveFramework(incomingData, raw) ||
    resolveFramework(template || {}) ||
    flowFramework;

  const parameterDefinitions =
    (incomingData.parameterDefinitions && Object.keys(incomingData.parameterDefinitions).length > 0
      ? incomingData.parameterDefinitions
      : null) ||
    template?.parameterDefinitions ||
    fallbackParameterDefinitions(taskLabel);

  const parameters = buildParametersFromDefinitions(parameterDefinitions, {
    ...(incomingData.parameters || {}),
    ...(raw?.parameters || {}),
    task_id: requestedTaskId || taskLabel,
  });

  return {
    id: nodeId,
    type: "dagNode",
    position: { x: posX, y: posY },
    data: {
      ...(template || {}),
      ...incomingData,
      id: nodeId,
      label: incomingData.label || template?.label || taskLabel,
      task_id: parameters.task_id || taskLabel,
      type: operatorType,
      icon: incomingData.icon || template?.icon || raw?.icon || "extension",
      category: incomingData.category || template?.category || raw?.category || "others",
      description:
        incomingData.description || template?.description || raw?.description || "",
      framework: framework || incomingData.framework,
      platform: incomingData.platform || template?.platform || framework || incomingData.framework,
      importLiteral: incomingData.importLiteral ?? template?.importLiteral ?? null,
      imports: incomingData.imports ?? template?.imports ?? null,
      operatorImport: incomingData.operatorImport ?? template?.operatorImport ?? null,
      pythonImportLiteral:
        incomingData.pythonImportLiteral ?? template?.pythonImportLiteral ?? null,
      catalogId: incomingData.catalogId || template?.id || null,
      parameterDefinitions,
      parameters,
      showParameters:
        incomingData.showParameters !== undefined
          ? Boolean(incomingData.showParameters)
          : true,
    },
  };
}

function mergeNodeData(existingData = {}, patch = {}) {
  const next = {
    ...existingData,
    ...patch,
    id: existingData.id,
  };

  if (patch.parameters && typeof patch.parameters === "object") {
    next.parameters = {
      ...(existingData.parameters || {}),
      ...patch.parameters,
    };
    if (patch.parameters.task_id != null && patch.parameters.task_id !== "") {
      next.task_id = patch.parameters.task_id;
    }
  }

  if (patch.parameterDefinitions && typeof patch.parameterDefinitions === "object") {
    next.parameterDefinitions = {
      ...(existingData.parameterDefinitions || {}),
      ...patch.parameterDefinitions,
    };
  }

  if (patch.task_id != null && patch.task_id !== "") {
    next.task_id = patch.task_id;
    next.parameters = {
      ...(next.parameters || {}),
      task_id: patch.task_id,
    };
  }

  return next;
}

function enrichMissingDefinitions(node, taskBlocks = [], flowFramework = null) {
  const data = node?.data || {};
  const hasDefs =
    data.parameterDefinitions &&
    typeof data.parameterDefinitions === "object" &&
    Object.keys(data.parameterDefinitions).length > 0;
  if (hasDefs) return node;

  const template = resolveTaskTemplate({}, data, taskBlocks, flowFramework);
  const parameterDefinitions =
    template?.parameterDefinitions ||
    fallbackParameterDefinitions(data.task_id || data.label || node.id);
  const parameters = buildParametersFromDefinitions(parameterDefinitions, data.parameters || {});

  return {
    ...node,
    data: {
      ...data,
      ...(template
        ? {
            icon: data.icon || template.icon,
            category: data.category || template.category,
            description: data.description || template.description,
            importLiteral: data.importLiteral ?? template.importLiteral ?? null,
            imports: data.imports ?? template.imports ?? null,
            operatorImport: data.operatorImport ?? template.operatorImport ?? null,
            catalogId: data.catalogId || template.id || null,
          }
        : {}),
      parameterDefinitions,
      parameters,
      showParameters: data.showParameters !== undefined ? data.showParameters : true,
    },
  };
}

function isValidFlow(nodes, edges) {
  const ids = nodes.map((node) => String(node?.id || "").trim());
  if (!ids.every(Boolean) || new Set(ids).size !== ids.length) return false;
  if (nodes.filter((node) => ROOT_TYPES.has(node?.data?.type)).length > 1) return false;

  const frameworks = new Set(
    nodes
      .map((node) => resolveFramework(node?.data || {}))
      .filter((framework) => framework === "airflow" || framework === "argo"),
  );
  if (frameworks.size > 1) return false;

  const nodeIds = new Set(ids);
  const checkedEdges = [];
  for (const edge of edges) {
    if (!nodeIds.has(edge?.source) || !nodeIds.has(edge?.target)) return false;
    if (wouldCreateCycle(edge.source, edge.target, checkedEdges)) return false;
    checkedEdges.push(edge);
  }
  return true;
}

export function applyAiActions(currentNodes = [], currentEdges = [], actions = [], options = {}) {
  const taskBlocks = Array.isArray(options.taskBlocks) ? options.taskBlocks : [];
  const flowFramework =
    options.framework ||
    resolveFramework(
      (Array.isArray(currentNodes) ? currentNodes : []).find((node) =>
        ROOT_TYPES.has(node?.data?.type),
      )?.data || {},
    ) ||
    resolveFramework((Array.isArray(currentNodes) ? currentNodes : [])[0]?.data || {});

  let nodes = (Array.isArray(currentNodes) ? currentNodes : []).map((node) =>
    enrichMissingDefinitions(node, taskBlocks, flowFramework),
  );
  let edges = Array.isArray(currentEdges) ? [...currentEdges] : [];
  let appliedActions = 0;
  let rejectedActions = 0;
  for (const [index, action] of (Array.isArray(actions) ? actions : []).entries()) {
    const type = String(action?.type || "").trim();
    const payload = action?.payload && typeof action.payload === "object" ? action.payload : {};
    if (!ALLOWED_ACTIONS.has(type)) {
      rejectedActions += 1;
      continue;
    }

    let candidateNodes = [...nodes];
    let candidateEdges = [...edges];
    const nodeIds = new Set(nodes.map((node) => node.id));
    const createOpts = { taskBlocks, flowFramework };

    if (type === "replace_flow") {
      if (!Array.isArray(payload.nodes) || !Array.isArray(payload.edges)) {
        rejectedActions += 1;
        continue;
      }
      candidateNodes = payload.nodes.map((node, nodeIndex) =>
        createNodeFromPayload(node, nodeIndex, createOpts),
      );
      candidateEdges = (payload.edges || []).map((edge, edgeIndex) => ({
        id: edge?.id || generateEdgeId(edge?.source, edge?.target || edgeIndex),
        source: edge?.source,
        target: edge?.target,
        sourceHandle: edge?.sourceHandle ?? null,
        targetHandle: edge?.targetHandle ?? null,
        type: edge?.type || "smoothstep",
        animated: edge?.animated ?? true,
        style: edge?.style || { stroke: "#64748b", strokeWidth: 2 },
      }));
    } else if (type === "clear_flow") {
      candidateNodes = [];
      candidateEdges = [];
    } else if (type === "add_node") {
      const node = createNodeFromPayload(payload.node || payload, nodes.length + index, createOpts);
      if (!node.id || nodeIds.has(node.id)) {
        rejectedActions += 1;
        continue;
      }
      candidateNodes.push(node);
    } else if (type === "update_node") {
      const nodeId = String(payload.nodeId || "").trim();
      if (!nodeIds.has(nodeId)) {
        rejectedActions += 1;
        continue;
      }

      // Soporta data.parameters o parameters en el root del payload
      const dataPatch = {
        ...(payload.data && typeof payload.data === "object" ? payload.data : {}),
      };
      if (payload.parameters && typeof payload.parameters === "object") {
        dataPatch.parameters = {
          ...(dataPatch.parameters || {}),
          ...payload.parameters,
        };
      }

      if (!Object.keys(dataPatch).length && !payload.position) {
        rejectedActions += 1;
        continue;
      }

      candidateNodes = nodes.map((node) => {
        if (node.id !== nodeId) return node;
        const enriched = enrichMissingDefinitions(node, taskBlocks, flowFramework);
        return {
          ...enriched,
          position: payload.position
            ? { ...enriched.position, ...payload.position }
            : enriched.position,
          data: Object.keys(dataPatch).length
            ? mergeNodeData(enriched.data, dataPatch)
            : enriched.data,
        };
      });
    } else if (type === "delete_node") {
      const nodeId = String(payload.nodeId || "").trim();
      if (!nodeIds.has(nodeId)) {
        rejectedActions += 1;
        continue;
      }
      candidateNodes = nodes.filter((node) => node.id !== nodeId);
      candidateEdges = edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId);
    } else if (type === "connect_nodes") {
      const source = String(payload.source || "").trim();
      const target = String(payload.target || "").trim();
      const sourceHandle = payload.sourceHandle ?? null;
      const targetHandle = payload.targetHandle ?? null;
      const duplicate = edges.some(
        (edge) =>
          edge.source === source &&
          edge.target === target &&
          (edge.sourceHandle ?? null) === sourceHandle &&
          (edge.targetHandle ?? null) === targetHandle,
      );
      if (!nodeIds.has(source) || !nodeIds.has(target) || duplicate || wouldCreateCycle(source, target, edges)) {
        rejectedActions += 1;
        continue;
      }
      candidateEdges.push({
        id: generateEdgeId(source, target),
        source,
        target,
        sourceHandle,
        targetHandle,
        type: "smoothstep",
        animated: true,
        style: { stroke: "#64748b", strokeWidth: 2 },
      });
    } else if (type === "disconnect_nodes") {
      const edgeId = String(payload.edgeId || "").trim();
      if (edgeId) {
        if (!edges.some((edge) => edge.id === edgeId)) {
          rejectedActions += 1;
          continue;
        }
        candidateEdges = edges.filter((edge) => edge.id !== edgeId);
      } else {
        const source = String(payload.source || "").trim();
        const target = String(payload.target || "").trim();
        if (
          !nodeIds.has(source) ||
          !nodeIds.has(target) ||
          !edges.some((edge) => edge.source === source && edge.target === target)
        ) {
          rejectedActions += 1;
          continue;
        }
        candidateEdges = edges.filter(
          (edge) => !(edge.source === source && edge.target === target),
        );
      }
    }

    if ((candidateNodes.length === 0 && candidateEdges.length === 0) || isValidFlow(candidateNodes, candidateEdges)) {
      nodes = candidateNodes;
      edges = candidateEdges;
      appliedActions += 1;
    } else {
      rejectedActions += 1;
    }
  }

  return { nodes, edges, appliedActions, rejectedActions };
}
