import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';

const PublicRoute = ({ children }) => {
  const { currentUser, loading, initialized } = useAuth();

  // Mientras se verifica la autenticación
  if (!initialized || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <div className="flex gap-2 mb-4 justify-center">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-3 h-3 bg-blue-500 rounded-full"
                animate={{
                  y: [0, -15, 0],
                  opacity: [0.5, 1, 0.5]
                }}
                transition={{
                  duration: 0.8,
                  repeat: Infinity,
                  delay: i * 0.2,
                  ease: "easeInOut"
                }}
              />
            ))}
          </div>
          <p className="text-gray-400 text-sm">Cargando...</p>
        </motion.div>
      </div>
    );
  }

  // Si ya está autenticado, redirigir a home
  if (currentUser) {
    return <Navigate to="/splash" replace />;
  }

  // Si no está autenticado, mostrar la página pública
  return children;
};

export default PublicRoute;