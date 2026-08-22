/**
 * Mero Sadak — Nepal Road GIS & High-Altitude Highway Data Pack
 * Curated reference datasets for Nepal National Road Network
 */

const NEPAL_DATA = {
  // Key Cities & Highway Hubs with GPS coordinates
  cities: [
    { id: 'ktm', name: 'Kathmandu (काठमाडौँ)', district: 'Kathmandu', province: 'Bagmati', lat: 27.7172, lng: 85.3240, highway: 'NH39 / NH34' },
    { id: 'pkr', name: 'Pokhara (पोखरा)', district: 'Kaski', province: 'Gandaki', lat: 28.2096, lng: 83.9856, highway: 'NH17 (Prithvi)' },
    { id: 'btl', name: 'Butwal (बुटवल)', district: 'Rupandehi', province: 'Lumbini', lat: 27.7006, lng: 83.4484, highway: 'NH01 / NH47' },
    { id: 'bwa', name: 'Bhairahawa / Belahiya (भैरहवा)', district: 'Rupandehi', province: 'Lumbini', lat: 27.5065, lng: 83.4544, highway: 'NH47' },
    { id: 'brt', name: 'Biratnagar (विराटनगर)', district: 'Morang', province: 'Koshi', lat: 26.4525, lng: 87.2718, highway: 'NH08' },
    { id: 'ith', name: 'Itahari (इटहरी)', district: 'Sunsari', province: 'Koshi', lat: 26.6664, lng: 87.2798, highway: 'NH01 / NH08' },
    { id: 'dhn', name: 'Dharan (धरान)', district: 'Sunsari', province: 'Koshi', lat: 26.8124, lng: 87.2834, highway: 'NH08' },
    { id: 'cwn', name: 'Bharatpur / Narayangarh (चितवन)', district: 'Chitwan', province: 'Bagmati', lat: 27.6833, lng: 84.4333, highway: 'NH01 / NH44' },
    { id: 'het', name: 'Hetauda (हेटौँडा)', district: 'Makwanpur', province: 'Bagmati', lat: 27.4287, lng: 85.0322, highway: 'NH01 / NH41' },
    { id: 'bkj', name: 'Nepalgunj (नेपालगञ्ज)', district: 'Banke', province: 'Lumbini', lat: 28.0500, lng: 81.6167, highway: 'NH58' },
    { id: 'khp', name: 'Kohalpur (कोहलपुर)', district: 'Banke', province: 'Lumbini', lat: 28.1963, lng: 81.6917, highway: 'NH01 / NH58' },
    { id: 'dhi', name: 'Dhangadhi (धनगढी)', district: 'Kailali', province: 'Sudurpashchim', lat: 28.6852, lng: 80.5975, highway: 'NH01 / NH66' },
    { id: 'mhn', name: 'Mahendranagar / Bhimdatta', district: 'Kanchanpur', province: 'Sudurpashchim', lat: 28.9667, lng: 80.1833, highway: 'NH01' },
    { id: 'jnk', name: 'Janakpurdham (जनकपुर)', district: 'Dhanusha', province: 'Madhesh', lat: 26.7288, lng: 85.9244, highway: 'NH22' },
    { id: 'bir', name: 'Birgunj (वीरगञ्ज)', district: 'Parsa', province: 'Madhesh', lat: 27.0000, lng: 84.8667, highway: 'NH41' },
    { id: 'skh', name: 'Surkhet / Birendranagar (सुर्खेत)', district: 'Surkhet', province: 'Karnali', lat: 28.6019, lng: 81.6339, highway: 'NH58 / NH60' },
    { id: 'dml', name: 'Dumre (डुम्रे)', district: 'Tanahu', province: 'Gandaki', lat: 27.9711, lng: 84.4239, highway: 'NH17 / NH25' },
    { id: 'mug', name: 'Mugling (मुग्लिङ)', district: 'Chitwan', province: 'Bagmati', lat: 27.8575, lng: 84.5539, highway: 'NH17 / NH44' },
    { id: 'nag', name: 'Nagdhunga Checkpost (नागढुङ्गा)', district: 'Kathmandu', province: 'Bagmati', lat: 27.6978, lng: 85.2078, highway: 'NH17 / NH39' },
    { id: 'bdr', name: 'Bardibas (बर्दिबास)', district: 'Mahottari', province: 'Madhesh', lat: 26.9944, lng: 85.9011, highway: 'NH01 / NH13' },
    { id: 'kkb', name: 'Kakarbhitta (काँकडभिट्टा)', district: 'Jhapa', province: 'Koshi', lat: 26.6500, lng: 88.1600, highway: 'NH01' },
    { id: 'ilm', name: 'Ilam (इलाम)', district: 'Ilam', province: 'Koshi', lat: 26.9089, lng: 87.9272, highway: 'NH02' },
    { id: 'dml2', name: 'Damak (दमक)', district: 'Jhapa', province: 'Koshi', lat: 26.6667, lng: 87.7000, highway: 'NH01 / NH76' },
    { id: 'dhl', name: 'Dhulikhel (धुलिखेल)', district: 'Kavrepalanchok', province: 'Bagmati', lat: 27.6221, lng: 85.5428, highway: 'NH13 / NH34' },
    { id: 'trh', name: 'Trishuli / Bidur (त्रिशूली)', district: 'Nuwakot', province: 'Bagmati', lat: 27.9167, lng: 85.1667, highway: 'NH18 / NH40' },
    { id: 'bsr', name: 'Besisahar (बेसीशहर)', district: 'Lamjung', province: 'Gandaki', lat: 28.2333, lng: 84.3833, highway: 'NH25' },
    { id: 'bgl', name: 'Baglung (बागलुङ)', district: 'Baglung', province: 'Gandaki', lat: 28.2719, lng: 83.5936, highway: 'NH03' },
    { id: 'ben', name: 'Beni (बेनी)', district: 'Myagdi', province: 'Gandaki', lat: 28.3444, lng: 83.5639, highway: 'NH03' },
    { id: 'joms', name: 'Jomsom / Muktinath (जोमसोम)', district: 'Mustang', province: 'Gandaki', lat: 28.7833, lng: 83.7333, highway: 'NH48' },
    { id: 'ghr', name: 'Ghorahi (घोराही)', district: 'Dang', province: 'Lumbini', lat: 28.0500, lng: 82.5000, highway: 'NH55' },
    { id: 'tls', name: 'Tulsipur (तुलसीपुर)', district: 'Dang', province: 'Lumbini', lat: 28.1306, lng: 82.2961, highway: 'NH55' },
    { id: 'tns', name: 'Tansen (तानसेन)', district: 'Palpa', province: 'Lumbini', lat: 27.8667, lng: 83.5500, highway: 'NH47 / NH48' },
    { id: 'jml', name: 'Jumla Khalanga (जुम्ला)', district: 'Jumla', province: 'Karnali', lat: 29.2747, lng: 82.1839, highway: 'Karnali Hwy' },
    { id: 'man', name: 'Manang (मनाङ)', district: 'Manang', province: 'Gandaki', lat: 28.6667, lng: 84.0167, highway: 'NH25' }
  ],

  // Live Road Incidents, Landslide Zones & Warnings
  incidents: [
    {
      id: 'inc-1',
      type: 'landslide',
      severity: 'high',
      title: 'Mugling - Narayangarh Landslide Watch (Tuin Khola)',
      highway: 'NH44',
      district: 'Chitwan',
      locationName: 'Tuin Khola, Mugling',
      lat: 27.8123,
      lng: 84.5122,
      status: 'One-Way Traffic Allowed',
      reportedAt: '15 mins ago',
      description: 'Heavy boulder clearance in progress. Police pilot vehicle deployed. Expect 20-30 min delays.'
    },
    {
      id: 'inc-2',
      type: 'roadwork',
      severity: 'medium',
      title: 'Nagdhunga Tunnel Bypass & Road Widening',
      highway: 'NH17 / NH39',
      district: 'Kathmandu / Dhading',
      locationName: 'Sisne Khola, Dharke',
      lat: 27.7011,
      lng: 85.1832,
      status: 'Moderate Slowdown',
      reportedAt: '1 hour ago',
      description: 'Asphalt resurfacing on approach roads. Heavy trucks queued on uphill lane.'
    },
    {
      id: 'inc-3',
      type: 'blackspot',
      severity: 'high',
      title: 'Siddhababa Rockfall Hazard Zone',
      highway: 'NH47 (Siddhartha)',
      district: 'Palpa / Rupandehi',
      locationName: 'Dobhan - Siddhababa',
      lat: 27.7490,
      lng: 83.4730,
      status: 'Caution — Falling Stones',
      reportedAt: '3 hours ago',
      description: 'Tunnel construction ongoing. Watch overhead netting and obey flagmen signals.'
    },
    {
      id: 'inc-4',
      type: 'roadwork',
      severity: 'medium',
      title: 'Narayangarh - Butwal Road Expansion (Daunne Section)',
      highway: 'NH01 (Mahendra)',
      district: 'Nawalparasi (Bardaghat Susta East)',
      locationName: 'Daunne Hill Pass',
      lat: 27.5620,
      lng: 83.8200,
      status: 'Rough Track / Dusty Conditions',
      reportedAt: 'Today',
      description: 'Mountain cutting and bridge construction. 4WD / High ground clearance recommended.'
    },
    {
      id: 'inc-5',
      type: 'flood',
      severity: 'low',
      title: 'Koshi Barrage Water Level Normal',
      highway: 'NH01',
      district: 'Saptari / Sunsari',
      locationName: 'Koshi Barrage',
      lat: 26.5220,
      lng: 86.9300,
      status: 'Clear — Smooth Transit',
      reportedAt: '4 hours ago',
      description: 'All 56 gates operational, cross-border freight traffic normal.'
    }
  ],

  // Mountain Passes & High-Altitude Weather Nodes
  mountainPasses: [
    {
      id: 'pass-thorong',
      name: 'Thorong La Pass (थोरङ ला)',
      altitude: '5,416 m',
      highway: 'Annapurna Circuit Trail / NH48 Link',
      district: 'Mustang / Manang',
      lat: 28.7933,
      lng: 83.9350,
      temp: '-4°C',
      condition: 'Snow / Icy winds',
      status: 'Restricted to Trekking / Extreme 4WD'
    },
    {
      id: 'pass-daunne',
      name: 'Daunne Hill Pass (दाउन्ने डाँडा)',
      altitude: '520 m',
      highway: 'NH01 (Mahendra)',
      district: 'Nawalparasi',
      lat: 27.5615,
      lng: 83.8210,
      temp: '26°C',
      condition: 'Hazy / Heavy Truck Traffic',
      status: 'Open — Under 4-lane expansion'
    },
    {
      id: 'pass-siddhababa',
      name: 'Siddhababa Pass (सिद्धबाबा)',
      altitude: '680 m',
      highway: 'NH47 (Siddhartha)',
      district: 'Palpa',
      lat: 27.7485,
      lng: 83.4725,
      temp: '24°C',
      condition: 'Dry / Rockfall screen active',
      status: 'Open with cautious speed (<30 km/h)'
    },
    {
      id: 'pass-nagdhunga',
      name: 'Nagdhunga Pass (नागढुङ्गा भञ्ज्याङ)',
      altitude: '1,500 m',
      highway: 'NH17',
      district: 'Kathmandu / Dhading',
      lat: 27.6980,
      lng: 85.2085,
      temp: '18°C',
      condition: 'Light Fog / Foggy Mornings',
      status: 'Open — Tunnel Bypass testing'
    },
    {
      id: 'pass-deurali',
      name: 'Khurkot - Sindhuli Pass (सिन्धुली गढी)',
      altitude: '1,420 m',
      highway: 'NH13 (BP Highway)',
      district: 'Sindhuli',
      lat: 27.2830,
      lng: 85.8830,
      temp: '20°C',
      condition: 'Clear Sky / Scenic',
      status: 'Open (Strict vehicle length & weight limits)'
    },
    {
      id: 'pass-korala',
      name: 'Korala Border Pass (कोरोला नाका)',
      altitude: '4,660 m',
      highway: 'NH48 (Kaligandaki Corridor)',
      district: 'Mustang',
      lat: 29.3190,
      lng: 83.9780,
      temp: '2°C',
      condition: 'Chilly winds',
      status: 'Bilateral Trade Pass Open'
    }
  ],

  // Verified Highway POIs (Fuel, EV Fast Chargers, Hospitals, Police Stations, Rest Areas)
  pois: [
    {
      id: 'poi-1',
      name: 'Nepal Oil Corp — Highway Petroleum Hub',
      type: 'fuel',
      highway: 'NH17',
      location: 'Malekhu, Dhading',
      lat: 27.8080,
      lng: 84.8250,
      open: '24/7',
      amenities: ['Diesel/Petrol', 'EV 60kW DC Charger', 'Clean Restrooms', 'Fresh Malekhu Fish Cafe']
    },
    {
      id: 'poi-2',
      name: 'NEA Electric Vehicle Ultra-Fast Charging Station',
      type: 'ev',
      highway: 'NH17',
      location: 'Kurintar / Cable Car Gate, Chitwan',
      lat: 27.8720,
      lng: 84.5860,
      open: '24/7',
      amenities: ['120kW Dual CCS2 Guns', 'Manakamana Cable Car Walkway', 'Restaurant', 'Cafe']
    },
    {
      id: 'poi-3',
      name: 'Mugling Highway Trauma Emergency & Police Post',
      type: 'police_hospital',
      highway: 'NH17 / NH44',
      location: 'Mugling Chowk, Chitwan',
      lat: 27.8580,
      lng: 84.5540,
      open: '24/7',
      amenities: ['Emergency First Aid 102', 'Nepal Highway Patrol 103', 'Tow Crane']
    },
    {
      id: 'poi-4',
      name: 'Narayangarh Bypass Fuel & Rest Plaza',
      type: 'fuel',
      highway: 'NH01 / NH44',
      location: 'Aaptaari, Bharatpur',
      lat: 27.7020,
      lng: 84.4410,
      open: '24/7',
      amenities: ['High-speed Dispensers', 'ATM', 'Tyre Air & Repair', 'Food Court']
    },
    {
      id: 'poi-5',
      name: 'Butwal Highway EV Hub & Rest Stop',
      type: 'ev',
      highway: 'NH01 / NH47',
      location: 'Chauraha, Butwal',
      lat: 27.6985,
      lng: 83.4560,
      open: '24/7',
      amenities: ['60kW CCS2 Charger', 'Lumbini Provincial Hospital (1km)', 'Lodging']
    },
    {
      id: 'poi-6',
      name: 'Sindhuli Khurkot Highway Medical Center',
      type: 'hospital',
      highway: 'NH13',
      location: 'Khurkot, Sindhuli',
      lat: 27.3340,
      lng: 85.9810,
      open: '24/7',
      amenities: ['Ambulance Station', 'Pharmacy', 'Emergency Trauma Unit']
    },
    {
      id: 'poi-7',
      name: 'Dharan Bhedetar Tourist & Highway Police Post',
      type: 'police',
      highway: 'NH08 (Koshi Highway)',
      location: 'Bhedetar, Dhankuta',
      lat: 26.8780,
      lng: 87.3270,
      open: '24/7',
      amenities: ['Tourist Police 1144', 'Road Clearance Patrol', 'Weather Station']
    }
  ],

  // Real-Time Traffic Corridors & Speed Monitoring
  trafficCorridors: [
    {
      id: 'trf-1',
      name: 'Kathmandu - Naubise - Mugling Corridor',
      highway: 'NH17 (Prithvi)',
      distanceKm: 110,
      currentAvgSpeedKmh: 34,
      normalSpeedKmh: 45,
      congestionLevel: 'Moderate Slowdown',
      statusColor: '#F59E0B',
      cause: 'Heavy freight trucks ascending Nagdhunga & road upgrading near Galchi',
      lat: 27.8500,
      lng: 84.6500
    },
    {
      id: 'trf-2',
      name: 'Mugling - Bharatpur Narayangarh Section',
      highway: 'NH44',
      distanceKm: 36,
      currentAvgSpeedKmh: 38,
      normalSpeedKmh: 50,
      congestionLevel: 'One-way Bottleneck at Tuin Khola',
      statusColor: '#EF4444',
      cause: 'Active slope stabilisation & landslide debris control',
      lat: 27.7800,
      lng: 84.5000
    },
    {
      id: 'trf-3',
      name: 'Narayangarh - Kawasoti - Butwal Section',
      highway: 'NH01 (Mahendra)',
      distanceKm: 114,
      currentAvgSpeedKmh: 30,
      normalSpeedKmh: 65,
      congestionLevel: 'Heavy Construction Delay',
      statusColor: '#EF4444',
      cause: 'Daunne mountain hill widening & culvert works',
      lat: 27.6000,
      lng: 84.1000
    },
    {
      id: 'trf-4',
      name: 'Kakarbhitta - Itahari - Lahan Highway',
      highway: 'NH01 (East-West)',
      distanceKm: 165,
      currentAvgSpeedKmh: 68,
      normalSpeedKmh: 75,
      congestionLevel: 'Smooth Flowing',
      statusColor: '#10B981',
      cause: 'Clear 4-lane expressway sections',
      lat: 26.6500,
      lng: 87.1500
    },
    {
      id: 'trf-5',
      name: 'Dhulikhel - Sindhuli - Bardibas (BP Highway)',
      highway: 'NH13',
      distanceKm: 158,
      currentAvgSpeedKmh: 42,
      normalSpeedKmh: 45,
      congestionLevel: 'Clear Mountain Flow',
      statusColor: '#10B981',
      cause: 'Restricted heavy vehicle entry keeps pace steady',
      lat: 27.2000,
      lng: 85.8000
    }
  ],

  // Emergency SOS Hub & Nepal Highway Patrol Numbers
  emergencyContacts: [
    { title: 'Nepal Police Emergency Control', number: '100', icon: '🚨', type: 'Primary Emergency' },
    { title: 'Nepal Highway Traffic Police Control', number: '103', icon: '🚓', type: 'Highway Traffic & Patrol' },
    { title: 'Nepal Red Cross Ambulance Service', number: '102', icon: '🚑', type: 'Medical & Trauma' },
    { title: 'Nepal Tourist Police Helpline', number: '1144', icon: '👮‍♂️', type: 'Tourist Security & Assistance' },
    { title: 'Department of Roads (DOR) Highway Help', number: '01-5525527', icon: '🛣️', type: 'DOR Road Emergency Control' },
    { title: 'Armed Police Force (APF) Disaster Rescue', number: '1114', icon: '🦺', type: 'Landslide & Flood Rescue' },
    { title: 'Nepal Disaster Management (NDRRMA)', number: '1155', icon: '⚠️', type: 'Monsoon & Landslide Alert' }
  ],

  // Regional Dialect Transit & Driving Phrases
  dialects: [
    {
      id: 'doteli',
      name: 'Doteli / Far-West (डोटेली)',
      region: 'Sudurpashchim (Kailali, Dadeldhura, Doti, Baitadi)',
      description: 'Used across Mahakali and Seti highways.',
      phrases: [
        { eng: 'Where does this road go?', nep: 'यो बाटो कता जान्छ?', local: 'यो बाटो काँ जान्छ?', pron: 'Yo bato kaan jaanchha?' },
        { eng: 'Is the road blocked by landslide?', nep: 'बाटो पहिरोले बन्द छ?', local: 'बाटो पहिराले बन्द छ कि?', pron: 'Bato pahirale banda chha ki?' },
        { eng: 'Where is the petrol pump?', nep: 'पेट्रोल पम्प कता छ?', local: 'पेट्रोल पम्प काँ छ?', pron: 'Petrol pump kaan chha?' },
        { eng: 'How far is the next hotel/lodge?', nep: 'अर्को होटल कति टाढा छ?', local: 'आगो होटल कति टाढा छ?', pron: 'Aago hotel kati tadha chha?' },
        { eng: 'Drive carefully, steep turn ahead.', nep: 'होशियार हुनुहोस्, अगाडि भीर र मोड छ।', local: 'बल्ल चलाउनु, अघातिर अप्ठेरो घुम्ती छ।', pron: 'Balla chalaunu, aghatira apthero ghumti chha.' }
      ]
    },
    {
      id: 'maithili',
      name: 'Maithili (मैथिली)',
      region: 'Madhesh (Janakpur, Siraha, Saptari, Dhanusha)',
      description: 'Prominently spoken on Postal & East-West Highways in Province 2.',
      phrases: [
        { eng: 'Where does this road go?', nep: 'यो बाटो कता जान्छ?', local: 'ई रास्ता कतय जाएत अछि?', pron: 'Ee rasta katay jaayet achhi?' },
        { eng: 'Is there a mechanic nearby?', nep: 'नजिकै गाडी बनाउने ठाउँ छ?', local: 'लगमे मिस्त्रीक दोकान अछि?', pron: 'Lagme mistreek dokan achhi?' },
        { eng: 'Where is the nearest hospital?', nep: 'नजिकको अस्पताल कता छ?', local: 'सबसँ लगक अस्पताल कतय अछि?', pron: 'Sabsan lagak aspatal katay achhi?' },
        { eng: 'Is the bridge open for vehicles?', nep: 'गाडीको लागि पुल खुलेको छ?', local: 'गाडी लेल पुल खुजल अछि?', pron: 'Gadi lel pul khujal achhi?' },
        { eng: 'Please help us, our vehicle broke down.', nep: 'कृपया मद्दत गर्नुहोस्, गाडी बिग्रियो।', local: 'कृपया मद्दति करू, हमर गाडी खराब भ गेल।', pron: 'Kripaya maddat karu, hamar gadi kharab bha gel.' }
      ]
    },
    {
      id: 'bhojpuri',
      name: 'Bhojpuri (भोजपुरी)',
      region: 'Madhesh / Lumbini (Birgunj, Bara, Parsa, Rautahat, Nawalparasi)',
      description: 'Widely spoken on Tribhuvan & Postal corridors.',
      phrases: [
        { eng: 'Where does this road go?', nep: 'यो बाटो कता जान्छ?', local: 'ई रस्ता कहाँ जाला?', pron: 'Ee rasta kahaan jaala?' },
        { eng: 'Is the highway clear?', nep: 'राजमार्ग खुला छ?', local: 'हाइवे साफ बा कि जाम बा?', pron: 'Highway saaf ba ki jaam ba?' },
        { eng: 'How much for towing/repair?', nep: 'गाडी तानेको / बनाएको कति लिने?', local: 'गाडी बनावे के केतना लागी?', pron: 'Gadi banawe ke ketna laagi?' },
        { eng: 'Where can we get drinking water and food?', nep: 'खानेपानी र खाना कता पाइन्छ?', local: 'पानी आ खाना कहाँ मिली?', pron: 'Paani aa khaana kahaan mili?' }
      ]
    },
    {
      id: 'newari',
      name: 'Nepal Bhasa / Newari (नेपाल भाषा)',
      region: 'Kathmandu Valley (Kathmandu, Lalitpur, Bhaktapur, Banepa)',
      description: 'Traditional language in Kathmandu Valley highway entries.',
      phrases: [
        { eng: 'Where does this road go?', nep: 'यो बाटो कता जान्छ?', local: 'थ्व लँ गन वनी?', pron: 'Thwa lan gana wani?' },
        { eng: 'Is there heavy traffic ahead?', nep: 'अगाडि धेरै जाम छ?', local: 'न्ह्योने यक्व जाम दु ला?', pron: 'Nhyone yakwa jaam du la?' },
        { eng: 'Where is the police station?', nep: 'प्रहरी चौकी कता छ?', local: 'पुलिस चौकी गन दु?', pron: 'Police chowki gana du?' },
        { eng: 'Thank you for your help.', nep: 'सहयोगको लागि धन्यवाद।', local: 'ग्वाहालि यानादीगुया निंतिं सुभाय्।', pron: 'Gwahali yanaadiguya nintin Subhay.' }
      ]
    },
    {
      id: 'tharu',
      name: 'Tharu (थारू)',
      region: 'Terai Belt (Dang, Banke, Bardiya, Kailali, Chitwan)',
      description: 'Spoken across agricultural and highway towns in the plains.',
      phrases: [
        { eng: 'Where does this road go?', nep: 'यो बाटो कता जान्छ?', local: 'यी डहर काँह जाइठ?', pron: 'Yee dahar kaanha jaith?' },
        { eng: 'Is the river crossing safe?', nep: 'खोला तर्न सकिन्छ?', local: 'खोला पार करे सेकजाइठ कि नाइ?', pron: 'Khola paar kare sekjaith ki naai?' },
        { eng: 'Where can I find EV charging or fuel?', nep: 'पेट्रोल वा बिजुली चार्ज कहाँ पाइन्छ?', local: 'पेट्रोल आ बत्ती चार्ज करेक ठाउँ काँह बा?', pron: 'Petrol aa batti charge karek thau kaanha ba?' }
      ]
    }
  ]
};

// Expose globally for browser usage
if (typeof window !== 'undefined') {
  window.NEPAL_DATA = NEPAL_DATA;
}
