// src/map.ts

import * as dom from './dom';
import { state } from './state';
import { fetchTimezoneForCoordinates, getTimezoneOffset, startClocks } from './time';
import { distance } from './utils';

const TIMEZONE_GEOJSON_URL = '/timezones.geojson';

// --- HELPER FUNCTIONS ---

function updateTimezoneDetails(element: HTMLElement, feature: google.maps.Data.Feature | null) {
  if (feature) {
    const tzid = feature.getProperty('tz_name1st') as string | null;
    const zone = feature.getProperty('zone') as number;
    
    let displayName = tzid;
    let offsetDisplay: string;

    if (tzid) {
      const referenceTz = state.gpsTzid || Intl.DateTimeFormat().resolvedOptions().timeZone;
      offsetDisplay = getTimezoneOffset(tzid, referenceTz);
    } else {
      // Fallback for shapes with no name
      displayName = `UTC${zone >= 0 ? '+' : ''}${zone}`;
      offsetDisplay = `UTC${zone >= 0 ? '+' : ''}${zone}`;
    }
    
    const region = displayName?.split('/')[0].replace(/_/g, ' ') || 'Unknown';
    const city = displayName?.split('/')[1]?.replace(/_/g, ' ') || '';
    
    element.innerHTML = `
      <div class="text-lg font-bold">${city || region}</div>
      <div class="text-sm">${offsetDisplay}</div>
    `;
    element.classList.remove('hidden');
  } else {
    element.innerHTML = '';
    element.classList.add('hidden');
  }
}

function selectTimezone(feature: google.maps.Data.Feature | null) {
  if (!feature) return;

  const tzid = feature.getProperty('tz_name1st') as string | null;
  const zone = feature.getProperty('zone') as number;

  state.selectedZone = zone;
  state.temporaryTimezone = tzid || `UTC${zone >= 0 ? '+' : ''}${zone}`;
  
  updateMapHighlights();
  updateTimezoneDetails(dom.selectedTimezoneDetailsEl, feature);
  document.dispatchEvent(new CustomEvent('temporarytimezonechanged'));
}

// --- END HELPER FUNCTIONS ---


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

  loadGeoJson();

  // --- ZONE-BASED EVENT LISTENERS ---

  state.timezoneMap.data.addListener('mouseover', (event: google.maps.Data.MouseEvent) => {
    state.hoveredZone = event.feature.getProperty('zone') as number;
    updateMapHighlights();
    updateTimezoneDetails(dom.hoverTimezoneDetailsEl, event.feature);
  });
  
  state.timezoneMap.data.addListener('mouseout', () => {
    state.hoveredZone = null;
    updateMapHighlights();
    updateTimezoneDetails(dom.hoverTimezoneDetailsEl, null);
  });
  
  state.timezoneMap.data.addListener('click', (event: google.maps.Data.MouseEvent) => {
    selectTimezone(event.feature);
  });
}

function loadGeoJson() {
    console.log(`Loading GeoJSON from: ${TIMEZONE_GEOJSON_URL}`);
    // FIX: Removed the problematic idPropertyName option
    state.timezoneMap!.data.loadGeoJson(TIMEZONE_GEOJSON_URL, undefined, () => {
        state.geoJsonLoaded = true;
        console.log('Timezone GeoJSON has finished loading and is ready.');
        updateMapHighlights();
        if (state.lastFetchedCoords.lat !== 0) {
            findAndSetGpsFeature();
        }
    });
}

function updateMapHighlights() {
    state.timezoneMap!.data.setStyle(feature => {
        const featureZone = feature.getProperty('zone') as number;
        let zIndex = 1;
        let fillColor = 'transparent';
        let strokeColor = 'rgba(255, 255, 255, 0.5)';
        let strokeWeight = 1;

        if (state.selectedZone !== null && state.selectedZone === featureZone) {
            fillColor = 'rgba(255, 255, 0, 0.3)';
            strokeColor = 'yellow';
            strokeWeight = 2;
            zIndex = 3;
        } else if (state.hoveredZone !== null && state.hoveredZone === featureZone) {
            fillColor = 'rgba(255, 255, 255, 0.3)';
            strokeColor = 'white';
            strokeWeight = 2;
            zIndex = 2;
        } else if (state.gpsZone !== null && state.gpsZone === featureZone) {
            fillColor = 'rgba(0, 0, 255, 0.3)';
            strokeColor = 'blue';
            strokeWeight = 2;
            zIndex = 1;
        }

        return ({
            fillColor,
            strokeColor,
            strokeWeight,
            zIndex,
        });
    });
}

function findAndSetGpsFeature() {
    if (state.gpsTzid) {
        let foundZone: number | null = null;
        state.timezoneMap!.data.forEach(feature => {
            if (feature.getProperty('tz_name1st') === state.gpsTzid) {
                foundZone = feature.getProperty('zone') as number;
            }
        });
        if (foundZone !== null) {
            state.gpsZone = foundZone;
        }
        updateMapHighlights();
    }
}


export async function onLocationSuccess(position: GeolocationPosition) {
  const { latitude, longitude } = position.coords;
  const currentLatLng = new google.maps.LatLng(latitude, longitude);

  dom.latitudeEl.textContent = `${latitude.toFixed(4)}°`;
  dom.longitudeEl.textContent = `${longitude.toFixed(4)}°`;

  state.locationMap!.setCenter(currentLatLng);
  state.locationMarker!.position = currentLatLng;
  state.timezoneMap!.setCenter(currentLatLng);
  state.timezoneMapMarker!.position = currentLatLng;

  dom.locationLoader.classList.add('hidden');
  dom.locationContent.classList.remove('hidden');

  const dist = distance(latitude, longitude, state.lastFetchedCoords.lat, state.lastFetchedCoords.lon);
  if (dist > 1) {
    console.log("Location changed, fetching new timezone name...");
    state.lastFetchedCoords = { lat: latitude, lon: longitude };

    const tzid = await fetchTimezoneForCoordinates(latitude, longitude);
    if (tzid) {
      startClocks(tzid);
      state.gpsTzid = tzid;
      
      if (state.geoJsonLoaded) {
          findAndSetGpsFeature();
      }
      
      document.dispatchEvent(new CustomEvent('gpstimezonefound', { detail: { tzid } }));
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