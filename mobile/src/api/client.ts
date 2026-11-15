import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { secureStorage } from "../services/secureStore";

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || "https://jsp-distributors.onrender.com";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 50000, // 50-second timeout for server response & free-tier cold-start tolerance
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json"
  }
});

/**
 * Health-check ping to wake up free-tier hosted instances or test connectivity
 */
export const pingServer = async (): Promise<boolean> => {
  try {
    const res = await apiClient.get("/", { timeout: 15000 });
    return res.status === 200;
  } catch {
    return false;
  }
};

// Event listener mechanism for session expiration (401)
type UnauthorizedListener = () => void;
const unauthorizedListeners: Set<UnauthorizedListener> = new Set();

export const onUnauthorized = (listener: UnauthorizedListener) => {
  unauthorizedListeners.add(listener);
  return () => {
    unauthorizedListeners.delete(listener);
  };
};

// Request Interceptor: Attach Bearer token from secure storage
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      const token = await secureStorage.getToken();
      if (token && !config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (err) {
      console.warn("Error retrieving auth token for request:", err);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Format error messages & handle 401 session expiration
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ message?: string }>) => {
    if (error.response?.status === 401) {
      // Clear local credentials on token expiration
      await secureStorage.clearAll();
      unauthorizedListeners.forEach((listener) => listener());
    }

    // Enhance user-facing error message
    let message = "An unexpected error occurred. Please try again.";

    if (error.code === "ECONNABORTED" || error.message.includes("timeout")) {
      message =
        "Server connection timed out. The server may be waking up from sleep. Please try again in a moment.";
    } else if (!error.response) {
      message =
        "Network connection failed. Please check your internet connection or server availability.";
    } else if (error.response.data?.message) {
      message = error.response.data.message;
    }

    const enhancedError = new Error(message);
    (enhancedError as any).status = error.response?.status;
    (enhancedError as any).originalError = error;

    return Promise.reject(enhancedError);
  }
);

