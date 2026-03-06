import dagre from "dagre";

// Configuración del layout de árbol
export const getLayoutedElements = (nodes, edges, direction = "TB") => {
  if (!nodes || nodes.length === 0) {
    return { nodes: [], edges };
  }

  // Separar nodos DAG/Argo de tareas
  const dagNodes = nodes.filter(
    (n) => n.data && (n.data.type === "DAG" || n.data.type === "ArgoWorkflow"),
  );
  const taskNodes = nodes.filter(
    (n) => !n.data || (n.data.type !== "DAG" && n.data.type !== "ArgoWorkflow"),
  );

  // CASO CON AL MENOS UN DAG Y TAREAS
  if (dagNodes.length > 0 && taskNodes.length > 0) {
    const dagNode = dagNodes[0]; // layout usa el primer DAG como raíz
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

  // CASO SIN DAG
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

    const isDAG = data.type === "DAG" || data.type === "ArgoWorkflow";
    const isBranch = data.type === "BranchPythonOperator";

    dagreGraph.setNode(node.id, {
      width: isDAG ? 460 : isBranch ? 420 : 280,
      height: isDAG ? 180 : isBranch ? 150 : 100,
    });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  const dagNode = nodes.find(
    (n) =>
      n.data && (n.data.type === "DAG" || n.data.type === "ArgoWorkflow"),
  );

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
        node.data?.type !== "DAG" &&
        node.data?.type !== "ArgoWorkflow"
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
