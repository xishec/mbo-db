import { useState, useEffect } from "react";
import { Button } from "@heroui/react";
import Navigation from "./components/Navigation";
import PageContent from "./components/PageContent/PageContent";
import LoadingProgressBar from "./components/Helper/LoadingProgressBar";
import MilestoneCelebration from "./components/Helper/MilestoneCelebration";
import { DataProvider } from "./services/DataService";
import { useData } from "./services/useData";
import { CURRENT_ENVIRONMENT } from "./firebase";
import mboLogo from "./assets/mbo-logo.svg";

function ModeSelector() {
  const { modeChosen, chooseOnline, chooseOffline } = useData();
  const [hasCache, setHasCache] = useState<boolean | null>(null);

  useEffect(() => {
    import("./services/indexedDB").then(({ getLastUpdated }) =>
      getLastUpdated(CURRENT_ENVIRONMENT).then((ts) => setHasCache(ts !== null))
    ).catch(() => setHasCache(false));
  }, []);

  if (modeChosen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background">
      <div className="text-center max-w-sm mx-4">
        <img src={mboLogo} alt="MBO Logo" className="h-16 w-16 mx-auto mb-6" />
        <h1 className="text-2xl font-bold mb-2">MBO Database</h1>
        <p className="text-default-500 mb-8">How would you like to start?</p>
        <div className="flex flex-col gap-3">
          <Button color="primary" size="lg" className="w-full" onPress={chooseOnline}>
            Online
          </Button>
          <Button
            variant="bordered"
            size="lg"
            className="w-full"
            onPress={chooseOffline}
            isDisabled={hasCache === false || hasCache === null}
          >
            Offline{hasCache === false ? " (no cached data)" : ""}
          </Button>
        </div>
      </div>
    </div>
  );
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
      {CURRENT_ENVIRONMENT !== "prod" && (
        <div className="fixed bottom-0 right-0 p-2 text-xs text-gray-400 pointer-events-none">
          {CURRENT_ENVIRONMENT}
        </div>
      )}
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
