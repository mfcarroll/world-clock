// src/state.ts

interface AppState {
    // Map State
    locationMap: google.maps.Map | null;
    timezoneMap: google.maps.Map | null;
    locationMarker: google.maps.Marker | null;
    timezoneMapMarker: google.maps.Marker | null;

    // GeoJSON Data
    geoJsonData: any | null;
    geoJsonLoaded: boolean;

    // Timezone State
    localTimezone: string | null;
    gpsTzid: string | null;
    gpsZone: number | null;
    temporaryTimezone: string | null;
    addedTimezones: string[];
    timezonesFromUrl: string[] | null;

    // Map Interaction State
    hoveredZone: number | null;
    hoveredTimezoneName: string | null; // To track the specific shape under the cursor
    selectedZone: number | null;

    // Time State
    timeOffset: number;
    clocksInterval: number | null;
}

export const state: AppState = {
    // Map State
    locationMap: null,
    timezoneMap: null,
    locationMarker: null,
    timezoneMapMarker: null,

    // GeoJSON Data
    geoJsonData: null,
    geoJsonLoaded: false,

    // Timezone State
    localTimezone: null,
    gpsTzid: null,
    gpsZone: null,
    temporaryTimezone: null,
    addedTimezones: JSON.parse(localStorage.getItem('worldClocks') || '[]'),
    timezonesFromUrl: null,

    // Map Interaction State
    hoveredZone: null,
    hoveredTimezoneName: null, // Default to null
    selectedZone: null,

    // Time State
    timeOffset: 0,
    clocksInterval: null,
};