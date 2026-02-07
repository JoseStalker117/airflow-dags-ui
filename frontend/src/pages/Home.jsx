import { motion, AnimatePresence } from "framer-motion";
import { useRef, useState, useEffect, useCallback } from "react";
import TopBar from "../components/TopBar";
import BlockPalette from "../components/BlockPalette";
import DagCanvas from "../components/DagCanvas";
import { clearCanvasState, saveCanvasState, loadCanvasState } from "../utils/storage";
import { saveUserPreferences, loadUserPreferences } from "../utils/storage";
import { dagService, dagLogger } from "../services/dagService";

export default function Home() {
  const canvasRef = useRef(null);
  const paletteRef = useRef(null);
  const fileInputRef = useRef(null);
  
  const [paletteWidth, setPaletteWidth] = useState(() => {
    const saved = loadUserPreferences();
    return saved?.paletteWidth || 288;
  });
  
  const [isResizing, setIsResizing] = useState(false);
  const [notification, setNotification] = useState(null);

  // ============== HELPERS ==============
  
  // Obtener datos del canvas (incluye parameters/parameterDefinitions para backend y persistencia)
  const getCanvasData = useCallback(() => {
    if (!canvasRef.current) {
      return { nodes: [], edges: [] };
    }
    try {
      // Preferir payload serializable con contenido de paneles (parameters, parameterDefinitions)
      if (typeof canvasRef.current.getPayloadForBackend === "function") {
        return canvasRef.current.getPayloadForBackend();
      }
      if (canvasRef.current.getNodes && canvasRef.current.getEdges) {
        return {
          nodes: canvasRef.current.getNodes(),
          edges: canvasRef.current.getEdges()
        };
      }
      const savedState = loadCanvasState();
      return {
        nodes: savedState?.nodes || [],
        edges: savedState?.edges || []
      };
    } catch (error) {
      console.warn("No se pudieron obtener datos del canvas:", error);
      return { nodes: [], edges: [] };
    }
  }, []);

  // Aplicar datos al canvas (nodos con data.parameters, data.parameterDefinitions, etc.)
  const setCanvasData = useCallback((nodes, edges) => {
    if (!canvasRef.current) return;
    try {
      if (typeof canvasRef.current.setCanvasData === "function") {
        canvasRef.current.setCanvasData(nodes, edges);
        saveCanvasState(nodes, edges);
        return;
      }
      if (canvasRef.current.setNodes && canvasRef.current.setEdges) {
        canvasRef.current.setNodes(nodes);
        canvasRef.current.setEdges(edges);
        saveCanvasState(nodes, edges);
      }
    } catch (error) {
      console.error("Error al aplicar datos al canvas:", error);
    }
  }, []);

  // Mostrar notificación
  const showNotif = useCallback((message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  // ============== MANEJADOR DE ACCIONES ==============
  
  const handleTopBarAction = useCallback(async (action) => {
    const { nodes, edges } = getCanvasData();
    
    try {
      switch (action) {
        case "newDag":
          if (window.confirm("¿Estás seguro de que quieres crear un nuevo DAG? Se perderán los cambios no guardados.")) {
            clearCanvasState();
            dagLogger.log('newDag', 'success', { message: 'Nuevo DAG creado' });
            window.location.reload();
          }
          break;

        case "openDag":
          // Trigger file input
          if (fileInputRef.current) {
            fileInputRef.current.click();
          }
          break;

        case "saveDag":
          try {
            // Guardar localmente primero
            saveCanvasState(nodes, edges);
            
            // Intentar guardar en backend
            const result = await dagService.saveToBackend(nodes, edges, 'Mi DAG');
            
            if (result.success) {
              showNotif('✅ DAG guardado exitosamente');
              dagLogger.log('saveDag', 'success', { 
                nodeCount: nodes.length,
                edgeCount: edges.length 
              });
            } else {
              showNotif(`⚠️ Guardado local OK, backend: ${result.error}`, 'warning');
              dagLogger.log('saveDag', 'warning', { 
                error: result.error,
                message: 'Guardado solo local' 
              });
            }
          } catch (error) {
            // Si falla el backend, al menos guardamos local
            saveCanvasState(nodes, edges);
            showNotif('✅ DAG guardado localmente', 'warning');
            dagLogger.log('saveDag', 'warning', { 
              error: error.message,
              message: 'Solo guardado local' 
            });
          }
          break;

        case "saveAsDag":
          const dagName = prompt("Nombre del DAG:", `dag_${Date.now()}`);
          if (dagName) {
            const result = await dagService.saveToBackend(nodes, edges, dagName);
            if (result.success) {
              showNotif(`✅ Guardado como: ${dagName}`);
              dagLogger.log('saveAsDag', 'success', { dagName });
            } else {
              showNotif(`❌ Error: ${result.error}`, 'error');
              dagLogger.log('saveAsDag', 'error', { error: result.error });
            }
          }
          break;

        case "exportDag":
          const pythonFilename = `dag_${Date.now()}.py`;
          dagService.exportToPython(nodes, edges, pythonFilename);
          showNotif(`🐍 Exportado: ${pythonFilename}`);
          dagLogger.log('exportDag', 'success', { 
            filename: pythonFilename,
            nodeCount: nodes.length 
          });
          break;

        case "exportJson":
          const jsonFilename = `dag_${Date.now()}.json`;
          dagService.exportToJSON(nodes, edges, jsonFilename);
          showNotif(`📄 Exportado: ${jsonFilename}`);
          dagLogger.log('exportJson', 'success', { 
            filename: jsonFilename,
            nodeCount: nodes.length 
          });
          break;

        case "exportYaml":
          const yamlFilename = `dag_${Date.now()}.yaml`;
          dagService.exportToYAML(nodes, edges, yamlFilename);
          showNotif(`📋 Exportado: ${yamlFilename}`);
          dagLogger.log('exportYaml', 'success', { 
            filename: yamlFilename,
            nodeCount: nodes.length 
          });
          break;

        case "copyJson":
          const copyResult = await dagService.copyToClipboard(nodes, edges);
          if (copyResult.success) {
            showNotif('📋 JSON copiado al portapapeles');
            dagLogger.log('copyJson', 'success', { 
              nodeCount: copyResult.nodeCount,
              edgeCount: copyResult.edgeCount 
            });
          } else {
            showNotif(`❌ Error al copiar`, 'error');
            dagLogger.log('copyJson', 'error', { error: copyResult.error });
          }
          break;

        case "validateDag":
          const validation = dagService.validateDAG(nodes, edges);
          
          let alertMessage = validation.valid 
            ? '✅ DAG VÁLIDO\n\n' 
            : '❌ DAG INVÁLIDO\n\n';
          
          if (validation.errors.length > 0) {
            alertMessage += `Errores:\n${validation.errors.map(e => `  • ${e}`).join('\n')}\n\n`;
          }
          
          if (validation.warnings.length > 0) {
            alertMessage += `Advertencias:\n${validation.warnings.map(w => `  ⚠️ ${w}`).join('\n')}`;
          }
          
          alert(alertMessage);
          
          showNotif(
            validation.valid ? '✅ DAG válido' : '❌ DAG inválido',
            validation.valid ? 'success' : 'error'
          );
          
          dagLogger.log('validateDag', validation.valid ? 'success' : 'error', {
            errors: validation.errors,
            warnings: validation.warnings,
            nodeCount: nodes.length,
            edgeCount: edges.length
          });
          break;

        case "formatDag":
          // TODO: Implementar formateo automático
          showNotif('⚙️ Función en desarrollo', 'warning');
          dagLogger.log('formatDag', 'pending', { 
            message: 'Función por implementar' 
          });
          break;

        case "optimizeDag":
          // TODO: Implementar optimización
          showNotif('⚙️ Función en desarrollo', 'warning');
          dagLogger.log('optimizeDag', 'pending', { 
            message: 'Función por implementar' 
          });
          break;

        case "openSettings":
          showNotif('⚙️ Configuración en desarrollo', 'warning');
          break;

        case "openPreferences":
          showNotif('⚙️ Preferencias en desarrollo', 'warning');
          break;

        case "showAbout":
          alert(`DAG Builder v1.0
          
📊 Creado con React Flow
🔧 Gestión visual de DAGs para Apache Airflow

Estado actual:
  • Nodos: ${nodes.length}
  • Conexiones: ${edges.length}
  • Operaciones registradas: ${dagLogger.getLogs().length}

Desarrollado con ❤️`);
          break;

        default:
          console.log(`Acción no reconocida: ${action}`);
          dagLogger.log(action, 'pending', { 
            message: `Acción "${action}" no implementada` 
          });
      }
    } catch (error) {
      console.error(`Error en acción ${action}:`, error);
      showNotif(`❌ Error: ${error.message}`, 'error');
      dagLogger.log(action, 'error', { error: error.message });
    }
  }, [getCanvasData, setCanvasData, showNotif]);

  // ============== IMPORTAR ARCHIVO ==============
  
  const handleFileImport = useCallback(async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
      const result = await dagService.importFromFile(file);
      
      if (result.success) {
        // Aplicar datos al canvas
        setCanvasData(result.data.nodes, result.data.edges);
        
        showNotif(`✅ Importado: ${result.filename}`);
        dagLogger.log('openDag', 'success', { 
          filename: result.filename,
          nodeCount: result.data.nodes.length,
          edgeCount: result.data.edges.length
        });
      }
    } catch (error) {
      showNotif(`❌ Error al importar: ${error.message}`, 'error');
      dagLogger.log('openDag', 'error', { 
        error: error.message,
        filename: file.name 
      });
    }
    
    // Limpiar input
    event.target.value = '';
  }, [setCanvasData, showNotif]);

  // ============== GUARDAR PREFERENCIAS ==============
  
  useEffect(() => {
    saveUserPreferences({ paletteWidth });
  }, [paletteWidth]);

  // ============== REDIMENSIONAMIENTO ==============
  
  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      
      const newWidth = e.clientX;
      const minWidth = 200;
      const maxWidth = 600;
      
      if (newWidth >= minWidth && newWidth <= maxWidth) {
        setPaletteWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  // ============== RENDER ==============
  
  return (
    <motion.div
      initial={{ opacity: 0, filter: "blur(12px)", scale: 0.98 }}
      animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
      exit={{ opacity: 0, filter: "blur(10px)", scale: 1.02 }}
      transition={{ duration: 1, ease: "easeOut" }}
      className="h-screen w-full flex flex-col bg-gray-100"
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileImport}
        className="hidden"
      />

      {/* Notification Toast */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 20, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.9 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="fixed top-0 right-4 z-[100] pointer-events-none"
          >
            <div className={`
              px-6 py-3 rounded-lg shadow-2xl flex items-center gap-3 min-w-[300px]
              ${notification.type === 'error' 
                ? 'bg-red-500 text-white' 
                : notification.type === 'warning'
                ? 'bg-yellow-500 text-white'
                : 'bg-green-500 text-white'
              }
            `}>
              <span className="material-symbols-outlined text-2xl">
                {notification.type === 'error' 
                  ? 'error' 
                  : notification.type === 'warning'
                  ? 'warning'
                  : 'check_circle'
                }
              </span>
              <span className="font-medium flex-1">{notification.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TopBar */}
      <TopBar onAction={handleTopBarAction} />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* BlockPalette con ancho dinámico */}
        <div 
          ref={paletteRef}
          style={{ width: `${paletteWidth}px`, minWidth: "200px", maxWidth: "600px" }}
          className="flex-shrink-0 h-full"
        >
          <BlockPalette />
        </div>

        {/* Divisor resizable */}
        <div
          onMouseDown={handleMouseDown}
          className={`w-1 bg-gray-300 hover:bg-blue-500 cursor-col-resize flex-shrink-0 transition-colors ${
            isResizing ? "bg-blue-600" : ""
          }`}
          style={{ userSelect: "none" }}
        >
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-0.5 h-8 bg-gray-400 rounded-full"></div>
          </div>
        </div>

        {/* DagCanvas - ocupa el resto del espacio */}
        <div className="flex-1 min-w-0">
          <DagCanvas ref={canvasRef} />
        </div>
      </div>
    </motion.div>
  );
}