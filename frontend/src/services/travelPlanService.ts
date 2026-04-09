// src/services/travelPlanService.ts
// Manages travel plans storage and retrieval

import { TravelPlan, TravelPlanChecklist, ChecklistItem, TripBriefing } from '../types/travelPlan';

const PLANS_KEY = 'merosadak_travel_plans';
const CHECKLISTS_KEY = 'merosadak_checklists';
const ACTIVE_PLAN_KEY = 'merosadak_active_plan';

// Save travel plan
export function saveTravelPlan(plan: TravelPlan): void {
  try {
    const plans = getTravelPlans();
    // Check if plan with same destination exists, update it
    const existingIndex = plans.findIndex(p => 
      p.destination.name === plan.destination.name && p.status === 'planned'
    );

    if (existingIndex >= 0) {
      plans[existingIndex] = { ...plans[existingIndex], ...plan };
    } else {
      plans.unshift(plan); // Add to front
    }

    // Limit to 20 plans
    const trimmed = plans.slice(0, 20);
    localStorage.setItem(PLANS_KEY, JSON.stringify(trimmed));
  } catch (err) {
    console.error('[TravelPlanService] Failed to save plan:', err);
  }
}

// Get all travel plans
export function getTravelPlans(): TravelPlan[] {
  try {
    const stored = localStorage.getItem(PLANS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

// Get single plan by ID
export function getTravelPlan(id: string): TravelPlan | null {
  try {
    const plans = getTravelPlans();
    return plans.find(p => p.id === id) || null;
  } catch {
    return null;
  }
}

// Delete travel plan
export function deleteTravelPlan(id: string): void {
  try {
    const plans = getTravelPlans();
    const filtered = plans.filter(p => p.id !== id);
    localStorage.setItem(PLANS_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.error('[TravelPlanService] Failed to delete plan:', err);
  }
}

// Update plan status
export function updatePlanStatus(id: string, status: TravelPlan['status']): void {
  try {
    const plans = getTravelPlans();
    const plan = plans.find(p => p.id === id);
    if (plan) {
      plan.status = status;
      localStorage.setItem(PLANS_KEY, JSON.stringify(plans));
    }
  } catch (err) {
    console.error('[TravelPlanService] Failed to update status:', err);
  }
}

// Get active plan
export function getActivePlan(): TravelPlan | null {
  try {
    const stored = localStorage.getItem(ACTIVE_PLAN_KEY);
    if (!stored) return null;
    
    const activePlan = JSON.parse(stored);
    // Verify it still exists in plans
    const plans = getTravelPlans();
    return plans.find(p => p.id === activePlan.id) || null;
  } catch {
    return null;
  }
}

// Set active plan
export function setActivePlan(plan: TravelPlan | null): void {
  try {
    if (plan) {
      localStorage.setItem(ACTIVE_PLAN_KEY, JSON.stringify(plan));
    } else {
      localStorage.removeItem(ACTIVE_PLAN_KEY);
    }
  } catch (err) {
    console.error('[TravelPlanService] Failed to set active plan:', err);
  }
}

// Get or create checklist for a plan
export function getChecklist(planId: string): TravelPlanChecklist | null {
  try {
    const stored = localStorage.getItem(CHECKLISTS_KEY);
    const checklists: TravelPlanChecklist[] = stored ? JSON.parse(stored) : [];
    return checklists.find(c => c.planId === planId) || null;
  } catch {
    return null;
  }
}

// Save checklist
export function saveChecklist(checklist: TravelPlanChecklist): void {
  try {
    const stored = localStorage.getItem(CHECKLISTS_KEY);
    const checklists: TravelPlanChecklist[] = stored ? JSON.parse(stored) : [];
    
    const existingIndex = checklists.findIndex(c => c.planId === checklist.planId);
    if (existingIndex >= 0) {
      checklists[existingIndex] = checklist;
    } else {
      checklists.unshift(checklist);
    }

    localStorage.setItem(CHECKLISTS_KEY, JSON.stringify(checklists));
  } catch (err) {
    console.error('[TravelPlanService] Failed to save checklist:', err);
  }
}

// Dismiss checklist
export function dismissChecklist(planId: string): void {
  try {
    const stored = localStorage.getItem(CHECKLISTS_KEY);
    const checklists: TravelPlanChecklist[] = stored ? JSON.parse(stored) : [];
    
    const checklist = checklists.find(c => c.planId === planId);
    if (checklist) {
      checklist.dismissed = true;
      checklist.dismissedAt = new Date().toISOString();
      localStorage.setItem(CHECKLISTS_KEY, JSON.stringify(checklists));
    }
  } catch (err) {
    console.error('[TravelPlanService] Failed to dismiss checklist:', err);
  }
}

// Generate context-aware checklist
export function generateChecklist(
  plan: TravelPlan,
  weather?: any,
  monsoonRisk?: string
): ChecklistItem[] {
  const items: ChecklistItem[] = [
    { id: 'phone', text: 'Phone & charger', icon: '📱', checked: false },
    { id: 'wallet', text: 'Wallet & ID', icon: '💳', checked: false },
  ];

  // Weather-based items
  if (weather) {
    if (weather.condition?.toLowerCase().includes('rain') || monsoonRisk === 'HIGH' || monsoonRisk === 'EXTREME') {
      items.push({
        id: 'rain',
        text: 'Rain jacket/umbrella',
        icon: '🌂',
        checked: false,
        context: 'Rain expected on your route'
      });
    }

    if (weather.temp < 15) {
      items.push({
        id: 'warm',
        text: 'Warm clothes & jacket',
        icon: '🧥',
        checked: false,
        context: `Temperature at destination: ${weather.temp}°C`
      });
    }

    if (weather.temp > 30) {
      items.push(
        {
          id: 'water',
          text: 'Water bottle',
          icon: '💧',
          checked: false,
          context: 'Hot weather, stay hydrated'
        },
        {
          id: 'sunscreen',
          text: 'Sunscreen & hat',
          icon: '🧴',
          checked: false,
          context: 'Strong sun expected'
        }
      );
    }
  }

  // Distance-based items
  if (plan.distance > 100) {
    items.push(
      {
        id: 'snacks',
        text: 'Snacks & water',
        icon: '🍫',
        checked: false,
        context: `Long drive (${plan.distance.toFixed(0)} km)`
      },
      {
        id: 'fuel',
        text: 'Fuel up before departure',
        icon: '⛽',
        checked: false,
        context: 'Long distance, fuel stations may be scarce'
      }
    );
  }

  // Remote area warning
  if (plan.destination.name.toLowerCase().includes('mountain') || 
      plan.destination.name.toLowerCase().includes('humla') ||
      plan.destination.name.toLowerCase().includes('dolpa')) {
    items.push({
      id: 'cash',
      text: 'Cash (ATMs scarce)',
      icon: '💵',
      checked: false,
      context: 'Remote destination, limited ATMs'
    });
  }

  // General items
  items.push(
    {
      id: 'firstaid',
      text: 'First aid kit',
      icon: '🏥',
      checked: false
    },
    {
      id: 'documents',
      text: 'Travel documents',
      icon: '📄',
      checked: false
    }
  );

  return items;
}

// Generate AI-style pre-trip briefing (simulated)
export function generateTripBriefing(
  plan: TravelPlan,
  weather?: any,
  incidents?: any[],
  pois?: any[]
): TripBriefing {
  const briefing: TripBriefing = {
    planId: plan.id,
    weather: {
      condition: weather?.condition || 'Unknown',
      temp: weather?.temp || 0,
      alerts: []
    },
    roadStatus: {
      blockedSections: plan.routeStatus?.blockedSections || 0,
      incidents: plan.routeStatus?.incidents || 0,
      changes: []
    },
    recommendations: [],
    reminders: []
  };

  // Weather alerts
  if (weather?.condition?.toLowerCase().includes('rain')) {
    briefing.weather.alerts?.push('Rain expected - drive carefully');
    briefing.recommendations.push('Pack rain gear and waterproof bag');
  }

  if (weather?.temp < 10) {
    briefing.weather.alerts?.push('Cold weather at destination');
    briefing.recommendations.push('Warm clothes recommended');
  }

  // Road status alerts
  if (plan.routeStatus?.blockedSections && plan.routeStatus.blockedSections > 0) {
    briefing.roadStatus.changes?.push(`${plan.routeStatus.blockedSections} blocked section(s) on route`);
    briefing.recommendations.push('Check alternative routes before departure');
  }

  if (plan.routeStatus?.incidents && plan.routeStatus.incidents > 2) {
    briefing.recommendations.push('Multiple incidents on route - allow extra time');
  }

  // Fuel recommendation
  if (plan.distance > 150) {
    briefing.reminders.push('Fuel up at Kurintar - next station 85km away');
  }

  // Time-based recommendations
  const hour = new Date().getHours();
  if (hour >= 18 || hour < 6) {
    briefing.reminders.push('Night travel - use extra caution');
    briefing.recommendations.push('Carry torch and reflective vest');
  }

  // POI recommendations
  if (pois && pois.length > 0) {
    const fuelStations = pois.filter((p: any) => p.type?.toLowerCase().includes('fuel'));
    if (fuelStations.length > 0) {
      briefing.reminders.push(`${fuelStations.length} fuel station(s) near destination`);
    }
  }

  return briefing;
}

// Count active plans (for badge)
export function getActivePlansCount(): number {
  const plans = getTravelPlans();
  return plans.filter(p => p.status === 'planned').length;
}

// Mark AI briefing as shown
export function markBriefingShown(planId: string): void {
  try {
    const plans = getTravelPlans();
    const plan = plans.find(p => p.id === planId);
    if (plan) {
      plan.aiBriefingShown = true;
      localStorage.setItem(PLANS_KEY, JSON.stringify(plans));
    }
  } catch (err) {
    console.error('[TravelPlanService] Failed to mark briefing shown:', err);
  }
}
