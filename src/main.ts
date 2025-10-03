// src/main.ts

import './style.css';
import { Loader } from '@googlemaps/js-api-loader';
import * as dom from './dom';
import { state } from './state';
import { initMaps, onLocationError, onLocationSuccess, selectTimezone } from './map';
import { updateAllClocks, getUtcOffset, syncClock } from './time';

const GOOGLE_MAPS_API_KEY = "AIzaSyAmfnxthlRCjJNKNQTvp6RX-0pTQPL2cB0";

/**
 * Checks for a 'timezones' URL parameter and processes it.
 * If found, it saves the timezones to local storage and the app state, then cleans the URL.
 */
function handleUrlParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('timezones')) {
        const timezonesParam = urlParams.get('timezones');
        if (timezonesParam) {
            const timezones = timezonesParam.split(',').filter(tz => tz.trim() !== '');
            
            // Save to localStorage for persistence
            localStorage.setItem('worldClocks', JSON.stringify(timezones));
            state.addedTimezones = timezones;
            
            // Save to state for initial selection after GPS lock
            state.timezonesFromUrl = timezones;
        }

        // Remove the parameters from the URL without reloading the page
        history.replaceState(null, '', window.location.pathname);
    }
}

function saveTimezones() {
    localStorage.setItem('worldClocks', JSON.stringify(state.addedTimezones));
}

function addUniqueTimezoneToList(tz: string) {
    // If the exact timezone is already in the list, do nothing.
    if (state.addedTimezones.includes(tz)) {
        return;
    }

    const newOffset = getUtcOffset(tz);

    // Prioritize user's GPS timezone: if the new timezone has the same offset as the
    // GPS zone but a different name, do not add it.
    if (state.gpsTzid && getUtcOffset(state.gpsTzid) === newOffset && tz !== state.gpsTzid) {
        return;
    }

    // Remove any other existing timezones from the list that have the same UTC offset.
    state.addedTimezones = state.addedTimezones.filter(existingTz => getUtcOffset(existingTz) !== newOffset);

    // Add the new timezone.
    state.addedTimezones.push(tz);

    saveTimezones();
    renderWorldClocks();
}


function createClockElement(tz: string): HTMLElement {
    const template = dom.worldClockTemplate;
    const clone = template.content.cloneNode(true) as DocumentFragment;
    const clockDiv = clone.querySelector('.grid') as HTMLElement;

    clockDiv.id = `clock-${tz.replace(/\//g, '-')}`;

    // Start with a clean slate for borders
    clockDiv.classList.remove('border-transparent', 'border-blue-500', 'border-yellow-500');

    // Style for GPS-detected timezone
    if (tz === state.gpsTzid) {
        clockDiv.classList.add('border-blue-500');
    }
    // Style for the timezone currently selected on the map
    else if (tz === state.temporaryTimezone) {
        clockDiv.classList.add('border-yellow-500');
    }
    // Default for all other clocks
    else {
        clockDiv.classList.add('border-transparent');
    }

    // Add a special background if the selected timezone hasn't been "pinned" yet
    if (tz === state.temporaryTimezone && !state.addedTimezones.includes(tz)) {
        clockDiv.classList.add('bg-yellow-800', 'bg-opacity-50');
    } else {
        clockDiv.classList.remove('bg-yellow-800', 'bg-opacity-50');
    }

    let city = tz.split('/').pop()?.replace(/_/g, ' ') || 'Unknown';
    if (tz.startsWith('Etc/GMT')) {
        const offsetMatch = tz.match(/[+-](\d+(?:\.\d+)?)/);
        if (offsetMatch) {
            const offset = -parseFloat(offsetMatch[0]);
            city = `UTC${offset >= 0 ? '+' : ''}${offset}`;
        }
    }

    clone.querySelector('.city')!.textContent = city;
    const removeBtn = clone.querySelector('.remove-btn') as HTMLElement;
    const pinBtn = clone.querySelector('.pin-btn') as HTMLElement;

    removeBtn.dataset.timezone = tz;
    pinBtn.dataset.timezone = tz;

    // Show 'pin' button for temporary timezones, 'remove' for others
    if (tz === state.temporaryTimezone && !state.addedTimezones.includes(tz)) {
        removeBtn.classList.add('hidden');
        pinBtn.classList.remove('hidden');
    } else {
        removeBtn.classList.remove('hidden');
        pinBtn.classList.add('hidden');
    }

    return clockDiv;
}

function renderWorldClocks() {
    dom.worldClocksContainerEl.innerHTML = '';

    const timezonesToRender = [...state.addedTimezones];
    if (state.temporaryTimezone && !timezonesToRender.includes(state.temporaryTimezone)) {
        timezonesToRender.push(state.temporaryTimezone);
    }

    timezonesToRender
        .sort((a, b) => getUtcOffset(a) - getUtcOffset(b))
        .forEach((tz: string) => {
            const clockElement = createClockElement(tz);
            dom.worldClocksContainerEl.appendChild(clockElement);
        });
}

function handleAddTimezone() {
    const newTimezone = dom.timezoneInput.value;
    const ianaTimezones = Intl.supportedValuesOf('timeZone');
    if (newTimezone && ianaTimezones.includes(newTimezone)) {
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
  handleUrlParameters();

  await syncClock();
  
  const loader = new Loader({
    apiKey: GOOGLE_MAPS_API_KEY,
    version: "weekly",
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
  
  dom.timezoneInput.addEventListener('input', () => {
    const ianaTimezones = Intl.supportedValuesOf('timeZone');
    if (ianaTimezones.includes(dom.timezoneInput.value)) {
        handleAddTimezone();
    }
  });

  dom.worldClocksContainerEl.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const removeBtn = target.closest('.remove-btn');
    const pinBtn = target.closest('.pin-btn');

    if (removeBtn) {
      const timezoneToRemove = (removeBtn as HTMLElement).dataset.timezone!;
      state.addedTimezones = state.addedTimezones.filter((tz: string) => tz !== timezoneToRemove);
      saveTimezones();
      renderWorldClocks();
      updateAllClocks();
    } else if (pinBtn) {
      const timezoneToPin = (pinBtn as HTMLElement).dataset.timezone!;
      addUniqueTimezoneToList(timezoneToPin);
      renderWorldClocks();
      updateAllClocks();
    } else {
        const clockDiv = target.closest('.grid');
        if (clockDiv) {
            const timezone = (clockDiv as HTMLElement).id.replace('clock-', '').replace(/-/g, '/');
            selectTimezone(timezone);
        }
    }
  });

  document.addEventListener('temporarytimezonechanged', () => {
    renderWorldClocks();
    updateAllClocks();
  });

  // Listen for the custom event from the map to replace a timezone
  document.addEventListener('replacetimezone', (e: Event) => {
      const { tzid } = (e as CustomEvent).detail;
      addUniqueTimezoneToList(tzid);
  });

  document.addEventListener('gpstimezonefound', (e) => {
    const { tzid } = (e as CustomEvent).detail;
    dom.localTimezoneEl.textContent = tzid.replace(/_/g, ' ');
    addUniqueTimezoneToList(tzid);

    if (state.timezonesFromUrl) {
      const timezoneToSelect = state.timezonesFromUrl.find(tz => tz !== tzid);
      if (timezoneToSelect) {
          state.temporaryTimezone = timezoneToSelect;
          state.selectedZone = getUtcOffset(timezoneToSelect);
          document.dispatchEvent(new CustomEvent('temporarytimezonechanged'));
      }
      state.timezonesFromUrl = null; // Clear after processing
    }

    renderWorldClocks();
  });

  renderWorldClocks();
}

startApp();