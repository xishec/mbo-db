import { useEffect, useState } from "react";
import Navigation from "./components/Navigation";
import PageContent from "./components/PageContent";
import { auth, db } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { get, ref } from "firebase/database";
import type { Programs } from "./types/Programs";
import type { Years } from "./types/Years";

function App() {
  const [activePage, setActivePage] = useState("captures");
  const [programs, setPrograms] = useState<Programs | null>(null);
  const [isLoadingPrograms, setIsLoadingPrograms] = useState(false);
  const [years, setYears] = useState<Years | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setPrograms(null);
        return;
      }

      setIsLoadingPrograms(true);
      try {
        const snapshot = await get(ref(db, "programs"));
        if (snapshot.exists()) {
          const raw = snapshot.val() as Record<string, unknown>;
          const programsMap: Programs = new Map<string, Set<string>>();
          Object.entries(raw).forEach(([programKey, value]) => {
            let set: Set<string>;
            if (Array.isArray(value)) {
              set = new Set(
                (value as unknown[]).filter(
                  (v) => typeof v === "string"
                ) as string[]
              );
            } else if (typeof value === "object" && value !== null) {
              // If stored as an object, use its keys as entries
              set = new Set(Object.keys(value as Record<string, unknown>));
            } else if (typeof value === "string") {
              set = new Set([value]);
            } else {
              set = new Set();
            }
            programsMap.set(programKey, set);
          });
          setPrograms(programsMap);
        } else {
          setPrograms(new Map());
        }

        // Load years alongside programs
        const yearsSnap = await get(ref(db, "years"));
        if (yearsSnap.exists()) {
          const rawYears = yearsSnap.val() as Record<string, string[]>;
          const yearsMap: Years = new Map<number, Set<string>>();
          for (const [yearStr, programsArr] of Object.entries(rawYears)) {
            const yr = Number(yearStr);
            if (!Number.isFinite(yr)) continue;
            yearsMap.set(yr, new Set((programsArr || []).filter(Boolean)));
          }
          setYears(yearsMap);
        } else {
          setYears(new Map());
        }
      } catch (err) {
        console.error("Error loading programs or years:", (err as Error).message);
      } finally {
        setIsLoadingPrograms(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <div className="flex-shrink-0">
        <Navigation activePage={activePage} onPageChange={setActivePage} />
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        <PageContent
          activePage={activePage}
          programs={programs}
          years={years}
          isLoadingPrograms={isLoadingPrograms}
        />
      </div>
    </div>
  );
}

export default App;
