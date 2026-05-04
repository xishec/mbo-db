import {
  Band,
  BandSize,
  BirdEventType,
  getBandGroupMapKey,
  type BandGroupsMap,
  type BandIdToBirdEventIdsMap,
  type BirdEvent,
  type BirdEventsMap,
  type PendingBirdEvent,
  type PendingEvent,
  type ProgramsMap,
  type SpeciesInfoMap,
  type VolunteersMap,
  type YearToProgramMap,
} from "../types";

type FavoriteRateResult = { value: string; rate: number };
type BandStats = {
  count: number;
  earliest: BirdEvent;
  latest: BirdEvent;
  earliestTime: number;
  latestTime: number;
};

const getEventTimestamp = (event: BirdEvent): number =>
  Date.parse(`${event.date}T${event.time}`);

const computeFavoriteRate = (
  events: BirdEvent[],
  selector: (event: BirdEvent) => string | undefined,
): FavoriteRateResult => {
  const counts = new Map<string, number>();
  for (const event of events) {
    const key = selector(event);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  if (counts.size === 0) return { value: "", rate: 0 };

  let totalCount = 0;
  let maxKey = "";
  let maxCount = 0;
  for (const [key, count] of counts.entries()) {
    totalCount += count;
    if (count > maxCount) {
      maxCount = count;
      maxKey = key;
    }
  }
  const averageCount = totalCount / counts.size;
  const rate = averageCount > 0 ? maxCount / averageCount : 0;
  return { value: maxKey, rate };
};

/**
 * Overlay queued (not-yet-synced) bird events into the RTDB/cached snapshot
 * so derived maps, prefill suggestions, and capture lists see pending work.
 * Stamps modifiedEventId on predecessors to mirror what syncQueue does.
 */
export function overlayQueuedEvents(
  events: Record<string, BirdEvent>,
  queued: PendingEvent[],
): Record<string, BirdEvent> {
  if (queued.length === 0) return events;
  const next: Record<string, BirdEvent> = { ...events };
  for (const pending of queued) {
    if (pending.type !== "bird-event") continue;
    const ev = (pending as PendingBirdEvent).pendingEvent;
    next[ev.id] = ev;
    if (ev.previousEventId && next[ev.previousEventId]) {
      next[ev.previousEventId] = {
        ...next[ev.previousEventId],
        modifiedEventId: ev.id,
      };
    }
  }
  return next;
}

/**
 * Rebuild every derived index map from the bird events record.
 * Single source of truth for the app's shape on load / reload.
 */
export function rebuildMapsFromEvents(
  allEvents: Record<string, BirdEvent>,
  fullNameMap: Record<string, string>,
): {
  bandIdMap: BandIdToBirdEventIdsMap;
  bandGroups: BandGroupsMap;
  programs: ProgramsMap;
  years: YearToProgramMap;
  volCounts: VolunteersMap;
} {
  const bandIdMap: BandIdToBirdEventIdsMap = {};
  const bandGroups: BandGroupsMap = {};
  const programs: ProgramsMap = {};
  const years: YearToProgramMap = {};
  const volCounts: VolunteersMap = {};

  for (const [id, ev] of Object.entries(allEvents)) {
    if (!ev || !ev.date) continue;
    const bandId =
      ev.band?.bandPrefix && ev.band?.bandSuffix
        ? new Band(ev.band.bandPrefix, ev.band.bandSuffix).id
        : "";
    if (bandId) {
      if (!bandIdMap[bandId]) bandIdMap[bandId] = [];
      if (!bandIdMap[bandId].includes(id)) bandIdMap[bandId].push(id);
    }
  }

  for (const [id, ev] of Object.entries(allEvents)) {
    if (!ev || !ev.date || ev.modifiedEventId) continue;

    const isNewCapture =
      ev.birdEventType === BirdEventType.Banded || ev.birdEventType === BirdEventType.None;
    const bgKey =
      ev.band?.bandPrefix && ev.band?.bandSuffix
        ? getBandGroupMapKey(new Band(ev.band.bandPrefix, ev.band.bandSuffix))
        : "";
    const pid = ev.programId || "NONE";
    const year = ev.date.slice(0, 4);

    if (bgKey && isNewCapture) {
      if (!bandGroups[bgKey]) bandGroups[bgKey] = { id: bgKey, newCaptureIds: [] };
      if (!bandGroups[bgKey].newCaptureIds.includes(id))
        bandGroups[bgKey].newCaptureIds.push(id);
    }

    if (!programs[pid]) {
      programs[pid] = {
        id: pid,
        displayName: pid,
        bandGroupIds: [],
        recaptureIds: [],
      };
    }
    if (isNewCapture && bgKey && !programs[pid].bandGroupIds.includes(bgKey))
      programs[pid].bandGroupIds.push(bgKey);
    if (!isNewCapture && !programs[pid].recaptureIds.includes(id))
      programs[pid].recaptureIds.push(id);
    if (!programs[pid].firstCaptureDate || ev.date < programs[pid].firstCaptureDate)
      programs[pid].firstCaptureDate = ev.date;
    if (!programs[pid].lastCaptureDate || ev.date > programs[pid].lastCaptureDate)
      programs[pid].lastCaptureDate = ev.date;

    if (!years[year]) years[year] = [];
    if (!years[year].includes(pid)) years[year].push(pid);

    if (ev.bander && isNewCapture) {
      if (!volCounts[ev.bander])
        volCounts[ev.bander] = {
          code: ev.bander,
          fullName: fullNameMap[ev.bander] ?? "",
          totalBanded: 0,
          totalScribed: 0,
        };
      volCounts[ev.bander].totalBanded++;
    }
    if (ev.scribe) {
      if (!volCounts[ev.scribe])
        volCounts[ev.scribe] = {
          code: ev.scribe,
          fullName: fullNameMap[ev.scribe] ?? "",
          totalBanded: 0,
          totalScribed: 0,
        };
      volCounts[ev.scribe].totalScribed++;
    }
  }

  return { bandIdMap, bandGroups, programs, years, volCounts };
}

// Physical band sequence within a strip: 01, 02, ..., 99, then the NEXT
// group's -00 (which logically belongs to this strip). After -00 we start
// fresh at the SAME numeric group's -01.
//
//   N-01 .. N-98 → same group, +1 last2
//   N-99         → next group N+1, last2=00
//   N-00         → same group N, last2=01
export function advanceBandId(bandId: string): string | null {
  if (bandId.length !== 9) return null;
  const bandGroupId = bandId.slice(0, 7);
  const last2 = bandId.slice(7, 9);
  const last2Num = parseInt(last2, 10);
  if (Number.isNaN(last2Num)) return null;
  const groupPrefix = parseInt(bandGroupId, 10);
  if (Number.isNaN(groupPrefix)) return null;

  let nextPrefix: number;
  let nextLast2: number;
  if (last2Num === 0) {
    nextPrefix = groupPrefix;
    nextLast2 = 1;
  } else if (last2Num < 99) {
    nextPrefix = groupPrefix;
    nextLast2 = last2Num + 1;
  } else {
    nextPrefix = groupPrefix + 1;
    nextLast2 = 0;
  }
  return nextPrefix.toString().padStart(7, "0") + nextLast2.toString().padStart(2, "0");
}

/**
 * For each band size, suggest the next available band id. Picks the
 * highest-numbered group holding a banding of that size, then advances
 * past the highest last2 within that strip (01→99→00 order).
 */
export function computeBandSizeToBandIdMap(
  events: BirdEventsMap,
  groups: BandGroupsMap,
): Record<BandSize, string> {
  // Per size, track which group holds the most recently banded event.
  // Recency wins over numeric-max: banders don't always issue strips in
  // strict numeric order, so a higher-numbered group that's been idle for
  // years shouldn't override the strip that's actually in active use.
  const latestPerSize = new Map<BandSize, { group: string; updatedAt: number }>();
  for (const ev of events.values()) {
    if (!ev?.band?.bandSize || ev.band.bandSize === BandSize.Other) continue;
    if (ev.previousEventId) continue;
    if (ev.modifiedEventId) continue;
    // Recaptures can carry a bandSize on the Band (same band = same size),
    // but they don't advance the strip. Including them would let a recap
    // typed into a size's strip silently overwrite that size's active group.
    if (ev.birdEventType !== BirdEventType.Banded && ev.birdEventType !== BirdEventType.None) continue;

    const prefix = ev.band.bandPrefix;
    const suffix = ev.band.bandSuffix;
    const last2 = suffix.slice(-2);
    const bandGroupId = prefix + suffix.slice(0, 3);
    const group =
      last2 !== "00"
        ? bandGroupId
        : (parseInt(bandGroupId, 10) - 1).toString().padStart(7, "0");

    const ts = parseInt(ev.updatedAt ?? "0", 10);
    if (Number.isNaN(ts)) continue;
    const current = latestPerSize.get(ev.band.bandSize);
    if (!current || ts > current.updatedAt) {
      latestPerSize.set(ev.band.bandSize, { group, updatedAt: ts });
    }
  }

  const map = {} as Record<BandSize, string>;
  for (const [size, { group: currentGroup }] of latestPerSize) {
    const bandGroup = groups[currentGroup];
    if (!bandGroup) continue;

    // -00 encoded as 100 so 01→99→00 order compares correctly.
    let max = 0;
    for (const eventId of bandGroup.newCaptureIds) {
      const ev = events.get(eventId);
      if (!ev?.band) continue;
      const last2 = parseInt(ev.band.bandSuffix.slice(-2), 10);
      if (Number.isNaN(last2)) continue;
      const encoded = last2 === 0 ? 100 : last2;
      if (encoded > max) max = encoded;
    }
    if (max === 0) continue;

    const groupPrefixNum = parseInt(currentGroup, 10);
    const latestBandId =
      max === 100
        ? (groupPrefixNum + 1).toString().padStart(7, "0") + "00"
        : currentGroup + max.toString().padStart(2, "0");
    const nextId = advanceBandId(latestBandId);
    if (nextId) map[size] = nextId;
  }
  return map;
}

/**
 * Per-species stats (biggest / fattest / dummiest / oldest / favourite
 * bander / favourite net). Computed on load — too expensive per-save,
 * and stats barely shift with one more capture.
 */
export function computeSpeciesInfoMap(source: BirdEventsMap): SpeciesInfoMap {
  const infoMap: SpeciesInfoMap = {};
  const validEvents = [...source.values()].filter((event) => event && !event.modifiedEventId);
  if (validEvents.length === 0) return infoMap;

  const eventsBySpecies = new Map<string, BirdEvent[]>();
  for (const event of validEvents) {
    if (!event.species || event.species.length !== 4) continue;
    const speciesEvents = eventsBySpecies.get(event.species);
    if (speciesEvents) speciesEvents.push(event);
    else eventsBySpecies.set(event.species, [event]);
  }

  for (const [speciesCode, events] of eventsBySpecies.entries()) {
    if (events.length === 0) continue;

    const biggest = events.reduce((max, event) => (event.wing > max.wing ? event : max));
    const fattest = events.reduce((max, event) => {
      if (event.fat > max.fat) return event;
      if (event.fat === max.fat && event.weight > max.weight) return event;
      return max;
    });

    const bandStats = new Map<string, BandStats>();
    for (const event of events) {
      const bandId = event.band.id;
      const timestamp = getEventTimestamp(event);
      const stats = bandStats.get(bandId);
      if (!stats) {
        bandStats.set(bandId, {
          count: 1,
          earliest: event,
          latest: event,
          earliestTime: timestamp,
          latestTime: timestamp,
        });
        continue;
      }
      stats.count += 1;
      if (timestamp < stats.earliestTime) {
        stats.earliest = event;
        stats.earliestTime = timestamp;
      }
      if (timestamp > stats.latestTime) {
        stats.latest = event;
        stats.latestTime = timestamp;
      }
    }

    let maxEventCount = 0;
    let dummiestEvent: BirdEvent | null = null;
    for (const stats of bandStats.values()) {
      if (stats.count > maxEventCount) {
        maxEventCount = stats.count;
        dummiestEvent = stats.latest;
      }
    }

    let maxSpan = 0;
    let oldestSpanDays = 0;
    let oldestEvent: BirdEvent | null = null;
    for (const stats of bandStats.values()) {
      if (stats.count < 2) continue;
      const spanMs = stats.latestTime - stats.earliestTime;
      if (spanMs > maxSpan) {
        maxSpan = spanMs;
        oldestSpanDays = Math.floor(spanMs / (1000 * 60 * 60 * 24));
        oldestEvent = stats.latest;
      }
    }

    const { value: favoriteBander, rate: favoriteBanderRate } = computeFavoriteRate(
      events,
      (event) => event.bander,
    );
    const { value: favoriteNet, rate: favoriteNetRate } = computeFavoriteRate(
      events,
      (event) => event.net,
    );

    if (biggest && fattest && dummiestEvent) {
      infoMap[speciesCode] = {
        totalCaptures: events.length,
        speciesCode,
        biggest,
        fattest,
        dummiest: dummiestEvent,
        dummiestCount: maxEventCount,
        oldest: oldestEvent,
        oldestSpanDays: oldestEvent ? oldestSpanDays : -1,
        favoriteBander,
        favoriteBanderRate,
        favoriteNet,
        favoriteNetRate,
      };
    }
  }

  return infoMap;
}
