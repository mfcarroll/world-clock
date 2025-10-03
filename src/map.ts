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
  valueType: 'offset' | 'time'
) {
  if (feature) {
    const tzid = feature.getProperty('tz_name1st') as string | null;
    const zone = feature.getProperty('zone') as number;
    const referenceTz = state.gpsTzid || Intl.DateTimeFormat().resolvedOptions().timeZone;

    let displayName = tzid;
    if (!tzid) {
      displayName = `UTC${zone >= 0 ? '+' : ''}${zone}`;
    }
    
    const region = displayName?.split('/')[0].replace(/_/g, ' ') || 'Unknown';
    const city = displayName?.split('/')[1]?.replace(/_/g, ' ') || '';
    nameEl.textContent = city || region;

    if (valueType === 'offset') {
      const tempTz = getValidTimezoneName(tzid, zone);
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

function selectFeature(feature: google.maps.Data.Feature) {
    const tzid = feature.getProperty('tz_name1st') as string | null;
    const currentOffset = feature.getProperty('current_offset') as number;
    const zone = feature.getProperty('zone') as number;
    let newTzid = getValidTimezoneName(tzid, zone);
  
    // Prioritize user's GPS timezone: if the selected map area has the same offset
    // as the user's GPS zone, use the GPS timezone name for the selection.
    if (state.gpsTzid && getUtcOffset(state.gpsTzid) === currentOffset) {
      newTzid = state.gpsTzid;
    }

    if (state.selectedZone === currentOffset && state.temporaryTimezone === newTzid) {
      // Deselecting the current timezone
      state.selectedZone = null;
      state.temporaryTimezone = null;
      updateCard(dom.selectedTimezoneDetailsEl, dom.selectedTimezoneNameEl, dom.selectedTimezoneOffsetEl, null, 'offset');
    } else {
      // Selecting a new timezone
      const existingTzWithOffset = state.addedTimezones.find(
          (tz) => getUtcOffset(tz) === currentOffset
      );

      // If a clock with the same time already exists, replace it immediately.
      if (existingTzWithOffset && existingTzWithOffset !== newTzid) {
          document.dispatchEvent(new CustomEvent('replacetimezone', { detail: { tzid: newTzid } }));
      }

      state.selectedZone = currentOffset;
      state.temporaryTimezone = newTzid;
      updateCard(dom.selectedTimezoneDetailsEl, dom.selectedTimezoneNameEl, dom.selectedTimezoneOffsetEl, feature, 'offset');
    }
  
    // On touch devices, ensure hover is cleared
    if (isTouchDevice) {
        state.hoveredZone = null;
    }

    updateMapHighlights();
    document.dispatchEvent(new CustomEvent('temporarytimezonechanged'));
}

export function selectTimezone(tzid: string) {
    if (!state.geoJsonLoaded || !state.timezoneMap) return;

    const offset = getUtcOffset(tzid);
    let found = false;

    // Using 'any' as a workaround for a complex typing issue where TypeScript
    // incorrectly infers the feature type as 'never'.
    state.timezoneMap.data.forEach((feature: any) => {
        if (!found && feature.getProperty('current_offset') === offset) {
            selectFeature(feature as google.maps.Data.Feature);
            found = true;
        }
    });
}


// --- END HELPER FUNCTIONS ---


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

  state.locationMap = new Map(document.getElementById('location-map') as HTMLElement, mapOptions);
  state.locationMarker = new Marker({ map: state.locationMap, position: { lat: 0, lng: 0 } });

  state.timezoneMap = new Map(document.getElementById('timezone-map') as HTMLElement, mapOptions);
  state.timezoneMapMarker = new Marker({ map: state.timezoneMap, position: { lat: 0, lng: 0 } });

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
    
    // Always set the hover state for visual highlighting
    const tzidFromFeature = feature.getProperty('tz_name1st') as string | null;
    state.hoveredZone = currentOffset;
    state.hoveredTimezoneName = tzidFromFeature;
    updateMapHighlights();

    // Now, separately decide whether to show the informational hover card
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
    const wasSelected = state.selectedZone === event.feature.getProperty('current_offset');

    selectFeature(event.feature);
    
    if (wasSelected) {
      state.hoveredZone = event.feature.getProperty('current_offset') as number;
      state.hoveredTimezoneName = event.feature.getProperty('tz_name1st') as string;
      updateCard(dom.hoveredTimezoneDetailsEl, dom.hoveredTimezoneNameEl, dom.hoveredTimezoneOffsetEl, event.feature, 'offset');
    } else {
      state.hoveredZone = null;
      state.hoveredTimezoneName = null;
      updateCard(dom.hoveredTimezoneDetailsEl, dom.hoveredTimezoneNameEl, dom.hoveredTimezoneOffsetEl, null, 'offset');
    }
    updateMapHighlights();
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

        if (state.gpsZone === featureOffset) {
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
    state.locationMarker.setPosition(pos);
  }
}

function updateTimezoneMapMarker(lat: number, lon: number) {
  if (state.timezoneMap && state.timezoneMapMarker) {
    const pos = { lat, lng: lon };
    state.timezoneMap.setCenter(pos);
    state.timezoneMapMarker.setPosition(pos);
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