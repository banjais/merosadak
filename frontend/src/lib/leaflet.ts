// Shared Leaflet instance - prevents multiple Leaflet copies causing TDZ errors
import * as L from 'leaflet';

// Add markercluster support
import 'leaflet.markercluster';

export { L };
export default L;
