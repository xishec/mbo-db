import {
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  Link,
  Button,
  useDisclosure,
} from "@heroui/react";
import LoginModal from "./LoginModal";

interface NavigationProps {
  activePage: string;
  onPageChange: (page: string) => void;
}

export default function Navigation({ activePage, onPageChange }: NavigationProps) {
  const { isOpen, onOpen, onOpenChange } = useDisclosure();

  return (
    <>
      <Navbar maxWidth="full">
      <NavbarBrand>
        <img src="/mbo-logo.svg" alt="MBO Logo" className="h-8 w-8 mr-2" />
        <p className="text-xl">
          <span className="font-bold">MBO</span> Database
        </p>
      </NavbarBrand>
      <NavbarContent className="hidden sm:flex gap-4" justify="center">
        <NavbarItem isActive={activePage === 'captures'} className="w-24">
          <Link 
            aria-current={activePage === 'captures' ? 'page' : undefined}
            color={activePage === 'captures' ? 'primary' : 'foreground'}
            href="#"
            className="inline-block w-full text-center"
            onClick={(e) => {
              e.preventDefault();
              onPageChange('captures');
            }}
          >
            Captures
          </Link>
        </NavbarItem>
        <NavbarItem isActive={activePage === 'customers'} className="w-24">
          <Link 
            aria-current={activePage === 'customers' ? 'page' : undefined}
            color={activePage === 'customers' ? 'primary' : 'foreground'}
            href="#"
            className="inline-block w-full text-center"
            onClick={(e) => {
              e.preventDefault();
              onPageChange('customers');
            }}
          >
            DET
          </Link>
        </NavbarItem>
        <NavbarItem isActive={activePage === 'integrations'} className="w-24">
          <Link 
            color={activePage === 'integrations' ? 'primary' : 'foreground'}
            href="#"
            className="inline-block w-full text-center"
            onClick={(e) => {
              e.preventDefault();
              onPageChange('integrations');
            }}
          >
            Reports
          </Link>
        </NavbarItem>
      </NavbarContent>
      <NavbarContent justify="end">
        <NavbarItem>
          <Button radius="full" color="primary" onPress={onOpen}>
            Login
          </Button>
        </NavbarItem>
      </NavbarContent>
    </Navbar>
    <LoginModal isOpen={isOpen} onOpenChange={onOpenChange} />
    </>
  );
}
