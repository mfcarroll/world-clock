// src/time.ts

import * as dom from './dom';
import { state } from './state';

const GOOGLE_MAPS_API_KEY = "AIzaSyAmfnxthlRCjJNKNQTvp6RX-0pTQPL2cB0";

export async function syncClock() {
  console.log('Performing initial clock synchronization...');
  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const apiUrl = `https://maps.googleapis.com/maps/api/timezone/json?location=51.5072,-0.1276&timestamp=${timestamp}&key=${GOOGLE_MAPS_API_KEY}`;
    
    const response = await fetch(apiUrl);
    if (!response.ok) throw new Error('Network response was not ok.');
    
    const data = await response.json();
    if (data.status !== 'OK') {
      throw new Error(data.errorMessage || 'Failed to sync time.');
    }

    const googleUtcTime = (timestamp + data.dstOffset + data.rawOffset) * 1000;
    const localDeviceTime = new Date().getTime();
    
    state.timeOffset = googleUtcTime - localDeviceTime;
    
    console.log(`Clock synchronized. Device offset is ${state.timeOffset}ms.`);
  } catch (error) {
    console.error('Could not synchronize clock with remote server:', error);
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

  // Added ': string' type to the tz parameter
  state.addedTimezones.forEach((tz: string) => {
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

export function getTimezoneOffset(tz1: string, tz2: string | null): string {
  if (!tz2 || tz1 === tz2) return 'Same as GPS';
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
    return `${diffHours > 0 ? '+' : ''}${diffHours} hrs`;
  } catch (e) {
    return 'Offset N/A';
  }
}