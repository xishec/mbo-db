import { useMemo } from "react";
import { useData } from "../../services/useData";

export default function Home() {
  const { birdEventsMap } = useData();

  const latestDaySummary = useMemo(() => {
    // Filter out modified/superseded events
    const activeEvents = Object.values(birdEventsMap).filter(
      (event) => event && !event.modifiedEventId
    );

    // Find the latest date in a single pass
    let latestDate = "";
    for (const event of activeEvents) {
      if (event.date && event.date > latestDate) {
        latestDate = event.date;
      }
    }

    if (!latestDate) {
      return null;
    }

    // Get all active events from the latest date
    const latestDayEvents = activeEvents.filter((event) => event.date === latestDate);

    // Calculate days ago using date-only comparison to avoid timezone issues
    const [y, m, d] = latestDate.split("-").map(Number);
    const latestDateObj = new Date(y, m - 1, d);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const daysAgo = Math.round((todayStart.getTime() - latestDateObj.getTime()) / (1000 * 60 * 60 * 24));

    // Get unique banders and scribes
    const banders = [...new Set(latestDayEvents.map((e) => e.bander).filter(Boolean))];
    const scribes = [...new Set(latestDayEvents.map((e) => e.scribe).filter(Boolean))];

    // Count species in a single pass
    const speciesCounts = new Map<string, number>();
    let mostCapturedSpecies = "";
    let maxCount = 0;
    for (const event of latestDayEvents) {
      if (!event.species) continue;
      const count = (speciesCounts.get(event.species) ?? 0) + 1;
      speciesCounts.set(event.species, count);
      if (count > maxCount) {
        maxCount = count;
        mostCapturedSpecies = event.species;
      }
    }

    return {
      daysAgo,
      banders,
      scribes,
      uniqueSpeciesCount: speciesCounts.size,
      mostCapturedSpecies,
      totalCaptures: latestDayEvents.length,
    };
  }, [birdEventsMap]);

  if (!latestDaySummary) {
    return (
      <div
        className="flex items-center justify-start min-h-[calc(100vh-64px)] p-12 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url(https://oommbo.org/wp-content/uploads/2024/04/hp-hero.svg)" }}
      >
        <div className="max-w-2xl ml-24 font-medium text-5xl">
          <p className="leading-relaxed text-foreground">No banding data available yet.</p>
        </div>
      </div>
    );
  }

  const { daysAgo, banders, scribes, uniqueSpeciesCount, mostCapturedSpecies, totalCaptures } = latestDaySummary;

  return (
    <div
      className="flex items-center justify-start min-h-[calc(100vh-64px)] p-12 bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url(https://oommbo.org/wp-content/uploads/2024/04/hp-hero.svg)" }}
    >
      <div className="space-y-20 max-w-xl ml-24 font-medium text-4xl">
        <p className="leading-relaxed text-foreground">
          Latest banding was{" "}
          {daysAgo <= 0
            ? <span className="font-bold text-primary">today</span>
            : <><span className="font-bold text-primary">{daysAgo}</span> day{daysAgo !== 1 ? "s" : ""} ago</>}
          {banders.length > 0 && (
            <>
              {", "}by <span className="font-bold text-secondary">{banders.join(", ")}</span>
            </>
          )}
          {scribes.length > 0 && (
            <>
              {" "}
              with scribe{scribes.length > 1 ? "s" : ""}{" "}
              <span className="font-bold text-secondary">{scribes.join(", ")}</span>
              {". "}
            </>
          )}
        </p>

        <p className="leading-relaxed text-foreground">
          <span className="font-bold text-primary">{totalCaptures}</span> bird{totalCaptures !== 1 ? "s" : ""} captured
          across <span className="font-bold text-primary">{uniqueSpeciesCount}</span> species
          {mostCapturedSpecies && (
            <>
              , with <span className="font-bold text-secondary">{mostCapturedSpecies}</span> being the most captured
              {". "}
            </>
          )}
        </p>
      </div>
    </div>
  );
}
