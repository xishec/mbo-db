import { lazy, Suspense } from "react";
import Home from "./Home";
import Trends from "./Trends";

const Programs = lazy(() => import("./Programs/Programs"));
const Search = lazy(() => import("./Search"));
const DETs = lazy(() => import("./DETs/DETs"));
const SpeciesGroups = lazy(() => import("./SpeciesGroups"));
const Volunteers = lazy(() => import("./Volunteers"));
const Bands = lazy(() => import("./Bands"));
const FunStats = lazy(() => import("./FunStats"));
const Reports = lazy(() => import("./Reports/Reports"));

interface PageContentProps {
  activePage: string;
}

export default function PageContent({ activePage }: PageContentProps) {
  return (
    <div className="h-full">
      <div className="mx-auto h-full">
        <Suspense fallback={<div className="p-8 text-sm text-default-500">Loading page...</div>}>
          {activePage === "home" && <Home />}
          {activePage === "programs" && <Programs />}
          {activePage === "search" && <Search />}
          {activePage === "DETs" && <DETs />}
          {activePage === "species" && <SpeciesGroups />}
          {activePage === "volunteers" && <Volunteers />}
          {activePage === "bands" && <Bands />}
          {activePage === "funstats" && <FunStats />}
          {activePage === "reports" && <Reports />}
          {activePage === "trends" && <Trends />}
        </Suspense>
      </div>
    </div>
  );
}
