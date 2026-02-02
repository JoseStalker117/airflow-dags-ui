import { createContext, useContext, useEffect, useState } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  // Inicializar - verificar si hay sesión guardada
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('token');
      const savedUser = localStorage.getItem('user');

      if (token && savedUser) {
        try {
          const user = JSON.parse(savedUser);
          setCurrentUser(user);

          // Validar token con el backend
          try {
            const response = await authAPI.getCurrentUser();
            setCurrentUser(response.data);
            localStorage.setItem('user', JSON.stringify(response.data));
          } catch (error) {
            // Token inválido o expirado
            console.log('Token inválido, limpiando sesión');
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setCurrentUser(null);
          }
        } catch (error) {
          console.error('Error parseando usuario:', error);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setCurrentUser(null);
        }
      }

      setLoading(false);
      setInitialized(true);
    };

    initAuth();
  }, []);

  // Login con email y password
  const login = async (email, password) => {
    try {
      const response = await authAPI.login(email, password);
      const { token, user } = response.data;

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      setCurrentUser(user);

      return user;
    } catch (error) {
      throw error;
    }
  };

  // Registro con email y password
  const register = async (email, password) => {
    try {
      const response = await authAPI.register(email, password);
      const { token, user } = response.data;

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      setCurrentUser(user);

      return user;
    } catch (error) {
      throw error;
    }
  };

  // Login anónimo
  const loginAnonymous = async () => {
    try {
      const response = await authAPI.loginAnonymous();
      const { token, user } = response.data;

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      setCurrentUser(user);

      return user;
    } catch (error) {
      throw error;
    }
  };

  // Cerrar sesión
  const signOut = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Error en logout:', error);
    } finally {
      // Limpiar todo del localStorage
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('canvas');
      setCurrentUser(null);
    }
  };

  // Refrescar datos del usuario
  const refreshUser = async () => {
    try {
      const response = await authAPI.getCurrentUser();
      setCurrentUser(response.data);
      localStorage.setItem('user', JSON.stringify(response.data));
      return response.data;
    } catch (error) {
      console.error('Error refrescando usuario:', error);
      return null;
    }
  };

  const value = {
    currentUser,
    loading,
    initialized,
    login,
    register,
    loginAnonymous,
    signOut,
    refreshUser,
    isAuthenticated: !!currentUser,
    isAdmin: currentUser?.admin || false,
    isAnonymous: currentUser?.isAnonymous || false,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};