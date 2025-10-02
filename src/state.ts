// src/state.ts

function loadTimezones(): string[] {
    const savedTimezones = localStorage.getItem('worldClocks');
    if (savedTimezones) {
        try {
            const parsed = JSON.parse(savedTimezones);
            if (Array.isArray(parsed) && parsed.every(item => typeof item === 'string')) {
                return parsed;
            }
        } catch (error) {
            console.error("Failed to parse saved timezones from localStorage", error);
        }
    }
    return ['America/New_York', 'Europe/London', 'Asia/Tokyo'];
}

export const state = {
    locationMap: null as google.maps.Map | null,
    timezoneMap: null as google.maps.Map | null,
    locationMarker: null as google.maps.marker.AdvancedMarkerElement | null,
    timezoneMapMarker: null as google.maps.marker.AdvancedMarkerElement | null,
    
    // REFACTORED: We now store the numeric zone offset as the primary ID.
    selectedZone: null as number | null,
    hoveredZone: null as number | null,
    gpsZone: null as number | null,
    
    // We still store the GPS tzid for other parts of the app.
    gpsTzid: null as string | null,

    temporaryTimezone: null as string | null,
    clocksInterval: 0,
    addedTimezones: loadTimezones(),
    lastFetchedCoords: { lat: 0, lon: 0 },
    timeOffset: 0,
    geoJsonLoaded: false,
};