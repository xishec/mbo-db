import { useState, useEffect } from "react";
import { logger } from "../services/logger";

/**
 * Hook to track online/offline status
 * Returns true if online, false if offline
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      logger.info("Network", "Back online");
      setIsOnline(true);
    };

    const handleOffline = () => {
      logger.warn("Network", "Gone offline");
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}
