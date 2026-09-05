import React, { useState, useEffect } from 'react';
import {
  Compass,
  AlertTriangle,
  CloudFog,
  Activity,
  ShieldAlert,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  MapPin,
  Car,
  Download,
  PhoneCall,
  Check,
  X,
  Zap,
  Mountain,
  Bike,
  Truck,
  ShieldCheck,
  AlertCircle,
  Sparkles,
  BatteryCharging,
  Gauge,
  Lightbulb,
  ExternalLink,
  Layers,
} from 'lucide-react';
import { SubViewTab } from '../App';
import { VehicleType } from '../types';

export interface TravelStepsGuideProps {
  currentStep?: number;
  onSelectTab: (tab: SubViewTab) => void;
  onOpenSos: () => void;
  onOpenPreTrip: () => void;
  onOpenOffline: () => void;
  onClose: () => void;
  activeRouteSummary?: {
    originName: string;
    destinationName: string;
    distanceKm: number;
    durationMinutes: number;
    routeName?: string;
    routeBadge?: string;
    vehicle?: VehicleType;
  } | null;
  incidentCount: number;
  activeVehicle?: VehicleType;
  onVehicleChange?: (vehicle: VehicleType) => void;
}

interface TravelStep {
  step: number;
  id: SubViewTab | 'prep';
  title: string;
  subtitle: string;
  icon: React.ElementType;
  actionText: string;
  checklist: string[];
  color: string;
}

export interface VehicleTravelTip {
  id: string;
  category: 'Corridor & Range' | 'Braking & Safety' | 'Terrain & Incline' | 'Emergency & Prep';
  title: string;
  description: string;
  highwayCorridor?: string;
  isPriority?: boolean;
  actionText?: string;
  actionTab?: SubViewTab | 'pre-trip' | 'offline';
}

export interface VehicleTipsConfig {
  type: VehicleType;
  label: string;
  shortName: string;
  icon: React.ElementType;
  color: string;
  badgeBg: string;
  featuredHeadline: string;
  featuredDescription: string;
  featuredCorridor: string;
  tips: VehicleTravelTip[];
}

export const VEHICLE_TIPS_DATA: Record<VehicleType, VehicleTipsConfig> = {
  electric_vehicle: {
    type: 'electric_vehicle',
    label: 'Electric Vehicle (EV)',
    shortName: 'EV',
    icon: Zap,
    color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
    badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    featuredHeadline: 'For EV: Check charging station spacing on Prithvi Highway',
    featuredDescription:
      'NEA 30kW/60kW DC fast chargers are spaced at Kurintar, Mugling, Malekhu, and Dumre. Maintain at least a 25% battery buffer before beginning steep climbs toward Nagdhunga or Pokhara.',
    featuredCorridor: 'Prithvi Highway (H04)',
    tips: [
      {
        id: 'ev-1',
        category: 'Corridor & Range',
        title: 'For EV: Check charging station spacing on Prithvi Highway',
        description:
          'NEA 30kW/60kW DC fast chargers are spaced at Kurintar, Mugling, Malekhu, and Dumre. Maintain at least a 25% battery buffer before beginning steep climbs toward Nagdhunga or Pokhara.',
        highwayCorridor: 'Prithvi Highway (H04)',
        isPriority: true,
        actionText: 'Find EV Charging Stations',
        actionTab: 'pois',
      },
      {
        id: 'ev-2',
        category: 'Braking & Safety',
        title: 'Regenerative Braking on Nagdhunga & Daunne Descents',
        description:
          'Steep downhill descents can regenerate 8–15% battery pack capacity. Set regen mode to Level 2/High, but ensure the battery is not 100% full before descent or regen braking will be throttled.',
        highwayCorridor: 'Nagdhunga & Daunne Passes',
        actionText: 'Inspect Pass Elevations',
        actionTab: 'weather',
      },
      {
        id: 'ev-3',
        category: 'Terrain & Incline',
        title: 'Cold Mountain Pass Elevation Range Penalty',
        description:
          'High-altitude mountain climbs (+1,000m gain) and cold temperatures at Simbhanjyang or Nagdhunga increase consumption by 30-40%. Plan stops assuming 70% of flat-terrain range.',
        highwayCorridor: 'Tribhuvan & Prithvi Highways',
        actionText: 'Check Pass Weather',
        actionTab: 'weather',
      },
      {
        id: 'ev-4',
        category: 'Emergency & Prep',
        title: 'Caution Over Monsoon Washout Ruts & Battery Skid Plate',
        description:
          'Electric sedans and crossovers often carry lower clearance with vulnerable battery skid plates. Take unpaved diversion tracks slowly in the Mugling-Pokhara widening sector.',
        highwayCorridor: 'Mugling–Pokhara Widening Sector',
        actionText: 'Pre-Trip Clearance Checklist',
        actionTab: 'pre-trip',
      },
    ],
  },
  car: {
    type: 'car',
    label: 'Car / Sedan / Hatchback',
    shortName: 'Car',
    icon: Car,
    color: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10',
    badgeBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    featuredHeadline: 'For Car: Mind low ground clearance through unpaved Mugling-Pokhara widening ruts',
    featuredDescription:
      'Standard sedans (150-170mm clearance) risk scraping oil sumps on unpaved detour gravel. Straddle ruts carefully and maintain low, steady momentum.',
    featuredCorridor: 'Prithvi Highway (H04)',
    tips: [
      {
        id: 'car-1',
        category: 'Terrain & Incline',
        title: 'For Car: Mind low ground clearance through unpaved Mugling-Pokhara widening ruts',
        description:
          'Standard sedans (150-170mm clearance) risk scraping oil sumps on unpaved detour gravel. Straddle ruts carefully and maintain low, steady momentum.',
        highwayCorridor: 'Prithvi Highway (H04)',
        isPriority: true,
        actionText: 'View Road Alerts',
        actionTab: 'incidents',
      },
      {
        id: 'car-2',
        category: 'Terrain & Incline',
        title: 'Downshift and Monitor Coolant on BP Highway Hairpin Climbs',
        description:
          'BP Highway’s 160+ continuous switchbacks put heavy thermal load on small displacement engines. Shift to 2nd gear and turn off A/C if temperature gauge rises above mid-point.',
        highwayCorridor: 'BP Highway (H08)',
        actionText: 'View Corridor Traffic',
        actionTab: 'traffic',
      },
      {
        id: 'car-3',
        category: 'Braking & Safety',
        title: 'Never Overtake on Inner Curve Blind Spots in Trishuli Gorge',
        description:
          'Trishuli river gorge visibility is severely limited around bluffs. Wait for wide sightlines or driver hand-signals before attempting passes.',
        highwayCorridor: 'Prithvi Highway Corridor',
        actionText: 'Check Road Incidents',
        actionTab: 'incidents',
      },
      {
        id: 'car-4',
        category: 'Emergency & Prep',
        title: 'Check Spare Tire PSI & Wheel Lug Wrench',
        description:
          'Sharp shale rock fragments on detour roads cause frequent sidewall punctures. Verify spare tire is fully inflated and jack handle is on board.',
        highwayCorridor: 'All Hill Highways',
        actionText: 'Pre-Trip Inspection',
        actionTab: 'pre-trip',
      },
    ],
  },
  suv_4wd: {
    type: 'suv_4wd',
    label: 'SUV / 4WD Jeep',
    shortName: '4WD SUV',
    icon: Mountain,
    color: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
    badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    featuredHeadline: 'For 4WD: Engage 4H/4L before muddy monsoon river washouts & Karnali off-road stretches',
    featuredDescription:
      'Engage four-wheel drive early before crossing seasonal streams (kholsi) and loose gravel inclines; shifting mid-gradient on clay slopes risks traction loss.',
    featuredCorridor: 'BP & Karnali Corridors',
    tips: [
      {
        id: 'suv-1',
        category: 'Terrain & Incline',
        title: 'For 4WD: Engage 4H/4L before muddy monsoon river washouts & Karnali off-road stretches',
        description:
          'Engage four-wheel drive early before crossing seasonal streams (kholsi) and loose gravel inclines; shifting mid-gradient on clay slopes risks traction loss.',
        highwayCorridor: 'BP & Karnali Corridors',
        isPriority: true,
        actionText: 'Check River Alerts',
        actionTab: 'incidents',
      },
      {
        id: 'suv-2',
        category: 'Corridor & Range',
        title: 'Lower Tire Pressure for Loose Mountain Scree & Wet Clay',
        description:
          'Dropping tire pressure to 26–28 PSI significantly widens contact patch on slippery wet limestone mud during monsoon travels.',
        highwayCorridor: 'Mid-Hill & Rural Corridors',
        actionText: 'Pre-Trip Equipment',
        actionTab: 'pre-trip',
      },
      {
        id: 'suv-3',
        category: 'Braking & Safety',
        title: 'Disengage Center Diff Lock Once Back on Dry Paved Tarmac',
        description:
          'Disengage differential lock immediately when returning to dry paved tarmac to avoid driveline binding on tight hairpin switchbacks.',
        highwayCorridor: 'Hill Switchback Corridors',
        actionText: 'Inspect Passes',
        actionTab: 'weather',
      },
      {
        id: 'suv-4',
        category: 'Emergency & Prep',
        title: 'Carry Heavy-Duty Kinetic Tow Strap & D-Shackles',
        description:
          'Hill road recovery in remote Mid-Hill sections often depends on assistance from local tipper trucks or other jeeps. Keep a 5-ton kinetic tow strap handy.',
        highwayCorridor: 'Remote Corridors',
        actionText: 'Emergency SOS Guide',
        actionTab: 'pre-trip',
      },
    ],
  },
  motorbike: {
    type: 'motorbike',
    label: 'Motorcycle / Scooter',
    shortName: 'Motorbike',
    icon: Bike,
    color: 'text-orange-400 border-orange-500/30 bg-orange-500/10',
    badgeBg: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    featuredHeadline: 'For Motorbike: Watch for diesel spills on Prithvi & BP Highway hairpin switchbacks',
    featuredDescription:
      'Overloaded freight trucks frequently leak diesel on steep uphill curves. Stay centered in your lane and avoid hard front-braking on wet or shiny road patches.',
    featuredCorridor: 'Prithvi & BP Highways',
    tips: [
      {
        id: 'bike-1',
        category: 'Braking & Safety',
        title: 'For Motorbike: Watch for diesel spills on Prithvi & BP Highway hairpin switchbacks',
        description:
          'Overloaded freight trucks frequently leak diesel on steep uphill curves. Stay centered in your lane and avoid hard front-braking on wet or shiny road patches.',
        highwayCorridor: 'Prithvi & BP Highways',
        isPriority: true,
        actionText: 'Review Active Alerts',
        actionTab: 'incidents',
      },
      {
        id: 'bike-2',
        category: 'Corridor & Range',
        title: 'Sudden Temperature Drops at High Mountain Passes',
        description:
          'Passing Nagdhunga (1,500m) or Simbhanjyang (2,488m) brings rapid fog and 10°C temperature drops. Pack thermal windproof layers and clear visor backups.',
        highwayCorridor: 'Nagdhunga & Simbhanjyang',
        actionText: 'Check Pass Weather',
        actionTab: 'weather',
      },
      {
        id: 'bike-3',
        category: 'Braking & Safety',
        title: 'Engine Brake Down Naubise or Daunne to Avoid Disc Overheating',
        description:
          'Prolonged downhill braking down Naubise or Daunne Pass causes brake fluid boil and pad glazing. Use 2nd gear compression braking to regulate descent speed.',
        highwayCorridor: 'Naubise & Daunne Passes',
        actionText: 'Pass Elevation Profile',
        actionTab: 'weather',
      },
      {
        id: 'bike-4',
        category: 'Emergency & Prep',
        title: 'Fuel Up Before Entering 45+ km Rural Hill Corridors',
        description:
          'Fuel stations in rural hill sections (Mid-Hill, Ramechhap, Karnali) can be 45+ km apart and frequently face load-shedding pump downtime.',
        highwayCorridor: 'Mid-Hill & Rural Corridors',
        actionText: 'Pre-Trip Checklist',
        actionTab: 'pre-trip',
      },
    ],
  },
  bus_truck: {
    type: 'bus_truck',
    label: 'Bus / Heavy Commercial Truck',
    shortName: 'Bus/Truck',
    icon: Truck,
    color: 'text-purple-400 border-purple-500/30 bg-purple-500/10',
    badgeBg: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    featuredHeadline: 'For Bus/Truck: Rely on compression & exhaust braking down Daunne & Nagdhunga descents',
    featuredDescription:
      'Prevent catastrophic air brake thermal fade on steep 8%+ continuous mountain declines. Stay in low gear (2nd/3rd) and inspect pneumatic pressure gauges at crests.',
    featuredCorridor: 'East-West & Prithvi Highways',
    tips: [
      {
        id: 'truck-1',
        category: 'Braking & Safety',
        title: 'For Bus/Truck: Rely on compression & exhaust braking down Daunne & Nagdhunga descents',
        description:
          'Prevent catastrophic air brake thermal fade on steep 8%+ continuous mountain declines. Stay in low gear (2nd/3rd) and inspect pneumatic pressure gauges at crests.',
        highwayCorridor: 'East-West & Prithvi Highways',
        isPriority: true,
        actionText: 'Pass Slope Analysis',
        actionTab: 'weather',
      },
      {
        id: 'truck-2',
        category: 'Braking & Safety',
        title: 'Strict Single-Lane Passing Protocols Along Trishuli Gorge',
        description:
          'Use horn warnings 30m before blind rock outcroppings. Allow uphill heavy cargo vehicles the right of way to prevent hill-stall rollbacks.',
        highwayCorridor: 'Prithvi Highway Corridor',
        actionText: 'Traffic Chokepoints',
        actionTab: 'traffic',
      },
      {
        id: 'truck-3',
        category: 'Corridor & Range',
        title: 'Verify Tonnage Limits on Hill Bailey Bridges',
        description:
          'Older single-lane steel bridges on feeder roads and Mid-Hill Highway have 15-20 ton gross weight limits. Verify permit clearances before transit.',
        highwayCorridor: 'Mid-Hill & Feeder Bridges',
        actionText: 'Check Road Incidents',
        actionTab: 'incidents',
      },
      {
        id: 'truck-4',
        category: 'Emergency & Prep',
        title: 'Always Carry Wooden Wheel Chocks & Dual Warning Triangles',
        description:
          'Parking or stalling on mountain grades without mechanical chocks leads to severe runaway incidents. Deploy reflective warning triangles 50m behind.',
        highwayCorridor: 'All Mountain Corridors',
        actionText: 'Pre-Trip Checklist',
        actionTab: 'pre-trip',
      },
    ],
  },
};

const TRAVEL_STEPS: TravelStep[] = [
  {
    step: 1,
    id: 'route',
    title: 'Select Destination & Route',
    subtitle: 'Choose start, end, vehicle type, and preferred road profile.',
    icon: Compass,
    actionText: 'Open Route Planner',
    checklist: [
      'Select starting hub and destination city',
      'Choose vehicle: Car, 4WD SUV, Bus, or EV',
      'Select preference: Fastest, Safest, or Scenic',
    ],
    color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
  },
  {
    step: 2,
    id: 'incidents',
    title: 'Check Road Alerts & Safety',
    subtitle: 'Verify active landslides, rockfall hazards, and highway blockages.',
    icon: AlertTriangle,
    actionText: 'View Road Alerts Feed',
    checklist: [
      'Review DoR & Traffic Police verified incidents',
      'Check single-lane alternating sections',
      'Look for clearance time forecasts',
    ],
    color: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  },
  {
    step: 3,
    id: 'weather',
    title: 'Inspect Passes & Weather',
    subtitle: 'Check fog, rainfall, and freezing conditions at mountain ridges.',
    icon: CloudFog,
    actionText: 'View Mountain Passes Weather',
    checklist: [
      'Check visibility at high passes (e.g., Nagdhunga, Daunne)',
      'Confirm rain intensity and monsoon mud risks',
      'Ensure headlights and wipers are functional',
    ],
    color: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
  },
  {
    step: 4,
    id: 'traffic',
    title: 'Live Traffic & Speed Telemetry',
    subtitle: 'Monitor real-time bottlenecks, speed variances, and transit delays.',
    icon: Activity,
    actionText: 'Inspect Traffic & Speed',
    checklist: [
      'Check active chokepoints along corridor',
      'Compare live speed vs historical averages',
      'Pick optimal departure window to avoid queues',
    ],
    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  },
  {
    step: 5,
    id: 'prep',
    title: 'Pre-Trip Prep & Emergency SOS',
    subtitle: 'Download offline maps, verify fuel/charging, and save hotlines.',
    icon: ShieldAlert,
    actionText: 'Open Pre-Trip Checklist',
    checklist: [
      'Save offline highway pack in case cell network drops',
      'Review emergency hotlines: 100 (Police), 103 (Traffic), 1114 (DoR)',
      'Confirm spare tire, jack, and power bank ready',
    ],
    color: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
  },
];

export const TravelStepsGuide: React.FC<TravelStepsGuideProps> = ({
  onSelectTab,
  onOpenSos,
  onOpenPreTrip,
  onOpenOffline,
  onClose,
  activeRouteSummary,
  incidentCount,
  activeVehicle = 'electric_vehicle',
  onVehicleChange,
}) => {
  // Navigation mode: 'sequence' (5 steps) or 'tips' (Travel Tips section)
  const [guideMode, setGuideMode] = useState<'sequence' | 'tips'>('sequence');
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  // Dynamic Vehicle state for the Travel Tips section
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleType>(activeVehicle);

  // Tip filter category
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Track checked / acknowledged tips
  const [checkedTips, setCheckedTips] = useState<Record<string, boolean>>({});

  // Sync when activeVehicle changes externally
  useEffect(() => {
    if (activeVehicle) {
      setSelectedVehicle(activeVehicle);
    }
  }, [activeVehicle]);

  const currentStep = TRAVEL_STEPS[activeStepIndex];
  const activeVehicleConfig = VEHICLE_TIPS_DATA[selectedVehicle] || VEHICLE_TIPS_DATA.electric_vehicle;

  const handleStepAction = () => {
    if (currentStep.id === 'prep') {
      onOpenPreTrip();
    } else {
      onSelectTab(currentStep.id as SubViewTab);
    }
  };

  const handleVehicleSelect = (type: VehicleType) => {
    setSelectedVehicle(type);
    if (onVehicleChange) {
      onVehicleChange(type);
    }
  };

  const handleTipAction = (tip: VehicleTravelTip) => {
    if (tip.actionTab === 'pre-trip') {
      onOpenPreTrip();
    } else if (tip.actionTab === 'offline') {
      onOpenOffline();
    } else if (tip.actionTab) {
      onSelectTab(tip.actionTab);
    }
  };

  const toggleTipCheck = (id: string) => {
    setCheckedTips((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const filteredTips =
    selectedCategory === 'All'
      ? activeVehicleConfig.tips
      : activeVehicleConfig.tips.filter((t) => t.category === selectedCategory);

  const vehicleOptions: { type: VehicleType; label: string; icon: React.ElementType }[] = [
    { type: 'electric_vehicle', label: 'EV', icon: Zap },
    { type: 'car', label: 'Car', icon: Car },
    { type: 'suv_4wd', label: '4WD SUV', icon: Mountain },
    { type: 'motorbike', label: 'Bike', icon: Bike },
    { type: 'bus_truck', label: 'Bus/Truck', icon: Truck },
  ];

  const categories = ['All', 'Corridor & Range', 'Braking & Safety', 'Terrain & Incline', 'Emergency & Prep'];

  return (
    <div className="flex flex-col h-full text-slate-100 p-3 sm:p-4 space-y-3.5">
      {/* 1. Header with Mode Switcher & Close */}
      <div className="pb-2 border-b border-slate-800/80">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center space-x-1">
                <Compass className="w-3 h-3" />
                <span>Nepal Travel Protocol</span>
              </span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                {guideMode === 'sequence' ? `Step ${currentStep.step} of 5` : 'Travel Tips Active'}
              </span>
            </div>
            <h3 className="text-base font-extrabold text-white mt-0.5">
              {guideMode === 'sequence' ? 'What After What for Travel?' : 'Travel Tips & Recommendations'}
            </h3>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition"
            title="Close guide"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Primary View Mode Switcher: Travel Sequence vs Travel Tips */}
        <div className="grid grid-cols-2 gap-1.5 mt-2.5 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setGuideMode('sequence')}
            className={`py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 transition ${
              guideMode === 'sequence'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Sequence (5 Steps)</span>
          </button>

          <button
            id="travel-tips-mode-btn"
            onClick={() => setGuideMode('tips')}
            className={`py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 transition ${
              guideMode === 'tips'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Lightbulb className="w-3.5 h-3.5" />
            <span>Travel Tips</span>
            <span
              className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono uppercase ${
                guideMode === 'tips'
                  ? 'bg-slate-950 text-amber-300 font-black'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              }`}
            >
              {activeVehicleConfig.shortName}
            </span>
          </button>
        </div>
      </div>

      {/* 2. MODE A: SEQUENTIAL GUIDE (STEPS 1 - 5) */}
      {guideMode === 'sequence' && (
        <div className="flex-1 flex flex-col justify-between space-y-3.5">
          {/* Step Navigation Pills */}
          <div className="grid grid-cols-5 gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
            {TRAVEL_STEPS.map((s, idx) => {
              const Icon = s.icon;
              const isActive = idx === activeStepIndex;
              const isPassed = idx < activeStepIndex;

              return (
                <button
                  key={s.step}
                  onClick={() => setActiveStepIndex(idx)}
                  className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg text-center transition ${
                    isActive
                      ? 'bg-amber-500 text-slate-950 font-black shadow'
                      : isPassed
                      ? 'text-amber-400 hover:bg-slate-800/60'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                  title={`Step ${s.step}: ${s.title}`}
                >
                  <div className="flex items-center space-x-0.5">
                    {isPassed ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                  </div>
                  <span className="text-[10px] font-bold mt-1 leading-none hidden sm:block">
                    {s.step}. {s.title.split(' ')[0]}
                  </span>
                  <span className="text-[9px] font-bold mt-1 leading-none sm:hidden">
                    {s.step}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Current Step Focused Content */}
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <div className={`p-3 rounded-xl border ${currentStep.color} shrink-0`}>
                {React.createElement(currentStep.icon, { className: 'w-6 h-6' })}
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                  Step {currentStep.step} of 5
                </div>
                <h4 className="text-base sm:text-lg font-black text-white leading-snug">
                  {currentStep.title}
                </h4>
                <p className="text-xs text-slate-300 mt-0.5">{currentStep.subtitle}</p>
              </div>
            </div>

            {/* Quick Context Summary */}
            {activeRouteSummary && currentStep.step === 1 && (
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs flex items-center justify-between text-slate-300">
                <span className="font-semibold text-white">
                  {activeRouteSummary.originName} ➔ {activeRouteSummary.destinationName}
                </span>
                <span className="text-amber-400 font-mono">
                  {activeRouteSummary.distanceKm} km • {Math.round(activeRouteSummary.durationMinutes / 60)}h{' '}
                  {activeRouteSummary.durationMinutes % 60}m
                </span>
              </div>
            )}

            {currentStep.step === 2 && (
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs flex items-center justify-between text-slate-300">
                <span>Active road incidents reported:</span>
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold font-mono">
                  {incidentCount} Alerts Active
                </span>
              </div>
            )}

            {/* Dynamic Travel Tip Callout Banner in Step 1 & Step 5 */}
            <div
              id="embedded-travel-tip-banner"
              className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  <div className="p-1 rounded bg-amber-500/20 text-amber-400">
                    <Lightbulb className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                    Travel Tip for {activeVehicleConfig.label}
                  </span>
                </div>
                <button
                  onClick={() => setGuideMode('tips')}
                  className="text-[10px] text-cyan-400 hover:text-cyan-300 font-semibold flex items-center space-x-1"
                >
                  <span>All Tips</span>
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              <div className="text-xs font-bold text-white leading-snug">
                "{activeVehicleConfig.featuredHeadline}"
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                {activeVehicleConfig.featuredDescription}
              </p>

              <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400">
                <span className="font-mono text-cyan-400">Corridor: {activeVehicleConfig.featuredCorridor}</span>
                <button
                  onClick={() => setGuideMode('tips')}
                  className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 hover:bg-slate-700 transition"
                >
                  Switch to Tips View
                </button>
              </div>
            </div>

            {/* Checklist */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Recommended Actions:
              </span>
              <ul className="space-y-1.5">
                {currentStep.checklist.map((item, i) => (
                  <li key={i} className="flex items-center space-x-2 text-xs text-slate-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Action Button & Next/Back for Current Step */}
          <div className="space-y-2 pt-2 border-t border-slate-800/80">
            <button
              onClick={handleStepAction}
              className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center space-x-2 transition shadow-lg shadow-amber-500/20"
            >
              <span>{currentStep.actionText}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => setActiveStepIndex((prev) => Math.max(0, prev - 1))}
                disabled={activeStepIndex === 0}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1 transition ${
                  activeStepIndex === 0
                    ? 'text-slate-600 cursor-not-allowed'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>

              <span className="text-[10px] text-slate-400 font-mono">
                Step {activeStepIndex + 1} / {TRAVEL_STEPS.length}
              </span>

              <button
                onClick={() => setActiveStepIndex((prev) => Math.min(TRAVEL_STEPS.length - 1, prev + 1))}
                disabled={activeStepIndex === TRAVEL_STEPS.length - 1}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1 transition ${
                  activeStepIndex === TRAVEL_STEPS.length - 1
                    ? 'text-slate-600 cursor-not-allowed'
                    : 'text-amber-400 hover:text-amber-300 hover:bg-slate-800'
                }`}
              >
                <span>Next Step</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. MODE B: DEDICATED TRAVEL TIPS SECTION (Vehicle-Adaptive) */}
      {guideMode === 'tips' && (
        <div id="travel-tips-section" className="flex-1 flex flex-col space-y-3.5 overflow-y-auto pr-0.5 custom-scrollbar">
          {/* Vehicle Selector Tabs */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
                <Gauge className="w-3.5 h-3.5 text-cyan-400" />
                <span>Active Vehicle Profile:</span>
              </span>
              {activeRouteSummary && (
                <span className="text-[10px] text-amber-400 font-mono">
                  {activeRouteSummary.originName} ➔ {activeRouteSummary.destinationName}
                </span>
              )}
            </div>

            {/* Vehicle Selector Pills */}
            <div className="grid grid-cols-5 gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
              {vehicleOptions.map((opt) => {
                const Icon = opt.icon;
                const isSelected = selectedVehicle === opt.type;
                const isRouteVehicle = activeVehicle === opt.type;

                return (
                  <button
                    key={opt.type}
                    onClick={() => handleVehicleSelect(opt.type)}
                    className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg text-center transition relative ${
                      isSelected
                        ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    }`}
                    title={`View travel tips for ${opt.label}`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-[10px] font-bold mt-1 leading-none">{opt.label}</span>
                    {isRouteVehicle && (
                      <span
                        className={`absolute -top-1 -right-0.5 w-2 h-2 rounded-full ${
                          isSelected ? 'bg-slate-950' : 'bg-emerald-400'
                        }`}
                        title="Currently active trip vehicle"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Featured Priority Tip Banner */}
          <div
            id="featured-vehicle-tip-card"
            className="p-3.5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-amber-500/40 shadow-xl space-y-2.5 relative overflow-hidden"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                  {React.createElement(activeVehicleConfig.icon, { className: 'w-5 h-5' })}
                </div>
                <div>
                  <div className="flex items-center space-x-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                      Featured Travel Tip
                    </span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 font-mono">
                      {activeVehicleConfig.label}
                    </span>
                  </div>
                  <span className="text-[10px] text-cyan-400 font-mono">
                    Corridor: {activeVehicleConfig.featuredCorridor}
                  </span>
                </div>
              </div>

              {selectedVehicle === activeVehicle && (
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold shrink-0">
                  Trip Vehicle
                </span>
              )}
            </div>

            {/* Exact Featured Headline (e.g. For EV: Check charging station spacing on Prithvi Highway) */}
            <h4 className="text-sm sm:text-base font-extrabold text-white leading-snug">
              {activeVehicleConfig.featuredHeadline}
            </h4>

            <p className="text-xs text-slate-300 leading-relaxed">
              {activeVehicleConfig.featuredDescription}
            </p>

            {/* Quick Action for Featured Tip */}
            <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
              <div className="flex items-center space-x-1.5 text-[10px] text-slate-400">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Verified Nepal Highway Safety Standard</span>
              </div>

              {selectedVehicle === 'electric_vehicle' && (
                <button
                  onClick={() => onSelectTab('pois')}
                  className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[10px] flex items-center space-x-1 transition shadow-sm"
                >
                  <Zap className="w-3 h-3 fill-current" />
                  <span>View Fast Chargers</span>
                </button>
              )}

              {selectedVehicle === 'car' && (
                <button
                  onClick={() => onSelectTab('incidents')}
                  className="px-2.5 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-[10px] flex items-center space-x-1 transition shadow-sm"
                >
                  <AlertTriangle className="w-3 h-3" />
                  <span>Check Road Ruts</span>
                </button>
              )}

              {selectedVehicle === 'suv_4wd' && (
                <button
                  onClick={() => onOpenPreTrip()}
                  className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[10px] flex items-center space-x-1 transition shadow-sm"
                >
                  <Mountain className="w-3 h-3" />
                  <span>4WD Inspection</span>
                </button>
              )}

              {selectedVehicle === 'motorbike' && (
                <button
                  onClick={() => onSelectTab('weather')}
                  className="px-2.5 py-1 rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-950 font-bold text-[10px] flex items-center space-x-1 transition shadow-sm"
                >
                  <CloudFog className="w-3 h-3" />
                  <span>Pass Fog & Rain</span>
                </button>
              )}

              {selectedVehicle === 'bus_truck' && (
                <button
                  onClick={() => onSelectTab('traffic')}
                  className="px-2.5 py-1 rounded-lg bg-purple-500 hover:bg-purple-400 text-slate-950 font-bold text-[10px] flex items-center space-x-1 transition shadow-sm"
                >
                  <Truck className="w-3 h-3" />
                  <span>Chokepoint Queues</span>
                </button>
              )}
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center space-x-1 overflow-x-auto pb-1 text-[10px] custom-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2 py-1 rounded-lg font-bold whitespace-nowrap transition ${
                  selectedCategory === cat
                    ? 'bg-slate-700 text-white border border-slate-600'
                    : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Tactical Tips List */}
          <div className="space-y-2.5">
            {filteredTips.map((tip) => {
              const isChecked = !!checkedTips[tip.id];

              return (
                <div
                  key={tip.id}
                  className={`p-3 rounded-xl border transition space-y-2 ${
                    isChecked
                      ? 'bg-slate-950/60 border-slate-800/60 opacity-80'
                      : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start space-x-2 min-w-0">
                      <button
                        onClick={() => toggleTipCheck(tip.id)}
                        className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition ${
                          isChecked
                            ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                            : 'border-slate-600 hover:border-slate-400 text-transparent'
                        }`}
                        title={isChecked ? 'Mark as unread' : 'Mark as reviewed'}
                      >
                        <Check className="w-3 h-3 stroke-[3]" />
                      </button>

                      <div className="min-w-0">
                        <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-cyan-300 font-mono font-semibold">
                            {tip.category}
                          </span>
                          {tip.highwayCorridor && (
                            <span className="text-[9px] text-slate-400 font-mono truncate">
                              • {tip.highwayCorridor}
                            </span>
                          )}
                          {tip.isPriority && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                              Key Recommendation
                            </span>
                          )}
                        </div>

                        <h5
                          className={`text-xs font-bold mt-1 leading-snug ${
                            isChecked ? 'line-through text-slate-400' : 'text-white'
                          }`}
                        >
                          {tip.title}
                        </h5>
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-300 leading-relaxed pl-6">
                    {tip.description}
                  </p>

                  {tip.actionText && (
                    <div className="flex items-center justify-end pl-6 pt-1">
                      <button
                        onClick={() => handleTipAction(tip)}
                        className="text-[10px] font-bold text-amber-400 hover:text-amber-300 flex items-center space-x-1 transition"
                      >
                        <span>{tip.actionText}</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bottom Action / Return to Sequence */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <button
              onClick={() => setGuideMode('sequence')}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold flex items-center space-x-1.5 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to 5-Step Sequence</span>
            </button>

            <button
              onClick={onOpenPreTrip}
              className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black flex items-center space-x-1.5 transition shadow-md shadow-amber-500/20"
            >
              <span>Pre-Trip Checklist</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

