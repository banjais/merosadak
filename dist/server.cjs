var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");
var import_genai = require("@google/genai");
var import_dotenv = __toESM(require("dotenv"), 1);

// src/data/travelTimeTrendsData.ts
function generate24HourProfile(freeFlowMinutes, distanceKm, peakHourRanges, nightDiscount = 0.95) {
  const hours = [];
  for (let h = 0; h < 24; h++) {
    let factor = 1;
    let level = "smooth";
    let note = "Free-flowing traffic with minimal slowdowns.";
    if (h >= 23 || h <= 4) {
      factor = nightDiscount;
      level = "smooth";
      note = "Late night / early morning low-traffic window. Watch for heavy freight trucks.";
    }
    for (const range of peakHourRanges) {
      if (h >= range.start && h <= range.end) {
        factor = range.multiplier;
        level = range.level;
        note = range.note;
        break;
      }
    }
    const travelTimeMinutes = Math.round(freeFlowMinutes * factor);
    const delayMinutes = Math.max(0, travelTimeMinutes - freeFlowMinutes);
    const avgSpeedKmh = Math.max(8, Math.round(distanceKm / (travelTimeMinutes / 60)));
    const congestionIndex = Math.min(100, Math.round((travelTimeMinutes - freeFlowMinutes) / freeFlowMinutes * 100 * 1.6));
    const ampm = h === 0 ? "12 AM" : h === 12 ? "12 PM" : h > 12 ? `${h - 12} PM` : `${h} AM`;
    hours.push({
      hour: h,
      label: ampm,
      travelTimeMinutes,
      freeFlowMinutes,
      delayMinutes,
      avgSpeedKmh,
      congestionIndex: Math.max(5, congestionIndex),
      level,
      advisoryNote: note
    });
  }
  return hours;
}
var HISTORICAL_CORRIDOR_TRENDS = {
  "tr-daunne": {
    corridorId: "tr-daunne",
    corridorName: "Daunne Hill Chokepoint (H01)",
    highwayCode: "H01",
    section: "Daunne East (Bardaghat) to Dumkibas (14 km)",
    distanceKm: 14,
    freeFlowTimeMinutes: 20,
    peakTimeMinutes: 75,
    bestDepartureWindow: "05:00 AM \u2013 07:30 AM",
    worstDepartureWindow: "03:30 PM \u2013 07:30 PM",
    primaryBottlenecks: [
      "Single-lane alternating stop-and-go at Asian Development Bank road widening cuts",
      "Heavy 10-wheeler Indian transit clunkers crawling uphill at 5-10 km/h",
      "Monsoon slippery mud puddles and axle breakdowns near Daunne Temple summit"
    ],
    historicalTips: [
      "Early morning crossing before 7:30 AM typically saves 45 to 60 minutes of delay.",
      "During evening bus departure surges (4 PM - 7 PM), expect alternating traffic queues extending up to 3 km.",
      "Heavy 4WD or high-clearance vehicles handle muddy switchback shoulders significantly better."
    ],
    hourlyProfiles: {
      weekday: generate24HourProfile(20, 14, [
        { start: 8, end: 11, multiplier: 2.1, level: "heavy", note: "Morning intercity microbus & freight rush." },
        { start: 12, end: 14, multiplier: 1.6, level: "moderate", note: "Mid-day construction machinery movement." },
        { start: 15, end: 19, multiplier: 3.2, level: "standstill", note: "Peak long-haul cargo convoys and alternating 1-way stoppages." },
        { start: 20, end: 22, multiplier: 2.4, level: "heavy", note: "Night tourist & deluxe express bus convoy." }
      ]),
      friday: generate24HourProfile(20, 14, [
        { start: 8, end: 11, multiplier: 2.3, level: "heavy", note: "Pre-weekend cargo dispatches." },
        { start: 13, end: 15, multiplier: 2.2, level: "heavy", note: "Early weekend departure traffic building up." },
        { start: 16, end: 21, multiplier: 3.8, level: "standstill", note: "Severe weekend exodus choke; queues over 4 km." },
        { start: 22, end: 23, multiplier: 2.7, level: "heavy", note: "Overnight long-route sleeper buses." }
      ]),
      saturday: generate24HourProfile(20, 14, [
        { start: 9, end: 12, multiplier: 1.8, level: "moderate", note: "Holiday personal car & motorbike traffic." },
        { start: 14, end: 18, multiplier: 2.5, level: "heavy", note: "Afternoon return flows and local goods carriers." }
      ]),
      festival: generate24HourProfile(20, 14, [
        { start: 6, end: 22, multiplier: 3.9, level: "standstill", note: "Dashain / Tihar peak holiday migration; severe bottlenecks throughout the day." }
      ])
    }
  },
  "tr-mugling-abukhaireni": {
    corridorId: "tr-mugling-abukhaireni",
    corridorName: "Mugling \u2013 Abukhaireni Widening (H04)",
    highwayCode: "H04",
    section: "Marshyangdi Bridge to Abukhaireni Bazar (12 km)",
    distanceKm: 12,
    freeFlowTimeMinutes: 15,
    peakTimeMinutes: 48,
    bestDepartureWindow: "06:00 AM \u2013 08:30 AM",
    worstDepartureWindow: "11:30 AM \u2013 03:30 PM & 08:00 PM \u2013 10:30 PM",
    primaryBottlenecks: [
      "Scheduled 20-minute traffic halts for rock blasting and hillside slope stabilization",
      "Narrow Marshyangdi river bridge bottleneck at Mugling junction",
      "Heavy dumper trucks hauling quarry aggregate for highway widening"
    ],
    historicalTips: [
      "Check daily DOR blasting schedules (usually 11:00 AM \u2013 1:00 PM and 3:00 PM \u2013 4:00 PM).",
      "Night departure (8 PM - 11 PM) sees high volumes of Pokhara-bound overnight VIP deluxe buses.",
      "Maintain extra distance near Marshyangdi gorge due to falling loose gravel."
    ],
    hourlyProfiles: {
      weekday: generate24HourProfile(15, 12, [
        { start: 9, end: 11, multiplier: 1.9, level: "moderate", note: "Morning intercity passenger transit stream." },
        { start: 11, end: 14, multiplier: 2.8, level: "heavy", note: "Hill blasting & heavy equipment excavator operations." },
        { start: 16, end: 19, multiplier: 2.2, level: "heavy", note: "Kathmandu-Pokhara tourist & freight convergence." },
        { start: 20, end: 23, multiplier: 2.6, level: "heavy", note: "Night sleeper buses and intercity container trucks." }
      ]),
      friday: generate24HourProfile(15, 12, [
        { start: 11, end: 15, multiplier: 2.6, level: "heavy", note: "Blasting operations and outbound tourist vehicles." },
        { start: 16, end: 22, multiplier: 3.2, level: "standstill", note: "Friday night Pokhara weekend getaway rush." }
      ]),
      saturday: generate24HourProfile(15, 12, [
        { start: 8, end: 11, multiplier: 1.8, level: "moderate", note: "Weekend excursion & family road trips." },
        { start: 16, end: 20, multiplier: 2.5, level: "heavy", note: "Saturday return traffic toward capital/plains." }
      ]),
      festival: generate24HourProfile(15, 12, [
        { start: 6, end: 23, multiplier: 3.5, level: "standstill", note: "Continuous peak movement across Prithvi corridor." }
      ])
    }
  },
  "tr-nagdhunga": {
    corridorId: "tr-nagdhunga",
    corridorName: "Nagdhunga Inbound/Outbound Valley Pass (H02 / H04)",
    highwayCode: "H02 / H04",
    section: "Khanikhola / Naubise to Nagdhunga Tunnel Portal (8 km)",
    distanceKm: 8,
    freeFlowTimeMinutes: 12,
    peakTimeMinutes: 52,
    bestDepartureWindow: "04:30 AM \u2013 06:30 AM & 01:00 PM \u2013 03:00 PM",
    worstDepartureWindow: "06:30 PM \u2013 11:30 PM (Inbound Trucks) & 07:00 AM \u2013 10:30 AM (Outbound Buses)",
    primaryBottlenecks: [
      "Heavy freight trucks restricted from entering Kathmandu valley during daytime queueing up at Naubise until 7 PM",
      "Overloaded tipper and fuel tanker hill climbing on steep 12% Nagdhunga slopes",
      "Security and customs checkpost documentation check at valley checkpoint"
    ],
    historicalTips: [
      "Avoid 7 PM to 10 PM on the uphill climb: hundreds of queued freight trucks enter the valley at once.",
      "Utilize the newly opened Nagdhunga tunnel bypass route whenever operational to bypass 30+ minutes of hairpin crawling.",
      "Check engine coolant levels before tackling the sustained Khanikhola to Nagdhunga steep climb."
    ],
    hourlyProfiles: {
      weekday: generate24HourProfile(12, 8, [
        { start: 7, end: 10, multiplier: 2.3, level: "heavy", note: "Morning outbound long-route bus departure surge." },
        { start: 18, end: 23, multiplier: 3.8, level: "standstill", note: "Cargo truck daytime ban lifted; mass truck uphill crawl into valley." }
      ]),
      friday: generate24HourProfile(12, 8, [
        { start: 14, end: 19, multiplier: 3.1, level: "heavy", note: "Friday valley escape rush toward Chitwan/Pokhara." },
        { start: 19, end: 23, multiplier: 4.1, level: "standstill", note: "Freight release combined with holiday buses." }
      ]),
      saturday: generate24HourProfile(12, 8, [
        { start: 7, end: 10, multiplier: 2, level: "moderate", note: "Morning weekend trips and bike convoys." },
        { start: 17, end: 21, multiplier: 2.8, level: "heavy", note: "Returning weekenders and freight flow." }
      ]),
      festival: generate24HourProfile(12, 8, [
        { start: 5, end: 23, multiplier: 4.2, level: "standstill", note: "Massive exodus from Kathmandu; queues can extend past Thankot." }
      ])
    }
  },
  "tr-siddhababa": {
    corridorId: "tr-siddhababa",
    corridorName: "Siddhababa Rock Shed Zone (H10)",
    highwayCode: "H10",
    section: "Chidiya Khola (Butwal) to Dobhan (Palpa) (6 km)",
    distanceKm: 6,
    freeFlowTimeMinutes: 10,
    peakTimeMinutes: 38,
    bestDepartureWindow: "06:00 AM \u2013 08:30 AM",
    worstDepartureWindow: "11:00 AM \u2013 04:30 PM",
    primaryBottlenecks: [
      "Active 1,126m rock-shed tunnel construction work on vertical gorge cliffs",
      "Periodic 15-minute stoppages for rock clearing and crane maneuvers",
      "Single-lane bridge crossing over Dobhan Khola"
    ],
    historicalTips: [
      "Traffic police restrict movement during active heavy rainfall due to rockfall hazard.",
      "Speed limit is strictly enforced at 20 km/h in the construction corridor.",
      "Early morning transit gives optimal visibility and minimal dust kickback."
    ],
    hourlyProfiles: {
      weekday: generate24HourProfile(10, 6, [
        { start: 9, end: 12, multiplier: 2.2, level: "moderate", note: "Construction machinery transit and Palpa morning bus flow." },
        { start: 13, end: 17, multiplier: 2.9, level: "heavy", note: "Rock-shed assembly works and dump truck shuttles." }
      ]),
      friday: generate24HourProfile(10, 6, [
        { start: 10, end: 17, multiplier: 3, level: "heavy", note: "Increased weekend tourist travel toward Tansen & Pokhara." }
      ]),
      saturday: generate24HourProfile(10, 6, [
        { start: 9, end: 13, multiplier: 2.4, level: "moderate", note: "Saturday Rani Mahal & Palpa tourist influx." },
        { start: 16, end: 19, multiplier: 2.2, level: "moderate", note: "Return traffic toward Butwal." }
      ]),
      festival: generate24HourProfile(10, 6, [
        { start: 7, end: 20, multiplier: 3.3, level: "standstill", note: "Heavy festival traffic on Siddhartha highway." }
      ])
    }
  },
  "tr-narayanghat-mugling": {
    corridorId: "tr-narayanghat-mugling",
    corridorName: "Narayanghat \u2013 Mugling Trishuli Gorge (H05)",
    highwayCode: "H05",
    section: "Aaptari (Bharatpur) to Mugling Bridge (36 km)",
    distanceKm: 36,
    freeFlowTimeMinutes: 45,
    peakTimeMinutes: 110,
    bestDepartureWindow: "05:30 AM \u2013 08:00 AM",
    worstDepartureWindow: "04:30 PM \u2013 08:30 PM",
    primaryBottlenecks: [
      "Tuin Khola bridge construction rock-cutting cutouts",
      "Slow heavy commercial trucks on steep river cliff curves",
      "Landslide clearing machinery deployment near Jalbire / Setidobhan"
    ],
    historicalTips: [
      "Crucial lifeline connecting Kathmandu & Pokhara to southern Terai and India.",
      "Check live monsoon alerts: Tuin Khola and Kalikhola are historically active landslide zones.",
      "Night travel between 1 AM - 4 AM offers smoothest transit but requires high-beam alertness."
    ],
    hourlyProfiles: {
      weekday: generate24HourProfile(45, 36, [
        { start: 8, end: 11, multiplier: 1.7, level: "moderate", note: "Morning freight & bus flow from Terai." },
        { start: 15, end: 19, multiplier: 2.3, level: "heavy", note: "Afternoon container trucks & intercity microbuses." },
        { start: 20, end: 23, multiplier: 2.1, level: "heavy", note: "Long-haul freight and overnight AC bus convoys." }
      ]),
      friday: generate24HourProfile(45, 36, [
        { start: 14, end: 22, multiplier: 2.5, level: "heavy", note: "Heavy weekend tourist & commercial traffic convergence." }
      ]),
      saturday: generate24HourProfile(45, 36, [
        { start: 9, end: 12, multiplier: 1.5, level: "smooth", note: "Moderate family road trips." },
        { start: 16, end: 19, multiplier: 1.8, level: "moderate", note: "Evening return streams." }
      ]),
      festival: generate24HourProfile(45, 36, [
        { start: 6, end: 23, multiplier: 2.8, level: "standstill", note: "Continuous maximum capacity flow during national festivals." }
      ])
    }
  },
  "tr-sindhuli-bp": {
    corridorId: "tr-sindhuli-bp",
    corridorName: "Sindhuli Gadhi Serpentine Ridge (H13 - BP Highway)",
    highwayCode: "H13",
    section: "Nepalthok to Sindhuli Madi (42 km)",
    distanceKm: 42,
    freeFlowTimeMinutes: 60,
    peakTimeMinutes: 125,
    bestDepartureWindow: "06:00 AM \u2013 09:00 AM",
    worstDepartureWindow: "02:00 PM \u2013 06:30 PM",
    primaryBottlenecks: [
      "Continuous hairpin switchbacks with restricted vehicle width (large trucks banned)",
      "Overtaking bottlenecks behind slow hill microbuses on 3.75m narrow carriageway",
      "Rosha Khola flash flood river fords in monsoon"
    ],
    historicalTips: [
      "Heavy multi-axle cargo trucks are legally prohibited; only microbuses, cars, and bikes permitted.",
      "Brake cooling stop recommended at Sindhuli Gadhi crest to prevent mountain brake fade.",
      "Scenic photography stops at Selfiedanda frequently cause mini shoulder congestions on weekends."
    ],
    hourlyProfiles: {
      weekday: generate24HourProfile(60, 42, [
        { start: 8, end: 11, multiplier: 1.6, level: "moderate", note: "Eastern Nepal microbuses heading to Kathmandu." },
        { start: 13, end: 17, multiplier: 1.9, level: "heavy", note: "Mid-day Kathmandu outbound microbuses." }
      ]),
      friday: generate24HourProfile(60, 42, [
        { start: 12, end: 18, multiplier: 2.2, level: "heavy", note: "Friday eastern Terai passenger rush." }
      ]),
      saturday: generate24HourProfile(60, 42, [
        { start: 9, end: 16, multiplier: 1.8, level: "moderate", note: "Weekend motorcycle tours and scenic roadtrippers." }
      ]),
      festival: generate24HourProfile(60, 42, [
        { start: 5, end: 20, multiplier: 2.6, level: "standstill", note: "Massive alternative route diversion during Dashain." }
      ])
    }
  },
  "tr-chitwan-express": {
    corridorId: "tr-chitwan-express",
    corridorName: "Narayanghat \u2013 Butwal Plains (H01)",
    highwayCode: "H01",
    section: "Kawasoti to Bardaghat (32 km)",
    distanceKm: 32,
    freeFlowTimeMinutes: 28,
    peakTimeMinutes: 40,
    bestDepartureWindow: "All day (Free Flow)",
    worstDepartureWindow: "07:30 PM \u2013 09:30 PM (Minor Local Bazar Flow)",
    primaryBottlenecks: [
      "Local market bazars with pedestrian crossings at Kawasoti & Sunwal",
      "Agricultural tractor and slow rickshaw movement in outer lanes"
    ],
    historicalTips: [
      "Newly 4-lane paved surface offers exceptional travel speeds up to 70-80 km/h.",
      "Watch for wildlife crossing signs in buffer forest zones between Narayani river and Kawasoti."
    ],
    hourlyProfiles: {
      weekday: generate24HourProfile(28, 32, [
        { start: 9, end: 11, multiplier: 1.2, level: "smooth", note: "Local bazar trading traffic." },
        { start: 17, end: 20, multiplier: 1.35, level: "smooth", note: "Evening commuter movement across market hubs." }
      ]),
      friday: generate24HourProfile(28, 32, [
        { start: 16, end: 21, multiplier: 1.3, level: "smooth", note: "Weekend intercity transit." }
      ]),
      saturday: generate24HourProfile(28, 32, [
        { start: 10, end: 18, multiplier: 1.15, level: "smooth", note: "Smooth holiday flow." }
      ]),
      festival: generate24HourProfile(28, 32, [
        { start: 7, end: 21, multiplier: 1.5, level: "moderate", note: "High volume but remains fast-flowing on 4 lanes." }
      ])
    }
  }
};

// src/data/nepalHighwaysData.ts
var CITIES_AND_JUNCTIONS = [
  { id: "ktm", name: "Kathmandu", nepaliName: "\u0915\u093E\u0920\u092E\u093E\u0921\u094C\u0902", district: "Kathmandu", province: "Bagmati", lat: 27.7172, lng: 85.324, elevationM: 1400, isMajorHub: true, connectedHighways: ["H02", "H03", "H04", "H13"] },
  { id: "pkr", name: "Pokhara", nepaliName: "\u092A\u094B\u0916\u0930\u093E", district: "Kaski", province: "Gandaki", lat: 28.2096, lng: 83.9856, elevationM: 822, isMajorHub: true, connectedHighways: ["H04", "H10", "H15"] },
  { id: "cht", name: "Narayanghat / Bharatpur", nepaliName: "\u0928\u093E\u0930\u093E\u092F\u0923\u0917\u0922 / \u092D\u0930\u0924\u092A\u0941\u0930", district: "Chitwan", province: "Bagmati", lat: 27.6833, lng: 84.4333, elevationM: 208, isMajorHub: true, connectedHighways: ["H01", "H05"] },
  { id: "mgl", name: "Mugling", nepaliName: "\u092E\u0941\u0917\u094D\u0932\u093F\u0928", district: "Chitwan", province: "Bagmati", lat: 27.8617, lng: 84.5542, elevationM: 275, isMajorHub: true, connectedHighways: ["H04", "H05"] },
  { id: "btl", name: "Butwal", nepaliName: "\u092C\u0941\u091F\u0935\u0932", district: "Rupandehi", province: "Lumbini", lat: 27.7006, lng: 83.4484, elevationM: 220, isMajorHub: true, connectedHighways: ["H01", "H10"] },
  { id: "bhr", name: "Bhairahawa / Sunauli", nepaliName: "\u092D\u0948\u0930\u0939\u0935\u093E / \u0938\u0941\u0928\u094C\u0932\u0940", district: "Rupandehi", province: "Lumbini", lat: 27.5045, lng: 83.4503, elevationM: 105, isMajorHub: true, connectedHighways: ["H10"] },
  { id: "htd", name: "Hetauda", nepaliName: "\u0939\u0947\u091F\u094C\u0902\u0921\u093E", district: "Makwanpur", province: "Bagmati", lat: 27.4285, lng: 85.0331, elevationM: 460, isMajorHub: true, connectedHighways: ["H01", "H02", "H17"] },
  { id: "brg", name: "Birgunj", nepaliName: "\u0935\u0940\u0930\u0917\u0928\u094D\u091C", district: "Parsa", province: "Madhesh", lat: 27.0128, lng: 84.8774, elevationM: 90, isMajorHub: true, connectedHighways: ["H02", "H16"] },
  { id: "jnk", name: "Janakpurdham", nepaliName: "\u091C\u0928\u0915\u092A\u0941\u0930\u0927\u093E\u092E", district: "Dhanusha", province: "Madhesh", lat: 26.7271, lng: 85.9408, elevationM: 74, isMajorHub: true, connectedHighways: ["H01", "H16"] },
  { id: "brd", name: "Bardibas", nepaliName: "\u092C\u0930\u094D\u0926\u093F\u092C\u093E\u0938", district: "Mahottari", province: "Madhesh", lat: 26.974, lng: 85.9024, elevationM: 150, isMajorHub: true, connectedHighways: ["H01", "H13"] },
  { id: "brt", name: "Biratnagar", nepaliName: "\u0935\u093F\u0930\u093E\u091F\u0928\u0917\u0930", district: "Morang", province: "Koshi", lat: 26.4525, lng: 87.2718, elevationM: 72, isMajorHub: true, connectedHighways: ["H01", "H16"] },
  { id: "dhr", name: "Dharan", nepaliName: "\u0927\u0930\u093E\u0928", district: "Sunsari", province: "Koshi", lat: 26.8124, lng: 87.2834, elevationM: 349, isMajorHub: true, connectedHighways: ["H01", "H08", "H17"] },
  { id: "kkr", name: "Kakarbhitta", nepaliName: "\u0915\u093E\u0901\u0915\u0921\u092D\u093F\u091F\u094D\u091F\u093E", district: "Jhapa", province: "Koshi", lat: 26.6508, lng: 88.1565, elevationM: 145, isMajorHub: true, connectedHighways: ["H01", "H09"] },
  { id: "npg", name: "Nepalgunj", nepaliName: "\u0928\u0947\u092A\u093E\u0932\u0917\u0928\u094D\u091C", district: "Banke", province: "Lumbini", lat: 28.05, lng: 81.6167, elevationM: 150, isMajorHub: true, connectedHighways: ["H01", "H12"] },
  { id: "srk", name: "Surkhet (Birendranagar)", nepaliName: "\u0938\u0941\u0930\u094D\u0916\u0947\u0924 (\u0935\u0940\u0930\u0947\u0928\u094D\u0926\u094D\u0930\u0928\u0917\u0930)", district: "Surkhet", province: "Karnali", lat: 28.5997, lng: 81.6334, elevationM: 660, isMajorHub: true, connectedHighways: ["H06", "H12", "H17"] },
  { id: "dhg", name: "Dhangadhi", nepaliName: "\u0927\u0928\u0917\u0922\u0940", district: "Kailali", province: "Sudurpashchim", lat: 28.6946, lng: 80.5977, elevationM: 109, isMajorHub: true, connectedHighways: ["H01", "H14"] },
  { id: "mhn", name: "Mahendranagar / Gaddachauki", nepaliName: "\u092E\u0939\u0947\u0928\u094D\u0926\u094D\u0930\u0928\u0917\u0930", district: "Kanchanpur", province: "Sudurpashchim", lat: 28.9667, lng: 80.1833, elevationM: 198, isMajorHub: true, connectedHighways: ["H01"] },
  { id: "dhk", name: "Dhulikhel", nepaliName: "\u0927\u0941\u0932\u093F\u0916\u0947\u0932", district: "Kavrepalanchok", province: "Bagmati", lat: 27.6221, lng: 85.5428, elevationM: 1550, isMajorHub: false, connectedHighways: ["H03", "H13"] },
  { id: "sdh", name: "Sindhuli Gadhi", nepaliName: "\u0938\u093F\u0928\u094D\u0927\u0941\u0932\u0940\u0917\u0922\u0940", district: "Sindhuli", province: "Bagmati", lat: 27.2486, lng: 85.9186, elevationM: 1100, isMajorHub: false, connectedHighways: ["H13"] },
  { id: "dml", name: "Damauli", nepaliName: "\u0926\u092E\u094C\u0932\u0940", district: "Tanahun", province: "Gandaki", lat: 27.9733, lng: 84.2833, elevationM: 450, isMajorHub: false, connectedHighways: ["H04"] },
  { id: "plp", name: "Tansen (Palpa)", nepaliName: "\u0924\u093E\u0928\u0938\u0947\u0928 (\u092A\u093E\u0932\u094D\u092A\u093E)", district: "Palpa", province: "Lumbini", lat: 27.8683, lng: 83.5489, elevationM: 1350, isMajorHub: false, connectedHighways: ["H10"] },
  { id: "ilm", name: "Ilam", nepaliName: "\u0907\u0932\u093E\u092E", district: "Ilam", province: "Koshi", lat: 26.9117, lng: 87.9275, elevationM: 1208, isMajorHub: false, connectedHighways: ["H09"] },
  { id: "bgl", name: "Baglung", nepaliName: "\u092C\u093E\u0917\u0932\u0941\u0919", district: "Baglung", province: "Gandaki", lat: 28.2725, lng: 83.6006, elevationM: 1020, isMajorHub: false, connectedHighways: ["H15"] },
  { id: "jml", name: "Jumla", nepaliName: "\u091C\u0941\u092E\u094D\u0932\u093E", district: "Jumla", province: "Karnali", lat: 29.2747, lng: 82.1838, elevationM: 2514, isMajorHub: false, connectedHighways: ["H06"] },
  { id: "nbz", name: "Naubise / Khanikhola", nepaliName: "\u0928\u094C\u092C\u093F\u0938\u0947", district: "Dhading", province: "Bagmati", lat: 27.7214, lng: 85.1764, elevationM: 920, isMajorHub: false, connectedHighways: ["H02", "H04"] },
  { id: "kdr", name: "Tatopani / Kodari (China Border)", nepaliName: "\u0924\u093E\u0924\u094B\u092A\u093E\u0928\u0940 / \u0915\u094B\u0926\u093E\u0930\u0940", district: "Sindhupalchok", province: "Bagmati", lat: 27.9497, lng: 85.9452, elevationM: 1640, isMajorHub: false, connectedHighways: ["H03"] }
];
var NEPAL_HIGHWAYS = [
  {
    id: "h04",
    code: "H04",
    name: "Prithvi Highway",
    nepaliName: "\u092A\u0943\u0925\u094D\u0935\u0940 \u0930\u093E\u091C\u092E\u093E\u0930\u094D\u0917",
    totalLengthKm: 174,
    startPoint: "Naubise (Dhading / Kathmandu Entry)",
    endPoint: "Prithvi Chowk, Pokhara",
    provinces: ["Bagmati", "Gandaki"],
    keyPassesAndJunctions: ["Nagdhunga Tunnel Exit", "Naubise", "Galchhi (Trishuli link)", "Malekhu (Fish hub)", "Mugling Junction", "Dumre (Bandipur entry)", "Damauli", "Kotre", "Pokhara"],
    overallStatus: "caution",
    conditionRating: 3.4,
    scenicRating: 4.6,
    terrainType: "Hilly",
    description: "Vital mountain arterial highway connecting Kathmandu Valley with the tourist hub of Pokhara, winding alongside the fast-flowing Trishuli and Marshyangdi river valleys. Currently undergoing major 4-lane expansion between Mugling and Pokhara.",
    dorDivision: "DOR Road Division Bharatpur & Tanahun (Pokhara)",
    emergencyContact: "+977-1-4286577 (Traffic Hotline: 103)",
    activeAlertCount: 2,
    segments: [
      {
        id: "h04-seg-1",
        from: "Naubise",
        to: "Galchhi",
        distanceKm: 26,
        avgSpeedKmh: 45,
        surface: "asphalt_excellent",
        status: "clear",
        lanes: 2,
        elevationStartM: 920,
        elevationEndM: 580,
        coordinates: [[27.7214, 85.1764], [27.7533, 85.0872], [27.8105, 84.9754]]
      },
      {
        id: "h04-seg-2",
        from: "Galchhi",
        to: "Malekhu",
        distanceKm: 22,
        avgSpeedKmh: 40,
        surface: "blacktopped_fair",
        status: "clear",
        lanes: 2,
        elevationStartM: 580,
        elevationEndM: 450,
        coordinates: [[27.8105, 84.9754], [27.8286, 84.8912], [27.8228, 84.8155]]
      },
      {
        id: "h04-seg-3",
        from: "Malekhu",
        to: "Mugling",
        distanceKm: 40,
        avgSpeedKmh: 35,
        surface: "blacktopped_fair",
        status: "caution",
        lanes: 2,
        elevationStartM: 450,
        elevationEndM: 275,
        currentIssue: "Minor rock fall hazard near Benighat & Jogimara curves during heavy rain",
        lastUpdated: "1 hour ago",
        coordinates: [[27.8228, 84.8155], [27.8423, 84.7155], [27.8617, 84.5542]]
      },
      {
        id: "h04-seg-4",
        from: "Mugling",
        to: "Damauli",
        distanceKm: 44,
        avgSpeedKmh: 30,
        surface: "under_construction",
        status: "caution",
        lanes: 2,
        elevationStartM: 275,
        elevationEndM: 450,
        currentIssue: "Highway widening work in progress (Asian Development Bank funded 4-lane upgrade). Dusty with occasional stop-and-go single lane diversions.",
        lastUpdated: "30 mins ago",
        coordinates: [[27.8617, 84.5542], [27.9142, 84.4223], [27.9733, 84.2833]]
      },
      {
        id: "h04-seg-5",
        from: "Damauli",
        to: "Pokhara",
        distanceKm: 42,
        avgSpeedKmh: 48,
        surface: "asphalt_excellent",
        status: "clear",
        lanes: 4,
        elevationStartM: 450,
        elevationEndM: 822,
        coordinates: [[27.9733, 84.2833], [28.0833, 84.1432], [28.2096, 83.9856]]
      }
    ],
    evChargers: [
      { id: "ev-kurintar", name: "Nepal Electricity Authority DC Fast Charger", location: "Kurintar Cable Car Station", powerKw: 60, type: "CCS2", available: true, lat: 27.8698, lng: 84.6288 },
      { id: "ev-mugling", name: "BYD & Tata Fast Hub Mugling", location: "Near Mugling Bridge Chowk", powerKw: 50, type: "CCS2", available: true, lat: 27.8625, lng: 84.555 },
      { id: "ev-dumre", name: "Bandipur Highway Resort EV Station", location: "Dumre Chowk", powerKw: 30, type: "Type 2", available: true, lat: 27.962, lng: 84.412 },
      { id: "ev-pkr-prithvi", name: "Pokhara City Hub Fast Charger", location: "Prithvi Chowk Pokhara", powerKw: 120, type: "CCS2", available: true, lat: 28.209, lng: 83.986 }
    ],
    tollPlazas: [
      { id: "toll-nagdhunga", name: "Nagdhunga Tunnel Toll Plaza", location: "Nagdhunga-Sisne Khola", costNpr: { car: 60, suv_4wd: 80, motorbike: 25, bus_truck: 150, electric_vehicle: 50 }, lat: 27.702, lng: 85.201 },
      { id: "toll-malekhu", name: "Roads Board Nepal Malekhu Toll", location: "Malekhu Bridge", costNpr: { car: 30, suv_4wd: 40, motorbike: 0, bus_truck: 70, electric_vehicle: 30 }, lat: 27.823, lng: 84.816 }
    ]
  },
  {
    id: "h05",
    code: "H05",
    name: "Narayanghat\u2013Mugling Highway",
    nepaliName: "\u0928\u093E\u0930\u093E\u092F\u0923\u0917\u0922\u2013\u092E\u0941\u0917\u094D\u0932\u093F\u0928 \u0938\u0921\u0915",
    totalLengthKm: 36,
    startPoint: "Mugling (Prithvi Highway Junction)",
    endPoint: "Aaptari / Narayanghat (Mahendra Highway Link)",
    provinces: ["Bagmati"],
    keyPassesAndJunctions: ["Mugling", "Chorkilo", "Jalbire", "Gaighat", "Setidobhan", "Aaptari", "Pulchowk Narayanghat"],
    overallStatus: "caution",
    conditionRating: 4.1,
    scenicRating: 4.2,
    terrainType: "Hilly",
    description: "The supreme commercial lifeline of Nepal carrying over 90% of imported vehicular freight between the Terai border and Kathmandu / Pokhara. Beautiful wide 2-lane Asian Highway standard along the Trishuli canyon with sophisticated rockfall mitigation barriers.",
    dorDivision: "DOR Road Division Bharatpur",
    emergencyContact: "+977-56-520100 (Disaster Quick Response)",
    activeAlertCount: 1,
    segments: [
      {
        id: "h05-seg-1",
        from: "Mugling",
        to: "Jalbire",
        distanceKm: 18,
        avgSpeedKmh: 42,
        surface: "asphalt_excellent",
        status: "caution",
        lanes: 2,
        elevationStartM: 275,
        elevationEndM: 235,
        currentIssue: "Single lane controlled crossing near Chorkilo due to drainage clearance work",
        lastUpdated: "15 mins ago",
        coordinates: [[27.8617, 84.5542], [27.8102, 84.502], [27.765, 84.475]]
      },
      {
        id: "h05-seg-2",
        from: "Jalbire",
        to: "Aaptari Narayanghat",
        distanceKm: 18,
        avgSpeedKmh: 55,
        surface: "asphalt_excellent",
        status: "clear",
        lanes: 2,
        elevationStartM: 235,
        elevationEndM: 208,
        coordinates: [[27.765, 84.475], [27.712, 84.451], [27.6833, 84.4333]]
      }
    ],
    evChargers: [
      { id: "ev-jalbire", name: "Highway Oasis Fast Charger", location: "Jalbire, Chitwan", powerKw: 60, type: "CCS2", available: true, lat: 27.765, lng: 84.475 },
      { id: "ev-narayanghat", name: "Bharatpur Central Charging Station", location: "Pulchowk Narayanghat", powerKw: 120, type: "CCS2", available: true, lat: 27.685, lng: 84.43 }
    ],
    tollPlazas: [
      { id: "toll-aaptari", name: "Roads Board Nepal Aaptari Toll Plaza", location: "Aaptari Gate, Chitwan", costNpr: { car: 35, suv_4wd: 50, motorbike: 0, bus_truck: 80, electric_vehicle: 35 }, lat: 27.695, lng: 84.438 }
    ]
  },
  {
    id: "h01",
    code: "H01",
    name: "Mahendra Highway (East\u2013West Highway)",
    nepaliName: "\u092E\u0939\u0947\u0928\u094D\u0926\u094D\u0930 \u0930\u093E\u091C\u092E\u093E\u0930\u094D\u0917 (\u092A\u0942\u0930\u094D\u0935\u2013\u092A\u0936\u094D\u091A\u093F\u092E \u0930\u093E\u091C\u092E\u093E\u0930\u094D\u0917)",
    totalLengthKm: 1027,
    startPoint: "Kakarbhitta (Eastern Border - India/Assam Link)",
    endPoint: "Gaddachauki / Mahendranagar (Western Border)",
    provinces: ["Koshi", "Madhesh", "Bagmati", "Gandaki", "Lumbini", "Sudurpashchim"],
    keyPassesAndJunctions: ["Kakarbhitta", "Damak", "Itahari (Dharan link)", "Koshi Barrage", "Lahan", "Bardibas (BP Highway junction)", "Pathlaiya (Birgunj link)", "Hetauda", "Narayanghat", "Daunne Hill Pass", "Butwal", "Gorusinghe", "Kohalpur (Nepalgunj link)", "Karnali Chisapani Bridge", "Attariya (Dhangadhi link)", "Mahendranagar"],
    overallStatus: "caution",
    conditionRating: 3.8,
    scenicRating: 4,
    terrainType: "Plains",
    description: "The national spine of Nepal spanning the entire southern Terai belt from east to west. Connects major agricultural, industrial, and demographic centers. Major 4-lane expansion underway along Narayanghat\u2013Butwal and Kamala\u2013Kanchanpur sections.",
    dorDivision: "DOR Central Project Directorate & Regional Divisions",
    emergencyContact: "103 / +977-1-4286577",
    activeAlertCount: 2,
    segments: [
      {
        id: "h01-seg-1",
        from: "Kakarbhitta",
        to: "Itahari",
        distanceKm: 85,
        avgSpeedKmh: 65,
        surface: "asphalt_excellent",
        status: "clear",
        lanes: 4,
        elevationStartM: 145,
        elevationEndM: 110,
        coordinates: [[26.6508, 88.1565], [26.662, 87.892], [26.665, 87.278]]
      },
      {
        id: "h01-seg-2",
        from: "Itahari",
        to: "Bardibas",
        distanceKm: 165,
        avgSpeedKmh: 58,
        surface: "blacktopped_fair",
        status: "clear",
        lanes: 2,
        elevationStartM: 110,
        elevationEndM: 150,
        coordinates: [[26.665, 87.278], [26.521, 86.932], [26.974, 85.9024]]
      },
      {
        id: "h01-seg-3",
        from: "Bardibas",
        to: "Hetauda",
        distanceKm: 130,
        avgSpeedKmh: 60,
        surface: "asphalt_excellent",
        status: "clear",
        lanes: 2,
        elevationStartM: 150,
        elevationEndM: 460,
        coordinates: [[26.974, 85.9024], [27.05, 85.35], [27.4285, 85.0331]]
      },
      {
        id: "h01-seg-4",
        from: "Hetauda",
        to: "Narayanghat",
        distanceKm: 76,
        avgSpeedKmh: 62,
        surface: "asphalt_excellent",
        status: "clear",
        lanes: 2,
        elevationStartM: 460,
        elevationEndM: 208,
        coordinates: [[27.4285, 85.0331], [27.57, 84.75], [27.6833, 84.4333]]
      },
      {
        id: "h01-seg-5",
        from: "Narayanghat",
        to: "Butwal (via Daunne Pass)",
        distanceKm: 114,
        avgSpeedKmh: 35,
        surface: "under_construction",
        status: "caution",
        lanes: 2,
        elevationStartM: 208,
        elevationEndM: 220,
        currentIssue: "Daunne Hill section (14 km) undergoing heavy widening and slope cutting. Expect 40-minute delays during peak hours.",
        lastUpdated: "45 mins ago",
        coordinates: [[27.6833, 84.4333], [27.53, 83.89], [27.7006, 83.4484]]
      },
      {
        id: "h01-seg-6",
        from: "Butwal",
        to: "Kohalpur (Nepalgunj)",
        distanceKm: 240,
        avgSpeedKmh: 70,
        surface: "asphalt_excellent",
        status: "clear",
        lanes: 2,
        elevationStartM: 220,
        elevationEndM: 150,
        coordinates: [[27.7006, 83.4484], [27.72, 82.85], [28.19, 81.69]]
      },
      {
        id: "h01-seg-7",
        from: "Kohalpur",
        to: "Dhangadhi / Mahendranagar",
        distanceKm: 217,
        avgSpeedKmh: 72,
        surface: "asphalt_excellent",
        status: "clear",
        lanes: 2,
        elevationStartM: 150,
        elevationEndM: 198,
        coordinates: [[28.19, 81.69], [28.64, 81.28], [28.6946, 80.5977], [28.9667, 80.1833]]
      }
    ],
    evChargers: [
      { id: "ev-itahari", name: "Itahari Sub-Metropolitan Supercharger", location: "Itahari Chowk", powerKw: 60, type: "CCS2", available: true, lat: 26.665, lng: 87.278 },
      { id: "ev-bardibas", name: "Bardibas Highway EV Hub", location: "Sindhuli Highway Junction", powerKw: 60, type: "CCS2", available: true, lat: 26.974, lng: 85.9024 },
      { id: "ev-hetauda", name: "Hetauda Industrial EV Plaza", location: "Chauki Toll, Hetauda", powerKw: 90, type: "CCS2", available: true, lat: 27.4285, lng: 85.0331 },
      { id: "ev-butwal", name: "Butwal Traffic Chowk Mega Charger", location: "Butwal By-pass", powerKw: 120, type: "CCS2", available: true, lat: 27.7006, lng: 83.4484 },
      { id: "ev-kohalpur", name: "Kohalpur Western Nepal EV Hub", location: "Kohalpur Chauraha", powerKw: 60, type: "CCS2", available: true, lat: 28.19, lng: 81.69 }
    ],
    tollPlazas: [
      { id: "toll-hetauda", name: "RBN Hetauda Entry Toll", location: "Rato Mate, Hetauda", costNpr: { car: 30, suv_4wd: 50, motorbike: 0, bus_truck: 80, electric_vehicle: 30 }, lat: 27.435, lng: 85.021 },
      { id: "toll-butwal", name: "RBN Butwal Toll Gate", location: "Ramuapur, Butwal", costNpr: { car: 30, suv_4wd: 50, motorbike: 0, bus_truck: 80, electric_vehicle: 30 }, lat: 27.705, lng: 83.439 }
    ]
  },
  {
    id: "h13",
    code: "H13",
    name: "B.P. Koirala Highway (Banepa\u2013Bardibas)",
    nepaliName: "\u092C\u093F\u092A\u0940 \u0930\u093E\u091C\u092E\u093E\u0930\u094D\u0917 (\u092C\u0928\u0947\u092A\u093E\u2013\u092C\u0930\u094D\u0926\u093F\u092C\u093E\u0938)",
    totalLengthKm: 160,
    startPoint: "Dhulikhel / Banepa (Kavre)",
    endPoint: "Bardibas (Mahottari)",
    provinces: ["Bagmati", "Madhesh"],
    keyPassesAndJunctions: ["Dhulikhel", "Bhakundebesi", "Nepalthok", "Khurkot (Manthali link)", "Sindhuli Gadhi", "Sindhuli Madi", "Bardibas"],
    overallStatus: "caution",
    conditionRating: 4.4,
    scenicRating: 4.9,
    terrainType: "High Mountain",
    description: "An engineering marvel constructed with Japanese JICA grant assistance, featuring geotextile reinforced soil walls and hairpin hairpin mountain turns hugging the Sunkoshi and Roshi rivers. Drastically cuts travel time between Kathmandu and Eastern Terai. Restrictive heavy vehicle limits apply.",
    dorDivision: "DOR Road Division Sindhuli & Bhaktapur",
    emergencyContact: "+977-47-520144 / 103",
    activeAlertCount: 1,
    segments: [
      {
        id: "h13-seg-1",
        from: "Dhulikhel",
        to: "Nepalthok",
        distanceKm: 50,
        avgSpeedKmh: 42,
        surface: "asphalt_excellent",
        status: "caution",
        lanes: 2,
        elevationStartM: 1550,
        elevationEndM: 520,
        currentIssue: "Repaired Roshi river washout sections operating under 20 km/h speed restrictions with concrete paved fords",
        lastUpdated: "2 hours ago",
        coordinates: [[27.6221, 85.5428], [27.502, 85.67], [27.42, 85.87]]
      },
      {
        id: "h13-seg-2",
        from: "Nepalthok",
        to: "Khurkot",
        distanceKm: 37,
        avgSpeedKmh: 48,
        surface: "asphalt_excellent",
        status: "clear",
        lanes: 2,
        elevationStartM: 520,
        elevationEndM: 470,
        coordinates: [[27.42, 85.87], [27.35, 85.96], [27.3333, 86.0167]]
      },
      {
        id: "h13-seg-3",
        from: "Khurkot",
        to: "Sindhuli Gadhi Pass",
        distanceKm: 33,
        avgSpeedKmh: 35,
        surface: "asphalt_excellent",
        status: "clear",
        lanes: 2,
        elevationStartM: 470,
        elevationEndM: 1100,
        coordinates: [[27.3333, 86.0167], [27.28, 85.94], [27.2486, 85.9186]]
      },
      {
        id: "h13-seg-4",
        from: "Sindhuli Gadhi",
        to: "Bardibas",
        distanceKm: 40,
        avgSpeedKmh: 50,
        surface: "asphalt_excellent",
        status: "clear",
        lanes: 2,
        elevationStartM: 1100,
        elevationEndM: 150,
        coordinates: [[27.2486, 85.9186], [27.15, 85.91], [26.974, 85.9024]]
      }
    ],
    evChargers: [
      { id: "ev-khurkot", name: "Khurkot Sunkoshi Fast Hub", location: "Khurkot Chowk", powerKw: 60, type: "CCS2", available: true, lat: 27.3333, lng: 86.0167 },
      { id: "ev-sindhuli", name: "Sindhuli Madi Charging Plaza", location: "Sindhuli Bazar", powerKw: 30, type: "Type 2", available: true, lat: 27.2486, lng: 85.9186 }
    ],
    tollPlazas: []
  },
  {
    id: "h10",
    code: "H10",
    name: "Siddhartha Highway",
    nepaliName: "\u0938\u093F\u0926\u094D\u0927\u093E\u0930\u094D\u0925 \u0930\u093E\u091C\u092E\u093E\u0930\u094D\u0917",
    totalLengthKm: 181,
    startPoint: "Sunauli / Bhairahawa (Indian border)",
    endPoint: "Prithvi Chowk, Pokhara",
    provinces: ["Lumbini", "Gandaki"],
    keyPassesAndJunctions: ["Sunauli", "Bhairahawa", "Butwal", "Siddhababa Rockfall Tunnel", "Tansen (Palpa link)", "Ramdi Bridge", "Galyang", "Waling", "Syangja Bazar", "Kande Pass", "Pokhara"],
    overallStatus: "caution",
    conditionRating: 3.6,
    scenicRating: 4.7,
    terrainType: "High Mountain",
    description: "Scenic winding hill highway connecting the southern international border at Sunauli/Bhairahawa (Lumbini) directly with Pokhara valley. Famous for the recently inaugurated Siddhababa rock-shed tunnel and lush Palpa/Syangja terraced vistas.",
    dorDivision: "DOR Road Division Palpa & Butwal",
    emergencyContact: "+977-75-520120 / 103",
    activeAlertCount: 1,
    segments: [
      {
        id: "h10-seg-1",
        from: "Sunauli/Bhairahawa",
        to: "Butwal",
        distanceKm: 22,
        avgSpeedKmh: 65,
        surface: "asphalt_excellent",
        status: "clear",
        lanes: 6,
        elevationStartM: 105,
        elevationEndM: 220,
        coordinates: [[27.5045, 83.4503], [27.6, 83.45], [27.7006, 83.4484]]
      },
      {
        id: "h10-seg-2",
        from: "Butwal",
        to: "Tansen (Palpa)",
        distanceKm: 39,
        avgSpeedKmh: 38,
        surface: "blacktopped_fair",
        status: "caution",
        lanes: 2,
        elevationStartM: 220,
        elevationEndM: 1350,
        currentIssue: "Siddhababa slope protection finishing works. Minor single lane movement near Kerabari",
        lastUpdated: "1 hour ago",
        coordinates: [[27.7006, 83.4484], [27.78, 83.49], [27.8683, 83.5489]]
      },
      {
        id: "h10-seg-3",
        from: "Tansen (Palpa)",
        to: "Waling (Syangja)",
        distanceKm: 55,
        avgSpeedKmh: 42,
        surface: "asphalt_excellent",
        status: "clear",
        lanes: 2,
        elevationStartM: 1350,
        elevationEndM: 750,
        coordinates: [[27.8683, 83.5489], [27.91, 83.62], [27.98, 83.77]]
      },
      {
        id: "h10-seg-4",
        from: "Waling",
        to: "Pokhara",
        distanceKm: 65,
        avgSpeedKmh: 45,
        surface: "asphalt_excellent",
        status: "clear",
        lanes: 2,
        elevationStartM: 750,
        elevationEndM: 822,
        coordinates: [[27.98, 83.77], [28.09, 83.87], [28.2096, 83.9856]]
      }
    ],
    evChargers: [
      { id: "ev-waling", name: "Syangja Waling Fast Station", location: "Waling Bazaar", powerKw: 60, type: "CCS2", available: true, lat: 27.98, lng: 83.77 },
      { id: "ev-palpa", name: "Palpa Tansen City Charger", location: "Tansen Buspark", powerKw: 30, type: "Type 2", available: true, lat: 27.8683, lng: 83.5489 }
    ],
    tollPlazas: []
  },
  {
    id: "h02",
    code: "H02",
    name: "Tribhuvan Highway (Byroad)",
    nepaliName: "\u0924\u094D\u0930\u093F\u092D\u0941\u0935\u0928 \u0930\u093E\u091C\u092A\u0925",
    totalLengthKm: 160,
    startPoint: "Tripureshwor / Kathmandu",
    endPoint: "Birgunj / Raxaul Border",
    provinces: ["Bagmati", "Madhesh"],
    keyPassesAndJunctions: ["Kathmandu", "Nagdhunga Pass", "Naubise", "Tistung", "Daman (2,322m view tower)", "Bhainse", "Hetauda", "Amlekhgunj", "Pathlaiya", "Birgunj"],
    overallStatus: "clear",
    conditionRating: 3.5,
    scenicRating: 4.8,
    terrainType: "High Mountain",
    description: "The historic first highway constructed in Nepal (1956). Traverses extreme mountain altitudes through Daman pass offering panoramic views of Mount Everest and the entire Himalayan Range. The Hetauda-Birgunj segment forms part of the Asian Highway.",
    dorDivision: "DOR Road Division Hetauda & Kathmandu",
    emergencyContact: "+977-57-520288 / 103",
    activeAlertCount: 0,
    segments: [
      {
        id: "h02-seg-1",
        from: "Kathmandu",
        to: "Naubise",
        distanceKm: 26,
        avgSpeedKmh: 40,
        surface: "asphalt_excellent",
        status: "clear",
        lanes: 2,
        elevationStartM: 1400,
        elevationEndM: 920,
        coordinates: [[27.7172, 85.324], [27.702, 85.201], [27.7214, 85.1764]]
      },
      {
        id: "h02-seg-2",
        from: "Naubise",
        to: "Daman Pass",
        distanceKm: 55,
        avgSpeedKmh: 30,
        surface: "blacktopped_fair",
        status: "clear",
        lanes: 2,
        elevationStartM: 920,
        elevationEndM: 2322,
        coordinates: [[27.7214, 85.1764], [27.65, 85.1], [27.6, 85.05]]
      },
      {
        id: "h02-seg-3",
        from: "Daman Pass",
        to: "Hetauda",
        distanceKm: 51,
        avgSpeedKmh: 35,
        surface: "blacktopped_fair",
        status: "clear",
        lanes: 2,
        elevationStartM: 2322,
        elevationEndM: 460,
        coordinates: [[27.6, 85.05], [27.51, 85.03], [27.4285, 85.0331]]
      },
      {
        id: "h02-seg-4",
        from: "Hetauda",
        to: "Birgunj Border",
        distanceKm: 54,
        avgSpeedKmh: 65,
        surface: "asphalt_excellent",
        status: "clear",
        lanes: 4,
        elevationStartM: 460,
        elevationEndM: 90,
        coordinates: [[27.4285, 85.0331], [27.18, 84.99], [27.0128, 84.8774]]
      }
    ],
    evChargers: [
      { id: "ev-daman", name: "Daman Mountain Resort EV Charger", location: "Daman View Tower", powerKw: 22, type: "Type 2", available: true, lat: 27.6, lng: 85.05 },
      { id: "ev-birgunj", name: "Birgunj ICD Supercharger", location: "Dry Port Bypass, Birgunj", powerKw: 120, type: "CCS2", available: true, lat: 27.0128, lng: 84.8774 }
    ],
    tollPlazas: []
  },
  {
    id: "h06",
    code: "H06",
    name: "Karnali Highway",
    nepaliName: "\u0915\u0930\u094D\u0923\u093E\u0932\u0940 \u0930\u093E\u091C\u092E\u093E\u0930\u094D\u0917",
    totalLengthKm: 232,
    startPoint: "Birendranagar / Surkhet",
    endPoint: "Chandannath / Jumla Bazar",
    provinces: ["Karnali"],
    keyPassesAndJunctions: ["Surkhet", "Bange Shanti", "Dallu", "Kalikot (Manma)", "Nagma (Rara Lake link)", "Jumla"],
    overallStatus: "caution",
    conditionRating: 2.8,
    scenicRating: 5,
    terrainType: "High Mountain",
    description: "The heroic mountain road carving through remote, sheer limestone gorges along the Karnali River to high Himalayan valleys. Essential for travelers visiting Rara National Park and Jumla apples valley.",
    dorDivision: "DOR Road Division Jumla & Surkhet",
    emergencyContact: "+977-87-520133 / 100",
    activeAlertCount: 1,
    segments: [
      {
        id: "h06-seg-1",
        from: "Surkhet",
        to: "Kalikot (Manma)",
        distanceKm: 130,
        avgSpeedKmh: 28,
        surface: "blacktopped_fair",
        status: "caution",
        lanes: 1.5,
        elevationStartM: 660,
        elevationEndM: 1450,
        currentIssue: "Narrow curves near Gaganekhola and Shubhakalika with dry landslide clearance ongoing",
        lastUpdated: "3 hours ago",
        coordinates: [[28.5997, 81.6334], [28.85, 81.65], [29.14, 81.6]]
      },
      {
        id: "h06-seg-2",
        from: "Kalikot",
        to: "Jumla",
        distanceKm: 102,
        avgSpeedKmh: 30,
        surface: "gravel",
        status: "caution",
        lanes: 1.5,
        elevationStartM: 1450,
        elevationEndM: 2514,
        coordinates: [[29.14, 81.6], [29.2, 81.9], [29.2747, 82.1838]]
      }
    ],
    evChargers: [
      { id: "ev-surkhet", name: "Surkhet Valley Fast Hub", location: "Birendranagar Buspark", powerKw: 60, type: "CCS2", available: true, lat: 28.5997, lng: 81.6334 }
    ],
    tollPlazas: []
  },
  {
    id: "h03",
    code: "H03",
    name: "Araniko Highway",
    nepaliName: "\u0905\u0930\u0928\u093F\u0915\u094B \u0930\u093E\u091C\u092E\u093E\u0930\u094D\u0917",
    totalLengthKm: 113,
    startPoint: "Maitighar / Kathmandu",
    endPoint: "Kodari / Tatopani (China / Tibet Border)",
    provinces: ["Bagmati"],
    keyPassesAndJunctions: ["Kathmandu", "Bhaktapur (6-lane expressway)", "Banepa", "Dhulikhel", "Panchkhal", "Dolalghat (Indrawati link)", "Bahrabise", "Tatopani Border"],
    overallStatus: "caution",
    conditionRating: 3.7,
    scenicRating: 4.5,
    terrainType: "Hilly",
    description: "Historic trade corridor connecting Kathmandu with China / Tibet Autonomous Region through the Bhotekoshi river gorge.",
    dorDivision: "DOR Road Division Charikot & Bhaktapur",
    emergencyContact: "+977-11-660144",
    activeAlertCount: 1,
    segments: [
      {
        id: "h03-seg-1",
        from: "Kathmandu",
        to: "Dhulikhel",
        distanceKm: 30,
        avgSpeedKmh: 50,
        surface: "asphalt_excellent",
        status: "clear",
        lanes: 6,
        elevationStartM: 1400,
        elevationEndM: 1550,
        coordinates: [[27.7172, 85.324], [27.671, 85.4298], [27.6221, 85.5428]]
      },
      {
        id: "h03-seg-2",
        from: "Dhulikhel",
        to: "Dolalghat",
        distanceKm: 27,
        avgSpeedKmh: 45,
        surface: "asphalt_excellent",
        status: "clear",
        lanes: 2,
        elevationStartM: 1550,
        elevationEndM: 630,
        coordinates: [[27.6221, 85.5428], [27.67, 85.65], [27.6333, 85.7]]
      },
      {
        id: "h03-seg-3",
        from: "Dolalghat",
        to: "Tatopani / Kodari",
        distanceKm: 56,
        avgSpeedKmh: 32,
        surface: "blacktopped_fair",
        status: "caution",
        lanes: 2,
        elevationStartM: 630,
        elevationEndM: 1640,
        currentIssue: "Drainage repairs near Liping bridge with temporary 1-lane signal",
        lastUpdated: "4 hours ago",
        coordinates: [[27.6333, 85.7], [27.79, 85.89], [27.9497, 85.9452]]
      }
    ],
    evChargers: [
      { id: "ev-banepa", name: "Banepa Bus Station Fast Charger", location: "Banepa Pul", powerKw: 60, type: "CCS2", available: true, lat: 27.631, lng: 85.523 },
      { id: "ev-dolalghat", name: "Dolalghat River View EV Point", location: "Dolalghat Bazar", powerKw: 30, type: "Type 2", available: true, lat: 27.6333, lng: 85.7 }
    ],
    tollPlazas: []
  },
  {
    id: "h15",
    code: "H15",
    name: "Mid-Hill Highway (Pushpalal Rajmarga)",
    nepaliName: "\u092E\u0927\u094D\u092F\u092A\u0939\u093E\u0921\u0940 \u0932\u094B\u0915\u092E\u093E\u0930\u094D\u0917 (\u092A\u0941\u0937\u094D\u092A\u0932\u093E\u0932 \u0930\u093E\u091C\u092E\u093E\u0930\u094D\u0917)",
    totalLengthKm: 1879,
    startPoint: "Chiwabhanjyang (Panchthar, Eastern Border)",
    endPoint: "Jhulaghat (Baitadi, Western Border)",
    provinces: ["Koshi", "Bagmati", "Gandaki", "Karnali", "Sudurpashchim"],
    keyPassesAndJunctions: ["Chiwabhanjyang", "Terhathum", "Bhojpur", "Ghurmi", "Khurkot", "Pati Bhanjyang", "Galchhi", "Gorkha", "Pokhara", "Baglung", "Burtibang", "Rukumkot", "Jajarkot", "Dailekh", "Sanfebagar", "Jhulaghat"],
    overallStatus: "caution",
    conditionRating: 3.5,
    scenicRating: 5,
    terrainType: "High Mountain",
    description: "National pride project weaving across all mid-hill districts of Nepal, serving over 10 modern planned smart hill towns and linking remote agricultural belts.",
    dorDivision: "Pushpalal Highway Project Directorate",
    emergencyContact: "+977-1-4287890",
    activeAlertCount: 2,
    segments: [
      {
        id: "h15-seg-1",
        from: "Pokhara",
        to: "Baglung",
        distanceKm: 72,
        avgSpeedKmh: 45,
        surface: "asphalt_excellent",
        status: "clear",
        lanes: 2,
        elevationStartM: 822,
        elevationEndM: 1020,
        coordinates: [[28.2096, 83.9856], [28.25, 83.75], [28.2725, 83.6006]]
      }
    ],
    evChargers: [
      { id: "ev-baglung", name: "Baglung Kalika EV Station", location: "Baglung Buspark", powerKw: 60, type: "CCS2", available: true, lat: 28.2725, lng: 83.6006 }
    ],
    tollPlazas: []
  }
];
var LIVE_ROAD_INCIDENTS = [
  {
    id: "inc-1",
    highwayCode: "H04",
    highwayName: "Prithvi Highway",
    locationName: "Jogimara Curve, Dhading (Km 68)",
    chainageKm: "Ch 68+400",
    lat: 27.8423,
    lng: 84.7155,
    type: "landslide",
    severity: "moderate",
    title: "Debris Clearance at Jogimara Bend",
    description: "Minor hillside slush and loose boulders triggered by localized rain shower. Department of Roads heavy excavators deployed. Two-way traffic running with controlled 10-minute intermittent pauses.",
    status: "caution",
    reportedAt: "35 minutes ago",
    estimatedClearance: "1 hour remaining (Open for single lane now)",
    dorVerified: true,
    alternativeRouteAdvice: "Light vehicles heading from Kathmandu to Pokhara can also use Galchhi-Trishuli-Betrawati-Syaphrubesi or maintain standard Prithvi queue.",
    upvotes: 42
  },
  {
    id: "inc-2",
    highwayCode: "H05",
    highwayName: "Narayanghat\u2013Mugling Road",
    locationName: "Chorkilo & Kalikhola (Km 12)",
    chainageKm: "Ch 12+100",
    lat: 27.8102,
    lng: 84.502,
    type: "construction",
    severity: "minor",
    title: "Drainage Channel Culvert Upgrade",
    description: "Routine monsoon culvert enhancement by DOR Bharatpur Division. Road is open both ways with traffic police flagmen directing flow.",
    status: "caution",
    reportedAt: "1 hour ago",
    estimatedClearance: "Work ends by 5:00 PM today",
    dorVerified: true,
    upvotes: 18
  },
  {
    id: "inc-3",
    highwayCode: "H01",
    highwayName: "Mahendra Highway",
    locationName: "Daunne Hill Pass (Nawalparasi West)",
    chainageKm: "Ch 384+000",
    lat: 27.53,
    lng: 83.89,
    type: "construction",
    severity: "severe",
    title: "Daunne Section Hill Cutting & Expansion",
    description: "Major road widening works on the winding Daunne hill climb between Bardaghat and Dumkibas. Heavy dust and rough gravel. Heavy freight trucks restricted between 11 AM - 3 PM to ease passenger transit.",
    status: "caution",
    reportedAt: "2 hours ago",
    estimatedClearance: "Expect 30-45 mins average transit delay across the 14km pass",
    dorVerified: true,
    alternativeRouteAdvice: "No direct bypass exists for Terai traversal; plan transit during early morning (5 AM - 8 AM) for fastest flow.",
    upvotes: 89
  },
  {
    id: "inc-4",
    highwayCode: "H13",
    highwayName: "B.P. Highway",
    locationName: "Nepalthok\u2013Mamti Khola, Kavre/Sindhuli",
    chainageKm: "Ch 48+200",
    lat: 27.42,
    lng: 85.87,
    type: "bridge_maintenance",
    severity: "minor",
    title: "Roshi Corridor Concrete Pavement Speed Control",
    description: "Post-flood reconstructed road surface is in pristine drivable condition with concrete river crossing causeways. Maximum speed limit restricted to 25 km/h for heavy safety.",
    status: "clear",
    reportedAt: "4 hours ago",
    dorVerified: true,
    upvotes: 35
  },
  {
    id: "inc-5",
    highwayCode: "H06",
    highwayName: "Karnali Highway",
    locationName: "Gaganekhola, Kalikot",
    chainageKm: "Ch 112+000",
    lat: 29.14,
    lng: 81.6,
    type: "landslide",
    severity: "moderate",
    title: "Dry Landslide Clearance",
    description: "Loose shale slide cleared. Single-lane movement permitted for 4WD jeeps, buses, and local transport.",
    status: "caution",
    reportedAt: "5 hours ago",
    estimatedClearance: "Fully 2-way expected by evening",
    dorVerified: true,
    upvotes: 14
  }
];
var INITIAL_USER_REPORTS = [
  {
    id: "usr-1",
    highwayCode: "H04",
    location: "Near Benighat Trishuli riverside",
    incidentType: "fallen_rocks",
    severity: "minor",
    description: "Small gravel and stones fallen on outer shoulder. Drive in center lane.",
    reporterName: "Bishal Sharma (Bus Driver)",
    createdAt: "45m ago",
    upvotes: 12,
    verified: true
  },
  {
    id: "usr-2",
    highwayCode: "H01",
    location: "Hetauda Bypass Ratomate",
    incidentType: "pothole",
    severity: "minor",
    description: "Deep pothole after railway overpass bridge on the left lane toward Narayanghat.",
    reporterName: "Sujan Thapa",
    createdAt: "2h ago",
    upvotes: 21,
    verified: true
  },
  {
    id: "usr-3",
    highwayCode: "H10",
    location: "Near Ramdi Bridge, Palpa",
    incidentType: "traffic_jam",
    severity: "minor",
    description: "Slow moving queue of heavy fertilizer trucks ascending toward Tansen.",
    reporterName: "Kabita Shrestha",
    createdAt: "3h ago",
    upvotes: 8,
    verified: false
  }
];
var HIGHWAY_WEATHER_NODES = [
  {
    id: "wx-nagdhunga",
    name: "Nagdhunga Pass / Sisne Khola",
    nepaliName: "\u0928\u093E\u0917\u0922\u0941\u0902\u0917\u093E \u092D\u091E\u094D\u091C\u094D\u092F\u093E\u0919",
    highwayCode: "H02 / H04",
    elevationM: 1510,
    lat: 27.698,
    lng: 85.201,
    tempC: 18,
    condition: "dense_fog",
    rainProbabilityPercent: 35,
    humidityPercent: 88,
    windSpeedKmh: 14,
    visibilityKm: 0.8,
    roadGrip: "fog_low_visibility",
    landslideRisk: "moderate",
    summary: "Dense mountain fog near the tunnel portal approach. Low beam headlights recommended.",
    lastUpdated: "12 mins ago"
  },
  {
    id: "wx-mugling",
    name: "Mugling Trishuli Gorge",
    nepaliName: "\u092E\u0941\u0917\u094D\u0932\u093F\u0928 \u0924\u094D\u0930\u093F\u0936\u0942\u0932\u0940 \u0916\u094B\u0902\u091A",
    highwayCode: "H04 / H05",
    elevationM: 275,
    lat: 27.8617,
    lng: 84.5542,
    tempC: 27,
    condition: "mountain_shower",
    rainProbabilityPercent: 65,
    humidityPercent: 92,
    windSpeedKmh: 18,
    visibilityKm: 4.5,
    roadGrip: "wet_caution",
    landslideRisk: "high",
    summary: "River valley rainfall triggering light debris runoff. Exercise defensive driving along steep rock cuts.",
    lastUpdated: "8 mins ago"
  },
  {
    id: "wx-daunne",
    name: "Daunne Hill Pass",
    nepaliName: "\u0926\u093E\u0909\u0928\u094D\u0928\u0947 \u0921\u093E\u0901\u0921\u093E",
    highwayCode: "H01",
    elevationM: 650,
    lat: 27.56,
    lng: 83.82,
    tempC: 26,
    condition: "rain_monsoon",
    rainProbabilityPercent: 80,
    humidityPercent: 95,
    windSpeedKmh: 20,
    visibilityKm: 1.2,
    roadGrip: "mud_slippery",
    landslideRisk: "severe",
    summary: "Mud slush and active hill climb construction. Heavy truck slippage reported. Single-lane movement.",
    lastUpdated: "5 mins ago"
  },
  {
    id: "wx-sindhuli",
    name: "Sindhuli Gadhi Mountain Pass",
    nepaliName: "\u0938\u093F\u0928\u094D\u0927\u0941\u0932\u0940\u0917\u0922\u0940 \u092D\u091E\u094D\u091C\u094D\u092F\u093E\u0919",
    highwayCode: "H13",
    elevationM: 1100,
    lat: 27.2486,
    lng: 85.9186,
    tempC: 22,
    condition: "sunny",
    rainProbabilityPercent: 10,
    humidityPercent: 62,
    windSpeedKmh: 10,
    visibilityKm: 12,
    roadGrip: "dry_excellent",
    landslideRisk: "low",
    summary: "Clear mountain weather with excellent road grip. Safe hairpin climbing conditions.",
    lastUpdated: "15 mins ago"
  },
  {
    id: "wx-damauli",
    name: "Damauli - Tanahun Valley",
    nepaliName: "\u0926\u092E\u094C\u0932\u0940 \u0909\u092A\u0924\u094D\u092F\u0915\u093E",
    highwayCode: "H04",
    elevationM: 450,
    lat: 27.9733,
    lng: 84.2833,
    tempC: 28,
    condition: "cloudy",
    rainProbabilityPercent: 25,
    humidityPercent: 74,
    windSpeedKmh: 12,
    visibilityKm: 8,
    roadGrip: "dry_excellent",
    landslideRisk: "low",
    summary: "Overcast skies with dry road surface. Heavy dust generated by 4-lane construction machinery.",
    lastUpdated: "20 mins ago"
  },
  {
    id: "wx-siddhababa",
    name: "Siddhababa Rock Face (Palpa)",
    nepaliName: "\u0938\u093F\u0926\u094D\u0927\u092C\u093E\u092C\u093E \u0915\u094D\u0937\u0947\u0924\u094D\u0930",
    highwayCode: "H10",
    elevationM: 520,
    lat: 27.76,
    lng: 83.47,
    tempC: 25,
    condition: "thunderstorm",
    rainProbabilityPercent: 75,
    humidityPercent: 90,
    windSpeedKmh: 24,
    visibilityKm: 2,
    roadGrip: "wet_caution",
    landslideRisk: "high",
    summary: "Intermittent rock falls triggered by localized thunderstorm. Tunnel bypass sheds under construction.",
    lastUpdated: "10 mins ago"
  },
  {
    id: "wx-pokhara",
    name: "Pokhara Valley Entry",
    nepaliName: "\u092A\u094B\u0916\u0930\u093E \u0909\u092A\u0924\u094D\u092F\u0915\u093E",
    highwayCode: "H04 / H10",
    elevationM: 822,
    lat: 28.2096,
    lng: 83.9856,
    tempC: 24,
    condition: "sunny",
    rainProbabilityPercent: 15,
    humidityPercent: 68,
    windSpeedKmh: 8,
    visibilityKm: 15,
    roadGrip: "dry_excellent",
    landslideRisk: "low",
    summary: "Sunny with clear Annapurna mountain view. Pristine 6-lane urban highway conditions.",
    lastUpdated: "18 mins ago"
  },
  {
    id: "wx-narayanghat",
    name: "Narayanghat / Chitwan Plains",
    nepaliName: "\u0928\u093E\u0930\u093E\u092F\u0923\u0917\u0922 / \u092D\u0930\u0924\u092A\u0941\u0930",
    highwayCode: "H01 / H05",
    elevationM: 208,
    lat: 27.6833,
    lng: 84.4333,
    tempC: 31,
    condition: "sunny",
    rainProbabilityPercent: 20,
    humidityPercent: 70,
    windSpeedKmh: 11,
    visibilityKm: 10,
    roadGrip: "dry_excellent",
    landslideRisk: "low",
    summary: "Warm Terai plains weather. Clear asphalt driving along East-West highway.",
    lastUpdated: "25 mins ago"
  },
  {
    id: "wx-daman",
    name: "Daman Pass / Simbhanjyang Summit",
    nepaliName: "\u0926\u093E\u092E\u0928 / \u0938\u093F\u092E\u092D\u091E\u094D\u091C\u094D\u092F\u093E\u0919 \u0932\u0947\u0915",
    highwayCode: "H02 (Tribhuvan Byroad)",
    elevationM: 2322,
    lat: 27.6,
    lng: 85.05,
    tempC: 12,
    condition: "dense_fog",
    rainProbabilityPercent: 40,
    humidityPercent: 94,
    windSpeedKmh: 16,
    visibilityKm: 0.5,
    roadGrip: "fog_low_visibility",
    landslideRisk: "moderate",
    summary: "High altitude mountain fog and cool breeze at 2,322m summit. Reduced visibility on sharp hairpin bends.",
    lastUpdated: "10 mins ago"
  },
  {
    id: "wx-kande",
    name: "Kande Pass / Naudanda Ridge",
    nepaliName: "\u0915\u093E\u0901\u0921\u0947 \u092D\u091E\u094D\u091C\u094D\u092F\u093E\u0919 / \u0928\u094C\u0921\u093E\u0901\u0921\u093E",
    highwayCode: "H10 / Mid-Hill Highway",
    elevationM: 1770,
    lat: 28.272,
    lng: 83.82,
    tempC: 17,
    condition: "mountain_shower",
    rainProbabilityPercent: 55,
    humidityPercent: 86,
    windSpeedKmh: 12,
    visibilityKm: 5,
    roadGrip: "wet_caution",
    landslideRisk: "moderate",
    summary: "Gentle mountain drizzle along the Annapurna ridge pass. Good road grip with caution on downhill hairpins.",
    lastUpdated: "14 mins ago"
  },
  {
    id: "wx-khurkot",
    name: "Khurkot Sun Koshi Pass",
    nepaliName: "\u0916\u0941\u0930\u094D\u0915\u094B\u091F \u0938\u0941\u0928\u0915\u094B\u0936\u0940",
    highwayCode: "H13 (B.P. Highway)",
    elevationM: 480,
    lat: 27.34,
    lng: 85.99,
    tempC: 28,
    condition: "sunny",
    rainProbabilityPercent: 10,
    humidityPercent: 60,
    windSpeedKmh: 9,
    visibilityKm: 14,
    roadGrip: "dry_excellent",
    landslideRisk: "low",
    summary: "Warm river valley conditions. Pristine asphalt and smooth transit towards Sindhuli Gadhi and Terai.",
    lastUpdated: "16 mins ago"
  },
  {
    id: "wx-dhunche",
    name: "Dhunche High Mountain Pass",
    nepaliName: "\u0927\u0941\u0928\u094D\u091A\u0947 \u0909\u091A\u094D\u091A \u092A\u0939\u093E\u0921\u0940 \u0916\u0923\u094D\u0921",
    highwayCode: "NH03 (Pasang Lhamu)",
    elevationM: 1960,
    lat: 28.11,
    lng: 85.3,
    tempC: 15,
    condition: "rain_monsoon",
    rainProbabilityPercent: 85,
    humidityPercent: 96,
    windSpeedKmh: 22,
    visibilityKm: 1.5,
    roadGrip: "mud_slippery",
    landslideRisk: "severe",
    summary: "Heavy monsoon hillside runoff near Ramche cliff. 4WD vehicles recommended; DOR clearance excavators on standby.",
    lastUpdated: "6 mins ago"
  },
  {
    id: "wx-kalikot",
    name: "Kalikot Shubhakalika Gorge Pass",
    nepaliName: "\u0915\u093E\u0932\u093F\u0915\u094B\u091F \u0936\u0941\u092D\u0915\u093E\u0932\u093F\u0915\u093E \u0916\u0923\u094D\u0921",
    highwayCode: "H06 (Karnali Highway)",
    elevationM: 1450,
    lat: 29.14,
    lng: 81.6,
    tempC: 19,
    condition: "cloudy",
    rainProbabilityPercent: 30,
    humidityPercent: 72,
    windSpeedKmh: 15,
    visibilityKm: 6,
    roadGrip: "wet_caution",
    landslideRisk: "high",
    summary: "Narrow cliffside pass with loose stones. Exercise low-gear descent along the Karnali river corridor.",
    lastUpdated: "22 mins ago"
  },
  {
    id: "wx-jumla",
    name: "Chandannath Jumla Alpine Pass",
    nepaliName: "\u091A\u0928\u094D\u0926\u0928\u0928\u093E\u0925 \u091C\u0941\u092E\u094D\u0932\u093E \u0909\u091A\u094D\u091A \u0909\u092A\u0924\u094D\u092F\u0915\u093E",
    highwayCode: "H06 (Karnali Highway)",
    elevationM: 2514,
    lat: 29.2747,
    lng: 82.1838,
    tempC: 14,
    condition: "sunny",
    rainProbabilityPercent: 5,
    humidityPercent: 50,
    windSpeedKmh: 10,
    visibilityKm: 20,
    roadGrip: "dry_excellent",
    landslideRisk: "low",
    summary: "Crisp high-altitude Himalayan air in Jumla valley. Dry gravel and asphalt roads with clear visibility.",
    lastUpdated: "30 mins ago"
  }
];
var HIGHWAY_POIS = [
  {
    id: "poi-ev-mugling",
    name: "NEA DC Fast Charging Hub Mugling",
    nepaliName: "\u0935\u093F\u0926\u094D\u092F\u0941\u0924 \u092A\u094D\u0930\u093E\u0927\u093F\u0915\u0930\u0923 \u092B\u093E\u0938\u094D\u091F \u091A\u093E\u0930\u094D\u091C\u093F\u0919 \u092E\u0941\u0917\u094D\u0932\u093F\u0928",
    category: "ev_charger",
    highwayCode: "H04 / H05",
    locationName: "Mugling Junction Bus Park",
    lat: 27.8625,
    lng: 84.555,
    rating: 4.8,
    description: "Premier 24/7 dual-gun 60kW CCS2 / GB/T DC fast charging station operated by Nepal Electricity Authority. Restrooms and 24h eateries on site.",
    facilities: ["24/7 Open", "Washroom", "Dhaba Food", "Security", "Free Air"],
    contactNumber: "+977-56-540112",
    evSpecs: {
      powerKw: 60,
      plugs: ["CCS2 (60kW)", "GB/T (60kW)", "Type 2 (22kW)"],
      operator: "Nepal Electricity Authority (NEA)",
      availablePorts: 3,
      totalPorts: 4
    }
  },
  {
    id: "poi-ev-kurintar",
    name: "Tata Power / BYD Supercharger Kurintar",
    category: "ev_charger",
    highwayCode: "H04",
    locationName: "Kurintar Manakamana Cable Car Station",
    lat: 27.876,
    lng: 84.582,
    rating: 4.9,
    description: "High-speed 120kW twin gun DC station ideal for quick 20-minute top-ups during Kathmandu-Pokhara transit.",
    facilities: ["120kW Supercharger", "Cafeteria", "Clean Toilets", "Souvenirs", "Valet"],
    contactNumber: "+977-56-540055",
    evSpecs: {
      powerKw: 120,
      plugs: ["CCS2 Dual (120kW)", "Type 2 (22kW)"],
      operator: "Sipradi / BYD Nepal",
      availablePorts: 2,
      totalPorts: 2
    }
  },
  {
    id: "poi-ev-itahari",
    name: "NEA DC Fast Charging Station Itahari",
    category: "ev_charger",
    highwayCode: "H01",
    locationName: "Itahari Chowk East-West Highway",
    lat: 26.6645,
    lng: 87.2718,
    rating: 4.7,
    description: "Eastern Nepal primary 60kW DC fast charging hub with multiple CCS2 connectors for cross-country EV transit.",
    facilities: ["24/7 Open", "Well Lit", "Restroom", "Convenience Store"],
    contactNumber: "+977-25-580123",
    evSpecs: {
      powerKw: 60,
      plugs: ["CCS2 (60kW)", "GB/T (60kW)"],
      operator: "Nepal Electricity Authority (NEA)",
      availablePorts: 3,
      totalPorts: 3
    }
  },
  {
    id: "poi-ev-butwal",
    name: "NEA / BYD Fast Charging Hub Butwal",
    category: "ev_charger",
    highwayCode: "H03 / H08",
    locationName: "Traffic Chowk Butwal",
    lat: 27.7005,
    lng: 83.4485,
    rating: 4.8,
    description: "Western corridor 90kW high-output DC charging station servicing Lumbini and Terai highway travelers.",
    facilities: ["90kW DC", "Coffee Bar", "24/7 Security", "Air Pump"],
    contactNumber: "+977-71-540988",
    evSpecs: {
      powerKw: 90,
      plugs: ["CCS2 (90kW)", "GB/T (60kW)", "Type 2"],
      operator: "NEA & BYD Nepal",
      availablePorts: 2,
      totalPorts: 4
    }
  },
  {
    id: "poi-food-malekhu",
    name: "Malekhu Riverside Fish Dhabas",
    nepaliName: "\u092E\u0932\u0947\u0916\u0941 \u0924\u093E\u091C\u093E \u092E\u093E\u091B\u093E \u0939\u094B\u091F\u0932",
    category: "food_rest",
    highwayCode: "H04",
    locationName: "Malekhu Bridge (Dhading)",
    lat: 27.8228,
    lng: 84.8155,
    rating: 4.7,
    description: "Iconic Nepal highway culinary stop famous for fresh local Trishuli river fish curry, roasted machha, and organic dal-bhat.",
    facilities: ["Riverside Seating", "Ample Car Parking", "Fresh Fish", "Clean Washrooms", "Cold Drinks"],
    contactNumber: "+977-9841234567"
  },
  {
    id: "poi-food-mugling",
    name: "Mugling Highway Nepali Thakali Thali",
    nepaliName: "\u092E\u0941\u0917\u094D\u0932\u093F\u0928 \u0925\u0915\u093E\u0932\u0940 \u092D\u093E\u0928\u094D\u0938\u093E \u0918\u0930",
    category: "food_rest",
    highwayCode: "H04",
    locationName: "Mugling Highway Center",
    lat: 27.861,
    lng: 84.5535,
    rating: 4.6,
    description: "Authentic Mustang Thakali ghee dal bhat served with mountain jimbu, black lentils, gundruk, and timur spicy chutney.",
    facilities: ["Fast Service", "Thakali Set", "Card Payment", "Parking", "Mineral Water"]
  },
  {
    id: "poi-fuel-naubise",
    name: "NOC Smart Petrol Pump & Service Naubise",
    nepaliName: "\u0928\u0947\u092A\u093E\u0932 \u0906\u092F\u0932 \u0928\u093F\u0917\u092E \u0928\u094C\u092C\u093F\u0938\u0947",
    category: "fuel_station",
    highwayCode: "H02 / H04",
    locationName: "Naubise Highway Entry",
    lat: 27.721,
    lng: 85.177,
    rating: 4.5,
    description: "24/7 computerized dispensing pumps with nitrogen tyre inflation, automated car wash bay, and clean public restrooms.",
    facilities: ["24/7 Fuel", "Nitrogen Air", "Car Wash", "Automated POS", "ATM"],
    fuelSpecs: {
      petrolAvailable: true,
      dieselAvailable: true,
      airPumpAvailable: true,
      open24Hours: true
    }
  },
  {
    id: "poi-scenic-sindhuli",
    name: "Sindhuli Gadhi Historic Ridge Viewpoint",
    nepaliName: "\u0938\u093F\u0928\u094D\u0927\u0941\u0932\u0940\u0917\u0922\u0940 \u0910\u0924\u093F\u0939\u093E\u0938\u093F\u0915 \u092D\u094D\u092F\u0942 \u092A\u094D\u0935\u093E\u0907\u0928\u094D\u091F",
    category: "scenic_pass",
    highwayCode: "H13",
    locationName: "Sindhuli Gadhi Crest (1,100m)",
    lat: 27.2486,
    lng: 85.9186,
    rating: 4.9,
    description: "Breathtaking panoramic overlook of the Mahabharat range and winding serpentine B.P. Highway curves. Historical Anglo-Nepal war fort museum.",
    facilities: ["Panoramic Vista", "Photo Deck", "Tea Stalls", "Historical Fort Museum", "Parking Area"]
  },
  {
    id: "poi-scenic-nagdhunga",
    name: "Nagdhunga Sisne Khola Valley Overlook",
    nepaliName: "\u0928\u093E\u0917\u0922\u0941\u0902\u0917\u093E \u0909\u092A\u0924\u094D\u092F\u0915\u093E \u0926\u0943\u0936\u094D\u092F",
    category: "scenic_pass",
    highwayCode: "H04",
    locationName: "Nagdhunga Tunnel Exit Point",
    lat: 27.701,
    lng: 85.195,
    rating: 4.6,
    description: "Stunning viewpoint overlooking the Dhading valley hills, Nagdhunga tunnel portal viaduct, and Chandragiri ridge.",
    facilities: ["Viaduct View", "Fresh Tea", "Vehicle Pullout Bay"]
  },
  {
    id: "poi-dor-bharatpur",
    name: "DOR Heavy Equipment & Emergency Rescue Depot",
    nepaliName: "\u0938\u0921\u0915 \u0921\u093F\u092D\u093F\u091C\u0928 \u092D\u0930\u0924\u092A\u0941\u0930 \u0906\u092A\u0924\u094D\u0915\u093E\u0932\u0940\u0928 \u0936\u093E\u0916\u093E",
    category: "emergency_dor",
    highwayCode: "H04 / H05 / H01",
    locationName: "Dasdhunga, Chitwan",
    lat: 27.75,
    lng: 84.48,
    rating: 4.9,
    description: "Department of Roads rapid deployment station housing hydraulic rock excavators, heavy cranes, wheel loaders, and towing rigs for landslide response.",
    facilities: ["24/7 Highway Rescue", "Heavy Tow Crane", "First Aid Station", "Ambulance Hotline"],
    contactNumber: "+977-56-520144 / Hotline: 103"
  },
  {
    id: "poi-toll-nagdhunga",
    name: "Nagdhunga Tunnel Expressway Toll Plaza",
    nepaliName: "\u0928\u093E\u0917\u0922\u0941\u0902\u0917\u093E \u0938\u0941\u0930\u0941\u0919\u092E\u093E\u0930\u094D\u0917 \u091F\u094B\u0932 \u092A\u094D\u0932\u093E\u091C\u093E",
    category: "toll_plaza",
    highwayCode: "H04",
    locationName: "Sisne Khola Portal (Dhading side)",
    lat: 27.705,
    lng: 85.188,
    rating: 4.4,
    description: "State-of-the-art automated RFID FASTag / QR toll payment system for Nepal\u2019s first national highway tunnel bypass.",
    facilities: ["FASTag RFID", "QR Payment", "Emergency Lane", "Information Desk"],
    tollFeeNpr: {
      bike: 25,
      car: 70,
      bus_truck: 150
    }
  }
];
var TRAFFIC_CORRIDORS = [
  {
    id: "tr-daunne",
    name: "Daunne Hill Chokepoint (H01)",
    highwayCode: "H01",
    section: "Daunne East - Daunne West (14 km)",
    level: "standstill",
    avgSpeedKmh: 12,
    normalSpeedKmh: 45,
    delayMinutes: 55,
    cause: "Single-lane alternating traffic due to heavy monsoon mud clearing and Asian Development Bank 4-lane widening slope excavation.",
    lastUpdated: "6 mins ago",
    startCoord: [27.55, 83.78],
    endCoord: [27.57, 83.85],
    trends: HISTORICAL_CORRIDOR_TRENDS["tr-daunne"]
  },
  {
    id: "tr-mugling-abukhaireni",
    name: "Mugling - Abukhaireni Widening (H04)",
    highwayCode: "H04",
    section: "Marshyangdi Bridge to Abukhaireni Bazar (12 km)",
    level: "heavy",
    avgSpeedKmh: 20,
    normalSpeedKmh: 50,
    delayMinutes: 30,
    cause: "Pavement upgrading, heavy dump truck movement, and periodic 20-minute road stoppages for rock cutting.",
    lastUpdated: "12 mins ago",
    startCoord: [27.8617, 84.5542],
    endCoord: [27.91, 84.45],
    trends: HISTORICAL_CORRIDOR_TRENDS["tr-mugling-abukhaireni"]
  },
  {
    id: "tr-nagdhunga",
    name: "Nagdhunga Inbound Checkpost (H02 / H04)",
    highwayCode: "H02",
    section: "Khanikhola - Nagdhunga Summit (8 km)",
    level: "moderate",
    avgSpeedKmh: 25,
    normalSpeedKmh: 40,
    delayMinutes: 18,
    cause: "Heavy freight truck slow hill climb and security checkpost queue at valley entrance.",
    lastUpdated: "15 mins ago",
    startCoord: [27.7214, 85.1764],
    endCoord: [27.698, 85.201],
    trends: HISTORICAL_CORRIDOR_TRENDS["tr-nagdhunga"]
  },
  {
    id: "tr-narayanghat-mugling",
    name: "Narayanghat - Mugling Trishuli Gorge (H05)",
    highwayCode: "H05",
    section: "Aaptari (Bharatpur) to Mugling Bridge (36 km)",
    level: "heavy",
    avgSpeedKmh: 28,
    normalSpeedKmh: 55,
    delayMinutes: 35,
    cause: "Tuin Khola bridge construction cliff works, heavy trucks on river curves, and landslide clearance machinery.",
    lastUpdated: "8 mins ago",
    startCoord: [27.7, 84.43],
    endCoord: [27.86, 84.55],
    trends: HISTORICAL_CORRIDOR_TRENDS["tr-narayanghat-mugling"]
  },
  {
    id: "tr-siddhababa",
    name: "Siddhababa Rock Shed Zone (H10)",
    highwayCode: "H10",
    section: "Chidiya Khola - Dobhan (6 km)",
    level: "moderate",
    avgSpeedKmh: 22,
    normalSpeedKmh: 45,
    delayMinutes: 15,
    cause: "Concrete rock-shed shelter tunnel construction works. Caution: Speed restricted to 20 km/h.",
    lastUpdated: "20 mins ago",
    startCoord: [27.74, 83.46],
    endCoord: [27.78, 83.49],
    trends: HISTORICAL_CORRIDOR_TRENDS["tr-siddhababa"]
  },
  {
    id: "tr-sindhuli-bp",
    name: "Sindhuli Gadhi Serpentine Ridge (H13)",
    highwayCode: "H13",
    section: "Nepalthok to Sindhuli Madi (42 km)",
    level: "moderate",
    avgSpeedKmh: 32,
    normalSpeedKmh: 45,
    delayMinutes: 20,
    cause: "Narrow mountain switchbacks with slow hill microbuses and photographic stop congestion near ridge crest.",
    lastUpdated: "25 mins ago",
    startCoord: [27.42, 85.88],
    endCoord: [27.24, 85.92],
    trends: HISTORICAL_CORRIDOR_TRENDS["tr-sindhuli-bp"]
  },
  {
    id: "tr-chitwan-express",
    name: "Narayanghat - Butwal Plains (H01)",
    highwayCode: "H01",
    section: "Kawasoti to Bardaghat (32 km)",
    level: "smooth",
    avgSpeedKmh: 68,
    normalSpeedKmh: 70,
    delayMinutes: 0,
    cause: "Newly completed 4-lane asphalt section with smooth free-flow traffic.",
    lastUpdated: "10 mins ago",
    startCoord: [27.6, 84.1],
    endCoord: [27.58, 83.75],
    trends: HISTORICAL_CORRIDOR_TRENDS["tr-chitwan-express"]
  }
];

// src/data/accidentBlackspotsData.ts
var NEPAL_HIGHWAY_BLACKSPOTS = [
  {
    id: "bs-nagdhunga-descent",
    name: "Nagdhunga - Khani Khola Descent",
    highwayCode: "H02/H04",
    chainageOrLocation: "Ch. 12+500 (Dhading / Kathmandu border)",
    riskLevel: "high",
    primaryCause: "Steep continuous downhill gradient (-480m descent), heavy multi-axle freight brake overheating/fade, acute hairpin curves",
    annualAccidentStats: "~72 collisions & rollovers per year",
    safeDrivingAdvice: "Engage low gear (2nd gear engine braking). Avoid continuous riding of foot brakes. Maintain 30m following distance.",
    coordinates: [27.702, 85.201]
  },
  {
    id: "bs-jogimara-curves",
    name: "Jogimara & Benighat Trishuli S-Bends",
    highwayCode: "H04",
    chainageOrLocation: "Ch. 64+200 (Dhading)",
    riskLevel: "high",
    primaryCause: "Narrow Trishuli river canyon cliffside curves, reduced skid resistance on wet asphalt, speeding microbuses overtaking on blind corners",
    annualAccidentStats: "~54 incidents annually (high fatality index)",
    safeDrivingAdvice: "Sound horn before blind turns. Keep headlights on in canyon shadows. Obey 35 km/h advisory speed limit.",
    coordinates: [27.8423, 84.7155]
  },
  {
    id: "bs-charkilo-jalbire",
    name: "Charkilo & Jalbire Gorge Chutes",
    highwayCode: "H05",
    chainageOrLocation: "Narayanghat-Mugling Ch. 18+400 to 22+100",
    riskLevel: "critical",
    primaryCause: "Active overhead unstable rock slopes, sudden rockfalls, blind river bend at Jalbire bridge, heavy overnight commercial vehicle flow",
    annualAccidentStats: "~95 incidents / rockfall stoppages annually",
    safeDrivingAdvice: "Avoid stopping under overhangs. Observe DOR rockfall netting zones. Do not overtake heavy vehicles on gorge bridges.",
    coordinates: [27.8102, 84.502]
  },
  {
    id: "bs-siddhababa-cliff",
    name: "Siddhababa Rockfall Zone (Butwal-Palpa)",
    highwayCode: "H10",
    chainageOrLocation: "Siddhartha Highway Ch. 4+000 (Dobhan)",
    riskLevel: "critical",
    primaryCause: "Vertical fragile shale cliffs prone to continuous rock-slide debris, acute switchback gorge without guardrails in older sections",
    annualAccidentStats: "~84 incidents annually",
    safeDrivingAdvice: "Strictly observe rock-shed protection tunnel bypass. Avoid transit during active rainfall or high winds.",
    coordinates: [27.765, 83.512]
  },
  {
    id: "bs-daunne-hill-pass",
    name: "Daunne Hill Hairpin Pass",
    highwayCode: "H01",
    chainageOrLocation: "Mahendra Highway Ch. 210 (Bardaghat-Dumkibas)",
    riskLevel: "high",
    primaryCause: "Steep hill ascent with 18 consecutive blind switchbacks, frequent breakdown of heavy trailers causing sudden lane obstructions",
    annualAccidentStats: "~68 incidents and vehicle jack-knifes annually",
    safeDrivingAdvice: "Never overtake on inner curve radii. Yield to uphill climbing trucks. Keep safe clearance on shoulder edges.",
    coordinates: [27.57, 83.85]
  },
  {
    id: "bs-byas-tanahun-widening",
    name: "Byas - Ghansikuwa Widening Detours",
    highwayCode: "H04",
    chainageOrLocation: "Prithvi Highway Ch. 112+000 (Damauli section)",
    riskLevel: "moderate",
    primaryCause: "Active 4-lane Asian Development Bank roadbed expansion, loose crushed stone gravel, sudden elevation steps between old & new asphalt",
    annualAccidentStats: "~48 minor/moderate collisions & two-wheeler skids",
    safeDrivingAdvice: "Reduce speed on unpaved bypasses. Watch for flag-bearers and temporary single-lane alternating signals.",
    coordinates: [27.945, 84.34]
  },
  {
    id: "bs-sindhuli-hairpins",
    name: "Sindhuli Gadhi Switchbacks (BP Highway)",
    highwayCode: "H13",
    chainageOrLocation: "BP Highway Ch. 78+000 (Khurkot-Sindhuli)",
    riskLevel: "high",
    primaryCause: "Extremely tight radius turns designed for light vehicles, blind mountain crests, severe consequences of lane drifting on cliff edge",
    annualAccidentStats: "~42 rollover/off-road incidents annually",
    safeDrivingAdvice: "Strict 25 km/h limit on hairpin loops. Heavy multi-axle freight vehicles prohibited. Keep strictly to the left lane.",
    coordinates: [27.2486, 85.9186]
  },
  {
    id: "bs-koteshwor-express-merge",
    name: "Koteshwor - Jadibuti Urban Fast Corridor",
    highwayCode: "H03",
    chainageOrLocation: "Araniko Highway Ch. 3+200 (Kathmandu entry)",
    riskLevel: "moderate",
    primaryCause: "High speed differentials between 6-lane express traffic and local service lane cross traffic, frequent pedestrian crossing conflicts",
    annualAccidentStats: "~38 urban traffic collisions per year",
    safeDrivingAdvice: "Observe 50 km/h urban limit. Check blind spots carefully before merging into express lanes.",
    coordinates: [27.677, 85.352]
  }
];
var CORRIDOR_SAFETY_PROFILES = {
  "ktm-nbz": {
    edgeKey: "ktm-nbz",
    baseAccidentRisk: "high",
    annualIncidents: 72,
    roadQualityScore: 88,
    hazardFactors: ["Steep downhill slope (-480m)", "Heavy freight truck brake fade", "Nagdhunga hairpin switchbacks"],
    recommendedSpeedKmh: 35,
    blackspotId: "bs-nagdhunga-descent"
  },
  "nbz-mgl": {
    edgeKey: "nbz-mgl",
    baseAccidentRisk: "high",
    annualIncidents: 56,
    roadQualityScore: 74,
    hazardFactors: ["Trishuli River gorge cliff drops", "Jogimara blind S-curves", "Wet surface hydroplaning"],
    recommendedSpeedKmh: 45,
    blackspotId: "bs-jogimara-curves"
  },
  "mgl-dml": {
    edgeKey: "mgl-dml",
    baseAccidentRisk: "moderate",
    annualIncidents: 48,
    roadQualityScore: 52,
    hazardFactors: ["Active 4-lane widening construction", "Loose gravel & sudden dips", "Single-lane detours"],
    recommendedSpeedKmh: 30,
    blackspotId: "bs-byas-tanahun-widening"
  },
  "dml-pkr": {
    edgeKey: "dml-pkr",
    baseAccidentRisk: "low",
    annualIncidents: 14,
    roadQualityScore: 94,
    hazardFactors: ["Newly upgraded 4-lane divided asphalt", "Minor local livestock/pedestrian crossings"],
    recommendedSpeedKmh: 65
  },
  "mgl-cht": {
    edgeKey: "mgl-cht",
    baseAccidentRisk: "critical",
    annualIncidents: 95,
    roadQualityScore: 78,
    hazardFactors: ["Charkilo & Jalbire rockfall chutes", "Trishuli river gorge depth", "Heavy night freight/tourist bus flow"],
    recommendedSpeedKmh: 40,
    blackspotId: "bs-charkilo-jalbire"
  },
  "cht-htd": {
    edgeKey: "cht-htd",
    baseAccidentRisk: "moderate",
    annualIncidents: 32,
    roadQualityScore: 86,
    hazardFactors: ["Chitwan wildlife buffer zone crossings", "High-speed Terai straightaways", "Winter morning fog"],
    recommendedSpeedKmh: 70
  },
  "htd-brg": {
    edgeKey: "htd-brg",
    baseAccidentRisk: "moderate",
    annualIncidents: 28,
    roadQualityScore: 82,
    hazardFactors: ["Industrial container traffic", "Slow agricultural tractors on shoulder"],
    recommendedSpeedKmh: 60
  },
  "htd-ktm": {
    edgeKey: "htd-ktm",
    baseAccidentRisk: "high",
    annualIncidents: 60,
    roadQualityScore: 68,
    hazardFactors: ["Simbhanjyang Pass (2,488m) altitude", "Chisapani acute switchbacks", "Dense fog & frost in winter"],
    recommendedSpeedKmh: 30
  },
  "cht-btl": {
    edgeKey: "cht-btl",
    baseAccidentRisk: "high",
    annualIncidents: 68,
    roadQualityScore: 72,
    hazardFactors: ["Daunne hill pass hairpins (18 curves)", "Overloaded truck breakdowns", "Loose unpaved shoulder"],
    recommendedSpeedKmh: 40,
    blackspotId: "bs-daunne-hill-pass"
  },
  "btl-bhr": {
    edgeKey: "btl-bhr",
    baseAccidentRisk: "low",
    annualIncidents: 16,
    roadQualityScore: 92,
    hazardFactors: ["6-lane divided express highway", "U-turn crossing points"],
    recommendedSpeedKmh: 75
  },
  "btl-plp": {
    edgeKey: "btl-plp",
    baseAccidentRisk: "critical",
    annualIncidents: 84,
    roadQualityScore: 64,
    hazardFactors: ["Siddhababa vertical shale rockfalls", "Blind river canyon turns", "Tinau river cliff edge"],
    recommendedSpeedKmh: 30,
    blackspotId: "bs-siddhababa-cliff"
  },
  "plp-pkr": {
    edgeKey: "plp-pkr",
    baseAccidentRisk: "moderate",
    annualIncidents: 36,
    roadQualityScore: 76,
    hazardFactors: ["Winding hilly topography", "Rambha & Waling hill curves"],
    recommendedSpeedKmh: 45
  },
  "ktm-dhk": {
    edgeKey: "ktm-dhk",
    baseAccidentRisk: "low",
    annualIncidents: 22,
    roadQualityScore: 92,
    hazardFactors: ["Suryabinayak - Dhulikhel 6-lane/4-lane highway", "Pedestrian zebra crossings"],
    recommendedSpeedKmh: 60,
    blackspotId: "bs-koteshwor-express-merge"
  },
  "dhk-sdh": {
    edgeKey: "dhk-sdh",
    baseAccidentRisk: "high",
    annualIncidents: 44,
    roadQualityScore: 84,
    hazardFactors: ["Extremely narrow single/1.5-lane mountain road", "Continuous 180\xB0 switchback hairpins", "Steep drop-offs into Sun Koshi basin"],
    recommendedSpeedKmh: 30,
    blackspotId: "bs-sindhuli-hairpins"
  },
  "sdh-brd": {
    edgeKey: "sdh-brd",
    baseAccidentRisk: "moderate",
    annualIncidents: 26,
    roadQualityScore: 88,
    hazardFactors: ["Sindhuli plain descent", "Occasional livestock crossings"],
    recommendedSpeedKmh: 55
  },
  "brd-jnk": {
    edgeKey: "brd-jnk",
    baseAccidentRisk: "low",
    annualIncidents: 18,
    roadQualityScore: 90,
    hazardFactors: ["Flat Terai agricultural highway", "Motorcycle and e-rickshaw traffic"],
    recommendedSpeedKmh: 65
  },
  "brd-brt": {
    edgeKey: "brd-brt",
    baseAccidentRisk: "moderate",
    annualIncidents: 38,
    roadQualityScore: 85,
    hazardFactors: ["High-speed Koshi Barrage section", "Sunsari market bottlenecks"],
    recommendedSpeedKmh: 70
  },
  "brt-dhr": {
    edgeKey: "brt-dhr",
    baseAccidentRisk: "low",
    annualIncidents: 15,
    roadQualityScore: 92,
    hazardFactors: ["6-lane trade corridor", "Urban junction signals"],
    recommendedSpeedKmh: 65
  },
  "brt-kkr": {
    edgeKey: "brt-kkr",
    baseAccidentRisk: "low",
    annualIncidents: 20,
    roadQualityScore: 91,
    hazardFactors: ["Straight Asian Highway 2 (AH2) standard", "Intersection merges in Damak/Birtamod"],
    recommendedSpeedKmh: 75
  }
};

// src/utils/safetyIndexCalculator.ts
var SAFETY_TIER_COLORS = {
  high: "#10b981",
  // Emerald Green (Score 80 - 100)
  moderate: "#f59e0b",
  // Amber Yellow (Score 60 - 79)
  elevated_risk: "#f97316",
  // Vibrant Orange (Score 40 - 59)
  high_hazard: "#ef4444"
  // Crimson Red (Score < 40)
};
function calculateSegmentSafety(params) {
  const { fromId, toId, fromName, toName, highwayCode, highwayName, distanceKm, surface, status, elevationGainM, coordinates } = params;
  const edgeKey1 = `${fromId}-${toId}`;
  const edgeKey2 = `${toId}-${fromId}`;
  const profile = CORRIDOR_SAFETY_PROFILES[edgeKey1] || CORRIDOR_SAFETY_PROFILES[edgeKey2];
  let baseRoadQuality = 80;
  if (surface === "asphalt_excellent") baseRoadQuality = 96;
  else if (surface === "blacktopped_fair") baseRoadQuality = 78;
  else if (surface === "under_construction") baseRoadQuality = 48;
  else if (surface === "gravel") baseRoadQuality = 55;
  else if (surface === "offroad_mud") baseRoadQuality = 32;
  if (status === "caution") baseRoadQuality *= 0.84;
  else if (status === "obstructed") baseRoadQuality *= 0.55;
  else if (status === "closed") baseRoadQuality *= 0.15;
  const roadQualityScore = profile?.roadQualityScore ? Math.round(profile.roadQualityScore * (status === "caution" ? 0.9 : 1)) : Math.round(baseRoadQuality);
  let accidentRiskLevel = profile?.baseAccidentRisk || "moderate";
  let annualAccidentIncidents = profile?.annualIncidents || 35;
  let accidentSafetyComponent = 75;
  if (accidentRiskLevel === "low") accidentSafetyComponent = 94;
  else if (accidentRiskLevel === "moderate") accidentSafetyComponent = 74;
  else if (accidentRiskLevel === "high") accidentSafetyComponent = 46;
  else if (accidentRiskLevel === "critical") accidentSafetyComponent = 26;
  let terrainPenalty = 0;
  if (Math.abs(elevationGainM) > 400) {
    terrainPenalty = 8;
  }
  let rawSafetyScore = Math.round(
    roadQualityScore * 0.45 + accidentSafetyComponent * 0.45 + (status === "clear" ? 10 : status === "caution" ? 4 : 0) - terrainPenalty
  );
  const safetyScore = Math.max(15, Math.min(99, rawSafetyScore));
  let safetyTier = "high";
  if (safetyScore >= 80) safetyTier = "high";
  else if (safetyScore >= 60) safetyTier = "moderate";
  else if (safetyScore >= 42) safetyTier = "elevated_risk";
  else safetyTier = "high_hazard";
  let blackspotName;
  if (profile?.blackspotId) {
    const bs = NEPAL_HIGHWAY_BLACKSPOTS.find((b) => b.id === profile.blackspotId);
    if (bs) blackspotName = bs.name;
  }
  const hazardFactors = profile?.hazardFactors || [
    status === "caution" ? "Active single-lane highway caution" : "General mountain highway gradient",
    surface === "under_construction" ? "Loose gravel & unpaved work zone" : "Two-way single carriageway without median"
  ];
  const recommendedSpeedKmh = profile?.recommendedSpeedKmh || (safetyScore >= 80 ? 65 : safetyScore >= 60 ? 45 : 30);
  return {
    segmentId: `seg-${fromId}-${toId}-${highwayCode}`,
    fromName,
    toName,
    highwayCode,
    highwayName,
    distanceKm,
    safetyScore,
    safetyTier,
    color: SAFETY_TIER_COLORS[safetyTier],
    roadQualityScore,
    accidentRiskLevel,
    annualAccidentIncidents,
    hazardFactors,
    recommendedSpeedKmh,
    blackspotName,
    coordinates
  };
}
function calculateRouteSafetyIndex(segmentsSafety, totalDistanceKm) {
  if (!segmentsSafety || segmentsSafety.length === 0 || totalDistanceKm <= 0) {
    return {
      overallScore: 80,
      safetyTier: "high",
      tierLabel: "Safe Corridor",
      color: SAFETY_TIER_COLORS.high,
      roadQualityAverage: 85,
      accidentRiskSummary: {
        safeKm: 0,
        moderateKm: 0,
        elevatedRiskKm: 0,
        highHazardKm: 0,
        safePercentage: 100
      },
      totalHistoricalAnnualAccidents: 0,
      activeBlackspots: [],
      segmentBreakdown: [],
      keySafetyDirectives: ["Maintain safe following distance."]
    };
  }
  let weightedSafetyScoreSum = 0;
  let weightedQualityScoreSum = 0;
  let totalHistoricalAnnualAccidents = 0;
  let safeKm = 0;
  let moderateKm = 0;
  let elevatedRiskKm = 0;
  let highHazardKm = 0;
  segmentsSafety.forEach((seg) => {
    weightedSafetyScoreSum += seg.safetyScore * seg.distanceKm;
    weightedQualityScoreSum += seg.roadQualityScore * seg.distanceKm;
    totalHistoricalAnnualAccidents += seg.annualAccidentIncidents;
    if (seg.safetyTier === "high") safeKm += seg.distanceKm;
    else if (seg.safetyTier === "moderate") moderateKm += seg.distanceKm;
    else if (seg.safetyTier === "elevated_risk") elevatedRiskKm += seg.distanceKm;
    else highHazardKm += seg.distanceKm;
  });
  const overallScore = Math.round(weightedSafetyScoreSum / totalDistanceKm);
  const roadQualityAverage = Math.round(weightedQualityScoreSum / totalDistanceKm);
  const safePercentage = Math.round(safeKm / totalDistanceKm * 100);
  let safetyTier = "high";
  let tierLabel = "Optimal Safety & Well-Maintained";
  if (overallScore >= 80) {
    safetyTier = "high";
    tierLabel = "Safe Corridor (Divided / Low Accident Risk)";
  } else if (overallScore >= 60) {
    safetyTier = "moderate";
    tierLabel = "Moderate Caution (Mountain Slopes & Curves)";
  } else if (overallScore >= 42) {
    safetyTier = "elevated_risk";
    tierLabel = "Elevated Risk (Widening / Canyon Cliffs)";
  } else {
    safetyTier = "high_hazard";
    tierLabel = "High Hazard Corridor (Known Blackspots / Heavy Freight)";
  }
  const activeBlackspots = [];
  const highwayCodesOnPath = Array.from(new Set(segmentsSafety.map((s) => s.highwayCode.split("/")[0])));
  NEPAL_HIGHWAY_BLACKSPOTS.forEach((bs) => {
    if (highwayCodesOnPath.some((c) => bs.highwayCode.includes(c))) {
      activeBlackspots.push(bs);
    }
  });
  const keySafetyDirectives = [];
  if (highHazardKm > 0 || activeBlackspots.length > 0) {
    keySafetyDirectives.push("Sound horn before all blind canyon curves; avoid overtaking on unbanked switchbacks.");
  }
  if (elevatedRiskKm > 0) {
    keySafetyDirectives.push("Reduce speed by 15-20 km/h in gravel and active widening zones (Tanahun/Mugling corridor).");
  }
  keySafetyDirectives.push("Use engine braking (2nd/3rd gear) on steep descents to prevent brake shoe overheating.");
  if (totalHistoricalAnnualAccidents > 100) {
    keySafetyDirectives.push("High-density night commercial traffic corridor: keep low-beam fog lights on during dawn/dusk hours.");
  }
  return {
    overallScore,
    safetyTier,
    tierLabel,
    color: SAFETY_TIER_COLORS[safetyTier],
    roadQualityAverage,
    accidentRiskSummary: {
      safeKm,
      moderateKm,
      elevatedRiskKm,
      highHazardKm,
      safePercentage
    },
    totalHistoricalAnnualAccidents,
    activeBlackspots,
    segmentBreakdown: segmentsSafety,
    keySafetyDirectives
  };
}

// src/utils/routeOptimizer.ts
var ROAD_NETWORK_EDGES = [
  // KTM to Naubise (H02 / H04 entry)
  {
    fromId: "ktm",
    toId: "nbz",
    distanceKm: 26,
    baseTimeMinutes: 45,
    highwayCode: "H02/H04",
    highwayName: "Nagdhunga Corridor",
    surface: "asphalt_excellent",
    status: "clear",
    elevationGain: -480,
    intermediateCoords: [[27.7172, 85.324], [27.702, 85.201], [27.7214, 85.1764]]
  },
  // Naubise to Mugling (H04 Prithvi Highway)
  {
    fromId: "nbz",
    toId: "mgl",
    distanceKm: 88,
    baseTimeMinutes: 135,
    highwayCode: "H04",
    highwayName: "Prithvi Highway",
    surface: "blacktopped_fair",
    status: "caution",
    elevationGain: -645,
    intermediateCoords: [[27.7214, 85.1764], [27.8105, 84.9754], [27.8228, 84.8155], [27.8423, 84.7155], [27.8617, 84.5542]]
  },
  // Mugling to Damauli (H04)
  {
    fromId: "mgl",
    toId: "dml",
    distanceKm: 44,
    baseTimeMinutes: 75,
    highwayCode: "H04",
    highwayName: "Prithvi Highway (Tanahun)",
    surface: "under_construction",
    status: "caution",
    elevationGain: 175,
    intermediateCoords: [[27.8617, 84.5542], [27.9142, 84.4223], [27.9733, 84.2833]]
  },
  // Damauli to Pokhara (H04)
  {
    fromId: "dml",
    toId: "pkr",
    distanceKm: 42,
    baseTimeMinutes: 55,
    highwayCode: "H04",
    highwayName: "Prithvi Highway (Pokhara entry)",
    surface: "asphalt_excellent",
    status: "clear",
    elevationGain: 372,
    intermediateCoords: [[27.9733, 84.2833], [28.0833, 84.1432], [28.2096, 83.9856]]
  },
  // Mugling to Narayanghat (H05)
  {
    fromId: "mgl",
    toId: "cht",
    distanceKm: 36,
    baseTimeMinutes: 50,
    highwayCode: "H05",
    highwayName: "Narayanghat-Mugling Road",
    surface: "asphalt_excellent",
    status: "caution",
    elevationGain: -67,
    intermediateCoords: [[27.8617, 84.5542], [27.8102, 84.502], [27.765, 84.475], [27.6833, 84.4333]]
  },
  // Narayanghat to Hetauda (H01 Mahendra Highway)
  {
    fromId: "cht",
    toId: "htd",
    distanceKm: 76,
    baseTimeMinutes: 80,
    highwayCode: "H01",
    highwayName: "Mahendra Highway (Chitwan-Makwanpur)",
    surface: "asphalt_excellent",
    status: "clear",
    elevationGain: 252,
    intermediateCoords: [[27.6833, 84.4333], [27.57, 84.75], [27.4285, 85.0331]]
  },
  // Hetauda to Birgunj (H02 Tribhuvan Highway)
  {
    fromId: "htd",
    toId: "brg",
    distanceKm: 54,
    baseTimeMinutes: 55,
    highwayCode: "H02",
    highwayName: "Tribhuvan Highway (Terai Section)",
    surface: "asphalt_excellent",
    status: "clear",
    elevationGain: -370,
    intermediateCoords: [[27.4285, 85.0331], [27.18, 84.99], [27.0128, 84.8774]]
  },
  // Naubise to Hetauda via Daman (H02 Mountain Byroad)
  {
    fromId: "nbz",
    toId: "htd",
    distanceKm: 106,
    baseTimeMinutes: 200,
    highwayCode: "H02",
    highwayName: "Tribhuvan Highway (Daman Pass)",
    surface: "blacktopped_fair",
    status: "clear",
    elevationGain: 1402,
    intermediateCoords: [[27.7214, 85.1764], [27.6, 85.05], [27.4285, 85.0331]]
  },
  // Narayanghat to Butwal via Daunne Pass (H01)
  {
    fromId: "cht",
    toId: "btl",
    distanceKm: 114,
    baseTimeMinutes: 195,
    highwayCode: "H01",
    highwayName: "Mahendra Highway (Daunne Section)",
    surface: "under_construction",
    status: "caution",
    elevationGain: 12,
    intermediateCoords: [[27.6833, 84.4333], [27.53, 83.89], [27.7006, 83.4484]]
  },
  // Butwal to Bhairahawa / Sunauli (H10 Siddhartha Highway)
  {
    fromId: "btl",
    toId: "bhr",
    distanceKm: 22,
    baseTimeMinutes: 25,
    highwayCode: "H10",
    highwayName: "Siddhartha Highway (6-Lane Corridor)",
    surface: "asphalt_excellent",
    status: "clear",
    elevationGain: -115,
    intermediateCoords: [[27.7006, 83.4484], [27.6, 83.45], [27.5045, 83.4503]]
  },
  // Butwal to Palpa Tansen (H10)
  {
    fromId: "btl",
    toId: "plp",
    distanceKm: 39,
    baseTimeMinutes: 60,
    highwayCode: "H10",
    highwayName: "Siddhartha Highway (Siddhababa section)",
    surface: "blacktopped_fair",
    status: "caution",
    elevationGain: 1130,
    intermediateCoords: [[27.7006, 83.4484], [27.78, 83.49], [27.8683, 83.5489]]
  },
  // Palpa Tansen to Pokhara (H10)
  {
    fromId: "plp",
    toId: "pkr",
    distanceKm: 120,
    baseTimeMinutes: 170,
    highwayCode: "H10",
    highwayName: "Siddhartha Highway (Syangja section)",
    surface: "asphalt_excellent",
    status: "clear",
    elevationGain: -528,
    intermediateCoords: [[27.8683, 83.5489], [27.98, 83.77], [28.2096, 83.9856]]
  },
  // Pokhara to Baglung (H15 Mid-Hill Highway)
  {
    fromId: "pkr",
    toId: "bgl",
    distanceKm: 72,
    baseTimeMinutes: 95,
    highwayCode: "H15",
    highwayName: "Mid-Hill Highway (Pokhara-Baglung)",
    surface: "asphalt_excellent",
    status: "clear",
    elevationGain: 198,
    intermediateCoords: [[28.2096, 83.9856], [28.25, 83.75], [28.2725, 83.6006]]
  },
  // KTM to Dhulikhel (H03 Araniko)
  {
    fromId: "ktm",
    toId: "dhk",
    distanceKm: 30,
    baseTimeMinutes: 40,
    highwayCode: "H03",
    highwayName: "Araniko 6-Lane Expressway",
    surface: "asphalt_excellent",
    status: "clear",
    elevationGain: 150,
    intermediateCoords: [[27.7172, 85.324], [27.671, 85.4298], [27.6221, 85.5428]]
  },
  // Dhulikhel to Tatopani / Kodari (H03)
  {
    fromId: "dhk",
    toId: "kdr",
    distanceKm: 83,
    baseTimeMinutes: 155,
    highwayCode: "H03",
    highwayName: "Araniko Highway (Bhotekoshi Gorge)",
    surface: "blacktopped_fair",
    status: "caution",
    elevationGain: 90,
    intermediateCoords: [[27.6221, 85.5428], [27.6333, 85.7], [27.9497, 85.9452]]
  },
  // Dhulikhel to Sindhuli Gadhi (H13 BP Highway)
  {
    fromId: "dhk",
    toId: "sdh",
    distanceKm: 120,
    baseTimeMinutes: 190,
    highwayCode: "H13",
    highwayName: "B.P. Koirala Highway (Kavre-Sindhuli)",
    surface: "asphalt_excellent",
    status: "caution",
    elevationGain: -450,
    intermediateCoords: [[27.6221, 85.5428], [27.42, 85.87], [27.3333, 86.0167], [27.2486, 85.9186]]
  },
  // Sindhuli Gadhi to Bardibas (H13)
  {
    fromId: "sdh",
    toId: "brd",
    distanceKm: 40,
    baseTimeMinutes: 50,
    highwayCode: "H13",
    highwayName: "B.P. Koirala Highway (Sindhuli-Bardibas)",
    surface: "asphalt_excellent",
    status: "clear",
    elevationGain: -950,
    intermediateCoords: [[27.2486, 85.9186], [27.15, 85.91], [26.974, 85.9024]]
  },
  // Bardibas to Janakpur (H01 / Link)
  {
    fromId: "brd",
    toId: "jnk",
    distanceKm: 34,
    baseTimeMinutes: 40,
    highwayCode: "H01/Link",
    highwayName: "Bardibas-Janakpur Highway",
    surface: "asphalt_excellent",
    status: "clear",
    elevationGain: -76,
    intermediateCoords: [[26.974, 85.9024], [26.85, 85.92], [26.7271, 85.9408]]
  },
  // Bardibas to Hetauda (H01)
  {
    fromId: "brd",
    toId: "htd",
    distanceKm: 130,
    baseTimeMinutes: 130,
    highwayCode: "H01",
    highwayName: "Mahendra Highway (Central Terai)",
    surface: "asphalt_excellent",
    status: "clear",
    elevationGain: 310,
    intermediateCoords: [[26.974, 85.9024], [27.05, 85.35], [27.4285, 85.0331]]
  },
  // Bardibas to Biratnagar / Dharan (H01)
  {
    fromId: "brd",
    toId: "brt",
    distanceKm: 175,
    baseTimeMinutes: 180,
    highwayCode: "H01",
    highwayName: "Mahendra Highway (East Section & Koshi Barrage)",
    surface: "asphalt_excellent",
    status: "clear",
    elevationGain: -78,
    intermediateCoords: [[26.974, 85.9024], [26.521, 86.932], [26.4525, 87.2718]]
  },
  // Biratnagar to Dharan (H01 / H08 link)
  {
    fromId: "brt",
    toId: "dhr",
    distanceKm: 42,
    baseTimeMinutes: 45,
    highwayCode: "H08 Link",
    highwayName: "6-Lane Commercial Highway",
    surface: "asphalt_excellent",
    status: "clear",
    elevationGain: 277,
    intermediateCoords: [[26.4525, 87.2718], [26.665, 87.278], [26.8124, 87.2834]]
  },
  // Biratnagar to Kakarbhitta (H01)
  {
    fromId: "brt",
    toId: "kkr",
    distanceKm: 105,
    baseTimeMinutes: 105,
    highwayCode: "H01",
    highwayName: "Mahendra Highway (Jhapa-Morang 4-lane)",
    surface: "asphalt_excellent",
    status: "clear",
    elevationGain: 73,
    intermediateCoords: [[26.4525, 87.2718], [26.662, 87.892], [26.6508, 88.1565]]
  },
  // Kakarbhitta to Ilam (H09 Mechi Highway)
  {
    fromId: "kkr",
    toId: "ilm",
    distanceKm: 82,
    baseTimeMinutes: 140,
    highwayCode: "H09",
    highwayName: "Mechi Highway (Tea Garden Hill Climb)",
    surface: "asphalt_excellent",
    status: "clear",
    elevationGain: 1063,
    intermediateCoords: [[26.6508, 88.1565], [26.78, 87.98], [26.9117, 87.9275]]
  },
  // Butwal to Nepalgunj (H01)
  {
    fromId: "btl",
    toId: "npg",
    distanceKm: 240,
    baseTimeMinutes: 215,
    highwayCode: "H01",
    highwayName: "Mahendra Highway (Kapilvastu-Banke)",
    surface: "asphalt_excellent",
    status: "clear",
    elevationGain: -70,
    intermediateCoords: [[27.7006, 83.4484], [27.72, 82.85], [28.05, 81.6167]]
  },
  // Nepalgunj to Surkhet (H12 Ratna Highway)
  {
    fromId: "npg",
    toId: "srk",
    distanceKm: 113,
    baseTimeMinutes: 140,
    highwayCode: "H12",
    highwayName: "Ratna Highway (Kohalpur-Birendranagar)",
    surface: "asphalt_excellent",
    status: "clear",
    elevationGain: 510,
    intermediateCoords: [[28.05, 81.6167], [28.19, 81.69], [28.5997, 81.6334]]
  },
  // Surkhet to Jumla (H06 Karnali Highway)
  {
    fromId: "srk",
    toId: "jml",
    distanceKm: 232,
    baseTimeMinutes: 460,
    highwayCode: "H06",
    highwayName: "Karnali Highway (Mountain Gorge Road)",
    surface: "blacktopped_fair",
    status: "caution",
    elevationGain: 1854,
    intermediateCoords: [[28.5997, 81.6334], [29.14, 81.6], [29.2747, 82.1838]]
  },
  // Nepalgunj to Dhangadhi (H01)
  {
    fromId: "npg",
    toId: "dhg",
    distanceKm: 165,
    baseTimeMinutes: 145,
    highwayCode: "H01",
    highwayName: "Mahendra Highway (Chisapani Karnali Bridge)",
    surface: "asphalt_excellent",
    status: "clear",
    elevationGain: -41,
    intermediateCoords: [[28.05, 81.6167], [28.64, 81.28], [28.6946, 80.5977]]
  },
  // Dhangadhi to Mahendranagar (H01)
  {
    fromId: "dhg",
    toId: "mhn",
    distanceKm: 52,
    baseTimeMinutes: 50,
    highwayCode: "H01",
    highwayName: "Mahendra Highway (Far Western Terminus)",
    surface: "asphalt_excellent",
    status: "clear",
    elevationGain: 89,
    intermediateCoords: [[28.6946, 80.5977], [28.85, 80.35], [28.9667, 80.1833]]
  }
];
var VEHICLE_CONFIGS = {
  car: { mileageKmPerL: 14, fuelCostPerL: 172, speedMultiplier: 1, label: "Car / Hatchback / Sedan" },
  suv_4wd: { mileageKmPerL: 10, fuelCostPerL: 160, speedMultiplier: 1.05, label: "SUV / 4WD Jeep" },
  motorbike: { mileageKmPerL: 35, fuelCostPerL: 172, speedMultiplier: 1.12, label: "Motorcycle" },
  bus_truck: { mileageKmPerL: 4.5, fuelCostPerL: 160, speedMultiplier: 0.75, label: "Commercial Bus / Truck" },
  electric_vehicle: { mileageKmPerL: 6.5, fuelCostPerL: 0, speedMultiplier: 1, label: "Electric Vehicle (EV)" }
  // 6.5 km/kWh
};
function calculateRouteScenicRating(highwayCodes) {
  let score = 3.6;
  const codeStr = highwayCodes.join(" ");
  if (codeStr.includes("H13")) score = Math.max(score, 4.9);
  if (codeStr.includes("H09")) score = Math.max(score, 4.8);
  if (codeStr.includes("H02") && highwayCodes.some((c) => c.includes("H02"))) score = Math.max(score, 4.7);
  if (codeStr.includes("H10")) score = Math.max(score, 4.7);
  if (codeStr.includes("H15")) score = Math.max(score, 4.7);
  if (codeStr.includes("H06")) score = Math.max(score, 4.6);
  if (codeStr.includes("H03")) score = Math.max(score, 4.5);
  if (codeStr.includes("H04")) score = Math.max(score, 4.2);
  return Math.round(score * 10) / 10;
}
function findRouteByPreference(originId, destinationId, preference = "fastest", vehicle = "car", penalizedEdgeIds = /* @__PURE__ */ new Set(), overrideMetadata, terrainFilters = {}) {
  const origin = CITIES_AND_JUNCTIONS.find((c) => c.id === originId);
  const destination = CITIES_AND_JUNCTIONS.find((c) => c.id === destinationId);
  if (!origin || !destination) return null;
  if (originId === destinationId) return null;
  const adjMap = /* @__PURE__ */ new Map();
  CITIES_AND_JUNCTIONS.forEach((city) => adjMap.set(city.id, []));
  ROAD_NETWORK_EDGES.forEach((edge) => {
    const keyForward = `${edge.fromId}-${edge.toId}`;
    const keyReverse = `${edge.toId}-${edge.fromId}`;
    adjMap.get(edge.fromId)?.push({ nodeId: edge.toId, edge, edgeKey: keyForward });
    adjMap.get(edge.toId)?.push({
      nodeId: edge.fromId,
      edge: {
        ...edge,
        fromId: edge.toId,
        toId: edge.fromId,
        elevationGain: -edge.elevationGain,
        intermediateCoords: [...edge.intermediateCoords].reverse()
      },
      edgeKey: keyReverse
    });
  });
  const distances = /* @__PURE__ */ new Map();
  const previous = /* @__PURE__ */ new Map();
  const visited = /* @__PURE__ */ new Set();
  CITIES_AND_JUNCTIONS.forEach((city) => {
    distances.set(city.id, Infinity);
    previous.set(city.id, null);
  });
  distances.set(originId, 0);
  while (visited.size < CITIES_AND_JUNCTIONS.length) {
    let minNode = null;
    let minCost = Infinity;
    for (const [nodeId, cost] of distances.entries()) {
      if (!visited.has(nodeId) && cost < minCost) {
        minCost = cost;
        minNode = nodeId;
      }
    }
    if (!minNode || minCost === Infinity) break;
    if (minNode === destinationId) break;
    visited.add(minNode);
    const neighbors = adjMap.get(minNode) || [];
    for (const { nodeId: nextId, edge, edgeKey } of neighbors) {
      if (visited.has(nextId)) continue;
      let edgeWeight = edge.baseTimeMinutes;
      const fromCityNode = CITIES_AND_JUNCTIONS.find((c) => c.id === edge.fromId);
      const toCityNode = CITIES_AND_JUNCTIONS.find((c) => c.id === edge.toId);
      const fromElev = fromCityNode?.elevationM ?? 400;
      const toElev = toCityNode?.elevationM ?? 400;
      const peakElevOnEdge = Math.max(fromElev, toElev, fromElev + Math.max(0, edge.elevationGain), toElev + Math.max(0, -edge.elevationGain));
      const slopeGradePct = edge.distanceKm > 0 ? Math.abs(edge.elevationGain) / (edge.distanceKm * 1e3) * 100 : 0;
      const isPassCorridor = peakElevOnEdge >= 1450 || edge.highwayName.toLowerCase().includes("pass") || edge.highwayName.toLowerCase().includes("daman") || edge.highwayName.toLowerCase().includes("ridge") || edge.highwayCode.includes("H02") && edge.distanceKm > 80;
      if (preference === "shortest") {
        edgeWeight = edge.distanceKm * 1.5;
        if (edge.status === "closed") edgeWeight *= 15;
      } else {
        if (edge.status === "caution") edgeWeight *= 1.35;
        if (edge.status === "obstructed") edgeWeight *= 2.5;
        if (edge.status === "closed") edgeWeight *= 10;
        if (edge.surface === "under_construction") edgeWeight *= 1.4;
        if (edge.surface === "gravel" || edge.surface === "offroad_mud") {
          edgeWeight *= vehicle === "suv_4wd" ? 1.2 : 1.8;
        }
        if (preference === "safest") {
          if (edge.status !== "clear") edgeWeight *= 2.5;
          if (edge.surface === "under_construction") edgeWeight *= 2.8;
          if (edge.surface === "offroad_mud" || edge.surface === "gravel") edgeWeight *= 3;
        } else if (preference === "scenic") {
          if (["H13", "H10", "H02", "H15", "H09", "H03"].some((c) => edge.highwayCode.includes(c))) {
            edgeWeight *= 0.55;
          }
        } else if (preference === "ev_optimized") {
          if (["H04", "H05", "H01", "H10"].some((c) => edge.highwayCode.includes(c))) {
            edgeWeight *= 0.8;
          }
        }
      }
      if (terrainFilters.avoidHighPasses) {
        if (peakElevOnEdge >= 1800 || isPassCorridor && peakElevOnEdge >= 1400) {
          edgeWeight *= 14 * (peakElevOnEdge / 1300);
        } else if (peakElevOnEdge >= 1400) {
          edgeWeight *= 6;
        } else if (peakElevOnEdge >= 1100 && isPassCorridor) {
          edgeWeight *= 3;
        }
      }
      if (terrainFilters.requirePavedOnly) {
        if (edge.surface === "gravel" || edge.surface === "offroad_mud") {
          edgeWeight *= 30;
        } else if (edge.surface === "under_construction") {
          edgeWeight *= 8.5;
        } else if (edge.surface === "asphalt_excellent") {
          edgeWeight *= 0.75;
        } else if (edge.surface === "blacktopped_fair") {
          edgeWeight *= 0.9;
        }
      }
      if (terrainFilters.avoidSteepGrades) {
        if (slopeGradePct >= 5.5) {
          edgeWeight *= 5 * (slopeGradePct / 4);
        } else if (slopeGradePct >= 3.8) {
          edgeWeight *= 2.2;
        }
      }
      if (terrainFilters.avoidActiveLandslideZones) {
        if (edge.status === "caution") {
          edgeWeight *= 4.5;
        } else if (edge.status === "obstructed") {
          edgeWeight *= 18;
        } else if (edge.status === "closed") {
          edgeWeight *= 60;
        }
        const hasLiveIncident = LIVE_ROAD_INCIDENTS.some(
          (inc) => (inc.highwayCode === edge.highwayCode || inc.locationName.toLowerCase().includes(edge.highwayName.toLowerCase())) && (inc.type === "landslide" || inc.type === "fallen_rocks" || inc.type === "flood" || inc.severity === "severe")
        );
        if (hasLiveIncident) {
          edgeWeight *= 5;
        }
      }
      if (terrainFilters.maxElevationM && peakElevOnEdge > terrainFilters.maxElevationM) {
        const excessM = peakElevOnEdge - terrainFilters.maxElevationM;
        edgeWeight *= 12 + excessM / 100 * 3;
      }
      if (penalizedEdgeIds.has(edgeKey) || penalizedEdgeIds.has(`${edge.toId}-${edge.fromId}`)) {
        edgeWeight *= 5;
      }
      const totalNewCost = distances.get(minNode) + edgeWeight;
      if (totalNewCost < distances.get(nextId)) {
        distances.set(nextId, totalNewCost);
        previous.set(nextId, { nodeId: minNode, edge });
      }
    }
  }
  const edgesOnPath = [];
  let curr = destinationId;
  while (curr !== originId) {
    const prev = previous.get(curr);
    if (!prev) return null;
    edgesOnPath.unshift(prev.edge);
    curr = prev.nodeId;
  }
  if (edgesOnPath.length === 0) return null;
  let totalDistanceKm = 0;
  let totalMinutes = 0;
  let clearKm = 0;
  let cautionKm = 0;
  let obstructedKm = 0;
  let totalElevationGainM = 0;
  let pathCoordinates = [];
  const steps = [];
  const vehicleConfig = VEHICLE_CONFIGS[vehicle] || VEHICLE_CONFIGS.car;
  const segmentsSafety = [];
  edgesOnPath.forEach((edge, idx) => {
    totalDistanceKm += edge.distanceKm;
    let segMinutes = edge.baseTimeMinutes / vehicleConfig.speedMultiplier;
    if (edge.status === "caution") segMinutes *= 1.25;
    if (edge.status === "obstructed") segMinutes *= 1.8;
    totalMinutes += Math.round(segMinutes);
    if (edge.status === "clear") clearKm += edge.distanceKm;
    else if (edge.status === "caution") cautionKm += edge.distanceKm;
    else obstructedKm += edge.distanceKm;
    if (edge.elevationGain > 0) totalElevationGainM += edge.elevationGain;
    if (idx === 0) {
      pathCoordinates.push(...edge.intermediateCoords);
    } else {
      pathCoordinates.push(...edge.intermediateCoords.slice(1));
    }
    const fromCity = CITIES_AND_JUNCTIONS.find((c) => c.id === edge.fromId)?.name || edge.fromId;
    const toCity = CITIES_AND_JUNCTIONS.find((c) => c.id === edge.toId)?.name || edge.toId;
    let warningText;
    if (edge.status === "caution") {
      warningText = `Caution: Active road widening / single-lane section on ${edge.highwayName}.`;
    }
    const segSafety = calculateSegmentSafety({
      fromId: edge.fromId,
      toId: edge.toId,
      fromName: fromCity,
      toName: toCity,
      highwayCode: edge.highwayCode,
      highwayName: edge.highwayName,
      distanceKm: edge.distanceKm,
      surface: edge.surface,
      status: edge.status,
      elevationGainM: edge.elevationGain,
      coordinates: edge.intermediateCoords
    });
    segmentsSafety.push(segSafety);
    steps.push({
      instruction: `Follow ${edge.highwayName} (${edge.highwayCode}) from ${fromCity} to ${toCity}`,
      highwayCode: edge.highwayCode,
      distanceKm: edge.distanceKm,
      durationMinutes: Math.round(segMinutes),
      roadStatus: edge.status,
      surface: edge.surface,
      warning: warningText,
      elevationChangeM: edge.elevationGain,
      safetyData: segSafety
    });
  });
  const routeSafetyIndex = calculateRouteSafetyIndex(segmentsSafety, totalDistanceKm);
  const roadConditionScore = routeSafetyIndex.roadQualityAverage;
  const fuelLiters = Math.round(totalDistanceKm / vehicleConfig.mileageKmPerL * 10) / 10;
  const fuelCostNpr = Math.round(fuelLiters * vehicleConfig.fuelCostPerL);
  const evKwhRequired = Math.round(totalDistanceKm / 6.2 * 10) / 10;
  const recommendedChargers = [];
  const highwayCodesOnPath = Array.from(new Set(edgesOnPath.map((e) => e.highwayCode.split("/")[0])));
  NEPAL_HIGHWAYS.forEach((hw) => {
    if (highwayCodesOnPath.some((c) => hw.code === c || hw.code.includes(c))) {
      recommendedChargers.push(...hw.evChargers);
    }
  });
  let totalTollCost = 0;
  NEPAL_HIGHWAYS.forEach((hw) => {
    if (highwayCodesOnPath.some((c) => hw.code === c || hw.code.includes(c))) {
      hw.tollPlazas.forEach((tp) => {
        totalTollCost += tp.costNpr[vehicle] || 0;
      });
    }
  });
  const incidentsOnRoute = LIVE_ROAD_INCIDENTS.filter((inc) => highwayCodesOnPath.includes(inc.highwayCode));
  const elevationsOnRoute = [origin.elevationM, destination.elevationM, ...edgesOnPath.map((e) => e.elevationGain + origin.elevationM)];
  const maxElevationM = Math.max(...elevationsOnRoute);
  const scenicRating = calculateRouteScenicRating(highwayCodesOnPath);
  const viaHighways = Array.from(new Set(edgesOnPath.map((e) => `${e.highwayName} (${e.highwayCode})`))).join(" \u2794 ");
  const viaShort = edgesOnPath.length <= 2 ? `via ${edgesOnPath.map((e) => e.highwayName).join(" & ")}` : `via ${edgesOnPath[0].highwayName} & ${edgesOnPath[edgesOnPath.length - 1].highwayName}`;
  let defaultName = "Express Highway Corridor";
  let defaultBadge = "\u{1F680} Fastest";
  let defaultColor = "#38bdf8";
  if (preference === "shortest") {
    defaultName = "Direct Distance Path";
    defaultBadge = "\u{1F4CF} Shortest";
    defaultColor = "#10b981";
  } else if (preference === "scenic") {
    defaultName = "Scenic Mountain & River Vistas";
    defaultBadge = "\u{1F3D4}\uFE0F Most Scenic";
    defaultColor = "#a855f7";
  } else if (preference === "safest") {
    defaultName = "Paved & Safety-Prioritized";
    defaultBadge = "\u{1F6E1}\uFE0F Safest Surface";
    defaultColor = "#f59e0b";
  } else if (preference === "ev_optimized") {
    defaultName = "EV Fast-Charging Corridor";
    defaultBadge = "\u26A1 EV Priority";
    defaultColor = "#06b6d4";
  }
  const hasActiveTerrainFilters = Boolean(
    terrainFilters.avoidHighPasses || terrainFilters.requirePavedOnly || terrainFilters.avoidSteepGrades || terrainFilters.avoidActiveLandslideZones || terrainFilters.maxElevationM
  );
  return {
    id: `plan-${originId}-${destinationId}-${preference}-${vehicle}-${edgesOnPath.map((e) => e.fromId).join("-")}${hasActiveTerrainFilters ? "-filtered" : ""}`,
    origin,
    destination,
    preference,
    vehicle,
    routeName: overrideMetadata?.name || defaultName,
    routeBadge: overrideMetadata?.badge || defaultBadge,
    routeColor: overrideMetadata?.color || defaultColor,
    viaHighlights: overrideMetadata?.viaHighlights || viaShort,
    scenicRating,
    totalDistanceKm,
    estimatedTimeMinutes: totalMinutes,
    roadConditionScore,
    safetyIndex: routeSafetyIndex,
    statusSummary: {
      clearKm,
      cautionKm,
      obstructedKm
    },
    fuelEstimate: {
      liters: fuelLiters,
      costNpr: fuelCostNpr,
      avgMileageKmPerLiter: vehicleConfig.mileageKmPerL
    },
    evEstimate: {
      kwhRequired: evKwhRequired,
      recommendedChargingStops: recommendedChargers,
      batteryUsagePercent: Math.round(evKwhRequired / 50 * 100)
    },
    totalTollCostNpr: totalTollCost,
    elevationGainM: totalElevationGainM,
    maxElevationM,
    incidentsOnRoute,
    steps,
    pathCoordinates,
    appliedTerrainFilters: hasActiveTerrainFilters ? terrainFilters : void 0,
    alternateRouteSummary: {
      name: preference === "fastest" ? "Scenic Hill Pass Alternative" : "Primary Express Corridor",
      distanceDiffKm: preference === "fastest" ? 24 : -18,
      timeDiffMinutes: preference === "fastest" ? 45 : -25,
      reason: viaHighways
    },
    aiAdvisory: {
      summary: `Travel route between ${origin.name} and ${destination.name} via ${viaShort} is currently ${roadConditionScore > 75 ? "Optimal" : "Moderate with caution zones"}. Total distance is ${totalDistanceKm} km with an estimated drive time of ${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m.${hasActiveTerrainFilters ? " (Terrain optimization filters active)." : ""}`,
      riskLevel: roadConditionScore > 75 ? "Low" : roadConditionScore > 50 ? "Moderate" : "High",
      keyRecommendations: [
        terrainFilters.avoidHighPasses ? "Route optimized to avoid high mountain passes (>1500m) and steep ridge summits." : "Maintain headlights on during river canyon curves and foggy morning mountain passes.",
        terrainFilters.requirePavedOnly ? "Route strictly prioritized on blacktopped & asphalt highway surfaces." : "Use lower gear (Engine braking) on steep descents instead of riding foot brakes to prevent brake overheating.",
        vehicle === "electric_vehicle" ? "Top up battery at high-capacity DC fast charging hubs before ascending steep ghat passes." : "Ensure adequate fuel reserve before entering remote mountain segments."
      ],
      monsoonOrWeatherWarning: "Monitor DOR Live alerts for sudden rockfall clearances between 11 AM - 3 PM.",
      bestDepartureWindow: "5:30 AM - 7:00 AM (Recommended to beat heavy freight truck queues)",
      emergencyContacts: ["Nepal Traffic Police: 103", "Emergency Police Hotline: 100", "Armed Police Force Highway Rescue: 1114", "Ambulance: 102"]
    }
  };
}
function findAllRouteOptions(originId, destinationId, vehicle = "car", terrainFilters = {}) {
  const options = [];
  const seenEdgeFingerprints = /* @__PURE__ */ new Set();
  const getFingerprint = (plan) => {
    return plan.steps.map((s) => `${s.highwayCode}-${s.distanceKm}`).join("|");
  };
  const fastest = findRouteByPreference(originId, destinationId, "fastest", vehicle, /* @__PURE__ */ new Set(), {
    name: "Express Corridor (Fastest)",
    badge: "\u{1F680} Fastest",
    color: "#38bdf8"
  }, terrainFilters);
  if (fastest) {
    options.push(fastest);
    seenEdgeFingerprints.add(getFingerprint(fastest));
  }
  const shortest = findRouteByPreference(originId, destinationId, "shortest", vehicle, /* @__PURE__ */ new Set(), {
    name: "Direct Distance (Shortest)",
    badge: "\u{1F4CF} Shortest",
    color: "#10b981"
  }, terrainFilters);
  if (shortest) {
    const fp = getFingerprint(shortest);
    if (!seenEdgeFingerprints.has(fp)) {
      options.push(shortest);
      seenEdgeFingerprints.add(fp);
    }
  }
  const scenic = findRouteByPreference(originId, destinationId, "scenic", vehicle, /* @__PURE__ */ new Set(), {
    name: "Scenic Ridge & Passes",
    badge: "\u{1F3D4}\uFE0F Most Scenic",
    color: "#a855f7"
  }, terrainFilters);
  if (scenic) {
    const fp = getFingerprint(scenic);
    if (!seenEdgeFingerprints.has(fp)) {
      options.push(scenic);
      seenEdgeFingerprints.add(fp);
    }
  }
  const safest = findRouteByPreference(originId, destinationId, "safest", vehicle, /* @__PURE__ */ new Set(), {
    name: "Paved & Safety-Prioritized",
    badge: "\u{1F6E1}\uFE0F Safest Surface",
    color: "#f59e0b"
  }, terrainFilters);
  if (safest) {
    const fp = getFingerprint(safest);
    if (!seenEdgeFingerprints.has(fp)) {
      options.push(safest);
      seenEdgeFingerprints.add(fp);
    }
  }
  if (options.length < 2 && fastest) {
    const primaryEdgeKeys = /* @__PURE__ */ new Set();
    fastest.steps.forEach((step) => {
      ROAD_NETWORK_EDGES.forEach((e) => {
        if (step.highwayCode?.includes(e.highwayCode)) {
          primaryEdgeKeys.add(`${e.fromId}-${e.toId}`);
          primaryEdgeKeys.add(`${e.toId}-${e.fromId}`);
        }
      });
    });
    const alternative = findRouteByPreference(originId, destinationId, "scenic", vehicle, primaryEdgeKeys, {
      name: "Alternative Highway Bypass",
      badge: "\u{1F504} Alternative",
      color: "#c084fc"
    }, terrainFilters);
    if (alternative) {
      const fp = getFingerprint(alternative);
      if (!seenEdgeFingerprints.has(fp)) {
        options.push(alternative);
        seenEdgeFingerprints.add(fp);
      }
    }
  }
  if (vehicle === "electric_vehicle") {
    const evRoute = findRouteByPreference(originId, destinationId, "ev_optimized", vehicle, /* @__PURE__ */ new Set(), {
      name: "EV Fast-Charging Network",
      badge: "\u26A1 EV Priority",
      color: "#06b6d4"
    }, terrainFilters);
    if (evRoute) {
      const fp = getFingerprint(evRoute);
      if (!seenEdgeFingerprints.has(fp)) {
        options.push(evRoute);
      }
    }
  }
  return options;
}
function findOptimizedRoute(originId, destinationId, preference = "fastest", vehicle = "car", terrainFilters = {}) {
  const allOptions = findAllRouteOptions(originId, destinationId, vehicle, terrainFilters);
  if (allOptions.length === 0) return null;
  let selected = allOptions.find((opt) => opt.preference === preference);
  if (!selected) {
    selected = findRouteByPreference(originId, destinationId, preference, vehicle, /* @__PURE__ */ new Set(), void 0, terrainFilters) || allOptions[0];
  }
  return {
    ...selected,
    allRouteOptions: allOptions,
    appliedTerrainFilters: Object.keys(terrainFilters).some((k) => terrainFilters[k]) ? terrainFilters : void 0
  };
}

// server.ts
import_dotenv.default.config();
var userReports = [...INITIAL_USER_REPORTS];
var liveWeatherNodes = [...HIGHWAY_WEATHER_NODES];
var lastWeatherFetchTimestamp = 0;
var WEATHER_CACHE_TTL_MS = 60 * 1e3;
function mapWmoCodeToHighwayCondition(wmoCode, tempC, windSpeedKmh) {
  if (wmoCode >= 95) {
    return { condition: "thunderstorm", roadGrip: "wet_caution", landslideRisk: "high" };
  } else if (wmoCode >= 63 || wmoCode === 82) {
    return { condition: "rain_monsoon", roadGrip: "mud_slippery", landslideRisk: "severe" };
  } else if (wmoCode >= 61 || wmoCode >= 80 || wmoCode >= 51) {
    return { condition: "mountain_shower", roadGrip: "wet_caution", landslideRisk: "moderate" };
  } else if (wmoCode === 45 || wmoCode === 48) {
    return { condition: "dense_fog", roadGrip: "fog_low_visibility", landslideRisk: "moderate" };
  } else if (wmoCode >= 1 && wmoCode <= 3) {
    return { condition: "cloudy", roadGrip: "dry_excellent", landslideRisk: "low" };
  } else {
    return { condition: "sunny", roadGrip: "dry_excellent", landslideRisk: "low" };
  }
}
async function fetchRealtimePassWeather() {
  const now = Date.now();
  if (now - lastWeatherFetchTimestamp < WEATHER_CACHE_TTL_MS && liveWeatherNodes.length > 0) {
    return { nodes: liveWeatherNodes, source: "live_open_meteo" };
  }
  try {
    const lats = HIGHWAY_WEATHER_NODES.map((n) => n.lat.toFixed(4)).join(",");
    const lngs = HIGHWAY_WEATHER_NODES.map((n) => n.lng.toFixed(4)).join(",");
    const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,visibility&timezone=Asia%2FKathmandu`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4e3);
    const res = await fetch(apiUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      const resultsArray = Array.isArray(data) ? data : [data];
      const updatedNodes = HIGHWAY_WEATHER_NODES.map((baselineNode, idx) => {
        const stationData = resultsArray[idx]?.current;
        if (!stationData) return baselineNode;
        const tempC = Math.round(stationData.temperature_2m ?? baselineNode.tempC);
        const humidityPercent = Math.round(stationData.relative_humidity_2m ?? baselineNode.humidityPercent);
        const windSpeedKmh = Math.round(stationData.wind_speed_10m ?? baselineNode.windSpeedKmh);
        const rawVis = stationData.visibility;
        const visibilityKm = rawVis ? Number((rawVis / 1e3).toFixed(1)) : baselineNode.visibilityKm;
        const wmoCode = stationData.weather_code ?? 0;
        const precip = stationData.precipitation ?? 0;
        const { condition, roadGrip, landslideRisk } = mapWmoCodeToHighwayCondition(wmoCode, tempC, windSpeedKmh);
        const rainProbabilityPercent = precip > 0 ? Math.min(100, Math.round(50 + precip * 15)) : baselineNode.rainProbabilityPercent;
        let summary = baselineNode.summary;
        if (condition === "thunderstorm") {
          summary = `Real-time sensor alert: Active thunderstorm detected over ${baselineNode.name}. Rain rate: ${precip}mm. Reduce speed to \u226425 km/h.`;
        } else if (condition === "rain_monsoon") {
          summary = `Real-time sensor alert: Heavy mountain rain with active runoff. Landslide risk high across ${baselineNode.highwayCode}.`;
        } else if (condition === "dense_fog") {
          summary = `Real-time visibility dropped to ${visibilityKm} km at altitude ${baselineNode.elevationM}m. Low-beam headlights required.`;
        } else if (condition === "sunny") {
          summary = `Real-time observation: Clear and dry across ${baselineNode.name} (${tempC}\xB0C). Optimal driving conditions.`;
        }
        return {
          ...baselineNode,
          tempC,
          humidityPercent,
          windSpeedKmh,
          visibilityKm,
          condition,
          roadGrip,
          landslideRisk: precip > 3 ? "severe" : landslideRisk,
          rainProbabilityPercent,
          summary,
          lastUpdated: "Live Just Now"
        };
      });
      liveWeatherNodes = updatedNodes;
      lastWeatherFetchTimestamp = now;
      return { nodes: liveWeatherNodes, source: "live_open_meteo" };
    }
  } catch (err) {
    console.warn("[Weather API] Open-Meteo request failed or timed out. Falling back to calibrated DHM baseline telemetry:", err);
  }
  liveWeatherNodes = HIGHWAY_WEATHER_NODES;
  return { nodes: HIGHWAY_WEATHER_NODES, source: "fallback_dhm_baseline" };
}
var aiClient = null;
function getGeminiClient() {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new import_genai.GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  return aiClient;
}
function extractAndParseJson(text) {
  if (!text) return null;
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
  }
  const unmarkdown = trimmed.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/\s*```$/, "").trim();
  try {
    return JSON.parse(unmarkdown);
  } catch {
  }
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const jsonCandidate = trimmed.substring(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(jsonCandidate);
    } catch {
      try {
        const cleanedCommas = jsonCandidate.replace(/,\s*([\]}])/g, "$1");
        return JSON.parse(cleanedCommas);
      } catch {
      }
    }
  }
  const firstBracket = trimmed.indexOf("[");
  const lastBracket = trimmed.lastIndexOf("]");
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    const arrayCandidate = trimmed.substring(firstBracket, lastBracket + 1);
    try {
      return JSON.parse(arrayCandidate);
    } catch {
      try {
        const cleanedCommas = arrayCandidate.replace(/,\s*([\]}])/g, "$1");
        return JSON.parse(cleanedCommas);
      } catch {
      }
    }
  }
  return null;
}
async function generateJsonWithModelFallback(ai, prompt, candidateModels = ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-3.1-flash-lite", "gemini-3.7-flash"]) {
  for (const model of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });
      const responseText = response.text?.trim();
      if (responseText) {
        const parsed = extractAndParseJson(responseText);
        if (parsed) {
          return parsed;
        }
      }
    } catch (err) {
      const isQuota = err?.status === 429 || err?.message?.includes("429") || err?.message?.includes("RESOURCE_EXHAUSTED") || err?.message?.includes("quota");
      console.warn(
        `[Gemini AI] Model '${model}' notice (${isQuota ? "Quota Limit Reached" : err?.status || err?.message || "temporarily unavailable"}). ${isQuota ? "Switching to next model/fallback..." : "Trying next candidate..."}`
      );
      await new Promise((r) => setTimeout(r, 150));
    }
  }
  return null;
}
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.use(import_express.default.json());
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", service: "Mero Sadak Highway & Route Optimization Engine" });
  });
  app.get("/api/highways", (req, res) => {
    res.json({ highways: NEPAL_HIGHWAYS });
  });
  app.get("/api/cities", (req, res) => {
    res.json({ cities: CITIES_AND_JUNCTIONS });
  });
  app.get("/api/road-alerts", (req, res) => {
    res.json({
      incidents: LIVE_ROAD_INCIDENTS,
      userReports,
      source: "dor_nepal_police_feeds",
      syncedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
  app.get("/api/weather", async (req, res) => {
    const { nodes, source } = await fetchRealtimePassWeather();
    res.json({
      weatherNodes: nodes,
      source,
      dhmCalibrated: true,
      lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
  app.get("/api/pois", (req, res) => {
    res.json({ pois: HIGHWAY_POIS, source: "nea_ev_dor_directory" });
  });
  app.get("/api/traffic", (req, res) => {
    res.json({
      corridors: TRAFFIC_CORRIDORS,
      source: "ktm_valley_traffic_police_telemetry",
      syncedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
  app.get("/api/offline-bundle", (req, res) => {
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.json({
      version: "1.2.0",
      syncedAt: (/* @__PURE__ */ new Date()).toISOString(),
      highways: NEPAL_HIGHWAYS,
      cities: CITIES_AND_JUNCTIONS,
      incidents: LIVE_ROAD_INCIDENTS,
      userReports,
      weatherNodes: HIGHWAY_WEATHER_NODES,
      pois: HIGHWAY_POIS,
      corridors: TRAFFIC_CORRIDORS,
      offlineSupport: {
        routingEngine: "Client-side topological Dijkstra running locally in memory",
        tileStrategy: "Service Worker Cache-First with Stale-While-Revalidate",
        cachedCorridors: ["H01", "H02", "H03", "H04", "H05", "H06", "H07", "H08", "H09", "H10", "H11", "H12", "H13", "H14", "H15", "H16", "H17", "H18", "H19", "H20", "H21", "H22"]
      }
    });
  });
  app.get("/sw.js", (req, res) => {
    res.setHeader("Content-Type", "application/javascript");
    res.setHeader("Service-Worker-Allowed", "/");
    res.sendFile(import_path.default.join(process.cwd(), "public", "sw.js"));
  });
  app.post("/api/submit-report", (req, res) => {
    const { highwayCode, location, incidentType, severity, description, reporterName, contactNumber } = req.body;
    if (!location || !description) {
      return res.status(400).json({ error: "Location and description are required" });
    }
    const newReport = {
      id: `usr-rep-${Date.now()}`,
      highwayCode: highwayCode || "H04",
      location,
      incidentType: incidentType || "pothole",
      severity: severity || "minor",
      description,
      reporterName: reporterName || "Anonymous Traveler",
      contactNumber,
      createdAt: "Just now",
      upvotes: 1,
      verified: false
    };
    userReports.unshift(newReport);
    res.json({ success: true, report: newReport });
  });
  app.post("/api/upvote-report/:id", (req, res) => {
    const { id } = req.params;
    const report = userReports.find((r) => r.id === id);
    if (report) {
      report.upvotes += 1;
      return res.json({ success: true, upvotes: report.upvotes });
    }
    res.status(404).json({ error: "Report not found" });
  });
  app.post("/api/calculate-route", (req, res) => {
    const { originId, destinationId, preference, vehicle } = req.body;
    if (!originId || !destinationId) {
      return res.status(400).json({ error: "Origin and destination are required" });
    }
    const result = findOptimizedRoute(originId, destinationId, preference || "fastest", vehicle || "car");
    if (!result) {
      return res.status(404).json({ error: "No reachable route found between selected points." });
    }
    res.json({ routePlan: result });
  });
  app.post("/api/ai-smart-route-query", async (req, res) => {
    const { query } = req.body;
    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: "Query string is required" });
    }
    try {
      const ai = getGeminiClient();
      if (!ai) {
        const lower = query.toLowerCase();
        let dest = "pkr";
        let origin = "ktm";
        let vehicle = "car";
        let preference = "fastest";
        if (lower.includes("pokhara") || lower.includes("pkr")) dest = "pkr";
        else if (lower.includes("chitwan") || lower.includes("narayanghat") || lower.includes("bharatpur")) dest = "cht";
        else if (lower.includes("lumbini") || lower.includes("bhairahawa")) dest = "bhr";
        else if (lower.includes("butwal")) dest = "btl";
        else if (lower.includes("hetauda")) dest = "htd";
        else if (lower.includes("birgunj")) dest = "brg";
        else if (lower.includes("janakpur")) dest = "jnk";
        else if (lower.includes("biratnagar")) dest = "brt";
        else if (lower.includes("dharan")) dest = "dhr";
        else if (lower.includes("dhangadhi")) dest = "dhg";
        else if (lower.includes("surkhet") || lower.includes("birendranagar")) dest = "srk";
        else if (lower.includes("jumla")) dest = "jml";
        else if (lower.includes("mustang") || lower.includes("jomsom") || lower.includes("baglung")) dest = "bgl";
        if (lower.includes("bike") || lower.includes("motorcycle") || lower.includes("scooter")) vehicle = "motorbike";
        else if (lower.includes("suv") || lower.includes("jeep") || lower.includes("4wd") || lower.includes("4x4")) vehicle = "suv_4wd";
        else if (lower.includes("truck") || lower.includes("bus") || lower.includes("heavy")) vehicle = "bus_truck";
        else if (lower.includes("ev") || lower.includes("electric")) vehicle = "electric_vehicle";
        if (lower.includes("safe") || lower.includes("safest")) preference = "safest";
        else if (lower.includes("scenic") || lower.includes("view") || lower.includes("nature")) preference = "scenic";
        else if (lower.includes("eco") || lower.includes("green")) preference = "ev_optimized";
        return res.json({
          originId: origin,
          destId: dest,
          vehicle,
          preference,
          summary: `Identified destination as ${dest} for ${vehicle} with ${preference} priority.`
        });
      }
      const prompt = `You are the AI routing assistant for Nepal Highway GIS (Mero Sadak).
Parse the following user query into structured route parameters for Nepal highways:
"${query}"

Available cities and IDs:
${CITIES_AND_JUNCTIONS.map((c) => `${c.id}: ${c.name} (${c.district})`).join(", ")}

Return a valid JSON object matching:
{
  "originId": "id of origin city (default 'ktm' if unspecified)",
  "destId": "id of destination city (e.g. 'pkr', 'cht', 'bhr', etc.)",
  "vehicle": "car" | "suv_4wd" | "motorbike" | "bus_truck" | "electric_vehicle",
  "preference": "fastest" | "safest" | "scenic" | "ev_optimized",
  "summary": "1 brief, friendly sentence explaining what parameters were parsed"
}`;
      const parsed = await generateJsonWithModelFallback(ai, prompt);
      if (parsed && parsed.destId) {
        return res.json(parsed);
      }
      throw new Error("Could not parse query with AI");
    } catch (err) {
      console.warn("AI query parse fallback used:", err);
      return res.json({
        originId: "ktm",
        destId: "pkr",
        vehicle: "car",
        preference: "fastest",
        summary: "Mapped to Pokhara via Kathmandu default."
      });
    }
  });
  app.post("/api/ai-route-advisor", async (req, res) => {
    const { origin, destination, vehicle, preference, distanceKm, timeHours, roadConditionScore, incidents } = req.body;
    try {
      const ai = getGeminiClient();
      if (!ai) {
        return res.json({
          advisory: {
            summary: `Travel between ${origin} and ${destination} covers ${distanceKm} km with a road condition rating of ${roadConditionScore}/100. Terrain contains river canyons, narrow hairpin bends, and periodic construction zones.`,
            riskLevel: roadConditionScore < 60 ? "Moderate" : "Low",
            keyRecommendations: [
              "Start early morning (before 6:30 AM) to minimize encountering slow-moving heavy freight convoys.",
              "Use engine braking on steep downhill slopes; avoid excessive foot braking to prevent vapor lock.",
              "Watch for sudden gravel patches and flagmen near ongoing road widening sections.",
              "Carry sufficient potable water, emergency torch, and first-aid essentials."
            ],
            monsoonOrWeatherWarning: "During active rainfall, reduce speed near active river gorges and check live DOR updates for temporary clearing pauses.",
            bestDepartureWindow: "5:00 AM - 6:30 AM",
            emergencyContacts: ["Nepal Traffic Police: 103", "Emergency Hotline: 100", "Armed Police Force Highway Rescue: 1114"]
          }
        });
      }
      const prompt = `You are the chief highway safety and terrain navigation advisor for the Department of Roads, Nepal and Mero Sadak.
Analyze this planned trip in Nepal:
- Origin: ${origin}
- Destination: ${destination}
- Vehicle Type: ${vehicle}
- Routing Preference: ${preference}
- Total Distance: ${distanceKm} km
- Estimated Travel Time: ${timeHours} hours
- Road Condition Safety Score: ${roadConditionScore}/100
- Active Incidents on Corridors: ${JSON.stringify(incidents || [])}

Provide an authoritative, hyper-practical navigation advisory tailored to Nepal's unique Himalayan and Terai highway conditions.
Return a valid JSON object with the following fields:
{
  "summary": "2-3 concise, realistic sentences describing terrain dynamics, road conditions, and critical choke points (e.g. Nagdhunga, Daunne, Mugling, Siddhababa, or Roshi)",
  "riskLevel": "Low",
  "keyRecommendations": ["4 practical actionable points for the driver/rider concerning road geometry, braking, overtaking etiquette, rest stops, or EV charging"],
  "monsoonOrWeatherWarning": "Specific advice regarding mountain fog, rockfall zones, landslide sensitivity, or river crossings",
  "bestDepartureWindow": "Specific optimal departure time window (e.g. 5:30 AM - 6:30 AM) with brief reason",
  "emergencyContacts": ["Nepal Traffic Police: 103", "Emergency Hotline: 100", "Armed Police Force Highway Rescue: 1114"]
}
(Note: riskLevel must be one of "Low", "Moderate", "High", or "Severe")`;
      const parsedAdvisory = await generateJsonWithModelFallback(ai, prompt);
      if (parsedAdvisory) {
        return res.json({ advisory: parsedAdvisory });
      }
      throw new Error("Gemini models temporarily unavailable");
    } catch (error) {
      console.warn("Using authentic domain advisory fallback:", error);
      return res.json({
        advisory: {
          summary: `Travel between ${origin} and ${destination} covers ${distanceKm} km. Ensure safe speeds across hilly curves and watch for ongoing road expansion diversions.`,
          riskLevel: "Moderate",
          keyRecommendations: [
            "Maintain safe following distance behind heavy buses and freight trucks.",
            "Check tire pressure and cooling system before tackling high-elevation mountain climbs.",
            "Keep headlights on during winding gorge sections and early morning mist."
          ],
          monsoonOrWeatherWarning: "Check DOR alerts before entering Trishuli or Karnali river corridors during rain.",
          bestDepartureWindow: "6:00 AM - 7:30 AM",
          emergencyContacts: ["Nepal Traffic Police: 103", "Armed Police Force Highway Rescue: 1114"]
        }
      });
    }
  });
  app.post("/api/ai-trip-assistant", async (req, res) => {
    const {
      origin,
      destination,
      originDistrict,
      destinationDistrict,
      vehicle,
      preference,
      distanceKm,
      timeHours,
      elevationGainM,
      highwaysTraversed,
      focusFilter,
      customQuestion
    } = req.body;
    const generateFallbackTripPlan = () => {
      const isPokhara = destination?.toLowerCase().includes("pokhara");
      const isChitwan = destination?.toLowerCase().includes("chitwan") || destination?.toLowerCase().includes("narayanghat");
      const isKathmandu = destination?.toLowerCase().includes("kathmandu");
      const isSindhuliOrBardibas = destination?.toLowerCase().includes("sindhuli") || destination?.toLowerCase().includes("bardibas") || destination?.toLowerCase().includes("janakpur");
      const isHetaudaOrButwal = destination?.toLowerCase().includes("hetauda") || destination?.toLowerCase().includes("butwal");
      let suggestedStops = [
        {
          id: "stop-1",
          name: "Malekhu Riverfront Fresh Fish & Local Dhaba Strip",
          category: "cafe_dining",
          approxKmFromOrigin: Math.round(distanceKm * 0.35),
          approxTravelTime: "1 hr 45 min mark",
          locationName: "Malekhu, Dhading (Prithvi Highway H04)",
          highwayCode: "H04",
          highlights: "Famous crisp golden fried river fish, home-ground yellow mustard pickle (raayo ko achar), and fresh lemon masala tea with outdoor river view.",
          proTip: "Stop at the quieter riverside family restaurants on the western exit side for cleaner restrooms and less bus congestion.",
          bestFor: "Breakfast & Local Culinary Specialty",
          rating: 4.8,
          lat: 27.8228,
          lng: 84.8155
        },
        {
          id: "stop-2",
          name: "Kurintar Trishuli River Gorge Overlook & Riverside Cafe",
          category: "scenic_viewpoint",
          approxKmFromOrigin: Math.round(distanceKm * 0.52),
          approxTravelTime: "2 hr 40 min mark",
          locationName: "Kurintar, Chitwan / Gorkha border",
          highwayCode: "H04",
          highlights: "Breathtaking canyon panorama of turquoise Trishuli river rafters, Manakamana Cable Car terminal view, and cold brew coffee & bakery.",
          proTip: "Great spot to let vehicle brakes and engine cool down before continuing towards Mugling junction.",
          bestFor: "Scenic Photography & Espresso Coffee",
          rating: 4.9,
          lat: 27.8732,
          lng: 84.6054
        },
        {
          id: "stop-3",
          name: "Mugling Junction 60kW DC Fast Charger & Rest Hub",
          category: "rest_stop",
          approxKmFromOrigin: Math.round(distanceKm * 0.58),
          approxTravelTime: "3 hr 10 min mark",
          locationName: "Mugling Bazar, Highway Convergence H04/H05",
          highwayCode: "H04",
          highlights: "Major highway intersection with NEA EV Fast Charging station, 24-hour mechanic workshops, clean tea lounges, and ATM services.",
          proTip: "Top up tire pressure here and grab fresh bottled mineral water before the winding climb or Narayanghat descent.",
          bestFor: "EV Quick Top-up & Vehicle Health Check",
          rating: 4.6,
          lat: 27.8617,
          lng: 84.5542
        },
        {
          id: "stop-4",
          name: "Bandipur Dumre Ridge Cultural Viewpoint",
          category: "cultural_heritage",
          approxKmFromOrigin: Math.round(distanceKm * 0.72),
          approxTravelTime: "3 hr 55 min mark",
          locationName: "Dumre, Tanahun",
          highwayCode: "H04",
          highlights: "Panoramic vista of Marshyangdi River valley, traditional Newari stone gateway, and freshly made organic curd (Dahi) from local buffalo dairies.",
          proTip: "If you have an extra 45 minutes, drive up the 8km spur road to Bandipur hilltop village for a world-class Annapurna mountain panorama.",
          bestFor: "Himalayan Ridge Views & Authentic Dahi",
          rating: 4.9,
          lat: 27.9622,
          lng: 84.4125
        }
      ];
      if (isSindhuliOrBardibas) {
        suggestedStops = [
          {
            id: "stop-sdh-1",
            name: "Dhulikhel Himalayan Sunrise Ridge Cafe",
            category: "cafe_dining",
            approxKmFromOrigin: 30,
            approxTravelTime: "55 min mark",
            locationName: "Dhulikhel, Kavrepalanchok",
            highwayCode: "H03",
            highlights: "Artisan bakery and hillside coffee terrace overlooking the eastern Langtang to Gaurishankar Himalayan range.",
            proTip: "Order fresh masala tea and local sel roti; avoid heavy breakfast as BP Highway has tight twisting curves ahead.",
            bestFor: "Mountain View Coffee & Light Breakfast",
            rating: 4.8
          },
          {
            id: "stop-sdh-2",
            name: "Khurkot Sun Koshi River Suspension Bridge & Fish Stop",
            category: "scenic_viewpoint",
            approxKmFromOrigin: 85,
            approxTravelTime: "2 hr 30 min mark",
            locationName: "Khurkot, Sindhuli (BP Highway H13)",
            highwayCode: "H13",
            highlights: "Spectacular golden sands along Sun Koshi river, pedestrian suspension bridge stroll, and sweet river water breeze.",
            proTip: "Use lower gears descending the Nepalthok-Khurkot mountain switchbacks to save your brake pads.",
            bestFor: "River Walking & Stunning Photo Op",
            rating: 4.9
          },
          {
            id: "stop-sdh-3",
            name: "Historic Sindhuli Gadhi Fort & Junar Orange Groves",
            category: "cultural_heritage",
            approxKmFromOrigin: 130,
            approxTravelTime: "3 hr 45 min mark",
            locationName: "Sindhuli Gadhi Ridge",
            highwayCode: "H13",
            highlights: "18th-century stone battlefield fortress where Gorkhali troops defeated Captain Kinloch, flanked by juicy organic Junar (sweet orange) orchards.",
            proTip: "Buy fresh Junar juice concentrate from local village co-ops along the roadside.",
            bestFor: "Historic Exploration & Mountain Breeze",
            rating: 4.9
          }
        ];
      }
      return {
        tripTitle: `Highway Journey from ${origin || "Origin"} to ${destination || "Destination"}`,
        overallVibe: `Scenic mountain journey passing through river gorges, scenic terrace valleys, and vibrant highway settlements.`,
        destinationOverview: {
          tagline: isPokhara ? "Nepal\u2019s premier adventure and tranquil lake paradise nestled under the Annapurnas" : isChitwan ? "Subtropical wildlife haven famous for rhinos, tigers, and Rapti river sunsets" : isKathmandu ? "Historic capital of ancient pagoda temples, vibrant culinary scene, and culture" : `Fascinating destination in ${destinationDistrict || "Nepal"} with rich local culture and geography`,
          mustDoUponArrival: isPokhara ? "Head directly to Phewa Lakeside for evening reflection boating or walk along the pedestrian promenade." : isChitwan ? "Catch the sunset at Sauraha Rapti riverbank with a cool drink while watching wildlife on the far shore." : isKathmandu ? "Unwind from the highway with a warm dinner in Thamel or Patan Durbar Square courtyard." : `Explore the central chowk and sample the famous local market delicacies.`,
          localSpecialty: isPokhara ? "Authentic Thakali Thali with Mustang Jimbu ghee, fresh trout, and artisanal lake-view coffee" : isChitwan ? "Chitwan Taas (spiced pan-fried mutton with beaten rice & radish pickle) and fresh coconut water" : isKathmandu ? "Newari Choila, Samay Baji platter, Momos with sesame-tomato jhol, and King Curd (Juju Dhau)" : "Traditional Dal Bhat with organic regional seasonal greens and fresh highway tea",
          parkingTip: isPokhara ? "Park at designated lakeside municipal pay lots; central Lakeside street has evening vehicle restrictions on weekends." : isChitwan ? "Most safari resorts have spacious private parking; keep windows rolled up at night near forested buffer zones." : "Seek secure basement hotel parking in city center hubs to avoid narrow lane congestion."
        },
        suggestedStops,
        travelerTips: [
          "Sound your horn gently before blind hairpin turns on narrow gorge highways.",
          "Always carry local cash (NPR) as several scenic rural fruit stalls and roadside tea dhabas have limited cellular data for QR payments.",
          "Keep vehicle headlights on low beam when driving through river mist or shaded mountain corridors.",
          "Hydrate well and take a 10-15 minute break every 2 hours to avoid driver fatigue on winding routes."
        ],
        customAnswer: customQuestion ? `For your request regarding "${customQuestion}": Along the ${origin} to ${destination} corridor, we recommend planning your main refreshment break around the river valley sections where parking is widest and food is freshly cooked.` : void 0
      };
    };
    try {
      const ai = getGeminiClient();
      if (!ai) {
        return res.json({ tripPlan: generateFallbackTripPlan() });
      }
      const prompt = `You are the ultimate AI Highway Trip Assistant & Travel Concierge for Nepal highways (Mero Sadak).
A traveler is taking a trip with the following route parameters:
- Origin: ${origin} (District: ${originDistrict || "Unknown"})
- Destination: ${destination} (District: ${destinationDistrict || "Unknown"})
- Vehicle Type: ${vehicle || "car"}
- Routing Preference: ${preference || "fastest"}
- Total Route Distance: ${distanceKm} km
- Estimated Travel Time: ${timeHours} hours
- Elevation Climb: +${elevationGainM || 0}m
- Highway Corridors Traversed: ${JSON.stringify(highwaysTraversed || ["Prithvi Highway H04"])}
- Traveler Focus / Filter Preference: ${focusFilter || "all"}
${customQuestion ? `- Specific Traveler Question / Request: "${customQuestion}"` : ""}

Provide intelligent, highly accurate, authentic recommendations for scenic stops, cafes/eateries, rest areas, cultural spots, and destination intelligence along this specific highway path in Nepal.

Return a valid JSON object matching this exact schema:
{
  "tripTitle": "Short evocative title for this road trip",
  "overallVibe": "1-2 sentence captivating summary of the scenery, terrain, and traveler ambiance",
  "destinationOverview": {
    "tagline": "Inspiring 1-sentence description of the destination",
    "mustDoUponArrival": "Specific activity to do immediately after reaching the destination to unwind",
    "localSpecialty": "Authentic must-try food, dish, or beverage unique to this destination",
    "parkingTip": "Practical advice regarding city traffic, parking, or vehicle access at destination"
  },
  "suggestedStops": [
    {
      "id": "stop-1",
      "name": "Name of the stop, cafe, viewpoint, or dhaba",
      "category": "scenic_viewpoint",
      "approxKmFromOrigin": 65,
      "approxTravelTime": "1 hr 45 min mark",
      "locationName": "Precise town/milepost and highway name",
      "highwayCode": "H04",
      "highlights": "Specific highlights",
      "proTip": "Insider local tip",
      "bestFor": "Scenic Photo & Snack",
      "rating": 4.8
    }
  ],
  "travelerTips": [
    "Practical tips specific to driving this corridor"
  ]${customQuestion ? `,
  "customAnswer": "Thorough, helpful direct answer to the user question with specific highway landmarks"` : ""}
}
(Note: each stop category must be one of: "scenic_viewpoint", "cafe_dining", "rest_stop", "cultural_heritage", "ev_charging")

Generate between 3 to 5 realistic, high-quality, geographically authentic stops along the route ordered sequentially from origin to destination. Ensure realistic kilometer milestones and travel times based on ${distanceKm} km total.`;
      const parsedPlan = await generateJsonWithModelFallback(ai, prompt);
      if (parsedPlan) {
        return res.json({ tripPlan: parsedPlan });
      }
      return res.json({ tripPlan: generateFallbackTripPlan() });
    } catch (error) {
      return res.json({ tripPlan: generateFallbackTripPlan() });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Mero Sadak Highway Server running on http://localhost:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
