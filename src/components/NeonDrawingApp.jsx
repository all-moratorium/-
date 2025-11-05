import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import './NeonDrawingApp.css';
import { calculateSvgSizeCm, calculateTotalLength, scalePathsToSize } from '../utils/sizeCalculations';
import NeonDrawingGuideModal from './NeonDrawingGuideModal.jsx';

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

const POINT_HIT_RADIUS = 12; // 点のヒット判定半径
const MIN_HIT_RADIUS = 6; // 最小ヒット判定半径（ズーム時の保証）

// モーダルコンポーネント
const Modal = ({ isOpen, onClose, title, children, position = 'center', className = '', showCloseButton = false }) => {
    if (!isOpen) return null;

    const modalClass = position === 'right'
        ? `modal-overlay ${className}`.trim()
        : `modal-overlay modal-center ${className}`.trim();

    const contentClass = position === 'right'
        ? "modal-content modal-content-right"
        : "modal-content modal-content-center";

    return createPortal(
        <div className={modalClass}>
            <div className={contentClass}>
                <div className="modal-header">
                    <h3 className="modal-title">{title}</h3>
                    {onClose && (
                        <button
                            onClick={onClose}
                            className={showCloseButton ? "modal-close-btn" : "modal-apply-btn"}
                        >
                            {showCloseButton ? "×" : "適用"}
                        </button>
                    )}
                </div>
                {children}
            </div>
        </div>,
        document.body
    );
};

// 安全なLocalStorage読み込み関数
const safeGetFromLocalStorage = (key, fallback = null) => {
    try {
        const item = sessionStorage.getItem(key);
        return item ? JSON.parse(item) : fallback;
    } catch (error) {
        console.error(`LocalStorage読み込みエラー (${key}):`, error);
        return fallback;
    }
};

// 座標制限関数（3m×3m = 原点から1.5m四方制限）
const limitCoordinates = (x, y) => {
    const HALF_SIZE = 3750; // 1.5m = 3750px (100px = 4cm基準)
    
    return {
        x: Math.round(Math.max(-HALF_SIZE, Math.min(HALF_SIZE, x)) * 10) / 10,
        y: Math.round(Math.max(-HALF_SIZE, Math.min(HALF_SIZE, y)) * 10) / 10
    };
};

// 包括的な初期状態取得関数
const getInitialDrawingState = (initialState) => {
    const savedData = safeGetFromLocalStorage('neonDrawingData');
    
    // 優先順位: initialState > LocalStorage > デフォルト値
    const getStateValue = (key, defaultValue) => {
        if (initialState && initialState[key] !== undefined) {
            return initialState[key];
        }
        if (savedData && savedData[key] !== undefined) {
            return savedData[key];
        }
        return defaultValue;
    };
    
    const defaultColors = {
        strokePoint: '#ffffff',
        strokeLine: '#ffffff',
        fillPoint: '#34d399',
        fillArea: 'rgba(110, 110, 110, 0.5)',
        fillBorder: '#000000',
        background: '#191919',
        grid: '#000000'
    };
    
    const defaultLineWidths = {
        strokeLine: 4,
        fillBorder: 3
    };
    
    const defaultPaths = [{ points: [], mode: 'stroke', type: 'spline' }];
    
    return {
        drawMode: getStateValue('drawMode', 'stroke'),
        drawingType: getStateValue('drawingType', 'spline'),
        paths: getStateValue('paths', defaultPaths),
        currentPathIndex: getStateValue('currentPathIndex', 0),
        scale: getStateValue('scale', 1),
        offsetX: getStateValue('offsetX', 0),
        offsetY: getStateValue('offsetY', 0),
        backgroundImage: getStateValue('backgroundImage', null),
        initialBgImageWidth: getStateValue('initialBgImageWidth', 0),
        initialBgImageHeight: getStateValue('initialBgImageHeight', 0),
        bgImageScale: getStateValue('bgImageScale', 1.0),
        bgImageX: getStateValue('bgImageX', 0),
        bgImageY: getStateValue('bgImageY', 0),
        bgImageOpacity: getStateValue('bgImageOpacity', 1.0),
        showGrid: getStateValue('showGrid', true),
        gridSize: getStateValue('gridSize', 100),
        gridOpacity: getStateValue('gridOpacity', 0.3),
        colors: getStateValue('colors', defaultColors),
        lineWidths: getStateValue('lineWidths', defaultLineWidths),
        history: getStateValue('history', [{
            paths: JSON.parse(JSON.stringify(defaultPaths)),
            currentPathIndex: 0,
            drawMode: 'stroke',
            drawingType: 'spline'
        }]),
        historyIndex: getStateValue('historyIndex', 0)
    };
};

const NeonDrawingApp = ({ initialState, onStateChange, sharedFileData, onSharedFileDataProcessed, isGuideEffectStopped, onGuideEffectStop }) => {
    // 包括的な初期状態を取得
    const initialDrawingState = useMemo(() => getInitialDrawingState(initialState), [initialState]);
    
    // 初期化完了フラグ
    const isInitialized = useRef(false);
    const [isInitializing, setIsInitializing] = useState(true); // 初期化中フラグ（ちらつき防止）
    const hasLoadedFromCustomize = useRef(false); // カスタマイズからの読み込み完了フラグ
    
    const canvasRef = useRef(null);
    const widthInputRef = useRef(null);
    const isUserTypingRef = useRef(false);
    
    // すべてのstateを包括的な初期値で初期化
    const [drawMode, setDrawMode] = useState(initialDrawingState.drawMode);
    const [drawingType, setDrawingType] = useState(initialDrawingState.drawingType);
    const [paths, setPaths] = useState(initialDrawingState.paths);
    const [currentPathIndex, setCurrentPathIndex] = useState(initialDrawingState.currentPathIndex);
    const [canvasWidth, setCanvasWidth] = useState(800);
    const [canvasHeight, setCanvasHeight] = useState(600);
    const [segmentsPerCurve, setSegmentsPerCurve] = useState(30);

    // ズームとパン（LocalStorageから直接初期化）
    const [scale, setScale] = useState(() => {
        const saved = safeGetFromLocalStorage('neonDrawingData');
        return saved?.scale || initialDrawingState.scale;
    });
    const [offsetX, setOffsetX] = useState(() => {
        const saved = safeGetFromLocalStorage('neonDrawingData');
        return saved?.offsetX || initialDrawingState.offsetX;
    });
    const [offsetY, setOffsetY] = useState(() => {
        const saved = safeGetFromLocalStorage('neonDrawingData');
        return saved?.offsetY || initialDrawingState.offsetY;
    });
    const [isPanning, setIsPanning] = useState(false);
    const [lastPanX, setLastPanX] = useState(0);
    const [lastPanY, setLastPanY] = useState(0);
    const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);
    const [showPoints, setShowPoints] = useState(false); // 点の表示/非表示
    const [originalShowPointsState, setOriginalShowPointsState] = useState(null); // モード切り替え前の点表示状態を記憶
    
    // タッチ操作用のstate
    const [lastTouchDistance, setLastTouchDistance] = useState(0);
    const [touchStartScale, setTouchStartScale] = useState(1);
    const [lastTouchCenter, setLastTouchCenter] = useState({ x: 0, y: 0 });

    // ドラッグと編集
    const [activePoint, setActivePoint] = useState(null);
    const didDragRef = useRef(false); // ドラッグが行われたかを判定
    const [isModifyingPoints, setIsModifyingPoints] = useState(false);
    const [isPathDeleteMode, setIsPathDeleteMode] = useState(false); // パス削除モード
    const [isPointDeleteMode, setIsPointDeleteMode] = useState(false); // 点削除モード
    const [isNewPathDisabled, setIsNewPathDisabled] = useState(false); // 新しいパスボタンの無効化状態

    // 点結合モード
    const [isMergeMode, setIsMergeMode] = useState(false);
    const [selectedPointsForMerge, setSelectedPointsForMerge] = useState([]); // 結合する2点を保存
    const [hoveredPointForMerge, setHoveredPointForMerge] = useState(null); // ホバー中の点

    // 背景画像
    const [backgroundImage, setBackgroundImage] = useState(initialDrawingState.backgroundImage);
    const [loadedBackgroundImage, setLoadedBackgroundImage] = useState(null);
    const [initialBgImageWidth, setInitialBgImageWidth] = useState(initialDrawingState.initialBgImageWidth);
    const [initialBgImageHeight, setInitialBgImageHeight] = useState(initialDrawingState.initialBgImageHeight);
    const [bgImageScale, setBgImageScale] = useState(initialDrawingState.bgImageScale);
    const [bgImageX, setBgImageX] = useState(initialDrawingState.bgImageX);
    const [bgImageY, setBgImageY] = useState(initialDrawingState.bgImageY);
    const [bgImageOpacity, setBgImageOpacity] = useState(initialDrawingState.bgImageOpacity);

    // グリッド
    const [showGrid, setShowGrid] = useState(initialDrawingState.showGrid);
    const [gridSize, setGridSize] = useState(initialDrawingState.gridSize);
    const [gridOpacity, setGridOpacity] = useState(initialDrawingState.gridOpacity);

    // モーダル状態
    const [showGridModal, setShowGridModal] = useState(false);
    const [showBgModal, setShowBgModal] = useState(initialDrawingState.showBgModal || false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [showColorModal, setShowColorModal] = useState(false);
    const [sidebarVisible, setSidebarVisible] = useState(initialDrawingState.sidebarVisible !== undefined ? initialDrawingState.sidebarVisible : true);
    // 自動長方形生成モーダル状態
    const [showRectangleModal, setShowRectangleModal] = useState(false);
    const [rectangleSize, setRectangleSize] = useState(5); // デフォルト5cm
    const [rectangleRadius, setRectangleRadius] = useState(1); // デフォルト1cm (角の半径)
    // 自動円生成モーダル状態
    const [showCircleModal, setShowCircleModal] = useState(false);
    const [circleMargin, setCircleMargin] = useState(5); // デフォルト5cm
    const [circleX, setCircleX] = useState(0); // X位置（cm）
    const [circleY, setCircleY] = useState(0); // Y位置（cm）
    // チューブ素材テンプレートモーダル状態
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [showRectTemplateModal, setShowRectTemplateModal] = useState(false);
    const [showTriangleTemplateModal, setShowTriangleTemplateModal] = useState(false);
    const [showCircleTemplateModal, setShowCircleTemplateModal] = useState(false);
    const [showLineTemplateModal, setShowLineTemplateModal] = useState(false);
    // 長方形テンプレート設定（常に左下基準）
    const [rectTemplateWidth, setRectTemplateWidth] = useState(3); // 幅（cm）
    const [rectTemplateHeight, setRectTemplateHeight] = useState(3); // 高さ（cm）
    const [rectTemplateRadius, setRectTemplateRadius] = useState(0); // 角の半径（cm）
    const [rectTemplateX, setRectTemplateX] = useState(0); // X位置（左下のX座標、cm）
    const [rectTemplateY, setRectTemplateY] = useState(0); // Y位置（左下のY座標、cm）
    const [rectTemplateAngle, setRectTemplateAngle] = useState(0); // 回転角度（度）
    // 円テンプレート設定
    const [circleTemplateDiameter, setCircleTemplateDiameter] = useState(10); // 直径（cm）
    const [circleTemplateWidth, setCircleTemplateWidth] = useState(10); // 幅（cm）
    const [circleTemplateHeight, setCircleTemplateHeight] = useState(10); // 高さ（cm）
    const [circleTemplateX, setCircleTemplateX] = useState(0); // X位置（中心のX座標、cm）
    const [circleTemplateY, setCircleTemplateY] = useState(0); // Y位置（中心のY座標、cm）
    // 直線テンプレート設定
    const [lineTemplateLength, setLineTemplateLength] = useState(10); // 長さ（cm）
    const [lineTemplateCurve, setLineTemplateCurve] = useState(0); // 曲げ具合（cm）
    const [lineTemplateX, setLineTemplateX] = useState(0); // X位置（始点のX座標、cm）
    const [lineTemplateY, setLineTemplateY] = useState(0); // Y位置（始点のY座標、cm）
    const [lineTemplateAngle, setLineTemplateAngle] = useState(0); // 回転角度（度）
    // 自動形状生成モーダル状態
    const [showAutoShapeModal, setShowAutoShapeModal] = useState(false);
    const [autoShapeMargin, setAutoShapeMargin] = useState(3); // デフォルト3cm
    // ガイドモーダル関連のstate
    const [showGuideModal, setShowGuideModal] = useState(false);
 
    
    // 履歴管理 (Undo/Redo) - 包括的な初期化
    const [history, setHistory] = useState(initialDrawingState.history);
    const [historyIndex, setHistoryIndex] = useState(initialDrawingState.historyIndex);
    // historyIndex の最新値を同期的に参照するための Ref
    const historyIndexRef = useRef(historyIndex);
    useEffect(() => {
        historyIndexRef.current = historyIndex;
    }, [historyIndex]);
    
    // 背景色変更のデバウンス用ref
    const backgroundColorTimeoutRef = useRef(null);
    
    // 色設定 - 包括的な初期化（白色と緑色を強制適用）
    const [colors, setColors] = useState({
        ...initialDrawingState.colors,
        strokePoint: '#ffffff',
        strokeLine: '#ffffff',
        fillPoint: '#10b981'
    });
    
    // 線の太さ設定 - 包括的な初期化
    const [lineWidths, setLineWidths] = useState(initialDrawingState.lineWidths);
    
    // チューブ太さプレビュー設定
    const [tubeThickness, setTubeThickness] = useState('default');
    
    // 拡大縮小モーダル関連の状態
    const [showScaleModal, setShowScaleModal] = useState(false);
    const [openedFromFunctionBar, setOpenedFromFunctionBar] = useState(false);
    const [scaleFactor, setScaleFactor] = useState(1.0);
    const [originalPaths, setOriginalPaths] = useState(null);
    
    // モデルサイズ情報
    const [modelSize, setModelSize] = useState({
        width: 0,
        height: 0,
        totalLength: 0
    });
    
    // 入力可能なモデルサイズ（ユーザーが手動で設定）
    const [inputModelSize, setInputModelSize] = useState({
        width: 0,
        height: 0
    });
    
    // サイズ入力フィールド用のref
    const widthSizeInputRef = useRef(null);
    const heightSizeInputRef = useRef(null);
    const isUserTypingSizeRef = useRef(false);
    
    // オリジナルサイズ（リセット用）
    const [originalModelSize, setOriginalModelSize] = useState({
        width: 0,
        height: 0
    });

    // チューブ太さプレビューの変更を実際の線の太さに反映
    useEffect(() => {
        let strokeWidth;
        switch (tubeThickness) {
            case '6':
                strokeWidth = 15; // 6mm = 0.6cm = 15px (25px/cm * 0.6cm)
                break;
            case '8':
                strokeWidth = 20; // 8mm = 0.8cm = 20px (25px/cm * 0.8cm)
                break;
            case 'default':
            default:
                strokeWidth = 4; // 骨組み描画（現在の太さ）
                break;
        }
        
        setLineWidths(prev => ({
            ...prev,
            strokeLine: strokeWidth
        }));
    }, [tubeThickness]);

    // パス変更時にモデルサイズを計算
    useEffect(() => {
        if (paths && paths.length > 0) {
            const sizeInfo = calculateSvgSizeCm(paths, gridSize);
            const totalLength = calculateTotalLength(paths);
            
            const newSize = {
                width: sizeInfo.width,
                height: sizeInfo.height,
                totalLength: totalLength
            };
            
            setModelSize(newSize);
            
            // 入力フィールドも同期（モーダルが開いていない時のみ）
            if (!showScaleModal) {
                setInputModelSize({
                    width: newSize.width,
                    height: newSize.height
                });
            }
        } else {
            setModelSize({
                width: 0,
                height: 0,
                totalLength: 0
            });
            if (!showScaleModal) {
                setInputModelSize({
                    width: 0,
                    height: 0
                });
            }
        }
    }, [paths, gridSize, scaleFactor, showScaleModal]);

    // モデルサイズ変更時に入力フィールドを更新（ユーザーが入力中でない場合のみ）
    useEffect(() => {
        if (!isUserTypingSizeRef.current) {
            if (widthSizeInputRef.current) {
                const width = modelSize.width;
                widthSizeInputRef.current.value = width % 1 === 0 ? width.toString() : width.toFixed(1);
            }
            if (heightSizeInputRef.current) {
                const height = modelSize.height;
                heightSizeInputRef.current.value = height % 1 === 0 ? height.toString() : height.toFixed(1);
            }
            // inputModelSizeも同期
            setInputModelSize({
                width: modelSize.width,
                height: modelSize.height
            });
        }
    }, [modelSize]);

    // 初期化完了マーカー + LocalStorageから最新状態を確実に復元
    useEffect(() => {
        // ページリロード時にsessionStorageをクリア
        const isPageReload = () => {
            // performance.getEntriesByType('navigation')をサポートしているブラウザの場合
            if (typeof performance !== 'undefined' && performance.getEntriesByType) {
                const navEntries = performance.getEntriesByType('navigation');
                if (navEntries.length > 0) {
                    return navEntries[0].type === 'reload';
                }
            }
            
            // フォールバック: performance.navigation.typeを使用（非推奨だが互換性のため）
            if (typeof performance !== 'undefined' && performance.navigation) {
                return performance.navigation.type === 1; // TYPE_RELOAD
            }
            
            return false;
        };

        // リロード時のLocalStorageクリアは削除（ユーザーの選択に委ねる）

        // リマウント時に最新の状態を確実に復元
        try {
            const savedData = sessionStorage.getItem('neonDrawingData');
            if (savedData) {
                const parsedData = JSON.parse(savedData);
                console.log('リマウント時にLocalStorageから最新状態を復元:', parsedData);
                
                // 確実に最新の描画状態を復元
                if (parsedData.paths && Array.isArray(parsedData.paths)) {
                    setPaths(parsedData.paths);
                }
                if (parsedData.currentPathIndex !== undefined) {
                    setCurrentPathIndex(parsedData.currentPathIndex);
                }
                if (parsedData.history && Array.isArray(parsedData.history)) {
                    setHistory(parsedData.history);
                }
                if (parsedData.historyIndex !== undefined) {
                    setHistoryIndex(parsedData.historyIndex);
                }
                
                console.log('最新状態復元完了 - パス数:', parsedData.paths?.length, '履歴:', parsedData.history?.length, 'インデックス:', parsedData.historyIndex);
            }
        } catch (error) {
            console.error('最新状態復元エラー:', error);
        }
        
        isInitialized.current = true;
        setIsInitializing(false); // 初期化完了フラグを設定（ちらつき防止）
        console.log('NeonDrawingApp初期化完了 - LocalStorageから最新状態を確実に復元');
    }, []);

    // 状態変更時にLocalStorageに保存する関数 - 履歴も含めて保存
    const saveToLocalStorage = useCallback(() => {
        if (!isInitialized.current) {
            console.log('LocalStorage保存スキップ - 初期化未完了');
            return;
        }
        
        try {
            // 履歴を最新の20件に制限
            const limitedHistory = history.slice(-20);
            const adjustedHistoryIndex = Math.min(historyIndex, limitedHistory.length - 1);
            
            const dataToSave = {
                paths,
                currentPathIndex,
                drawMode,
                drawingType,
                scale,
                offsetX,
                offsetY,
                backgroundImage,
                initialBgImageWidth,
                initialBgImageHeight,
                bgImageScale,
                bgImageX,
                bgImageY,
                bgImageOpacity,
                showGrid,
                gridSize,
                gridOpacity,
                colors,
                lineWidths,
                history: limitedHistory,
                historyIndex: adjustedHistoryIndex
            };
            
            const dataString = JSON.stringify(dataToSave);
            
            // データサイズをログ出力してデバッグ
            const totalSizeKB = Math.round(dataString.length / 1024);
            const bgImageSizeKB = backgroundImage ? Math.round(backgroundImage.length / 1024) : 0;
            const historyString = JSON.stringify(limitedHistory);
            const historySizeKB = Math.round(historyString.length / 1024);
            
            console.log(`LocalStorageデータサイズ詳細:
                - 全体: ${totalSizeKB}KB
                - 背景画像: ${bgImageSizeKB}KB
                - 履歴: ${historySizeKB}KB (${limitedHistory.length}個)
                - その他: ${totalSizeKB - bgImageSizeKB - historySizeKB}KB`);
            
            // データサイズが5MBを超える場合は背景画像を除外
            if (dataString.length > 5 * 1024 * 1024) {
                const dataWithoutImage = {
                    ...dataToSave,
                    backgroundImage: null,
                    initialBgImageWidth: 0,
                    initialBgImageHeight: 0
                };
                sessionStorage.setItem('neonDrawingData', JSON.stringify(dataWithoutImage));
                console.log('背景画像を除外してLocalStorageに保存しました - 履歴:', limitedHistory.length, '個');
            } else {
                sessionStorage.setItem('neonDrawingData', dataString);
                console.log('描画データをLocalStorageに保存しました - 履歴:', limitedHistory.length, '個');
            }
        } catch (error) {
            console.error('LocalStorageへのデータ保存に失敗しました:', error);
            // 履歴なしで保存を試行
            try {
                const minimalData = {
                    paths,
                    currentPathIndex,
                    drawMode,
                    drawingType,
                    scale,
                    offsetX,
                    offsetY,
                    showGrid,
                    gridSize,
                    gridOpacity,
                    colors,
                    lineWidths,
                    history: [{ paths, currentPathIndex, drawMode, drawingType }],
                    historyIndex: 0
                };
                sessionStorage.setItem('neonDrawingData', JSON.stringify(minimalData));
                console.log('最小限のデータでLocalStorageに保存しました');
            } catch (minimalError) {
                console.error('最小限データの保存も失敗:', minimalError);
            }
        }
    }, [isInitialized, paths, currentPathIndex, drawMode, drawingType, scale, offsetX, offsetY, backgroundImage, 
        initialBgImageWidth, initialBgImageHeight, bgImageScale, bgImageX, bgImageY, bgImageOpacity, 
        showGrid, gridSize, gridOpacity, colors, lineWidths, history, historyIndex]);

    // Undo/Redo時のパス変更を監視してLocalStorageに保存
    useEffect(() => {
        if (isInitialized.current && paths.length > 0) {
            // デバウンス処理でパス変更を監視
            const timeoutId = setTimeout(() => {
                console.log('パス変更検出 - LocalStorageに保存');
                saveToLocalStorage();
            }, 150);
            
            return () => clearTimeout(timeoutId);
        }
    }, [paths, isInitialized, saveToLocalStorage]);

    // 背景色変更のデバウンス処理
    const handleBackgroundColorChange = useCallback((color) => {
        // 既存のタイマーをクリア
        if (backgroundColorTimeoutRef.current) {
            clearTimeout(backgroundColorTimeoutRef.current);
        }
        
        // 200ms後に実際の更新を実行
        backgroundColorTimeoutRef.current = setTimeout(() => {
            setColors(prev => ({ ...prev, background: color }));
            // 背景色変更時に保存
            saveToLocalStorage();
            if (onStateChange) {
                const currentState = {
                    paths: paths,
                    currentPathIndex: currentPathIndex,
                    drawMode: drawMode,
                    drawingType: drawingType,
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
                    colors: { ...colors, background: color },
                    lineWidths: lineWidths
                };
                onStateChange(currentState);
            }
        }, 200);
    }, [paths, currentPathIndex, drawMode, drawingType, scale, offsetX, offsetY, backgroundImage, initialBgImageWidth, initialBgImageHeight, bgImageScale, bgImageX, bgImageY, bgImageOpacity, showGrid, gridSize, gridOpacity, colors, lineWidths, saveToLocalStorage, onStateChange]);

    // スライダー変更時に入力フィールドを更新（ユーザーが入力中でない場合のみ）
    useEffect(() => {
        if (widthInputRef.current && initialBgImageWidth > 0 && !isUserTypingRef.current) {
            const currentWidth = (initialBgImageWidth * bgImageScale) / 25;
            // 整数の場合は小数点を表示しない
            widthInputRef.current.value = currentWidth % 1 === 0 ? currentWidth.toString() : currentWidth.toFixed(1);
        }
    }, [bgImageScale, initialBgImageWidth]);

    // 背景画像のロード処理
    useEffect(() => {
        if (backgroundImage) {
            const img = new Image();
            img.onload = () => {
                setLoadedBackgroundImage(img);

                // sessionStorageから復元された場合はサイズ計算のみ行い、設定値は保持する
                const isRestoredFromStorage = bgImageScale !== 1.0 || bgImageX !== 0 || bgImageY !== 0 || bgImageOpacity !== 1.0;
                
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
                
                // 新しい画像の場合のみ設定をリセット
                if (!isRestoredFromStorage) {
                    setBgImageScale(1.0);
                    setBgImageX(0);
                    setBgImageY(0);
                    setBgImageOpacity(1.0);
                }
            };
            img.onerror = () => {
                console.error("背景画像の読み込みに失敗しました。");
                setBackgroundImage(null); // エラー時は画像をクリア
                setLoadedBackgroundImage(null);
            };
            img.src = backgroundImage;
        } else {
            setLoadedBackgroundImage(null);
            // 画像がクリアされた時は全ての設定をリセット
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
        // 初期化中は描画をスキップしてちらつきを防止
        if (isInitializing) return;
        
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, canvasWidth, canvasHeight); // キャンバスをクリア（CSS座標系で）

        // 無限背景とグリッドの描画
        ctx.save();
        ctx.translate(offsetX, offsetY);
        ctx.scale(scale, scale);

        const visibleLeft = -offsetX / scale;
        const visibleTop = -offsetY / scale;
        const visibleRight = (canvasWidth - offsetX) / scale;
        const visibleBottom = (canvasHeight - offsetY) / scale;

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
            ctx.strokeStyle = '#646464';
            ctx.lineWidth = 0.5 / scale;
            ctx.setLineDash([]);
            ctx.globalAlpha = 0.3;

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

        // スケール表示（1マス = 4cm）
        if (showGrid) {
            ctx.save();
            
            // 画面の横の真ん中（50%）、上側に表示
            const textX = canvasWidth / 2;
            const textY = 16;
            
            // モバイル判定
            const isMobile = window.innerWidth <= 1280 || navigator.maxTouchPoints > 0;
            const fontSize = isMobile ? '10px' : '14px';
            const boxWidth = isMobile ? 60 : 80;
            const boxHeight = isMobile ? 18 : 24;
            const boxOffsetX = isMobile ? 30 : 40;
            
            // 背景の半透明ボックス（中央揃えのため少し左にずらす）
            ctx.globalAlpha = 0.7;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(textX - boxOffsetX, textY - 4, boxWidth, boxHeight);
            ctx.globalAlpha = 1;
            
            // テキストを描画（中央揃え）
            ctx.fillStyle = '#ffffff';
            ctx.font = `${fontSize} Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(`1マス = ${gridSize / 25}cm`, textX, textY);
            ctx.restore();
        }

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

        // 1. まず全てのベースプレート（fill）パスの面と境界線を描画
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
                // SVG出力と全く同じ閉じたパス処理: キャンバス描画でもベジェ曲線を使用
                for (let i = 0; i < pathPoints.length; i++) {
                    const p0 = pathPoints[(i - 1 + pathPoints.length) % pathPoints.length];
                    const p1 = pathPoints[i];
                    const p2 = pathPoints[(i + 1) % pathPoints.length];
                    const p3 = pathPoints[(i + 2) % pathPoints.length];

                    // SVG出力と全く同じCatmull-Rom→ベジェ制御点計算
                    const cp1x = p1.x + (p2.x - p0.x) / 8;
                    const cp1y = p1.y + (p2.y - p0.y) / 8;
                    const cp2x = p2.x - (p3.x - p1.x) / 8;
                    const cp2y = p2.y - (p3.y - p1.y) / 8;
                    
                    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
                }
            } else { // 直線描画
                for (let i = 1; i < pathPoints.length; i++) {
                    ctx.lineTo(pathPoints[i].x, pathPoints[i].y);
                }
                ctx.closePath();
            }
            ctx.fill();
            
            // 境界線を緑色のグローで描画
            ctx.save();
            ctx.globalAlpha = 0.85;
            ctx.shadowColor = '#10b981';
            ctx.shadowBlur = 8;
            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = lineWidths.fillBorder / scale;
            ctx.stroke();
            ctx.restore();
        });

        // 2. 次に全てのチューブ（stroke）パスを描画
        paths.forEach((pathObj) => {
            if (!pathObj || !Array.isArray(pathObj.points) || pathObj.mode !== 'stroke') {
                return;
            }

            const pathPoints = pathObj.points;
            const pathType = pathObj.type; // パスのタイプを取得

            if (pathPoints.length < 2) return;

            // 白いスプライン
            ctx.save();
            ctx.globalAlpha = 0.85;
            ctx.strokeStyle = colors.strokeLine;
            
            // 骨組み描画の場合はスケールで調整、チューブ表示の場合は固定
            ctx.lineWidth = tubeThickness === 'default' ? lineWidths.strokeLine / scale : lineWidths.strokeLine;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';

            ctx.beginPath();
            ctx.moveTo(pathPoints[0].x, pathPoints[0].y);

            if (pathType === 'spline') {
                for (let i = 0; i < pathPoints.length - 1; i++) {
                    const p0 = (i === 0) ? pathPoints[0] : pathPoints[i - 1];
                    const p1 = pathPoints[i];
                    const p2 = pathPoints[i + 1];
                    const p3 = (i + 2 >= pathPoints.length) ? pathPoints[pathPoints.length - 1] : pathPoints[i + 2];

                    const cp1x = p1.x + (p2.x - p0.x) / 8;
                    const cp1y = p1.y + (p2.y - p0.y) / 8;
                    const cp2x = p2.x - (p3.x - p1.x) / 8;
                    const cp2y = p2.y - (p3.y - p1.y) / 8;

                    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
                }
            } else {
                for (let i = 1; i < pathPoints.length; i++) {
                    ctx.lineTo(pathPoints[i].x, pathPoints[i].y);
                }
            }
            ctx.stroke();
            ctx.restore();
        });

        // 表示領域内の全点数をカウントして表示制御
        const totalVisiblePoints = paths.reduce((count, pathObj) => {
            if (!pathObj || !Array.isArray(pathObj.points)) return count;
            return count + pathObj.points.filter(point => {
                return point.x >= visibleLeft && point.x <= visibleRight &&
                       point.y >= visibleTop && point.y <= visibleBottom;
            }).length;
        }, 0);

        const POINT_DISPLAY_THRESHOLD = 500;

        // 3. 最後に全ての制御点を描画（ベースプレート、チューブの順で色分け）
        if (showPoints) {
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

                    // 点結合モードで選択された点
                    const isSelectedForMerge = isMergeMode && selectedPointsForMerge.some(
                        sp => sp.pathIndex === pathIdx && sp.pointIndex === ptIdx
                    );

                    // 点結合モードでホバー中の点
                    const isHoveredForMerge = isMergeMode && hoveredPointForMerge &&
                        hoveredPointForMerge.pathIndex === pathIdx && hoveredPointForMerge.pointIndex === ptIdx;

                    // 点修正モード または 点結合モードの場合は全ての点をシアン色で表示
                    if (isModifyingPoints || isMergeMode) {
                        pointFillStyle = '#06b6d4'; // 点修正モード・点結合モード時はシアン
                        // ホバー中の点はオレンジ色
                        if (isHoveredForMerge && !isSelectedForMerge) {
                            pointFillStyle = '#f59e0b'; // ホバー時はオレンジ
                        }
                        // 点結合モードで選択された点は緑色
                        if (isSelectedForMerge) {
                            pointFillStyle = '#10b981'; // 選択時は緑
                        }
                    } else {
                        // パスのモードに応じて点の色を変更
                        if (pathMode === 'fill') {
                            pointFillStyle = colors.fillPoint; // ベースプレート（fill）の点の色
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
                    }
                    
                    // 点の外側に黒い境界線を描画（500個以下の場合のみ）
                    if (totalVisiblePoints <= 500) {
                        ctx.strokeStyle = '#000000';
                        ctx.lineWidth = 0.8 / scale;
                        ctx.beginPath();
                        ctx.arc(p.x, p.y, 4 / scale, 0, Math.PI * 2);
                        ctx.stroke();
                    }
                    
                    // 内側を塗りつぶし（スプラインは色変更適用、strokeモードは白に近いグレー、fillモードは元の色）
                    if (pathObj.type === 'spline') {
                        ctx.fillStyle = pointFillStyle; // スプラインは色変更を適用
                    } else {
                        ctx.fillStyle = pathObj.mode === 'stroke' ? '#e8e8e8' : pointFillStyle;
                    }
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, 4 / scale, 0, Math.PI * 2);
                    ctx.fill();
                });
            });
        }

        // 長方形ベースプレートプレビューの描画
        if (showRectangleModal) {
            // 境界計算をインライン実行
            if (paths && paths.length > 0) {
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                let hasValidPoints = false;
                
                paths.forEach(path => {
                    if (path && path.points && path.points.length > 0) {
                        path.points.forEach(point => {
                            if (point && typeof point.x === 'number' && typeof point.y === 'number') {
                                minX = Math.min(minX, point.x);
                                minY = Math.min(minY, point.y);
                                maxX = Math.max(maxX, point.x);
                                maxY = Math.max(maxY, point.y);
                                hasValidPoints = true;
                            }
                        });
                    }
                });
                
                if (hasValidPoints) {
                    // cmをピクセルに変換 (100px = 4cm基準)
                    const marginPx = (rectangleSize * 100) / 4;
                    const radiusPx = (rectangleRadius * 100) / 4;

                    const rectangleBase = {
                        x: minX - marginPx,
                        y: minY - marginPx,
                        width: (maxX - minX) + (marginPx * 2),
                        height: (maxY - minY) + (marginPx * 2)
                    };

                    ctx.save();
                    // 境界線を緑色のグローで描画（ベースプレートと同じエフェクト）
                    ctx.globalAlpha = 0.85;
                    ctx.shadowColor = '#10b981';
                    ctx.shadowBlur = 8;
                    ctx.strokeStyle = '#10b981';
                    ctx.lineWidth = lineWidths.fillBorder / scale;
                    ctx.setLineDash([]); // 実線

                    // 長方形プレビュー（角丸対応）
                    ctx.beginPath();
                    const { x, y, width, height } = rectangleBase;
                    const r = Math.min(radiusPx, width / 2, height / 2);

                    if (r <= 0) {
                        // 角丸なし
                        ctx.rect(x, y, width, height);
                    } else {
                        // 角丸あり
                        ctx.moveTo(x + r, y);
                        ctx.lineTo(x + width - r, y);
                        ctx.arcTo(x + width, y, x + width, y + r, r);
                        ctx.lineTo(x + width, y + height - r);
                        ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
                        ctx.lineTo(x + r, y + height);
                        ctx.arcTo(x, y + height, x, y + height - r, r);
                        ctx.lineTo(x, y + r);
                        ctx.arcTo(x, y, x + r, y, r);
                        ctx.closePath();
                    }
                    ctx.stroke();

                    ctx.restore();
                }
            }
        }

        // 長方形テンプレートプレビューの描画
        if (showRectTemplateModal) {
            // cmをピクセルに変換 (100px = 4cm基準)
            const widthPx = (rectTemplateWidth * 100) / 4;
            const heightPx = (rectTemplateHeight * 100) / 4;
            const radiusPx = (rectTemplateRadius * 100) / 4;

            // 位置をピクセルに変換
            const posX = (rectTemplateX * 100) / 4;
            const posY = (rectTemplateY * 100) / 4;

            // 常に左下基準で計算
            // posX, posYは左下の座標
            // 左上の座標 = (左辺のX, 下辺のY - 高さ)
            const x = posX;
            const y = posY - heightPx;

            ctx.save();

            // 回転がある場合は、左下を中心に回転
            if (rectTemplateAngle !== 0) {
                ctx.translate(posX, posY);
                ctx.rotate((rectTemplateAngle * Math.PI) / 180);
                ctx.translate(-posX, -posY);
            }

            // 境界線を赤色のグローで描画
            ctx.globalAlpha = 0.85;
            ctx.shadowColor = '#ef4444';
            ctx.shadowBlur = 8;
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = lineWidths.fillBorder / scale;
            ctx.setLineDash([]); // 実線

            // 長方形プレビュー（角丸対応）
            ctx.beginPath();
            const r = Math.min(radiusPx, widthPx / 2, heightPx / 2);

            if (r <= 0) {
                // 角丸なし
                ctx.rect(x, y, widthPx, heightPx);
            } else {
                // 角丸あり
                ctx.moveTo(x + r, y);
                ctx.lineTo(x + widthPx - r, y);
                ctx.arcTo(x + widthPx, y, x + widthPx, y + r, r);
                ctx.lineTo(x + widthPx, y + heightPx - r);
                ctx.arcTo(x + widthPx, y + heightPx, x + widthPx - r, y + heightPx, r);
                ctx.lineTo(x + r, y + heightPx);
                ctx.arcTo(x, y + heightPx, x, y + heightPx - r, r);
                ctx.lineTo(x, y + r);
                ctx.arcTo(x, y, x + r, y, r);
                ctx.closePath();
            }
            ctx.stroke();

            ctx.restore();
        }

        // 円テンプレートプレビューの描画
        if (showCircleTemplateModal) {
            // cmをピクセルに変換 (100px = 4cm基準)
            const widthPx = (circleTemplateWidth * 100) / 4;
            const heightPx = (circleTemplateHeight * 100) / 4;

            // 位置をピクセルに変換（左下基準）
            const posX = (circleTemplateX * 100) / 4;
            const posY = (circleTemplateY * 100) / 4;

            // 中心座標を計算（左下基準から）
            const centerX = posX + widthPx / 2;
            const centerY = posY - heightPx / 2;

            ctx.save();

            // 境界線を赤色のグローで描画
            ctx.globalAlpha = 0.85;
            ctx.shadowColor = '#ef4444';
            ctx.shadowBlur = 8;
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = lineWidths.fillBorder / scale;
            ctx.setLineDash([]); // 実線

            // 楕円プレビュー
            ctx.beginPath();
            ctx.ellipse(centerX, centerY, widthPx / 2, heightPx / 2, 0, 0, 2 * Math.PI);
            ctx.stroke();

            ctx.restore();
        }

        // 直線テンプレートプレビューの描画
        if (showLineTemplateModal) {
            // cmをピクセルに変換 (100px = 4cm基準)
            const lengthPx = (lineTemplateLength * 100) / 4;
            const curvePx = (lineTemplateCurve * 100) / 4;

            // 位置をピクセルに変換
            const posX = (lineTemplateX * 100) / 4;
            const posY = (lineTemplateY * 100) / 4;

            ctx.save();

            // 回転がある場合は、始点を中心に回転
            if (lineTemplateAngle !== 0) {
                ctx.translate(posX, posY);
                ctx.rotate((lineTemplateAngle * Math.PI) / 180);
                ctx.translate(-posX, -posY);
            }

            // 境界線を赤色のグローで描画
            ctx.globalAlpha = 0.85;
            ctx.shadowColor = '#ef4444';
            ctx.shadowBlur = 8;
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = lineWidths.fillBorder / scale;
            ctx.setLineDash([]); // 実線

            // 曲線を描画（2次ベジェ曲線）
            ctx.beginPath();

            // 始点
            const startX = posX;
            const startY = posY;

            // 終点
            const endX = posX + lengthPx;
            const endY = posY;

            // 制御点（中点を垂直方向にオフセット）
            const controlX = posX + lengthPx / 2;
            const controlY = posY - curvePx; // マイナスは上方向（キャンバス座標系）

            ctx.moveTo(startX, startY);
            ctx.quadraticCurveTo(controlX, controlY, endX, endY);
            ctx.stroke();

            ctx.restore();
        }

        // 円形ベースプレートプレビューの描画
        if (showCircleModal) {
            // 境界計算をインライン実行
            if (paths && paths.length > 0) {
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                let hasValidPoints = false;

                paths.forEach(path => {
                    if (path && path.points && path.points.length > 0) {
                        path.points.forEach(point => {
                            if (point && typeof point.x === 'number' && typeof point.y === 'number') {
                                minX = Math.min(minX, point.x);
                                minY = Math.min(minY, point.y);
                                maxX = Math.max(maxX, point.x);
                                maxY = Math.max(maxY, point.y);
                                hasValidPoints = true;
                            }
                        });
                    }
                });

                if (hasValidPoints) {
                    // cmをピクセルに変換 (100px = 4cm基準)
                    const marginPx = (circleMargin * 100) / 4;
                    const offsetXPx = (circleX * 100) / 4;
                    const offsetYPx = (circleY * 100) / 4;

                    // 中心座標を計算
                    let centerX = (minX + maxX) / 2;
                    let centerY = (minY + maxY) / 2;

                    // 位置調整を反映
                    centerX += offsetXPx;
                    centerY += offsetYPx;

                    // 半径を計算
                    const width = maxX - minX;
                    const height = maxY - minY;
                    const radius = Math.sqrt(width * width + height * height) / 2 + marginPx;

                    ctx.save();
                    // 境界線を緑色のグローで描画（ベースプレートと同じエフェクト）
                    ctx.globalAlpha = 0.85;
                    ctx.shadowColor = '#10b981';
                    ctx.shadowBlur = 8;
                    ctx.strokeStyle = '#10b981';
                    ctx.lineWidth = lineWidths.fillBorder / scale;
                    ctx.setLineDash([]); // 実線

                    // 円形プレビュー
                    ctx.beginPath();
                    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
                    ctx.stroke();

                    ctx.restore();
                }
            }
        }

        ctx.restore(); // パスと制御点の変換を元に戻す
    }, [paths, segmentsPerCurve, scale, offsetX, offsetY, activePoint, loadedBackgroundImage, initialBgImageWidth, initialBgImageHeight, bgImageScale, bgImageX, bgImageY, bgImageOpacity, showGrid, gridSize, gridOpacity, colors, lineWidths, isPathDeleteMode, isPointDeleteMode, isModifyingPoints, isMergeMode, selectedPointsForMerge, hoveredPointForMerge, showRectangleModal, rectangleSize, rectangleRadius, showCircleModal, circleMargin, circleX, circleY, showPoints, showRectTemplateModal, rectTemplateWidth, rectTemplateHeight, rectTemplateRadius, rectTemplateX, rectTemplateY, rectTemplateAngle, showCircleTemplateModal, circleTemplateDiameter, circleTemplateWidth, circleTemplateHeight, circleTemplateX, circleTemplateY, showLineTemplateModal, lineTemplateLength, lineTemplateCurve, lineTemplateX, lineTemplateY, lineTemplateAngle, canvasWidth, canvasHeight]);

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
        return '#FFFFFF'; // デフォルト色
    };

    // 履歴を保存する関数
    const saveToHistory = useCallback((currentPaths, currentPathIdx, currentDrawMode, currentDrawingType) => {
        if (!isInitialized.current) {
            console.log('履歴保存スキップ - 初期化未完了');
            return;
        }

        setHistory(prevHistory => {
            const truncatedHistory = prevHistory.slice(0, historyIndexRef.current + 1);
            
            // 現在のパスと前の状態を比較して差分のみ保存
            const lastState = truncatedHistory[truncatedHistory.length - 1];
            let pathChanges = null;
            
            if (lastState && lastState.paths) {
                // 変更されたパスのみを特定
                pathChanges = [];
                for (let i = 0; i < Math.max(currentPaths.length, lastState.paths.length); i++) {
                    const currentPath = currentPaths[i];
                    const lastPath = lastState.paths[i];
                    
                    if (!lastPath || !currentPath || 
                        JSON.stringify(currentPath) !== JSON.stringify(lastPath)) {
                        pathChanges.push({
                            index: i,
                            path: currentPath ? JSON.parse(JSON.stringify(currentPath)) : null
                        });
                    }
                }
            }
            
            const newState = {
                type: 'state_change',
                pathChanges: pathChanges || currentPaths.map((path, index) => ({
                    index: index,
                    path: JSON.parse(JSON.stringify(path))
                })),
                currentPathIndex: currentPathIdx,
                drawMode: currentDrawMode,
                drawingType: currentDrawingType,
                // 後方互換性のため、フルデータも保持（削除予定）
                paths: JSON.parse(JSON.stringify(currentPaths))
            };
            
            const newHistory = [...truncatedHistory, newState];
            
            // 履歴を20件に制限
            const finalHistory = newHistory.length > 20 ? newHistory.slice(-20) : newHistory;
            const newHistoryIndex = finalHistory.length - 1;
            
            setHistoryIndex(newHistoryIndex); // historyIndex を同期的に更新

            // LocalStorageにも保存
            try {
                const dataToSave = {
                    paths: newState.paths, // 保存するパスは履歴の最新状態から
                    currentPathIndex: newState.currentPathIndex,
                    drawMode: newState.drawMode,
                    drawingType: newState.drawingType,
                    scale,
                    offsetX,
                    offsetY,
                    backgroundImage,
                    initialBgImageWidth,
                    initialBgImageHeight,
                    bgImageScale,
                    bgImageX,
                    bgImageY,
                    bgImageOpacity,
                    showGrid,
                    gridSize,
                    gridOpacity,
                    colors,
                    lineWidths,
                    history: finalHistory, // 最新の履歴全体を保存
                    historyIndex: newHistoryIndex // 最新の履歴インデックスを保存
                };
                sessionStorage.setItem('neonDrawingData', JSON.stringify(dataToSave));
                console.log('描画データをLocalStorageに保存しました (履歴保存時) - 履歴:', finalHistory.length, '個');
            } catch (error) {
                console.error('LocalStorageへのデータ保存に失敗しました (履歴保存時):', error);
            }

            // 親コンポーネントに状態変更を通知
            if (onStateChange) {
                onStateChange(newState);
            }
            
            return finalHistory;
        });
    }, [historyIndex, isInitialized, onStateChange, scale, offsetX, offsetY, backgroundImage, 
        initialBgImageWidth, initialBgImageHeight, bgImageScale, bgImageX, bgImageY, 
        bgImageOpacity, showGrid, gridSize, gridOpacity, colors, lineWidths]);

    // 拡大縮小モーダルを開く
    const openScaleModal = useCallback(() => {
        console.log('拡大縮小ボタンがクリックされました');
        // 現在のパス状態を保存
        setOriginalPaths(JSON.parse(JSON.stringify(paths)));
        // 現在のサイズをオリジナルサイズとして保存
        setOriginalModelSize({
            width: modelSize.width,
            height: modelSize.height
        });
        setScaleFactor(1.0);
        setShowScaleModal(true);
        console.log('拡大縮小モーダルを開きました');
    }, [paths, modelSize]);

    // 拡大縮小をリアルタイムで適用
    const applyScalePreview = useCallback((factor) => {
        if (!originalPaths || factor === 1.0) {
            // 倍率1.0の場合は元のパスに戻す
            if (originalPaths) {
                setPaths(originalPaths);
            }
            return;
        }

        // 座標系の中心点 (0, 0) を基準に拡大縮小
        const centerX = 0;
        const centerY = 0;

        const scaledPaths = originalPaths.map(pathObj => {
            if (!pathObj || !Array.isArray(pathObj.points)) return pathObj;

            const scaledPoints = pathObj.points.map(point => {
                const relativeX = point.x - centerX;
                const relativeY = point.y - centerY;
                
                const scaledX = relativeX * factor;
                const scaledY = relativeY * factor;
                
                const newX = centerX + scaledX;
                const newY = centerY + scaledY;
                
                return limitCoordinates(newX, newY);
            });

            return { ...pathObj, points: scaledPoints };
        });

        setPaths(scaledPaths);
    }, [originalPaths]);

    // 拡大縮小モーダルを閉じる（履歴保存）
    const closeScaleModal = useCallback(() => {
        if (originalPaths && scaleFactor !== 1.0) {
            // 履歴に保存
            saveToHistory(paths, currentPathIndex, drawMode, drawingType);
        }
        
        // LocalStorageに保存
        saveToLocalStorage();
        
        // 親コンポーネントに状態変更を通知
        if (onStateChange) {
            const currentState = {
                paths: paths,
                currentPathIndex: currentPathIndex,
                drawMode: drawMode,
                drawingType: drawingType,
                scale,
                offsetX,
                offsetY,
                backgroundImage,
                initialBgImageWidth,
                initialBgImageHeight,
                bgImageScale,
                bgImageX,
                bgImageY,
                bgImageOpacity,
                showGrid,
                gridSize,
                gridOpacity,
                colors,
                lineWidths
            };
            onStateChange(currentState);
        }
        
        setShowScaleModal(false);
        setOriginalPaths(null);
        setScaleFactor(1.0);
        
        // 機能バーから開いた場合はサイドバーを開かない
        if (!openedFromFunctionBar) {
            setSidebarVisible(true);
        }
        setOpenedFromFunctionBar(false);
    }, [originalPaths, scaleFactor, paths, currentPathIndex, drawMode, drawingType, saveToHistory, 
        saveToLocalStorage, onStateChange, scale, offsetX, offsetY, backgroundImage, 
        initialBgImageWidth, initialBgImageHeight, bgImageScale, bgImageX, bgImageY, 
        bgImageOpacity, showGrid, gridSize, gridOpacity, colors, lineWidths]);

    // サイズ入力が変更された時にパスをスケールする
    const applyWidthChange = useCallback((targetWidthCm) => {
        if (!paths || paths.length === 0 || targetWidthCm <= 0) return;
        
        const currentSize = calculateSvgSizeCm(paths, gridSize);
        if (currentSize.width === 0) return;
        
        // 比率を計算してスケールファクターを設定
        const newScaleFactor = targetWidthCm / currentSize.width;
        const newHeight = currentSize.height * newScaleFactor;
        const scaledPaths = scalePathsToSize(paths, { width: targetWidthCm, height: newHeight }, gridSize);
        
        // 履歴に保存してからパスを更新
        saveToHistory(paths, currentPathIndex, drawMode, drawingType);
        setPaths(scaledPaths);
        
        // 高さの入力フィールドも同期更新
        if (heightSizeInputRef.current) {
            heightSizeInputRef.current.value = newHeight % 1 === 0 ? newHeight.toString() : newHeight.toFixed(1);
        }
        // inputModelSizeも更新
        setInputModelSize(prev => ({
            ...prev,
            width: targetWidthCm,
            height: newHeight
        }));
        
        // スライダーも更新（オリジナルサイズからの倍率を計算）
        if (originalModelSize.width > 0) {
            const scaleFromOriginal = targetWidthCm / originalModelSize.width;
            setScaleFactor(scaleFromOriginal);
        }
    }, [paths, gridSize, saveToHistory, currentPathIndex, drawMode, drawingType, originalModelSize]);

    const applyHeightChange = useCallback((targetHeightCm) => {
        if (!paths || paths.length === 0 || targetHeightCm <= 0) return;
        
        const currentSize = calculateSvgSizeCm(paths, gridSize);
        if (currentSize.height === 0) return;
        
        // 比率を計算してスケールファクターを設定
        const newScaleFactor = targetHeightCm / currentSize.height;
        const newWidth = currentSize.width * newScaleFactor;
        const scaledPaths = scalePathsToSize(paths, { width: newWidth, height: targetHeightCm }, gridSize);
        
        // 履歴に保存してからパスを更新
        saveToHistory(paths, currentPathIndex, drawMode, drawingType);
        setPaths(scaledPaths);
        
        // 幅の入力フィールドも同期更新
        if (widthSizeInputRef.current) {
            widthSizeInputRef.current.value = newWidth % 1 === 0 ? newWidth.toString() : newWidth.toFixed(1);
        }
        // inputModelSizeも更新
        setInputModelSize(prev => ({
            ...prev,
            width: newWidth,
            height: targetHeightCm
        }));
        
        // スライダーも更新（オリジナルサイズからの倍率を計算）
        if (originalModelSize.height > 0) {
            const scaleFromOriginal = targetHeightCm / originalModelSize.height;
            setScaleFactor(scaleFromOriginal);
        }
    }, [paths, gridSize, saveToHistory, currentPathIndex, drawMode, drawingType, originalModelSize]);

    // サイズをリセットする
    const resetModelSize = useCallback(() => {
        if (originalModelSize.width > 0 && originalModelSize.height > 0) {
            const scaledPaths = scalePathsToSize(paths, originalModelSize, gridSize);
            // 履歴に保存してからパスを更新
            saveToHistory(paths, currentPathIndex, drawMode, drawingType);
            setPaths(scaledPaths);
            // スライダーも1.0にリセット
            setScaleFactor(1.0);
        }
    }, [originalModelSize, paths, gridSize, saveToHistory, currentPathIndex, drawMode, drawingType]);

    // スライダー変更時にリアルタイムで拡大縮小を適用
    useEffect(() => {
        console.log('Scale useEffect実行:', showScaleModal, scaleFactor);
        if (showScaleModal && scaleFactor !== 1.0) {
            console.log('applyScalePreview呼び出し');
            applyScalePreview(scaleFactor);
        }
    }, [scaleFactor, showScaleModal]);

    // やり直し (Redo)
    const handleRedo = useCallback(() => {
        console.log("handleRedo called. historyIndex:", historyIndex, "history.length:", history.length);
        if (historyIndex < history.length - 1) {
            const nextIndex = historyIndex + 1;
            const nextState = history[nextIndex];
            console.log("Attempting to access nextIndex:", nextIndex, "history[nextIndex]:", nextState);

            // 新形式と旧形式の両方に対応
            if (nextState) {
                if (nextState.paths && Array.isArray(nextState.paths)) {
                    // フルパス情報を使用して完全に復元
                    setPaths(JSON.parse(JSON.stringify(nextState.paths)));
                } else if (nextState.pathChanges && Array.isArray(nextState.pathChanges)) {
                    const restoredPaths = [];
                    nextState.pathChanges.forEach(change => {
                        if (change.path !== null) {
                            restoredPaths[change.index] = change.path;
                        }
                    });
                    setPaths(restoredPaths.filter(p => p));
                }
                
                setCurrentPathIndex(nextState.currentPathIndex);
                setHistoryIndex(nextIndex);
                setDrawMode(nextState.drawMode); // Redoでモードも復元
                setDrawingType(nextState.drawingType); // Redoで描画タイプも復元
                
                // UI操作モードは保持（ユーザーの操作モードを維持）
                // setIsModifyingPoints(false);
                // setIsPathDeleteMode(false); 
                // setIsPointDeleteMode(false); 
                setIsNewPathDisabled(false); 
                
                // Redo後のLocalStorage保存
                saveToLocalStorage(); 

                // 親コンポーネントに状態変更を通知
                if (onStateChange) {
                    onStateChange(nextState);
                }
            } else {
                console.error("Redo failed: nextState is invalid or missing at index", nextIndex, { nextState, historySnapshot: history });
            }
        } else {
            console.log("Redo not possible: historyIndex is at end.");
        }
    }, [history, historyIndex, saveToLocalStorage, onStateChange]);

    // キャンバスをクリア
    const clearCanvas = useCallback(() => {
        const initialPaths = [{ points: [], mode: drawMode, type: drawingType }]; 
        setPaths(initialPaths);
        setCurrentPathIndex(0);
        setScale(1);
        setOffsetX(canvasWidth / 2); 
        setOffsetY(canvasHeight / 2);
        setIsModifyingPoints(false);
        setIsPathDeleteMode(false); 
        setIsPointDeleteMode(false); 
        setIsNewPathDisabled(false);
        
        // 背景画像はクリアしない（描画要素のみクリア）
        
        const initialHistory = [{
            paths: JSON.parse(JSON.stringify(initialPaths)),
            currentPathIndex: 0,
            drawMode: drawMode,
            drawingType: drawingType
        }];
        setHistory(initialHistory);
        setHistoryIndex(0);
        
        // LocalStorageもクリア状態に更新
        try {
            const clearedData = getInitialDrawingState({}); // デフォルト状態を取得
            sessionStorage.setItem('neonDrawingData', JSON.stringify(clearedData));
            console.log('LocalStorageをクリア状態に更新しました。');
        } catch (error) {
            console.error('LocalStorageクリアエラー:', error);
        }

        if (onStateChange) {
            const clearedState = {
                paths: initialPaths,
                currentPathIndex: 0,
                drawMode: drawMode,
                drawingType: drawingType,
                scale: 1,
                offsetX: canvasWidth / 2,
                offsetY: canvasHeight / 2,
                backgroundImage: null,
                initialBgImageWidth: 0,
                initialBgImageHeight: 0,
                bgImageScale: 1.0,
                bgImageX: 0,
                bgImageY: 0,
                bgImageOpacity: 1.0,
                showGrid: true,
                gridSize: 100,
                gridOpacity: 0.3,
                colors: {
                    strokePoint: '#ffffff',
                    strokeLine: '#ffffff',
                    fillPoint: '#34d399',
                    fillArea: 'rgba(110, 110, 110, 0.5)',
                    fillBorder: '#000000',
                    background: '#191919',
                    grid: '#000000'
                },
                lineWidths: {
                    strokeLine: 4,
                    fillBorder: 3
                }
            };
            onStateChange(clearedState);
        }
    }, [drawMode, drawingType, canvasWidth, canvasHeight, onStateChange]);

    // 新しいパスを開始
    const startNewPath = useCallback(() => {
        
        console.log('新しいパスボタンが押されました - ボタンを無効化します');
        setIsNewPathDisabled(true); // ボタンを無効化
        
        setPaths(prevPaths => {
            const currentPath = prevPaths[currentPathIndex];
            if (currentPath && currentPath.points.length > 0) {
                // ベースプレートの重複チェック
                if (drawMode === 'fill') {
                    const existingFillPaths = prevPaths.filter(pathObj => 
                        pathObj && pathObj.mode === 'fill' && pathObj.points && pathObj.points.length >= 3
                    );
                    if (existingFillPaths.length >= 1) {
                        alert('ベースプレートは1つまでしか作成できません。既存のベースプレートを削除してから新しいものを作成してください。');
                        setIsNewPathDisabled(false);
                        return prevPaths;
                    }
                }
                
                const newPath = { points: [], mode: drawMode, type: drawingType };
                const updatedPaths = [...prevPaths, newPath];
                const newPathIdx = updatedPaths.length - 1; 
                setCurrentPathIndex(newPathIdx);
                setIsModifyingPoints(false);
                setIsPathDeleteMode(false); 
                setIsPointDeleteMode(false); 
                saveToHistory(updatedPaths, newPathIdx, drawMode, drawingType);
                return updatedPaths;
            } else if (currentPath && currentPath.points.length === 0) {
                const updatedPaths = [...prevPaths];
                if (updatedPaths[currentPathIndex].mode === drawMode && updatedPaths[currentPathIndex].type === drawingType) {
                    setIsNewPathDisabled(false); 
                    return prevPaths;
                }
                updatedPaths[currentPathIndex] = { points: [], mode: drawMode, type: drawingType };
                saveToHistory(updatedPaths, currentPathIndex, drawMode, drawingType);
                return updatedPaths;
            }
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

            // 新形式と旧形式の両方に対応
            if (prevState) {
                if (prevState.paths && Array.isArray(prevState.paths)) {
                    // フルパス情報がある場合はそれをそのまま使用して復元する。
                    setPaths(JSON.parse(JSON.stringify(prevState.paths)));
                } else if (prevState.pathChanges && Array.isArray(prevState.pathChanges)) {
                    // 差分のみ保持しているレガシー履歴の場合：空配列をベースに差分を適用して復元。
                    const restoredPaths = [];
                    prevState.pathChanges.forEach(change => {
                        if (change.path !== null) {
                            restoredPaths[change.index] = change.path;
                        }
                    });
                    setPaths(restoredPaths.filter(p => p));
                }
                
                setCurrentPathIndex(prevState.currentPathIndex);
                setHistoryIndex(prevIndex);
                setDrawMode(prevState.drawMode); // Undoでモードも復元
                setDrawingType(prevState.drawingType); // Undoで描画タイプも復元
                
                // UI操作モードは保持（ユーザーの操作モードを維持）
                // setIsModifyingPoints(false);
                // setIsPathDeleteMode(false); 
                // setIsPointDeleteMode(false); 
                setIsNewPathDisabled(false); 
                
                // Undo後のLocalStorage保存
                saveToLocalStorage();
                
                // 親コンポーネントに状態変更を通知
                if (onStateChange) {
                    // 現在のパス数と復元後のパス数を比較
                    const currentPathCount = paths.length;
                    const restoredPathCount = prevState.paths.length;
                    
                    // パスが復活した場合の処理
                    if (restoredPathCount > currentPathCount) {
                        // 復活したパスのインデックスを特定
                        let restoredIndex = -1;
                        for (let i = 0; i < restoredPathCount; i++) {
                            if (i >= currentPathCount || 
                                JSON.stringify(prevState.paths[i]) !== JSON.stringify(paths[i] || {})) {
                                restoredIndex = i;
                                break;
                            }
                        }
                        
                        // pathRestoredIndexを含めた状態を送信
                        if (restoredIndex !== -1) {
                            const stateWithRestoredIndex = {
                                ...prevState,
                                pathRestoredIndex: restoredIndex
                            };
                            onStateChange(stateWithRestoredIndex);
                        } else {
                            onStateChange(prevState);
                        }
                    } else {
                        onStateChange(prevState);
                    }
                }
            } else {
                console.error("Undo failed: Previous state is invalid or missing.", { historyIndex, prevIndex, historySnapshot: history });
            }
        } else {
            console.log("Undo not possible: historyIndex is 0.");
        }
    }, [history, historyIndex, saveToLocalStorage, onStateChange]);

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

                        // Catmull-RomからBezier制御点を計算（より滑らか）
                        const cp1x = p1.x + (p2.x - p0.x) / 8;
                        const cp1y = p1.y + (p2.y - p0.y) / 8;
                        const cp2x = p2.x - (p3.x - p1.x) / 8;
                        const cp2y = p2.y - (p3.y - p1.y) / 8;
                        
                        currentStrokeSegment += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
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
                    // 閉じたパス処理: キャンバス描画と同じ循環参照方式を使用
                    for (let i = 0; i < pathPoints.length; i++) {
                        const p0 = pathPoints[(i - 1 + pathPoints.length) % pathPoints.length];
                        const p1 = pathPoints[i];
                        const p2 = pathPoints[(i + 1) % pathPoints.length];
                        const p3 = pathPoints[(i + 2) % pathPoints.length];

                        // Catmull-RomからBezier制御点を計算（より滑らか）
                        const cp1x = p1.x + (p2.x - p0.x) / 8;
                        const cp1y = p1.y + (p2.y - p0.y) / 8;
                        const cp2x = p2.x - (p3.x - p1.x) / 8;
                        const cp2y = p2.y - (p3.y - p1.y) / 8;
                        
                        currentFillSegment += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
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

    // ネオン下絵の完全な状態を保存してダウンロード
    const downloadNeonProject = useCallback(() => {
        try {
            // データが空の場合は保存しない
            const hasValidData = paths && paths.length > 0 && paths.some(path => 
                path && Array.isArray(path.points) && path.points.length > 0
            );
            
            if (!hasValidData) {
                alert('保存できるデータがありません。描画してから保存してください。');
                return;
            }
            
            const currentTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const projectData = {
                // メタ情報
                metadata: {
                    version: "1.0",
                    created: currentTimestamp,
                    type: "neon-drawing-project"
                },
                // 描画状態（履歴は保存しない - ファイルサイズ削減のため）
                drawing: {
                    paths,
                    currentPathIndex,
                    drawMode,
                    drawingType
                },
                // UI設定
                settings: {
                    scale,
                    offsetX,
                    offsetY,
                    backgroundImage,
                    initialBgImageWidth,
                    initialBgImageHeight,
                    bgImageScale,
                    bgImageX,
                    bgImageY,
                    bgImageOpacity,
                    showGrid,
                    gridSize,
                    gridOpacity,
                    colors,
                    lineWidths
                },
                // キャンバス設定
                canvas: {
                    width: canvasWidth,
                    height: canvasHeight,
                    segmentsPerCurve
                }
            };
            
            // 日本時間でタイムスタンプを生成
            const japanTime = new Date().toLocaleString('ja-JP', {
                timeZone: 'Asia/Tokyo',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            }).replace(/[\/\s:]/g, '-');
            
            // ファイル名を入力させる
            const fileName = prompt('ファイル名を入力してください（拡張子は自動で追加されます）:', `neon-project-${japanTime}`);
            if (!fileName) {
                return; // キャンセルされた場合は保存しない
            }
            
            const jsonString = JSON.stringify(projectData, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${fileName}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            console.log('ネオンプロジェクトファイルをダウンロード:', a.download);
        } catch (error) {
            console.error('プロジェクトファイルのダウンロードに失敗:', error);
            alert('ファイルのダウンロードに失敗しました');
        }
    }, [paths, currentPathIndex, drawMode, drawingType, scale, offsetX, offsetY, 
        backgroundImage, initialBgImageWidth, initialBgImageHeight, bgImageScale, bgImageX, bgImageY, 
        bgImageOpacity, showGrid, gridSize, gridOpacity, colors, lineWidths, canvasWidth, canvasHeight, segmentsPerCurve]);

    // ネオンプロジェクトファイルを読み込んで復元
    const loadNeonProject = useCallback((file) => {
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const projectData = JSON.parse(e.target.result);
                console.log('プロジェクトファイル読み込み:', projectData);
                
                // データ形式の検証と変換
                const isDrawingFile = projectData.metadata && projectData.metadata.type === 'neon-drawing-project';
                const isCustomizeFile = projectData.version && projectData.neonPaths && !projectData.metadata;
                
                if (!isDrawingFile && !isCustomizeFile) {
                    alert('サポートされていないファイル形式です');
                    return;
                }
                
                if (isCustomizeFile) {
                    console.log('カスタマイズファイル検出:', projectData);
                    
                    // カスタマイズファイルには必ずneonPathsが含まれている
                    if (projectData.neonPaths && Array.isArray(projectData.neonPaths) && projectData.neonPaths.length > 0) {
                        // neonPathsから直接パスデータを取得
                        const loadedPaths = projectData.neonPaths;
                        
                        // カスタマイズされた色設定のみ反映（線幅は下絵で独自に決める）
                        // ストローク色は常に白色を強制適用
                        if (projectData.neonColors) {
                            setColors({
                                ...projectData.neonColors,
                                strokePoint: '#ffffff',
                                strokeLine: '#ffffff',
                                fillPoint: '#10b981'
                            });
                        }
                        
                        // 最適な初期視点を計算してモデルを画面中央に配置
                        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                        loadedPaths.forEach(pathObj => {
                            if (pathObj && pathObj.points && pathObj.points.length > 0) {
                                pathObj.points.forEach(point => {
                                    minX = Math.min(minX, point.x);
                                    minY = Math.min(minY, point.y);
                                    maxX = Math.max(maxX, point.x);
                                    maxY = Math.max(maxY, point.y);
                                });
                            }
                        });
                        
                        if (minX !== Infinity) {
                            const modelWidth = maxX - minX;
                            const modelHeight = maxY - minY;
                            const modelCenterX = (minX + maxX) / 2;
                            const modelCenterY = (minY + maxY) / 2;
                            
                            // 画面サイズに対してモデルが適切に収まるスケールを計算
                            const screenWidth = window.innerWidth;
                            const screenHeight = window.innerHeight;
                            const isMobile = window.innerWidth <= 1280 || navigator.maxTouchPoints > 0;
                            const padding = isMobile ? 5 : 200; // スマホは5px、PCは200pxの余白
                            
                            const scaleX = (screenWidth - padding * 2) / modelWidth;
                            const scaleY = (screenHeight - padding * 2) / modelHeight;
                            const optimalScale = Math.min(scaleX, scaleY, 1); // 最大1倍まで
                            
                            // モデル中央を画面中央に配置するオフセット計算
                            const offsetX = screenWidth / 2 - modelCenterX * optimalScale;
                            const offsetY = screenHeight / 2 - modelCenterY * optimalScale;
                            
                            setScale(optimalScale);
                            setOffsetX(offsetX);
                            setOffsetY(offsetY);
                        }
                        
                        // グリッド設定は現在の設定を維持（読み込まない）
                        
                        // 適切なcurrentPathIndexを設定（新しいパスを追加）
                        const newPath = { points: [], mode: drawMode, type: drawingType };
                        const pathsWithNewPath = [...loadedPaths, newPath];
                        const newCurrentPathIndex = pathsWithNewPath.length - 1;
                        
                        setPaths(pathsWithNewPath);
                        setCurrentPathIndex(newCurrentPathIndex);
                        
                        // 履歴を初期化（新しいパスを含めた状態で）
                        const initialHistory = [{
                            paths: JSON.parse(JSON.stringify(pathsWithNewPath)),
                            currentPathIndex: newCurrentPathIndex,
                            drawMode: drawMode,
                            drawingType: drawingType
                        }];
                        setHistory(initialHistory);
                        setHistoryIndex(0);
                        
                        // ファイル読み込み時は点を非表示にする
                        setShowPoints(false);
                        
                        saveToLocalStorage();
                        alert('色 / 仕様のカスタマイズファイルを読み込みました');
                        console.log('パスデータ復元完了:', loadedPaths.length, '個のパス');
                        return;
                    }
                    
                    // フォールバック: svgDataからパスデータを復元
                    if (projectData.svgData) {
                        try {
                            const svgDataParsed = typeof projectData.svgData === 'string' ? 
                                JSON.parse(projectData.svgData) : projectData.svgData;
                            
                            if (svgDataParsed && svgDataParsed.paths) {
                                // カスタマイズされた色設定のみ反映
                                // ストローク色は常に白色を強制適用
                                if (svgDataParsed.colors) {
                                    setColors({
                                        ...svgDataParsed.colors,
                                        strokePoint: '#ffffff',
                                        strokeLine: '#ffffff',
                                        fillPoint: '#10b981'
                                    });
                                }
                                
                                // 最適な初期視点を計算してモデルを画面中央に配置
                                const loadedPaths = svgDataParsed.paths;
                                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                                loadedPaths.forEach(pathObj => {
                                    if (pathObj && pathObj.points && pathObj.points.length > 0) {
                                        pathObj.points.forEach(point => {
                                            minX = Math.min(minX, point.x);
                                            minY = Math.min(minY, point.y);
                                            maxX = Math.max(maxX, point.x);
                                            maxY = Math.max(maxY, point.y);
                                        });
                                    }
                                });
                                
                                if (minX !== Infinity) {
                                    const modelWidth = maxX - minX;
                                    const modelHeight = maxY - minY;
                                    const modelCenterX = (minX + maxX) / 2;
                                    const modelCenterY = (minY + maxY) / 2;
                                    
                                    // 画面サイズに対してモデルが適切に収まるスケールを計算
                                    const screenWidth = window.innerWidth;
                                    const screenHeight = window.innerHeight;
                                    const isMobile = window.innerWidth <= 1280 || navigator.maxTouchPoints > 0;
                                    const padding = isMobile ? 5 : 200; // スマホは5px、PCは200pxの余白
                                    
                                    const scaleX = (screenWidth - padding * 2) / modelWidth;
                                    const scaleY = (screenHeight - padding * 2) / modelHeight;
                                    const optimalScale = Math.min(scaleX, scaleY, 1); // 最大1倍まで
                                    
                                    // モデル中央を画面中央に配置するオフセット計算
                                    const offsetX = screenWidth / 2 - modelCenterX * optimalScale;
                                    const offsetY = screenHeight / 2 - modelCenterY * optimalScale;
                                    
                                    setScale(optimalScale);
                                    setOffsetX(offsetX);
                                    setOffsetY(offsetY);
                                }
                                
                                // 適切なcurrentPathIndexを設定（新しいパスを追加）
                                const newPath = { points: [], mode: drawMode, type: drawingType };
                                const pathsWithNewPath = [...loadedPaths, newPath];
                                const newCurrentPathIndex = pathsWithNewPath.length - 1;
                                
                                setPaths(pathsWithNewPath);
                                setCurrentPathIndex(newCurrentPathIndex);
                                
                                // 履歴を初期化（新しいパスを含めた状態で）
                                const initialHistory = [{
                                    paths: JSON.parse(JSON.stringify(pathsWithNewPath)),
                                    currentPathIndex: newCurrentPathIndex,
                                    drawMode: drawMode,
                                    drawingType: drawingType
                                }];
                                setHistory(initialHistory);
                                setHistoryIndex(0);
                                
                                saveToLocalStorage();
                                alert('色 / 仕様のカスタマイズファイルを読み込みました');
                                return;
                            }
                        } catch (parseError) {
                            console.error('svgData parsing error:', parseError);
                        }
                    }
                    
                    // より詳細なエラーメッセージを表示
                    if (!projectData.svgData && !projectData.neonPaths) {
                        alert('色 / 仕様のカスタマイズファイルに下絵データが含まれていません');
                    } else {
                        alert('色 / 仕様のカスタマイズファイルの下絵データの形式が正しくありません');
                    }
                    console.log('Debug: projectData structure:', projectData);
                    return;
                }
                
                // 描画状態を復元
                if (projectData.drawing) {
                    const { paths: loadedPaths, currentPathIndex: loadedIndex, drawMode: loadedDrawMode, 
                            drawingType: loadedDrawingType, history: loadedHistory, historyIndex: loadedHistoryIndex } = projectData.drawing;
                    
                    if (loadedPaths && Array.isArray(loadedPaths)) {
                        // 新しい空のパスを末尾に追加して、currentPathIndexをそこに設定
                        const newPath = { points: [], mode: drawMode, type: drawingType };
                        const pathsWithNewPath = [...loadedPaths, newPath];
                        const newCurrentPathIndex = pathsWithNewPath.length - 1;
                        
                        setPaths(pathsWithNewPath);
                        setCurrentPathIndex(newCurrentPathIndex);
                    }
                    if (loadedDrawMode) {
                        setDrawMode(loadedDrawMode);
                    }
                    if (loadedDrawingType) {
                        setDrawingType(loadedDrawingType);
                    }
                    
                    // 履歴を復元または初期化
                    if (loadedHistory && Array.isArray(loadedHistory) && loadedHistory.length > 0) {
                        setHistory(loadedHistory);
                        setHistoryIndex(loadedHistoryIndex !== undefined ? loadedHistoryIndex : loadedHistory.length - 1);
                    } else if (loadedPaths && Array.isArray(loadedPaths)) {
                        // 履歴がない場合は読み込んだデータで履歴を初期化（新しいパスを含む）
                        const newPath = { points: [], mode: drawMode, type: drawingType };
                        const pathsWithNewPath = [...loadedPaths, newPath];
                        const newCurrentPathIndex = pathsWithNewPath.length - 1;
                        
                        const initialHistory = [{
                            paths: JSON.parse(JSON.stringify(pathsWithNewPath)),
                            currentPathIndex: newCurrentPathIndex,
                            drawMode: loadedDrawMode || 'stroke',
                            drawingType: loadedDrawingType || 'spline'
                        }];
                        setHistory(initialHistory);
                        setHistoryIndex(0);
                    }
                }
                
                // UI設定を復元
                if (projectData.settings) {
                    const settings = projectData.settings;
                    if (settings.scale !== undefined) setScale(settings.scale);
                    if (settings.offsetX !== undefined) setOffsetX(settings.offsetX);
                    if (settings.offsetY !== undefined) setOffsetY(settings.offsetY);
                    if (settings.backgroundImage !== undefined) setBackgroundImage(settings.backgroundImage);
                    if (settings.initialBgImageWidth !== undefined) setInitialBgImageWidth(settings.initialBgImageWidth);
                    if (settings.initialBgImageHeight !== undefined) setInitialBgImageHeight(settings.initialBgImageHeight);
                    if (settings.bgImageScale !== undefined) setBgImageScale(settings.bgImageScale);
                    if (settings.bgImageX !== undefined) setBgImageX(settings.bgImageX);
                    if (settings.bgImageY !== undefined) setBgImageY(settings.bgImageY);
                    if (settings.bgImageOpacity !== undefined) setBgImageOpacity(settings.bgImageOpacity);
                    if (settings.showGrid !== undefined) setShowGrid(settings.showGrid);
                    if (settings.gridSize !== undefined) setGridSize(settings.gridSize);
                    if (settings.gridOpacity !== undefined) setGridOpacity(settings.gridOpacity);
                    if (settings.colors) setColors(settings.colors);
                    if (settings.lineWidths) setLineWidths(settings.lineWidths);
                }
                
                // キャンバス設定を復元
                if (projectData.canvas) {
                    if (projectData.canvas.width) setCanvasWidth(projectData.canvas.width);
                    if (projectData.canvas.height) setCanvasHeight(projectData.canvas.height);
                    if (projectData.canvas.segmentsPerCurve) setSegmentsPerCurve(projectData.canvas.segmentsPerCurve);
                }
                
                // LocalStorageにも保存
                saveToLocalStorage();
                
                console.log('プロジェクト復元完了');
                
                // ネオン下絵でファイルが読み込まれたことをLaserCutImageProcessorに通知（カスタマイズの状態をクリアするため）
                const clearStateEvent = new CustomEvent('clearCustomizeState');
                window.dispatchEvent(clearStateEvent);
                
                alert('ネオンプロジェクトを読み込みました');
                
            } catch (error) {
                console.error('プロジェクトファイルの読み込みに失敗:', error);
                alert('ファイルの読み込みに失敗しました。正しいネオンプロジェクトファイルを選択してください。');
            }
        };
        
        reader.readAsText(file);
    }, [saveToLocalStorage]);

    // カスタマイズコンポーネントからの共有ファイルデータを処理
    useEffect(() => {
        if (sharedFileData && onSharedFileDataProcessed) {
            try {
                console.log('カスタマイズからの共有ファイルデータを受信:', sharedFileData);
                
                // カスタマイズからの読み込みフラグを設定
                if (sharedFileData.isCustomizeLoad) {
                    hasLoadedFromCustomize.current = true;
                    console.log('カスタマイズからの読み込みフラグを設定しました');
                }
                
                // ネオンパスデータを読み込み
                if (sharedFileData.neonPaths && sharedFileData.neonPaths.length > 0) {
                    const loadedPaths = sharedFileData.neonPaths;
                    
                    // 最適視点を計算（ファイル読み込み処理と同様）
                    const allPoints = [];
                    loadedPaths.forEach(pathObj => {
                        if (pathObj && pathObj.points) {
                            allPoints.push(...pathObj.points);
                        }
                    });
                    
                    if (allPoints.length > 0) {
                        const minX = Math.min(...allPoints.map(p => p.x));
                        const maxX = Math.max(...allPoints.map(p => p.x));
                        const minY = Math.min(...allPoints.map(p => p.y));
                        const maxY = Math.max(...allPoints.map(p => p.y));
                        
                        const modelWidth = maxX - minX;
                        const modelHeight = maxY - minY;
                        const modelCenterX = (minX + maxX) / 2;
                        const modelCenterY = (minY + maxY) / 2;
                        
                        // 画面サイズに対してモデルが適切に収まるスケールを計算
                        const screenWidth = window.innerWidth;
                        const screenHeight = window.innerHeight;
                        const isMobile = window.innerWidth <= 1280 || navigator.maxTouchPoints > 0;
                        const padding = isMobile ? 20 : 200; // スマホは20px、PCは200pxの余白
                        
                        const scaleX = (screenWidth - padding * 2) / modelWidth;
                        const scaleY = (screenHeight - padding * 2) / modelHeight;
                        const optimalScale = Math.min(scaleX, scaleY, 1); // 最大1倍まで
                        
                        // モデル中央を画面中央に配置するオフセット計算
                        const offsetX = screenWidth / 2 - modelCenterX * optimalScale;
                        const offsetY = screenHeight / 2 - modelCenterY * optimalScale;
                        
                        setScale(optimalScale);
                        setOffsetX(offsetX);
                        setOffsetY(offsetY);
                    }
                    
                    // 新しいパスを追加（現在の描画モードで）
                    const newPath = { points: [], mode: drawMode, type: drawingType };
                    const pathsWithNewPath = [...loadedPaths, newPath];
                    const newCurrentPathIndex = pathsWithNewPath.length - 1;
                    
                    setPaths(pathsWithNewPath);
                    setCurrentPathIndex(newCurrentPathIndex);
                    
                    // 履歴を初期化
                    const initialHistory = [{
                        paths: pathsWithNewPath,
                        currentPathIndex: newCurrentPathIndex
                    }];
                    setHistory(initialHistory);
                    setHistoryIndex(0);
                }
                
                // 色設定を復元
                // ストローク色は常に白色を強制適用
                if (sharedFileData.neonColors) {
                    setColors({
                        ...sharedFileData.neonColors,
                        strokePoint: '#ffffff',
                        strokeLine: '#ffffff',
                        fillPoint: '#10b981'
                    });
                }
                
                // 線幅設定を復元（ただし骨組み描画用の太さに調整）
                if (sharedFileData.neonLineWidths) {
                    const adjustedLineWidths = {
                        ...sharedFileData.neonLineWidths,
                        strokeLine: 4 // 骨組み描画用の太さに固定
                    };
                    setLineWidths(adjustedLineWidths);
                } else {
                    // デフォルトの骨組み描画の線幅を設定
                    setLineWidths(prev => ({
                        ...prev,
                        strokeLine: 4
                    }));
                }
                
                // キャンバス設定を復元（視点情報は除く）
                if (sharedFileData.canvasSettings) {
                    const settings = sharedFileData.canvasSettings;
                    if (settings.showGrid !== undefined) setShowGrid(settings.showGrid);
                    if (settings.gridSize !== undefined) setGridSize(settings.gridSize);
                    if (settings.gridOpacity !== undefined) setGridOpacity(settings.gridOpacity);
                }
                
                // LocalStorageに保存
                saveToLocalStorage();
                
                // カスタマイズからの読み込み完了フラグを設定
                hasLoadedFromCustomize.current = true;
                
                console.log('カスタマイズからの共有ファイルデータの処理完了');
                
                // 処理完了を通知（親コンポーネントで状態をクリア）
                onSharedFileDataProcessed();
                
            } catch (error) {
                console.error('共有ファイルデータの処理に失敗:', error);
                onSharedFileDataProcessed(); // エラーでも状態をクリア
            }
        }
    }, [sharedFileData, onSharedFileDataProcessed, drawMode, drawingType, saveToLocalStorage]);

    // 初期描画（またはpaths変更時）にスプラインを描画
    useEffect(() => {
        drawSpline();
    }, [paths, drawSpline]);

    // コンポーネントマウント時にキャンバスを再描画
    useEffect(() => {
        drawSpline();
    }, [drawSpline]);

    // キャンバスサイズ変更時にも再描画
    useEffect(() => {
        if (canvasWidth > 0 && canvasHeight > 0) {
            drawSpline();
        }
    }, [canvasWidth, canvasHeight, drawSpline]);

    // 背景画像設定モーダルを開くイベントリスナー
    useEffect(() => {
        const handleOpenBgModal = () => {
            setShowBgModal(true);
            setSidebarVisible(false);
        };

        window.addEventListener('openBgModal', handleOpenBgModal);
        return () => window.removeEventListener('openBgModal', handleOpenBgModal);
    }, []);

    // キャンバスのサイズを画面サイズに合わせる
    useEffect(() => {
        const handleResize = () => {
            const newWidth = window.innerWidth;
            const newHeight = window.innerHeight;
            
            setCanvasWidth(newWidth);
            setCanvasHeight(newHeight);
            
            // 初期表示時は原点を中央に配置
            // 初期表示時は保存された視点状態を復元、なければ中央に配置
            // ただし、offsetXとoffsetYが初期値(0)の場合のみ
            if (offsetX === 0 && offsetY === 0) {
                const savedViewState = sessionStorage.getItem('neonDrawingViewState');
                if (savedViewState) {
                    try {
                        const viewState = JSON.parse(savedViewState);
                        setOffsetX(viewState.offsetX || newWidth / 2);
                        setOffsetY(viewState.offsetY || newHeight / 2);
                        setScale(viewState.scale || 1);
                    } catch (error) {
                        console.error('視点状態の復元エラー:', error);
                        setOffsetX(newWidth / 2);
                        setOffsetY(newHeight / 2);
                    }
                } else {
                    setOffsetX(newWidth / 2);
                    setOffsetY(newHeight / 2);
                }
            }
        };

        window.addEventListener('resize', handleResize);
        handleResize(); // 初回ロード時に実行
        return () => window.removeEventListener('resize', handleResize);
    }, [offsetX, offsetY]); // offsetX, offsetYが初期値でない場合はリサイズ時に中央に移動しない

    // キャンバスのdevicePixelRatio対応設定
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const pixelRatio = window.devicePixelRatio || 1;
        
        // CSS上のサイズを取得
        const displayWidth = canvasWidth;
        const displayHeight = canvasHeight;
        
        // 物理解像度を設定（pixelRatio倍）
        canvas.width = displayWidth * pixelRatio;
        canvas.height = displayHeight * pixelRatio;
        
        // CSS上のサイズは変更しない
        canvas.style.width = displayWidth + 'px';
        canvas.style.height = displayHeight + 'px';
        
        // 描画コンテキストをpixelRatio倍にスケール
        ctx.scale(pixelRatio, pixelRatio);
        
        // 再描画をトリガー
        drawSpline();
    }, [canvasWidth, canvasHeight, drawSpline]);

    // 描画モード (チューブ/ベースプレート) を設定
    const handleSetDrawMode = useCallback((mode) => {
        // ベースプレートモードで既にベースプレート面が存在する場合はブロック
        if (mode === 'fill') {
            const existingFillPaths = paths.filter(pathObj =>
                pathObj && pathObj.mode === 'fill' && pathObj.points && pathObj.points.length >= 3
            );
            if (existingFillPaths.length >= 1) {
                alert('ベースプレートは1つまでしか作成できません。既存のベースプレートを削除してから新しいものを作成してください。');
                return;
            }
        } else {
            // チューブモードの場合は描画タイプをデフォルトのスプラインに戻す
            setDrawingType('spline'); // チューブは常にスプライン描画として扱う
        }
        setDrawMode(mode);
        
        // モード変更時は新しいパスボタンを有効化
        setIsNewPathDisabled(false);

        setPaths(prevPaths => {
            const newPaths = [...prevPaths];
            // 現在のパスが空の場合のみモードを更新（履歴保存はしない - キャンバスに変化がないため）
            // 既に点が打たれている場合は、モード切り替えは無効（ボタンがdisabledになるためここには来ないはずだが念のため）
            if (newPaths[currentPathIndex] && newPaths[currentPathIndex].points.length === 0) {
                   newPaths[currentPathIndex] = { ...newPaths[currentPathIndex], mode: mode, type: (mode === 'stroke' ? 'spline' : drawingType) };
            }
            return newPaths;
        });
    }, [currentPathIndex, drawingType, paths]);

    // 描画タイプ (スプライン/直線/自動長方形) を設定
    const handleSetDrawingType = useCallback((type) => {
        if (type === 'rectangle') {
            // 自動長方形の場合は先にベースプレートの重複チェック
            const existingFillPaths = paths.filter(pathObj =>
                pathObj && pathObj.mode === 'fill' && pathObj.points && pathObj.points.length >= 3
            );
            if (existingFillPaths.length >= 1) {
                alert('ベースプレートは1つまでしか作成できません。既存のベースプレートを削除してから新しいものを作成してください。');
                return;
            }

            // 自動長方形の場合はモーダルを開く
            setShowRectangleModal(true);
            setSidebarVisible(false);
            return;
        }

        if (type === 'circle') {
            // 自動円の場合は先にベースプレートの重複チェック
            const existingFillPaths = paths.filter(pathObj =>
                pathObj && pathObj.mode === 'fill' && pathObj.points && pathObj.points.length >= 3
            );
            if (existingFillPaths.length >= 1) {
                alert('ベースプレートは1つまでしか作成できません。既存のベースプレートを削除してから新しいものを作成してください。');
                return;
            }

            // 自動円の場合はモーダルを開く
            setShowCircleModal(true);
            setSidebarVisible(false);
            return;
        }

        if (type === 'auto-shape') {
            // 自動形状の場合は先にベースプレートの重複チェック
            const existingFillPaths = paths.filter(pathObj => 
                pathObj && pathObj.mode === 'fill' && pathObj.points && pathObj.points.length >= 3
            );
            if (existingFillPaths.length >= 1) {
                alert('ベースプレートは1つまでしか作成できません。既存のベースプレートを削除してから新しいものを作成してください。');
                return;
            }
            
            // ネオンパス（strokeモード）が存在するかチェック
            const strokePaths = paths.filter(pathObj => 
                pathObj && pathObj.mode === 'stroke' && pathObj.points && pathObj.points.length >= 2
            );
            if (strokePaths.length === 0) {
                alert('ネオンパス（チューブ）を先に描画してください。');
                return;
            }
            
            // 自動形状ベースプレートを生成
            const autoShapeBase = generateAutoShapeBase(strokePaths, 3); // デフォルト3cm余白
            if (autoShapeBase) {
                // 新しいベースプレートパスを作成
                const newPath = {
                    points: autoShapeBase,
                    mode: 'fill',
                    type: 'straight'
                };
                
                // パスを追加
                setPaths(prevPaths => {
                    const newPaths = [...prevPaths];
                    // 既存のベースプレートパスを削除（1つのベースプレートのみ許可）
                    const filteredPaths = newPaths.filter(path => path.mode !== 'fill');
                    // 新しいベースプレートパスを追加
                    filteredPaths.push(newPath);
                    
                    // 履歴に保存（新しいパス状態で）
                    setTimeout(() => {
                        saveToHistory(filteredPaths, currentPathIndex, drawMode, drawingType);
                    }, 0);
                    
                    return filteredPaths;
                });
            }

            return;
        }

        setDrawingType(type);

        setPaths(prevPaths => {
            const newPaths = [...prevPaths];
            // 新しいパスまたは現在の空パスのタイプのみを更新（履歴保存はしない - キャンバスに変化がないため）
            // 既存のパス（点が既に追加されているパス）のタイプは変更しない
            if (!newPaths[currentPathIndex] || newPaths[currentPathIndex].points.length === 0) {
                newPaths[currentPathIndex] = { points: [], mode: drawMode, type: type };
            }
            return newPaths;
        });
    }, [currentPathIndex, drawMode, paths]);

    // すべてのネオンパスの境界を計算する関数
    const calculatePathsBounds = useCallback(() => {
        if (!paths || paths.length === 0) return null;
        
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        let hasValidPoints = false;
        
        paths.forEach(path => {
            if (path && path.points && path.points.length > 0) {
                path.points.forEach(point => {
                    if (point && typeof point.x === 'number' && typeof point.y === 'number') {
                        minX = Math.min(minX, point.x);
                        minY = Math.min(minY, point.y);
                        maxX = Math.max(maxX, point.x);
                        maxY = Math.max(maxY, point.y);
                        hasValidPoints = true;
                    }
                });
            }
        });
        
        if (!hasValidPoints) return null;
        
        return { minX, minY, maxX, maxY };
    }, [paths]);

    // 長方形ベースプレートの座標を計算する関数
    const calculateRectangleBase = useCallback((marginCm) => {
        const bounds = calculatePathsBounds();
        if (!bounds) return null;
        
        // cmをピクセルに変換 (100px = 4cm基準)
        const marginPx = (marginCm * 100) / 4;
        
        return {
            x: bounds.minX - marginPx,
            y: bounds.minY - marginPx,
            width: (bounds.maxX - bounds.minX) + (marginPx * 2),
            height: (bounds.maxY - bounds.minY) + (marginPx * 2)
        };
    }, [calculatePathsBounds]);

    // 円形ベースプレートの座標を計算する関数
    const calculateCircleBase = useCallback((marginCm) => {
        const bounds = calculatePathsBounds();
        if (!bounds) return null;

        // cmをピクセルに変換 (100px = 4cm基準)
        const marginPx = (marginCm * 100) / 4;

        // 中心座標を計算
        const centerX = (bounds.minX + bounds.maxX) / 2;
        const centerY = (bounds.minY + bounds.maxY) / 2;

        // 全ての点から最も遠い点までの距離を計算
        const width = bounds.maxX - bounds.minX;
        const height = bounds.maxY - bounds.minY;
        const radius = Math.sqrt(width * width + height * height) / 2 + marginPx;

        return { centerX, centerY, radius };
    }, [calculatePathsBounds]);

    // 楕円周上に密に点を配置する関数
    const subdivideEllipseEdge = useCallback((ellipseBase, spacing = 5) => {
        const points = [];
        const { centerX, centerY, radiusX, radiusY } = ellipseBase;

        // 楕円の周長の近似値（Ramanujanの公式）
        const h = Math.pow((radiusX - radiusY), 2) / Math.pow((radiusX + radiusY), 2);
        const circumference = Math.PI * (radiusX + radiusY) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));

        // 必要な点の数
        const numPoints = Math.max(50, Math.ceil(circumference / spacing));

        // 楕円周上に等間隔で点を配置
        for (let i = 0; i < numPoints; i++) {
            const angle = (2 * Math.PI * i) / numPoints;
            points.push({
                x: centerX + radiusX * Math.cos(angle),
                y: centerY + radiusY * Math.sin(angle)
            });
        }

        return points;
    }, []);

    // 円周上に密に点を配置する関数
    const subdivideCircleEdge = useCallback((circleBase, spacing = 5) => {
        const points = [];
        const { centerX, centerY, radius } = circleBase;

        // 円周の長さ
        const circumference = 2 * Math.PI * radius;
        // 必要な点の数
        const numPoints = Math.max(50, Math.ceil(circumference / spacing));

        // 円周上に等間隔で点を配置
        for (let i = 0; i < numPoints; i++) {
            const angle = (2 * Math.PI * i) / numPoints;
            points.push({
                x: centerX + radius * Math.cos(angle),
                y: centerY + radius * Math.sin(angle)
            });
        }

        return points;
    }, []);

    // 長方形の辺上に密に点を追加する関数（角丸対応）
    const subdivideRectangleEdges = useCallback((rectangleBase, spacing = 10, radiusCm = 0) => {
        const points = [];
        const { x, y, width, height } = rectangleBase;

        // cmをピクセルに変換 (100px = 4cm基準)
        const radiusPx = (radiusCm * 100) / 4;
        const effectiveRadius = Math.min(radiusPx, width / 2, height / 2); // 半径が大きすぎる場合は制限

        if (effectiveRadius <= 0) {
            // 角丸なしの場合、角を直角に保つため角を中心に両側に点を密に配置
            const cornerDensity = 10; // 角の各側の点の数
            const cornerSpacing = 0.5; // 角近くの点の間隔

            // 上辺（右上角の手前まで）
            const topPoints = Math.max(2, Math.ceil(width / spacing));
            for (let i = 0; i < topPoints - 1; i++) {
                const ratio = i / (topPoints - 1);
                points.push({ x: x + (width * ratio), y: y });
            }

            // 右上角：上辺側に密な点を配置
            for (let i = cornerDensity; i >= 1; i--) {
                points.push({ x: x + width - (i * cornerSpacing), y: y });
            }
            // 右上角の頂点
            points.push({ x: x + width, y: y });
            // 右上角：右辺側に密な点を配置
            for (let i = 1; i <= cornerDensity; i++) {
                points.push({ x: x + width, y: y + (i * cornerSpacing) });
            }

            // 右辺（右下角の手前まで）
            const rightPoints = Math.max(2, Math.ceil(height / spacing));
            for (let i = 1; i < rightPoints - 1; i++) {
                const ratio = i / (rightPoints - 1);
                points.push({ x: x + width, y: y + (height * ratio) });
            }

            // 右下角：右辺側に密な点を配置
            for (let i = cornerDensity; i >= 1; i--) {
                points.push({ x: x + width, y: y + height - (i * cornerSpacing) });
            }
            // 右下角の頂点
            points.push({ x: x + width, y: y + height });
            // 右下角：下辺側に密な点を配置
            for (let i = 1; i <= cornerDensity; i++) {
                points.push({ x: x + width - (i * cornerSpacing), y: y + height });
            }

            // 下辺（左下角の手前まで）
            const bottomPoints = Math.max(2, Math.ceil(width / spacing));
            for (let i = 1; i < bottomPoints - 1; i++) {
                const ratio = i / (bottomPoints - 1);
                points.push({ x: x + width - (width * ratio), y: y + height });
            }

            // 左下角：下辺側に密な点を配置
            for (let i = cornerDensity; i >= 1; i--) {
                points.push({ x: x + (i * cornerSpacing), y: y + height });
            }
            // 左下角の頂点
            points.push({ x: x, y: y + height });
            // 左下角：左辺側に密な点を配置
            for (let i = 1; i <= cornerDensity; i++) {
                points.push({ x: x, y: y + height - (i * cornerSpacing) });
            }

            // 左辺（左上角の手前まで）
            const leftPoints = Math.max(2, Math.ceil(height / spacing));
            for (let i = 1; i < leftPoints - 1; i++) {
                const ratio = i / (leftPoints - 1);
                points.push({ x: x, y: y + height - (height * ratio) });
            }

            // 左上角：左辺側に密な点を配置
            for (let i = cornerDensity; i >= 1; i--) {
                points.push({ x: x, y: y + (i * cornerSpacing) });
            }
            // 左上角の頂点は始点なので追加しない
            // 左上角：上辺側に密な点を配置
            for (let i = 1; i <= cornerDensity; i++) {
                points.push({ x: x + (i * cornerSpacing), y: y });
            }
        } else {
            // 角丸ありの場合
            const r = effectiveRadius;

            // 上辺（左の角丸終了点から右の角丸開始点まで）
            const topStart = x + r;
            const topEnd = x + width - r;
            const topLength = topEnd - topStart;
            if (topLength > 0) {
                const topPoints = Math.max(2, Math.ceil(topLength / spacing));
                for (let i = 0; i < topPoints; i++) {
                    const ratio = i / (topPoints - 1);
                    points.push({ x: topStart + (topLength * ratio), y: y });
                }
            }

            // 右上の角丸（90度の円弧、上から右へ）
            // 角丸部分は非常に密に点を配置（2.5px間隔で滑らかに）
            const cornerPoints = Math.max(60, Math.ceil((Math.PI * r / 2) / 2.5));
            for (let i = 1; i <= cornerPoints; i++) {
                const angle = (Math.PI / 2) * (i / cornerPoints); // 0度から90度
                const cx = x + width - r;
                const cy = y + r;
                points.push({
                    x: cx + r * Math.sin(angle),
                    y: cy - r * Math.cos(angle)
                });
            }

            // 右辺（上の角丸終了点から下の角丸開始点まで）
            const rightStart = y + r;
            const rightEnd = y + height - r;
            const rightLength = rightEnd - rightStart;
            if (rightLength > 0) {
                const rightPoints = Math.max(2, Math.ceil(rightLength / spacing));
                for (let i = 1; i < rightPoints; i++) {
                    const ratio = i / (rightPoints - 1);
                    points.push({ x: x + width, y: rightStart + (rightLength * ratio) });
                }
            }

            // 右下の角丸（90度の円弧、右から下へ）
            for (let i = 1; i <= cornerPoints; i++) {
                const angle = (Math.PI / 2) * (i / cornerPoints);
                const cx = x + width - r;
                const cy = y + height - r;
                points.push({
                    x: cx + r * Math.cos(angle),
                    y: cy + r * Math.sin(angle)
                });
            }

            // 下辺（右の角丸終了点から左の角丸開始点まで）
            const bottomStart = x + width - r;
            const bottomEnd = x + r;
            const bottomLength = bottomStart - bottomEnd;
            if (bottomLength > 0) {
                const bottomPoints = Math.max(2, Math.ceil(bottomLength / spacing));
                for (let i = 1; i < bottomPoints; i++) {
                    const ratio = i / (bottomPoints - 1);
                    points.push({ x: bottomStart - (bottomLength * ratio), y: y + height });
                }
            }

            // 左下の角丸（90度の円弧、下から左へ）
            for (let i = 1; i <= cornerPoints; i++) {
                const angle = (Math.PI / 2) * (i / cornerPoints);
                const cx = x + r;
                const cy = y + height - r;
                points.push({
                    x: cx - r * Math.sin(angle),
                    y: cy + r * Math.cos(angle)
                });
            }

            // 左辺（下の角丸終了点から上の角丸開始点まで）
            const leftStart = y + height - r;
            const leftEnd = y + r;
            const leftLength = leftStart - leftEnd;
            if (leftLength > 0) {
                const leftPoints = Math.max(2, Math.ceil(leftLength / spacing));
                for (let i = 1; i < leftPoints; i++) {
                    const ratio = i / (leftPoints - 1);
                    points.push({ x: x, y: leftStart - (leftLength * ratio) });
                }
            }

            // 左上の角丸（90度の円弧、左から上へ）- 最後の点まで含める
            for (let i = 1; i <= cornerPoints; i++) {
                const angle = (Math.PI / 2) * (i / cornerPoints);
                const cx = x + r;
                const cy = y + r;
                points.push({
                    x: cx - r * Math.cos(angle),
                    y: cy - r * Math.sin(angle)
                });
            }
        }

        return points;
    }, []);

    // 外積計算（左折判定用）
    const crossProduct = useCallback((o, a, b) => {
        return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    }, []);
    
    // 凸包計算（Graham scan アルゴリズム）
    const calculateConvexHull = useCallback((points) => {
        if (points.length < 3) return points;
        
        // 重複点を除去
        const uniquePoints = [];
        const seen = new Set();
        for (const point of points) {
            const key = `${Math.round(point.x)},${Math.round(point.y)}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniquePoints.push(point);
            }
        }
        
        if (uniquePoints.length < 3) return uniquePoints;
        
        // 最下点（Y座標最小、同じならX座標最小）を探す
        let start = uniquePoints[0];
        for (let i = 1; i < uniquePoints.length; i++) {
            const p = uniquePoints[i];
            if (p.y < start.y || (p.y === start.y && p.x < start.x)) {
                start = p;
            }
        }
        
        // 極角でソート
        const sortedPoints = uniquePoints
            .filter(p => p !== start)
            .sort((a, b) => {
                const angleA = Math.atan2(a.y - start.y, a.x - start.x);
                const angleB = Math.atan2(b.y - start.y, b.x - start.x);
                if (angleA !== angleB) return angleA - angleB;
                // 同じ角度の場合は距離で比較
                const distA = (a.x - start.x) ** 2 + (a.y - start.y) ** 2;
                const distB = (b.x - start.x) ** 2 + (b.y - start.y) ** 2;
                return distA - distB;
            });
        
        // Graham scan
        const hull = [start];
        
        for (const point of sortedPoints) {
            // 左折するまで最後の点を除去
            while (hull.length > 1 && crossProduct(hull[hull.length - 2], hull[hull.length - 1], point) <= 0) {
                hull.pop();
            }
            hull.push(point);
        }
        
        return hull;
    }, [crossProduct]);

    // 自動形状ベースプレート生成アルゴリズム（完全一定距離オフセット方式）
    const generateAutoShapeBase = useCallback((strokePaths, marginCm) => {
        try {
            // cmをピクセルに変換 (100px = 4cm基準)
            const marginPx = (marginCm * 100) / 4;
            
            // 全てのネオンパスの点を収集
            const allNeonPoints = [];
            strokePaths.forEach(pathObj => {
                if (pathObj && pathObj.points && pathObj.points.length >= 1) {
                    pathObj.points.forEach(point => {
                        allNeonPoints.push({ x: point.x, y: point.y });
                    });
                }
            });
            
            if (allNeonPoints.length === 0) return null;
            
            // 各ネオン点から指定距離の円を描き、すべての円の外包を計算
            const offsetPoints = [];
            
            // 各ネオン点について、360度方向にオフセット点を生成
            allNeonPoints.forEach(neonPoint => {
                for (let angle = 0; angle < 360; angle += 5) { // 5度刻み
                    const rad = (angle * Math.PI) / 180;
                    const offsetPoint = {
                        x: neonPoint.x + Math.cos(rad) * marginPx,
                        y: neonPoint.y + Math.sin(rad) * marginPx
                    };
                    offsetPoints.push(offsetPoint);
                }
            });
            
            // 凸包を計算して最終的な境界を取得
            const boundary = calculateConvexHull(offsetPoints);
            
            return boundary;
            
        } catch (error) {
            console.error('自動形状ベースプレート生成エラー:', error);
            alert('形状が複雑すぎてベースプレートを生成できませんでした。長方形ベースプレートをお試しください。');
            return null;
        }
    }, [calculateConvexHull]);

    // 真のオフセット曲線生成（完全一定距離保証）
    const generateOffsetCurve = useCallback((pathObj, offsetDistance) => {
        if (!pathObj || !pathObj.points || pathObj.points.length < 2) return [];
        
        const points = pathObj.points;
        const offsetPoints = [];
        
        // 各点で垂直オフセットを計算（角度補正なし）
        for (let i = 0; i < points.length; i++) {
            const curr = points[i];
            
            // 前後の点のインデックス
            const prevIdx = i === 0 ? points.length - 1 : i - 1;
            const nextIdx = i === points.length - 1 ? 0 : i + 1;
            
            const prev = points[prevIdx];
            const next = points[nextIdx];
            
            // 接線ベクトルを計算（前後の点から）
            let tangent;
            if (i === 0 || i === points.length - 1) {
                // 端点では隣の点への方向を使用
                const neighbor = i === 0 ? next : prev;
                tangent = {
                    x: neighbor.x - curr.x,
                    y: neighbor.y - curr.y
                };
            } else {
                // 中間点では前後の点を結ぶ方向を使用
                tangent = {
                    x: next.x - prev.x,
                    y: next.y - prev.y
                };
            }
            
            // 接線ベクトルを正規化
            const tangentLen = Math.sqrt(tangent.x * tangent.x + tangent.y * tangent.y);
            if (tangentLen > 0) {
                tangent.x /= tangentLen;
                tangent.y /= tangentLen;
            }
            
            // 法線ベクトル（左に90度回転）
            const normal = { x: -tangent.y, y: tangent.x };
            
            // オフセット点を計算（常に一定距離）
            const offsetPoint = {
                x: curr.x + normal.x * offsetDistance,
                y: curr.y + normal.y * offsetDistance
            };
            
            offsetPoints.push(offsetPoint);
        }
        
        return offsetPoints;
    }, []);

    // 複数のオフセットパスを統合（凸包ベース）
    const mergeOffsetPaths = useCallback((offsetPaths) => {
        if (offsetPaths.length === 0) return [];
        if (offsetPaths.length === 1) return offsetPaths[0];
        
        // 全ての点を収集
        let allPoints = [];
        offsetPaths.forEach(path => {
            allPoints = allPoints.concat(path);
        });
        
        if (allPoints.length === 0) return [];
        
        // 凸包を計算（Graham scan）
        const convexHull = calculateConvexHull(allPoints);
        
        return convexHull;
    }, []);
    
    // 重複する関数定義を削除

    // スプライン補間で密な点列を生成
    const interpolateSplinePath = useCallback((points) => {
        if (points.length < 2) return points;
        
        let interpolatedPoints = [];
        const segmentsPerCurve = 20; // 密度
        
        for (let i = 0; i < points.length; i++) {
            const p0 = points[(i - 1 + points.length) % points.length];
            const p1 = points[i];
            const p2 = points[(i + 1) % points.length];
            const p3 = points[(i + 2) % points.length];
            
            for (let t = 0; t < segmentsPerCurve; t++) {
                const step = t / segmentsPerCurve;
                const x = getCatmullRomPt(p0.x, p1.x, p2.x, p3.x, step);
                const y = getCatmullRomPt(p0.y, p1.y, p2.y, p3.y, step);
                interpolatedPoints.push({ x, y });
            }
        }
        
        return interpolatedPoints;
    }, []);

    // Alpha Shape アルゴリズム（へこみ対応）
    const calculateImprovedEnvelope = useCallback((points, radius) => {
        if (points.length === 0) return [];
        if (points.length === 1) {
            return generateCirclePoints(points[0], radius);
        }
        
        // Alpha Shape でへこみを保持した境界を計算
        const alphaShapePoints = calculateAlphaShape(points, radius);
        
        if (alphaShapePoints.length > 0) {
            return alphaShapePoints;
        }
        
        // Alpha Shape が失敗した場合は従来の包絡線計算
        return calculateFallbackEnvelope(points, radius);
    }, []);

    // Alpha Shape アルゴリズム実装
    const calculateAlphaShape = useCallback((points, radius) => {
        try {
            // デローネ三角分割を簡略化した手法
            const alpha = radius * 1.5; // Alpha値（調整可能）
            const boundaryEdges = [];
            
            // 格子ベースでのエッジ検出
            const gridSize = radius / 2;
            const gridMap = new Map();
            
            // 各点を円で拡張してグリッドに配置
            points.forEach((point, idx) => {
                const angleStep = Math.PI / 18; // 10度刻み
                for (let angle = 0; angle < 2 * Math.PI; angle += angleStep) {
                    const x = point.x + Math.cos(angle) * radius;
                    const y = point.y + Math.sin(angle) * radius;
                    
                    const gridX = Math.floor(x / gridSize);
                    const gridY = Math.floor(y / gridSize);
                    const key = `${gridX},${gridY}`;
                    
                    if (!gridMap.has(key)) {
                        gridMap.set(key, { x, y, sourceIdx: idx });
                    }
                }
            });
            
            // 境界エッジを検出
            const gridPoints = Array.from(gridMap.values());
            const boundary = extractBoundaryFromGrid(gridPoints, gridSize);
            
            return boundary;
            
        } catch (error) {
            console.log('Alpha Shape計算失敗、フォールバックに切り替え');
            return [];
        }
    }, []);

    // グリッドから境界を抽出
    const extractBoundaryFromGrid = useCallback((gridPoints, gridSize) => {
        if (gridPoints.length === 0) return [];
        
        // 各グリッド点について8方向の隣接をチェック
        const directions = [
            [-1, -1], [-1, 0], [-1, 1],
            [0, -1],           [0, 1],
            [1, -1],  [1, 0],  [1, 1]
        ];
        
        const occupiedCells = new Set();
        const cellToPoint = new Map();
        
        gridPoints.forEach(point => {
            const cellX = Math.floor(point.x / gridSize);
            const cellY = Math.floor(point.y / gridSize);
            const key = `${cellX},${cellY}`;
            
            occupiedCells.add(key);
            if (!cellToPoint.has(key)) {
                cellToPoint.set(key, point);
            }
        });
        
        // 境界セルを特定（隣接セルが全て埋まっていない）
        const boundaryCells = [];
        for (const cellKey of occupiedCells) {
            const [cellX, cellY] = cellKey.split(',').map(Number);
            
            let hasEmptyNeighbor = false;
            for (const [dx, dy] of directions) {
                const neighborKey = `${cellX + dx},${cellY + dy}`;
                if (!occupiedCells.has(neighborKey)) {
                    hasEmptyNeighbor = true;
                    break;
                }
            }
            
            if (hasEmptyNeighbor) {
                boundaryCells.push(cellKey);
            }
        }
        
        // 境界点を座標順に並べ替え
        const boundaryPoints = boundaryCells
            .map(key => cellToPoint.get(key))
            .filter(Boolean);
        
        if (boundaryPoints.length < 3) return boundaryPoints;
        
        // 角度でソートして境界を形成
        const center = {
            x: boundaryPoints.reduce((sum, p) => sum + p.x, 0) / boundaryPoints.length,
            y: boundaryPoints.reduce((sum, p) => sum + p.y, 0) / boundaryPoints.length
        };
        
        boundaryPoints.sort((a, b) => {
            const angleA = Math.atan2(a.y - center.y, a.x - center.x);
            const angleB = Math.atan2(b.y - center.y, b.x - center.x);
            return angleA - angleB;
        });
        
        return boundaryPoints;
    }, []);

    // フォールバック用の従来包絡線計算
    const calculateFallbackEnvelope = useCallback((points, radius) => {
        const envelopePoints = [];
        const angleStep = Math.PI / 90; // 2度刻み
        const centerPoint = {
            x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
            y: points.reduce((sum, p) => sum + p.y, 0) / points.length
        };
        
        for (let angle = 0; angle < 2 * Math.PI; angle += angleStep) {
            const direction = { x: Math.cos(angle), y: Math.sin(angle) };
            
            let maxDistance = -Infinity;
            let bestPoint = null;
            
            points.forEach(center => {
                const circlePoint = {
                    x: center.x + direction.x * radius,
                    y: center.y + direction.y * radius
                };
                
                const distance = (circlePoint.x - centerPoint.x) * direction.x + 
                               (circlePoint.y - centerPoint.y) * direction.y;
                
                if (distance > maxDistance) {
                    maxDistance = distance;
                    bestPoint = circlePoint;
                }
            });
            
            if (bestPoint) {
                envelopePoints.push(bestPoint);
            }
        }
        
        return envelopePoints;
    }, []);

    // 不要な突起を除去
    const removeExcessiveBulges = useCallback((points, radius) => {
        if (points.length < 3) return points;
        
        const smoothedPoints = [];
        const windowSize = Math.max(3, Math.ceil(radius / 20)); // 適応的なウィンドウサイズ
        
        for (let i = 0; i < points.length; i++) {
            const current = points[i];
            let sumX = current.x;
            let sumY = current.y;
            let count = 1;
            
            // 前後の点で平均化（ローパスフィルタ）
            for (let j = 1; j <= windowSize; j++) {
                const prevIdx = (i - j + points.length) % points.length;
                const nextIdx = (i + j) % points.length;
                
                sumX += points[prevIdx].x + points[nextIdx].x;
                sumY += points[prevIdx].y + points[nextIdx].y;
                count += 2;
            }
            
            smoothedPoints.push({
                x: sumX / count,
                y: sumY / count
            });
        }
        
        // 曲率が急激に変化する点を間引き
        const finalPoints = [];
        for (let i = 0; i < smoothedPoints.length; i += 2) { // 2点おきにサンプリング
            finalPoints.push(smoothedPoints[i]);
        }
        
        return finalPoints.length > 6 ? finalPoints : smoothedPoints;
    }, []);

    // 円周上の点を生成
    const generateCirclePoints = useCallback((center, radius) => {
        const points = [];
        const numPoints = 36; // 10度刻み
        
        for (let i = 0; i < numPoints; i++) {
            const angle = (i * 2 * Math.PI) / numPoints;
            points.push({
                x: center.x + Math.cos(angle) * radius,
                y: center.y + Math.sin(angle) * radius
            });
        }
        
        return points;
    }, []);

    // 描画モードボタンの無効化条件
    // 点修正モード中、点結合モード中、パス削除モード中、点削除モード中の場合のみ無効化
    const areDrawModeButtonsDisabled = isModifyingPoints || isMergeMode || isPathDeleteMode || isPointDeleteMode;

    // マウスイベントハンドラー
    const handleWheel = useCallback((e) => {
        // 長方形モーダル表示中はズーム可能、自動形状は除外
        
        // passive event listenerでは preventDefault は無効なので削除
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

        const isMobile = window.innerWidth <= 1280 || navigator.maxTouchPoints > 0;
        const minScale = isMobile ? 0.1 : 0.18; // スマホは0.05倍、PCは0.18倍まで縮小可能
        newScale = Math.max(minScale, Math.min(newScale, 20));

        // ズームの中心をマウスカーソルに合わせる
        setOffsetX(mouseX - (mouseX - offsetX) * (newScale / scale));
        setOffsetY(mouseY - (mouseY - offsetY) * (newScale / scale));
        setScale(newScale);
    }, [scale, offsetX, offsetY]);

    const handleMouseDown = useCallback((e) => {
        // モーダル表示中はクリック操作のみ無効化、パン操作は許可
        if (showRectangleModal && e.button !== 2) return;
        
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
            if (isMergeMode) {
                let closestPoint = null;
                let closestDistance = Infinity;
                const hitRadius = Math.max(POINT_HIT_RADIUS / scale, MIN_HIT_RADIUS);

                // 全てのパスの点をチェックして最も近い点を見つける
                for (let pathIdx = 0; pathIdx < paths.length; pathIdx++) {
                    if (!paths[pathIdx] || !Array.isArray(paths[pathIdx].points)) continue;
                    for (let ptIdx = 0; ptIdx < paths[pathIdx].points.length; ptIdx++) {
                        const p = paths[pathIdx].points[ptIdx];
                        const distance = Math.sqrt(
                            Math.pow(mouseContentX - p.x, 2) + Math.pow(mouseContentY - p.y, 2)
                        );
                        // ヒット判定内で最も近い点を記録
                        if (distance < hitRadius && distance < closestDistance) {
                            closestDistance = distance;
                            closestPoint = { pathIndex: pathIdx, pointIndex: ptIdx, x: p.x, y: p.y };
                        }
                    }
                }

                // 最も近い点があれば選択リストに追加
                if (closestPoint) {
                    // 点結合処理が行われたことをマーク（handleMouseClickをブロックするため）
                    didDragRef.current = true;

                    setSelectedPointsForMerge(prev => {
                        // 既に選択されている点は無視
                        const alreadySelected = prev.some(
                            p => p.pathIndex === closestPoint.pathIndex && p.pointIndex === closestPoint.pointIndex
                        );
                        if (alreadySelected) return prev;

                        const newSelection = [...prev, closestPoint];

                        // 2点選択されたら自動的に結合実行
                        if (newSelection.length === 2) {
                            const [point1, point2] = newSelection;

                            // 即座にパスを更新
                            setPaths(prevPaths => {
                                const newPaths = JSON.parse(JSON.stringify(prevPaths));
                                newPaths[point1.pathIndex].points[point1.pointIndex] = {
                                    x: newPaths[point2.pathIndex].points[point2.pointIndex].x,
                                    y: newPaths[point2.pathIndex].points[point2.pointIndex].y
                                };
                                saveToHistory(newPaths, currentPathIndex, drawMode, drawingType);
                                return newPaths;
                            });

                            // 選択をクリア
                            setSelectedPointsForMerge([]);

                            // 即座に点結合モードを解除（handleMouseClickが実行される前に）
                            setIsMergeMode(false);
                            setHoveredPointForMerge(null);

                            // 元の点表示状態に戻す
                            if (originalShowPointsState !== null) {
                                setShowPoints(originalShowPointsState);
                                setOriginalShowPointsState(null);
                            }

                            return newSelection;
                        }

                        return newSelection;
                    });
                }
            } else if (isModifyingPoints) {
                let closestPoint = null;
                let closestDistance = Infinity;
                const hitRadius = Math.max(POINT_HIT_RADIUS / scale, MIN_HIT_RADIUS);

                // 全てのパスの点をチェックして最も近い点を見つける
                for (let pathIdx = 0; pathIdx < paths.length; pathIdx++) {
                    if (!paths[pathIdx] || !Array.isArray(paths[pathIdx].points)) continue;
                    for (let ptIdx = 0; ptIdx < paths[pathIdx].points.length; ptIdx++) {
                        const p = paths[pathIdx].points[ptIdx];
                        const distance = Math.sqrt(
                            Math.pow(mouseContentX - p.x, 2) + Math.pow(mouseContentY - p.y, 2)
                        );
                        // ヒット判定内で最も近い点を記録
                        if (distance < hitRadius && distance < closestDistance) {
                            closestDistance = distance;
                            closestPoint = { pathIndex: pathIdx, pointIndex: ptIdx };
                        }
                    }
                }

                // 最も近い点があれば選択
                if (closestPoint) {
                    setActivePoint(closestPoint);
                }
            } else if (isPathDeleteMode) { // パス削除モード
                let pathToDeleteIdx = -1;
                let closestDistance = Infinity;
                const hitRadius = Math.max(POINT_HIT_RADIUS / scale, MIN_HIT_RADIUS);
                
                // 削除モード：最も近い点が所属するパス全体を削除
                for (let pathIdx = 0; pathIdx < paths.length; pathIdx++) {
                    if (!paths[pathIdx] || !Array.isArray(paths[pathIdx].points)) continue;
                    for (let ptIdx = 0; ptIdx < paths[pathIdx].points.length; ptIdx++) {
                        const p = paths[pathIdx].points[ptIdx];
                        const distance = Math.sqrt(
                            Math.pow(mouseContentX - p.x, 2) + Math.pow(mouseContentY - p.y, 2)
                        );
                        // ヒット判定内で最も近い点を記録
                        if (distance < hitRadius && distance < closestDistance) {
                            closestDistance = distance;
                            pathToDeleteIdx = pathIdx;
                        }
                    }
                }

                if (pathToDeleteIdx !== -1) {
                    setPaths(prevPaths => {
                        const newPaths = prevPaths.filter((_, index) => index !== pathToDeleteIdx);
                        let nextCurrentPathIndex;

                        if (newPaths.length === 0) {
                            newPaths.push({ points: [], mode: drawMode, type: drawingType });
                            nextCurrentPathIndex = 0;
                        } else {
                            if (pathToDeleteIdx < currentPathIndex) {
                                nextCurrentPathIndex = currentPathIndex - 1;
                            } else if (pathToDeleteIdx === currentPathIndex) {
                                nextCurrentPathIndex = newPaths.length - 1;
                            } else {
                                nextCurrentPathIndex = currentPathIndex;
                            }
                            nextCurrentPathIndex = Math.max(0, nextCurrentPathIndex);
                        }
                        
                        saveToHistory(newPaths, nextCurrentPathIndex, drawMode, drawingType); // 履歴を保存
                        setCurrentPathIndex(nextCurrentPathIndex);
                        
                        // パス削除通知: 他のコンポーネントでpathColors/pathThicknessを調整
                        if (onStateChange) {
                            setTimeout(() => {
                                const currentState = {
                                    paths: newPaths,
                                    currentPathIndex: nextCurrentPathIndex,
                                    drawMode: drawMode,
                                    drawingType: drawingType,
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
                                    lineWidths: lineWidths,
                                    pathDeletedIndex: pathToDeleteIdx // 削除されたパスのインデックス
                                };
                                onStateChange(currentState);
                            }, 0);
                        }
                        
                        return newPaths;
                    });
                }
            } else if (isPointDeleteMode) { // 点削除モード
                let pointToDelete = null;
                let closestDistance = Infinity;
                const hitRadius = Math.max(POINT_HIT_RADIUS / scale, MIN_HIT_RADIUS);
                
                // 最も近い点を見つけて削除
                for (let pathIdx = 0; pathIdx < paths.length; pathIdx++) {
                    if (!paths[pathIdx] || !Array.isArray(paths[pathIdx].points)) continue;
                    for (let ptIdx = 0; ptIdx < paths[pathIdx].points.length; ptIdx++) {
                        const p = paths[pathIdx].points[ptIdx];
                        const distance = Math.sqrt(
                            Math.pow(mouseContentX - p.x, 2) + Math.pow(mouseContentY - p.y, 2)
                        );
                        // ヒット判定内で最も近い点を記録
                        if (distance < hitRadius && distance < closestDistance) {
                            closestDistance = distance;
                            pointToDelete = { pathIndex: pathIdx, pointIndex: ptIdx };
                        }
                    }
                }

                if (pointToDelete) {
                    setPaths(prevPaths => {
                        const newPaths = [...prevPaths];
                        const { pathIndex, pointIndex } = pointToDelete;
                        
                        const updatedPoints = newPaths[pathIndex].points.filter((_, idx) => idx !== pointIndex);
                        
                        let nextCurrentPathIndex = currentPathIndex;

                        if (updatedPoints.length === 0) {
                            const filteredPaths = newPaths.filter((_, idx) => idx !== pathIndex);
                            if (filteredPaths.length === 0) {
                                filteredPaths.push({ points: [], mode: drawMode, type: drawingType });
                                nextCurrentPathIndex = 0;
                            } else {
                                if (pathIndex < currentPathIndex) {
                                    nextCurrentPathIndex = currentPathIndex - 1;
                                } else if (pathIndex === currentPathIndex) {
                                    nextCurrentPathIndex = filteredPaths.length - 1;
                                } else {
                                    nextCurrentPathIndex = currentPathIndex;
                                }
                                nextCurrentPathIndex = Math.max(0, nextCurrentPathIndex);
                            }
                            saveToHistory(filteredPaths, nextCurrentPathIndex, drawMode, drawingType); // 履歴を保存
                            setCurrentPathIndex(nextCurrentPathIndex);
                            
                            // 点削除によるパス削除通知: 他のコンポーネントでpathColors/pathThicknessを調整
                            if (onStateChange) {
                                setTimeout(() => {
                                    const currentState = {
                                        paths: filteredPaths,
                                        currentPathIndex: nextCurrentPathIndex,
                                        drawMode: drawMode,
                                        drawingType: drawingType,
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
                                        lineWidths: lineWidths,
                                        pathDeletedIndex: pathIndex // 削除されたパスのインデックス
                                    };
                                    onStateChange(currentState);
                                }, 0);
                            }
                            
                            return filteredPaths;
                        } else {
                            newPaths[pathIndex] = { ...newPaths[pathIndex], points: updatedPoints };
                            saveToHistory(newPaths, currentPathIndex, drawMode, drawingType); // 履歴を保存
                            return newPaths;
                        }
                    });
                }
            }
        }
    }, [offsetX, offsetY, scale, paths, isModifyingPoints, isMergeMode, isPathDeleteMode, isPointDeleteMode, currentPathIndex, drawMode, drawingType, saveToHistory, originalShowPointsState]);

    const handleMouseMove = useCallback((e) => {
        // モーダル表示中はパン操作のみ許可
        if (showRectangleModal && !isPanning) return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();

        // 点結合モード時のホバー処理
        if (isMergeMode && !isPanning && activePoint === null) {
            const mouseContentX = (e.clientX - rect.left - offsetX) / scale;
            const mouseContentY = (e.clientY - rect.top - offsetY) / scale;

            let closestPoint = null;
            let closestDistance = Infinity;
            const hitRadius = Math.max(POINT_HIT_RADIUS / scale, MIN_HIT_RADIUS);

            // 全てのパスの点をチェックして最も近い点を見つける
            for (let pathIdx = 0; pathIdx < paths.length; pathIdx++) {
                if (!paths[pathIdx] || !Array.isArray(paths[pathIdx].points)) continue;
                for (let ptIdx = 0; ptIdx < paths[pathIdx].points.length; ptIdx++) {
                    const p = paths[pathIdx].points[ptIdx];
                    const distance = Math.sqrt(
                        Math.pow(mouseContentX - p.x, 2) + Math.pow(mouseContentY - p.y, 2)
                    );
                    if (distance < hitRadius && distance < closestDistance) {
                        closestDistance = distance;
                        closestPoint = { pathIndex: pathIdx, pointIndex: ptIdx };
                    }
                }
            }

            // ホバー中の点を更新
            if (closestPoint) {
                setHoveredPointForMerge(closestPoint);
            } else {
                setHoveredPointForMerge(null);
            }
        } else if (!isMergeMode && hoveredPointForMerge !== null) {
            // 点結合モードを抜けたらホバー状態をクリア
            setHoveredPointForMerge(null);
        }

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

            const rawNewPointX = (newRawClientX - offsetX) / scale;
            const rawNewPointY = (newRawClientY - offsetY) / scale;
            
            // 3m×3m制限を適用
            const { x: newPointX, y: newPointY } = limitCoordinates(rawNewPointX, rawNewPointY);

            // setPathsの関数形式で最新のpathsにアクセスし、直接更新
            setPaths(prevPaths => {
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
    }, [isPanning, lastPanX, lastPanY, activePoint, offsetX, offsetY, scale, isMergeMode, hoveredPointForMerge, paths]);

    const handleMouseUp = useCallback(() => {
        // モーダル表示中でもパン操作終了は許可
        if (showRectangleModal && !isPanning) return;
        
        // 点をドラッグした場合は履歴に保存
        if (activePoint !== null && didDragRef.current) {
            // ここでpathsはuseCallbackの依存配列に含まれているため、最新の値が取得できるはず
            saveToHistory(paths, currentPathIndex, drawMode, drawingType); 
        }
        setIsPanning(false);
        setActivePoint(null); // アクティブな点をリセット
    }, [activePoint, paths, currentPathIndex, drawMode, drawingType, saveToHistory]);

    // タッチイベントハンドラー
    const getTouchDistance = (touches) => {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    };

    const getTouchCenter = (touches) => {
        return {
            x: (touches[0].clientX + touches[1].clientX) / 2,
            y: (touches[0].clientY + touches[1].clientY) / 2
        };
    };

    const handlePointerDown = useCallback((e) => {
        e.preventDefault();
        
        // マウス、ペン、プライマリタッチを統一処理
        const pointerEvent = {
            button: e.button,
            clientX: e.clientX,
            clientY: e.clientY,
            preventDefault: () => {}
        };
        handleMouseDown(pointerEvent);
    }, [handleMouseDown]);

    const handlePointerMove = useCallback((e) => {
        e.preventDefault();
        
        // マウス、ペン、プライマリタッチを統一処理
        const pointerEvent = {
            clientX: e.clientX,
            clientY: e.clientY,
            preventDefault: () => {}
        };
        handleMouseMove(pointerEvent);
    }, [handleMouseMove]);


    const handleMouseLeave = useCallback(() => {
        // モーダル表示中でもパン操作終了は許可
        
        setIsPanning(false);
        setActivePoint(null);
    }, []);

    const handlePointerLeave = useCallback((e) => {
        e.preventDefault();
        
        // マウスリーブと同じ処理
        handleMouseLeave();
    }, [handleMouseLeave]);

    const handleTouchStart = useCallback((e) => {
        if (e.touches.length === 2) {
            // 2本指: パン・ズーム開始
            const distance = getTouchDistance(e.touches);
            const center = getTouchCenter(e.touches);
            
            setLastTouchDistance(distance);
            setTouchStartScale(scale);
            setLastTouchCenter(center);
            setIsPanning(true);
        }
        // 1本指の処理はPointer Eventsに任せる
    }, [scale]);

    const handleTouchMove = useCallback((e) => {
        if (e.touches.length === 2 && isPanning) {
            const distance = getTouchDistance(e.touches);
            const center = getTouchCenter(e.touches);
            
            // ピンチズーム
            if (lastTouchDistance > 0) {
                const scaleChange = distance / lastTouchDistance;
                let newScale = touchStartScale * scaleChange;
                const isMobile = window.innerWidth <= 1280 || navigator.maxTouchPoints > 0;
                const minScale = isMobile ? 0.1 : 0.18; // スマホは0.05倍、PCは0.18倍まで縮小可能
                newScale = Math.max(minScale, Math.min(newScale, 20));
                
                const canvas = canvasRef.current;
                const rect = canvas.getBoundingClientRect();
                const zoomCenterX = center.x - rect.left;
                const zoomCenterY = center.y - rect.top;
                
                const scaleRatio = newScale / scale;
                const newOffsetX = zoomCenterX - (zoomCenterX - offsetX) * scaleRatio;
                const newOffsetY = zoomCenterY - (zoomCenterY - offsetY) * scaleRatio;
                
                setScale(newScale);
                setOffsetX(newOffsetX);
                setOffsetY(newOffsetY);
            }
            
            // パン移動
            if (lastTouchCenter.x !== 0 && lastTouchCenter.y !== 0) {
                const deltaX = center.x - lastTouchCenter.x;
                const deltaY = center.y - lastTouchCenter.y;
                
                setOffsetX(prev => prev + deltaX);
                setOffsetY(prev => prev + deltaY);
            }
            
            setLastTouchCenter(center);
        }
        // 1本指の処理はPointer Eventsに任せる
    }, [isPanning, lastTouchDistance, touchStartScale, lastTouchCenter, scale, offsetX, offsetY]);

    const handleTouchEnd = useCallback((e) => {
        if (e.touches.length < 2) {
            setIsPanning(false);
            setLastTouchDistance(0);
            setLastTouchCenter({ x: 0, y: 0 });
        }
        // 1本指の処理はPointer Eventsに任せる
    }, []);

    // ビューをリセット（ズームとパンを初期値に戻す）
    const resetView = useCallback(() => {
        // パスが存在する場合は最適視点を計算
        if (paths.length > 0) {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            paths.forEach(pathObj => {
                if (pathObj && pathObj.points && pathObj.points.length > 0) {
                    pathObj.points.forEach(point => {
                        minX = Math.min(minX, point.x);
                        minY = Math.min(minY, point.y);
                        maxX = Math.max(maxX, point.x);
                        maxY = Math.max(maxY, point.y);
                    });
                }
            });

            if (minX !== Infinity) {
                const modelWidth = maxX - minX;
                const modelHeight = maxY - minY;
                const modelCenterX = (minX + maxX) / 2;
                const modelCenterY = (minY + maxY) / 2;
                
                // 画面サイズに対してモデルが適切に収まるスケールを計算
                const screenWidth = window.innerWidth;
                const screenHeight = window.innerHeight;
                const isMobile = window.innerWidth <= 1280 || navigator.maxTouchPoints > 0;
                const padding = isMobile ? 20 : 200; // スマホは20px、PCは200pxの余白
                
                const scaleX = (screenWidth - padding * 2) / modelWidth;
                const scaleY = (screenHeight - padding * 2) / modelHeight;
                const optimalScale = Math.min(scaleX, scaleY, 1); // 最大1倍まで
                
                // モデル中央を画面中央に配置するオフセット計算
                const offsetX = screenWidth / 2 - modelCenterX * optimalScale;
                const offsetY = screenHeight / 2 - modelCenterY * optimalScale;
                
                console.log('視点リセット: 最適視点を計算:', {
                    modelSize: { width: modelWidth, height: modelHeight },
                    modelCenter: { x: modelCenterX, y: modelCenterY },
                    screenSize: { width: screenWidth, height: screenHeight },
                    result: { scale: optimalScale, offsetX: offsetX, offsetY: offsetY }
                });
                
                setScale(optimalScale);
                setOffsetX(offsetX);
                setOffsetY(offsetY);
                return;
            }
        }
        
        // パスがない場合は保存された視点を復元、なければデフォルト視点
        console.log('視点リセット: パスがないためデフォルト視点を使用');
        setScale(1);
        setOffsetX(canvasWidth / 2); // 原点(0,0)を画面中央に表示
        setOffsetY(canvasHeight / 2);
    }, [canvasWidth, canvasHeight, paths]);

    // 視点状態を保存・復元する機能
    const saveViewState = useCallback(() => {
        const viewState = {
            scale,
            offsetX,
            offsetY,
            timestamp: Date.now()
        };
        sessionStorage.setItem('neonDrawingViewState', JSON.stringify(viewState));
    }, [scale, offsetX, offsetY]);

    const restoreViewState = useCallback(() => {
        try {
            const savedViewState = sessionStorage.getItem('neonDrawingViewState');
            if (savedViewState) {
                const viewState = JSON.parse(savedViewState);
                setScale(viewState.scale || 1);
                setOffsetX(viewState.offsetX || canvasWidth / 2);
                setOffsetY(viewState.offsetY || canvasHeight / 2);
                return true;
            }
        } catch (error) {
            console.error('視点状態の復元エラー:', error);
        }
        return false;
    }, [canvasWidth, canvasHeight]);

    // このuseEffectは無効化（LocalStorageからの復元で十分）
    // useEffect(() => {
    //     if (canvasWidth > 0 && canvasHeight > 0 && !isInitializing) {
    //         // カスタマイズからのデータ読み込み完了後は視点復元をスキップ
    //         if (hasLoadedFromCustomize.current) {
    //             console.log('カスタマイズからのデータ読み込み完了のため視点復元をスキップ');
    //             return;
    //         }
    //         
    //         // 視点復元を試行（失敗してもリセットしない）
    //         restoreViewState();
    //     }
    // }, [canvasWidth, canvasHeight, restoreViewState, isInitializing]);

    // コンポーネントのアンマウント時に視点を保存
    useEffect(() => {
        return () => {
            saveViewState();
        };
    }, [saveViewState]);

    const handleMouseClick = useCallback((e) => {
        // モーダル表示中はキャンバス操作を無効化
        if (showRectangleModal) return;

        // 右クリック、パン中、ドラッグ中、修正モード、点結合モード、パス削除モード、点削除モード、ベースプレートモードで描画タイプ選択モーダルが表示されている場合、または描画モード選択中は処理しない
        const isModeSelecting = !isModifyingPoints && !isMergeMode && !isPathDeleteMode && !isPointDeleteMode &&
                               (drawMode !== 'stroke' && drawMode !== 'fill');

        // ドラッグが行われた場合は常にブロック（モード解除後も有効）
        if (didDragRef.current) {
            return;
        }

        if (e.button !== 0 || isPanning || isModifyingPoints || isMergeMode || isPathDeleteMode || isPointDeleteMode || isModeSelecting) {
            return;
        }

        // ベースプレートモードで既にベースプレート面が存在し、かつ新しいベースプレートパスを作ろうとしている場合はキャンバスクリックをブロック
        if (drawMode === 'fill') {
            const existingFillPaths = paths.filter(pathObj => 
                pathObj && pathObj.mode === 'fill' && pathObj.points && pathObj.points.length >= 3
            );
            const currentPath = paths[currentPathIndex];
            // 既にベースプレート面が存在し、かつ現在のパスが空（新しいベースプレートを作ろうとしている）場合のみブロック
            if (existingFillPaths.length >= 1 && currentPath && currentPath.points.length === 0) {
                alert('ベースプレートは1つまでしか作成できません。既存のベースプレートを削除してから新しいものを作成してください。');
                return;
            }
        }

        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const rawClientX = e.clientX - rect.left;
        const rawClientY = e.clientY - rect.top;
        // キャンバス座標をコンテンツ座標に変換
        const rawContentX = (rawClientX - offsetX) / scale;
        const rawContentY = (rawClientY - offsetY) / scale;
        
        // 3m×3m制限を適用
        const { x: contentX, y: contentY } = limitCoordinates(rawContentX, rawContentY);

        setPaths((prevPaths) => {
            const newPaths = [...prevPaths];
            let targetPath = newPaths[currentPathIndex];
            let actualPathIndex = currentPathIndex;

            // 現在のパスが存在しない、または空である場合は初期化
            if (!targetPath || targetPath.points.length === 0) {
                // ベースプレートの重複チェック（新しいベースプレートパスを初期化する場合）
                if (drawMode === 'fill') {
                    const existingFillPaths = newPaths.filter(pathObj => 
                        pathObj && pathObj.mode === 'fill' && pathObj.points && pathObj.points.length >= 3
                    );
                    if (existingFillPaths.length >= 1) {
                        alert('ベースプレートは1つまでしか作成できません。既存のベースプレートを削除してから新しいものを作成してください。');
                        return prevPaths; // 変更せずに元の配列を返す
                    }
                }
                
                newPaths[currentPathIndex] = { points: [], mode: drawMode, type: drawingType };
                targetPath = newPaths[currentPathIndex];
            }
            // 既存のパスがあるが、モード/タイプが異なる場合は新しいパスを作成
            else if (targetPath.mode !== drawMode || targetPath.type !== drawingType) {
                // ベースプレートの重複チェック（新しいベースプレートパスを作成する場合）
                if (drawMode === 'fill') {
                    const existingFillPaths = newPaths.filter(pathObj => 
                        pathObj && pathObj.mode === 'fill' && pathObj.points && pathObj.points.length >= 3
                    );
                    if (existingFillPaths.length >= 1) {
                        alert('ベースプレートは1つまでしか作成できません。既存のベースプレートを削除してから新しいものを作成してください。');
                        return prevPaths; // 変更せずに元の配列を返す
                    }
                }
                
                // 新しいパスを配列の最後に追加
                const newPath = { points: [], mode: drawMode, type: drawingType };
                newPaths.push(newPath);
                actualPathIndex = newPaths.length - 1;
                targetPath = newPaths[actualPathIndex];
                
                // currentPathIndexを新しいパスに更新
                setCurrentPathIndex(actualPathIndex);
            }

            // 点が非表示の場合は自動で表示
            if (!showPoints) {
                setShowPoints(true);
            }
            
            // 新しい点を追加
            targetPath.points = [...targetPath.points, { x: contentX, y: contentY }];
            
            // 最初の点が追加された場合、新しいパスボタンを有効化
            if (targetPath.points.length === 1) {
                console.log('最初の点が描画されました - ボタンを有効化します');
                setIsNewPathDisabled(false);
            }
            
            // 点追加後の状態を履歴に保存（実際のパスインデックスを使用）
            saveToHistory(newPaths, actualPathIndex, drawMode, drawingType); 
            return newPaths;
        });
    }, [currentPathIndex, drawMode, drawingType, offsetX, offsetY, scale, isPanning, isModifyingPoints, isMergeMode, isPathDeleteMode, isPointDeleteMode, saveToHistory, showPoints]); 

    const handlePointerUp = useCallback((e) => {
        e.preventDefault();
        
        // マウスアップ処理
        const pointerEvent = {
            preventDefault: () => {}
        };
        handleMouseUp(pointerEvent);
    }, [handleMouseUp]);

    // 点修正モードの切り替え
    const toggleModifyMode = useCallback(() => {
        setIsModifyingPoints(prev => {
            const newValue = !prev;
            if (newValue) {
                // モードON: 現在の表示状態を記憶し、点が非表示なら表示
                setOriginalShowPointsState(showPoints);
                if (!showPoints) {
                    setShowPoints(true);
                }
            } else {
                // モードOFF: 元の表示状態に戻す
                if (originalShowPointsState !== null) {
                    setShowPoints(originalShowPointsState);
                    setOriginalShowPointsState(null);
                }
            }
            return newValue;
        });
        setActivePoint(null); // アクティブな点をクリア
        setIsPathDeleteMode(false); // パス削除モードを無効化
        setIsPointDeleteMode(false); // 点削除モードを無効化
        setIsMergeMode(false); // 点結合モードを無効化
        setSelectedPointsForMerge([]); // 選択中の点をクリア
    }, [showPoints, originalShowPointsState]);

    // 点結合モードの切り替え
    const toggleMergeMode = useCallback(() => {
        setIsMergeMode(prev => {
            const newValue = !prev;

            // まず他のモードをすべて無効化
            setIsModifyingPoints(false);
            setIsPathDeleteMode(false);
            setIsPointDeleteMode(false);
            setActivePoint(null);

            if (newValue) {
                // モードON: 点を表示
                setOriginalShowPointsState(showPoints);
                if (!showPoints) {
                    setShowPoints(true);
                }
                setSelectedPointsForMerge([]); // 選択中の点をクリア
                setHoveredPointForMerge(null); // ホバー状態をクリア
            } else {
                // モードOFF: 元の表示状態に戻す
                if (originalShowPointsState !== null) {
                    setShowPoints(originalShowPointsState);
                    setOriginalShowPointsState(null);
                }
                setSelectedPointsForMerge([]); // 選択中の点をクリア
                setHoveredPointForMerge(null); // ホバー状態をクリア
            }
            return newValue;
        });
    }, [showPoints, originalShowPointsState]);

    // 点結合の実行
    const mergePoints = useCallback(() => {
        if (selectedPointsForMerge.length !== 2) return;

        const [point1, point2] = selectedPointsForMerge;

        setPaths(prevPaths => {
            const newPaths = JSON.parse(JSON.stringify(prevPaths));

            // 1つ目の点を2つ目の点の位置に移動
            newPaths[point1.pathIndex].points[point1.pointIndex] = {
                x: newPaths[point2.pathIndex].points[point2.pointIndex].x,
                y: newPaths[point2.pathIndex].points[point2.pointIndex].y
            };

            saveToHistory(newPaths, currentPathIndex, drawMode, drawingType);
            return newPaths;
        });

        setSelectedPointsForMerge([]);
        setIsMergeMode(false);
        setShowPoints(originalShowPointsState);
        setOriginalShowPointsState(null);
    }, [selectedPointsForMerge, saveToHistory, currentPathIndex, drawMode, drawingType, originalShowPointsState]);

    // パス削除モードの切り替え
    const togglePathDeleteMode = useCallback(() => {
        setIsPathDeleteMode(prev => {
            const newValue = !prev;
            if (newValue) {
                // モードON: 現在の表示状態を記憶し、点が非表示なら表示
                setOriginalShowPointsState(showPoints);
                if (!showPoints) {
                    setShowPoints(true);
                }
            } else {
                // モードOFF: 元の表示状態に戻す
                if (originalShowPointsState !== null) {
                    setShowPoints(originalShowPointsState);
                    setOriginalShowPointsState(null);
                }
            }
            return newValue;
        });
        setActivePoint(null); // アクティブな点をクリア
        setIsModifyingPoints(false); // 点修正モードを無効化
        setIsPointDeleteMode(false); // 点削除モードを無効化
        setIsMergeMode(false); // 点結合モードを無効化
        setSelectedPointsForMerge([]);
        setHoveredPointForMerge(null);
    }, [showPoints, originalShowPointsState]);

    // 点削除モードの切り替え
    const togglePointDeleteMode = useCallback(() => {
        setIsPointDeleteMode(prev => {
            const newValue = !prev;
            if (newValue) {
                // モードON: 現在の表示状態を記憶し、点が非表示なら表示
                setOriginalShowPointsState(showPoints);
                if (!showPoints) {
                    setShowPoints(true);
                }
            } else {
                // モードOFF: 元の表示状態に戻す
                if (originalShowPointsState !== null) {
                    setShowPoints(originalShowPointsState);
                    setOriginalShowPointsState(null);
                }
            }
            return newValue;
        });
        setActivePoint(null); // アクティブな点をクリア
        setIsModifyingPoints(false); // 点修正モードを無効化
        setIsPathDeleteMode(false); // パス削除モードを無効化
        setIsMergeMode(false); // 点結合モードを無効化
        setSelectedPointsForMerge([]);
        setHoveredPointForMerge(null);
    }, [showPoints, originalShowPointsState]);

    // 画像圧縮関数
    const compressImage = useCallback((file, quality = 0.7, maxWidth = 1920) => {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            img.onload = () => {
                // アスペクト比を保持してリサイズ
                let { width, height } = img;
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }
                
                canvas.width = width;
                canvas.height = height;
                
                // 画像を描画
                ctx.drawImage(img, 0, 0, width, height);
                
                // 圧縮してBase64で出力
                const compressedDataURL = canvas.toDataURL('image/jpeg', quality);
                resolve(compressedDataURL);
            };
            
            img.src = URL.createObjectURL(file);
        });
    }, []);

    // 背景画像ファイルのアップロード
    const handleImageUpload = useCallback(async (event) => {
        const file = event.target.files[0];
        if (file) {
            // 1.5MB以上は自動で圧縮
            if (file.size > 1.5 * 1024 * 1024) {
                try {
                    console.log(`画像が大きいため圧縮します (${Math.round(file.size / 1024 / 1024 * 10) / 10}MB)`);
                    const compressedImage = await compressImage(file, 0.7, 1920);
                    console.log('圧縮完了:', Math.round(compressedImage.length / 1024), 'KB');
                    setBackgroundImage(compressedImage);
                    return;
                } catch (error) {
                    console.error('画像圧縮エラー:', error);
                    // 圧縮に失敗した場合は元の画像で続行
                }
            }
            
            // 通常の読み込み処理（1.5MB以下または圧縮失敗時）
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result;
                console.log('背景画像を読み込みました:', Math.round(result.length / 1024), 'KB');
                setBackgroundImage(result);
            };
            reader.readAsDataURL(file);
        }
    }, [compressImage]);

    // 背景画像をクリア
    const clearBackgroundImage = useCallback(() => {
        setBackgroundImage(null);
        setInitialBgImageWidth(0);
        setInitialBgImageHeight(0);
        setBgImageScale(1.0);
        setBgImageX(0);
        setBgImageY(0);
        setBgImageOpacity(1.0);
    }, []);

    // カーソルクラスを決定
    const getCursorClass = () => {
        if (isPanning) return 'cursor-pan';
        if (isModifyingPoints || isMergeMode) return 'cursor-modify';
        if (isPathDeleteMode || isPointDeleteMode) return 'cursor-delete';
        return 'cursor-draw';
    };

    return (
        <div className="app-container">
            {/* メインキャンバスエリア */}
            <div className="canvas-area">
                <canvas
                    ref={canvasRef}
                    className={`main-canvas ${getCursorClass()}`}
                    onClick={handleMouseClick}
                    onWheel={handleWheel}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handleMouseUp}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onContextMenu={(e) => e.preventDefault()} // 右クリックメニューを無効化
                    onPointerLeave={handlePointerLeave}
                    style={{ touchAction: 'none' }}
                />
                
                {/* キャンバス右上のサイズ表示 */}
                <div className={`canvas-size-display ${!sidebarVisible ? 'sidebar-collapsed' : ''}`}>
                    <div className="canvas-size-title">寸法</div>
                    <div className="canvas-size-item">
                        <span className="canvas-size-label">幅:</span>
                        <span className="canvas-size-value">{modelSize.width.toFixed(1)}cm</span>
                    </div>
                    <div className="canvas-size-item">
                        <span className="canvas-size-label">高さ:</span>
                        <span className="canvas-size-value">{modelSize.height.toFixed(1)}cm</span>
                    </div>
                    <div className="canvas-size-item">
                        <span className="canvas-size-label">チューブ長:</span>
                        <span className="canvas-size-value">{modelSize.totalLength.toFixed(1)}cm</span>
                    </div>
                </div>

                {/* モバイル機能バー（サイドバー閉じている時のみ表示） */}
                {!isInitializing && (
                <div className="mobile-function-bar">
                    {/* 固定ヘッダー部分（サイドバートグルボタン用の領域） */}
                    <div className="mobile-function-bar-header">
                    </div>
                    
                    {/* スクロール可能なボタンコンテンツ部分 */}
                    <div className="mobile-function-bar-content">
                        <button
                            className={`mobile-function-btn new-path ${(isNewPathDisabled || isModifyingPoints || isMergeMode || isPathDeleteMode || isPointDeleteMode) ? 'button-disabled' : ''}`}
                            onClick={startNewPath}
                            disabled={isNewPathDisabled || isModifyingPoints || isMergeMode || isPathDeleteMode || isPointDeleteMode}
                        >
                            <svg width="23" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 5v14M5 12h14"/>
                            </svg>
                        </button>
                        <button
                            className={`mobile-function-btn modify-points ${isModifyingPoints ? 'button-active' : ''}`}
                            onClick={toggleModifyMode}
                        >
                            <svg width="24" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"></path>
                                <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"></path>
                                <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"></path>
                                <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L8 16h4"></path>
                            </svg>
                        </button>
                        <button
                            className={`mobile-function-btn merge-points ${isMergeMode ? 'button-active' : ''}`}
                            onClick={toggleMergeMode}
                        >
                            <svg width="24" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="7" cy="7" r="2.5" fill="currentColor" stroke="currentColor" strokeWidth="1.5"/>
                                <circle cx="17" cy="17" r="2.5" fill="currentColor" stroke="currentColor" strokeWidth="1.5"/>
                                <path d="M9 9L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                <path d="M14 16L17 17L16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                            </svg>
                        </button>
                        <button
                            className={`mobile-function-btn undo ${historyIndex <= 0 ? 'button-disabled' : ''}`}
                            onClick={handleUndo}
                            disabled={historyIndex <= 0}
                        >
                            <svg width="22" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M11 17l-5-5 5-5"></path>
                                <path d="M18 17l-5-5 5-5"></path>
                            </svg>
                        </button>
                        
                        <button
                            className={`mobile-function-btn redo ${historyIndex >= history.length - 1 ? 'button-disabled' : ''}`}
                            onClick={handleRedo}
                            disabled={historyIndex >= history.length - 1}
                        >
                            <svg width="22" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M13 17l5-5-5-5"></path>
                                <path d="M6 17l5-5-5-5"></path>
                            </svg>
                        </button>
                        <button
                            className={`mobile-function-btn points-toggle ${!showPoints ? 'button-active' : ''}`}
                            onClick={() => setShowPoints(!showPoints)}
                        >
                            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                                <path d="M6 20 Q12 12 18 20 Q24 28 30 20 Q34 16 36 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                {showPoints && (
                                    <>
                                        <circle cx="12" cy="16" r="2.5" fill="currentColor" stroke="black" strokeWidth="0.8"/>
                                        <circle cx="24" cy="24" r="2.5" fill="currentColor" stroke="black" strokeWidth="0.8"/>
                                        <circle cx="32" cy="18" r="2.5" fill="currentColor" stroke="black" strokeWidth="0.8"/>
                                    </>
                                )}
                            </svg>
                        </button>
                        <button
                            className={`mobile-function-btn point-delete ${isPointDeleteMode ? 'button-active' : ''}`}
                            onClick={togglePointDeleteMode}
                        >
                            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                                <circle cx="20" cy="20" r="6" fill="currentColor" stroke="black" strokeWidth="1.2"/>
                                <path d="M30 10l-20 20M10 10l20 20" stroke="currentColor" strokeWidth="2"/>
                            </svg>
                        </button>
                        <button
                            className={`mobile-function-btn path-delete ${isPathDeleteMode ? 'button-active' : ''}`}
                            onClick={togglePathDeleteMode}
                        >
                            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                                <path d="M6 20 Q12 12 18 20 Q24 28 30 20 Q34 16 36 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                <path d="M30 10l-20 20M10 10l20 20" stroke="currentColor" strokeWidth="2"/>
                            </svg>
                        </button>
                        <button
                            className="mobile-function-btn scale"
                            onClick={() => {
                                setOpenedFromFunctionBar(true);
                                openScaleModal();
                            }}
                        >
                            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                                <circle cx="18" cy="18" r="7" fill="none" stroke="currentColor" strokeWidth="2"/>
                                <path d="M23 23 L30 30" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                <path d="M15 18 L21 18 M18 15 L18 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                            </svg>
                        </button>
                        <button
                            className="mobile-function-btn background-image"
                            onClick={() => {
                                setOpenedFromFunctionBar(true);
                                setShowBgModal(true);
                                setSidebarVisible(false);
                            }}
                        >
                            <svg width="24" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                <circle cx="8.5" cy="8.5" r="1.5"/>
                                <path d="M21 15l-5-5L5 21"/>
                            </svg>
                        </button>
                    </div>
                </div>
                )}
            </div>

            {/* サイドバー - オーバーレイ */}
            <div className={`neon-sidebar ${sidebarVisible ? '' : 'collapsed'}`}>
                    <div className="neon-header">
                        <h1 className="neon-sidebar-title">
                            下絵描画
                        </h1>
                        {/* ガイドボタン */}
                        <button
                            onClick={() => {
                                setIsGuideModalOpen(true);
                                setTimeout(() => {
                                    onGuideEffectStop?.();
                                }, 150);
                            }}
                            className={`neon-guide-button ${isGuideEffectStopped ? 'stopped' : ''}`}
                        >
                        </button>

                        {/* サイドバー切り替えボタン */}
                        <button
                            onClick={() => setSidebarVisible(!sidebarVisible)}
                            className="neon-toggle-sidebar-button"
                        >
                            <div className={`triangle ${sidebarVisible ? 'triangle-down' : 'triangle-up'}`}></div>
                        </button>
                    </div>

                    {/* ステータスメッセージ表示エリア */}
                    <div className="status-message-area">
                        <div className="status-message">
                            {isMergeMode ? `点結合モードアクティブ中: ${selectedPointsForMerge.length}/2点選択中` :
                             isModifyingPoints ? '点修正モードアクティブ中' :
                             isPathDeleteMode ? 'パス削除モードアクティブ中' :
                             isPointDeleteMode ? '点削除モードアクティブ中' :
                             drawMode === 'stroke' ? `チューブパス${paths.filter(p => p.mode === 'stroke').length}描画中` :
                             drawMode === 'fill' ? 'ベースプレート描画中' :
                             '描画モードを選択してください'}
                        </div>
                    </div>


                    {/* 背景画像を設定 */}
                    <button
                        onClick={() => {
                            setShowBgModal(true);
                            setSidebarVisible(false);
                        }}
                        className="settings-button-drawing"
                    >
                        背景画像を設定
                    </button>

                    {/* 描画モード */}
                    <div className="draw-tools-title">描画モード</div>

                    {/* ネオンチューブ・ベースプレートボタン */}
                    <div className="draw-mode-buttons">
                        <button
                            onClick={() => handleSetDrawMode('stroke')}
                            disabled={areDrawModeButtonsDisabled}
                            className={`draw-mode-button ${
                                areDrawModeButtonsDisabled
                                        ? (drawMode === 'stroke' ? 'button-blue' : 'button-disabled')
                                        : (drawMode === 'stroke' ? 'button-blue' : 'button-secondary')
                            }`}
                        >
                            ネオンチューブ
                        </button>
                        <button
                            onClick={() => handleSetDrawMode('fill')}
                            disabled={areDrawModeButtonsDisabled}
                            className={`draw-mode-button ${
                                areDrawModeButtonsDisabled
                                        ? (drawMode === 'fill' ? 'button-red' : 'button-disabled')
                                        : (drawMode === 'fill' ? 'button-red' : 'button-secondary')
                            }`}
                        >
                            ベースプレート
                        </button>
                    </div>

                    {/* ネオンチューブ描画モード */}
                    {drawMode === 'stroke' && (
                        <>
                            <div className="draw-tools-title">ネオンチューブ描画モード</div>

                            {sidebarVisible && (
                                <>
                                    {/* 新しいパス・テンプレートボタン */}
                                    <div className="draw-mode-buttons" style={{ gridTemplateColumns: '1.5fr 1fr' }}>
                                        <button
                                            onClick={startNewPath}
                                            disabled={isNewPathDisabled || isModifyingPoints || isMergeMode || isPathDeleteMode || isPointDeleteMode}
                                            className={`draw-mode-button new-path-button ${(isNewPathDisabled || isModifyingPoints || isMergeMode || isPathDeleteMode || isPointDeleteMode) ? 'button-disabled' : ''}`}
                                        >
                                            新しいパス
                                        </button>
                                        <button
                                            onClick={() => {
                                                setShowTemplateModal(true);
                                                setSidebarVisible(false);
                                            }}
                                            disabled={areDrawModeButtonsDisabled}
                                            className={`draw-mode-button ${
                                                areDrawModeButtonsDisabled ? 'button-disabled' : 'button-red'
                                            }`}
                                            style={{ cursor: areDrawModeButtonsDisabled ? 'not-allowed' : 'pointer' }}
                                        >
                                            テンプレ
                                        </button>
                                    </div>
                                </>
                            )}
                        </>
                    )}

                    {/* ベースプレート描画モード */}
                    {drawMode === 'fill' && (
                        <>
                            <div className="draw-tools-title">ベースプレート描画モード</div>

                            {sidebarVisible && (
                                <>
                                    <p className="baseplate-drawing-description">描画方法を選択</p>
                                    <div className="baseplate-drawing-type-buttons">
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
                                    <button
                                        onClick={() => handleSetDrawingType('rectangle')}
                                        className={`drawing-type-button ${
                                            drawingType === 'rectangle'
                                                ? 'button-active button-purple'
                                                : 'button-secondary'
                                        }`}
                                    >
                                        長方形(自動生成)
                                    </button>
                                    <button
                                        onClick={() => handleSetDrawingType('circle')}
                                        className={`drawing-type-button ${
                                            drawingType === 'circle'
                                                ? 'button-active button-purple'
                                                : 'button-secondary'
                                        }`}
                                    >
                                        円(自動生成)
                                    </button>
                                </div>
                                <button
                                    onClick={() => handleSetDrawingType('auto-shape')}
                                    className={`drawing-type-button auto-shape-button ${
                                        drawingType === 'auto-shape'
                                            ? 'button-active button-purple'
                                            : 'button-secondary'
                                    }`}
                                >
                                    ネオンパスに合わせた形状(自動)
                                </button>
                                </>
                            )}
                        </>
                    )}

                    {/* 修正ツール */}
                    <div className="edit-tools-title">修正ツール</div>

                    {/* 点修正・点結合 */}
                    <div className="edit-mode-buttons-two">
                        <button
                            onClick={toggleModifyMode}
                            className={`edit-mode-button ${
                                isModifyingPoints
                                            ? 'button-cyan'
                                            : 'button-secondary'
                            }`}
                        >
                            点修正
                        </button>
                        <button
                            onClick={toggleMergeMode}
                            className={`edit-mode-button ${
                                isMergeMode
                                    ? 'button-cyan'
                                    : 'button-secondary'
                            }`}
                        >
                            点結合
                        </button>
                    </div>

                    {/* ←戻る・拡大縮小・進む→ */}
                    <div className="edit-mode-buttons-three">
                        <button
                            onClick={handleUndo}
                            disabled={historyIndex === 0}
                            className={`edit-mode-button ${
                                historyIndex === 0 ? 'button-disabled' : 'button-purple'
                            }`}
                        >
                            ←戻る
                        </button>
                        {sidebarVisible && (
                            <button
                                onClick={() => {
                                    openScaleModal();
                                    setSidebarVisible(false);
                                }}
                                className="edit-mode-button button-blue"
                            >
                                拡大縮小
                            </button>
                        )}
                        <button
                            onClick={handleRedo}
                            disabled={historyIndex === history.length - 1}
                            className={`edit-mode-button ${
                                historyIndex === history.length - 1 ? 'button-disabled' : 'button-purple'
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
                                            ? 'button-red'
                                            : 'button-secondary'
                            }`}
                        >
                            点削除
                        </button>
                        <button
                            onClick={togglePathDeleteMode}
                            className={`delete-button ${
                                isPathDeleteMode
                                            ? 'button-red'
                                            : 'button-secondary'
                            }`}
                        >
                            パス削除
                        </button>
                    </div>

                    {/* チューブ太さプレビュー */}
                    <div className="tube-thickness-section">
                        <div className="tube-thickness-title">太さプレビュー</div>
                        <div className="tube-thickness-selector">
                            <button
                                className={`points-toggle-sidebar ${!showPoints ? 'button-active' : ''}`}
                                onClick={() => setShowPoints(!showPoints)}
                                dangerouslySetInnerHTML={{
                                    __html: showPoints ? '点<br/>非表示' : '点<br/>表示'
                                }}
                            ></button>
                            <select
                                value={tubeThickness}
                                onChange={(e) => setTubeThickness(e.target.value)}
                                className="tube-thickness-select"
                            >
                                <option value="default">骨組み描画</option>
                                <option value="6">6mmチューブ</option>
                                <option value="8">8mmチューブ</option>
                            </select>
                        </div>
                    </div>

                    {/* グリッド表示・背景色 */}
                    <div className="grid-bg-controls">
                        <div className="grid-toggle-container-drawing">
                            <label className="grid-toggle-label">グリッド表示</label>
                            <button
                                onClick={() => {
                                    setShowGrid(!showGrid);
                                    // グリッド設定変更時に保存
                                    saveToLocalStorage();
                                    if (onStateChange) {
                                        const currentState = {
                                            paths: paths,
                                            currentPathIndex: currentPathIndex,
                                            drawMode: drawMode,
                                            drawingType: drawingType,
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
                                            showGrid: !showGrid,
                                            gridSize: gridSize,
                                            gridOpacity: gridOpacity,
                                            colors: colors,
                                            lineWidths: lineWidths
                                        };
                                        onStateChange(currentState);
                                    }
                                }}
                                className={`grid-toggle-button ${showGrid ? 'on' : 'off'}`}
                            >
                                {showGrid ? 'ON' : 'OFF'}
                            </button>
                        </div>
                        
                        {/* グリッド間隔セレクタ */}
                        
                        
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
                    {sidebarVisible && (
                        <div className="grid-spacing-container">
                            <label className="grid-spacing-label">間隔</label>
                            <select 
                                value={gridSize / 25} 
                                onChange={(e) => {
                                    const newGridSize = parseFloat(e.target.value) * 25;
                                    setGridSize(newGridSize);
                                    // グリッド設定変更時に保存
                                    saveToLocalStorage();
                                    if (onStateChange) {
                                        const currentState = {
                                            paths: paths,
                                            currentPathIndex: currentPathIndex,
                                            drawMode: drawMode,
                                            drawingType: drawingType,
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
                                            gridSize: newGridSize,
                                            gridOpacity: gridOpacity,
                                            colors: colors,
                                            lineWidths: lineWidths
                                        };
                                        onStateChange(currentState);
                                    }
                                }}
                                className="grid-spacing-select"
                                onBlur={(e) => {
                                    // ブラウザのデフォルト動作を完全に停止
                                    e.preventDefault();
                                    e.stopPropagation();
                                    return false;
                                }}
                                onScroll={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    return false;
                                }}
                                onTouchMove={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    return false;
                                }}
                                style={{ position: 'sticky', zIndex: 9999 }}
                            >
                                <option value={1}>1cm</option>
                                <option value={2}>2cm</option>
                                <option value={3}>3cm</option>
                                <option value={4}>4cm</option>
                                <option value={5}>5cm</option>
                                <option value={10}>10cm</option>
                            </select>
                        </div>
                    )}

                    <div className="view-controls">
                        <h3 className="reset-tools-title">リセット操作</h3>
                        
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
                                className="view-reset-button half-width"
                            >
                                全てクリア
                            </button>
                        </div>
                    </div>

                    {/* エクスポート機能 */}
                    <div className="project-controls">
                        <h3 className="project-tools-title">プロジェクトの保存/読み込み</h3>
                        <div className="reset-buttons-row">
                            <button
                                onClick={downloadNeonProject}
                                className={`project-save-btn ${(!paths || paths.length === 0 || !paths.some(path => path && Array.isArray(path.points) && path.points.length > 0)) ? 'button-disabled' : ''}`}
                                disabled={!paths || paths.length === 0 || !paths.some(path => path && Array.isArray(path.points) && path.points.length > 0)}
                                title="現在のネオン下絵プロジェクトをJSONファイルとしてダウンロード"
                            >
                                📥 保存
                            </button>
                            <label className="project-load-btn">
                                📤 読み込む
                                <input
                                    type="file"
                                    accept=".json"
                                    onChange={(e) => {
                                        if (e.target.files.length > 0) {
                                            loadNeonProject(e.target.files[0]);
                                        }
                                        e.target.value = ''; // ファイル選択をリセット
                                    }}
                                    style={{ display: 'none' }}
                                />
                            </label>
                        </div>
                    </div>

                    {/* カスタマイズへ進む */}
                    <button
                        onClick={() => {
                            // ベースプレート（fillモード）が存在するかチェック
                            const hasFillPath = paths.some(pathObj => 
                                pathObj && pathObj.mode === 'fill' && pathObj.points && pathObj.points.length >= 3
                            );
                            
                            // ネオンパス（strokeモード）が存在するかチェック
                            const hasStrokePath = paths.some(pathObj => 
                                pathObj && pathObj.mode === 'stroke' && pathObj.points && pathObj.points.length >= 2
                            );
                            
                            if (!hasFillPath) {
                                alert('ベースプレートを描画してください。');
                                return;
                            }
                            
                            if (!hasStrokePath) {
                                alert('少なくとも一つのネオンパスを描画してください。');
                                return;
                            }
                            
                            // カスタマイズへ進む前に現在の状態を親に保存（視点情報は保存しない）
                            if (onStateChange) {
                                const currentState = {
                                    paths: paths,
                                    currentPathIndex: currentPathIndex,
                                    drawMode: drawMode,
                                    drawingType: drawingType,
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
                                onStateChange(currentState);
                            }
                            
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
                                        gridColor: colors.grid 
                                    }
                                }
                            }));
                        }}
                        className="download-button"
                    >
                        カスタマイズへ進む
                    </button>
                    
                    {/* SVG出力ボタン */}
                    <button
                        onClick={() => {
                            try {
                                const { strokePathData, fillPathData } = generateSvgPaths();
                                
                                const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}">
    ${fillPathData ? `<path d="${fillPathData}" stroke="${colors.fillBorder}" stroke-width="${lineWidths.fillBorder}" fill="${colors.fillArea}" stroke-linecap="round" stroke-linejoin="round"/>` : ''}
    ${strokePathData ? `<path d="${strokePathData}" stroke="${colors.strokeLine}" stroke-width="${lineWidths.strokeLine}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` : ''}
</svg>`;

                                // SVGファイルとしてダウンロード
                                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                                const fileName = `neon-sketch-${timestamp}`;
                                
                                const blob = new Blob([svgContent], { type: 'image/svg+xml' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `${fileName}.svg`;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                URL.revokeObjectURL(url);
                                
                                console.log('SVG出力完了:', fileName);
                            } catch (error) {
                                console.error('SVG出力エラー:', error);
                                alert('SVG出力に失敗しました');
                            }
                        }}
                        className="download-button"
                        disabled={!paths || paths.length === 0 || !paths.some(path => path && Array.isArray(path.points) && path.points.length > 0)}
                        title="現在のネオン下絵をSVGファイルとして出力"
                    >
                        📄 SVG出力
                    </button>
                </div>


            {/* モーダル群 */}
            {/* グリッド設定モーダル */}
            <Modal isOpen={showGridModal} onClose={() => setShowGridModal(false)} title="グリッド設定" position="right">
                <div className="modal-content-inner">
                    <div className="modal-setting-item">
                        <label className="modal-label">グリッド表示</label>
                        <button
                            onClick={() => {
                                setShowGrid(!showGrid);
                                saveToLocalStorage();
                                if (onStateChange) {
                                    const currentState = {
                                        paths: paths,
                                        currentPathIndex: currentPathIndex,
                                        drawMode: drawMode,
                                        drawingType: drawingType,
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
                                        showGrid: !showGrid,
                                        gridSize: gridSize,
                                        gridOpacity: gridOpacity,
                                        colors: colors,
                                        lineWidths: lineWidths
                                    };
                                    onStateChange(currentState);
                                }
                            }}
                            className={`grid-toggle-button ${
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
            <Modal isOpen={showBgModal} onClose={() => {
                saveToLocalStorage();
                if (onStateChange) {
                    const currentState = {
                        paths: paths,
                        currentPathIndex: currentPathIndex,
                        drawMode: drawMode,
                        drawingType: drawingType,
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
                    onStateChange(currentState);
                }
                setShowBgModal(false);
                if (!openedFromFunctionBar) {
                    setSidebarVisible(true);
                }
                setOpenedFromFunctionBar(false);
            }} title="背景画像設定" position="right" className="bg-modal">
                <div className="modal-content-inner">
                    <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="file-input"
                    />
                    <p className="bg-image-compress-notice">
                        ※ 1.5MB以上の画像は自動的に圧縮されます
                    </p>
                    {loadedBackgroundImage && (
                        <>
                            <div className="modal-setting-item">
                                <label htmlFor="bgImageScale" className="modal-label">
                                    画像サイズ : {(bgImageScale * 100).toFixed(1)}% 
                                    ({((initialBgImageWidth * bgImageScale) / 25).toFixed(1)}×{((initialBgImageHeight * bgImageScale) / 25).toFixed(1)}cm)
                                </label>
                                <input
                                    id="bgImageScale"
                                    type="range"
                                    min="0.1"
                                    max="5.0"
                                    step="0.001"
                                    value={bgImageScale}
                                    onChange={(e) => setBgImageScale(Number(e.target.value))}
                                    className="range-input"
                                />
                                <div className="bg-scale-input-container">
                                    <label className="direct-input-label">画像横幅 :</label>
                                    <input
                                        ref={widthInputRef}
                                        type="number"
                                        min="0.5"
                                        placeholder="横幅を入力"
                                        onInput={() => {
                                            isUserTypingRef.current = true;
                                        }}
                                        onChange={(e) => {
                                            const inputValue = e.target.value;
                                            if (inputValue === '') return;
                                            
                                            const targetWidthCm = parseFloat(inputValue);
                                            if (!isNaN(targetWidthCm) && targetWidthCm >= 0.5 && initialBgImageWidth > 0) {
                                                const newScale = (targetWidthCm * 25) / initialBgImageWidth;
                                                setBgImageScale(Math.max(0.1, Math.min(5.0, newScale)));
                                            }
                                        }}
                                        onFocus={(e) => {
                                            isUserTypingRef.current = true;
                                            e.target.select();
                                        }}
                                        onBlur={() => {
                                            isUserTypingRef.current = false;
                                        }}
                                        onWheel={(e) => {
                                            e.target.blur();
                                        }}
                                        className="direct-number-input"
                                    />
                                    <span className="input-unit">cm</span>
                                </div>
                            </div>
                            {/* X/Y position controls */}
                            <div className="modal-setting-item">
                                <label htmlFor="bgImageX" className="modal-label">
                                    X位置 : {(bgImageX / 25).toFixed(1)}cm
                                </label>
                                <input
                                    id="bgImageX"
                                    type="range"
                                    min="-2500"
                                    max="2500"
                                    step="25"
                                    value={bgImageX}
                                    onChange={(e) => setBgImageX(Number(e.target.value))}
                                    className="range-input"
                                />
                            </div>
                            <div className="modal-setting-item">
                                <label htmlFor="bgImageY" className="modal-label">
                                    Y位置 : {(bgImageY / 25).toFixed(1)}cm
                                </label>
                                <input
                                    id="bgImageY"
                                    type="range"
                                    min="-2500"
                                    max="2500"
                                    step="25"
                                    value={bgImageY}
                                    onChange={(e) => setBgImageY(Number(e.target.value))}
                                    className="range-input"
                                />
                            </div>
                            <div className="modal-setting-item">
                                <label htmlFor="bgImageOpacity" className="modal-label">
                                    透明度 : {(bgImageOpacity * 100).toFixed(0)}%
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
                            <div className="modal-buttons-container">
                                <button
                                    onClick={() => {
                                        setBgImageX(0);
                                        setBgImageY(0);
                                    }}
                                    className="reset-position-button"
                                >
                                    位置をリセット
                                </button>
                                <button
                                    onClick={() => {
                                        setBgImageScale(1.0);
                                        setBgImageOpacity(1.0);
                                    }}
                                    className="reset-size-button"
                                >
                                    サイズ・透明度をリセット
                                </button>
                                <button
                                    onClick={clearBackgroundImage}
                                    className="clear-image-button"
                                >
                                    画像をクリア
                                </button>
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
                        <label htmlFor="fillPointColor" className="modal-label">ベースプレートの点の色</label>
                        <input
                            id="fillPointColor"
                            type="color"
                            value={colors.fillPoint}
                            onChange={(e) => setColors(prev => ({ ...prev, fillPoint: e.target.value }))}
                            className="color-input"
                        />
                    </div>
                    <div className="modal-setting-item">
                        <label htmlFor="fillAreaColor" className="modal-label">ベースプレートの中身の色</label>
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
                        <label htmlFor="fillBorderColor" className="modal-label">ベースプレートの境界線の色</label>
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
                            ベースプレートの境界線の太さ: {lineWidths.fillBorder}px
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
                                strokePoint: '#ffffff',
                                strokeLine: '#ffffff',
                                fillPoint: '#34d399',
                                fillArea: 'rgba(110, 110, 110, 0.5)',
                                fillBorder: '#000000',
                                background: '#191919',
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

            {/* 自動長方形生成モーダル */}
            <Modal isOpen={showRectangleModal} title="ベースプレート自動生成(長方形)" position="right" className="rectangle-generation-modal">
                <div className="modal-content-inner">
                <label htmlFor="rectangleSize" className="modal-label">
                            余白: {rectangleSize}cm
                        </label>
                    <div className="modal-setting-item">
                        <input
                            id="rectangleSize"
                            type="range"
                            min="1.5"
                            max="10"
                            step="0.1"
                            defaultValue="3"
                            value={rectangleSize}
                            onChange={(e) => setRectangleSize(Number(e.target.value))}
                            className="scale-range-input"
                        />
                        <div className="rectangle-margin-input-container">
                            <label className="direct-input-label">余白 :</label>
                            <input
                                type="number"
                                min="1.5"
                                max="10"
                                step="0.1"
                                placeholder="余白を入力"
                                value={rectangleSize}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setRectangleSize(val);
                                }}
                                onBlur={(e) => {
                                    const val = e.target.value;
                                    if (val === '' || val === '-') {
                                        setRectangleSize(3);
                                    } else {
                                        const numVal = Number(val);
                                        if (!isNaN(numVal)) {
                                            setRectangleSize(Math.max(1.5, Math.min(10, numVal)));
                                        }
                                    }
                                }}
                                onFocus={(e) => {
                                    e.target.select();
                                }}
                                onWheel={(e) => {
                                    e.target.blur();
                                }}
                                className="direct-number-input"
                            />
                            <span className="unit-label">cm</span>
                        </div>
                    </div>

                    <label htmlFor="rectangleRadius" className="modal-label">
                            角丸半径: {rectangleRadius}cm
                        </label>
                    <div className="modal-setting-item">
                        <input
                            id="rectangleRadius"
                            type="range"
                            min="0.5"
                            max="20"
                            step="0.1"
                            defaultValue="1"
                            value={rectangleRadius}
                            onChange={(e) => setRectangleRadius(Number(e.target.value))}
                            className="scale-range-input"
                        />
                        <div className="rectangle-radius-input-container">
                            <label className="direct-input-label">角丸半径 :</label>
                            <input
                                type="number"
                                min="0.5"
                                max="20"
                                step="0.1"
                                placeholder="角丸半径を入力"
                                value={rectangleRadius}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setRectangleRadius(val);
                                }}
                                onBlur={(e) => {
                                    const val = e.target.value;
                                    if (val === '' || val === '-') {
                                        setRectangleRadius(1);
                                    } else {
                                        const numVal = Number(val);
                                        if (!isNaN(numVal)) {
                                            setRectangleRadius(Math.max(0.5, Math.min(20, numVal)));
                                        }
                                    }
                                }}
                                onFocus={(e) => {
                                    e.target.select();
                                }}
                                onWheel={(e) => {
                                    e.target.blur();
                                }}
                                className="direct-number-input"
                            />
                            <span className="unit-label">cm</span>
                        </div>
                    </div>

                    <div className="rectangle-modal-buttons">
                        <button
                            onClick={() => {
                                // 長方形ベースプレートを生成
                                const rectangleBase = calculateRectangleBase(rectangleSize);
                                if (rectangleBase) {
                                    // 長方形の辺上に点を配置（4cm = 100px間隔、角丸半径付き）
                                    const rectanglePoints = subdivideRectangleEdges(rectangleBase, 100, rectangleRadius);

                                    // 新しいベースプレートパスを作成
                                    const newPath = {
                                        points: rectanglePoints,
                                        mode: 'fill',
                                        type: 'straight'
                                    };
                                    
                                    // パスを追加
                                    setPaths(prevPaths => {
                                        const newPaths = [...prevPaths];
                                        // 既存のベースプレートパスを削除（1つのベースプレートのみ許可）
                                        const filteredPaths = newPaths.filter(path => path.mode !== 'fill');
                                        // 新しいベースプレートパスを追加
                                        filteredPaths.push(newPath);
                                        
                                        // 履歴に保存（新しいパス状態で）
                                        setTimeout(() => {
                                            saveToHistory(filteredPaths, currentPathIndex, drawMode, drawingType);
                                        }, 0);
                                        
                                        return filteredPaths;
                                    });
                                }

                                setShowRectangleModal(false);
                                setSidebarVisible(true);
                            }}
                            className="rectangle-generate-button"
                        >
                            ベースプレートを生成
                        </button>
                        <button
                            onClick={() => {
                                setShowRectangleModal(false);
                                setSidebarVisible(true);
                            }}
                            className="rectangle-cancel-button"
                        >
                            キャンセル
                        </button>
                    </div>
                </div>
            </Modal>

            {/* 自動円生成モーダル */}
            <Modal isOpen={showCircleModal} title="ベースプレート自動生成(円)" position="right" className="circle-generation-modal">
                <div className="modal-content-inner">
                    <label htmlFor="circleMargin" className="modal-label">
                        余白: {circleMargin}cm
                    </label>
                    <div className="modal-setting-item">
                        <input
                            id="circleMargin"
                            type="range"
                            min="1.5"
                            max="10"
                            step="0.1"
                            defaultValue="5"
                            value={circleMargin}
                            onChange={(e) => setCircleMargin(Number(e.target.value))}
                            className="scale-range-input"
                        />
                        <div className="circle-margin-input-container">
                            <label className="direct-input-label">余白 :</label>
                            <input
                                type="number"
                                min="1.5"
                                max="10"
                                step="0.1"
                                placeholder="余白を入力"
                                value={circleMargin}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setCircleMargin(val);
                                }}
                                onBlur={(e) => {
                                    const val = e.target.value;
                                    if (val === '' || val === '-') {
                                        setCircleMargin(5);
                                    } else {
                                        const numVal = Number(val);
                                        if (!isNaN(numVal)) {
                                            setCircleMargin(Math.max(1.5, Math.min(10, numVal)));
                                        }
                                    }
                                }}
                                onFocus={(e) => {
                                    e.target.select();
                                }}
                                onWheel={(e) => {
                                    e.target.blur();
                                }}
                                className="direct-number-input"
                            />
                            <span className="unit-label">cm</span>
                        </div>
                    </div>

                    {/* 位置調整セクション */}
                    <div className="template-position-section">
                        <div className="template-position-title">位置調整</div>

                        {/* X位置 */}
                        <div className="template-setting-item">
                        <label htmlFor="circleX" className="template-label">
                            X位置: {circleX}cm
                        </label>
                        <input
                            id="circleX"
                            type="range"
                            min="-30"
                            max="30"
                            step="0.05"
                            value={circleX}
                            onChange={(e) => setCircleX(Number(e.target.value))}
                            className="template-range-input"
                        />
                        <div className="circle-x-input-container">
                            <label className="direct-input-label">X位置 :</label>
                            <input
                                type="number"
                                min="-30"
                                max="30"
                                step="0.1"
                                placeholder="X位置を入力"
                                value={circleX}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setCircleX(val);
                                }}
                                onBlur={(e) => {
                                    const val = e.target.value;
                                    if (val === '' || val === '-') {
                                        setCircleX(0);
                                    } else {
                                        const numVal = Number(val);
                                        if (!isNaN(numVal)) {
                                            setCircleX(Math.max(-30, Math.min(30, numVal)));
                                        }
                                    }
                                }}
                                onFocus={(e) => {
                                    e.target.select();
                                }}
                                onWheel={(e) => {
                                    e.target.blur();
                                }}
                                className="direct-number-input"
                            />
                            <span className="unit-label">cm</span>
                        </div>
                    </div>

                    {/* Y位置 */}
                    <div className="template-setting-item">
                        <label htmlFor="circleY" className="template-label">
                            Y位置: {circleY}cm
                        </label>
                        <input
                            id="circleY"
                            type="range"
                            min="-30"
                            max="30"
                            step="0.05"
                            value={circleY}
                            onChange={(e) => setCircleY(Number(e.target.value))}
                            className="template-range-input"
                        />
                        <div className="circle-y-input-container">
                            <label className="direct-input-label">Y位置 :</label>
                            <input
                                type="number"
                                min="-30"
                                max="30"
                                step="0.1"
                                placeholder="Y位置を入力"
                                value={circleY}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setCircleY(val);
                                }}
                                onBlur={(e) => {
                                    const val = e.target.value;
                                    if (val === '' || val === '-') {
                                        setCircleY(0);
                                    } else {
                                        const numVal = Number(val);
                                        if (!isNaN(numVal)) {
                                            setCircleY(Math.max(-30, Math.min(30, numVal)));
                                        }
                                    }
                                }}
                                onFocus={(e) => {
                                    e.target.select();
                                }}
                                onWheel={(e) => {
                                    e.target.blur();
                                }}
                                className="direct-number-input"
                            />
                            <span className="unit-label">cm</span>
                        </div>
                    </div>
                    </div>

                    <div className="rectangle-modal-buttons">
                        <button
                            onClick={() => {
                                // 円形ベースプレートを生成
                                const circleBase = calculateCircleBase(circleMargin);
                                if (circleBase) {
                                    // 位置調整を反映（cmをピクセルに変換）
                                    const offsetXPx = (circleX * 100) / 4;
                                    const offsetYPx = (circleY * 100) / 4;
                                    circleBase.centerX += offsetXPx;
                                    circleBase.centerY += offsetYPx;

                                    // 円周上に点を配置（5px間隔）
                                    const circlePoints = subdivideCircleEdge(circleBase, 5);

                                    // 新しいベースプレートパスを作成
                                    const newPath = {
                                        points: circlePoints,
                                        mode: 'fill',
                                        type: 'straight'
                                    };

                                    // パスを追加
                                    setPaths(prevPaths => {
                                        const newPaths = [...prevPaths];
                                        // 既存のベースプレートパスを削除（1つのベースプレートのみ許可）
                                        const filteredPaths = newPaths.filter(path => path.mode !== 'fill');
                                        // 新しいベースプレートパスを追加
                                        filteredPaths.push(newPath);

                                        // 履歴に保存（新しいパス状態で）
                                        setTimeout(() => {
                                            saveToHistory(filteredPaths, currentPathIndex, drawMode, drawingType);
                                        }, 0);

                                        return filteredPaths;
                                    });
                                }

                                setShowCircleModal(false);
                                setSidebarVisible(true);
                            }}
                            className="rectangle-generate-button"
                        >
                            ベースプレートを生成
                        </button>
                        <button
                            onClick={() => {
                                setShowCircleModal(false);
                                setSidebarVisible(true);
                            }}
                            className="rectangle-cancel-button"
                        >
                            キャンセル
                        </button>
                    </div>
                </div>
            </Modal>

            {/* チューブ素材テンプレートモーダル */}
            <Modal isOpen={showTemplateModal} title="素材の種類を選択" position="center" showCloseButton={true} onClose={() => { setShowTemplateModal(false); setSidebarVisible(true); }}>
                <p className="drawing-type-description">テンプレートの種類を選択してください。</p>
                <div className="drawing-type-buttons">
                    <button
                        onClick={() => {
                            // 初期値にリセット
                            setRectTemplateWidth(3);
                            setRectTemplateHeight(3);
                            setRectTemplateRadius(0);
                            setRectTemplateX(0);
                            setRectTemplateY(0);
                            setRectTemplateAngle(0);
                            setShowTemplateModal(false);
                            setShowRectTemplateModal(true);
                        }}
                        className="drawing-type-button button-secondary"
                    >
                        長方形
                    </button>
                    <button
                        onClick={() => {
                            // 初期値にリセット
                            setCircleTemplateDiameter(6);
                            setCircleTemplateWidth(6);
                            setCircleTemplateHeight(6);
                            setCircleTemplateX(0);
                            setCircleTemplateY(0);
                            setShowTemplateModal(false);
                            setShowCircleTemplateModal(true);
                        }}
                        className="drawing-type-button button-secondary"
                    >
                        円
                    </button>
                    <button
                        onClick={() => {
                            // 初期値にリセット
                            setLineTemplateLength(10);
                            setLineTemplateCurve(0);
                            setLineTemplateX(0);
                            setLineTemplateY(0);
                            setLineTemplateAngle(0);
                            setShowTemplateModal(false);
                            setShowLineTemplateModal(true);
                        }}
                        className="drawing-type-button button-secondary"
                    >
                        直線
                    </button>
                </div>
            </Modal>

            {/* 長方形テンプレートモーダル */}
            <Modal
                isOpen={showRectTemplateModal}
                onClose={() => {
                    setShowRectTemplateModal(false);
                    setSidebarVisible(true);
                }}
                title="長方形テンプレート"
                position="right"
                className="rect-template-modal"
                showCloseButton={true}
            >
                <div className="modal-content-inner">
                    {/* サイズ・角半径設定 */}
                    <div className="template-size-section">
                        <div className="template-size-title">サイズ・角丸半径設定</div>

                        {/* 幅 */}
                        <div className="template-setting-item">
                        <label htmlFor="rectTemplateWidth" className="template-label">
                            幅: {rectTemplateWidth}cm
                        </label>
                        <input
                            id="rectTemplateWidth"
                            type="range"
                            min="3"
                            max="115"
                            step="0.05"
                            value={rectTemplateWidth}
                            onChange={(e) => setRectTemplateWidth(Number(e.target.value))}
                            className="template-range-input"
                        />
                        <div className="template-width-input-container">
                            <label className="direct-input-label">幅 :</label>
                            <input
                                type="number"
                                min="3"
                                max="115"
                                step="0.1"
                                placeholder="幅を入力"
                                value={rectTemplateWidth}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setRectTemplateWidth(val);
                                }}
                                onBlur={(e) => {
                                    const val = e.target.value;
                                    if (val === '' || val === '-') {
                                        setRectTemplateWidth(3);
                                    } else {
                                        const numVal = Number(val);
                                        if (!isNaN(numVal)) {
                                            setRectTemplateWidth(Math.max(3, Math.min(115, numVal)));
                                        }
                                    }
                                }}
                                onFocus={(e) => {
                                    e.target.select();
                                }}
                                onWheel={(e) => {
                                    e.target.blur();
                                }}
                                className="direct-number-input"
                            />
                            <span className="unit-label">cm</span>
                        </div>
                    </div>

                    {/* 高さ */}
                    <div className="template-setting-item">
                        <label htmlFor="rectTemplateHeight" className="template-label">
                            高さ: {rectTemplateHeight}cm
                        </label>
                        <input
                            id="rectTemplateHeight"
                            type="range"
                            min="3"
                            max="70"
                            step="0.05"
                            value={rectTemplateHeight}
                            onChange={(e) => setRectTemplateHeight(Number(e.target.value))}
                            className="template-range-input"
                        />
                        <div className="template-height-input-container">
                            <label className="direct-input-label">高さ :</label>
                            <input
                                type="number"
                                min="3"
                                max="70"
                                step="0.1"
                                placeholder="高さを入力"
                                value={rectTemplateHeight}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setRectTemplateHeight(val);
                                }}
                                onBlur={(e) => {
                                    const val = e.target.value;
                                    if (val === '' || val === '-') {
                                        setRectTemplateHeight(3);
                                    } else {
                                        const numVal = Number(val);
                                        if (!isNaN(numVal)) {
                                            setRectTemplateHeight(Math.max(3, Math.min(70, numVal)));
                                        }
                                    }
                                }}
                                onFocus={(e) => {
                                    e.target.select();
                                }}
                                onWheel={(e) => {
                                    e.target.blur();
                                }}
                                className="direct-number-input"
                            />
                            <span className="unit-label">cm</span>
                        </div>
                    </div>

                    {/* 角半径 */}
                    <div className="template-setting-item">
                        <label htmlFor="rectTemplateRadius" className="template-label">
                            角丸半径: {rectTemplateRadius}cm
                        </label>
                        <input
                            id="rectTemplateRadius"
                            type="range"
                            min="0"
                            max="30"
                            step="0.1"
                            value={rectTemplateRadius}
                            onChange={(e) => setRectTemplateRadius(Number(e.target.value))}
                            className="template-range-input"
                        />
                        <div className="template-radius-input-container">
                            <label className="direct-input-label">角丸半径 :</label>
                            <input
                                type="number"
                                min="0"
                                max="30"
                                step="0.1"
                                placeholder="角半径を入力"
                                value={rectTemplateRadius}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setRectTemplateRadius(val);
                                }}
                                onBlur={(e) => {
                                    const val = e.target.value;
                                    if (val === '' || val === '-') {
                                        setRectTemplateRadius(0);
                                    } else {
                                        const numVal = Number(val);
                                        if (!isNaN(numVal)) {
                                            setRectTemplateRadius(Math.max(0, Math.min(30, numVal)));
                                        }
                                    }
                                }}
                                onFocus={(e) => {
                                    e.target.select();
                                }}
                                onWheel={(e) => {
                                    e.target.blur();
                                }}
                                className="direct-number-input"
                            />
                            <span className="unit-label">cm</span>
                        </div>
                    </div>
                    </div>

                    {/* 位置調整 */}
                    <div className="template-position-section">
                        <div className="template-position-title">位置調整</div>

                        {/* X位置 */}
                        <div className="template-setting-item">
                        <label htmlFor="rectTemplateX" className="template-label">
                            X位置: {rectTemplateX}cm
                        </label>
                        <input
                            id="rectTemplateX"
                            type="range"
                            min="-50"
                            max="50"
                            step="0.05"
                            value={rectTemplateX}
                            onChange={(e) => setRectTemplateX(Number(e.target.value))}
                            className="template-range-input"
                        />
                        <div className="template-x-input-container">
                            <label className="direct-input-label">X位置 :</label>
                            <input
                                type="number"
                                min="-50"
                                max="50"
                                step="0.1"
                                placeholder="X位置を入力"
                                value={rectTemplateX}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setRectTemplateX(val);
                                }}
                                onBlur={(e) => {
                                    const val = e.target.value;
                                    if (val === '' || val === '-') {
                                        setRectTemplateX(0);
                                    } else {
                                        const numVal = Number(val);
                                        if (!isNaN(numVal)) {
                                            setRectTemplateX(Math.max(-50, Math.min(50, numVal)));
                                        }
                                    }
                                }}
                                onFocus={(e) => {
                                    e.target.select();
                                }}
                                onWheel={(e) => {
                                    e.target.blur();
                                }}
                                className="direct-number-input"
                            />
                            <span className="unit-label">cm</span>
                        </div>
                    </div>

                    {/* Y位置 */}
                    <div className="template-setting-item">
                        <label htmlFor="rectTemplateY" className="template-label">
                            Y位置: {rectTemplateY}cm
                        </label>
                        <input
                            id="rectTemplateY"
                            type="range"
                            min="-70"
                            max="70"
                            step="0.05"
                            value={rectTemplateY}
                            onChange={(e) => setRectTemplateY(Number(e.target.value))}
                            className="template-range-input"
                        />
                        <div className="template-y-input-container">
                            <label className="direct-input-label">Y位置 :</label>
                            <input
                                type="number"
                                min="-70"
                                max="70"
                                step="0.1"
                                placeholder="Y位置を入力"
                                value={rectTemplateY}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setRectTemplateY(val);
                                }}
                                onBlur={(e) => {
                                    const val = e.target.value;
                                    if (val === '' || val === '-') {
                                        setRectTemplateY(0);
                                    } else {
                                        const numVal = Number(val);
                                        if (!isNaN(numVal)) {
                                            setRectTemplateY(Math.max(-70, Math.min(70, numVal)));
                                        }
                                    }
                                }}
                                onFocus={(e) => {
                                    e.target.select();
                                }}
                                onWheel={(e) => {
                                    e.target.blur();
                                }}
                                className="direct-number-input"
                            />
                            <span className="unit-label">cm</span>
                        </div>
                    </div>

                    {/* 角度 */}
                    <div className="template-setting-item">
                        <label htmlFor="rectTemplateAngle" className="template-label">
                            角度: {rectTemplateAngle}°
                        </label>
                        <input
                            id="rectTemplateAngle"
                            type="range"
                            min="0"
                            max="360"
                            step="1"
                            value={rectTemplateAngle}
                            onChange={(e) => setRectTemplateAngle(Number(e.target.value))}
                            className="template-range-input"
                        />
                        <div className="template-y-input-container">
                            <label className="direct-input-label">角度 :</label>
                            <input
                                type="number"
                                min="0"
                                max="360"
                                step="1"
                                placeholder="角度を入力"
                                value={rectTemplateAngle}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setRectTemplateAngle(val);
                                }}
                                onBlur={(e) => {
                                    const val = e.target.value;
                                    if (val === '' || val === '-') {
                                        setRectTemplateAngle(0);
                                    } else {
                                        const numVal = Number(val);
                                        if (!isNaN(numVal)) {
                                            setRectTemplateAngle(Math.max(0, Math.min(360, numVal)));
                                        }
                                    }
                                }}
                                onFocus={(e) => {
                                    e.target.select();
                                }}
                                onWheel={(e) => {
                                    e.target.blur();
                                }}
                                className="direct-number-input"
                            />
                            <span className="unit-label">°</span>
                        </div>
                    </div>
                    </div>

                    <div className="rectangle-modal-buttons">
                        <button
                            onClick={() => {
                                // 長方形テンプレート生成処理
                                // cmをピクセルに変換 (100px = 4cm基準)
                                const widthPx = (rectTemplateWidth * 100) / 4;
                                const heightPx = (rectTemplateHeight * 100) / 4;

                                // 位置をピクセルに変換
                                const posX = (rectTemplateX * 100) / 4;
                                const posY = (rectTemplateY * 100) / 4;

                                // 常に左下基準で計算
                                // posX, posYは左下の座標
                                // 左上の座標 = (左辺のX, 下辺のY - 高さ)
                                const x = posX;
                                const y = posY - heightPx;

                                const rectangleBase = {
                                    x: x,
                                    y: y,
                                    width: widthPx,
                                    height: heightPx
                                };

                                // 長方形の辺上に点を配置（適度な間隔、角丸半径付き）
                                const rectanglePoints = subdivideRectangleEdges(rectangleBase, 50, rectTemplateRadius);

                                // 始点と同じ座標の点を終点に追加してスプラインを閉じる
                                if (rectanglePoints.length > 0) {
                                    rectanglePoints.push({ ...rectanglePoints[0] });
                                }

                                // 角度が0でない場合は、左下を中心に回転
                                if (rectTemplateAngle !== 0) {
                                    const angleRad = (rectTemplateAngle * Math.PI) / 180;
                                    const cosA = Math.cos(angleRad);
                                    const sinA = Math.sin(angleRad);
                                    const centerX = posX;
                                    const centerY = posY;

                                    for (let i = 0; i < rectanglePoints.length; i++) {
                                        const dx = rectanglePoints[i].x - centerX;
                                        const dy = rectanglePoints[i].y - centerY;
                                        rectanglePoints[i].x = centerX + dx * cosA - dy * sinA;
                                        rectanglePoints[i].y = centerY + dx * sinA + dy * cosA;
                                    }
                                }

                                // 新しいネオンチューブパスを作成
                                const newPath = {
                                    points: rectanglePoints,
                                    mode: 'stroke',
                                    type: 'spline'
                                };

                                setPaths(prevPaths => {
                                    // 最後のパスが空の場合は、それを置き換える
                                    const lastPath = prevPaths[prevPaths.length - 1];
                                    let newPaths;

                                    if (lastPath && lastPath.points.length === 0) {
                                        // 空のパスを置き換え
                                        newPaths = [...prevPaths.slice(0, -1), newPath];
                                    } else {
                                        // 空のパスがない場合は追加
                                        newPaths = [...prevPaths, newPath];
                                    }

                                    // currentPathIndexを新しいパスに更新
                                    const newPathIndex = newPaths.length - 1;
                                    setCurrentPathIndex(newPathIndex);

                                    // 履歴に保存
                                    setTimeout(() => {
                                        saveToHistory(newPaths, newPathIndex, 'stroke', 'spline');
                                    }, 0);

                                    return newPaths;
                                });

                                setShowRectTemplateModal(false);
                                setSidebarVisible(true);
                            }}
                            className="rectangle-generate-button"
                        >
                            生成
                        </button>
                        <button
                            onClick={() => {
                                setShowRectTemplateModal(false);
                                setSidebarVisible(true);
                            }}
                            className="rectangle-cancel-button"
                        >
                            キャンセル
                        </button>
                    </div>
                </div>
            </Modal>

            {/* 三角形テンプレートモーダル */}
            <Modal isOpen={showTriangleTemplateModal} title="三角形テンプレート" position="right" className="triangle-template-modal">
                <div className="modal-content-inner">
                    <p>三角形テンプレートの設定項目（後で追加）</p>
                    <div className="rectangle-modal-buttons">
                        <button
                            onClick={() => {
                                // 三角形テンプレート生成処理（後で実装）
                                setShowTriangleTemplateModal(false);
                                setSidebarVisible(true);
                            }}
                            className="rectangle-generate-button"
                        >
                            生成
                        </button>
                        <button
                            onClick={() => {
                                setShowTriangleTemplateModal(false);
                                setSidebarVisible(true);
                            }}
                            className="rectangle-cancel-button"
                        >
                            キャンセル
                        </button>
                    </div>
                </div>
            </Modal>

            {/* 円テンプレートモーダル */}
            <Modal
                isOpen={showCircleTemplateModal}
                onClose={() => {
                    setShowCircleTemplateModal(false);
                    setSidebarVisible(true);
                }}
                title="円テンプレート"
                position="right"
                className="circle-template-modal"
                showCloseButton={true}
            >
                <div className="modal-content-inner">
                    {/* サイズ調整 */}
                    <div className="template-size-section">
                        <div className="template-size-title">サイズ調整</div>

                        {/* 直径 */}
                        <div className="template-setting-item">
                        <label htmlFor="circleTemplateDiameter" className="template-label">
                            直径: {circleTemplateDiameter}cm
                        </label>
                        <input
                            id="circleTemplateDiameter"
                            type="range"
                            min="3"
                            max="115"
                            step="0.05"
                            value={circleTemplateDiameter}
                            onChange={(e) => {
                                const newDiameter = Number(e.target.value);
                                setCircleTemplateDiameter(newDiameter);
                                setCircleTemplateWidth(newDiameter);
                                setCircleTemplateHeight(newDiameter);
                            }}
                            className="template-range-input"
                        />
                        <div className="template-diameter-input-container">
                            <label className="direct-input-label">直径 :</label>
                            <input
                                type="number"
                                min="3"
                                max="115"
                                step="0.1"
                                placeholder="直径を入力"
                                value={circleTemplateDiameter}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setCircleTemplateDiameter(val);
                                }}
                                onBlur={(e) => {
                                    const val = e.target.value;
                                    let newDiameter;
                                    if (val === '' || val === '-') {
                                        newDiameter = 10;
                                    } else {
                                        const numVal = Number(val);
                                        if (!isNaN(numVal)) {
                                            newDiameter = Math.max(3, Math.min(115, numVal));
                                        } else {
                                            newDiameter = 10;
                                        }
                                    }
                                    setCircleTemplateDiameter(newDiameter);
                                    setCircleTemplateWidth(newDiameter);
                                    setCircleTemplateHeight(newDiameter);
                                }}
                                onFocus={(e) => {
                                    e.target.select();
                                }}
                                onWheel={(e) => {
                                    e.target.blur();
                                }}
                                className="direct-number-input"
                            />
                            <span className="unit-label">cm</span>
                        </div>
                    </div>

                        {/* 幅 */}
                        <div className="template-setting-item">
                        <label htmlFor="circleTemplateWidth" className="template-label">
                            幅: {circleTemplateWidth}cm
                        </label>
                        <input
                            id="circleTemplateWidth"
                            type="range"
                            min="3"
                            max="115"
                            step="0.05"
                            value={circleTemplateWidth}
                            onChange={(e) => setCircleTemplateWidth(Number(e.target.value))}
                            className="template-range-input"
                        />
                        <div className="template-width-input-container">
                            <label className="direct-input-label">幅 :</label>
                            <input
                                type="number"
                                min="3"
                                max="115"
                                step="0.1"
                                placeholder="幅を入力"
                                value={circleTemplateWidth}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setCircleTemplateWidth(val);
                                }}
                                onBlur={(e) => {
                                    const val = e.target.value;
                                    if (val === '' || val === '-') {
                                        setCircleTemplateWidth(10);
                                    } else {
                                        const numVal = Number(val);
                                        if (!isNaN(numVal)) {
                                            setCircleTemplateWidth(Math.max(3, Math.min(115, numVal)));
                                        }
                                    }
                                }}
                                onFocus={(e) => {
                                    e.target.select();
                                }}
                                onWheel={(e) => {
                                    e.target.blur();
                                }}
                                className="direct-number-input"
                            />
                            <span className="unit-label">cm</span>
                        </div>
                    </div>

                    {/* 高さ */}
                    <div className="template-setting-item">
                        <label htmlFor="circleTemplateHeight" className="template-label">
                            高さ: {circleTemplateHeight}cm
                        </label>
                        <input
                            id="circleTemplateHeight"
                            type="range"
                            min="3"
                            max="115"
                            step="0.05"
                            value={circleTemplateHeight}
                            onChange={(e) => setCircleTemplateHeight(Number(e.target.value))}
                            className="template-range-input"
                        />
                        <div className="template-height-input-container">
                            <label className="direct-input-label">高さ :</label>
                            <input
                                type="number"
                                min="3"
                                max="115"
                                step="0.1"
                                placeholder="高さを入力"
                                value={circleTemplateHeight}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setCircleTemplateHeight(val);
                                }}
                                onBlur={(e) => {
                                    const val = e.target.value;
                                    if (val === '' || val === '-') {
                                        setCircleTemplateHeight(10);
                                    } else {
                                        const numVal = Number(val);
                                        if (!isNaN(numVal)) {
                                            setCircleTemplateHeight(Math.max(3, Math.min(115, numVal)));
                                        }
                                    }
                                }}
                                onFocus={(e) => {
                                    e.target.select();
                                }}
                                onWheel={(e) => {
                                    e.target.blur();
                                }}
                                className="direct-number-input"
                            />
                            <span className="unit-label">cm</span>
                        </div>
                    </div>
                    </div>

                    {/* 位置調整 */}
                    <div className="template-position-section">
                        <div className="template-position-title">位置調整</div>

                        {/* X位置 */}
                        <div className="template-setting-item">
                        <label htmlFor="circleTemplateX" className="template-label">
                            X位置: {circleTemplateX}cm
                        </label>
                        <input
                            id="circleTemplateX"
                            type="range"
                            min="-50"
                            max="50"
                            step="0.05"
                            value={circleTemplateX}
                            onChange={(e) => setCircleTemplateX(Number(e.target.value))}
                            className="template-range-input"
                        />
                        <div className="template-x-input-container">
                            <label className="direct-input-label">X位置 :</label>
                            <input
                                type="number"
                                min="-50"
                                max="50"
                                step="0.1"
                                placeholder="X位置を入力"
                                value={circleTemplateX}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setCircleTemplateX(val);
                                }}
                                onBlur={(e) => {
                                    const val = e.target.value;
                                    if (val === '' || val === '-') {
                                        setCircleTemplateX(0);
                                    } else {
                                        const numVal = Number(val);
                                        if (!isNaN(numVal)) {
                                            setCircleTemplateX(Math.max(-50, Math.min(50, numVal)));
                                        }
                                    }
                                }}
                                onFocus={(e) => {
                                    e.target.select();
                                }}
                                onWheel={(e) => {
                                    e.target.blur();
                                }}
                                className="direct-number-input"
                            />
                            <span className="unit-label">cm</span>
                        </div>
                    </div>

                    {/* Y位置 */}
                    <div className="template-setting-item">
                        <label htmlFor="circleTemplateY" className="template-label">
                            Y位置: {circleTemplateY}cm
                        </label>
                        <input
                            id="circleTemplateY"
                            type="range"
                            min="-70"
                            max="70"
                            step="0.05"
                            value={circleTemplateY}
                            onChange={(e) => setCircleTemplateY(Number(e.target.value))}
                            className="template-range-input"
                        />
                        <div className="template-y-input-container">
                            <label className="direct-input-label">Y位置 :</label>
                            <input
                                type="number"
                                min="-70"
                                max="70"
                                step="0.1"
                                placeholder="Y位置を入力"
                                value={circleTemplateY}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setCircleTemplateY(val);
                                }}
                                onBlur={(e) => {
                                    const val = e.target.value;
                                    if (val === '' || val === '-') {
                                        setCircleTemplateY(0);
                                    } else {
                                        const numVal = Number(val);
                                        if (!isNaN(numVal)) {
                                            setCircleTemplateY(Math.max(-70, Math.min(70, numVal)));
                                        }
                                    }
                                }}
                                onFocus={(e) => {
                                    e.target.select();
                                }}
                                onWheel={(e) => {
                                    e.target.blur();
                                }}
                                className="direct-number-input"
                            />
                            <span className="unit-label">cm</span>
                        </div>
                    </div>
                    </div>

                    <div className="rectangle-modal-buttons">
                        <button
                            onClick={() => {
                                // 円テンプレート生成処理
                                // cmをピクセルに変換 (100px = 4cm基準)
                                const widthPx = (circleTemplateWidth * 100) / 4;
                                const heightPx = (circleTemplateHeight * 100) / 4;

                                // 位置をピクセルに変換（左下基準）
                                const posX = (circleTemplateX * 100) / 4;
                                const posY = (circleTemplateY * 100) / 4;

                                // 中心座標を計算（左下基準から）
                                const centerX = posX + widthPx / 2;
                                const centerY = posY - heightPx / 2;

                                const ellipseBase = {
                                    centerX: centerX,
                                    centerY: centerY,
                                    radiusX: widthPx / 2,
                                    radiusY: heightPx / 2
                                };

                                // 楕円周上に点を配置
                                const ellipsePoints = subdivideEllipseEdge(ellipseBase, 50);

                                // 始点と同じ座標の点を終点に追加してスプラインを閉じる
                                if (ellipsePoints.length > 0) {
                                    ellipsePoints.push({ ...ellipsePoints[0] });
                                }

                                // 新しいネオンチューブパスを作成
                                const newPath = {
                                    points: ellipsePoints,
                                    mode: 'stroke',
                                    type: 'spline'
                                };

                                setPaths(prevPaths => {
                                    // 最後のパスが空の場合は、それを置き換える
                                    const lastPath = prevPaths[prevPaths.length - 1];
                                    let newPaths;

                                    if (lastPath && lastPath.points.length === 0) {
                                        // 空のパスを置き換え
                                        newPaths = [...prevPaths.slice(0, -1), newPath];
                                    } else {
                                        // 空のパスがない場合は追加
                                        newPaths = [...prevPaths, newPath];
                                    }

                                    // currentPathIndexを新しいパスに更新
                                    const newPathIndex = newPaths.length - 1;
                                    setCurrentPathIndex(newPathIndex);

                                    // 履歴に保存
                                    setTimeout(() => {
                                        saveToHistory(newPaths, newPathIndex, 'stroke', 'spline');
                                    }, 0);

                                    return newPaths;
                                });

                                setShowCircleTemplateModal(false);
                                setSidebarVisible(true);
                            }}
                            className="rectangle-generate-button"
                        >
                            生成
                        </button>
                        <button
                            onClick={() => {
                                setShowCircleTemplateModal(false);
                                setSidebarVisible(true);
                            }}
                            className="rectangle-cancel-button"
                        >
                            キャンセル
                        </button>
                    </div>
                </div>
            </Modal>

            {/* 直線テンプレートモーダル */}
            <Modal
                isOpen={showLineTemplateModal}
                onClose={() => {
                    setShowLineTemplateModal(false);
                    setSidebarVisible(true);
                }}
                title="直線テンプレート"
                position="right"
                className="line-template-modal"
                showCloseButton={true}
            >
                <div className="modal-content-inner">
                    {/* サイズ調整セクション */}
                    <div className="template-size-section">
                        <div className="template-size-title">サイズ調整</div>

                        {/* 長さ */}
                        <div className="template-setting-item">
                            <label htmlFor="lineLength" className="template-label">
                                長さ: {lineTemplateLength}cm
                            </label>
                            <input
                                id="lineLength"
                                type="range"
                                min="3"
                                max="115"
                                step="0.05"
                                value={lineTemplateLength}
                                onChange={(e) => setLineTemplateLength(Number(e.target.value))}
                                className="template-range-input"
                            />
                            <div className="line-length-input-container">
                                <label className="direct-input-label">長さ :</label>
                                <input
                                    type="number"
                                    min="3"
                                    max="115"
                                    step="0.1"
                                    value={lineTemplateLength}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setLineTemplateLength(val);
                                    }}
                                    onBlur={(e) => {
                                        const val = e.target.value;
                                        if (val === '' || val === '-') {
                                            setLineTemplateLength(3);
                                        } else {
                                            const numVal = Number(val);
                                            if (!isNaN(numVal)) {
                                                setLineTemplateLength(Math.max(3, Math.min(115, numVal)));
                                            }
                                        }
                                    }}
                                    onFocus={(e) => e.target.select()}
                                    onWheel={(e) => e.target.blur()}
                                    className="direct-number-input"
                                />
                                <span className="unit-label">cm</span>
                            </div>
                        </div>

                        {/* 曲げ具合 */}
                        <div className="template-setting-item">
                            <label htmlFor="lineCurve" className="template-label">
                                曲げ具合: {lineTemplateCurve}cm
                            </label>
                            <input
                                id="lineCurve"
                                type="range"
                                min="-60"
                                max="60"
                                step="0.1"
                                value={lineTemplateCurve}
                                onChange={(e) => setLineTemplateCurve(Number(e.target.value))}
                                className="template-range-input"
                            />
                            <div className="line-curve-input-container">
                                <label className="direct-input-label">曲げ具合 :</label>
                                <input
                                    type="number"
                                    min="-60"
                                    max="60"
                                    step="0.1"
                                    value={lineTemplateCurve}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setLineTemplateCurve(val);
                                    }}
                                    onBlur={(e) => {
                                        const val = e.target.value;
                                        if (val === '' || val === '-') {
                                            setLineTemplateCurve(0);
                                        } else {
                                            const numVal = Number(val);
                                            if (!isNaN(numVal)) {
                                                setLineTemplateCurve(Math.max(-60, Math.min(60, numVal)));
                                            }
                                        }
                                    }}
                                    onFocus={(e) => e.target.select()}
                                    onWheel={(e) => e.target.blur()}
                                    className="direct-number-input"
                                />
                                <span className="unit-label">cm</span>
                            </div>
                        </div>
                    </div>

                    {/* 位置調整セクション */}
                    <div className="template-position-section">
                        <div className="template-position-title">位置調整</div>

                        {/* X位置 */}
                        <div className="template-setting-item">
                            <label htmlFor="lineX" className="template-label">
                                X位置: {lineTemplateX.toFixed(1)}cm
                            </label>
                            <input
                                id="lineX"
                                type="range"
                                min="-30"
                                max="30"
                                step="0.1"
                                value={lineTemplateX}
                                onChange={(e) => setLineTemplateX(Number(e.target.value))}
                                className="template-range-input"
                            />
                            <div className="line-x-input-container">
                                <label className="direct-input-label">X位置 :</label>
                                <input
                                    type="number"
                                    min="-30"
                                    max="30"
                                    step="0.1"
                                    value={lineTemplateX}
                                    onChange={(e) => {
                                        const val = Number(e.target.value);
                                        setLineTemplateX(val);
                                    }}
                                    onBlur={(e) => {
                                        let val = Number(e.target.value);
                                        if (val < -30) val = -30;
                                        if (val > 30) val = 30;
                                        setLineTemplateX(val);
                                    }}
                                    onFocus={(e) => e.target.select()}
                                    onWheel={(e) => e.target.blur()}
                                    className="direct-number-input"
                                />
                                <span className="unit-label">cm</span>
                            </div>
                        </div>

                        {/* Y位置 */}
                        <div className="template-setting-item">
                            <label htmlFor="lineY" className="template-label">
                                Y位置: {lineTemplateY.toFixed(1)}cm
                            </label>
                            <input
                                id="lineY"
                                type="range"
                                min="-30"
                                max="30"
                                step="0.1"
                                value={lineTemplateY}
                                onChange={(e) => setLineTemplateY(Number(e.target.value))}
                                className="template-range-input"
                            />
                            <div className="line-y-input-container">
                                <label className="direct-input-label">Y位置 :</label>
                                <input
                                    type="number"
                                    min="-30"
                                    max="30"
                                    step="0.1"
                                    value={lineTemplateY}
                                    onChange={(e) => {
                                        const val = Number(e.target.value);
                                        setLineTemplateY(val);
                                    }}
                                    onBlur={(e) => {
                                        let val = Number(e.target.value);
                                        if (val < -30) val = -30;
                                        if (val > 30) val = 30;
                                        setLineTemplateY(val);
                                    }}
                                    onFocus={(e) => e.target.select()}
                                    onWheel={(e) => e.target.blur()}
                                    className="direct-number-input"
                                />
                                <span className="unit-label">cm</span>
                            </div>
                        </div>

                        {/* 角度 */}
                        <div className="template-setting-item">
                            <label htmlFor="lineAngle" className="template-label">
                                角度: {lineTemplateAngle.toFixed(0)}°
                            </label>
                            <input
                                id="lineAngle"
                                type="range"
                                min="-180"
                                max="180"
                                step="1"
                                value={lineTemplateAngle}
                                onChange={(e) => setLineTemplateAngle(Number(e.target.value))}
                                className="template-range-input"
                            />
                            <div className="line-angle-input-container">
                                <label className="direct-input-label">角度 :</label>
                                <input
                                    type="number"
                                    min="-180"
                                    max="180"
                                    step="1"
                                    value={lineTemplateAngle}
                                    onChange={(e) => {
                                        const val = Number(e.target.value);
                                        setLineTemplateAngle(val);
                                    }}
                                    onBlur={(e) => {
                                        let val = Number(e.target.value);
                                        if (val < -180) val = -180;
                                        if (val > 180) val = 180;
                                        setLineTemplateAngle(val);
                                    }}
                                    onFocus={(e) => e.target.select()}
                                    onWheel={(e) => e.target.blur()}
                                    className="direct-number-input"
                                />
                                <span className="unit-label">°</span>
                            </div>
                        </div>
                    </div>

                    {/* ボタン群 */}
                    <div className="rectangle-modal-buttons">
                        <button
                            onClick={() => {
                                // 直線テンプレート生成処理
                                // cmをピクセルに変換 (100px = 4cm基準)
                                const lengthPx = (lineTemplateLength * 100) / 4;
                                const curvePx = (lineTemplateCurve * 100) / 4;

                                // 位置をピクセルに変換
                                const posX = (lineTemplateX * 100) / 4;
                                const posY = (lineTemplateY * 100) / 4;

                                // 2次ベジェ曲線の点を計算
                                const startX = 0;
                                const startY = 0;
                                const endX = lengthPx;
                                const endY = 0;
                                const controlX = lengthPx / 2;
                                const controlY = -curvePx;

                                // 曲線上に点を配置（spacing: 5px間隔）
                                const spacing = 5;
                                const points = [];

                                // ベジェ曲線の長さを近似計算
                                let curveLength = 0;
                                const steps = 100;
                                let prevX = startX;
                                let prevY = startY;

                                for (let i = 1; i <= steps; i++) {
                                    const t = i / steps;
                                    const x = (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * controlX + t * t * endX;
                                    const y = (1 - t) * (1 - t) * startY + 2 * (1 - t) * t * controlY + t * t * endY;
                                    const dx = x - prevX;
                                    const dy = y - prevY;
                                    curveLength += Math.sqrt(dx * dx + dy * dy);
                                    prevX = x;
                                    prevY = y;
                                }

                                const numPoints = Math.max(2, Math.floor(curveLength / spacing));

                                // 等間隔で点を配置
                                for (let i = 0; i <= numPoints; i++) {
                                    const t = i / numPoints;
                                    const x = (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * controlX + t * t * endX;
                                    const y = (1 - t) * (1 - t) * startY + 2 * (1 - t) * t * controlY + t * t * endY;

                                    // 回転を適用
                                    const angleRad = (lineTemplateAngle * Math.PI) / 180;
                                    const cosA = Math.cos(angleRad);
                                    const sinA = Math.sin(angleRad);
                                    const rotatedX = x * cosA - y * sinA;
                                    const rotatedY = x * sinA + y * cosA;

                                    // 位置を適用
                                    points.push({
                                        x: posX + rotatedX,
                                        y: posY + rotatedY
                                    });
                                }

                                // 新しいネオンチューブパスを作成
                                const newPath = {
                                    points: points,
                                    mode: 'stroke',
                                    type: 'spline'
                                };

                                setPaths(prevPaths => {
                                    // 最後のパスが空の場合は、それを置き換える
                                    const lastPath = prevPaths[prevPaths.length - 1];
                                    let newPaths;

                                    if (lastPath && lastPath.points.length === 0) {
                                        // 空のパスを置き換え
                                        newPaths = [...prevPaths.slice(0, -1), newPath];
                                    } else {
                                        // 空のパスがない場合は追加
                                        newPaths = [...prevPaths, newPath];
                                    }

                                    // currentPathIndexを新しいパスに更新
                                    const newPathIndex = newPaths.length - 1;
                                    setCurrentPathIndex(newPathIndex);

                                    // 履歴に保存
                                    setTimeout(() => {
                                        saveToHistory(newPaths, newPathIndex, 'stroke', 'spline');
                                    }, 0);

                                    return newPaths;
                                });

                                setShowLineTemplateModal(false);
                                setSidebarVisible(true);
                            }}
                            className="rectangle-generate-button"
                        >
                            生成
                        </button>
                        <button
                            onClick={() => {
                                setShowLineTemplateModal(false);
                                setSidebarVisible(true);
                            }}
                            className="rectangle-cancel-button"
                        >
                            キャンセル
                        </button>
                    </div>
                </div>
            </Modal>

            {/* 拡大縮小モーダル */}
            <Modal isOpen={showScaleModal} onClose={closeScaleModal} title="拡大縮小" position="right">
                <div className="modal-content-inner scale-modal-content">
                    <div className="scale-setting-item">
                        <label htmlFor="scaleFactor" className="scale-label">
                            倍率 : {scaleFactor.toFixed(2)}x
                        </label>
                        <input
                            id="scaleFactor"
                            type="range"
                            min="0.1"
                            max="3.0"
                            step="0.01"
                            value={scaleFactor}
                            onChange={(e) => setScaleFactor(Number(e.target.value))}
                            className="scale-range-input"
                        />
                    </div>
                    
                    {/* モデルサイズ情報 */}
                    <div className="model-size-info">
                        <h4 className="size-info-title">モデルサイズ</h4>
                        <div className="size-info-grid">
                            <div className="size-info-item">
                                <div className="scale-input-container">
                                    <label className="direct-input-label">幅 :</label>
                                    <input
                                        ref={widthSizeInputRef}
                                        type="number"
                                        min="0.1"
                                        step="0.1"
                                        placeholder="幅を入力"
                                        onInput={() => {
                                            isUserTypingSizeRef.current = true;
                                        }}
                                        onChange={(e) => {
                                            const inputValue = e.target.value;
                                            if (inputValue === '') return;
                                            
                                            const targetWidthCm = parseFloat(inputValue);
                                            if (!isNaN(targetWidthCm) && targetWidthCm >= 0.1) {
                                                applyWidthChange(targetWidthCm);
                                            }
                                        }}
                                        onFocus={(e) => {
                                            isUserTypingSizeRef.current = true;
                                            e.target.select();
                                        }}
                                        onBlur={() => {
                                            isUserTypingSizeRef.current = false;
                                        }}
                                        onWheel={(e) => {
                                            e.target.blur();
                                        }}
                                        className="direct-number-input"
                                    />
                                    <span className="input-unit">cm</span>
                                </div>
                            </div>
                            <div className="size-info-item">
                                <div className="scale-input-container">
                                    <label className="direct-input-label">高さ :</label>
                                    <input
                                        ref={heightSizeInputRef}
                                        type="number"
                                        min="0.1"
                                        step="0.1"
                                        placeholder="高さを入力"
                                        onInput={() => {
                                            isUserTypingSizeRef.current = true;
                                        }}
                                        onChange={(e) => {
                                            const inputValue = e.target.value;
                                            if (inputValue === '') return;
                                            
                                            const targetHeightCm = parseFloat(inputValue);
                                            if (!isNaN(targetHeightCm) && targetHeightCm >= 0.1) {
                                                applyHeightChange(targetHeightCm);
                                            }
                                        }}
                                        onFocus={(e) => {
                                            isUserTypingSizeRef.current = true;
                                            e.target.select();
                                        }}
                                        onBlur={() => {
                                            isUserTypingSizeRef.current = false;
                                        }}
                                        onWheel={(e) => {
                                            e.target.blur();
                                        }}
                                        className="direct-number-input"
                                    />
                                    <span className="input-unit">cm</span>
                                </div>
                            </div>
                            <div className="size-info-item">
                                <span className="direct-input-label">チューブ長 :</span>
                                <span className="size-value">{modelSize.totalLength.toFixed(1)} cm</span>
                            </div>
                        </div>
                        
                    </div>
                    
                    {/* リセットボタン */}
                    <div className="modal-buttons-container">
                        <button
                            onClick={resetModelSize}
                            className="clear-image-button"
                        >
                            サイズをリセット
                        </button>
                    </div>
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
                                    「チューブ」モードではネオンチューブの線を描画し、「ベースプレート」モードではベースプレートの形状を描画できます。描画タイプは「スプライン」で滑らかな曲線、「直線」で角ばった線が描けます。
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
                            <div className="guide-notice-section">
                                <div className="guide-section-title">
                                    <div className="guide-section-icon">5</div>
                                    プロジェクトの保存・読み込み
                                </div>
                                <p>
                                    描いたネオン下絵を保存して、後で続きから作業できます。他の端末でも同じデータを読み込んで作業を再開できます。
                                </p>
                            </div>
                            <button 
                                onClick={() => {
                                    setShowGuideModal(false);
                                    onGuideEffectStop?.();
                                }} 
                                className="neon-guide-modal-close-button"
                            >
                                閉じる
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ガイドモーダル */}
            <NeonDrawingGuideModal 
                isOpen={isGuideModalOpen} 
                onClose={() => setIsGuideModalOpen(false)} 
            />
        </div>
    );
};

export default NeonDrawingApp;