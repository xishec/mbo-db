import { useState } from 'react'
import Navigation from './components/Navigation'
import PageContent from './components/PageContent'

function App() {
  const [activePage, setActivePage] = useState('captures')

  return (
    <>
      <Navigation activePage={activePage} onPageChange={setActivePage} />
      <PageContent activePage={activePage} />
    </>
  )
}

export default App
