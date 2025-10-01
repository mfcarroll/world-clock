# GeoTime Dashboard

This is a modern, location-aware world clock dashboard built with Vite, TypeScript, and Tailwind CSS.

## Features

-   **Real-time GPS Location:** Fetches and displays your current latitude and longitude.
-   **GPS-based & Device Time:** Shows a comparison between the time at your physical location and your device's system time.
-   **Dynamic Location Map:** Displays your current location with a pin on an embedded Google Map.
-   **Interactive Timezone Map:** A dynamic Google Map with an overlay of world timezone boundaries. Hover over a region to see its name.
-   **World Clock:** Add and remove timezones to compare times across the globe.

## Project Setup

### Prerequisites

-   [Node.js](https://nodejs.org/) (version 18.x or newer recommended)
-   A package manager like `npm` or `yarn`.

### Installation

1.  **Clone the repository or download the files** into a new project folder.

2.  **Navigate into the project directory:**
    ```bash
    cd your-project-folder
    ```

3.  **Install dependencies:**
    ```bash
    npm install
    ```

4.  **Set Up API Keys:**
    You need two API keys for the application to function correctly.

    -   **Google Maps API Key:**
        -   Go to the [Google Cloud Console](https://console.cloud.google.com/google/maps-apis/).
        -   Enable the **"Maps JavaScript API"** and the **"Maps Embed API"**.
        -   Create a new API key.
        -   Open `index.html` and replace `YOUR_GOOGLE_MAPS_API_KEY` in the script URL with your actual key.

    -   **TimeZoneDB API Key:**
        -   Register for a free account at [TimeZoneDB](https://timezonedb.com/register).
        -   Get your API key from your dashboard.
        -   Open `src/main.ts` and replace `YOUR_TIMEZONEDB_API_KEY` with your actual key.

## Development

To run the local development server with hot-reloading:

```bash
npm run dev
```

This will start a server, typically on `http://localhost:5173`. Open this URL in your browser.

## Building for Production

To compile and bundle the application for deployment (e.g., to GitHub Pages):

```bash
npm run build
```

This command will create a `dist` directory containing the optimized, static HTML, CSS, and JavaScript files. You can then deploy the contents of this `dist` folder to any static hosting service.