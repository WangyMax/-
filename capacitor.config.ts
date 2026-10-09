import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fitcustom.pro',
  appName: 'FitCustom Pro',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
