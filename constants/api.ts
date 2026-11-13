import Constants from "expo-constants";
import * as ReactNative from "react-native";

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;

const API_BASE_URL = extra.apiBaseUrl ?? process.env.EXPO_PUBLIC_API_BASE_URL ?? "";

/**
 * Get the API base URL.
 * - If EXPO_PUBLIC_API_BASE_URL is set, use it.
 * - Local web dev: Metro serves the app on 8081 and the API runs on 3000.
 * - Otherwise use same-origin relative URLs (the Docker deployment).
 */
export function getApiBaseUrl(): string {
  if (API_BASE_URL) {
    return API_BASE_URL.replace(/\/$/, "");
  }

  if (ReactNative.Platform.OS === "web" && typeof window !== "undefined" && window.location) {
    const { protocol, hostname, port } = window.location;
    if (port === "8081" && /^(localhost|127\.0\.0\.1)$/.test(hostname)) {
      return `${protocol}//${hostname}:3000`;
    }
  }

  return "";
}
