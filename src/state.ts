// src/state.ts

interface AppState {
    // Map State
    locationMap: google.maps.Map | null;
    timezoneMap: google.maps.Map | null;
    locationMarker: google.maps.Marker | null;
    timezoneMapMarker: google.maps.Marker | null;
    initialLocationSet: boolean;

    // GeoJSON Data
    geoJsonData: any | null;
    geoJsonLoaded: boolean;

    // Timezone State
    localTimezone: string | null;
    gpsTzid: string | null;
    gpsZone: number | null;
    gpsTimezoneSelected: boolean; // Tracks if the user's own timezone is selected
    temporaryTimezone: string | null;
    addedTimezones: string[];
    timezonesFromUrl: string[] | null;

    // Map Interaction State
    hoveredZone: number | null;
    hoveredTimezoneName: string | null;
    selectedZone: number | null;
    currentZoneFeature: google.maps.Data.Feature | null;

    // Time State
    timeOffset: number;
    clocksInterval: number | null;
    lastFetchedCoords: { lat: number; lon: number; };
}

export const state: AppState = {
    // Map State
    locationMap: null,
    timezoneMap: null,
    locationMarker: null,
    timezoneMapMarker: null,
    initialLocationSet: false,

    // GeoJSON Data
    geoJsonData: null,
    geoJsonLoaded: false,

    // Timezone State
    localTimezone: null,
    gpsTzid: null,
    gpsZone: null,
    gpsTimezoneSelected: false, // Default to false
    temporaryTimezone: null,
    addedTimezones: JSON.parse(localStorage.getItem('worldClocks') || '[]'),
    timezonesFromUrl: null,

    // Map Interaction State
    hoveredZone: null,
    hoveredTimezoneName: null,
    selectedZone: null,
    currentZoneFeature: null,

    // Time State
    timeOffset: 0,
    clocksInterval: null,
    lastFetchedCoords: { lat: 0, lon: 0 },
};