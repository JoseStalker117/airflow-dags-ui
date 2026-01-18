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

    // DAG
    dagreGraph.setNode(dagId, {
      width: 460,
      height: 180,
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
  const isInitialLoad = useRef(true);
  const saveTimeoutRef = useRef(null);
  const reactFlowInstance = useRef(null);

  const handleNodeDelete = useCallback((nodeId) => {
    setInitialNodes((nds) => nds.filter((node) => node.id !== nodeId));
    setInitialEdges((eds) =>
      eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
    );
  }, []);

  // Cargar estado guardado al montar el componente
  useEffect(() => {
    const savedState = loadCanvasState();
    if (savedState && savedState.nodes && savedState.nodes.length > 0) {
      // Restaurar nodos con sus funciones onUpdate/onDelete
      const restoredNodes = savedState.nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          onUpdate: (updatedData) => {
            setInitialNodes((nds) =>
              nds.map((n) =>
                n.id === node.id
                  ? { ...n, data: { ...n.data, ...updatedData } }
                  : n,
              ),
            );
          },
          onDelete: handleNodeDelete,
        },
      }));

      setInitialNodes(restoredNodes);
      setInitialEdges(savedState.edges || []);
    }
    // Marcar como cargado después de un pequeño delay para permitir que React procese
    setTimeout(() => {
      isInitialLoad.current = false;
    }, 100);
  }, [handleNodeDelete]);

  // Función para actualizar layout cuando cambian los nodos o edges
  useEffect(() => {
    // Si está cargando inicialmente y no hay nodos, esperar
    // Pero si hay nodos (aunque sea carga inicial), calcular layout
    if (isInitialLoad.current && initialNodes.length === 0) {
      return; // Esperar a que termine la carga inicial solo si no hay nodos
    }

    // Calcular layout solo si hay nodos
    if (initialNodes.length > 0) {
      const { nodes: layoutedNodes, edges: layoutedEdges } =
        getLayoutedElements(initialNodes, initialEdges, "TB");
      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
    } else {
      // Si no hay nodos, limpiar el estado
      setNodes([]);
      setEdges([]);
    }
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  // Auto-guardar cuando cambian los nodos o edges (con debounce)
  useEffect(() => {
    if (isInitialLoad.current) {
      return;
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      const saved = saveCanvasState(initialNodes, initialEdges);
      if (saved) {
        console.log("✅ Canvas guardado en localStorage:", {
          nodes: initialNodes.length,
          edges: initialEdges.length,
        });
      }
    }, 500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [initialNodes, initialEdges]);

  // Manejar eliminación de edges con tecla Supr
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (
        (event.key === "Delete" || event.key === "Backspace") &&
        selectedEdgeId
      ) {
        event.preventDefault();
        setInitialEdges((eds) =>
          eds.filter((edge) => edge.id !== selectedEdgeId),
        );
        setSelectedEdgeId(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedEdgeId]);

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
  const findDropZone = useCallback(
    (dropY, dropX, excludeNodeId = null) => {
      if (nodes.length === 0) return null;

      let closestNode = null;
      let minDistance = Infinity;
      let dropZone = "below"; // 'above', 'below', 'branch-true', 'branch-false'

      nodes.forEach((node) => {
        if (node.data?.type === "DAG") return; // Ignorar DAG
        if (excludeNodeId && node.id === excludeNodeId) return; // Ignorar el nodo que se está arrastrando

        const nodeY = node.position.y;
        const nodeHeight =
          node.data?.type === "BranchPythonOperator" ? 120 : 100;
        const nodeX = node.position.x;
        const nodeWidth = 280;
        const nodeCenterX = nodeX + nodeWidth / 2;
        const nodeCenterY = nodeY + nodeHeight / 2;
        const isBranch = node.data?.type === "BranchPythonOperator";

        // Calcular distancia euclidiana al centro del nodo
        const distanceX = Math.abs(dropX - nodeCenterX);
        const distanceY = Math.abs(dropY - nodeCenterY);
        const distance = Math.sqrt(
          distanceX * distanceX + distanceY * distanceY,
        );

        // Solo considerar nodos dentro de un rango razonable (300px)
        if (distance < 300 && distance < minDistance) {
          minDistance = distance;
          closestNode = node;

          // Determinar zona basada en posición relativa
          if (dropY < nodeCenterY) {
            dropZone = "above";
          } else if (isBranch) {
            // Para BranchPythonOperator, determinar si es rama true (izquierda) o false (derecha)
            // Los handles están en 40% (true) y 60% (false) del ancho
            const trueHandleX = nodeX + nodeWidth * 0.4;
            const falseHandleX = nodeX + nodeWidth * 0.6;

            // Si está debajo del nodo, determinar qué rama
            if (dropX < nodeCenterX) {
              dropZone = "branch-true"; // Lado izquierdo = true (verde)
            } else {
              dropZone = "branch-false"; // Lado derecho = false (rojo)
            }
          } else {
            dropZone = "below";
          }
        }
      });

      return closestNode ? { node: closestNode, zone: dropZone } : null;
    },
    [nodes],
  );

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
        console.error("Error parseando drag block:", raw, err);
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
      const newNode = {
        id: newNodeId,
        type: "dagNode",
        data: {
          ...data,
          id: newNodeId,
          task_id:
            `${data.id}_${Date.now()}` || `task_${initialNodes.length + 1}`,
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

      setInitialNodes((nds) => [...nds, newNode]);
      setInitialEdges(newEdges);
    },
    [
      initialNodes,
      initialEdges,
      handleNodeDelete,
      hasOutgoingEdge,
      nodes,
      findDropZone,
    ],
  );

  const onConnect = useCallback(
    (params) => {
      // Verificar si el nodo origen ya tiene una conexión saliente (excepto branches y DAG)
      const sourceNode = initialNodes.find((n) => n.id === params.source);
      const isBranch = sourceNode?.data?.type === "BranchPythonOperator";
      const isDAGSource = sourceNode?.data?.type === "DAG";

      // Verificar si el nodo destino ya tiene una conexión entrante
      const targetNode = initialNodes.find((n) => n.id === params.target);
      const isDAGTarget = targetNode?.data?.type === "DAG";

      // Prevenir conexiones a un DAG (no tiene handle de entrada)
      if (isDAGTarget) {
        console.warn("No se puede conectar nada a un nodo DAG");
        return;
      }

      // Remover conexiones anteriores antes de crear la nueva
      setInitialEdges((eds) => {
        // Remover conexión anterior del target (si existe y viene de otro source)
        let filteredEdges = eds.filter(
          (edge) =>
            !(edge.target === params.target && edge.source !== params.source),
        );

        // Remover conexión anterior del source (excepto branches y DAG que permiten múltiples)
        if (!isDAGSource && !isBranch) {
          filteredEdges = filteredEdges.filter(
            (edge) =>
              !(edge.source === params.source && edge.target !== params.target),
          );
        }

        // Verificar si ya existe esta conexión
        const exists = filteredEdges.some(
          (edge) =>
            edge.source === params.source && edge.target === params.target,
        );

        if (exists) {
          return filteredEdges;
        }

        // Crear nueva conexión
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

        return addEdge(newEdge, filteredEdges);
      });
    },
    [initialNodes, hasOutgoingEdge, hasIncomingEdge],
  );

  const onEdgesChangeWithSelection = useCallback(
    (changes) => {
      // Procesar cambios de edges
      changes.forEach((change) => {
        if (change.type === "select") {
          if (change.selected) {
            setSelectedEdgeId(change.id);
          } else {
            setSelectedEdgeId(null);
          }
        } else if (change.type === "remove") {
          // Sincronizar eliminación con initialEdges inmediatamente
          setInitialEdges((eds) => {
            const filtered = eds.filter((edge) => edge.id !== change.id);
            return filtered;
          });
          if (selectedEdgeId === change.id) {
            setSelectedEdgeId(null);
          }
        }
      });

      // Permitir que React Flow maneje los cambios internos DESPUÉS de actualizar initialEdges
      onEdgesChange(changes);
    },
    [onEdgesChange, selectedEdgeId],
  );

  const onDragOver = useCallback(
    (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";

      // Actualizar preview de zona de drop
      if (reactFlowInstance.current && nodes.length > 0) {
        const dropPosition = reactFlowInstance.current.screenToFlowPosition({
          x: e.clientX,
          y: e.clientY,
        });

        const dropZoneInfo = findDropZone(dropPosition.y, dropPosition.x);
        if (dropZoneInfo) {
          setDropZonePreview({
            nodeId: dropZoneInfo.node.id,
            zone: dropZoneInfo.zone,
          });
        } else {
          setDropZonePreview(null);
        }
      }
    },
    [nodes, findDropZone],
  );

  const onDragEnter = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e) => {
    // Solo desactivar si salimos completamente del área de drop
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;

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
        // Usar el centro del nodo como punto de referencia
        const nodeCenterY = node.position.y + nodeHeight / 2;
        const nodeCenterX = node.position.x + nodeWidth / 2;

        const dropZoneInfo = findDropZone(nodeCenterY, nodeCenterX, node.id);
        if (dropZoneInfo) {
          setDropZonePreview({
            nodeId: dropZoneInfo.node.id,
            zone: dropZoneInfo.zone,
          });
        } else {
          setDropZonePreview(null);
        }
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

      // Si hay una zona de drop activa, reconectar el nodo
      if (dropZonePreview && dropZonePreview.nodeId !== node.id) {
        const targetNode = nodes.find((n) => n.id === dropZonePreview.nodeId);
        if (targetNode) {
          setInitialEdges((eds) => {
            // Encontrar las conexiones actuales del nodo que se está moviendo
            const incomingToMovedNode = eds.find((e) => e.target === node.id);
            const outgoingFromMovedNode = eds.find((e) => e.source === node.id);

            // Paso 1: Reconectar los nodos que estaban conectados al nodo movido
            // Si el nodo movido tenía un nodo anterior y uno posterior, conectarlos entre sí
            let newEdges = eds.filter(
              (e) => e.source !== node.id && e.target !== node.id,
            );

            if (incomingToMovedNode && outgoingFromMovedNode) {
              // El nodo movido estaba en medio de una cadena, reconectar la cadena
              const sourceOfMoved = incomingToMovedNode.source;
              const targetOfMoved = outgoingFromMovedNode.target;
              const sourceHandle = incomingToMovedNode.sourceHandle;

              // Verificar que no estemos creando un ciclo o conexión redundante
              if (sourceOfMoved !== targetOfMoved) {
                // Verificar si ya existe esta conexión
                const connectionExists = newEdges.some(
                  (e) =>
                    e.source === sourceOfMoved &&
                    e.target === targetOfMoved &&
                    e.sourceHandle === sourceHandle,
                );
                if (!connectionExists) {
                  // Determinar el color basado en si el source es DAG o Branch
                  const sourceNodeData = nodes.find(
                    (n) => n.id === sourceOfMoved,
                  );
                  const isFromDAG = sourceNodeData?.data?.type === "DAG";
                  const isFromBranch =
                    sourceNodeData?.data?.type === "BranchPythonOperator";
                  let strokeColor = "#64748b";
                  if (isFromDAG) strokeColor = "#6366f1";
                  else if (isFromBranch) {
                    strokeColor =
                      sourceHandle === "true"
                        ? "#22c55e"
                        : sourceHandle === "false"
                          ? "#ef4444"
                          : "#64748b";
                  }

                  newEdges.push({
                    id: `e${sourceOfMoved}-${sourceHandle || ""}-${targetOfMoved}`,
                    source: sourceOfMoved,
                    sourceHandle: sourceHandle,
                    target: targetOfMoved,
                    type: "smoothstep",
                    animated: true,
                    style: { stroke: strokeColor, strokeWidth: 2 },
                    markerEnd: {
                      type: MarkerType.ArrowClosed,
                      color: strokeColor,
                    },
                  });
                }
              }
            }

            // Paso 2: Insertar el nodo movido en la nueva posición
            if (dropZonePreview.zone === "above") {
              // Insertar antes del nodo objetivo
              const incomingToTarget = eds.find(
                (e) => e.target === targetNode.id,
              );

              if (incomingToTarget) {
                // Hay una conexión entrante al target, insertar en medio
                // Remover la conexión entrante al target (si no fue ya removida)
                newEdges = newEdges.filter((e) => e.id !== incomingToTarget.id);

                // Determinar color basado en si viene de DAG o Branch
                const sourceNodeData = nodes.find(
                  (n) => n.id === incomingToTarget.source,
                );
                const isFromDAG = sourceNodeData?.data?.type === "DAG";
                const isFromBranch =
                  sourceNodeData?.data?.type === "BranchPythonOperator";
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

                // Conectar source original -> nodo movido
                newEdges.push({
                  id: `e${incomingToTarget.source}-${incomingToTarget.sourceHandle || ""}-${node.id}`,
                  source: incomingToTarget.source,
                  sourceHandle: incomingToTarget.sourceHandle,
                  target: node.id,
                  type: "smoothstep",
                  animated: true,
                  style: { stroke: strokeColor, strokeWidth: 2 },
                  markerEnd: {
                    type: MarkerType.ArrowClosed,
                    color: strokeColor,
                  },
                });
              }

              // Conectar nodo movido -> target
              newEdges.push({
                id: `e${node.id}-${targetNode.id}`,
                source: node.id,
                target: targetNode.id,
                type: "smoothstep",
                animated: true,
                style: { stroke: "#64748b", strokeWidth: 2 },
                markerEnd: { type: MarkerType.ArrowClosed, color: "#64748b" },
              });
            } else if (
              dropZonePreview.zone === "branch-true" ||
              dropZonePreview.zone === "branch-false"
            ) {
              // Insertar en una rama de BranchPythonOperator
              const handleId =
                dropZonePreview.zone === "branch-true" ? "true" : "false";
              const strokeColor =
                dropZonePreview.zone === "branch-true" ? "#22c55e" : "#ef4444";

              // Buscar si ya hay una conexión desde este handle
              const existingBranchEdge = eds.find(
                (e) =>
                  e.source === targetNode.id && e.sourceHandle === handleId,
              );

              if (existingBranchEdge) {
                // Insertar en medio de la rama existente
                newEdges = newEdges.filter(
                  (e) => e.id !== existingBranchEdge.id,
                );

                // Conectar nodo movido al destino original
                newEdges.push({
                  id: `e${node.id}-${existingBranchEdge.target}`,
                  source: node.id,
                  target: existingBranchEdge.target,
                  type: "smoothstep",
                  animated: true,
                  style: { stroke: "#64748b", strokeWidth: 2 },
                  markerEnd: { type: MarkerType.ArrowClosed, color: "#64748b" },
                });
              }

              // Conectar branch -> nodo movido
              newEdges.push({
                id: `e${targetNode.id}-${handleId}-${node.id}`,
                source: targetNode.id,
                sourceHandle: handleId,
                target: node.id,
                type: "smoothstep",
                animated: true,
                style: { stroke: strokeColor, strokeWidth: 2 },
                markerEnd: { type: MarkerType.ArrowClosed, color: strokeColor },
              });
            } else if (dropZonePreview.zone === "below") {
              // Insertar después del nodo objetivo (solo para nodos normales)
              const isTargetBranch =
                targetNode.data?.type === "BranchPythonOperator";

              if (!isTargetBranch) {
                const outgoingFromTarget = eds.find(
                  (e) => e.source === targetNode.id,
                );

                if (outgoingFromTarget) {
                  // Hay una conexión saliente del target, insertar en medio
                  // Remover la conexión saliente del target (si no fue ya removida)
                  newEdges = newEdges.filter(
                    (e) => e.id !== outgoingFromTarget.id,
                  );

                  // Conectar nodo movido -> target original
                  newEdges.push({
                    id: `e${node.id}-${outgoingFromTarget.target}`,
                    source: node.id,
                    target: outgoingFromTarget.target,
                    type: "smoothstep",
                    animated: true,
                    style: { stroke: "#64748b", strokeWidth: 2 },
                    markerEnd: {
                      type: MarkerType.ArrowClosed,
                      color: "#64748b",
                    },
                  });
                }

                // Determinar color basado en si el target es DAG
                const isTargetDAG = targetNode.data?.type === "DAG";
                const strokeColor = isTargetDAG ? "#6366f1" : "#64748b";

                // Conectar target -> nodo movido
                newEdges.push({
                  id: `e${targetNode.id}-${node.id}`,
                  source: targetNode.id,
                  target: node.id,
                  type: "smoothstep",
                  animated: true,
                  style: { stroke: strokeColor, strokeWidth: 2 },
                  markerEnd: {
                    type: MarkerType.ArrowClosed,
                    color: strokeColor,
                  },
                });
              }
            }

            return newEdges;
          });
        }
      }

      setIsNodeDragging(false);
      setDraggingNodeId(null);
      setDropZonePreview(null);
    },
    [dropZonePreview, nodes],
  );

  // Función para autoajustar el layout
  const handleAutoLayout = useCallback(
    (customNodes, customEdges) => {
      if (!customNodes?.length) return;

      const { nodes: layoutedNodes, edges: layoutedEdges } =
        getLayoutedElements(customNodes, customEdges, "TB");

      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
    },
    [setNodes, setEdges],
  );

  const expandAllParameters = () => {
    setNodes((prev) => {
      const updated = prev.map((n) => ({
        ...n,
        data: {
          ...n.data,
          showParameters: true,
        },
      }));

      requestAnimationFrame(() => {
        handleAutoLayout(updated, edges);
      });

      return updated;
    });
  };

  const collapseAllParameters = () => {
    setNodes((prev) => {
      const updated = prev.map((n) => ({
        ...n,
        data: {
          ...n.data,
          showParameters: false,
        },
      }));

      requestAnimationFrame(() => {
        handleAutoLayout(updated, edges);
      });

      return updated;
    });
  };

  // Usar initialNodes.length para el contador en lugar de nodes.length
  // porque nodes puede estar desactualizado durante el cálculo del layout
  const nodeCount =
    initialNodes.length > 0 ? initialNodes.length : nodes.length;

  return (
    <div
      className="flex-1 flex flex-col relative bg-gray-50 overflow-hidden"
      style={{ height: "100%" }}
    >
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
                onClick={() => handleAutoLayout(nodes, edges)}
                className="text-xs bg-indigo-100 text-indigo-700 hover:bg-indigo-200 px-3 py-1.5 rounded-md border border-indigo-300 transition-colors flex items-center gap-1.5"
                title="Ajustar layout automáticamente"
              >
                <span className="material-symbols-outlined text-sm">
                  account_tree
                </span>
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
            onNodesChange={onNodesChange}
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

            const isActiveAbove = dropZonePreview.zone === "above";
            const isActiveBelow = dropZonePreview.zone === "below";
            const isActiveBranchTrue = dropZonePreview.zone === "branch-true";
            const isActiveBranchFalse = dropZonePreview.zone === "branch-false";

            // Obtener el nombre del nodo objetivo
            const targetTaskId =
              node.data?.task_id || node.data?.label || "task";

            // Generar el texto del comando según la zona
            const getCommandText = () => {
              if (isActiveAbove) return `new_task >> ${targetTaskId}`;
              if (isActiveBelow) return `${targetTaskId} >> new_task`;
              if (isActiveBranchTrue)
                return `${targetTaskId}.set_downstream(new_task, branch='true')`;
              if (isActiveBranchFalse)
                return `${targetTaskId}.set_downstream(new_task, branch='false')`;
              return "";
            };

            // Determinar color principal
            const getColor = () => {
              if (isActiveAbove) return { bg: "#6366f1", light: "#818cf8" };
              if (isActiveBelow) return { bg: "#22c55e", light: "#4ade80" };
              if (isActiveBranchTrue)
                return { bg: "#22c55e", light: "#4ade80" };
              if (isActiveBranchFalse)
                return { bg: "#ef4444", light: "#f87171" };
              return { bg: "#64748b", light: "#94a3b8" };
            };

            // Determinar etiqueta y descripción
            const getInfo = () => {
              if (isActiveAbove)
                return {
                  label: "INSERTAR ANTES",
                  desc: "El nuevo elemento se conectará ANTES de este nodo",
                  arrow: "north", // Flecha apuntando hacia arriba
                };
              if (isActiveBelow)
                return {
                  label: "INSERTAR DESPUÉS",
                  desc: "El nuevo elemento se conectará DESPUÉS de este nodo",
                  arrow: "south", // Flecha apuntando hacia abajo
                };
              if (isActiveBranchTrue)
                return {
                  label: "RAMA VERDADERA",
                  desc: "Conectar a la rama TRUE (condición verdadera)",
                  arrow: "south_west", // Flecha hacia abajo-izquierda
                };
              if (isActiveBranchFalse)
                return {
                  label: "RAMA FALSA",
                  desc: "Conectar a la rama FALSE (condición falsa)",
                  arrow: "south_east", // Flecha hacia abajo-derecha
                };
              return { label: "", desc: "", arrow: "link" };
            };

            const color = getColor();
            const info = getInfo();

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
                    background: `linear-gradient(135deg, ${color.bg} 0%, ${color.light} 100%)`,
                    borderRadius: "12px",
                    padding: "12px 20px",
                    boxShadow: `0 8px 32px ${color.bg}66, 0 4px 12px rgba(0,0,0,0.15)`,
                    display: "flex",
                    alignItems: "center",
                    gap: "16px",
                    minWidth: "320px",
                    maxWidth: "500px",
                  }}
                >
                  {/* Icono de flecha direccional grande */}
                  <div
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "10px",
                      background: "rgba(255,255,255,0.2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{
                        fontSize: "28px",
                        color: "#ffffff",
                      }}
                    >
                      {info.arrow}
                    </span>
                  </div>

                  {/* Contenido de texto */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Etiqueta principal */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        marginBottom: "4px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "13px",
                          fontWeight: 700,
                          color: "#ffffff",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                        }}
                      >
                        {info.label}
                      </span>
                      {(isActiveBranchTrue || isActiveBranchFalse) && (
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 600,
                            color: "rgba(255,255,255,0.8)",
                            background: "rgba(255,255,255,0.2)",
                            padding: "2px 6px",
                            borderRadius: "4px",
                          }}
                        >
                          {isActiveBranchTrue ? "TRUE" : "FALSE"}
                        </span>
                      )}
                    </div>

                    {/* Descripción */}
                    <div
                      style={{
                        fontSize: "11px",
                        color: "rgba(255,255,255,0.85)",
                        marginBottom: "6px",
                      }}
                    >
                      {info.desc}
                    </div>

                    {/* Código del comando */}
                    <div
                      style={{
                        background: "rgba(0,0,0,0.25)",
                        borderRadius: "6px",
                        padding: "6px 10px",
                        fontFamily:
                          'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
                        fontSize: "11px",
                        color: "#ffffff",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span
                        className="material-symbols-outlined"
                        style={{
                          fontSize: "12px",
                          color: "rgba(255,255,255,0.7)",
                          flexShrink: 0,
                        }}
                      >
                        code
                      </span>
                      {getCommandText()}
                    </div>
                  </div>

                  {/* Indicador del nodo objetivo */}
                  <div
                    style={{
                      background: "rgba(255,255,255,0.15)",
                      borderRadius: "8px",
                      padding: "8px 12px",
                      flexShrink: 0,
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "9px",
                        color: "rgba(255,255,255,0.7)",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        marginBottom: "2px",
                      }}
                    >
                      Destino
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "#ffffff",
                        maxWidth: "100px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {targetTaskId}
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
