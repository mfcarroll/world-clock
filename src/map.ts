// src/map.ts

import * as dom from './dom';
import { state } from './state';
import { fetchTimezoneForCoordinates, startClocks, getTimezoneOffset, getFormattedTime, getUtcOffset, getValidTimezoneName, getDisplayTimezoneName } from './time';
import { darkModeStyles } from './map-styles';
import { point as turfPoint, booleanPointInPolygon } from '@turf/turf';

let userTimeInterval: number | null = null;
const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

/**
 * Draws the track from track.json as a thin blue line.
 */
async function drawTrackLine() {
    if (!state.timezoneMap) return;

    try {
        const response = await fetch('/track.json');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();

        // The JSON has a nested array structure, so we grab the first element.
        const coordinatePairs = data.coordinates[0];

        const pathCoordinates = coordinatePairs.map((coords: number[]) => ({ lat: coords[1], lng: coords[0] }));

        new google.maps.Polyline({
            path: pathCoordinates,
            geodesic: true,
            strokeColor: '#4285F4',
            strokeOpacity: 0.8,
            strokeWeight: 2, // Thinner line
            map: state.timezoneMap,
        });

    } catch (error) {
        console.error("Could not load or draw the track line:", error);
    }
}

/**
 * Draws the route from route.json as a thin dotted blue line.
 */
async function drawDottedRouteLine() {
    if (!state.timezoneMap) return;

    try {
        const response = await fetch('/route.json');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        
        const pathCoordinates = data.coordinates.map((coords: number[]) => ({ lat: coords[1], lng: coords[0] }));

        const dottedLineSymbol = {
            path: 'M 0,-1 0,1',
            strokeOpacity: 1,
            scale: 2,
        };

        new google.maps.Polyline({
            path: pathCoordinates,
            geodesic: true,
            strokeColor: '#4285F4',
            strokeOpacity: 0, // The line itself is invisible, only the icons are shown
            strokeWeight: 2,
            icons: [{
                icon: dottedLineSymbol,
                offset: '0',
                repeat: '10px'
            }],
            map: state.timezoneMap,
        });

    } catch (error) {
        console.error("Could not load or draw the dotted route line:", error);
    }
}


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
    
    const finalTz = forceTzid || getValidTimezoneName(tzid, zone);
    nameEl.textContent = getDisplayTimezoneName(finalTz);

    if (valueType === 'offset') {
      const referenceTz = state.gpsTzid || Intl.DateTimeFormat().resolvedOptions().timeZone;
      valueEl.textContent = getTimezoneOffset(finalTz, referenceTz);
    }

    cardEl.classList.remove('hidden');
  } else {
    cardEl.classList.add('hidden');
    nameEl.textContent = '';
    valueEl.textContent = '';
  }
}

function updateUserTimezoneDetails(tzid: string) {
  const city = getDisplayTimezoneName(tzid);
  dom.userTimezoneNameEl.textContent = city;
  dom.userTimezoneDetailsEl.classList.remove('hidden');

  if (userTimeInterval) clearInterval(userTimeInterval);

  const updateTime = () => {
    dom.userTimezoneTimeEl.textContent = getFormattedTime(tzid, {
      hour: 'numeric',
      minute: '2-digit',
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
        return;
    }

    if (state.gpsTzid && getUtcOffset(state.gpsTzid) === currentOffset) {
        newTzid = state.gpsTzid;
    }

    const isGpsTz = newTzid === state.gpsTzid;
    const isDeselecting = state.temporaryTimezone === newTzid;

    const nextGpsSelectedState = !isDeselecting && isGpsTz;
    if (state.gpsTimezoneSelected !== nextGpsSelectedState) {
        state.gpsTimezoneSelected = nextGpsSelectedState;
        document.dispatchEvent(new CustomEvent('gpstimezoneSelectionChanged', { detail: { selected: state.gpsTimezoneSelected } }));
    }

    if (isDeselecting) {
        state.selectedZone = null;
        state.temporaryTimezone = null;
    } else {
        state.selectedZone = currentOffset;
        state.temporaryTimezone = newTzid;
    }

    if (isDeselecting || state.gpsTimezoneSelected) {
        updateCard(dom.selectedTimezoneDetailsEl, dom.selectedTimezoneNameEl, dom.selectedTimezoneOffsetEl, null, 'offset');
    } else {
        updateCard(dom.selectedTimezoneDetailsEl, dom.selectedTimezoneNameEl, dom.selectedTimezoneOffsetEl, feature, 'offset', newTzid);
    }

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
  const { Map, Polyline } = await google.maps.importLibrary("maps") as google.maps.MapsLibrary;
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
  
  const blueDotIcon: google.maps.Symbol = {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 5,
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
  drawTrackLine();
  drawDottedRouteLine();
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
    
    if (validHoveredTzid === state.gpsTzid || validHoveredTzid === state.temporaryTimezone) {
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
    if (event.latLng) {
      console.log(`Map clicked at: Lat: ${event.latLng.lat()}, Lng: ${event.latLng.lng()}`);
    }

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

  const formatCoordinate = (value: number, padding: number): string => {
    const [integer, fractional] = value.toFixed(4).split('.');
    return `${integer.padStart(padding, '\u00A0')}.${fractional}°`;
  };

  dom.latitudeEl.textContent = formatCoordinate(latitude, 4);
  dom.longitudeEl.textContent = formatCoordinate(longitude, 4);
  
  dom.locationLoader.classList.add('hidden');
  dom.locationContent.classList.remove('hidden');
  dom.locationContent.classList.add('grid');

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