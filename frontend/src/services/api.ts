import axios from 'axios';
import type { TripFormData, EditScope } from '@/types';

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
// Geocoding API
// ------------------------------------------------------------------
export const geocodeAPI = {
  async reverseGeocode(lat: number, lng: number) {
    const { data } = await apiClient.get('/geocode/reverse', { params: { lat, lng } });
    return data;
  },
};

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

// ------------------------------------------------------------------
// Trip API
// ------------------------------------------------------------------
export const tripAPI = {
  async createTrip(formData: TripFormData) {
    const { data } = await apiClient.post('/trips', { formData });
    return data;
  },

  async getTrips() {
    const { data } = await apiClient.get('/trips');
    return data;
  },

  async getTrip(tripId: string) {
    const { data } = await apiClient.get(`/trips/${tripId}`);
    return data;
  },

  async updateTrip(tripId: string, updates: Record<string, unknown>) {
    const { data } = await apiClient.put(`/trips/${tripId}`, updates);
    return data;
  },

  async deleteTrip(tripId: string) {
    const { data } = await apiClient.delete(`/trips/${tripId}`);
    return data;
  },

  /**
   * Open an SSE connection to stream trip generation progress.
   *
   * Returns an EventSource. The caller should listen to:
   *   - 'status'        → { phase: string }
   *   - 'section_ready' → { section: string, data: any[] }
   *   - 'done'          → { tripId: string }
   *   - 'error'         → { message: string }
   */
  streamGeneration(tripId: string): EventSource {
    const token = localStorage.getItem('triply_token');
    const url = `${API_BASE_URL}/trips/${tripId}/stream${token ? `?token=${token}` : ''}`;
    return new EventSource(url);
  },
};

// ------------------------------------------------------------------
// Chat API
// ------------------------------------------------------------------
export const chatAPI = {
  async getHistory(tripId: string) {
    const { data } = await apiClient.get(`/trips/${tripId}/chat`);
    return data;
  },

  async sendMessage(tripId: string, content: string, editScope?: EditScope) {
    const { data } = await apiClient.post(`/trips/${tripId}/chat`, {
      content,
      editScope: editScope
        ? {
            section: editScope.section,
            dayNumber: editScope.dayNumber,
            targetRefType: editScope.itemId ? 'plan_item' : undefined,
            targetRefId: editScope.itemId,
          }
        : undefined,
    });
    return data;
  },
};
