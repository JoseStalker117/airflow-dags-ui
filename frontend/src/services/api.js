import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

// Crear instancia de axios
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptor para añadir el token a todas las peticiones
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para manejar errores de autenticación
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const requestUrl = error.config?.url || '';
    const isAuthEndpoint = requestUrl.includes('/auth/login') || requestUrl.includes('/auth/register');
    const hasToken = !!localStorage.getItem('token');

    if (status === 401 && !isAuthEndpoint && hasToken) {
      // Token expirado o inválido (solo para endpoints protegidos)
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth endpoints
export const authAPI = {
  register: (email, password) => 
    apiClient.post('/auth/register', { email, password }),
  
  login: (email, password) => 
    apiClient.post('/auth/login', { email, password }),
  
  loginAnonymous: () => 
    apiClient.post('/auth/login/anonymous'),
  
  getCurrentUser: () => 
    apiClient.get('/auth/me'),
  
  logout: () => 
    apiClient.post('/auth/logout')
};

// Task endpoints
export const taskAPI = {
  getAll: (config = {}) => apiClient.get('/tasks', config),
  getAllAdmin: (config = {}) => apiClient.get('/admin/tasks', config),
  getById: (id) => apiClient.get(`/tasks/${id}`),
  create: (data) => apiClient.post('/tasks', data),
  update: (id, data) => apiClient.put(`/tasks/${id}`, data),
  delete: (id) => apiClient.delete(`/tasks/${id}`)
};

export const templateAPI = {
  getAll: (config = {}) => apiClient.get('/templates', config),
  getAllAdmin: (config = {}) => apiClient.get('/admin/templates', config),
  getById: (id) => apiClient.get(`/templates/${id}`),
  create: (data) => apiClient.post('/templates', data),
  update: (id, data) => apiClient.put(`/templates/${id}`, data),
  delete: (id) => apiClient.delete(`/templates/${id}`)
};

export const categoryAPI = {
  getAll: (config = {}) => apiClient.get('/categories', config),
  getAllAdmin: (config = {}) => apiClient.get('/admin/categories', config),
  create: (id, data) => apiClient.post(`/categories/${id}`, data),
  update: (id, data) => apiClient.put(`/categories/${id}`, data),
  delete: (id) => apiClient.delete(`/categories/${id}`)
};

export const styleAPI = {
  getAll: (config = {}) => apiClient.get('/styles', config),
  getAllAdmin: (config = {}) => apiClient.get('/admin/styles', config),
  create: (id, data) => apiClient.post(`/styles/${id}`, data),
  update: (id, data) => apiClient.put(`/styles/${id}`, data),
  delete: (id) => apiClient.delete(`/styles/${id}`),
};

export const userPreferencesAPI = {
  get: (config = {}) => apiClient.get('/user/preferences', config),
  update: (data) => apiClient.put('/user/preferences', data),
};

export const aiAPI = {
  chat: (data) => apiClient.post('/ai/chat', data),
};

export default apiClient;
