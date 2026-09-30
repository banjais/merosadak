const roadSurfaceLabels: Record<string, string> = {
  asphalt_excellent: 'Asphalt surface',
  blacktopped_fair: 'Blacktopped',
  gravel: 'Gravel',
  under_construction: 'Under construction',
  offroad_mud: 'Off-road / mud',
};

export function getRoadSurfaceLabel(surface: string): string {
  return roadSurfaceLabels[surface] || surface.replaceAll('_', ' ');
}

export const ROAD_SURFACE_CONDITION_NOTE =
  'Surface type is mapped data; it does not indicate current pavement condition.';
