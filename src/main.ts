// src/main.ts

import { Loader } from '@googlemaps/js-api-loader';
import * as dom from './dom';
import { state } from './state';
import { initMaps, onLocationError, onLocationSuccess } from './map';
import { updateAllClocks } from './time';

const GOOGLE_MAPS_API_KEY = "AIzaSyAmfnxthlRCjJNKNQTvp6RX-0pTQPL2cB0"; 

function saveTimezones() {
    localStorage.setItem('worldClocks', JSON.stringify(state.addedTimezones));
}

function renderWorldClocks() {
    dom.worldClocksContainer.innerHTML = '';
    const template = document.getElementById('world-clock-template') as HTMLTemplateElement;

    state.addedTimezones.forEach(tz => {
        const clone = template.content.cloneNode(true) as DocumentFragment;
        
        const clockDiv = clone.querySelector('.grid')!;
        const cityEl = clone.querySelector('.city')!;
        const regionEl = clone.querySelector('.region')!;
        const removeBtn = clone.querySelector('.remove-btn')!;

        clockDiv.id = `clock-${tz.replace(/\//g, '-')}`;
        removeBtn.setAttribute('data-timezone', tz);
        
        const tzParts = tz.replace(/_/g, ' ').split('/');
        cityEl.textContent = tzParts[tzParts.length - 1];
        regionEl.textContent = tzParts[0];

        dom.worldClocksContainer.appendChild(clone);
    });
}

// --- NEW: Helper function to add a timezone to the list if it's not already there ---
function addUniqueTimezoneToList(tz: string) {
    if (tz && !state.addedTimezones.includes(tz)) {
        state.addedTimezones.push(tz);
        state.addedTimezones.sort(); // Keep the list sorted alphabetically
        saveTimezones();
        renderWorldClocks();
    }
}

function handleAddTimezone() {
    const newTimezone = dom.timezoneInput.value.trim();
    const ianaTimezones = Intl.supportedValuesOf('timeZone');
    if (newTimezone && !state.addedTimezones.includes(newTimezone) && ianaTimezones.includes(newTimezone)) {
        addUniqueTimezoneToList(newTimezone);
        const localTimezone = dom.localTimezoneEl.textContent?.replace(/ /g, '_');
        if (localTimezone && localTimezone !== '--_/_--') {
          updateAllClocks(localTimezone);
        }
    } else if (newTimezone && !ianaTimezones.includes(newTimezone)) {
        alert('Invalid or unsupported timezone. Please select from the list.');
    }
    dom.timezoneInput.value = '';
}


async function startApp() {
  const loader = new Loader({
    apiKey: GOOGLE_MAPS_API_KEY,
    version: "weekly",
  });

  try {
    await loader.load();
    await initMaps();
  } catch (error) {
    console.error("Failed to load Google Maps API", error);
    document.getElementById('location-map')!.innerHTML = '<span>Failed to load Google Maps. Please check your API key and network connection.</span>';
    document.getElementById('timezone-map')!.innerHTML = '<span>Failed to load Google Maps. An ad blocker might be interfering.</span>';
    return;
  }

  const ianaTimezones = Intl.supportedValuesOf('timeZone');
  dom.timezoneList.innerHTML = ianaTimezones.map(tz => `<option value="${tz}"></option>`).join('');

  dom.addTimezoneBtn.addEventListener('click', handleAddTimezone);
  dom.timezoneInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleAddTimezone();
  });

  dom.worldClocksContainer.addEventListener('click', (e) => {
    const removeBtn = (e.target as HTMLElement).closest('.remove-btn');
    if (removeBtn) {
      const timezoneToRemove = (removeBtn as HTMLElement).dataset.timezone!;
      state.addedTimezones = state.addedTimezones.filter(tz => tz !== timezoneToRemove);
      saveTimezones();
      renderWorldClocks();
    }
  });

  // --- NEW: Listen for the custom event from the map module ---
  document.addEventListener('gpstimezonefound', (e: Event) => {
      const customEvent = e as CustomEvent;
      const { tzid } = customEvent.detail;

      // Add both the GPS and device timezones to the list
      addUniqueTimezoneToList(tzid);
      const deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      addUniqueTimezoneToList(deviceTz);
  });

  renderWorldClocks();

  navigator.geolocation.watchPosition(onLocationSuccess, onLocationError, {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0,
  });
}

startApp();