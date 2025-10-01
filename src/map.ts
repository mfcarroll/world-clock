// src/map.ts

import * as dom from './dom';
import { state } from './state';
import { fetchTimezoneForCoordinates, getTimezoneOffset, startClocks } from './time';
import { distance } from './utils';
// JSZip is no longer needed

// File from https://github.com/evansiroky/timezone-boundary-builder/releases
const TIMEZONE_GEOJSON_URL = '/timezones-with-oceans.json';

export async function initMaps() {
  const initialCoords = { lat: 0, lng: 0 };

  const { Map } = await google.maps.importLibrary("maps") as google.maps.MapsLibrary;
  const { AdvancedMarkerElement } = await google.maps.importLibrary("marker") as google.maps.MarkerLibrary;
  await google.maps.importLibrary("geometry");

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

  loadGeoJsonAsync();

  state.timezoneMap.data.setStyle({
    fillColor: '#4f46e5',
    fillOpacity: 0.1,
    strokeWeight: 1,
    strokeColor: '#818cf8',
  });
  
  state.timezoneMap.data.addListener('click', async (event: google.maps.Data.MouseEvent) => {
    if (event.latLng) {
      const tzid = event.feature.getProperty('tzid') as string;
      if (tzid) {
        state.selectedTimezone = { tzid, feature: event.feature };
        state.temporaryTimezone = tzid;
        updateMapHighlights();
        document.dispatchEvent(new CustomEvent('temporarytimezonechanged', { detail: { tzid } }));
      }
    }
  });

  state.timezoneMap.data.addListener('mouseover', (event: google.maps.Data.MouseEvent) => {
    if(!state.timezoneMap) return;
    state.timezoneMap.data.overrideStyle(event.feature, {
        strokeWeight: 2,
        strokeColor: '#9ca3af',
    });
    
    const tzid = event.feature.getProperty('tzid') as string;
    const hoverText = tzid || 'Unknown';

    if (hoverText && hoverText !== state.selectedTimezone.tzid) {
        dom.hoverTimezoneDetailsEl.innerHTML = `<p class="font-semibold">${hoverText.replace(/_/g, ' ')}</p>`;
        dom.hoverTimezoneDetailsEl.classList.remove('hidden');
    }
  });

  state.timezoneMap.data.addListener('mouseout', () => {
    if(!state.timezoneMap) return;
    state.timezoneMap.data.revertStyle();
    updateMapHighlights();
    dom.hoverTimezoneDetailsEl.classList.add('hidden');
  });
}

async function loadGeoJsonAsync() {
    try {
        console.log(`Starting background download from: ${TIMEZONE_GEOJSON_URL}`);
        const response = await fetch(TIMEZONE_GEOJSON_URL);
        if (!response.ok) {
            console.error("Failed to fetch local GeoJSON file. Did you place 'timezones-with-oceans.json' in the 'public' directory?");
            throw new Error(`Network response was not ok: ${response.statusText}`);
        }
        
        const geoJson = await response.json();
        
        if (state.timezoneMap) {
            state.timezoneMap.data.addGeoJson(geoJson);
            state.geoJsonLoaded = true;
            console.log("GeoJSON loaded and layered onto map.");

            if (state.lastFetchedCoords.lat !== 0) {
                 console.log("Location already known. Finding feature now.");
                 findAndSetGpsFeature(new google.maps.LatLng(state.lastFetchedCoords.lat, state.lastFetchedCoords.lon));
                 updateMapHighlights();
            }
        }
    } catch (error) {
        console.error("Failed to load and process GeoJSON data:", error);
    }
}

export function updateMapHighlights() {
    if (!state.timezoneMap) return;
    
    state.timezoneMap.data.revertStyle();
    dom.selectedTimezoneDetailsEl.innerHTML = ''; 

    if (state.gpsTimezone.feature) {
        state.timezoneMap.data.overrideStyle(state.gpsTimezone.feature, {
            fillColor: '#3b82f6',
            fillOpacity: 0.4,
            strokeWeight: 3,
            strokeColor: '#60a5fa',
        });
    }

    if (state.selectedTimezone.feature && state.selectedTimezone.feature !== state.gpsTimezone.feature) {
        state.timezoneMap.data.overrideStyle(state.selectedTimezone.feature, {
            fillColor: '#f59e0b',
            fillOpacity: 0.4,
            strokeWeight: 3,
            strokeColor: '#fcd34d',
        });
    }

    let detailsHtml = '';
    if (state.gpsTimezone.tzid) {
        detailsHtml += `<p class="font-semibold text-white">Your Location: ${state.gpsTimezone.tzid.replace(/_/g, ' ')}</p>`;
    }
    if (state.selectedTimezone.tzid && state.selectedTimezone.tzid !== state.gpsTimezone.tzid) {
        detailsHtml += `<p class="font-semibold text-white">Selected: ${state.selectedTimezone.tzid.replace(/_/g, ' ')}</p>`;
        if(state.gpsTimezone.tzid) {
            const offset = getTimezoneOffset(state.selectedTimezone.tzid, state.gpsTimezone.tzid);
            detailsHtml += `<p>${offset}</p>`;
        }
    }
    dom.selectedTimezoneDetailsEl.innerHTML = detailsHtml;
}

function isLocationInFeature(location: google.maps.LatLng, feature: google.maps.Data.Feature): boolean {
    const geometry = feature.getGeometry();
    if (!geometry) {
        return false;
    }

    let isInside = false;
    const geometryType = geometry.getType();

    const processPolygon = (geom: google.maps.Data.Polygon): boolean => {
        const linearRings = geom.getArray();
        const outerBoundary = linearRings[0].getArray();
        const polygon = new google.maps.Polygon({ paths: outerBoundary });
        return google.maps.geometry.poly.containsLocation(location, polygon);
    };

    if (geometryType === 'Polygon') {
        isInside = processPolygon(geometry as google.maps.Data.Polygon);
    } else if (geometryType === 'MultiPolygon') {
        const polygons = (geometry as google.maps.Data.MultiPolygon).getArray();
        for (const polygon of polygons) {
            if (processPolygon(polygon)) {
                isInside = true;
                break;
            }
        }
    }

    return isInside;
}

function findAndSetGpsFeature(location: google.maps.LatLng) {
    if (!state.timezoneMap) return;
    
    let matchFound = false;
    state.timezoneMap.data.forEach((feature: google.maps.Data.Feature) => {
        if (matchFound) return;

        if (isLocationInFeature(location, feature)) {
            state.gpsTimezone.feature = feature;
            matchFound = true;
        }
    });

    if(!matchFound) {
        console.warn("Could not find a timezone polygon for the current location.");
    }
}


export async function onLocationSuccess(position: GeolocationPosition) {
  if (!state.locationMarker || !state.timezoneMapMarker || !state.locationMap || !state.timezoneMap) {
      return;
  }
    
  const { latitude, longitude } = position.coords;
  const currentPos = { lat: latitude, lng: longitude };
  const currentLatLng = new google.maps.LatLng(latitude, longitude);

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
    console.log("Location changed, fetching new timezone name...");
    state.lastFetchedCoords = { lat: latitude, lon: longitude };

    const tzid = await fetchTimezoneForCoordinates(latitude, longitude);
    
    if (tzid) {
      startClocks(tzid);
      state.gpsTimezone.tzid = tzid;
      
      if (state.geoJsonLoaded) {
          console.log("GeoJSON already loaded. Finding feature now.");
          findAndSetGpsFeature(currentLatLng);
          updateMapHighlights();
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