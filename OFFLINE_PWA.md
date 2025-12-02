# Offline PWA Support

This app is a Progressive Web App (PWA) that works offline after the first visit.

## How It Works

### Two-Layer Caching Strategy

| Layer | What it Caches | Purpose |
|-------|---------------|---------|
| **Service Worker** | HTML, JS, CSS, images, fonts | App can **load** offline |
| **IndexedDB** | Captures, Magic Table data | App has **data** offline |

### Flow Diagram

```
First Visit (Online):
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │────▶│   Server    │────▶│  Firebase   │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │
       ▼                   ▼
┌─────────────┐     ┌─────────────┐
│Service Worker│    │  IndexedDB  │
│  (caches    │     │  (caches    │
│  app shell) │     │   data)     │
└─────────────┘     └─────────────┘

Subsequent Visits (Offline):
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │────▶│Service Worker│────▶│  IndexedDB  │
└─────────────┘     │  (serves    │     │  (serves    │
                    │  cached JS, │     │   cached    │
                    │  CSS, HTML) │     │   data)     │
                    └─────────────┘     └─────────────┘
```

## Features

### 1. Service Worker (Workbox)
- Automatically caches all static assets on first visit
- Updates automatically when new versions are deployed
- Configured in `vite.config.ts` using `vite-plugin-pwa`

### 2. IndexedDB Data Caching
- Captures and Magic Table are cached locally
- Timestamp-based cache validation
- Automatic sync when back online
- Located in `src/services/indexedDB.ts`

### 3. Offline Detection
- `useOnlineStatus` hook tracks connection status
- DataService falls back to cached data when offline
- Located in `src/hooks/useOnlineStatus.ts`

### 4. Offline Indicator
- Amber banner appears when offline
- Shows "Offline Mode - Using cached data"
- Located in `src/components/OfflineIndicator.tsx`

## Testing Offline Mode

### Method 1: Browser DevTools
1. Open the app in Chrome/Edge
2. Open DevTools (F12)
3. Go to **Network** tab
4. Check **Offline** checkbox
5. Refresh the page - it should still load!

### Method 2: Disable Network
1. Turn off WiFi/Ethernet
2. The app continues to work with cached data
3. An "Offline Mode" indicator appears at the bottom left

## Installation as App

The PWA can be installed on devices:

### Desktop (Chrome/Edge)
1. Visit the app
2. Click the install icon in the address bar (or the ⋮ menu → "Install MBO Database")
3. The app opens in its own window

### Mobile (iOS Safari)
1. Visit the app
2. Tap Share → "Add to Home Screen"
3. The app appears as an icon on your home screen

### Mobile (Android Chrome)
1. Visit the app
2. Tap the banner or menu → "Add to Home Screen"
3. The app installs like a native app

## Technical Details

### Files Added/Modified

| File | Purpose |
|------|---------|
| `vite.config.ts` | PWA plugin configuration |
| `index.html` | Meta tags for PWA |
| `public/pwa-192x192.svg` | App icon (small) |
| `public/pwa-512x512.svg` | App icon (large) |
| `src/hooks/useOnlineStatus.ts` | Online/offline detection hook |
| `src/components/OfflineIndicator.tsx` | Offline status UI |
| `src/services/DataService.tsx` | Offline-aware data fetching |

### Build Output

When you run `npm run build`, these PWA files are generated:

```
dist/
├── sw.js                  # Service Worker
├── workbox-*.js           # Workbox runtime
├── manifest.webmanifest   # PWA manifest
├── registerSW.js          # Auto-registration script
└── ...
```

### Dependencies

```json
{
  "devDependencies": {
    "vite-plugin-pwa": "^x.x.x",
    "workbox-window": "^x.x.x"
  }
}
```

## How It Works (Simple Explanation)

Think of it like downloading a Netflix show for offline viewing:

1. **First time you visit**: The app downloads and saves itself to your device
2. **Data gets saved locally**: All the bird capture records are stored on your device
3. **No internet? No problem**: The app and data are already on your device

---

## What Happens in Different Situations

### 📱 First Time Opening the App (with internet)

```
You ──────────► Internet ──────────► MBO Database Server
                                            │
                                            ▼
                                    "Here's the app and
                                     all the bird data!"
                                            │
                                            ▼
                              💾 Saved to your device
```

**What's happening:**
- The app downloads to your phone/computer
- All bird capture records download too
- Everything gets saved locally for later
- ✅ You can now use the app anytime!

---

### 🔄 Coming Back Later (with internet)

```
You ──────────► Your Device
                    │
                    ▼
              "I already have
               the app saved!"
                    │
                    ▼
              App loads instantly ⚡
                    │
                    ▼
              Quick check: "Any new data online?"
                    │
              ┌─────┴─────┐
              ▼           ▼
           Yes? 📥      No? ✓
        Download it   Use what I have
```

**What's happening:**
- App opens instantly (it's already on your device!)
- Quick background check for any new records
- If there's new data, it updates automatically
- ✅ Fast loading + always up to date

---

### 📴 Opening the App Without Internet

```
You ──────────► Your Device
                    │
                    ▼
              "I have the app
               saved locally!"
                    │
                    ▼
              App loads! ✅
                    │
                    ▼
              "I have bird data
               saved too!"
                    │
                    ▼
              Shows your data ✅
                    │
                    ▼
              ⚠️ "Offline Mode" banner appears
              (so you know you're using saved data)
```

**What's happening:**
- App works because it's saved on your device
- Shows bird records from your last visit
- Orange banner reminds you that you're offline
- ✅ Full access to view and search records!

---

### 🔌 Internet Drops While Using the App

```
You're using the app normally...
              │
              ▼
        Internet dies 💀
              │
              ▼
        ⚠️ "Offline Mode" banner appears
              │
              ▼
        App keeps working!
        (using saved data)
              │
              ▼
        Internet comes back 🎉
              │
              ▼
        Banner disappears
        Back to normal!
```

**What's happening:**
- You won't lose your work
- App seamlessly switches to saved data
- When internet returns, everything syncs up
- ✅ Uninterrupted workflow!

---

## The Bottom Line

| Situation | What Happens |
|-----------|--------------|
| **First visit** | App + data downloads and saves to your device |
| **Return visit (online)** | Opens instantly, quietly checks for updates |
| **Offline** | Works perfectly using saved data |
| **Internet drops** | Keeps working, syncs when back online |

**Key Point:** After your first visit, you can use this app anywhere – in the field with no cell service, on a plane, or during an internet outage. Just make sure to open it once while connected so it can save everything!

## Limitations

- **First visit requires internet**: The app must be loaded once online to cache assets
- **Data freshness**: Offline data may be stale if not synced recently
- **Write operations**: Any data modifications while offline won't sync to Firebase until back online (currently read-only offline)

## Troubleshooting

### App not loading offline
1. Make sure you visited the app at least once while online
2. Check DevTools → Application → Service Workers (should show "activated")
3. Check DevTools → Application → Cache Storage (should have cached assets)

### Data not showing offline
1. Check DevTools → Application → IndexedDB → mbo-db
2. Verify captures and magicTable stores have data
3. The app needs to have loaded data at least once while online

### Clearing cache (for testing)
1. DevTools → Application → Storage → Clear site data
2. This removes Service Worker cache AND IndexedDB data
