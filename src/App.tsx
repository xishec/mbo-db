import { useState } from "react";
import Navigation from "./components/Navigation";
import PageContent from "./components/PageContent/PageContent";
import { ProgramDataProvider } from "./services/ProgramDataService";

function App() {
  const [activePage, setActivePage] = useState("programs");

  return (
    <ProgramDataProvider>
      <Navigation activePage={activePage} onPageChange={setActivePage} />
      <PageContent activePage={activePage} />
    </ProgramDataProvider>
  );
}

export default App;
