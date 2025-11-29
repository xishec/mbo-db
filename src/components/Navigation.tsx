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
} from "@heroui/react";
import { ChevronDownIcon } from "@heroicons/react/24/solid";
import { useState, useEffect } from "react";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import type { User as FirebaseUser } from "firebase/auth";
import { app } from "../firebase";
import LoginModal from "./LoginModal";

interface NavigationProps {
  activePage: string;
  onPageChange: (page: string) => void;
}

export default function Navigation({ activePage, onPageChange }: NavigationProps) {
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const auth = getAuth(app);

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
        <NavbarBrand>
          <img src="/mbo-logo.svg" alt="MBO Logo" className="h-8 w-8 mr-2" />
          <p className="text-xl">
            <span className="font-bold">MBO</span> Database
          </p>
        </NavbarBrand>
        <NavbarContent className="hidden sm:flex gap-4" justify="center">
          <NavbarItem isActive={activePage === "programs"} className="w-24">
            <Link
              aria-current={activePage === "programs" ? "page" : undefined}
              color={activePage === "programs" ? "primary" : "foreground"}
              href="#"
              className="inline-block w-full text-center"
              onClick={(e) => {
                e.preventDefault();
                onPageChange("programs");
              }}
            >
              Programs
            </Link>
          </NavbarItem>
          <NavbarItem isActive={activePage === "customers"} className="w-24">
            <Link
              aria-current={activePage === "customers" ? "page" : undefined}
              color={activePage === "customers" ? "primary" : "foreground"}
              href="#"
              className="inline-block w-full text-center"
              onClick={(e) => {
                e.preventDefault();
                onPageChange("customers");
              }}
            >
              DET
            </Link>
          </NavbarItem>
          <NavbarItem isActive={activePage === "integrations"} className="w-24">
            <Link
              color={activePage === "integrations" ? "primary" : "foreground"}
              href="#"
              className="inline-block w-full text-center"
              onClick={(e) => {
                e.preventDefault();
                onPageChange("integrations");
              }}
            >
              Reports
            </Link>
          </NavbarItem>
        </NavbarContent>
        <NavbarContent justify="end">
          <NavbarItem className="flex items-center">
            {user ? (
              <Dropdown placement="bottom-end">
                <DropdownTrigger>
                  <div className="flex items-center gap-2 cursor-pointer">
                    <User
                      as="button"
                      name={user.email}
                      className="transition-transform"
                      avatarProps={{
                        size: "sm",
                        name: user.email?.[0].toUpperCase(),
                      }}
                    />
                    <ChevronDownIcon className="w-4 h-4 text-default-900" />
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
    </>
  );
}
