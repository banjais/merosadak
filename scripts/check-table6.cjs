const fs = require('fs');
const path = require('path');
const ref = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'data', 'snh-reference.json'), 'utf8'));

// Find all Table 6 entries
const table6Entries = Object.entries(ref.published_distances).filter(([k, v]) => v.table === 'Table 6');
console.log('Table 6 entries count:', table6Entries.length);
console.log('Table 6 entries:', table6Entries.map(([k, v]) => ({ key: k, distance: v.distance_km })));

// Check which district HQs from Table 6 are missing
const table6Districts = [
  'Taplejung', 'Siddhicharan', 'Dhankuta', 'Myanglung', 'Phidim', 'Ilam', 'Bhadrapur', 'Biratnagar', 'Inaruwa', 'Gaighat',
  'Rajbiraj', 'Siraha', 'Janakpur', 'Jaleshwor', 'Malangawa', 'Gaur', 'Kalaiya', 'Birgunj', 'Kamalamai', 'Hetauda',
  'Khandbari', 'Salleri', 'Diktel', 'Bhojpur', 'Bhimeshwar', 'Chautara', 'Dhunche', 'Nilkantha', 'Bidur', 'Bhaktapur',
  'Lalitpur', 'Dhulikhel', 'Manthali', 'Bharatpur', 'Gorkha', 'Chame', 'Jomsom', 'Simikot', 'Rukumkot', 'Beni',
  'Pokhara', 'Besishahar', 'Byas', 'Kawasoti', 'Putalibazar', 'Kusma', 'Baglung', 'Libang', 'Pyuthan', 'Resunga',
  'Sandhikhark', 'Tansen', 'Ramgram', 'Siddharthanagar', 'Kapilvastu', 'Tribhuwannager', 'Nepalgunj', 'Gulariya', 'Gamgadhi',
  'Chandannath', 'Manma', 'Narayan', 'Khalanga', 'Musikot', 'Salyan', 'Birendranagar', 'Martadi', 'Jayaprithvi', 'Api',
  'Dasharathchand', 'Amargadhi', 'Dipayal Silgadhi', 'Mangalsen', 'Dhangadi', 'Bhimdatta', 'Dunai'
];

const missing = table6Districts.filter(d => {
  const key = 'kathmandu|' + d.toLowerCase();
  return !ref.published_distances[key];
});
console.log('Missing Table 6 districts:', missing.length);
console.log('Missing:', missing);
