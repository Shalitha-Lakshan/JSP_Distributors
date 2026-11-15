import { useEffect, useState, useCallback } from "react";
import { networkService, NetworkStatus } from "../services/networkService";

export function useNetworkStatus() {
  const [status, setStatus] = useState<NetworkStatus>(networkService.getStatus());

  useEffect(() => {
    const unsubscribe = networkService.subscribe((newStatus) => {
      setStatus(newStatus);
    });

    return unsubscribe;
  }, []);

  const refreshStatus = useCallback(async () => {
    return await networkService.checkConnectivity();
  }, []);

  return {
    ...status,
    networkState: status.state,
    refreshStatus
  };
}

