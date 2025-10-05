// src/utils.ts

/**
 * Calculates the distance between two geographical coordinates in kilometers.
 * @param lat1 Latitude of the first point.
 * @param lon1 Longitude of the first point.
 * @param lat2 Latitude of the second point.
 * @param lon2 Longitude of the second point.
 * @returns The distance in kilometers.
 */
export function distance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
}

/**
 * Formats the accuracy value for display.
 * @param accuracy The accuracy in meters.
 * @returns A formatted string (e.g., "7m", "94m", "560m", "3.0km", "2,100km").
 */
export function formatAccuracy(accuracy: number): string {
    if (accuracy < 1000) {
        return `${Math.round(accuracy)}m`;
    } else {
        const accuracyInKm = accuracy / 1000;
        const fixed = accuracyInKm < 10 ? 1 : 0;
        return `${accuracyInKm.toLocaleString(undefined, { minimumFractionDigits: fixed, maximumFractionDigits: fixed })}km`;
    }
}