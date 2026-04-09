// src/types/travelPlan.ts
// Types for travel plans and trip management

export interface TravelPlan {
  id: string;
  name: string;
  destination: {
    name: string;
    lat: number;
    lng: number;
  };
  origin?: {
    name: string;
    lat: number;
    lng: number;
  };
  distance: number; // km
  estimatedDuration: number; // hours
  createdAt: string; // ISO timestamp
  departureTime?: string; // ISO timestamp (when user plans to leave)
  status: 'planned' | 'active' | 'completed' | 'cancelled';
  routeStatus?: {
    blockedSections: number;
    incidents: number;
    lastChecked: string;
  };
  notes?: string;
  checklistDismissed?: boolean;
  aiBriefingShown?: boolean;
}

export interface TravelPlanChecklist {
  id: string;
  planId: string;
  items: ChecklistItem[];
  dismissed: boolean;
  dismissedAt?: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  icon: string;
  checked: boolean;
  context?: string; // Why this item is recommended
}

export interface TripBriefing {
  planId: string;
  weather: {
    condition: string;
    temp: number;
    alerts?: string[];
  };
  roadStatus: {
    blockedSections: number;
    incidents: number;
    changes?: string[];
  };
  recommendations: string[];
  reminders: string[];
}

export interface EnRouteAlert {
  id: string;
  type: 'hazard' | 'fuel' | 'food' | 'tourist' | 'hospital';
  title: string;
  description: string;
  distance: number; // km from user
  eta: number; // minutes
  action?: {
    label: string;
    handler: string;
  };
  dismissed: boolean;
}
