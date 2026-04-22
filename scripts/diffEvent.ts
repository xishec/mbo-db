import { db } from "./firebase-node";

const OLD_ID = "1462020792026-04-19H1128723";
const NEW_ID = "1462020792026-04-19C1128723ModAt1776634900041";

async function main() {
  for (const env of ["prod"]) {
    const [oldSnap, newSnap] = await Promise.all([
      db.ref(`${env}/birdEventsMap/${OLD_ID}`).once("value"),
      db.ref(`${env}/birdEventsMap/${NEW_ID}`).once("value"),
    ]);
    const old = oldSnap.val();
    const neu = newSnap.val();
    if (!old || !neu) { console.log(`${env}: missing`); continue; }

    console.log(`\n=== ${env} ===`);
    const allKeys = new Set([...Object.keys(old), ...Object.keys(neu)]);
    for (const key of [...allKeys].sort()) {
      const o = JSON.stringify(old[key]);
      const n = JSON.stringify(neu[key]);
      if (o !== n) {
        console.log(`  ${key}: ${o} → ${n}`);
      }
    }
  }
  process.exit(0);
}

main();
