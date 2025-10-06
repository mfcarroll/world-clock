// capacitor.config.ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ca.matthewcarroll.geotime',
  appName: 'GeoTime',
  webDir: 'dist',
  server: {
    hostname: 'geotime.local',
    androidScheme: 'https',
    iosScheme: 'https',
  },
};

export default config;