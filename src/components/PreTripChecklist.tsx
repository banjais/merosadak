import React, { useState, useEffect, useMemo } from 'react';
import { RoutePlanResult, VehicleType, HighwayWeatherNode } from '../types';
import { HIGHWAY_WEATHER_NODES } from '../data/nepalHighwaysData';
import {
  CheckSquare,
  Square,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  FileText,
  Gauge,
  Wrench,
  CloudRain,
  Mountain,
  Zap,
  Bike,
  Car,
  Truck,
  Sparkles,
  RotateCcw,
  Copy,
  Check,
  ExternalLink,
  Info,
  ChevronDown,
  ChevronUp,
  BatteryCharging,
  PhoneCall,
  Compass,
  ThermometerSnowflake,
  Sun,
  Eye,
  PlusCircle,
  Percent,
  Luggage,
  Shirt,
  Pill,
  Coffee,
  Flame,
  Umbrella,
  Glasses,
  ShoppingBag,
} from 'lucide-react';

interface PreTripChecklistProps {
  routePlan: RoutePlanResult;
  vehicle: VehicleType;
}

export type ChecklistCategory =
  | 'all'
  | 'documents'
  | 'vehicle_tires'
  | 'emergency_tools'
  | 'weather_mountain'
  | 'packing_list';
export type ChecklistPriority = 'mandatory' | 'recommended';

export interface ChecklistItem {
  id: string;
  title: string;
  category: 'documents' | 'vehicle_tires' | 'emergency_tools' | 'weather_mountain' | 'packing_list';
  priority: ChecklistPriority;
  description: string;
  triggerReason: string;
  triggerType: 'statutory' | 'terrain' | 'weather' | 'vehicle' | 'distance';
  icon: React.ComponentType<{ className?: string }>;
  packingSubtype?: 'cold_elevation' | 'monsoon_rain' | 'first_aid' | 'logistics_power' | 'vehicle_specific';
}

export const PreTripChecklist: React.FC<PreTripChecklistProps> = ({
  routePlan,
  vehicle,
}) => {
  const [checkedIds, setCheckedIds] = useState<Record<string, boolean>>({});
  const [selectedCategory, setSelectedCategory] = useState<ChecklistCategory>('all');
  const [filterPriority, setFilterPriority] = useState<'all' | 'mandatory' | 'recommended'>('all');
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [copiedText, setCopiedText] = useState<boolean>(false);
  const [activePackingSubtype, setActivePackingSubtype] = useState<string>('all');

  // Storage key for caching checked state per origin-dest-vehicle
  const storageKey = useMemo(() => {
    return `mero_sadak_checklist_${routePlan.origin.id}_${routePlan.destination.id}_${vehicle}`;
  }, [routePlan.origin.id, routePlan.destination.id, vehicle]);

  // Load checked items from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setCheckedIds(JSON.parse(saved));
      } else {
        setCheckedIds({});
      }
    } catch {
      setCheckedIds({});
    }
  }, [storageKey]);

  // Save checked items to localStorage
  const toggleCheck = (id: string) => {
    setCheckedIds((prev) => {
      const updated = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to persist checklist state', e);
      }
      return updated;
    });
  };

  const checkAll = () => {
    const allChecked: Record<string, boolean> = {};
    activeItems.forEach((item) => {
      allChecked[item.id] = true;
    });
    setCheckedIds(allChecked);
    try {
      localStorage.setItem(storageKey, JSON.stringify(allChecked));
    } catch {}
  };

  const resetAll = () => {
    setCheckedIds({});
    try {
      localStorage.removeItem(storageKey);
    } catch {}
  };

  // Inspect weather conditions along the route
  const detectedWeather = useMemo(() => {
    const routeCoords = routePlan.pathCoordinates || [];
    const matchedWeatherNodes: HighwayWeatherNode[] = [];

    HIGHWAY_WEATHER_NODES.forEach((wx) => {
      // Check if weather node is near route path or connected hubs
      const isNearby = routeCoords.some(
        ([lat, lng]) => Math.abs(lat - wx.lat) < 0.25 && Math.abs(lng - wx.lng) < 0.25
      );
      const isOriginOrDest =
        (Math.abs(routePlan.origin.lat - wx.lat) < 0.3 && Math.abs(routePlan.origin.lng - wx.lng) < 0.3) ||
        (Math.abs(routePlan.destination.lat - wx.lat) < 0.3 && Math.abs(routePlan.destination.lng - wx.lng) < 0.3);

      if (isNearby || isOriginOrDest) {
        matchedWeatherNodes.push(wx);
      }
    });

    const hasRain = matchedWeatherNodes.some(
      (w) => w.condition === 'rain_monsoon' || w.condition === 'thunderstorm' || w.condition === 'mountain_shower'
    );
    const hasFog = matchedWeatherNodes.some((w) => w.condition === 'dense_fog' || w.visibilityKm < 2.0);
    const hasHighLandslideRisk = matchedWeatherNodes.some(
      (w) => w.landslideRisk === 'high' || w.landslideRisk === 'severe'
    );
    const hasSlipperyGrip = matchedWeatherNodes.some(
      (w) => w.roadGrip === 'mud_slippery' || w.roadGrip === 'wet_caution'
    );

    return {
      nodes: matchedWeatherNodes,
      hasRain,
      hasFog,
      hasHighLandslideRisk,
      hasSlipperyGrip,
    };
  }, [routePlan]);

  // Inspect terrain characteristics
  const detectedTerrain = useMemo(() => {
    const maxAlt = routePlan.maxElevationM || Math.max(routePlan.origin.elevationM, routePlan.destination.elevationM);
    const elevationGain = routePlan.elevationGainM || 0;
    const isHighAltitude = maxAlt > 1400 || elevationGain > 1000;
    const isSteepPass = maxAlt > 1800 || elevationGain > 1600;
    const isLongDistance = routePlan.totalDistanceKm > 140 || routePlan.estimatedTimeMinutes > 240;

    const hasRoughSegments = routePlan.steps.some(
      (s) => s.surface === 'gravel' || s.surface === 'under_construction' || s.surface === 'offroad_mud'
    );

    return {
      maxAlt,
      elevationGain,
      isHighAltitude,
      isSteepPass,
      isLongDistance,
      hasRoughSegments,
    };
  }, [routePlan]);

  // Generate dynamic checklist items
  const activeItems: ChecklistItem[] = useMemo(() => {
    const list: ChecklistItem[] = [];

    // ─────────────────────────────────────────────
    // 1. STATUTORY DOCUMENTS & COMPLIANCE
    // ─────────────────────────────────────────────
    list.push({
      id: 'doc-bluebook',
      title: 'Vehicle Blue Book (सवारी दर्ता किताब)',
      category: 'documents',
      priority: 'mandatory',
      description: 'Ensure vehicle registration booklet is on board with valid fiscal year road tax payment stamp.',
      triggerReason: 'Mandatory by Nepal Traffic Police at highway checkpoints',
      triggerType: 'statutory',
      icon: FileText,
    });

    list.push({
      id: 'doc-license',
      title: 'Valid Driving License (सवारी चालक अनुमति पत्र)',
      category: 'documents',
      priority: 'mandatory',
      description: 'Valid physical smart card license or active Nagarik App QR code for the matching vehicle category.',
      triggerReason: 'Mandatory verification along inter-district highway posts',
      triggerType: 'statutory',
      icon: FileText,
    });

    list.push({
      id: 'doc-insurance',
      title: 'Third-Party / Comprehensive Motor Insurance',
      category: 'documents',
      priority: 'mandatory',
      description: 'Active motor insurance certificate required for highway toll gates and accidental liabilities.',
      triggerReason: 'Legal requirement for all public and private motor transit',
      triggerType: 'statutory',
      icon: ShieldCheck,
    });

    list.push({
      id: 'doc-green-sticker',
      title: 'Green Pollution Sticker (हरियो स्टिकर)',
      category: 'documents',
      priority: 'recommended',
      description: 'Valid vehicle emission test pass sticker, especially enforced when exiting Kathmandu Valley.',
      triggerReason: 'Strictly inspected at Nagdhunga, Bhaktapur & valley checkposts',
      triggerType: 'statutory',
      icon: Sparkles,
    });

    // ─────────────────────────────────────────────
    // 2. VEHICLE HEALTH & TIRE PRESSURE (PSI)
    // ─────────────────────────────────────────────
    // Dynamic PSI recommendation based on vehicle & terrain
    let recommendedPsi = '32 - 34 PSI (Cold)';
    if (vehicle === 'electric_vehicle') {
      recommendedPsi = '35 - 38 PSI (EV optimized low-drag)';
    } else if (vehicle === 'suv_4wd') {
      recommendedPsi = '30 - 32 PSI (Highway) / 24 PSI (Mud/Gravel)';
    } else if (vehicle === 'motorbike') {
      recommendedPsi = '28 Front / 32 Rear PSI';
    } else if (vehicle === 'bus_truck') {
      recommendedPsi = '100 - 110 PSI Dual Wheels';
    }

    list.push({
      id: 'veh-tire-pressure',
      title: `Tire Cold Pressure Calibration (${recommendedPsi})`,
      category: 'vehicle_tires',
      priority: 'mandatory',
      description: `Measure cold tire PSI before driving. ${
        detectedTerrain.isHighAltitude
          ? 'Air expands under elevation and heating; inspect before ascending passes.'
          : 'High highway speeds increase tire friction temperature.'
      }`,
      triggerReason: `Calibrated for ${vehicle.replace('_', ' ')} on ${routePlan.origin.name} ➔ ${routePlan.destination.name}`,
      triggerType: 'terrain',
      icon: Gauge,
    });

    list.push({
      id: 'veh-tire-tread',
      title: 'Tread Depth & Sidewall Inspection (> 3.5mm)',
      category: 'vehicle_tires',
      priority: detectedWeather.hasRain || detectedWeather.hasSlipperyGrip ? 'mandatory' : 'recommended',
      description: 'Ensure adequate wet-grip channels to prevent hydroplaning across riverbed spray and wet tarmac.',
      triggerReason: detectedWeather.hasRain
        ? 'Monsoon rain and wet road grip detected on this route'
        : 'Essential for mountain hairpin stability',
      triggerType: 'weather',
      icon: ShieldAlert,
    });

    list.push({
      id: 'veh-brake-fluid',
      title: 'Brake Fluid Level & Pad Thickness Check',
      category: 'vehicle_tires',
      priority: detectedTerrain.isHighAltitude || detectedTerrain.elevationGain > 600 ? 'mandatory' : 'recommended',
      description: 'Mountain descents generate extreme friction heat. Check DOT4 fluid boiling point and pad lining thickness.',
      triggerReason: `Climb/Descent of +${detectedTerrain.elevationGain}m requires heavy engine and hydraulic braking`,
      triggerType: 'terrain',
      icon: Wrench,
    });

    list.push({
      id: 'veh-coolant-radiator',
      title: 'Engine Coolant & Radiator Reservoir',
      category: 'vehicle_tires',
      priority: vehicle !== 'electric_vehicle' ? 'mandatory' : 'recommended',
      description: 'Verify 50/50 anti-freeze coolant blend to prevent hill-climb engine overheating in uphill crawling queues.',
      triggerReason: 'Heavy uphill load on mountain passes (Nagdhunga, Daunne, Sindhuli)',
      triggerType: 'terrain',
      icon: ThermometerSnowflake,
    });

    list.push({
      id: 'veh-windshield-wipers',
      title: 'Wiper Blades & Hydrophobic Washer Fluid',
      category: 'vehicle_tires',
      priority: detectedWeather.hasRain || detectedWeather.hasFog ? 'mandatory' : 'recommended',
      description: 'Clean rubber wiper blades and top up windshield washer reservoir to handle muddy highway spray from freight trucks.',
      triggerReason: detectedWeather.hasRain ? 'Active rainfall and road spray detected' : 'Road widening dust mitigation',
      triggerType: 'weather',
      icon: CloudRain,
    });

    // Vehicle Specific Hardware Checks
    if (vehicle === 'electric_vehicle') {
      list.push({
        id: 'veh-ev-charger-cable',
        title: 'Type-2 / CCS2 Portable Emergency Charger Cable',
        category: 'vehicle_tires',
        priority: 'mandatory',
        description: 'Pack standard 15A/16A 3-pin trickle charging cable with heavy-duty extension cord for emergency tea lodge stops.',
        triggerReason: 'Essential EV lifeline for remote Nepal mountain corridors',
        triggerType: 'vehicle',
        icon: BatteryCharging,
      });

      list.push({
        id: 'veh-ev-app-cache',
        title: 'EV Charging App Offline Session & Wallet Balance',
        category: 'vehicle_tires',
        priority: 'mandatory',
        description: 'Ensure NEA / Drivegreen / ChargePoint apps are logged in with loaded wallet balance before entering zero-network zones.',
        triggerReason: 'Zero cellular connectivity on Trishuli & Karnali gorges',
        triggerType: 'vehicle',
        icon: Zap,
      });
    } else if (vehicle === 'motorbike') {
      list.push({
        id: 'veh-moto-gear',
        title: 'ISI/DOT Certified Helmet & Armored Riding Gear',
        category: 'vehicle_tires',
        priority: 'mandatory',
        description: 'Full-face helmet with scratch-free clear visor, armored jacket, knee guards, and waterproof winter riding gloves.',
        triggerReason: 'High vulnerability on single-lane mountain overtaking zones',
        triggerType: 'vehicle',
        icon: Bike,
      });

      list.push({
        id: 'veh-moto-chain',
        title: 'Drive Chain Tension & Lubrication',
        category: 'vehicle_tires',
        priority: 'recommended',
        description: 'Clean and lube chain with heavy wax to resist gritty dirt and river gravel runoff.',
        triggerReason: 'Heavy dust and gravel wear on highway segments',
        triggerType: 'vehicle',
        icon: Wrench,
      });
    } else if (vehicle === 'suv_4wd') {
      list.push({
        id: 'veh-4wd-transfer-case',
        title: '4x4 Low Range & Differential Lock Engagement',
        category: 'vehicle_tires',
        priority: detectedTerrain.hasRoughSegments ? 'mandatory' : 'recommended',
        description: 'Test 4H and 4L transfer case engagement to ensure smooth lock before encountering river crossings or steep mud.',
        triggerReason: detectedTerrain.hasRoughSegments ? 'Unpaved / gravel segments on route' : 'Mountain terrain readiness',
        triggerType: 'vehicle',
        icon: Mountain,
      });
    } else if (vehicle === 'bus_truck') {
      list.push({
        id: 'veh-truck-airbrake',
        title: 'Air Brake Pneumatic Reservoir Pressure (> 8.5 Bar)',
        category: 'vehicle_tires',
        priority: 'mandatory',
        description: 'Test dual-circuit air compression build-up and check for stone debris lodged between rear dual tires.',
        triggerReason: 'Heavy commercial transit safety on mountain grades',
        triggerType: 'vehicle',
        icon: Truck,
      });
    }

    // ─────────────────────────────────────────────
    // 3. EMERGENCY, TOOLS & SAFETY GEAR
    // ─────────────────────────────────────────────
    list.push({
      id: 'emg-spare-tire-jack',
      title: 'Inflated Spare Tire, Hydraulic Jack & Lug Wrench',
      category: 'emergency_tools',
      priority: 'mandatory',
      description: 'Check that spare tire is fully inflated to at least 34 PSI and that the jack, handle, and lug wrench are present.',
      triggerReason: 'Remote roadside mechanics are spaced 20–40 km apart in gorges',
      triggerType: 'distance',
      icon: Wrench,
    });

    list.push({
      id: 'emg-puncture-kit-pump',
      title: '12V Electric Tire Inflator & Tubeless Plug Kit',
      category: 'emergency_tools',
      priority: 'mandatory',
      description: 'Enables quick 10-minute puncture repair on the roadside without having to dismount the heavy wheel.',
      triggerReason: 'Essential for sharp rock shale and ongoing construction zones',
      triggerType: 'terrain',
      icon: AlertTriangle,
    });

    list.push({
      id: 'emg-tow-strap',
      title: 'Heavy-Duty Tow Strap / Rope (min 3-Ton) with Shackles',
      category: 'emergency_tools',
      priority: detectedTerrain.hasRoughSegments || detectedWeather.hasHighLandslideRisk ? 'mandatory' : 'recommended',
      description: 'High-strength nylon tow strap for pulling out of mud slush or towing disabled vehicles to safe shoulders.',
      triggerReason: 'Active landslide & mud slush risk along hill sections',
      triggerType: 'terrain',
      icon: Compass,
    });

    list.push({
      id: 'emg-hazard-triangle',
      title: 'Reflective Hazard Triangle & High-Vis Vest',
      category: 'emergency_tools',
      priority: 'mandatory',
      description: 'Place 50 meters behind the vehicle in the event of an emergency stop on blind mountain curves.',
      triggerReason: 'Mandatory safety protocol for narrow highway shoulders',
      triggerType: 'statutory',
      icon: AlertTriangle,
    });

    list.push({
      id: 'emg-jump-starter',
      title: 'Battery Jump Starter Powerbank or Jumper Cables',
      category: 'emergency_tools',
      priority: 'recommended',
      description: 'Protects against sudden 12V battery drain in cold mountain temperatures or stalled restarts.',
      triggerReason: 'Remote mountain valleys with limited emergency electrical services',
      triggerType: 'distance',
      icon: Zap,
    });

    list.push({
      id: 'emg-flashlight',
      title: 'High-Lumen LED Flashlight / Rechargeable Headlamp',
      category: 'emergency_tools',
      priority: 'mandatory',
      description: 'Hands-free illumination for night-time wheel changes, engine checks, or roadside warning flags.',
      triggerReason: 'Unlit rural highway stretches and dark mountain passes',
      triggerType: 'distance',
      icon: Sun,
    });

    list.push({
      id: 'emg-hotlines-saved',
      title: 'Saved Nepal Emergency Hotlines (103, 1114, 100)',
      category: 'emergency_tools',
      priority: 'mandatory',
      description: 'Nepal Traffic Police: 103 | DOR Roads Helpline: 1114 | Police Control: 100 | Red Cross Ambulance: 102.',
      triggerReason: 'Instant access during emergency obstructions or medical dispatch',
      triggerType: 'statutory',
      icon: PhoneCall,
    });

    // ─────────────────────────────────────────────
    // 4. TERRAIN & WEATHER SPECIFIC ESSENTIALS
    // ─────────────────────────────────────────────
    if (detectedTerrain.isHighAltitude) {
      list.push({
        id: 'wx-altitude-first-aid',
        title: 'High Altitude First-Aid, Diamox & Electrolytes',
        category: 'weather_mountain',
        priority: 'mandatory',
        description: 'Pack oral rehydration salts (ORS/Jeevan Jal), motion sickness pills, bandages, and Diamox if traveling > 2,000m.',
        triggerReason: `Climbing to peak elevation of ${detectedTerrain.maxAlt}m ASL on this corridor`,
        triggerType: 'terrain',
        icon: Mountain,
      });

      list.push({
        id: 'wx-warm-clothing',
        title: 'Thermal Jackets, Woolen Blankets & Warm Layers',
        category: 'weather_mountain',
        priority: 'mandatory',
        description: 'Mountain pass temperatures drop sharply after sunset; pack thermal wear in cabin, not locked in trunk.',
        triggerReason: `High-elevation pass climate (${detectedTerrain.maxAlt}m ASL)`,
        triggerType: 'terrain',
        icon: ThermometerSnowflake,
      });
    }

    if (detectedWeather.hasRain) {
      list.push({
        id: 'wx-rain-gear',
        title: 'Heavy Rain Umbrellas & Waterproof Ponchos',
        category: 'weather_mountain',
        priority: 'mandatory',
        description: 'Keep umbrellas and waterproof jackets within arm’s reach in the cabin for sudden roadblock inspections.',
        triggerReason: 'Active monsoon / mountain rain detected along highway sectors',
        triggerType: 'weather',
        icon: CloudRain,
      });

      list.push({
        id: 'wx-anti-fog-wipe',
        title: 'Anti-Fog Microfiber Wipes & Silica Gel Defroster',
        category: 'weather_mountain',
        priority: 'recommended',
        description: 'Prevents interior windshield condensation caused by cold outside rain and cabin moisture.',
        triggerReason: 'High humidity & rain triggering windshield fogging',
        triggerType: 'weather',
        icon: Eye,
      });
    }

    if (detectedWeather.hasFog) {
      list.push({
        id: 'wx-fog-lights',
        title: 'Yellow Low-Beam Fog Lamps Alignment',
        category: 'weather_mountain',
        priority: 'mandatory',
        description: 'Ensure low beams and amber fog lights are functional; avoid high beams which reflect back in dense white mist.',
        triggerReason: 'Dense mountain fog (<2km visibility) detected at pass approaches',
        triggerType: 'weather',
        icon: Sun,
      });
    }

    // Long distance rations
    if (detectedTerrain.isLongDistance) {
      list.push({
        id: 'wx-rations-water',
        title: 'Emergency Drinking Water (3L+) & Dry Food Rations',
        category: 'weather_mountain',
        priority: 'mandatory',
        description: 'Pack bottled drinking water, beaten rice (chiura), roasted nuts, and energy bars in case of multi-hour landslide closures.',
        triggerReason: `Long journey (${routePlan.totalDistanceKm} km, ~${Math.floor(routePlan.estimatedTimeMinutes / 60)}h) with limited supply shops`,
        triggerType: 'distance',
        icon: Info,
      });

      list.push({
        id: 'wx-powerbank-offline-map',
        title: '20,000mAh Powerbank & Pre-downloaded Offline Map',
        category: 'weather_mountain',
        priority: 'mandatory',
        description: 'Ensure mobile phone is preloaded with Mero Sadak offline cache before cell towers lose power in remote valleys.',
        triggerReason: 'Cellular blackspots along deep river valleys (Trishuli, Marshyangdi, Karnali)',
        triggerType: 'distance',
        icon: BatteryCharging,
      });
    }

    // ─────────────────────────────────────────────
    // 5. SUGGESTED PACKING LIST (ELEVATION & PREDICTED WEATHER ADAPTIVE)
    // ─────────────────────────────────────────────

    // A. High-Altitude & Mountain Pass Thermal Layering
    if (detectedTerrain.isHighAltitude || detectedTerrain.maxAlt > 1300) {
      list.push({
        id: 'pack-thermal-jacket',
        title: 'Heavy Windproof Down Jacket & Thermal Base Layer',
        category: 'packing_list',
        packingSubtype: 'cold_elevation',
        priority: detectedTerrain.isSteepPass ? 'mandatory' : 'recommended',
        description: `Pack thermal merino base layers and a high-loft windproof jacket in the cabin. Summit temperatures at ${detectedTerrain.maxAlt}m ASL can plummet rapidly at sunset.`,
        triggerReason: `High-elevation pass climb (+${detectedTerrain.elevationGain}m gain to ${detectedTerrain.maxAlt}m ASL)`,
        triggerType: 'terrain',
        icon: Shirt,
      });

      list.push({
        id: 'pack-beanie-gloves',
        title: 'Fleece Beanie / Monkey Cap & Insulated Windproof Gloves',
        category: 'packing_list',
        packingSubtype: 'cold_elevation',
        priority: detectedTerrain.maxAlt > 1700 ? 'mandatory' : 'recommended',
        description: 'Protects extremities from severe mountain pass draft during tire inspections or viewpoint stops.',
        triggerReason: `Exposed high-altitude wind chill at summits exceeding ${detectedTerrain.maxAlt}m`,
        triggerType: 'terrain',
        icon: ThermometerSnowflake,
      });

      list.push({
        id: 'pack-thermos-flask',
        title: 'Vacuum Insulated Thermos (1L+) with Boiled Water / Ginger Tea',
        category: 'packing_list',
        packingSubtype: 'cold_elevation',
        priority: 'mandatory',
        description: 'Hot fluids aid hydration and core body temperature retention during high-altitude chill and sudden traffic jams.',
        triggerReason: `Cold mountain corridor (${detectedTerrain.maxAlt}m ASL) with prolonged transit times`,
        triggerType: 'terrain',
        icon: Coffee,
      });

      list.push({
        id: 'pack-thermal-foil-blanket',
        title: 'Emergency Thermal Foil Space Blanket (Cabin Stash)',
        category: 'packing_list',
        packingSubtype: 'cold_elevation',
        priority: 'recommended',
        description: 'Ultra-compact silver Mylar emergency blanket to reflect 90% body heat in case of stranded roadside halts.',
        triggerReason: 'Remote mountain passes with sub-10°C night drops',
        triggerType: 'terrain',
        icon: Sparkles,
      });

      list.push({
        id: 'pack-glacier-sunglasses',
        title: 'UV400 Polarized Sunglasses & Lip Balm / Sunscreen SPF50',
        category: 'packing_list',
        packingSubtype: 'cold_elevation',
        priority: 'recommended',
        description: 'High UV index at Himalayan elevations causes driver eye fatigue; protect against intense road glare and dry wind.',
        triggerReason: `Intense mountain UV radiation at ${detectedTerrain.maxAlt}m elevation`,
        triggerType: 'terrain',
        icon: Glasses,
      });
    }

    // B. High Altitude First-Aid & Motion Comfort Kit
    list.push({
      id: 'pack-motion-sickness-avomine',
      title: 'Motion Sickness (Avomine / Dimenhydrinate) & Herbal Balm',
      category: 'packing_list',
      packingSubtype: 'first_aid',
      priority: detectedTerrain.elevationGain > 500 ? 'mandatory' : 'recommended',
      description: 'Mountain switchbacks and hairpin loops frequently trigger nausea. Take 30 minutes before winding pass ascent.',
      triggerReason: `Twisting mountain terrain with +${detectedTerrain.elevationGain}m elevation swings`,
      triggerType: 'terrain',
      icon: Pill,
    });

    if (detectedTerrain.isHighAltitude || detectedTerrain.maxAlt > 1600) {
      list.push({
        id: 'pack-diamox-electrolytes',
        title: 'Diamox (Acetazolamide) & ORS Electrolyte Sachets (Jeevan Jal)',
        category: 'packing_list',
        packingSubtype: 'first_aid',
        priority: detectedTerrain.maxAlt > 2000 ? 'mandatory' : 'recommended',
        description: 'Dissolve ORS electrolytes in water to maintain salt-water balance. Diamox helps mitigate Acute Mountain Sickness (AMS).',
        triggerReason: `Ascending above high elevation threshold (${detectedTerrain.maxAlt}m ASL)`,
        triggerType: 'terrain',
        icon: Pill,
      });
    }

    // C. Monsoon Rain & Predicted Wet Weather Packing
    if (detectedWeather.hasRain || detectedWeather.hasSlipperyGrip) {
      list.push({
        id: 'pack-rain-poncho-waterproofs',
        title: 'Heavy Waterproof Hooded Rain Poncho / Gore-Tex Parka',
        category: 'packing_list',
        packingSubtype: 'monsoon_rain',
        priority: 'mandatory',
        description: 'Keep in the passenger cabin (not buried under luggage) for quick access during road blockage inspections.',
        triggerReason: 'Monsoon downpours & wet highway conditions predicted along route',
        triggerType: 'weather',
        icon: Umbrella,
      });

      list.push({
        id: 'pack-waterproof-dry-bags',
        title: 'Waterproof Roll-Top Dry Bags & Heavy Ziploc Pouches',
        category: 'packing_list',
        packingSubtype: 'monsoon_rain',
        priority: 'mandatory',
        description: 'Seal vehicle blue book, licenses, smartphones, power banks, and cash currency against sudden downpours.',
        triggerReason: 'Active rain & spray risk across mountain highway corridors',
        triggerType: 'weather',
        icon: ShoppingBag,
      });

      list.push({
        id: 'pack-quickdry-apparel-socks',
        title: 'Quick-Dry Trekking Pants & 2x Pairs of Spare Dry Wool Socks',
        category: 'packing_list',
        packingSubtype: 'monsoon_rain',
        priority: 'recommended',
        description: 'Essential when stepping into muddy gravel shoulders or river overflows during route delays.',
        triggerReason: 'High splash & mud risk in construction/landslide zones',
        triggerType: 'weather',
        icon: Shirt,
      });

      list.push({
        id: 'pack-cabin-umbrella',
        title: 'Wind-Resistant Inverted Cabin Umbrella',
        category: 'packing_list',
        packingSubtype: 'monsoon_rain',
        priority: 'mandatory',
        description: 'Inverted umbrella design closes without dripping water into the vehicle interior.',
        triggerReason: 'Monsoon showers along highway sectors',
        triggerType: 'weather',
        icon: CloudRain,
      });

      list.push({
        id: 'pack-microfiber-defog-towels',
        title: 'Hydrophobic Microfiber Towels & Glass Defogger Wipes',
        category: 'packing_list',
        packingSubtype: 'monsoon_rain',
        priority: 'recommended',
        description: 'Wipe down misted exterior mirrors, backup cameras, and interior windshields.',
        triggerReason: 'High humidity & precipitation causing cabin condensation',
        triggerType: 'weather',
        icon: Eye,
      });
    }

    // D. Fog & Low Visibility Packing
    if (detectedWeather.hasFog) {
      list.push({
        id: 'pack-fog-yellow-glasses',
        title: 'High-Contrast Yellow Tinted Night & Fog Driving Glasses',
        category: 'packing_list',
        packingSubtype: 'monsoon_rain',
        priority: 'recommended',
        description: 'Filters blue glare and heightens road edge contrast during dense white cloud passes and evening mist.',
        triggerReason: 'Dense mountain pass fog (<2km visibility) detected',
        triggerType: 'weather',
        icon: Glasses,
      });

      list.push({
        id: 'pack-highvis-vest',
        title: 'Reflective High-Visibility Vest / LED Armband',
        category: 'packing_list',
        packingSubtype: 'monsoon_rain',
        priority: 'mandatory',
        description: 'Mandatory personal protection if stepping out near sharp blind turns in dense pass fog.',
        triggerReason: 'Low visibility mist and narrow road shoulders',
        triggerType: 'weather',
        icon: AlertTriangle,
      });
    }

    // E. Remote Highway Logistics & Nutrition Packing
    list.push({
      id: 'pack-energy-dense-snacks',
      title: 'High-Calorie Rations (Roasted Chana, Beaten Rice, Almonds, Chocolates)',
      category: 'packing_list',
      packingSubtype: 'logistics_power',
      priority: detectedTerrain.isLongDistance ? 'mandatory' : 'recommended',
      description: 'Non-perishable energy snacks in case of 4-6 hour landslide road clearing delays with no dhabas nearby.',
      triggerReason: `${routePlan.totalDistanceKm} km journey (~${Math.floor(routePlan.estimatedTimeMinutes / 60)}h) with isolated gorge sectors`,
      triggerType: 'distance',
      icon: Info,
    });

    list.push({
      id: 'pack-sealed-mineral-water',
      title: 'Bottled Sealed Drinking Water (Minimum 3 Liters per passenger)',
      category: 'packing_list',
      packingSubtype: 'logistics_power',
      priority: 'mandatory',
      description: 'Never rely solely on roadside unboiled stream water during highway monsoon transit.',
      triggerReason: 'High physical exertion & dehydration on mountain climbs',
      triggerType: 'distance',
      icon: Info,
    });

    list.push({
      id: 'pack-fast-charge-powerbank',
      title: '20,000mAh Power Bank + 65W Fast Car USB-C Charger',
      category: 'packing_list',
      packingSubtype: 'logistics_power',
      priority: 'mandatory',
      description: 'Ensure phones, flashlights, and GPS navigation devices stay charged during multi-hour traffic delays.',
      triggerReason: 'Zero power infrastructure in river gorge landslides',
      triggerType: 'distance',
      icon: BatteryCharging,
    });

    list.push({
      id: 'pack-hygiene-sanitizer',
      title: 'Travel Hygiene Kit (Biodegradable Wet Wipes & Sanitizer)',
      category: 'packing_list',
      packingSubtype: 'logistics_power',
      priority: 'recommended',
      description: 'Essential for roadside tire checks, food stops, and basic hygiene in remote pit stops.',
      triggerReason: 'Long highway transit cleanliness',
      triggerType: 'distance',
      icon: ShieldCheck,
    });

    // F. Vehicle-Specific Specialized Packing
    if (vehicle === 'motorbike') {
      list.push({
        id: 'pack-moto-dry-saddle-cover',
        title: 'Waterproof Saddlebag Rain Cover & Heavy Bungee Cords',
        category: 'packing_list',
        packingSubtype: 'vehicle_specific',
        priority: 'mandatory',
        description: 'Secure luggage tightly to motorcycle subframe with high-tension rubber bungee cords; prevent bag sagging into wheels.',
        triggerReason: 'High vibrations and rainfall on single-track highway sections',
        triggerType: 'vehicle',
        icon: Bike,
      });

      list.push({
        id: 'pack-moto-balaclava-neck-buff',
        title: 'Windproof Thermal Balaclava & Neck Buff',
        category: 'packing_list',
        packingSubtype: 'vehicle_specific',
        priority: 'mandatory',
        description: 'Seals helmet collar against freezing mountain crosswinds and truck exhaust dust.',
        triggerReason: 'Direct motorcycle weather exposure at altitude',
        triggerType: 'vehicle',
        icon: Bike,
      });
    } else if (vehicle === 'electric_vehicle') {
      list.push({
        id: 'pack-ev-heavy-extension-box',
        title: '15A Heavy-Duty 3-Pin Extension Board (15m) & Industrial Plug',
        category: 'packing_list',
        packingSubtype: 'vehicle_specific',
        priority: 'mandatory',
        description: 'Allows emergency 3.3kW slow charging from roadside tea lodges, hotels, or restaurants in remote gorges.',
        triggerReason: 'Remote mountain corridors with spaced-out DC fast chargers',
        triggerType: 'vehicle',
        icon: Zap,
      });
    } else if (vehicle === 'suv_4wd') {
      list.push({
        id: 'pack-4wd-work-gloves-shovel',
        title: 'Heavy Cowhide Work Gloves & Compact Folding Shovel',
        category: 'packing_list',
        packingSubtype: 'vehicle_specific',
        priority: detectedTerrain.hasRoughSegments ? 'mandatory' : 'recommended',
        description: 'Essential for handling muddy tow cables, clearing debris around tires, or digging out gravel ruts.',
        triggerReason: 'Gravel & unpaved terrain along route',
        triggerType: 'vehicle',
        icon: Mountain,
      });
    }

    return list;
  }, [routePlan, vehicle, detectedWeather, detectedTerrain]);

  // Filtered items based on active UI tabs
  const filteredItems = useMemo(() => {
    return activeItems.filter((item) => {
      const matchCat = selectedCategory === 'all' || item.category === selectedCategory;
      const matchPri = filterPriority === 'all' || item.priority === filterPriority;
      const matchSub =
        selectedCategory !== 'packing_list' ||
        activePackingSubtype === 'all' ||
        item.packingSubtype === activePackingSubtype;
      return matchCat && matchPri && matchSub;
    });
  }, [activeItems, selectedCategory, filterPriority, activePackingSubtype]);

  // Packing list items specifically
  const packingItems = useMemo(() => {
    return activeItems.filter((i) => i.category === 'packing_list');
  }, [activeItems]);

  const checkedPackingCount = packingItems.filter((item) => !!checkedIds[item.id]).length;
  const packingCompletionPercent = packingItems.length > 0 ? Math.round((checkedPackingCount / packingItems.length) * 100) : 0;

  // Completion percentage and readiness calculation
  const totalCount = activeItems.length;
  const checkedCount = activeItems.filter((item) => !!checkedIds[item.id]).length;
  const mandatoryItems = activeItems.filter((item) => item.priority === 'mandatory');
  const checkedMandatoryCount = mandatoryItems.filter((item) => !!checkedIds[item.id]).length;
  const completionPercent = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;
  const isFullyReady = completionPercent === 100;
  const isMandatoryComplete = checkedMandatoryCount === mandatoryItems.length;

  // Copy checklist text to clipboard
  const handleCopyChecklist = (onlyPacking: boolean = false) => {
    let text = onlyPacking
      ? `🎒 SUGGESTED PACKING LIST (ELEVATION & WEATHER ADAPTIVE)\n`
      : `📋 PRE-TRIP HIGHWAY READINESS CHECKLIST & PACKING GUIDE\n`;
    text += `Route: ${routePlan.origin.name} ➔ ${routePlan.destination.name} (${routePlan.totalDistanceKm} km)\n`;
    text += `Vehicle: ${vehicle.toUpperCase().replace('_', ' ')} | Peak Summit: ${detectedTerrain.maxAlt}m (+${detectedTerrain.elevationGain}m gain)\n`;
    text += `Readiness Score: ${completionPercent}% (${checkedCount}/${totalCount} verified)\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    const categories: { key: ChecklistCategory; label: string }[] = onlyPacking
      ? [{ key: 'packing_list', label: '🎒 SUGGESTED PACKING LIST (ELEVATION & WEATHER ADAPTIVE)' }]
      : [
          { key: 'documents', label: '🪪 DOCUMENTS & LEGAL' },
          { key: 'vehicle_tires', label: '⚙️ VEHICLE & TIRE PRESSURE' },
          { key: 'emergency_tools', label: '🚨 EMERGENCY & SAFETY TOOLS' },
          { key: 'weather_mountain', label: '🏔️ TERRAIN & WEATHER ESSENTIALS' },
          { key: 'packing_list', label: '🎒 SUGGESTED PACKING LIST' },
        ];

    categories.forEach((cat) => {
      const items = activeItems.filter((i) => i.category === cat.key);
      if (items.length > 0) {
        text += `${cat.label}\n`;
        items.forEach((item) => {
          const status = checkedIds[item.id] ? '[✓]' : '[ ]';
          const prio = item.priority === 'mandatory' ? '(Mandatory)' : '(Recommended)';
          text += `  ${status} ${item.title} ${prio}\n`;
          text += `     ${item.description}\n`;
          text += `     Trigger: ${item.triggerReason}\n`;
        });
        text += `\n`;
      }
    });

    text += `Generated by Mero Sadak Nepal Highway Intelligence\n`;

    navigator.clipboard.writeText(text).then(() => {
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2500);
    });
  };

  return (
    <div
      className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-5"
      id="pre-trip-checklist"
    >
      {/* Header & Collapse Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
            <CheckSquare className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm sm:text-base font-bold text-white tracking-tight font-display">
                Essential Pre-Trip Highway Checklist
              </h3>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                Terrain & Weather Adaptive
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Customized for {vehicle.replace('_', ' ')} • {routePlan.origin.name} ➔ {routePlan.destination.name} (+{detectedTerrain.elevationGain}m climb)
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={handleCopyChecklist}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center space-x-1.5 transition border border-slate-700"
            title="Copy checklist text to clipboard"
          >
            {copiedText ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition border border-slate-700"
            title={isExpanded ? 'Collapse Checklist' : 'Expand Checklist'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Progress & Readiness Meter */}
      <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-slate-300">Trip Readiness Score:</span>
            <span
              className={`font-black text-sm font-display ${
                isFullyReady
                  ? 'text-emerald-400'
                  : completionPercent >= 70
                  ? 'text-cyan-400'
                  : completionPercent >= 40
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}
            >
              {completionPercent}% Ready
            </span>
          </div>

          <div className="text-slate-400 text-[11px]">
            <span className="font-bold text-white">{checkedCount}</span> of{' '}
            <span className="font-bold text-white">{totalCount}</span> items verified ({checkedMandatoryCount}/{mandatoryItems.length} mandatory)
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 rounded-full ${
              isFullyReady
                ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                : completionPercent >= 70
                ? 'bg-gradient-to-r from-cyan-500 to-emerald-400'
                : completionPercent >= 40
                ? 'bg-gradient-to-r from-amber-500 to-cyan-400'
                : 'bg-gradient-to-r from-rose-500 to-amber-500'
            }`}
            style={{ width: `${completionPercent}%` }}
          />
        </div>

        {/* Dynamic Context Trigger Summary Badges */}
        <div className="flex items-center flex-wrap gap-1.5 pt-1 text-[10px]">
          <span className="text-slate-500 font-medium mr-1">Active Route Triggers:</span>

          {detectedTerrain.isHighAltitude && (
            <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/30 flex items-center space-x-1">
              <Mountain className="w-3 h-3" />
              <span>High Summit ({detectedTerrain.maxAlt}m ASL)</span>
            </span>
          )}

          {detectedWeather.hasRain && (
            <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 flex items-center space-x-1">
              <CloudRain className="w-3 h-3" />
              <span>Monsoon Wet Grip Alert</span>
            </span>
          )}

          {detectedWeather.hasFog && (
            <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 flex items-center space-x-1">
              <Sun className="w-3 h-3" />
              <span>Mountain Fog (&lt; 2km Visibility)</span>
            </span>
          )}

          {detectedTerrain.hasRoughSegments && (
            <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 flex items-center space-x-1">
              <AlertTriangle className="w-3 h-3" />
              <span>Gravel / Widening Road Works</span>
            </span>
          )}

          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 flex items-center space-x-1">
            {vehicle === 'electric_vehicle' ? <Zap className="w-3 h-3 text-cyan-400" /> : <Car className="w-3 h-3 text-slate-400" />}
            <span className="capitalize">{vehicle.replace('_', ' ')} Profile</span>
          </span>
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-4">
          {/* Category Tabs & Priority Filter */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-800/80 pb-3">
            {/* Category Pills */}
            <div className="flex items-center flex-wrap gap-1.5">
              {[
                { id: 'all', label: 'All Items', count: activeItems.length },
                { id: 'packing_list', label: '🎒 Suggested Packing', count: activeItems.filter((i) => i.category === 'packing_list').length, highlight: true },
                { id: 'weather_mountain', label: '🏔️ Weather & Mountain', count: activeItems.filter((i) => i.category === 'weather_mountain').length },
                { id: 'vehicle_tires', label: '⚙️ Vehicle & Tires', count: activeItems.filter((i) => i.category === 'vehicle_tires').length },
                { id: 'emergency_tools', label: '🚨 Emergency Tools', count: activeItems.filter((i) => i.category === 'emergency_tools').length },
                { id: 'documents', label: '🪪 Documents', count: activeItems.filter((i) => i.category === 'documents').length },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setSelectedCategory(tab.id as ChecklistCategory);
                    if (tab.id !== 'packing_list') {
                      setActivePackingSubtype('all');
                    }
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition flex items-center space-x-1.5 ${
                    selectedCategory === tab.id
                      ? tab.id === 'packing_list'
                        ? 'bg-amber-600 text-white shadow-sm shadow-amber-600/30'
                        : 'bg-emerald-600 text-white shadow-sm'
                      : tab.id === 'packing_list'
                      ? 'bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 border border-amber-500/30'
                      : 'bg-slate-800/70 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-700/60'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-1 py-0.2 rounded-full text-[10px] ${
                      selectedCategory === tab.id
                        ? 'bg-black/30 text-white'
                        : tab.id === 'packing_list'
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-slate-900 text-slate-400'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Quick Bulk Actions & Priority Filter */}
            <div className="flex items-center space-x-2 text-xs">
              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value as any)}
                aria-label="Filter checklist by priority"
                className="bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-emerald-500"
              >
                <option value="all">All Priorities</option>
                <option value="mandatory">🔴 Mandatory Only</option>
                <option value="recommended">🟡 Recommended Only</option>
              </select>

              <button
                onClick={checkAll}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 transition"
              >
                Check All
              </button>

              <button
                onClick={resetAll}
                className="p-1 text-slate-400 hover:text-rose-400 transition"
                title="Reset checklist"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Specialized Packing Header & Subtype Filter Bar (when in packing list mode or viewing all) */}
          {selectedCategory === 'packing_list' && (
            <div className="bg-gradient-to-r from-amber-950/40 via-slate-900 to-amber-950/30 p-3.5 rounded-xl border border-amber-500/30 space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    <Luggage className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                      <span>Adaptive Route Packing Guide</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">
                        {checkedPackingCount}/{packingItems.length} Packed ({packingCompletionPercent}%)
                      </span>
                    </h4>
                    <p className="text-[10px] text-slate-400">
                      Tailored specifically for elevation climbs to <span className="text-amber-300 font-bold">{detectedTerrain.maxAlt}m ASL</span> and predicted <span className="text-cyan-300 font-bold">{detectedWeather.hasRain ? 'Monsoon Rainfall' : detectedWeather.hasFog ? 'Pass Mist & Fog' : 'Mountain Weather'}</span>.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handleCopyChecklist(true)}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-bold flex items-center space-x-1.5 transition self-start sm:self-auto shrink-0"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copy Packing List</span>
                </button>
              </div>

              {/* Sub-Filter Pills for Packing */}
              <div className="flex items-center flex-wrap gap-1.5 pt-1 border-t border-slate-800/80">
                <span className="text-[10px] text-slate-400 font-semibold mr-1">Filter by Scenario:</span>
                {[
                  { id: 'all', label: 'All Packing', icon: Luggage },
                  { id: 'cold_elevation', label: '🧥 Mountain Passes & Thermal', icon: ThermometerSnowflake },
                  { id: 'first_aid', label: '💊 Altitude & First Aid', icon: Pill },
                  { id: 'monsoon_rain', label: '🌧️ Monsoon & Wet Weather', icon: Umbrella },
                  { id: 'logistics_power', label: '⚡ Valleys & Power', icon: BatteryCharging },
                  { id: 'vehicle_specific', label: '🚗 Vehicle Hardware', icon: Wrench },
                ].map((sub) => {
                  const SubIcon = sub.icon;
                  const count =
                    sub.id === 'all'
                      ? packingItems.length
                      : packingItems.filter((i) => i.packingSubtype === sub.id).length;

                  if (count === 0 && sub.id !== 'all') return null;

                  return (
                    <button
                      key={sub.id}
                      onClick={() => setActivePackingSubtype(sub.id)}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition flex items-center space-x-1 ${
                        activePackingSubtype === sub.id
                          ? 'bg-amber-500 text-black font-bold shadow-sm'
                          : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                      }`}
                    >
                      <SubIcon className="w-3 h-3" />
                      <span>{sub.label}</span>
                      <span className="opacity-80">({count})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Checklist Items List */}
          <div className="grid grid-cols-1 gap-2.5 max-h-[480px] overflow-y-auto pr-1">
            {filteredItems.map((item) => {
              const isChecked = !!checkedIds[item.id];
              const Icon = item.icon;

              return (
                <div
                  key={item.id}
                  onClick={() => toggleCheck(item.id)}
                  className={`p-3.5 rounded-xl border transition cursor-pointer flex items-start space-x-3 select-none ${
                    isChecked
                      ? 'bg-slate-950/40 border-emerald-500/30 opacity-80'
                      : item.priority === 'mandatory'
                      ? 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                      : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  {/* Checkbox */}
                  <div className="mt-0.5 shrink-0">
                    {isChecked ? (
                      <CheckSquare className="w-5 h-5 text-emerald-400 fill-emerald-500/20" />
                    ) : (
                      <Square className="w-5 h-5 text-slate-500 hover:text-slate-300" />
                    )}
                  </div>

                  {/* Item Content */}
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between flex-wrap gap-1.5">
                      <div className="flex items-center space-x-2">
                        <Icon
                          className={`w-4 h-4 shrink-0 ${
                            isChecked
                              ? 'text-emerald-400'
                              : item.priority === 'mandatory'
                              ? 'text-rose-400'
                              : 'text-amber-400'
                          }`}
                        />
                        <span
                          className={`text-xs font-bold ${
                            isChecked ? 'line-through text-slate-400 font-normal' : 'text-white'
                          }`}
                        >
                          {item.title}
                        </span>
                      </div>

                      {/* Priority Badge */}
                      <span
                        className={`px-1.5 py-0.5 text-[9px] font-bold rounded uppercase tracking-wider ${
                          item.priority === 'mandatory'
                            ? 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
                            : 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {item.priority}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400 leading-relaxed">{item.description}</p>

                    {/* Trigger Explanation Tag */}
                    <div className="flex items-center space-x-1.5 text-[10px] text-emerald-400/90 font-medium pt-0.5">
                      <Sparkles className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span>{item.triggerReason}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Readiness Verdict Banner */}
          <div
            className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
              isFullyReady
                ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                : isMandatoryComplete
                ? 'bg-cyan-950/30 border-cyan-500/40 text-cyan-300'
                : 'bg-amber-950/30 border-amber-500/40 text-amber-300'
            }`}
          >
            <div className="flex items-center space-x-2 font-medium">
              {isFullyReady ? (
                <>
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>All pre-trip safety, document, and terrain checks complete. Safe travels!</span>
                </>
              ) : isMandatoryComplete ? (
                <>
                  <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>All mandatory items checked. Consider reviewing recommended comfort essentials.</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    {mandatoryItems.length - checkedMandatoryCount} mandatory item(s) pending verification before departing.
                  </span>
                </>
              )}
            </div>

            <span className="text-[11px] font-bold shrink-0 ml-2">
              {checkedCount}/{totalCount} Done
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
