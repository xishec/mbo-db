import { useState } from "react";
import Navigation from "./components/Navigation";
import PageContent from "./components/PageContent/PageContent";
import { DataProvider } from "./services/DataService";

function App() {
  const [activePage, setActivePage] = useState("programs");

  return (
    <DataProvider>
      <Navigation activePage={activePage} onPageChange={setActivePage} />
      <PageContent activePage={activePage} />
    </DataProvider>
  );
}

export default App;
