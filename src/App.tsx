import { useState } from "react";
import Navigation from "./components/Navigation";
import PageContent from "./components/PageContent/PageContent";
import OfflineIndicator from "./components/OfflineIndicator";
import { DataProvider } from "./services/DataService";

function App() {
  const [activePage, setActivePage] = useState("programs");

  return (
    <DataProvider>
      <Navigation activePage={activePage} onPageChange={setActivePage} />
      <PageContent activePage={activePage} />
      <OfflineIndicator />
    </DataProvider>
  );
}

export default App;
