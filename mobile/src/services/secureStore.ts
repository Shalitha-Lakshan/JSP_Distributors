import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const TOKEN_KEY = "jsp_auth_token";
const USER_KEY = "jsp_auth_user";

export const secureStorage = {
  async getToken(): Promise<string | null> {
    try {
      if (Platform.OS === "web") {
        return typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
      }
      return await SecureStore.getItemAsync(TOKEN_KEY);
    } catch (err) {
      console.warn("secureStorage.getToken error:", err);
      return null;
    }
  },

  async setToken(token: string): Promise<void> {
    try {
      if (Platform.OS === "web") {
        if (typeof window !== "undefined") {
          localStorage.setItem(TOKEN_KEY, token);
        }
        return;
      }
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    } catch (err) {
      console.warn("secureStorage.setToken error:", err);
    }
  },

  async removeToken(): Promise<void> {
    try {
      if (Platform.OS === "web") {
        if (typeof window !== "undefined") {
          localStorage.removeItem(TOKEN_KEY);
        }
        return;
      }
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    } catch (err) {
      console.warn("secureStorage.removeToken error:", err);
    }
  },

  async getUser<T>(): Promise<T | null> {
    try {
      let raw: string | null = null;
      if (Platform.OS === "web") {
        raw = typeof window !== "undefined" ? localStorage.getItem(USER_KEY) : null;
      } else {
        raw = await SecureStore.getItemAsync(USER_KEY);
      }
      return raw ? (JSON.parse(raw) as T) : null;
    } catch (err) {
      console.warn("secureStorage.getUser error:", err);
      return null;
    }
  },

  async setUser<T>(user: T): Promise<void> {
    try {
      const raw = JSON.stringify(user);
      if (Platform.OS === "web") {
        if (typeof window !== "undefined") {
          localStorage.setItem(USER_KEY, raw);
        }
        return;
      }
      await SecureStore.setItemAsync(USER_KEY, raw);
    } catch (err) {
      console.warn("secureStorage.setUser error:", err);
    }
  },

  async clearAll(): Promise<void> {
    await this.removeToken();
    try {
      if (Platform.OS === "web") {
        if (typeof window !== "undefined") {
          localStorage.removeItem(USER_KEY);
        }
        return;
      }
      await SecureStore.deleteItemAsync(USER_KEY);
    } catch (err) {
      console.warn("secureStorage.clearAll error:", err);
    }
  },

  async getItem(key: string): Promise<string | null> {
    try {
      if (Platform.OS === "web") {
        return typeof window !== "undefined" ? localStorage.getItem(key) : null;
      }
      return await SecureStore.getItemAsync(key);
    } catch (err) {
      console.warn(`secureStorage.getItem(${key}) error:`, err);
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      if (Platform.OS === "web") {
        if (typeof window !== "undefined") {
          localStorage.setItem(key, value);
        }
        return;
      }
      await SecureStore.setItemAsync(key, value);
    } catch (err) {
      console.warn(`secureStorage.setItem(${key}) error:`, err);
    }
  }
};

