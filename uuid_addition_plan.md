# NeonDrawingApp.jsx パス作成時のUUID追加計画

## 現在のパス作成箇所

### 1. startNewPath関数（行1213）
```javascript
const newPath = { points: [], mode: drawMode, type: drawingType };
```

### 2. handleMouseClick関数（行2696）
```javascript
const newPath = { points: [], mode: drawMode, type: drawingType };
```

### 3. 長方形土台生成（行3740）
```javascript
const newPath = {
    points: rectanglePoints,
    mode: 'fill',
    type: 'straight'
};
```

### 4. 自動形状土台生成（行1822）
```javascript
const newPath = {
    points: autoShapeBase,
    mode: 'fill',
    type: 'straight'
};
```

### 5. プロジェクトファイル読み込み時の新しいパス作成
- 行1506: `const newPath = { points: [], mode: drawMode, type: drawingType };`
- 行1542: `const newPath = { points: [], mode: drawMode, type: drawingType };`
- 行1562: `const newPath = { points: [], mode: drawMode, type: drawingType };`
- 行1635: `const newPath = { points: [], mode: drawMode, type: drawingType };`

### 6. 初期パス作成（行103）
```javascript
const defaultPaths = [{ points: [], mode: 'stroke', type: 'spline' }];
```

### 7. パス削除時の新しいパス作成（行2468）
```javascript
newPaths.push({ points: [], mode: drawMode, type: drawingType });
```

## 修正案

各パス作成箇所で以下のようにuuidを追加：

```javascript
import { v4 as uuidv4 } from 'uuid';

// 修正例：
const newPath = { 
    id: uuidv4(),
    points: [], 
    mode: drawMode, 
    type: drawingType 
};
```

## 必要な作業

1. uuidパッケージのインポート追加
2. 各パス作成箇所での`id: uuidv4()`の追加
3. 初期パス作成時のuuid追加
4. 既存パスに対するuuid追加の互換性確保