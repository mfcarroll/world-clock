// src/state.ts

export interface AppState {
    timeOffset: number;
    localTimezone: string | null;
    gpsTzid: string | null;
    addedTimezones: string[];
    clocksInterval: number | null;
    locationMap: google.maps.Map | null;
    timezoneMap: google.maps.Map | null;
    locationMarker: google.maps.Marker | null;
    timezoneMapMarker: google.maps.Marker | null;
    accuracyCircle: google.maps.Circle | null;
    locationAvailable: boolean;
    initialLocationSet: boolean;
    lastFetchedCoords: { lat: number, lon: number };
    geoJsonData: any | null;
    geoJsonLoaded: boolean;
    hoveredZone: number | null;
    selectedZone: number | null;
    gpsZone: number | null;
    temporaryTimezone: string | null;
    hoveredTimezoneName: string | null;
    gpsTimezoneSelected: boolean;
    timezonesFromUrl: string[] | null;
}

export const state: AppState = {
    timeOffset: 0,
    localTimezone: null,
    gpsTzid: null,
    addedTimezones: JSON.parse(localStorage.getItem('worldClocks') || '[]'),
    clocksInterval: null,
    locationMap: null,
    timezoneMap: null,
    locationMarker: null,
    timezoneMapMarker: null,
    accuracyCircle: null,
    locationAvailable: false,
    initialLocationSet: false,
    lastFetchedCoords: { lat: 0, lon: 0 },
    geoJsonData: null,
    geoJsonLoaded: false,
    hoveredZone: null,
    selectedZone: null,
    gpsZone: null,
    temporaryTimezone: null,
    hoveredTimezoneName: null,
    gpsTimezoneSelected: false,
    timezonesFromUrl: null,
};