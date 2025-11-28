import { useState } from 'react';
import Navigation from './components/Navigation';
import PageContent from './components/PageContent';

function App() {
  const [activePage, setActivePage] = useState('captures');

  return (
    <div className="h-screen flex flex-col">
      <div className="flex-shrink-0">
        <Navigation activePage={activePage} onPageChange={setActivePage} />
      </div>
      <PageContent activePage={activePage} />
    </div>
  );
}

export default App;
