import { useMemo, useState, useEffect, useRef } from "react";
import { Card, CardBody, RangeCalendar } from "@heroui/react";
import { useAppStore } from "../../stores/useAppStore";
import { birdEventsStore, useBirdEventsVersion } from "../../services/birdEventsStore";
import { BirdEventType, type BirdEvent } from "../../types";
import SpeciesTooltip from "../Helper/Info/SpeciesTooltip";
import CaptureHistoryModal from "../Modals/CaptureHistoryModal";
import BirdEventsTable from "./Programs/Captures/BirdEventsTable";
import PageHeader from "./PageHeader";
import { resolveSpeciesKey } from "../../types/species";
import { isActiveBirdEvent } from "../../stores/derive";

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / (1000 * 60 * 60 * 24));
}

function formatSpan(spanDays: number): string {
  return `${spanDays} ${spanDays === 1 ? "day" : "days"}`;
}

function topUniqueBirds(
  events: BirdEvent[],
  compare: (a: BirdEvent, b: BirdEvent) => number
): BirdEvent[] {
  const bestByBand = new Map<string, BirdEvent>();
  for (const event of events) {
    const key = event.band?.id || `event:${event.id}`;
    const existing = bestByBand.get(key);
    if (!existing || compare(event, existing) < 0) bestByBand.set(key, event);
  }
  return [...bestByBand.values()].sort(compare).slice(0, 3);
}

interface StatCardProps {
  title: string;
  children: React.ReactNode;
}

function StatCard({ title, children }: StatCardProps) {
  return (
    <Card shadow="sm" className="h-full">
      <CardBody>
        <p className="text-sm font-bold mb-2">{title}</p>
        {children}
      </CardBody>
    </Card>
  );
}

interface RankedItem {
  label: string;
  value: number;
  detail?: string;
}

function RankedList({ items, unit, isSpecies, onDetailClick }: {
  items: RankedItem[];
  unit: string;
  isSpecies?: boolean;
  onDetailClick?: (detail: string) => void;
}) {
  if (items.length === 0) return <p className="text-sm text-default-600">No data</p>;
  return (
    <ol className="space-y-1">
      {items.map((item, i) => (
        <li key={item.label + (item.detail ?? "")} className="flex items-baseline gap-2 text-sm">
          <span className="font-bold text-primary">{i + 1}.</span>
          <span className="font-bold">{isSpecies ? <SpeciesTooltip speciesCode={item.label} /> : item.label}</span>
          {item.detail && (
            onDetailClick ? (
              <span className="font-bold cursor-pointer hover:underline" onClick={() => onDetailClick(item.detail!)}>
                {item.detail}
              </span>
            ) : (
              <span className="text-default-600">({item.detail})</span>
            )
          )}
          <span className="text-default-600">{item.value} {unit}</span>
        </li>
      ))}
    </ol>
  );
}

interface BirdRecordItem {
  event: BirdEvent;
  headline: string;
  detail: string;
}

function BirdRecordList({ items, onBandClick, emptyMessage }: {
  items: BirdRecordItem[];
  onBandClick: (bandId: string) => void;
  emptyMessage: string;
}) {
  if (items.length === 0) return <p className="text-sm text-default-600">{emptyMessage}</p>;
  return (
    <ol className="space-y-3">
      {items.map(({ event, headline, detail }, index) => (
        <li key={event.id} className="flex flex-wrap items-baseline gap-2 text-sm">
          <span className="font-bold text-primary">{index + 1}.</span>
          <SpeciesTooltip speciesCode={event.species} />
          <span
            className="font-bold cursor-pointer hover:underline"
            onClick={() => onBandClick(event.band.id)}
          >
            {event.band.id}
          </span>
          <span className="text-default-600">{headline}</span>
          <span className="text-default-600">{detail}</span>
        </li>
      ))}
    </ol>
  );
}

export default function FunStats() {
  const volunteerStatsMap = useAppStore((s) => s.volunteerStatsMap);
  const speciesAliasesMap = useAppStore((s) => s.speciesAliasesMap);
  const birdEventsVersion = useBirdEventsVersion();
  const bandResetsMap = useAppStore((s) => s.bandResetsMap);

  const eventDatesSet = useMemo(() => {
    const dates = new Set<string>();
    for (const ev of birdEventsStore.getAll().values()) {
      if (ev?.date && isActiveBirdEvent(ev, bandResetsMap)) dates.add(ev.date);
    }
    return dates;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [birdEventsVersion, bandResetsMap]);

  const defaultEndDate = useMemo(() => {
    if (eventDatesSet.size === 0) return new Date().toISOString().split("T")[0];
    return [...eventDatesSet].sort().pop()!;
  }, [eventDatesSet]);

  const [startDate, setStartDate] = useState(defaultEndDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [selectedBandId, setSelectedBandId] = useState<string | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);
  useEffect(() => {
    if (!hasInitialized && eventDatesSet.size > 0) {
      setStartDate(defaultEndDate);
      setEndDate(defaultEndDate);
      setHasInitialized(true);
    }
  }, [defaultEndDate, eventDatesSet.size, hasInitialized]);

  const calendarRef = useRef<HTMLDivElement>(null);

  const stats = useMemo(() => {
    const events: BirdEvent[] = [];
    for (const ev of birdEventsStore.getAll().values()) {
      if (!ev || !isActiveBirdEvent(ev, bandResetsMap) || !ev.date) continue;
      if (ev.date >= startDate && ev.date <= endDate) events.push(ev);
    }

    // Basic counts
    const species = new Set<string>();
    const bandedSpecies = new Set<string>();
    const recaptureSpecies = new Set<string>();
    let banded = 0;
    let repeat = 0;
    let returnCount = 0;
    const netCounts = new Map<string, number>();
    const banderCounts = new Map<string, number>();
    const scribeCounts = new Map<string, number>();
    const speciesCounts = new Map<string, number>();
    const bandedSpeciesCounts = new Map<string, number>();
    const recaptureSpeciesCounts = new Map<string, number>();
    const weightedBirds: BirdEvent[] = [];
    const fatBirds: BirdEvent[] = [];

    // For oldest recap/return: need original banding date
    const bandIdFirstSeen = new Map<string, string>(); // bandId → earliest date across ALL events
    for (const ev of birdEventsStore.getAll().values()) {
      if (!ev || !isActiveBirdEvent(ev, bandResetsMap) || !ev.band?.bandPrefix) continue;
      const bandId = `${ev.band.bandPrefix}${ev.band.bandSuffix}`;
      const existing = bandIdFirstSeen.get(bandId);
      if (!existing || ev.date < existing) bandIdFirstSeen.set(bandId, ev.date);
    }

    // For rare birds: last capture of each species BEFORE the period
    const speciesLastSeenBefore = new Map<string, string>();
    for (const ev of birdEventsStore.getAll().values()) {
      if (!ev || !isActiveBirdEvent(ev, bandResetsMap) || !ev.species || !ev.date) continue;
      const speciesKey = resolveSpeciesKey(ev.species, speciesAliasesMap);
      if (ev.date < startDate) {
        const existing = speciesLastSeenBefore.get(speciesKey);
        if (!existing || ev.date > existing) speciesLastSeenBefore.set(speciesKey, ev.date);
      }
    }

    // For dummest bird: count recaptures per band ID within period
    const bandIdRecapCount = new Map<string, { count: number; species: string; latest: BirdEvent }>();

    // For oldest: track recap/return events with their band's first seen date
    const oldestByBand = new Map<string, { event: BirdEvent; spanDays: number }>();

    for (const ev of events) {
      const speciesKey = ev.species ? resolveSpeciesKey(ev.species, speciesAliasesMap) : "";
      if (speciesKey) species.add(speciesKey);

      const isNewCapture = ev.birdEventType === BirdEventType.Banded || ev.birdEventType === BirdEventType.None;
      const isRecapture = ev.birdEventType === BirdEventType.Repeat || ev.birdEventType === BirdEventType.Return;
      if (isNewCapture) {
        banded++;
        if (speciesKey) {
          bandedSpecies.add(speciesKey);
          bandedSpeciesCounts.set(speciesKey, (bandedSpeciesCounts.get(speciesKey) ?? 0) + 1);
        }
      } else if (ev.birdEventType === BirdEventType.Repeat) {
        repeat++;
        if (speciesKey) {
          recaptureSpecies.add(speciesKey);
          recaptureSpeciesCounts.set(speciesKey, (recaptureSpeciesCounts.get(speciesKey) ?? 0) + 1);
        }
      } else if (ev.birdEventType === BirdEventType.Return) {
        returnCount++;
        if (speciesKey) {
          recaptureSpecies.add(speciesKey);
          recaptureSpeciesCounts.set(speciesKey, (recaptureSpeciesCounts.get(speciesKey) ?? 0) + 1);
        }
      }

      // Net productivity
      if (ev.net) netCounts.set(ev.net, (netCounts.get(ev.net) ?? 0) + 1);

      // Species counts (all capture types)
      if (speciesKey) speciesCounts.set(speciesKey, (speciesCounts.get(speciesKey) ?? 0) + 1);

      // Bander/scribe counts
      if (ev.bander && isNewCapture) banderCounts.set(ev.bander, (banderCounts.get(ev.bander) ?? 0) + 1);
      if (ev.scribe) scribeCounts.set(ev.scribe, (scribeCounts.get(ev.scribe) ?? 0) + 1);

      // Heaviest
      if (ev.weight > 0) weightedBirds.push(ev);

      // Fattest
      if (ev.fat > 0) {
        fatBirds.push(ev);
      }

      // Dummest bird (most recaptured individual)
      if (isRecapture && ev.band?.bandPrefix) {
        const bandId = `${ev.band.bandPrefix}${ev.band.bandSuffix}`;
        const existing = bandIdRecapCount.get(bandId);
        if (existing) {
          existing.count++;
          existing.latest = ev;
        } else {
          bandIdRecapCount.set(bandId, { count: 1, species: speciesKey || "?", latest: ev });
        }
      }

      // Oldest recap/return
      if (isRecapture && ev.band?.bandPrefix) {
        const bandId = `${ev.band.bandPrefix}${ev.band.bandSuffix}`;
        const firstDate = bandIdFirstSeen.get(bandId);
        if (firstDate && firstDate < ev.date) {
          const span = daysBetween(firstDate, ev.date);
          const existing = oldestByBand.get(bandId);
          if (!existing || span > existing.spanDays) oldestByBand.set(bandId, { event: ev, spanDays: span });
        }
      }
    }

    // Top 3 banded species
    const topBandedSpecies = [...bandedSpeciesCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([sp, count]) => ({ label: sp, value: count }));

    // Top 3 recaptured species
    const topRecaptureSpecies = [...recaptureSpeciesCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([sp, count]) => ({ label: sp, value: count }));

    // Top 3 nets
    const topNets = [...netCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([net, count]) => ({ label: net, value: count }));

    // Top 3 banders
    const topBanders = [...banderCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([code, count]) => ({
        label: volunteerStatsMap[code]?.fullName || code,
        value: count,
        detail: code,
      }));

    // Top 3 scribes
    const topScribes = [...scribeCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([code, count]) => ({
        label: volunteerStatsMap[code]?.fullName || code,
        value: count,
        detail: code,
      }));

    // Top 3 rare birds (longest gap since last seen before period)
    const speciesInPeriod = [...species];
    const rareBirds = speciesInPeriod
      .filter((s) => speciesLastSeenBefore.has(s))
      .map((s) => ({
        species: s,
        gap: daysBetween(speciesLastSeenBefore.get(s)!, startDate),
      }))
      .sort((a, b) => b.gap - a.gap)
      .slice(0, 3)
      .map((r) => ({
        label: r.species,
        value: r.gap,
      }));

    // Dummest bird (most recaptured individual)
    const dummest = [...bandIdRecapCount.entries()]
      .filter(([, data]) => data.count > 1)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 3)
      .map(([bandId, data]) => ({
        label: data.species,
        value: data.count,
        detail: bandId,
      }));

    const heaviestBirds = topUniqueBirds(weightedBirds, (a, b) => b.weight - a.weight);
    const fattestBirds = topUniqueBirds(fatBirds, (a, b) => b.fat - a.fat || b.weight - a.weight);
    const oldestBirds = [...oldestByBand.values()]
      .sort((a, b) => b.spanDays - a.spanDays)
      .slice(0, 3);

    return {
      events,
      totalEvents: events.length,
      speciesCount: species.size,
      bandedSpeciesCount: bandedSpecies.size,
      recaptureSpeciesCount: recaptureSpecies.size,
      banded,
      repeat,
      returnCount,
      topBandedSpecies,
      topRecaptureSpecies,
      topNets,
      topBanders,
      topScribes,
      heaviestBirds,
      fattestBirds,
      oldestBirds,
      rareBirds,
      dummest,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [birdEventsVersion, volunteerStatsMap, speciesAliasesMap, startDate, endDate, bandResetsMap]);

  return (
    <div className="h-full w-full max-w-7xl mx-auto flex flex-col pt-4 p-8 gap-4">
      <PageHeader
        title="Fun Stats"
        subtitle="Select a date range to view highlights. Bold dates have DET entries."
      />

      <div className="flex gap-6 items-start">
        {/* Calendar — sticky left */}
        <div className="sticky top-20 shrink-0">
          <Card shadow="sm">
            <CardBody className="p-0">
              <RangeCalendar
                ref={calendarRef}
                aria-label="Select date range"
                showMonthAndYearPickers
                onChange={(val) => {
                  if (!val) return;
                  const fmt = (d: { year: number; month: number; day: number }) =>
                    `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
                  setStartDate(fmt(val.start));
                  setEndDate(fmt(val.end));
                }}
                isDateUnavailable={(date) => {
                  const dateStr = `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
                  return !eventDatesSet.has(dateStr);
                }}
                allowsNonContiguousRanges
                errorMessage="Some dates have no banding data"
                classNames={{
                  base: "bg-white",
                  title: "text-default-900",
                  headerWrapper: "py-4 [&>button]:bg-transparent",
                  gridHeaderCell: "text-default-900 font-normal",
                  gridHeader: "shadow-none",
                  prevButton: "text-default-900 hover:bg-default-200",
                  nextButton: "text-default-900 hover:bg-default-200",
                }}
              />
            </CardBody>
          </Card>
        </div>

        {/* Stats — right */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          {stats.totalEvents === 0 ? (
            <p className="text-default-600 py-12">No events found in this date range.</p>
          ) : (
            <>
              {/* Date range */}
              <div className="grid grid-cols-2 gap-4">
                <StatCard title="From">
                  <p className="text-xl font-bold">{startDate}</p>
                </StatCard>
                <StatCard title="To">
                  <p className="text-xl font-bold">{endDate}</p>
                </StatCard>
              </div>

              {/* Overview */}
              <div className="grid grid-cols-2 gap-4">
                <StatCard title="Species (Banded)">
                  <p className="text-3xl font-bold">{stats.bandedSpeciesCount}</p>
                </StatCard>
                <StatCard title="Species (Recaptures)">
                  <p className="text-3xl font-bold">{stats.recaptureSpeciesCount}</p>
                </StatCard>
                <StatCard title="Total Species">
                  <p className="text-3xl font-bold">{stats.speciesCount}</p>
                </StatCard>
                <StatCard title="Banded">
                  <p className="text-3xl font-bold">{stats.banded}</p>
                </StatCard>
                <StatCard title="Recaptures">
                  <p className="text-3xl font-bold">{stats.repeat}</p>
                </StatCard>
                <StatCard title="Returns">
                  <p className="text-3xl font-bold">{stats.returnCount}</p>
                </StatCard>
              </div>

              {/* Rankings */}
              <div className="grid grid-cols-2 gap-4">
                <StatCard title="Most Banded Species">
                  <RankedList items={stats.topBandedSpecies} unit="banded" isSpecies />
                </StatCard>
                <StatCard title="Most Recaptured Species">
                  <RankedList items={stats.topRecaptureSpecies} unit="recaptures" isSpecies />
                </StatCard>
                <StatCard title="Most Productive Nets">
                  <RankedList items={stats.topNets} unit="birds" />
                </StatCard>
                <StatCard title="Busiest Banders">
                  <RankedList items={stats.topBanders} unit="banded" />
                </StatCard>
                <StatCard title="Busiest Scribes">
                  <RankedList items={stats.topScribes} unit="scribed" />
                </StatCard>
                <StatCard title="Rarest Birds (longest gap since last captured)">
                  <RankedList items={stats.rareBirds} unit="days" isSpecies />
                </StatCard>
              </div>

              {/* Records */}
              <div className="grid grid-cols-2 gap-4">
                <StatCard title="Heaviest Bird">
                  <BirdRecordList
                    items={stats.heaviestBirds.map((event) => ({
                      event,
                      headline: `${event.weight}g`,
                      detail: event.date,
                    }))}
                    onBandClick={setSelectedBandId}
                    emptyMessage="No weight data"
                  />
                </StatCard>
                <StatCard title="Fattest Bird">
                  <BirdRecordList
                    items={stats.fattestBirds.map((event) => ({
                      event,
                      headline: `Fat ${event.fat} · ${event.weight}g`,
                      detail: event.date,
                    }))}
                    onBandClick={setSelectedBandId}
                    emptyMessage="No fat data"
                  />
                </StatCard>
                <StatCard title="Oldest Recap/Return">
                  <BirdRecordList
                    items={stats.oldestBirds.map(({ event, spanDays }) => ({
                      event,
                      headline: formatSpan(spanDays),
                      detail: event.date,
                    }))}
                    onBandClick={setSelectedBandId}
                    emptyMessage="No recaptures"
                  />
                </StatCard>
                {stats.dummest.length > 0 && (
                  <StatCard title="Dummest Birds (most recaptured)">
                    <RankedList items={stats.dummest} unit="recaptures" isSpecies onDetailClick={setSelectedBandId} />
                  </StatCard>
                )}
              </div>

            </>
          )}
          {stats.totalEvents > 0 && (
            <>
            <p className="text-md mt-8 font-bold">All Captures from {startDate} to {endDate}</p>
            <BirdEventsTable
              birdEvents={stats.events}
              maxTableHeight={600}
              allowInspectBandId
            />
            </>
          )}
        </div>
      </div>
      <CaptureHistoryModal
        isOpen={selectedBandId !== null}
        onOpenChange={() => setSelectedBandId(null)}
        bandId={selectedBandId}
      />
    </div>
  );
}
