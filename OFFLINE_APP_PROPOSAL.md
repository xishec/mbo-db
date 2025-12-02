# MBO Database - Offline Desktop App Proposal

## Overview

A desktop app that lets you record bird data in the field **without internet**, then sync it back when you're online.

**Key Points:**
- Available for Mac and Windows
- Admins can work offline; regular users need internet to view data
- Only ONE admin can use offline mode at a time (to prevent sync conflicts)
- Best practice: use mobile hotspot when possible for real-time syncing

---

## Why We Need This

### The Problem

Bird banding fieldwork often happens in remote locations with no cell service or WiFi. Currently, data must be recorded on paper and manually entered into the database later—a process that's slow, error-prone, and creates delays in data availability.

### Our Solution

Build an app that works offline, storing data locally on the laptop, then syncs to the cloud when internet is available. This gives us:

- **Immediate digital entry** — No paper forms, no transcription errors
- **Data validation in the field** — App can check for invalid entries on the spot
- **Faster data availability** — Sync as soon as you're back online

### Why "One Admin Offline at a Time"?

We chose a simple sync model to avoid complex conflict resolution:

- **The challenge:** If Alice and Bob both work offline and both create "Bird #50", whose record is correct when they sync? Automatic merging is error-prone for scientific data where accuracy matters.
- **Our approach:** By limiting offline mode to one admin at a time, we guarantee no conflicts. The offline admin "owns" all new data until they sync.
- **The trade-off:** Less flexibility, but 100% data integrity. For a small team doing sequential fieldwork, this is usually fine.

### How We Enforce "One Admin Offline at a Time"

We use a **physical USB key** that acts as an "offline permission token":

- **The key stays at the field shelter** — Where you typically work without internet
- **To work offline** — Plug the USB key into your laptop at the shelter
- **The app checks** — "Is the offline key present?" If yes → Offline mode enabled
- **Only one person at a time** — Only one person can be at the shelter working offline
- **Simple and foolproof** — No complex software locks, no network checks needed
- **Key stays behind** — Leave the USB key at the shelter when you leave

**What's on the USB key?**
- A simple verification file (e.g., `mbo-offline-key.json`)
- The app detects this file and enables offline data entry
- No sensitive data on the key—it's just a permission token

**Benefits of this approach:**
- ✅ **No internet required** — Works even when completely offline
- ✅ **Physical enforcement** — Can't have two people offline simultaneously (only one key exists)
- ✅ **Easy to understand** — "I have the key, I can enter data offline"
- ✅ **No lock conflicts** — No software synchronization issues
- ✅ **Transferable** — Hand the key to the next person when your shift ends

### Why Not Full Offline for Everyone?

Building robust multi-user offline sync (like Google Docs) requires complex conflict resolution, version tracking, and merge strategies. For our use case—a small team where fieldwork is typically done by one person at a time—the simpler approach is more reliable and much faster to build.

---

## Two Ways to Use the App

### Option 1: Offline Mode (No Cell Service)

Best for locations with no cell coverage. Requires the **offline USB key** (which stays at the field shelter).

1. **Before fieldwork** (with internet at home/office): 
   - Open app and let it download latest data to your laptop
2. **At the field shelter** (no internet): 
   - Plug in the offline USB key (kept at the shelter)
   - App detects the key and enables offline data entry
   - Add new bird captures to local storage
   - Unplug USB key when done (leave it at the shelter for next person)
3. **After fieldwork** (back online at home/office): 
   - Open app with internet connection
   - App uploads your new data to the cloud

**⚠️ Only ONE admin can use offline mode at a time!** The physical USB key stays at the shelter—whoever is at the shelter can work offline.

### Option 2: Online Mode (Mobile Hotspot)

Best when you have cell service. Any admin can use their own laptop—connect it to your phone's hotspot, and all changes save instantly to the cloud.

**Benefits:**
- No syncing needed—always up to date
- If needed, multiple admins can work at the same time without conflicts

**Trade-off:** Uses phone battery and data

---

## Installation

| Computer | Instructions |
|----------|--------------|
| **Mac** | Download `.dmg` file → Drag app to Applications folder |
| **Windows** | Download `.exe` file → Run installer |

**First launch requires internet.** Sign in, and the app will download all data from the cloud.

---

## Quick Reference

| Situation | What to Do |
|-----------|------------|
| Going to field (no wifi)? | Open app with internet first, let it sync, then go to shelter |
| At the shelter? | Plug in the USB key (kept there), start entering data |
| Back from field? | Connect to internet, open app, wait for "Synced" |
| Someone else needs offline access? | Sync YOUR data first, they use the key at the shelter |
| Have mobile hotspot? | Use online mode—no USB key needed |
| Lost the USB key? | Take a new USB key and upload the verification file |

---

## Frequently Asked Questions

**Q: What if I forget to sync after fieldwork?**
> A: Your data is safe on your laptop! Just sync next time you have internet. The USB key stays at the shelter, so the next person working there will be able to add new data once you sync.

**Q: What if I lose the USB key?**
> A: Contact your system admin. They can create a new key with the verification file. Only one key should exist at a time.

**Q: Can I work offline without the USB key?**
> A: No. The app requires the physical key to enable offline mode. This prevents accidental conflicts.

**Q: Do I need to keep the USB key plugged in the whole time?**
> A: Yes, while at the shelter entering data. The app periodically checks for the key's presence. Unplug it when you leave—it stays at the shelter.

**Q: Can I see who made changes?**
> A: Yes! All entries are tagged with who added them and when.

**Q: What if the app crashes in the field?**
> A: Data is saved after each entry. Reopen the app (with USB key still plugged in) and continue - nothing is lost.

**Q: What if I don't have internet for several days?**
> A: No problem! Data stays on your laptop until you can sync. The USB key stays at the shelter, so coordinate with your team to avoid conflicts.

**Q: Can two admins work at the same time if they both have internet?**
> A: Yes! When everyone is online, multiple people can work at the same time with no issues. No USB key needed for online mode.

---

## Data Safety & Completeness

### How We Keep Your Data Safe

Your bird banding data is protected through a **dual-storage approach**:

**1. Cloud Storage (Primary)**
- All data is stored in Firebase (Google's cloud database)
- Automatically backed up and replicated across multiple data centers
- Protected by enterprise-grade security
- Accessible from anywhere with internet

**2. Local Copy (Backup)**
- Each admin's laptop maintains a complete copy of the database
- Acts as a backup if cloud access is temporarily unavailable
- Ensures you can always work, even without internet
- Data persists on your device until you explicitly clear it

### Why This Matters

With this approach, you get the best of both worlds:

- **Reliability**: If the cloud service has an outage (rare), your local copy keeps you working
- **Completeness**: Your laptop always has a full, up-to-date copy of all bird records
- **Peace of mind**: Data exists in multiple places—never just one
- **Recovery**: If something happens to your laptop, the cloud has everything
- **Accessibility**: Team members can access the latest data from any device when online

### Data Lifecycle

1. **When online**: Your app automatically syncs with the cloud every few seconds
2. **When offline**: New entries are stored locally on your laptop
3. **When reconnecting**: Local changes upload to the cloud, ensuring nothing is lost
4. **Always**: Both copies stay in sync, giving you redundancy and reliability
