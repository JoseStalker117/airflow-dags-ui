import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType
} from "reactflow";
import "reactflow/dist/style.css";
import dagre from "dagre";
import DagFlowNode from "./DagFlowNode";
import { saveCanvasState, loadCanvasState } from "../utils/storage";

// Configuración del layout de árbol
const getLayoutedElements = (nodes, edges, direction = "TB") => {
  if (nodes.length === 0) {
    return { nodes: [], edges };
  }

  // Separar nodos DAG de las tareas
  const dagNodes = nodes.filter(node => node.data?.type === "DAG");
  const taskNodes = nodes.filter(node => node.data?.type !== "DAG");
  
  // Si hay un DAG, el DAG va arriba y las tareas abajo
  if (dagNodes.length > 0 && taskNodes.length > 0) {
    const dagNode = dagNodes[0]; // Solo un DAG por canvas
    const dagId = dagNode.id;
    
    // Crear grafo incluyendo el DAG para calcular layout completo
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({ 
      rankdir: direction,
      nodesep: 100,
      ranksep: 150,
      marginx: 50,
      marginy: 50
    });

    // Añadir DAG al grafo (arriba)
    dagreGraph.setNode(dagId, { width: 500, height: 200 });
    
    // Añadir tareas al grafo (abajo del DAG)
    taskNodes.forEach((node) => {
      const isBranch = node.data?.type === "BranchPythonOperator";
      dagreGraph.setNode(node.id, { 
        width: 280, 
        height: isBranch ? 120 : 100 
      });
    });

    // Agregar todos los edges (incluyendo desde/hacia DAG)
    edges.forEach((edge) => {
      dagreGraph.setEdge(edge.source, edge.target);
    });

    // Si hay tareas sin conexiones (incluyendo BranchPythonOperator), conectarlas virtualmente al DAG para el layout
    const connectedTaskIds = new Set();
    edges.forEach(edge => {
      connectedTaskIds.add(edge.source);
      connectedTaskIds.add(edge.target);
    });

    taskNodes.forEach(node => {
      if (!connectedTaskIds.has(node.id) && !dagreGraph.hasEdge(dagId, node.id)) {
        // Conectar virtualmente al DAG para el layout (no se añade a los edges reales)
        dagreGraph.setEdge(dagId, node.id);
      }
    });

    dagre.layout(dagreGraph);

    // Posición del DAG (arriba)
    const dagPosition = dagreGraph.node(dagId);
    const layoutedDag = {
      ...dagNode,
      position: {
        x: dagPosition.x - 250,
        y: dagPosition.y - 100
      }
    };

    // Posiciones de las tareas (abajo del DAG)
    const taskPositions = taskNodes.map((node) => {
      const nodeWithPosition = dagreGraph.node(node.id);
      const isBranch = node.data?.type === "BranchPythonOperator";
      return {
        ...node,
        position: {
          x: nodeWithPosition.x - 140,
          y: nodeWithPosition.y - (isBranch ? 60 : 50)
        }
      };
    });

    return { 
      nodes: [layoutedDag, ...taskPositions], 
      edges: edges 
    };
  }

  // Si no hay DAG, usar layout normal - asegurarse de incluir todos los nodos (incluso sin conexiones)
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ 
    rankdir: direction,
    nodesep: 100,
    ranksep: 150,
    marginx: 50,
    marginy: 50
  });

  nodes.forEach((node) => {
    const isDAG = node.data?.type === "DAG";
    const isBranch = node.data?.type === "BranchPythonOperator";
    dagreGraph.setNode(node.id, { 
      width: isDAG ? 500 : 280, 
      height: isDAG ? 400 : (isBranch ? 120 : 100)
    });
  });

  // Agregar todos los edges existentes
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  // Si hay nodos sin conexiones (incluyendo BranchPythonOperator), crear conexiones virtuales para el layout
  // Esto asegura que todos los nodos estén en el mismo grafo
  const dagNode = nodes.find(n => n.data?.type === "DAG");
  const connectedNodeIds = new Set();
  edges.forEach(edge => {
    connectedNodeIds.add(edge.source);
    connectedNodeIds.add(edge.target);
  });

  if (dagNode && nodes.length > 1) {
    // Conectar nodos desconectados al DAG o al último nodo conectado
    nodes.forEach(node => {
      if (!connectedNodeIds.has(node.id) && node.id !== dagNode.id && node.data?.type !== "DAG") {
        // Si no está conectado y no es el DAG, conectarlo virtualmente al DAG para el layout
        if (!dagreGraph.hasEdge(dagNode.id, node.id)) {
          dagreGraph.setEdge(dagNode.id, node.id);
        }
      }
    });
  }

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const isDAG = node.data?.type === "DAG";
    const isBranch = node.data?.type === "BranchPythonOperator";
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - (isDAG ? 250 : 140),
        y: nodeWithPosition.y - (isDAG ? 200 : (isBranch ? 60 : 50))
      }
    };
  });

  return { nodes: layoutedNodes, edges };
};

// Componente de nodo personalizado - definido fuera del componente para evitar recreación
const nodeTypes = {
  dagNode: DagFlowNode
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
  const isInitialLoad = useRef(true);
  const saveTimeoutRef = useRef(null);
  const reactFlowInstance = useRef(null);

  const handleNodeDelete = useCallback((nodeId) => {
    setInitialNodes((nds) => nds.filter((node) => node.id !== nodeId));
    setInitialEdges((eds) =>
      eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId)
    );
  }, []);

  // Cargar estado guardado al montar el componente
  useEffect(() => {
    const savedState = loadCanvasState();
    if (savedState && savedState.nodes && savedState.nodes.length > 0) {
      // Restaurar nodos con sus funciones onUpdate/onDelete
      const restoredNodes = savedState.nodes.map(node => ({
        ...node,
        data: {
          ...node.data,
          onUpdate: (updatedData) => {
            setInitialNodes((nds) =>
              nds.map((n) =>
                n.id === node.id
                  ? { ...n, data: { ...n.data, ...updatedData } }
                  : n
              )
            );
          },
          onDelete: handleNodeDelete
        }
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
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        initialNodes,
        initialEdges,
        "TB"
      );
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
          edges: initialEdges.length
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
      if ((event.key === "Delete" || event.key === "Backspace") && selectedEdgeId) {
        event.preventDefault();
        setInitialEdges((eds) => eds.filter((edge) => edge.id !== selectedEdgeId));
        setSelectedEdgeId(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedEdgeId]);

  // Función para verificar si un nodo ya tiene una conexión saliente
  const hasOutgoingEdge = useCallback((nodeId) => {
    return initialEdges.some((edge) => edge.source === nodeId);
  }, [initialEdges]);

  // Función para verificar si un nodo ya tiene una conexión entrante
  const hasIncomingEdge = useCallback((nodeId) => {
    return initialEdges.some((edge) => edge.target === nodeId);
  }, [initialEdges]);

  // Función para encontrar el nodo más cercano y determinar la zona de drop
  const findDropZone = useCallback((dropY, dropX, excludeNodeId = null) => {
    if (nodes.length === 0) return null;

    let closestNode = null;
    let minDistance = Infinity;
    let dropZone = 'below'; // 'above', 'below'

    nodes.forEach(node => {
      if (node.data?.type === "DAG") return; // Ignorar DAG
      if (excludeNodeId && node.id === excludeNodeId) return; // Ignorar el nodo que se está arrastrando

      const nodeY = node.position.y;
      const nodeHeight = node.data?.type === "BranchPythonOperator" ? 120 : 100;
      const nodeX = node.position.x;
      const nodeWidth = 280;
      const nodeCenterX = nodeX + nodeWidth / 2;
      const nodeCenterY = nodeY + nodeHeight / 2;

      // Calcular distancia euclidiana al centro del nodo
      const distanceX = Math.abs(dropX - nodeCenterX);
      const distanceY = Math.abs(dropY - nodeCenterY);
      const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);

      // Solo considerar nodos dentro de un rango razonable (300px)
      if (distance < 300 && distance < minDistance) {
        minDistance = distance;
        closestNode = node;

        // Determinar zona basada en posición Y relativa al centro del nodo
        if (dropY < nodeCenterY) {
          dropZone = 'above';
        } else {
          dropZone = 'below';
        }
      }
    });

    return closestNode ? { node: closestNode, zone: dropZone } : null;
  }, [nodes]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    setDropZonePreview(null);
    const data = JSON.parse(e.dataTransfer.getData("block"));

    // Obtener posición del drop en coordenadas del flujo
    let dropPosition = { x: 0, y: 0 };
    if (reactFlowInstance.current) {
      const reactFlowBounds = reactFlowInstance.current.getViewport();
      dropPosition = reactFlowInstance.current.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY
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
        task_id: `${data.id}_${Date.now()}` || `task_${initialNodes.length + 1}`,
        // Guardar definiciones de parámetros para poder editarlos
        parameterDefinitions: data.parameters || {},
        // Inicializar parámetros con valores por defecto
        parameters: data.parameters ? Object.entries(data.parameters).reduce((acc, [key, param]) => {
          if (param.default !== undefined) {
            acc[key] = param.default;
          }
          return acc;
        }, {}) : {},
        onUpdate: (updatedData) => {
          setInitialNodes((nds) =>
            nds.map((node) =>
              node.id === newNodeId
                ? { ...node, data: { ...node.data, ...updatedData } }
                : node
            )
          );
        },
        onDelete: handleNodeDelete
      },
      position: { x: 0, y: 0 }
    };

    // Detectar zona de drop inteligente
    const dropZoneInfo = findDropZone(dropPosition.y, dropPosition.x);
    let newEdges = initialEdges;
    const isBranchOperator = data.type === "BranchPythonOperator";
    const isDAG = data.type === "DAG";
    
    if (dropZoneInfo && !isBranchOperator && !isDAG) {
      const { node: targetNode, zone } = dropZoneInfo;
      
      if (zone === 'below') {
        // Insertar después del nodo objetivo
        // Conectar desde targetNode al nuevo nodo
        const outgoingEdge = initialEdges.find(e => e.source === targetNode.id);
        if (outgoingEdge) {
          // Si targetNode tiene una conexión saliente, insertar el nuevo nodo en medio
          newEdges = initialEdges
            .filter(e => e.id !== outgoingEdge.id) // Remover conexión antigua
            .concat([{
              id: `e${targetNode.id}-${newNodeId}`,
              source: targetNode.id,
              target: newNodeId,
              type: "smoothstep",
              animated: true,
              style: { stroke: "#64748b", strokeWidth: 2 },
              markerEnd: { type: MarkerType.ArrowClosed, color: "#64748b" }
            }, {
              id: `e${newNodeId}-${outgoingEdge.target}`,
              source: newNodeId,
              target: outgoingEdge.target,
              type: "smoothstep",
              animated: true,
              style: { stroke: "#64748b", strokeWidth: 2 },
              markerEnd: { type: MarkerType.ArrowClosed, color: "#64748b" }
            }]);
        } else {
          // Si no tiene conexión saliente, conectar directamente desde targetNode
          newEdges = [...initialEdges, {
            id: `e${targetNode.id}-${newNodeId}`,
            source: targetNode.id,
            target: newNodeId,
            type: "smoothstep",
            animated: true,
            style: { stroke: "#64748b", strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: "#64748b" }
          }];
        }
      } else if (zone === 'above') {
        // Insertar antes del nodo objetivo
        const targetEdge = initialEdges.find(e => e.target === targetNode.id);
        if (targetEdge) {
          // Redirigir conexión: source -> newNode -> targetNode
          newEdges = initialEdges
            .filter(e => e.id !== targetEdge.id)
            .concat([{
              id: `e${targetEdge.source}-${newNodeId}`,
              source: targetEdge.source,
              target: newNodeId,
              type: "smoothstep",
              animated: true,
              style: { stroke: "#64748b", strokeWidth: 2 },
              markerEnd: { type: MarkerType.ArrowClosed, color: "#64748b" }
            }, {
              id: `e${newNodeId}-${targetNode.id}`,
              source: newNodeId,
              target: targetNode.id,
              type: "smoothstep",
              animated: true,
              style: { stroke: "#64748b", strokeWidth: 2 },
              markerEnd: { type: MarkerType.ArrowClosed, color: "#64748b" }
            }]);
        } else {
          // Si targetNode no tiene entrada, conectar desde DAG o último nodo
          const dagNode = initialNodes.find((n) => n.data?.type === "DAG");
          if (dagNode) {
            newEdges = [...initialEdges, {
              id: `e${dagNode.id}-${newNodeId}`,
              source: dagNode.id,
              target: newNodeId,
              type: "smoothstep",
              animated: true,
              style: { stroke: "#6366f1", strokeWidth: 2 },
              markerEnd: { type: MarkerType.ArrowClosed, color: "#6366f1" }
            }, {
              id: `e${newNodeId}-${targetNode.id}`,
              source: newNodeId,
              target: targetNode.id,
              type: "smoothstep",
              animated: true,
              style: { stroke: "#64748b", strokeWidth: 2 },
              markerEnd: { type: MarkerType.ArrowClosed, color: "#64748b" }
            }];
          }
        }
      }
      // 'middle' se trata como 'below'
    } else if (initialNodes.length > 0 && !isBranchOperator && !isDAG) {
      // Fallback a conexión automática estándar
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
              color: "#6366f1"
            }
          }
        ];
      } else {
        const lastNodeWithoutConnection = [...initialNodes].reverse().find(
          (node) => !hasOutgoingEdge(node.id) && node.data?.type !== "DAG"
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
                color: "#64748b"
              }
            }
          ];
        }
      }
    }

    setInitialNodes((nds) => [...nds, newNode]);
    setInitialEdges(newEdges);
  }, [initialNodes, initialEdges, handleNodeDelete, hasOutgoingEdge, nodes, findDropZone]);

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
          (edge) => !(edge.target === params.target && edge.source !== params.source)
        );

        // Remover conexión anterior del source (excepto branches y DAG que permiten múltiples)
        if (!isDAGSource && !isBranch) {
          filteredEdges = filteredEdges.filter(
            (edge) => !(edge.source === params.source && edge.target !== params.target)
          );
        }

        // Verificar si ya existe esta conexión
        const exists = filteredEdges.some(
          (edge) => edge.source === params.source && edge.target === params.target
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
          style: { stroke: isDAGSource ? "#6366f1" : "#64748b", strokeWidth: 2 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: isDAGSource ? "#6366f1" : "#64748b"
          }
        };

        return addEdge(newEdge, filteredEdges);
      });
    },
    [initialNodes, hasOutgoingEdge, hasIncomingEdge]
  );

  const onEdgesChangeWithSelection = useCallback((changes) => {
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
  }, [onEdgesChange, selectedEdgeId]);

  const onDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    
    // Actualizar preview de zona de drop
    if (reactFlowInstance.current && nodes.length > 0) {
      const dropPosition = reactFlowInstance.current.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY
      });
      
      const dropZoneInfo = findDropZone(dropPosition.y, dropPosition.x);
      if (dropZoneInfo) {
        setDropZonePreview({ nodeId: dropZoneInfo.node.id, zone: dropZoneInfo.zone });
      } else {
        setDropZonePreview(null);
      }
    }
  }, [nodes, findDropZone]);

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
  const onNodeDrag = useCallback((event, node) => {
    if (node.data?.type === "DAG") return;
    
    if (reactFlowInstance.current) {
      const nodeHeight = node.data?.type === "BranchPythonOperator" ? 120 : 100;
      const nodeWidth = 280;
      // Usar el centro del nodo como punto de referencia
      const nodeCenterY = node.position.y + nodeHeight / 2;
      const nodeCenterX = node.position.x + nodeWidth / 2;
      
      const dropZoneInfo = findDropZone(nodeCenterY, nodeCenterX, node.id);
      if (dropZoneInfo) {
        setDropZonePreview({ nodeId: dropZoneInfo.node.id, zone: dropZoneInfo.zone });
      } else {
        setDropZonePreview(null);
      }
    }
  }, [findDropZone]);

  // Manejar fin de arrastre de nodo interno
  const onNodeDragStop = useCallback((event, node) => {
    if (node.data?.type === "DAG") {
      setIsNodeDragging(false);
      setDraggingNodeId(null);
      setDropZonePreview(null);
      return;
    }
    
    // Si hay una zona de drop activa, reconectar el nodo
    if (dropZonePreview && dropZonePreview.nodeId !== node.id) {
      const targetNode = nodes.find(n => n.id === dropZonePreview.nodeId);
      if (targetNode) {
        setInitialEdges((eds) => {
          // Encontrar las conexiones actuales del nodo que se está moviendo
          const incomingToMovedNode = eds.find(e => e.target === node.id);
          const outgoingFromMovedNode = eds.find(e => e.source === node.id);
          
          // Paso 1: Reconectar los nodos que estaban conectados al nodo movido
          // Si el nodo movido tenía un nodo anterior y uno posterior, conectarlos entre sí
          let newEdges = eds.filter(e => e.source !== node.id && e.target !== node.id);
          
          if (incomingToMovedNode && outgoingFromMovedNode) {
            // El nodo movido estaba en medio de una cadena, reconectar la cadena
            const sourceOfMoved = incomingToMovedNode.source;
            const targetOfMoved = outgoingFromMovedNode.target;
            
            // Verificar que no estemos creando un ciclo o conexión redundante
            if (sourceOfMoved !== targetOfMoved) {
              // Verificar si ya existe esta conexión
              const connectionExists = newEdges.some(e => e.source === sourceOfMoved && e.target === targetOfMoved);
              if (!connectionExists) {
                // Determinar el color basado en si el source es DAG
                const sourceNodeData = nodes.find(n => n.id === sourceOfMoved);
                const isFromDAG = sourceNodeData?.data?.type === "DAG";
                const strokeColor = isFromDAG ? "#6366f1" : "#64748b";
                
                newEdges.push({
                  id: `e${sourceOfMoved}-${targetOfMoved}`,
                  source: sourceOfMoved,
                  target: targetOfMoved,
                  type: "smoothstep",
                  animated: true,
                  style: { stroke: strokeColor, strokeWidth: 2 },
                  markerEnd: { type: MarkerType.ArrowClosed, color: strokeColor }
                });
              }
            }
          }
          
          // Paso 2: Insertar el nodo movido en la nueva posición
          if (dropZonePreview.zone === 'above') {
            // Insertar antes del nodo objetivo
            const incomingToTarget = eds.find(e => e.target === targetNode.id);
            
            if (incomingToTarget) {
              // Hay una conexión entrante al target, insertar en medio
              // Remover la conexión entrante al target (si no fue ya removida)
              newEdges = newEdges.filter(e => e.id !== incomingToTarget.id);
              
              // Determinar color basado en si viene de DAG
              const sourceNodeData = nodes.find(n => n.id === incomingToTarget.source);
              const isFromDAG = sourceNodeData?.data?.type === "DAG";
              const strokeColor = isFromDAG ? "#6366f1" : "#64748b";
              
              // Conectar source original -> nodo movido
              newEdges.push({
                id: `e${incomingToTarget.source}-${node.id}`,
                source: incomingToTarget.source,
                target: node.id,
                type: "smoothstep",
                animated: true,
                style: { stroke: strokeColor, strokeWidth: 2 },
                markerEnd: { type: MarkerType.ArrowClosed, color: strokeColor }
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
              markerEnd: { type: MarkerType.ArrowClosed, color: "#64748b" }
            });
          } else {
            // Insertar después del nodo objetivo
            const outgoingFromTarget = eds.find(e => e.source === targetNode.id);
            
            if (outgoingFromTarget) {
              // Hay una conexión saliente del target, insertar en medio
              // Remover la conexión saliente del target (si no fue ya removida)
              newEdges = newEdges.filter(e => e.id !== outgoingFromTarget.id);
              
              // Conectar nodo movido -> target original
              newEdges.push({
                id: `e${node.id}-${outgoingFromTarget.target}`,
                source: node.id,
                target: outgoingFromTarget.target,
                type: "smoothstep",
                animated: true,
                style: { stroke: "#64748b", strokeWidth: 2 },
                markerEnd: { type: MarkerType.ArrowClosed, color: "#64748b" }
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
              markerEnd: { type: MarkerType.ArrowClosed, color: strokeColor }
            });
          }
          
          return newEdges;
        });
      }
    }
    
    setIsNodeDragging(false);
    setDraggingNodeId(null);
    setDropZonePreview(null);
  }, [dropZonePreview, nodes]);

  // Función para autoajustar el layout
  const handleAutoLayout = useCallback(() => {
    if (initialNodes.length > 0) {
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        initialNodes,
        initialEdges,
        "TB"
      );
      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
    }
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  // Usar initialNodes.length para el contador en lugar de nodes.length
  // porque nodes puede estar desactualizado durante el cálculo del layout
  const nodeCount = initialNodes.length > 0 ? initialNodes.length : nodes.length;

  return (
    <div className="flex-1 flex flex-col relative bg-gray-50 overflow-hidden" style={{ height: '100%' }}>
      {/* Header informativo */}
      <div className="flex-shrink-0 z-10 bg-white/80 backdrop-blur-sm border-b border-gray-200 px-4 py-2 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">DAG Builder</h3>
          <p className="text-xs text-slate-500">Arrastra bloques para crear tu DAG</p>
        </div>
        <div className="flex items-center gap-2">
          {nodeCount > 0 && (
            <>
              <button
                onClick={handleAutoLayout}
                className="text-xs bg-indigo-100 text-indigo-700 hover:bg-indigo-200 px-3 py-1.5 rounded-md border border-indigo-300 transition-colors flex items-center gap-1.5"
                title="Ajustar layout automáticamente"
              >
                <span className="material-symbols-outlined text-sm">account_tree</span>
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
        className={`flex-1 w-full relative overflow-hidden transition-all duration-200 ${isDragging ? 'bg-indigo-50/50' : ''}`}
        style={{ minHeight: 0, width: '100%' }}
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
              Arrastra bloques de tareas desde el panel izquierdo para comenzar a construir tu DAG de Airflow
            </p>
          </div>
        ) : (
          <ReactFlow
            onInit={(instance) => {
              reactFlowInstance.current = instance;
            }}
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChangeWithSelection}
            onConnect={onConnect}
            onNodeDragStart={onNodeDragStart}
            onNodeDrag={onNodeDrag}
            onNodeDragStop={onNodeDragStop}
            nodeTypes={nodeTypes}
            connectionLineStyle={{ stroke: "#64748b", strokeWidth: 2 }}
            defaultEdgeOptions={{
              type: "smoothstep",
              animated: true,
              style: { stroke: "#64748b", strokeWidth: 2 },
              markerEnd: {
                type: MarkerType.ArrowClosed,
                color: "#64748b"
              }
            }}
            fitView
            attributionPosition="bottom-left"
            minZoom={0.1}
            maxZoom={2}
            defaultViewport={{ x: 0, y: 0, zoom: 1 }}
            style={{ width: '100%', height: '100%' }}
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
                  ShortCircuitOperator: "#fcd34d"
                };
                const operatorType = node.data?.type;
                return typeColorMap[operatorType] || "#cbd5e1";
              }}
              maskColor="rgba(0, 0, 0, 0.1)"
              position="bottom-right"
              pannable
              zoomable
            />
            
            {/* Indicadores visuales de zonas de drop - solo para el nodo más cercano */}
            {(isDragging || isNodeDragging) && dropZonePreview && (() => {
              const node = nodes.find(n => n.id === dropZonePreview.nodeId);
              if (!node || node.data?.type === "DAG" || node.id === draggingNodeId) return null;
              
              const nodeHeight = node.data?.type === "BranchPythonOperator" ? 120 : 100;
              const nodeWidth = 280;
              const isActiveAbove = dropZonePreview.zone === 'above';
              const isActiveBelow = dropZonePreview.zone === 'below';
              const indicatorHeight = 28;
              
              return (
                <div key={`dropzone-${node.id}`} style={{ pointerEvents: 'none' }}>
                  {/* Zona superior - Insertar ANTES - pegada al borde TOP del nodo */}
                  {isActiveAbove && (
                    <>
                      {/* Barra indicadora en el borde superior */}
                      <div
                        style={{
                          position: 'absolute',
                          left: node.position.x - 15,
                          top: node.position.y - indicatorHeight - 4,
                          width: nodeWidth + 30,
                          height: indicatorHeight,
                          background: 'linear-gradient(180deg, #6366f1 0%, #818cf8 100%)',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          zIndex: 1001,
                          boxShadow: '0 2px 10px rgba(99, 102, 241, 0.5)',
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '11px',
                          fontWeight: 700,
                          color: '#ffffff',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                        }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>arrow_upward</span>
                          Insertar antes
                        </div>
                      </div>
                      {/* Línea conectora */}
                      <div
                        style={{
                          position: 'absolute',
                          left: node.position.x + nodeWidth / 2 - 2,
                          top: node.position.y - 4,
                          width: 4,
                          height: 4,
                          background: '#6366f1',
                          borderRadius: '50%',
                          zIndex: 1001,
                        }}
                      />
                    </>
                  )}
                  
                  {/* Zona inferior - Insertar DESPUÉS - pegada al borde BOTTOM del nodo */}
                  {isActiveBelow && (
                    <>
                      {/* Barra indicadora en el borde inferior */}
                      <div
                        style={{
                          position: 'absolute',
                          left: node.position.x - 15,
                          top: node.position.y + nodeHeight + 4,
                          width: nodeWidth + 30,
                          height: indicatorHeight,
                          background: 'linear-gradient(180deg, #22c55e 0%, #4ade80 100%)',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          zIndex: 1001,
                          boxShadow: '0 2px 10px rgba(34, 197, 94, 0.5)',
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '11px',
                          fontWeight: 700,
                          color: '#ffffff',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                        }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>arrow_downward</span>
                          Insertar después
                        </div>
                      </div>
                      {/* Línea conectora */}
                      <div
                        style={{
                          position: 'absolute',
                          left: node.position.x + nodeWidth / 2 - 2,
                          top: node.position.y + nodeHeight,
                          width: 4,
                          height: 4,
                          background: '#22c55e',
                          borderRadius: '50%',
                          zIndex: 1001,
                        }}
                      />
                    </>
                  )}
                  
                  {/* Highlight del nodo objetivo - borde coloreado */}
                  <div
                    style={{
                      position: 'absolute',
                      left: node.position.x - 4,
                      top: node.position.y - 4,
                      width: nodeWidth + 8,
                      height: nodeHeight + 8,
                      borderTop: `3px solid ${isActiveAbove ? '#6366f1' : '#22c55e'}`,
                      borderRight: `3px solid ${isActiveAbove ? '#6366f1' : '#22c55e'}`,
                      borderBottom: `3px solid ${isActiveAbove ? '#6366f1' : '#22c55e'}`,
                      borderLeft: `3px solid ${isActiveAbove ? '#6366f1' : '#22c55e'}`,
                      borderRadius: '12px',
                      boxShadow: `0 0 20px ${isActiveAbove ? 'rgba(99, 102, 241, 0.4)' : 'rgba(34, 197, 94, 0.4)'}`,
                      zIndex: 999,
                      animation: 'pulse 1.5s ease-in-out infinite',
                    }}
                  />
                </div>
              );
            })()}
          </ReactFlow>
        )}
        
        {/* Estilos para animación de pulse */}
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.6; }
          }
        `}} />
      </div>
    </div>
  );
}
