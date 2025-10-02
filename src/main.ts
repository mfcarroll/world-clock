// src/main.ts

import { Loader } from '@googlemaps/js-api-loader';
import * as dom from './dom';
import { state } from './state';
import { initMaps, onLocationError, onLocationSuccess } from './map';
import { updateAllClocks, syncClock } from './time';

const GOOGLE_MAPS_API_KEY = "AIzaSyAmfnxthlRCjJNKNQTvp6RX-0pTQPL2cB0"; 

function saveTimezones() {
    localStorage.setItem('worldClocks', JSON.stringify(state.addedTimezones));
}

function renderWorldClocks() {
    dom.worldClocksContainer.innerHTML = '';
    const template = document.getElementById('world-clock-template') as HTMLTemplateElement;

    const timezonesToRender = [...state.addedTimezones];
    if (state.temporaryTimezone && !timezonesToRender.includes(state.temporaryTimezone)) {
        timezonesToRender.push(state.temporaryTimezone);
    }
    timezonesToRender.sort();

    timezonesToRender.forEach((tz: string) => {
        const clone = template.content.cloneNode(true) as DocumentFragment;
        
        const clockDiv = clone.querySelector('.grid')!;
        const cityEl = clone.querySelector('.city')!;
        const regionEl = clone.querySelector('.region')!;
        const removeBtn = clone.querySelector('.remove-btn')!;
        const pinBtn = clone.querySelector('.pin-btn')!;

        clockDiv.id = `clock-${tz.replace(/\//g, '-')}`;
        
        const tzParts = tz.replace(/_/g, ' ').split('/');
        cityEl.textContent = tzParts[tzParts.length - 1];
        regionEl.textContent = tzParts[0];

        if (tz === state.temporaryTimezone && !state.addedTimezones.includes(tz)) {
            clockDiv.classList.add('bg-amber-800/50');
            removeBtn.classList.add('hidden');
            pinBtn.classList.remove('hidden');
            pinBtn.setAttribute('data-timezone', tz);
        } else {
            removeBtn.setAttribute('data-timezone', tz);
        }

        dom.worldClocksContainer.appendChild(clone);
    });
}

function addUniqueTimezoneToList(tz: string) {
    if (tz && !state.addedTimezones.includes(tz)) {
        state.addedTimezones.push(tz);
        state.addedTimezones.sort();
        saveTimezones();
        renderWorldClocks();
    }
}

function handleAddTimezone() {
    const newTimezone = dom.timezoneInput.value.trim();
    const ianaTimezones = Intl.supportedValuesOf('timeZone');
    if (newTimezone && !state.addedTimezones.includes(newTimezone) && ianaTimezones.includes(newTimezone)) {
        addUniqueTimezoneToList(newTimezone);
        if (state.localTimezone) {
          updateAllClocks();
        }
    } else if (newTimezone && !ianaTimezones.includes(newTimezone)) {
        alert('Invalid or unsupported timezone. Please select from the list.');
    }
    dom.timezoneInput.value = '';
}


async function startApp() {
  await syncClock();

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
  dom.timezoneList.innerHTML = ianaTimezones.map((tz: string) => `<option value="${tz}"></option>`).join('');

  dom.addTimezoneBtn.addEventListener('click', handleAddTimezone);
  dom.timezoneInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleAddTimezone();
  });

  dom.worldClocksContainer.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const removeBtn = target.closest('.remove-btn');
    const pinBtn = target.closest('.pin-btn');

    if (removeBtn) {
      const timezoneToRemove = (removeBtn as HTMLElement).dataset.timezone!;
      state.addedTimezones = state.addedTimezones.filter((tz: string) => tz !== timezoneToRemove);
      saveTimezones();
      renderWorldClocks();
    } else if (pinBtn) {
        const timezoneToPin = (pinBtn as HTMLElement).dataset.timezone!;
        addUniqueTimezoneToList(timezoneToPin);
        state.temporaryTimezone = null;
        renderWorldClocks();
    }
  });

  document.addEventListener('gpstimezonefound', (e: Event) => {
      const customEvent = e as CustomEvent;
      const { tzid } = customEvent.detail;
      const deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      addUniqueTimezoneToList(deviceTz);
  });
  
  document.addEventListener('temporarytimezonechanged', (e: Event) => {
      renderWorldClocks();
  });

  renderWorldClocks();

  navigator.geolocation.watchPosition(onLocationSuccess, onLocationError, {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0,
  });
}

startApp();