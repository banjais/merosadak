/**
 * 📊 GOOGLE SHEETS MASTER CONFIGURATION
 * These keys match your sheet column headers exactly.
 */
export const SHEET_HEADERS = {
  SUBMISSION_DATE: "reportDate",
  DIVISION: "div_name",
  ROAD_CODE: "road_refno",          
  ROAD_NAME: "road_name",
  DISTRICT: "dist_name",      // Fixed: was "incidentDistrict"     
  PLACE: "incidentPlace",           
  CHAINAGE: "chainage",
  COORDINATES: "incidentCoordinate", 
  START_DATE: "incidentStarted",
  ESTIMATED_RESTORATION: "estimatedRestoration",
  STATUS: "status",
  RESUMED_DATE: "resumedDate",
  BLOCKED_HOURS: "blockedHours",
  CONTACT: "contactPerson",
  EFFORTS: "restorationEfforts",
  REMARKS: "remarks"
};

export const ROAD_STATUS = {
  BLOCKED: 'Blocked',
  ONE_LANE: 'One-Lane',
  RESUMED: 'Resumed'
};
