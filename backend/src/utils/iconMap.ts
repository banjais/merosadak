/**
 * Maps POI categories to UI-safe emojis.
 */
export function getMarkerIcon(category: string): string {
  const c = category.toLowerCase();
  if (c.includes('hospital') || c.includes('health') || c.includes('medical')) return '🏥';
  if (c.includes('fuel') || c.includes('petrol') || c.includes('gas')) return '⛽';
  if (c.includes('hotel') || c.includes('resort') || c.includes('lodging')) return '🏨';
  if (c.includes('restaurant') || c.includes('food') || c.includes('cafe')) return '🍴';
  if (c.includes('police') || c.includes('station')) return '🚔';
  if (c.includes('bus') || c.includes('transport') || c.includes('park')) return '🚌';
  if (c.includes('airport')) return '✈️';
  if (c.includes('temple') || c.includes('religious')) return '🛕';
  if (c.includes('tourist') || c.includes('heritage')) return '📸';
  if (c.includes('bank') || c.includes('atm')) return '💰';
  return '📍';
}