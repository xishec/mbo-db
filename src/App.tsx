import { useState } from "react";
import Navigation from "./components/Navigation";
import PageContent from "./components/PageContent/PageContent";
import OfflineIndicator from "./components/OfflineIndicator";
import LoadingProgressBar from "./components/LoadingProgressBar";
import { DataProvider } from "./services/DataService";
import { useData } from "./services/useData";

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
