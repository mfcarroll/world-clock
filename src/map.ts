// src/map.ts

import * as dom from './dom';
import { state } from './state';
import { fetchTimezoneForCoordinates, getTimezoneOffset, startClocks } from './time';
import { distance } from './utils';

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

  loadGeoJson();

  state.timezoneMap.data.setStyle({
    fillColor: '#4f46e5',
    fillOpacity: 0.1,
    strokeWeight: 1,
    strokeColor: '#818cf8',
  });
  
  // --- CORRECTED: Use a more robust click handler ---
  state.timezoneMap.data.addListener('click', (event: google.maps.Data.MouseEvent) => {
    if (event.latLng) {
      const bestFeature = findSmallestFeatureAtLatLng(event.latLng);
      if (bestFeature) {
        const tzid = bestFeature.getProperty('tzid') as string;
        if (tzid) {
          state.selectedTimezone = { tzid, feature: bestFeature };
          state.temporaryTimezone = tzid;
          updateMapHighlights();
          document.dispatchEvent(new CustomEvent('temporarytimezonechanged', { detail: { tzid } }));
        }
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

function loadGeoJson() {
    if (!state.timezoneMap) return;
    
    console.log(`Loading GeoJSON from: ${TIMEZONE_GEOJSON_URL}`);
    
    state.timezoneMap.data.loadGeoJson(TIMEZONE_GEOJSON_URL, { idPropertyName: 'tzid' }, () => {
        state.geoJsonLoaded = true;
        console.log("GeoJSON loaded and layered onto map.");

        if (state.lastFetchedCoords.lat !== 0) {
            console.log("Location already known. Finding feature now.");
            findAndSetGpsFeature(new google.maps.LatLng(state.lastFetchedCoords.lat, state.lastFetchedCoords.lon));
            updateMapHighlights();
        }
    });
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

/**
 * Calculates the area of a feature's geometry.
 */
function getFeatureArea(feature: google.maps.Data.Feature): number {
    let area = 0;
    const geometry = feature.getGeometry();
    if (!geometry) return 0;

    const processPolygon = (geom: google.maps.Data.Polygon) => {
        const path = geom.getArray()[0].getArray();
        area += google.maps.geometry.spherical.computeArea(path);
    };

    const geometryType = geometry.getType();
    if (geometryType === 'Polygon') {
        processPolygon(geometry as google.maps.Data.Polygon);
    } else if (geometryType === 'MultiPolygon') {
        (geometry as google.maps.Data.MultiPolygon).getArray().forEach(processPolygon);
    }
    return area;
}

/**
 * Finds all features at a given LatLng and returns the one with the smallest area.
 */
function findSmallestFeatureAtLatLng(latLng: google.maps.LatLng): google.maps.Data.Feature | null {
    if (!state.timezoneMap) return null;

    const intersectingFeatures: google.maps.Data.Feature[] = [];
    state.timezoneMap.data.forEach((feature: google.maps.Data.Feature) => {
        if (isLocationInFeature(latLng, feature)) {
            intersectingFeatures.push(feature);
        }
    });

    if (intersectingFeatures.length === 0) {
        return null;
    }
    if (intersectingFeatures.length === 1) {
        return intersectingFeatures[0];
    }

    // Sort by area and return the smallest feature
    intersectingFeatures.sort((a, b) => getFeatureArea(a) - getFeatureArea(b));
    return intersectingFeatures[0];
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
        if (linearRings.length === 0) return false;
        
        const paths = linearRings.map(ring => ring.getArray());
        
        const polygon = new google.maps.Polygon({ paths: paths });
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
    const bestFeature = findSmallestFeatureAtLatLng(location);
    if (bestFeature) {
        state.gpsTimezone.feature = bestFeature;
    } else {
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