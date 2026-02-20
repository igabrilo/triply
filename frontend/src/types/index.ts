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
}

export interface Stay {
  id: string;
  name: string;
  type: string;
  neighborhood: string;
  priceRange: string;
  rating: number;
  reviewCount: number;
  whyItFits: string;
  imageUrl?: string;
  bookingUrl: string;
  amenities: string[];
  saved: boolean;
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
export type TabId = 'plan' | 'flights' | 'stays' | 'map' | 'profile';
