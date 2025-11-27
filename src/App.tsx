import { useEffect, useState } from 'react'
import Navigation from './components/Navigation'
import PageContent from './components/PageContent'
import { auth, db } from './firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { get, ref } from 'firebase/database'
import type { Programs } from './types/Programs'

function App() {
  const [activePage, setActivePage] = useState('captures')
  const [programs, setPrograms] = useState<Programs | null>(null)
  const [isLoadingPrograms, setIsLoadingPrograms] = useState(false)
  const [programsError, setProgramsError] = useState<string | null>(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setPrograms(null)
        return
      }

      setIsLoadingPrograms(true)
      setProgramsError(null)
      try {
        const snapshot = await get(ref(db, 'programs'))
        if (snapshot.exists()) {
          const raw = snapshot.val() as Record<string, unknown>
          const programsMap: Programs = new Map<string, Set<string>>()
          Object.entries(raw).forEach(([programKey, value]) => {
            let set: Set<string>
            if (Array.isArray(value)) {
              set = new Set((value as unknown[]).filter(v => typeof v === 'string') as string[])
            } else if (typeof value === 'object' && value !== null) {
              // If stored as an object, use its keys as entries
              set = new Set(Object.keys(value as Record<string, unknown>))
            } else if (typeof value === 'string') {
              set = new Set([value])
            } else {
              set = new Set()
            }
            programsMap.set(programKey, set)
          })
          setPrograms(programsMap)
        } else {
          setPrograms(new Map())
        }
      } catch (err) {
        setProgramsError((err as Error).message)
      } finally {
        setIsLoadingPrograms(false)
      }
    })

    return () => unsubscribe()
  }, [])

  return (
    <>
      <Navigation activePage={activePage} onPageChange={setActivePage} />
      <PageContent activePage={activePage} programs={programs} isLoadingPrograms={isLoadingPrograms} programsError={programsError} />
    </>
  )
}

export default App
