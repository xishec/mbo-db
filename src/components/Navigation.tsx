import {
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  Link,
  Button,
} from "@heroui/react";

interface NavigationProps {
  activePage: string;
  onPageChange: (page: string) => void;
}

export default function Navigation({ activePage, onPageChange }: NavigationProps) {
  return (
    <Navbar maxWidth="full">
      <NavbarBrand>
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
        <NavbarItem className="hidden lg:flex">
          <Link href="#">Login</Link>
        </NavbarItem>
        <NavbarItem>
          <Button as={Link} color="primary" href="#" variant="flat">
            Sign Up
          </Button>
        </NavbarItem>
      </NavbarContent>
    </Navbar>
  );
}
