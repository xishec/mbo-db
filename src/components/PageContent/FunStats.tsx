import { useMemo, useState, useCallback } from "react";
import { Card, CardBody, RangeCalendar } from "@heroui/react";
import { today, getLocalTimeZone } from "@internationalized/date";
import type { DateValue, RangeValue } from "@heroui/react";
import { useData } from "../../services/useData";
import { BirdEventType, type BirdEvent } from "../../types";
import PageHeader from "./PageHeader";

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / (1000 * 60 * 60 * 24));
}

interface StatCardProps {
  title: string;
  children: React.ReactNode;
}

function StatCard({ title, children }: StatCardProps) {
  return (
    <Card shadow="sm">
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

function RankedList({ items, unit }: { items: RankedItem[]; unit: string }) {
  if (items.length === 0) return <p className="text-sm text-default-600">No data</p>;
  return (
    <ol className="space-y-1">
      {items.map((item, i) => (
        <li key={item.label} className="flex items-baseline gap-2 text-sm">
          <span className="font-bold text-primary">{i + 1}.</span>
          <span className="font-bold">{item.label}</span>
          <span className="text-default-600">{item.value} {unit}</span>
          {item.detail && <span className="text-default-600">({item.detail})</span>}
        </li>
      ))}
    </ol>
  );
}

export default function FunStats() {
  const { birdEventsMap, volunteersMap } = useData();

  const now = today(getLocalTimeZone());
  const sevenDaysAgo = now.subtract({ days: 7 });
  const [range, setRange] = useState<RangeValue<DateValue>>({ start: sevenDaysAgo, end: now });
  const startDate = `${range.start.year}-${String(range.start.month).padStart(2, "0")}-${String(range.start.day).padStart(2, "0")}`;
  const endDate = `${range.end.year}-${String(range.end.month).padStart(2, "0")}-${String(range.end.day).padStart(2, "0")}`;

  const eventDatesSet = useMemo(() => {
    const dates = new Set<string>();
    for (const ev of Object.values(birdEventsMap)) {
      if (ev?.date && !ev.modifiedEventId) dates.add(ev.date);
    }
    return dates;
  }, [birdEventsMap]);

  const isDateUnavailable = useCallback(
    (date: DateValue) => {
      const dateStr = `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
      return !eventDatesSet.has(dateStr);
    },
    [eventDatesSet]
  );

  const stats = useMemo(() => {
    const events: BirdEvent[] = [];
    for (const ev of Object.values(birdEventsMap)) {
      if (!ev || ev.modifiedEventId || !ev.date) continue;
      if (ev.date >= startDate && ev.date <= endDate) events.push(ev);
    }

    // Basic counts
    const species = new Set<string>();
    let banded = 0;
    let repeat = 0;
    let returnCount = 0;
    const netCounts = new Map<string, number>();
    const banderCounts = new Map<string, number>();
    const scribeCounts = new Map<string, number>();
    let heaviest: BirdEvent | null = null;
    let fattest: BirdEvent | null = null;

    // For oldest recap/return: need original banding date
    const bandIdFirstSeen = new Map<string, string>(); // bandId → earliest date across ALL events
    for (const ev of Object.values(birdEventsMap)) {
      if (!ev || ev.modifiedEventId || !ev.band?.bandPrefix) continue;
      const bandId = `${ev.band.bandPrefix}${ev.band.bandSuffix}`;
      const existing = bandIdFirstSeen.get(bandId);
      if (!existing || ev.date < existing) bandIdFirstSeen.set(bandId, ev.date);
    }

    // For rare birds: last capture of each species BEFORE the period
    const speciesLastSeenBefore = new Map<string, string>();
    for (const ev of Object.values(birdEventsMap)) {
      if (!ev || ev.modifiedEventId || !ev.species || !ev.date) continue;
      if (ev.date < startDate) {
        const existing = speciesLastSeenBefore.get(ev.species);
        if (!existing || ev.date > existing) speciesLastSeenBefore.set(ev.species, ev.date);
      }
    }

    // For dummest bird: count recaptures per band ID within period
    const bandIdRecapCount = new Map<string, { count: number; species: string; latest: BirdEvent }>();

    // For oldest: track recap/return events with their band's first seen date
    let oldestEvent: BirdEvent | null = null;
    let oldestSpanDays = 0;

    for (const ev of events) {
      if (ev.species) species.add(ev.species);

      const isNewCapture = ev.birdEventType === BirdEventType.Banded || ev.birdEventType === BirdEventType.None;
      if (isNewCapture) banded++;
      else if (ev.birdEventType === BirdEventType.Repeat) repeat++;
      else if (ev.birdEventType === BirdEventType.Return) returnCount++;

      // Net productivity
      if (ev.net) netCounts.set(ev.net, (netCounts.get(ev.net) ?? 0) + 1);

      // Bander/scribe counts
      if (ev.bander && isNewCapture) banderCounts.set(ev.bander, (banderCounts.get(ev.bander) ?? 0) + 1);
      if (ev.scribe) scribeCounts.set(ev.scribe, (scribeCounts.get(ev.scribe) ?? 0) + 1);

      // Heaviest
      if (ev.weight > 0 && (!heaviest || ev.weight > heaviest.weight)) heaviest = ev;

      // Fattest
      if (ev.fat > 0) {
        if (!fattest || ev.fat > fattest.fat || (ev.fat === fattest.fat && ev.weight > fattest.weight)) fattest = ev;
      }

      // Dummest bird (most recaptured individual)
      if (!isNewCapture && ev.band?.bandPrefix) {
        const bandId = `${ev.band.bandPrefix}${ev.band.bandSuffix}`;
        const existing = bandIdRecapCount.get(bandId);
        if (existing) {
          existing.count++;
          existing.latest = ev;
        } else {
          bandIdRecapCount.set(bandId, { count: 1, species: ev.species || "?", latest: ev });
        }
      }

      // Oldest recap/return
      if (!isNewCapture && ev.band?.bandPrefix) {
        const bandId = `${ev.band.bandPrefix}${ev.band.bandSuffix}`;
        const firstDate = bandIdFirstSeen.get(bandId);
        if (firstDate && firstDate < ev.date) {
          const span = daysBetween(firstDate, ev.date);
          if (span > oldestSpanDays) {
            oldestSpanDays = span;
            oldestEvent = ev;
          }
        }
      }
    }

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
        label: volunteersMap[code]?.fullName || code,
        value: count,
        detail: code,
      }));

    // Top 3 scribes
    const topScribes = [...scribeCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([code, count]) => ({
        label: volunteersMap[code]?.fullName || code,
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
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 3)
      .map(([bandId, data]) => ({
        label: `${data.species} (${bandId})`,
        value: data.count,
      }));

    return {
      totalEvents: events.length,
      speciesCount: species.size,
      banded,
      repeat,
      returnCount,
      topNets,
      topBanders,
      topScribes,
      heaviest,
      fattest,
      oldestEvent,
      oldestSpanDays,
      rareBirds,
      dummest,
    };
  }, [birdEventsMap, volunteersMap, startDate, endDate]);

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
                aria-label="Select date range"
                showMonthAndYearPickers
                value={range}
                onChange={setRange}
                isDateUnavailable={isDateUnavailable}
                allowsNonContiguousRanges
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
        <div className="flex-1 flex flex-col gap-4">
          {stats.totalEvents === 0 ? (
            <p className="text-default-600 py-12">No events found in this date range.</p>
          ) : (
            <>
              {/* Overview */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatCard title="Species">
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard title="Most Productive Nets">
                  <RankedList items={stats.topNets} unit="birds" />
                </StatCard>
                <StatCard title="Busiest Banders">
                  <RankedList items={stats.topBanders} unit="banded" />
                </StatCard>
                <StatCard title="Busiest Scribes">
                  <RankedList items={stats.topScribes} unit="scribed" />
                </StatCard>
              </div>

              {/* Records */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard title="Heaviest Bird">
                  {stats.heaviest ? (
                    <div>
                      <p className="text-2xl font-bold">{stats.heaviest.weight}g</p>
                      <p className="text-sm text-default-600">{stats.heaviest.species} &middot; {stats.heaviest.date}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-default-600">No weight data</p>
                  )}
                </StatCard>
                <StatCard title="Fattest Bird">
                  {stats.fattest ? (
                    <div>
                      <p className="text-2xl font-bold">Fat {stats.fattest.fat}</p>
                      <p className="text-sm text-default-600">
                        {stats.fattest.species} &middot; {stats.fattest.weight}g &middot; {stats.fattest.date}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-default-600">No fat data</p>
                  )}
                </StatCard>
                <StatCard title="Oldest Recap/Return">
                  {stats.oldestEvent ? (
                    <div>
                      <p className="text-2xl font-bold">{Math.round(stats.oldestSpanDays / 365 * 10) / 10} years</p>
                      <p className="text-sm text-default-600">
                        {stats.oldestEvent.species} &middot; {stats.oldestSpanDays} days &middot; {stats.oldestEvent.date}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-default-600">No recaptures</p>
                  )}
                </StatCard>
              </div>

              {/* Fun */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <StatCard title="Rarest Birds (longest gap since last seen)">
                  <RankedList items={stats.rareBirds} unit="days" />
                </StatCard>
                <StatCard title="Dummest Birds (most recaptured)">
                  <RankedList items={stats.dummest} unit="recaptures" />
                </StatCard>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
