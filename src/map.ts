// src/map.ts

import * as dom from './dom';
import { state } from './state';
import { fetchTimezoneForCoordinates, startClocks, getTimezoneOffset, getFormattedTime } from './time';
import { darkModeStyles } from './map-styles';

let userTimeInterval: number | null = null;

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
      const tempTz = tzid ? tzid : `Etc/GMT${zone <= 0 ? '+' : '-'}${Math.abs(zone)}`;
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
    state.hoveredZone = event.feature.getProperty('zone') as number;
    updateMapHighlights();
    updateCard(dom.hoveredTimezoneDetailsEl, dom.hoveredTimezoneNameEl, dom.hoveredTimezoneOffsetEl, event.feature, 'offset');
  });
  
  state.timezoneMap.data.addListener('mouseout', () => {
    state.hoveredZone = null;
    updateMapHighlights();
    updateCard(dom.hoveredTimezoneDetailsEl, dom.hoveredTimezoneNameEl, dom.hoveredTimezoneOffsetEl, null, 'offset');
  });
  
  state.timezoneMap.data.addListener('click', (event: google.maps.Data.MouseEvent) => {
    const feature = event.feature;
    const tzid = feature.getProperty('tz_name1st') as string | null;
    const zone = feature.getProperty('zone') as number;
  
    if (state.selectedZone === zone) {
      state.selectedZone = null;
      state.temporaryTimezone = null;
      updateCard(dom.selectedTimezoneDetailsEl, dom.selectedTimezoneNameEl, dom.selectedTimezoneOffsetEl, null, 'offset');
    } else {
      state.selectedZone = zone;
      if (tzid) {
        state.temporaryTimezone = tzid;
      } else {
        const sign = zone <= 0 ? '+' : '-';
        const offset = Math.abs(zone);
        state.temporaryTimezone = `Etc/GMT${sign}${offset}`;
      }
      updateCard(dom.selectedTimezoneDetailsEl, dom.selectedTimezoneNameEl, dom.selectedTimezoneOffsetEl, feature, 'offset');
    }
  
    updateMapHighlights();
    document.dispatchEvent(new CustomEvent('temporarytimezonechanged'));
  });
}

function updateMapHighlights() {
    state.timezoneMap!.data.setStyle(feature => {
        const featureZone = feature.getProperty('zone') as number;
        let zIndex = 1;
        let fillColor = 'transparent';
        let strokeColor = 'rgba(255, 255, 255, 0.2)'; 
        let strokeWeight = 1;

        if (state.gpsZone !== null && state.gpsZone === featureZone) {
            fillColor = 'rgba(63, 128, 255, 0.7)';
            strokeColor = 'transparent';
            strokeWeight = 2;
            zIndex = 1;
        }
        
        if (state.hoveredZone !== null && state.hoveredZone === featureZone) {
            fillColor = 'rgba(255, 255, 255, 0.5)';
            strokeColor = 'transparent';
            strokeWeight = 2;
            zIndex = 2;
        }

        if (state.selectedZone !== null && state.selectedZone === featureZone) {
            fillColor = 'rgba(255, 215, 0, 0.7)';
            strokeColor = 'transparent';
            strokeWeight = 2;
            zIndex = 3;
        }

        return ({
            fillColor,
            strokeColor,
            strokeWeight,
            zIndex,
        });
    });
}

async function loadTimezoneGeoJson() {
  if (state.geoJsonLoaded) return;
  try {
    const response = await fetch('timezones.geojson');
    state.geoJsonData = await response.json();
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

    if (state.timezoneMap?.data) {
        let foundMatch = false;
        // UPDATED: Convert map data to an array first, then loop over the array
        const features: google.maps.Data.Feature[] = [];
        state.timezoneMap.data.forEach(feature => features.push(feature));

        for (const feature of features) {
            if (foundMatch) break;
            const featureTzid = feature.getProperty('tz_name1st') as string | null;
            if (featureTzid && typeof featureTzid === 'string') {
                const offsetString = getTimezoneOffset(featureTzid, tzid);
                if (offsetString === 'Same time') {
                    state.gpsZone = feature.getProperty('zone') as number;
                    foundMatch = true;
                }
            }
        }
    }
    
    updateMapHighlights();

    document.dispatchEvent(new CustomEvent('gpstimezonefound', { detail: { tzid } }));
    startClocks();
  } else if (!state.localTimezone && tzid) {
    state.localTimezone = tzid;
    state.gpsTzid = tzid;
    startClocks();
  }

  const initialTimezonesStr = sessionStorage.getItem('initialTimezones');
  if (initialTimezonesStr && tzid && state.timezoneMap?.data) {
      const initialTimezones = JSON.parse(initialTimezonesStr);
      const targetTz = initialTimezones.find((tz: string) => tz !== tzid);

      if (targetTz) {
          let targetFeature: google.maps.Data.Feature | null = null;
          // UPDATED: Convert map data to an array first, then loop over the array
          const features: google.maps.Data.Feature[] = [];
          state.timezoneMap.data.forEach(feature => features.push(feature));

          for (const feature of features) {
              if (feature.getProperty('tz_name1st') === targetTz) {
                  targetFeature = feature;
                  break;
              }
          }

          if (targetFeature) {
              const zone = targetFeature.getProperty('zone') as number;
              state.selectedZone = zone;
              state.temporaryTimezone = targetTz;
              updateCard(dom.selectedTimezoneDetailsEl, dom.selectedTimezoneNameEl, dom.selectedTimezoneOffsetEl, targetFeature, 'offset');
              updateMapHighlights();
              document.dispatchEvent(new CustomEvent('temporarytimezonechanged'));
          }
      }
      sessionStorage.removeItem('initialTimezones');
  }
}