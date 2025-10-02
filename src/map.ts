// src/map.ts

import { state } from './state';
import { fetchTimezoneForCoordinates, startClocks } from './time';
import { debounce } from './utils';

let geocoder: google.maps.Geocoder;

export async function initMaps() {
  const { Map } = await google.maps.importLibrary("maps") as google.maps.MapsLibrary;
  const { AdvancedMarkerElement } = await google.maps.importLibrary("marker") as google.maps.MarkerLibrary;
  const { ColorScheme } = await google.maps.importLibrary("core");

  geocoder = new google.maps.Geocoder();

  // Initialize Location Map - REMOVED the 'styles' property
  state.locationMap = new Map(document.getElementById('location-map') as HTMLElement, {
    center: { lat: 0, lng: 0 },
    zoom: 2,
    mapId: 'c75a3fdf244efe75fccc5434',
    colorScheme: ColorScheme.DARK,
  });
  state.locationMarker = new AdvancedMarkerElement({ map: state.locationMap, position: { lat: 0, lng: 0 } });

  // Initialize Timezone Map - REMOVED the 'styles' property
  state.timezoneMap = new Map(document.getElementById('timezone-map') as HTMLElement, {
    center: { lat: 0, lng: 0 },
    zoom: 2,
    mapId: 'c75a3fdf244efe75fccc5434',
    colorScheme: ColorScheme.DARK,
  });
  state.timezoneMapMarker = new AdvancedMarkerElement({ map: state.timezoneMap, position: { lat: 0, lng: 0 } });

  setupTimezoneMapListeners();
}

async function setupTimezoneMapListeners() {
  if (!state.timezoneMap) return;
  await loadTimezoneGeoJson();

  state.timezoneMap.data.addGeoJson(state.geoJsonData);
  state.timezoneMap.data.setStyle({
    fillColor: 'rgba(135, 206, 250, 0.3)',
    strokeWeight: 0.5,
    strokeColor: '#81d4fa'
  });

  state.timezoneMap.data.addListener('mouseover', (event: google.maps.Data.MouseEvent) => {
    state.timezoneMap!.data.revertStyle();
    state.timezoneMap!.data.overrideStyle(event.feature, { strokeWeight: 2, strokeColor: '#ffffff' });
    state.temporaryTimezone = event.feature.getProperty('tzid') as string;
    document.dispatchEvent(new Event('temporarytimezonechanged'));
  });

  state.timezoneMap.data.addListener('mouseout', (event: google.maps.Data.MouseEvent) => {
    state.timezoneMap!.data.revertStyle();
    state.temporaryTimezone = null;
    document.dispatchEvent(new Event('temporarytimezonechanged'));
  });

  state.timezoneMap.data.addListener('click', (event: google.maps.Data.MouseEvent) => {
    const tzid = event.feature.getProperty('tzid');
    if (tzid) {
      document.dispatchEvent(new CustomEvent('gpstimezonefound', { detail: { tzid } }));
    }
  });

  const debouncedGeocode = debounce((latLng: google.maps.LatLng) => {
    geocodeLatLng(latLng);
  }, 1000);

  state.timezoneMap.addListener('click', (mapsMouseEvent: google.maps.MapMouseEvent) => {
    if (mapsMouseEvent.latLng) {
      updateTimezoneMapMarker(mapsMouseEvent.latLng.lat(), mapsMouseEvent.latLng.lng());
      debouncedGeocode(mapsMouseEvent.latLng);
    }
  });
}

function geocodeLatLng(latlng: google.maps.LatLng) {
  geocoder.geocode({ 'location': latlng }, (results, status) => {
    if (status === 'OK' && results && results[0]) {
      console.log(results[0].formatted_address);
    } else {
      console.log('Geocoder failed due to: ' + status);
    }
  });
}

async function loadTimezoneGeoJson() {
  if (state.geoJsonLoaded) return;
  try {
    const response = await fetch('/timezones.geojson');
    state.geoJsonData = await response.json();
    state.geoJsonLoaded = true;
    console.log('Timezone GeoJSON has finished loading and is ready.');

    // MOVED the interval here to prevent the race condition
    setInterval(() => {
      if (state.timezoneMap) {
        state.timezoneMap.data.revertStyle();
        if (state.localTimezone) {
          showTimezoneOnMap(state.localTimezone);
        }
      }
    }, 5000);

  } catch (error) {
    console.error('Could not load timezone GeoJSON:', error);
  }
}

function updateLocationMap(lat: number, lon: number) {
  if (state.locationMap && state.locationMarker) {
    const pos = { lat, lng: lon };
    state.locationMap.setCenter(pos);
    state.locationMap.setZoom(12);
    state.locationMarker.position = pos;
  }
}

function updateTimezoneMapMarker(lat: number, lon: number) {
  if (state.timezoneMap && state.timezoneMapMarker) {
    const pos = { lat, lng: lon };
    state.timezoneMapMarker.position = pos;
  }
}

export function onLocationError(error: GeolocationPositionError) {
  console.error(`Geolocation error: ${error.message}`);
  if (!state.localTimezone) {
    state.localTimezone = 'Etc/UTC'; 
    startClocks();
  }
}

export async function onLocationSuccess(pos: GeolocationPosition) {
  const { latitude, longitude } = pos.coords;
  console.log(`Location changed, fetching new timezone name...`);
  updateLocationMap(latitude, longitude);

  const tzid = await fetchTimezoneForCoordinates(latitude, longitude);

  if (tzid && tzid !== state.localTimezone) {
    console.log(`Timezone updated to ${tzid}`);
    state.localTimezone = tzid;
    document.dispatchEvent(new CustomEvent('gpstimezonefound', { detail: { tzid } }));
    startClocks();
  } else if (!state.localTimezone && tzid) {
    state.localTimezone = tzid;
    startClocks();
  }
}

export function showTimezoneOnMap(timezone: string) {
  if (!state.geoJsonLoaded || !state.timezoneMap) {
    return; // Don't try to run if data isn't ready
  }

  // Get the current UTC offset for the given timezone.
  // This is a simplified calculation and may not be perfectly accurate for all historical dates.
  const date = new Date();
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
  const targetOffset = (tzDate.getTime() - utcDate.getTime()) / 3600000;

  let featureFound = false;
  // The geojson uses a numeric 'zone' property for the UTC offset.
  // We iterate through the features to find one with a matching offset.
  state.timezoneMap.data.forEach((feature: google.maps.Data.Feature) => {
    if (feature.getProperty('zone') === targetOffset) {
      state.timezoneMap!.data.overrideStyle(feature, { strokeWeight: 2, strokeColor: '#ffffff' });
      featureFound = true;
    }
  });

  if (!featureFound) {
    console.warn(`Could not find feature for timezone: ${timezone} (offset ${targetOffset})`);
  }
}
