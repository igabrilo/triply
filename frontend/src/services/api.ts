import axios from 'axios';

const API_BASE_URL = '/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('triply_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('triply_token');
    }
    return Promise.reject(error);
  }
);

// ------------------------------------------------------------------
// Auth API
// ------------------------------------------------------------------
export const authAPI = {
  async register(name: string, email: string, password: string) {
    const { data } = await apiClient.post('/auth/register', { name, email, password });
    return data;
  },
  
  async login(email: string, password: string) {
    const { data } = await apiClient.post('/auth/login', { email, password });
    return data;
  },
  
  async getCurrentUser() {
    const { data } = await apiClient.get('/auth/me');
    return data;
  },
  
  async getGoogleAuthUrl(intent?: string) {
    const params = intent ? { intent } : {};
    const { data } = await apiClient.get('/auth/google', { params });
    return data;
  },
  
  async getAppleAuthUrl(intent?: string) {
    const params = intent ? { intent } : {};
    const { data } = await apiClient.get('/auth/apple', { params });
    return data;
  },
};
