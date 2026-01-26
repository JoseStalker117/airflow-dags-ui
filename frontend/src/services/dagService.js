// ============================================
// services/dagService.js
// Servicio completo para gestión de DAGs
// ============================================

import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

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
  exportToPython: (nodes, edges, filename = 'dag.py', dagId = 'generated_dag') => {
    const pythonCode = `"""
DAG generado automáticamente
Creado: ${new Date().toLocaleString('es-MX')}
Nodos: ${nodes.length} | Conexiones: ${edges.length}
"""

from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.operators.bash import BashOperator
from datetime import datetime, timedelta

# Configuración por defecto
default_args = {
    'owner': 'airflow',
    'depends_on_past': False,
    'start_date': datetime(2024, 1, 1),
    'email_on_failure': False,
    'email_on_retry': False,
    'retries': 1,
    'retry_delay': timedelta(minutes=5),
}

# Definir DAG
with DAG(
    '${dagId}',
    default_args=default_args,
    description='DAG generado desde ReactFlow',
    schedule_interval='@daily',
    catchup=False,
    tags=['auto-generated'],
) as dag:

    # ========== TAREAS ==========
${nodes.map(node => {
  const taskId = node.id.replace(/[^a-zA-Z0-9_]/g, '_');
  const label = node.data?.label || node.id;
  const taskType = node.data?.type || 'python';
  
  if (taskType === 'bash') {
    return `    ${taskId} = BashOperator(
        task_id='${taskId}',
        bash_command='echo "Ejecutando: ${label}"',
    )`;
  } else {
    return `    ${taskId} = PythonOperator(
        task_id='${taskId}',
        python_callable=lambda: print('Ejecutando: ${label}'),
    )`;
  }
}).join('\n\n')}

    # ========== DEPENDENCIAS ==========
${edges.map(edge => {
  const source = edge.source.replace(/[^a-zA-Z0-9_]/g, '_');
  const target = edge.target.replace(/[^a-zA-Z0-9_]/g, '_');
  return `    ${source} >> ${target}`;
}).join('\n')}
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

  // 📄 Exportar a YAML
  exportToYAML: (nodes, edges, filename = 'dag.yaml') => {
    const yamlContent = `# DAG Configuration
# Generado: ${new Date().toLocaleString('es-MX')}

metadata:
  name: dag_configuration
  version: '1.0'
  created: ${new Date().toISOString()}
  stats:
    nodes: ${nodes.length}
    edges: ${edges.length}

# Nodos del DAG
nodes:
${nodes.map(node => `  - id: ${node.id}
    type: ${node.type || 'default'}
    label: ${node.data?.label || node.id}
    position:
      x: ${node.position.x}
      y: ${node.position.y}
    data: ${JSON.stringify(node.data || {})}`).join('\n')}

# Conexiones del DAG
edges:
${edges.map(edge => `  - id: ${edge.id}
    source: ${edge.source}
    target: ${edge.target}
    type: ${edge.type || 'default'}`).join('\n')}
`;

    const blob = new Blob([yamlContent], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    console.log('✅ YAML exportado:', filename);
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