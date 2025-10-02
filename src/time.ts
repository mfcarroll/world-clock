// src/time.ts

import * as dom from './dom';
import { state } from './state';

const GOOGLE_MAPS_API_KEY = "AIzaSyAmfnxthlRCjJNKNQTvp6RX-0pTQPL2cB0";

export async function syncClock() {
  console.log('Performing initial clock synchronization with worldtimeapi.org...');
  try {
    // This API provides the true current UTC time, which is required.
    const response = await fetch('https://worldtimeapi.org/api/timezone/Etc/UTC');
    if (!response.ok) throw new Error('Network response was not ok.');
    
    const data = await response.json();
    const serverUtcTime = new Date(data.utc_datetime).getTime();
    const localDeviceTime = new Date().getTime();
    
    // This is the correct way to calculate the offset.
    state.timeOffset = serverUtcTime - localDeviceTime;
    
    console.log(`Clock synchronized. Device offset is ${state.timeOffset}ms.`);
  } catch (error) {
    console.error('Could not synchronize clock with remote server:', error);
    // If the API fails, we fall back to assuming the device clock is correct.
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
      try {
        const timeString = correctedTime.toLocaleTimeString('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
        const dateString = correctedTime.toLocaleDateString('en-US', { timeZone: tz, weekday: 'short' });
        const timeDiff = getTimezoneOffset(tz, localTimezone);

        el.querySelector('.time')!.textContent = timeString;
        el.querySelector('.date-diff')!.textContent = `${dateString}, ${timeDiff}`;
      } catch (e) {
        el.querySelector('.time')!.textContent = "Invalid";
      }
    }
  });
  
  const deviceNow = new Date();
  const deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  dom.deviceTimeEl.textContent = deviceNow.toLocaleTimeString('en-US');
  dom.deviceTimezoneEl.textContent = deviceTz.replace(/_/g, ' ');

  dom.timeLoader.classList.add('hidden');
  dom.timeContent.classList.remove('hidden');
}

export function getTimezoneOffset(tz1: string, tz2: string | null): string {
  if (!tz2 || tz1 === tz2) return 'Same as local';
  try {
    const now = new Date();
    const getOffsetMilliseconds = (timeZone: string) => {
      const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
      const tzDate = new Date(now.toLocaleString('en-US', { timeZone }));
      return tzDate.getTime() - utcDate.getTime();
    };

    const offset1 = getOffsetMilliseconds(tz1);
    const offset2 = getOffsetMilliseconds(tz2);
    const diffHours = (offset1 - offset2) / 3600000;

    if (diffHours === 0) return 'Same time';
    // Use Number.isInteger to avoid unnecessary decimals
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
  console.log(`Fetching timezone name from Google for Lat: ${lat}, Lon: ${lon}`);
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