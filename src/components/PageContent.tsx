import Captures from "./Captures";
import type { Programs } from "../types/Programs";
import type { Years } from "../types/Years";

interface PageContentProps {
  activePage: string;
  programs: Programs | null;
  years: Years | null;
  isLoadingPrograms: boolean;
}

export default function PageContent({
  activePage,
  programs,
  years,
  isLoadingPrograms,
}: PageContentProps) {
  return (
    <div className="min-h-screen p-8">
      <div className="mx-auto">
        {activePage === "captures" && (
          <Captures
            programs={programs}
            years={years}
            isLoading={isLoadingPrograms}
          />
        )}
        {activePage === "DET" && (
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-4">DET</h2>
            <p>DET content coming soon...</p>
          </div>
        )}
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
