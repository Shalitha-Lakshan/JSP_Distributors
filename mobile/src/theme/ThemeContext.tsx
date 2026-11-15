import React, { createContext, useContext, useEffect, useState } from "react";
import { useColorScheme } from "react-native";
import { darkTheme, lightTheme, ThemeColors, ThemeMode } from "./themes";
import { secureStorage } from "../services/secureStore";

const THEME_PREF_KEY = "jsp_theme_preference";

interface ThemeContextValue {
  theme: ThemeColors;
  isDark: boolean;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => Promise<void>;
  toggleTheme: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: lightTheme,
  isDark: false,
  mode: "system",
  setMode: async () => {},
  toggleTheme: async () => {}
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const saved = await secureStorage.getItem(THEME_PREF_KEY);
        if (saved === "light" || saved === "dark" || saved === "system") {
          setModeState(saved);
        }
      } catch (err) {
        console.warn("Error reading theme preference:", err);
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []);

  const isDark =
    mode === "dark" ? true : mode === "light" ? false : systemColorScheme === "dark";

  const theme = isDark ? darkTheme : lightTheme;

  const setMode = async (newMode: ThemeMode) => {
    setModeState(newMode);
    try {
      await secureStorage.setItem(THEME_PREF_KEY, newMode);
    } catch (err) {
      console.warn("Error saving theme preference:", err);
    }
  };

  const toggleTheme = async () => {
    const nextMode: ThemeMode = isDark ? "light" : "dark";
    await setMode(nextMode);
  };

  return (
    <ThemeContext.Provider value={{ theme, isDark, mode, setMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useAppTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      theme: lightTheme,
      isDark: false,
      mode: "light",
      setMode: async () => {},
      toggleTheme: async () => {}
    };
  }
  return context;
};

