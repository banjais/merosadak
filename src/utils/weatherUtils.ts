import { HighwayWeatherNode, WeatherCondition, RoadGrip } from '../types';

export function getWeatherConditionLabel(condition: WeatherCondition): string {
  const labels: Record<WeatherCondition, string> = {
    sunny: 'Sunny',
    rain_monsoon: 'Rain / Monsoon',
    dense_fog: 'Dense Fog',
    cloudy: 'Cloudy',
    thunderstorm: 'Thunderstorm',
    mountain_shower: 'Mountain Shower',
  };
  return labels[condition] || condition;
}

export function getRoadGripLabel(grip: RoadGrip): string {
  const labels: Record<RoadGrip, string> = {
    dry_excellent: 'Dry / Excellent',
    wet_caution: 'Wet / Caution',
    mud_slippery: 'Mud / Slippery',
    fog_low_visibility: 'Fog / Low Visibility',
  };
  return labels[grip] || grip;
}

export function getLandslideRiskLabel(risk: 'low' | 'moderate' | 'high' | 'severe'): string {
  const labels: Record<string, string> = {
    low: 'Low Risk',
    moderate: 'Moderate Risk',
    high: 'High Risk',
    severe: 'Severe Risk',
  };
  return labels[risk] || risk;
}

export function getWeatherConditionColor(condition: WeatherCondition): string {
  const colors: Record<WeatherCondition, string> = {
    sunny: '#f59e0b',
    rain_monsoon: '#3b82f6',
    dense_fog: '#94a3b8',
    cloudy: '#64748b',
    thunderstorm: '#7c3aed',
    mountain_shower: '#06b6d4',
  };
  return colors[condition] || '#94a3b8';
}

export function getWeatherConditionIcon(condition: WeatherCondition): string {
  const icons: Record<WeatherCondition, string> = {
    sunny: '☀️',
    rain_monsoon: '🌧️',
    dense_fog: '🌫️',
    cloudy: '☁️',
    thunderstorm: '⛈️',
    mountain_shower: '🌦️',
  };
  return icons[condition] || '🌡️';
}

export function formatLastUpdated(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return timestamp;
  }
}

export function isWeatherNodeSevere(node: HighwayWeatherNode): boolean {
  return (
    node.condition === 'thunderstorm' ||
    node.condition === 'rain_monsoon' ||
    node.roadGrip === 'mud_slippery' ||
    node.landslideRisk === 'high' ||
    node.landslideRisk === 'severe' ||
    node.visibilityKm < 5
  );
}

export function getWeatherSeverityScore(node: HighwayWeatherNode): number {
  let score = 0;
  if (node.condition === 'sunny') score += 0;
  else if (node.condition === 'cloudy') score += 1;
  else if (node.condition === 'dense_fog') score += 2;
  else if (node.condition === 'mountain_shower') score += 3;
  else if (node.condition === 'rain_monsoon') score += 4;
  else if (node.condition === 'thunderstorm') score += 5;

  if (node.roadGrip === 'dry_excellent') score += 0;
  else if (node.roadGrip === 'wet_caution') score += 1;
  else if (node.roadGrip === 'fog_low_visibility') score += 2;
  else if (node.roadGrip === 'mud_slippery') score += 3;

  if (node.landslideRisk === 'low') score += 0;
  else if (node.landslideRisk === 'moderate') score += 1;
  else if (node.landslideRisk === 'high') score += 2;
  else if (node.landslideRisk === 'severe') score += 3;

  if (node.visibilityKm < 2) score += 3;
  else if (node.visibilityKm < 5) score += 2;
  else if (node.visibilityKm < 10) score += 1;

  if (node.windSpeedKmh > 60) score += 2;
  else if (node.windSpeedKmh > 40) score += 1;

  return score;
}
