import {
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  NavbarMenu,
  NavbarMenuItem,
  NavbarMenuToggle,
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
  Tooltip,
} from "@heroui/react";
import { ChevronDownIcon } from "@heroicons/react/24/solid";
import { CodeBracketIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import LoginModal from "./Modals/LoginModal";
import { DeveloperModal } from "./Modals/DeveloperModal";
import { ErrorsModal } from "./Modals/ErrorsModal";
import { ActivityModal } from "./Modals/ActivityModal";
import { useData } from "../services/useData";
import { CURRENT_ENVIRONMENT } from "../firebase";
import mboLogo from "../assets/mbo-logo.svg";

interface NavigationProps {
  activePage: string;
  onPageChange: (page: string) => void;
  isLoading: boolean;
}

export default function Navigation({ activePage, onPageChange, isLoading }: NavigationProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const { isOpen: isLogsOpen, onOpen: onLogsOpen, onClose: onLogsClose } = useDisclosure();
  const { isOpen: isErrorsOpen, onOpen: onErrorsOpen, onClose: onErrorsClose } = useDisclosure();
  const { isOpen: isActivityOpen, onOpen: onActivityOpen, onClose: onActivityClose } = useDisclosure();
  const {
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
    signOut: handleSignOut,
  } = useData();

  const handleLogsOpen = () => !isLoading && onLogsOpen();
  const handleErrorsOpen = () => !isLoading && onErrorsOpen();
  const handleActivityOpen = () => !isLoading && onActivityOpen();
  const handleLoginOpen = () => !isLoading && onOpen();

  // Conflict scan is expensive (iterates all bands). We no longer compute it
  // eagerly — the badge is hidden and the full scan runs only when the admin
  // opens the Errors modal. This keeps the save click instant on slow CPUs.
  const errorCount = 0;

  return (
    <>
      <Navbar
        maxWidth="full"
        isMenuOpen={isMenuOpen}
        onMenuOpenChange={setIsMenuOpen}
        classNames={{ wrapper: "px-4 md:px-8", base: CURRENT_ENVIRONMENT !== "prod" ? "bg-primary-400" : "" }}
      >
        <NavbarBrand
          className="cursor-pointer"
          onClick={() => {
            selectProgram(null);
            onPageChange("home");
          }}
        >
          <img src={mboLogo} alt="MBO Logo" className="h-6 w-6 md:h-8 md:w-8 mr-2" />
          <p className="text-lg md:text-xl">
            <span className="font-bold">MBO</span> <span className="hidden sm:inline">Database</span>
            {CURRENT_ENVIRONMENT !== "prod" && (
              <span className="ml-2 text-xs font-normal text-warning-600">{CURRENT_ENVIRONMENT}</span>
            )}
          </p>
          {isLoggedIn && (
            <div className="ml-2 md:ml-4 hidden sm:flex items-center gap-2">
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
                  className="cursor-pointer text-sm"
                  onClick={handleActivityOpen}
                >
                  {isOnline ? "Online" : "Offline"}
                </Chip>
              </Badge>
              {!isOnline && lastSyncedAt && (
                <span className="text-xs text-default-700">
                  Data from {new Date(lastSyncedAt).toLocaleDateString()}{" "}
                  {new Date(lastSyncedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </div>
          )}
        </NavbarBrand>
        {isLoggedIn && <NavbarMenuToggle className="sm:hidden" />}
        <NavbarContent className="hidden md:hidden" justify="center" />
        {isLoggedIn && (
          <NavbarContent className="hidden sm:flex gap-12" justify="center">
            {(["home", "programs", "DETs"] as const).map((page) => {
              const disabled = isLoading || (page === "DETs" && !isOnline);
              const link = (
                <Link
                  aria-current={activePage === page ? "page" : undefined}
                  color={activePage === page ? "primary" : "foreground"}
                  href="#"
                  className={`inline-block text-center ${disabled ? "pointer-events-none opacity-50" : ""}`}
                  onClick={(e) => {
                    e.preventDefault();
                    if (!disabled) {
                      selectProgram(null);
                      onPageChange(page);
                    }
                  }}
                >
                  {page === "DETs" ? "DETs" : page.charAt(0).toUpperCase() + page.slice(1)}
                </Link>
              );
              return (
                <NavbarItem key={page} isActive={activePage === page}>
                  {page === "DETs" && !isOnline ? <Tooltip content="Requires internet connection">{link}</Tooltip> : link}
                </NavbarItem>
              );
            })}
            <Dropdown>
              <NavbarItem isActive={["search", "species", "volunteers", "bands", "reports", "funstats", "trends"].includes(activePage)}>
                <DropdownTrigger>
                  <Button
                    variant="light"
                    className={`text-md ${isLoading ? "pointer-events-none opacity-50" : ""} ${
                      ["search", "species", "volunteers", "bands", "reports", "funstats", "trends"].includes(activePage)
                        ? "text-primary"
                        : "text-foreground"
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
                <DropdownItem key="bands">Bands</DropdownItem>
                <DropdownItem key="funstats">Fun Stats</DropdownItem>
                <DropdownItem key="reports">Program Report</DropdownItem>
                <DropdownItem key="trends">Trends</DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </NavbarContent>
        )}
        <NavbarContent className="hidden sm:flex" justify="end">
          {isAdmin && (
          <NavbarItem className="mr-2">
            <Badge
              content={errorCount}
              color="secondary"
              size="sm"
              showOutline={false}
              disableAnimation
              isInvisible={errorCount === 0}
            >
              <Button
                isIconOnly
                variant="light"
                onPress={handleErrorsOpen}
                aria-label="View errors"
                isDisabled={isLoading}
              >
                <ExclamationTriangleIcon className="w-5 h-5" />
              </Button>
            </Badge>
          </NavbarItem>
          )}
          {isAdmin && (
            <NavbarItem>
              <Button
                isIconOnly
                variant="light"
                onPress={handleLogsOpen}
                aria-label="Developer tools"
                isDisabled={isLoading}
              >
                <CodeBracketIcon className="w-5 h-5" />
              </Button>
            </NavbarItem>
          )}
          <NavbarItem className="flex items-center">
            {!isOnline ? null : isLoggedIn ? (
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
        {isLoggedIn && (
          <NavbarMenu>
            <NavbarMenuItem>
              <div className="flex items-center gap-2 py-2">
                <Badge
                  content={pendingCount}
                  color={isOnline ? "primary" : "secondary"}
                  size="sm"
                  showOutline={false}
                  isInvisible={pendingCount === 0 && isOnline}
                >
                  <Chip
                    size="sm"
                    variant="flat"
                    color={isOnline ? "primary" : "secondary"}
                    className="cursor-pointer text-xs"
                    onClick={handleActivityOpen}
                  >
                    {isOnline ? "Online" : "Offline"}
                  </Chip>
                </Badge>
                {!isOnline && lastSyncedAt && (
                  <span className="text-xs text-default-700">
                    {new Date(lastSyncedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            </NavbarMenuItem>
            {isAdmin && (
              <>
                <NavbarMenuItem>
                  <Link
                    className="w-full"
                    color="foreground"
                    size="lg"
                    onPress={() => {
                      handleErrorsOpen();
                      setIsMenuOpen(false);
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <ExclamationTriangleIcon className="w-5 h-5" />
                      <span>Errors {errorCount > 0 && `(${errorCount})`}</span>
                    </div>
                  </Link>
                </NavbarMenuItem>
                <NavbarMenuItem>
                  <Link
                    className="w-full"
                    color="foreground"
                    size="lg"
                    onPress={() => {
                      handleLogsOpen();
                      setIsMenuOpen(false);
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <CodeBracketIcon className="w-5 h-5" />
                      <span>Developer Tools</span>
                    </div>
                  </Link>
                </NavbarMenuItem>
              </>
            )}
            <NavbarMenuItem>
              <Link
                className="w-full"
                color={activePage === "home" ? "primary" : "foreground"}
                size="lg"
                onPress={() => {
                  selectProgram(null);
                  onPageChange("home");
                  setIsMenuOpen(false);
                }}
              >
                Home
              </Link>
            </NavbarMenuItem>
            <NavbarMenuItem>
              <Link
                className="w-full"
                color={activePage === "programs" ? "primary" : "foreground"}
                size="lg"
                onPress={() => {
                  selectProgram(null);
                  onPageChange("programs");
                  setIsMenuOpen(false);
                }}
              >
                Programs
              </Link>
            </NavbarMenuItem>
            <NavbarMenuItem>
              <Link
                className="w-full"
                color={activePage === "DETs" ? "primary" : "foreground"}
                size="lg"
                onPress={() => {
                  if (isOnline) {
                    selectProgram(null);
                    onPageChange("DETs");
                    setIsMenuOpen(false);
                  }
                }}
              >
                DETs {!isOnline && "(Offline)"}
              </Link>
            </NavbarMenuItem>
            <NavbarMenuItem>
              <Link
                className="w-full"
                color={activePage === "search" ? "primary" : "foreground"}
                size="lg"
                onPress={() => {
                  selectProgram(null);
                  onPageChange("search");
                  setIsMenuOpen(false);
                }}
              >
                Search
              </Link>
            </NavbarMenuItem>
            <NavbarMenuItem>
              <Link
                className="w-full"
                color={activePage === "species" ? "primary" : "foreground"}
                size="lg"
                onPress={() => {
                  selectProgram(null);
                  onPageChange("species");
                  setIsMenuOpen(false);
                }}
              >
                Species
              </Link>
            </NavbarMenuItem>
            <NavbarMenuItem>
              <Link
                className="w-full"
                color={activePage === "volunteers" ? "primary" : "foreground"}
                size="lg"
                onPress={() => {
                  selectProgram(null);
                  onPageChange("volunteers");
                  setIsMenuOpen(false);
                }}
              >
                Volunteers
              </Link>
            </NavbarMenuItem>
            <NavbarMenuItem>
              <Link
                className="w-full"
                color={activePage === "bands" ? "primary" : "foreground"}
                size="lg"
                onPress={() => {
                  selectProgram(null);
                  onPageChange("bands");
                  setIsMenuOpen(false);
                }}
              >
                Bands
              </Link>
            </NavbarMenuItem>
            <NavbarMenuItem>
              <Link
                className="w-full"
                color={activePage === "funstats" ? "primary" : "foreground"}
                size="lg"
                onPress={() => {
                  selectProgram(null);
                  onPageChange("funstats");
                  setIsMenuOpen(false);
                }}
              >
                Fun Stats
              </Link>
            </NavbarMenuItem>
            <NavbarMenuItem>
              <Link
                className="w-full"
                color={activePage === "reports" ? "primary" : "foreground"}
                size="lg"
                onPress={() => {
                  selectProgram(null);
                  onPageChange("reports");
                  setIsMenuOpen(false);
                }}
              >
                Program Report
              </Link>
            </NavbarMenuItem>
            <NavbarMenuItem>
              <Link
                className="w-full"
                color={activePage === "trends" ? "primary" : "foreground"}
                size="lg"
                onPress={() => {
                  selectProgram(null);
                  onPageChange("trends");
                  setIsMenuOpen(false);
                }}
              >
                Trends
              </Link>
            </NavbarMenuItem>
            {isOnline && (
              <NavbarMenuItem>
                <Link
                  className="w-full"
                  color="foreground"
                  size="lg"
                  onPress={() => {
                    setIsMenuOpen(false);
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{userEmail}</span>
                  </div>
                </Link>
              </NavbarMenuItem>
            )}
            {isOnline && isLoggedIn && (
              <NavbarMenuItem>
                <Link
                  className="w-full"
                  color="danger"
                  size="lg"
                  onPress={() => {
                    handleSignOut();
                    setIsMenuOpen(false);
                  }}
                >
                  Log Out
                </Link>
              </NavbarMenuItem>
            )}
          </NavbarMenu>
        )}
      </Navbar>
      <LoginModal isOpen={isOpen} onOpenChange={onOpenChange} />
      <ErrorsModal isOpen={isErrorsOpen} onClose={onErrorsClose} />
      <DeveloperModal isOpen={isLogsOpen} onClose={onLogsClose} />
      <ActivityModal isOpen={isActivityOpen} onClose={onActivityClose} />
      <Modal
        isOpen={isSyncing || syncResult !== null}
        isDismissable={false}
        hideCloseButton
        onClose={clearSyncResult}
        size="sm"
      >
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
