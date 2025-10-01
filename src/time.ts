// src/time.ts

import * as dom from './dom';
import { state } from './state';
import { updateMapHighlights } from './map'; // Assuming map.ts exports this

const TIMEZONE_API_KEY = "W9EYNXL4UXY8";

export function startClocks(localTimezone: string) {
  if (state.clocksInterval) clearInterval(state.clocksInterval);
  updateAllClocks(localTimezone);
  state.clocksInterval = setInterval(() => updateAllClocks(localTimezone), 1000);
}

// --- REFACTORED: Now correctly calculates UTC time from the API response ---
export async function fetchTimezoneForCoordinates(lat: number, lon: number): Promise<string | null> {
  console.log(`Fetching timezone for Lat: ${lat}, Lon: ${lon}`);
  try {
    const apiUrl = `/api/timezone/v2.1/get-time-zone?key=${TIMEZONE_API_KEY}&format=json&by=position&lat=${lat}&lng=${lon}`;
    const response = await fetch(apiUrl);

    if (!response.ok) throw new Error('Network response was not ok.');
    
    const data = await response.json();
    console.log("TimeZoneDB API Response:", data);

    if (data.status === 'OK') {
      // If this is the first successful fetch, calculate the time offset.
      if (state.timeOffset === 0 && data.timestamp) {
        // The API's timestamp is local, so convert it to UTC by subtracting the zone's offset.
        const serverUtcTime = (data.timestamp - data.gmtOffset) * 1000;
        const localDeviceTime = new Date().getTime();
        state.timeOffset = serverUtcTime - localDeviceTime;
        console.log(`Time offset calculated from TimeZoneDB: ${state.timeOffset}ms`);
      }
      return data.zoneName;
    } else {
      throw new Error(data.message || 'Failed to fetch timezone.');
    }
  } catch (error) {
    console.error('Error fetching timezone:', error);
    return null;
  }
}

export function updateAllClocks(localTimezone: string) {
  const correctedTime = new Date(new Date().getTime() + state.timeOffset);

  try {
    dom.localTimeEl.textContent = correctedTime.toLocaleTimeString('en-US', { timeZone: localTimezone });
    dom.localDateEl.textContent = correctedTime.toLocaleDateString('en-US', { timeZone: localTimezone, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    dom.localTimezoneEl.textContent = localTimezone.replace(/_/g, ' ');
  } catch (e) {
    console.error(`Invalid local timezone: ${localTimezone}`, e);
    dom.localTimeEl.textContent = "Error";
  }
  
  const deviceNow = new Date();
  const deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  dom.deviceTimeEl.textContent = deviceNow.toLocaleTimeString('en-US');
  dom.deviceTimezoneEl.textContent = deviceTz.replace(/_/g, ' ');

  dom.timeLoader.classList.add('hidden');
  dom.timeContent.classList.remove('hidden');

  state.addedTimezones.forEach(tz => {
    const el = document.getElementById(`clock-${tz.replace(/\//g, '-')}`);
    if (el) {
      try {
        const timeString = correctedTime.toLocaleTimeString('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
        const dateString = correctedTime.toLocaleDateString('en-US', { timeZone: tz, weekday: 'short' });
        const timeDiff = getTimezoneOffset(tz, localTimezone);
        el.querySelector('.time')!.textContent = timeString;
        el.querySelector('.date-diff')!.textContent = `${dateString}, ${timeDiff}`;
      } catch (e) {
        el.querySelector('.time')!.textContent = "Error";
      }
    }
  });
}

export function getTimezoneOffset(tz1: string, tz2: string): string {
    let result: string;
    try {
        const getOffsetMilliseconds = (timeZone: string) => {
            const date = new Date();
            const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
            const tzDate = new Date(date.toLocaleString('en-US', { timeZone }));
            return tzDate.getTime() - utcDate.getTime();
        };

        const offset1 = getOffsetMilliseconds(tz1);
        const offset2 = getOffsetMilliseconds(tz2);
        
        const diffHours = (offset1 - offset2) / 3600000;
        
        if (tz1 === tz2) {
            result = 'Same as GPS';
        } else if (tz2 === 'UTC') {
            result = `UTC${diffHours >= 0 ? '+' : ''}${Number.isInteger(diffHours) ? diffHours : diffHours.toFixed(2)}`;
        } else {
            result = `${diffHours > 0 ? '+' : ''}${diffHours} hrs`;
        }
    } catch (e) {
        console.error(`Failed to calculate offset between ${tz1} and ${tz2}`, e);
        result = 'Offset N/A';
    }
    return result;
}