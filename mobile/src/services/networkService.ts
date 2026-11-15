import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import { pingServer } from "../api/client";

export type NetworkStatusType = "online" | "offline" | "server_unavailable" | "connecting";

export interface NetworkStatus {
  state: NetworkStatusType;
  isOnline: boolean;
  isOffline: boolean;
  isServerUnavailable: boolean;
  isConnecting: boolean;
  lastCheckedAt: string;
}

type NetworkListener = (status: NetworkStatus) => void;
type ReconnectListener = () => void;

class NetworkService {
  private currentStatus: NetworkStatus = {
    state: "connecting",
    isOnline: true, // Default optimistic until first probe completes
    isOffline: false,
    isServerUnavailable: false,
    isConnecting: true,
    lastCheckedAt: new Date().toISOString()
  };

  private listeners: Set<NetworkListener> = new Set();
  private reconnectListeners: Set<ReconnectListener> = new Set();
  private isChecking = false;
  private unsubscribeNetInfo: (() => void) | null = null;
  private debounceTimer: any = null;

  constructor() {
    this.init();
  }

  private init() {
    // Listen to OS-level network state changes
    this.unsubscribeNetInfo = NetInfo.addEventListener((netState: NetInfoState) => {
      this.handleNetInfoChange(netState);
    });

    // Run initial connectivity check
    this.checkConnectivity();
  }

  private handleNetInfoChange(netState: NetInfoState) {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Debounce flap (500ms)
    this.debounceTimer = setTimeout(() => {
      if (netState.isConnected === false || netState.isInternetReachable === false) {
        this.updateStatus("offline");
      } else {
        // Device has connectivity; check backend reachability
        this.checkConnectivity();
      }
    }, 500);
  }

  /**
   * Probes network interface and verifies backend reachability.
   */
  public async checkConnectivity(): Promise<NetworkStatus> {
    if (this.isChecking) {
      return this.currentStatus;
    }

    this.isChecking = true;
    try {
      const netState = await NetInfo.fetch();

      if (netState.isConnected === false || netState.isInternetReachable === false) {
        this.updateStatus("offline");
        return this.currentStatus;
      }

      // Check backend ping with brief timeout
      const serverAlive = await pingServer();
      if (serverAlive) {
        this.updateStatus("online");
      } else {
        this.updateStatus("server_unavailable");
      }
    } catch {
      this.updateStatus("server_unavailable");
    } finally {
      this.isChecking = false;
    }

    return this.currentStatus;
  }

  private updateStatus(newState: NetworkStatusType) {
    const prevState = this.currentStatus.state;
    const isOnline = newState === "online";
    const isOffline = newState === "offline";
    const isServerUnavailable = newState === "server_unavailable";
    const isConnecting = newState === "connecting";

    this.currentStatus = {
      state: newState,
      isOnline,
      isOffline,
      isServerUnavailable,
      isConnecting,
      lastCheckedAt: new Date().toISOString()
    };

    // Notify status listeners
    this.listeners.forEach((listener) => {
      try {
        listener(this.currentStatus);
      } catch (err) {
        console.warn("Network listener error:", err);
      }
    });

    // If transitioned from offline/server_unavailable to online, trigger reconnect
    if ((prevState === "offline" || prevState === "server_unavailable") && newState === "online") {
      this.reconnectListeners.forEach((listener) => {
        try {
          listener();
        } catch (err) {
          console.warn("Reconnect listener error:", err);
        }
      });
    }
  }

  public getStatus(): NetworkStatus {
    return this.currentStatus;
  }

  public subscribe(listener: NetworkListener): () => void {
    this.listeners.add(listener);
    listener(this.currentStatus);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public onReconnect(listener: ReconnectListener): () => void {
    this.reconnectListeners.add(listener);
    return () => {
      this.reconnectListeners.delete(listener);
    };
  }

  public destroy() {
    if (this.unsubscribeNetInfo) {
      this.unsubscribeNetInfo();
      this.unsubscribeNetInfo = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.listeners.clear();
    this.reconnectListeners.clear();
  }
}

export const networkService = new NetworkService();

