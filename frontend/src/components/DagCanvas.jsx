import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";
import dagre from "dagre";
import DagFlowNode from "./DagFlowNode";
import { saveCanvasState, loadCanvasState } from "../utils/storage";
import { defaultDAG } from "../data/tasks/defaultDAG";

// ============================================================================
// UTILIDADES DE VALIDACIÓN Y DETECCIÓN DE CICLOS
// ============================================================================

/**
 * Detecta si agregar una arista crearía un ciclo en el grafo
 */
const wouldCreateCycle = (sourceId, targetId, edges) => {
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
 * Valida la integridad del DAG
 */
const validateDAG = (nodes, edges) => {
  const dagNodes = nodes.filter((n) => n.data?.type === "DAG");

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

  const orphanNodes = nodes.filter(
    (n) => !connectedNodes.has(n.id) && n.data?.type !== "DAG",
  );

  return {
    isValid: cycles.length === 0 && dagNodes.length === 1,
    hasCycles: cycles.length > 0,
    cycleEdges: cycles,
    hasOrphanNodes: orphanNodes.length > 0,
    orphanNodes,
    hasMultipleDAGs: dagNodes.length > 1,
    dagCount: dagNodes.length,
  };
};

// ============================================================================
// UTILIDADES DE RECONEXIÓN DE NODOS
// ============================================================================

/**
 * Reconecta un nodo insertándolo ANTES del nodo objetivo
 */
const reconnectAbove = (movedNodeId, targetNode, edges, nodes) => {
  const incomingToTarget = edges.find((e) => e.target === targetNode.id);
  let newEdges = edges.filter(
    (e) => e.source !== movedNodeId && e.target !== movedNodeId,
  );

  if (incomingToTarget) {
    newEdges = newEdges.filter((e) => e.id !== incomingToTarget.id);

    const sourceNodeData = nodes.find((n) => n.id === incomingToTarget.source);
    const isFromDAG = sourceNodeData?.data?.type === "DAG";
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
 * Reconecta un nodo insertándolo DESPUÉS del nodo objetivo
 */
const reconnectBelow = (movedNodeId, targetNode, edges, nodes) => {
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

  const isTargetDAG = targetNode.data?.type === "DAG";
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
 * Reconecta un nodo en una rama de BranchPythonOperator
 */
const reconnectBranch = (movedNodeId, targetNode, branch, edges) => {
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
 * Limpia las conexiones de un nodo que está siendo movido
 */
const cleanupMovedNodeConnections = (movedNodeId, edges) => {
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

// Configuración del layout de árbol
const getLayoutedElements = (nodes, edges, direction = "TB") => {
  if (!nodes || nodes.length === 0) {
    return { nodes: [], edges };
  }

  // Separar nodos DAG de tareas
  const dagNodes = nodes.filter((n) => n.data && n.data.type === "DAG");
  const taskNodes = nodes.filter((n) => !n.data || n.data.type !== "DAG");

  // ---------------------------
  // CASO CON DAG
  // ---------------------------
  if (dagNodes.length > 0 && taskNodes.length > 0) {
    const dagNode = dagNodes[0];
    const dagId = dagNode.id;

    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({
      rankdir: direction,
      nodesep: 90,
      ranksep: 140,
      marginx: 80,
      marginy: 80,
    });

    // DAG - Calcular dimensiones dinámicamente basado en si está expandido
    const dagData = dagNode.data || {};
    const isDAGExpanded = dagData.showParameters === true;
    const dagParamsCount = dagData.parameterDefinitions
      ? Object.keys(dagData.parameterDefinitions).length
      : 0;
    const dagParamHeight = 28;

    let dagWidth = 460; // Ancho base
    let dagHeight = 180; // Alto base

    if (isDAGExpanded && dagParamsCount > 0) {
      // Ajustar altura si está expandido
      dagHeight += Math.min(dagParamsCount * dagParamHeight + 60, 400); // Max 400px extra
    }

    dagreGraph.setNode(dagId, {
      width: dagWidth,
      height: dagHeight,
    });

    // Tareas
    taskNodes.forEach((node) => {
      const data = node.data || {};

      const isBranch = data.type === "BranchPythonOperator";
      const isExpanded = data.showParameters === true;

      const paramsCount = data.parameterDefinitions
        ? Object.keys(data.parameterDefinitions).length
        : 0;

      const paramHeight = 28;

      let width = isBranch ? 420 : 280;
      let height = isBranch ? 150 : 100;

      if (isExpanded) {
        width += isBranch ? 160 : 60;
        height += paramsCount * paramHeight + 30;
      }

      dagreGraph.setNode(node.id, {
        width,
        height,
      });
    });

    // Edges reales
    edges.forEach((edge) => {
      dagreGraph.setEdge(edge.source, edge.target);
    });

    // Conectar tareas sueltas al DAG para layout
    const connected = new Set();
    edges.forEach((e) => {
      connected.add(e.source);
      connected.add(e.target);
    });

    taskNodes.forEach((node) => {
      if (!connected.has(node.id)) {
        dagreGraph.setEdge(dagId, node.id);
      }
    });

    dagre.layout(dagreGraph);

    // DAG posición
    const dagPos = dagreGraph.node(dagId);
    const layoutedDag = {
      ...dagNode,
      position: {
        x: dagPos.x - dagPos.width / 2,
        y: dagPos.y - dagPos.height / 2,
      },
    };

    // Tareas posición
    const layoutedTasks = taskNodes.map((node) => {
      const pos = dagreGraph.node(node.id);
      const isBranch = node.data && node.data.type === "BranchPythonOperator";
      const offsetX = isBranch ? 40 : 0;

      return {
        ...node,
        position: {
          x: pos.x - pos.width / 2 + offsetX,
          y: pos.y - pos.height / 2,
        },
      };
    });

    return {
      nodes: [layoutedDag, ...layoutedTasks],
      edges,
    };
  }

  // ---------------------------
  // CASO SIN DAG
  // ---------------------------
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: 110,
    ranksep: 160,
    marginx: 80,
    marginy: 80,
  });

  nodes.forEach((node) => {
    const data = node.data || {};

    const isDAG = data.type === "DAG";
    const isBranch = data.type === "BranchPythonOperator";

    dagreGraph.setNode(node.id, {
      width: isDAG ? 460 : isBranch ? 420 : 280,
      height: isDAG ? 180 : isBranch ? 150 : 100,
    });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  const dagNode = nodes.find((n) => n.data && n.data.type === "DAG");

  const connected = new Set();
  edges.forEach((e) => {
    connected.add(e.source);
    connected.add(e.target);
  });

  if (dagNode) {
    nodes.forEach((node) => {
      if (
        node.id !== dagNode.id &&
        !connected.has(node.id) &&
        (!node.data || node.data.type !== "DAG")
      ) {
        dagreGraph.setEdge(dagNode.id, node.id);
      }
    });
  }

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const pos = dagreGraph.node(node.id);
    if (!pos) return node;

    const isBranch = node.data && node.data.type === "BranchPythonOperator";
    const offsetX = isBranch ? 40 : 0;

    return {
      ...node,
      position: {
        x: pos.x - pos.width / 2 + offsetX,
        y: pos.y - pos.height / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

// Tipos definidos fuera del componente
const edgeTypes = {};
const nodeTypes = {
  dagNode: DagFlowNode,
};

const connectionLineStyle = {
  stroke: "#64748b",
  strokeWidth: 2,
};

const defaultEdgeOptions = {
  type: "smoothstep",
  animated: true,
  style: { stroke: "#64748b", strokeWidth: 2 },
  markerEnd: {
    type: MarkerType.ArrowClosed,
    color: "#64748b",
  },
};

const defaultViewport = { x: 0, y: 0, zoom: 1 };
const reactFlowStyle = { width: "100%", height: "100%" };

// ID fijo para el nodo DAG por defecto
const DEFAULT_DAG_NODE_ID = "dag_definition";

// Función helper para crear el nodo DAG desde defaultDAG
const createDefaultDAGNode = (handleNodeDelete) => {
  const dagData = defaultDAG[0];
  const dagNodeId = DEFAULT_DAG_NODE_ID;

  return {
    id: dagNodeId,
    type: "dagNode",
    data: {
      ...dagData,
      id: dagNodeId,
      task_id: dagData.label || "DAG Definition",
      parameterDefinitions: dagData.parameters || {},
      parameters: dagData.parameters
        ? Object.entries(dagData.parameters).reduce((acc, [key, param]) => {
            if (param.default !== undefined) {
              acc[key] = param.default;
            }
            return acc;
          }, {})
        : {},
      onUpdate: (updatedData) => {
        // Esta función será actualizada cuando se setee el nodo
      },
      onDelete: handleNodeDelete,
    },
    position: { x: 0, y: 0 },
    draggable: true, // Permitir arrastrar el nodo DAG
    selectable: true,
    deletable: false, // Marcarlo como no eliminable
  };
};

// Función helper para asegurar que el DAG esté al inicio del array de nodos
const ensureDAGAtStart = (nodes, handleNodeDelete, setNodesCallback = null) => {
  const dagNodes = nodes.filter((n) => n.data?.type === "DAG");
  const taskNodes = nodes.filter((n) => !n.data || n.data.type !== "DAG");

  // Si no hay nodo DAG, crear uno
  let dagNode = dagNodes[0];
  if (!dagNode) {
    dagNode = createDefaultDAGNode(handleNodeDelete);
  } else {
    // Asegurar que el nodo DAG tenga las propiedades correctas
    dagNode = {
      ...dagNode,
      draggable: true, // Permitir arrastrar
      deletable: false,
    };
  }

  // Retornar array con DAG al inicio
  return [dagNode, ...taskNodes];
};

export default function DagCanvas() {
  const [initialNodes, setInitialNodes] = useState([]);
  const [initialEdges, setInitialEdges] = useState([]);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isNodeDragging, setIsNodeDragging] = useState(false); // Para arrastre interno de nodos
  const [draggingNodeId, setDraggingNodeId] = useState(null); // ID del nodo que se está arrastrando
  const [dropZonePreview, setDropZonePreview] = useState(null); // { nodeId, zone: 'above' | 'below' }
  const [notification, setNotification] = useState(null);
  const [validationErrors, setValidationErrors] = useState(null);
  const isInitializedRef = useRef(false);
  const saveTimeoutRef = useRef(null);
  const reactFlowInstance = useRef(null);

  const showNotification = useCallback((message, type = "info") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  const handleNodeDelete = useCallback(
    (nodeId) => {
      if (nodeId === DEFAULT_DAG_NODE_ID) {
        showNotification("No se puede eliminar el nodo DAG principal", "error");
        return;
      }

      setInitialNodes((prev) => {
        const filtered = prev.filter((node) => node.id !== nodeId);
        return ensureDAGAtStart(filtered, handleNodeDelete);
      });

      setInitialEdges((prev) =>
        prev.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
      );

      showNotification("Nodo eliminado correctamente", "success");
    },
    [ensureDAGAtStart, showNotification],
  );

  useEffect(() => {
    if (isInitializedRef.current) return;

    const savedState = loadCanvasState();

    if (savedState?.nodes?.length > 0) {
      const restoredNodes = savedState.nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          onUpdate: (updatedData) => {
            setInitialNodes((prev) =>
              prev.map((n) =>
                n.id === node.id
                  ? { ...n, data: { ...n.data, ...updatedData } }
                  : n,
              ),
            );
          },
          onDelete: handleNodeDelete,
        },
      }));

      const nodesWithDAG = ensureDAGAtStart(restoredNodes, handleNodeDelete);
      setInitialNodes(nodesWithDAG);
      setInitialEdges(savedState.edges || []);
      showNotification("Estado cargado correctamente", "success");
    } else {
      const dagData = defaultDAG[0];
      const defaultDAGNode = {
        id: DEFAULT_DAG_NODE_ID,
        type: "dagNode",
        data: {
          ...dagData,
          id: DEFAULT_DAG_NODE_ID,
          task_id: dagData.label || "DAG Definition",
          parameterDefinitions: dagData.parameters || {},
          parameters: dagData.parameters
            ? Object.entries(dagData.parameters).reduce((acc, [key, param]) => {
                if (param.default !== undefined) {
                  acc[key] = param.default;
                }
                return acc;
              }, {})
            : {},
          onUpdate: (updatedData) => {
            setInitialNodes((prev) =>
              prev.map((n) =>
                n.id === DEFAULT_DAG_NODE_ID
                  ? { ...n, data: { ...n.data, ...updatedData } }
                  : n,
              ),
            );
          },
          onDelete: handleNodeDelete,
        },
        position: { x: 0, y: 0 },
        draggable: true,
        selectable: true,
        deletable: false,
      };

      setInitialNodes([defaultDAGNode]);
    }

    isInitializedRef.current = true;
  }, [handleNodeDelete, ensureDAGAtStart, showNotification]);

  const onNodesChangeWithDAGProtection = useCallback(
    (changes) => {
      const filtered = changes.filter((change) => {
        if (change.type === "remove" && change.id === DEFAULT_DAG_NODE_ID) {
          showNotification("No se puede eliminar el nodo DAG", "error");
          return false;
        }
        return true;
      });

      onNodesChange(filtered);
    },
    [onNodesChange, showNotification],
  );

  // Función para actualizar layout cuando cambian los nodos o edges
  useEffect(() => {
    if (!isInitializedRef.current) return;
    if (initialNodes.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const nodesWithDAG = ensureDAGAtStart(initialNodes, handleNodeDelete);
    const needsUpdate =
      nodesWithDAG[0]?.id !== initialNodes[0]?.id ||
      nodesWithDAG.length !== initialNodes.length;

    if (needsUpdate) {
      setInitialNodes(nodesWithDAG);
      return;
    }

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      nodesWithDAG,
      initialEdges,
      "TB",
    );

    setNodes(layoutedNodes);
    setEdges(layoutedEdges);

    // Validar DAG
    const validation = validateDAG(layoutedNodes, layoutedEdges);
    if (!validation.isValid) {
      setValidationErrors(validation);
      if (validation.hasCycles) {
        showNotification(
          "¡Advertencia! Se detectaron ciclos en el DAG",
          "warning",
        );
      }
    } else {
      setValidationErrors(null);
    }
  }, [
    initialNodes,
    initialEdges,
    setNodes,
    setEdges,
    handleNodeDelete,
    ensureDAGAtStart,
    showNotification,
  ]);

  // Auto-guardar cuando cambian los nodos o edges (con debounce)
  useEffect(() => {
    if (!isInitializedRef.current) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      try {
        const saved = saveCanvasState(initialNodes, initialEdges);
        if (!saved) {
          showNotification("Error al guardar el estado", "error");
        }
      } catch (error) {
        console.error("Error crítico guardando:", error);
        showNotification("Error crítico al guardar", "error");
      }
    }, 500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [initialNodes, initialEdges, showNotification]);

  // Manejar eliminación de edges con tecla Supr
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (
        (event.key === "Delete" || event.key === "Backspace") &&
        selectedEdgeId
      ) {
        event.preventDefault();
        setInitialEdges((prev) =>
          prev.filter((edge) => edge.id !== selectedEdgeId),
        );
        setSelectedEdgeId(null);
        showNotification("Conexión eliminada", "success");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedEdgeId, showNotification]);

  // Función para verificar si un nodo ya tiene una conexión saliente
  const hasOutgoingEdge = useCallback(
    (nodeId) => {
      return initialEdges.some((edge) => edge.source === nodeId);
    },
    [initialEdges],
  );

  // Función para verificar si un nodo ya tiene una conexión entrante
  const hasIncomingEdge = useCallback(
    (nodeId) => {
      return initialEdges.some((edge) => edge.target === nodeId);
    },
    [initialEdges],
  );

  // Función para encontrar el nodo más cercano y determinar la zona de drop
  // Zonas posibles: 'above', 'below', 'branch-true', 'branch-false'
  // Función para encontrar el nodo más cercano y determinar la zona de drop
  // Zonas posibles: 'above', 'below', 'branch-true', 'branch-false'
  const findDropZone = useMemo(() => {
    return (dropY, dropX, excludeNodeId = null) => {
      if (nodes.length === 0) return null;

      let closestNode = null;
      let minDistance = Infinity;
      let dropZone = "below";

      nodes.forEach((node) => {
        if (node.data?.type === "DAG") return;
        if (excludeNodeId && node.id === excludeNodeId) return;

        const nodeHeight =
          node.data?.type === "BranchPythonOperator" ? 120 : 100;
        const nodeWidth = 280;
        const nodeCenterX = node.position.x + nodeWidth / 2;
        const nodeCenterY = node.position.y + nodeHeight / 2;
        const isBranch = node.data?.type === "BranchPythonOperator";

        const distanceX = Math.abs(dropX - nodeCenterX);
        const distanceY = Math.abs(dropY - nodeCenterY);
        const distance = Math.sqrt(
          distanceX * distanceX + distanceY * distanceY,
        );

        if (distance < 300 && distance < minDistance) {
          minDistance = distance;
          closestNode = node;

          if (dropY < nodeCenterY) {
            dropZone = "above";
          } else if (isBranch) {
            dropZone = dropX < nodeCenterX ? "branch-true" : "branch-false";
          } else {
            dropZone = "below";
          }
        }
      });

      return closestNode ? { node: closestNode, zone: dropZone } : null;
    };
  }, [nodes]);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setIsDragging(false);
      setDropZonePreview(null);

      const raw = e.dataTransfer.getData("block");
      if (!raw) return;

      let data;
      try {
        data = JSON.parse(raw);
      } catch (err) {
        console.error("Error parseando drag block:", err);
        showNotification("Error al procesar el bloque", "error");
        return;
      }

      // Obtener posición del drop en coordenadas del flujo
      let dropPosition = { x: 0, y: 0 };
      if (reactFlowInstance.current) {
        const reactFlowBounds = reactFlowInstance.current.getViewport();
        dropPosition = reactFlowInstance.current.screenToFlowPosition({
          x: e.clientX,
          y: e.clientY,
        });
      }

      // Crear nuevo nodo
      const newNodeId = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      // Generar task_id que será usado como nombre del nodo
      // Usar task_id de los parámetros si está disponible, sino usar label o generar uno
      const newTaskId =
        data.parameters?.task_id?.default ||
        data.label ||
        `task_${initialNodes.length + 1}`;
      const newNode = {
        id: newNodeId,
        type: "dagNode",
        data: {
          ...data,
          id: newNodeId,
          task_id: newTaskId,
          // Mostrar parámetros automáticamente al crear un nuevo nodo
          showParameters: true,
          // Guardar definiciones de parámetros para poder editarlos
          parameterDefinitions: data.parameters || {},
          // Inicializar parámetros con valores por defecto
          parameters: data.parameters
            ? Object.entries(data.parameters).reduce((acc, [key, param]) => {
                if (param.default !== undefined) {
                  acc[key] = param.default;
                }
                return acc;
              }, {})
            : {},
          onUpdate: (updatedData) => {
            setInitialNodes((nds) =>
              nds.map((node) =>
                node.id === newNodeId
                  ? { ...node, data: { ...node.data, ...updatedData } }
                  : node,
              ),
            );
          },
          onDelete: handleNodeDelete,
        },
        position: { x: 0, y: 0 },
      };

      // Detectar zona de drop inteligente
      const dropZoneInfo = findDropZone(dropPosition.y, dropPosition.x);
      let newEdges = initialEdges;
      const isBranchOperator = data.type === "BranchPythonOperator";
      const isDAG = data.type === "DAG";

      if (dropZoneInfo && !isDAG) {
        const { node: targetNode, zone } = dropZoneInfo;
        // Validar que no se cree un ciclo
        if (zone === "above") {
          const incomingToTarget = initialEdges.find(
            (e) => e.target === targetNode.id,
          );
          if (
            incomingToTarget &&
            wouldCreateCycle(incomingToTarget.source, newNodeId, initialEdges)
          ) {
            showNotification("No se puede crear: generaría un ciclo", "error");
            return;
          }
        }

        const isTargetBranch = targetNode.data?.type === "BranchPythonOperator";

        // Manejar inserción en ramas de BranchPythonOperator
        if (zone === "branch-true" || zone === "branch-false") {
          const handleId = zone === "branch-true" ? "true" : "false";
          const strokeColor = zone === "branch-true" ? "#22c55e" : "#ef4444"; // Verde o Rojo

          // Buscar si ya hay una conexión desde este handle
          const existingBranchEdge = initialEdges.find(
            (e) => e.source === targetNode.id && e.sourceHandle === handleId,
          );

          if (existingBranchEdge) {
            // Insertar en medio de la rama existente
            newEdges = initialEdges
              .filter((e) => e.id !== existingBranchEdge.id)
              .concat([
                {
                  id: `e${targetNode.id}-${handleId}-${newNodeId}`,
                  source: targetNode.id,
                  sourceHandle: handleId,
                  target: newNodeId,
                  type: "smoothstep",
                  animated: true,
                  style: { stroke: strokeColor, strokeWidth: 2 },
                  markerEnd: {
                    type: MarkerType.ArrowClosed,
                    color: strokeColor,
                  },
                },
                {
                  id: `e${newNodeId}-${existingBranchEdge.target}`,
                  source: newNodeId,
                  target: existingBranchEdge.target,
                  type: "smoothstep",
                  animated: true,
                  style: { stroke: "#64748b", strokeWidth: 2 },
                  markerEnd: { type: MarkerType.ArrowClosed, color: "#64748b" },
                },
              ]);
          } else {
            // Crear nueva conexión desde la rama
            newEdges = [
              ...initialEdges,
              {
                id: `e${targetNode.id}-${handleId}-${newNodeId}`,
                source: targetNode.id,
                sourceHandle: handleId,
                target: newNodeId,
                type: "smoothstep",
                animated: true,
                style: { stroke: strokeColor, strokeWidth: 2 },
                markerEnd: { type: MarkerType.ArrowClosed, color: strokeColor },
              },
            ];
          }
        } else if (zone === "below") {
          // Insertar después del nodo objetivo
          // Para nodos normales (no BranchPythonOperator como target)
          if (!isTargetBranch) {
            const outgoingEdge = initialEdges.find(
              (e) => e.source === targetNode.id,
            );
            if (outgoingEdge) {
              // Si targetNode tiene una conexión saliente, insertar el nuevo nodo en medio
              newEdges = initialEdges
                .filter((e) => e.id !== outgoingEdge.id)
                .concat([
                  {
                    id: `e${targetNode.id}-${newNodeId}`,
                    source: targetNode.id,
                    target: newNodeId,
                    type: "smoothstep",
                    animated: true,
                    style: { stroke: "#64748b", strokeWidth: 2 },
                    markerEnd: {
                      type: MarkerType.ArrowClosed,
                      color: "#64748b",
                    },
                  },
                  {
                    id: `e${newNodeId}-${outgoingEdge.target}`,
                    source: newNodeId,
                    target: outgoingEdge.target,
                    type: "smoothstep",
                    animated: true,
                    style: { stroke: "#64748b", strokeWidth: 2 },
                    markerEnd: {
                      type: MarkerType.ArrowClosed,
                      color: "#64748b",
                    },
                  },
                ]);
            } else {
              // Si no tiene conexión saliente, conectar directamente desde targetNode
              newEdges = [
                ...initialEdges,
                {
                  id: `e${targetNode.id}-${newNodeId}`,
                  source: targetNode.id,
                  target: newNodeId,
                  type: "smoothstep",
                  animated: true,
                  style: { stroke: "#64748b", strokeWidth: 2 },
                  markerEnd: { type: MarkerType.ArrowClosed, color: "#64748b" },
                },
              ];
            }
          }
          // Si es un BranchPythonOperator target con zone='below', no hacer nada aquí
          // porque debería usar branch-true o branch-false
        } else if (zone === "above") {
          // Insertar antes del nodo objetivo
          const targetEdge = initialEdges.find(
            (e) => e.target === targetNode.id,
          );
          if (targetEdge) {
            // Determinar el color basado en si viene de un branch
            const sourceNode = initialNodes.find(
              (n) => n.id === targetEdge.source,
            );
            const isFromBranch =
              sourceNode?.data?.type === "BranchPythonOperator";
            const strokeColor = isFromBranch
              ? targetEdge.sourceHandle === "true"
                ? "#22c55e"
                : targetEdge.sourceHandle === "false"
                  ? "#ef4444"
                  : "#64748b"
              : "#64748b";

            // Redirigir conexión: source -> newNode -> targetNode
            newEdges = initialEdges
              .filter((e) => e.id !== targetEdge.id)
              .concat([
                {
                  id: `e${targetEdge.source}-${targetEdge.sourceHandle || ""}-${newNodeId}`,
                  source: targetEdge.source,
                  sourceHandle: targetEdge.sourceHandle,
                  target: newNodeId,
                  type: "smoothstep",
                  animated: true,
                  style: { stroke: strokeColor, strokeWidth: 2 },
                  markerEnd: {
                    type: MarkerType.ArrowClosed,
                    color: strokeColor,
                  },
                },
                {
                  id: `e${newNodeId}-${targetNode.id}`,
                  source: newNodeId,
                  target: targetNode.id,
                  type: "smoothstep",
                  animated: true,
                  style: { stroke: "#64748b", strokeWidth: 2 },
                  markerEnd: { type: MarkerType.ArrowClosed, color: "#64748b" },
                },
              ]);
          } else {
            // Si targetNode no tiene entrada, conectar desde DAG o último nodo
            const dagNode = initialNodes.find((n) => n.data?.type === "DAG");
            if (dagNode) {
              newEdges = [
                ...initialEdges,
                {
                  id: `e${dagNode.id}-${newNodeId}`,
                  source: dagNode.id,
                  target: newNodeId,
                  type: "smoothstep",
                  animated: true,
                  style: { stroke: "#6366f1", strokeWidth: 2 },
                  markerEnd: { type: MarkerType.ArrowClosed, color: "#6366f1" },
                },
                {
                  id: `e${newNodeId}-${targetNode.id}`,
                  source: newNodeId,
                  target: targetNode.id,
                  type: "smoothstep",
                  animated: true,
                  style: { stroke: "#64748b", strokeWidth: 2 },
                  markerEnd: { type: MarkerType.ArrowClosed, color: "#64748b" },
                },
              ];
            }
          }
        }
      } else if (initialNodes.length > 0 && !isDAG) {
        // Fallback a conexión automática estándar (también aplica para BranchPythonOperator)
        const dagNode = initialNodes.find((node) => node.data?.type === "DAG");

        if (dagNode) {
          newEdges = [
            ...initialEdges,
            {
              id: `e${dagNode.id}-${newNodeId}`,
              source: dagNode.id,
              target: newNodeId,
              type: "smoothstep",
              animated: true,
              style: { stroke: "#6366f1", strokeWidth: 2 },
              markerEnd: {
                type: MarkerType.ArrowClosed,
                color: "#6366f1",
              },
            },
          ];
        } else {
          const lastNodeWithoutConnection = [...initialNodes]
            .reverse()
            .find(
              (node) => !hasOutgoingEdge(node.id) && node.data?.type !== "DAG",
            );

          if (lastNodeWithoutConnection) {
            newEdges = [
              ...initialEdges,
              {
                id: `e${lastNodeWithoutConnection.id}-${newNodeId}`,
                source: lastNodeWithoutConnection.id,
                target: newNodeId,
                type: "smoothstep",
                animated: true,
                style: { stroke: "#64748b", strokeWidth: 2 },
                markerEnd: {
                  type: MarkerType.ArrowClosed,
                  color: "#64748b",
                },
              },
            ];
          }
        }
      }

      setInitialNodes((prev) => {
        const updated = [...prev, newNode];
        return ensureDAGAtStart(updated, handleNodeDelete);
      });
      setInitialEdges(newEdges);
      showNotification("Nodo agregado correctamente", "success");
    },
    [
      initialNodes,
      initialEdges,
      handleNodeDelete,
      findDropZone,
      ensureDAGAtStart,
      showNotification,
    ],
  );

  const onConnect = useCallback(
    (params) => {
      // Validar ciclos
      if (wouldCreateCycle(params.source, params.target, initialEdges)) {
        showNotification("No se puede conectar: crearía un ciclo", "error");
        return;
      }

      const sourceNode = initialNodes.find((n) => n.id === params.source);
      const targetNode = initialNodes.find((n) => n.id === params.target);
      const isDAGTarget = targetNode?.data?.type === "DAG";

      if (isDAGTarget) {
        showNotification("No se puede conectar a un nodo DAG", "error");
        return;
      }

      const isDAGSource = sourceNode?.data?.type === "DAG";
      const isBranch = sourceNode?.data?.type === "BranchPythonOperator";

      setInitialEdges((prev) => {
        let filtered = prev.filter(
          (e) => !(e.target === params.target && e.source !== params.source),
        );

        if (!isDAGSource && !isBranch) {
          filtered = filtered.filter(
            (e) => !(e.source === params.source && e.target !== params.target),
          );
        }

        const exists = filtered.some(
          (e) => e.source === params.source && e.target === params.target,
        );

        if (exists) return filtered;

        const newEdge = {
          ...params,
          id: `e${params.source}-${params.target}`,
          type: "smoothstep",
          animated: true,
          style: {
            stroke: isDAGSource ? "#6366f1" : "#64748b",
            strokeWidth: 2,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: isDAGSource ? "#6366f1" : "#64748b",
          },
        };

        return addEdge(newEdge, filtered);
      });

      showNotification("Conexión creada", "success");
    },
    [initialNodes, initialEdges, showNotification],
  );

  const onEdgesChangeWithSelection = useCallback(
    (changes) => {
      changes.forEach((change) => {
        if (change.type === "select") {
          setSelectedEdgeId(change.selected ? change.id : null);
        } else if (change.type === "remove") {
          setInitialEdges((prev) =>
            prev.filter((edge) => edge.id !== change.id),
          );
          if (selectedEdgeId === change.id) {
            setSelectedEdgeId(null);
          }
        }
      });

      onEdgesChange(changes);
    },
    [onEdgesChange, selectedEdgeId],
  );

  const onDragOver = useCallback(
    (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";

      if (reactFlowInstance.current && nodes.length > 0) {
        const dropPosition = reactFlowInstance.current.screenToFlowPosition({
          x: e.clientX,
          y: e.clientY,
        });

        const dropZoneInfo = findDropZone(dropPosition.y, dropPosition.x);
        setDropZonePreview(
          dropZoneInfo
            ? {
                nodeId: dropZoneInfo.node.id,
                zone: dropZoneInfo.zone,
              }
            : null,
        );
      }
    },
    [nodes, findDropZone],
  );

  const onDragEnter = useCallback(() => {
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const { clientX: x, clientY: y } = e;

    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDragging(false);
      setDropZonePreview(null);
    }
  }, []);

  // Manejar inicio de arrastre de nodo interno
  const onNodeDragStart = useCallback((event, node) => {
    if (node.data?.type === "DAG") return; // No aplicar a DAG
    setIsNodeDragging(true);
    setDraggingNodeId(node.id);
  }, []);

  // Manejar arrastre de nodo interno
  const onNodeDrag = useCallback(
    (event, node) => {
      if (node.data?.type === "DAG") return;

      if (reactFlowInstance.current) {
        const nodeHeight =
          node.data?.type === "BranchPythonOperator" ? 120 : 100;
        const nodeWidth = 280;
        const nodeCenterY = node.position.y + nodeHeight / 2;
        const nodeCenterX = node.position.x + nodeWidth / 2;

        const dropZoneInfo = findDropZone(nodeCenterY, nodeCenterX, node.id);
        setDropZonePreview(
          dropZoneInfo
            ? {
                nodeId: dropZoneInfo.node.id,
                zone: dropZoneInfo.zone,
              }
            : null,
        );
      }
    },
    [findDropZone],
  );

  // Manejar fin de arrastre de nodo interno
  const onNodeDragStop = useCallback(
    (event, node) => {
      if (node.data?.type === "DAG") {
        setIsNodeDragging(false);
        setDraggingNodeId(null);
        setDropZonePreview(null);
        return;
      }

      if (dropZonePreview && dropZonePreview.nodeId !== node.id) {
        const targetNode = nodes.find((n) => n.id === dropZonePreview.nodeId);

        if (targetNode) {
          setInitialEdges((prev) => {
            let newEdges = cleanupMovedNodeConnections(node.id, prev);

            // Validar ciclos antes de reconectar
            if (dropZonePreview.zone === "above") {
              const incoming = prev.find((e) => e.target === targetNode.id);
              if (
                incoming &&
                wouldCreateCycle(incoming.source, node.id, newEdges)
              ) {
                showNotification(
                  "No se puede mover: crearía un ciclo",
                  "error",
                );
                return prev;
              }
              newEdges = reconnectAbove(node.id, targetNode, newEdges, nodes);
            } else if (dropZonePreview.zone === "below") {
              if (wouldCreateCycle(targetNode.id, node.id, newEdges)) {
                showNotification(
                  "No se puede mover: crearía un ciclo",
                  "error",
                );
                return prev;
              }
              newEdges = reconnectBelow(node.id, targetNode, newEdges, nodes);
            } else if (
              dropZonePreview.zone === "branch-true" ||
              dropZonePreview.zone === "branch-false"
            ) {
              const branch =
                dropZonePreview.zone === "branch-true" ? "true" : "false";
              if (wouldCreateCycle(targetNode.id, node.id, newEdges)) {
                showNotification(
                  "No se puede mover: crearía un ciclo",
                  "error",
                );
                return prev;
              }
              newEdges = reconnectBranch(node.id, targetNode, branch, newEdges);
            }

            return newEdges;
          });

          showNotification("Nodo reubicado correctamente", "success");
        }
      }

      setIsNodeDragging(false);
      setDraggingNodeId(null);
      setDropZonePreview(null);
    },
    [dropZonePreview, nodes, showNotification],
  );

  // Función para autoajustar el layout
  const handleAutoLayout = useCallback(() => {
    if (!nodes.length) return;

    const { nodes: layouted, edges: layoutedEdges } = getLayoutedElements(
      nodes,
      edges,
      "TB",
    );

    setNodes(layouted);
    setEdges(layoutedEdges);
    showNotification("Layout ajustado", "success");
  }, [nodes, edges, setNodes, setEdges, showNotification]);

  const expandAllParameters = useCallback(() => {
    setNodes((prev) => {
      const updated = prev.map((n) => ({
        ...n,
        data: { ...n.data, showParameters: true },
      }));

      requestAnimationFrame(() => {
        const { nodes: layouted } = getLayoutedElements(updated, edges, "TB");
        setNodes(layouted);
      });

      return updated;
    });
    showNotification("Parámetros expandidos", "success");
  }, [edges, setNodes, showNotification]);

  const collapseAllParameters = useCallback(() => {
    setNodes((prev) => {
      const updated = prev.map((n) => ({
        ...n,
        data: { ...n.data, showParameters: false },
      }));

      requestAnimationFrame(() => {
        const { nodes: layouted } = getLayoutedElements(updated, edges, "TB");
        setNodes(layouted);
      });

      return updated;
    });
    showNotification("Parámetros contraídos", "success");
  }, [edges, setNodes, showNotification]);

  // Usar initialNodes.length para el contador en lugar de nodes.length
  // porque nodes puede estar desactualizado durante el cálculo del layout
  const nodeCount =
    initialNodes.length > 0 ? initialNodes.length : nodes.length;

  return (
    <div
      className="flex-1 flex flex-col relative bg-gray-50 overflow-hidden"
      style={{ height: "100%" }}
    >
      {/* Notificaciones */}
      {notification && (
        <div
          style={{
            position: "fixed",
            top: "20px",
            right: "20px",
            zIndex: 3000,
            background:
              notification.type === "error"
                ? "#ef4444"
                : notification.type === "warning"
                  ? "#f59e0b"
                  : notification.type === "success"
                    ? "#22c55e"
                    : "#3b82f6",
            color: "#fff",
            padding: "12px 20px",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            fontSize: "14px",
            fontWeight: "500",
          }}
        >
          {notification.message}
        </div>
      )}

      {/* Errores de validación */}
      {validationErrors && !validationErrors.isValid && (
        <div
          style={{
            position: "fixed",
            bottom: "20px",
            left: "20px",
            zIndex: 3000,
            background: "#fef3c7",
            border: "2px solid #f59e0b",
            color: "#92400e",
            padding: "12px 16px",
            borderRadius: "8px",
            maxWidth: "400px",
            fontSize: "12px",
          }}
        >
          <div style={{ fontWeight: "bold", marginBottom: "4px" }}>
            ⚠️ Advertencias de validación:
          </div>
          {validationErrors.hasCycles && (
            <div>• Se detectaron ciclos en el DAG</div>
          )}
          {validationErrors.hasOrphanNodes && (
            <div>
              • {validationErrors.orphanNodes.length} nodo(s) sin conexiones
            </div>
          )}
          {validationErrors.hasMultipleDAGs && (
            <div>• Múltiples nodos DAG detectados</div>
          )}
        </div>
      )}
      {/* Header informativo */}
      <div className="flex-shrink-0 z-10 bg-white/80 backdrop-blur-sm border-b border-gray-200 px-4 py-2 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">DAG Builder</h3>
          <p className="text-xs text-slate-500">
            Arrastra bloques para crear tu DAG
          </p>
        </div>
        <div className="flex items-center gap-2">
          {nodeCount > 0 && (
            <>
              <button
                onClick={expandAllParameters}
                className="text-xs bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-3 py-1.5 rounded-md border border-emerald-300 transition-colors flex items-center gap-1.5"
                title="Expandir parámetros de todos los nodos"
              >
                Expandir
              </button>

              <button
                onClick={collapseAllParameters}
                className="text-xs bg-rose-100 text-rose-700 hover:bg-rose-200 px-3 py-1.5 rounded-md border border-rose-300 transition-colors flex items-center gap-1.5"
                title="Contraer parámetros de todos los nodos"
              >
                Contraer
              </button>

              <button
                onClick={handleAutoLayout}
                className="text-xs bg-indigo-100 text-indigo-700 hover:bg-indigo-200 px-3 py-1.5 rounded-md border border-indigo-300 transition-colors"
                title="Ajustar layout automáticamente"
              >
                Ajustar Layout
              </button>
              <div className="text-xs text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md border border-gray-200">
                <span className="font-medium">{nodeCount}</span>{" "}
                {nodeCount === 1 ? "tarea" : "tareas"}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Canvas de React Flow */}
      <div
        onDrop={handleDrop}
        onDragOver={onDragOver}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        className={`flex-1 w-full relative overflow-hidden transition-all duration-200 ${isDragging ? "bg-indigo-50/50" : ""}`}
        style={{ minHeight: 0, width: "100%" }}
      >
        {initialNodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <span className="material-symbols-outlined text-7xl text-gray-300 mb-4">
              account_tree
            </span>
            <p className="text-lg text-slate-600 font-medium mb-2">
              No hay tareas en el DAG
            </p>
            <p className="text-sm text-slate-500 max-w-md">
              Arrastra bloques de tareas desde el panel izquierdo para comenzar
              a construir tu DAG de Airflow
            </p>
          </div>
        ) : (
          <ReactFlow
            onInit={(instance) => {
              reactFlowInstance.current = instance;
            }}
            nodes={nodes}
            edges={edges}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChangeWithDAGProtection}
            onEdgesChange={onEdgesChangeWithSelection}
            onConnect={onConnect}
            onNodeDragStart={onNodeDragStart}
            onNodeDrag={onNodeDrag}
            onNodeDragStop={onNodeDragStop}
            nodeTypes={nodeTypes}
            connectionLineStyle={connectionLineStyle}
            defaultEdgeOptions={defaultEdgeOptions}
            fitView
            attributionPosition="bottom-left"
            minZoom={0.1}
            maxZoom={2}
            defaultViewport={defaultViewport}
            style={reactFlowStyle}
          >
            <Background color="#e2e8f0" gap={16} />
            <Controls
              showZoom={true}
              showFitView={true}
              showInteractive={true}
              position="top-right"
            />
            <MiniMap
              nodeColor={(node) => {
                const typeColorMap = {
                  DAG: "#6366f1",
                  BashOperator: "#6ee7b7",
                  PythonOperator: "#93c5fd",
                  PythonVirtualenvOperator: "#a5b4fc",
                  PostgresOperator: "#67e8f9",
                  BigQueryOperator: "#c4b5fd",
                  SQLExecuteQueryOperator: "#5eead4",
                  LocalFilesystemToS3Operator: "#fdba74",
                  S3ToS3Operator: "#fcd34d",
                  SFTPOperator: "#7dd3fc",
                  GCSToBigQueryOperator: "#c4b5fd",
                  FileSensor: "#f9a8d4",
                  S3KeySensor: "#fda4af",
                  SqlSensor: "#86efac",
                  HttpSensor: "#fca5a5",
                  DummyOperator: "#d1d5db",
                  BranchPythonOperator: "#fde047",
                  ShortCircuitOperator: "#fcd34d",
                };
                const operatorType = node.data?.type;
                return typeColorMap[operatorType] || "#cbd5e1";
              }}
              maskColor="rgba(0, 0, 0, 0.1)"
              position="bottom-right"
              pannable
              zoomable
            />
          </ReactFlow>
        )}

        {/* Overlay de notificación superior - Indicador de zona de drop */}
        {/* Drop Zone Preview */}
        {(isDragging || isNodeDragging) &&
          dropZonePreview &&
          (() => {
            const node = nodes.find((n) => n.id === dropZonePreview.nodeId);
            if (
              !node ||
              node.data?.type === "DAG" ||
              node.id === draggingNodeId
            )
              return null;

            const targetTaskId =
              node.data?.task_id || node.data?.label || "task";
            const zone = dropZonePreview.zone;

            const info = {
              above: { label: "INSERTAR ANTES", color: "#6366f1", icon: "⬆️" },
              below: {
                label: "INSERTAR DESPUÉS",
                color: "#22c55e",
                icon: "⬇️",
              },
              "branch-true": {
                label: "RAMA TRUE",
                color: "#22c55e",
                icon: "↙️",
              },
              "branch-false": {
                label: "RAMA FALSE",
                color: "#ef4444",
                icon: "↘️",
              },
            }[zone];

            return (
              <div
                style={{
                  position: "absolute",
                  top: "10px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  zIndex: 2000,
                  pointerEvents: "none",
                }}
              >
                <div
                  style={{
                    background: info.color,
                    color: "#fff",
                    padding: "12px 20px",
                    borderRadius: "8px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                    fontSize: "13px",
                    fontWeight: "600",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span style={{ fontSize: "18px" }}>{info.icon}</span>
                  <div>
                    <div>{info.label}</div>
                    <div style={{ fontSize: "11px", opacity: 0.9 }}>
                      → {targetTaskId}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
      </div>
    </div>
  );
}
