import { motion } from "framer-motion";
import { useRef, useState, useEffect, useCallback } from "react";
import TopBar from "../components/TopBar";
import BlockPalette from "../components/BlockPalette";
import DagCanvas from "../components/DagCanvas";
import { clearCanvasState, saveCanvasState, loadCanvasState } from "../utils/storage";
import { saveUserPreferences, loadUserPreferences } from "../utils/storage";

function handleTopBarAction(action, canvasRef) {
  switch (action) {
    case "newDag":
      if (window.confirm("¿Estás seguro de que quieres crear un nuevo DAG? Se perderán los cambios no guardados.")) {
        clearCanvasState();
        window.location.reload(); // Recargar para limpiar el canvas
      }
      break;
    case "openDag":
      console.log("Abrir DAG - Funcionalidad por implementar");
      break;
    case "saveDag":
      console.log("Guardar DAG - Auto-guardado activo");
      break;
    case "saveAsDag":
      console.log("Guardar DAG Como...");
      break;
    case "exportDag":
      console.log("Exportar DAG Python");
      break;
    case "exportJson":
      console.log("Exportar JSON");
      break;
    case "exportYaml":
      console.log("Exportar YAML");
      break;
    case "validateDag":
      console.log("Validar DAG");
      break;
    case "formatDag":
      console.log("Formatear DAG");
      break;
    case "optimizeDag":
      console.log("Optimizar DAG");
      break;
    case "openSettings":
      console.log("Abrir Configuración");
      break;
    case "openPreferences":
      console.log("Abrir Preferencias");
      break;
    case "showAbout":
      console.log("Mostrar Acerca de");
      break;
    default:
      console.log(`Acción no reconocida: ${action}`);
  }
}

export default function Home() {
  const canvasRef = useRef(null);
  const paletteRef = useRef(null);
  const [paletteWidth, setPaletteWidth] = useState(() => {
    const saved = loadUserPreferences();
    return saved?.paletteWidth || 288; // 72 * 4 = 288px (w-72)
  });
  const [isResizing, setIsResizing] = useState(false);

  // Guardar ancho del palete en preferencias
  useEffect(() => {
    saveUserPreferences({ paletteWidth });
  }, [paletteWidth]);

  // Manejar el redimensionamiento
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

  const handleAction = (action) => {
    handleTopBarAction(action, canvasRef);
  };

  return (
    <motion.div
      initial={{ opacity: 0, filter: "blur(12px)", scale: 0.98 }}
      animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
      exit={{ opacity: 0, filter: "blur(10px)", scale: 1.02 }}
      transition={{ duration: 1, ease: "easeOut" }}
      className="h-screen w-full flex flex-col bg-gray-100"
    >
      <TopBar onAction={handleAction} />

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
