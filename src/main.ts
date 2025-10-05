// src/main.ts

import './style.css';
import { Loader } from '@googlemaps/js-api-loader';
import * as dom from './dom';
import { state } from './state';
import { initMaps, onLocationError, onLocationSuccess, selectTimezone } from './map';
import { updateAllClocks, getUtcOffset, syncClock, getDisplayTimezoneName, startClocks } from './time';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { library, dom as faDom } from '@fortawesome/fontawesome-svg-core';
import { faLocationDot, faWifi, faBullseye, faMobileAlt } from '@fortawesome/free-solid-svg-icons';

library.add(faLocationDot, faWifi, faBullseye, faMobileAlt);
faDom.watch();

const GOOGLE_MAPS_API_KEY = "AIzaSyAmfnxthlRCjJNKNQTvp6RX-0pTQPL2cB0";

function handleUrlParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('timezones')) {
        const timezonesParam = urlParams.get('timezones');
        if (timezonesParam) {
            const timezones = timezonesParam.split(',').filter(tz => tz.trim() !== '');
            
            localStorage.setItem('worldClocks', JSON.stringify(timezones));
            state.addedTimezones = timezones;
            
            state.timezonesFromUrl = timezones;
        }

        history.replaceState(null, '', window.location.pathname);
    }
}

function saveTimezones() {
    localStorage.setItem('worldClocks', JSON.stringify(state.addedTimezones));
}

function addUniqueTimezoneToList(tz: string) {
    if (state.addedTimezones.includes(tz)) {
        return;
    }

    const newOffset = getUtcOffset(tz);

    if (state.gpsTzid && getUtcOffset(state.gpsTzid) === newOffset && tz !== state.gpsTzid) {
        return;
    }

    state.addedTimezones = state.addedTimezones.filter(existingTz => getUtcOffset(existingTz) !== newOffset);
    state.addedTimezones.push(tz);

    saveTimezones();
    renderWorldClocks();
}


function createClockElement(tz: string): HTMLElement {
    const template = dom.worldClockTemplate;
    const clone = template.content.cloneNode(true) as DocumentFragment;
    const clockDiv = clone.querySelector('.grid') as HTMLElement;

    clockDiv.id = `clock-${tz.replace(/\//g, '-')}`;

    clockDiv.classList.remove('border-transparent', 'border-blue-500', 'border-yellow-500');

    if (tz === state.gpsTzid && state.gpsTimezoneSelected) {
        clockDiv.classList.add('border-yellow-500');
    } else if (tz === state.gpsTzid) {
        clockDiv.classList.add('border-blue-500');
    } else if (tz === state.temporaryTimezone) {
        clockDiv.classList.add('border-yellow-500');
    } else {
        clockDiv.classList.add('border-transparent');
    }

    if (tz === state.temporaryTimezone && !state.addedTimezones.includes(tz)) {
        clockDiv.classList.add('bg-yellow-800', 'bg-opacity-50');
    } else {
        clockDiv.classList.remove('bg-yellow-800', 'bg-opacity-50');
    }

    clone.querySelector('.city')!.textContent = getDisplayTimezoneName(tz);
    const removeBtn = clone.querySelector('.remove-btn') as HTMLElement;
    const pinBtn = clone.querySelector('.pin-btn') as HTMLElement;

    removeBtn.dataset.timezone = tz;
    pinBtn.dataset.timezone = tz;

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
  
  if (Capacitor.getPlatform() === 'ios') {
    document.body.classList.add('is-ios');
  }

  const initialTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  state.localTimezone = initialTimezone;
  state.gpsTzid = initialTimezone;
  state.gpsZone = getUtcOffset(initialTimezone);

  startClocks();
  syncClock();
  
  const loader = new Loader({
    apiKey: GOOGLE_MAPS_API_KEY,
    version: "weekly",
  });

  try {
    await loader.load();
    await initMaps();
    
    if (Capacitor.isNativePlatform()) {
      Geolocation.watchPosition({}, (position, err) => {
        if (err) {
          onLocationError(err as GeolocationPositionError);
          return;
        }
        if (position) {
            onLocationSuccess(position as GeolocationPosition);
        }
      });
    } else {
      navigator.geolocation.watchPosition(
        onLocationSuccess, 
        onLocationError
      );
    }
  } catch (e) {
    console.error("Failed to load Google Maps or get location", e);
    onLocationError({
        code: 0,
        message: "Initialization failed",
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3
    });
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
      localStorage.setItem('worldClocks', JSON.stringify(state.addedTimezones));
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

  document.addEventListener('gpstimezoneSelectionChanged', (e: Event) => {
      const { selected } = (e as CustomEvent).detail;
      if (selected) {
          dom.userTimezoneDetailsEl.classList.add('border-yellow-500');
          dom.userTimezoneDetailsEl.classList.remove('border-blue-500');
      } else {
          dom.userTimezoneDetailsEl.classList.remove('border-yellow-500');
          dom.userTimezoneDetailsEl.classList.add('border-blue-500');
      }
  });

  document.addEventListener('replacetimezone', (e: Event) => {
      const { tzid } = (e as CustomEvent).detail;
      addUniqueTimezoneToList(tzid);
  });

  document.addEventListener('gpstimezonefound', (e) => {
    const { tzid } = (e as CustomEvent).detail;
    dom.localTimezoneEl.textContent = getDisplayTimezoneName(tzid);
    addUniqueTimezoneToList(tzid);

    if (state.timezonesFromUrl) {
      const timezoneToSelect = state.timezonesFromUrl.find(tz => tz !== tzid);
      if (timezoneToSelect) {
          state.temporaryTimezone = timezoneToSelect;
          state.selectedZone = getUtcOffset(timezoneToSelect);
          document.dispatchEvent(new CustomEvent('temporarytimezonechanged'));
      }
      state.timezonesFromUrl = null;
    }

    renderWorldClocks();
  });

  renderWorldClocks();
}

startApp();