import { TravelIncident, IncidentType } from '../types';

export const ROAD_MOCKS: TravelIncident[] = [
  {
    id: 'road-mock-1',
    type: IncidentType.BLOCKAGE,
    title: 'Narayangadh-Mugling Landslide',
    description: 'Highway blocked due to fresh landslide near Jalbire. Clearance expected in 4 hours.',
    lat: 27.755,
    lng: 84.425,
    severity: 'high',
    timestamp: new Date().toISOString()
  },
  {
    id: 'road-mock-2',
    type: IncidentType.ONE_LANE,
    title: 'Prithvi Highway One-Lane',
    description: 'One-way traffic operation near Kurintar due to road maintenance.',
    lat: 27.8174,
    lng: 84.5919,
    severity: 'medium',
    timestamp: new Date().toISOString()
  },
  {
    id: 'road-mock-3',
    type: IncidentType.BLOCKAGE,
    title: 'Siddhartha Highway Closure',
    description: 'Road closed near Tansen due to bridge repair work. Reopening at 6 PM.',
    lat: 27.871,
    lng: 83.551,
    severity: 'high',
    timestamp: new Date().toISOString()
  }
];

export const TRAFFIC_MOCKS: TravelIncident[] = [
  {
    id: 'traffic-1',
    type: IncidentType.TRAFFIC,
    title: 'Koteshwor Jam',
    description: 'Heavy congestion at Koteshwor intersection. Expected delay of 30 minutes.',
    lat: 27.6756,
    lng: 85.3450,
    severity: 'medium',
    timestamp: new Date().toISOString()
  },
  {
    id: 'traffic-2',
    type: IncidentType.TRAFFIC,
    title: 'Kalanki Chok Crowd',
    description: 'Slow moving traffic due to rush hour at Kalanki.',
    lat: 27.6938,
    lng: 85.2817,
    severity: 'low',
    timestamp: new Date().toISOString()
  }
];

export const WEATHER_MOCKS: TravelIncident[] = [
  {
    id: 'weather-mock-1',
    type: IncidentType.WEATHER,
    title: 'Heavy Snowfall - Thorong La',
    description: 'High altitude passes are currently covered in deep snow. Trekking discouraged.',
    lat: 28.794,
    lng: 83.938,
    severity: 'high',
    timestamp: new Date().toISOString()
  },
  {
    id: 'weather-mock-2',
    type: IncidentType.WEATHER,
    title: 'Terai Fog Alert',
    description: 'Dense morning fog reducing visibility to below 50m on the East-West Highway.',
    lat: 27.512,
    lng: 84.345,
    severity: 'medium',
    timestamp: new Date().toISOString()
  }
];

export const MONSOON_MOCKS: TravelIncident[] = [
  {
    id: 'monsoon-mock-1',
    type: IncidentType.MONSOON,
    title: 'Kosi River Alert',
    description: 'Water levels rising above danger mark near Chatara. Avoid riverside roads.',
    lat: 26.821,
    lng: 87.156,
    severity: 'high',
    timestamp: new Date().toISOString()
  },
  {
    id: 'monsoon-mock-2',
    type: IncidentType.MONSOON,
    title: 'Mugling-Kathmandu Risk',
    description: 'High saturation levels in soil. Risk of minor slips near Jogimara.',
    lat: 27.817,
    lng: 84.717,
    severity: 'medium',
    timestamp: new Date().toISOString()
  }
];

export const POI_MOCKS: TravelIncident[] = [
  {
    id: 'poi-mock-1',
    type: IncidentType.POI,
    title: 'Kurintar Fuel Station',
    description: 'Major refueling point and rest area on the Prithvi Highway. Clean restrooms and food available.',
    lat: 27.818,
    lng: 84.590,
    severity: 'success',
    timestamp: new Date().toISOString()
  },
  {
    id: 'poi-mock-2',
    type: IncidentType.POI,
    title: 'Kathmandu Tourist Info',
    description: 'Nepal Tourism Board information center. Open 9 AM - 5 PM.',
    lat: 27.701,
    lng: 85.315,
    severity: 'success',
    timestamp: new Date().toISOString()
  },
  {
    id: 'poi-mock-3',
    type: IncidentType.POI,
    title: 'Dhulikhel View Point',
    description: 'Popular stop for Himalayan mountain views. Parking available.',
    lat: 27.618,
    lng: 85.552,
    severity: 'success',
    timestamp: new Date().toISOString()
  }
];
