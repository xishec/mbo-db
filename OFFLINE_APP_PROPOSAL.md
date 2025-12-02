# MBO Database - Offline Desktop App Proposal

## What We're Building

A desktop app that lets you record bird data in the field **without internet**, then sync it back when you're online.

---

## How It Works

There are two ways to use the app:

### Mode 1: Offline Mode (No Internet in the Field)

The cloud database serves as the "master copy" of all data. When using offline mode:

1. **Before fieldwork** (with internet): The app downloads the latest data from the cloud to your laptop.
2. **During fieldwork** (no internet): You work offline, adding new bird captures to your laptop's local storage.
3. **After fieldwork** (with internet): The app syncs and uploads all your new data back to the cloud.

**⚠️ WARNING: Only ONE admin can use offline mode at a time!**

---

### Mode 2: Always Online Mode (Using Mobile Hotspot)

Each admin connects their laptop to the internet via their phone's mobile hotspot. All laptops connect directly to the cloud database.

**Benefits:**
- Multiple admins can work at the same time
- Changes save instantly to the cloud
- No syncing needed - always up to date
- Everyone sees each other's changes immediately

---

### Which Mode Should I Use?

| Mode | Best For | Limitations |
|------|----------|-------------|
| **Offline** | No cell service at all | Only ONE admin at a time |
| **Online (hotspot)** | Has cell service | Uses phone battery & data |

---

## User Roles

| Role | What They Can Do | Offline Access? |
|------|------------------|-----------------|
| **Admin** | View, add, edit, delete data | Yes |
| **Regular User** | View data only | No (online only) |

---

## The Daily Workflow

### A Typical Field Day

**Before fieldwork** (somewhere with internet):
1. Admin opens the app
2. App downloads latest data from cloud
3. App displays "Ready for offline use!"

**During fieldwork** (no internet):
4. Admin records new bird captures
5. Data saves locally on laptop
6. App shows "Offline Mode" indicator

**After fieldwork** (somewhere with internet):
7. Admin opens app (auto-connects)
8. App uploads all new data to cloud
9. App displays "All changes synced!"

---

## The Golden Rule

### Only ONE offline admin at a time!

**Correct approach:** On Day 1, Alice goes offline to do fieldwork. She returns and uploads her data. Everything works perfectly.

**Wrong approach:** On Day 1, both Alice and Bob go offline at the same time. They both add a bird with ID #50. When they try to sync, there's a conflict—whose Bird #50 is correct?

**Why this matters:** If two people edit data offline at the same time, the system can't know whose changes are correct.

---

## Alternative: Use Mobile Hotspot

If possible, admins can use their phone's mobile hotspot for internet access in the field. Your phone provides cellular internet via WiFi to your laptop, keeping the app online.

**Benefits:**
- No syncing needed
- Multiple people can work simultaneously
- Changes save instantly

---

## How to Get the App

### Download

Visit our website and download the app for your computer:

| Computer Type | Download |
|---------------|----------|
| **Mac** | Download the `.dmg` file |
| **Windows** | Download the `.exe` file |

### Install

**Mac:**
1. Open the downloaded `.dmg` file
2. Drag the app to your Applications folder
3. Done!

**Windows:**
1. Run the downloaded `.exe` file
2. Follow the installation wizard
3. Done!

### First Launch (requires internet!)

When you first open the app, you'll see a login screen where you enter your username and password. After signing in, the app downloads all data from the cloud. Once complete, you're ready to use the app!

---

## Quick Reference Card

| Situation | What to Do |
|-----------|------------|
| **Going to field (no wifi)?** | Open app with internet first, let it sync, then close. You're ready! |
| **Back from field?** | Connect to internet, open app, wait for "Synced", done! |
| **Someone else needs offline access?** | Make sure YOU upload first, then they can download |
| **Have mobile hotspot?** | Use online mode - no syncing worries! |
| **Just want to look at data?** | Any user can view anytime (needs internet) |

---

## Summary

| Feature | Details |
|---------|---------|
| **Available for** | Mac and Windows |
| **Who can use offline?** | Admins only |
| **How many offline at once?** | ONE admin at a time |
| **Who syncs?** | The admin who worked offline |
| **What can regular users do?** | View data (online only) |
| **Best practice** | Use mobile hotspot when possible |

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

## Summary

The MBO Database app allows admins to work offline and sync data later. Regular users can view data online only. The key rule is that only one admin should work offline at a time to avoid sync conflicts. When possible, using a mobile hotspot is the best approach since it allows multiple admins to work simultaneously without any syncing concerns.
