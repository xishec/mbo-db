# MBO Database - Offline Desktop App Proposal

## What We're Building

A desktop app that lets you record bird data in the field **without internet**, then sync it back when you're online.

---

## How It Works

### Think of it Like a Shared Notebook

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   ☁️ CLOUD DATABASE                                     │
│   (The "master copy" - always online)                   │
│                                                         │
│         ▲                           ▲                   │
│         │ download                  │ upload            │
│         │ before                    │ after             │
│         │ fieldwork                 │ fieldwork         │
│         │                           │                   │
│   ┌─────┴─────┐               ┌─────┴─────┐            │
│   │  📥       │               │  📤       │            │
│   │  Sync     │    🏕️         │  Sync     │            │
│   │  Before   │  FIELDWORK    │  After    │            │
│   └───────────┘  (no wifi)    └───────────┘            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## User Roles

| Role | What They Can Do | Offline Access? |
|------|------------------|-----------------|
| **Admin** | View, add, edit, delete data | ✅ Yes |
| **Regular User** | View data only | ❌ No (online only) |

---

## The Daily Workflow

### 📅 A Typical Field Day

```
🌅 BEFORE FIELDWORK (somewhere with internet)
───────────────────────────────────────────
    1. Admin opens the app
    2. App downloads latest data from cloud
    3. ✅ "Ready for offline use!"
    
    
🏕️ DURING FIELDWORK (no internet)
───────────────────────────────────────────
    4. Admin records new bird captures
    5. Data saves locally on laptop
    6. App shows "📴 Offline Mode"
    
    
🌆 AFTER FIELDWORK (somewhere with internet)
───────────────────────────────────────────
    7. Admin opens app (auto-connects)
    8. App uploads all new data to cloud
    9. ✅ "All changes synced!"
```

---

## The Golden Rule ⚠️

### Only ONE offline admin at a time!

```
    ✅ CORRECT                    ❌ WRONG
    
    Day 1: Alice                  Day 1: Alice AND Bob
           goes offline                  both go offline
              │                             │    │
              ▼                             ▼    ▼
           Alice                         Alice  Bob
           returns,                      both add
           uploads                       Bird #50
              │                             │    │
              ▼                             ▼    ▼
         ✅ All good!               🔥 CONFLICT!
                                    Whose Bird #50
                                    is correct?
```

**Why?** If two people edit data offline at the same time, the system can't know whose changes are correct.

---

## Alternative: Use Mobile Hotspot

If possible, admins can use their phone's mobile hotspot for internet access in the field:

```
    📱 ─── wifi ───► 💻
    Phone            Laptop
    (cellular)       (app stays online)
    
    ✅ No syncing needed
    ✅ Multiple people can work
    ✅ Changes save instantly
```

---

## How to Get the App

### Download

Visit our website and download the app for your computer:

| Computer Type | Download |
|---------------|----------|
| 🍎 **Mac** | Download the `.dmg` file |
| 🪟 **Windows** | Download the `.exe` file |

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

```
┌────────────────────────────────────┐
│                                    │
│   Welcome to MBO Database!         │
│                                    │
│   Username: [_______________]      │
│                                    │
│   Password: [_______________]      │
│                                    │
│           [Sign In]                │
│                                    │
└────────────────────────────────────┘
              │
              ▼
     App downloads all data
              │
              ▼
      ✅ Ready to use!
```

---

## Quick Reference Card

| Situation | What to Do |
|-----------|------------|
| **Going to field (no wifi)?** | Open app with internet first, let it sync, then close. You're ready! |
| **Back from field?** | Connect to internet, open app, wait for "Synced ✅", done! |
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

## Visual Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                        MBO DATABASE                             │
│                                                                 │
│   ┌─────────┐         ┌─────────┐         ┌─────────┐          │
│   │         │         │         │         │         │          │
│   │  ADMIN  │         │  CLOUD  │         │  USER   │          │
│   │         │         │         │         │         │          │
│   └────┬────┘         └────┬────┘         └────┬────┘          │
│        │                   │                   │                │
│        │◄──── sync ───────►│◄─── view only ───►│               │
│        │                   │                   │                │
│        ▼                   │                   │                │
│   Can work                 │              Needs internet        │
│   OFFLINE                  │              to see data           │
│                            │                                    │
│   ⚠️ Only ONE              │                                    │
│   admin offline            │                                    │
│   at a time!               │                                    │
│                            │                                    │
└─────────────────────────────────────────────────────────────────┘
```
