import { mapStyles } from './map-styles';

// --- CONFIGURATION ---
const TIMEZONE_API_KEY = "W9EYNXL4UXY8";
const TIMEZONE_GEOJSON_URL = 'https://raw.githubusercontent.com/evansiroky/timezone-boundary-builder/master/dist/timezones.geojson';


// --- DOM ELEMENTS ---
const latitudeEl = document.getElementById('latitude')!;
const longitudeEl = document.getElementById('longitude')!;
const locationErrorEl = document.getElementById('location-error')!;
const localTimeEl = document.getElementById('local-time')!;
const localTimezoneEl = document.getElementById('local-timezone')!;
const localDateEl = document.getElementById('local-date')!;
const deviceTimeEl = document.getElementById('device-time')!;
const deviceTimezoneEl = document.getElementById('device-timezone')!;

const locationLoader = document.getElementById('location-loader')!;
const timeLoader = document.getElementById('time-loader')!;
const locationContent = document.getElementById('location-content')!;
const timeContent = document.getElementById('time-content')!;

const timezoneInput = document.getElementById('timezone-input') as HTMLInputElement;
const addTimezoneBtn = document.getElementById('add-timezone-btn')!;
const worldClocksContainer = document.getElementById('world-clocks-container')!;
const timezoneList = document.getElementById('timezone-list')!;
const timezoneMapTitle = document.getElementById('timezone-map-title')!;

// --- MAP & GEOLOCATION STATE ---
let locationMap: google.maps.Map;
let timezoneMap: google.maps.Map;
let locationMarker: google.maps.Marker;
let timezoneMapMarker: google.maps.Marker;

let clocksInterval: number;
let addedTimezones: string[] = ['America/New_York', 'Europe/London', 'Asia/Tokyo'];
let lastFetchedCoords = { lat: 0, lon: 0 };

// --- MAP INITIALIZATION ---
function initMaps() {
  const initialCoords = { lat: 0, lng: 0 };

  // 1. Initialize Location Map
  locationMap = new google.maps.Map(document.getElementById('location-map')!, {
    center: initialCoords,
    zoom: 2,
    styles: mapStyles,
    disableDefaultUI: true,
  });
  locationMarker = new google.maps.Marker({ position: initialCoords, map: locationMap });

  // 2. Initialize Timezone Map
  timezoneMap = new google.maps.Map(document.getElementById('timezone-map')!, {
    center: initialCoords,
    zoom: 2,
    styles: mapStyles,
    disableDefaultUI: true,
    zoomControl: true,
    streetViewControl: false,
  });
  timezoneMapMarker = new google.maps.Marker({ position: initialCoords, map: timezoneMap });

  // 3. Load Timezone Boundaries GeoJSON
  timezoneMap.data.loadGeoJson(TIMEZONE_GEOJSON_URL);

  // Style the timezone layer
  timezoneMap.data.setStyle({
    fillColor: '#4f46e5',
    fillOpacity: 0.1,
    strokeWeight: 1,
    strokeColor: '#818cf8',
  });
  
  // Add hover effect to timezone layer
  timezoneMap.data.addListener('mouseover', (event: google.maps.Data.MouseEvent) => {
    timezoneMap.data.overrideStyle(event.feature, {
        strokeWeight: 3,
        strokeColor: '#f87171',
    });
    const tzid = event.feature.getProperty('tzid');
    timezoneMapTitle.textContent = `Timezone: ${tzid}`;
  });

  timezoneMap.data.addListener('mouseout', () => {
    timezoneMap.data.revertStyle();
    timezoneMapTitle.textContent = 'World Timezone Map';
  });

  // Start the main application logic
  main();
}
// Expose initMaps to the global scope so the Maps API callback can find it
(window as any).initMaps = initMaps;


// --- GEOLOCATION & TIME LOGIC ---

function onLocationSuccess(position: GeolocationPosition) {
  const { latitude, longitude } = position.coords;
  const currentPos = { lat: latitude, lng: longitude };

  // Update UI
  latitudeEl.textContent = latitude.toFixed(6);
  longitudeEl.textContent = longitude.toFixed(6);
  locationLoader.classList.add('hidden');
  locationContent.classList.remove('hidden');
  locationErrorEl.classList.add('hidden');
  
  // Update map markers and centers
  locationMarker.setPosition(currentPos);
  timezoneMapMarker.setPosition(currentPos);
  locationMap.setCenter(currentPos);
  locationMap.setZoom(14);
  timezoneMap.panTo(currentPos);

  // Fetch timezone if location has changed significantly
  const dist = distance(latitude, longitude, lastFetchedCoords.lat, lastFetchedCoords.lon);
  if (dist > 1) { // Refetch if moved > 1km
    console.log("Location changed, fetching new timezone...");
    lastFetchedCoords = { lat: latitude, lon: longitude };
    fetchTimezone(latitude, longitude);
  }
}

function onLocationError(error: GeolocationPositionError) {
  let errorMessage = 'Could not retrieve location.';
  switch (error.code) {
    case error.PERMISSION_DENIED:
      errorMessage = 'Location access denied. Please enable it in your browser settings.';
      break;
    case error.POSITION_UNAVAILABLE:
      errorMessage = 'Location information is unavailable.';
      break;
    case error.TIMEOUT:
      errorMessage = 'The request to get user location timed out.';
      break;
  }
  locationErrorEl.textContent = errorMessage;
  locationErrorEl.classList.remove('hidden');
  locationLoader.classList.add('hidden');
  locationContent.classList.remove('hidden');

  if (!clocksInterval) {
    console.warn("Falling back to browser's default timezone.");
    const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    startClocks(browserTimezone);
  }
}

async function fetchTimezone(lat: number, lon: number) {
  if (TIMEZONE_API_KEY === 'YOUR_TIMEZONEDB_API_KEY') {
    console.error('TimeZoneDB API key is missing.');
    locationErrorEl.textContent = 'TimeZone API key missing. Using browser default.';
    locationErrorEl.classList.remove('hidden');
    if (!clocksInterval) startClocks(Intl.DateTimeFormat().resolvedOptions().timeZone);
    return;
  }

  try {
    const response = await fetch(`https://api.timezonedb.com/v2.1/get-time-zone?key=${TIMEZONE_API_KEY}&format=json&by=position&lat=${lat}&lng=${lon}`);
    if (!response.ok) throw new Error('Network response was not ok.');
    
    const data = await response.json();
    if (data.status === 'OK') {
      startClocks(data.zoneName);
    } else {
      throw new Error(data.message || 'Failed to fetch timezone.');
    }
  } catch (error) {
    console.error('Error fetching timezone:', error);
    locationErrorEl.textContent = 'Could not fetch timezone. Using browser default.';
    locationErrorEl.classList.remove('hidden');
    if (!clocksInterval) startClocks(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }
}

function startClocks(localTimezone: string) {
  if (clocksInterval) clearInterval(clocksInterval);
  updateAllClocks(localTimezone);
  clocksInterval = setInterval(() => updateAllClocks(localTimezone), 1000);
}

function updateAllClocks(localTimezone: string) {
  const now = new Date();

  // Update GPS-based Time
  try {
    localTimeEl.textContent = now.toLocaleTimeString('en-US', { timeZone: localTimezone });
    localDateEl.textContent = now.toLocaleDateString('en-US', { timeZone: localTimezone, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    localTimezoneEl.textContent = localTimezone.replace(/_/g, ' ');
  } catch (e) {
    console.error(`Invalid local timezone: ${localTimezone}`, e);
    localTimeEl.textContent = "Error";
  }
  
  // Update Device Time
  const deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  deviceTimeEl.textContent = now.toLocaleTimeString('en-US');
  deviceTimezoneEl.textContent = deviceTz.replace(/_/g, ' ');

  timeLoader.classList.add('hidden');
  timeContent.classList.remove('hidden');

  // Update World Clocks
  addedTimezones.forEach(tz => {
    const el = document.getElementById(`clock-${tz.replace(/\//g, '-')}`);
    if (el) {
      try {
        const timeString = now.toLocaleTimeString('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
        const dateString = now.toLocaleDateString('en-US', { timeZone: tz, weekday: 'short' });
        const timeDiff = getTimezoneOffset(tz, localTimezone);
        el.querySelector('.time')!.textContent = timeString;
        el.querySelector('.date-diff')!.textContent = `${dateString}, ${timeDiff}`;
      } catch (e) {
        el.querySelector('.time')!.textContent = "Error";
      }
    }
  });
}

// --- HELPER FUNCTIONS ---

function getTimezoneOffset(tz1: string, tz2: string): string {
  try {
    const now = new Date();
    const offset1 = new Date(now.toLocaleString('en-US', { timeZone: tz1 })).getTime();
    const offset2 = new Date(now.toLocaleString('en-US', { timeZone: tz2 })).getTime();
    const diffHours = (offset1 - offset2) / 3600000;
    if (Math.abs(diffHours) < 0.01) return 'Same as GPS';
    return `${diffHours > 0 ? '+' : ''}${diffHours} hrs`;
  } catch (e) {
    return 'Offset N/A';
  }
}

function distance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (!lat2 || !lon2) return Infinity; // Handle initial case
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 0.5 - Math.cos(dLat) / 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * (1 - Math.cos(dLon)) / 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

// --- WORLD CLOCK UI ---

function renderWorldClocks() {
  worldClocksContainer.innerHTML = '';
  addedTimezones.forEach(tz => {
    const tzId = `clock-${tz.replace(/\//g, '-')}`;
    const clockHTML = `
      <div id="${tzId}" class="flex items-center justify-between bg-gray-700/50 p-3 rounded-lg">
        <div>
          <p class="text-lg font-medium text-white">${tz.replace(/_/g, ' ').split('/').pop()}</p>
          <p class="text-sm text-gray-400">${tz.replace(/_/g, ' ').split('/')[0]}</p>
        </div>
        <div class="text-right">
          <p class="time text-2xl font-semibold text-white font-mono">--:--</p>
          <p class="date-diff text-sm text-gray-400">--, +/- hrs</p>
        </div>
        <button class="remove-btn ml-4 text-gray-500 hover:text-red-400 transition-colors" data-timezone="${tz}">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
        </button>
      </div>`;
    worldClocksContainer.insertAdjacentHTML('beforeend', clockHTML);
  });
}

function handleAddTimezone() {
  const newTimezone = timezoneInput.value.trim();
  const ianaTimezones = Intl.supportedValuesOf('timeZone');
  if (newTimezone && !addedTimezones.includes(newTimezone) && ianaTimezones.includes(newTimezone)) {
    addedTimezones.push(newTimezone);
    renderWorldClocks();
    const localTimezone = localTimezoneEl.textContent?.replace(/ /g, '_');
    if (localTimezone && localTimezone !== '--_/_--') {
      updateAllClocks(localTimezone);
    }
  } else if (newTimezone && !ianaTimezones.includes(newTimezone)) {
    alert('Invalid or unsupported timezone. Please select from the list.');
  }
  timezoneInput.value = '';
}

// --- MAIN APP INITIALIZATION ---

function main() {
  // Populate timezone datalist
  const ianaTimezones = Intl.supportedValuesOf('timeZone');
  timezoneList.innerHTML = ianaTimezones.map(tz => `<option value="${tz}"></option>`).join('');

  // Setup event listeners
  addTimezoneBtn.addEventListener('click', handleAddTimezone);
  timezoneInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleAddTimezone();
  });

  worldClocksContainer.addEventListener('click', (e) => {
    const removeBtn = (e.target as HTMLElement).closest('.remove-btn');
    if (removeBtn) {
      const timezoneToRemove = (removeBtn as HTMLElement).dataset.timezone!;
      addedTimezones = addedTimezones.filter(tz => tz !== timezoneToRemove);
      renderWorldClocks();
    }
  });

  // Initial render of clocks
  renderWorldClocks();

  // Start watching for location
  navigator.geolocation.watchPosition(onLocationSuccess, onLocationError, {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0,
  });
}
