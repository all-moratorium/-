# LocalStorage Quota Analysis Report

## Executive Summary

Based on deep analysis of the neon-sign-app codebase, the LocalStorage quota issue is primarily caused by **exponential data growth due to history accumulation**. Each user action creates a full snapshot of the entire drawing state, including all paths and points, which gets stored in both the history array and LocalStorage.

## Data Structure Analysis

### 1. LocalStorage Keys Used

The application uses **2 main LocalStorage keys**:
- `neonDrawingData` - Main drawing data (NeonDrawingApp.jsx)
- `textGeneratorData` - Text generator settings (TextGenerator.jsx)

Note: The Costomize.jsx component has localStorage code commented out due to "Claude.ai restrictions".

### 2. Point Data Structure

Each point in the drawing is stored as:
```javascript
{ x: 123.456, y: 789.012 }
```

**Size Analysis:**
- JSON string: `{"x":123.456,"y":789.012}` = 25 bytes
- UTF-16 storage: 50 bytes per point

### 3. Full Data Structure Hierarchy

```
neonDrawingData (localStorage key)
├── paths[] (array of drawing paths)
│   ├── points[] (array of coordinate points)
│   ├── mode (string: 'stroke' or 'fill')
│   └── type (string: 'spline', 'straight', 'rectangle', etc.)
├── currentPathIndex (number)
├── drawMode (string)
├── drawingType (string)
├── scale, offsetX, offsetY (viewport state)
├── backgroundImage (base64 string - can be huge)
├── background settings (multiple properties)
├── grid settings (multiple properties)
├── colors (object with 7 color properties)
├── lineWidths (object with 2 width properties)
├── history[] (array of complete state snapshots)
└── historyIndex (number)
```

## Critical Issue: History Accumulation

### The Problem
The `saveToHistory` function creates a **complete deep copy** of the entire drawing state for every user action:

```javascript
const newState = {
    paths: JSON.parse(JSON.stringify(currentPaths)), // DEEP COPY OF ALL PATHS
    currentPathIndex: currentPathIdx,
    drawMode: currentDrawMode,
    drawingType: currentDrawingType
};
```

### Storage Impact Calculation

**Base data size**: 552 bytes (without paths/history)
**Each point**: 25 bytes
**Path overhead**: 45 bytes per path

### Scenario Analysis

| Scenario | Paths | Points/Path | History Entries | Total Size | Status |
|----------|-------|-------------|----------------|------------|--------|
| Small Drawing | 5 | 10 | 20 | 4.90 KB | ✅ Safe |
| Medium Drawing | 10 | 50 | 50 | 674 KB | ⚠️ Caution |
| Large Drawing | 20 | 200 | 100 | **10.11 MB** | ❌ Quota Exceeded |
| Extreme Drawing | 50 | 500 | 200 | **125.04 MB** | ❌ Massively Exceeded |

## Root Cause Analysis

### 1. History Explosion
- **Every click** adds a complete state snapshot to history
- **Every point modification** adds a complete state snapshot
- **Every path operation** adds a complete state snapshot
- History limit is 30 entries, but each entry contains the ENTIRE drawing state

### 2. Data Duplication
The same path data is stored multiple times:
- In the current `paths` array
- In each history entry (up to 30 copies)
- In LocalStorage as JSON string

### 3. No Compression
- Coordinates are stored as full floating-point numbers
- No data compression applied
- Base64 background images can be massive

## Memory Leak Patterns

### 1. Accumulating History
```javascript
// This happens on EVERY user action:
const finalHistory = newHistory.length > 30 ? newHistory.slice(-30) : newHistory;
```
While history is limited to 30 entries, each entry contains the complete drawing state.

### 2. LocalStorage Persistence
Every history save also triggers a LocalStorage save:
```javascript
localStorage.setItem('neonDrawingData', JSON.stringify(dataToSave));
```

### 3. No Cleanup Mechanisms
- No automatic cleanup of old data
- No storage quota monitoring
- No user warnings about storage usage

## Quota Breaking Points

For a typical 5MB LocalStorage quota:
- **Max points (no history)**: 209,693 points
- **Max points (with history)**: 104,846 points
- **Max points per path (10 paths)**: 10,484 points per path

**Real-world breaking point**: A drawing with 20 paths of 200 points each will exceed the 5MB quota due to history accumulation.

## Clearing/Refresh Mechanisms

### 1. Manual Clearing
- `clearCanvas()` function exists but only clears drawing data
- "全てクリア" button requires user confirmation
- No automatic cleanup

### 2. Page Reload Detection
```javascript
// Code exists to detect page reload, but clearing is commented out
// リロード時のLocalStorageクリアは削除（ユーザーの選択に委ねる）
```

### 3. No Automatic Cleanup
- No storage quota monitoring
- No automatic history pruning
- No data compression

## Recommendations

### 1. Immediate Fixes (High Priority)
1. **Reduce history data size**: Store only changed paths instead of entire state
2. **Implement storage monitoring**: Warn users when approaching quota
3. **Add automatic cleanup**: Clear old history entries more aggressively

### 2. Medium-term Solutions
1. **Implement delta compression**: Store only differences between states
2. **Coordinate compression**: Round coordinates to reduce precision
3. **Background image optimization**: Compress or limit image sizes

### 3. Long-term Solutions
1. **Move to IndexedDB**: Higher storage limits and better performance
2. **Implement cloud storage**: Optional cloud sync for large drawings
3. **Add storage management UI**: Let users manage their storage usage

## Conclusion

The LocalStorage quota issue is primarily caused by the exponential growth of history data. Each user action creates a complete snapshot of the entire drawing state, leading to rapid storage consumption. A medium-complexity drawing with 10 paths of 50 points each and 50 history entries can consume 674 KB, while a large drawing easily exceeds the 5MB quota.

The solution requires reducing the data stored in history entries and implementing proper storage management and cleanup mechanisms.