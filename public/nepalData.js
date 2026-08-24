/**
 * Mero Sadak — Static Reference Data
 * Loads cities, places, emergency contacts, and dialects from local data files.
 * Live weather, traffic, incidents, and POIs are fetched from the Worker API.
 */

async function loadStaticData() {
  try {
    const [citiesRes, placesRes] = await Promise.all([
      fetch('data/cities.json?v=' + Date.now()).then(r => r.json()).catch(() => []),
      fetch('data/places.json?v=' + Date.now()).then(r => r.json()).catch(() => [])
    ]);

    window.NEPAL_DATA = window.NEPAL_DATA || {};
    window.NEPAL_DATA.cities = citiesRes;
    window.NEPAL_DATA.places = placesRes;
    window.NEPAL_DATA.tollFees = {
      nagdhungaTunnel: {
        name: 'Nagdhunga Tunnel (Naubise–Kathmandu)',
        notice: 'Nepal Gazette, Chaitra 26, 2082 BS (April 2026)',
        authority: 'Ministry of Physical Infrastructure and Transport',
        categories: [
          { label: 'Light vehicles', vehicles: 'Cars, vans, pickups, tractors, microbuses', entry: 65, exit: 60 },
          { label: 'Mini buses / tippers', vehicles: 'Mini buses, mini trucks, tippers', entry: 115, exit: 80 },
          { label: 'Buses / single axle', vehicles: 'Buses, single rear-axle trucks', entry: 260, exit: 200 },
          { label: 'Multi-axle / heavy', vehicles: 'Multi-axle trucks, heavy equipment', entry: 600, exit: 250 }
        ],
        paymentMethods: ['Cash', 'QR Code (Fonepay)', 'RFID Sticker', 'N-Tag (RFID)'],
        revenueTo: 'Road Board Nepal'
      }
    };
    window.NEPAL_DATA.emergencyHotlines = [
      { name: 'Nepal Police Emergency', number: '100', tel: 'tel:100', badge: '🚔 100', role: 'General Law & Emergency First Responders' },
      { name: 'Nepal Traffic Police', number: '103', tel: 'tel:103', badge: '🚦 103', role: 'Highway Road Rescue & Traffic Obstructions' },
      { name: 'Tourist Police Nepal', number: '1144', tel: 'tel:1144', badge: '🏔️ 1144', role: 'Foreign Travelers & Trekking Route Assistance' },
      { name: 'Ambulance (Red Cross)', number: '102', tel: 'tel:102', badge: '🚑 102', role: 'Immediate Medical & Trauma Evacuation' },
      { name: 'Armed Police Force (APF)', number: '1114', tel: 'tel:1114', badge: '🛡️ 1114', role: 'Disaster Relief & Landslide Search-and-Rescue' },
      { name: 'Road Department (DoR)', number: '+977-1-4262693', tel: 'tel:+97714262693', badge: '🏗️ DoR', role: 'Heavy Machinery, Road Blockage & Bulldozer Dispatch' }
    ];
    window.NEPAL_DATA.emergencyContacts = [
      { title: 'Nepal Police Emergency Control', number: '100', icon: '🚨', type: 'Primary Emergency' },
      { title: 'Nepal Highway Traffic Police Control', number: '103', icon: '🚓', type: 'Highway Traffic & Patrol' },
      { title: 'Nepal Red Cross Ambulance Service', number: '102', icon: '🚑', type: 'Medical & Trauma' },
      { title: 'Nepal Tourist Police Helpline', number: '1144', icon: '👮‍♂️', type: 'Tourist Security & Assistance' },
      { title: 'Department of Roads (DOR) Highway Help', number: '01-5525527', icon: '🛣️', type: 'DOR Road Emergency Control' },
      { title: 'Armed Police Force (APF) Disaster Rescue', number: '1114', icon: '🦺', type: 'Landslide & Flood Rescue' },
      { title: 'Nepal Disaster Management (NDRRMA)', number: '1155', icon: '⚠️', type: 'Monsoon & Landslide Alert' }
    ];
    window.NEPAL_DATA.distressTypes = {
      accident: { label: 'Road Accident / Vehicle Collision', nepaliLabel: 'सडक दुर्घटना / गाडी ठोक्किएको', iconEmoji: '🚨', priority: 'Critical' },
      landslide_obstruction: { label: 'Landslide / Rockfall / Mudflow Trapped', nepaliLabel: 'पहिरो / ढुङ्गा खसेर थुनिएको', iconEmoji: '⛰️', priority: 'Critical' },
      medical: { label: 'Acute Medical Emergency / Altitude Sickness', nepaliLabel: 'आकस्मिक स्वास्थ्य समस्या / लेक लागेको', iconEmoji: '🚑', priority: 'Critical' },
      offroad_distress: { label: 'Vehicle Slipped Off-Road / Cliff Edge Danger', nepaliLabel: 'सडकबाट चिप्लिएको / भीरको जोखिम', iconEmoji: '🆘', priority: 'Critical' },
      vehicle_breakdown: { label: 'Mechanical Failure / Engine / Axle / Brake Breakdown', nepaliLabel: 'गाडी बिग्रिएको / इन्जिन वा ब्रेक फेल', iconEmoji: '🚙', priority: 'Urgent' },
      ev_battery_or_fuel: { label: 'EV Battery Depleted / Out of Fuel on Remote Pass', nepaliLabel: 'इभी चार्ज सकिएको / इन्धन रित्तिएको', iconEmoji: '⚡', priority: 'Urgent' },
      mountain_weather: { label: 'Severe Blizzard / Flash Flood / Torrential Whiteout', nepaliLabel: 'हिमपात / बाढी / भारी वर्षामा अलपत्र', iconEmoji: '🌨️', priority: 'Urgent' },
      general_rescue: { label: 'General Rescue / Stranded Traveler Assistance', nepaliLabel: 'अन्य उद्धार तथा सहयोग', iconEmoji: '🚩', priority: 'High' }
    };
    window.NEPAL_DATA.dialects = [
      {
        id: 'doteli', name: 'Doteli / Far-West (डोटेली)', region: 'Sudurpashchim (Kailali, Dadeldhura, Doti, Baitadi)',
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
        id: 'maithili', name: 'Maithili (मैथिली)', region: 'Madhesh (Janakpur, Siraha, Saptari, Dhanusha)',
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
        id: 'bhojpuri', name: 'Bhojpuri (भोजपुरी)', region: 'Madhesh / Lumbini (Birgunj, Bara, Parsa, Rautahat, Nawalparasi)',
        description: 'Widely spoken on Tribhuvan & Postal corridors.',
        phrases: [
          { eng: 'Where does this road go?', nep: 'यो बाटो कता जान्छ?', local: 'ई रस्ता कहाँ जाला?', pron: 'Ee rasta kahaan jaala?' },
          { eng: 'Is the highway clear?', nep: 'राजमार्ग खुला छ?', local: 'हाइवे साफ बा कि जाम बा?', pron: 'Highway saaf ba ki jaam ba?' },
          { eng: 'How much for towing/repair?', nep: 'गाडी तानेको / बनाएको कति लिने?', local: 'गाडी बनावे के केतना लागी?', pron: 'Gadi banawe ke ketna laagi?' },
          { eng: 'Where can we get drinking water and food?', nep: 'खानेपानी र खाना कता पाइन्छ?', local: 'पानी आ खाना कहाँ मिली?', pron: 'Paani aa khaana kahaan mili?' }
        ]
      },
      {
        id: 'newari', name: 'Nepal Bhasa / Newari (नेपाल भाषा)', region: 'Kathmandu Valley (Kathmandu, Lalitpur, Bhaktapur, Banepa)',
        description: 'Traditional language in Kathmandu Valley highway entries.',
        phrases: [
          { eng: 'Where does this road go?', nep: 'यो बाटो कता जान्छ?', local: 'थ्व लँ गन वनी?', pron: 'Thwa lan gana wani?' },
          { eng: 'Is there heavy traffic ahead?', nep: 'अगाडि धेरै जाम छ?', local: 'न्ह्योने यक्व जाम दु ला?', pron: 'Nhyone yakwa jaam du la?' },
          { eng: 'Where is the police station?', nep: 'प्रहरी चौकी कता छ?', local: 'पुलिस चौकी गन दु?', pron: 'Police chowki gana du?' },
          { eng: 'Thank you for your help.', nep: 'सहयोगको लागि धन्यवाद।', local: 'ग्वाहालि यानादीगुया निंतिं सुभाय्।', pron: 'Gwahali yanaadiguya nintin Subhay.' }
        ]
      },
      {
        id: 'tharu', name: 'Tharu (थारू)', region: 'Terai Belt (Dang, Banke, Bardiya, Kailali, Chitwan)',
        description: 'Spoken across agricultural and highway towns in the plains.',
        phrases: [
          { eng: 'Where does this road go?', nep: 'यो बाटो कता जान्छ?', local: 'यी डहर काँह जाइठ?', pron: 'Yee dahar kaanha jaith?' },
          { eng: 'Is the river crossing safe?', nep: 'खोला तर्न सकिन्छ?', local: 'खोला पार करे सेकजाइठ कि नाइ?', pron: 'Khola paar kare sekjaith ki naai?' },
          { eng: 'Where can I find EV charging or fuel?', nep: 'पेट्रोल वा बिजुली चार्ज कहाँ पाइन्छ?', local: 'पेट्रोल आ बत्ती चार्ज करेक ठाउँ काँह बा?', pron: 'Petrol aa batti charge karek thau kaanha ba?' }
        ]
      }
    ];
    return true;
  } catch (e) {
    console.error('Static data load error:', e);
    return false;
  }
}
