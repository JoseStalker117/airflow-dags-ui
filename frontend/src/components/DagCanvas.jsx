import { useState, useCallback, useEffect, useRef } from "react";
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

// Componente de nodo personalizado - definido fuera del componente para evitar recreación
const nodeTypes = {
  dagNode: DagFlowNode
};

// Configuración del layout de árbol
const getLayoutedElements = (nodes, edges, direction = "TB") => {
  if (nodes.length === 0) {
    return { nodes: [], edges };
  }

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
    dagreGraph.setNode(node.id, { width: 220, height: 100 });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - 110, // Ajustar por ancho del nodo / 2
        y: nodeWithPosition.y - 50   // Ajustar por alto del nodo / 2
      }
    };
  });

  return { nodes: layoutedNodes, edges };
};

export default function DagCanvas() {
  const [initialNodes, setInitialNodes] = useState([]);
  const [initialEdges, setInitialEdges] = useState([]);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState(null);
  const isInitialLoad = useRef(true);
  const saveTimeoutRef = useRef(null);

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

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const data = JSON.parse(e.dataTransfer.getData("block"));

    // Crear nuevo nodo
    const newNodeId = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newNode = {
      id: newNodeId,
      type: "dagNode",
      data: {
        ...data,
        id: newNodeId,
        task_id: `${data.id}_${Date.now()}` || `task_${initialNodes.length + 1}`,
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

    // Si hay nodos existentes, crear edge desde el último nodo (solo si no tiene ya una conexión)
    let newEdges = initialEdges;
    const isBranchOperator = data.type === "BranchPythonOperator";
    const isDAG = data.type === "DAG";
    
    // No crear conexiones automáticas para DAGs ni desde DAGs
    if (initialNodes.length > 0 && !isBranchOperator && !isDAG) {
      // Encontrar el último nodo que no tenga conexión saliente y que no sea DAG
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

    setInitialNodes((nds) => [...nds, newNode]);
    setInitialEdges(newEdges);
  }, [initialNodes, initialEdges, handleNodeDelete, hasOutgoingEdge]);

  const onConnect = useCallback(
    (params) => {
      // Verificar si el nodo origen ya tiene una conexión saliente (excepto branches)
      const sourceNode = initialNodes.find((n) => n.id === params.source);
      const isBranch = sourceNode?.data?.type === "BranchPythonOperator";
      const isDAGSource = sourceNode?.data?.type === "DAG";

      // Prevenir conexiones desde un DAG (no tiene handle de salida)
      if (isDAGSource) {
        console.warn("Un nodo DAG no puede tener conexiones salientes");
        return;
      }

      if (!isBranch && hasOutgoingEdge(params.source)) {
        // Ya existe una conexión saliente, no permitir otra
        console.warn("Un nodo solo puede tener una conexión saliente única");
        return;
      }

      // Verificar si el nodo destino ya tiene una conexión entrante (solo una entrada por nodo)
      const targetNode = initialNodes.find((n) => n.id === params.target);
      const isDAGTarget = targetNode?.data?.type === "DAG";

      // Prevenir conexiones a un DAG (no tiene handle de entrada)
      if (isDAGTarget) {
        console.warn("No se puede conectar nada a un nodo DAG");
        return;
      }

      if (hasIncomingEdge(params.target)) {
        // Ya existe una conexión entrante, no permitir otra
        console.warn("Un nodo solo puede tener una conexión entrante única");
        return;
      }

      const newEdge = {
        ...params,
        id: `e${params.source}-${params.target}`,
        type: "smoothstep",
        animated: true,
        style: { stroke: "#64748b", strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "#64748b"
        }
      };
      setInitialEdges((eds) => addEdge(newEdge, eds));
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
  }, []);

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
        {nodeCount > 0 && (
          <div className="text-xs text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md border border-gray-200">
            <span className="font-medium">{nodeCount}</span>{" "}
            {nodeCount === 1 ? "tarea" : "tareas"}
          </div>
        )}
      </div>

      {/* Canvas de React Flow */}
      <div
        onDrop={handleDrop}
        onDragOver={onDragOver}
        className="flex-1 w-full relative overflow-hidden"
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
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChangeWithSelection}
            onConnect={onConnect}
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
          </ReactFlow>
        )}
      </div>
    </div>
  );
}
