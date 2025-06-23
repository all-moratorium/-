// サイズ計算のユーティリティ関数

/**
 * パスの境界ボックスを計算
 * @param {Array} paths - パスの配列
 * @returns {Object} { minX, minY, maxX, maxY }
 */
export const calculateBoundingBox = (paths) => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    if (!paths || paths.length === 0) {
        return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    }
    
    paths.forEach(path => {
        if (path && path.points && path.points.length > 0) {
            path.points.forEach(point => {
                if (point && typeof point.x === 'number' && typeof point.y === 'number') {
                    minX = Math.min(minX, point.x);
                    minY = Math.min(minY, point.y);
                    maxX = Math.max(maxX, point.x);
                    maxY = Math.max(maxY, point.y);
                }
            });
        }
    });
    
    // パスが空の場合のデフォルト値
    if (minX === Infinity) {
        return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    }
    
    return { minX, minY, maxX, maxY };
};

/**
 * SVGのサイズをcmとpxで計算
 * @param {Array} paths - パスの配列
 * @param {number} gridSize - グリッドサイズ（デフォルト: 100px = 4cm）
 * @returns {Object} { width, height, widthPx, heightPx }
 */
export const calculateSvgSizeCm = (paths, gridSize = 100) => {
    const { minX, minY, maxX, maxY } = calculateBoundingBox(paths);
    const svgWidth = maxX - minX;
    const svgHeight = maxY - minY;
    
    // 100px = 4cm の比率で計算
    const svgWidthCm = (svgWidth / gridSize) * 4;
    const svgHeightCm = (svgHeight / gridSize) * 4;
    
    return { 
        width: Math.max(0, svgWidthCm), 
        height: Math.max(0, svgHeightCm),
        widthPx: Math.max(0, svgWidth),
        heightPx: Math.max(0, svgHeight)
    };
};

/**
 * パスの総長を計算（ネオンチューブの長さ）
 * @param {Array} paths - パスの配列
 * @returns {number} 総長（cm）
 */
export const calculateTotalLength = (paths) => {
    if (!paths || paths.length === 0) return 0;
    
    let totalLength = 0;
    
    paths.forEach(path => {
        if (path && path.points && path.points.length > 1) {
            for (let i = 1; i < path.points.length; i++) {
                const prev = path.points[i - 1];
                const curr = path.points[i];
                
                if (prev && curr && 
                    typeof prev.x === 'number' && typeof prev.y === 'number' &&
                    typeof curr.x === 'number' && typeof curr.y === 'number') {
                    
                    const dx = curr.x - prev.x;
                    const dy = curr.y - prev.y;
                    const segmentLength = Math.sqrt(dx * dx + dy * dy);
                    
                    // px → cm 変換（100px = 4cm）
                    totalLength += (segmentLength / 100) * 4;
                }
            }
        }
    });
    
    return totalLength;
};

/**
 * 指定されたサイズに合わせてパスをスケールする
 * @param {Array} paths - パスの配列
 * @param {Object} targetSize - 目標サイズ { width: number, height: number }
 * @param {number} gridSize - グリッドサイズ（デフォルト: 100px = 4cm）
 * @returns {Array} スケールされたパス配列
 */
export const scalePathsToSize = (paths, targetSize, gridSize = 100) => {
    if (!paths || paths.length === 0) return paths;
    
    const currentSize = calculateSvgSizeCm(paths, gridSize);
    
    // 現在のサイズが0の場合はスケールできない
    if (currentSize.width === 0 || currentSize.height === 0) return paths;
    
    // スケール比率を計算
    const scaleX = targetSize.width / currentSize.width;
    const scaleY = targetSize.height / currentSize.height;
    
    // 境界ボックスを取得してスケール用の中心点を計算
    const { minX, minY, maxX, maxY } = calculateBoundingBox(paths);
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    
    // パスをスケール
    return paths.map(pathObj => {
        if (!pathObj || !Array.isArray(pathObj.points)) return pathObj;
        
        const scaledPoints = pathObj.points.map(point => {
            if (!point || typeof point.x !== 'number' || typeof point.y !== 'number') {
                return point;
            }
            
            // 中心点からの相対位置を計算
            const relativeX = point.x - centerX;
            const relativeY = point.y - centerY;
            
            // スケール適用
            const scaledX = relativeX * scaleX;
            const scaledY = relativeY * scaleY;
            
            // 新しい座標を計算
            return {
                ...point,
                x: centerX + scaledX,
                y: centerY + scaledY
            };
        });
        
        return { ...pathObj, points: scaledPoints };
    });
};