import Programs from "./Programs/Programs";
import Search from "./Search";
import Home from "./Home";
import DETs from "./DETs/DETs";
import SpeciesGroups from "./SpeciesGroups";

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
        {activePage === "Reports" && (
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-4">Reports</h2>
            <p>Reports content coming soon...</p>
          </div>
        )}
      </div>
    </div>
  );
}
