import { create } from 'zustand';
import { tripAPI } from '@/services/api';
import type { TripFormData, Trip, TabId, BudgetLevel, PlanDay, Flight, Stay } from '@/types';

interface TripState {
  /* ─── Form ─── */
  formData: TripFormData;
  updateFormData: (partial: Partial<TripFormData>) => void;
  resetForm: () => void;

  /* ─── Generation ─── */
  isGenerating: boolean;
  generationStatus: string;
  currentTrip: Trip | null;
  generateTrip: () => Promise<void>;
  loadTrip: (tripId: string) => Promise<void>;

  /* ─── Dashboard ─── */
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  selectedDay: number | null;
  setSelectedDay: (day: number | null) => void;

  /* ─── Actions ─── */
  toggleFlightSaved: (flightId: string) => void;
  toggleStaySaved: (stayId: string) => void;
  updateActivityStatus: (activityId: string, status: 'planned' | 'saved' | 'must-do' | 'skip') => void;

  /* ─── Section update from chat edits ─── */
  updatedSections: Record<string, number>;
  markSectionUpdated: (section: string) => void;
  applySectionData: (section: string, data: unknown[]) => void;
}

const defaultFormData: TripFormData = {
  destinations: [],
  startDate: '',
  endDate: '',
  travelers: 2,
  budget: 'mid' as BudgetLevel,
  origin: '',
  preferences: {
    interests: [],
    pace: 'balanced',
    stayStyle: [],
    dealBreakers: [],
    accessibility: [],
    dietary: [],
    kidsFriendly: false,
  },
};

// ------------------------------------------------------------------
// Status labels for each generation phase
// ------------------------------------------------------------------
const phaseLabels: Record<string, string> = {
  generating_plan: 'Building your itinerary...',
  generating_stays: 'Finding accommodation...',
  generating_flights: 'Searching flights...',
};

// ------------------------------------------------------------------
// Transform backend data → frontend types
// ------------------------------------------------------------------
function transformDays(backendDays: any[]): PlanDay[] {
  return backendDays.map((d: any) => ({
    day: d.dayIndex ?? d.day_index ?? 0,
    title: d.title || `Day ${(d.dayIndex ?? d.day_index ?? 0) + 1}`,
    activities: (d.items || d.planItems || []).map((item: any, idx: number) => ({
      id: item.id || `item_${idx}`,
      name: item.title || item.name || '',
      description: item.description || '',
      timeOfDay: item.timeBlock || item.time_block || '',
      duration: item.durationMinutes ? `${item.durationMinutes} min` : '',
      links: [
        ...(item.mapsUrl || item.maps_url
          ? [{ label: 'Map', url: item.mapsUrl || item.maps_url, type: 'map' as const }]
          : []),
        ...(item.externalUrl || item.external_url
          ? [{ label: 'Link', url: item.externalUrl || item.external_url, type: 'other' as const }]
          : []),
      ],
      status: item.status || 'planned',
      tags: [item.category || item.timeBlock || item.time_block].filter(Boolean) as string[],
    })),
  }));
}

function transformFlights(backendFlights: any[]): Flight[] {
  return backendFlights.map((f: any, idx: number) => {
    const details = f.details || {};
    return {
      id: f.id || `flight_${idx}`,
      airline: f.airline || details.airline || 'Unknown',
      departure: details.origin || f.origin || '',
      arrival: details.destination || f.destination || '',
      departureTime: details.departTimeHint || (f.departTime ? new Date(f.departTime).toLocaleTimeString() : ''),
      arrivalTime: details.arriveTimeHint || (f.arriveTime ? new Date(f.arriveTime).toLocaleTimeString() : ''),
      duration: details.durationHint || (f.durationMinutes ? `${f.durationMinutes} min` : ''),
      stops: f.stopsCount ?? f.stops_count ?? 0,
      priceRange: details.priceHint || (f.price ? `€${f.price}` : ''),
      bookingUrl: f.deepLinkUrl || f.deep_link_url || details.bookingSearchUrl || '#',
      saved: f.saved || false,
    };
  });
}

function transformStays(backendStays: any[]): Stay[] {
  return backendStays.map((s: any, idx: number) => {
    const details = s.details || {};
    return {
      id: s.id || `stay_${idx}`,
      name: s.name || 'Unknown',
      type: details.stayType || s.stay_type || 'Hotel',
      neighborhood: s.neighborhood || '',
      priceRange: details.priceRange || s.price_range || (s.price ? `€${s.price}/night` : ''),
      rating: s.rating ?? s.rating_hint ?? 0,
      reviewCount: 0,
      whyItFits: s.whyItFits || s.why_it_fits || '',
      bookingUrl: s.deepLinkUrl || s.deep_link_url || details.bookingSearchUrl || '#',
      amenities: details.amenities || s.amenities || [],
      saved: s.saved || false,
    };
  });
}

// ------------------------------------------------------------------
// Store
// ------------------------------------------------------------------

export const useTripStore = create<TripState>((set, get) => ({
  formData: { ...defaultFormData },

  updateFormData: (partial) =>
    set((s) => ({ formData: { ...s.formData, ...partial } })),

  resetForm: () => set({ formData: { ...defaultFormData } }),

  isGenerating: false,
  generationStatus: '',
  currentTrip: null,

  // -----------------------------------------------------------------
  // Generate trip: POST to create, then SSE for progressive results.
  // Resolves as soon as the trip record exists and the SSE stream is
  // open so the caller can navigate to the dashboard immediately.
  // -----------------------------------------------------------------
  generateTrip: async () => {
    const { formData } = get();
    set({ isGenerating: true, generationStatus: 'Creating your trip...' });

    try {
      const result = await tripAPI.createTrip(formData);
      if (!result.success) {
        throw new Error(result.message || 'Failed to create trip');
      }

      const tripId = result.trip.id;

      // Initialize a skeleton trip so the dashboard can render immediately
      const trip: Trip = {
        id: tripId,
        userId: result.trip.userId,
        formData,
        flights: [],
        stays: [],
        plan: [],
        savedItems: [],
        createdAt: result.trip.createdAt || new Date().toISOString(),
        updatedAt: result.trip.updatedAt || new Date().toISOString(),
        status: 'generating',
      };
      set({ currentTrip: trip });

      // Open SSE stream (fire-and-forget – updates arrive asynchronously)
      const eventSource = tripAPI.streamGeneration(tripId);

      eventSource.addEventListener('status', (e: MessageEvent) => {
        const data = JSON.parse(e.data);
        const label = phaseLabels[data.phase] || data.phase;
        set({ generationStatus: label });
      });

      eventSource.addEventListener('section_ready', (e: MessageEvent) => {
        const data = JSON.parse(e.data);
        const section = data.section;
        const sectionData = data.data;

        set((s) => {
          if (!s.currentTrip) return {};
          const updates: Partial<Trip> = {};

          if (section === 'plan') {
            updates.plan = transformDays(sectionData);
          } else if (section === 'stays') {
            updates.stays = transformStays(sectionData);
          } else if (section === 'flights') {
            updates.flights = transformFlights(sectionData);
          }

          return {
            currentTrip: { ...s.currentTrip, ...updates },
            updatedSections: { ...s.updatedSections, [section]: Date.now() },
          };
        });
      });

      eventSource.addEventListener('done', (_e: MessageEvent) => {
        eventSource.close();
        set((s) => ({
          isGenerating: false,
          generationStatus: '',
          currentTrip: s.currentTrip ? { ...s.currentTrip, status: 'ready' } : null,
        }));
      });

      eventSource.addEventListener('error', (e: MessageEvent) => {
        try {
          const data = JSON.parse((e as any).data || '{}');
          console.error('Generation error:', data.message);
          set((s) => ({
            isGenerating: false,
            generationStatus: '',
            currentTrip: s.currentTrip ? { ...s.currentTrip, status: 'error' } : null,
          }));
        } catch {
          console.error('SSE connection error');
        }
        eventSource.close();
      });

      eventSource.onerror = () => {
        eventSource.close();
        set((s) => ({
          isGenerating: false,
          generationStatus: '',
          currentTrip: s.currentTrip ? { ...s.currentTrip, status: 'error' } : null,
        }));
      };

      // Resolve immediately – SSE events will continue updating state
    } catch (err: any) {
      console.error('Trip creation failed:', err);
      set({
        isGenerating: false,
        generationStatus: '',
      });
    }
  },

  // -----------------------------------------------------------------
  // Load an existing trip from the backend
  // -----------------------------------------------------------------
  loadTrip: async (tripId: string) => {
    try {
      const result = await tripAPI.getTrip(tripId);
      if (!result.success || !result.trip) return;

      const t = result.trip;
      const trip: Trip = {
        id: t.id,
        userId: t.userId,
        formData: {
          destinations: t.destination ? [t.destination] : [],
          startDate: t.startDate || '',
          endDate: t.endDate || '',
          travelers: t.travelersCount || 2,
          budget: (t.budgetTier || 'mid') as BudgetLevel,
          origin: t.origin || '',
          preferences: {
            interests: t.interests ? t.interests.split(',') : [],
            pace: (t.pace || 'balanced') as 'relaxed' | 'balanced' | 'packed',
            stayStyle: [],
            dealBreakers: [],
            accessibility: [],
            dietary: [],
            kidsFriendly: false,
          },
        },
        flights: transformFlights(t.flights || []),
        stays: transformStays(t.stays || []),
        plan: transformDays(t.days || []),
        savedItems: [],
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        status: t.status,
      };
      set({ currentTrip: trip });
    } catch (err) {
      console.error('Failed to load trip:', err);
    }
  },

  activeTab: 'plan',
  setActiveTab: (tab) => set({ activeTab: tab }),
  selectedDay: null,
  setSelectedDay: (day) => set({ selectedDay: day }),

  toggleFlightSaved: (flightId) =>
    set((s) => {
      if (!s.currentTrip) return {};
      const flights = s.currentTrip.flights.map((f) =>
        f.id === flightId ? { ...f, saved: !f.saved } : f
      );
      return { currentTrip: { ...s.currentTrip, flights } };
    }),

  toggleStaySaved: (stayId) =>
    set((s) => {
      if (!s.currentTrip) return {};
      const stays = s.currentTrip.stays.map((st) =>
        st.id === stayId ? { ...st, saved: !st.saved } : st
      );
      return { currentTrip: { ...s.currentTrip, stays } };
    }),

  updateActivityStatus: (activityId, status) =>
    set((s) => {
      if (!s.currentTrip) return {};
      const plan = s.currentTrip.plan.map((day) => ({
        ...day,
        activities: day.activities.map((a) =>
          a.id === activityId ? { ...a, status } : a
        ),
      }));
      return { currentTrip: { ...s.currentTrip, plan } };
    }),

  updatedSections: {},
  markSectionUpdated: (section) =>
    set((s) => ({
      updatedSections: { ...s.updatedSections, [section]: Date.now() },
    })),

  // -----------------------------------------------------------------
  // Apply section data from a chat edit response
  // -----------------------------------------------------------------
  applySectionData: (section: string, data: unknown[]) => {
    set((s) => {
      if (!s.currentTrip) return {};
      const updates: Partial<Trip> = {};

      if (section === 'plan') {
        updates.plan = transformDays(data);
      } else if (section === 'stays') {
        updates.stays = transformStays(data);
      } else if (section === 'flights') {
        updates.flights = transformFlights(data);
      }

      return {
        currentTrip: { ...s.currentTrip, ...updates },
        updatedSections: { ...s.updatedSections, [section]: Date.now() },
      };
    });
  },
}));
