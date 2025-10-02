// src/time.ts

import * as dom from './dom';
import { state } from './state';

const GOOGLE_MAPS_API_KEY = "AIzaSyAmfnxthlRCjJNKNQTvp6RX-0pTQPL2cB0";

/**
 * Returns a formatted time string for a given timezone.
 * @param tz The IANA timezone name.
 * @param options Intl.DateTimeFormatOptions for formatting.
 * @returns The formatted time string.
 */
export function getFormattedTime(tz: string, options: Intl.DateTimeFormatOptions = {}): string {
  const correctedTime = new Date(new Date().getTime() + state.timeOffset);
  try {
    return correctedTime.toLocaleTimeString('en-US', { timeZone: tz, ...options });
  } catch (e) {
    return "Invalid";
  }
}

export async function syncClock() {
  console.log('Performing initial clock synchronization with Google Cloud Function...');
  try {
    // --- IMPORTANT: Paste your new Cloud Function Trigger URL here! ---
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
      dom.localTimeEl.textContent = correctedTime.toLocaleTimeString('en-US', { timeZone: localTimezone });
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
        const timeString = getFormattedTime(tz, { hour: '2-digit', minute: '2-digit' });
        const dateString = correctedTime.toLocaleDateString('en-US', { timeZone: tz, weekday: 'short' });
        const timeDiff = getTimezoneOffset(tz, localTimezone);

        el.querySelector('.time')!.textContent = timeString;
        el.querySelector('.date-diff')!.textContent = `${dateString}, ${timeDiff}`;
    }
  });
  
  const deviceNow = new Date();
  const deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  dom.deviceTimeEl.textContent = deviceNow.toLocaleTimeString('en-US');
  dom.deviceTimezoneEl.textContent = deviceTz.replace(/_/g, ' ');

  dom.timeLoader.classList.add('hidden');
  dom.timeContent.classList.remove('hidden');
}

/**
 * Calculates the numeric UTC offset for a given timezone.
 * @param timeZone The IANA timezone name.
 * @returns The UTC offset in hours.
 */
export function getUtcOffset(timeZone: string): number {
    try {
        const now = new Date();
        const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
        const tzDate = new Date(now.toLocaleString('en-US', { timeZone }));
        return (tzDate.getTime() - utcDate.getTime()) / 3600000; // Return offset in hours
    } catch (e) {
        return 99; // Return a large number for invalid timezones to sort them last
    }
}

// ADDED: A helper to get a valid timezone name for offset calculation
export function getValidTimezoneName(tzid: string | null, zone: number): string {
    if (tzid && tzid.trim() !== '') {
        try {
            // Test if the tzid is valid
            new Intl.DateTimeFormat('en-US', { timeZone: tzid });
            return tzid;
        } catch (e) {
            // Fallback if tzid is invalid
        }
    }
    // Fallback for null, empty, or invalid tzid
    const sign = zone <= 0 ? '+' : '-';
    return `Etc/GMT${sign}${Math.abs(zone)}`;
}


export function getTimezoneOffset(tz1: string, tz2: string | null): string {
  if (!tz2) return '';
  if (tz1 === tz2) return 'Same time';
  try {
    const offset1 = getUtcOffset(tz1);
    const offset2 = getUtcOffset(tz2);
    const diffHours = offset1 - offset2;

    if (diffHours === 0) return 'Same time';
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
    } else {
      throw new Error(data.errorMessage || 'Failed to fetch timezone from Google.');
    }
  } catch (error) {
    console.error('Error fetching timezone:', error);
    return null;
  }
}