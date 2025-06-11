import React, { useState, useRef, useEffect, useCallback } from 'react';
import './NeonDrawingApp.css';

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

const POINT_HIT_RADIUS = 8; // 点のヒット判定半径

// モーダルコンポーネント
const Modal = ({ isOpen, onClose, title, children, position = 'center' }) => {
    if (!isOpen) return null;
    
    const modalClass = position === 'right' 
        ? "modal-overlay modal-right"
        : "modal-overlay modal-center";
    
    const contentClass = position === 'right'
        ? "modal-content modal-content-right"
        : "modal-content modal-content-center";
    
    return (
        <div className={modalClass}>
            <div className={contentClass}>
                <div className="modal-header">
                    <h3 className="modal-title">{title}</h3>
                    <button 
                        onClick={onClose}
                        className="modal-close-btn"
                    >
                        ×
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
};

const NeonDrawingApp = ({ initialState, onStateChange }) => {
    // 初期状態の設定（propsから受け取るか、デフォルト値を使用）
    const [drawMode, setDrawMode] = useState(initialState?.drawMode || 'stroke');
    const [drawingType, setDrawingType] = useState(initialState?.drawingType || 'spline');

    const canvasRef = useRef(null);
    const [paths, setPaths] = useState(initialState?.paths || [{ points: [], mode: initialState?.drawMode || 'stroke', type: initialState?.drawingType || 'spline' }]);
    const [currentPathIndex, setCurrentPathIndex] = useState(initialState?.currentPathIndex || 0);
    const [canvasWidth, setCanvasWidth] = useState(800);
    const [canvasHeight, setCanvasHeight] = useState(600);
    const [segmentsPerCurve, setSegmentsPerCurve] = useState(30);

    // ズームとパン
    const [scale, setScale] = useState(initialState?.scale || 1);
    const [offsetX, setOffsetX] = useState(initialState?.offsetX || 0);
    const [offsetY, setOffsetY] = useState(initialState?.offsetY || 0);
    const [isPanning, setIsPanning] = useState(false);
    const [lastPanX, setLastPanX] = useState(0);
    const [lastPanY, setLastPanY] = useState(0);

    // ドラッグと編集
    const [activePoint, setActivePoint] = useState(null);
    const didDragRef = useRef(false); // ドラッグが行われたかを判定
    const [isModifyingPoints, setIsModifyingPoints] = useState(false);
    const [isPathDeleteMode, setIsPathDeleteMode] = useState(false); // パス削除モード
    const [isPointDeleteMode, setIsPointDeleteMode] = useState(false); // 点削除モード

    // 背景画像
    const [backgroundImage, setBackgroundImage] = useState(initialState?.backgroundImage || null);
    const [loadedBackgroundImage, setLoadedBackgroundImage] = useState(null);
    const [initialBgImageWidth, setInitialBgImageWidth] = useState(initialState?.initialBgImageWidth || 0);
    const [initialBgImageHeight, setInitialBgImageHeight] = useState(initialState?.initialBgImageHeight || 0);
    const [bgImageScale, setBgImageScale] = useState(initialState?.bgImageScale || 1.0);
    const [bgImageX, setBgImageX] = useState(initialState?.bgImageX || 0); 
    const [bgImageY, setBgImageY] = useState(initialState?.bgImageY || 0); 
    const [bgImageOpacity, setBgImageOpacity] = useState(initialState?.bgImageOpacity || 1.0);

    // グリッド - デフォルトでオンに変更
    const [showGrid, setShowGrid] = useState(initialState?.showGrid !== undefined ? initialState.showGrid : true); 
    const [gridSize, setGridSize] = useState(initialState?.gridSize || 100); // 4cm = 100px (20px=8mm基準)
    const [gridOpacity, setGridOpacity] = useState(initialState?.gridOpacity || 0.5);

    // モーダル状態
    const [showGridModal, setShowGridModal] = useState(false);
    const [showBgModal, setShowBgModal] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [showColorModal, setShowColorModal] = useState(false);
    const [sidebarVisible, setSidebarVisible] = useState(true);
    // 土台モード時に描画タイプ選択モーダルを表示するためのステート
    const [showFillDrawingTypeModal, setShowFillDrawingTypeModal] = useState(false);
    // ガイドモーダル関連のstate
    const [showGuideModal, setShowGuideModal] = useState(false);
    const [isGuideEffectStopped, setIsGuideEffectStopped] = useState(false); 
    
    // 履歴管理 (Undo/Redo)
    const [history, setHistory] = useState(() => {
        const initialPaths = [{ points: [], mode: 'stroke', type: 'spline' }];
        return [{ 
            paths: JSON.parse(JSON.stringify(initialPaths)), 
            currentPathIndex: 0, 
            drawMode: 'stroke', 
            drawingType: 'spline' 
        }];
    });
    const [historyIndex, setHistoryIndex] = useState(0);
    
    // 背景色変更のデバウンス用ref
    const backgroundColorTimeoutRef = useRef(null);
    
    // 色設定 - デフォルト値を変更
    const [colors, setColors] = useState(initialState?.colors || {
        strokePoint: '#00ffff',  // チューブの点：シアン
        strokeLine: '#ffff00',   // チューブの線：イエロー
        fillPoint: '#000000',    // 土台の点：黒
        fillArea: 'rgba(110, 110, 110, 0.5)', // 土台の中身：RGB(110, 110, 110) 透明度50%
        fillBorder: '#000000',   // 土台の境界線：黒
        background: '#303030',   // 背景色：RGB(48,48,48)
        grid: '#000000'          // グリッド色：黒
    });
    
    // 線の太さ設定 - デフォルト値を変更
    const [lineWidths, setLineWidths] = useState(initialState?.lineWidths || {
        strokeLine: 4,  // チューブの線の太さ
        fillBorder: 3   // 土台の境界線の太さ
    });

    // 背景色変更のデバウンス処理
    const handleBackgroundColorChange = useCallback((color) => {
        // 既存のタイマーをクリア
        if (backgroundColorTimeoutRef.current) {
            clearTimeout(backgroundColorTimeoutRef.current);
        }
        
        // 200ms後に実際の更新を実行
        backgroundColorTimeoutRef.current = setTimeout(() => {
            setColors(prev => ({ ...prev, background: color }));
        }, 200);
    }, []);

    // 背景画像のロード処理
    useEffect(() => {
        if (backgroundImage) {
            const img = new Image();
            img.onload = () => {
                setLoadedBackgroundImage(img);

                const drawingAreaWidth = 800; // 仮想的な初期サイズ
                const drawingAreaHeight = 600;

                let fittedWidth, fittedHeight;
                // 画像のアスペクト比に合わせてフィットさせる
                if (img.width / img.height > drawingAreaWidth / drawingAreaHeight) {
                    fittedWidth = drawingAreaWidth;
                    fittedHeight = img.height * (drawingAreaWidth / img.width);
                } else {
                    fittedHeight = drawingAreaHeight;
                    fittedWidth = img.width * (drawingAreaHeight / img.height);
                }

                setInitialBgImageWidth(fittedWidth);
                setInitialBgImageHeight(fittedHeight);
                setBgImageScale(1.0);
                // 中央に配置（無限キャンバスの原点付近）
                setBgImageX(0);
                setBgImageY(0);
                setBgImageOpacity(1.0);
            };
            img.onerror = () => {
                console.error("背景画像の読み込みに失敗しました。");
                setBackgroundImage(null); // エラー時は画像をクリア
                setLoadedBackgroundImage(null);
            };
            img.src = backgroundImage;
        } else {
            setLoadedBackgroundImage(null);
            setInitialBgImageWidth(0);
            setInitialBgImageHeight(0);
            setBgImageScale(1.0);
            setBgImageX(0);
            setBgImageY(0);
            setBgImageOpacity(1.0);
        }
    }, [backgroundImage]);

    // スプライン曲線を描画する関数
    const drawSpline = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, canvas.width, canvas.height); // キャンバスをクリア

        // 無限背景とグリッドの描画
        ctx.save();
        ctx.translate(offsetX, offsetY);
        ctx.scale(scale, scale);

        const visibleLeft = -offsetX / scale;
        const visibleTop = -offsetY / scale;
        const visibleRight = (canvas.width - offsetX) / scale;
        const visibleBottom = (canvas.height - offsetY) / scale;

        // 背景色を描画
        ctx.fillStyle = colors.background;
        ctx.fillRect(visibleLeft - 1000, visibleTop - 1000, 
                     (visibleRight - visibleLeft) + 2000, (visibleBottom - visibleTop) + 2000);

        // 背景画像を描画
        if (loadedBackgroundImage && initialBgImageWidth > 0 && initialBgImageHeight > 0) {
            ctx.globalAlpha = bgImageOpacity;
            const currentBgWidth = initialBgImageWidth * bgImageScale;
            const currentBgHeight = initialBgImageHeight * bgImageScale;
            const drawX = bgImageX - (currentBgWidth / 2); // 画像の中心を基準に描画
            const drawY = bgImageY - (currentBgHeight / 2);
            ctx.drawImage(loadedBackgroundImage, drawX, drawY, currentBgWidth, currentBgHeight);
            ctx.globalAlpha = 1;
        }

        // 無限グリッドを描画
        if (showGrid) {
            ctx.strokeStyle = colors.grid;
            ctx.lineWidth = 0.5 / scale;
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

        ctx.restore(); // グリッドと背景の変換を元に戻す

        // パスと制御点の描画
        ctx.save();
        ctx.translate(offsetX, offsetY);
        ctx.scale(scale, scale);

        // 中心点に十字マークを描画
        const crossSize = 10 / scale; // スケールに合わせてサイズを調整
        ctx.strokeStyle = '#FF0000'; // 赤色
        ctx.lineWidth = 1 / scale;
        ctx.beginPath();
        ctx.moveTo(-crossSize, 0);
        ctx.lineTo(crossSize, 0);
        ctx.moveTo(0, -crossSize);
        ctx.lineTo(0, crossSize);
        ctx.stroke();

        // 1. まず全ての土台（fill）パスの面と境界線を描画
        paths.forEach((pathObj) => {
            if (!pathObj || !Array.isArray(pathObj.points) || pathObj.mode !== 'fill') {
                return;
            }

            const pathPoints = pathObj.points;
            const pathType = pathObj.type; // パスのタイプを取得

            if (pathPoints.length < 2) return;

            ctx.fillStyle = colors.fillArea;
            ctx.beginPath();
            ctx.moveTo(pathPoints[0].x, pathPoints[0].y);

            if (pathType === 'spline') { // スプライン描画
                for (let i = 0; i < pathPoints.length - 1; i++) {
                    const p0 = (i === 0) ? pathPoints[0] : pathPoints[i - 1];
                    const p1 = pathPoints[i];
                    const p2 = pathPoints[i + 1];
                    const p3 = (i + 2 >= pathPoints.length) ? pathPoints[pathPoints.length - 1] : pathPoints[i + 2];

                    for (let t = 0; t <= segmentsPerCurve; t++) {
                        const step = t / segmentsPerCurve;
                        const x = getCatmullRomPt(p0.x, p1.x, p2.x, p3.x, step);
                        const y = getCatmullRomPt(p0.y, p1.y, p2.y, p3.y, step);
                        ctx.lineTo(x, y);
                    }
                }
            } else { // 直線描画
                for (let i = 1; i < pathPoints.length; i++) {
                    ctx.lineTo(pathPoints[i].x, pathPoints[i].y);
                }
            }
            ctx.closePath();
            ctx.fill();
            
            // 境界線も描画
            ctx.strokeStyle = colors.fillBorder;
            ctx.lineWidth = lineWidths.fillBorder / scale;
            ctx.stroke();
        });

        // 2. 次に全てのチューブ（stroke）パスを描画
        paths.forEach((pathObj) => {
            if (!pathObj || !Array.isArray(pathObj.points) || pathObj.mode !== 'stroke') {
                return;
            }

            const pathPoints = pathObj.points;
            const pathType = pathObj.type; // パスのタイプを取得

            if (pathPoints.length < 2) return;

            ctx.strokeStyle = colors.strokeLine;
            ctx.lineWidth = lineWidths.strokeLine / scale;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';

            ctx.beginPath();
            ctx.moveTo(pathPoints[0].x, pathPoints[0].y);

            if (pathType === 'spline') { // スプライン描画
                for (let i = 0; i < pathPoints.length - 1; i++) {
                    const p0 = (i === 0) ? pathPoints[0] : pathPoints[i - 1];
                    const p1 = pathPoints[i];
                    const p2 = pathPoints[i + 1];
                    const p3 = (i + 2 >= pathPoints.length) ? pathPoints[pathPoints.length - 1] : pathPoints[i + 2];

                    for (let t = 0; t <= segmentsPerCurve; t++) {
                        const step = t / segmentsPerCurve;
                        const x = getCatmullRomPt(p0.x, p1.x, p2.x, p3.x, step);
                        const y = getCatmullRomPt(p0.y, p1.y, p2.y, p3.y, step);
                        ctx.lineTo(x, y);
                    }
                }
            } else { // 直線描画
                for (let i = 1; i < pathPoints.length; i++) {
                    ctx.lineTo(pathPoints[i].x, pathPoints[i].y);
                }
            }
            ctx.stroke();
        });

        // 3. 最後に全ての制御点を描画（土台、チューブの順で色分け）
        paths.forEach((pathObj, pathIdx) => {
            if (!pathObj || !Array.isArray(pathObj.points)) {
                return;
            }

            const pathPoints = pathObj.points;
            const pathMode = pathObj.mode;

            // 制御点を描画
            pathPoints.forEach((p, ptIdx) => {
                ctx.beginPath();
                let pointFillStyle;
                
                // パスのモードに応じて点の色を変更
                if (pathMode === 'fill') {
                    pointFillStyle = colors.fillPoint; // 土台（fill）の点の色
                } else {
                    pointFillStyle = colors.strokePoint; // チューブ（stroke）の点の色
                }

                // アクティブな点の色
                if (activePoint && activePoint.pathIndex === pathIdx && activePoint.pointIndex === ptIdx) {
                    pointFillStyle = '#3b82f6'; // アクティブ時は青
                }
                
                // 削除モードの場合は赤色で表示
                if (isPathDeleteMode || isPointDeleteMode) { // 点削除モード時も赤
                    pointFillStyle = '#ef4444'; // 削除モード時は赤
                }
                
                ctx.fillStyle = pointFillStyle;

                ctx.arc(p.x, p.y, 4 / scale, 0, Math.PI * 2);
                ctx.fill();
            });
        });

        ctx.restore(); // パスと制御点の変換を元に戻す
    }, [paths, segmentsPerCurve, scale, offsetX, offsetY, activePoint, loadedBackgroundImage, initialBgImageWidth, initialBgImageHeight, bgImageScale, bgImageX, bgImageY, bgImageOpacity, showGrid, gridSize, gridOpacity, colors, lineWidths, isPathDeleteMode, isPointDeleteMode]);

    // 色変換のヘルパー関数
    const hexToRgba = (hex, alpha = 0.5) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    const rgbaToHex = (rgba) => {
        const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (match) {
            const r = parseInt(match[1]).toString(16).padStart(2, '0');
            const g = parseInt(match[2]).toString(16).padStart(2, '0');
            const b = parseInt(match[3]).toString(16).padStart(2, '0');
            return `#${r}${g}${b}`;
        }
        return '#FFFF00'; // デフォルト色
    };

    // 履歴を保存する関数
    const saveToHistory = useCallback((currentPaths, currentPathIdx, currentDrawMode, currentDrawingType) => {
        setHistory(prevHistory => {
            const newHistory = prevHistory.slice(0, historyIndex + 1); // 現在のhistoryIndexまでを保持

            // 最新のstateを履歴に追加
            const newState = {
                paths: JSON.parse(JSON.stringify(currentPaths)), // ディープコピー
                currentPathIndex: currentPathIdx,
                drawMode: currentDrawMode,
                drawingType: currentDrawingType,
                scale: scale,
                offsetX: offsetX,
                offsetY: offsetY,
                backgroundImage: backgroundImage,
                initialBgImageWidth: initialBgImageWidth,
                initialBgImageHeight: initialBgImageHeight,
                bgImageScale: bgImageScale,
                bgImageX: bgImageX,
                bgImageY: bgImageY,
                bgImageOpacity: bgImageOpacity,
                showGrid: showGrid,
                gridSize: gridSize,
                gridOpacity: gridOpacity,
                colors: colors,
                lineWidths: lineWidths
            };
            newHistory.push(newState);

            // 履歴の最大数（50個）を管理
            if (newHistory.length > 50) {
                newHistory.shift(); // 最も古い履歴を削除
            }
            
            // 親コンポーネントに状態変更を通知
            if (onStateChange) {
                onStateChange(newState);
            }
            
            console.log("History saved. newHistory.length:", newHistory.length, "historyIndex to be:", newHistory.length -1, "Saved state:", newState);
            return newHistory;
        });
        setHistoryIndex(prev => {
            const newIndex = Math.min(prev + 1, 49); // 最大履歴数に合わせる
            console.log("setHistoryIndex to:", newIndex);
            return newIndex;
        });
    }, [historyIndex, onStateChange, scale, offsetX, offsetY, backgroundImage, initialBgImageWidth, initialBgImageHeight, bgImageScale, bgImageX, bgImageY, bgImageOpacity, showGrid, gridSize, gridOpacity, colors, lineWidths]); 

    // やり直し (Redo)
    const handleRedo = useCallback(() => {
        console.log("handleRedo called. historyIndex:", historyIndex, "history.length:", history.length);
        if (historyIndex < history.length - 1) {
            const nextIndex = historyIndex + 1;
            const nextState = history[nextIndex];
            console.log("Attempting to access nextIndex:", nextIndex, "history[nextIndex]:", nextState);
            if (nextState && Array.isArray(nextState.paths)) { 
                setPaths(nextState.paths);
                setCurrentPathIndex(nextState.currentPathIndex);
                setDrawMode(nextState.drawMode);
                setDrawingType(nextState.drawingType);
                setHistoryIndex(nextIndex);
                setIsModifyingPoints(false);
                setIsPathDeleteMode(false); // Redo時にモードを解除
                setIsPointDeleteMode(false); // Redo時にモードを解除
            } else {
                console.error("Redo failed: nextState is invalid or missing at index", nextIndex, { nextState, historySnapshot: history });
            }
        } else {
            console.log("Redo not possible: historyIndex is at end.");
        }
    }, [history, historyIndex]);

    // キャンバスをクリア
    const clearCanvas = useCallback(() => {
        // クリア時には常に新しい空のパスを作成し、最初のパスとする
        const initialPaths = [{ points: [], mode: drawMode, type: drawingType }]; 
        setPaths(initialPaths);
        setCurrentPathIndex(0);
        setScale(1);
        setOffsetX(canvasWidth / 2); // 原点(0,0)を画面中央に表示
        setOffsetY(canvasHeight / 2);
        setIsModifyingPoints(false);
        setIsPathDeleteMode(false); // クリア時にモードを解除
        setIsPointDeleteMode(false); // クリア時にモードを解除
        saveToHistory(initialPaths, 0, drawMode, drawingType); // クリア後の状態を履歴に保存
    }, [drawMode, drawingType, saveToHistory, canvasWidth, canvasHeight]);

    // 新しいパスを開始
    const startNewPath = useCallback(() => {
        setPaths(prevPaths => {
            const currentPath = prevPaths[currentPathIndex];
            // 現在のパスに既に点が描画されている場合のみ新しいパスを追加
            if (currentPath && currentPath.points.length > 0) {
                const newPath = { points: [], mode: drawMode, type: drawingType };
                const updatedPaths = [...prevPaths, newPath];
                const newPathIdx = updatedPaths.length - 1; 
                setCurrentPathIndex(newPathIdx);
                setIsModifyingPoints(false);
                setIsPathDeleteMode(false); // 新しいパス開始時にモードを解除
                setIsPointDeleteMode(false); // 新しいパス開始時にモードを解除
                saveToHistory(updatedPaths, newPathIdx, drawMode, drawingType);
                return updatedPaths;
            } else if (currentPath && currentPath.points.length === 0) {
                // 現在のパスが空の場合は、そのパスのモードとタイプを更新して履歴に保存
                const updatedPaths = [...prevPaths];
                // 変更がない場合は履歴に保存しない
                if (updatedPaths[currentPathIndex].mode === drawMode && updatedPaths[currentPathIndex].type === drawingType) {
                    return prevPaths;
                }
                updatedPaths[currentPathIndex] = { points: [], mode: drawMode, type: drawingType };
                saveToHistory(updatedPaths, currentPathIndex, drawMode, drawingType);
                return updatedPaths;
            }
            // まだパスが一つもない場合（初回起動時など）
            const initialPaths = [{ points: [], mode: drawMode, type: drawingType }];
            saveToHistory(initialPaths, 0, drawMode, drawingType);
            return initialPaths;
        });
    }, [paths, currentPathIndex, drawMode, drawingType, saveToHistory]);


    // 元に戻す (Undo)
    const handleUndo = useCallback(() => {
        console.log("handleUndo called. historyIndex:", historyIndex, "history.length:", history.length);
        if (historyIndex > 0) {
            const prevIndex = historyIndex - 1;
            const prevState = history[prevIndex];
            console.log("Attempting to access prevIndex:", prevIndex, "history[prevIndex]:", prevState);

            // prevStateが存在し、かつそのpathsプロパティが配列であることを確認
            if (prevState && Array.isArray(prevState.paths)) { 
                setPaths(prevState.paths);
                setCurrentPathIndex(prevState.currentPathIndex);
                setDrawMode(prevState.drawMode);
                setDrawingType(prevState.drawingType);
                setHistoryIndex(prevIndex);
                setIsModifyingPoints(false);
                setIsPathDeleteMode(false); // Undo時にモードを解除
                setIsPointDeleteMode(false); // Undo時にモードを解除
            } else {
                console.error("Undo failed: Previous state is invalid or missing.", { historyIndex, prevIndex, historySnapshot: history });
            }
        } else {
            console.log("Undo not possible: historyIndex is 0.");
        }
    }, [history, historyIndex]);

    // SVGパスを生成
    const generateSvgPaths = useCallback(() => {
        let strokePathData = '';
        let fillPathData = '';

        paths.forEach((pathObj) => {
            if (!pathObj || !Array.isArray(pathObj.points)) return;

            const pathPoints = pathObj.points;
            const pathMode = pathObj.mode;
            const pathType = pathObj.type; // パスのタイプを取得

            if (pathPoints.length < 2) return;

            if (pathMode === 'stroke') {
                let currentStrokeSegment = `M ${pathPoints[0].x},${pathPoints[0].y}`;
                if (pathType === 'spline') { // スプラインのSVG生成
                    for (let i = 0; i < pathPoints.length - 1; i++) {
                        const p0 = (i === 0) ? pathPoints[0] : pathPoints[i - 1];
                        const p1 = pathPoints[i];
                        const p2 = pathPoints[i + 1];
                        const p3 = (i + 2 >= pathPoints.length) ? pathPoints[pathPoints.length - 1] : pathPoints[i + 2];

                        for (let t = 0; t <= segmentsPerCurve; t++) {
                            const step = t / segmentsPerCurve;
                            const x = getCatmullRomPt(p0.x, p1.x, p2.x, p3.x, step);
                            const y = getCatmullRomPt(p0.y, p1.y, p2.y, p3.y, step);
                            currentStrokeSegment += ` L ${x},${y}`;
                        }
                    }
                } else { // 直線のSVG生成
                    for (let i = 1; i < pathPoints.length; i++) {
                        currentStrokeSegment += ` L ${pathPoints[i].x},${pathPoints[i].y}`;
                    }
                }
                strokePathData += currentStrokeSegment;
            }

            if (pathMode === 'fill' && pathPoints.length >= 3) {
                let currentFillSegment = `M ${pathPoints[0].x},${pathPoints[0].y}`;
                if (pathType === 'spline') { // スプラインのSVG生成
                    for (let i = 0; i < pathPoints.length - 1; i++) {
                        const p0 = (i === 0) ? pathPoints[0] : pathPoints[i - 1];
                        const p1 = pathPoints[i];
                        const p2 = pathPoints[i + 1];
                        const p3 = (i + 2 >= pathPoints.length) ? pathPoints[pathPoints.length - 1] : pathPoints[i + 2];

                        for (let t = 0; t <= segmentsPerCurve; t++) {
                            const step = t / segmentsPerCurve;
                            const x = getCatmullRomPt(p0.x, p1.x, p2.x, p3.x, step);
                            const y = getCatmullRomPt(p0.y, p1.y, p2.y, p3.y, step);
                            currentFillSegment += ` L ${x},${y}`;
                        }
                    }
                } else { // 直線のSVG生成
                    for (let i = 1; i < pathPoints.length; i++) {
                        currentFillSegment += ` L ${pathPoints[i].x},${pathPoints[i].y}`;
                    }
                }
                currentFillSegment += ` Z`; // パスを閉じる
                fillPathData += currentFillSegment;
            }
        });

        return { strokePathData, fillPathData };
    }, [paths, segmentsPerCurve]);

    // SVGとしてダウンロード
    const downloadSvg = useCallback(() => {
        const totalPoints = paths.reduce((acc, pathObj) => acc + (pathObj?.points?.length || 0), 0);
        if (totalPoints < 2) {
            console.warn("SVGを生成するには少なくとも2点が必要です。");
            return;
        }

        const { strokePathData, fillPathData } = generateSvgPaths();

        // SVGのviewBoxは無限キャンバスの原点を考慮しない絶対座標で出力
        // ここでは、単純に現在のキャンバスサイズに合わせる
        const svgContent = `
<svg width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}" xmlns="http://www.w3.org/2000/svg">
    ${fillPathData ? `<path d="${fillPathData}" fill="${colors.fillArea}" stroke="${colors.fillBorder}" stroke-width="${lineWidths.fillBorder}"/>` : ''}
    ${strokePathData ? `<path d="${strokePathData}" stroke="${colors.strokeLine}" stroke-width="${lineWidths.strokeLine}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` : ''}
</svg>
        `;

        const blob = new Blob([svgContent], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'spline_paths.svg';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [paths, canvasWidth, canvasHeight, generateSvgPaths, colors, lineWidths]);

    // 初期描画（またはpaths変更時）にスプラインを描画
    useEffect(() => {
        drawSpline();
    }, [paths, drawSpline]);

    // キャンバスのサイズを画面サイズに合わせる
    useEffect(() => {
        const handleResize = () => {
            const newWidth = window.innerWidth;
            const newHeight = window.innerHeight;
            
            setCanvasWidth(newWidth);
            setCanvasHeight(newHeight);
            
            // 初期表示時は原点を中央に配置
            // offsetXとoffsetYが初期値(0)の場合のみ設定
            if (offsetX === 0 && offsetY === 0) {
                setOffsetX(newWidth / 2);
                setOffsetY(newHeight / 2);
            }
        };

        window.addEventListener('resize', handleResize);
        handleResize(); // 初回ロード時に実行
        return () => window.removeEventListener('resize', handleResize);
    }, [offsetX, offsetY]); // offsetX, offsetYが初期値でない場合はリサイズ時に中央に移動しない

    // 描画モード (チューブ/土台) を設定
    const handleSetDrawMode = useCallback((mode) => {
        setDrawMode(mode);
        // 土台モードに切り替えたら、描画タイプ選択モーダルを表示
        if (mode === 'fill') {
            setShowFillDrawingTypeModal(true);
        } else {
            // チューブモードの場合はモーダルを閉じ、描画タイプをデフォルトのスプラインに戻す
            setShowFillDrawingTypeModal(false);
            setDrawingType('spline'); // チューブは常にスプライン描画として扱う
        }

        setPaths(prevPaths => {
            const newPaths = [...prevPaths];
            // 現在のパスが空の場合のみモードを更新して履歴に保存。
            // 既に点が打たれている場合は、モード切り替えは無効（ボタンがdisabledになるためここには来ないはずだが念のため）
            if (newPaths[currentPathIndex] && newPaths[currentPathIndex].points.length === 0) {
                 newPaths[currentPathIndex] = { ...newPaths[currentPathIndex], mode: mode, type: (mode === 'stroke' ? 'spline' : drawingType) };
                 saveToHistory(newPaths, currentPathIndex, mode, (mode === 'stroke' ? 'spline' : drawingType));
            }
            return newPaths;
        });
    }, [currentPathIndex, drawingType, saveToHistory]);

    // 描画タイプ (スプライン/直線) を設定
    const handleSetDrawingType = useCallback((type) => {
        setDrawingType(type);
        // 描画タイプを選択したらモーダルを閉じる
        setShowFillDrawingTypeModal(false);

        setPaths(prevPaths => {
            const newPaths = [...prevPaths];
            // 新しいパスまたは現在の空パスのタイプを更新
            if (!newPaths[currentPathIndex] || newPaths[currentPathIndex].points.length === 0) {
                newPaths[currentPathIndex] = { points: [], mode: drawMode, type: type };
            } else {
                // 既存のパスに点を追加中の場合、そのパスのタイプを更新
                newPaths[currentPathIndex] = { ...newPaths[currentPathIndex], type: type };
            }
            saveToHistory(newPaths, currentPathIndex, drawMode, type);
            return newPaths;
        });
    }, [currentPathIndex, drawMode, saveToHistory]);


    // 描画モードボタンの無効化条件
    // 点修正モード中、パス削除モード中、点削除モード中、または現在のパスに点が一つでも存在する場合は無効化
    const areDrawModeButtonsDisabled = isModifyingPoints || isPathDeleteMode || isPointDeleteMode || (paths[currentPathIndex] && paths[currentPathIndex].points.length > 0);

    // マウスイベントハンドラー
    const handleWheel = useCallback((e) => {
        e.preventDefault();
        const scaleAmount = 0.1;
        const rect = e.target.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        let newScale = scale;
        if (e.deltaY < 0) { // スクロールアップ (拡大)
            newScale = scale * (1 + scaleAmount);
        } else { // スクロールダウン (縮小)
            newScale = scale / (1 + scaleAmount);
        }

        newScale = Math.max(0.1, Math.min(newScale, 10)); // 最小0.1倍、最大10倍に制限

        // ズームの中心をマウスカーソルに合わせる
        setOffsetX(mouseX - (mouseX - offsetX) * (newScale / scale));
        setOffsetY(mouseY - (mouseY - offsetY) * (newScale / scale));
        setScale(newScale);
    }, [scale, offsetX, offsetY]);

    const handleMouseDown = useCallback((e) => {
        e.preventDefault();
        didDragRef.current = false; // ドラッグ開始時にリセット

        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        // キャンバス座標をコンテンツ座標に変換
        const mouseContentX = (e.clientX - rect.left - offsetX) / scale;
        const mouseContentY = (e.clientY - rect.top - offsetY) / scale;

        if (e.button === 2) { // 右クリック (パン操作)
            setIsPanning(true);
            setLastPanX(e.clientX);
            setLastPanY(e.clientY);
        } else if (e.button === 0) { // 左クリック
            if (isModifyingPoints) {
                let pointFound = false;
                // 全てのパスの点をチェック
                for (let pathIdx = 0; pathIdx < paths.length; pathIdx++) {
                    if (!paths[pathIdx] || !Array.isArray(paths[pathIdx].points)) continue;
                    for (let ptIdx = 0; ptIdx < paths[pathIdx].points.length; ptIdx++) {
                        const p = paths[pathIdx].points[ptIdx];
                        const distance = Math.sqrt(
                            Math.pow(mouseContentX - p.x, 2) + Math.pow(mouseContentY - p.y, 2)
                        );
                        // 点のヒット判定
                        if (distance < POINT_HIT_RADIUS / scale) {
                            setActivePoint({ pathIndex: pathIdx, pointIndex: ptIdx }); // アクティブな点を設定
                            pointFound = true;
                            break;
                        }
                    }
                    if (pointFound) break;
                }
            } else if (isPathDeleteMode) { // パス削除モード
                let pathToDeleteIdx = -1;
                // 削除モード：パスの点をクリックしたらそのパス全体を削除
                for (let pathIdx = 0; pathIdx < paths.length; pathIdx++) {
                    if (!paths[pathIdx] || !Array.isArray(paths[pathIdx].points)) continue;
                    for (let ptIdx = 0; ptIdx < paths[pathIdx].points.length; ptIdx++) {
                        const p = paths[pathIdx].points[ptIdx];
                        const distance = Math.sqrt(
                            Math.pow(mouseContentX - p.x, 2) + Math.pow(mouseContentY - p.y, 2)
                        );
                        // 点のヒット判定
                        if (distance < POINT_HIT_RADIUS / scale) {
                            pathToDeleteIdx = pathIdx;
                            break;
                        }
                    }
                    if (pathToDeleteIdx !== -1) break;
                }

                if (pathToDeleteIdx !== -1) {
                    setPaths(prevPaths => {
                        const newPaths = prevPaths.filter((_, index) => index !== pathToDeleteIdx);
                        let nextCurrentPathIndex;

                        if (newPaths.length === 0) {
                            // 全てのパスが削除された場合、新しい空のパスを追加
                            newPaths.push({ points: [], mode: drawMode, type: drawingType });
                            nextCurrentPathIndex = 0;
                        } else {
                            // 削除されたパスが現在のパスより前にある場合
                            if (pathToDeleteIdx < currentPathIndex) {
                                nextCurrentPathIndex = currentPathIndex - 1;
                            } else if (pathToDeleteIdx === currentPathIndex) {
                                // 現在のパス自体が削除された場合、新しいパスの最後のパスに移動
                                nextCurrentPathIndex = newPaths.length - 1;
                            } else { // 削除されたパスが現在のパスより後ろにある場合
                                nextCurrentPathIndex = currentPathIndex;
                            }
                            // インデックスが負にならないように調整
                            nextCurrentPathIndex = Math.max(0, nextCurrentPathIndex);
                        }
                        
                        // 計算された新しい currentPathIndex で状態を更新し、履歴に保存
                        setCurrentPathIndex(nextCurrentPathIndex);
                        saveToHistory(newPaths, nextCurrentPathIndex, drawMode, drawingType);
                        return newPaths;
                    });
                }
            } else if (isPointDeleteMode) { // 点削除モード
                let pointToDelete = null;
                for (let pathIdx = 0; pathIdx < paths.length; pathIdx++) {
                    if (!paths[pathIdx] || !Array.isArray(paths[pathIdx].points)) continue;
                    for (let ptIdx = 0; ptIdx < paths[pathIdx].points.length; ptIdx++) {
                        const p = paths[pathIdx].points[ptIdx];
                        const distance = Math.sqrt(
                            Math.pow(mouseContentX - p.x, 2) + Math.pow(mouseContentY - p.y, 2)
                        );
                        if (distance < POINT_HIT_RADIUS / scale) {
                            pointToDelete = { pathIndex: pathIdx, pointIndex: ptIdx };
                            break;
                        }
                    }
                    if (pointToDelete) break;
                }

                if (pointToDelete) {
                    setPaths(prevPaths => {
                        const newPaths = [...prevPaths];
                        const { pathIndex, pointIndex } = pointToDelete;
                        
                        // 点を削除
                        const updatedPoints = newPaths[pathIndex].points.filter((_, idx) => idx !== pointIndex);
                        
                        let nextCurrentPathIndex = currentPathIndex;

                        if (updatedPoints.length === 0) {
                            // 点が全て削除されパスが空になった場合、そのパスを削除
                            const filteredPaths = newPaths.filter((_, idx) => idx !== pathIndex);
                            if (filteredPaths.length === 0) {
                                filteredPaths.push({ points: [], mode: drawMode, type: drawingType });
                                nextCurrentPathIndex = 0;
                            } else {
                                // 削除されたパスが現在のパスより前にある場合
                                if (pathIndex < currentPathIndex) {
                                    nextCurrentPathIndex = currentPathIndex - 1;
                                } else if (pathIndex === currentPathIndex) {
                                    // 現在のパス自体が削除された場合、新しいパスの最後のパスに移動
                                    nextCurrentPathIndex = filteredPaths.length - 1;
                                } else { // 削除されたパスが現在のパスより後ろにある場合
                                    nextCurrentPathIndex = currentPathIndex;
                                }
                                nextCurrentPathIndex = Math.max(0, nextCurrentPathIndex);
                            }
                            setCurrentPathIndex(nextCurrentPathIndex);
                            saveToHistory(filteredPaths, nextCurrentPathIndex, drawMode, drawingType);
                            return filteredPaths;
                        } else {
                            // 点を削除したパスを更新
                            newPaths[pathIndex] = { ...newPaths[pathIndex], points: updatedPoints };
                            saveToHistory(newPaths, currentPathIndex, drawMode, drawingType);
                            return newPaths;
                        }
                    });
                }
            }
        }
    }, [offsetX, offsetY, scale, paths, isModifyingPoints, isPathDeleteMode, isPointDeleteMode, currentPathIndex, drawMode, drawingType, saveToHistory]);

    const handleMouseMove = useCallback((e) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();

        if (isPanning) { // パン操作中
            const dx = e.clientX - lastPanX;
            const dy = e.clientY - lastPanY;
            setOffsetX(prev => prev + dx);
            setOffsetY(prev => prev + dy);
            setLastPanX(e.clientX);
            setLastPanY(e.clientY);
            didDragRef.current = true; // ドラッグが行われたとマーク
        } else if (activePoint !== null) { // 点のドラッグ中
            const newRawClientX = e.clientX - rect.left;
            const newRawClientY = e.clientY - rect.top;

            let newPointX = (newRawClientX - offsetX) / scale;
            let newPointY = (newRawClientY - offsetY) / scale;

            // 点の移動は mouseUp でまとめて履歴に保存するため、ここでは直接pathsを更新しない
            setPaths(prevPaths => { // prevPathsを使用するように修正
                const newPaths = [...prevPaths];
                const { pathIndex, pointIndex } = activePoint;
                if (newPaths[pathIndex] && newPaths[pathIndex].points[pointIndex]) {
                    const updatedPoints = [...newPaths[pathIndex].points];
                    updatedPoints[pointIndex] = { x: newPointX, y: newPointY };
                    newPaths[pathIndex] = { ...newPaths[pathIndex], points: updatedPoints };
                }
                return newPaths;
            });
            didDragRef.current = true;
        }
    }, [isPanning, lastPanX, lastPanY, activePoint, offsetX, offsetY, scale]);

    const handleMouseUp = useCallback(() => {
        // 点をドラッグした場合は履歴に保存
        if (activePoint !== null && didDragRef.current) {
            // mouseMoveでpathsが更新されているため、ここではpathsの最新状態をそのまま渡す
            saveToHistory(paths, currentPathIndex, drawMode, drawingType); 
        }
        setIsPanning(false);
        setActivePoint(null); // アクティブな点をリセット
    }, [activePoint, paths, currentPathIndex, drawMode, drawingType, saveToHistory]);

    const handleMouseLeave = useCallback(() => {
        setIsPanning(false);
        setActivePoint(null);
    }, []);

    // ビューをリセット（ズームとパンを初期値に戻す）
    const resetView = useCallback(() => {
        setScale(1);
        setOffsetX(canvasWidth / 2); // 原点(0,0)を画面中央に表示
        setOffsetY(canvasHeight / 2);
    }, [canvasWidth, canvasHeight]);

    const handleMouseClick = useCallback((e) => {
        // 右クリック、パン中、ドラッグ中、修正モード、パス削除モード、点削除モード、または土台モードで描画タイプ選択モーダルが表示されている場合は処理しない
        if (e.button !== 0 || isPanning || didDragRef.current || isModifyingPoints || isPathDeleteMode || isPointDeleteMode || (drawMode === 'fill' && showFillDrawingTypeModal)) {
            return;
        }

        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const rawClientX = e.clientX - rect.left;
        const rawClientY = e.clientY - rect.top;
        // キャンバス座標をコンテンツ座標に変換
        const contentX = (rawClientX - offsetX) / scale;
        const contentY = (rawClientY - offsetY) / scale;

        setPaths((prevPaths) => {
            const newPaths = [...prevPaths];
            let targetPath = newPaths[currentPathIndex];

            // 現在のパスが存在しない、または空である場合、またはモード/タイプが現在の設定と異なる場合、初期化/再初期化する
            if (!targetPath || targetPath.points.length === 0 || targetPath.mode !== drawMode || targetPath.type !== drawingType) {
                newPaths[currentPathIndex] = { points: [], mode: drawMode, type: drawingType };
                targetPath = newPaths[currentPathIndex]; // 再代入して最新のパスを参照
            }

            // 新しい点を追加
            targetPath.points = [...targetPath.points, { x: contentX, y: contentY }];
            
            // 点追加後の状態を履歴に保存
            saveToHistory(newPaths, currentPathIndex, drawMode, drawingType); 
            return newPaths;
        });
    }, [currentPathIndex, drawMode, drawingType, offsetX, offsetY, scale, isPanning, isModifyingPoints, isPathDeleteMode, isPointDeleteMode, paths, saveToHistory, showFillDrawingTypeModal]); 

    // 点修正モードの切り替え
    const toggleModifyMode = useCallback(() => {
        setIsModifyingPoints(prev => !prev);
        setActivePoint(null); // アクティブな点をクリア
        setIsPathDeleteMode(false); // パス削除モードを無効化
        setIsPointDeleteMode(false); // 点削除モードを無効化
    }, []);

    // パス削除モードの切り替え
    const togglePathDeleteMode = useCallback(() => {
        setIsPathDeleteMode(prev => !prev);
        setActivePoint(null); // アクティブな点をクリア
        setIsModifyingPoints(false); // 点修正モードを無効化
        setIsPointDeleteMode(false); // 点削除モードを無効化
    }, []);

    // 点削除モードの切り替え
    const togglePointDeleteMode = useCallback(() => {
        setIsPointDeleteMode(prev => !prev);
        setActivePoint(null); // アクティブな点をクリア
        setIsModifyingPoints(false); // 点修正モードを無効化
        setIsPathDeleteMode(false); // パス削除モードを無効化
    }, []);

    // 背景画像ファイルのアップロード
    const handleImageUpload = useCallback((event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setBackgroundImage(reader.result);
            };
            reader.readAsDataURL(file);
        }
    }, []);

    // 背景画像をクリア
    const clearBackgroundImage = useCallback(() => {
        setBackgroundImage(null);
    }, []);

    // カーソルクラスを決定
    const getCursorClass = () => {
        if (isPanning) return 'cursor-pan';
        if (isModifyingPoints) return 'cursor-modify';
        if (isPathDeleteMode || isPointDeleteMode) return 'cursor-delete';
        return 'cursor-draw';
    };

    return (
        <div className="app-container">
            {/* メインキャンバスエリア */}
            <div className="canvas-area">
                <canvas
                    ref={canvasRef}
                    width={canvasWidth}
                    height={canvasHeight}
                    className={`main-canvas ${getCursorClass()}`}
                    onClick={handleMouseClick}
                    onWheel={handleWheel}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onContextMenu={(e) => e.preventDefault()} // 右クリックメニューを無効化
                    onMouseLeave={handleMouseLeave}
                />
            </div>

            {/* サイドバー - オーバーレイ */}
            {sidebarVisible && (
                <div className="neon-sidebar">
                    <div className="neon-header">
                        <h1 className="neon-sidebar-title">
                            下絵描画
                        </h1>
                        {/* ガイドボタン */}
                        <button
                            onClick={() => setShowGuideModal(true)}
                            className={`neon-guide-button ${isGuideEffectStopped ? 'stopped' : ''}`}
                        >
                        </button>
                    </div>

                    {/* サイドバー非表示ボタン */}
                    <button 
                        onClick={() => setSidebarVisible(false)}
                        className="neon-sidebar-hide-button"
                        aria-label="サイドバー非表示"
                    >
                        ▲
                    </button>

                    {/* 描画ツール */}
                    <div className="draw-mode-title">描画ツール</div>
                    
                    {/* チューブ・土台ボタン */}
                    <div className="draw-mode-buttons">
                        <button
                            onClick={() => handleSetDrawMode('stroke')}
                            disabled={areDrawModeButtonsDisabled}
                            className={`draw-mode-button ${
                                areDrawModeButtonsDisabled
                                        ? 'button-disabled'
                                        : drawMode === 'stroke' 
                                            ? 'button-active button-blue' 
                                            : 'button-secondary'
                            }`}
                        >
                            チューブ
                        </button>
                        <button
                            onClick={() => handleSetDrawMode('fill')}
                            disabled={areDrawModeButtonsDisabled}
                            className={`draw-mode-button ${
                                areDrawModeButtonsDisabled
                                        ? 'button-disabled'
                                        : drawMode === 'fill' 
                                            ? 'button-active button-green' 
                                            : 'button-secondary'
                            }`}
                        >
                            土台
                        </button>
                    </div>

                    {/* 新しいパス */}
                    <button
                        onClick={startNewPath}
                        className="new-path-button"
                    >
                        新しいパス
                    </button>

                    {/* 背景画像を追加 */}
                    <button
                        onClick={() => setShowBgModal(true)}
                        className="settings-button"
                    >
                        背景画像を追加
                    </button>

                    {/* 修正ツール */}
                    <div className="draw-mode-title">修正ツール</div>
                    
                    {/* ←戻る・点修正・進む→ */}
                    <div className="edit-mode-buttons">
                        <button
                            onClick={handleUndo}
                            disabled={historyIndex === 0}
                            className={`edit-mode-button ${
                                historyIndex === 0 ? 'button-disabled' : 'button-secondary'
                            }`}
                        >
                            ←戻る
                        </button>
                        <button
                            onClick={toggleModifyMode}
                            className={`edit-mode-button ${
                                isModifyingPoints
                                        ? 'button-active button-yellow' 
                                        : 'button-secondary'
                            }`}
                        >
                            点修正
                        </button>
                        <button
                            onClick={handleRedo}
                            disabled={historyIndex === history.length - 1}
                            className={`edit-mode-button ${
                                historyIndex === history.length - 1 ? 'button-disabled' : 'button-secondary'
                            }`}
                        >
                            進む→
                        </button>
                    </div>

                    {/* 点削除・パス削除 */}
                    <div className="delete-buttons">
                        <button
                            onClick={togglePointDeleteMode}
                            className={`delete-button ${
                                isPointDeleteMode
                                        ? 'button-active button-red' 
                                        : 'button-secondary'
                            }`}
                        >
                            点削除
                        </button>
                        <button
                            onClick={togglePathDeleteMode}
                            className={`delete-button ${
                                isPathDeleteMode
                                        ? 'button-active button-red' 
                                        : 'button-secondary'
                            }`}
                        >
                            パス削除
                        </button>
                    </div>

                    {/* グリッド表示・背景色 */}
                    <div className="grid-bg-controls">
                        <div className="grid-toggle-container">
                            <label className="grid-toggle-label">グリッド表示</label>
                            <button
                                onClick={() => setShowGrid(!showGrid)}
                                className={`grid-toggle-button ${showGrid ? 'on' : 'off'}`}
                            >
                                {showGrid ? 'ON' : 'OFF'}
                            </button>
                        </div>
                        <div className="background-controls">
                            <span className="background-label">背景色</span>
                            <div className="background-color-picker-wrapper">
                                <div 
                                    className="background-color-preview"
                                    style={{
                                        backgroundColor: colors.background
                                    }}
                                />
                                <input
                                    type="color"
                                    value={colors.background}
                                    onChange={(e) => handleBackgroundColorChange(e.target.value)}
                                    className="background-color-input"
                                />
                            </div>
                        </div>
                    </div>

                    {/* リセット操作 */}
                    <div className="draw-mode-title">リセット操作</div>
                    
                    <div className="reset-buttons-row">
                        {/* 視点リセットボタン */}
                        <button
                            onClick={resetView}
                            className="view-reset-button half-width"
                        >
                            視点リセット
                        </button>

                        {/* 全てクリアボタン */}
                        <button
                            onClick={() => {
                                if (window.confirm('すべての描画がクリアされます。本当に実行しますか？')) {
                                    clearCanvas();
                                }
                            }}
                            className="clear-button half-width"
                        >
                            全てクリア
                        </button>
                    </div>

                    {/* カスタマイズへ進む */}
                    <button
                        onClick={() => {
                            const { strokePathData, fillPathData } = generateSvgPaths();
                            const svgContent = `
<svg width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}" xmlns="http://www.w3.org/2000/svg">
    ${fillPathData ? `<path d="${fillPathData}" fill="${colors.fillArea}" stroke="${colors.fillBorder}" stroke-width="${lineWidths.fillBorder}"/>` : ''}
    ${strokePathData ? `<path d="${strokePathData}" stroke="${colors.strokeLine}" stroke-width="${lineWidths.strokeLine}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` : ''}
</svg>
                            `.trim();
                            
                            // SVGデータと一緒にカスタマイズイベントを発行
                            window.dispatchEvent(new CustomEvent('showCustomize', {
                                detail: {
                                    svgData: svgContent,
                                    paths: paths,
                                    colors: colors,
                                    lineWidths: lineWidths,
                                    canvasData: {
                                        scale: scale,
                                        offsetX: offsetX,
                                        offsetY: offsetY,
                                        segmentsPerCurve: segmentsPerCurve,
                                        canvasWidth: canvasWidth,
                                        canvasHeight: canvasHeight,
                                        gridSize: gridSize,
                                        gridOpacity: gridOpacity,
                                        showGrid: showGrid,
                                        gridColor: colors.grid // ネオン下絵のグリッド色も送信
                                    }
                                }
                            }));
                        }}
                        className="download-button"
                    >
                        カスタマイズへ進む
                    </button>
                </div>
            )}

            {/* サイドバー表示ボタン（サイドバーが非表示の時） */}
            {!sidebarVisible && (
                <button
                    onClick={() => setSidebarVisible(true)}
                    className="show-neon-sidebar-button"
                >
                    サイドバー表示
                </button>
            )}

            {/* モーダル群 */}
            {/* グリッド設定モーダル */}
            <Modal isOpen={showGridModal} onClose={() => setShowGridModal(false)} title="グリッド設定" position="right">
                <div className="modal-content-inner">
                    <div className="modal-setting-item">
                        <label className="modal-label">グリッド表示</label>
                        <button
                            onClick={() => setShowGrid(!showGrid)}
                            className={`toggle-button ${
                                showGrid ? 'toggle-active' : 'toggle-inactive'
                            }`}
                        >
                            {showGrid ? 'ON' : 'OFF'}
                        </button>
                    </div>
                    <div className="modal-setting-item">
                        <label htmlFor="gridOpacity" className="modal-label">
                            透明度: {(gridOpacity * 100).toFixed(0)}%
                        </label>
                        <input
                            id="gridOpacity"
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={gridOpacity}
                            onChange={(e) => setGridOpacity(Number(e.target.value))}
                            className="range-input"
                        />
                    </div>
                </div>
            </Modal>

            {/* 背景画像設定モーダル */}
            <Modal isOpen={showBgModal} onClose={() => setShowBgModal(false)} title="背景画像設定" position="right">
                <div className="modal-content-inner">
                    <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="file-input"
                    />
                    {loadedBackgroundImage && (
                        <>
                            <button
                                onClick={clearBackgroundImage}
                                className="clear-image-button"
                            >
                                画像をクリア
                            </button>
                            <div className="modal-setting-item">
                                <label htmlFor="bgImageX" className="modal-label">
                                    X位置: {bgImageX.toFixed(0)}px
                                </label>
                                <input
                                    id="bgImageX"
                                    type="range"
                                    min="-2000"
                                    max="2000"
                                    step="10"
                                    value={bgImageX}
                                    onChange={(e) => setBgImageX(Number(e.target.value))}
                                    className="range-input"
                                />
                            </div>
                            <div className="modal-setting-item">
                                <label htmlFor="bgImageY" className="modal-label">
                                    Y位置: {bgImageY.toFixed(0)}px
                                </label>
                                <input
                                    id="bgImageY"
                                    type="range"
                                    min="-2000"
                                    max="2000"
                                    step="10"
                                    value={bgImageY}
                                    onChange={(e) => setBgImageY(Number(e.target.value))}
                                    className="range-input"
                                />
                            </div>
                            <div className="modal-setting-item">
                                <label htmlFor="bgImageScale" className="modal-label">
                                    サイズ: {(bgImageScale * 100).toFixed(0)}%
                                </label>
                                <input
                                    id="bgImageScale"
                                    type="range"
                                    min="0.1"
                                    max="3.0"
                                    step="0.01"
                                    value={bgImageScale}
                                    onChange={(e) => setBgImageScale(Number(e.target.value))}
                                    className="range-input"
                                />
                            </div>
                            <div className="modal-setting-item">
                                <label htmlFor="bgImageOpacity" className="modal-label">
                                    透明度: {(bgImageOpacity * 100).toFixed(0)}%
                                </label>
                                <input
                                    id="bgImageOpacity"
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.01"
                                    value={bgImageOpacity}
                                    onChange={(e) => setBgImageOpacity(Number(e.target.value))}
                                    className="range-input"
                                />
                            </div>
                        </>
                    )}
                </div>
            </Modal>

            {/* 詳細設定モーダル */}
            <Modal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} title="詳細設定" position="right">
                <div className="modal-content-inner">
                    <div className="modal-setting-item">
                        <label htmlFor="segmentsPerCurve" className="modal-label">
                            曲線の滑らかさ: {segmentsPerCurve}
                        </label>
                        <input
                            id="segmentsPerCurve"
                            type="range"
                            min="5"
                            max="100"
                            step="1"
                            value={segmentsPerCurve}
                            onChange={(e) => setSegmentsPerCurve(Number(e.target.value))}
                            className="range-input"
                        />
                        <p className="setting-description">
                            値が小さいほどSVGファイルが軽くなります
                        </p>
                    </div>
                </div>
            </Modal>

            {/* 色・太さ設定モーダル */}
            <Modal isOpen={showColorModal} onClose={() => setShowColorModal(false)} title="色・太さ設定" position="right">
                <div className="modal-content-inner">
                    <div className="modal-setting-item">
                        <label htmlFor="bgColor" className="modal-label">背景色</label>
                        <input
                            id="bgColor"
                            type="color"
                            value={colors.background}
                            onChange={(e) => setColors(prev => ({ ...prev, background: e.target.value }))}
                            className="color-input"
                        />
                    </div>
                    <div className="modal-setting-item">
                        <label htmlFor="gridColor" className="modal-label">グリッドの色</label>
                        <input
                            id="gridColor"
                            type="color"
                            value={colors.grid}
                            onChange={(e) => setColors(prev => ({ ...prev, grid: e.target.value }))}
                            className="color-input"
                        />
                    </div>
                    <div className="modal-setting-item">
                        <label htmlFor="strokePointColor" className="modal-label">チューブの点の色</label>
                        <input
                            id="strokePointColor"
                            type="color"
                            value={colors.strokePoint}
                            onChange={(e) => setColors(prev => ({ ...prev, strokePoint: e.target.value }))}
                            className="color-input"
                        />
                    </div>
                    <div className="modal-setting-item">
                        <label htmlFor="strokeLineColor" className="modal-label">チューブの線の色</label>
                        <input
                            id="strokeLineColor"
                            type="color"
                            value={colors.strokeLine}
                            onChange={(e) => setColors(prev => ({ ...prev, strokeLine: e.target.value }))}
                            className="color-input"
                        />
                    </div>
                    <div className="modal-setting-item">
                        <label htmlFor="strokeLineWidth" className="modal-label">
                            チューブの線の太さ: {lineWidths.strokeLine}px
                        </label>
                        <input
                            id="strokeLineWidth"
                            type="range"
                            min="1"
                            max="20"
                            step="0.5"
                            value={lineWidths.strokeLine}
                            onChange={(e) => setLineWidths(prev => ({ ...prev, strokeLine: Number(e.target.value) }))}
                            className="range-input"
                        />
                    </div>
                    <div className="modal-setting-item">
                        <label htmlFor="fillPointColor" className="modal-label">土台の点の色</label>
                        <input
                            id="fillPointColor"
                            type="color"
                            value={colors.fillPoint}
                            onChange={(e) => setColors(prev => ({ ...prev, fillPoint: e.target.value }))}
                            className="color-input"
                        />
                    </div>
                    <div className="modal-setting-item">
                        <label htmlFor="fillAreaColor" className="modal-label">土台の中身の色</label>
                        <input
                            id="fillAreaColor"
                            type="color"
                            value={rgbaToHex(colors.fillArea)}
                            onChange={(e) => setColors(prev => ({ ...prev, fillArea: hexToRgba(e.target.value, 0.5) }))}
                            className="color-input"
                        />
                        <p className="setting-description">自動的に50%透明度が適用されます</p>
                    </div>
                    <div className="modal-setting-item">
                        <label htmlFor="fillBorderColor" className="modal-label">土台の境界線の色</label>
                        <input
                            id="fillBorderColor"
                            type="color"
                            value={colors.fillBorder}
                            onChange={(e) => setColors(prev => ({ ...prev, fillBorder: e.target.value }))}
                            className="color-input"
                        />
                    </div>
                    <div className="modal-setting-item">
                        <label htmlFor="fillBorderWidth" className="modal-label">
                            土台の境界線の太さ: {lineWidths.fillBorder}px
                        </label>
                        <input
                            id="fillBorderWidth"
                            type="range"
                            min="0.5"
                            max="20"
                            step="0.5"
                            value={lineWidths.fillBorder}
                            onChange={(e) => setLineWidths(prev => ({ ...prev, fillBorder: Number(e.target.value) }))}
                            className="range-input"
                        />
                    </div>
                    <button
                        onClick={() => {
                            setColors({
                                strokePoint: '#00ffff',
                                strokeLine: '#ffff00',
                                fillPoint: '#000000',
                                fillArea: 'rgba(110, 110, 110, 0.5)',
                                fillBorder: '#000000',
                                background: '#303030',
                                grid: '#000000'
                            });
                            setLineWidths({
                                strokeLine: 4,
                                fillBorder: 3
                            });
                        }}
                        className="reset-colors-button"
                    >
                        デフォルトに戻す
                    </button>
                </div>
            </Modal>

            {/* 土台モード時の描画タイプ選択モーダル */}
            <Modal isOpen={showFillDrawingTypeModal} onClose={() => setShowFillDrawingTypeModal(false)} title="土台の描画タイプを選択" position="center">
                <p className="drawing-type-description">土台の描画方法を選択してください。</p>
                <div className="drawing-type-buttons">
                    <button
                        onClick={() => handleSetDrawingType('spline')}
                        className={`drawing-type-button ${
                            drawingType === 'spline' 
                                ? 'button-active button-purple' 
                                : 'button-secondary'
                        }`}
                    >
                        スプライン
                    </button>
                    <button
                        onClick={() => handleSetDrawingType('straight')}
                        className={`drawing-type-button ${
                            drawingType === 'straight' 
                                ? 'button-active button-purple' 
                                : 'button-secondary'
                        }`}
                    >
                        直線
                    </button>
                </div>
            </Modal>

            {/* ガイドモーダル */}
            {showGuideModal && (
                <div className="neon-guide-modal-overlay">
                    <div className="neon-guide-modal-content">
                        <div className="neon-guide-modal-inner">
                            <h2>下絵描画ガイド</h2>
                            <div className="guide-notice-section">
                                <div className="guide-section-title">
                                    <div className="guide-section-icon">1</div>
                                    描画モードの選択
                                </div>
                                <p>
                                    「チューブ」モードではネオンチューブの線を描画し、「土台」モードではベースプレートの形状を描画できます。描画タイプは「スプライン」で滑らかな曲線、「直線」で角ばった線が描けます。
                                </p>
                            </div>
                            <div className="guide-notice-section">
                                <div className="guide-section-title">
                                    <div className="guide-section-icon">2</div>
                                    基本操作
                                </div>
                                <p>
                                    左クリックで点を追加、右クリック+ドラッグでビューを移動、マウスホイールでズームができます。「編集」モードで点をドラッグして移動、「削除」モードで点や線を削除できます。
                                </p>
                            </div>
                            <div className="guide-notice-section">
                                <div className="guide-section-title">
                                    <div className="guide-section-icon">3</div>
                                    新しいパスの作成
                                </div>
                                <p>
                                    「新しいパス」ボタンで別の線や形状を開始できます。複数のパスを組み合わせて複雑なネオンサインのデザインを作成しましょう。
                                </p>
                            </div>
                            <div className="guide-notice-section">
                                <div className="guide-section-title">
                                    <div className="guide-section-icon">4</div>
                                    設定とカスタマイズ
                                </div>
                                <p>
                                    色設定で線や背景の色を変更、背景画像を読み込んでトレース、グリッド表示で正確な描画ができます。完成したら「SVGダウンロード」でファイルを保存できます。
                                </p>
                            </div>
                            <button 
                                onClick={() => {
                                    setShowGuideModal(false);
                                    setIsGuideEffectStopped(true);
                                }} 
                                className="neon-guide-modal-close-button"
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

export default NeonDrawingApp;