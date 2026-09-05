export interface DialectInfo {
  id: string;
  name: string;
  nativeName: string;
  provinces: string[];
  primaryHighways: string[];
  keyRegions: string[];
  greeting: string;
  thankYou: string;
  culturalTip: string;
  badgeColor: string;
}

export type PhraseCategory =
  | 'direction_road'
  | 'landslide_weather'
  | 'mechanic_breakdown'
  | 'tea_food_stay'
  | 'transit_bus_fare'
  | 'fuel_ev_charging'
  | 'courtesy_greetings'
  | 'emergency_safety';

export interface RegionalPhrase {
  id: string;
  category: PhraseCategory;
  english: string;
  standardNepali: string;
  standardNepaliRomanized: string;
  translations: Record<string, { text: string; romanized: string; note?: string }>;
  contextTip?: string;
  audioTextNepali?: string;
}

export const NEPAL_DIALECTS: DialectInfo[] = [
  {
    id: 'standard_nepali',
    name: 'Standard Nepali (Khas)',
    nativeName: 'मानक नेपाली (खस)',
    provinces: ['Bagmati', 'Gandaki', 'All Provinces'],
    primaryHighways: ['H01 Mahendra', 'H04 Prithvi', 'H02 Tribhuvan', 'H13 BP Highway', 'H17 Mid-Hill'],
    keyRegions: ['Kathmandu Valley', 'Pokhara', 'Chitwan', 'Hetauda', 'Nationwide Hubs'],
    greeting: 'नमस्ते (Namaste) / नमस्कार (Namaskar)',
    thankYou: 'धन्यवाद (Dhanyabad)',
    culturalTip: 'Adding "Hajur" (हजुर) at the start or end of sentences denotes utmost politeness and respect everywhere in Nepal.',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  },
  {
    id: 'doteli',
    name: 'Doteli / Khas (Far-Western)',
    nativeName: 'डोटेली / मानसखण्ड खस',
    provinces: ['Sudurpashchim', 'Karnali'],
    primaryHighways: ['H01 Far-West', 'H14 Mahakali', 'H06 Karnali Highway', 'Seti Corridor'],
    keyRegions: ['Dhangadhi', 'Dadeldhura', 'Baitadi', 'Doti (Silgadhi)', 'Sanfebagar', 'Jumla'],
    greeting: 'पैलाग (Pailaag) / नमस्ते (Namaste)',
    thankYou: 'धन्यवाद / भलो होउ (Bhalo Hou)',
    culturalTip: 'In Sudurpashchim, "Pailaag" (touching feet in greeting) is the traditional humble greeting to elders. Pronouns like "Mui" (I) and "Tui" (you) are uniquely Doteli.',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  },
  {
    id: 'maithili',
    name: 'Maithili (Eastern Terai)',
    nativeName: 'मैथिली',
    provinces: ['Madhesh', 'Koshi'],
    primaryHighways: ['H01 East Mahendra', 'H16 Postal Highway', 'Janakpur Bypass'],
    keyRegions: ['Janakpurdham', 'Biratnagar', 'Bardibas', 'Saptari (Rajbiraj)', 'Siraha', 'Mahottari'],
    greeting: 'प्रणाम (Pranaam) / गोर लागै छी (Gor Lagai Chhi)',
    thankYou: 'धन्यवाद / आभार (Aabhaar)',
    culturalTip: '"Gor Lagai Chhi" is a traditional respectful salutation in Mithila culture. Speaking with high honorific "Ahan" (अहाँ) shows hospitality.',
    badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
  },
  {
    id: 'bhojpuri',
    name: 'Bhojpuri (Central Terai)',
    nativeName: 'भोजपुरी',
    provinces: ['Madhesh', 'Lumbini'],
    primaryHighways: ['H02 Tribhuvan Bypass', 'H01 Narayangadh-Butwal', 'Birgunj Corridor'],
    keyRegions: ['Birgunj', 'Parsa', 'Bara (Kalaiya)', 'Rautahat (Gaur)', 'Nawalparasi', 'Rupandehi'],
    greeting: 'प्रणाम (Pranaam) / राम राम (Ram Ram)',
    thankYou: 'धन्यवाद (Dhanyabaad)',
    culturalTip: 'Bhojpuri is widely spoken in the industrial trade hubs between Birgunj and Butwal. "Ka haal ba?" is a friendly opening for how are you.',
    badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
  },
  {
    id: 'tharu',
    name: 'Tharu (Terai Belt)',
    nativeName: 'थारु (डंगौरा / राना)',
    provinces: ['Lumbini', 'Sudurpashchim', 'Madhesh'],
    primaryHighways: ['H01 Mahendra Highway Terai stretches', 'Postal Highway Terai'],
    keyRegions: ['Dang Valley', 'Nepalgunj', 'Chitwan Plains', 'Kailali', 'Bardiya', 'Kanchanpur'],
    greeting: 'राम राम (Ram Ram) / सेवा (Sewa)',
    thankYou: 'धन्यवाद (Dhanyabad)',
    culturalTip: 'Tharu communities are very welcoming along the national park highway corridors. "Sewa" or "Ram Ram" initiates warm local rapport.',
    badgeColor: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  },
  {
    id: 'tamang',
    name: 'Tamang (Bagmati Hills)',
    nativeName: 'तामाङ ग्योइ',
    provinces: ['Bagmati', 'Gandaki'],
    primaryHighways: ['H03 Arniko', 'H13 BP Highway Hills', 'Galchhi-Trishuli', 'Pasang Lhamu Highway'],
    keyRegions: ['Sindhupalchok', 'Rasuwa (Dhunche)', 'Kavrepalanchok', 'Nuwakot', 'Dhading Hills'],
    greeting: 'फ्याफुल्ला (Lhaso Fyafulla)',
    thankYou: 'थुचेछे (Thuchechhe)',
    culturalTip: '"Fyafulla" is the universal warm greeting in Tamang hill settlements and tea houses along Arniko, BP, and Langtang access corridors.',
    badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
  },
  {
    id: 'newari',
    name: 'Newari (Nepal Bhasa)',
    nativeName: 'नेपाल भाषा',
    provinces: ['Bagmati', 'Gandaki (Trading Hubs)'],
    primaryHighways: ['Kathmandu Ring Road', 'H03 Arniko Banepa', 'Bandipur Highway Access', 'Tansen Bazar'],
    keyRegions: ['Kathmandu Valley (Patan, Bhaktapur)', 'Banepa', 'Dhulikhel', 'Bandipur', 'Tansen'],
    greeting: 'ज्वजलपा (Jwajalapa)',
    thankYou: 'सुभाय् (Subhay)',
    culturalTip: '"Jwajalapa" with folded hands is the traditional Newar greeting. Newari cuisine stalls (Samay Baji, Choila) along trading routes appreciate this.',
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
  },
  {
    id: 'gurung',
    name: 'Gurung (Tamu Kyui)',
    nativeName: 'तमु क्युई (गुरुङ)',
    provinces: ['Gandaki'],
    primaryHighways: ['H04 Pokhara Valley', 'H15 Mid-Hill Highway Pokhara-Baglung', 'Besisahar-Manang Corridor'],
    keyRegions: ['Pokhara (Lakeside/Hemja)', 'Lamjung (Ghalegaun)', 'Kaski Hills', 'Gorkha', 'Tanahun'],
    greeting: 'फ्याफुल्ला / सेवारो (Fyafulla / Sewaro) / नमस्ते',
    thankYou: 'थुचेछे (Thuchechhe)',
    culturalTip: 'In Gandaki hill trails and homestays, greeting homestay owners with "Tashi Delek" or "Fyafulla" builds instant warmth with Gurung hosts.',
    badgeColor: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
  },
  {
    id: 'sherpa',
    name: 'Sherpa / Himalayan (Bod-kyi)',
    nativeName: 'शेर्पा भाषा / भोटे',
    provinces: ['Koshi', 'Bagmati', 'Gandaki (High Passes)'],
    primaryHighways: ['Salleri-Okhaldhunga Access', 'Jiri-Shivalaya', 'Manang-Mustang Pass Route'],
    keyRegions: ['Solukhumbu', 'Okhaldhunga', 'Langtang Gosaikunda Corridor', 'Mustang (Muktinath)'],
    greeting: 'ताशी देलेक (Tashi Delek)',
    thankYou: 'थुजेछे (Thujeychhe)',
    culturalTip: '"Tashi Delek" (Blessings & Good Fortune) is the universal greeting for Himalayan pass crossings, mountain lodges, and high-altitude checkpoints.',
    badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  },
  {
    id: 'limbu',
    name: 'Limbu (Yakthungpan)',
    nativeName: 'याक्थुङ पान् (लिम्बू)',
    provinces: ['Koshi'],
    primaryHighways: ['H09 Mechi Highway', 'H08 Koshi Highway (Dharan-Dhankuta)', 'Tamor Corridor'],
    keyRegions: ['Ilam (Tea Gardens)', 'Panchthar (Phidim)', 'Taplejung (Pathibhara)', 'Dhankuta', 'Tehrathum'],
    greeting: 'सेवागेलो (Sewagelo) / सेवारो (Sewaro)',
    thankYou: 'नुगेन् (Nugen) / धन्यवाद',
    culturalTip: '"Sewaro" with palm-touch is the sacred Kirat Limbu greeting throughout the eastern hills of Koshi Province and tea trail stops.',
    badgeColor: 'bg-emerald-600/20 text-emerald-200 border-emerald-600/40',
  },
];

export const TRANSIT_PHRASE_CATEGORIES: { id: PhraseCategory; label: string; nepaliLabel: string; icon: string }[] = [
  { id: 'direction_road', label: 'Directions & Route Navigation', nepaliLabel: 'बाटो र दिशा सोधपुछ', icon: '🧭' },
  { id: 'landslide_weather', label: 'Landslides & Road Status', nepaliLabel: 'पहिरो, जाम र सडक अवस्था', icon: '⛰️' },
  { id: 'mechanic_breakdown', label: 'Mechanic & Breakdown Assistance', nepaliLabel: 'गाडी मर्मत र सहयोग', icon: '🔧' },
  { id: 'tea_food_stay', label: 'Highway Bhatti, Food & Lodge', nepaliLabel: 'खाना, चिया र बास', icon: '🍲' },
  { id: 'transit_bus_fare', label: 'Bus, Jeep, Ticket & Fares', nepaliLabel: 'बस, जीप र भाडा', icon: '🚌' },
  { id: 'fuel_ev_charging', label: 'Fuel, Oil & EV Charging', nepaliLabel: 'इन्धन र चार्जिङ स्टेशन', icon: '⚡' },
  { id: 'emergency_safety', label: 'Emergency Rescue & Police', nepaliLabel: 'आकस्मिक उद्धार र प्रहरी', icon: '🚨' },
  { id: 'courtesy_greetings', label: 'Greetings, Bargaining & Courtesy', nepaliLabel: 'अभिवादन र शिष्टाचार', icon: '🤝' },
];

export const REGIONAL_TRANSIT_PHRASES: RegionalPhrase[] = [
  // 1. Directions & Road Navigation
  {
    id: 'p_dir_1',
    category: 'direction_road',
    english: 'Which road goes towards Pokhara / Dhangadhi?',
    standardNepali: 'पोखरा / धनगढी जाने बाटो कुन हो हजुर?',
    standardNepaliRomanized: 'Pokhara / Dhangadhi jaane baato kun ho hajur?',
    translations: {
      doteli: {
        text: 'धनगढी जान्या बाटो कतुतिर हो दाजु?',
        romanized: 'Dhangadhi jaanya baato katutira ho daaju?',
        note: 'In Doteli, "Janya" means going, "Katutira" means which way.',
      },
      maithili: {
        text: 'पोखरा / विराटनगर जाए वाला रस्ता कोन छि?',
        romanized: 'Pokhara / Biratnagar jaae wala rasta kon chhi?',
        note: '"Rasta" is used for road, "Jaae wala" for going.',
      },
      bhojpuri: {
        text: 'ई रास्ता कहाँ जाई? पोखरा जाए खातिर कवन रस्ता बा?',
        romanized: 'Ee raasta kahaan jaayi? Pokhara jaae khaatir kavan rasta ba?',
      },
      tharu: {
        text: 'पोखरा जाइना डग्हर कून हो डदुआ?',
        romanized: 'Pokhara jaina daghar koon ho dadua?',
        note: '"Daghar" is the traditional Tharu word for path/road.',
      },
      tamang: {
        text: 'पोखरा याबा ग्याम खाङ्ला जिन्बा?',
        romanized: 'Pokhara yaaba gyaam khangla jinba?',
        note: '"Gyaam" means road/trail in Tamang.',
      },
      newari: {
        text: 'पोखरा वनेगु लँ गुगु खः?',
        romanized: 'Pokhara wanegu lam gugu kha?',
        note: '"Lam" (लँ) means road in Nepal Bhasa.',
      },
      sherpa: {
        text: 'पोखरा डोप्के लाम खाङ्बा यिन्?',
        romanized: 'Pokhara dopke laam khangba yin?',
        note: '"Laam" is mountain trail/pass road.',
      },
      limbu: {
        text: 'पोखरा पेम्बा लाम हेबे आन्?',
        romanized: 'Pokhara pemba laam hebe aan?',
      },
    },
    contextTip: 'Always point with an open hand rather than a single finger when confirming road junctions.',
  },
  {
    id: 'p_dir_2',
    category: 'direction_road',
    english: 'How far is the next town or junction from here?',
    standardNepali: 'यहाँबाट अर्को बजार वा चोक कति टाढा छ?',
    standardNepaliRomanized: 'Yahaanbaata arko bajaar waa chok kati taadha chha?',
    translations: {
      doteli: {
        text: 'याइँबाट अर्को बजार कति दुर छ?',
        romanized: 'Yaainbaata arko bajaar kati door chha?',
      },
      maithili: {
        text: 'एतय सं अगिला बजार कतेक दूर अछि?',
        romanized: 'Etay sa agila bajaar katek door achhi?',
      },
      bhojpuri: {
        text: 'इहाँ से अगिला बाजार कतना दूर बा?',
        romanized: 'Ihaan se agila bajaar katana door ba?',
      },
      tharu: {
        text: 'यहाँसे आघेक बजार कत्तिक दूर बा?',
        romanized: 'Yahanse aaghek bajaar kattik door ba?',
      },
      newari: {
        text: 'थ्वं मेगु बजार गुलि तापाः?',
        romanized: 'Thwo megu bajaar guli taapaa?',
      },
      tamang: {
        text: 'चुग्‍याम अर्को सहर कति थारबा मुला?',
        romanized: 'Chugyaam arko sahar kati thaarba mula?',
      },
      sherpa: {
        text: 'दिने सा अर्को सा ठाक्यो खादेक यिन्?',
        romanized: 'Dine sa arko sa thaakyo khaadek yin?',
      },
    },
  },
  {
    id: 'p_dir_3',
    category: 'direction_road',
    english: 'Is the road paved asphalt or rough gravel/off-road ahead?',
    standardNepali: 'अगाडिको बाटो पिच छ कि कच्ची / ग्राभेल छ?',
    standardNepaliRomanized: 'Agaadiko baato pitch chha ki kachhi / gravel chha?',
    translations: {
      doteli: {
        text: 'अगाडि बाटो पिच छ कि कच्चो-खुद्दो छ?',
        romanized: 'Agaadi baato pitch chha ki kachho-khuddo chha?',
      },
      maithili: {
        text: 'आगाँक रस्ता पक्की अछि कि काँच / माटिके?',
        romanized: 'Aagaank rasta pakki achhi ki kaanch / maatike?',
      },
      bhojpuri: {
        text: 'आगें के रास्ता पक्की बा कि कच्ची बा?',
        romanized: 'Aagen ke raasta pakki ba ki kachhi ba?',
      },
      tharu: {
        text: 'आघेक डग्हर पक्की बा कि कच्ची डग्हर हो?',
        romanized: 'Aaghek daghar pakki ba ki kachhi daghar ho?',
      },
    },
  },

  // 2. Landslides & Road Status
  {
    id: 'p_land_1',
    category: 'landslide_weather',
    english: 'Is the highway open ahead, or is it blocked by a landslide / rockfall?',
    standardNepali: 'अगाडि बाटो खुलेको छ कि पहिरोले बन्द छ हजुर?',
    standardNepaliRomanized: 'Agaadi baato khuleko chha ki pahirole banda chha hajur?',
    translations: {
      doteli: {
        text: 'अगाडि बाटो खुल्ला छ कि पैरोले थुनिएको छ?',
        romanized: 'Agaadi baato khulla chha ki pairole thunieko chha?',
        note: '"Pairo" is Doteli for landslide.',
      },
      maithili: {
        text: 'आगाँ रस्ता खुजल अछि कि बन्न अछि / पहिर खसल अछि?',
        romanized: 'Aagaan rasta khujal achhi ki bann achhi / pahir khasal achhi?',
      },
      bhojpuri: {
        text: 'आगें रास्ता चालू बा कि जाम / पहिर गिरल बा?',
        romanized: 'Aagen raasta chaaloo ba ki jaam / pahir giral ba?',
      },
      tharu: {
        text: 'आघेक डग्हर खुलल बा कि बन्द बा?',
        romanized: 'Aaghek daghar khulal ba ki band ba?',
      },
      tamang: {
        text: 'ग्याम फ्रेसिबा मुला कि प्हिरो दिबा मुला?',
        romanized: 'Gyaam phresiba mula ki phero diba mula?',
      },
      sherpa: {
        text: 'दिल्ला लाम घेबा यिन् कि सा रिल्नी बन्द यिन्?',
        romanized: 'Dilla laam gheba yin ki sa rilni banda yin?',
      },
      limbu: {
        text: 'लाम तेन्दुबा आन् कि खाम्मुक पे आन्?',
        romanized: 'Laam tenduba aan ki khammuk pe aan?',
      },
    },
    contextTip: 'Crucial for monsoon travel along Prithvi, Narayangadh-Mugling, Karnali, and BP Highways.',
  },
  {
    id: 'p_land_2',
    category: 'landslide_weather',
    english: 'How long will the dozer / loader take to clear the landslide?',
    standardNepali: 'डोजरले पहिरो पन्छाउन कति समय लाग्ला?',
    standardNepaliRomanized: 'Dojarle pahiro panchaauna kati samaya laagla?',
    translations: {
      doteli: {
        text: 'डोजरले पैरो सफा अद्दु कति बेला लाग्ला?',
        romanized: 'Dojarle pairo safaa addu kati belaa laagla?',
      },
      maithili: {
        text: 'पहिर हटाबऽ मे डोजरके कतेक काल लागत?',
        romanized: 'Pahir hataab me dozerke katek kaal laagat?',
      },
      bhojpuri: {
        text: 'डोजर से पहिर साफ होखे में कतना देरी लागी?',
        romanized: 'Dozer se pahir saaf hokhe mein katana deri laagi?',
      },
      tharu: {
        text: 'डोजरसे पहिरो हटाएक कत्तिक समय लागी?',
        romanized: 'Dozerse pahiro hataek kattik samay laagi?',
      },
    },
  },
  {
    id: 'p_land_3',
    category: 'landslide_weather',
    english: 'Is there an alternate bypass or detour route available?',
    standardNepali: 'यताबाट घुमेर जाने अर्को वैकल्पिक बाटो छ?',
    standardNepaliRomanized: 'Yataabaata ghumera jaane arko vaikolpik baato chha?',
    translations: {
      doteli: {
        text: 'यता बटि घुमियर जान्या दोसरो बाटो छ कि नाइँ?',
        romanized: 'Yata bati ghumiyar jaanya dosaro baato chha ki naain?',
      },
      maithili: {
        text: 'एतय सं घुमि कऽ जाए लेल दोसर रस्ता अछि?',
        romanized: 'Etay sa ghumi ka jaae lel dosar rasta achhi?',
      },
      bhojpuri: {
        text: 'कवनो दोसर रास्ता बा घूमि के जाए खातिर?',
        romanized: 'Kavano dosar raasta ba ghoomi ke jaae khaatir?',
      },
    },
  },

  // 3. Mechanic & Breakdown Assistance
  {
    id: 'p_mech_1',
    category: 'mechanic_breakdown',
    english: 'My vehicle broke down. Where is the nearest mechanic / puncture shop?',
    standardNepali: 'मेरो गाडी बिग्रियो। नजिकै वर्कसप वा पञ्चर टाल्ने पसल कहाँ छ?',
    standardNepaliRomanized: 'Mero gaadi bigriyo. Najikai workshop waa puncture taalne pasal kahaan chha?',
    translations: {
      doteli: {
        text: 'मेरो गाडी बिग्रिग्यो। नजिक पञ्चर टाल्न्या पसल कतुतिर छ?',
        romanized: 'Mero gaadi bigrigyo. Najik puncture taalnya pasal katutira chha?',
      },
      maithili: {
        text: 'हमार गाड़ी खराब भऽ गेल। नजदिक मे मिस्त्री / पञ्चर दोकान कतय अछि?',
        romanized: 'Hamaar gaadi kharaab bha gel. Najdik me mistri / puncture dokaan katay achhi?',
      },
      bhojpuri: {
        text: 'हमार गाड़ी बिगड़ गईल बा। नजदीक में पञ्चर दुकान कहाँ बा?',
        romanized: 'Hamaar gaadi bigad gayil ba. Najdeek mein puncture dukaan kahaan ba?',
      },
      tharu: {
        text: 'हमार गाड़ी बिगड़ल। लगही मिस्त्री दुकान कतह बा?',
        romanized: 'Hamaar gaadi bigdal. Lagahi mistri dukaan katah ba?',
      },
      tamang: {
        text: 'ङाला गाडी बिग्रिसिजी। नजिक मर्मत लबा दोकान खाङ्ला मुला?',
        romanized: 'Ngala gaadi bigrisiji. Najik marmat laba dokaan khangla mula?',
      },
      newari: {
        text: 'जिगु गाडी स्यात। सतीगु पञ्चर पसः गन दु?',
        romanized: 'Jigu gaadi syaata. Sateegu puncture pasa gana du?',
      },
    },
  },
  {
    id: 'p_mech_2',
    category: 'mechanic_breakdown',
    english: 'Can you help push the vehicle or pull it out with a tow rope / tractor?',
    standardNepali: 'गाडी धकेल्न वा डोरी / ट्र्याक्टरले तान्न मद्दत गर्न सक्नुहुन्छ?',
    standardNepaliRomanized: 'Gaadi dhakelna waa dori / tractorle taanna maddat garna saknuhunchha?',
    translations: {
      doteli: {
        text: 'गाडी धकेल्ल वा डोरीले तान्न सघाउन सक्याला?',
        romanized: 'Gaadi dhakella waa dorile taanna saghaauna sakyaala?',
      },
      maithili: {
        text: 'गाड़ी ठेलऽ मे वा रस्सी/ट्र्याक्टर सं खिँचऽ मे मद्दति करब?',
        romanized: 'Gaadi thela me waa rassi/tractor sa khincha me maddati karab?',
      },
      bhojpuri: {
        text: 'गाड़ी धकेले खातिर चाहे ट्र्याक्टर से खींचे में मदद करीं ना?',
        romanized: 'Gaadi dhakele khaatir chaahe tractor se kheenchain mein madad kareen na?',
      },
      tharu: {
        text: 'गाड़ी ठेलक मद्दत करि सकथू का डदुआ?',
        romanized: 'Gaadi thelak maddat kari sakthoo ka dadua?',
      },
    },
  },
  {
    id: 'p_mech_3',
    category: 'mechanic_breakdown',
    english: 'Can you check the tire air pressure / water coolant level?',
    standardNepali: 'टायरको हावा र रेडिएटरको पानी जाँचिदिनुस् न।',
    standardNepaliRomanized: 'Tyre-ko haawa ra radiator-ko paani jaanchidinos na.',
    translations: {
      doteli: {
        text: 'टायरको हावा र पानी हेरिदिन्या भए हुन्थ्यो।',
        romanized: 'Tyre-ko haawa ra paani heridinya bhaye hunthyo.',
      },
      maithili: {
        text: 'टायरक हावा आ पानी देखि दियौ न।',
        romanized: 'Tyrek haawa aa paani dekhi diyau na.',
      },
      bhojpuri: {
        text: 'टायर के हवा आ पानी चेक कऽ दीं।',
        romanized: 'Tyre ke hawa aa paani check ka deen.',
      },
    },
  },

  // 4. Highway Bhatti, Food & Lodge
  {
    id: 'p_food_1',
    category: 'tea_food_stay',
    english: 'Is fresh hot tea / Daal Bhaat (rice meal) available right now?',
    standardNepali: 'अहिले ताजा तातो चिया र दाल-भात पाइन्छ हजुर?',
    standardNepaliRomanized: 'Ahile taajaa taato chiyaa ra daal-bhaat paainchha hajur?',
    translations: {
      doteli: {
        text: 'तातो चिया र भात पाइन्छ कि नाइँ साउजी?',
        romanized: 'Taato chiyaa ra bhaat paainchha ki naain saauji?',
      },
      maithili: {
        text: 'एखन ताजा चाय आ दाल-भात भेटत साहुजी?',
        romanized: 'Ekhan taaja chaay aa daal-bhaat bhetat sahuji?',
      },
      bhojpuri: {
        text: 'अखन गरम चाय आ दाल-भात मिली साहुजी?',
        romanized: 'Akhan garam chaay aa daal-bhaat mili sahuji?',
      },
      tharu: {
        text: 'गरम चाहा आ दाल-भात भेट्ठी कि नाइँ?',
        romanized: 'Garam chaahaa aa daal-bhaat bhetthi ki naain?',
      },
      tamang: {
        text: 'च्या तामाङ दाल-भात याङ्बा मुला?',
        romanized: 'Chya taamang daal-bhaat yangba mula?',
      },
      newari: {
        text: 'आ चिया व जा दुल ला?',
        romanized: 'Aa chiya wa jaa dula laa?',
      },
      sherpa: {
        text: 'दन्दा च्या तातो काङ्रे झा पाछी?',
        romanized: 'Danda chya taato kangre jhaa paachhi?',
      },
      limbu: {
        text: 'च्या नु थक्पे थाक्पा चोक्पा?',
        romanized: 'Chya nu thakpe thaakpaa chokpaa?',
      },
    },
  },
  {
    id: 'p_food_2',
    category: 'tea_food_stay',
    english: 'Where is the clean restroom / toilet located?',
    standardNepali: 'शौचालय / चर्पी कतातिर छ?',
    standardNepaliRomanized: 'Shauchalaya / charpee kataatira chha?',
    translations: {
      doteli: {
        text: 'चर्पी कतुतिर छ साउजी?',
        romanized: 'Charpee katutira chha saauji?',
      },
      maithili: {
        text: 'शौचालय कतय अछि?',
        romanized: 'Shauchalay katay achhi?',
      },
      bhojpuri: {
        text: 'शौचालय / पाखाना कता बा?',
        romanized: 'Shauchalay / paakhaana kata ba?',
      },
      tharu: {
        text: 'शौचालय कतह बा?',
        romanized: 'Shauchalay katah ba?',
      },
      newari: {
        text: 'चर्पी गन दु?',
        romanized: 'Charpee gana du?',
      },
      sherpa: {
        text: 'देसाङ खाङ्ला यिन्?',
        romanized: 'Desaang khangla yin?',
      },
    },
  },
  {
    id: 'p_food_3',
    category: 'tea_food_stay',
    english: 'Do you have a clean room for night stay / lodging?',
    standardNepali: 'आज राति बस्नको लागि सफा कोठा पाइन्छ?',
    standardNepaliRomanized: 'Aaja raati basnako laagi safaa kothaa paainchha?',
    translations: {
      doteli: {
        text: 'आज रात बस्या कोठा पाइला?',
        romanized: 'Aaja raat basya kothaa paaila?',
      },
      maithili: {
        text: 'आइ राति रहऽ लेल निक कोठा भेटत?',
        romanized: 'Aai raati raha lel neek kothaa bhetat?',
      },
      bhojpuri: {
        text: 'आज रात रहे खातिर नीक कमरा बा?',
        romanized: 'Aaj raat rahe khaatir neek kamra ba?',
      },
      newari: {
        text: 'थाैं च्वनेगु बांलागु कोठा दु ला?',
        romanized: 'Thaun chwanegu baamlaagu kothaa du laa?',
      },
      sherpa: {
        text: 'थिरी डेप्के देसाङ खाङ्ला यिन्?',
        romanized: 'Thiri depke desaang khangla yin?',
      },
    },
  },

  // 5. Bus, Jeep, Ticket & Fares
  {
    id: 'p_bus_1',
    category: 'transit_bus_fare',
    english: 'When does the next local bus / shared jeep leave for Pokhara / Surkhet?',
    standardNepali: 'पोखरा / सुर्खेत जाने पछिल्लो बस वा जीप कति बजे छुट्छ?',
    standardNepaliRomanized: 'Pokhara / Surkhet jaane pachhillo bus waa jeep kati baje chhutchha?',
    translations: {
      doteli: {
        text: 'सुर्खेत / धनगढी जाँदो गाडी कति बेला हिँड्छ?',
        romanized: 'Surkhet / Dhangadhi jaando gaadi kati belaa hindchha?',
      },
      maithili: {
        text: 'विराटनगर / जनकपुर जाए वाला बस कतेक बजे छुटत?',
        romanized: 'Biratnagar / Janakpur jaae wala bus katek baje chhutat?',
      },
      bhojpuri: {
        text: 'अगिला बस केतना बजे खुली?',
        romanized: 'Agila bus ketana baje khuli?',
      },
      tharu: {
        text: 'पछिल्लो बस कत्तिक बजे खुलठी?',
        romanized: 'Pachhillo bus kattik baje khulthi?',
      },
    },
  },
  {
    id: 'p_bus_2',
    category: 'transit_bus_fare',
    english: 'How much is the seat fare per person to Kathmandu / Butwal?',
    standardNepali: 'काठमाडौँ / बुटवलसम्मको प्रति व्यक्ति भाडा कति हो?',
    standardNepaliRomanized: 'Kathmandusammako prati byakti bhaadaa kati ho?',
    translations: {
      doteli: {
        text: 'काठमाडौं सम्मको गाडी भाडा कति हो दाजु?',
        romanized: 'Kathmandu sammako gaadi bhaadaa kati ho daaju?',
      },
      maithili: {
        text: 'काठमाडौं जाएक भाड़ा कतेक लेबै?',
        romanized: 'Kathmandu jaaek bhaadaa katek lebai?',
      },
      bhojpuri: {
        text: 'काठमाडौं के भाड़ा कतना रुपिया बा?',
        romanized: 'Kathmandu ke bhaadaa katana rupiya ba?',
      },
      newari: {
        text: 'भाडा गुलि खः?',
        romanized: 'Bhaadaa guli kha?',
      },
    },
  },
  {
    id: 'p_bus_3',
    category: 'transit_bus_fare',
    english: 'Please stop at the next intersection / tea shop ahead.',
    standardNepali: 'अगाडिको चोक वा चिया पसलमा गाडी रोकिदिनुस् न।',
    standardNepaliRomanized: 'Agaadiko chok waa chiyaa pasalmaa gaadi rokidinos na.',
    translations: {
      doteli: {
        text: 'अगाडि चोकमा गाडी रोकिदियौ दाजु।',
        romanized: 'Agaadi chokmaa gaadi rokidiyau daaju.',
      },
      maithili: {
        text: 'आगाँक चोक पर गाड़ी रोकि दियौ।',
        romanized: 'Aagaank chok par gaadi roki diyau.',
      },
      bhojpuri: {
        text: 'आगें चोक पर गाड़ी रोक दीं।',
        romanized: 'Aagen chok par gaadi rok deen.',
      },
      tharu: {
        text: 'आघेक चोकमा गाड़ी रोक देहू।',
        romanized: 'Aaghek chokmaa gaadi rok dehoo.',
      },
      newari: {
        text: 'न्ह्यने च्वंगु चोकय् गाडी दिकादिसँ।',
        romanized: 'Nhyane chwangu chokay gaadi dikaadisaan.',
      },
    },
  },

  // 6. Fuel, Oil & EV Charging
  {
    id: 'p_fuel_1',
    category: 'fuel_ev_charging',
    english: 'Where is the nearest petrol pump or NEA EV fast charging station?',
    standardNepali: 'नजिकको पेट्रोल पम्प वा इभी फास्ट चार्जिङ स्टेशन कहाँ छ?',
    standardNepaliRomanized: 'Najikko petrol pump waa EV fast charging station kahaan chha?',
    translations: {
      doteli: {
        text: 'नजिक पेट्रोल पम्प वा चार्ज अद्द्या ठाउँ कतु छ?',
        romanized: 'Najik petrol pump waa charge addya thaaun katu chha?',
      },
      maithili: {
        text: 'नजदिक मे पेट्रोल पम्प आ गाडी चार्ज करऽ बला ठाउँ कतय अछि?',
        romanized: 'Najdik me petrol pump aa gaadi charge kara bala thaaun katay achhi?',
      },
      bhojpuri: {
        text: 'नजदीक में पेट्रोल पम्प आ चार्जिंग कहाँ बा?',
        romanized: 'Najdeek mein petrol pump aa charging kahaan ba?',
      },
      tharu: {
        text: 'लगही पेट्रोल पम्प कतह बा?',
        romanized: 'Lagahi petrol pump katah ba?',
      },
    },
  },
  {
    id: 'p_fuel_2',
    category: 'fuel_ev_charging',
    english: 'Can I buy 5 liters of petrol / diesel in a jar/can for emergency?',
    standardNepali: 'आपत्कालीन प्रयोजनको लागि जारमा ५ लिटर पेट्रोल / डिजेल पाइएला?',
    standardNepaliRomanized: 'Aapatkaaleen prayojanko laagi jaarmaa 5 liter petrol / diesel paaiyelaa?',
    translations: {
      doteli: {
        text: 'जारमा ५ लिटर पेट्रोल मिल्याला कि नाइँ?',
        romanized: 'Jaarmaa 5 liter petrol milyaala ki naain?',
      },
      maithili: {
        text: 'डब्बा मे ५ लिटर पेट्रोल भेटत?',
        romanized: 'Dabba me 5 liter petrol bhetat?',
      },
      bhojpuri: {
        text: 'कैन में ५ लिटर पेट्रोल मिली?',
        romanized: 'Can mein 5 liter petrol mili?',
      },
    },
  },

  // 7. Emergency Rescue & Police
  {
    id: 'p_emer_1',
    category: 'emergency_safety',
    english: 'There has been an accident here! Please call an ambulance (102) and police (100).',
    standardNepali: 'यहाँ दुर्घटना भयो! कृपया एम्बुलेन्स (१०२) र प्रहरी (१००) लाई तुरुन्त खबर गरिदिनुहोस्।',
    standardNepaliRomanized: 'Yahaan durghatanaa bhayo! Kripayaa ambulance (102) ra prahari (100) laai turunta khabar garidinhosh.',
    translations: {
      doteli: {
        text: 'याइँ दुर्घटना भ्यो! चाँडो प्रहरी र एम्बुलेन्सलाई बोलाइदिनु साउजी!',
        romanized: 'Yaain durghatanaa bhyo! Chaando prahari ra ambulancelaai bolaaidinu saauji!',
      },
      maithili: {
        text: 'एतय दुर्घटना भऽ गेल! जल्दी एम्बुलेन्स आ पुलिसके फोन करू!',
        romanized: 'Etay durghatanaa bha gel! Jaldee ambulance aa policeke phone karoo!',
      },
      bhojpuri: {
        text: 'इहाँ एक्सीडेंट हो गईल! जल्दी पुलिस आ एम्बुलेन्स के फोन करीं!',
        romanized: 'Ihaan accident ho gayil! Jaldee police aa ambulance ke phone kareen!',
      },
      tharu: {
        text: 'यहाँ दुर्घटना हुइल! जल्दी पुलिस बोलाइ देहू!',
        romanized: 'Yahaan durghatanaa huil! Jaldee police bolaai dehoo!',
      },
      newari: {
        text: 'थन दुर्घटना जुल! याकनं एम्बुलेन्स व प्रहरीयात सःतादिसँ!',
        romanized: 'Than durghatanaa jula! Yaakanam ambulance wa prahariyaata sahataadisaan!',
      },
    },
  },
  {
    id: 'p_emer_2',
    category: 'emergency_safety',
    english: 'We are stuck in mud / flood water, we need towing help.',
    standardNepali: 'हाम्रो गाडी हिलो / बाढीमा फस्यो, तानेर निकाल्न मद्दत चाहियो।',
    standardNepaliRomanized: 'Haamro gaadi hilo / baadhimaa phasyo, taanera nikaalna maddat chaahiyo.',
    translations: {
      doteli: {
        text: 'हाम्रो गाडी हिल्याम फस्यो, तान्नाकि सघाउ दाजु!',
        romanized: 'Haamro gaadi hilyaam phasyo, taannaaki saghaau daaju!',
      },
      maithili: {
        text: 'हमार गाड़ी कादो / पानी मे फँसि गेल, टानि कऽ निकालऽ मे मद्दति करू।',
        romanized: 'Hamaar gaadi kaado / paani me phansi gel, taani ka nikaala me maddati karoo.',
      },
      bhojpuri: {
        text: 'गाड़ी कीचड़ में फँस गईल बा, निकाले में मदद करीं।',
        romanized: 'Gaadi keechad mein phans gayil ba, nikaale mein madad kareen.',
      },
    },
  },

  // 8. Greetings, Bargaining & Courtesy
  {
    id: 'p_court_1',
    category: 'courtesy_greetings',
    english: 'Namaste / Greetings! How are you doing?',
    standardNepali: 'नमस्ते हजुर! सन्चै हुनुहुन्छ?',
    standardNepaliRomanized: 'Namaste hajur! Sanchai hunuhunchha?',
    translations: {
      doteli: {
        text: 'पैलाग दाजु! कस्या छौ? सब निको छ?',
        romanized: 'Pailaag daaju! Kasya chhau? Sab niko chha?',
        note: '"Kasya chhau" is Doteli for how are you.',
      },
      maithili: {
        text: 'प्रणाम! अपनेक की हालचाल अछि?',
        romanized: 'Pranaam! Apanek kee haalchaal achhi?',
        note: '"Apanek" is the high-respect honorific in Maithili.',
      },
      bhojpuri: {
        text: 'राम राम! का हाल बा? सब ठीक-ठाक बा ना?',
        romanized: 'Ram Ram! Ka haal ba? Sab theek-thaak ba na?',
      },
      tharu: {
        text: 'राम राम डदुआ! कइसन बा हालचाल?',
        romanized: 'Ram Ram dadua! Kaisan ba haalchaal?',
      },
      tamang: {
        text: 'लहासाे फ्याफुल्ला! तिन्बा जेबा मुला?',
        romanized: 'Lhaso Fyafulla! Tinba jeba mula?',
      },
      newari: {
        text: 'ज्वजलपा! छि बांलाक्क च्वनादिया ला?',
        romanized: 'Jwajalapa! Chhi baamlaakka chwanaadiyaa laa?',
      },
      gurung: {
        text: 'फ्याफुल्ला! खैरी मुँ?',
        romanized: 'Fyafulla! Khairi mun?',
      },
      sherpa: {
        text: 'ताशी देलेक! ङ्योम्बु यिन् पे?',
        romanized: 'Tashi Delek! Ngyombu yin pe?',
      },
      limbu: {
        text: 'सेवारो! हेन्चुङ वा?',
        romanized: 'Sewaro! Henchung waa?',
      },
    },
  },
  {
    id: 'p_court_2',
    category: 'courtesy_greetings',
    english: 'Thank you very much for your kind help and hospitality.',
    standardNepali: 'सहयोग र न्यानो आतिथ्यको लागि धेरै धेरै धन्यवाद हजुर!',
    standardNepaliRomanized: 'Sahayog ra nyaano aatithyako laagi dherai dherai dhanyabaad hajur!',
    translations: {
      doteli: {
        text: 'सघाया खातिर भौत-भौत धन्यवाद / भलो होउ!',
        romanized: 'Saghaayaa khaatir bhaut-bhaut dhanyabaad / Bhalo hou!',
        note: '"Bhaut-bhaut" means very much in Doteli.',
      },
      maithili: {
        text: 'मद्दति लेल बहुत बहुत धन्यवाद आ आभार!',
        romanized: 'Maddati lel bahut bahut dhanyabaad aa aabhaar!',
      },
      bhojpuri: {
        text: 'मदद खातिर बहुत बहुत धन्यवाद!',
        romanized: 'Madad khaatir bahut bahut dhanyabaad!',
      },
      tamang: {
        text: 'सहयोग लबासी थुचेछे!',
        romanized: 'Sahayog labaasi thuchechhe!',
      },
      newari: {
        text: 'ग्वाहालि यानादीगुलिं यक्व यक्व सुभाय्!',
        romanized: 'Gwaahaali yaanaadeegulin yakwo yakwo subhaay!',
      },
      sherpa: {
        text: 'रोम लहापा ला थुजेछे!',
        romanized: 'Rom lahapa la thujeychhe!',
      },
      limbu: {
        text: 'सहयोग चोक्पा लागी नुगेन!',
        romanized: 'Sahayog chokpaa laagi nugen!',
      },
    },
  },
];
