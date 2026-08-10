import { useEffect, useRef, useState } from "react";
import { onValue, ref } from "firebase/database";
import { db } from "../firebase";
import { logger } from "../services/logger";

/**
 * Tracks effective RTDB reachability and increments reconnectToken whenever
 * a confirmed Firebase connection returns. A null state means connecting.
 */
export function useOnlineStatus(): { isOnline: boolean; reconnectToken: number } {
  const [networkOnline, setNetworkOnline] = useState(navigator.onLine);
  const [firebaseConnected, setFirebaseConnected] = useState<boolean | null>(null);
  const [reconnectToken, setReconnectToken] = useState(0);
  const previousFirebaseConnected = useRef<boolean | null>(null);

  useEffect(() => {
    const handleOnline = () => {
      logger.info("Network", "Back online");
      setNetworkOnline(true);
    };

    const handleOffline = () => {
      logger.warn("Network", "Gone offline");
      setNetworkOnline(false);
      setFirebaseConnected(false);
      previousFirebaseConnected.current = false;
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    return onValue(
      ref(db, ".info/connected"),
      (snapshot) => {
        const connected = networkOnline && snapshot.val() === true;
        if (connected && previousFirebaseConnected.current === false) {
          setReconnectToken((value) => value + 1);
        }
        previousFirebaseConnected.current = connected;
        setFirebaseConnected(connected);
      },
      (err) => {
        previousFirebaseConnected.current = false;
        setFirebaseConnected(false);
        logger.warn("Network", "Firebase connection check failed", err);
      }
    );
  }, [networkOnline]);

  return {
    isOnline: networkOnline && firebaseConnected !== false,
    reconnectToken,
  };
}
