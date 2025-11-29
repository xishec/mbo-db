import { useState } from "react";
import Navigation from "./components/Navigation";
import PageContent from "./components/PageContent/PageContent";

function App() {
  const [activePage, setActivePage] = useState("programs");

  return (
    <>
      <Navigation activePage={activePage} onPageChange={setActivePage} />
      <PageContent activePage={activePage} />
    </>
  );
}

export default App;
