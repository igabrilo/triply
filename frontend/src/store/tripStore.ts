import { create } from 'zustand';
import { tripAPI } from '@/services/api';
import type {
  TripFormData,
  Trip,
  TabId,
  BudgetLevel,
  PlanDay,
  Flight,
  Stay,
  SuggestedActivity,
  WeatherDay,
  BudgetHint,
  OverviewData,
} from '@/types';

interface TripState {
  /* ─── Form ─── */
  formData: TripFormData;
  updateFormData: (partial: Partial<TripFormData>) => void;
  resetForm: () => void;
  clearRememberedDefaults: () => void;

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
  focusFlightId: string | null;
  setFocusFlightId: (flightId: string | null) => void;
  focusStayId: string | null;
  setFocusStayId: (stayId: string | null) => void;

  /* ─── Actions ─── */
  toggleFlightSaved: (flightId: string) => void;
  toggleStaySaved: (stayId: string) => void;
  updateActivityStatus: (activityId: string, status: 'planned' | 'saved' | 'must-do' | 'skip') => void;
  selectPrimaryFlight: (flightId: string) => Promise<void>;
  selectPrimaryStay: (stayId: string) => Promise<void>;
  addSuggestedActivityToDay: (activityId: string, dayNumber: number) => Promise<void>;
  updateSuggestedActivityStatus: (activityId: string, status: 'suggested' | 'saved' | 'dismissed') => Promise<void>;
  generateMoreActivities: (category?: string) => Promise<void>;
  returnPlanItemToBucket: (itemId: string) => Promise<void>;
  autofillDay: (dayNumber: number, limit?: number) => Promise<void>;
  refreshWeather: () => Promise<void>;
  saveTripNotes: (notes: string) => Promise<void>;
  saveOverviewImage: (imageUrl: string) => Promise<void>;
  addBudgetEntry: (payload: { category: string; amount: number; date: string; note?: string }) => Promise<void>;
  updateBudgetEntry: (
    entryId: string,
    payload: { category?: string; amount?: number; date?: string; note?: string },
  ) => Promise<void>;
  deleteBudgetEntry: (entryId: string) => Promise<void>;

  /* ─── Section update from chat edits ─── */
  updatedSections: Record<string, number>;
  markSectionUpdated: (section: string) => void;
  applySectionData: (section: string, data: unknown) => void;
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

const FORM_MEMORY_KEY = 'triply:last-trip-defaults:v1';

type FormMemoryPayload = {
  origin?: string;
  budget?: BudgetLevel;
  pace?: 'relaxed' | 'balanced' | 'packed';
};

function loadFormMemory(): FormMemoryPayload {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(FORM_MEMORY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as FormMemoryPayload;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveFormMemory(formData: TripFormData): void {
  if (typeof window === 'undefined') return;
  const payload: FormMemoryPayload = {
    origin: (formData.origin || '').trim(),
    budget: formData.budget,
    pace: formData.preferences.pace,
  };
  window.localStorage.setItem(FORM_MEMORY_KEY, JSON.stringify(payload));
}

function clearFormMemory(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(FORM_MEMORY_KEY);
}

function initialFormData(): TripFormData {
  const memory = loadFormMemory();
  const validBudget: BudgetLevel[] = ['budget', 'mid', 'premium', 'luxury'];
  const validPace: Array<'relaxed' | 'balanced' | 'packed'> = ['relaxed', 'balanced', 'packed'];
  const paceValue = memory.pace;

  return {
    ...defaultFormData,
    origin: memory.origin || defaultFormData.origin,
    budget: validBudget.includes(memory.budget as BudgetLevel) ? (memory.budget as BudgetLevel) : defaultFormData.budget,
    preferences: {
      ...defaultFormData.preferences,
      pace: paceValue && validPace.includes(paceValue) ? paceValue : defaultFormData.preferences.pace,
    },
  };
}

// ------------------------------------------------------------------
// Status labels for each generation phase
// ------------------------------------------------------------------
const phaseLabels: Record<string, string> = {
  generating_plan: 'Building your itinerary...',
  generating_stays: 'Finding accommodation...',
  generating_flights: 'Searching flights...',
  generating_activities: 'Curating activity ideas...',
  generating_weather: 'Checking weather forecast...',
  generating_budget: 'Estimating budget...',
  generating_overview: 'Creating overview and destination hero...',
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
      category: item.category || null,
      lat: item.lat ?? null,
      lng: item.lng ?? null,
      locationName: item.locationName || item.location_name || '',
      address: item.address || '',
    })),
  }));
}

function transformFlights(backendFlights: any[], selectedFlightId?: string | null): Flight[] {
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
      isSelected: (f.id || `flight_${idx}`) === selectedFlightId,
    };
  });
}

function transformStays(backendStays: any[], selectedStayId?: string | null): Stay[] {
  return backendStays.map((s: any, idx: number) => {
    const details = s.details || {};
    return {
      id: s.id || `stay_${idx}`,
      name: s.name || 'Unknown',
      type: details.stayType || s.stay_type || 'Hotel',
      neighborhood: s.neighborhood || '',
      lat: s.lat ?? details.lat ?? null,
      lng: s.lng ?? details.lng ?? null,
      mapsUrl: s.mapsUrl || s.maps_url || details.mapsUrl || details.maps_url || '',
      priceRange: details.priceRange || s.price_range || (s.price ? `€${s.price}/night` : ''),
      rating: s.rating ?? s.rating_hint ?? 0,
      reviewCount: 0,
      whyItFits: s.whyItFits || s.why_it_fits || '',
      imageUrl: s.imageUrl || s.image_url || details.imageUrl || details.image_url || '',
      bookingUrl: s.deepLinkUrl || s.deep_link_url || details.bookingSearchUrl || '#',
      amenities: details.amenities || s.amenities || [],
      saved: s.saved || false,
      isSelected: (s.id || `stay_${idx}`) === selectedStayId,
    };
  });
}

function transformActivities(backendActivities: any[]): SuggestedActivity[] {
  return (backendActivities || []).map((a: any, idx: number) => ({
    id: a.id || `act_${idx}`,
    title: a.title || '',
    description: a.description || '',
    category: a.category || 'custom',
    durationMinutes: a.duration_minutes ?? a.durationMinutes ?? null,
    costHint: a.cost_hint || a.costHint || '',
    placeQuery: a.place_query || a.placeQuery || '',
    mapsUrl: a.maps_url || a.mapsUrl || '',
    imageQuery: a.image_query || a.imageQuery || '',
    locationName: a.location_name || a.locationName || '',
    address: a.address || '',
    lat: a.lat ?? null,
    lng: a.lng ?? null,
    status: a.status || 'suggested',
  }));
}

function transformWeather(backendWeather: any[]): WeatherDay[] {
  return (backendWeather || []).map((w: any) => ({
    date: w.date || '',
    highTempC: w.high_temp_c ?? w.highTempC ?? null,
    lowTempC: w.low_temp_c ?? w.lowTempC ?? null,
    condition: w.condition || '',
    icon: w.icon || '',
    humidityPct: w.humidity_pct ?? w.humidityPct ?? null,
  }));
}

function transformBudget(backendBudget: any): BudgetHint | null {
  if (!backendBudget) return null;
  const currency = backendBudget.currency || backendBudget.summary?.currency || 'EUR';
  const entries = (backendBudget.entries || []).map((e: any) => ({
    id: e.id || '',
    category: e.category || 'other',
    amount: Number(e.amount ?? 0),
    currency: e.currency || currency,
    date: e.date || '',
    note: e.note || '',
    createdAt: e.createdAt || e.created_at || '',
    updatedAt: e.updatedAt || e.updated_at || '',
  }));
  const estimated = backendBudget.total_estimated ?? backendBudget.totalEstimated ?? backendBudget.summary?.estimatedTotal ?? null;
  const actual = backendBudget.summary?.actualTotal ?? entries.reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);
  const delta = backendBudget.summary?.delta ?? (estimated != null ? Number(estimated) - Number(actual) : null);
  return {
    currency,
    totalEstimated: estimated,
    categories: (backendBudget.categories || []).map((c: any) => ({
      category: c.category || 'other',
      estimatedAmount: c.estimated_amount ?? c.estimatedAmount ?? null,
      note: c.note || '',
    })),
    entries,
    summary: {
      estimatedTotal: estimated,
      actualTotal: Number(actual || 0),
      delta: delta == null ? null : Number(delta),
      currency,
    },
  };
}

function transformOverview(backendOverview: any): OverviewData | null {
  if (!backendOverview) return null;
  return {
    summary: backendOverview.summary || '',
    destinationImagePrompt: backendOverview.destination_image_prompt || backendOverview.destinationImagePrompt || '',
    destinationImageUrl: backendOverview.destination_image_url || backendOverview.destinationImageUrl || '',
    notesSeed: backendOverview.notes_seed || backendOverview.notesSeed || [],
    notes: backendOverview.notes || '',
  };
}

function mapBackendTripToTrip(t: any): Trip {
  const aiGenerated = t.constraints?.aiGenerated || {};
  const mergedBudget = aiGenerated.budget || aiGenerated.budgetEntries
    ? {
        ...(aiGenerated.budget || {}),
        entries: aiGenerated.budgetEntries || [],
      }
    : null;

  return {
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
    flights: transformFlights(t.flights || [], t.selectedFlightId),
    stays: transformStays(t.stays || [], t.selectedStayId),
    plan: transformDays(t.days || []),
    activities: transformActivities(aiGenerated.activities || []),
    weather: transformWeather(aiGenerated.weather || []),
    budget: transformBudget(mergedBudget),
    overview: transformOverview(aiGenerated.overview),
    selectedFlightId: t.selectedFlightId || null,
    selectedStayId: t.selectedStayId || null,
    savedItems: [],
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    status: t.status,
  };
}

// ------------------------------------------------------------------
// Store
// ------------------------------------------------------------------

export const useTripStore = create<TripState>((set, get) => ({
  formData: initialFormData(),

  updateFormData: (partial) =>
    set((s) => ({ formData: { ...s.formData, ...partial } })),

  resetForm: () => set({ formData: initialFormData() }),

  clearRememberedDefaults: () => {
    clearFormMemory();
    set((s) => ({
      formData: {
        ...s.formData,
        origin: defaultFormData.origin,
        budget: defaultFormData.budget,
        preferences: {
          ...s.formData.preferences,
          pace: defaultFormData.preferences.pace,
        },
      },
    }));
  },

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
      saveFormMemory(formData);
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
        activities: [],
        weather: [],
        budget: null,
        overview: null,
        selectedFlightId: null,
        selectedStayId: null,
        savedItems: [],
        createdAt: result.trip.createdAt || new Date().toISOString(),
        updatedAt: result.trip.updatedAt || new Date().toISOString(),
        status: 'generating',
      };
      set({ currentTrip: trip, focusFlightId: null, focusStayId: null });

      // Open SSE stream (fire-and-forget – updates arrive asynchronously)
      const eventSource = await tripAPI.streamGeneration(tripId);

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
            updates.stays = transformStays(sectionData, s.currentTrip.selectedStayId);
          } else if (section === 'flights') {
            updates.flights = transformFlights(sectionData, s.currentTrip.selectedFlightId);
          } else if (section === 'activities') {
            updates.activities = transformActivities(sectionData);
          } else if (section === 'weather') {
            updates.weather = transformWeather(sectionData);
          } else if (section === 'budget') {
            updates.budget = transformBudget(sectionData);
          } else if (section === 'overview') {
            updates.overview = transformOverview(sectionData);
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
            currentTrip: s.currentTrip
              ? { ...s.currentTrip, status: data?.partial ? 'ready' : 'error' }
              : null,
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
          currentTrip: s.currentTrip
            ? {
                ...s.currentTrip,
                status:
                  s.currentTrip.plan.length > 0 &&
                  s.currentTrip.flights.length > 0 &&
                  s.currentTrip.stays.length > 0
                    ? 'ready'
                    : 'error',
              }
            : null,
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
      const trip = mapBackendTripToTrip(result.trip);
      set({ currentTrip: trip, focusFlightId: null, focusStayId: null });
    } catch (err) {
      console.error('Failed to load trip:', err);
    }
  },

  activeTab: 'overview',
  setActiveTab: (tab) => set({ activeTab: tab }),
  selectedDay: null,
  setSelectedDay: (day) => set({ selectedDay: day }),
  focusFlightId: null,
  setFocusFlightId: (flightId) => set({ focusFlightId: flightId }),
  focusStayId: null,
  setFocusStayId: (stayId) => set({ focusStayId: stayId }),

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

  selectPrimaryFlight: async (flightId) => {
    const { currentTrip, loadTrip } = get();
    if (!currentTrip) return;
    await tripAPI.selectPrimaryFlight(currentTrip.id, flightId);
    await loadTrip(currentTrip.id);
  },

  selectPrimaryStay: async (stayId) => {
    const { currentTrip, loadTrip } = get();
    if (!currentTrip) return;
    await tripAPI.selectPrimaryStay(currentTrip.id, stayId);
    await loadTrip(currentTrip.id);
  },

  addSuggestedActivityToDay: async (activityId, dayNumber) => {
    const { currentTrip, loadTrip } = get();
    if (!currentTrip) return;
    const result = await tripAPI.addActivityToDay(currentTrip.id, activityId, dayNumber);
    if (result?.success && result?.trip) {
      const mapped = mapBackendTripToTrip(result.trip);
      set({ currentTrip: mapped });
      return;
    }
    await loadTrip(currentTrip.id);
  },

  generateMoreActivities: async (category) => {
    const { currentTrip, loadTrip } = get();
    if (!currentTrip) return;
    await tripAPI.generateMoreActivities(currentTrip.id, category);
    await loadTrip(currentTrip.id);
  },

  updateSuggestedActivityStatus: async (activityId, status) => {
    const { currentTrip, loadTrip } = get();
    if (!currentTrip) return;
    await tripAPI.updateActivityStatus(currentTrip.id, activityId, status);
    await loadTrip(currentTrip.id);
  },

  returnPlanItemToBucket: async (itemId) => {
    const { currentTrip, loadTrip } = get();
    if (!currentTrip) return;
    await tripAPI.returnPlanItemToBucket(currentTrip.id, itemId);
    await loadTrip(currentTrip.id);
  },

  autofillDay: async (dayNumber, limit = 3) => {
    const { currentTrip, loadTrip } = get();
    if (!currentTrip) return;
    await tripAPI.autofillDay(currentTrip.id, dayNumber, limit);
    await loadTrip(currentTrip.id);
  },

  refreshWeather: async () => {
    const { currentTrip, loadTrip } = get();
    if (!currentTrip) return;
    await tripAPI.refreshWeather(currentTrip.id);
    await loadTrip(currentTrip.id);
  },

  saveTripNotes: async (notes) => {
    const { currentTrip, loadTrip } = get();
    if (!currentTrip) return;
    await tripAPI.updateNotes(currentTrip.id, notes);
    await loadTrip(currentTrip.id);
  },

  saveOverviewImage: async (imageUrl) => {
    const { currentTrip, loadTrip } = get();
    if (!currentTrip) return;
    await tripAPI.updateOverviewImage(currentTrip.id, imageUrl);
    await loadTrip(currentTrip.id);
  },

  addBudgetEntry: async (payload) => {
    const { currentTrip, loadTrip } = get();
    if (!currentTrip) return;
    await tripAPI.addBudgetEntry(currentTrip.id, payload);
    await loadTrip(currentTrip.id);
  },

  updateBudgetEntry: async (entryId, payload) => {
    const { currentTrip, loadTrip } = get();
    if (!currentTrip) return;
    await tripAPI.updateBudgetEntry(currentTrip.id, entryId, payload);
    await loadTrip(currentTrip.id);
  },

  deleteBudgetEntry: async (entryId) => {
    const { currentTrip, loadTrip } = get();
    if (!currentTrip) return;
    await tripAPI.deleteBudgetEntry(currentTrip.id, entryId);
    await loadTrip(currentTrip.id);
  },

  updatedSections: {},
  markSectionUpdated: (section) =>
    set((s) => ({
      updatedSections: { ...s.updatedSections, [section]: Date.now() },
    })),

  // -----------------------------------------------------------------
  // Apply section data from a chat edit response
  // -----------------------------------------------------------------
  applySectionData: (section: string, data: unknown) => {
    set((s) => {
      if (!s.currentTrip) return {};
      const updates: Partial<Trip> = {};
      const listData = Array.isArray(data) ? data : [];

      if (section === 'plan') {
        updates.plan = transformDays(listData);
      } else if (section === 'stays') {
        updates.stays = transformStays(listData, s.currentTrip.selectedStayId);
      } else if (section === 'flights') {
        updates.flights = transformFlights(listData, s.currentTrip.selectedFlightId);
      } else if (section === 'activities') {
        updates.activities = transformActivities(listData);
      } else if (section === 'weather') {
        updates.weather = transformWeather(listData);
      } else if (section === 'budget') {
        updates.budget = transformBudget(data);
      } else if (section === 'overview') {
        updates.overview = transformOverview(data);
      }

      return {
        currentTrip: { ...s.currentTrip, ...updates },
        updatedSections: { ...s.updatedSections, [section]: Date.now() },
      };
    });
  },
}));
