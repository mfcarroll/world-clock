// src/state.ts

interface AppState {
    locationMap: google.maps.Map | null;
    timezoneMap: google.maps.Map | null;
    locationMarker: google.maps.Marker | null;
    timezoneMapMarker: google.maps.Marker | null;
    geoJsonData: any | null;
    geoJsonLoaded: boolean;
    localTimezone: string | null;
    gpsTzid: string | null;
    gpsZone: number | null;
    temporaryTimezone: string | null;
    addedTimezones: string[];
    hoveredZone: number | null;
    selectedZone: number | null;
    // ADDED: For storing the offset from true time
    timeOffset: number;
    // ADDED: For managing the clock update interval
    clocksInterval: number | null;
}

export const state: AppState = {
    locationMap: null,
    timezoneMap: null,
    locationMarker: null,
    timezoneMapMarker: null,
    geoJsonData: null,
    geoJsonLoaded: false,
    localTimezone: null,
    gpsTzid: null,
    gpsZone: null,
    temporaryTimezone: null,
    addedTimezones: JSON.parse(localStorage.getItem('worldClocks') || '[]'),
    hoveredZone: null,
    selectedZone: null,
    // ADDED: Initialize the new properties
    timeOffset: 0,
    clocksInterval: null,
};