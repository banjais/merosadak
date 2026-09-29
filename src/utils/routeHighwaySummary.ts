import type { RouteStep } from '../types';
import { NEPAL_HIGHWAYS } from '../data/nepalHighwaysData';

export interface RouteHighwaySummary {
  highwayCode: string;
  highwayName: string;
  roadClass: string;
  surface: string;
  distanceKm: number;
}

export function summarizeRouteHighways(steps: RouteStep[]): RouteHighwaySummary[] {
  return steps.reduce<RouteHighwaySummary[]>((segments, step) => {
    if (step.highwayCode?.toUpperCase() === 'AERIAL' || (!step.highwayCode && !step.highwayName)) return segments;

    const highwayCode = step.highwayCode || 'Code unavailable';
    const highwayName = step.highwayName || NEPAL_HIGHWAYS.find((highway) => highway.code === highwayCode)?.name || 'Unnamed route';
    const roadClass = step.roadClassification?.replaceAll('_', ' ') || 'Road class unavailable';
    const previous = segments[segments.length - 1];

    if (previous && previous.highwayCode === highwayCode && previous.highwayName === highwayName && previous.roadClass === roadClass && previous.surface === step.surface) {
      previous.distanceKm += step.distanceKm;
    } else {
      segments.push({
        highwayCode,
        highwayName,
        roadClass,
        surface: step.surface,
        distanceKm: step.distanceKm,
      });
    }
    return segments;
  }, []);
}
