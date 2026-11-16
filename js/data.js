/* BantayDavao – static content for the prototype.
   In production this comes from the city admin panel (CDRRMO / DCWD) and PAGASA. */
window.BD = window.BD || {};

BD.LEVELS = [0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200, 4000];
BD.RANKS = [
  { from: 1, name: 'Bag-ong Bantay' },
  { from: 3, name: 'Bantay sa Balay' },
  { from: 5, name: 'Bantay sa Purok' },
  { from: 7, name: 'Bantay sa Barangay' },
  { from: 9, name: 'Bayani sa Davao' },
  { from: 11, name: 'Alamat sa Davao' }
];

BD.SEASONS = {
  heat: {
    key: 'heat', label: 'Heat mode', sub: 'El Niño · dry season', short: 'Init · Heat',
    challenge: 'Bantay sa Init', icon: 'sun'
  },
  rain: {
    key: 'rain', label: 'Rain mode', sub: 'La Niña · rainy season', short: 'Ulan · Rain',
    challenge: 'Bantay sa Ulan', icon: 'rain'
  }
};

BD.WATER_QUEST = { id: 'water', xp: 25, icon: 'droplet', color: 'teal', title: 'Drink 8 glasses of water', hour: 0 };

BD.QUESTS = {
  heat: [
    { id: 'h_check', hour: 6, xp: 10, icon: 'thermometer', color: 'sun', title: "Check today's heat outside", desc: 'Open Peligro to see the heat index.', go: 'peligro' },
    { id: 'h_bottle', hour: 6, xp: 15, icon: 'bottle', color: 'teal', title: 'Fill your water bottle', desc: 'Bring at least 1 liter when you go out.' },
    { id: 'h_shade', hour: 10, xp: 25, icon: 'umbrella', color: 'sun', title: 'Stay in the shade, 10 AM–4 PM', desc: 'Avoid direct sun at the hottest hours.' },
    { id: 'h_lolo', hour: 14, xp: 30, icon: 'heart', color: 'purple', title: 'Check on lolo, lola or a neighbor', desc: 'Seniors and the sick feel the heat first.' },
    { id: 'h_store', hour: 17, xp: 20, icon: 'bucket', color: 'teal', title: "Store tomorrow's water", desc: 'Use clean, covered containers.' },
    { id: 'h_leak', hour: 18, xp: 15, icon: 'wrench', color: 'gulf', title: 'Check faucets and pipes for leaks', desc: 'Report leaks to DCWD.', go: 'tawag' },
    { id: 'h_kit', hour: 20, xp: 15, icon: 'backpack', color: 'purple', title: "Pack tomorrow's going-out kit", desc: 'Water, payong or hat, sunblock.' }
  ],
  rain: [
    { id: 'r_check', hour: 6, xp: 10, icon: 'rain', color: 'gulf', title: 'Check the rainfall warning', desc: 'Open Peligro to see the PAGASA warning.', go: 'peligro' },
    { id: 'r_pack', hour: 6, xp: 15, icon: 'umbrella', color: 'teal', title: 'Pack payong or raincoat', desc: 'Plus a plastic pouch for your phone and IDs.' },
    { id: 'r_canal', hour: 9, xp: 25, icon: 'waves', color: 'teal', title: 'Clear canals and drains near your house', desc: 'Blocked drains flood the street first.' },
    { id: 'r_dengue', hour: 15, xp: 30, icon: 'bug', color: 'purple', title: 'Empty standing water around the house', desc: 'DOH 4S against dengue.' },
    { id: 'r_charge', hour: 17, xp: 15, icon: 'battery', color: 'sun', title: 'Charge your phone and power bank', desc: 'Power may go out in a storm.' },
    { id: 'r_gobag', hour: 19, xp: 20, icon: 'backpack', color: 'purple', title: 'Check your go-bag', desc: 'Water, food, medicine, flashlight, IDs.' },
    { id: 'r_evac', hour: 20, xp: 20, icon: 'house', color: 'gulf', title: 'Know your nearest evacuation center', desc: 'Find it on the Mapa tab.', go: 'mapa' }
  ]
};

BD.CHECKLIST = {
  heat: ['Water bottle', 'Payong or hat', 'Sunblock', 'Loose, light clothes', 'Phone charged, 911 saved', "Told someone where I'm going"],
  rain: ['Payong or raincoat', 'Phone and IDs in plastic', 'Closed shoes', 'Checked the rainfall warning', 'Route avoids flooded roads and riverbanks', "Told someone where I'm going"]
};

// An icon and a tip for each checklist item (same order as BD.CHECKLIST), shown when it's packed.
BD.CHECKLIST_INFO = {
  heat: [['bottle', 'At least 1 liter. Refill it at a water station on Mapa.'], ['umbrella', 'Shade keeps your head and neck cooler.'],
    ['sun', 'SPF 30 or more. Put it on again every 2 hours.'], ['user', 'Light colors reflect the sun, and loose clothes let sweat dry.'],
    ['phone', 'In an emergency, call 911. It is free.'], ['users', 'Tell your family where you are going and when you will be back.']],
  rain: [['umbrella', 'A raincoat keeps your hands free for railings and kids.'], ['phone', 'A zip bag keeps your phone and IDs dry if you wade or get soaked.'],
    ['shield', 'Closed shoes protect your feet from cuts. Leptospirosis enters through wounds.'], ['rain', 'Open Peligro. If it is Orange or Red, avoid going out if you can.'],
    ['map', 'Use Mapa to avoid flood-prone barangays and riverbanks.'], ['users', 'Tell your family where you are going and when you will be back.']]
};

/* Embedded 7-day Davao City forecast (prototype sample). Index 0 = today. */
BD.FORECAST = {
  heat: { high: [33, 34, 33, 35, 34, 33, 32], low: [24, 25, 24, 25, 25, 24, 24], rain: [10, 15, 20, 5, 10, 30, 40] },
  rain: { high: [30, 29, 31, 30, 28, 29, 31], low: [24, 24, 24, 23, 23, 24, 24], rain: [70, 85, 60, 75, 95, 80, 55] }
};

BD.HEAT_LEVELS = [
  { key: 'none', name: 'Not hazardous', min: -99, color: 'var(--pg-none)', advice: 'Comfortable. Keep drinking water.' },
  { key: 'caution', name: 'Caution', min: 27, range: '27–32°C', color: 'var(--pg-yellow)', effect: 'Fatigue is possible with long exposure and activity.', advice: 'Drink water often and rest in the shade.' },
  { key: 'xcaution', name: 'Extreme Caution', min: 33, range: '33–41°C', color: 'var(--pg-orange)', effect: 'Heat cramps and heat exhaustion are possible.', advice: 'Limit time outside. Drink a glass of water every hour.' },
  { key: 'danger', name: 'Danger', min: 42, range: '42–51°C', color: 'var(--pg-red)', effect: 'Heat cramps and exhaustion are likely. Heat stroke is probable with continued exposure.', advice: 'Stay indoors or in the shade. Check on seniors and kids.' },
  { key: 'xdanger', name: 'Extreme Danger', min: 52, range: '52°C and up', color: 'var(--pg-dred)', effect: 'Heat stroke is imminent.', advice: 'Do not stay outdoors. Watch for heat stroke signs.' }
];

BD.RAIN_LEVELS = {
  none: { key: 'none', name: 'No warning', tag: 'All clear', mm: 'Light or no rain', color: 'var(--ok)', meaning: 'No rainfall warning right now.', act: 'Keep your go-bag ready and keep drains clear.' },
  yellow: { key: 'yellow', name: 'Yellow', tag: 'Be alert', mm: '7.5–15 mm/hr', color: 'var(--pg-yellow)', meaning: 'Flooding is possible in low-lying areas and near rivers.', act: 'Monitor the weather. Prepare your go-bag.' },
  orange: { key: 'orange', name: 'Orange', tag: 'Be prepared', mm: '15–30 mm/hr', color: 'var(--pg-orange)', meaning: 'Flooding is threatening in low-lying areas.', act: 'Be ready to evacuate. Move valuables up high.' },
  red: { key: 'red', name: 'Red', tag: 'Take action', mm: 'Over 30 mm/hr', color: 'var(--pg-red)', meaning: 'Serious flooding is expected in low-lying areas.', act: 'Evacuate now if you live in a flood-prone area.' }
};

BD.DISTRICTS = [
  { id: 'poblacion', name: 'Poblacion', lat: 7.0642, lng: 125.6093 },
  { id: 'agdao', name: 'Agdao', lat: 7.0817, lng: 125.6223 },
  { id: 'buhangin', name: 'Buhangin', lat: 7.1093, lng: 125.6155 },
  { id: 'talomo', name: 'Talomo/Matina', lat: 7.0589, lng: 125.5701 },
  { id: 'bunawan', name: 'Bunawan', lat: 7.2357, lng: 125.6426 },
  { id: 'toril', name: 'Toril', lat: 7.019, lng: 125.4978 },
  { id: 'tugbok', name: 'Tugbok/Mintal', lat: 7.0902, lng: 125.5015 },
  { id: 'calinan', name: 'Calinan', lat: 7.1899, lng: 125.4524 },
  { id: 'baguio', name: 'Baguio District', lat: 7.1722, lng: 125.4038, upland: true },
  { id: 'paquibato', name: 'Paquibato', lat: 7.3719, lng: 125.496, upland: true },
  { id: 'marilog', name: 'Marilog', lat: 7.2959, lng: 125.302, upland: true }
];

BD.PLACE_TYPES = {
  dcwd: { label: 'DCWD office', icon: 'droplet', color: 'var(--gulf-2)' },
  station: { label: 'Drinking water', icon: 'cup', color: 'var(--teal)' },
  cool: { label: 'Cooling point', icon: 'tree', color: 'var(--ok)' },
  tanker: { label: 'Tanker stop', icon: 'truck', color: 'var(--sun)' },
  c911: { label: 'Central 911', icon: 'siren', color: 'var(--danger)' },
  hospital: { label: 'Hospital', icon: 'hospital', color: 'var(--danger)' },
  evac: { label: 'Evacuation center', icon: 'house', color: 'var(--purple)' },
  health: { label: 'Health center', icon: 'plus', color: 'var(--teal)' },
  // Nearby help from OpenStreetMap (map/gazetteer.json), shown in both seasons.
  brgy: { label: 'Barangay hall', icon: 'flag', color: 'var(--gulf-2)', osm: ['townhall'] },
  clinic: { label: 'Clinic', icon: 'plus', color: 'var(--teal)', osm: ['clinic', 'doctors'] },
  osmhosp: { label: 'Hospital', icon: 'hospital', color: 'var(--danger)', osm: ['hospital'] },
  police: { label: 'Police', icon: 'shield', color: 'var(--police)', osm: ['police'] },
  fire: { label: 'Fire station', icon: 'flame', color: '#EA580C', osm: ['fire_station'] }
};

BD.PLACES = {
  heat: [
    { type: 'dcwd', name: 'DCWD Bajada Office', district: 'Poblacion', lat: 7.08943, lng: 125.60204, note: 'Water service, bills and leak reports' },
    { type: 'dcwd', real: true, name: 'DCWD Matina Office', district: 'Talomo/Matina', lat: 7.06017, lng: 125.59095, note: 'Water service, bills and leak reports' },
    { type: 'dcwd', name: 'DCWD Toril Office', district: 'Toril', lat: 7.02621, lng: 125.50506, note: 'Water service, bills and leak reports' },
    { type: 'station', name: 'Barangay drinking water station · Agdao', district: 'Agdao', lat: 7.09251, lng: 125.62956, note: 'Free refill, 7 AM–5 PM' },
    { type: 'station', name: 'Barangay drinking water station · Buhangin', district: 'Buhangin', lat: 7.12011, lng: 125.60461, note: 'Free refill, 7 AM–5 PM' },
    { type: 'station', name: 'Barangay drinking water station · Bunawan', district: 'Bunawan', lat: 7.25011, lng: 125.65349, note: 'Free refill, 7 AM–5 PM' },
    { type: 'station', name: 'Barangay drinking water station · Calinan', district: 'Calinan', lat: 7.20071, lng: 125.44151, note: 'Free refill, 7 AM–5 PM' },
    { type: 'station', name: 'Barangay drinking water station · Mintal', district: 'Tugbok/Mintal', lat: 7.10101, lng: 125.51239, note: 'Free refill, 7 AM–5 PM' },
    { type: 'station', name: 'Barangay drinking water station · Marilog', district: 'Marilog', lat: 7.28149, lng: 125.29111, note: 'Free refill, 7 AM–5 PM' },
    { type: 'station', name: 'Barangay drinking water station · Paquibato', district: 'Paquibato', lat: 7.36109, lng: 125.48511, note: 'Free refill, 7 AM–5 PM' },
    { type: 'station', name: 'Barangay drinking water station · Baguio', district: 'Baguio District', lat: 7.18301, lng: 125.41469, note: 'Free refill, 7 AM–5 PM' },
    { type: 'station', name: 'Barangay drinking water station · Toril', district: 'Toril', lat: 7.00819, lng: 125.48691, note: 'Free refill, 7 AM–5 PM' },
    { type: 'cool', name: 'Cooling point · Poblacion covered court', district: 'Poblacion', lat: 7.05339, lng: 125.62019, note: 'Shade, fans and drinking water, 10 AM–4 PM' },
    { type: 'cool', name: 'Cooling point · Matina covered court', district: 'Talomo/Matina', lat: 7.06971, lng: 125.57736, note: 'Shade, fans and drinking water, 10 AM–4 PM' },
    { type: 'cool', name: 'Cooling point · Buhangin gym', district: 'Buhangin', lat: 7.09489, lng: 125.62639, note: 'Shade, fans and drinking water, 10 AM–4 PM' },
    { type: 'cool', name: 'Cooling point · Toril gym', district: 'Toril', lat: 7.03702, lng: 125.51595, note: 'Shade, fans and drinking water, 10 AM–4 PM' },
    { type: 'tanker', name: 'Rolling tanker stop · Tigatto', district: 'Buhangin', lat: 7.13453, lng: 125.64091, note: 'Tue & Fri · 7–10 AM' },
    { type: 'tanker', name: 'Rolling tanker stop · Mintal', district: 'Tugbok/Mintal', lat: 7.07218, lng: 125.49061, note: 'Mon & Thu · 8–11 AM' },
    { type: 'tanker', name: 'Rolling tanker stop · Lasang', district: 'Bunawan', lat: 7.28255, lng: 125.67891, note: 'Wed & Sat · 1–4 PM' },
    { type: 'tanker', name: 'Rolling tanker stop · Tamugan', district: 'Baguio District', lat: 7.2695, lng: 125.43648, note: 'Daily · 6–8 AM' },
    { type: 'tanker', name: 'Rolling tanker stop · Malabog', district: 'Paquibato', lat: 7.33226, lng: 125.46332, note: 'Mon, Wed, Fri · 9 AM–12 PM' }
  ],
  rain: [
    { type: 'c911', name: 'Davao City Central 911 (SIR Matina)', district: 'Talomo/Matina', lat: 7.08413, lng: 125.60641, note: 'Emergency response, 24/7' },
    { type: 'hospital', real: true, name: 'Southern Philippines Medical Center', district: 'Poblacion', lat: 7.09978, lng: 125.61948, note: 'Government hospital, 24/7 emergency room' },
    { type: 'evac', name: 'Evacuation center · Agdao barangay gym', district: 'Agdao', lat: 7.09611, lng: 125.62956, note: 'Covered gym, families welcome' },
    { type: 'evac', name: 'Evacuation center · Matina covered court', district: 'Talomo/Matina', lat: 7.09494, lng: 125.58825, note: 'On higher ground, away from the coast' },
    { type: 'evac', name: 'Evacuation center · Talomo central school', district: 'Talomo/Matina', lat: 7.06971, lng: 125.54832, note: 'School classrooms' },
    { type: 'evac', name: 'Evacuation center · Buhangin gym', district: 'Buhangin', lat: 7.09128, lng: 125.61913, note: 'Covered gym' },
    { type: 'evac', name: 'Evacuation center · Bunawan covered court', district: 'Bunawan', lat: 7.22129, lng: 125.63534, note: 'Covered court' },
    { type: 'evac', name: 'Evacuation center · Toril central school', district: 'Toril', lat: 7.03702, lng: 125.50869, note: 'School classrooms' },
    { type: 'evac', name: 'Evacuation center · Mintal barangay gym', district: 'Tugbok/Mintal', lat: 7.07939, lng: 125.51239, note: 'Covered gym' },
    { type: 'evac', name: 'Evacuation center · Calinan covered court', district: 'Calinan', lat: 7.17549, lng: 125.45966, note: 'Covered court' },
    { type: 'evac', name: 'Evacuation center · Baguio District school', district: 'Baguio District', lat: 7.18301, lng: 125.39291, note: 'School, away from slopes' },
    { type: 'evac', name: 'Evacuation center · Paquibato gym', district: 'Paquibato', lat: 7.38271, lng: 125.50689, note: 'Covered gym, away from slopes' },
    { type: 'evac', name: 'Evacuation center · Marilog school', district: 'Marilog', lat: 7.30671, lng: 125.31289, note: 'School, away from slopes' },
    { type: 'health', name: 'District health center · Poblacion', district: 'Poblacion', lat: 7.07141, lng: 125.61656, note: 'Leptospirosis and dengue checks' },
    { type: 'health', name: 'District health center · Talomo', district: 'Talomo/Matina', lat: 7.04809, lng: 125.56284, note: 'Leptospirosis and dengue checks' },
    { type: 'health', name: 'District health center · Buhangin', district: 'Buhangin', lat: 7.10209, lng: 125.60098, note: 'Leptospirosis and dengue checks' },
    { type: 'health', name: 'District health center · Toril', district: 'Toril', lat: 7.01179, lng: 125.49054, note: 'Leptospirosis and dengue checks' },
    { type: 'health', name: 'District health center · Calinan', district: 'Calinan', lat: 7.17909, lng: 125.44151, note: 'Leptospirosis and dengue checks' },
    { type: 'health', name: 'District health center · Bunawan', district: 'Bunawan', lat: 7.22849, lng: 125.65349, note: 'Leptospirosis and dengue checks' }
  ]
};

// Flood-prone barangays with recorded floods (js/hazards.js, from docs/data/davao_city_data.json). Drawn as ~800 m circles.
BD.FLOOD_ZONES = BD.HAZARDS.flood.map(f => Object.assign({ km: 0.8 }, f));

BD.MAP_TIPS = {
  heat: [
    'Store water in clean, covered containers.',
    'Collect rainwater for washing and flushing, not for drinking.',
    'Report leaks to DCWD: every drop counts in El Niño.'
  ],
  rain: [
    'Follow pre-emptive evacuation. Leave early, not when the water is already high.',
    'Never walk or drive through floodwater.',
    'Switch off the main power if water enters your house.',
    'Monitor the CDRRMO page and Davao City Disaster Radio.'
  ]
};

BD.FIRST_AID = {
  heat: {
    title: 'Heat illness',
    mild: [
      { id: 'tired', label: 'Very tired', tip: 'Stop and rest in the shade. Drink cool water slowly.' },
      { id: 'dizzy', label: 'Dizzy', tip: 'Sit or lie down in the shade. Raise the legs a little.' },
      { id: 'headache', label: 'Headache', tip: 'Rest somewhere cool and drink water. Avoid the sun.' },
      { id: 'cramps', label: 'Cramps', tip: 'Stop moving. Gently stretch the muscle. Sip water.' },
      { id: 'vomit', label: 'Vomiting', tip: 'Turn them on their side. Small sips of water only once vomiting stops.' },
      { id: 'sweat', label: 'Heavy sweating', tip: 'Move to the shade, loosen clothes, cool the skin with a wet cloth.' }
    ],
    danger: [
      { id: 'confused', label: 'Confused' },
      { id: 'fainted', label: 'Fainted' },
      { id: 'seizure', label: 'Seizure' },
      { id: 'dryskin', label: 'Hot, red, dry skin' },
      { id: 'fever', label: 'Fever over 40°C' }
    ],
    dangerText: 'These are signs of heat stroke. It can kill. Call 911 now and start cooling the person while you wait.',
    steps: [
      'Move the person to the shade and fan them.',
      'Remove outer clothing.',
      'Put cold compresses on the head, face, neck, armpits, wrists, ankles and groin.',
      'Give slow sips of cool water, only if they are awake.',
      'Call 911 or bring them to the hospital.'
    ],
    donts: [
      'No water for anyone who is confused or unconscious.',
      'No soda, coffee or alcohol.',
      'Turn a vomiting or unconscious person on their side.'
    ]
  },
  rain: {
    title: 'Flood and rainy-season illness',
    mild: [
      { id: 'waded', label: 'Waded in floodwater', tip: 'Wash with soap and clean water now. Visit a health center within 1–2 days and ask about preventive medicine.' },
      { id: 'wound', label: 'Small wound after a flood', tip: 'Wash with soap and clean water, then cover it. Watch for redness or swelling.' },
      { id: 'mfever', label: 'Mild fever', tip: 'Rest and drink fluids. If you waded in floodwater, see a health center. No aspirin or ibuprofen until dengue is ruled out.' },
      { id: 'cough', label: 'Cough or colds', tip: 'Rest, drink warm fluids, and cover your cough. See a doctor if it lasts over a week.' }
    ],
    danger: [
      { id: 'calf', label: 'Fever with muscle or calf pain' },
      { id: 'yellow', label: 'Yellow eyes or skin' },
      { id: 'urine', label: 'Little or dark urine' },
      { id: 'bleed', label: 'Bleeding gums or nose' },
      { id: 'belly', label: 'Severe belly pain or nonstop vomiting' },
      { id: 'weak', label: 'Very weak or drowsy' }
    ],
    dangerText: 'These can be signs of leptospirosis or severe dengue. Go to the hospital now. Call 911 if you need transport.',
    steps: [
      'After wading in floodwater, wash with soap and clean water.',
      'Clean and cover any wounds.',
      'Visit a health center within 1–2 days, even without symptoms. Ask about preventive medicine.',
      'In the following weeks, watch for fever, muscle pain, and red or yellow eyes.',
      'Prevent dengue: empty standing water around the house.'
    ],
    donts: [
      'Never jump in after someone swept away. Call 911 and throw a rope or something that floats.',
      'Stay away from fallen power lines.',
      'Do not let children play in floodwater.'
    ]
  }
};

BD.HOTLINES = [
  { name: 'Davao City Central 911', desc: 'Free, 24/7. Police, fire, rescue and ambulance.', numbers: [{ label: 'Emergency', n: '911' }], big: true },
  { name: 'Central 911 office', desc: 'Office line for non-emergency matters.', numbers: [{ label: 'Landline', n: '(082) 296-9626' }] },
  { name: 'DCWD 24-hour call center', desc: 'Davao City Water District: no water, leaks, low pressure.', numbers: [{ label: 'Landline', n: '(082) 235-3293' }, { label: 'Landline', n: '(082) 244-6767' }] },
  { name: 'DCWD text hotlines', desc: 'Send a text to report water problems.', numbers: [{ label: 'Globe', n: '0927-798-8966', sms: true }, { label: 'Smart', n: '0908-441-0653', sms: true }, { label: 'Sun', n: '0925-511-3293', sms: true }] }
];
