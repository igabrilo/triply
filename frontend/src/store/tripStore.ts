import { create } from 'zustand';
import type { TripFormData, Trip, TabId, BudgetLevel, Flight, Stay, PlanDay } from '@/types';

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

  /* ─── Dashboard ─── */
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  selectedDay: number | null;
  setSelectedDay: (day: number | null) => void;

  /* ─── Actions ─── */
  toggleFlightSaved: (flightId: string) => void;
  toggleStaySaved: (stayId: string) => void;
  updateActivityStatus: (activityId: string, status: 'planned' | 'saved' | 'must-do' | 'skip') => void;

  /* ─── Section update indicator ─── */
  updatedSections: Record<string, number>;
  markSectionUpdated: (section: string) => void;
}

const defaultFormData: TripFormData = {
  destinations: [],
  startDate: '',
  endDate: '',
  travelers: 2,
  budget: 'mid' as BudgetLevel,
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

/* ─── Mock Data ─── */
const mockFlights: Flight[] = [
  {
    id: 'f1',
    airline: 'Air France',
    departure: 'ZAG',
    arrival: 'CDG',
    departureTime: '08:30',
    arrivalTime: '10:45',
    duration: '2h 15m',
    stops: 0,
    priceRange: '\u20AC120\u2013\u20AC180',
    bookingUrl: 'https://www.airfrance.com',
    saved: false,
  },
  {
    id: 'f2',
    airline: 'Lufthansa',
    departure: 'ZAG',
    arrival: 'CDG',
    departureTime: '14:10',
    arrivalTime: '17:30',
    duration: '3h 20m',
    stops: 1,
    priceRange: '\u20AC95\u2013\u20AC140',
    bookingUrl: 'https://www.lufthansa.com',
    saved: false,
  },
  {
    id: 'f3',
    airline: 'Croatia Airlines',
    departure: 'ZAG',
    arrival: 'CDG',
    departureTime: '06:15',
    arrivalTime: '08:25',
    duration: '2h 10m',
    stops: 0,
    priceRange: '\u20AC140\u2013\u20AC200',
    bookingUrl: 'https://www.croatiaairlines.com',
    saved: false,
  },
];

const mockStays: Stay[] = [
  {
    id: 's1',
    name: 'H\u00F4tel du Petit Moulin',
    type: 'Boutique Hotel',
    neighborhood: 'Le Marais',
    priceRange: '\u20AC150\u2013\u20AC200/night',
    rating: 4.6,
    reviewCount: 824,
    whyItFits: 'Central location in Le Marais, walkable to major attractions. Great for couples.',
    bookingUrl: 'https://www.booking.com',
    amenities: ['Wi-Fi', 'Breakfast', 'Air Conditioning'],
    saved: false,
  },
  {
    id: 's2',
    name: 'Citadines Montmartre',
    type: 'Apart-Hotel',
    neighborhood: 'Montmartre',
    priceRange: '\u20AC120\u2013\u20AC170/night',
    rating: 4.3,
    reviewCount: 1205,
    whyItFits: 'Self-catering option with kitchen. Perfect if you want a local feel near Sacr\u00E9-C\u0153ur.',
    bookingUrl: 'https://www.booking.com',
    amenities: ['Kitchen', 'Wi-Fi', 'Laundry'],
    saved: false,
  },
  {
    id: 's3',
    name: 'Generator Paris',
    type: 'Hostel',
    neighborhood: 'Canal Saint-Martin',
    priceRange: '\u20AC40\u2013\u20AC80/night',
    rating: 4.1,
    reviewCount: 3420,
    whyItFits: 'Budget-friendly with a social vibe. Near trendy caf\u00E9s and the canal.',
    bookingUrl: 'https://www.booking.com',
    amenities: ['Wi-Fi', 'Bar', 'Lounge'],
    saved: false,
  },
];

const mockPlan: PlanDay[] = [
  {
    day: 1,
    title: 'Arrival + Montmartre',
    activities: [
      {
        id: 'a1',
        name: 'Sacr\u00E9-C\u0153ur Basilica',
        description: 'Start with panoramic views and a calm walk around the hill.',
        timeOfDay: 'Morning',
        duration: '60\u201390 min',
        links: [
          { label: 'Map', url: 'https://maps.google.com/?q=Sacre+Coeur+Paris', type: 'map' },
          { label: 'Official', url: 'https://www.sacre-coeur-montmartre.com', type: 'official' },
        ],
        status: 'planned',
        tags: ['landmark', 'views'],
      },
      {
        id: 'a2',
        name: 'Caf\u00E9 stop in Montmartre',
        description: 'Pick a quiet caf\u00E9 street and settle in for a slow start.',
        timeOfDay: 'Late morning',
        duration: '45\u201360 min',
        links: [
          { label: 'Map', url: 'https://maps.google.com/?q=Montmartre+cafes+Paris', type: 'map' },
        ],
        status: 'planned',
        tags: ['food', 'relax'],
      },
    ],
  },
  {
    day: 2,
    title: 'Louvre + Seine',
    activities: [
      {
        id: 'a3',
        name: 'Louvre Museum',
        description: 'Go early and focus on 3\u20134 highlights to avoid fatigue.',
        timeOfDay: 'Morning',
        duration: '2\u20133 hours',
        links: [
          { label: 'Map', url: 'https://maps.google.com/?q=Louvre+Museum+Paris', type: 'map' },
          { label: 'Tickets', url: 'https://www.louvre.fr/en/visit', type: 'tickets' },
        ],
        status: 'planned',
        tags: ['museum', 'culture'],
      },
      {
        id: 'a4',
        name: 'Seine River Walk',
        description: 'Stroll along the Left Bank, browse the bookstalls, and enjoy the views.',
        timeOfDay: 'Afternoon',
        duration: '1\u20132 hours',
        links: [
          { label: 'Map', url: 'https://maps.google.com/?q=Seine+River+Walk+Paris', type: 'map' },
        ],
        status: 'planned',
        tags: ['walk', 'scenic'],
      },
    ],
  },
  {
    day: 3,
    title: 'Eiffel Tower + Latin Quarter',
    activities: [
      {
        id: 'a5',
        name: 'Eiffel Tower',
        description: 'Book tickets in advance. Go for sunset views if possible.',
        timeOfDay: 'Late afternoon',
        duration: '2\u20133 hours',
        links: [
          { label: 'Map', url: 'https://maps.google.com/?q=Eiffel+Tower+Paris', type: 'map' },
          { label: 'Tickets', url: 'https://www.toureiffel.paris/en', type: 'tickets' },
        ],
        status: 'planned',
        tags: ['landmark', 'iconic'],
      },
      {
        id: 'a6',
        name: 'Dinner in the Latin Quarter',
        description: 'Explore Rue Mouffetard for authentic French bistros.',
        timeOfDay: 'Evening',
        duration: '1.5\u20132 hours',
        links: [
          { label: 'Map', url: 'https://maps.google.com/?q=Rue+Mouffetard+Paris', type: 'map' },
        ],
        status: 'planned',
        tags: ['food', 'nightlife'],
      },
    ],
  },
  {
    day: 4,
    title: 'Versailles Day Trip',
    activities: [
      {
        id: 'a7',
        name: 'Palace of Versailles',
        description: 'Take the RER C early. Explore the palace, gardens, and Trianon.',
        timeOfDay: 'Full day',
        duration: '5\u20136 hours',
        links: [
          { label: 'Map', url: 'https://maps.google.com/?q=Palace+of+Versailles', type: 'map' },
          { label: 'Tickets', url: 'https://en.chateauversailles.fr', type: 'tickets' },
        ],
        status: 'planned',
        tags: ['day-trip', 'palace', 'gardens'],
      },
    ],
  },
  {
    day: 5,
    title: 'Le Marais + Departure',
    activities: [
      {
        id: 'a8',
        name: 'Morning in Le Marais',
        description: 'Browse vintage shops, galleries, and grab falafel on Rue des Rosiers.',
        timeOfDay: 'Morning',
        duration: '2\u20133 hours',
        links: [
          { label: 'Map', url: 'https://maps.google.com/?q=Le+Marais+Paris', type: 'map' },
        ],
        status: 'planned',
        tags: ['shopping', 'food', 'culture'],
      },
      {
        id: 'a9',
        name: 'Transfer to Airport',
        description: 'Head to CDG via RER B or book a taxi. Allow 2\u20133 hours.',
        timeOfDay: 'Afternoon',
        duration: '2\u20133 hours',
        links: [
          { label: 'Map', url: 'https://maps.google.com/?q=CDG+Airport+Paris', type: 'map' },
        ],
        status: 'planned',
        tags: ['logistics'],
      },
    ],
  },
];

/* ─── Initial Mock Trip for Preview ─── */
const initialMockTrip: Trip = {
  id: 'trip_mock_preview',
  userId: '1',
  formData: {
    ...defaultFormData,
    destinations: ['Paris'],
    startDate: '2026-03-15',
    endDate: '2026-03-20',
    travelers: 2,
    budget: 'mid' as BudgetLevel,
  },
  flights: mockFlights,
  stays: mockStays,
  plan: mockPlan,
  savedItems: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  status: 'ready',
};

export const useTripStore = create<TripState>((set, get) => ({
  formData: { ...defaultFormData },

  updateFormData: (partial) =>
    set((s) => ({ formData: { ...s.formData, ...partial } })),

  resetForm: () => set({ formData: { ...defaultFormData } }),

  isGenerating: false,
  generationStatus: '',
  currentTrip: initialMockTrip, // Set initial mock trip for preview

  generateTrip: async () => {
    set({ isGenerating: true, generationStatus: 'Analyzing your preferences...' });
    await new Promise((r) => setTimeout(r, 1200));
    set({ generationStatus: 'Finding best flights...' });
    await new Promise((r) => setTimeout(r, 1000));
    set({ generationStatus: 'Matching accommodation...' });
    await new Promise((r) => setTimeout(r, 1000));
    set({ generationStatus: 'Building your itinerary...' });
    await new Promise((r) => setTimeout(r, 1200));

    const { formData } = get();
    const days = formData.startDate && formData.endDate
      ? Math.max(1, Math.ceil((new Date(formData.endDate).getTime() - new Date(formData.startDate).getTime()) / 86400000))
      : 5;

    const trip: Trip = {
      id: 'trip_' + Date.now(),
      userId: '1',
      formData,
      flights: mockFlights,
      stays: mockStays,
      plan: mockPlan.slice(0, days),
      savedItems: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'ready',
    };

    set({
      currentTrip: trip,
      isGenerating: false,
      generationStatus: '',
      activeTab: 'plan',
      selectedDay: null,
    });

    return;
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
}));
