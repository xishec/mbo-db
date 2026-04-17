import { useState } from "react";
import Navigation from "./components/Navigation";
import PageContent from "./components/PageContent/PageContent";
import OfflineIndicator from "./components/Helper/OfflineIndicator";
import LoadingProgressBar from "./components/Helper/LoadingProgressBar";
import MilestoneCelebration from "./components/Helper/MilestoneCelebration";
import { DataProvider } from "./services/DataService";
import { useData } from "./services/useData";
import { CURRENT_ENVIRONMENT } from "./firebase";

declare const __BUILD_TIME__: string;

function AppContent() {
  const [activePage, setActivePage] = useState("home");
  const { isLoading } = useData();

  const handlePageChange = (page: string) => {
    if (!isLoading) {
      setActivePage(page);
    }
  };

  return (
    <>
      {isLoading && <LoadingProgressBar />}
      <Navigation activePage={isLoading ? "home" : activePage} onPageChange={handlePageChange} isLoading={isLoading} />
      <PageContent activePage={isLoading ? "home" : activePage} />
      <OfflineIndicator />
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
