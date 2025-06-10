import React, { useState, useRef, useEffect, useCallback } from 'react';
import './Costomize.css';

/* 背景色設定 */

// カスタマイズデータを保存するためのローカルストレージキー
const CUSTOMIZE_DATA_KEY = 'neon-customize-data';

const Costomize = ({ svgData, initialState, onStateChange }) => {
    // 初期状態の設定（propsから受け取るか、デフォルト値を使用）
    const [selectedColor, setSelectedColor] = useState(initialState?.selectedColor || '#ff0080');
    const [brightness, setBrightness] = useState(initialState?.brightness || 100);
    const [thickness, setThickness] = useState(initialState?.thickness || 20);
    const [glowIntensity, setGlowIntensity] = useState(initialState?.glowIntensity || 50);
    const [blinkEffect, setBlinkEffect] = useState(initialState?.blinkEffect || false);
    const [animationSpeed, setAnimationSpeed] = useState(initialState?.animationSpeed || 1);
    const [sidebarVisible, setSidebarVisible] = useState(initialState?.sidebarVisible !== undefined ? initialState.sidebarVisible : true);
    const [neonPower, setNeonPower] = useState(initialState?.neonPower !== undefined ? initialState.neonPower : true); // ネオンON/OFF状態
    const [backgroundColor, setBackgroundColor] = useState(initialState?.backgroundColor || '#000000');
    const [backgroundColorOff, setBackgroundColorOff] = useState(initialState?.backgroundColorOff || '#f5f5f5');
    const [gridColor, setGridColor] = useState(initialState?.gridColor || '#333333');
    const [gridColorOff, setGridColorOff] = useState(initialState?.gridColorOff || '#cccccc');
    const [showGrid, setShowGrid] = useState(initialState?.showGrid !== undefined ? initialState.showGrid : true);
    const [gridOpacity, setGridOpacity] = useState(initialState?.gridOpacity || 0.3);
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
    }, [selectedColor, brightness, thickness, glowIntensity, blinkEffect, animationSpeed, sidebarVisible, neonPower, backgroundColor, backgroundColorOff, gridColor, gridColorOff, showGrid, gridOpacity, gridSize, pathColors, pathThickness, onStateChange]);

    const neonPresetColors = [
        '#ff0080', '#00ff80', '#8000ff', '#ff8000',
        '#0080ff', '#ffff00', '#ff0040', '#40ff00',
        '#00ffff', '#ff00ff', '#ffffff', '#ff4080'
    ];

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

    // Catmull-Rom補間関数（NeonDrawingAppと同じ）
    const getCatmullRomPt = (p0, p1, p2, p3, t) => {
        const t2 = t * t;
        const t3 = t2 * t;
        const c0 = p1;
        const c1 = 0.5 * (p2 - p0);
        const c2 = 0.5 * (2 * p0 - 5 * p1 + 4 * p2 - p3);
        const c3 = 0.5 * (-p0 + 3 * p1 - 3 * p2 + p3);

        return c0 + c1 * t + c2 * t2 + c3 * t3;
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
    const drawNeonTube = (ctx, pathPoints, pathType, color, thickness, glowIntensity, brightness) => {
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
                setNeonLineWidths(svgData.lineWidths);
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
                    const defaultColor = pathObj.mode === 'stroke' ? 
                        (svgData.colors?.strokeLine || '#ffff00') : 
                        (svgData.colors?.fillBorder || '#000000');
                    const defaultThickness = pathObj.mode === 'stroke' ? 
                        (svgData.lineWidths?.strokeLine || 20) :  // 20pxに変更
                        (svgData.lineWidths?.fillBorder || 3);
                    
                    initialColors[pathIndex] = defaultColor;
                    initialThickness[pathIndex] = defaultThickness;
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
    }, [pathColors, pathThickness, backgroundColor, gridColor, showGrid, gridOpacity, selectedColor, brightness, thickness, glowIntensity, blinkEffect, animationSpeed, neonPaths.length]);

    // 状態変更時に親コンポーネントに通知（初期化時は除く）
    const isInitializedRef = useRef(false);
    useEffect(() => {
        if (isInitializedRef.current) {
            saveCurrentState();
        } else {
            isInitializedRef.current = true;
        }
    }, [selectedColor, brightness, thickness, glowIntensity, blinkEffect, animationSpeed, sidebarVisible, neonPower, backgroundColor, backgroundColorOff, gridColor, gridColorOff, showGrid, gridOpacity, gridSize, pathColors, pathThickness]);

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
        }
    }, []);

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

            // ベースプレートの色（透明・白・黒のみ）
            const fillColorValue = pathColors[`${pathIndex}_fill`] || neonColors.fillArea;
            // 境界線は常に1px黒線
            const borderColor = '#000000';
            const borderWidth = 1;

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
            
            // ネオンチューブ効果で描画
            drawNeonTube(
                ctx, 
                pathPoints, 
                pathType, 
                strokeColor, 
                strokeWidth,
                glowIntensity,
                currentBrightness
            );
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
    }, [neonPaths, pathColors, pathThickness, canvasSettings, neonColors, neonLineWidths, canvasWidth, canvasHeight, backgroundColor, backgroundColorOff, gridColor, gridColorOff, showGrid, gridOpacity, gridSize, brightness, glowIntensity, blinkEffect, animationSpeed, neonPower, isDataLoaded]);

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
                    <h1 className="customize-sidebar-title">
                        💡 ネオンチューブ カスタマイズ
                    </h1>

                    {/* ネオンON/OFFスイッチと背景色設定 */}
                    <div className="customize-setting-group" style={{ borderBottom: '2px solid #fbbf24', paddingBottom: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '8px' }}>
                            {/* 左側：ON/OFFスイッチ */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ color: neonPower ? '#10b981' : '#6b7280', fontWeight: 'bold' }}>
                                    {neonPower ? '💡 ON' : '⚫ OFF'}
                                </span>
                                <button
                                    onClick={() => setNeonPower(!neonPower)}
                                    style={{
                                        width: '80px',
                                        height: '40px',
                                        borderRadius: '20px',
                                        border: '2px solid',
                                        borderColor: neonPower ? '#10b981' : '#6b7280',
                                        backgroundColor: neonPower ? '#10b981' : '#374151',
                                        color: 'white',
                                        fontWeight: 'bold',
                                        fontSize: '16px',
                                        cursor: 'pointer',
                                        transition: 'all 0.3s ease',
                                        position: 'relative',
                                        boxShadow: neonPower ? '0 0 20px rgba(16, 185, 129, 0.5)' : 'none'
                                    }}
                                >
                                    <div style={{
                                        position: 'absolute',
                                        top: '3px',
                                        left: neonPower ? '43px' : '3px',
                                        width: '30px',
                                        height: '30px',
                                        borderRadius: '50%',
                                        backgroundColor: 'white',
                                        transition: 'left 0.3s ease',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                    }} />
                                </button>
                            </div>
                            
                            {/* 右側：背景色設定 */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ color: '#d1d5db', fontSize: '12px', fontWeight: 'bold' }}>
                                    背景色
                                </span>
                                <div 
                                    style={{
                                        width: '32px',
                                        height: '32px',
                                        backgroundColor: neonPower ? backgroundColor : backgroundColorOff,
                                        border: '2px solid #ccc',
                                        borderRadius: '6px',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                    }}
                                />
                                <input
                                    type="color"
                                    value={neonPower ? backgroundColor : backgroundColorOff}
                                    onChange={(e) => {
                                        if (neonPower) {
                                            setBackgroundColor(e.target.value);
                                        } else {
                                            setBackgroundColorOff(e.target.value);
                                        }
                                    }}
                                    style={{
                                        width: '24px',
                                        height: '24px',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        opacity: 0,
                                        position: 'absolute',
                                        pointerEvents: 'none'
                                    }}
                                />
                                <button
                                    onClick={() => {
                                        const input = document.createElement('input');
                                        input.type = 'color';
                                        input.value = neonPower ? backgroundColor : backgroundColorOff;
                                        input.onchange = (e) => {
                                            if (neonPower) {
                                                setBackgroundColor(e.target.value);
                                            } else {
                                                setBackgroundColorOff(e.target.value);
                                            }
                                        };
                                        input.click();
                                    }}
                                    style={{
                                        padding: '4px 8px',
                                        backgroundColor: '#3b82f6',
                                        color: 'white',
                                        border: '1px solid #2563eb',
                                        borderRadius: '4px',
                                        fontSize: '10px',
                                        cursor: 'pointer',
                                        fontWeight: 'bold'
                                    }}
                                >
                                    変更
                                </button>
                            </div>
                        </div>
                        <p style={{ 
                            color: '#9ca3af', 
                            fontSize: '12px', 
                            textAlign: 'center', 
                            margin: 0,
                            fontStyle: 'italic'
                        }}>
                            {neonPower ? 'LEDネオンが点灯しています' : 'LEDネオンが消灯しています'}
                        </p>
                    </div>

                    {/* サイドバー非表示ボタン */}
                    <div className="customize-sidebar-hide-button-container">
                        <button 
                            onClick={() => setSidebarVisible(false)}
                            className="customize-sidebar-hide-button"
                        >
                            サイドバー非表示
                        </button>
                    </div>

                    {/* ネオンチューブ設定 */}
                    {neonPaths.filter(pathObj => pathObj && pathObj.mode === 'stroke').length > 0 && (
                        <div className="customize-setting-group">
                            <h3 className="customize-setting-title">ネオンチューブ設定 ({neonPaths.filter(pathObj => pathObj && pathObj.mode === 'stroke').length}個)</h3>
                            {neonPaths
                                .map((pathObj, index) => ({ pathObj, originalIndex: index }))
                                .filter(({ pathObj }) => pathObj && pathObj.mode === 'stroke')
                                .sort((a, b) => calculatePathLength(b.pathObj) - calculatePathLength(a.pathObj))
                                .map(({ pathObj, originalIndex }, sortedIndex) => (
                                    <div 
                                        key={originalIndex} 
                                        className="customize-path-color-section"
                                        onClick={() => {
                                            if (highlightedTube === originalIndex) {
                                                setHighlightedTube(null); // 既にハイライトされている場合は解除
                                            } else {
                                                setHighlightedTube(originalIndex); // ハイライト設定
                                            }
                                        }}
                                        style={{
                                            cursor: 'pointer',
                                            border: highlightedTube === originalIndex ? '2px solid #fbbf24' : '1px solid rgba(255, 255, 255, 0.1)',
                                            backgroundColor: highlightedTube === originalIndex ? 'rgba(251, 191, 36, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        <label className="customize-setting-label">
                                            チューブ {sortedIndex + 1} (長さ: {Math.round(calculatePathLength(pathObj) / 25 * 10) / 10}cm)
                                        </label>
                                        
                                        {/* 色設定 */}
                                        <div className="customize-slider-container">
                                            <label className="customize-setting-label">色の設定</label>
                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                {/* 現在の色アイコン */}
                                                <div 
                                                    style={{
                                                        width: '32px',
                                                        height: '32px',
                                                        backgroundColor: pathColors[originalIndex] || neonColors.strokeLine || '#ffff00',
                                                        border: '2px solid #ccc',
                                                        borderRadius: '6px',
                                                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                                    }}
                                                />
                                                {/* 色設定ボタン */}
                                                <button
                                                    onClick={() => {
                                                        setSelectedPathIndex(originalIndex);
                                                        setShowColorModal(true);
                                                    }}
                                                    style={{
                                                        backgroundColor: '#3b82f6',
                                                        color: 'white',
                                                        border: '1px solid #2563eb',
                                                        borderRadius: '6px',
                                                        padding: '8px 16px',
                                                        fontSize: '12px',
                                                        cursor: 'pointer',
                                                        fontWeight: 'bold'
                                                    }}
                                                >
                                                    色を選択
                                                </button>
                                            </div>
                                        </div>
                                        
                                        {/* 太さ設定 */}
                                        <div className="customize-slider-container" style={{ marginTop: '16px' }}>
                                            <label className="customize-setting-label">太さ: {pathThickness[originalIndex] || neonLineWidths.strokeLine}px</label>
                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                                <button
                                                    onClick={() => handlePathThicknessChange(originalIndex, 15)}
                                                    className={`customize-color-preset ${(pathThickness[originalIndex] || neonLineWidths.strokeLine) === 15 ? 'active' : ''}`}
                                                    style={{ 
                                                        backgroundColor: (pathThickness[originalIndex] || neonLineWidths.strokeLine) === 15 ? '#10b981' : '#6b7280',
                                                        color: 'white',
                                                        border: '1px solid',
                                                        borderColor: (pathThickness[originalIndex] || neonLineWidths.strokeLine) === 15 ? '#10b981' : '#6b7280',
                                                        borderRadius: '4px',
                                                        padding: '4px 8px',
                                                        fontSize: '12px',
                                                        cursor: 'pointer',
                                                        width: '60px',
                                                        height: 'auto'
                                                    }}
                                                >
                                                    6mm
                                                </button>
                                                <button
                                                    onClick={() => handlePathThicknessChange(originalIndex, 20)}
                                                    className={`customize-color-preset ${(pathThickness[originalIndex] || neonLineWidths.strokeLine) === 20 ? 'active' : ''}`}
                                                    style={{ 
                                                        backgroundColor: (pathThickness[originalIndex] || neonLineWidths.strokeLine) === 20 ? '#10b981' : '#6b7280',
                                                        color: 'white',
                                                        border: '1px solid',
                                                        borderColor: (pathThickness[originalIndex] || neonLineWidths.strokeLine) === 20 ? '#10b981' : '#6b7280',
                                                        borderRadius: '4px',
                                                        padding: '4px 8px',
                                                        fontSize: '12px',
                                                        cursor: 'pointer',
                                                        width: '60px',
                                                        height: 'auto'
                                                    }}
                                                >
                                                    8mm
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                        </div>
                    )}

                    {/* 土台設定 */}
                    {neonPaths.filter(pathObj => pathObj && pathObj.mode === 'fill').length > 0 && (
                        <div className="customize-setting-group">
                            <h3 className="customize-setting-title">土台設定 ({neonPaths.filter(pathObj => pathObj && pathObj.mode === 'fill').length}個)</h3>
                            {neonPaths.map((pathObj, index) => {
                                if (!pathObj || pathObj.mode !== 'fill') return null;
                                return (
                                    <div key={index} className="customize-path-color-section">
                                        <label className="customize-setting-label">
                                            土台 {neonPaths.filter((p, i) => p && p.mode === 'fill' && i <= index).length}
                                        </label>
                                        
                                        {/* ベースプレートの色設定 */}
                                        <div className="customize-slider-container">
                                            <label className="customize-setting-label">ベースプレートの色</label>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                            <button
                                                className={`customize-path-preset ${pathColors[`${index}_fill`] === 'transparent' ? 'active' : ''}`}
                                                style={{ 
                                                    backgroundColor: 'transparent',
                                                    border: '2px solid #ccc',
                                                    width: '32px',
                                                    height: '32px',
                                                    borderRadius: '6px',
                                                    position: 'relative',
                                                    background: 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)',
                                                    backgroundSize: '8px 8px',
                                                    backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px'
                                                }}
                                                onClick={() => handlePathColorChange(`${index}_fill`, 'transparent')}
                                                title="透明"
                                            />
                                            <button
                                                className={`customize-path-preset ${pathColors[`${index}_fill`] === '#ffffff' ? 'active' : ''}`}
                                                style={{ 
                                                    backgroundColor: '#ffffff',
                                                    border: '2px solid #ccc',
                                                    width: '32px',
                                                    height: '32px',
                                                    borderRadius: '6px'
                                                }}
                                                onClick={() => handlePathColorChange(`${index}_fill`, '#ffffff')}
                                                title="白"
                                            />
                                            <button
                                                className={`customize-path-preset ${pathColors[`${index}_fill`] === '#000000' ? 'active' : ''}`}
                                                style={{ 
                                                    backgroundColor: '#000000',
                                                    border: '2px solid #ccc',
                                                    width: '32px',
                                                    height: '32px',
                                                    borderRadius: '6px'
                                                }}
                                                onClick={() => handlePathColorChange(`${index}_fill`, '#000000')}
                                                title="黒"
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    <div className="customize-setting-group">
                        <h3 className="customize-setting-title">ビュー操作</h3>
                        
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
                            className="customize-reset-button"
                            style={{ marginBottom: '12px' }}
                        >
                            🎯 ビューリセット
                        </button>
                        
                        <p style={{ 
                            color: '#9ca3af', 
                            fontSize: '12px', 
                            margin: 0,
                            fontStyle: 'italic'
                        }}>
                            マウスホイール: ズーム<br/>
                            右クリック+ドラッグ: パン
                        </p>
                    </div>
                    <div className="customize-setting-group">
                        <h3 className="customize-setting-title">背景・表示設定</h3>
                        
                        {/* 背景色設定（点灯時） */}
                        <div className="customize-slider-container">
                            <label className="customize-setting-label">背景色（点灯時）</label>
                            <input
                                type="color"
                                value={backgroundColor}
                                onChange={(e) => setBackgroundColor(e.target.value)}
                                className="customize-path-color-input"
                            />
                            <span className="customize-path-color-value">{backgroundColor}</span>
                        </div>

                        {/* 背景色設定（消灯時） */}
                        <div className="customize-slider-container">
                            <label className="customize-setting-label">背景色（消灯時）</label>
                            <input
                                type="color"
                                value={backgroundColorOff}
                                onChange={(e) => setBackgroundColorOff(e.target.value)}
                                className="customize-path-color-input"
                            />
                            <span className="customize-path-color-value">{backgroundColorOff}</span>
                        </div>

                        {/* グリッド表示切り替え */}
                        <div className="customize-slider-container">
                            <label className="customize-setting-label">グリッド表示</label>
                            <button
                                onClick={() => setShowGrid(!showGrid)}
                                className={`customize-color-preset ${showGrid ? 'active' : ''}`}
                                style={{ 
                                    backgroundColor: showGrid ? '#10b981' : '#6b7280',
                                    width: '60px',
                                    height: '24px',
                                    borderRadius: '12px'
                                }}
                            >
                                {showGrid ? 'ON' : 'OFF'}
                            </button>
                        </div>

                        {/* グリッド設定 */}
                        {showGrid && (
                            <>
                                <div className="customize-slider-container">
                                    <label className="customize-setting-label">グリッドサイズ: {gridSize}px（{gridSize/25}cm間隔）</label>
                                    <input
                                        type="range"
                                        min="25"
                                        max="200"
                                        step="25"
                                        value={gridSize}
                                        onChange={(e) => setGridSize(Number(e.target.value))}
                                        className="customize-setting-slider"
                                    />
                                </div>

                                <div className="customize-slider-container">
                                    <label className="customize-setting-label">グリッドの色（点灯時）</label>
                                    <input
                                        type="color"
                                        value={gridColor}
                                        onChange={(e) => setGridColor(e.target.value)}
                                        className="customize-path-color-input"
                                    />
                                    <span className="customize-path-color-value">{gridColor}</span>
                                </div>

                                <div className="customize-slider-container">
                                    <label className="customize-setting-label">グリッドの色（消灯時）</label>
                                    <input
                                        type="color"
                                        value={gridColorOff}
                                        onChange={(e) => setGridColorOff(e.target.value)}
                                        className="customize-path-color-input"
                                    />
                                    <span className="customize-path-color-value">{gridColorOff}</span>
                                </div>

                                <div className="customize-slider-container">
                                    <label className="customize-setting-label">グリッド透明度: {Math.round(gridOpacity * 100)}%</label>
                                    <input
                                        type="range"
                                        min="0.1"
                                        max="1"
                                        step="0.1"
                                        value={gridOpacity}
                                        onChange={(e) => setGridOpacity(Number(e.target.value))}
                                        className="customize-setting-slider"
                                    />
                                </div>
                            </>
                        )}
                    </div>

                    <div className="customize-setting-group">
                        <h3 className="customize-setting-title">ネオン効果設定</h3>
                        
                        {/* 明るさ */}
                        <div className="customize-slider-container">
                            <label className="customize-setting-label">明るさ: {brightness}%</label>
                            <input
                                type="range"
                                min="20"
                                max="200"
                                value={brightness}
                                onChange={(e) => setBrightness(e.target.value)}
                                className="customize-setting-slider"
                                disabled={!neonPower}
                                style={{ opacity: neonPower ? 1 : 0.5 }}
                            />
                        </div>

                        {/* グロー強度 */}
                        <div className="customize-slider-container">
                            <label className="customize-setting-label">グロー強度: {glowIntensity}px</label>
                            <input
                                type="range"
                                min="10"
                                max="100"
                                value={glowIntensity}
                                onChange={(e) => setGlowIntensity(e.target.value)}
                                className="customize-setting-slider"
                                disabled={!neonPower}
                                style={{ opacity: neonPower ? 1 : 0.5 }}
                            />
                        </div>

                        {/* 点滅エフェクト */}
                        <div className="customize-animation-controls">
                            <label className="customize-checkbox-container">
                                <input
                                    type="checkbox"
                                    checked={blinkEffect && neonPower}
                                    onChange={(e) => setBlinkEffect(e.target.checked)}
                                    className="customize-setting-checkbox"
                                    disabled={!neonPower}
                                />
                                <span className="customize-checkmark" style={{ opacity: neonPower ? 1 : 0.5 }}></span>
                                点滅エフェクト {!neonPower && '(電源OFF時は無効)'}
                            </label>
                            {blinkEffect && neonPower && (
                                <div className="customize-slider-container">
                                    <label className="customize-setting-label">点滅速度: {animationSpeed}x</label>
                                    <input
                                        type="range"
                                        min="0.5"
                                        max="3"
                                        step="0.1"
                                        value={animationSpeed}
                                        onChange={(e) => setAnimationSpeed(e.target.value)}
                                        className="customize-setting-slider"
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="customize-setting-group">
                        <h3 className="customize-setting-title">一括カラー設定</h3>
                        <button
                            onClick={() => {
                                setSelectedTubes(new Set());
                                setShowBulkColorModal(true);
                            }}
                            style={{
                                width: '100%',
                                padding: '12px',
                                backgroundColor: '#7c3aed',
                                color: 'white',
                                border: '1px solid #8b5cf6',
                                borderRadius: '6px',
                                fontSize: '14px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            チューブを選択して一括色変更
                        </button>
                    </div>

                    {/* SVGダウンロード */}
                    <button
                        onClick={handleDownloadSVG}
                        className="customize-download-button"
                        disabled={neonPaths.length === 0}
                    >
                        💾 ネオンサインSVGダウンロード
                    </button>

                    {/* リセットボタン */}
                    <button
                        onClick={() => {
                            setSelectedColor('#ff0080');
                            setBrightness(100);
                            setThickness(20);
                            setGlowIntensity(50);
                            setBlinkEffect(false);
                            setAnimationSpeed(1);
                            setBackgroundColor('#000000');
                            setBackgroundColorOff('#f5f5f5');
                            setGridColor('#333333');
                            setGridColorOff('#cccccc');
                            setShowGrid(true);
                            setGridOpacity(0.3);
                            setGridSize(160);
                            setNeonPower(true); // 電源もONにリセット
                            
                            // パス別設定もリセット
                            const resetColors = {};
                            const resetThickness = {};
                            neonPaths.forEach((pathObj, index) => {
                                if (pathObj.mode === 'stroke') {
                                    resetColors[index] = '#ffff00';
                                    resetThickness[index] = 20;
                                } else {
                                    resetColors[index] = '#000000';
                                    resetThickness[index] = 3;
                                }
                            });
                            setPathColors(resetColors);
                            setPathThickness(resetThickness);
                        }}
                        className="customize-reset-button"
                    >
                        🔄 すべてリセット
                    </button>
                </div>
            )}

            {/* サイドバー表示ボタン（サイドバーが非表示の時） */}
            {!sidebarVisible && (
                <button
                    onClick={() => setSidebarVisible(true)}
                    className="customize-show-sidebar-button"
                >
                    💡 ネオン設定を表示
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
                        backgroundColor: '#1f2937',
                        padding: '24px',
                        borderRadius: '12px',
                        border: '1px solid #374151',
                        minWidth: '320px'
                    }}>
                        <h3 style={{ color: '#fbbf24', marginBottom: '16px', textAlign: 'center' }}>
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

            {/* 一括色変更モーダル */}
            {showBulkColorModal && (
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
                        backgroundColor: '#1f2937',
                        padding: '24px',
                        borderRadius: '12px',
                        border: '1px solid #374151',
                        minWidth: '400px',
                        maxWidth: '500px'
                    }}>
                        <h3 style={{ color: '#fbbf24', marginBottom: '16px', textAlign: 'center' }}>
                            チューブを選択して一括色変更
                        </h3>
                        
                        {/* チューブ選択 */}
                        <div style={{ marginBottom: '16px' }}>
                            <h4 style={{ color: '#d1d5db', marginBottom: '8px', fontSize: '14px' }}>
                                変更するチューブを選択 ({selectedTubes.size}個選択中)
                            </h4>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '12px' }}>
                                {neonPaths.map((pathObj, index) => {
                                    if (!pathObj || pathObj.mode !== 'stroke') return null;
                                    const tubeNumber = neonPaths.filter((p, i) => p && p.mode === 'stroke' && i <= index).length;
                                    return (
                                        <button
                                            key={index}
                                            onClick={() => {
                                                const newSelected = new Set(selectedTubes);
                                                if (newSelected.has(index)) {
                                                    newSelected.delete(index);
                                                } else {
                                                    newSelected.add(index);
                                                }
                                                setSelectedTubes(newSelected);
                                            }}
                                            style={{
                                                padding: '8px 12px',
                                                backgroundColor: selectedTubes.has(index) ? '#10b981' : '#374151',
                                                color: 'white',
                                                border: selectedTubes.has(index) ? '2px solid #10b981' : '1px solid #6b7280',
                                                borderRadius: '6px',
                                                fontSize: '12px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px'
                                            }}
                                        >
                                            <div 
                                                style={{
                                                    width: '16px',
                                                    height: '16px',
                                                    backgroundColor: pathColors[index] || neonColors.strokeLine || '#ffff00',
                                                    borderRadius: '3px',
                                                    border: '1px solid #ccc'
                                                }}
                                            />
                                            チューブ {tubeNumber}
                                        </button>
                                    );
                                })}
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    onClick={() => {
                                        const allTubeIndices = neonPaths
                                            .map((pathObj, index) => pathObj && pathObj.mode === 'stroke' ? index : null)
                                            .filter(index => index !== null);
                                        setSelectedTubes(new Set(allTubeIndices));
                                    }}
                                    style={{
                                        padding: '4px 8px',
                                        backgroundColor: '#3b82f6',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        fontSize: '12px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    全選択
                                </button>
                                <button
                                    onClick={() => setSelectedTubes(new Set())}
                                    style={{
                                        padding: '4px 8px',
                                        backgroundColor: '#6b7280',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        fontSize: '12px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    全解除
                                </button>
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
                                                setShowBulkColorModal(false);
                                                setSelectedTubes(new Set());
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        <button
                            onClick={() => {
                                setShowBulkColorModal(false);
                                setSelectedTubes(new Set());
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
        </div>
    );
};

export default Costomize;