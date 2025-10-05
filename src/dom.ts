// src/dom.ts

// Main container
export const appContainer = document.getElementById('app-container')!;

// Location Card
export const locationLoader = document.getElementById('location-loader')!;
export const locationContent = document.getElementById('location-content')!;
export const latitudeEl = document.getElementById('latitude')!;
export const longitudeEl = document.getElementById('longitude')!;
export const locationTitleEl = document.getElementById('location-title')!;
export const accuracyDisplayEl = document.getElementById('accuracy-display')!;

// Time Card
export const timeLoader = document.getElementById('time-loader')!;
export const timeContent = document.getElementById('time-content')!;
export const localTimeEl = document.getElementById('local-time')!;
export const localTimezoneEl = document.getElementById('local-timezone')!;
export const localDateEl = document.getElementById('local-date')!;
export const deviceTimeEl = document.getElementById('device-time')!;
export const deviceTimezoneEl = document.getElementById('device-timezone')!;

// World Clock
export const timezoneInput = document.getElementById('timezone-input') as HTMLInputElement;
export const timezoneList = document.getElementById('timezone-list')!;
export const addTimezoneBtn = document.getElementById('add-timezone-btn')!;
export const worldClocksContainerEl = document.getElementById('world-clocks-container')!;
export const worldClockTemplate = document.getElementById('world-clock-template') as HTMLTemplateElement;

// Timezone Map Details
export const userTimezoneDetailsEl = document.getElementById('user-timezone-details')!;
export const userTimezoneNameEl = document.getElementById('user-timezone-name')!;
export const userTimezoneTimeEl = document.getElementById('user-timezone-time')!;

export const selectedTimezoneDetailsEl = document.getElementById('selected-timezone-details')!;
export const selectedTimezoneNameEl = document.getElementById('selected-timezone-name')!;
export const selectedTimezoneOffsetEl = document.getElementById('selected-timezone-offset')!;

export const hoveredTimezoneDetailsEl = document.getElementById('hovered-timezone-details')!;
export const hoveredTimezoneNameEl = document.getElementById('hovered-timezone-name')!;
export const hoveredTimezoneOffsetEl = document.getElementById('hovered-timezone-offset')!;