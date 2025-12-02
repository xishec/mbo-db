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

### Why Not Full Offline for Everyone?

Building robust multi-user offline sync (like Google Docs) requires complex conflict resolution, version tracking, and merge strategies. For our use case—a small team where fieldwork is typically done by one person at a time—the simpler approach is more reliable and much faster to build.

---

## Two Ways to Use the App

### Option 1: Offline Mode (No Cell Service)

Best for locations with no cell coverage. Any admin can use their own laptop.

1. **Before fieldwork** (with internet): App downloads latest data to your laptop
2. **During fieldwork** (no internet): Add new bird captures to local storage
3. **After fieldwork** (with internet): App uploads your new data to the cloud

**⚠️ Only ONE admin can use offline mode at a time!** If two admins work offline simultaneously, their changes will conflict when syncing.

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
| Going to field (no wifi)? | Open app with internet first, let it sync, then go |
| Back from field? | Connect to internet, open app, wait for "Synced" |
| Someone else needs offline access? | Upload YOUR data first, then they can download |
| Have mobile hotspot? | Use online mode—no syncing worries |

---

## Frequently Asked Questions

**Q: What if I forget to sync after fieldwork?**
> A: Your data is safe on your laptop! Just sync next time you have internet. BUT make sure no one else goes offline before you upload.

**Q: Can I see who made changes?**
> A: Yes! All entries are tagged with who added them and when.

**Q: What if the app crashes in the field?**
> A: Data is saved after each entry. Reopen the app and continue - nothing is lost.

**Q: What if I don't have internet for several days?**
> A: No problem! Data stays on your laptop until you can sync. Just remember: only one admin should be working offline during that time.

**Q: Can two admins work at the same time if they both have internet?**
> A: Yes! When everyone is online, multiple people can work at the same time with no issues.

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
