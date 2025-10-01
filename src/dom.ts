// src/dom.ts

export const latitudeEl = document.getElementById('latitude')!;
export const longitudeEl = document.getElementById('longitude')!;
export const locationErrorEl = document.getElementById('location-error')!;
export const localTimeEl = document.getElementById('local-time')!;
export const localTimezoneEl = document.getElementById('local-timezone')!;
export const localDateEl = document.getElementById('local-date')!;
export const deviceTimeEl = document.getElementById('device-time')!;
export const deviceTimezoneEl = document.getElementById('device-timezone')!;
export const locationLoader = document.getElementById('location-loader')!;
export const timeLoader = document.getElementById('time-loader')!;
export const locationContent = document.getElementById('location-content')!;
export const timeContent = document.getElementById('time-content')!;
export const timezoneInput = document.getElementById('timezone-input') as HTMLInputElement;
export const addTimezoneBtn = document.getElementById('add-timezone-btn')!;
export const worldClocksContainer = document.getElementById('world-clocks-container')!;
export const timezoneList = document.getElementById('timezone-list')!;
export const timezoneMapTitle = document.getElementById('timezone-map-title')!;
export const selectedTimezoneDetailsEl = document.getElementById('selected-timezone-details')!;
export const hoverTimezoneDetailsEl = document.getElementById('hover-timezone-details')!;