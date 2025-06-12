import React, { useState, useRef, useEffect, useCallback } from 'react';
import './Costomize.css';

/* 背景色設定 */

// カスタマイズデータを保存するためのローカルストレージキー
const CUSTOMIZE_DATA_KEY = 'neon-customize-data';

const Costomize = ({ svgData, initialState, onStateChange }) => {
    // 初期状態の設定（propsから受け取るか、デフォルト値を使用）
    const [selectedColor, setSelectedColor] = useState(initialState?.selectedColor || '#ff0080');
    const brightness = 100; // 固定値
    const [thickness, setThickness] = useState(initialState?.thickness || 20);
    const glowIntensity = 50; // 固定値
    const [blinkEffect, setBlinkEffect] = useState(initialState?.blinkEffect || false);
    const [animationSpeed, setAnimationSpeed] = useState(initialState?.animationSpeed || 1);
    const [sidebarVisible, setSidebarVisible] = useState(initialState?.sidebarVisible !== undefined ? initialState.sidebarVisible : true);
    const [neonPower, setNeonPower] = useState(initialState?.neonPower !== undefined ? initialState.neonPower : true); // ネオンON/OFF状態
    const [backgroundColor, setBackgroundColor] = useState(initialState?.backgroundColor || '#0d0d0d'); // RGB(13,13,13)
    const [backgroundColorOff, setBackgroundColorOff] = useState(initialState?.backgroundColorOff || '#e6e6e6'); // RGB(230,230,230)
    const [gridColor, setGridColor] = useState(initialState?.gridColor || '#646464'); // RGB(100,100,100)
    const [gridColorOff, setGridColorOff] = useState(initialState?.gridColorOff || '#000000'); // RGB(0,0,0)
    const [showGrid, setShowGrid] = useState(initialState?.showGrid !== undefined ? initialState.showGrid : true);
    const [gridOpacity, setGridOpacity] = useState(initialState?.gridOpacity || 0.3); // 30%
    const [gridSize, setGridSize] = useState(initialState?.gridSize || 100); // ネオン下絵と同じ4cm = 100px (20px=8mm基準)
    const [canvasWidth, setCanvasWidth] = useState(800);
    const [canvasHeight, setCanvasHeight] = useState(600);
    const [svgPaths, setSvgPaths] = useState([]);
    const [pathColors, setPathColors] = useState(initialState?.pathColors || {});
    const [pathThickness, setPathThickness] = useState(initialState?.pathThickness || {});
    const [showColorModal, setShowColorModal] = useState(false);
    const [selectedPathIndex, setSelectedPathIndex] = useState(null);
    const [showBulkColorModal, setShowBulkColorModal] = useState(false);
    const [selectedTubes, setSelectedTubes] = useState(new Set());
    const [highlightedTube, setHighlightedTube] = useState(null);
    const [highlightedBase, setHighlightedBase] = useState(null);
    const [isCanvasSelectionMode, setIsCanvasSelectionMode] = useState(false);
    const [isTubeSettingsMinimized, setIsTubeSettingsMinimized] = useState(false);
    const [showGuideModal, setShowGuideModal] = useState(false);
    const [isGuideEffectStopped, setIsGuideEffectStopped] = useState(false);
    const [selectedBulkThickness, setSelectedBulkThickness] = useState(null); // 一括設定で選択された太さ
    const [neonPaths, setNeonPaths] = useState([]);
    const [neonColors, setNeonColors] = useState({});
    const [neonLineWidths, setNeonLineWidths] = useState({});
    const [isDataLoaded, setIsDataLoaded] = useState(!!svgData); // svgDataがあれば初期値をtrue
    const [canvasSettings, setCanvasSettings] = useState({
        scale: 1,
        offsetX: 0,
        offsetY: 0,
        segmentsPerCurve: 30
    });
    
    const canvasRef = useRef(null);
    const animationRef = useRef(null);

    // 背景色変更処理（即座に変更）
    const handleBackgroundColorChange = useCallback((color) => {
        if (neonPower) {
            setBackgroundColor(color);
        } else {
            setBackgroundColorOff(color);
        }
    }, [neonPower]);

    // 現在の状態を保存する関数
    const saveCurrentState = useCallback(() => {
        if (onStateChange) {
            const currentState = {
                selectedColor,
                brightness,
                thickness,
                glowIntensity,
                blinkEffect,
                animationSpeed,
                sidebarVisible,
                neonPower,
                backgroundColor,
                backgroundColorOff,
                gridColor,
                gridColorOff,
                showGrid,
                gridOpacity,
                gridSize,
                pathColors,
                pathThickness
            };
            onStateChange(currentState);
        }
    }, [selectedColor, thickness, blinkEffect, animationSpeed, sidebarVisible, neonPower, backgroundColor, backgroundColorOff, gridColor, gridColorOff, showGrid, gridOpacity, gridSize, pathColors, pathThickness, onStateChange]);

    const neonPresetColors = [
        '#ff0080', '#00ff80', '#8000ff', '#ff8000',
        '#0080ff', '#ffff00', '#ff0040', '#40ff00',
        '#00ffff', '#ff00ff', '#ffffff', '#ff4080'
    ];

    // Catmull-Rom補間関数
    const getCatmullRomPt = (p0, p1, p2, p3, t) => {
        const t2 = t * t;
        const t3 = t2 * t;
        const c0 = p1;
        const c1 = 0.5 * (p2 - p0);
        const c2 = 0.5 * (2 * p0 - 5 * p1 + 4 * p2 - p3);
        const c3 = 0.5 * (-p0 + 3 * p1 - 3 * p2 + p3);

        return c0 + c1 * t + c2 * t2 + c3 * t3;
    };

    // パスの長さを計算する関数
    const calculatePathLength = (pathObj) => {
        if (!pathObj || !pathObj.points || pathObj.points.length < 2) return 0;
        
        let totalLength = 0;
        const points = pathObj.points;
        
        for (let i = 0; i < points.length - 1; i++) {
            const dx = points[i + 1].x - points[i].x;
            const dy = points[i + 1].y - points[i].y;
            totalLength += Math.sqrt(dx * dx + dy * dy);
        }
        
        return totalLength;
    };

    const handlePresetColorClick = (color) => {
        setSelectedColor(color);
    };

    const handlePathColorChange = (pathIndex, color) => {
        setPathColors(prev => ({
            ...prev,
            [pathIndex]: color
        }));
    };

    const handlePathThicknessChange = (pathIndex, thickness) => {
        setPathThickness(prev => ({
            ...prev,
            [pathIndex]: thickness
        }));
    };


    // 色の明度調整関数
    const adjustBrightness = (hexColor, brightness) => {
        const hex = hexColor.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        
        const factor = brightness / 100;
        const newR = Math.min(255, Math.floor(r * factor));
        const newG = Math.min(255, Math.floor(g * factor));
        const newB = Math.min(255, Math.floor(b * factor));
        
        return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
    };

    // 点滅効果の計算
    const applyBlinkEffect = (opacity, animationSpeed) => {
        const time = Date.now() * 0.001 * animationSpeed;
        return opacity * (0.7 + 0.3 * Math.sin(time * Math.PI));
    };

    // パス描画のヘルパー関数
    const drawPath = (ctx, pathPoints, pathType) => {
        if (pathPoints.length < 2) return;
        
        ctx.beginPath();
        ctx.moveTo(pathPoints[0].x, pathPoints[0].y);
        
        if (pathType === 'spline') {
            for (let i = 0; i < pathPoints.length - 1; i++) {
                const p0 = (i === 0) ? pathPoints[0] : pathPoints[i - 1];
                const p1 = pathPoints[i];
                const p2 = pathPoints[i + 1];
                const p3 = (i + 2 >= pathPoints.length) ? pathPoints[pathPoints.length - 1] : pathPoints[i + 2];

                for (let t = 0; t <= canvasSettings.segmentsPerCurve; t++) {
                    const step = t / canvasSettings.segmentsPerCurve;
                    const x = getCatmullRomPt(p0.x, p1.x, p2.x, p3.x, step);
                    const y = getCatmullRomPt(p0.y, p1.y, p2.y, p3.y, step);
                    ctx.lineTo(x, y);
                }
            }
        } else {
            for (let i = 1; i < pathPoints.length; i++) {
                ctx.lineTo(pathPoints[i].x, pathPoints[i].y);
            }
        }
        ctx.stroke();
    };

    // ネオンチューブ効果の描画
    const drawNeonTube = (ctx, pathPoints, pathType, color, thickness, glowIntensity, brightness, isHighlighted = false) => {
        // ハイライト表示（外側境界のみ - 元の描画の前に描画）
        if (isHighlighted) {
            // 2重のハイライト効果でより目立たせる
            ctx.save();
            // 外側の白いハイライト
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = thickness + 12;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.globalAlpha = 0.8;
            drawPath(ctx, pathPoints, pathType);
            ctx.restore();
            
            ctx.save();
            // 内側のオレンジハイライト
            ctx.strokeStyle = '#ff6b35';
            ctx.lineWidth = thickness + 8;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.globalAlpha = 0.9;
            drawPath(ctx, pathPoints, pathType);
            ctx.restore();
        }

        if (!neonPower) {
            // LEDネオンOFF時：マットな質感で描画
            ctx.save();
            
            // 色は元のまま、質感だけマットにする
            ctx.strokeStyle = color; // 元の色をそのまま使用
            ctx.globalAlpha = 1.0; // 完全に不透明
            ctx.lineWidth = thickness;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            // グロー効果、シャドウ効果は一切なし
            
            drawPath(ctx, pathPoints, pathType);
            ctx.restore();
            return;
        }

        // ネオンON時：メリハリのある光で描画
        // 1. 薄いグロー（シャープに）
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.shadowColor = color;
        ctx.shadowBlur = glowIntensity * 0.4;
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.6 * (brightness / 100);
        ctx.lineWidth = thickness * 1.1;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        drawPath(ctx, pathPoints, pathType);
        ctx.restore();
        
        // 2. コア（実際のチューブ）- しっかりとした光
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = glowIntensity * 0.3;
        ctx.strokeStyle = adjustBrightness(color, Math.min(brightness * 1.2, 200));
        ctx.globalAlpha = 1.0;
        ctx.lineWidth = thickness;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        drawPath(ctx, pathPoints, pathType);
        ctx.restore();
        
        // 3. 内側のハイライト（メリハリを強調）
        ctx.save();
        ctx.strokeStyle = adjustBrightness(color, Math.min(brightness * 1.5, 255));
        ctx.globalAlpha = 0.8;
        ctx.lineWidth = thickness * 0.6;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        drawPath(ctx, pathPoints, pathType);
        ctx.restore();
        
        // ハイライト（白い部分）は削除
    };

    // データの保存機能
    const saveCustomizeData = () => {
        const dataToSave = {
            pathColors,
            pathThickness,
            backgroundColor,
            gridColor,
            showGrid,
            gridOpacity,
            selectedColor,
            brightness,
            thickness,
            glowIntensity,
            blinkEffect,
            animationSpeed
        };
        // localStorage は使用しない（Claude.ai制限）
        // localStorage.setItem(CUSTOMIZE_DATA_KEY, JSON.stringify(dataToSave));
    };

    // データの読み込み機能
    const loadCustomizeData = () => {
        // localStorage からの読み込みは無効化
        // try {
        //     const savedData = localStorage.getItem(CUSTOMIZE_DATA_KEY);
        //     if (savedData) {
        //         const data = JSON.parse(savedData);
        //         // ... 読み込み処理
        //     }
        // } catch (error) {
        //     console.error('カスタマイズデータの読み込みに失敗しました:', error);
        // }
    };

    // 初回マウント時にデータを読み込み
    useEffect(() => {
        loadCustomizeData();
    }, []);

    // svgDataの変更を即座に検知
    useEffect(() => {
        setIsDataLoaded(!!svgData);
    }, [svgData]);

    // ネオン下絵データの解析
    useEffect(() => {
        if (svgData && svgData.paths) {
            setNeonPaths(svgData.paths);
            
            if (svgData.colors) {
                setNeonColors(svgData.colors);
            }
            
            if (svgData.lineWidths) {
                // strokeLineの太さを6mm（15px）に調整
                const adjustedLineWidths = {
                    ...svgData.lineWidths,
                    strokeLine: 15 // 6mm相当に固定
                };
                setNeonLineWidths(adjustedLineWidths);
            }
            
            if (svgData.canvasData) {
                setCanvasSettings(svgData.canvasData);
                
                // ネオン下絵のグリッド設定をそのまま使用（initialStateが無い場合のみ）
                if (svgData.canvasData.gridSize !== undefined && (!initialState || !initialState.gridSize)) {
                    setGridSize(svgData.canvasData.gridSize);
                }
                if (svgData.canvasData.gridOpacity !== undefined && (!initialState || !initialState.gridOpacity)) {
                    setGridOpacity(svgData.canvasData.gridOpacity);
                }
                if (svgData.canvasData.showGrid !== undefined && (!initialState || initialState.showGrid === undefined)) {
                    setShowGrid(svgData.canvasData.showGrid);
                }
                if (svgData.canvasData.gridColor !== undefined && (!initialState || !initialState.gridColorOff)) {
                    setGridColorOff(svgData.canvasData.gridColor);
                }
            }
            
            // ネオン下絵の背景色を消灯時の背景色として設定（initialStateが無い場合のみ）
            if (svgData.colors && svgData.colors.background !== undefined && (!initialState || !initialState.backgroundColorOff)) {
                setBackgroundColorOff(svgData.colors.background);
            }
            
            // ネオン下絵のグリッド色を消灯時のグリッド色として設定（initialStateが無い場合のみ）
            if (svgData.colors && svgData.colors.grid !== undefined && (!initialState || !initialState.gridColorOff)) {
                setGridColorOff(svgData.colors.grid);
            }
            
            // パス別の初期色設定（initialStateが無い場合のみ設定）
            if (!initialState || !initialState.pathColors || Object.keys(initialState.pathColors).length === 0) {
                const initialColors = {};
                const initialThickness = {};
                svgData.paths.forEach((pathObj, pathIndex) => {
                    if (pathObj.mode === 'stroke') {
                        // チューブの場合
                        initialColors[pathIndex] = svgData.colors?.strokeLine || '#ffff00';
                        initialThickness[pathIndex] = 15;  // チューブは常に15px（6mm）で開始
                    } else if (pathObj.mode === 'fill') {
                        // ベースプレートの場合
                        initialColors[`${pathIndex}_fill`] = 'transparent';  // ベースプレートは透明がデフォルト
                        initialThickness[pathIndex] = svgData.lineWidths?.fillBorder || 3;
                    }
                });
                
                setPathColors(prev => ({ ...prev, ...initialColors }));
                setPathThickness(prev => ({ ...prev, ...initialThickness }));
            }
        }
    }, [svgData]);

    // データ変更時に自動保存
    useEffect(() => {
        if (neonPaths.length > 0) {
            saveCustomizeData();
        }
    }, [pathColors, pathThickness, backgroundColor, gridColor, showGrid, gridOpacity, selectedColor, thickness, blinkEffect, animationSpeed, neonPaths.length]);

    // 状態変更時に親コンポーネントに通知（初期化時は除く）
    const isInitializedRef = useRef(false);
    useEffect(() => {
        if (isInitializedRef.current) {
            saveCurrentState();
        } else {
            isInitializedRef.current = true;
        }
    }, [selectedColor, thickness, blinkEffect, animationSpeed, sidebarVisible, neonPower, backgroundColor, backgroundColorOff, gridColor, gridColorOff, showGrid, gridOpacity, gridSize, pathColors, pathThickness]);

    const handleDownloadSVG = () => {
        if (!svgData || neonPaths.length === 0) {
            alert('SVGデータがありません');
            return;
        }

        let strokePathData = '';
        let fillPathData = '';

        neonPaths.forEach((pathObj, pathIndex) => {
            if (!pathObj || !Array.isArray(pathObj.points)) return;

            const pathPoints = pathObj.points;
            const pathMode = pathObj.mode;
            const pathType = pathObj.type;
            const customColor = pathColors[pathIndex];
            const customThickness = pathThickness[pathIndex];

            if (pathPoints.length < 2) return;

            if (pathMode === 'stroke') {
                let currentStrokeSegment = `M ${pathPoints[0].x},${pathPoints[0].y}`;
                if (pathType === 'spline') {
                    for (let i = 0; i < pathPoints.length - 1; i++) {
                        const p0 = (i === 0) ? pathPoints[0] : pathPoints[i - 1];
                        const p1 = pathPoints[i];
                        const p2 = pathPoints[i + 1];
                        const p3 = (i + 2 >= pathPoints.length) ? pathPoints[pathPoints.length - 1] : pathPoints[i + 2];

                        for (let t = 0; t <= canvasSettings.segmentsPerCurve; t++) {
                            const step = t / canvasSettings.segmentsPerCurve;
                            const x = getCatmullRomPt(p0.x, p1.x, p2.x, p3.x, step);
                            const y = getCatmullRomPt(p0.y, p1.y, p2.y, p3.y, step);
                            currentStrokeSegment += ` L ${x},${y}`;
                        }
                    }
                } else {
                    for (let i = 1; i < pathPoints.length; i++) {
                        currentStrokeSegment += ` L ${pathPoints[i].x},${pathPoints[i].y}`;
                    }
                }
                
                // ネオン効果付きSVG
                const glowFilter = `
                    <defs>
                        <filter id="neon-glow-${pathIndex}">
                            <feGaussianBlur stdDeviation="${glowIntensity/10}" result="coloredBlur"/>
                            <feMerge> 
                                <feMergeNode in="coloredBlur"/>
                                <feMergeNode in="SourceGraphic"/>
                            </feMerge>
                        </filter>
                    </defs>
                `;
                
                strokePathData += `<path d="${currentStrokeSegment}" stroke="${customColor || neonColors.strokeLine}" stroke-width="${customThickness || neonLineWidths.strokeLine}" fill="none" stroke-linecap="round" stroke-linejoin="round" filter="url(#neon-glow-${pathIndex})"/>\n    `;
            }

            if (pathMode === 'fill' && pathPoints.length >= 3) {
                let currentFillSegment = `M ${pathPoints[0].x},${pathPoints[0].y}`;
                if (pathType === 'spline') {
                    for (let i = 0; i < pathPoints.length - 1; i++) {
                        const p0 = (i === 0) ? pathPoints[0] : pathPoints[i - 1];
                        const p1 = pathPoints[i];
                        const p2 = pathPoints[i + 1];
                        const p3 = (i + 2 >= pathPoints.length) ? pathPoints[pathPoints.length - 1] : pathPoints[i + 2];

                        for (let t = 0; t <= canvasSettings.segmentsPerCurve; t++) {
                            const step = t / canvasSettings.segmentsPerCurve;
                            const x = getCatmullRomPt(p0.x, p1.x, p2.x, p3.x, step);
                            const y = getCatmullRomPt(p0.y, p1.y, p2.y, p3.y, step);
                            currentFillSegment += ` L ${x},${y}`;
                        }
                    }
                } else {
                    for (let i = 1; i < pathPoints.length; i++) {
                        currentFillSegment += ` L ${pathPoints[i].x},${pathPoints[i].y}`;
                    }
                }
                currentFillSegment += ` Z`;
                fillPathData += `<path d="${currentFillSegment}" fill="${neonColors.fillArea}" stroke="${customColor || neonColors.fillBorder}" stroke-width="${customThickness || neonLineWidths.fillBorder}"/>\n    `;
            }
        });

        const customizedSvg = `
<svg width="${canvasSettings.scale * canvasWidth}" height="${canvasSettings.scale * canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}" xmlns="http://www.w3.org/2000/svg">
    <defs>
        ${neonPaths.map((_, index) => `
        <filter id="neon-glow-${index}">
            <feGaussianBlur stdDeviation="${glowIntensity/10}" result="coloredBlur"/>
            <feMerge> 
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
            </feMerge>
        </filter>`).join('')}
    </defs>
    <rect width="100%" height="100%" fill="${neonPower ? backgroundColor : backgroundColorOff}"/>
    ${fillPathData}${strokePathData}
</svg>
        `.trim();

        const blob = new Blob([customizedSvg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'neon_tube_sign.svg';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // キャンバスのサイズを画面サイズの100%に設定
    useEffect(() => {
        const handleResize = () => {
            const newWidth = window.innerWidth;
            const newHeight = window.innerHeight;
            setCanvasWidth(newWidth);
            setCanvasHeight(newHeight);
        };

        window.addEventListener('resize', handleResize);
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // マウスイベントハンドラー（ズーム・パン機能）
    const [isPanning, setIsPanning] = useState(false);
    const [lastPanX, setLastPanX] = useState(0);
    const [lastPanY, setLastPanY] = useState(0);

    // パスのヒット判定を行う関数（stroke と fill の両方に対応）
    const getPathAtPosition = useCallback((x, y) => {
        const hitRadius = 20; // ヒット判定の半径を20pxに設定
        let closestPath = null;
        let closestDistance = Infinity;
        let pathType = null; // 'stroke' または 'fill'
        
        for (let pathIndex = 0; pathIndex < neonPaths.length; pathIndex++) {
            const pathObj = neonPaths[pathIndex];
            if (!pathObj || !Array.isArray(pathObj.points)) {
                continue;
            }
            
            const pathPoints = pathObj.points;
            if (pathPoints.length < 2) continue;
            
            let minDistanceForPath = Infinity;
            
            if (pathObj.mode === 'stroke') {
                // strokeモードの場合：線分との距離をチェック
                for (let i = 0; i < pathPoints.length - 1; i++) {
                    const p1 = pathPoints[i];
                    const p2 = pathPoints[i + 1];
                    
                    // 線分との距離を計算
                    const distance = distanceToLineSegment(x, y, p1.x, p1.y, p2.x, p2.y);
                    minDistanceForPath = Math.min(minDistanceForPath, distance);
                    
                    if (distance <= hitRadius) {
                        // 最も近いパスを選択
                        if (distance < closestDistance) {
                            closestDistance = distance;
                            closestPath = pathIndex;
                            pathType = 'stroke';
                        }
                    }
                }
                
                // スプライン補間されたパスの場合、より細かくチェック
                if (pathObj.type === 'spline' && minDistanceForPath > hitRadius) {
                    // スプライン曲線の補間点もチェック
                    for (let i = 0; i < pathPoints.length - 1; i++) {
                        const p0 = (i === 0) ? pathPoints[0] : pathPoints[i - 1];
                        const p1 = pathPoints[i];
                        const p2 = pathPoints[i + 1];
                        const p3 = (i + 2 >= pathPoints.length) ? pathPoints[pathPoints.length - 1] : pathPoints[i + 2];

                        // スプライン補間された点をチェック
                        for (let t = 0; t <= canvasSettings.segmentsPerCurve; t += 3) { // 3刻みでより細かく判定
                            const step = t / canvasSettings.segmentsPerCurve;
                            const splineX = getCatmullRomPt(p0.x, p1.x, p2.x, p3.x, step);
                            const splineY = getCatmullRomPt(p0.y, p1.y, p2.y, p3.y, step);
                            
                            const pointDistance = Math.sqrt((x - splineX) ** 2 + (y - splineY) ** 2);
                            if (pointDistance <= hitRadius && pointDistance < closestDistance) {
                                closestDistance = pointDistance;
                                closestPath = pathIndex;
                                pathType = 'stroke';
                            }
                        }
                    }
                }
            } else if (pathObj.mode === 'fill' && pathPoints.length >= 3) {
                // fillモードの場合：ポリゴン内部の点かどうかをチェック
                if (isPointInPolygon(x, y, pathPoints)) {
                    // ポリゴン内部の場合、中心からの距離を計算
                    const centerX = pathPoints.reduce((sum, p) => sum + p.x, 0) / pathPoints.length;
                    const centerY = pathPoints.reduce((sum, p) => sum + p.y, 0) / pathPoints.length;
                    const centerDistance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
                    
                    if (centerDistance < closestDistance) {
                        closestDistance = centerDistance;
                        closestPath = pathIndex;
                        pathType = 'fill';
                    }
                }
            }
        }
        
        return closestPath !== null ? { pathIndex: closestPath, mode: pathType } : null;
    }, [neonPaths, canvasSettings.segmentsPerCurve]);

    // 点と線分の距離を計算する関数
    const distanceToLineSegment = (px, py, x1, y1, x2, y2) => {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
        
        const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (length * length)));
        const projection = { x: x1 + t * dx, y: y1 + t * dy };
        
        return Math.sqrt((px - projection.x) ** 2 + (py - projection.y) ** 2);
    };

    // 点がポリゴン内部にあるかどうかを判定する関数（Ray casting algorithm）
    const isPointInPolygon = (x, y, polygon) => {
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].x;
            const yi = polygon[i].y;
            const xj = polygon[j].x;
            const yj = polygon[j].y;
            
            if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }
        return inside;
    };

    // チューブ設定コンテナまでスクロールする関数
    const scrollToTubeContainer = useCallback((pathIndex) => {
        // 少し遅延を入れてDOM更新を待つ
        setTimeout(() => {
            const containerElement = document.querySelector(`[data-tube-index="${pathIndex}"]`);
            if (containerElement) {
                containerElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
            }
        }, 100);
    }, []);

    // 土台設定コンテナまでスクロールする関数
    const scrollToBaseContainer = useCallback((pathIndex) => {
        // 少し遅延を入れてDOM更新を待つ
        setTimeout(() => {
            const containerElement = document.querySelector(`[data-base-index="${pathIndex}"]`);
            if (containerElement) {
                containerElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
            }
        }, 100);
    }, []);

    // サイドバーの一番上にスクロールする関数
    const scrollToTop = useCallback(() => {
        const sidebar = document.querySelector('.customize-sidebar');
        if (sidebar) {
            sidebar.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        }
    }, []);

    // 色設定の一番下（最後のチューブ）にスクロールする関数
    const scrollToLastTube = useCallback(() => {
        // 最後のチューブのインデックスを取得
        const tubeIndices = neonPaths
            .map((pathObj, index) => pathObj && pathObj.mode === 'stroke' ? index : null)
            .filter(index => index !== null);
        
        if (tubeIndices.length > 0) {
            // 長さ順にソートして最後のチューブ（最短のチューブ）を取得
            const sortedTubes = tubeIndices
                .map(index => ({ index, length: calculatePathLength(neonPaths[index]) }))
                .sort((a, b) => b.length - a.length);
            
            const lastTubeIndex = sortedTubes[sortedTubes.length - 1].index;
            
            setTimeout(() => {
                const lastTubeElement = document.querySelector(`[data-tube-index="${lastTubeIndex}"]`);
                if (lastTubeElement) {
                    lastTubeElement.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center'
                    });
                }
            }, 100);
        }
    }, [neonPaths, calculatePathLength]);

    const handleWheel = useCallback((e) => {
        e.preventDefault();
        const scaleAmount = 0.1;
        const rect = e.target.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        let newScale = canvasSettings.scale;
        if (e.deltaY < 0) { // スクロールアップ (拡大)
            newScale = canvasSettings.scale * (1 + scaleAmount);
        } else { // スクロールダウン (縮小)
            newScale = canvasSettings.scale / (1 + scaleAmount);
        }

        newScale = Math.max(0.1, Math.min(newScale, 10)); // 最小0.1倍、最大10倍に制限

        // ズームの中心をマウスカーソルに合わせる
        const newOffsetX = mouseX - (mouseX - canvasSettings.offsetX) * (newScale / canvasSettings.scale);
        const newOffsetY = mouseY - (mouseY - canvasSettings.offsetY) * (newScale / canvasSettings.scale);
        
        setCanvasSettings(prev => ({
            ...prev,
            scale: newScale,
            offsetX: newOffsetX,
            offsetY: newOffsetY
        }));
    }, [canvasSettings]);

    const handleMouseDown = useCallback((e) => {
        if (e.button === 2) { // 右クリック (パン操作)
            setIsPanning(true);
            setLastPanX(e.clientX);
            setLastPanY(e.clientY);
        } else if (e.button === 0) { // 左クリック
            const canvas = canvasRef.current;
            if (!canvas) return;
            
            const rect = canvas.getBoundingClientRect();
            const mouseX = (e.clientX - rect.left - canvasSettings.offsetX) / canvasSettings.scale;
            const mouseY = (e.clientY - rect.top - canvasSettings.offsetY) / canvasSettings.scale;
            
            const hitResult = getPathAtPosition(mouseX, mouseY);
            
            if (hitResult !== null) {
                const { pathIndex: hitPathIndex, mode: hitMode } = hitResult;
                
                if (hitMode === 'stroke') {
                    // チューブ（stroke）の処理
                    if (isCanvasSelectionMode) {
                        // 一括色変更モードの場合
                        const newSelected = new Set(selectedTubes);
                        if (newSelected.has(hitPathIndex)) {
                            newSelected.delete(hitPathIndex);
                        } else {
                            newSelected.add(hitPathIndex);
                        }
                        setSelectedTubes(newSelected);
                    } else {
                        // 通常モードの場合：ハイライト切り替え
                        if (highlightedTube === hitPathIndex) {
                            setHighlightedTube(null);
                        } else {
                            setHighlightedTube(hitPathIndex);
                            setHighlightedBase(null); // 土台のハイライトをクリア
                            // 対応する設定コンテナにスクロール
                            scrollToTubeContainer(hitPathIndex);
                        }
                    }
                } else if (hitMode === 'fill') {
                    // 土台（fill）の処理
                    if (!isCanvasSelectionMode) {
                        // 通常モードの場合：ハイライト切り替え
                        if (highlightedBase === hitPathIndex) {
                            setHighlightedBase(null);
                        } else {
                            setHighlightedBase(hitPathIndex);
                            setHighlightedTube(null); // チューブのハイライトをクリア
                            // 対応する設定コンテナにスクロール
                            scrollToBaseContainer(hitPathIndex);
                        }
                    }
                }
            } else {
                // パス以外の場所をクリックした場合
                if (!isCanvasSelectionMode) {
                    setHighlightedTube(null);
                    setHighlightedBase(null);
                }
            }
        }
    }, [canvasSettings, getPathAtPosition, isCanvasSelectionMode, selectedTubes, highlightedTube, highlightedBase, scrollToTubeContainer, scrollToBaseContainer]);

    const handleMouseMove = useCallback((e) => {
        if (isPanning) { // パン操作中
            const dx = e.clientX - lastPanX;
            const dy = e.clientY - lastPanY;
            setCanvasSettings(prev => ({
                ...prev,
                offsetX: prev.offsetX + dx,
                offsetY: prev.offsetY + dy
            }));
            setLastPanX(e.clientX);
            setLastPanY(e.clientY);
        }
    }, [isPanning, lastPanX, lastPanY]);

    const handleMouseUp = useCallback(() => {
        setIsPanning(false);
    }, []);

    const handleMouseLeave = useCallback(() => {
        setIsPanning(false);
    }, []);

    // アニメーション用の描画ループ
    const draw = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // データロード状態をチェック - svgDataがあればすぐに描画処理に進む
        if (!isDataLoaded || !svgData) {
            // 画面の真の中央位置
            const canvasCenterX = canvas.width / 2;
            const canvasCenterY = canvas.height / 2;
            
            ctx.fillStyle = '#ffffff';
            ctx.font = '24px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('ネオン下絵からデータを読み込んでください', canvasCenterX, canvasCenterY);
            return;
        }
        
        // 有効なパスデータがあるかチェック
        const hasValidData = neonPaths.length > 0 && neonPaths.some(path => 
            path && Array.isArray(path.points) && path.points.length > 0
        );
        
        if (!hasValidData) {
            // データはあるが空の場合は、即座に背景とグリッドのみ描画
            // メッセージは表示しない
        }

        // 背景とグリッドの描画
        ctx.save();
        ctx.translate(canvasSettings.offsetX, canvasSettings.offsetY);
        ctx.scale(canvasSettings.scale, canvasSettings.scale);

        const visibleLeft = -canvasSettings.offsetX / canvasSettings.scale;
        const visibleTop = -canvasSettings.offsetY / canvasSettings.scale;
        const visibleRight = (canvas.width - canvasSettings.offsetX) / canvasSettings.scale;
        const visibleBottom = (canvas.height - canvasSettings.offsetY) / canvasSettings.scale;

        // 背景色（ON/OFF時で切り替え）
        const currentBgColor = neonPower ? backgroundColor : backgroundColorOff;
        ctx.fillStyle = currentBgColor;
        ctx.fillRect(visibleLeft - 1000, visibleTop - 1000, 
                     (visibleRight - visibleLeft) + 2000, (visibleBottom - visibleTop) + 2000);

        // 無限グリッドを描画（ネオン下絵と全く同じコード）
        if (showGrid) {
            const currentGridColor = neonPower ? gridColor : gridColorOff;
            ctx.strokeStyle = currentGridColor;
            ctx.lineWidth = 0.5 / canvasSettings.scale;
            ctx.setLineDash([]);
            ctx.globalAlpha = gridOpacity;

            const startX = Math.floor(visibleLeft / gridSize) * gridSize;
            const startY = Math.floor(visibleTop / gridSize) * gridSize;
            const endX = Math.ceil(visibleRight / gridSize) * gridSize;
            const endY = Math.ceil(visibleBottom / gridSize) * gridSize;

            for (let x = startX; x <= endX; x += gridSize) {
                ctx.beginPath();
                ctx.moveTo(x, visibleTop - 100);
                ctx.lineTo(x, visibleBottom + 100);
                ctx.stroke();
            }
            for (let y = startY; y <= endY; y += gridSize) {
                ctx.beginPath();
                ctx.moveTo(visibleLeft - 100, y);
                ctx.lineTo(visibleRight + 100, y);
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
            ctx.setLineDash([]);
        }

        ctx.restore();

        // スケール表示（1マス = 4cm）
        if (showGrid) {
            ctx.save();
            
            // 画面の横の真ん中（50%）、上側に表示
            const textX = canvas.width / 2;
            const textY = 16;
            
            // 背景の半透明ボックス（中央揃えのため少し左にずらす）
            ctx.globalAlpha = 0.7;
            ctx.fillStyle = neonPower ? 'rgba(0, 0, 0, 0.5)' : 'rgba(255, 255, 255, 0.8)';
            ctx.fillRect(textX - 40, textY - 4, 80, 24);
            ctx.globalAlpha = 1;
            
            // テキストを描画（中央揃え）
            ctx.fillStyle = neonPower ? '#ffffff' : '#333333';
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText('1マス = 4cm', textX, textY);
            ctx.restore();
        }

        // パスと制御点の描画
        ctx.save();
        ctx.translate(canvasSettings.offsetX, canvasSettings.offsetY);
        ctx.scale(canvasSettings.scale, canvasSettings.scale);

        // 1. 土台（fill）パスの描画
        neonPaths.forEach((pathObj, pathIndex) => {
            if (!pathObj || !Array.isArray(pathObj.points) || pathObj.mode !== 'fill') {
                return;
            }

            const pathPoints = pathObj.points;
            const pathType = pathObj.type;

            if (pathPoints.length < 2) return;

            // ハイライト状態をチェック
            const isHighlighted = highlightedBase === pathIndex;

            // ベースプレートの色（透明・白・黒のみ）
            const fillColorValue = pathColors[`${pathIndex}_fill`] || neonColors.fillArea;
            // 境界線は常に1px黒線（ハイライト時は太くする）
            const borderColor = isHighlighted ? '#ff6b35' : '#000000';
            const borderWidth = isHighlighted ? 4 : 1;

            // ハイライト表示（外側境界）
            if (isHighlighted) {
                ctx.save();
                ctx.beginPath();
                ctx.moveTo(pathPoints[0].x, pathPoints[0].y);

                if (pathType === 'spline') {
                    for (let i = 0; i < pathPoints.length - 1; i++) {
                        const p0 = (i === 0) ? pathPoints[0] : pathPoints[i - 1];
                        const p1 = pathPoints[i];
                        const p2 = pathPoints[i + 1];
                        const p3 = (i + 2 >= pathPoints.length) ? pathPoints[pathPoints.length - 1] : pathPoints[i + 2];

                        for (let t = 0; t <= canvasSettings.segmentsPerCurve; t++) {
                            const step = t / canvasSettings.segmentsPerCurve;
                            const x = getCatmullRomPt(p0.x, p1.x, p2.x, p3.x, step);
                            const y = getCatmullRomPt(p0.y, p1.y, p2.y, p3.y, step);
                            ctx.lineTo(x, y);
                        }
                    }
                } else {
                    for (let i = 1; i < pathPoints.length; i++) {
                        ctx.lineTo(pathPoints[i].x, pathPoints[i].y);
                    }
                }
                ctx.closePath();
                
                // 外側の白いハイライト
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 8;
                ctx.globalAlpha = 0.8;
                ctx.stroke();
                ctx.restore();
            }

            // 透明の場合は塗りつぶしをスキップ
            const isTransparent = fillColorValue === 'transparent';
            
            if (!isTransparent) {
                ctx.fillStyle = fillColorValue;
            }
            ctx.beginPath();
            ctx.moveTo(pathPoints[0].x, pathPoints[0].y);

            if (pathType === 'spline') {
                for (let i = 0; i < pathPoints.length - 1; i++) {
                    const p0 = (i === 0) ? pathPoints[0] : pathPoints[i - 1];
                    const p1 = pathPoints[i];
                    const p2 = pathPoints[i + 1];
                    const p3 = (i + 2 >= pathPoints.length) ? pathPoints[pathPoints.length - 1] : pathPoints[i + 2];

                    for (let t = 0; t <= canvasSettings.segmentsPerCurve; t++) {
                        const step = t / canvasSettings.segmentsPerCurve;
                        const x = getCatmullRomPt(p0.x, p1.x, p2.x, p3.x, step);
                        const y = getCatmullRomPt(p0.y, p1.y, p2.y, p3.y, step);
                        ctx.lineTo(x, y);
                    }
                }
            } else {
                for (let i = 1; i < pathPoints.length; i++) {
                    ctx.lineTo(pathPoints[i].x, pathPoints[i].y);
                }
            }
            ctx.closePath();
            
            // 透明でない場合のみ塗りつぶし
            if (!isTransparent) {
                ctx.fill();
            }
            
            ctx.strokeStyle = borderColor;
            ctx.lineWidth = borderWidth;
            ctx.stroke();
        });

        // 2. ネオンチューブ（stroke）パスの描画
        neonPaths.forEach((pathObj, pathIndex) => {
            if (!pathObj || !Array.isArray(pathObj.points) || pathObj.mode !== 'stroke') {
                return;
            }

            const pathPoints = pathObj.points;
            const pathType = pathObj.type;

            if (pathPoints.length < 2) return;

            const strokeColor = pathColors[pathIndex] || neonColors.strokeLine;
            const strokeWidth = pathThickness[pathIndex] || neonLineWidths.strokeLine;
            
            // 点滅効果の適用（ネオンON時のみ）
            const currentBrightness = (neonPower && blinkEffect) ? 
                brightness * applyBlinkEffect(1, animationSpeed) : 
                brightness;
            
            // ハイライト状態をチェック
            const isHighlighted = highlightedTube === pathIndex;
            // 一括選択モードでの選択状態をチェック
            const isSelected = isCanvasSelectionMode && selectedTubes.has(pathIndex);
            
            // 一括選択モードの場合は選択状態を優先表示
            const shouldHighlight = isSelected || (!isCanvasSelectionMode && isHighlighted);
            
            // ネオンチューブ効果で描画
            drawNeonTube(
                ctx, 
                pathPoints, 
                pathType, 
                strokeColor, 
                strokeWidth,
                glowIntensity,
                currentBrightness,
                shouldHighlight
            );
            
            // 一括選択モードでの選択表示（異なる色で表示）
            if (isSelected) {
                ctx.save();
                ctx.strokeStyle = '#00ff00'; // 緑色で選択状態を表示
                ctx.lineWidth = strokeWidth + 10;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.globalAlpha = 0.6;
                drawPath(ctx, pathPoints, pathType);
                ctx.restore();
            }
        });

        ctx.restore();

        // アニメーションの継続（ネオンON かつ 点滅ON時のみ）
        if (neonPower && blinkEffect) {
            animationRef.current = requestAnimationFrame(draw);
        }
    };

    // 描画の実行 - 即座に描画開始
    useEffect(() => {
        // データがロードされている、またはcanvasが準備できている場合は即座に描画
        if (canvasRef.current) {
            if (neonPower && blinkEffect && isDataLoaded) {
                animationRef.current = requestAnimationFrame(draw);
            } else {
                if (animationRef.current) {
                    cancelAnimationFrame(animationRef.current);
                }
                // 即座に描画実行
                requestAnimationFrame(draw);
            }
        }

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [neonPaths, pathColors, pathThickness, canvasSettings, neonColors, neonLineWidths, canvasWidth, canvasHeight, backgroundColor, backgroundColorOff, gridColor, gridColorOff, showGrid, gridOpacity, gridSize, blinkEffect, animationSpeed, neonPower, isDataLoaded, highlightedTube, highlightedBase, isCanvasSelectionMode, selectedTubes]);

    return (
        <div className="customize-app-container">
            {/* メインキャンバスエリア */}
            <div className="customize-canvas-area">
                <canvas
                    ref={canvasRef}
                    width={canvasWidth}
                    height={canvasHeight}
                    className="customize-main-canvas"
                    onWheel={handleWheel}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onContextMenu={(e) => e.preventDefault()}
                    onMouseLeave={handleMouseLeave}
                />
            </div>

            {/* サイドバー */}
            {sidebarVisible && (
                <div className="customize-sidebar">
                    <div className="customize-header">
                        <h1 className="customize-sidebar-title">
                            カスタマイズ
                        </h1>
                        {/* ガイドボタン */}
                        <button
                            onClick={() => setShowGuideModal(true)}
                            className={`customize-guide-button ${isGuideEffectStopped ? 'stopped' : ''}`}
                        >
                        </button>
                    </div>

                    {/* ネオンON/OFFスイッチと背景色設定 */}
                    <div className="neon-power-section">
                        <div className="neon-power-controls">
                            {/* 左側：ON/OFFスイッチ */}
                            <div className="neon-power-status">
                                <span className={`neon-status-text ${neonPower ? 'on' : 'off'}`}>
                                    <span className={`status-dot ${neonPower ? 'on' : 'off'}`}></span>
                                    {neonPower ? 'ON' : 'OFF'}
                                </span>
                                <button
                                    onClick={() => setNeonPower(!neonPower)}
                                    className={`neon-power-switch ${neonPower ? 'on' : 'off'}`}
                                >
                                    <div className={`neon-switch-handle ${neonPower ? 'on' : 'off'}`} />
                                </button>
                            </div>
                            
                            {/* 右側：背景色設定 */}
                            <div className="neon-background-controls">
                                <span className="background-label">
                                    背景色
                                </span>
                                <div className="background-color-picker-wrapper">
                                    <div 
                                        className="background-color-preview"
                                        style={{
                                            backgroundColor: neonPower ? backgroundColor : backgroundColorOff
                                        }}
                                    />
                                    <input
                                        type="color"
                                        value={neonPower ? backgroundColor : backgroundColorOff}
                                        onChange={(e) => handleBackgroundColorChange(e.target.value)}
                                        className="background-color-input"
                                    />
                                </div>
                            </div>
                        </div>
                        
                        {/* グリッド表示切り替え */}
                        <div className="grid-toggle-container">
                            <label className="grid-toggle-label">グリッド表示</label>
                            <button
                                onClick={() => setShowGrid(!showGrid)}
                                className={`grid-toggle-button ${showGrid ? 'on' : 'off'}`}
                            >
                                {showGrid ? 'ON' : 'OFF'}
                            </button>
                        </div>
                       
                    </div>

                    {/* サイドバー非表示ボタン */}
                    <button 
                        onClick={() => setSidebarVisible(false)}
                        className="customize-sidebar-hide-button"
                        aria-label="サイドバー非表示"
                    >
                        ▲
                    </button>


                    {/* 一括設定 */}
                    <div className="bulk-setting-section">
                        <h3 className="customize-setting-title">一括設定</h3>
                        {!isCanvasSelectionMode ? (
                            <button
                                onClick={() => {
                                    setSelectedTubes(new Set());
                                    setIsCanvasSelectionMode(true);
                                }}
                                className="bulk-select-button"
                            >
                                キャンバスからチューブを選択
                            </button>
                        ) : (
                            <div>
                                <div className="bulk-selection-active">
                                    キャンバス上のチューブをクリックして選択<br/>({selectedTubes.size}本選択中)
                                </div>
                                <div className="bulk-action-buttons">
                                    <button
                                        onClick={() => {
                                            if (selectedTubes.size > 0) {
                                                setSelectedBulkThickness(null); // 太さ選択をリセット
                                                setSidebarVisible(false); // サイドバーを閉じる
                                                setShowBulkColorModal(true);
                                            }
                                        }}
                                        disabled={selectedTubes.size === 0}
                                        className={`bulk-action-button apply ${selectedTubes.size === 0 ? 'disabled' : ''}`}
                                    >
                                        設定変更
                                    </button>
                                    <button
                                        onClick={() => {
                                            setIsCanvasSelectionMode(false);
                                            setSelectedTubes(new Set());
                                            setSelectedBulkThickness(null);
                                            setSidebarVisible(true); // サイドバーを復活
                                        }}
                                        className="bulk-action-button cancel"
                                    >
                                        キャンセル
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ネオンチューブ設定 */}
                    {neonPaths.filter(pathObj => pathObj && pathObj.mode === 'stroke').length > 0 && (
                        <div className="neon-tube-settings">
                            <div className="neon-tube-header">
                                <div className="neon-tube-title-container">
                                    <h3 className="neon-tube-title">
                                        ネオンチューブ設定 ({neonPaths.filter(pathObj => pathObj && pathObj.mode === 'stroke').length}本)
                                    </h3>
                                    <span className="tube-total-length-subtitle">
                                        合計長さ: {Math.round(
                                            neonPaths
                                                .filter(pathObj => pathObj && pathObj.mode === 'stroke')
                                                .reduce((total, pathObj) => total + calculatePathLength(pathObj), 0) / 25 * 10
                                        ) / 10}cm
                                    </span>
                                </div>
                                <div className="neon-tube-actions">
                                    {/* 最後のチューブへスクロールボタン */}
                                    <button
                                        onClick={scrollToLastTube}
                                        className="tube-action-button scroll-last"
                                        title="最後のチューブへ"
                                    >
                                        ↓ 最後へ
                                    </button>
                                    {/* 最小化/展開ボタン */}
                                    <button
                                        onClick={() => setIsTubeSettingsMinimized(!isTubeSettingsMinimized)}
                                        className="tube-action-button minimize"
                                        title={isTubeSettingsMinimized ? '展開' : '最小化'}
                                    >
                                        {isTubeSettingsMinimized ? '▼' : '▲'}
                                    </button>
                                </div>
                            </div>
                            {!isTubeSettingsMinimized && neonPaths
                                .map((pathObj, index) => ({ pathObj, originalIndex: index }))
                                .filter(({ pathObj }) => pathObj && pathObj.mode === 'stroke')
                                .sort((a, b) => calculatePathLength(b.pathObj) - calculatePathLength(a.pathObj))
                                .map(({ pathObj, originalIndex }, sortedIndex) => (
                                    <div 
                                        key={originalIndex} 
                                        className="customize-path-color-section"
                                        data-tube-index={originalIndex}
                                        onClick={(e) => {
                                            // ボタンやコントロール要素をクリックした場合は処理しない
                                            if (e.target.tagName === 'BUTTON' || 
                                                e.target.tagName === 'INPUT' || 
                                                e.target.closest('button') || 
                                                e.target.closest('input')) {
                                                return;
                                            }
                                            
                                            if (highlightedTube === originalIndex) {
                                                setHighlightedTube(null); // 既にハイライトされている場合は解除
                                            } else {
                                                setHighlightedTube(originalIndex); // ハイライト設定
                                            }
                                        }}
                                        style={{
                                            cursor: 'pointer',
                                            border: highlightedTube === originalIndex ? '3px solid #ff6b35' : '1px solid rgba(255, 255, 255, 0.1)',
                                            backgroundColor: highlightedTube === originalIndex ? 'rgba(255, 107, 53, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                            transition: 'all 0.2s ease',
                                            boxShadow: highlightedTube === originalIndex ? '0 0 15px rgba(255, 107, 53, 0.3)' : 'none'
                                        }}
                                    >
                                        <label className="tube-title">
                                            チューブ {sortedIndex + 1} (長さ: {Math.round(calculatePathLength(pathObj) / 25 * 10) / 10}cm)
                                        </label>
                                        
                                        {/* 色設定 */}
                                        <div className="color-setting-section">
                                            <label className="color-setting-label">色の設定</label>
                                            <div className="color-setting-controls">
                                                {/* 現在の色アイコン */}
                                                <div 
                                                    className="color-preview"
                                                    style={{
                                                        backgroundColor: pathColors[originalIndex] || neonColors.strokeLine || '#ffff00'
                                                    }}
                                                />
                                                {/* 色設定ボタン */}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation(); // イベントバブリングを防ぐ
                                                        setSelectedPathIndex(originalIndex);
                                                        setShowColorModal(true);
                                                    }}
                                                    className="color-select-button"
                                                >
                                                    色を選択
                                                </button>
                                            </div>
                                        </div>
                                        
                                        {/* 太さ設定 */}
                                        <div className="thickness-setting-section">
                                            <label className="thickness-setting-label">太さ</label>
                                            <div className="thickness-button-group">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation(); // イベントバブリングを防ぐ
                                                        handlePathThicknessChange(originalIndex, 15);
                                                    }}
                                                    className={`thickness-button ${(pathThickness[originalIndex] || neonLineWidths.strokeLine) === 15 ? 'active' : ''}`}
                                                >
                                                    6mm
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation(); // イベントバブリングを防ぐ
                                                        handlePathThicknessChange(originalIndex, 20);
                                                    }}
                                                    className={`thickness-button ${(pathThickness[originalIndex] || neonLineWidths.strokeLine) === 20 ? 'active' : ''}`}
                                                >
                                                    8mm
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            {isTubeSettingsMinimized && (
                                <div className="tube-minimized-message">
                                    ネオンチューブ設定が最小化されています
                                </div>
                            )}
                        </div>
                    )}

                    {/* 土台設定 */}
                    {neonPaths.filter(pathObj => pathObj && pathObj.mode === 'fill').length > 0 && (
                        <div className="base-settings">
                            <h3 className="customize-setting-title">ベースプレート設定</h3>
                            {neonPaths.map((pathObj, index) => {
                                if (!pathObj || pathObj.mode !== 'fill') return null;
                                return (
                                    <div 
                                        key={index} 
                                        className="base-item"
                                        data-base-index={index}
                                        onClick={(e) => {
                                            // ボタンやコントロール要素をクリックした場合は処理しない
                                            if (e.target.tagName === 'BUTTON' || 
                                                e.target.tagName === 'INPUT' || 
                                                e.target.closest('button') || 
                                                e.target.closest('input')) {
                                                return;
                                            }
                                            
                                            if (highlightedBase === index) {
                                                setHighlightedBase(null); // 既にハイライトされている場合は解除
                                            } else {
                                                setHighlightedBase(index); // ハイライト設定
                                            }
                                        }}
                                        style={{
                                            cursor: 'pointer',
                                            border: highlightedBase === index ? '3px solid #ff6b35' : '1px solid rgba(255, 255, 255, 0.1)',
                                            backgroundColor: highlightedBase === index ? 'rgba(255, 107, 53, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                            transition: 'all 0.2s ease',
                                            boxShadow: highlightedBase === index ? '0 0 15px rgba(255, 107, 53, 0.3)' : 'none'
                                        }}
                                    >
                                      
                                        
                                        {/* ベースプレートの色設定 */}
                                        <div className="base-color-label">色の設定</div>
                                        <div className="base-color-options">
                                            <button
                                                className={`base-color-button transparent ${pathColors[`${index}_fill`] === 'transparent' ? 'active' : ''}`}
                                                onClick={() => handlePathColorChange(`${index}_fill`, 'transparent')}
                                                title="透明"
                                            />
                                            <button
                                                className={`base-color-button white ${pathColors[`${index}_fill`] === '#ffffff' ? 'active' : ''}`}
                                                onClick={() => handlePathColorChange(`${index}_fill`, '#ffffff')}
                                                title="白"
                                            />
                                            <button
                                                className={`base-color-button black ${pathColors[`${index}_fill`] === '#000000' ? 'active' : ''}`}
                                                onClick={() => handlePathColorChange(`${index}_fill`, '#000000')}
                                                title="黒"
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* 一番上へスクロールボタン（常に表示） */}
                    <div className="scroll-top-section">
                        <div className="neon-tube-header">
                            <h3 className="neon-tube-title"></h3>
                            <div className="neon-tube-actions">
                                <button
                                    onClick={scrollToTop}
                                    className="tube-action-button scroll-top"
                                    title="サイドバーの一番上へスクロール"
                                >
                                    ↑ 一番上へ戻る
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="view-controls">
                        <h3 className="customize-setting-title">リセット操作</h3>
                        
                        <div className="reset-buttons-row">
                            {/* ビューリセットボタン */}
                            <button
                                onClick={() => {
                                    setCanvasSettings(prev => ({
                                        ...prev,
                                        scale: 1,
                                        offsetX: canvasWidth / 2,
                                        offsetY: canvasHeight / 2
                                    }));
                                }}
                                className="view-reset-button half-width"
                            >
                                視点リセット
                            </button>

                            {/* すべてリセットボタン */}
                            <button
                                onClick={() => {
                                    if (window.confirm('すべてのカスタマイズ設定がリセットされます。本当に実行しますか？')) {
                                        setSelectedColor('#ff0080');
                                        setThickness(20);
                                        setBlinkEffect(false);
                                        setAnimationSpeed(1);
                                        setBackgroundColor('#0d0d0d'); // RGB(13,13,13)
                                        setBackgroundColorOff('#e6e6e6'); // RGB(230,230,230)
                                        setGridColor('#646464'); // RGB(100,100,100)
                                        setGridColorOff('#000000'); // RGB(0,0,0)
                                        setShowGrid(true);
                                        setGridOpacity(0.3); // 30%
                                        setGridSize(160);
                                        setNeonPower(true); // 電源もONにリセット
                                        
                                        // パス別設定もリセット
                                        const resetColors = {};
                                        const resetThickness = {};
                                        neonPaths.forEach((pathObj, index) => {
                                            if (pathObj.mode === 'stroke') {
                                                resetColors[index] = '#ffff00';
                                                resetThickness[index] = 15;
                                            } else {
                                                resetColors[index] = '#000000';
                                                resetThickness[index] = 3;
                                            }
                                        });
                                        setPathColors(resetColors);
                                        setPathThickness(resetThickness);
                                    }
                                }}
                                className="view-reset-button half-width"
                            >
                                全てリセット
                            </button>
                        </div>
                        
                    
                    </div>


                    {/* 3Dモデル生成 */}
                    <button
                        onClick={() => {
                            const totalPoints = neonPaths.reduce((acc, pathObj) => acc + (pathObj?.points?.length || 0), 0);
                            if (totalPoints < 2) {
                                alert('3Dモデルを生成するには少なくとも2点が必要です。');
                                return;
                            }

                            // 3Dプレビューイベントを発行
                            window.dispatchEvent(new CustomEvent('show3DPreview', {
                                detail: {
                                    paths: neonPaths,
                                    pathColors: pathColors,
                                    pathThickness: pathThickness,
                                    canvasSettings: canvasSettings,
                                    neonPower: neonPower,
                                    backgroundColor: backgroundColor,
                                    backgroundColorOff: backgroundColorOff
                                }
                            }));
                        }}
                        className="customize-download-button"
                        disabled={neonPaths.length === 0}
                    >
                        3Dモデル生成
                    </button>

                </div>
            )}

            {/* サイドバー表示ボタン（サイドバーが非表示の時） */}
            {!sidebarVisible && (
                <button
                    onClick={() => setSidebarVisible(true)}
                    className="customize-show-sidebar-button"
                >
                    サイドバー表示
                </button>
            )}

            {/* 色選択モーダル */}
            {showColorModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        backgroundColor: 'rgb(29, 29, 29)',
                        padding: '24px',
                        borderRadius: '12px',
                        border: '1px solid #4b5563',
                        minWidth: '320px'
                    }}>
                        <h3 style={{ color: '#FFFF00', marginBottom: '16px', textAlign: 'center' }}>
                            チューブの色を選択
                        </h3>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(4, 1fr)',
                            gap: '8px',
                            marginBottom: '16px'
                        }}>
                            {neonPresetColors.map((color) => (
                                <button
                                    key={color}
                                    style={{
                                        width: '48px',
                                        height: '48px',
                                        backgroundColor: color,
                                        border: pathColors[selectedPathIndex] === color ? '3px solid #ffffff' : '2px solid #6b7280',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        transform: pathColors[selectedPathIndex] === color ? 'scale(1.1)' : 'scale(1)'
                                    }}
                                    onClick={() => {
                                        handlePathColorChange(selectedPathIndex, color);
                                        setShowColorModal(false);
                                        setSelectedPathIndex(null);
                                    }}
                                />
                            ))}
                        </div>
                        <button
                            onClick={() => {
                                setShowColorModal(false);
                                setSelectedPathIndex(null);
                            }}
                            style={{
                                width: '100%',
                                padding: '8px',
                                backgroundColor: '#6b7280',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer'
                            }}
                        >
                            キャンセル
                        </button>
                    </div>
                </div>
            )}

            {/* 一括設定モーダル */}
            {showBulkColorModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 1000,
                    pointerEvents: 'none'
                }}>
                    <div 
                        className="bulk-modal-content"
                        style={{
                            backgroundColor: 'rgb(29, 29, 29)',
                            padding: '24px',
                            borderRadius: '12px',
                            border: 'none',
                            width: '500px',
                            maxHeight: '80vh',
                            overflowY: 'auto',
                            position: 'fixed',
                            right: '20px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            pointerEvents: 'auto'
                        }}>
                        <h3 style={{ color: '#FFFF00', marginBottom: '16px', textAlign: 'center' }}>
                            選択したチューブの設定を変更
                        </h3>
                        
                        {/* 選択されたチューブの表示 */}
                        <div style={{ marginBottom: '16px' }}>
                            <h4 style={{ color: '#d1d5db', marginBottom: '8px', fontSize: '14px' }}>
                                選択中のチューブ ({selectedTubes.size}個)
                            </h4>
                            <div style={{ 
                                display: 'grid',
                                gridTemplateColumns: 'repeat(3, 1fr)',
                                gap: '6px',
                                marginBottom: '12px',
                                maxHeight: '120px',
                                overflowY: 'auto',
                                padding: '8px',
                                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                borderRadius: '6px'
                            }}>
                                {Array.from(selectedTubes).map(index => {
                                    const tubeNumber = neonPaths.filter((p, i) => p && p.mode === 'stroke' && i <= index).length;
                                    return (
                                        <div
                                            key={index}
                                            style={{
                                                padding: '4px 6px',
                                                backgroundColor: '#374151',
                                                color: 'white',
                                                borderRadius: '4px',
                                                fontSize: '11px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                minHeight: '24px'
                                            }}
                                        >
                                            <div 
                                                style={{
                                                    width: '10px',
                                                    height: '10px',
                                                    backgroundColor: pathColors[index] || neonColors.strokeLine || '#ffff00',
                                                    borderRadius: '2px',
                                                    border: '1px solid #ccc',
                                                    flexShrink: 0
                                                }}
                                            />
                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                チューブ {tubeNumber}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        
                        {/* 色選択 */}
                        {selectedTubes.size > 0 && (
                            <div style={{ marginBottom: '16px' }}>
                                <h4 style={{ color: '#d1d5db', marginBottom: '8px', fontSize: '14px' }}>
                                    適用する色を選択
                                </h4>
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(4, 1fr)',
                                    gap: '8px'
                                }}>
                                    {neonPresetColors.map((color) => (
                                        <button
                                            key={color}
                                            style={{
                                                width: '48px',
                                                height: '48px',
                                                backgroundColor: color,
                                                border: '2px solid #6b7280',
                                                borderRadius: '8px',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s ease'
                                            }}
                                            onClick={() => {
                                                const newColors = {};
                                                selectedTubes.forEach(index => {
                                                    newColors[index] = color;
                                                });
                                                setPathColors(prev => ({ ...prev, ...newColors }));
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 太さ選択 */}
                        {selectedTubes.size > 0 && (
                            <div style={{ marginBottom: '16px' }}>
                                <h4 style={{ color: '#d1d5db', marginBottom: '8px', fontSize: '14px' }}>
                                    適用する太さを選択
                                </h4>
                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                    <button
                                        onClick={() => {
                                            const newThickness = {};
                                            selectedTubes.forEach(index => {
                                                newThickness[index] = 15;
                                            });
                                            setPathThickness(prev => ({ ...prev, ...newThickness }));
                                            setSelectedBulkThickness(15);
                                        }}
                                        style={{
                                            backgroundColor: selectedBulkThickness === 15 ? '#10b981' : '#6b7280',
                                            color: 'white',
                                            border: `1px solid ${selectedBulkThickness === 15 ? '#10b981' : '#6b7280'}`,
                                            borderRadius: '4px',
                                            padding: '8px 16px',
                                            fontSize: '12px',
                                            cursor: 'pointer',
                                            fontWeight: 'bold'
                                        }}
                                    >
                                        6mm
                                    </button>
                                    <button
                                        onClick={() => {
                                            const newThickness = {};
                                            selectedTubes.forEach(index => {
                                                newThickness[index] = 20;
                                            });
                                            setPathThickness(prev => ({ ...prev, ...newThickness }));
                                            setSelectedBulkThickness(20);
                                        }}
                                        style={{
                                            backgroundColor: selectedBulkThickness === 20 ? '#10b981' : '#6b7280',
                                            color: 'white',
                                            border: `1px solid ${selectedBulkThickness === 20 ? '#10b981' : '#6b7280'}`,
                                            borderRadius: '4px',
                                            padding: '8px 16px',
                                            fontSize: '12px',
                                            cursor: 'pointer',
                                            fontWeight: 'bold'
                                        }}
                                    >
                                        8mm
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* 完了・キャンセルボタン */}
                        <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
                            <button
                                onClick={() => {
                                    setShowBulkColorModal(false);
                                    setIsCanvasSelectionMode(false);
                                    setSelectedTubes(new Set());
                                    setSelectedBulkThickness(null);
                                    setSidebarVisible(true); // サイドバーを復活
                                }}
                                style={{
                                    flex: 1,
                                    padding: '10px',
                                    backgroundColor: '#10b981',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '14px',
                                    fontWeight: 'bold',
                                    cursor: 'pointer'
                                }}
                            >
                                完了
                            </button>
                            <button
                                onClick={() => {
                                    setShowBulkColorModal(false);
                                    setIsCanvasSelectionMode(false);
                                    setSelectedTubes(new Set());
                                    setSelectedBulkThickness(null);
                                    setSidebarVisible(true); // サイドバーを復活
                                }}
                                style={{
                                    flex: 1,
                                    padding: '10px',
                                    backgroundColor: '#6b7280',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '14px',
                                    fontWeight: 'bold',
                                    cursor: 'pointer'
                                }}
                            >
                                キャンセル
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ガイドモーダル */}
            {showGuideModal && (
                <div className="customize-guide-modal-overlay">
                    <div className="customize-guide-modal-content">
                        <div className="customize-guide-modal-inner">
                            <h2>カスタマイズガイド</h2>
                            <div className="guide-notice-section">
                                <div className="guide-section-title">
                                    <div className="guide-section-icon">1</div>
                                    ネオンチューブの色と太さ
                                </div>
                                <p>
                                    各チューブの色は12色のプリセットから選択できます。太さは6mm（15px）または8mm（20px）から選択可能です。キャンバス上のチューブをクリックするか、右側のコンテナをクリックして選択できます。
                                </p>
                            </div>
                            <div className="guide-notice-section">
                                <div className="guide-section-title">
                                    <div className="guide-section-icon">2</div>
                                    ベースプレートの設定
                                </div>
                                <p>
                                    土台となるベースプレートは透明、白、黒の3色から選択できます。キャンバス上の土台エリアをクリックするか、ベースプレート設定のコンテナをクリックして選択できます。
                                </p>
                            </div>
                            <div className="guide-notice-section">
                                <div className="guide-section-title">
                                    <div className="guide-section-icon">3</div>
                                    一括設定機能
                                </div>
                                <p>
                                    複数のチューブを同時に設定する場合は、一括設定機能を使用してください。「キャンバスからチューブを選択」ボタンをクリックし、キャンバス上で変更したいチューブをクリックして選択後、設定を変更できます。
                                </p>
                            </div>
                            <div className="guide-notice-section">
                                <div className="guide-section-title">
                                    <div className="guide-section-icon">4</div>
                                    ネオンON/OFF切り替え
                                </div>
                                <p>
                                    ネオン効果のON/OFFを切り替えて、点灯時と消灯時の見た目を確認できます。背景色も点灯状態に応じて自動的に切り替わります。
                                </p>
                            </div>
                            <button 
                                onClick={() => {
                                    setShowGuideModal(false);
                                    setIsGuideEffectStopped(true);
                                }} 
                                className="customize-guide-modal-close-button"
                            >
                                閉じる
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Costomize;