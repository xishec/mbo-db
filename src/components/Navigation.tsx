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
  User,
  Badge,
  Chip,
} from "@heroui/react";
import { ChevronDownIcon } from "@heroicons/react/24/solid";
import { CodeBracketIcon, ExclamationTriangleIcon, ArrowPathIcon, ClockIcon } from "@heroicons/react/24/outline";
import { useState, useEffect, useMemo } from "react";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import type { User as FirebaseUser } from "firebase/auth";
import { app } from "../firebase";
import LoginModal from "./Modals/LoginModal";
import { DeveloperModal } from "./Modals/DeveloperModal";
import { ErrorsModal } from "./Modals/ErrorsModal";
import { SyncQueueModal } from "./Modals/SyncQueueModal";
import { BirdEventHistoryModal } from "./Modals/BirdEventHistoryModal";
import { useData } from "../services/useData";
import { findConflicts } from "../types/conflicts";
import mboLogo from "../assets/mbo-logo.svg";

interface NavigationProps {
  activePage: string;
  onPageChange: (page: string) => void;
}

export default function Navigation({ activePage, onPageChange }: NavigationProps) {
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const { isOpen: isLogsOpen, onOpen: onLogsOpen, onClose: onLogsClose } = useDisclosure();
  const { isOpen: isErrorsOpen, onOpen: onErrorsOpen, onClose: onErrorsClose } = useDisclosure();
  const { isOpen: isSyncQueueOpen, onOpen: onSyncQueueOpen, onClose: onSyncQueueClose } = useDisclosure();
  const { isOpen: isHistoryOpen, onOpen: onHistoryOpen, onClose: onHistoryClose } = useDisclosure();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const auth = getAuth(app);
  const {
    birdEventsMap,
    bandIdToBirdEventIdsMap,
    magicTable,
    pendingCount,
    isOnline,
    syncQueue,
    selectProgram,
    dismissedConflictsMap,
  } = useData();

  // Calculate error count
  const errorCount = useMemo(() => {
    return (
      findConflicts(bandIdToBirdEventIdsMap, birdEventsMap, magicTable).length -
      Object.keys(dismissedConflictsMap).length
    );
  }, [bandIdToBirdEventIdsMap, birdEventsMap, magicTable, dismissedConflictsMap]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return () => unsubscribe();
  }, [auth]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <>
      <Navbar maxWidth="full" classNames={{ wrapper: "px-8" }}>
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
                onClick={onSyncQueueOpen}
              >
                {isOnline ? "Online" : "Offline"}
              </Chip>
            </Badge>
            {isOnline && (
              <Button isIconOnly variant="light" aria-label="Sync" onPress={() => syncQueue()}>
                <ArrowPathIcon className="w-5 h-5" />
              </Button>
            )}
          </div>
        </NavbarBrand>
        <NavbarContent className="hidden sm:flex gap-16" justify="center">
          <NavbarItem isActive={activePage === "home"}>
            <Link
              aria-current={activePage === "home" ? "page" : undefined}
              color={activePage === "home" ? "primary" : "foreground"}
              href="#"
              className="inline-block text-center"
              onClick={(e) => {
                e.preventDefault();
                selectProgram(null);
                onPageChange("home");
              }}
            >
              Home
            </Link>
          </NavbarItem>
          <NavbarItem isActive={activePage === "programs"}>
            <Link
              aria-current={activePage === "programs" ? "page" : undefined}
              color={activePage === "programs" ? "primary" : "foreground"}
              href="#"
              className="inline-block text-center"
              onClick={(e) => {
                e.preventDefault();
                selectProgram(null);
                onPageChange("programs");
              }}
            >
              Programs
            </Link>
          </NavbarItem>
          <NavbarItem isActive={activePage === "search"}>
            <Link
              aria-current={activePage === "search" ? "page" : undefined}
              color={activePage === "search" ? "primary" : "foreground"}
              href="#"
              className="inline-block text-center"
              onClick={(e) => {
                e.preventDefault();
                selectProgram(null);
                onPageChange("search");
              }}
            >
              Search
            </Link>
          </NavbarItem>
          <NavbarItem isActive={activePage === "customers"}>
            <Link
              aria-current={activePage === "customers" ? "page" : undefined}
              color={activePage === "customers" ? "primary" : "foreground"}
              href="#"
              className="inline-block text-center"
              onClick={(e) => {
                e.preventDefault();
                selectProgram(null);
                onPageChange("customers");
              }}
            >
              DET
            </Link>
          </NavbarItem>
          <NavbarItem isActive={activePage === "integrations"}>
            <Link
              color={activePage === "integrations" ? "primary" : "foreground"}
              href="#"
              className="inline-block text-center"
              onClick={(e) => {
                e.preventDefault();
                selectProgram(null);
                onPageChange("integrations");
              }}
            >
              Reports
            </Link>
          </NavbarItem>
        </NavbarContent>
        <NavbarContent justify="end">
          <NavbarItem>
            <Button isIconOnly variant="light" onPress={onHistoryOpen} aria-label="View bird event history">
              <ClockIcon className="w-5 h-5" />
            </Button>
          </NavbarItem>
          <NavbarItem>
            <Badge content={errorCount} color="danger" size="sm" showOutline={false} isInvisible={errorCount === 0}>
              <Button isIconOnly variant="light" onPress={onErrorsOpen} aria-label="View errors">
                <ExclamationTriangleIcon className="w-5 h-5" />
              </Button>
            </Badge>
          </NavbarItem>
          <NavbarItem>
            <Button isIconOnly variant="light" onPress={onLogsOpen} aria-label="View logs">
              <CodeBracketIcon className="w-5 h-5" />
            </Button>
          </NavbarItem>
          <NavbarItem className="flex items-center">
            {user ? (
              <Dropdown placement="bottom-end">
                <DropdownTrigger>
                  <div className="flex items-center gap-4 cursor-pointer">
                    <User
                      as="button"
                      name={user.email}
                      className="transition-transform"
                      avatarProps={{
                        size: "sm",
                        name: user.email?.[0].toUpperCase(),
                      }}
                    />
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
              <Button color="primary" onPress={onOpen}>
                Login
              </Button>
            )}
          </NavbarItem>
        </NavbarContent>
      </Navbar>
      <LoginModal isOpen={isOpen} onOpenChange={onOpenChange} />
      <ErrorsModal isOpen={isErrorsOpen} onClose={onErrorsClose} />
      <DeveloperModal isOpen={isLogsOpen} onClose={onLogsClose} />
      <SyncQueueModal isOpen={isSyncQueueOpen} onClose={onSyncQueueClose} />
      <BirdEventHistoryModal isOpen={isHistoryOpen} onClose={onHistoryClose} />
    </>
  );
}
