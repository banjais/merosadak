# ESC Key Implementation - Remaining Components

## ✅ COMPLETED
- HighwayBrowser.tsx
- SystemMenu.tsx
- useEscapeKey.ts hook created

## 📝 REMAINING - Add to these components:

### 1. ReportIncidentOverlay.tsx
**Line ~1** (add import):
```tsx
import { useEscapeKey } from '../hooks/useEscapeKey';
```

**Line ~58** (after component declaration):
```tsx
export const ReportIncidentOverlay: React.FC<ReportIncidentOverlayProps> = ({
  isOpen,
  onClose,
  location,
  onSuccess
}) => {
  // ... existing state ...

  // Close on Escape key
  useEscapeKey(handleClose, isOpen);
```

### 2. SOSOverlay.tsx
**Line ~1** (add import):
```tsx
import { useEscapeKey } from '../hooks/useEscapeKey';
```

**Line ~15** (after component declaration):
```tsx
export const SOSOverlay: React.FC<SOSOverlayProps> = ({
  isOpen,
  onClose,
  userLocation
}) => {
  // ... existing state ...

  // Close on Escape key
  useEscapeKey(onClose, isOpen);
```

### 3. MapLayersPanel.tsx
**Line ~1** (add import):
```tsx
import { useEscapeKey } from '../hooks/useEscapeKey';
```

**Line ~14** (after component declaration):
```tsx
export const MapLayersPanel: React.FC<MapLayersPanelProps> = ({
  isDarkMode,
  onClose,
  onToggleMonsoon,
  monsoonVisible,
  onOpenDistanceCalc
}) => {
  // Close on Escape key
  useEscapeKey(onClose);
```

### 4. DistanceCalculator.tsx
**Line ~1** (add import):
```tsx
import { useEscapeKey } from '../hooks/useEscapeKey';
```

**After component declaration**:
```tsx
export const DistanceCalculator: React.FC<DistanceCalculatorProps> = ({
  onClose,
  points,
  clearPoints
}) => {
  // Close on Escape key
  useEscapeKey(onClose);
```

---

## Testing Checklist

After adding to all components:

1. Open HighwayBrowser → Press ESC → should close ✅
2. Open SystemMenu → Press ESC → should close ✅
3. Open ReportIncident → Press ESC → should close ✅
4. Open SOSOverlay → Press ESC → should close ✅
5. Open MapLayersPanel → Press ESC → should close ✅
6. Open DistanceCalculator → Press ESC → should close ✅

**Note**: ESC should only work when the modal is open (isOpen=true)
