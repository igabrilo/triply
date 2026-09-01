import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Globe, TrendingUp, CornerDownLeft } from 'lucide-react';

/* ─── Data types ────────────────────────────────────────────────────────── */

type EntryType = 'city' | 'country';

interface Entry {
  name: string;
  subtitle: string; // country for cities, region for countries
  flag: string;
  type: EntryType;
  region: string;
  /** Whether to show in popular picks (shown when input is empty) */
  popular?: boolean;
}

/* ─── Destination data ──────────────────────────────────────────────────── */

const ENTRIES: Entry[] = [
  /* ── Countries ─────────────────────────────────────────────────────── */
  { name: 'France', subtitle: 'Europe', flag: '🇫🇷', type: 'country', region: 'Europe' },
  { name: 'Italy', subtitle: 'Europe', flag: '🇮🇹', type: 'country', region: 'Europe', popular: true },
  { name: 'Spain', subtitle: 'Europe', flag: '🇪🇸', type: 'country', region: 'Europe', popular: true },
  { name: 'Greece', subtitle: 'Europe', flag: '🇬🇷', type: 'country', region: 'Europe', popular: true },
  { name: 'Portugal', subtitle: 'Europe', flag: '🇵🇹', type: 'country', region: 'Europe' },
  { name: 'Netherlands', subtitle: 'Europe', flag: '🇳🇱', type: 'country', region: 'Europe' },
  { name: 'Czech Republic', subtitle: 'Europe', flag: '🇨🇿', type: 'country', region: 'Europe' },
  { name: 'Austria', subtitle: 'Europe', flag: '🇦🇹', type: 'country', region: 'Europe' },
  { name: 'Croatia', subtitle: 'Europe', flag: '🇭🇷', type: 'country', region: 'Europe' },
  { name: 'Denmark', subtitle: 'Europe', flag: '🇩🇰', type: 'country', region: 'Europe' },
  { name: 'Sweden', subtitle: 'Europe', flag: '🇸🇪', type: 'country', region: 'Europe' },
  { name: 'Norway', subtitle: 'Europe', flag: '🇳🇴', type: 'country', region: 'Europe' },
  { name: 'Iceland', subtitle: 'Europe', flag: '🇮🇸', type: 'country', region: 'Europe' },
  { name: 'United Kingdom', subtitle: 'Europe', flag: '🇬🇧', type: 'country', region: 'Europe' },
  { name: 'Ireland', subtitle: 'Europe', flag: '🇮🇪', type: 'country', region: 'Europe' },
  { name: 'Germany', subtitle: 'Europe', flag: '🇩🇪', type: 'country', region: 'Europe' },
  { name: 'Switzerland', subtitle: 'Europe', flag: '🇨🇭', type: 'country', region: 'Europe' },
  { name: 'Hungary', subtitle: 'Europe', flag: '🇭🇺', type: 'country', region: 'Europe' },
  { name: 'Poland', subtitle: 'Europe', flag: '🇵🇱', type: 'country', region: 'Europe' },
  { name: 'Belgium', subtitle: 'Europe', flag: '🇧🇪', type: 'country', region: 'Europe' },
  { name: 'Malta', subtitle: 'Europe', flag: '🇲🇹', type: 'country', region: 'Europe' },
  { name: 'Slovenia', subtitle: 'Europe', flag: '🇸🇮', type: 'country', region: 'Europe' },
  { name: 'Montenegro', subtitle: 'Europe', flag: '🇲🇪', type: 'country', region: 'Europe' },
  { name: 'Estonia', subtitle: 'Europe', flag: '🇪🇪', type: 'country', region: 'Europe' },
  { name: 'Japan', subtitle: 'Asia', flag: '🇯🇵', type: 'country', region: 'Asia', popular: true },
  { name: 'Thailand', subtitle: 'Asia', flag: '🇹🇭', type: 'country', region: 'Asia', popular: true },
  { name: 'Indonesia', subtitle: 'Asia', flag: '🇮🇩', type: 'country', region: 'Asia' },
  { name: 'Vietnam', subtitle: 'Asia', flag: '🇻🇳', type: 'country', region: 'Asia' },
  { name: 'South Korea', subtitle: 'Asia', flag: '🇰🇷', type: 'country', region: 'Asia' },
  { name: 'Singapore', subtitle: 'Asia', flag: '🇸🇬', type: 'country', region: 'Asia' },
  { name: 'Malaysia', subtitle: 'Asia', flag: '🇲🇾', type: 'country', region: 'Asia' },
  { name: 'Cambodia', subtitle: 'Asia', flag: '🇰🇭', type: 'country', region: 'Asia' },
  { name: 'Nepal', subtitle: 'Asia', flag: '🇳🇵', type: 'country', region: 'Asia' },
  { name: 'India', subtitle: 'Asia', flag: '🇮🇳', type: 'country', region: 'Asia' },
  { name: 'Sri Lanka', subtitle: 'Asia', flag: '🇱🇰', type: 'country', region: 'Asia' },
  { name: 'Taiwan', subtitle: 'Asia', flag: '🇹🇼', type: 'country', region: 'Asia' },
  { name: 'China', subtitle: 'Asia', flag: '🇨🇳', type: 'country', region: 'Asia' },
  { name: 'Maldives', subtitle: 'Asia', flag: '🇲🇻', type: 'country', region: 'Asia' },
  { name: 'Georgia', subtitle: 'Asia', flag: '🇬🇪', type: 'country', region: 'Asia' },
  { name: 'UAE', subtitle: 'Middle East', flag: '🇦🇪', type: 'country', region: 'Middle East', popular: true },
  { name: 'Turkey', subtitle: 'Middle East', flag: '🇹🇷', type: 'country', region: 'Middle East' },
  { name: 'Morocco', subtitle: 'Africa', flag: '🇲🇦', type: 'country', region: 'Africa' },
  { name: 'Egypt', subtitle: 'Africa', flag: '🇪🇬', type: 'country', region: 'Africa' },
  { name: 'Jordan', subtitle: 'Middle East', flag: '🇯🇴', type: 'country', region: 'Middle East' },
  { name: 'Oman', subtitle: 'Middle East', flag: '🇴🇲', type: 'country', region: 'Middle East' },
  { name: 'Qatar', subtitle: 'Middle East', flag: '🇶🇦', type: 'country', region: 'Middle East' },
  { name: 'USA', subtitle: 'Americas', flag: '🇺🇸', type: 'country', region: 'Americas' },
  { name: 'Mexico', subtitle: 'Americas', flag: '🇲🇽', type: 'country', region: 'Americas' },
  { name: 'Canada', subtitle: 'Americas', flag: '🇨🇦', type: 'country', region: 'Americas' },
  { name: 'Argentina', subtitle: 'Americas', flag: '🇦🇷', type: 'country', region: 'Americas' },
  { name: 'Brazil', subtitle: 'Americas', flag: '🇧🇷', type: 'country', region: 'Americas' },
  { name: 'Peru', subtitle: 'Americas', flag: '🇵🇪', type: 'country', region: 'Americas' },
  { name: 'Colombia', subtitle: 'Americas', flag: '🇨🇴', type: 'country', region: 'Americas' },
  { name: 'Chile', subtitle: 'Americas', flag: '🇨🇱', type: 'country', region: 'Americas' },
  { name: 'Costa Rica', subtitle: 'Americas', flag: '🇨🇷', type: 'country', region: 'Americas' },
  { name: 'Cuba', subtitle: 'Americas', flag: '🇨🇺', type: 'country', region: 'Americas' },
  { name: 'South Africa', subtitle: 'Africa', flag: '🇿🇦', type: 'country', region: 'Africa' },
  { name: 'Kenya', subtitle: 'Africa', flag: '🇰🇪', type: 'country', region: 'Africa' },
  { name: 'Tanzania', subtitle: 'Africa', flag: '🇹🇿', type: 'country', region: 'Africa' },
  { name: 'Australia', subtitle: 'Oceania', flag: '🇦🇺', type: 'country', region: 'Oceania', popular: true },
  { name: 'New Zealand', subtitle: 'Oceania', flag: '🇳🇿', type: 'country', region: 'Oceania' },
  { name: 'Fiji', subtitle: 'Oceania', flag: '🇫🇯', type: 'country', region: 'Oceania' },

  /* ── Cities ─────────────────────────────────────────────────────────── */
  { name: 'Paris', subtitle: 'France', flag: '🇫🇷', type: 'city', region: 'Europe', popular: true },
  { name: 'Rome', subtitle: 'Italy', flag: '🇮🇹', type: 'city', region: 'Europe', popular: true },
  { name: 'Barcelona', subtitle: 'Spain', flag: '🇪🇸', type: 'city', region: 'Europe', popular: true },
  { name: 'Amsterdam', subtitle: 'Netherlands', flag: '🇳🇱', type: 'city', region: 'Europe' },
  { name: 'Prague', subtitle: 'Czech Republic', flag: '🇨🇿', type: 'city', region: 'Europe' },
  { name: 'Vienna', subtitle: 'Austria', flag: '🇦🇹', type: 'city', region: 'Europe' },
  { name: 'Lisbon', subtitle: 'Portugal', flag: '🇵🇹', type: 'city', region: 'Europe' },
  { name: 'Athens', subtitle: 'Greece', flag: '🇬🇷', type: 'city', region: 'Europe' },
  { name: 'Santorini', subtitle: 'Greece', flag: '🇬🇷', type: 'city', region: 'Europe' },
  { name: 'Mykonos', subtitle: 'Greece', flag: '🇬🇷', type: 'city', region: 'Europe' },
  { name: 'Dubrovnik', subtitle: 'Croatia', flag: '🇭🇷', type: 'city', region: 'Europe' },
  { name: 'Split', subtitle: 'Croatia', flag: '🇭🇷', type: 'city', region: 'Europe' },
  { name: 'Copenhagen', subtitle: 'Denmark', flag: '🇩🇰', type: 'city', region: 'Europe' },
  { name: 'Stockholm', subtitle: 'Sweden', flag: '🇸🇪', type: 'city', region: 'Europe' },
  { name: 'Oslo', subtitle: 'Norway', flag: '🇳🇴', type: 'city', region: 'Europe' },
  { name: 'Reykjavik', subtitle: 'Iceland', flag: '🇮🇸', type: 'city', region: 'Europe' },
  { name: 'London', subtitle: 'United Kingdom', flag: '🇬🇧', type: 'city', region: 'Europe' },
  { name: 'Edinburgh', subtitle: 'United Kingdom', flag: '🇬🇧', type: 'city', region: 'Europe' },
  { name: 'Dublin', subtitle: 'Ireland', flag: '🇮🇪', type: 'city', region: 'Europe' },
  { name: 'Berlin', subtitle: 'Germany', flag: '🇩🇪', type: 'city', region: 'Europe' },
  { name: 'Munich', subtitle: 'Germany', flag: '🇩🇪', type: 'city', region: 'Europe' },
  { name: 'Zurich', subtitle: 'Switzerland', flag: '🇨🇭', type: 'city', region: 'Europe' },
  { name: 'Budapest', subtitle: 'Hungary', flag: '🇭🇺', type: 'city', region: 'Europe' },
  { name: 'Warsaw', subtitle: 'Poland', flag: '🇵🇱', type: 'city', region: 'Europe' },
  { name: 'Krakow', subtitle: 'Poland', flag: '🇵🇱', type: 'city', region: 'Europe' },
  { name: 'Brussels', subtitle: 'Belgium', flag: '🇧🇪', type: 'city', region: 'Europe' },
  { name: 'Bruges', subtitle: 'Belgium', flag: '🇧🇪', type: 'city', region: 'Europe' },
  { name: 'Florence', subtitle: 'Italy', flag: '🇮🇹', type: 'city', region: 'Europe' },
  { name: 'Venice', subtitle: 'Italy', flag: '🇮🇹', type: 'city', region: 'Europe' },
  { name: 'Milan', subtitle: 'Italy', flag: '🇮🇹', type: 'city', region: 'Europe' },
  { name: 'Amalfi Coast', subtitle: 'Italy', flag: '🇮🇹', type: 'city', region: 'Europe' },
  { name: 'Sicily', subtitle: 'Italy', flag: '🇮🇹', type: 'city', region: 'Europe' },
  { name: 'Madrid', subtitle: 'Spain', flag: '🇪🇸', type: 'city', region: 'Europe' },
  { name: 'Seville', subtitle: 'Spain', flag: '🇪🇸', type: 'city', region: 'Europe' },
  { name: 'Granada', subtitle: 'Spain', flag: '🇪🇸', type: 'city', region: 'Europe' },
  { name: 'Ibiza', subtitle: 'Spain', flag: '🇪🇸', type: 'city', region: 'Europe' },
  { name: 'Mallorca', subtitle: 'Spain', flag: '🇪🇸', type: 'city', region: 'Europe' },
  { name: 'Porto', subtitle: 'Portugal', flag: '🇵🇹', type: 'city', region: 'Europe' },
  { name: 'Algarve', subtitle: 'Portugal', flag: '🇵🇹', type: 'city', region: 'Europe' },
  { name: 'Nice', subtitle: 'France', flag: '🇫🇷', type: 'city', region: 'Europe' },
  { name: 'Lyon', subtitle: 'France', flag: '🇫🇷', type: 'city', region: 'Europe' },
  { name: 'Tallinn', subtitle: 'Estonia', flag: '🇪🇪', type: 'city', region: 'Europe' },
  { name: 'Riga', subtitle: 'Latvia', flag: '🇱🇻', type: 'city', region: 'Europe' },
  { name: 'Valletta', subtitle: 'Malta', flag: '🇲🇹', type: 'city', region: 'Europe' },
  { name: 'Sarajevo', subtitle: 'Bosnia', flag: '🇧🇦', type: 'city', region: 'Europe' },
  { name: 'Ljubljana', subtitle: 'Slovenia', flag: '🇸🇮', type: 'city', region: 'Europe' },
  { name: 'Kotor', subtitle: 'Montenegro', flag: '🇲🇪', type: 'city', region: 'Europe' },
  { name: 'Tokyo', subtitle: 'Japan', flag: '🇯🇵', type: 'city', region: 'Asia', popular: true },
  { name: 'Osaka', subtitle: 'Japan', flag: '🇯🇵', type: 'city', region: 'Asia' },
  { name: 'Kyoto', subtitle: 'Japan', flag: '🇯🇵', type: 'city', region: 'Asia' },
  { name: 'Seoul', subtitle: 'South Korea', flag: '🇰🇷', type: 'city', region: 'Asia' },
  { name: 'Bangkok', subtitle: 'Thailand', flag: '🇹🇭', type: 'city', region: 'Asia' },
  { name: 'Chiang Mai', subtitle: 'Thailand', flag: '🇹🇭', type: 'city', region: 'Asia' },
  { name: 'Phuket', subtitle: 'Thailand', flag: '🇹🇭', type: 'city', region: 'Asia' },
  { name: 'Singapore', subtitle: 'Singapore', flag: '🇸🇬', type: 'city', region: 'Asia' },
  { name: 'Bali', subtitle: 'Indonesia', flag: '🇮🇩', type: 'city', region: 'Asia', popular: true },
  { name: 'Kuala Lumpur', subtitle: 'Malaysia', flag: '🇲🇾', type: 'city', region: 'Asia' },
  { name: 'Hanoi', subtitle: 'Vietnam', flag: '🇻🇳', type: 'city', region: 'Asia' },
  { name: 'Ho Chi Minh City', subtitle: 'Vietnam', flag: '🇻🇳', type: 'city', region: 'Asia' },
  { name: 'Hoi An', subtitle: 'Vietnam', flag: '🇻🇳', type: 'city', region: 'Asia' },
  { name: 'Siem Reap', subtitle: 'Cambodia', flag: '🇰🇭', type: 'city', region: 'Asia' },
  { name: 'Kathmandu', subtitle: 'Nepal', flag: '🇳🇵', type: 'city', region: 'Asia' },
  { name: 'Mumbai', subtitle: 'India', flag: '🇮🇳', type: 'city', region: 'Asia' },
  { name: 'Delhi', subtitle: 'India', flag: '🇮🇳', type: 'city', region: 'Asia' },
  { name: 'Goa', subtitle: 'India', flag: '🇮🇳', type: 'city', region: 'Asia' },
  { name: 'Jaipur', subtitle: 'India', flag: '🇮🇳', type: 'city', region: 'Asia' },
  { name: 'Hong Kong', subtitle: 'China', flag: '🇭🇰', type: 'city', region: 'Asia' },
  { name: 'Shanghai', subtitle: 'China', flag: '🇨🇳', type: 'city', region: 'Asia' },
  { name: 'Beijing', subtitle: 'China', flag: '🇨🇳', type: 'city', region: 'Asia' },
  { name: 'Taipei', subtitle: 'Taiwan', flag: '🇹🇼', type: 'city', region: 'Asia' },
  { name: 'Tbilisi', subtitle: 'Georgia', flag: '🇬🇪', type: 'city', region: 'Asia' },
  { name: 'Dubai', subtitle: 'UAE', flag: '🇦🇪', type: 'city', region: 'Middle East', popular: true },
  { name: 'Abu Dhabi', subtitle: 'UAE', flag: '🇦🇪', type: 'city', region: 'Middle East' },
  { name: 'Istanbul', subtitle: 'Turkey', flag: '🇹🇷', type: 'city', region: 'Middle East' },
  { name: 'Cappadocia', subtitle: 'Turkey', flag: '🇹🇷', type: 'city', region: 'Middle East' },
  { name: 'Antalya', subtitle: 'Turkey', flag: '🇹🇷', type: 'city', region: 'Middle East' },
  { name: 'Marrakech', subtitle: 'Morocco', flag: '🇲🇦', type: 'city', region: 'Middle East' },
  { name: 'Cairo', subtitle: 'Egypt', flag: '🇪🇬', type: 'city', region: 'Middle East' },
  { name: 'Hurghada', subtitle: 'Egypt', flag: '🇪🇬', type: 'city', region: 'Middle East' },
  { name: 'Amman', subtitle: 'Jordan', flag: '🇯🇴', type: 'city', region: 'Middle East' },
  { name: 'Petra', subtitle: 'Jordan', flag: '🇯🇴', type: 'city', region: 'Middle East' },
  { name: 'New York', subtitle: 'USA', flag: '🇺🇸', type: 'city', region: 'Americas' },
  { name: 'Los Angeles', subtitle: 'USA', flag: '🇺🇸', type: 'city', region: 'Americas' },
  { name: 'Miami', subtitle: 'USA', flag: '🇺🇸', type: 'city', region: 'Americas' },
  { name: 'San Francisco', subtitle: 'USA', flag: '🇺🇸', type: 'city', region: 'Americas' },
  { name: 'Las Vegas', subtitle: 'USA', flag: '🇺🇸', type: 'city', region: 'Americas' },
  { name: 'Chicago', subtitle: 'USA', flag: '🇺🇸', type: 'city', region: 'Americas' },
  { name: 'New Orleans', subtitle: 'USA', flag: '🇺🇸', type: 'city', region: 'Americas' },
  { name: 'Hawaii', subtitle: 'USA', flag: '🇺🇸', type: 'city', region: 'Americas' },
  { name: 'Cancún', subtitle: 'Mexico', flag: '🇲🇽', type: 'city', region: 'Americas' },
  { name: 'Mexico City', subtitle: 'Mexico', flag: '🇲🇽', type: 'city', region: 'Americas' },
  { name: 'Tulum', subtitle: 'Mexico', flag: '🇲🇽', type: 'city', region: 'Americas' },
  { name: 'Toronto', subtitle: 'Canada', flag: '🇨🇦', type: 'city', region: 'Americas' },
  { name: 'Vancouver', subtitle: 'Canada', flag: '🇨🇦', type: 'city', region: 'Americas' },
  { name: 'Buenos Aires', subtitle: 'Argentina', flag: '🇦🇷', type: 'city', region: 'Americas' },
  { name: 'Rio de Janeiro', subtitle: 'Brazil', flag: '🇧🇷', type: 'city', region: 'Americas' },
  { name: 'Lima', subtitle: 'Peru', flag: '🇵🇪', type: 'city', region: 'Americas' },
  { name: 'Cusco', subtitle: 'Peru', flag: '🇵🇪', type: 'city', region: 'Americas' },
  { name: 'Machu Picchu', subtitle: 'Peru', flag: '🇵🇪', type: 'city', region: 'Americas' },
  { name: 'Cartagena', subtitle: 'Colombia', flag: '🇨🇴', type: 'city', region: 'Americas' },
  { name: 'Havana', subtitle: 'Cuba', flag: '🇨🇺', type: 'city', region: 'Americas' },
  { name: 'Punta Cana', subtitle: 'Dominican Republic', flag: '🇩🇴', type: 'city', region: 'Americas' },
  { name: 'Cape Town', subtitle: 'South Africa', flag: '🇿🇦', type: 'city', region: 'Africa' },
  { name: 'Nairobi', subtitle: 'Kenya', flag: '🇰🇪', type: 'city', region: 'Africa' },
  { name: 'Zanzibar', subtitle: 'Tanzania', flag: '🇹🇿', type: 'city', region: 'Africa' },
  { name: 'Sydney', subtitle: 'Australia', flag: '🇦🇺', type: 'city', region: 'Oceania' },
  { name: 'Melbourne', subtitle: 'Australia', flag: '🇦🇺', type: 'city', region: 'Oceania' },
  { name: 'Auckland', subtitle: 'New Zealand', flag: '🇳🇿', type: 'city', region: 'Oceania' },
  { name: 'Queenstown', subtitle: 'New Zealand', flag: '🇳🇿', type: 'city', region: 'Oceania' },
  { name: 'Bora Bora', subtitle: 'French Polynesia', flag: '🇵🇫', type: 'city', region: 'Oceania' },
];

const POPULAR = ENTRIES.filter(e => e.popular).slice(0, 8);

/* ─── Scoring ───────────────────────────────────────────────────────────── */

function scoreMatch(entry: Entry, query: string): number {
  const q = query.toLowerCase();
  const name = entry.name.toLowerCase();
  const sub = entry.subtitle.toLowerCase();

  if (name === q) return 110;
  if (name.startsWith(q)) return entry.type === 'country' ? 105 : 95;
  if (sub === q) return 85;
  if (name.includes(q)) return entry.type === 'country' ? 80 : 70;
  if (sub.startsWith(q)) return 60;
  if (sub.includes(q)) return 50;
  return 0;
}

/* ─── Highlight helper ──────────────────────────────────────────────────── */

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <span style={{ color: 'var(--primary-600)', fontWeight: 700 }}>
        {text.slice(idx, idx + query.length)}
      </span>
      {text.slice(idx + query.length)}
    </>
  );
}

/* ─── Component ─────────────────────────────────────────────────────────── */

interface DestinationAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (value: string) => void;
  onEnter: () => void;
  error?: string;
  placeholder?: string;
}

export default function DestinationAutocomplete({
  value, onChange, onSelect, onEnter, error, placeholder = 'City or country…',
}: DestinationAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const trimmed = value.trim();
  const isQuerying = trimmed.length > 0;

  const matches: Entry[] = isQuerying
    ? ENTRIES
        .map(e => ({ ...e, score: scoreMatch(e, trimmed) }))
        .filter(e => e.score > 0)
        .sort((a, b) => (b as any).score - (a as any).score)
        .slice(0, 7)
    : [];

  const listItems: Entry[] = isQuerying ? matches : POPULAR;
  const showDropdown = open && listItems.length > 0;

  const handleSelect = useCallback((entry: Entry) => {
    onSelect(entry.name);
    setOpen(false);
    setActiveIndex(-1);
  }, [onSelect]);

  useEffect(() => { setActiveIndex(-1); }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, listItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && listItems[activeIndex]) {
        e.preventDefault();
        handleSelect(listItems[activeIndex]);
      } else {
        e.preventDefault();
        onEnter();
        setOpen(false);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
    }
  };

  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      (listRef.current.children[activeIndex] as HTMLElement)?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <span className="form-icon"><MapPin size={16} /></span>
        <input
          ref={inputRef}
          className={`form-input form-input-with-icon${error ? ' form-input-error' : ''}`}
          placeholder={placeholder}
          value={value}
          autoComplete="off"
          onChange={e => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
        />
      </div>

      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 2, scale: 0.97 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: 0, right: 0,
              zIndex: 500,
              background: 'var(--surface)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-xl)',
              border: '1px solid var(--navy-100)',
              overflow: 'hidden',
            }}
          >
            {/* Section header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px 6px',
              borderBottom: '1px solid var(--navy-50)',
            }}>
              {isQuerying
                ? <><MapPin size={11} style={{ color: 'var(--navy-400)' }} /><span style={{ fontSize: 11, fontWeight: 600, color: 'var(--navy-400)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Results</span></>
                : <><TrendingUp size={11} style={{ color: 'var(--navy-400)' }} /><span style={{ fontSize: 11, fontWeight: 600, color: 'var(--navy-400)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Popular destinations</span></>
              }
            </div>

            <ul
              ref={listRef}
              role="listbox"
              style={{ listStyle: 'none', margin: 0, padding: '4px 0', maxHeight: 280, overflowY: 'auto' }}
            >
              {listItems.map((entry, i) => {
                const isActive = i === activeIndex;
                return (
                  <li
                    key={`${entry.name}-${entry.type}`}
                    role="option"
                    aria-selected={isActive}
                    onMouseDown={e => { e.preventDefault(); handleSelect(entry); }}
                    onMouseEnter={() => setActiveIndex(i)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 14px',
                      cursor: 'pointer',
                      background: isActive ? 'var(--primary-50)' : 'transparent',
                      transition: 'background 0.1s ease',
                    }}
                  >
                    {/* Flag */}
                    <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0, width: 28, textAlign: 'center' }}>
                      {entry.flag}
                    </span>

                    {/* Name + subtitle */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy-900)' }}>
                        <Highlight text={entry.name} query={isQuerying ? trimmed : ''} />
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--navy-400)', marginTop: 1 }}>
                        {entry.type === 'country'
                          ? `${entry.subtitle} · Entire country`
                          : <Highlight text={entry.subtitle} query={isQuerying ? trimmed : ''} />}
                      </div>
                    </div>

                    {/* Type badge */}
                    <span style={{
                      display: 'flex', alignItems: 'center', gap: 3,
                      fontSize: 11, fontWeight: 600, flexShrink: 0,
                      padding: '2px 8px', borderRadius: 'var(--radius-full)',
                      background: entry.type === 'country' ? 'var(--primary-50)' : 'var(--navy-50)',
                      color: entry.type === 'country' ? 'var(--primary-600)' : 'var(--navy-500)',
                    }}>
                      {entry.type === 'country'
                        ? <><Globe size={10} /> Country</>
                        : <><MapPin size={10} /> City</>}
                    </span>
                  </li>
                );
              })}
            </ul>

            {/* "Add as typed" footer — only shown while querying */}
            {isQuerying && (
              <div
                onMouseDown={e => { e.preventDefault(); onEnter(); setOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 14px',
                  borderTop: '1px solid var(--navy-100)',
                  cursor: 'pointer',
                  fontSize: 13, color: 'var(--navy-500)',
                  transition: 'background 0.1s ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--navy-50)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <CornerDownLeft size={13} style={{ color: 'var(--navy-400)' }} />
                <span>Add <strong style={{ color: 'var(--navy-800)' }}>{value}</strong> as destination</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
