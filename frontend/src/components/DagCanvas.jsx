import { useState, useCallback, useEffect, useRef, useMemo, forwardRef, useImperativeHandle } from "react";
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
import DagFlowNode from "./DagFlowNode";
import { saveCanvasState, loadCanvasState, getCanvasPayloadForBackend } from "../utils/storage";
import {
  wouldCreateCycle,
  validateDAG,
  sortNodesWithDAGFirst,
} from "./dagCanvas/graphValidation";
import { getLayoutedElements } from "./dagCanvas/layoutUtils";
import {
  reconnectAbove,
  reconnectBelow,
  reconnectBranch,
  cleanupMovedNodeConnections,
} from "./dagCanvas/edgeReconnection";

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
const ROOT_TYPES = new Set(["DAG", "ArgoWorkflow"]);
const isRootNodeType = (type) => ROOT_TYPES.has(type);
const isRootNode = (node) => isRootNodeType(node?.data?.type);
const isBranchNode = (node) => node?.data?.type === "BranchPythonOperator";

const inferFrameworkFromNodeData = (data) => {
  if (!data) return null;
  if (data.framework === "airflow" || data.platform === "airflow") return "airflow";
  if (data.framework === "argo" || data.platform === "argo") return "argo";
  if (data.type === "DAG") return "airflow";
  if (data.type === "ArgoWorkflow") return "argo";
  return null;
};

const getCanvasFramework = (nodes) => {
  const root = nodes.find(isRootNode);
  if (root) return inferFrameworkFromNodeData(root.data);
  const firstTask = nodes.find((n) => !isRootNode(n));
  return firstTask ? inferFrameworkFromNodeData(firstTask.data) : null;
};

const DagCanvas = forwardRef(function DagCanvas(_, ref) {
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
      setInitialNodes((prev) =>
        sortNodesWithDAGFirst(prev.filter((node) => node.id !== nodeId))
      );
      setInitialEdges((prev) =>
        prev.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
      );
      showNotification("Nodo eliminado correctamente", "success");
    },
    [showNotification],
  );

  // Exponer estado actual y payload para el padre (TopBar, backend) — después de handleNodeDelete
  useImperativeHandle(ref, () => ({
    getNodes: () => initialNodes,
    getEdges: () => initialEdges,
    getPayloadForBackend: () => getCanvasPayloadForBackend(initialNodes, initialEdges),
    setCanvasData: (nodes, edges) => {
      const withCallbacks = (nodes || []).map((node) => ({
        ...node,
        data: {
          ...node.data,
          onUpdate: (updatedData) => {
            setInitialNodes((prev) =>
              prev.map((n) =>
                n.id === node.id ? { ...n, data: { ...n.data, ...updatedData } } : n
              )
            );
          },
          onDelete: handleNodeDelete,
        },
      }));
      setInitialNodes(sortNodesWithDAGFirst(withCallbacks));
      setInitialEdges(edges || []);
    },
  }), [initialNodes, initialEdges, handleNodeDelete]);

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
      setInitialNodes(sortNodesWithDAGFirst(restoredNodes));
      setInitialEdges(savedState.edges || []);
      showNotification("Estado cargado correctamente", "success");
    } else {
      setInitialNodes([]);
      setInitialEdges([]);
    }

    isInitializedRef.current = true;
  }, [handleNodeDelete, showNotification]);

  const onNodesChangeWithDAGProtection = useCallback(
    (changes) => {
      onNodesChange(changes);
    },
    [onNodesChange],
  );

  // Sincronizar estado visible del canvas sin auto-reordenar nodos
  useEffect(() => {
    if (!isInitializedRef.current) return;
    if (initialNodes.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const sortedNodes = sortNodesWithDAGFirst(initialNodes);
    setNodes(sortedNodes);
    setEdges(initialEdges);

    // Validar DAG
    const validation = validateDAG(sortedNodes, initialEdges);
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
        if (
          node.data?.type === "DAG" ||
          node.data?.type === "ArgoWorkflow"
        )
          return;
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

      const existingRoot = initialNodes.find(isRootNode);
      const canvasFramework = getCanvasFramework(initialNodes);
      const droppedFramework = inferFrameworkFromNodeData(data);
      const droppedIsRoot = isRootNodeType(data.type);

      // Reglas de negocio: raíz única y no mezclar frameworks
      if (droppedIsRoot) {
        if (existingRoot) {
          showNotification("Solo se permite un nodo DAG/Workflow por diagrama", "error");
          return;
        }
        if (initialNodes.some((n) => !isRootNode(n))) {
          showNotification("El DAG/Workflow debe crearse antes de agregar tasks", "error");
          return;
        }
        if (canvasFramework && droppedFramework && canvasFramework !== droppedFramework) {
          showNotification("No se puede mezclar Airflow con Argo en el mismo flujo", "error");
          return;
        }
      } else {
        if (!existingRoot) {
          showNotification("Primero agrega el nodo DAG/Workflow al flujo", "error");
          return;
        }
        if (canvasFramework && droppedFramework && canvasFramework !== droppedFramework) {
          showNotification("La task no corresponde al framework del flujo actual", "error");
          return;
        }
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
      const parameterDefinitions = data.parameterDefinitions || data.parameters || {};

      const newTaskId =
        parameterDefinitions?.task_id?.default ||
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
          parameterDefinitions,
          // Inicializar parámetros con valores por defecto
          parameters: parameterDefinitions
            ? Object.entries(parameterDefinitions).reduce((acc, [key, param]) => {
                if (param && typeof param === "object" && param.default !== undefined) {
                  acc[key] = param.default;
                } else if (param !== undefined && param !== null && typeof param !== "object") {
                  acc[key] = param;
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
        position: { x: dropPosition.x, y: dropPosition.y },
      };

      // Detectar zona de drop inteligente
      const dropZoneInfo = findDropZone(dropPosition.y, dropPosition.x);
      let newEdges = initialEdges;
      const isDAG =
        data.type === "DAG" || data.type === "ArgoWorkflow";

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
            const dagNode = initialNodes.find(
              (n) =>
                n.data?.type === "DAG" || n.data?.type === "ArgoWorkflow"
            );
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
        // Fallback: si no cae en zona, conectar al final del workflow
        const dagNode = initialNodes.find(
          (node) =>
            node.data?.type === "DAG" || node.data?.type === "ArgoWorkflow"
        );
        const lastPlacedNode = [...initialNodes]
          .reverse()
          .find((node) => !isRootNode(node));

        const terminalTask = [...initialNodes]
          .reverse()
          .find(
            (node) =>
              !isRootNode(node) &&
              !isBranchNode(node) &&
              !hasOutgoingEdge(node.id),
          );

        if (lastPlacedNode && isBranchNode(lastPlacedNode)) {
          const branchTrueEdge = initialEdges.find(
            (e) => e.source === lastPlacedNode.id && e.sourceHandle === "true",
          );

          if (branchTrueEdge) {
            // Rama true ocupada: insertar en medio por defecto
            newEdges = initialEdges
              .filter((e) => e.id !== branchTrueEdge.id)
              .concat([
                {
                  id: `e${lastPlacedNode.id}-true-${newNodeId}`,
                  source: lastPlacedNode.id,
                  sourceHandle: "true",
                  target: newNodeId,
                  type: "smoothstep",
                  animated: true,
                  style: { stroke: "#22c55e", strokeWidth: 2 },
                  markerEnd: { type: MarkerType.ArrowClosed, color: "#22c55e" },
                },
                {
                  id: `e${newNodeId}-${branchTrueEdge.target}`,
                  source: newNodeId,
                  target: branchTrueEdge.target,
                  type: "smoothstep",
                  animated: true,
                  style: { stroke: "#64748b", strokeWidth: 2 },
                  markerEnd: { type: MarkerType.ArrowClosed, color: "#64748b" },
                },
              ]);
          } else {
            // Rama true libre: conectar por defecto en true
            newEdges = [
              ...initialEdges,
              {
                id: `e${lastPlacedNode.id}-true-${newNodeId}`,
                source: lastPlacedNode.id,
                sourceHandle: "true",
                target: newNodeId,
                type: "smoothstep",
                animated: true,
                style: { stroke: "#22c55e", strokeWidth: 2 },
                markerEnd: { type: MarkerType.ArrowClosed, color: "#22c55e" },
              },
            ];
          }
        } else if (terminalTask) {
          newEdges = [
            ...initialEdges,
            {
              id: `e${terminalTask.id}-${newNodeId}`,
              source: terminalTask.id,
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
        } else if (dagNode && !hasIncomingEdge(newNodeId)) {
          // Primer task después del nodo raíz
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
        }
      }

      setInitialNodes((prev) =>
        sortNodesWithDAGFirst([...prev, newNode])
      );
      setInitialEdges(newEdges);
      showNotification("Nodo agregado correctamente", "success");
    },
    [
      initialNodes,
      initialEdges,
      handleNodeDelete,
      findDropZone,
      hasOutgoingEdge,
      hasIncomingEdge,
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
      const sourceFramework = inferFrameworkFromNodeData(sourceNode?.data);
      const targetFramework = inferFrameworkFromNodeData(targetNode?.data);
      const isDAGTarget =
        targetNode?.data?.type === "DAG" ||
        targetNode?.data?.type === "ArgoWorkflow";

      if (isDAGTarget) {
        showNotification(
          "No se puede conectar a un nodo DAG/Workflow",
          "error"
        );
        return;
      }

      const isDAGSource =
        sourceNode?.data?.type === "DAG" ||
        sourceNode?.data?.type === "ArgoWorkflow";
      const isBranch = sourceNode?.data?.type === "BranchPythonOperator";

      if (
        sourceFramework &&
        targetFramework &&
        sourceFramework !== targetFramework
      ) {
        showNotification("No se pueden conectar nodos de frameworks distintos", "error");
        return;
      }

      setInitialEdges((prev) => {
        const sameHandleExists = prev.some(
          (e) =>
            e.source === params.source &&
            (e.sourceHandle || "") === (params.sourceHandle || ""),
        );
        if (isBranch && sameHandleExists) {
          showNotification("Cada rama (true/false) solo puede tener una conexión", "error");
          return prev;
        }

        const sourceHasOutgoing = prev.some((e) => e.source === params.source);
        if (!isDAGSource && !isBranch && sourceHasOutgoing) {
          showNotification("Esta task ya tiene una conexión de salida", "error");
          return prev;
        }

        const targetHasIncoming = prev.some((e) => e.target === params.target);
        if (targetHasIncoming) {
          showNotification("Esta task ya tiene una conexión de entrada", "error");
          return prev;
        }

        const exists = prev.some(
          (e) => e.source === params.source && e.target === params.target,
        );

        if (exists) return prev;

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

        return addEdge(newEdge, prev);
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
    if (
      node.data?.type === "DAG" ||
      node.data?.type === "ArgoWorkflow"
    )
      return;
    setIsNodeDragging(true);
    setDraggingNodeId(node.id);
  }, []);

  // Manejar arrastre de nodo interno
  const onNodeDrag = useCallback(
    (event, node) => {
      if (
        node.data?.type === "DAG" ||
        node.data?.type === "ArgoWorkflow"
      )
        return;

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
      if (
        node.data?.type === "DAG" ||
        node.data?.type === "ArgoWorkflow"
      ) {
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
              newEdges = reconnectBelow(node.id, targetNode, newEdges);
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
      } else {
        // Si no cae en zona válida:
        // - Nodos con edges: no reordenar automáticamente (solo dropzones válidas)
        // - Nodos sin edges: aplicar fallback al final del flujo
        setInitialEdges((prev) => {
          const nodeHasAnyEdge = prev.some(
            (e) => e.source === node.id || e.target === node.id,
          );

          if (nodeHasAnyEdge) {
            showNotification(
              "Nodo conectado: usa una zona válida (antes/después/rama) para reordenar",
              "warning",
            );
            return prev;
          }

          let newEdges = cleanupMovedNodeConnections(node.id, prev);
          const lastPlacedNode = [...nodes]
            .filter((n) => n.id !== node.id && !isRootNode(n))
            .reverse()
            .find(() => true);

          const terminalTask = [...nodes]
            .filter((n) => n.id !== node.id && !isRootNode(n) && !isBranchNode(n))
            .reverse()
            .find((n) => !newEdges.some((e) => e.source === n.id));

          if (lastPlacedNode && isBranchNode(lastPlacedNode)) {
            const branchTrueEdge = newEdges.find(
              (e) => e.source === lastPlacedNode.id && e.sourceHandle === "true",
            );

            if (
              branchTrueEdge &&
              branchTrueEdge.target !== node.id &&
              !wouldCreateCycle(lastPlacedNode.id, node.id, newEdges) &&
              !wouldCreateCycle(node.id, branchTrueEdge.target, newEdges)
            ) {
              newEdges = newEdges
                .filter((e) => e.id !== branchTrueEdge.id)
                .concat([
                  {
                    id: `e${lastPlacedNode.id}-true-${node.id}`,
                    source: lastPlacedNode.id,
                    sourceHandle: "true",
                    target: node.id,
                    type: "smoothstep",
                    animated: true,
                    style: { stroke: "#22c55e", strokeWidth: 2 },
                    markerEnd: { type: MarkerType.ArrowClosed, color: "#22c55e" },
                  },
                  {
                    id: `e${node.id}-${branchTrueEdge.target}`,
                    source: node.id,
                    target: branchTrueEdge.target,
                    type: "smoothstep",
                    animated: true,
                    style: { stroke: "#64748b", strokeWidth: 2 },
                    markerEnd: { type: MarkerType.ArrowClosed, color: "#64748b" },
                  },
                ]);
            } else if (
              !branchTrueEdge &&
              !wouldCreateCycle(lastPlacedNode.id, node.id, newEdges)
            ) {
              newEdges = [
                ...newEdges,
                {
                  id: `e${lastPlacedNode.id}-true-${node.id}`,
                  source: lastPlacedNode.id,
                  sourceHandle: "true",
                  target: node.id,
                  type: "smoothstep",
                  animated: true,
                  style: { stroke: "#22c55e", strokeWidth: 2 },
                  markerEnd: { type: MarkerType.ArrowClosed, color: "#22c55e" },
                },
              ];
            }
          } else if (
            terminalTask &&
            !wouldCreateCycle(terminalTask.id, node.id, newEdges)
          ) {
            newEdges = [
              ...newEdges,
              {
                id: `e${terminalTask.id}-${node.id}`,
                source: terminalTask.id,
                target: node.id,
                type: "smoothstep",
                animated: true,
                style: { stroke: "#64748b", strokeWidth: 2 },
                markerEnd: { type: MarkerType.ArrowClosed, color: "#64748b" },
              },
            ];
          } else {
            // Caso borde: si no hay task terminal disponible, volver a enlazar desde la raíz
            const rootNode = nodes.find((n) => isRootNode(n));
            const alreadyHasIncoming = newEdges.some((e) => e.target === node.id);
            if (
              rootNode &&
              !alreadyHasIncoming &&
              !wouldCreateCycle(rootNode.id, node.id, newEdges)
            ) {
              newEdges = [
                ...newEdges,
                {
                  id: `e${rootNode.id}-${node.id}`,
                  source: rootNode.id,
                  target: node.id,
                  type: "smoothstep",
                  animated: true,
                  style: { stroke: "#6366f1", strokeWidth: 2 },
                  markerEnd: { type: MarkerType.ArrowClosed, color: "#6366f1" },
                },
              ];
            }
          }

          // Garantía final: no dejar el nodo sin conexión de entrada
          if (!newEdges.some((e) => e.target === node.id)) {
            const rootNode = nodes.find((n) => isRootNode(n));
            if (
              rootNode &&
              !wouldCreateCycle(rootNode.id, node.id, newEdges)
            ) {
              newEdges = [
                ...newEdges,
                {
                  id: `e${rootNode.id}-${node.id}`,
                  source: rootNode.id,
                  target: node.id,
                  type: "smoothstep",
                  animated: true,
                  style: { stroke: "#6366f1", strokeWidth: 2 },
                  markerEnd: { type: MarkerType.ArrowClosed, color: "#6366f1" },
                },
              ];
            }
          }

          return newEdges;
        });
      }

      setIsNodeDragging(false);
      setDraggingNodeId(null);
      setDropZonePreview(null);
    },
    [dropZonePreview, nodes, showNotification],
  );

  // Función para autoajustar el layout
  const handleAutoLayout = useCallback(() => {
    if (!initialNodes.length) return;

    const { nodes: layouted, edges: layoutedEdges } = getLayoutedElements(
      sortNodesWithDAGFirst(initialNodes),
      initialEdges,
      "TB",
    );

    setInitialNodes(layouted);
    setInitialEdges(layoutedEdges);
    setNodes(layouted);
    setEdges(layoutedEdges);
    requestAnimationFrame(() => {
      reactFlowInstance.current?.fitView({ padding: 0.2, duration: 300 });
    });
    showNotification("Layout ajustado", "success");
  }, [initialNodes, initialEdges, setNodes, setEdges, showNotification]);

  const expandAllParameters = useCallback(() => {
    const nextNodes = initialNodes.map((n) => ({
      ...n,
      data: { ...n.data, showParameters: true },
    }));

    const { nodes: layouted, edges: layoutedEdges } = getLayoutedElements(
      sortNodesWithDAGFirst(nextNodes),
      initialEdges,
      "TB",
    );

    setInitialNodes(layouted);
    setInitialEdges(layoutedEdges);
    setNodes(layouted);
    setEdges(layoutedEdges);
    requestAnimationFrame(() => {
      reactFlowInstance.current?.fitView({ padding: 0.2, duration: 250 });
    });
    showNotification("Parámetros expandidos", "success");
  }, [initialNodes, initialEdges, setNodes, setEdges, showNotification]);

  const collapseAllParameters = useCallback(() => {
    const nextNodes = initialNodes.map((n) => ({
      ...n,
      data: { ...n.data, showParameters: false },
    }));

    const { nodes: layouted, edges: layoutedEdges } = getLayoutedElements(
      sortNodesWithDAGFirst(nextNodes),
      initialEdges,
      "TB",
    );

    setInitialNodes(layouted);
    setInitialEdges(layoutedEdges);
    setNodes(layouted);
    setEdges(layoutedEdges);
    requestAnimationFrame(() => {
      reactFlowInstance.current?.fitView({ padding: 0.2, duration: 250 });
    });
    showNotification("Parámetros contraídos", "success");
  }, [initialNodes, initialEdges, setNodes, setEdges, showNotification]);

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
      {/* Header informativo (z-20 para quedar siempre encima del canvas y no bloquear clics) */}
      <div className="flex-shrink-0 relative z-20 bg-white/80 backdrop-blur-sm border-b border-gray-200 px-3 sm:px-4 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">DAG Builder</h3>
          <p className="text-xs text-slate-500">
            Arrastra bloques para crear tu DAG
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
                  ArgoWorkflow: "#8b5cf6",
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
              node.data?.type === "ArgoWorkflow" ||
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
});

export default DagCanvas;
