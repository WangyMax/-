import {
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  loadAppSettings,
  resetAppSettings,
  saveAppSettings,
  type AppSettingKey,
  type AppSettings,
} from './appSettings';

interface AppSettingsContextValue {
  settings: AppSettings;
  updateSetting: <K extends AppSettingKey>(key: K, value: AppSettings[K]) => void;
  resetSettings: () => void;
}

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null);

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => loadAppSettings());
  // 开关可能被连续点击，用 ref 保证每次都基于最新值计算，避免闭包覆盖
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const value = useMemo<AppSettingsContextValue>(() => ({
    settings,
    updateSetting: (key, nextValue) => {
      const next = { ...settingsRef.current, [key]: nextValue };
      settingsRef.current = next;
      saveAppSettings(next);
      setSettings(next);
    },
    resetSettings: () => {
      const next = resetAppSettings();
      settingsRef.current = next;
      setSettings(next);
    },
  }), [settings]);

  return (
    <AppSettingsContext.Provider value={value}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings(): AppSettingsContextValue {
  const value = useContext(AppSettingsContext);
  if (!value) throw new Error('useAppSettings 必须在 AppSettingsProvider 内使用');
  return value;
}
