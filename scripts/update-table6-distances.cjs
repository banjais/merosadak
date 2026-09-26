/**
 * Update snh-reference.json with Table 6 district HQ distances from Kathmandu.
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const refPath = path.join(root, 'public', 'data', 'snh-reference.json');
const ref = JSON.parse(fs.readFileSync(refPath, 'utf8'));

// Table 6 data: District HQ distances from Kathmandu via NH17
const table6 = [
  { name: 'Taplejung', district: 'Taplejung', distance: 835.30 },
  { name: 'Siddhicharan', district: 'Okhaldhunga', distance: 507.79 },
  { name: 'Dhankuta', district: 'Dhankuta', distance: 594.20 },
  { name: 'Myanglung', district: 'Terhathum', distance: 655.12 },
  { name: 'Phidim', district: 'Panchthar', distance: 748.80 },
  { name: 'Ilam', district: 'Ilam', distance: 681.88 },
  { name: 'Bhadrapur', district: 'Jhapa', distance: 612.72 },
  { name: 'Biratnagar', district: 'Morang', distance: 548.77 },
  { name: 'Inaruwa', district: 'Sunsari', distance: 507.91 },
  { name: 'Gaighat', district: 'Udayapur', distance: 453.25 },
  { name: 'Rajbiraj', district: 'Saptari', distance: 457.23 },
  { name: 'Siraha', district: 'Siraha', distance: 417.15 },
  { name: 'Janakpur', district: 'Dhanusa', distance: 381.82 },
  { name: 'Jaleshwor', district: 'Mahottari', distance: 397.76 },
  { name: 'Malangawa', district: 'Sarlahi', distance: 344.16 },
  { name: 'Gaur', district: 'Rautahat', distance: 334.61 },
  { name: 'Kalaiya', district: 'Bara', distance: 283.55 },
  { name: 'Birgunj', district: 'Parsa', distance: 276.12 },
  { name: 'Kamalamai', district: 'Sindhuli', distance: 387.00 },
  { name: 'Hetauda', district: 'Makwanpur', distance: 221.01 },
  { name: 'Khandbari', district: 'Sankhuwasabha', distance: 685.20 },
  { name: 'Salleri', district: 'Solukhumbu', distance: 565.69 },
  { name: 'Diktel', district: 'Khotang', distance: 704.51 },
  { name: 'Bhojpur', district: 'Bhojpur', distance: 794.51 },
  { name: 'Bhimeshwar', district: 'Dolakha', distance: 131.72 },
  { name: 'Chautara', district: 'Sindhupalchok', distance: 84.21 },
  { name: 'Dhunche', district: 'Rasuwa', distance: 118.26 },
  { name: 'Nilkantha', district: 'Dhading', distance: 85.16 },
  { name: 'Bidur', district: 'Nuwakot', distance: 66.85 },
  { name: 'Bhaktapur', district: 'Bhaktapur', distance: 13.37 },
  { name: 'Lalitpur', district: 'Lalitpur', distance: 3.00 },
  { name: 'Dhulikhel', district: 'Kavrepalanchok', distance: 27.21 },
  { name: 'Manthali', district: 'Ramechhap', distance: 188.92 },
  { name: 'Bharatpur', district: 'Chitawan', distance: 146.28 },
  { name: 'Gorkha', district: 'Gorkha', distance: 140.48 },
  { name: 'Chame', district: 'Manang', distance: 240.54 },
  { name: 'Jomsom', district: 'Mustang', distance: 368.55 },
  { name: 'Simikot', district: 'Humla', distance: 934.80 },
  { name: 'Rukumkot', district: 'Rukum East', distance: 451.01 },
  { name: 'Beni', district: 'Myagdi', distance: 288.55 },
  { name: 'Pokhara', district: 'Kaski', distance: 198.55 },
  { name: 'Besishahar', district: 'Lamjung', distance: 175.54 },
  { name: 'Byas', district: 'Tanahu', distance: 42.00 },
  { name: 'Kawasoti', district: 'Nawalparasi East', distance: 179.50 },
  { name: 'Putalibazar', district: 'Syangja', distance: 235.67 },
  { name: 'Kusma', district: 'Parbat', distance: 251.55 },
  { name: 'Baglung', district: 'Baglung', distance: 271.13 },
  { name: 'Rukumkot', district: 'Rukum East', distance: 510.86 },
  { name: 'Libang', district: 'Rolpa', distance: 467.09 },
  { name: 'Pyuthan', district: 'Pyuthan', distance: 427.73 },
  { name: 'Resunga', district: 'Gulmi', distance: 375.06 },
  { name: 'Sandhikhark', district: 'Arghakhanchi', distance: 374.87 },
  { name: 'Tansen', district: 'Palpa', distance: 299.47 },
  { name: 'Ramgram', district: 'Nawalparasi West', distance: 245.85 },
  { name: 'Siddharthanagar', district: 'Rupandehi', distance: 278.41 },
  { name: 'Kapilvastu', district: 'Kapilbastu', distance: 309.14 },
  { name: 'Tribhuwannager', district: 'Dang', distance: 409.23 },
  { name: 'Nepalgunj', district: 'Banke', distance: 510.07 },
  { name: 'Gulariya', district: 'Bardiya', distance: 543.40 },
  { name: 'Gamgadhi', district: 'Mugu', distance: 893.80 },
  { name: 'Chandannath', district: 'Jumla', distance: 817.80 },
  { name: 'Manma', district: 'Kalikot', distance: 738.80 },
  { name: 'Narayan', district: 'Dailekh', distance: 647.41 },
  { name: 'Khalanga', district: 'Jajarkot', distance: 662.01 },
  { name: 'Musikot', district: 'Rukum West', distance: 571.86 },
  { name: 'Salyan', district: 'Salyan', distance: 495.66 },
  { name: 'Birendranagar', district: 'Surkhet', distance: 580.41 },
  { name: 'Martadi', district: 'Bajura', distance: 972.93 },
  { name: 'Jayaprithvi', district: 'Bajhang', distance: 903.48 },
  { name: 'Api', district: 'Darchula', distance: 960.86 },
  { name: 'Dasharathchand', district: 'Baitadi', distance: 854.53 },
  { name: 'Amargadhi', district: 'Dadeldhura', distance: 769.72 },
  { name: 'Dipayal Silgadhi', district: 'Doti', distance: 832.66 },
  { name: 'Mangalsen', district: 'Achham', distance: 938.16 },
  { name: 'Dhangadi', district: 'Kailali', distance: 664.42 },
  { name: 'Bhimdatta', district: 'Kanchanpur', distance: 692.31 },
  { name: 'Dunai', district: 'Dolpa', distance: 821.40 },
];

let added = 0;
for (const entry of table6) {
  const key = `kathmandu|${entry.name.toLowerCase()}`;
  if (!ref.published_distances[key]) {
    ref.published_distances[key] = {
      distance_km: entry.distance,
      source: 'SNH 2022/23',
      table: 'Table 6',
      row: null,
      printed_page: 12,
      pdf_page: 22,
      via: 'NH17 Prithvi Highway'
    };
    added++;
  }
}

// Update table_6 entry count
if (ref.tables && ref.tables.table_6) {
  ref.tables.table_6.entry_count = table6.length;
  ref.tables.table_6.added_to_published_distances = added;
}

fs.writeFileSync(refPath, JSON.stringify(ref, null, 2), 'utf8');
console.log(`Added ${added} district HQ distances from Kathmandu to published_distances`);
console.log(`Total published_distances entries: ${Object.keys(ref.published_distances).length}`);
