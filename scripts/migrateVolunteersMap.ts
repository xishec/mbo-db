import { db, ENVIRONMENT } from "./firebase-node.js";

type ObserverClass = 1 | 2 | 3;
type VolunteerMetadata = {
  fullName: string;
  observerClass: ObserverClass;
};
type BirdEventRecord = {
  bander?: string;
  scribe?: string;
  modifiedEventId?: string | null;
};

async function main() {
  const env = ENVIRONMENT;
  const [volunteersSnap, fullNamesSnap, observerClassesSnap, speciesAliasesSnap, birdEventsSnap] = await Promise.all([
    db.ref(`${env}/volunteersMap`).once("value"),
    db.ref(`${env}/volunteersFullNameMap`).once("value"),
    db.ref(`${env}/volunteersObserverClassMap`).once("value"),
    db.ref(`${env}/speciesAliasesMap`).once("value"),
    db.ref(`${env}/birdEventsMap`).once("value"),
  ]);

  const existingVolunteers = (volunteersSnap.val() ?? {}) as Record<string, Partial<VolunteerMetadata>>;
  const legacyFullNames = (fullNamesSnap.val() ?? {}) as Record<string, string>;
  const legacyObserverClasses = (observerClassesSnap.val() ?? {}) as Record<string, unknown>;
  const birdEvents = (birdEventsSnap.val() ?? {}) as Record<string, BirdEventRecord>;
  const nextVolunteers: Record<string, VolunteerMetadata> = {};

  for (const [code, volunteer] of Object.entries(existingVolunteers)) {
    nextVolunteers[code] = {
      fullName: volunteer.fullName ?? "",
      observerClass: 3,
    };
  }

  for (const [code, fullName] of Object.entries(legacyFullNames)) {
    nextVolunteers[code] = {
      fullName,
      observerClass: 3,
    };
  }

  for (const code of Object.keys(legacyObserverClasses)) {
    nextVolunteers[code] = {
      fullName: nextVolunteers[code]?.fullName ?? "",
      observerClass: 3,
    };
  }

  for (const event of Object.values(birdEvents)) {
    if (!event || event.modifiedEventId) continue;
    for (const code of [event.bander, event.scribe]) {
      if (!code) continue;
      nextVolunteers[code] = {
        fullName: nextVolunteers[code]?.fullName ?? "",
        observerClass: 3,
      };
    }
  }

  const now = Date.now();
  await db.ref(`${env}`).update({
    volunteersMap: nextVolunteers,
    speciesAliasesMap: speciesAliasesSnap.exists() ? speciesAliasesSnap.val() : {},
    volunteersFullNameMap: null,
    volunteersObserverClassMap: null,
    "metadata/lastModified_volunteersMap": now,
    "metadata/lastModified_speciesAliasesMap": now,
    "metadata/lastModified_volunteersFullNameMap": null,
    "metadata/lastModified_volunteersObserverClassMap": null,
  });

  console.log(`Migrated ${Object.keys(nextVolunteers).length} volunteers in ${env}/volunteersMap`);
  console.log(`Ensured ${env}/speciesAliasesMap exists`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Volunteer migration failed:", err);
  process.exit(1);
});
