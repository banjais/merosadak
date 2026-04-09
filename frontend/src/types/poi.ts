// src/types/poi.ts
// Comprehensive POI types with 20+ categories

export type POICategory = 
  | 'fuel'
  | 'food'
  | 'cafe'
  | 'lodging'
  | 'medical'
  | 'shopping'
  | 'culture'
  | 'adventure'
  | 'tourist'
  | 'nature'
  | 'banking'
  | 'emergency'
  | 'transport'
  | 'education'
  | 'fitness'
  | 'personal'
  | 'entertainment'
  | 'pet'
  | 'family'
  | 'accessible'
  | 'atm'
  | 'parking'
  | 'restroom'
  | 'wifi';

export interface POICategoryInfo {
  id: POICategory;
  name: string;
  icon: string;
  color: string;
  subcategories: string[];
  ageRelevance: {
    youth: number;
    professional: number;
    family: number;
    senior: number;
  };
  description: string;
}

export const POI_CATEGORIES: POICategoryInfo[] = [
  {
    id: 'fuel',
    name: 'Fuel',
    icon: '⛽',
    color: 'green',
    subcategories: ['petrol', 'diesel', 'ev_charging', 'cng'],
    ageRelevance: { youth: 0.7, professional: 0.9, family: 0.9, senior: 0.8 },
    description: 'Petrol pumps, EV charging stations'
  },
  {
    id: 'food',
    name: 'Food',
    icon: '🍽️',
    color: 'orange',
    subcategories: ['restaurant', 'local_cuisine', 'fast_food', 'street_food', 'vegetarian', 'non_veg'],
    ageRelevance: { youth: 0.9, professional: 0.8, family: 1.0, senior: 0.9 },
    description: 'Restaurants, local cuisine, street food'
  },
  {
    id: 'cafe',
    name: 'Cafes',
    icon: '☕',
    color: 'amber',
    subcategories: ['coffee', 'tea', 'bakery', 'dessert'],
    ageRelevance: { youth: 1.0, professional: 0.8, family: 0.6, senior: 0.7 },
    description: 'Coffee shops, tea houses, bakeries'
  },
  {
    id: 'lodging',
    name: 'Hotels',
    icon: '🏨',
    color: 'purple',
    subcategories: ['budget_hotel', 'luxury_resort', 'homestay', 'camping', 'guest_house'],
    ageRelevance: { youth: 0.7, professional: 0.8, family: 1.0, senior: 0.9 },
    description: 'Hotels, homestays, resorts'
  },
  {
    id: 'medical',
    name: 'Medical',
    icon: '🏥',
    color: 'red',
    subcategories: ['hospital', 'clinic', 'pharmacy', 'dental', 'eye_care', 'veterinary'],
    ageRelevance: { youth: 0.6, professional: 0.7, family: 0.9, senior: 1.0 },
    description: 'Hospitals, clinics, pharmacies'
  },
  {
    id: 'shopping',
    name: 'Shopping',
    icon: '🛒',
    color: 'pink',
    subcategories: ['mall', 'local_market', 'souvenir', 'electronics', 'clothing', 'grocery'],
    ageRelevance: { youth: 0.9, professional: 0.7, family: 0.8, senior: 0.5 },
    description: 'Malls, markets, souvenirs'
  },
  {
    id: 'culture',
    name: 'Culture',
    icon: '🏛️',
    color: 'indigo',
    subcategories: ['temple', 'church', 'mosque', 'monastery', 'museum', 'heritage_site'],
    ageRelevance: { youth: 0.6, professional: 0.7, family: 0.8, senior: 1.0 },
    description: 'Temples, museums, heritage sites'
  },
  {
    id: 'adventure',
    name: 'Adventure',
    icon: '🎯',
    color: 'cyan',
    subcategories: ['trekking', 'paragliding', 'rafting', 'bungee', 'zip_line', 'mountain_biking'],
    ageRelevance: { youth: 1.0, professional: 0.7, family: 0.5, senior: 0.2 },
    description: 'Trekking, paragliding, rafting'
  },
  {
    id: 'tourist',
    name: 'Tourist',
    icon: '📸',
    color: 'teal',
    subcategories: ['viewpoint', 'photo_spot', 'landmark', 'scenic_area'],
    ageRelevance: { youth: 0.9, professional: 0.7, family: 0.8, senior: 0.7 },
    description: 'Viewpoints, photo spots, landmarks'
  },
  {
    id: 'nature',
    name: 'Nature',
    icon: '🏞️',
    color: 'emerald',
    subcategories: ['park', 'garden', 'waterfall', 'lake', 'wildlife', 'forest'],
    ageRelevance: { youth: 0.7, professional: 0.6, family: 0.9, senior: 0.8 },
    description: 'Parks, waterfalls, lakes, wildlife'
  },
  {
    id: 'banking',
    name: 'Banking',
    icon: '💰',
    color: 'yellow',
    subcategories: ['atm', 'bank', 'money_exchange', 'insurance'],
    ageRelevance: { youth: 0.5, professional: 0.8, family: 0.8, senior: 1.0 },
    description: 'ATMs, banks, money exchange'
  },
  {
    id: 'emergency',
    name: 'Emergency',
    icon: '🚔',
    color: 'red',
    subcategories: ['police', 'fire_station', 'rescue', 'embassy', 'emergency_contact'],
    ageRelevance: { youth: 0.5, professional: 0.7, family: 0.9, senior: 1.0 },
    description: 'Police, fire, rescue services'
  },
  {
    id: 'transport',
    name: 'Transport',
    icon: '🚌',
    color: 'blue',
    subcategories: ['bus_park', 'taxi_stand', 'bike_rental', 'airport', 'train_station'],
    ageRelevance: { youth: 0.7, professional: 0.8, family: 0.8, senior: 0.7 },
    description: 'Bus parks, taxi stands, airports'
  },
  {
    id: 'education',
    name: 'Education',
    icon: '🎓',
    color: 'violet',
    subcategories: ['school', 'college', 'library', 'training_center'],
    ageRelevance: { youth: 0.7, professional: 0.5, family: 0.9, senior: 0.4 },
    description: 'Schools, colleges, libraries'
  },
  {
    id: 'fitness',
    name: 'Fitness',
    icon: '🏋️',
    color: 'lime',
    subcategories: ['gym', 'yoga', 'sports_complex', 'swimming'],
    ageRelevance: { youth: 0.9, professional: 0.7, family: 0.6, senior: 0.6 },
    description: 'Gyms, yoga studios, sports'
  },
  {
    id: 'personal',
    name: 'Personal',
    icon: '💇',
    color: 'fuchsia',
    subcategories: ['salon', 'spa', 'massage', 'laundry', 'dry_cleaning'],
    ageRelevance: { youth: 0.6, professional: 0.7, family: 0.5, senior: 0.6 },
    description: 'Salons, spas, laundry'
  },
  {
    id: 'entertainment',
    name: 'Entertainment',
    icon: '🎭',
    color: 'rose',
    subcategories: ['cinema', 'theater', 'nightlife', 'gaming', 'bowling'],
    ageRelevance: { youth: 1.0, professional: 0.6, family: 0.7, senior: 0.3 },
    description: 'Cinemas, theaters, nightlife'
  },
  {
    id: 'pet',
    name: 'Pet',
    icon: '🐕',
    color: 'brown',
    subcategories: ['vet_clinic', 'pet_shop', 'pet_park'],
    ageRelevance: { youth: 0.5, professional: 0.6, family: 0.7, senior: 0.6 },
    description: 'Vet clinics, pet shops'
  },
  {
    id: 'family',
    name: 'Family',
    icon: '👶',
    color: 'sky',
    subcategories: ['playground', 'daycare', 'baby_care', 'family_restroom'],
    ageRelevance: { youth: 0.3, professional: 0.6, family: 1.0, senior: 0.5 },
    description: 'Playgrounds, daycare, baby care'
  },
  {
    id: 'accessible',
    name: 'Accessible',
    icon: '♿',
    color: 'slate',
    subcategories: ['wheelchair_access', 'elevator', 'accessible_parking', 'accessible_restroom'],
    ageRelevance: { youth: 0.3, professional: 0.4, family: 0.6, senior: 1.0 },
    description: 'Wheelchair access, elevators'
  },
  {
    id: 'atm',
    name: 'ATM',
    icon: '🏧',
    color: 'amber',
    subcategories: ['atm', 'cash_point'],
    ageRelevance: { youth: 0.6, professional: 0.9, family: 0.8, senior: 0.9 },
    description: 'ATMs, cash points'
  },
  {
    id: 'parking',
    name: 'Parking',
    icon: '🅿️',
    color: 'gray',
    subcategories: ['parking_lot', 'street_parking', 'covered_parking'],
    ageRelevance: { youth: 0.7, professional: 0.9, family: 0.8, senior: 0.8 },
    description: 'Parking lots, street parking'
  },
  {
    id: 'restroom',
    name: 'Restroom',
    icon: '🚻',
    color: 'zinc',
    subcategories: ['public_restroom', 'accessible_restroom'],
    ageRelevance: { youth: 0.6, professional: 0.7, family: 0.9, senior: 1.0 },
    description: 'Public restrooms'
  },
  {
    id: 'wifi',
    name: 'WiFi',
    icon: '📶',
    color: 'cyan',
    subcategories: ['free_wifi', 'cafe_wifi', 'hotel_wifi'],
    ageRelevance: { youth: 1.0, professional: 0.9, family: 0.6, senior: 0.5 },
    description: 'Free WiFi spots'
  }
];

export interface EnhancedPOI {
  id: string;
  name: string;
  category: POICategory;
  subcategory?: string;
  lat: number;
  lng: number;
  distance?: number; // km from user
  rating?: number; // 1-5
  isOpen?: boolean;
  isAccessible?: boolean;
  score: number; // Personalization score
  icon: string;
  address?: string;
  phone?: string;
  website?: string;
  description?: string;
}

export interface GroupedPOIs {
  [category: string]: EnhancedPOI[];
}

export interface UserPOIPreferences {
  ageGroup: 'youth' | 'professional' | 'family' | 'senior';
  travelStyle: 'budget' | 'comfort' | 'luxury' | 'adventure';
  interests: POICategory[];
  accessibility: boolean;
  travelingWith: 'solo' | 'couple' | 'family' | 'friends' | 'elderly';
  dietaryRestrictions?: string[];
  favoriteCategories?: POICategory[];
}

export interface TripContext {
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  weather: 'clear' | 'rainy' | 'cold' | 'hot' | 'snowy';
  tripDuration: number; // hours
  distanceTraveled: number; // km
  isHighway: boolean;
  hasChildren: boolean;
  hasElderly: boolean;
}
