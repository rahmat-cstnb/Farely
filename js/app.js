// app.js

let map;
let markers = [];
let routeLine;
window.selectedPointA = null;
window.selectedPointB = null;
window.isLoading = false;

// Simpan layer plaza toll global agar bisa di-clear jika perlu
let plazaLayerGroup;
// Variabel global untuk layer taxi stand
let taxiLayerGroup = null;

window.markerPointA = null;
window.markerPointB = null;

// Definisi icon custom
const plazaIcon = L.icon({
  iconUrl: 'assets/gate.png',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32]
});

const taxiIcon = L.icon({
  iconUrl: 'assets/stand.png',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32]
});

// Utility: Haversine (km)
function haversineDistance(lat1, lon1, lat2, lon2) {
  function toRad(v){return v * Math.PI/180}
  const R = 6371;
  const dLat = toRad(lat2-lat1);
  const dLon = toRad(lon2-lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Render ringkasan & struk
function renderData(data) {
  function formatNumber(value) {
    return (typeof value === 'number' && !isNaN(value)) ? value.toFixed(2) : '-';
  }

  // Debug: tampilkan data di console (bisa dihapus nanti)
  console.log("Render data:", data);

  const vehicleType = data.vehicleType || '-';
  const vehicleClass = data.vehicleClass || '-';
  const distance = formatNumber(data.distance);
  const ratePerKm = formatNumber(data.ratePerKm);
  const roadCost = formatNumber(data.roadCost);
  const estimatedTime = data.estimatedTime || '-';
  const totalCost = formatNumber(data.totalCost);

  document.getElementById("summary").innerHTML = `
    <p><strong>Vehicle Type:</strong> ${vehicleType}</p>
    <p><strong>Vehicle Class:</strong> ${vehicleClass}</p>
    <p><strong>Distance:</strong> ${distance} km</p>
    <p><strong>Road Cost/km:</strong> RM ${ratePerKm}</p>
    <p><strong>Road Cost:</strong> RM ${roadCost}</p>
    <p><strong>Estimated Time:</strong> ${estimatedTime}</p>
  `;

  let receipt = "==============================\n";
  receipt += "        Travel Cost Receipt        \n";
  receipt += "==============================\n\n";
  receipt += `Vehicle Type   : ${vehicleType}\n`;
  receipt += `Vehicle Class  : ${vehicleClass}\n`;
  receipt += `Distance       : ${distance} km\n`;
  receipt += `Rate/km        : RM ${ratePerKm}\n`;
  receipt += `Road Cost      : RM ${roadCost}\n\n`;
  receipt += "Toll Breakdown:\n";
  receipt += "--------------------------------\n";

  if (Array.isArray(data.details) && data.details.length > 0) {
    data.details.forEach(toll => {
      const from = toll.from || 'Unknown';
      const to = toll.to || 'Unknown';
      const rateFormatted = (typeof toll.rate === 'number' && toll.rate !== null && !isNaN(toll.rate)) ? toll.rate.toFixed(2) : 'N/A';
      receipt += `${from} ➜ ${to} : RM ${rateFormatted}\n`;
    });
  } else {
    receipt += "No toll charges applied.\n";
  }

  receipt += "--------------------------------\n";
  receipt += `Total Toll Fee : RM ${formatNumber(data.tollCost || 0)}\n\n`;
  receipt += "==============================\n";
  receipt += `TOTAL COST     : RM ${totalCost}\n`;
  receipt += "==============================\n";

  document.getElementById("receipt").textContent = receipt;
}

// Inisialisasi peta (Leaflet)
function initMap() {
  map = L.map('map').setView([3.05, 101.72], 10);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OSM contributors'
  }).addTo(map);

  const MIN_ZOOM_SHOW_POINTS = 16; // zoom level minimal agar marker tampil

  function updateMarkerVisibility() {
    const currentZoom = map.getZoom();

    if (plazaLayerGroup) {
      if (currentZoom >= MIN_ZOOM_SHOW_POINTS) {
        if (!map.hasLayer(plazaLayerGroup)) {
          plazaLayerGroup.addTo(map);
        }
      } else {
        if (map.hasLayer(plazaLayerGroup)) {
          map.removeLayer(plazaLayerGroup);
        }
      }
    }

    if (taxiLayerGroup) {
      if (currentZoom >= MIN_ZOOM_SHOW_POINTS) {
        if (!map.hasLayer(taxiLayerGroup)) {
          taxiLayerGroup.addTo(map);
        }
      } else {
        if (map.hasLayer(taxiLayerGroup)) {
          map.removeLayer(taxiLayerGroup);
        }
      }
    }
  }

  map.on('zoomend', updateMarkerVisibility);
  updateMarkerVisibility();

}

// Clear markers/line
function clearMapOverlays() {
  markers.forEach(m => map.removeLayer(m));
  markers = [];
  if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
}

window.updateSelectedPointsMarkers = function() {
  if (window.markerPointA) {
    map.removeLayer(window.markerPointA);
    window.markerPointA = null;
  }
  if (window.markerPointB) {
    map.removeLayer(window.markerPointB);
    window.markerPointB = null;
  }

  if (window.selectedPointA) {
    window.markerPointA = L.marker([window.selectedPointA.lat, window.selectedPointA.lon], {
      icon: taxiIcon
    }).addTo(map).bindPopup("Point A: " + window.selectedPointA.name).openPopup();
  }

  if (window.selectedPointB) {
    window.markerPointB = L.marker([window.selectedPointB.lat, window.selectedPointB.lon], {
      icon: taxiIcon
    }).addTo(map).bindPopup("Point B: " + window.selectedPointB.name).openPopup();
  }
};

// Muat dan tampilkan semua plaza toll di peta dengan icon custom
async function loadAllPlazaTolls() {
  try {
    const res = await fetch('http://localhost:3000/plazatoll.geojson');
    if (!res.ok) throw new Error('Failed to load plaza toll data');
    const data = await res.json();

    if (plazaLayerGroup) {
      map.removeLayer(plazaLayerGroup);
    }

    plazaLayerGroup = L.geoJSON(data, {
      pointToLayer: (feature, latlng) =>
        L.marker(latlng, { icon: plazaIcon })
          .bindPopup(`<strong>${feature.properties.nama_plaza || feature.properties.name}</strong>`)
    }).addTo(map);
  } catch (err) {
    console.error('Error loading plaza tolls:', err);
  }
}

// Fungsi load taxi stands dengan icon custom
async function loadTaxiStands() {
  try {
    const res = await fetch('http://localhost:3000/taxistands.geojson');
    if (!res.ok) throw new Error('Failed to load taxi stands data');
    const data = await res.json();

    if (taxiLayerGroup) {
      map.removeLayer(taxiLayerGroup);
    }

    taxiLayerGroup = L.geoJSON(data, {
      pointToLayer: (feature, latlng) =>
        L.marker(latlng, { icon: taxiIcon })
          .bindPopup(feature.properties.name)
    }).addTo(map);
  } catch (err) {
    console.error('Error loading taxi stands:', err);
  }
}

// Ubah drawRouteAndPlazas untuk menampilkan plaza dilewati beda warna
function drawRouteAndPlazas(pointA, pointB, plazasPassed=[]) {
  clearMapOverlays();

  // Gambarkan rute polyline lewat semua plaza dilewati
  const latlngs = [ [pointA.lat, pointA.lon], ...plazasPassed.map(p=>[p.coordinates[1], p.coordinates[0]]), [pointB.lat, pointB.lon] ];
  routeLine = L.polyline(latlngs, {color: 'dodgerblue', weight: 5}).addTo(map);
  map.fitBounds(routeLine.getBounds(), {padding:[50,50]});

  // Markers titik start (hijau) dan end (merah)
  const startM = L.circleMarker([pointA.lat, pointA.lon], {radius:7, color:'green', fill:true}).addTo(map).bindPopup("Point A: " + (pointA.name || ""));
  const endM = L.circleMarker([pointB.lat, pointB.lon], {radius:7, color:'red', fill:true}).addTo(map).bindPopup("Point B: " + (pointB.name || ""));
  markers.push(startM, endM);

  // Markers plaza dilewati dengan warna biru
  plazasPassed.forEach(p=>{
    const pm = L.circleMarker([p.coordinates[1], p.coordinates[0]], {
      radius:6,
      fillColor: "blue",
      color: "#0000FF",
      weight: 1,
      opacity: 1,
      fillOpacity: 0.9,
      title: p.name
    }).addTo(map).bindPopup("Passed Plaza: " + p.name);
    markers.push(pm);
  });
}


document.addEventListener('DOMContentLoaded', () => {
  initMap();
  loadAllPlazaTolls();
  loadTaxiStands();

  const btn = document.getElementById('calculateBtn');

  btn.addEventListener('click', async () => {
    if (window.isLoading) return;
    window.isLoading = true;
    btn.disabled = true;
    btn.textContent = 'Calculating...';

    if (!window.selectedPointA || !window.selectedPointB) {
      alert("Please select Point A and Point B");
      window.isLoading = false;
      btn.disabled = false;
      btn.textContent = 'Calculate Fare';
      return;
    }

    const vehicleClass = parseInt(document.getElementById('vehicleType').value || "0", 10);
    if (!vehicleClass) {
      alert("Please select a vehicle type");
      window.isLoading = false;
      btn.disabled = false;
      btn.textContent = 'Calculate Fare';
      return;
    }

    try {
      const routeRes = await fetch('http://localhost:3000/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start: { lat: window.selectedPointA.lat, lon: window.selectedPointA.lon },
          end: { lat: window.selectedPointB.lat, lon: window.selectedPointB.lon }
        })
      });
      if (!routeRes.ok) throw new Error('Failed to fetch route');
      const routeData = await routeRes.json();

      drawRouteAndPlazas(window.selectedPointA, window.selectedPointB, routeData.plazas);

      const plazaNames = routeData.plazas.map(p => p.name);

      const distanceKm = haversineDistance(
        window.selectedPointA.lat,
        window.selectedPointA.lon,
        window.selectedPointB.lat,
        window.selectedPointB.lon
      );

      const tollRes = await fetch('http://localhost:3000/toll/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plazas: plazaNames,
          vehicleClass,
          distance_km: distanceKm
        })
      });
      if (!tollRes.ok) throw new Error('Failed to calculate toll');
      const tollData = await tollRes.json();

      renderData(tollData);
    } catch (err) {
      console.error('Error calculating toll:', err);
      alert("Failed to calculate toll. Please try again.");
    }

    window.isLoading = false;
    btn.disabled = false;
    btn.textContent = 'Calculate Fare';
  });
});