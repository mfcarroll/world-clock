// src/time.ts

import * as dom from './dom';
import { state } from './state';
import { point as turfPoint, booleanPointInPolygon } from '@turf/turf';

const GOOGLE_MAPS_API_KEY = "AIzaSyAmfnxthlRCjJNKNQTvp6RX-0pTQPL2cB0";

/**
 * [FALLBACK FUNCTION]
 * Finds a timezone for a given coordinate by checking against the local GeoJSON data.
 * @param lat The latitude.
 * @param lon The longitude.
 * @returns The IANA timezone name if a match is found, otherwise null.
 */
function findTimezoneFromGeoJSON(lat: number, lon: number): string | null {
    if (!state.geoJsonData) {
        console.error("GeoJSON data not loaded, cannot perform fallback search.");
        return null;
    }

    const searchPoint = turfPoint([lon, lat]);

    for (const feature of state.geoJsonData.features) {
        if (booleanPointInPolygon(searchPoint, feature.geometry)) {
            const tzid = feature.properties.tz_name1st;
            const zone = feature.properties.zone;
            console.log(`Fallback successful: Found timezone "${tzid}" in local GeoJSON.`);
            return getValidTimezoneName(tzid, zone);
        }
    }

    console.log("Fallback failed: No matching timezone found in local GeoJSON for the given coordinates.");
    return null;
}


/**
 * Parses the hour offset from a custom "Etc/GMT" timezone string.
 * @param timeZone The timezone string to parse.
 * @returns The offset in hours, or null if it's not a custom GMT string.
 */
function getGmtOffset(timeZone: string): number | null {
    const gmtMatch = timeZone.match(/^Etc\/GMT([+-])(\d+(?:\.\d+)?)$/);
    if (gmtMatch) {
        const sign = gmtMatch[1] === '+' ? -1 : 1;
        return sign * parseFloat(gmtMatch[2]);
    }
    return null;
}


/**
 * Returns a formatted time string for a given timezone.
 * @param tz The IANA timezone name.
 * @param options Intl.DateTimeFormatOptions for formatting.
 * @returns The formatted time string.
 */
export function getFormattedTime(tz: string, options: Intl.DateTimeFormatOptions = {}): string {
  const correctedTime = new Date(new Date().getTime() + state.timeOffset);
  const offset = getGmtOffset(tz);

  if (offset !== null) {
    const targetTime = new Date(correctedTime.getTime() + offset * 3600000);
    return targetTime.toLocaleTimeString('en-US', { timeZone: 'UTC', ...options });
  }

  try {
    return correctedTime.toLocaleTimeString('en-US', { timeZone: tz, ...options });
  } catch (e) {
    return "Invalid";
  }
}

export async function syncClock() {
  console.log('Performing initial clock synchronization with Google Cloud Function...');
  try {
    const GCF_URL = 'https://get-utc-time-100547663673.us-west1.run.app/';
    
    const response = await fetch(GCF_URL);
    if (!response.ok) throw new Error('Network response was not ok.');
    
    const data = await response.json();
    const serverUtcTime = new Date(data.dateTime).getTime();
    const localDeviceTime = new Date().getTime();
    
    state.timeOffset = serverUtcTime - localDeviceTime;
    
    console.log(`Clock synchronized. Device offset is ${state.timeOffset}ms.`);
  } catch (error) {
    console.error('Could not synchronize clock with Google Cloud Function:', error);
    state.timeOffset = 0;
  }
}

export function updateAllClocks() {
  const correctedTime = new Date(new Date().getTime() + state.timeOffset);
  const localTimezone = state.localTimezone;
  if (localTimezone) {
    try {
      dom.localTimeEl.textContent = correctedTime.toLocaleTimeString('en-US', { 
        timeZone: localTimezone,
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit'
      });
      dom.localDateEl.textContent = correctedTime.toLocaleDateString('en-US', { timeZone: localTimezone, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      dom.localTimezoneEl.textContent = localTimezone.replace(/_/g, ' ');
    } catch (e) {
      dom.localTimeEl.textContent = "Error";
    }
  }

  const timezonesToRender = [...state.addedTimezones];
  if (state.temporaryTimezone && !timezonesToRender.includes(state.temporaryTimezone)) {
      timezonesToRender.push(state.temporaryTimezone);
  }

  timezonesToRender.forEach((tz: string) => {
    const el = document.getElementById(`clock-${tz.replace(/\//g, '-')}`);
    if (el) {
        const timeString = getFormattedTime(tz, { hour: 'numeric', minute: '2-digit' });
        
        let dateString;
        const offset = getGmtOffset(tz);
        if (offset !== null) {
            const targetTime = new Date(correctedTime.getTime() + offset * 3600000);
            dateString = targetTime.toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short' });
        } else {
            dateString = correctedTime.toLocaleDateString('en-US', { timeZone: tz, weekday: 'short' });
        }

        const timeDiff = getTimezoneOffset(tz, localTimezone);

        el.querySelector('.time')!.textContent = timeString;
        el.querySelector('.date-diff')!.textContent = `${dateString}, ${timeDiff}`;
    }
  });
  
  const deviceNow = new Date();
  const deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  dom.deviceTimeEl.textContent = deviceNow.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit'
  });
  dom.deviceTimezoneEl.textContent = deviceTz.replace(/_/g, ' ');

  dom.timeLoader.classList.add('hidden');
  dom.timeContent.classList.remove('hidden');
}

export function getUtcOffset(timeZone: string): number {
    const offset = getGmtOffset(timeZone);
    if (offset !== null) {
        return offset;
    }

    try {
        const now = new Date();
        const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
        const tzDate = new Date(now.toLocaleString('en-US', { timeZone }));
        return (tzDate.getTime() - utcDate.getTime()) / 3600000;
    } catch (e) {
        return 99;
    }
}

export function getValidTimezoneName(tzid: string | null, zone: number): string {
    if (tzid && tzid.trim() !== '') {
        try {
            new Intl.DateTimeFormat('en-US', { timeZone: tzid });
            return tzid;
        } catch (e) {
            // Fallback for invalid tzid
        }
    }
    const sign = zone <= 0 ? '+' : '-';
    return `Etc/GMT${sign}${Math.abs(zone)}`;
}


export function getTimezoneOffset(tz1: string, tz2: string | null): string {
  if (!tz2) return '';
  if (tz1 === tz2) return 'Local time';
  try {
    const offset1 = getUtcOffset(tz1);
    const offset2 = getUtcOffset(tz2);
    const diffHours = offset1 - offset2;

    if (diffHours === 0) return 'Local time';
    const diff = Number.isInteger(diffHours) ? diffHours : diffHours.toFixed(1);
    return `${diffHours > 0 ? '+' : ''}${diff} hrs`;
  } catch (e) {
    return 'Offset N/A';
  }
}

export function startClocks() {
  if (state.clocksInterval) clearInterval(state.clocksInterval);
  updateAllClocks();
  state.clocksInterval = setInterval(updateAllClocks, 1000);
}

export async function fetchTimezoneForCoordinates(lat: number, lon: number): Promise<string | null> {
  console.log(`Fetching timezone from Google API for Lat: ${lat}, Lon: ${lon}`);
  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const apiUrl = `https://maps.googleapis.com/maps/api/timezone/json?location=${lat},${lon}&timestamp=${timestamp}&key=${GOOGLE_MAPS_API_KEY}`;
    
    const response = await fetch(apiUrl);
    if (!response.ok) throw new Error('Network response was not ok.');
    
    const data = await response.json();
    if (data.status === 'OK' && data.timeZoneId) {
      return data.timeZoneId;
    } else if (data.status === 'ZERO_RESULTS') {
        console.log("Google API returned ZERO_RESULTS. Initiating fallback to local GeoJSON.");
        return findTimezoneFromGeoJSON(lat, lon);
    } else {
      throw new Error(data.errorMessage || 'Failed to fetch timezone from Google.');
    }
  } catch (error) {
    console.error('Error fetching timezone from Google API, initiating fallback:', error);
    return findTimezoneFromGeoJSON(lat, lon);
  }
}