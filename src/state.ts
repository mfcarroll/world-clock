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
    // --- NEW: State for the selected timezone feature ---
    selectedTimezone: {
        tzid: null as string | null,
        feature: null as google.maps.Data.Feature | null,
    },
    clocksInterval: 0,
    addedTimezones: loadTimezones(),
    lastFetchedCoords: { lat: 0, lon: 0 },
    timeOffset: 0,
};