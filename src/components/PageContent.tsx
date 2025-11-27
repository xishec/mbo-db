import Captures from './Captures';
import type { Programs } from '../types/Programs';

interface PageContentProps {
  activePage: string;
  programs: Programs | null;
  isLoadingPrograms: boolean;
  programsError: string | null;
}

export default function PageContent({ activePage, programs, isLoadingPrograms, programsError }: PageContentProps) {
  return (
    <div className="min-h-screen p-8">
      <div className="mx-auto">
        {activePage === 'captures' && (
          <Captures programs={programs} isLoading={isLoadingPrograms} error={programsError} />
        )}
        {activePage === 'DET' && (
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-4">DET</h2>
            <p>DET content coming soon...</p>
          </div>
        )}
        {activePage === 'Reports' && (
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-4">Reports</h2>
            <p>Reports content coming soon...</p>
          </div>
        )}
      </div>
    </div>
  );
}
