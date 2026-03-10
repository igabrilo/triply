/* ─── Trip Form ─── */
export interface TripFormData {
  destinations: string[];
  startDate: string;
  endDate: string;
  travelers: number;
  budget: BudgetLevel;
  origin: string;
  preferences: TripPreferences;
}

export type BudgetLevel = 'budget' | 'mid' | 'premium' | 'luxury';

export interface TripPreferences {
  interests: string[];
  pace: 'relaxed' | 'balanced' | 'packed';
  stayStyle: string[];
  dealBreakers: string[];
  accessibility: string[];
  dietary: string[];
  kidsFriendly: boolean;
}

/* ─── Trip Results ─── */
export interface Trip {
  id: string;
  userId: string;
  formData: TripFormData;
  flights: Flight[];
  stays: Stay[];
  plan: PlanDay[];
  activities: SuggestedActivity[];
  weather: WeatherDay[];
  budget: BudgetHint | null;
  overview: OverviewData | null;
  selectedFlightId?: string | null;
  selectedStayId?: string | null;
  savedItems: SavedItem[];
  createdAt: string;
  updatedAt: string;
  status: 'generating' | 'ready' | 'error';
}

export interface Flight {
  id: string;
  airline: string;
  departure: string;
  arrival: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  stops: number;
  priceRange: string;
  bookingUrl: string;
  saved: boolean;
  isSelected?: boolean;
}

export interface Stay {
  id: string;
  name: string;
  type: string;
  neighborhood: string;
  lat?: number | null;
  lng?: number | null;
  mapsUrl?: string;
  placeId?: string;
  photoReference?: string;
  photoName?: string;
  priceRange: string;
  rating: number;
  reviewCount: number;
  whyItFits: string;
  imageUrl?: string;
  bookingUrl: string;
  amenities: string[];
  saved: boolean;
  isSelected?: boolean;
}

export interface PlanDay {
  day: number;
  title: string;
  activities: Activity[];
}

export interface Activity {
  id: string;
  name: string;
  description: string;
  timeOfDay: string;
  duration: string;
  links: ActivityLink[];
  status: 'planned' | 'saved' | 'must-do' | 'skip';
  tags: string[];
  category?: string;
  lat?: number | null;
  lng?: number | null;
  locationName?: string;
  address?: string;
}

export interface ActivityLink {
  label: string;
  url: string;
  type: 'map' | 'official' | 'tickets' | 'other';
}

export interface SavedItem {
  id: string;
  type: 'flight' | 'stay' | 'activity';
  label: string;
  detail: string;
  referenceId: string;
}

export interface SuggestedActivity {
  id: string;
  title: string;
  description: string;
  category: string;
  durationMinutes: number | null;
  costHint: string;
  placeQuery: string;
  mapsUrl?: string;
  imageQuery?: string;
  locationName?: string;
  address?: string;
  lat?: number | null;
  lng?: number | null;
  status?: 'suggested' | 'saved' | 'dismissed';
}

export interface WeatherDay {
  date: string;
  highTempC: number | null;
  lowTempC: number | null;
  condition: string;
  icon: string;
  humidityPct: number | null;
}

export interface BudgetCategoryHint {
  category: string;
  estimatedAmount: number | null;
  note: string;
}

export interface BudgetHint {
  currency: string;
  totalEstimated: number | null;
  categories: BudgetCategoryHint[];
  entries: BudgetEntry[];
  summary: BudgetSummary;
}

export interface BudgetEntry {
  id: string;
  category: string;
  amount: number;
  currency: string;
  date: string;
  note: string;
  createdAt: string;
  updatedAt?: string;
}

export interface BudgetSummary {
  estimatedTotal: number | null;
  actualTotal: number;
  delta: number | null;
  currency: string;
}

export interface OverviewData {
  summary: string;
  destinationImagePrompt: string;
  destinationImageUrl: string;
  notesSeed: string[];
  notes?: string;
  travelDescription?: string;
}

/* ─── Chat ─── */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  editScope?: EditScope;
}

export interface EditScope {
  section: 'flights' | 'stays' | 'plan';
  dayNumber?: number;
  itemId?: string;
}

/* ─── Auth ─── */
export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  preferences?: TripPreferences;
  createdAt: string;
}

/* ─── UI State ─── */
export type TabId = 'overview' | 'plan' | 'activities' | 'flights' | 'stays' | 'budget' | 'weather' | 'map' | 'profile';
