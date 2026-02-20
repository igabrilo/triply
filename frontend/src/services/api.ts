import axios from 'axios';
import type { TripFormData, EditScope } from '@/types';
import { supabase } from '@/services/supabase';

const API_BASE_URL = '/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor – attach Supabase access token
apiClient.interceptors.request.use(
  async (config) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Session may have expired – Supabase client will auto-refresh
      // on next getSession() call, so no need to clear localStorage.
    }
    return Promise.reject(error);
  },
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
// Auth API (only profile fetch – actual auth handled by Supabase client)
// ------------------------------------------------------------------
export const authAPI = {
  async getCurrentUser() {
    const { data } = await apiClient.get('/auth/me');
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
   * Returns a Promise<EventSource>. The caller should listen to:
   *   - 'status'        → { phase: string }
   *   - 'section_ready' → { section: string, data: any[] }
   *   - 'done'          → { tripId: string }
   *   - 'error'         → { message: string }
   */
  async streamGeneration(tripId: string): Promise<EventSource> {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token ?? '';
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
