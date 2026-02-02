import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

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
    if (error.response?.status === 401) {
      // Token expirado o inválido
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
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
  getAll: () => apiClient.get('/tasks'),
  getById: (id) => apiClient.get(`/tasks/${id}`),
  create: (data) => apiClient.post('/tasks', data),
  update: (id, data) => apiClient.put(`/tasks/${id}`, data),
  delete: (id) => apiClient.delete(`/tasks/${id}`)
};

export default apiClient;