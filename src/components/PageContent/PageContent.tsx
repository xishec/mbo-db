import Programs from "./Programs/Programs";
import Search from "./Search";
import Home from "./Home";
import DETs from "./DETs/DETs";
import SpeciesGroups from "./SpeciesGroups";
import Banders from "./Banders";
import Reports from "./Reports/Reports";

interface PageContentProps {
  activePage: string;
}

export default function PageContent({ activePage }: PageContentProps) {
  return (
    <div className="h-full">
      <div className="mx-auto h-full">
        {activePage === "home" && <Home />}
        {activePage === "programs" && <Programs />}
        {activePage === "search" && <Search />}
        {activePage === "DETs" && <DETs />}
        {activePage === "species" && <SpeciesGroups />}
        {activePage === "banders" && <Banders />}
        {activePage === "reports" && <Reports />}
      </div>
    </div>
  );
}
