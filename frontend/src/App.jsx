import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import PublicRoute from "./components/PublicRoute";
import Login from "./pages/Login";
import Splash from "./pages/Splash";
import Home from "./pages/Home";

function AnimatedRoutes() {
  return (
    <AnimatePresence mode="wait">
      <Routes>
        {/* Rutas públicas - si ya está autenticado, redirige a /splash */}
        <Route 
          path="/login" 
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          } 
        />
        
        {/* Rutas protegidas - requieren autenticación */}
        <Route 
          path="/splash" 
          element={
            <ProtectedRoute>
              <Splash />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/home" 
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          } 
        />
        
        {/* Ruta raíz - ir al splash y luego a la app (sin exigir login) */}
        <Route path="/" element={<Navigate to="/splash" replace />} />
        
        {/* Cualquier otra ruta - ir a splash */}
        <Route path="*" element={<Navigate to="/splash" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AnimatedRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}