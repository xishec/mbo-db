import { useState, useEffect } from "react";
import { Button, Spinner, useDisclosure } from "@heroui/react";
import Navigation from "./components/Navigation";
import LoginModal from "./components/Modals/LoginModal";
import PageContent from "./components/PageContent/PageContent";
import Trends from "./components/PageContent/Trends";
import LoadingProgressBar from "./components/Helper/LoadingProgressBar";
import MilestoneCelebration from "./components/Helper/MilestoneCelebration";
import { DataProvider } from "./services/DataService";
import { useData } from "./services/useData";
import mboLogo from "./assets/mbo-logo.svg";

function BeforeUnloadGuard() {
  const { isSyncing } = useData();

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isSyncing) {
        e.preventDefault();
        e.returnValue = ''; // Required for Chrome/modern browsers
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isSyncing]);

  return null;
}

const VALID_PAGES = new Set(["home", "programs", "search", "DETs", "species", "volunteers", "bands", "funstats", "reports", "trends"]);
const PUBLIC_PAGES = new Set(["trends"]);

function getPageFromHash(): string {
  const hash = window.location.hash.slice(1);
  return VALID_PAGES.has(hash) ? hash : "home";
}

function AppContent() {
  const [activePage, setActivePage] = useState(getPageFromHash);
  const { isLoading, isLoggedIn, isOnline, authReady } = useData();

  const handlePageChange = (page: string) => {
    if (!isLoading) {
      setActivePage(page);
      window.location.hash = page === "home" ? "" : page;
    }
  };

  useEffect(() => {
    const onHashChange = () => setActivePage(getPageFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const { isOpen: isLoginOpen, onOpen: onLoginOpen, onOpenChange: onLoginOpenChange } = useDisclosure();

  // Public pages don't need auth but still show navigation
  if (PUBLIC_PAGES.has(activePage)) {
    return (
      <>
        <Navigation activePage={activePage} onPageChange={handlePageChange} isLoading={false} />
        <Trends />
        <p className="fixed bottom-4 left-4 text-xs text-default-400 z-50">Build: {__BUILD_TIME__}</p>
      </>
    );
  }

  // Wait for Firebase auth to resolve before showing login
  if (isOnline && !authReady) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Spinner size="lg" />
      </div>
    );
  }

  // Online but not logged in — show sign-in prompt
  if (isOnline && !isLoggedIn) {
    return (
      <>
        <div className="flex items-center justify-center min-h-screen bg-background">
          <div className="text-center max-w-sm mx-4">
            <img src={mboLogo} alt="MBO Logo" className="h-16 w-16 mx-auto mb-6" />
            <h1 className="text-2xl font-bold mb-2">MBO Database</h1>
            <p className="text-default-700 mb-6">Please sign in to continue.</p>
            <Button color="primary" onPress={onLoginOpen}>Login</Button>
          </div>
        </div>
        <LoginModal isOpen={isLoginOpen} onOpenChange={onLoginOpenChange} />
      </>
    );
  }

  return (
    <>
      <LoadingProgressBar />
      <Navigation activePage={isLoading ? "home" : activePage} onPageChange={handlePageChange} isLoading={isLoading} />
      <PageContent activePage={isLoading ? "home" : activePage} />
      <MilestoneCelebration />
      <BeforeUnloadGuard />
      <p className="fixed bottom-4 left-4 text-xs text-default-400 z-50">Build: {__BUILD_TIME__}</p>
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
