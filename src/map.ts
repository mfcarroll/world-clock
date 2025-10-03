// src/map.ts

import * as dom from './dom';
import { state } from './state';
import { fetchTimezoneForCoordinates, startClocks, getTimezoneOffset, getFormattedTime, getUtcOffset, getValidTimezoneName } from './time';
import { darkModeStyles } from './map-styles';

let userTimeInterval: number | null = null;
const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

// --- HELPER FUNCTIONS ---

function updateCard(
  cardEl: HTMLElement,
  nameEl: HTMLElement,
  valueEl: HTMLElement,
  feature: google.maps.Data.Feature | null,
  valueType: 'offset' | 'time',
  forceTzid?: string
) {
  if (feature || forceTzid) {
    let tzid, zone;
    if (feature) {
      tzid = feature.getProperty('tz_name1st') as string | null;
      zone = feature.getProperty('zone') as number;
    } else {
      tzid = forceTzid!;
      zone = getUtcOffset(tzid);
    }
    
    const referenceTz = state.gpsTzid || Intl.DateTimeFormat().resolvedOptions().timeZone;
    let displayName = forceTzid || tzid;

    if (!displayName) {
      displayName = `UTC${zone >= 0 ? '+' : ''}${zone}`;
    }
    
    const region = displayName?.split('/')[0].replace(/_/g, ' ') || 'Unknown';
    const city = displayName?.split('/')[1]?.replace(/_/g, ' ') || '';
    nameEl.textContent = city || region;

    if (valueType === 'offset') {
      const tempTz = forceTzid || getValidTimezoneName(tzid, zone);
      valueEl.textContent = getTimezoneOffset(tempTz, referenceTz);
    }

    cardEl.classList.remove('hidden');
  } else {
    cardEl.classList.add('hidden');
    nameEl.textContent = '';
    valueEl.textContent = '';
  }
}

function updateUserTimezoneDetails(tzid: string) {
  const city = tzid.split('/').pop()?.replace(/_/g, ' ') || 'Unknown';
  dom.userTimezoneNameEl.textContent = city;
  dom.userTimezoneDetailsEl.classList.remove('hidden');

  if (userTimeInterval) clearInterval(userTimeInterval);

  const updateTime = () => {
    dom.userTimezoneTimeEl.textContent = getFormattedTime(tzid, {
      hour: 'numeric',
      minute: 'numeric',
      hour12: true,
    });
  };
  
  updateTime();
  userTimeInterval = setInterval(updateTime, 1000);
}

function selectFeature(feature: google.maps.Data.Feature | null, tzidToSelect?: string) {
    let tzid, currentOffset, zone, newTzid;

    if (tzidToSelect) {
        currentOffset = getUtcOffset(tzidToSelect);
        newTzid = tzidToSelect;
    } else if (feature) {
        tzid = feature.getProperty('tz_name1st') as string | null;
        currentOffset = feature.getProperty('current_offset') as number;
        zone = feature.getProperty('zone') as number;
        newTzid = getValidTimezoneName(tzid, zone);
    } else {
        return; // Nothing to select
    }

    // Prioritize user's GPS timezone
    if (state.gpsTzid && getUtcOffset(state.gpsTzid) === currentOffset) {
        newTzid = state.gpsTzid;
    }

    const isGpsTz = newTzid === state.gpsTzid;
    const isDeselecting = state.temporaryTimezone === newTzid;

    // Update the GPS selection state and notify the UI
    const nextGpsSelectedState = !isDeselecting && isGpsTz;
    if (state.gpsTimezoneSelected !== nextGpsSelectedState) {
        state.gpsTimezoneSelected = nextGpsSelectedState;
        document.dispatchEvent(new CustomEvent('gpstimezoneSelectionChanged', { detail: { selected: state.gpsTimezoneSelected } }));
    }

    // Update the main selection state
    if (isDeselecting) {
        state.selectedZone = null;
        state.temporaryTimezone = null;
    } else {
        state.selectedZone = currentOffset;
        state.temporaryTimezone = newTzid;
    }

    // Show the yellow "Selected" card only if the selected timezone is NOT the user's GPS zone.
    if (isDeselecting || state.gpsTimezoneSelected) {
        updateCard(dom.selectedTimezoneDetailsEl, dom.selectedTimezoneNameEl, dom.selectedTimezoneOffsetEl, null, 'offset');
    } else {
        updateCard(dom.selectedTimezoneDetailsEl, dom.selectedTimezoneNameEl, dom.selectedTimezoneOffsetEl, feature, 'offset', newTzid);
    }

    // Handle replacing timezones in the clock list
    const existingTzWithOffset = state.addedTimezones.find((tz) => getUtcOffset(tz) === currentOffset);
    if (!isDeselecting && existingTzWithOffset && existingTzWithOffset !== newTzid) {
        document.dispatchEvent(new CustomEvent('replacetimezone', { detail: { tzid: newTzid } }));
    }

    if (isTouchDevice) state.hoveredZone = null;
    updateMapHighlights();
    document.dispatchEvent(new CustomEvent('temporarytimezonechanged'));
}


export function selectTimezone(tzid: string) {
    if (!state.geoJsonLoaded || !state.timezoneMap) return;

    const offset = getUtcOffset(tzid);
    let feature: google.maps.Data.Feature | null = null;
    
    state.timezoneMap.data.forEach((f: any) => {
        if (!feature && f.getProperty('current_offset') === offset) {
            feature = f as google.maps.Data.Feature;
        }
    });

    selectFeature(feature, tzid);
}

export async function initMaps() {
  const { Map } = await google.maps.importLibrary("maps") as google.maps.MapsLibrary;
  const { Marker } = await google.maps.importLibrary("marker") as google.maps.MarkerLibrary;

  const mapOptions: google.maps.MapOptions = {
    center: { lat: 0, lng: 0 },
    zoom: 2,
    styles: darkModeStyles,
    disableDefaultUI: true,
    zoomControl: false,
  };

  const locationMapEl = document.getElementById('location-map') as HTMLElement;
  state.locationMap = new Map(locationMapEl, mapOptions);
  
  // Define the custom marker icon
  const blueDotIcon: google.maps.Symbol = {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 5, // Reduced from 8 to ~2/3 size
      fillColor: '#4285F4',
      fillOpacity: 1,
      strokeColor: '#FFFFFF',
      strokeWeight: 2,
  };

  state.locationMarker = new Marker({ map: state.locationMap, position: { lat: 0, lng: 0 }, icon: blueDotIcon });

  const timezoneMapEl = document.getElementById('timezone-map') as HTMLElement;
  state.timezoneMap = new Map(timezoneMapEl, mapOptions);
  state.timezoneMapMarker = new Marker({ map: state.timezoneMap, position: { lat: 0, lng: 0 }, icon: blueDotIcon });

  setupTimezoneMapListeners();
}

async function setupTimezoneMapListeners() {
  if (!state.timezoneMap) return;
  await loadTimezoneGeoJson();

  state.timezoneMap.data.addGeoJson(state.geoJsonData);
  
  state.timezoneMap.data.addListener('mouseover', (event: google.maps.Data.MouseEvent) => {
    if (isTouchDevice) return;
    
    const feature = event.feature;
    const currentOffset = feature.getProperty('current_offset') as number;
    
    const tzidFromFeature = feature.getProperty('tz_name1st') as string | null;
    state.hoveredZone = currentOffset;
    state.hoveredTimezoneName = tzidFromFeature;
    updateMapHighlights();

    const zoneFromFeature = feature.getProperty('zone') as number;
    const validHoveredTzid = getValidTimezoneName(tzidFromFeature, zoneFromFeature);
    
    if (currentOffset === state.gpsZone || (state.selectedZone === currentOffset && state.temporaryTimezone === validHoveredTzid)) {
      updateCard(dom.hoveredTimezoneDetailsEl, dom.hoveredTimezoneNameEl, dom.hoveredTimezoneOffsetEl, null, 'offset');
    } else {
      updateCard(dom.hoveredTimezoneDetailsEl, dom.hoveredTimezoneNameEl, dom.hoveredTimezoneOffsetEl, feature, 'offset');
    }
  });
  
  document.getElementById('timezone-map')!.addEventListener('mouseleave', () => {
    if (isTouchDevice) return;
    state.hoveredZone = null;
    state.hoveredTimezoneName = null;
    updateMapHighlights();
    updateCard(dom.hoveredTimezoneDetailsEl, dom.hoveredTimezoneNameEl, dom.hoveredTimezoneOffsetEl, null, 'offset');
  });
  
  state.timezoneMap.data.addListener('click', (event: google.maps.Data.MouseEvent) => {
    // Fix for sticky hover card: clear it before processing the click.
    updateCard(dom.hoveredTimezoneDetailsEl, dom.hoveredTimezoneNameEl, dom.hoveredTimezoneOffsetEl, null, 'offset');
    selectFeature(event.feature);
  });
}

function updateMapHighlights() {
    state.timezoneMap!.data.setStyle(feature => {
        const featureOffset = feature.getProperty('current_offset') as number;
        const featureTzid = feature.getProperty('tz_name1st') as string;

        const styles = {
            default: { fillColor: 'transparent', strokeColor: 'rgba(255, 255, 255, 0.2)', strokeWeight: 1, zIndex: 1 },
            gps: { fillColor: 'rgba(63, 128, 255, 0.7)', strokeColor: 'transparent', strokeWeight: 1, zIndex: 1 },
            hover: { fillColor: 'rgba(255, 255, 255, 0.5)', strokeColor: 'transparent', strokeWeight: 1, zIndex: 2 },
            selected: { fillColor: 'rgba(255, 215, 0, 0.7)', strokeColor: 'transparent', strokeWeight: 1, zIndex: 3 },
        };

        let style = { ...styles.default };
        const isDirectlyHovered = state.hoveredTimezoneName !== null && state.hoveredTimezoneName === featureTzid;

        // Apply correct base color, overriding GPS blue with selected yellow if needed
        if (state.gpsTimezoneSelected && state.gpsZone === featureOffset) {
            style = { ...styles.selected };
        } else if (state.gpsZone === featureOffset) {
            style = { ...styles.gps };
        } else if (state.selectedZone === featureOffset) {
            style = { ...styles.selected };
        } else if (state.hoveredZone === featureOffset) {
            style = { ...styles.hover };
        }

        if (isDirectlyHovered) {
            style.strokeColor = 'rgba(255, 255, 255, 0.4)';
            style.strokeWeight = 1;
            style.zIndex = 4;
        }

        return style;
    });
}

async function loadTimezoneGeoJson() {
  if (state.geoJsonLoaded) return;
  try {
    const response = await fetch('timezones.geojson');
    const geoJson = await response.json();

    geoJson.features.forEach((feature: any) => {
        const tzid = feature.properties.tz_name1st;
        const zone = feature.properties.zone;
        const validTimezone = getValidTimezoneName(tzid, zone);
        feature.properties.current_offset = getUtcOffset(validTimezone);
    });

    state.geoJsonData = geoJson;
    state.geoJsonLoaded = true;
    console.log('Timezone GeoJSON has finished loading and is ready.');

  } catch (error) {
    console.error('Could not load timezone GeoJSON:', error);
  }
}

function updateLocationMap(lat: number, lon: number) {
  if (state.locationMap && state.locationMarker) {
    const pos = { lat, lng: lon };
    state.locationMap.setCenter(pos);
    state.locationMap.setZoom(12);
    (state.locationMarker as google.maps.Marker).setPosition(pos);
  }
}

function updateTimezoneMapMarker(lat: number, lon: number) {
  if (state.timezoneMap && state.timezoneMapMarker) {
    const pos = { lat, lng: lon };
    state.timezoneMap.setCenter(pos);
    (state.timezoneMapMarker as google.maps.Marker).setPosition(pos);
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

  dom.latitudeEl.textContent = `${latitude.toFixed(4)}°`;
  dom.longitudeEl.textContent = `${longitude.toFixed(4)}°`;
  dom.locationLoader.classList.add('hidden');
  dom.locationContent.classList.remove('hidden');

  updateLocationMap(latitude, longitude);
  updateTimezoneMapMarker(latitude, longitude);

  const tzid = await fetchTimezoneForCoordinates(latitude, longitude);

  if (tzid && tzid !== state.localTimezone) {
    console.log(`Timezone updated to ${tzid}`);
    state.localTimezone = tzid;
    state.gpsTzid = tzid;
    
    updateUserTimezoneDetails(tzid);

    state.gpsZone = getUtcOffset(tzid);
    
    updateMapHighlights();

    document.dispatchEvent(new CustomEvent('gpstimezonefound', { detail: { tzid } }));
    startClocks();
  } else if (!state.localTimezone && tzid) {
    state.localTimezone = tzid;
    state.gpsTzid = tzid;
    startClocks();
  }
}