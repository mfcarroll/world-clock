// src/main.ts

import './style.css';
import { Loader } from '@googlemaps/js-api-loader';
import * as dom from './dom';
import { state } from './state';
import { initMaps, onLocationError, onLocationSuccess } from './map';
import { updateAllClocks, getUtcOffset, syncClock } from './time';

const GOOGLE_MAPS_API_KEY = "AIzaSyAmfnxthlRCjJNKNQTvp6RX-0pTQPL2cB0";

function saveTimezones() {
    localStorage.setItem('worldClocks', JSON.stringify(state.addedTimezones));
}

function addUniqueTimezoneToList(tz: string) {
    if (!state.addedTimezones.includes(tz)) {
        state.addedTimezones.push(tz);
        saveTimezones();
        renderWorldClocks();
    }
}

function renderWorldClocks() {
    const template = dom.worldClockTemplate;
    dom.worldClocksContainerEl.innerHTML = '';

    const timezonesToRender = [...state.addedTimezones];
    if (state.temporaryTimezone && !timezonesToRender.includes(state.temporaryTimezone)) {
        timezonesToRender.push(state.temporaryTimezone);
    }

    timezonesToRender.sort((a, b) => {
        const offsetA = getUtcOffset(a);
        const offsetB = getUtcOffset(b);
        return offsetA - offsetB;
    });

    timezonesToRender.forEach((tz: string) => {
        const clone = template.content.cloneNode(true) as DocumentFragment;
        const clockDiv = clone.querySelector('.grid')!;
        
        clockDiv.id = `clock-${tz.replace(/\//g, '-')}`;
        
        if (tz === state.gpsTzid) {
            clockDiv.classList.remove('border-transparent');
            clockDiv.classList.add('border-blue-500');
        }

        let city = tz.split('/').pop()?.replace(/_/g, ' ') || 'Unknown';
        if (tz.startsWith('Etc/GMT')) {
            const offsetMatch = tz.match(/[+-]\d+/);
            if (offsetMatch) {
                const offset = -parseInt(offsetMatch[0], 10);
                city = `UTC${offset >= 0 ? '+' : ''}${offset}`;
            }
        }

        clone.querySelector('.city')!.textContent = city;
        const removeBtn = clone.querySelector('.remove-btn') as HTMLElement;
        const pinBtn = clone.querySelector('.pin-btn') as HTMLElement;

        removeBtn.dataset.timezone = tz;
        pinBtn.dataset.timezone = tz;

        if (tz === state.temporaryTimezone) {
            clockDiv.classList.add('bg-yellow-800', 'bg-opacity-50', 'border', 'border-yellow-500');
            removeBtn.classList.add('hidden');
            pinBtn.classList.remove('hidden');
        } else {
            removeBtn.classList.remove('hidden');
            pinBtn.classList.add('hidden');
        }

        dom.worldClocksContainerEl.appendChild(clone);
    });
}

function handleAddTimezone() {
    const newTimezone = dom.timezoneInput.value;
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
    mapIds: ['c75a3fdf244efe75fccc5434'],
  });

  try {
    await loader.load();
    await initMaps();
    navigator.geolocation.watchPosition(onLocationSuccess, onLocationError);
  } catch (e) {
    console.error("Failed to load Google Maps", e);
  }

  const ianaTimezones = Intl.supportedValuesOf('timeZone');
  dom.timezoneList.innerHTML = ianaTimezones.map((tz: string) => `<option value="${tz}"></option>`).join('');

  dom.addTimezoneBtn.addEventListener('click', handleAddTimezone);
  dom.timezoneInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleAddTimezone();
  });

  dom.worldClocksContainerEl.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const removeBtn = target.closest('.remove-btn');
    const pinBtn = target.closest('.pin-btn');

    if (removeBtn) {
      const timezoneToRemove = (removeBtn as HTMLElement).dataset.timezone!;
      if (timezoneToRemove === state.temporaryTimezone) {
          state.temporaryTimezone = null;
      } else {
          state.addedTimezones = state.addedTimezones.filter((tz: string) => tz !== timezoneToRemove);
          saveTimezones();
      }
      renderWorldClocks();
    } else if (pinBtn) {
      const timezoneToPin = (pinBtn as HTMLElement).dataset.timezone!;
      addUniqueTimezoneToList(timezoneToPin);
      state.temporaryTimezone = null;
      renderWorldClocks();
      updateAllClocks();
    }
  });

  document.addEventListener('temporarytimezonechanged', () => {
    renderWorldClocks();
    updateAllClocks();
  });

  document.addEventListener('gpstimezonefound', (e) => {
    const { tzid } = (e as CustomEvent).detail;
    dom.localTimezoneEl.textContent = tzid.replace(/_/g, ' ');
    addUniqueTimezoneToList(tzid);
    renderWorldClocks();
  });

  renderWorldClocks();
}

startApp();