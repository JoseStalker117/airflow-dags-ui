// components/LoggerPanel.jsx
// Panel lateral opcional para ver el historial de operaciones

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { dagLogger } from '../services/dagService';

export default function LoggerPanel({ isOpen, onClose }) {
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState('all'); // all, success, error, pending

  useEffect(() => {
    // Actualizar logs cada segundo
    const interval = setInterval(() => {
      setLogs(dagLogger.getLogs());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const filteredLogs = logs.filter(log => {
    if (filter === 'all') return true;
    return log.status === filter;
  });

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success':
        return 'check_circle';
      case 'error':
        return 'error';
      case 'pending':
        return 'schedule';
      default:
        return 'info';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'success':
        return 'text-green-600 bg-green-50';
      case 'error':
        return 'text-red-600 bg-red-50';
      case 'pending':
        return 'text-yellow-600 bg-yellow-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const handleClearLogs = () => {
    if (window.confirm('¿Estás seguro de que quieres limpiar el historial?')) {
      dagLogger.clearLogs();
      setLogs([]);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black bg-opacity-30 z-40"
          />

          {/* Panel */}
          <motion.div
            initial={{ x: 400 }}
            animate={{ x: 0 }}
            exit={{ x: 400 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-96 bg-white shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined">history</span>
                  Historial de Operaciones
                </h2>
                <button
                  onClick={onClose}
                  className="p-1 hover:bg-blue-800 rounded transition-colors"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              
              <div className="text-sm opacity-90">
                {filteredLogs.length} registro(s)
              </div>
            </div>

            {/* Filters */}
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <div className="flex gap-2">
                {['all', 'success', 'error', 'pending'].map(status => (
                  <button
                    key={status}
                    onClick={() => setFilter(status)}
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                      filter === status
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                    }`}
                  >
                    {status === 'all' ? 'Todos' : status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Logs List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {filteredLogs.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <span className="material-symbols-outlined text-5xl mb-2 opacity-30">
                    inbox
                  </span>
                  <p>No hay registros</p>
                </div>
              ) : (
                filteredLogs.map((log, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-3 rounded-lg border-l-4 ${getStatusColor(log.status)} border-l-current`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-lg">
                        {getStatusIcon(log.status)}
                      </span>
                      
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm capitalize">
                          {log.action.replace(/([A-Z])/g, ' $1').trim()}
                        </div>
                        
                        {log.message && (
                          <div className="text-xs text-gray-600 mt-1">
                            {log.message}
                          </div>
                        )}
                        
                        {log.filename && (
                          <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">
                              description
                            </span>
                            {log.filename}
                          </div>
                        )}
                        
                        {log.nodeCount !== undefined && (
                          <div className="text-xs text-gray-500 mt-1">
                            {log.nodeCount} nodos, {log.edgeCount || 0} conexiones
                          </div>
                        )}
                        
                        {log.errors && log.errors.length > 0 && (
                          <div className="text-xs text-red-600 mt-1">
                            {log.errors.join(', ')}
                          </div>
                        )}
                        
                        {log.warnings && log.warnings.length > 0 && (
                          <div className="text-xs text-yellow-600 mt-1">
                            ⚠️ {log.warnings.join(', ')}
                          </div>
                        )}
                        
                        <div className="text-xs text-gray-400 mt-1">
                          {new Date(log.timestamp).toLocaleTimeString('es-MX')}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={handleClearLogs}
                className="w-full px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined">delete</span>
                Limpiar Historial
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}