// src/map.ts

import * as dom from './dom';
import { state } from './state';
import { fetchTimezoneForCoordinates, getTimezoneOffset, startClocks } from './time';
import { distance } from './utils';

const TIMEZONE_GEOJSON_URL = 'https://raw.githubusercontent.com/treyerl/timezones/refs/heads/master/timezones_wVVG8.geojson';

export async function initMaps() {
  const initialCoords = { lat: 0, lng: 0 };

  const { Map } = await google.maps.importLibrary("maps") as google.maps.MapsLibrary;
  const { AdvancedMarkerElement } = await google.maps.importLibrary("marker") as google.maps.MarkerLibrary;

  state.locationMap = new Map(document.getElementById('location-map')!, {
    center: initialCoords,
    zoom: 2,
    disableDefaultUI: true,
    mapId: 'LOCATION_MAP' 
  });
  state.locationMarker = new AdvancedMarkerElement({ position: initialCoords, map: state.locationMap });

  state.timezoneMap = new Map(document.getElementById('timezone-map')!, {
    center: initialCoords,
    zoom: 2,
    disableDefaultUI: true,
    zoomControl: true,
    streetViewControl: false,
    mapId: 'TIMEZONE_MAP',
    mapTypeId: 'satellite'
  });
  state.timezoneMapMarker = new AdvancedMarkerElement({ position: initialCoords, map: state.timezoneMap });

  try {
    state.timezoneMap.data.loadGeoJson(TIMEZONE_GEOJSON_URL);
  } catch (error) {
    console.error("Failed to load GeoJSON data:", error);
  }

  state.timezoneMap.data.setStyle({
    fillColor: '#4f46e5',
    fillOpacity: 0.1,
    strokeWeight: 1,
    strokeColor: '#818cf8',
  });
  
  state.timezoneMap.data.addListener('click', async (event: google.maps.Data.MouseEvent) => {
    if (event.latLng) {
      const tzid = await fetchTimezoneForCoordinates(event.latLng.lat(), event.latLng.lng());
      if (tzid) {
        state.selectedTimezone = { tzid, feature: event.feature };
        updateMapHighlights();
      }
    }
  });

  // --- FIXED: Restored the correct mouseover logic from the previous version ---
  state.timezoneMap.data.addListener('mouseover', (event: google.maps.Data.MouseEvent) => {
    if(!state.timezoneMap) return;
    state.timezoneMap.data.overrideStyle(event.feature, {
        strokeWeight: 2,
        strokeColor: '#9ca3af',
    });
    
    const nameProp = event.feature.getProperty('name');
    const hoverTzid = typeof nameProp === 'string' ? `UTC ${nameProp}` : 'Unknown';

    if (hoverTzid && hoverTzid !== state.selectedTimezone.tzid) {
        dom.hoverTimezoneDetailsEl.innerHTML = `<p class="font-semibold">${hoverTzid}</p>`;
        dom.hoverTimezoneDetailsEl.classList.remove('hidden');
    }
  });

  state.timezoneMap.data.addListener('mouseout', () => {
    if(!state.timezoneMap) return;
    state.timezoneMap.data.revertStyle();
    dom.hoverTimezoneDetailsEl.classList.add('hidden');
  });
}

export function updateMapHighlights() {
    if (!state.timezoneMap) return;
    
    state.timezoneMap.data.revertStyle();

    if (state.selectedTimezone.feature && state.selectedTimezone.tzid) {
        const { feature, tzid } = state.selectedTimezone;
        
        state.timezoneMap.data.overrideStyle(feature, {
            fillColor: '#f59e0b',
            fillOpacity: 0.4,
            strokeWeight: 3,
            strokeColor: '#fcd34d',
        });
        
        const offset = getTimezoneOffset(tzid, 'UTC');
        dom.selectedTimezoneDetailsEl.innerHTML = `
            <p class="font-semibold text-white">${tzid.replace(/_/g, ' ')}</p>
            <p>Offset from UTC: ${offset}</p>
        `;
    }
}

export async function onLocationSuccess(position: GeolocationPosition) {
  if (!state.locationMarker || !state.timezoneMapMarker || !state.locationMap || !state.timezoneMap) {
      return;
  }
    
  const { latitude, longitude } = position.coords;
  const currentPos = { lat: latitude, lng: longitude };

  dom.latitudeEl.textContent = latitude.toFixed(6);
  dom.longitudeEl.textContent = longitude.toFixed(6);
  dom.locationLoader.classList.add('hidden');
  dom.locationContent.classList.remove('hidden');
  dom.locationErrorEl.classList.add('hidden');
  
  state.locationMarker.position = currentPos;
  state.timezoneMapMarker.position = currentPos;
  state.locationMap.setCenter(currentPos);
  state.locationMap.setZoom(14);
  state.timezoneMap.panTo(currentPos);

  const dist = distance(latitude, longitude, state.lastFetchedCoords.lat, state.lastFetchedCoords.lon);
  if (dist > 1) {
    console.log("Location changed, fetching new timezone...");
    state.lastFetchedCoords = { lat: latitude, lon: longitude };
    const tzid = await fetchTimezoneForCoordinates(latitude, longitude);
    if (tzid) {
      startClocks(tzid);
    }
  }
}

export function onLocationError(error: GeolocationPositionError) {
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
  dom.locationErrorEl.textContent = errorMessage;
  dom.locationErrorEl.classList.remove('hidden');
  dom.locationLoader.classList.add('hidden');
  dom.locationContent.classList.remove('hidden');

  if (!state.clocksInterval) {
    console.warn("Falling back to browser's default timezone.");
    startClocks(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }
}