/* Mero Sadak — Highway Data (ported from merosadak-reference)
   Structured for minimal-size consumption with maximum information density.
   Used by index.html for highway layer rendering, safety segments, blackspot overlays. */

window.__HIGHWAY_DATA__ = {

  cities: [
    { id:'ktm', name:'Kathmandu', np:'काठमाडौं', district:'Kathmandu', province:'Bagmati', lat:27.7172, lng:85.3240, elev:1400, hub:true, highways:['H02','H03','H04','H13'] },
    { id:'pkr', name:'Pokhara', np:'पोखरा', district:'Kaski', province:'Gandaki', lat:28.2096, lng:83.9856, elev:822, hub:true, highways:['H04','H10','H15'] },
    { id:'cht', name:'Narayanghat / Bharatpur', np:'नारायणगढ / भरतपुर', district:'Chitwan', province:'Bagmati', lat:27.6833, lng:84.4333, elev:208, hub:true, highways:['H01','H05'] },
    { id:'mgl', name:'Mugling', np:'मुग्लिन', district:'Chitwan', province:'Bagmati', lat:27.8617, lng:84.5542, elev:275, hub:true, highways:['H04','H05'] },
    { id:'btl', name:'Butwal', np:'बुटवल', district:'Rupandehi', province:'Lumbini', lat:27.7006, lng:83.4484, elev:220, hub:true, highways:['H01','H10'] },
    { id:'bhr', name:'Bhairahawa / Sunauli', np:'भैरहवा / सुनौली', district:'Rupandehi', province:'Lumbini', lat:27.5045, lng:83.4503, elev:105, hub:true, highways:['H10'] },
    { id:'htd', name:'Hetauda', np:'हेटौंडा', district:'Makwanpur', province:'Bagmati', lat:27.4285, lng:85.0331, elev:460, hub:true, highways:['H01','H02','H17'] },
    { id:'brg', name:'Birgunj', np:'वीरगन्ज', district:'Parsa', province:'Madhesh', lat:27.0128, lng:84.8774, elev:90, hub:true, highways:['H02','H16'] },
    { id:'jnk', name:'Janakpurdham', np:'जनकपुरधाम', district:'Dhanusha', province:'Madhesh', lat:26.7271, lng:85.9408, elev:74, hub:true, highways:['H01','H16'] },
    { id:'brd', name:'Bardibas', np:'बर्दिबास', district:'Mahottari', province:'Madhesh', lat:26.9740, lng:85.9024, elev:150, hub:true, highways:['H01','H13'] },
    { id:'brt', name:'Biratnagar', np:'विराटनगर', district:'Morang', province:'Koshi', lat:26.4525, lng:87.2718, elev:72, hub:true, highways:['H01','H16'] },
    { id:'dhr', name:'Dharan', np:'धरान', district:'Sunsari', province:'Koshi', lat:26.8124, lng:87.2834, elev:349, hub:true, highways:['H01','H08','H17'] },
    { id:'kkr', name:'Kakarbhitta', np:'काँकडभिट्टा', district:'Jhapa', province:'Koshi', lat:26.6508, lng:88.1565, elev:145, hub:true, highways:['H01','H09'] },
    { id:'npg', name:'Nepalgunj', np:'नेपालगन्ज', district:'Banke', province:'Lumbini', lat:28.0500, lng:81.6167, elev:150, hub:true, highways:['H01','H12'] },
    { id:'srk', name:'Surkhet (Birendranagar)', np:'सुर्खेत (वीरेन्द्रनगर)', district:'Surkhet', province:'Karnali', lat:28.5997, lng:81.6334, elev:660, hub:true, highways:['H06','H12','H17'] },
    { id:'dhg', name:'Dhangadhi', np:'धनगढी', district:'Kailali', province:'Sudurpashchim', lat:28.6946, lng:80.5977, elev:109, hub:true, highways:['H01','H14'] },
    { id:'mhn', name:'Mahendranagar', np:'महेन्द्रनगर', district:'Kanchanpur', province:'Sudurpashchim', lat:28.9667, lng:80.1833, elev:198, hub:true, highways:['H01'] },
    { id:'dhk', name:'Dhulikhel', np:'धुलिखेल', district:'Kavrepalanchok', province:'Bagmati', lat:27.6221, lng:85.5428, elev:1550, hub:false, highways:['H03','H13'] },
    { id:'sdh', name:'Sindhuli Gadhi', np:'सिन्धुलीगढी', district:'Sindhuli', province:'Bagmati', lat:27.2486, lng:85.9186, elev:1100, hub:false, highways:['H13'] },
    { id:'dml', name:'Damauli', np:'दमौली', district:'Tanahun', province:'Gandaki', lat:27.9733, lng:84.2833, elev:450, hub:false, highways:['H04'] },
    { id:'plp', name:'Tansen (Palpa)', np:'तानसेन (पाल्पा)', district:'Palpa', province:'Lumbini', lat:27.8683, lng:83.5489, elev:1350, hub:false, highways:['H10'] },
    { id:'ilm', name:'Ilam', np:'इलाम', district:'Ilam', province:'Koshi', lat:26.9117, lng:87.9275, elev:1208, hub:false, highways:['H09'] },
    { id:'bgl', name:'Baglung', np:'बागलुङ', district:'Baglung', province:'Gandaki', lat:28.2725, lng:83.6006, elev:1020, hub:false, highways:['H15'] },
    { id:'jml', name:'Jumla', np:'जुम्ला', district:'Jumla', province:'Karnali', lat:29.2747, lng:82.1838, elev:2514, hub:false, highways:['H06'] },
    { id:'nbz', name:'Naubise / Khanikhola', np:'नौबिसे', district:'Dhading', province:'Bagmati', lat:27.7214, lng:85.1764, elev:920, hub:false, highways:['H02','H04'] },
    { id:'kdr', name:'Tatopani / Kodari', np:'तातोपानी / कोदारी', district:'Sindhupalchok', province:'Bagmati', lat:27.9497, lng:85.9452, elev:1640, hub:false, highways:['H03'] }
  ],

  blackspotHotspots: [
    { id:'bh-nagdhunga', name:'Nagdhunga - Khani Khola Descent', code:'H02/H04', ch:'Ch. 12+500', risk:'high', cause:'Steep downhill, brake fade, hairpin curves', stats:'~72 collisions/yr', advice:'Low gear engine braking, 30m gap', coords:[27.7020,85.2010] },
    { id:'bh-jogimara', name:'Jogimara & Benighat Trishuli S-Bends', code:'H04', ch:'Ch. 64+200', risk:'high', cause:'Canyon cliff curves, wet skid resistance', stats:'~54 incidents/yr', advice:'Horn before blind turns, 35 km/h limit', coords:[27.8423,84.7155] },
    { id:'bh-charkilo', name:'Charkilo & Jalbire Gorge Chutes', code:'H05', ch:'Ch. 18+400 to 22+100', risk:'critical', cause:'Unstable rock slopes, rockfalls, blind bend', stats:'~95 incidents/yr', advice:'Avoid stopping under overhangs', coords:[27.8102,84.5020] },
    { id:'bh-siddhababa', name:'Siddhababa Rockfall Zone', code:'H10', ch:'Ch. 4+000', risk:'critical', cause:'Shale cliff slides, switchback without guardrails', stats:'~84 incidents/yr', advice:'Use rock-shed tunnel bypass', coords:[27.7650,83.5120] },
    { id:'bh-daunne', name:'Daunne Hill Hairpin Pass', code:'H01', ch:'Ch. 210', risk:'high', cause:'18 blind switchbacks, truck breakdowns', stats:'~68 incidents/yr', advice:'No overtaking on inner curves', coords:[27.5700,83.8500] },
    { id:'bh-sindhuli', name:'Sindhuli Gadhi Switchbacks', code:'H13', ch:'Ch. 78+000', risk:'high', cause:'Tight radius turns, cliff edge drifting', stats:'~42 incidents/yr', advice:'25 km/h limit, no heavy freight', coords:[27.2486,85.9186] },
    { id:'bh-byas', name:'Byas - Ghansikuwa Widening', code:'H04', ch:'Ch. 112+000', risk:'moderate', cause:'ADB 4-lane expansion, loose gravel', stats:'~48 incidents/yr', advice:'Reduce speed on unpaved bypasses', coords:[27.9450,84.3400] },
    { id:'bh-koteshwor', name:'Koteshwor - Jadibuti Urban Fast Corridor', code:'H03', ch:'Ch. 3+200', risk:'moderate', cause:'Speed differentials, pedestrian crossings', stats:'~38 incidents/yr', advice:'50 km/h urban limit, check blind spots', coords:[27.6770,85.3520] }
  ],

  corridorSafety: {
    'ktm-nbz': { risk:'high', incidents:72, quality:88, hazards:['Steep downhill (-480m)','Freight brake fade','Nagdhunga hairpins'], speed:35, blackspot:'bs-nagdhunga-descent' },
    'nbz-mgl': { risk:'high', incidents:56, quality:74, hazards:['Trishuli gorge cliffs','Blind S-curves','Wet hydroplaning'], speed:45, blackspot:'bs-jogimara-curves' },
    'mgl-dml': { risk:'moderate', incidents:48, quality:52, hazards:['4-lane expansion','Loose gravel','Single-lane detours'], speed:30, blackspot:'bs-byas-tanahun-widening' },
    'mgl-cht': { risk:'critical', incidents:95, quality:78, hazards:['Charkilo Jalbire rock chutes','River gorge depth','Night freight flow'], speed:40, blackspot:'bs-charkilo-jalbire' },
    'cht-btl': { risk:'high', incidents:68, quality:72, hazards:['Daunne pass hairpins','Truck breakdowns','Loose shoulders'], speed:40, blackspot:'bs-daunne-hill-pass' },
    'btl-plp': { risk:'critical', incidents:84, quality:64, hazards:['Siddhababa shale rockfalls','Blind canyon turns','Tinau cliff edge'], speed:30, blackspot:'bs-siddhababa-cliff' },
    'dhk-sdh': { risk:'high', incidents:44, quality:84, hazards:['Single-lane mountain road','180 switchbacks','Sun Koshi drop-offs'], speed:30, blackspot:'bs-sindhuli-hairpins' }
  },

  trafficCorridors: {
    'tr-daunne': {
      name:'Daunne Hill Chokepoint (H01)', code:'H01', section:'Bardaghat to Dumkibas (14 km)',
      distance:14, freeFlow:20, peak:75, best:'05:00 AM – 07:30 AM', worst:'03:30 PM – 07:30 PM',
      bottlenecks:['Single-lane alternating at ADB widening cuts','Heavy 10-wheeler freight at 5-10 km/h','Monsoon mud puddles'],
      tips:['Early morning saves 45-60 mins','Friday 4-7 PM: queues up to 4 km','4WD handles muddy shoulders better'],
      hourly: {
        weekday:[
          {start:8,end:11,m:2.1,level:'heavy',note:'Morning intercity & freight rush'},
          {start:12,end:14,m:1.6,level:'moderate',note:'Mid-day construction'},
          {start:15,end:19,m:3.2,level:'standstill',note:'Peak cargo convoys & alternating 1-way'},
          {start:20,end:22,m:2.4,level:'heavy',note:'Night sleeper buses'}
        ],
        friday:[
          {start:8,end:11,m:2.3,level:'heavy',note:'Pre-weekend cargo'},
          {start:13,end:15,m:2.2,level:'heavy',note:'Early weekend build-up'},
          {start:16,end:21,m:3.8,level:'standstill',note:'Weekend exodus choke'},
          {start:22,end:23,m:2.7,level:'heavy',note:'Overnight sleeper buses'}
        ],
        saturday:[
          {start:9,end:12,m:1.8,level:'moderate',note:'Weekend car & bike traffic'},
          {start:14,end:18,m:2.5,level:'heavy',note:'Afternoon return flows'}
        ],
        festival:[
          {start:6,end:22,m:3.9,level:'standstill',note:'Dashain/Tihar peak migration'}
        ]
      }
    },
    'tr-mugling-abukhaireni': {
      name:'Mugling - Abukhaireni Widening (H04)', code:'H04', section:'Marshyangdi Bridge to Abukhaireni (12 km)',
      distance:12, freeFlow:15, peak:48, best:'06:00 AM – 08:30 AM', worst:'11:30 AM – 03:30 PM & 08:00 PM – 10:30 PM',
      bottlenecks:['Scheduled 20-min halts for rock blasting','Marshyangdi bridge bottleneck','Heavy dump trucks'],
      tips:['Check DOR blasting schedules (11AM-1PM, 3-4PM)','Night departure: 8-11 PM high volumes','Extra distance near gorge gravel'],
      hourly: {
        weekday:[
          {start:9,end:11,m:1.9,level:'moderate',note:'Morning intercity transit'},
          {start:11,end:14,m:2.8,level:'heavy',note:'Hill blasting & equipment ops'},
          {start:16,end:19,m:2.2,level:'heavy',note:'Tourist & freight convergence'},
          {start:20,end:23,m:2.6,level:'heavy',note:'Night sleeper & container trucks'}
        ],
        friday:[
          {start:11,end:15,m:2.6,level:'heavy',note:'Blasting & outbound tourists'},
          {start:16,end:22,m:3.2,level:'standstill',note:'Friday night Pokhara rush'}
        ],
        saturday:[
          {start:8,end:11,m:1.8,level:'moderate',note:'Weekend excursions'},
          {start:16,end:20,m:2.5,level:'heavy',note:'Return traffic'}
        ]
      }
    },
    'tr-nagdhunga': {
      name:'Nagdhunga Inbound Checkpost (H02/H04)', code:'H02/H04', section:'Khanikhola to Nagdhunga Summit (8 km)',
      distance:8, freeFlow:12, peak:52, best:'04:30 AM – 06:30 AM & 01:00 PM – 03:00 PM', worst:'06:30 PM – 11:30 PM (inbound) & 07:00 AM – 10:30 AM (outbound)',
      bottlenecks:['Daytime truck ban queuing until 7PM','Overloaded tipper hill climbs','Security checkpost delays'],
      tips:['Avoid 7-10 PM uphill crawl','Use Nagdhunga tunnel bypass when open','Check coolant before Khokha climb'],
      hourly: {
        weekday:[
          {start:7,end:10,m:2.3,level:'heavy',note:'Morning outbound bus surge'},
          {start:18,end:23,m:3.8,level:'standstill',note:'Cargo truck uphill crawl'}
        ],
        friday:[
          {start:14,end:19,m:3.1,level:'heavy',note:'Valley escape rush'},
          {start:19,end:23,m:4.1,level:'standstill',note:'Freight + holiday buses'}
        ]
      }
    },
    'tr-narayanghat-mugling': {
      name:'Narayanghat - Mugling Trishuli Gorge (H05)', code:'H05', section:'Bharatpur to Mugling Bridge (36 km)',
      distance:36, freeFlow:45, peak:110, best:'05:30 AM – 08:00 AM', worst:'04:30 PM – 08:30 PM',
      bottlenecks:['Tuin Khola bridge rock-cutting','Heavy trucks on river curves','Landslide clearance machinery'],
      tips:['Check monsoon alerts at Tuin Khola','Night travel 1-4 AM smoothest','Crucial Kathmandu-Pokhara-Terai link'],
      hourly: {
        weekday:[
          {start:8,end:11,m:1.7,level:'moderate',note:'Morning freight & Terai buses'},
          {start:15,end:19,m:2.3,level:'heavy',note:'Afternoon container trucks'},
          {start:20,end:23,m:2.1,level:'heavy',note:'Overnight convoys'}
        ]
      }
    },
    'tr-sindhuli-bp': {
      name:'Sindhuli Gadhi Serpentine Ridge (H13)', code:'H13', section:'Nepalthok to Sindhuli Madi (42 km)',
      distance:42, freeFlow:60, peak:125, best:'06:00 AM – 09:00 AM', worst:'02:00 PM – 06:30 PM',
      bottlenecks:['Hairpin switchbacks (no trucks)','Overtaking behind slow microbuses','Rosha Khola flash floods'],
      tips:['Heavy freight prohibited on BP Highway','Brake cooling stop at crest','Weekend photography causes shoulder jams'],
      hourly: {
        weekday:[
          {start:8,end:11,m:1.6,level:'moderate',note:'Eastern Nepal microbuses'},
          {start:13,end:17,m:1.9,level:'heavy',note:'Mid-day outbound microbuses'}
        ]
      }
    },
    'tr-siddhababa': {
      name:'Siddhababa Rock Shed Zone (H10)', code:'H10', section:'Butwal to Dobhan (6 km)',
      distance:6, freeFlow:10, peak:38, best:'06:00 AM – 08:30 AM', worst:'11:00 AM – 04:30 PM',
      bottlenecks:['Rock-shed tunnel construction','15-min stoppages for clearing','Single-lane bridge'],
      tips:['Avoid during heavy rainfall','Speed limited to 20 km/h','Early morning optimal visibility'],
      hourly: {
        weekday:[
          {start:9,end:12,m:2.2,level:'moderate',note:'Construction & morning buses'},
          {start:13,end:17,m:2.9,level:'heavy',note:'Rock-shed assembly & dump trucks'}
        ]
      }
    }
  },

  // Highway directory: full details for all 16 NH highways with segments
  highwayDirectory: [
    { code:'H01', name:'Mahendra Highway', np:'महेन्द्र राजमार्ग', length:1027, status:'caution', terrain:'Plains', desc:'East-West highway spanning all Terai districts. 4-lane upgrade underway on Narayanghat-Butwal section.', dor:'DOR Central Project Directorate', contact:'103' },
    { code:'H02', name:'Tribhuvan Highway', np:'त्रिभुवन राजमार्ग', length:160, status:'clear', terrain:'High Mountain', desc:'Historic Kathmandu-Birgunj route via Daman Pass (2322m). Part of Asian Highway AH4.', dor:'DOR Hetauda & Kathmandu', contact:'+977-57-520288' },
    { code:'H03', name:'Araniko Highway', np:'अरनिको राजमार्ग', length:113, status:'caution', terrain:'Hilly', desc:'Kathmandu-Kodari China border via Bhaktapur and Dhulikhel.', dor:'DOR Charikot & Bhaktapur', contact:'+977-11-660144' },
    { code:'H04', name:'Prithvi Highway', np:'पृथ्वी राजमार्ग', length:174, status:'caution', terrain:'Hilly', desc:'Kathmandu-Pokhara via Nagdhunga tunnel and Trishuli gorge.', dor:'DOR Bharatpur & Tanahun', contact:'+977-1-4286577' },
    { code:'H05', name:'Narayanghat-Mugling Highway', np:'नारायणगढ–मुग्लिन सडक', length:36, status:'caution', terrain:'Hilly', desc:'Commercial lifeline carrying 90% of freight between Terai and hills.', dor:'DOR Bharatpur', contact:'+977-56-520100' },
    { code:'H06', name:'Karnali Highway', np:'कर्णाली राजमार्ग', length:232, status:'caution', terrain:'High Mountain', desc:'Surkhet-Jumla via remote limestone gorges to Rara Lake.', dor:'DOR Jumla & Surkhet', contact:'+977-87-520133' },
    { code:'H08', name:'Eastern Ring Road', np:'पूर्वी रिंगरोड', length:80, status:'clear', terrain:'Plains', desc:'Dharan-Biratnagar bypass.', dor:'DOR Biratnagar', contact:'103' },
    { code:'H09', name:'Himalayan Highway (East)', np:'हिमालयन राजमार्ग (पूर्व)', length:100, status:'caution', terrain:'High Mountain', desc:'Kakarbhitta-Ilam via Dhankuta.', dor:'DOR Ilam', contact:'+977-23-520200' },
    { code:'H10', name:'Siddhartha Highway', np:'सिद्धार्थ राजमार्ग', length:181, status:'caution', terrain:'High Mountain', desc:'Sunauli-Bhairahawa-Pokhara via Siddhababa tunnel.', dor:'DOR Palpa & Butwal', contact:'+977-75-520120' },
    { code:'H12', name:'Kohalpur-Surkhet Highway', np:'कोहलपुर-सुर्खेत सडक', length:125, status:'warning', terrain:'Terai-Hilly', desc:'Connects Mahendra to Karnali region.', dor:'DOR Banke & Surkhet', contact:'103' },
    { code:'H13', name:'BP Koirala Highway', np:'बिपी कोइराला राजमार्ग', length:160, status:'caution', terrain:'High Mountain', desc:'Banepa-Bardibas via Sindhuli Gadhi gorge.', dor:'DOR Sindhuli & Bhaktapur', contact:'+977-47-520144' },
    { code:'H14', name:'Mechi Highway', np:'मेची राजमार्ग', length:180, status:'moderate', terrain:'Hilly', desc:'Biratnagar-Ramdhuni via Dhankuta hills.', dor:'DOR Dhankuta', contact:'103' },
    { code:'H15', name:'Mid-Hill Highway', np:'मध्यपहाडी लोकमार्ग', length:1879, status:'under_construction', terrain:'High Mountain', desc:'Pushpalal Highway spanning all mid-hill districts.', dor:'Pushpalal Highway Project', contact:'+977-1-4287890' },
    { code:'H16', name:'Eastern Highway', np:'पूर्वी राजमार्ग', length:350, status:'caution', terrain:'Hilly', desc:'Dharan-Jhapa via Purbi Marga.', dor:'DOR Biratnagar', contact:'103' },
    { code:'H17', name:'Koshi Highway', np:'कोशी राजमार्ग', length:66, status:'clear', terrain:'Hilly', desc:'Biratnagar-Bhadraua.', dor:'DOR Biratnagar', contact:'103' },
    { code:'H18', name:'Koshi Tappu Highway', np:'कोशी टाप्पु राजमार्ग', length:108, status:'moderate', terrain:'Plains', desc:'Rajbiraj-Biratchowk via Koshi Tappu.', dor:'DOR Sunsari', contact:'103' }
  ],

  // Mountain passes with coordinates and elevation
  mountainPasses: [
    { name:'Nagdhunga Pass', code:'H02/H04', elevation:1510, lat:27.7020, lng:85.2010, note:'Nagdhunga Tunnel bypasses 480m descent' },
    { name:'Daman Pass', code:'H02', elevation:2322, lat:27.5500, lng:85.0667, note:'Panoramic Himalayan views including Everest' },
    { name:'Sindhuli Gadhi Pass', code:'H13', elevation:1100, lat:27.2486, lng:85.9186, note:'Anglo-Nepal war historic fort' },
    { name:'Kodari Pass', code:'H03', elevation:1640, lat:27.9497, lng:85.9452, note:'China/Tibet border at Tatopani' },
    { name:'Siddhababa Pass', code:'H10', elevation:520, lat:27.7600, lng:83.4700, note:'Rock-shed tunnel under construction' },
    { name:'Daunne Hill Pass', code:'H01', elevation:650, lat:27.5700, lng:83.8500, note:'18 blind switchbacks, widening in progress' }
  ],

  // Major cities with full population and district info for search
  allPlaces: [
    { name:'Biratnagar', district:'Morang', lat:26.4525, lng:87.2718, type:'City Hub', icon:'🏙️' },
    { name:'Birgunj', district:'Parsa', lat:27.0128, lng:84.8774, type:'City Hub', icon:'🏙️' },
    { name:'Bhairahawa', district:'Rupandehi', lat:27.5045, lng:83.4503, type:'City Hub', icon:'🏙️' },
    { name:'Bardibas', district:'Mahottari', lat:26.9740, lng:85.9024, type:'City Hub', icon:'🏙️' },
    { name:'Butwal', district:'Rupandehi', lat:27.7006, lng:83.4484, type:'City Hub', icon:'🏙️' },
    { name:'Chitwan', district:'Chitwan', lat:27.6833, lng:84.4333, type:'City Hub', icon:'🏙️' },
    { name:'Dhading', district:'Dhading', lat:27.8750, lng:84.8833, type:'City Hub', icon:'🏙️' },
    { name:'Dharan', district:'Sunsari', lat:26.8124, lng:87.2834, type:'City Hub', icon:'🏙️' },
    { name:'Dhangadhi', district:'Kailali', lat:28.6946, lng:80.5977, type:'City Hub', icon:'🏙️' },
    { name:'Dhulikhel', district:'Kavrepalanchok', lat:27.6221, lng:85.5428, type:'Scenic Town', icon:'🏔️' },
    { name:'Hetauda', district:'Makwanpur', lat:27.4285, lng:85.0331, type:'City Hub', icon:'🏙️' },
    { name:'Janakpur', district:'Dhanusha', lat:26.7271, lng:85.9408, type:'City Hub', icon:'🏙️' },
    { name:'Jumla', district:'Jumla', lat:29.2747, lng:82.1838, type:'Hill Town', icon:'🏔️' },
    { name:'Kakarbhitta', district:'Jhapa', lat:26.6508, lng:88.1565, type:'Border Town', icon:'🚧' },
    { name:'Kathmandu', district:'Kathmandu', lat:27.7172, lng:85.3240, type:'Capital', icon:'🏛️' },
    { name:'Kathmandu Airport (TIA)', district:'Kathmandu', lat:27.6968, lng:85.3591, type:'Airport', icon:'✈️' },
    { name:'Kohalpur', district:'Banke', lat:28.1900, lng:81.6900, type:'City Hub', icon:'🏙️' },
    { name:'Kodari', district:'Sindhupalchok', lat:27.9497, lng:85.9452, type:'Border', icon:'🚧' },
    { name:'Lazimpur', district:'Chitwan', lat:27.6667, lng:84.4500, type:'City Hub', icon:'🏙️' },
    { name:'Mahendranagar', district:'Kanchanpur', lat:28.9667, lng:80.1833, type:'City Hub', icon:'🏙️' },
    { name:'Nepalgunj', district:'Banke', lat:28.0500, lng:81.6167, type:'City Hub', icon:'🏙️' },
    { name:'Pokhara', district:'Kaski', lat:28.2096, lng:83.9856, type:'City Hub', icon:'🏔️' },
    { name:'Rajbiraj', district:'Saptari', lat:26.5789, lng:86.5546, type:'City Hub', icon:'🏙️' },
    { name:'Siddharthanagar', district:'Rupandehi', lat:27.5045, lng:83.4503, type:'City Hub', icon:'🏙️' },
    { name:'Sindhuli Gadhi', district:'Sindhuli', lat:27.2486, lng:85.9186, type:'Historical', icon:'🏰' },
    { name:'Surkhet', district:'Surkhet', lat:28.5997, lng:81.6334, type:'City Hub', icon:'🏙️' },
    { name:'Tansen', district:'Palpa', lat:27.8683, lng:83.5489, type:'Hill Town', icon:'🏔️' },
    { name:'Tiju', district:'Sankhuwasabha', lat:27.6667, lng:87.4167, type:'Hill Town', icon:'🏔️' },
    { name:'Ilam', district:'Ilam', lat:26.9117, lng:87.9275, type:'Hill Town', icon:'🏔️' },
    { name:'Baglung', district:'Baglung', lat:28.2725, lng:83.6006, type:'Hill Town', icon:'🏔️' },
    { name:'Biratnagar Airport (BTR)', district:'Morang', lat:26.4525, lng:87.2718, type:'Airport', icon:'✈️' },
    { name:'Biratpur Airport', district:'Chitwan', lat:27.6833, lng:84.4333, type:'Airport', icon:'✈️' },
    { name:'Jomsom Airport', district:'Mustang', lat:28.7833, lng:83.6833, type:'Airport', icon:'✈️' },
    { name:'Nepalgunj Airport', district:'Banke', lat:28.0500, lng:81.6167, type:'Airport', icon:'✈️' },
    { name:'Pokhara Airport (PIA)', district:'Kaski', lat:28.2096, lng:83.9856, type:'Airport', icon:'✈️' }
  ]
};
