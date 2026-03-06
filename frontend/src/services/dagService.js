// ============================================
// services/dagService.js
// Servicio completo para gestión de DAGs
// ============================================

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
const ROOT_AIRFLOW_TYPE = 'DAG';
const BRANCH_TYPE = 'BranchPythonOperator';

const AIRFLOW_IMPORT_BY_TYPE = {
  BashOperator: 'from airflow.operators.bash import BashOperator',
  PythonOperator: 'from airflow.operators.python import PythonOperator',
  PythonVirtualenvOperator: 'from airflow.operators.python import PythonVirtualenvOperator',
  BranchPythonOperator: 'from airflow.operators.python import BranchPythonOperator',
  ShortCircuitOperator: 'from airflow.operators.python import ShortCircuitOperator',
  DummyOperator: 'from airflow.operators.dummy import DummyOperator',
  PostgresOperator: 'from airflow.providers.postgres.operators.postgres import PostgresOperator',
  BigQueryOperator: 'from airflow.providers.google.cloud.operators.bigquery import BigQueryInsertJobOperator as BigQueryOperator',
  SQLExecuteQueryOperator: 'from airflow.providers.common.sql.operators.sql import SQLExecuteQueryOperator',
  LocalFilesystemToS3Operator: 'from airflow.providers.amazon.aws.transfers.local_to_s3 import LocalFilesystemToS3Operator',
  S3ToS3Operator: 'from airflow.providers.amazon.aws.transfers.s3_to_s3 import S3ToS3Operator',
  SFTPOperator: 'from airflow.providers.sftp.operators.sftp import SFTPOperator',
  GCSToBigQueryOperator: 'from airflow.providers.google.cloud.transfers.gcs_to_bigquery import GCSToBigQueryOperator',
  FileSensor: 'from airflow.sensors.filesystem import FileSensor',
  S3KeySensor: 'from airflow.providers.amazon.aws.sensors.s3 import S3KeySensor',
  SqlSensor: 'from airflow.sensors.sql import SqlSensor',
  HttpSensor: 'from airflow.providers.http.sensors.http import HttpSensor',
};

const DEFAULT_ARGS_KEYS = new Set([
  'owner',
  'depends_on_past',
  'start_date',
  'email',
  'email_on_failure',
  'email_on_retry',
  'retries',
  'retry_delay',
  'retry_exponential_backoff',
  'max_retry_delay',
  'catchup',
  'sla',
  'execution_timeout',
]);

const CALLABLE_OPERATOR_TYPES = new Set([
  'PythonOperator',
  'PythonVirtualenvOperator',
  BRANCH_TYPE,
  'ShortCircuitOperator',
]);

const sanitizeTaskId = (value, fallback = 'task') => {
  const base = String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return base || fallback;
};

const sanitizePythonIdentifier = (value, fallback = 'task_ref') => {
  const cleaned = String(value || fallback)
    .trim()
    .replace(/[^a-zA-Z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const withPrefix = /^[a-zA-Z_]/.test(cleaned) ? cleaned : `n_${cleaned}`;
  return withPrefix || fallback;
};

const parseDateLiteral = (value) => {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, y, m, d] = match;
  return `datetime(${Number(y)}, ${Number(m)}, ${Number(d)})`;
};

const toPythonLiteral = (value) => {
  if (value === null || value === undefined) return 'None';
  if (typeof value === 'boolean') return value ? 'True' : 'False';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'None';
  if (typeof value === 'string') return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  if (Array.isArray(value)) {
    return `[${value.map((item) => toPythonLiteral(item)).join(', ')}]`;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value);
    if (!entries.length) return '{}';
    return `{${entries
      .map(([k, v]) => `'${String(k).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}': ${toPythonLiteral(v)}`)
      .join(', ')}}`;
  }
  return `'${String(value)}'`;
};

const normalizeImportMeta = (meta) => {
  if (!meta) return [];
  if (typeof meta === 'string') return [meta];
  if (Array.isArray(meta)) return meta.flatMap((item) => normalizeImportMeta(item));
  if (typeof meta === 'object') {
    const fromModule = meta.from || meta.module;
    const imported = meta.import || meta.class || meta.name;
    const alias = meta.as || meta.alias;
    if (fromModule && imported) {
      return [`from ${fromModule} import ${imported}${alias ? ` as ${alias}` : ''}`];
    }
  }
  return [];
};

const topologicalSort = (nodeIds, edges) => {
  const indegree = new Map();
  const adjacency = new Map();
  nodeIds.forEach((id) => {
    indegree.set(id, 0);
    adjacency.set(id, []);
  });

  edges.forEach((e) => {
    if (!indegree.has(e.source) || !indegree.has(e.target)) return;
    adjacency.get(e.source).push(e.target);
    indegree.set(e.target, indegree.get(e.target) + 1);
  });

  const queue = [...nodeIds].filter((id) => indegree.get(id) === 0);
  const result = [];

  while (queue.length) {
    const current = queue.shift();
    result.push(current);
    for (const next of adjacency.get(current)) {
      indegree.set(next, indegree.get(next) - 1);
      if (indegree.get(next) === 0) queue.push(next);
    }
  }

  // Si hay ciclo, conservar orden estable original de ids faltantes
  if (result.length < nodeIds.length) {
    const pending = nodeIds.filter((id) => !result.includes(id));
    return [...result, ...pending];
  }
  return result;
};

const buildDefaultArgsAndDagConfig = (rootParams = {}) => {
  const defaultArgs = {};
  const dagConfig = {};

  for (const [key, value] of Object.entries(rootParams || {})) {
    if (value === '' || value === undefined) continue;
    if (DEFAULT_ARGS_KEYS.has(key)) {
      if (key === 'start_date') {
        defaultArgs[key] = parseDateLiteral(value) || toPythonLiteral(value);
      } else if (key === 'retry_delay' && typeof value === 'number') {
        defaultArgs[key] = `timedelta(seconds=${value})`;
      } else {
        defaultArgs[key] = toPythonLiteral(value);
      }
      continue;
    }
    dagConfig[key] = value;
  }

  if (!defaultArgs.owner) defaultArgs.owner = "'airflow'";
  if (!defaultArgs.depends_on_past) defaultArgs.depends_on_past = 'False';
  if (!defaultArgs.start_date) defaultArgs.start_date = 'datetime(2024, 1, 1)';
  if (!defaultArgs.retries) defaultArgs.retries = '1';
  if (!defaultArgs.retry_delay) defaultArgs.retry_delay = 'timedelta(minutes=5)';

  return { defaultArgs, dagConfig };
};

// ============== SERVICIO DE API ==============
export const apiService = {
  // Método genérico para peticiones
  request: async (method, endpoint, data = null, config = {}) => {
    const logEntry = {
      timestamp: new Date().toISOString(),
      method,
      endpoint,
      data,
      status: 'pending'
    };
    
    try {
      const response = await axios({
        method,
        url: `${API_BASE_URL}${endpoint}`,
        data,
        headers: {
          'Content-Type': 'application/json',
          ...config.headers
        },
        ...config
      });
      
      console.log(`✅ ${method} ${endpoint}:`, response.data);
      
      return {
        success: true,
        data: response.data,
        log: { ...logEntry, status: 'success', response: response.data }
      };
    } catch (error) {
      console.error(`❌ ${method} ${endpoint}:`, error.message);
      
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        log: { ...logEntry, status: 'error', error: error.message }
      };
    }
  },

  // Métodos HTTP
  get: (endpoint, config) => apiService.request('GET', endpoint, null, config),
  post: (endpoint, data, config) => apiService.request('POST', endpoint, data, config),
  put: (endpoint, data, config) => apiService.request('PUT', endpoint, data, config),
  delete: (endpoint, config) => apiService.request('DELETE', endpoint, null, config),
};

// ============== SERVICIO DE DAG ==============
export const dagService = {
  
  // 📤 Exportar a JSON
  exportToJSON: (nodes, edges, filename = 'dag.json') => {
    const dagData = {
      nodes,
      edges,
      metadata: {
        exportedAt: new Date().toISOString(),
        version: '1.0',
        nodeCount: nodes.length,
        edgeCount: edges.length
      }
    };
    
    const blob = new Blob([JSON.stringify(dagData, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    console.log('✅ JSON exportado:', filename);
    return { success: true, filename, nodeCount: nodes.length };
  },

  // 📋 Copiar JSON al portapapeles
  copyToClipboard: async (nodes, edges) => {
    const dagData = {
      nodes,
      edges,
      metadata: {
        copiedAt: new Date().toISOString(),
        version: '1.0'
      }
    };
    
    try {
      await navigator.clipboard.writeText(JSON.stringify(dagData, null, 2));
      console.log('✅ JSON copiado al portapapeles');
      return { 
        success: true, 
        message: 'JSON copiado al portapapeles',
        nodeCount: nodes.length,
        edgeCount: edges.length
      };
    } catch (error) {
      console.error('❌ Error al copiar:', error);
      return { success: false, error: error.message };
    }
  },

  // 🐍 Exportar a Python (Airflow DAG)
  exportToPython: (nodes, edges, filename = 'dag.py', fallbackDagId = 'generated_dag') => {
    const rootNode = nodes.find((n) => n?.data?.type === ROOT_AIRFLOW_TYPE);
    if (!rootNode) {
      throw new Error('No se encontró el nodo raíz DAG para exportar a Airflow.');
    }
    if (nodes.some((n) => n?.data?.type === 'ArgoWorkflow')) {
      throw new Error('Exportar Python solo soporta workflows de Airflow.');
    }

    const taskNodes = nodes.filter((n) => n.id !== rootNode.id);
    const taskNodeIds = taskNodes.map((n) => n.id);
    const taskEdges = edges.filter(
      (e) => e.source !== rootNode.id && e.target !== rootNode.id,
    );

    const rootParams = rootNode.data?.parameters || {};
    const { defaultArgs, dagConfig } = buildDefaultArgsAndDagConfig(rootParams);
    const dagId = sanitizeTaskId(rootParams.dag_id || rootNode.data?.task_id || fallbackDagId, fallbackDagId);
    const dagDescription = dagConfig.description ?? rootNode.data?.description ?? '';
    const dagSchedule = dagConfig.schedule ?? dagConfig.schedule_interval ?? '@daily';
    const dagCatchup = dagConfig.catchup !== undefined ? dagConfig.catchup : false;
    const dagTags = Array.isArray(dagConfig.tags) ? dagConfig.tags : [];

    const orderedTaskIds = topologicalSort(taskNodeIds, taskEdges);

    const importLines = new Set([
      'from datetime import datetime, timedelta',
      'from airflow import DAG',
    ]);

    const branchCallableNames = new Set();
    const taskVarByNodeId = new Map();
    const usedVarNames = new Set();
    const taskDefinitions = [];

    const makeUniqueVarName = (base) => {
      let name = sanitizePythonIdentifier(base, 'task_ref');
      let i = 2;
      while (usedVarNames.has(name)) {
        name = `${sanitizePythonIdentifier(base, 'task_ref')}_${i}`;
        i += 1;
      }
      usedVarNames.add(name);
      return name;
    };

    orderedTaskIds.forEach((nodeId) => {
      const node = taskNodes.find((n) => n.id === nodeId);
      if (!node) return;

      const operatorType = node.data?.type || 'PythonOperator';
      const params = { ...(node.data?.parameters || {}) };
      const taskId = sanitizeTaskId(params.task_id || node.data?.task_id || node.id, node.id);
      const taskVar = makeUniqueVarName(taskId);
      taskVarByNodeId.set(node.id, taskVar);

      const literalImport = node.data?.importLiteral || node.data?.pythonImportLiteral;
      if (typeof literalImport === 'string' && literalImport.trim()) {
        importLines.add(literalImport.trim());
      }

      const customImportMeta = node.data?.imports || node.data?.import || node.data?.operatorImport;
      normalizeImportMeta(customImportMeta).forEach((line) => importLines.add(line));
      if (!literalImport && !customImportMeta && AIRFLOW_IMPORT_BY_TYPE[operatorType]) {
        importLines.add(AIRFLOW_IMPORT_BY_TYPE[operatorType]);
      }

      const kwargsLines = [`task_id='${taskId}'`];

      Object.entries(params).forEach(([key, rawValue]) => {
        if (key === 'task_id' || rawValue === '' || rawValue === undefined) return;

        if (CALLABLE_OPERATOR_TYPES.has(operatorType) && key === 'python_callable') {
          const callableName = sanitizePythonIdentifier(rawValue || `${taskId}_callable`, `${taskId}_callable`);
          kwargsLines.push(`${key}=${callableName}`);
          branchCallableNames.add(callableName);
          return;
        }

        kwargsLines.push(`${key}=${toPythonLiteral(rawValue)}`);
      });

      if (CALLABLE_OPERATOR_TYPES.has(operatorType) && !kwargsLines.some((line) => line.startsWith('python_callable='))) {
        const callableName = sanitizePythonIdentifier(`${taskId}_callable`, 'task_callable');
        kwargsLines.push(`python_callable=${callableName}`);
        branchCallableNames.add(callableName);
      }

      taskDefinitions.push(
        `    ${taskVar} = ${operatorType}(\n        ${kwargsLines.join(',\n        ')},\n    )`,
      );
    });

    const branchNodes = taskNodes.filter((n) => n.data?.type === BRANCH_TYPE);
    const branchDummyDefinitions = [];
    const dependencyLines = [];

    const outgoingByNode = new Map();
    taskEdges.forEach((e) => {
      if (!outgoingByNode.has(e.source)) outgoingByNode.set(e.source, []);
      outgoingByNode.get(e.source).push(e);
    });

    edges.forEach((e) => {
      if (!taskVarByNodeId.has(e.source) || !taskVarByNodeId.has(e.target)) return;
      dependencyLines.push(`    ${taskVarByNodeId.get(e.source)} >> ${taskVarByNodeId.get(e.target)}`);
    });

    branchNodes.forEach((branchNode) => {
      const branchVar = taskVarByNodeId.get(branchNode.id);
      if (!branchVar) return;

      const branchTaskId = sanitizeTaskId(
        branchNode.data?.parameters?.task_id || branchNode.data?.task_id || branchNode.id,
        branchNode.id,
      );
      importLines.add('from airflow.operators.dummy import DummyOperator');

      const trueEndTaskId = `${branchTaskId}__true_end`;
      const falseEndTaskId = `${branchTaskId}__false_end`;
      const trueEndVar = makeUniqueVarName(trueEndTaskId);
      const falseEndVar = makeUniqueVarName(falseEndTaskId);

      branchDummyDefinitions.push(
        `    ${trueEndVar} = DummyOperator(task_id='${trueEndTaskId}')`,
        `    ${falseEndVar} = DummyOperator(task_id='${falseEndTaskId}')`,
      );

      const trueStartEdge = edges.find((e) => e.source === branchNode.id && e.sourceHandle === 'true');
      const falseStartEdge = edges.find((e) => e.source === branchNode.id && e.sourceHandle === 'false');

      const getReachableLeaves = (startNodeId) => {
        if (!startNodeId || !taskVarByNodeId.has(startNodeId)) return [];
        const visited = new Set();
        const queue = [startNodeId];
        while (queue.length) {
          const current = queue.shift();
          if (visited.has(current)) continue;
          visited.add(current);
          const outgoing = outgoingByNode.get(current) || [];
          outgoing.forEach((edge) => {
            if (taskVarByNodeId.has(edge.target)) queue.push(edge.target);
          });
        }

        const leaves = [...visited].filter((nodeId) => {
          const outgoing = (outgoingByNode.get(nodeId) || []).filter((edge) => visited.has(edge.target));
          return outgoing.length === 0;
        });
        return leaves.length ? leaves : [startNodeId];
      };

      const trueLeaves = getReachableLeaves(trueStartEdge?.target);
      const falseLeaves = getReachableLeaves(falseStartEdge?.target);

      trueLeaves.forEach((leafNodeId) => {
        dependencyLines.push(`    ${taskVarByNodeId.get(leafNodeId)} >> ${trueEndVar}`);
      });
      falseLeaves.forEach((leafNodeId) => {
        dependencyLines.push(`    ${taskVarByNodeId.get(leafNodeId)} >> ${falseEndVar}`);
      });
    });

    const defaultArgsLines = Object.entries(defaultArgs).map(([k, v]) => `    '${k}': ${v},`);
    const branchCallableDefs = [...branchCallableNames]
      .sort()
      .map((callableName) => `def ${callableName}(**context):\n    """TODO: Implementar lógica para ${callableName}"""\n    pass\n`);

    const pythonCode = `"""
DAG exportado desde DAG Builder
Compatible con Apache Airflow 2.4.0
Generado: ${new Date().toLocaleString('es-MX')}
"""

${[...importLines].sort().join('\n')}

${branchCallableDefs.join('\n')}
# Default args para el nodo raíz del DAG
default_args = {
${defaultArgsLines.join('\n')}
}

with DAG(
    dag_id='${dagId}',
    default_args=default_args,
    schedule_interval=${toPythonLiteral(dagSchedule)},
    catchup=${toPythonLiteral(Boolean(dagCatchup))},
    tags=${toPythonLiteral(dagTags)},
    description=${toPythonLiteral(dagDescription)},
) as dag:
${[...taskDefinitions, ...branchDummyDefinitions].join('\n\n')}

    # Secuencia del workflow
${dependencyLines.join('\n')}
`;

    const blob = new Blob([pythonCode], { type: 'text/x-python' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    console.log('✅ Python exportado:', filename);
    return { success: true, filename };
  },

  // 📥 Importar desde JSON
  importFromFile: (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const dagData = JSON.parse(e.target.result);
          
          if (!dagData.nodes || !dagData.edges) {
            throw new Error('Formato de archivo inválido');
          }
          
          console.log('✅ DAG importado:', file.name);
          resolve({
            success: true,
            data: dagData,
            filename: file.name
          });
        } catch (error) {
          console.error('❌ Error al importar:', error);
          reject({
            success: false,
            error: error.message
          });
        }
      };
      
      reader.onerror = () => {
        reject({
          success: false,
          error: 'Error al leer el archivo'
        });
      };
      
      reader.readAsText(file);
    });
  },

  // ✅ Validar DAG
  validateDAG: (nodes, edges) => {
    const errors = [];
    const warnings = [];
    
    // Verificar que hay nodos
    if (nodes.length === 0) {
      errors.push('El DAG no contiene nodos');
      return { valid: false, errors, warnings };
    }
    
    // Detectar ciclos
    const hasCycles = detectCycles(nodes, edges);
    if (hasCycles) {
      errors.push('El DAG contiene ciclos (no es un grafo acíclico)');
    }
    
    // Verificar nodos sin conexiones
    const disconnectedNodes = nodes.filter(node => {
      return !edges.some(e => e.source === node.id || e.target === node.id);
    });
    
    if (disconnectedNodes.length > 0) {
      warnings.push(`${disconnectedNodes.length} nodo(s) aislado(s): ${
        disconnectedNodes.map(n => n.data?.label || n.id).join(', ')
      }`);
    }
    
    // Verificar nodos sin etiqueta
    const nodesWithoutLabel = nodes.filter(n => !n.data?.label);
    if (nodesWithoutLabel.length > 0) {
      warnings.push(`${nodesWithoutLabel.length} nodo(s) sin etiqueta`);
    }
    
    const valid = errors.length === 0;
    
    console.log(valid ? '✅ DAG válido' : '❌ DAG inválido', { errors, warnings });
    
    return { valid, errors, warnings };
  },

  // 💾 Guardar en backend
  saveToBackend: async (nodes, edges, dagName = 'Untitled DAG') => {
    const dagData = {
      name: dagName,
      nodes,
      edges,
      metadata: {
        savedAt: new Date().toISOString(),
        version: '1.0'
      }
    };
    
    return await apiService.post('/dags/save', dagData);
  },

  // 📂 Cargar desde backend
  loadFromBackend: async (dagId) => {
    return await apiService.get(`/dags/${dagId}`);
  },

  // 📋 Listar DAGs guardados
  listDAGs: async () => {
    return await apiService.get('/dags/list');
  }
};

// ============== UTILIDADES ==============

// Detectar ciclos en el grafo usando DFS
function detectCycles(nodes, edges) {
  const visited = new Set();
  const recursionStack = new Set();
  
  const adjacencyList = {};
  nodes.forEach(node => {
    adjacencyList[node.id] = [];
  });
  
  edges.forEach(edge => {
    if (adjacencyList[edge.source]) {
      adjacencyList[edge.source].push(edge.target);
    }
  });
  
  const hasCycleDFS = (nodeId) => {
    visited.add(nodeId);
    recursionStack.add(nodeId);
    
    const neighbors = adjacencyList[nodeId] || [];
    
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (hasCycleDFS(neighbor)) {
          return true;
        }
      } else if (recursionStack.has(neighbor)) {
        return true;
      }
    }
    
    recursionStack.delete(nodeId);
    return false;
  };
  
  for (const node of nodes) {
    if (!visited.has(node.id)) {
      if (hasCycleDFS(node.id)) {
        return true;
      }
    }
  }
  
  return false;
}

// ============== LOGGER ==============
export class DAGLogger {
  constructor() {
    this.logs = [];
    this.maxLogs = 100;
  }
  
  log(action, status, details = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      action,
      status,
      ...details
    };
    
    this.logs.unshift(logEntry);
    
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }
    
    // Guardar en localStorage
    try {
      localStorage.setItem('dag_logs', JSON.stringify(this.logs.slice(0, 50)));
    } catch (e) {
      console.warn('No se pudo guardar el log en localStorage');
    }
    
    return logEntry;
  }
  
  getLogs() {
    return this.logs;
  }
  
  clearLogs() {
    this.logs = [];
    localStorage.removeItem('dag_logs');
  }
  
  loadLogs() {
    try {
      const saved = localStorage.getItem('dag_logs');
      if (saved) {
        this.logs = JSON.parse(saved);
      }
    } catch (e) {
      console.warn('No se pudo cargar logs desde localStorage');
    }
  }
}

// Exportar instancia única del logger
export const dagLogger = new DAGLogger();
dagLogger.loadLogs();

// ============== EXPORT DEFAULT ==============
export default {
  api: apiService,
  dag: dagService,
  logger: dagLogger
};
