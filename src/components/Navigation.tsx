import {
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  Link,
  Button,
  useDisclosure,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Badge,
  Chip,
  Modal,
  ModalContent,
  ModalBody,
  ModalFooter,
  Spinner,
} from "@heroui/react";
import { ChevronDownIcon } from "@heroicons/react/24/solid";
import { CodeBracketIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { useMemo } from "react";
import LoginModal from "./Modals/LoginModal";
import { DeveloperModal } from "./Modals/DeveloperModal";
import { ErrorsModal } from "./Modals/ErrorsModal";
import { ActivityModal } from "./Modals/ActivityModal";
import { useData } from "../services/useData";
import { findBirdEventErrors } from "../types/birdEventErrors";
import { CURRENT_ENVIRONMENT } from "../firebase";
import mboLogo from "../assets/mbo-logo.svg";

interface NavigationProps {
  activePage: string;
  onPageChange: (page: string) => void;
  isLoading: boolean;
}

export default function Navigation({ activePage, onPageChange, isLoading }: NavigationProps) {
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const { isOpen: isLogsOpen, onOpen: onLogsOpen, onClose: onLogsClose } = useDisclosure();
  const { isOpen: isErrorsOpen, onOpen: onErrorsOpen, onClose: onErrorsClose } = useDisclosure();
  const { isOpen: isActivityOpen, onOpen: onActivityOpen, onClose: onActivityClose } = useDisclosure();
  const {
    birdEventsMap,
    bandIdToBirdEventIdsMap,
    magicTable,
    pendingCount,
    lastSyncedAt,
    isOnline,
    isAdmin,
    isLoggedIn,
    userEmail,
    isSyncing,
    syncResult,
    clearSyncResult,
    selectProgram,
    dismissedConflictsMap,
    forceOffline,
    signOut: handleSignOut,
  } = useData();

  const handleLogsOpen = () => !isLoading && onLogsOpen();
  const handleErrorsOpen = () => !isLoading && onErrorsOpen();
  const handleActivityOpen = () => !isLoading && onActivityOpen();
  const handleLoginOpen = () => !isLoading && onOpen();

  const errorCount = useMemo(() => {
    const allErrors = findBirdEventErrors(bandIdToBirdEventIdsMap, birdEventsMap, magicTable);
    const severeErrors = allErrors.filter((error) => error.severity === "danger");
    const activeErrors = severeErrors.filter((error) => !dismissedConflictsMap[error.id]);
    return activeErrors.length;
  }, [bandIdToBirdEventIdsMap, birdEventsMap, magicTable, dismissedConflictsMap]);

  return (
    <>
      <Navbar maxWidth="full" classNames={{ wrapper: "px-8", base: CURRENT_ENVIRONMENT !== "prod" ? "bg-primary-400" : "" }}>
        <NavbarBrand
          className="cursor-pointer"
          onClick={() => {
            selectProgram(null);
            onPageChange("home");
          }}
        >
          <img src={mboLogo} alt="MBO Logo" className="h-8 w-8 mr-2" />
          <p className="text-xl">
            <span className="font-bold">MBO</span> Database
            {CURRENT_ENVIRONMENT !== "prod" && (
              <span className="ml-2 text-xs font-normal text-warning-600">{CURRENT_ENVIRONMENT}</span>
            )}
          </p>
          <div className="ml-4 flex items-center gap-2">
            <Badge
              content={pendingCount}
              color={isOnline ? "primary" : "secondary"}
              size="sm"
              showOutline={false}
              isInvisible={pendingCount === 0 && isOnline}
            >
              <Chip
                size="md"
                variant="flat"
                color={isOnline ? "primary" : "secondary"}
                className="cursor-pointer"
                onClick={handleActivityOpen}
              >
                {isOnline ? "Online" : "Offline"}
              </Chip>
            </Badge>
            {!isOnline && lastSyncedAt && (
              <span className="text-xs text-default-700">
                Last synced {new Date(lastSyncedAt).toLocaleDateString()} {new Date(lastSyncedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>
        </NavbarBrand>
        <NavbarContent className="hidden sm:flex gap-12" justify="center">
          {(["home", "programs", "DETs"] as const).map((page) => (
            <NavbarItem key={page} isActive={activePage === page}>
              <Link
                aria-current={activePage === page ? "page" : undefined}
                color={activePage === page ? "primary" : "foreground"}
                href="#"
                className={`inline-block text-center ${isLoading ? "pointer-events-none opacity-50" : ""}`}
                onClick={(e) => {
                  e.preventDefault();
                  if (!isLoading) {
                    selectProgram(null);
                    onPageChange(page);
                  }
                }}
              >
                {page === "DETs" ? "DETs" : page.charAt(0).toUpperCase() + page.slice(1)}
              </Link>
            </NavbarItem>
          ))}
          <Dropdown>
            <NavbarItem isActive={["search", "species", "volunteers", "reports"].includes(activePage)}>
              <DropdownTrigger>
                <Button
                  variant="light"
                  className={`text-md ${isLoading ? "pointer-events-none opacity-50" : ""} ${
                    ["search", "species", "volunteers", "reports"].includes(activePage) ? "text-primary" : "text-foreground"
                  }`}
                  endContent={<ChevronDownIcon className="w-4 h-4" />}
                >
                  More
                </Button>
              </DropdownTrigger>
            </NavbarItem>
            <DropdownMenu
              aria-label="More pages"
              onAction={(key) => {
                if (!isLoading) {
                  selectProgram(null);
                  onPageChange(key as string);
                }
              }}
            >
              <DropdownItem key="search">Search</DropdownItem>
              <DropdownItem key="species">Species</DropdownItem>
              <DropdownItem key="volunteers">Volunteers</DropdownItem>
              <DropdownItem key="reports">Reports</DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </NavbarContent>
        <NavbarContent justify="end">
          <NavbarItem>
            <Badge content={errorCount} color="danger" size="sm" showOutline={false} disableAnimation isInvisible={errorCount === 0}>
              <Button isIconOnly variant="light" onPress={handleErrorsOpen} aria-label="View errors" isDisabled={isLoading}>
                <ExclamationTriangleIcon className="w-5 h-5" />
              </Button>
            </Badge>
          </NavbarItem>
          {isAdmin && (
            <NavbarItem>
              <Button isIconOnly variant="light" onPress={handleLogsOpen} aria-label="Developer tools" isDisabled={isLoading}>
                <CodeBracketIcon className="w-5 h-5" />
              </Button>
            </NavbarItem>
          )}
          <NavbarItem className="flex items-center">
            {forceOffline ? null : isLoggedIn ? (
              <Dropdown placement="bottom-end">
                <DropdownTrigger>
                  <div className="flex items-center gap-4 cursor-pointer">
                    <span className="text-sm">{userEmail}</span>
                    <ChevronDownIcon className="w-5 h-5" />
                  </div>
                </DropdownTrigger>
                <DropdownMenu aria-label="User Actions" variant="flat">
                  <DropdownItem key="settings">Settings</DropdownItem>
                  <DropdownItem key="logout" color="danger" onPress={handleSignOut}>
                    Log Out
                  </DropdownItem>
                </DropdownMenu>
              </Dropdown>
            ) : (
              <Button color="primary" onPress={handleLoginOpen} isDisabled={isLoading}>
                Login
              </Button>
            )}
          </NavbarItem>
        </NavbarContent>
      </Navbar>
      <LoginModal isOpen={isOpen} onOpenChange={onOpenChange} />
      <ErrorsModal isOpen={isErrorsOpen} onClose={onErrorsClose} />
      <DeveloperModal isOpen={isLogsOpen} onClose={onLogsClose} />
      <ActivityModal isOpen={isActivityOpen} onClose={onActivityClose} />
      <Modal isOpen={isSyncing || syncResult !== null} isDismissable={!isSyncing} onClose={clearSyncResult} size="sm">
        <ModalContent>
          <ModalBody>
            <div className="text-center py-6">
              {isSyncing ? (
                <>
                  <Spinner size="lg" className="mb-4" />
                  <p className="text-lg font-semibold">Syncing...</p>
                  <p className="text-sm text-default-500 mt-1">Uploading events and rebuilding data</p>
                </>
              ) : syncResult === "success" ? (
                <>
                  <div className="text-4xl mb-3">✓</div>
                  <p className="text-lg font-semibold text-success">Sync Complete</p>
                </>
              ) : (
                <>
                  <div className="text-4xl mb-3">✗</div>
                  <p className="text-lg font-semibold text-danger">Sync Failed</p>
                  <p className="text-sm text-default-500 mt-1">Please try again</p>
                </>
              )}
            </div>
          </ModalBody>
          {!isSyncing && (
            <ModalFooter>
              <Button color="primary" className="w-full" onPress={clearSyncResult}>
                Close
              </Button>
            </ModalFooter>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
