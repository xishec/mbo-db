import { useState, useEffect } from "react";
import { Button, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Spinner } from "@heroui/react";
import Navigation from "./components/Navigation";
import PageContent from "./components/PageContent/PageContent";
import LoadingProgressBar from "./components/Helper/LoadingProgressBar";
import MilestoneCelebration from "./components/Helper/MilestoneCelebration";
import { DataProvider } from "./services/DataService";
import { useData } from "./services/useData";
import { useOnlineStatus } from "./hooks/useOnlineStatus";
import { CURRENT_ENVIRONMENT } from "./firebase";
import mboLogo from "./assets/mbo-logo.svg";

function formatCacheAge(ms: number): string {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""}`;
  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? "s" : ""}`;
}

function ModeSelector() {
  const { modeChosen, chooseOnline, chooseOffline, forceOffline } = useData();
  const [hasCache, setHasCache] = useState<boolean | null>(null);
  const [cacheAge, setCacheAge] = useState<number | null>(null);
  const [showStaleWarning, setShowStaleWarning] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setHasCache(false), 3000);
    import("./services/indexedDB").then(({ getDataFromIndexedDB, getLastUpdated }) =>
      Promise.all([
        getDataFromIndexedDB(CURRENT_ENVIRONMENT),
        getLastUpdated(CURRENT_ENVIRONMENT),
      ]).then(([data, ts]) => {
        clearTimeout(timeout);
        setHasCache(data !== null);
        if (ts) setCacheAge(Date.now() - ts);
      })
    ).catch(() => { clearTimeout(timeout); setHasCache(false); });
  }, []);

  useEffect(() => {
    if (modeChosen || hasCache === null) return;

    if (!forceOffline) {
      // Online — go straight in
      chooseOnline();
    } else if (hasCache) {
      // Offline with cache — check staleness
      const ONE_DAY = 24 * 60 * 60 * 1000;
      if (cacheAge && cacheAge > ONE_DAY) {
        setShowStaleWarning(true);
      } else {
        chooseOffline();
      }
    }
    // Offline without cache — show waiting screen
  }, [hasCache, forceOffline, modeChosen, chooseOnline, chooseOffline, cacheAge]);

  if (modeChosen) return null;

  // Offline with no cache — can't proceed
  if (forceOffline && hasCache === false) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background">
        <div className="text-center max-w-sm mx-4">
          <img src={mboLogo} alt="MBO Logo" className="h-16 w-16 mx-auto mb-6" />
          <h1 className="text-2xl font-bold mb-2">MBO Database</h1>
          <p className="text-default-700 mt-4">No cached data available. Connect to WiFi and reload.</p>
        </div>
      </div>
    );
  }

  // Stale cache warning
  if (showStaleWarning) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background">
        <div className="text-center max-w-sm mx-4">
          <img src={mboLogo} alt="MBO Logo" className="h-16 w-16 mx-auto mb-6" />
          <h1 className="text-2xl font-bold mb-2">MBO Database</h1>
        </div>
        <Modal isOpen isDismissable={false} hideCloseButton size="sm">
          <ModalContent>
            <ModalHeader>Stale Cache</ModalHeader>
            <ModalBody>
              <p className="text-default-700">
                Your cached data is <strong>{cacheAge ? formatCacheAge(cacheAge) : ""}</strong> old.
                Connect to WiFi to get the latest data, or continue with cached data.
              </p>
            </ModalBody>
            <ModalFooter>
              <Button
                color="warning"
                variant="flat"
                onPress={() => { setShowStaleWarning(false); chooseOffline(); }}
              >
                Continue Offline
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </div>
    );
  }

  // Loading state while checking cache
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background">
      <div className="text-center max-w-sm mx-4">
        <img src={mboLogo} alt="MBO Logo" className="h-16 w-16 mx-auto mb-6" />
        <h1 className="text-2xl font-bold mb-2">MBO Database</h1>
        <Spinner size="lg" className="mt-4" />
      </div>
    </div>
  );
}

function ConnectionGuard() {
  const { forceOffline, modeChosen } = useData();
  const actualIsOnline = useOnlineStatus();

  if (!modeChosen) return null;

  // Online mode but lost connection
  if (!forceOffline && !actualIsOnline) {
    return (
      <Modal isOpen isDismissable={false} hideCloseButton size="sm">
        <ModalContent>
          <ModalHeader>Connection Lost</ModalHeader>
          <ModalBody>
            <p className="text-default-700">
              The app requires WiFi to work in online mode. Please reconnect to continue.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button
              color="warning"
              variant="flat"
              onPress={() => window.location.reload()}
            >
              Switch to Offline Mode
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    );
  }

  // Offline mode but connection available
  if (forceOffline && actualIsOnline) {
    return (
      <Modal isOpen isDismissable={false} hideCloseButton size="sm">
        <ModalContent>
          <ModalHeader>Connection Available</ModalHeader>
          <ModalBody>
            <p className="text-default-700">
              WiFi is available. Switch to online mode to get the latest data and sync pending changes.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button
              color="primary"
              onPress={() => window.location.reload()}
            >
              Switch to Online Mode
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    );
  }

  return null;
}

function BeforeUnloadGuard() {
  const { isSyncing } = useData();

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isSyncing) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isSyncing]);

  return null;
}

function AppContent() {
  const [activePage, setActivePage] = useState("home");
  const { isLoading, modeChosen } = useData();

  const handlePageChange = (page: string) => {
    if (!isLoading) {
      setActivePage(page);
    }
  };

  if (!modeChosen) return <ModeSelector />;

  return (
    <>
      <LoadingProgressBar />
      <Navigation activePage={isLoading ? "home" : activePage} onPageChange={handlePageChange} isLoading={isLoading} />
      <PageContent activePage={isLoading ? "home" : activePage} />
      <MilestoneCelebration />
      <ConnectionGuard />
      <BeforeUnloadGuard />
    </>
  );
}

function App() {
  return (
    <DataProvider>
      <AppContent />
    </DataProvider>
  );
}

export default App;
