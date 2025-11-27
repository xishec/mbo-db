import Captures from './Captures';

interface PageContentProps {
  activePage: string;
}

export default function PageContent({ activePage }: PageContentProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-8">
      <div className="max-w-6xl mx-auto">
        {activePage === 'captures' && <Captures />}
        {activePage === 'customers' && (
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-4">DET</h2>
            <p>DET content coming soon...</p>
          </div>
        )}
        {activePage === 'integrations' && (
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-4">Reports</h2>
            <p>Reports content coming soon...</p>
          </div>
        )}
      </div>
    </div>
  );
}
