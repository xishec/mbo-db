import { useState, useEffect } from "react";
import { Button, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure } from "@heroui/react";
import Navigation from "./components/Navigation";
import LoginModal from "./components/Modals/LoginModal";
import PageContent from "./components/PageContent/PageContent";
import LoadingProgressBar from "./components/Helper/LoadingProgressBar";
import MilestoneCelebration from "./components/Helper/MilestoneCelebration";
import { DataProvider } from "./services/DataService";
import { useData } from "./services/useData";
import mboLogo from "./assets/mbo-logo.svg";

function PendingEventsGuard() {
  const { pendingCount, isAdmin, isLoggedIn, isOnline } = useData();
  const [clearing, setClearing] = useState(false);

  const canSync = isOnline && isLoggedIn && isAdmin;
  const showWarning = isOnline && pendingCount > 0 && !canSync;

  if (!showWarning) return null;

  const handleClear = async () => {
    setClearing(true);
    const { clearQueue } = await import("./services/indexedDB");
    await clearQueue();
    window.location.reload();
  };

  return (
    <Modal isOpen isDismissable={false} hideCloseButton size="sm">
      <ModalContent>
        <ModalHeader>Pending Events</ModalHeader>
        <ModalBody>
          <p className="text-default-700">
            You have <strong>{pendingCount}</strong> pending event{pendingCount !== 1 ? "s" : ""} that
            {!isLoggedIn
              ? " cannot be synced because you are not signed in."
              : " cannot be synced because your account does not have admin access."}
          </p>
          <p className="text-default-700 text-sm">
            Sign in as an admin to sync, or clear the pending events to continue.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button color="danger" variant="flat" onPress={handleClear} isLoading={clearing}>
            Clear {pendingCount} Pending Event{pendingCount !== 1 ? "s" : ""}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function BeforeUnloadGuard() {
  const { isSyncing } = useData();

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isSyncing) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isSyncing]);

  return null;
}

function AppContent() {
  const [activePage, setActivePage] = useState("home");
  const { isLoading, isLoggedIn, isOnline } = useData();

  const handlePageChange = (page: string) => {
    if (!isLoading) setActivePage(page);
  };

  const { isOpen: isLoginOpen, onOpen: onLoginOpen, onOpenChange: onLoginOpenChange } = useDisclosure();

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
      <PendingEventsGuard />
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
