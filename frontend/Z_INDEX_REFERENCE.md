# Quick Z-Index Reference Card

## Visual Layer Map

```
┌─────────────────────────────────────────┐
│  z-[9999] DriverDashboard (full screen) │ ← Pilot mode
├─────────────────────────────────────────┤
│  z-[9998] OfflineBanner                  │ ← Network status
├─────────────────────────────────────────┤
│  z-[4000] Toast Notifications            │ ← Always on top
├─────────────────────────────────────────┤
│  z-[3500] SOS Overlay                    │ ← Emergency
├─────────────────────────────────────────┤
│  z-[3000] Report Incident                │ ← Modal with backdrop
├─────────────────────────────────────────┤
│  z-[2500] Highway Browser                │ ← Modal with backdrop
├─────────────────────────────────────────┤
│  z-[2200] Bottom Info Area               │ ← Incident details
├─────────────────────────────────────────┤
│  z-[2000] Map Layers Panel               │ ← Top-right panel
├─────────────────────────────────────────┤
│  z-[1950] System Menu Backdrop           │ ← Full screen overlay
├─────────────────────────────────────────┤
│  z-[1900] System Menu Panel              │ ← Settings dropdown
├─────────────────────────────────────────┤
│  z-[1800] Sidebar                        │ ← Left panel
├─────────────────────────────────────────┤
│  z-[1500] Distance Calculator            │ ← Top-right panel
├─────────────────────────────────────────┤
│  z-[1200] Floating Menu (FAB)            │ ← Bottom-right actions
├─────────────────────────────────────────┤
│  z-[1000] Quick Action FABs              │ ← SOS + Highway buttons
├─────────────────────────────────────────┤
│  z-[900]  Header Language Dropdown       │
├─────────────────────────────────────────┤
│  z-[800]  Header                          │
├─────────────────────────────────────────┤
│  z-[501]  Search Overlay (inner)         │
├─────────────────────────────────────────┤
│  z-[500]  Search Overlay (wrapper)       │
├─────────────────────────────────────────┤
│  z-[100]  Map Controls                    │ ← Zoom + Recenter
├─────────────────────────────────────────┤
│  z-[50]   Leaflet Markers/Overlays       │
├─────────────────────────────────────────┤
│  z-[0]    Map (Leaflet)                  │
└─────────────────────────────────────────┘
```

## Component Behavior Matrix

| Component | Position | Opens | Closes | Auto-Closes When |
|-----------|----------|-------|--------|------------------|
| **Sidebar** | Left, h-full | Header menu / AI ask | X button | Incident selected / Pilot mode |
| **SystemMenu** | Top-right | Header ⋮ button | Backdrop click / ESC | Sidebar opens / MapLayers opens |
| **MapLayers** | Top-right | SystemMenu item | X button / ESC | SystemMenu opens |
| **DistanceCalc** | Top-right | FloatingMenu / MapLayers | X button / ESC | SystemMenu opens |
| **FloatingMenu** | Bottom-right | FAB + button | Same button | Service selected |
| **BottomInfo** | Bottom-center | Incident click | X button | - |
| **HighwayBrowser** | Center modal | FAB 🛣️ button | X / backdrop / ESC | Report opens / Pilot mode |
| **ReportIncident** | Center modal | FloatingMenu | X / backdrop / ESC | HighwayBrowser opens |
| **SOSOverlay** | Center modal | FAB 🚨 button | X button / ESC | - |
| **SearchOverlay** | Top-center | Always visible | Dropdown auto-close | - |
| **Toast** | Top-right | Programmatic | Auto 5s / X click | - |
| **DriverDashboard** | Full screen | Pilot toggle | LogOut button | - |
| **OfflineBanner** | Bottom-center | Network change | Auto reconnect | - |

## Mutual Exclusivity Rules

### Group 1: Top-Right Panels (Only 1 at a time)
- SystemMenu
- MapLayersPanel
- DistanceCalculator

**Rule**: Opening one closes the others

### Group 2: Full-Screen Modals (Only 1 at a time)
- HighwayBrowser
- ReportIncident
- SOSOverlay

**Rule**: All have backdrops that block interaction. Opening one should close others.

### Group 3: Independent (Can coexist)
- Sidebar (left side)
- BottomInfoArea (bottom)
- SearchOverlay (always visible)
- FloatingMenu (bottom-right)
- MapControls (right side)

### Special: Pilot Mode
**Rule**: Entering Pilot Mode closes EVERYTHING except DriverDashboard

---

## CSS Classes for Common Patterns

### Modal with Backdrop
```tsx
// Backdrop (full screen, clickable to close)
<div className="fixed inset-0 z-[backdrop] bg-black/50" onClick={onClose} />

// Modal panel (centered)
<div className="fixed inset-0 z-[modal] flex items-center justify-center p-4">
  <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-lg w-full">
    {/* Content */}
  </div>
</div>
```

### Side Panel
```tsx
<div className="absolute top-0 left-0 h-full z-[panel] w-80 bg-white/85 dark:bg-slate-900/90 backdrop-blur-xl border-r transform transition-transform duration-300">
  {/* Content */}
</div>
```

### Floating Panel
```tsx
<div className="absolute top-20 right-4 z-[panel] w-64 bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl rounded-2xl border shadow-xl">
  {/* Content */}
</div>
```

### Bottom Sheet (Mobile-Friendly)
```tsx
<div className="fixed bottom-0 left-0 right-0 z-[bottom-sheet] p-4">
  <div className="max-w-4xl mx-auto bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-t-[2.5rem] shadow-2xl border max-h-[calc(100vh-2rem)] overflow-y-auto">
    {/* Content - will scroll if too tall */}
  </div>
</div>
```

### Map Overlay (Doesn't Block Map)
```tsx
<div className="absolute bottom-36 right-4 z-[overlay] pointer-events-none">
  <div className="pointer-events-auto bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-2xl border shadow-xl">
    {/* Content - only this part blocks map clicks */}
  </div>
</div>
```
