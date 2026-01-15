import { useMemo } from "react";
import { useData } from "../../services/useData";

export default function Home() {
  const { birdEventsMap } = useData();

  const latestDaySummary = useMemo(() => {
    const allBirdEvents = Object.values(birdEventsMap);

    // Filter and sort by date to find the latest capture day
    const sortedEvents = allBirdEvents
      .filter((event) => event.date)
      .sort((a, b) => {
        // date is in format YYYY-MM-DD, so string comparison works
        return b.date.localeCompare(a.date);
      });

    if (sortedEvents.length === 0) {
      return {
        daysAgo: "?",
        banders: ["?"],
        scribes: ["?"],
        uniqueSpeciesCount: "?",
        mostCapturedSpecies: "?",
        totalCaptures: "?",
      };
    }

    // Get the latest date
    const latestDate = sortedEvents[0].date;

    // Get all events from the latest date
    const latestDayEvents = sortedEvents.filter((event) => event.date === latestDate);

    // Calculate days ago
    const latestDateObj = new Date(latestDate);
    const now = new Date();
    const daysAgo = Math.floor((now.getTime() - latestDateObj.getTime()) / (1000 * 60 * 60 * 24));

    // Get unique banders and scribes
    const banders = [...new Set(latestDayEvents.map((e) => e.bander).filter(Boolean))];
    const scribes = [...new Set(latestDayEvents.map((e) => e.scribe).filter(Boolean))];

    // Count species
    const speciesCounts: Record<string, number> = {};
    latestDayEvents.forEach((event) => {
      if (event.species) {
        speciesCounts[event.species] = (speciesCounts[event.species] || 0) + 1;
      }
    });

    const uniqueSpeciesCount = Object.keys(speciesCounts).length;

    // Find most captured species
    let mostCapturedSpecies = "";
    let maxCount = 0;
    Object.entries(speciesCounts).forEach(([species, count]) => {
      if (count > maxCount) {
        maxCount = count;
        mostCapturedSpecies = species;
      }
    });

    return {
      daysAgo,
      banders,
      scribes,
      uniqueSpeciesCount,
      mostCapturedSpecies,
      totalCaptures: latestDayEvents.length,
      latestDate: latestDateObj.toLocaleDateString(),
    };
  }, [birdEventsMap]);

  const { daysAgo, banders, scribes, uniqueSpeciesCount, mostCapturedSpecies, totalCaptures } = latestDaySummary;

  return (
    <div
      className="flex items-center justify-start min-h-[calc(100vh-64px)] p-12 bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url(https://oommbo.org/wp-content/uploads/2024/04/hp-hero.svg)" }}
    >
      <div className="space-y-20 max-w-2xl ml-24 font-medium text-5xl">
        <p className="leading-relaxed text-foreground">
          Latest banding was <span className="font-bold text-primary">{daysAgo}</span> day{daysAgo !== 1 ? "s" : ""} ago
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
