// autocomplete.js

// debounce utility agar fungsi tidak dipanggil terlalu sering saat user mengetik
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// Fetch autocomplete taxi stand berdasarkan nama
async function fetchTaxiStandSuggestions(query) {
  if (!query || query.trim().length < 2) return [];
  try {
    const response = await fetch(`http://localhost:3000/taxistands/search?q=${encodeURIComponent(query.trim())}`);
    if (!response.ok) throw new Error('Network response was not ok');
    return await response.json();
  } catch (err) {
    console.error('Error fetching taxi stand suggestions:', err);
    return [];
  }
}

// Fetch taxi stand terdekat dari lokasi bebas (radius default 5km)
async function fetchNearbyTaxiStandsFromLocation(lat, lon, radius_km = 5) {
  try {
    const response = await fetch(`http://localhost:3000/taxistands/nearby-from-location?lat=${lat}&lon=${lon}&radius_km=${radius_km}`);
    if (!response.ok) throw new Error('Network response was not ok');
    return await response.json();
  } catch (err) {
    console.error('Error fetching nearby taxi stands from location:', err);
    return [];
  }
}

// Fungsi reverse geocoding Nominatim dari koordinat dengan cache sederhana
const reverseGeocodeCache = new Map();

async function reverseGeocode(lat, lon) {
  const key = `${lat.toFixed(6)}_${lon.toFixed(6)}`;
  if (reverseGeocodeCache.has(key)) {
    return reverseGeocodeCache.get(key);
  }
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=17&addressdetails=1`;
    const headers = { 'User-Agent': 'Farely-Webtool' };
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    const result = data.address?.road || data.display_name || "Unknown Location";
    reverseGeocodeCache.set(key, result);
    return result;
  } catch (error) {
    console.error("Reverse geocoding error:", error);
    return "Unknown Location";
  }
}

// Tampilkan daftar suggestion ke container dropdown
function showTaxiStandSuggestions(container, items, isPointA) {
  container.innerHTML = '';
  if (!items || items.length === 0) {
    const noitem = document.createElement('div');
    noitem.className = 'suggestion-item';
    noitem.textContent = 'No taxi stands found';
    container.appendChild(noitem);
    return;
  }
  items.slice(0, 10).forEach(item => {
    const div = document.createElement('div');
    div.className = 'suggestion-item';
    div.textContent = item.name || 'Unnamed Stand';
    div.onclick = () => {
      if (isPointA) {
        document.getElementById('pointA').value = item.name || '';
        window.selectedPointA = { lat: item.lat, lon: item.lon, name: item.name };
        window.updateSelectedPointsMarkers();
        document.getElementById('suggestA').innerHTML = '';
      } else {
        document.getElementById('pointB').value = item.name || '';
        window.selectedPointB = { lat: item.lat, lon: item.lon, name: item.name };
        window.updateSelectedPointsMarkers();
        document.getElementById('suggestB').innerHTML = '';
      }
    };
    container.appendChild(div);
  });
}

// Setup event autocomplete untuk input Point A dan B dengan debounce
const inputA = document.getElementById('pointA');
const inputB = document.getElementById('pointB');
const suggestA = document.getElementById('suggestA');
const suggestB = document.getElementById('suggestB');

const handleInputA = debounce(async () => {
  const query = inputA.value;
  if (query.length < 2) {
    suggestA.innerHTML = '';
    return;
  }
  suggestA.innerHTML = '<div class="suggestion-item">Loading...</div>';
  const results = await fetchTaxiStandSuggestions(query);
  showTaxiStandSuggestions(suggestA, results, true);
}, 300);

const handleInputB = debounce(async () => {
  const query = inputB.value;
  if (query.length < 2) {
    suggestB.innerHTML = '';
    return;
  }
  suggestB.innerHTML = '<div class="suggestion-item">Loading...</div>';
  const results = await fetchTaxiStandSuggestions(query);
  showTaxiStandSuggestions(suggestB, results, false);
}, 300);

inputA.addEventListener('input', handleInputA);
inputB.addEventListener('input', handleInputB);

// Event klik peta untuk pilih Point A atau B, dan fetch rekomendasi taxi stand terdekat
window.map.on('click', async function (e) {
  if (window.isLoading) return;
  const { lat, lng } = e.latlng;

  // Tentukan input aktif: prioritas input A jika kosong atau fokus, else B
  const activeInput = (document.activeElement === inputA || !inputA.value.trim()) ? 'A' : 'B';
  const suggestContainer = activeInput === 'A' ? suggestA : suggestB;
  const inputElement = activeInput === 'A' ? inputA : inputB;

  // Set loading suggestion
  suggestContainer.innerHTML = '<div class="suggestion-item">Loading nearby taxi stands...</div>';

  // Panggil reverse geocode untuk nama jalan/lokasi
  const placeName = await reverseGeocode(lat, lng);
  inputElement.value = placeName;

  // Simpan lokasi sebagai point A/B
  if (activeInput === 'A') {
    window.selectedPointA = { lat, lon: lng, name: placeName };
  } else {
    window.selectedPointB = { lat, lon: lng, name: placeName };
  }
  window.updateSelectedPointsMarkers();

  // Cari taxi stand terdekat dari lokasi klik
  const nearby = await fetchNearbyTaxiStandsFromLocation(lat, lng, 5);
  showTaxiStandSuggestions(suggestContainer, nearby, activeInput === 'A');
});