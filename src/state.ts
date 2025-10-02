// src/state.ts

// The types for Map and AdvancedMarkerElement are available globally via the Google Maps script,
// so we reference them using the 'google.maps' namespace.
export const state = {
  // Maps and Markers
  locationMap: null as google.maps.Map | null,
  timezoneMap: null as google.maps.Map | null,
  locationMarker: null as google.maps.marker.AdvancedMarkerElement | null,
  timezoneMapMarker: null as google.maps.marker.AdvancedMarkerElement | null,

  // Map Interaction State
  selectedZone: null as number | null,
  hoveredZone: null as number | null,
  gpsZone: null as number | null, // The UTC offset of the user's detected timezone

  // Time and Clocks
  timeOffset: 0, // Difference between server time and local device time in ms
  clocksInterval: null as number | null,
  localTimezone: null as string | null, // The IANA timezone name of the user's current location
  gpsTzid: null as string | null, // IANA timezone name specifically from the GPS lookup
  
  // Timezone Data
  addedTimezones: JSON.parse(localStorage.getItem('worldClocks') || '["America/New_York", "Europe/Paris", "Asia/Tokyo", "Australia/Sydney"]'),
  temporaryTimezone: null as string | null,
  geoJsonData: null as any,
  geoJsonLoaded: false,
};