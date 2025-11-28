import Captures from './Captures';

interface PageContentProps {
  activePage: string;
}

export default function PageContent({ activePage }: PageContentProps) {
  return (
    <div className="h-full">
      <div className="mx-auto h-full">
        {activePage === 'captures' && <Captures />}
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
