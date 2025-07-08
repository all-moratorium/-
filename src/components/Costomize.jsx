import React, { useState, useRef, useEffect, useCallback } from 'react';
import './Costomize.css';

/* 背景色設定 */

// カスタマイズデータを保存するためのローカルストレージキー
const CUSTOMIZE_DATA_KEY = 'neon-customize-data';

// 座標制限関数（3m×3m = 原点から1.5m四方制限）
const limitCoordinates = (x, y) => {
    const HALF_SIZE = 3750; // 1.5m = 3750px (100px = 4cm基準)
    
    return {
        x: Math.max(-HALF_SIZE, Math.min(HALF_SIZE, x)),
        y: Math.max(-HALF_SIZE, Math.min(HALF_SIZE, y))
    };
};

const Costomize = ({ svgData, initialState, onStateChange }) => {
    // 初期状態の設定（propsから受け取るか、デフォルト値を使用）
    const [selectedColor, setSelectedColor] = useState(initialState?.selectedColor || '#ff0080');
    const brightness = 100; // 固定値
    const [thickness, setThickness] = useState(initialState?.thickness || 20);
    const glowIntensity = 50; // 固定値
    // 点滅エフェクトを削除
    const [sidebarVisible, setSidebarVisible] = useState(initialState?.sidebarVisible !== undefined ? initialState.sidebarVisible : true);
    const [neonPower, setNeonPower] = useState(initialState?.neonPower !== undefined ? initialState.neonPower : true); // ネオンON/OFF状態
    const [backgroundColor, setBackgroundColor] = useState(initialState?.backgroundColor || '#191919'); // RGB(25,25,25)
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
    const [isTubeSettingsMinimized, setIsTubeSettingsMinimized] = useState(
        initialState?.isTubeSettingsMinimized !== undefined ? initialState.isTubeSettingsMinimized : false
    );
    const [showGuideModal, setShowGuideModal] = useState(false);
    const [isGuideEffectStopped, setIsGuideEffectStopped] = useState(false);
    const [selectedBulkThickness, setSelectedBulkThickness] = useState(null); // 一括設定で選択された太さ
    const [selectedBulkColor, setSelectedBulkColor] = useState(null); // 一括設定で選択された色
    const [originalPathSettings, setOriginalPathSettings] = useState({}); // 元の設定を保存
    const [isProcessing3D, setIsProcessing3D] = useState(false); // 3D処理中フラグ
    const [processing3DProgress, setProcessing3DProgress] = useState(0); // 3D処理進捗
    const [processing3DMessage, setProcessing3DMessage] = useState(''); // 3D処理メッセージ
    const [neonPaths, setNeonPaths] = useState([]);
    const [neonColors, setNeonColors] = useState({});
    const [neonLineWidths, setNeonLineWidths] = useState({});
    const [isDataLoaded, setIsDataLoaded] = useState(!!svgData); // svgDataがあれば初期値をtrue
    const [isInitializing, setIsInitializing] = useState(true); // 初期化中フラグ
    const [canvasSettings, setCanvasSettings] = useState({
        scale: 1,
        offsetX: 0,
        offsetY: 0,
        segmentsPerCurve: 30
    });
    const [installationEnvironment, setInstallationEnvironment] = useState(initialState?.installationEnvironment || 'indoor'); // 'indoor' or 'outdoor'
    
    // 寸法表示用の状態
    const [modelSize, setModelSize] = useState({
        width: 0,
        height: 0,
        totalLength: 0
    });

    // モデルサイズを計算する関数
    const calculateModelSize = useCallback(() => {
        if (neonPaths.length === 0) {
            return { width: 0, height: 0, totalLength: 0 };
        }

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        let totalLength = 0;

        neonPaths.forEach(pathObj => {
            if (pathObj && pathObj.points && pathObj.points.length > 0) {
                // 境界計算
                pathObj.points.forEach(point => {
                    minX = Math.min(minX, point.x);
                    minY = Math.min(minY, point.y);
                    maxX = Math.max(maxX, point.x);
                    maxY = Math.max(maxY, point.y);
                });

                // パス長計算（strokeパスのみ）
                if (pathObj.mode === 'stroke' && pathObj.points.length > 1) {
                    for (let i = 0; i < pathObj.points.length - 1; i++) {
                        const dx = pathObj.points[i + 1].x - pathObj.points[i].x;
                        const dy = pathObj.points[i + 1].y - pathObj.points[i].y;
                        totalLength += Math.sqrt(dx * dx + dy * dy);
                    }
                }
            }
        });

        if (minX === Infinity) {
            return { width: 0, height: 0, totalLength: 0 };
        }

        // 25px = 1cm の基準で変換
        const widthCm = (maxX - minX) / 25;
        const heightCm = (maxY - minY) / 25;
        const totalLengthCm = totalLength / 25;

        return {
            width: widthCm,
            height: heightCm,
            totalLength: totalLengthCm
        };
    }, [neonPaths]);

    // Canvas画像を商品情報に送信する関数
    const sendCanvasImageToProductInfo = useCallback(() => {
        // 非同期で処理してUIをブロックしない（画像品質は維持）
        setTimeout(() => {
            try {
                if (neonPaths.length > 0) {
                    // ネオンパスの境界を計算
                    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                    
                    neonPaths.forEach(pathObj => {
                        if (pathObj && pathObj.points) {
                            pathObj.points.forEach(point => {
                                minX = Math.min(minX, point.x);
                                minY = Math.min(minY, point.y);
                                maxX = Math.max(maxX, point.x);
                                maxY = Math.max(maxY, point.y);
                            });
                        }
                    });
                    
                    if (minX !== Infinity) {
                        // 商品情報用のクリーンなCanvas画像を再生成（グリッドテキスト除外）
                        const cleanCanvas = document.createElement('canvas');
                        const cleanCtx = cleanCanvas.getContext('2d');
                        
                        // パディングを追加
                        const padding = 40;
                        const modelWidth = (maxX - minX) + padding * 2;
                        const modelHeight = (maxY - minY) + padding * 2;
                        
                        // アスペクト比を維持して正方形にする
                        const maxDimension = Math.max(modelWidth, modelHeight, 300); // 最小サイズ300px
                        cleanCanvas.width = maxDimension;
                        cleanCanvas.height = maxDimension;
                        
                        // 背景色を設定（商品情報用は常に黒背景）
                        cleanCtx.fillStyle = '#000000';
                        cleanCtx.fillRect(0, 0, maxDimension, maxDimension);
                        
                        // キャンバス設定を適用
                        const centerX = maxDimension / 2;
                        const centerY = maxDimension / 2;
                        const modelCenterX = (minX + maxX) / 2;
                        const modelCenterY = (minY + maxY) / 2;
                        
                        cleanCtx.save();
                        cleanCtx.translate(centerX - modelCenterX, centerY - modelCenterY);
                        
                        // 1. 土台（fill）パスを先に描画
                        neonPaths.forEach((pathObj, pathIndex) => {
                            if (!pathObj || !pathObj.points || pathObj.points.length < 2 || pathObj.mode !== 'fill') return;
                            
                            const fillColor = pathColors[`${pathIndex}_fill`] || 'transparent';
                            console.log(`PNG生成 fillパス${pathIndex}: fillColor=${fillColor}`);
                            if (fillColor && fillColor !== 'transparent') {
                                const opacity = 1.0; // プレビュー画像では常にグロー効果オン
                                cleanCtx.save();
                                cleanCtx.fillStyle = fillColor;
                                cleanCtx.globalAlpha = opacity;
                                cleanCtx.beginPath();
                                cleanCtx.moveTo(pathObj.points[0].x, pathObj.points[0].y);
                                pathObj.points.forEach((point, i) => {
                                    if (i > 0) cleanCtx.lineTo(point.x, point.y);
                                });
                                cleanCtx.closePath();
                                cleanCtx.fill();
                                cleanCtx.restore();
                                console.log(`PNG生成 fillパス${pathIndex}: 描画完了`);
                            } else {
                                console.log(`PNG生成 fillパス${pathIndex}: 透明のためスキップ`);
                            }
                        });
                        
                        // 2. ネオンチューブ（stroke）パスを後に描画
                        neonPaths.forEach((pathObj, pathIndex) => {
                            if (!pathObj || !pathObj.points || pathObj.points.length < 2 || pathObj.mode !== 'stroke') return;
                            // 0.7cm以下の短いチューブは除外
                            if (calculatePathLength(pathObj) / 25 * 10 <= 7) return;
                            
                            const color = pathColors[pathIndex] || neonColors.strokeLine || '#ffff00';
                            const thickness = pathThickness[pathIndex] || 15;
                            const opacity = 1.0; // プレビュー画像では常にグロー効果オン
                            console.log(`PNG生成 strokeパス${pathIndex}: color=${color} thickness=${thickness}`);
                            
                            const currentBrightness = brightness; // 色仕様のカスタマイズと同じ輝度を使用
                            
                            // 商品情報用画像では常にネオンONで描画するため、一時的にneonPowerを保存・変更
                            const originalNeonPower = neonPower;
                            // 直接変更は避けて、カスタム描画関数を使用
                            
                            // drawNeonTube関数のネオンON部分のみを抜粋して実行
                            // ネオンON時：メリハリのある光で描画
                            // 軽量1層shadowBlurグロー（メインキャンバスと統一）
                            cleanCtx.save();
                            cleanCtx.shadowColor = color;
                            cleanCtx.shadowBlur = 15;
                            cleanCtx.strokeStyle = adjustBrightness(color, Math.min(currentBrightness * 1.2, 200));
                            cleanCtx.globalAlpha = 1.0;
                            cleanCtx.lineWidth = thickness;
                            cleanCtx.lineCap = 'round';
                            cleanCtx.lineJoin = 'round';
                            drawPath(cleanCtx, pathObj.points, pathObj.type);
                            cleanCtx.restore();
                        });
                        
                        cleanCtx.restore();
                        
                        const canvasImageDataURL = cleanCanvas.toDataURL('image/png');
                        window.dispatchEvent(new CustomEvent('customizeCanvasImage', {
                            detail: { canvasImageDataURL }
                        }));
                    }
                }
            } catch (error) {
                // Canvas汚染エラー等の場合は無視
            }
        }, 100); // 100ms遅延で非同期実行（UIブロックを回避）
    }, [neonPaths, pathColors, pathThickness, neonColors, canvasSettings, neonPower]);
    
    const canvasRef = useRef(null);
    const animationRef = useRef(null);

    // selectedTubesが変更された時に新しく追加されたチューブに設定を適用
    useEffect(() => {
        if (selectedTubes.size > 0 && (selectedBulkColor || selectedBulkThickness)) {
            selectedTubes.forEach(index => {
                // 既に色・太さが適用されているかチェック
                const currentColor = pathColors[index];
                const currentThickness = pathThickness[index];
                
                // 選択された色・太さと違う場合は適用
                if (selectedBulkColor && currentColor !== selectedBulkColor) {
                    setPathColors(prev => ({ ...prev, [index]: selectedBulkColor }));
                }
                if (selectedBulkThickness && currentThickness !== selectedBulkThickness) {
                    setPathThickness(prev => ({ ...prev, [index]: selectedBulkThickness }));
                }
            });
        }
    }, [selectedTubes, selectedBulkColor, selectedBulkThickness, pathColors, pathThickness]);

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
                pathThickness,
                isTubeSettingsMinimized,
                installationEnvironment,
                scale: canvasSettings.scale,
                offsetX: canvasSettings.offsetX,
                offsetY: canvasSettings.offsetY
            };
            onStateChange(currentState);
        }
    }, [selectedColor, thickness, sidebarVisible, neonPower, backgroundColor, backgroundColorOff, gridColor, gridColorOff, showGrid, gridOpacity, pathColors, pathThickness, isTubeSettingsMinimized, installationEnvironment, canvasSettings, onStateChange]);

    // 最小化状態が変更された時に状態を保存
    useEffect(() => {
        saveCurrentState();
    }, [isTubeSettingsMinimized, saveCurrentState]);

    // カメラ位置が変更された時に状態を保存
    useEffect(() => {
        if (isDataLoaded) {
            saveCurrentState();
        }
    }, [canvasSettings, isDataLoaded, saveCurrentState]);

    const neonPresetColors = [
        '#ff0000', '#ff8000', '#ffee00', '#ffff40',
        '#00ff00', '#00ffff', '#0080ff', '#cc60ff',
        '#ff00ff', '#ffffff', '#f5f5dc', '#fff5e6'
    ];

    // 色名のマッピング
    const colorNameMap = {
        '#fff5e6': 'ワームホワイト',
        '#f5f5dc': 'ナチュラルホワイト',
        '#ffffff': 'ホワイト',
        '#ff0000': 'レッド',
        '#ff00ff': 'ピンク',
        '#ff8000': 'オレンジ',
        '#ffee00': 'イエロー',
        '#ffff40': 'レモンイエロー',
        '#00ff00': 'グリーン',
        '#00ffff': 'アイスブルー',
        '#0080ff': 'ブルー',
        '#cc60ff': 'パープル'
    };

    // プロジェクト保存機能
    const saveProjectToFile = useCallback(() => {
        // データがない場合は保存しない
        if (!neonPaths || neonPaths.length === 0) {
            alert('保存できるデータがありません。ネオン下絵からデータを作成するか、前回保存したデータを読み込んでください。');
            return;
        }
        
        // 現在の視点をそのまま保存

        const projectData = {
            version: '1.0',
            timestamp: new Date().toISOString(),
            selectedColor,
            brightness,
            thickness,
            glowIntensity,
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
            pathThickness,
            isTubeSettingsMinimized,
            neonPaths,
            neonColors,
            neonLineWidths,
            canvasSettings,
            installationEnvironment,
            svgData
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
        const defaultFileName = `neon-customize-project-${japanTime}`;
        const fileName = prompt('ファイル名を入力してください（拡張子は自動で追加されます）:', defaultFileName);
        if (!fileName) {
            return; // キャンセルされた場合は保存しない
        }
        
        const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${fileName}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, [selectedColor, thickness, sidebarVisible, neonPower, backgroundColor, backgroundColorOff, gridColor, gridColorOff, showGrid, gridOpacity, pathColors, pathThickness, isTubeSettingsMinimized, neonPaths, neonColors, neonLineWidths, canvasSettings, installationEnvironment]);

    // プロジェクト読み込み機能
    const loadProjectFromFile = useCallback((event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                // ファイル読み込み開始時に初期化フラグを設定（ちらつき防止）
                setIsInitializing(true);
                
                const projectData = JSON.parse(e.target.result);
                
                // ファイル形式の判定
                const isDrawingFile = projectData.metadata && projectData.metadata.type === 'neon-drawing-project';
                
                if (isDrawingFile) {
                    alert('こちらのファイルはネオン下絵で読み込んでください。');
                    return;
                }
                
                // データの復元
                if (projectData.selectedColor !== undefined) setSelectedColor(projectData.selectedColor);
                if (projectData.thickness !== undefined) setThickness(projectData.thickness);
                if (projectData.sidebarVisible !== undefined) setSidebarVisible(projectData.sidebarVisible);
                if (projectData.neonPower !== undefined) setNeonPower(projectData.neonPower);
                if (projectData.backgroundColor !== undefined) setBackgroundColor(projectData.backgroundColor);
                if (projectData.backgroundColorOff !== undefined) setBackgroundColorOff(projectData.backgroundColorOff);
                if (projectData.gridColor !== undefined) setGridColor(projectData.gridColor);
                if (projectData.gridColorOff !== undefined) setGridColorOff(projectData.gridColorOff);
                if (projectData.showGrid !== undefined) setShowGrid(projectData.showGrid);
                if (projectData.gridOpacity !== undefined) setGridOpacity(projectData.gridOpacity);
                if (projectData.gridSize !== undefined) setGridSize(projectData.gridSize);
                if (projectData.pathColors !== undefined) setPathColors(projectData.pathColors);
                if (projectData.pathThickness !== undefined) setPathThickness(projectData.pathThickness);
                if (projectData.isTubeSettingsMinimized !== undefined) setIsTubeSettingsMinimized(projectData.isTubeSettingsMinimized);
                if (projectData.neonPaths !== undefined) {
                    // プロジェクトデータの座標に3m×3m制限を適用
                    const limitedPaths = projectData.neonPaths.map(path => {
                        if (path && path.points && Array.isArray(path.points)) {
                            return {
                                ...path,
                                points: path.points.map(point => limitCoordinates(point.x, point.y))
                            };
                        }
                        return path;
                    });
                    setNeonPaths(limitedPaths);
                }
                if (projectData.neonColors !== undefined) setNeonColors(projectData.neonColors);
                if (projectData.neonLineWidths !== undefined) setNeonLineWidths(projectData.neonLineWidths);
                // 読み込み後は視点を初期化（即座に実行してちらつき防止）
                if (true) { // setTimeoutを削除して即座に実行
                    if (projectData.neonPaths && projectData.neonPaths.length > 0) {
                        // モデルの境界を計算
                        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                        projectData.neonPaths.forEach(pathObj => {
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
                            const padding = 200; // 周囲の余白
                            
                            const scaleX = (screenWidth - padding * 2) / modelWidth;
                            const scaleY = (screenHeight - padding * 2) / modelHeight;
                            const optimalScale = Math.min(scaleX, scaleY, 1); // 最大1倍まで
                            
                            // モデル中央を画面中央に配置するオフセット計算
                            const offsetX = screenWidth / 2 - modelCenterX * optimalScale;
                            const offsetY = screenHeight / 2 - modelCenterY * optimalScale;
                            
                            setCanvasSettings({
                                scale: optimalScale,
                                offsetX: offsetX,
                                offsetY: offsetY,
                                segmentsPerCurve: projectData.canvasSettings?.segmentsPerCurve || 30
                            });
                        } else {
                            // モデルがない場合はデフォルト
                            setCanvasSettings({
                                scale: 1,
                                offsetX: window.innerWidth / 2,
                                offsetY: window.innerHeight / 2,
                                segmentsPerCurve: projectData.canvasSettings?.segmentsPerCurve || 30
                            });
                        }
                    } else {
                        // データがない場合はデフォルト
                        setCanvasSettings({
                            scale: 1,
                            offsetX: window.innerWidth / 2,
                            offsetY: window.innerHeight / 2,
                            segmentsPerCurve: projectData.canvasSettings?.segmentsPerCurve || 30
                        });
                    }
                } // 即座に実行でちらつき防止
                
                if (projectData.installationEnvironment !== undefined) setInstallationEnvironment(projectData.installationEnvironment);
                
                // 視点計算完了後に表示開始
                setIsInitializing(false);

                // svgDataの復元（ネオン下絵データ）
                if (projectData.svgData !== undefined) {
                    // svgDataを直接更新するのではなく、親コンポーネントに通知
                    if (onStateChange) {
                        onStateChange({ svgData: projectData.svgData });
                    }
                }

                // データが読み込まれたことを明示的に設定
                if (projectData.neonPaths && projectData.neonPaths.length > 0) {
                    setIsDataLoaded(true);
                }

                // 読み込んだプロジェクトデータをグローバルにバックアップ
                window.lastLoadedCustomizeProject = projectData;
                // ファイルが読み込まれたことを記録
                window.customizeFileWasLoaded = true;

                // 新しいファイルが読み込まれたことをLaserCutImageProcessorに通知（customizeStateをクリアするため）
                const clearStateEvent = new CustomEvent('clearCustomizeState');
                window.dispatchEvent(clearStateEvent);

                // ネオン下絵コンポーネントで共有するためのファイルデータをイベントで送信
                if (projectData.neonPaths && projectData.neonPaths.length > 0) {
                    const sharedData = {
                        neonPaths: projectData.neonPaths,
                        neonColors: projectData.neonColors,
                        neonLineWidths: projectData.neonLineWidths,
                        canvasSettings: projectData.canvasSettings
                    };
                    
                    const event = new CustomEvent('sharedFileDataLoaded', {
                        detail: { fileData: sharedData }
                    });
                    window.dispatchEvent(event);
                }

                alert('プロジェクトが正常に読み込まれました！');
            } catch (error) {
                alert('プロジェクトファイルの読み込みに失敗しました。ファイル形式を確認してください。');
                console.error('Project load error:', error);
            }
        };
        reader.readAsText(file);
        // ファイル選択をリセット
        event.target.value = '';
    }, []);

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
        console.log(`色変更: パス${pathIndex} → ${color}`);
        setPathColors(prev => {
            const updated = {
                ...prev,
                [pathIndex]: color
            };
            console.log('更新後のpathColors:', updated);
            return updated;
        });
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

        // 最軽量グロー：shadowBlur使用（filterより圧倒的に軽い）
        ctx.save();
        
        // shadowBlurでグロー効果（GPUアクセラレーションが効く）
        ctx.shadowColor = color;
        ctx.shadowBlur = 15;
        ctx.strokeStyle = adjustBrightness(color, Math.min(brightness * 1.3, 255));
        ctx.globalAlpha = 1.0;
        ctx.lineWidth = thickness;
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
            glowIntensity
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
        
        // 視点復元は正式な保存システム（ファイル・グローバルバックアップ）を使用
        
        // グローバルバックアップからの復元を試行（ファイルが読み込まれた場合のみ）
        if (window.lastLoadedCustomizeProject && window.customizeFileWasLoaded && neonPaths.length === 0) {
            const projectData = window.lastLoadedCustomizeProject;
            
            // データの復元
            if (projectData.selectedColor !== undefined) setSelectedColor(projectData.selectedColor);
            if (projectData.thickness !== undefined) setThickness(projectData.thickness);
            if (projectData.sidebarVisible !== undefined) setSidebarVisible(projectData.sidebarVisible);
            if (projectData.neonPower !== undefined) setNeonPower(projectData.neonPower);
            if (projectData.backgroundColor !== undefined) setBackgroundColor(projectData.backgroundColor);
            if (projectData.backgroundColorOff !== undefined) setBackgroundColorOff(projectData.backgroundColorOff);
            if (projectData.gridColor !== undefined) setGridColor(projectData.gridColor);
            if (projectData.gridColorOff !== undefined) setGridColorOff(projectData.gridColorOff);
            if (projectData.showGrid !== undefined) setShowGrid(projectData.showGrid);
            if (projectData.gridOpacity !== undefined) setGridOpacity(projectData.gridOpacity);
            if (projectData.gridSize !== undefined) setGridSize(projectData.gridSize);
            if (projectData.pathColors !== undefined) setPathColors(projectData.pathColors);
            if (projectData.pathThickness !== undefined) setPathThickness(projectData.pathThickness);
            if (projectData.isTubeSettingsMinimized !== undefined) setIsTubeSettingsMinimized(projectData.isTubeSettingsMinimized);
            if (projectData.neonPaths !== undefined) {
                // 初期化時の座標に3m×3m制限を適用
                const limitedPaths = projectData.neonPaths.map(path => {
                    if (path && path.points && Array.isArray(path.points)) {
                        return {
                            ...path,
                            points: path.points.map(point => limitCoordinates(point.x, point.y))
                        };
                    }
                    return path;
                });
                setNeonPaths(limitedPaths);
            }
            if (projectData.neonColors !== undefined) setNeonColors(projectData.neonColors);
            if (projectData.neonLineWidths !== undefined) setNeonLineWidths(projectData.neonLineWidths);
            if (projectData.canvasSettings !== undefined) setCanvasSettings(projectData.canvasSettings);
            if (projectData.installationEnvironment !== undefined) setInstallationEnvironment(projectData.installationEnvironment);

            // svgDataの復元
            if (projectData.svgData !== undefined && onStateChange) {
                onStateChange({ svgData: projectData.svgData });
            }

            if (projectData.neonPaths && projectData.neonPaths.length > 0) {
                setIsDataLoaded(true);
            }
        }
        
        // 初期化完了フラグを設定（ちらつき防止）
        setIsInitializing(false);
    }, []);
    
    // コンポーネントアンマウント時にファイル読み込みフラグをクリア
    useEffect(() => {
        return () => {
            // 他のページに移動する際はフラグをクリアしない（戻ってきたときに復元したいため）
            // ホームページに戻ったときのみクリアは別途LaserCutImageProcessorで行う
        };
    }, []);

    // svgDataの変更を即座に検知
    useEffect(() => {
        setIsDataLoaded(!!svgData);
    }, [svgData]);

    // neonPathsの変更を検知してisDataLoadedを更新
    useEffect(() => {
        if (neonPaths.length > 0) {
            setIsDataLoaded(true);
        } else if (!svgData) {
            setIsDataLoaded(false);
        }
    }, [neonPaths, svgData]);

    // neonPathsが変更された時にmodelSizeを更新
    useEffect(() => {
        const newModelSize = calculateModelSize();
        setModelSize(newModelSize);
    }, [neonPaths, calculateModelSize]);

    // 設定変更時にグローバルバックアップを更新（ファイル読み込み後の変更を保持するため）
    useEffect(() => {
        if (window.lastLoadedCustomizeProject && isDataLoaded) {
            window.lastLoadedCustomizeProject = {
                ...window.lastLoadedCustomizeProject,
                selectedColor: selectedColor,
                thickness: thickness,
                backgroundColor: backgroundColor,
                gridColor: gridColor,
                showGrid: showGrid,
                gridOpacity: gridOpacity,
                pathColors: pathColors,
                pathThickness: pathThickness,
                neonPower: neonPower,
                backgroundColorOff: backgroundColorOff,
                gridColorOff: gridColorOff,
                gridSize: gridSize,
                isTubeSettingsMinimized: isTubeSettingsMinimized,
                installationEnvironment: installationEnvironment,
                canvasSettings: canvasSettings
            };
        }
    }, [
        selectedColor, thickness, backgroundColor,
        gridColor, showGrid, gridOpacity, pathColors, pathThickness, neonPower,
        backgroundColorOff, gridColorOff, gridSize, isTubeSettingsMinimized, 
        installationEnvironment, isDataLoaded, canvasSettings
    ]);

    // 3Dプレビューから戻った時の状態復元
    useEffect(() => {
        const handleRestoreState = (event) => {
            const backupState = event.detail;
            if (backupState) {
                if (backupState.neonPaths) {
                    // バックアップデータの座標に3m×3m制限を適用
                    const limitedPaths = backupState.neonPaths.map(path => {
                        if (path && path.points && Array.isArray(path.points)) {
                            return {
                                ...path,
                                points: path.points.map(point => limitCoordinates(point.x, point.y))
                            };
                        }
                        return path;
                    });
                    setNeonPaths(limitedPaths);
                }
                if (backupState.pathColors) setPathColors(backupState.pathColors);
                if (backupState.pathThickness) setPathThickness(backupState.pathThickness);
                if (backupState.selectedColor) setSelectedColor(backupState.selectedColor);
                if (backupState.thickness) setThickness(backupState.thickness);
                if (backupState.neonPower !== undefined) setNeonPower(backupState.neonPower);
                if (backupState.backgroundColor) setBackgroundColor(backupState.backgroundColor);
                if (backupState.backgroundColorOff) setBackgroundColorOff(backupState.backgroundColorOff);
                if (backupState.gridColor) setGridColor(backupState.gridColor);
                if (backupState.gridColorOff) setGridColorOff(backupState.gridColorOff);
                if (backupState.showGrid !== undefined) setShowGrid(backupState.showGrid);
                if (backupState.gridOpacity) setGridOpacity(backupState.gridOpacity);
                if (backupState.gridSize) setGridSize(backupState.gridSize);
                if (backupState.neonColors) setNeonColors(backupState.neonColors);
                if (backupState.neonLineWidths) setNeonLineWidths(backupState.neonLineWidths);
                if (backupState.canvasSettings) setCanvasSettings(backupState.canvasSettings);
                if (backupState.installationEnvironment) setInstallationEnvironment(backupState.installationEnvironment);
                
                // svgDataの復元
                if (backupState.svgData && onStateChange) {
                    onStateChange({ svgData: backupState.svgData });
                }
                
                setIsDataLoaded(true);
            }
        };

        window.addEventListener('restoreCustomizeState', handleRestoreState);
        return () => window.removeEventListener('restoreCustomizeState', handleRestoreState);
    }, []);

    // モデルの境界を計算して最適な視点を設定する関数
    const calculateOptimalView = useCallback((paths) => {
        console.log('calculateOptimalView実行:', { pathsCount: paths?.length });
        
        if (!paths || paths.length === 0) {
            console.log('パスデータなし、デフォルト視点を返す');
            return {
                scale: 1,
                offsetX: canvasWidth / 2,
                offsetY: canvasHeight / 2,
                segmentsPerCurve: 30
            };
        }

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

        console.log('境界計算結果:', { minX, minY, maxX, maxY });

        if (minX !== Infinity) {
            const modelWidth = maxX - minX;
            const modelHeight = maxY - minY;
            const modelCenterX = (minX + maxX) / 2;
            const modelCenterY = (minY + maxY) / 2;
            
            // 画面サイズに対してモデルが適切に収まるスケールを計算
            const screenWidth = window.innerWidth;
            const screenHeight = window.innerHeight;
            const padding = 200; // 周囲の余白
            
            const scaleX = (screenWidth - padding * 2) / modelWidth;
            const scaleY = (screenHeight - padding * 2) / modelHeight;
            const optimalScale = Math.min(scaleX, scaleY, 1); // 最大1倍まで
            
            // モデル中央を画面中央に配置するオフセット計算
            const offsetX = screenWidth / 2 - modelCenterX * optimalScale;
            const offsetY = screenHeight / 2 - modelCenterY * optimalScale;
            
            const result = {
                scale: optimalScale,
                offsetX: offsetX,
                offsetY: offsetY,
                segmentsPerCurve: 30
            };
            
            console.log('最適視点計算完了:', {
                modelSize: { width: modelWidth, height: modelHeight },
                modelCenter: { x: modelCenterX, y: modelCenterY },
                screenSize: { width: screenWidth, height: screenHeight },
                result: result
            });
            
            return result;
        }

        console.log('境界が無効、デフォルト視点を返す');
        return {
            scale: 1,
            offsetX: canvasWidth / 2,
            offsetY: canvasHeight / 2,
            segmentsPerCurve: 30
        };
    }, [canvasWidth, canvasHeight]);

    // ネオン下絵データの解析
    useEffect(() => {
        if (svgData && svgData.paths) {
            // パスの座標に3m×3m制限を適用
            const limitedPaths = svgData.paths.map(path => {
                if (path && path.points && Array.isArray(path.points)) {
                    return {
                        ...path,
                        points: path.points.map(point => limitCoordinates(point.x, point.y))
                    };
                }
                return path;
            });
            setNeonPaths(limitedPaths);
            
            // 全パスにデフォルト太さを設定
            const defaultThickness = {};
            svgData.paths.forEach((path, index) => {
                if (path.mode === 'stroke') {
                    defaultThickness[index] = 15; // 6mm デフォルト
                }
            });
            setPathThickness(prev => ({
                ...defaultThickness,
                ...prev // 既存の設定があれば上書き
            }));
            
            if (svgData.colors) {
                // fillAreaを透明に設定してからneonColorsを更新
                const colorsWithTransparentFill = {
                    ...svgData.colors,
                    fillArea: 'transparent'
                };
                setNeonColors(colorsWithTransparentFill);
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
                // initialStateにカメラ位置情報がある場合はそちらを優先、無い場合は最適な視点を計算
                const hasInitialViewState = initialState && (initialState.scale !== undefined || initialState.offsetX !== undefined || initialState.offsetY !== undefined);
                
                console.log('カスタマイズ視点計算:', {
                    hasInitialState: !!initialState,
                    hasInitialViewState,
                    initialState: initialState,
                    pathsCount: limitedPaths.length
                });
                
                let canvasSettings;
                if (hasInitialViewState) {
                    // 既存の設定を使用
                    console.log('既存の視点設定を使用');
                    canvasSettings = {
                        ...svgData.canvasData,
                        scale: initialState.scale !== undefined ? initialState.scale : svgData.canvasData.scale,
                        offsetX: initialState.offsetX !== undefined ? initialState.offsetX : svgData.canvasData.offsetX,
                        offsetY: initialState.offsetY !== undefined ? initialState.offsetY : svgData.canvasData.offsetY
                    };
                } else {
                    // 新しく読み込まれた場合は最適な視点を計算
                    console.log('最適な視点を計算中...');
                    const optimalView = calculateOptimalView(limitedPaths);
                    console.log('計算された最適視点:', optimalView);
                    canvasSettings = {
                        ...svgData.canvasData,
                        scale: optimalView.scale,
                        offsetX: optimalView.offsetX,
                        offsetY: optimalView.offsetY,
                        segmentsPerCurve: svgData.canvasData.segmentsPerCurve || 30
                    };
                }
                setCanvasSettings(canvasSettings);
                
                // ネオン下絵のグリッド設定をそのまま使用（initialStateが無い場合のみ）
                const shouldUseInitialState = initialState;
                if (svgData.canvasData.gridSize !== undefined && (!shouldUseInitialState || !initialState.gridSize)) {
                    setGridSize(svgData.canvasData.gridSize);
                }
                if (svgData.canvasData.gridOpacity !== undefined && (!shouldUseInitialState || !initialState.gridOpacity)) {
                    setGridOpacity(svgData.canvasData.gridOpacity);
                }
                if (svgData.canvasData.showGrid !== undefined && (!shouldUseInitialState || initialState.showGrid === undefined)) {
                    setShowGrid(svgData.canvasData.showGrid);
                }
                // ネオン下絵のグリッド色をオフ時のグリッド色として引き継がない（独自設定を維持）
                // if (svgData.canvasData.gridColor !== undefined && (!shouldUseInitialState || !initialState.gridColorOff)) {
                //     setGridColorOff(svgData.canvasData.gridColor);
                // }
            }
            
            const shouldUseInitialState = initialState;
            
            // パス別の初期色設定（initialStateが無い場合のみ設定）
            if (!shouldUseInitialState || !initialState.pathColors || Object.keys(initialState.pathColors).length === 0) {
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

    // ベースプレートの透明設定を確実にする
    useEffect(() => {
        if (neonPaths.length > 0) {
            const basePaths = neonPaths.filter(pathObj => pathObj && pathObj.mode === 'fill');
            if (basePaths.length > 0) {
                const initialColors = {};
                basePaths.forEach((pathObj, index) => {
                    const originalIndex = neonPaths.findIndex(p => p === pathObj);
                    if (!pathColors[`${originalIndex}_fill`]) {
                        initialColors[`${originalIndex}_fill`] = 'transparent';
                    }
                });
                if (Object.keys(initialColors).length > 0) {
                    setPathColors(prev => ({ ...prev, ...initialColors }));
                }
            }
        }
    }, [neonPaths]);

    // データ変更時に自動保存
    useEffect(() => {
        if (neonPaths.length > 0) {
            saveCustomizeData();
        }
    }, [pathColors, pathThickness, backgroundColor, gridColor, showGrid, gridOpacity, selectedColor, thickness, neonPaths.length]);

    // 状態変更時に親コンポーネントに通知（初期化時は除く）
    const isInitializedRef = useRef(false);
    useEffect(() => {
        if (isInitializedRef.current) {
            saveCurrentState();
        } else {
            isInitializedRef.current = true;
        }
    }, [selectedColor, thickness, sidebarVisible, neonPower, backgroundColor, backgroundColorOff, gridColor, gridColorOff, showGrid, gridOpacity, pathColors, pathThickness]);

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
            
            // デバッグ情報
            console.log(`パス${pathIndex}: mode=${pathMode}, customThickness=${customThickness}, pathThickness=`, pathThickness);

            if (pathPoints.length < 2) return;
            
            // 0.7cm以下の短いstrokeパスは描画しない
            if (pathMode === 'stroke' && calculatePathLength(pathObj) / 25 * 10 <= 7) return;

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
                
                const effectiveThickness = customThickness || neonLineWidths.strokeLine || 15; // キャンバス表示と同じロジック
                console.log(`SVG出力 パス${pathIndex}: effectiveThickness=${effectiveThickness}`);
                strokePathData += `<path class="neon-stroke" d="${currentStrokeSegment}" stroke="${customColor || neonColors.strokeLine}" stroke-width="${effectiveThickness}" fill="none" stroke-linecap="round" stroke-linejoin="round" filter="url(#neon-glow-${pathIndex})"/>\n    `;
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
                const effectiveFillThickness = 3; // 土台の境界線は常に3px
                const fillColor = pathColors[`${pathIndex}_fill`] || neonColors.fillArea; // ベースプレート設定の色を使用
                const strokeColor = customColor || neonColors.fillBorder;
                fillPathData += `<path class="base-stroke" d="${currentFillSegment}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${effectiveFillThickness}"/>\n    `;
            }
        });

        // 土台（fillパス）の境界のみを計算
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        
        neonPaths.forEach(pathObj => {
            if (!pathObj || !Array.isArray(pathObj.points)) return;
            // fillパス（土台）のみを境界計算に使用
            if (pathObj.mode === 'fill') {
                pathObj.points.forEach(point => {
                    minX = Math.min(minX, point.x);
                    minY = Math.min(minY, point.y);
                    maxX = Math.max(maxX, point.x);
                    maxY = Math.max(maxY, point.y);
                });
            }
        });

        // 土台がない場合は全パスを使用
        if (minX === Infinity) {
            neonPaths.forEach(pathObj => {
                if (!pathObj || !Array.isArray(pathObj.points)) return;
                pathObj.points.forEach(point => {
                    minX = Math.min(minX, point.x);
                    minY = Math.min(minY, point.y);
                    maxX = Math.max(maxX, point.x);
                    maxY = Math.max(maxY, point.y);
                });
            });
        }

        // 余白なし（土台の輪郭ぴったり）
        const margin = 0;

        const svgWidth = maxX - minX;
        const svgHeight = maxY - minY;

        // パスデータの座標を調整（全ての数値座標を対象）
        const adjustedStrokePathData = strokePathData.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (match, x, y) => {
            const adjustedX = parseFloat(x) - minX;
            const adjustedY = parseFloat(y) - minY;
            return `${adjustedX.toFixed(2)},${adjustedY.toFixed(2)}`;
        });

        const adjustedFillPathData = fillPathData.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (match, x, y) => {
            const adjustedX = parseFloat(x) - minX;
            const adjustedY = parseFloat(y) - minY;
            return `${adjustedX.toFixed(2)},${adjustedY.toFixed(2)}`;
        });

        const customizedSvg = `
<svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg">
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
    <style>
        .base-stroke { stroke-width: 3px !important; }
    </style>
    ${adjustedFillPathData}${adjustedStrokePathData}
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

        newScale = Math.max(0.18, Math.min(newScale, 10)); // 最小0.18倍、最大10倍に制限

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
                            // 選択解除: 元の設定に戻す
                            newSelected.delete(hitPathIndex);
                            if (originalPathSettings[hitPathIndex]) {
                                setPathColors(prev => ({ 
                                    ...prev, 
                                    [hitPathIndex]: originalPathSettings[hitPathIndex].color 
                                }));
                                setPathThickness(prev => ({ 
                                    ...prev, 
                                    [hitPathIndex]: originalPathSettings[hitPathIndex].thickness 
                                }));
                            }
                        } else {
                            // 新規選択: 元の設定を保存
                            const currentColor = pathColors[hitPathIndex] || neonColors.strokeLine || '#ffff00';
                            const currentThickness = pathThickness[hitPathIndex] || neonLineWidths.strokeLine || 15;
                            
                            // 元の設定を保存
                            if (!originalPathSettings[hitPathIndex]) {
                                setOriginalPathSettings(prev => ({
                                    ...prev,
                                    [hitPathIndex]: {
                                        color: currentColor,
                                        thickness: currentThickness
                                    }
                                }));
                            }
                            
                            newSelected.add(hitPathIndex);
                            // 色・太さの適用はuseEffectで自動的に行われる
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

        // 初期化中は何も表示しない（ちらつき防止）
        if (isInitializing) {
            return;
        }
        
        // データロード状態をチェック - svgDataまたはneonPathsがあれば描画処理に進む
        if (!isDataLoaded || (!svgData && neonPaths.length === 0)) {
            // 画面の真の中央位置
            const canvasCenterX = canvas.width / 2;
            const canvasCenterY = canvas.height / 2;
            
            ctx.fillStyle = '#ffffff';
            ctx.font = '24px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('ネオン下絵からデータを作成するか、前回保存したデータを読み込んでください', canvasCenterX, canvasCenterY);
            return;
        }
        
        // 有効なパスデータがあるかチェック
        const hasValidData = neonPaths.length > 0 && neonPaths.some(path => 
            path && Array.isArray(path.points) && path.points.length > 0
        );
        
        if (!hasValidData) {
            // データはあるが空の場合も、メッセージを表示
            const canvasCenterX = canvas.width / 2;
            const canvasCenterY = canvas.height / 2;
            
            ctx.fillStyle = '#ffffff';
            ctx.font = '24px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('ネオン下絵からデータを作成するか、前回保存したデータを読み込んでください', canvasCenterX, canvasCenterY);
            return;
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

        // 無限グリッドを描画（グリッド間隔に応じて）
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
            ctx.fillText(`1マス = ${gridSize / 25}cm`, textX, textY);
            ctx.restore();
        }

        // パスと制御点の描画
        ctx.save();
        ctx.translate(canvasSettings.offsetX, canvasSettings.offsetY);
        ctx.scale(canvasSettings.scale, canvasSettings.scale);

        // 1. 土台（fill）パスの描画（最初の1つのみ）
        neonPaths.filter(pathObj => pathObj && pathObj.mode === 'fill').slice(0, 1).forEach((pathObj, pathIndex) => {
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
            
            // 0.7cm以下の短いパスは描画しない
            if (calculatePathLength(pathObj) / 25 * 10 <= 7) return;

            const strokeColor = pathColors[pathIndex] || neonColors.strokeLine;
            const strokeWidth = pathThickness[pathIndex] || neonLineWidths.strokeLine;
            
            // ベース輝度を使用
            const currentBrightness = brightness;
            
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

        // Canvas画像の送信は3Dモデル生成時のみに移動

        // アニメーションは使用しない（点滅効果を削除）
    };

    // 描画の実行 - 重要な変更のみで再描画
    useEffect(() => {
        // データがロードされている、またはcanvasが準備できている場合は即座に描画
        if (canvasRef.current) {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
            // 即座に描画実行（データ有無に関わらず、メッセージ表示のため）
            requestAnimationFrame(draw);
        }

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [neonPaths, pathColors, pathThickness, canvasSettings, neonColors, neonLineWidths, canvasWidth, canvasHeight, backgroundColor, backgroundColorOff, gridColor, gridColorOff, showGrid, gridOpacity, neonPower, isDataLoaded, highlightedTube, highlightedBase, isCanvasSelectionMode, selectedTubes]);

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
                
                {/* キャンバス右上のサイズ表示 */}
                <div 
                    className={`canvas-size-display ${!sidebarVisible ? 'sidebar-collapsed' : ''}`}
                >
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
            </div>

            {/* サイドバー */}
            <div className={`customize-sidebar ${sidebarVisible ? '' : 'collapsed'}`}>
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

                        {/* サイドバー切り替えボタン */}
                        <button
                            onClick={() => setSidebarVisible(!sidebarVisible)}
                            className="customize-toggle-sidebar-button"
                        >
                            {sidebarVisible ? '▲' : '▼'}
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



                    {/* 一括設定 */}
                    <div className="bulk-setting-section">
                        <h3 className="customize-setting-title">一括設定</h3>
                        {!isCanvasSelectionMode ? (
                            <button
                                onClick={() => {
                                    setSelectedTubes(new Set());
                                    setIsCanvasSelectionMode(true);
                                    setSidebarVisible(false); // サイドバーを閉じる
                                    setShowBulkColorModal(true); // 直接モーダルを開く
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
                                                // 選択中のチューブの元の設定を保存
                                                const originalSettings = {};
                                                selectedTubes.forEach(index => {
                                                    originalSettings[index] = {
                                                        color: pathColors[index] || neonColors.strokeLine || '#ffff00',
                                                        thickness: pathThickness[index] || neonLineWidths.strokeLine || 15
                                                    };
                                                });
                                                setOriginalPathSettings(originalSettings);
                                                
                                                setSelectedBulkThickness(null); // 太さ選択をリセット
                                                setSelectedBulkColor(null); // 色選択をリセット
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
                    {neonPaths.filter(pathObj => pathObj && pathObj.mode === 'stroke' && calculatePathLength(pathObj) / 25 * 10 > 7).length > 0 && (
                        <div className="neon-tube-settings">
                            <div className="neon-tube-header">
                                <div className="neon-tube-title-container">
                                    <h3 className="neon-tube-title">
                                        ネオンチューブ設定 ({neonPaths.filter(pathObj => pathObj && pathObj.mode === 'stroke' && calculatePathLength(pathObj) / 25 * 10 > 7).length}本)
                                    </h3>
                                    <span className="tube-total-length-subtitle">
                                        合計長さ: {(Math.round(
                                            neonPaths
                                                .filter(pathObj => pathObj && pathObj.mode === 'stroke' && calculatePathLength(pathObj) / 25 * 10 > 7)
                                                .reduce((total, pathObj) => total + calculatePathLength(pathObj), 0) / 25 * 10
                                        ) / 10).toFixed(1)}cm
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
                                .filter(({ pathObj }) => pathObj && pathObj.mode === 'stroke' && calculatePathLength(pathObj) / 25 * 10 > 7)
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
                                            チューブ {sortedIndex + 1} (長さ: {(Math.round(calculatePathLength(pathObj) / 25 * 10) / 10).toFixed(1)}cm)
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
                            {neonPaths.filter(pathObj => pathObj && pathObj.mode === 'fill').slice(0, 1).map((pathObj, index) => {
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
                                            <div className="color-button-container">
                                                <button
                                                    className={`base-color-button transparent ${(pathColors[`${index}_fill`] || 'transparent') === 'transparent' ? 'active' : ''}`}
                                                    onClick={() => handlePathColorChange(`${index}_fill`, 'transparent')}
                                                    title="透明"
                                                />
                                                <span className="color-name-text">クリア</span>
                                            </div>
                                            <div className="color-button-container">
                                                <button
                                                    className={`base-color-button black ${pathColors[`${index}_fill`] === '#000000' ? 'active' : ''}`}
                                                    onClick={() => handlePathColorChange(`${index}_fill`, '#000000')}
                                                    title="黒"
                                                />
                                                <span className="color-name-text">ブラック</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* 設置環境設定 */}
                    {neonPaths.some(pathObj => pathObj && pathObj.mode === 'fill') && (
                        <div className="base-settings">
                            <div className="base-settings-header">
                                <h3 className="customize-setting-title">設置環境</h3>
                            </div>
                            <div className="base-item installation-environment-section">
                                <label className="base-color-label">使用環境を選択してください</label>
                                <div className="base-color-options">
                                    <div 
                                        className={`installation-environment-button ${installationEnvironment === 'indoor' ? 'active' : ''}`}
                                        onClick={() => setInstallationEnvironment('indoor')}
                                        title="屋内使用（非防水）"
                                    >
                                        屋内 - 非防水
                                    </div>
                                    <div 
                                        className={`installation-environment-button ${installationEnvironment === 'outdoor' ? 'active' : ''}`}
                                        onClick={() => setInstallationEnvironment('outdoor')}
                                        title="屋外使用（IP67防水）"
                                    >
                                        <div>屋外 - IP67防水</div>
                                        <div style={{marginTop: '4px'}}>(価格＋15%)</div>
                                    </div>
                                </div>
                            </div>
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
                                        setBackgroundColor('#191919'); // RGB(25,25,25)
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


                    {/* 色仕様の保存・読み込み */}
                    <div className="project-controls">
                        <h3 className="project-tools-title">色仕様の保存/読み込み</h3>
                        <div className="reset-buttons-row">
                            <button
                                onClick={saveProjectToFile}
                                className={`project-save-btn ${neonPaths.length === 0 ? 'button-disabled' : ''}`}
                                disabled={neonPaths.length === 0}
                                title="現在の色仕様設定をJSONファイルとしてダウンロード"
                            >
                                📤 保存
                            </button>
                            <label className="project-load-btn">
                                📥 読み込む
                                <input
                                    type="file"
                                    accept=".json"
                                    onChange={loadProjectFromFile}
                                    style={{ display: 'none' }}
                                />
                            </label>
                        </div>
                    </div>

                    {/* 3Dモデル生成 */}
                    <button
                        onClick={async () => {
                            const totalPoints = neonPaths.reduce((acc, pathObj) => acc + (pathObj?.points?.length || 0), 0);
                            if (totalPoints < 2) {
                                alert('3Dモデルを生成するには少なくとも2点が必要です。');
                                return;
                            }

                            // 進捗モーダルを表示
                            setIsProcessing3D(true);
                            setProcessing3DProgress(0);
                            setProcessing3DMessage('3Dモデル生成を開始しています...');
                            
                            await new Promise(resolve => setTimeout(resolve, 30));

                            // 実際のデータ処理開始
                            setProcessing3DProgress(5);
                            setProcessing3DMessage('土台データを解析しています...');
                            
                            await new Promise(resolve => setTimeout(resolve, 60));

                            // サイズ情報を計算（4cm基準）
                            setProcessing3DProgress(10);
                            setProcessing3DMessage('境界ボックスを計算しています...');
                            
                            await new Promise(resolve => setTimeout(resolve, 50));
                            
                            // neonPathsから境界ボックスを計算
                            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                            
                            for (let i = 0; i < neonPaths.length; i++) {
                                const path = neonPaths[i];
                                if (path && path.points) {
                                    path.points.forEach(point => {
                                        minX = Math.min(minX, point.x);
                                        minY = Math.min(minY, point.y);
                                        maxX = Math.max(maxX, point.x);
                                        maxY = Math.max(maxY, point.y);
                                    });
                                }
                                
                                // 境界ボックス計算の進捗
                                if (i % 2 === 0) {
                                    const progress = 10 + (i / neonPaths.length) * 5;
                                    setProcessing3DProgress(Math.round(progress));
                                    await new Promise(resolve => setTimeout(resolve, 15));
                                }
                            }
                            
                            const svgWidth = maxX - minX;
                            const svgHeight = maxY - minY;
                            const svgWidthCm = (svgWidth / 100) * 4; // 固定: 100px = 4cm (25px = 1cm)
                            const svgHeightCm = (svgHeight / 100) * 4;
                            
                            setProcessing3DProgress(20);
                            setProcessing3DMessage('サイズ計算完了...');
                            
                            await new Promise(resolve => setTimeout(resolve, 40));
                            
                            // SVGファイル内容を生成（既存のロジックを使用）
                            setProcessing3DProgress(25);
                            setProcessing3DMessage('SVGデータを生成しています...');
                            
                            await new Promise(resolve => setTimeout(resolve, 50));
                            
                            let strokePathData = '';
                            let fillPathData = '';

                            let processedPaths = 0;
                            const totalPaths = neonPaths.length;
                            
                            for (let pathIndex = 0; pathIndex < neonPaths.length; pathIndex++) {
                                const pathObj = neonPaths[pathIndex];
                                if (!pathObj || !Array.isArray(pathObj.points)) continue;

                                const pathPoints = pathObj.points;
                                const pathMode = pathObj.mode;
                                const pathType = pathObj.type;
                                const customColor = pathColors[pathIndex];
                                const customThickness = pathThickness[pathIndex];

                                if (pathPoints.length < 2) continue;

                                if (pathMode === 'stroke') {
                                    let currentStrokeSegment = `M ${pathPoints[0].x},${pathPoints[0].y}`;
                                    if (pathType === 'spline' && pathPoints.length >= 2) {
                                        // 最初の点は既にMoveToで設定済み
                                        // 2点の場合は直線で接続
                                        if (pathPoints.length === 2) {
                                            currentStrokeSegment += ` L ${pathPoints[1].x},${pathPoints[1].y}`;
                                        } 
                                        // 3点以上の場合はCatmull-Rom補間
                                        else {
                                            for (let i = 0; i < pathPoints.length - 1; i++) {
                                                // 制御点の設定を修正
                                                const p0 = (i === 0) ? pathPoints[0] : pathPoints[i - 1];
                                                const p1 = pathPoints[i];
                                                const p2 = pathPoints[i + 1];
                                                const p3 = (i + 2 < pathPoints.length) ? pathPoints[i + 2] : pathPoints[pathPoints.length - 1];

                                                // キャンバス描画と同じロジックを使用
                                                for (let t = 0; t <= canvasSettings.segmentsPerCurve; t++) {
                                                    const step = t / canvasSettings.segmentsPerCurve;
                                                    const x = getCatmullRomPt(p0.x, p1.x, p2.x, p3.x, step);
                                                    const y = getCatmullRomPt(p0.y, p1.y, p2.y, p3.y, step);
                                                    
                                                    // 有効な数値かチェック（NaN、Infinityを除外）
                                                    if (isFinite(x) && isFinite(y)) {
                                                        currentStrokeSegment += ` L ${x.toFixed(2)},${y.toFixed(2)}`;
                                                    } else {
                                                        console.warn(`Invalid spline point at pathIndex ${pathIndex}, segment ${i}, t=${step}: (${x}, ${y})`);
                                                        // フォールバック：直線で接続
                                                        currentStrokeSegment += ` L ${p2.x},${p2.y}`;
                                                        break;
                                                    }
                                                }
                                            }
                                        }
                                    } else {
                                        for (let i = 1; i < pathPoints.length; i++) {
                                            currentStrokeSegment += ` L ${pathPoints[i].x},${pathPoints[i].y}`;
                                        }
                                    }
                                    
                                    const effectiveThickness = customThickness || neonLineWidths.strokeLine || 15;
                                    strokePathData += `<path class="neon-stroke" data-type="neon" d="${currentStrokeSegment}" stroke="${customColor || neonColors.strokeLine}" stroke-width="${effectiveThickness}" fill="none" stroke-linecap="round" stroke-linejoin="round" filter="url(#neon-glow-${pathIndex})"/>\n    `;
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
                                    const effectiveFillThickness = 3;
                                    const fillColor = pathColors[`${pathIndex}_fill`] || neonColors.fillArea;
                                    const strokeColor = customColor || neonColors.fillBorder;
                                    fillPathData += `<path class="base-stroke" data-type="base" d="${currentFillSegment}" fill="${fillColor}" stroke="none" stroke-width="0"/>\n    `;
                                }
                                
                                // 各パス処理完了時に進捗更新
                                processedPaths++;
                                const progressPercent = 25 + (processedPaths / totalPaths) * 15; // 25-40%
                                setProcessing3DProgress(Math.round(progressPercent));
                                setProcessing3DMessage(`パス処理中... (${processedPaths}/${totalPaths})`);
                                
                                // 非同期処理のため少し待機
                                await new Promise(resolve => setTimeout(resolve, 30));
                            }
                            
                            setProcessing3DProgress(45);
                            setProcessing3DMessage('パスデータ調整中...');
                            
                            await new Promise(resolve => setTimeout(resolve, 200));
                            
                            // パスデータの座標を調整（全ての数値座標を対象）
                            setProcessing3DProgress(50);
                            setProcessing3DMessage('ストロークデータを調整中...');
                            
                            const adjustedStrokePathData = strokePathData.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (match, x, y) => {
                                const adjustedX = parseFloat(x) - minX;
                                const adjustedY = parseFloat(y) - minY;
                                return `${adjustedX.toFixed(2)},${adjustedY.toFixed(2)}`;
                            });
                            
                            await new Promise(resolve => setTimeout(resolve, 250));
                            
                            setProcessing3DProgress(55);
                            setProcessing3DMessage('フィルデータを調整中...');

                            const adjustedFillPathData = fillPathData.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (match, x, y) => {
                                const adjustedX = parseFloat(x) - minX;
                                const adjustedY = parseFloat(y) - minY;
                                return `${adjustedX.toFixed(2)},${adjustedY.toFixed(2)}`;
                            });
                            
                            await new Promise(resolve => setTimeout(resolve, 300));

                            const customizedSvg = `
<svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg">
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
    <style>
        .base-stroke { stroke-width: 3px !important; }
    </style>
    ${adjustedFillPathData}${adjustedStrokePathData}
</svg>
                            `.trim();
                            
                            setProcessing3DProgress(60);
                            setProcessing3DMessage('データ生成完了...');
                            
                            await new Promise(resolve => setTimeout(resolve, 500));
                            
                            // 3Dモデルデータ生成完了
                            setProcessing3DProgress(65);
                            setProcessing3DMessage('3Dモデルデータを構築しています...');
                            
                            await new Promise(resolve => setTimeout(resolve, 300));
                            
                            setProcessing3DProgress(70);
                            setProcessing3DMessage('3Dモデル事前生成中...');
                            
                            await new Promise(resolve => setTimeout(resolve, 350));
                            
                            // SVGデータをプリロード処理
                            setProcessing3DProgress(75);
                            setProcessing3DMessage('プリロード中...');
                            
                            const blob = new Blob([customizedSvg], { type: 'image/svg+xml' });
                            const file = new File([blob], 'neon_sign.svg', { type: 'image/svg+xml' });
                            
                            await new Promise(resolve => setTimeout(resolve, 200));
                            
                            // DOMParserで事前解析
                            setProcessing3DProgress(80);
                            setProcessing3DMessage('DOM解析中...');
                            
                            const parser = new DOMParser();
                            const svgDoc = parser.parseFromString(customizedSvg, 'image/svg+xml');
                            const svgElement = svgDoc.querySelector('svg');
                            const viewBoxAttr = svgElement ? svgElement.getAttribute('viewBox') : null;
                            
                            await new Promise(resolve => setTimeout(resolve, 15));
                            
                            setProcessing3DProgress(85);
                            setProcessing3DMessage('3Dモデルのレンダリングを待っています...');

                            
                            window.dispatchEvent(new CustomEvent('show3DPreview', {
                                detail: {
                                    paths: neonPaths,
                                    pathColors: pathColors,
                                    pathThickness: pathThickness,
                                    canvasSettings: canvasSettings,
                                    neonPower: neonPower,
                                    backgroundColor: backgroundColor,
                                    backgroundColorOff: backgroundColorOff,
                                    svgSizeCm: { width: svgWidthCm, height: svgHeightCm },
                                    svgSizePx: { width: svgWidth, height: svgHeight },
                                    gridSizePx: gridSize,
                                    gridSizeCm: 4,
                                    svgContent: customizedSvg,
                                    strokeWidthsPx: neonLineWidths,
                                    installationEnvironment: installationEnvironment
                                }
                            }));
                            
                            // NeonRenderingCompleted イベントを待つ
                            await new Promise(resolve => {
                                const handleNeonRenderingComplete = () => {
                                    window.removeEventListener('NeonRenderingCompleted', handleNeonRenderingComplete);
                                    resolve();
                                };
                                window.addEventListener('NeonRenderingCompleted', handleNeonRenderingComplete, { once: true });
                                
                                setTimeout(() => {
                                    window.removeEventListener('NeonRenderingCompleted', handleNeonRenderingComplete);
                                    console.warn('NeonRenderingCompleted event timed out.');
                                    resolve(); 
                                }, 30000);
                            });

                            setProcessing3DProgress(100);
                            setProcessing3DMessage('生成完了');
                            
                            await new Promise(resolve => setTimeout(resolve, 500));
                            
                            setIsProcessing3D(false);
                            
                            // 状態をバックアップしてから3Dプレビューに移行
                            const stateBackup = {
                                neonPaths,
                                pathColors,
                                pathThickness,
                                selectedColor,
                                thickness,
                                neonPower,
                                backgroundColor,
                                backgroundColorOff,
                                gridColor,
                                gridColorOff,
                                showGrid,
                                gridOpacity,
                                gridSize,
                                neonColors,
                                neonLineWidths,
                                canvasSettings,
                                installationEnvironment,
                                svgData
                            };
                            
                            // カスタムイベントでバックアップデータを保存
                            window.dispatchEvent(new CustomEvent('storeCustomizeState', {
                                detail: stateBackup
                            }));

                            // Canvas画像を商品情報用に送信（3Dモデル生成時のみ）
                            sendCanvasImageToProductInfo();

                            window.dispatchEvent(new CustomEvent('RequestPageTransitionTo3DPreview'));
                        }}
                        className="customize-download-button"
                        disabled={neonPaths.length === 0 || isProcessing3D}
                    >
                        {isProcessing3D ? '生成中...' : '3Dモデル生成'}
                    </button>

                </div>


            {/* 色選択モーダル */}
            {showColorModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    zIndex: 1000,
                    pointerEvents: 'none'
                }}>
                    <div style={{
                        backgroundColor: 'rgb(29, 29, 29)',
                        padding: '24px',
                        borderRadius: '12px',
                        border: 'none',
                        minWidth: '380px',
                        maxWidth: '420px',
                        position: 'fixed',
                        right: '430px',
                        top: '20px',
                        animation: 'colorModalFadeIn 0.15s ease-out',
                        pointerEvents: 'auto'
                    }}>
                        <h3 style={{ color: '#FFFF00', marginBottom: '16px', textAlign: 'center' }}>
                            チューブの色を選択
                        </h3>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(4, 1fr)',
                            gap: '12px',
                            marginBottom: '16px'
                        }}>
                            {neonPresetColors.map((color) => (
                                <div key={color} style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}>
                                    <button
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
                                    <span style={{
                                        fontSize: '10px',
                                        color: '#d1d5db',
                                        textAlign: 'center',
                                        lineHeight: 1.2,
                                        maxWidth: '60px',
                                        wordWrap: 'break-word'
                                    }}>
                                        {colorNameMap[color]}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <button
                            className="tube-color-sample-button"
                            onClick={() => {
                                // 色サンプル表示の処理をここに追加予定
                                console.log('色サンプルを見るボタンがクリックされました');
                            }}
                        >
                            色サンプルを見る
                        </button>
                        <button
                            className="tube-color-modal-cancel-button"
                            onClick={() => {
                                setShowColorModal(false);
                                setSelectedPathIndex(null);
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
                            width: '520px',
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
                                キャンバスをクリックしてチューブを選択 ({selectedTubes.size}本)
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
                        {(
                            <div style={{ marginBottom: '16px' }}>
                                <h4 style={{ color: '#d1d5db', marginBottom: '8px', fontSize: '14px' }}>
                                    適用する色を選択
                                </h4>
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(4, 1fr)',
                                    gap: '12px'
                                }}>
                                    {neonPresetColors.map((color) => (
                                        <div key={color} style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            gap: '4px'
                                        }}>
                                            <button
                                                style={{
                                                    width: '48px',
                                                    height: '48px',
                                                    backgroundColor: color,
                                                    border: selectedBulkColor === color ? '3px solid #ffffff' : '2px solid #6b7280',
                                                    borderRadius: '8px',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s ease',
                                                    transform: selectedBulkColor === color ? 'scale(1.1)' : 'scale(1)'
                                                }}
                                                onClick={() => {
                                                    setSelectedBulkColor(color);
                                                    // 現在選択中の全チューブに色を適用
                                                    const newColors = {};
                                                    selectedTubes.forEach(index => {
                                                        newColors[index] = color;
                                                    });
                                                    setPathColors(prev => ({ ...prev, ...newColors }));
                                                }}
                                            />
                                            <span style={{
                                                fontSize: '10px',
                                                color: '#d1d5db',
                                                textAlign: 'center',
                                                lineHeight: 1.2,
                                                maxWidth: '60px',
                                                wordWrap: 'break-word'
                                            }}>
                                                {colorNameMap[color]}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 色サンプルを見るボタン */}
                        {(
                            <div style={{ marginBottom: '16px' }}>
                                <button
                                    className="bulk-color-sample-button"
                                    onClick={() => {
                                        // 色サンプル表示の処理をここに追加予定
                                        console.log('一括設定モーダル: 色サンプルを見るボタンがクリックされました');
                                    }}
                                >
                                    色サンプルを見る
                                </button>
                            </div>
                        )}

                        {/* 太さ選択 */}
                        {(
                            <div className="thickness-selection-container" style={{ marginBottom: '16px' }}>
                                <h4 className="thickness-selection-title" style={{ color: '#d1d5db', marginBottom: '8px', fontSize: '14px' }}>
                                    適用する太さを選択
                                </h4>
                                <div className="thickness-buttons-container" style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                                    <button
                                        onClick={() => {
                                            setSelectedBulkThickness(15);
                                            // 現在選択中の全チューブに太さを適用
                                            const newThickness = {};
                                            selectedTubes.forEach(index => {
                                                newThickness[index] = 15;
                                            });
                                            setPathThickness(prev => ({ ...prev, ...newThickness }));
                                        }}
                                        style={{
                                            backgroundColor: selectedBulkThickness === 15 ? '#10b981' : '#6b7280',
                                            color: 'white',
                                            border: `1px solid ${selectedBulkThickness === 15 ? '#10b981' : '#6b7280'}`,
                                            borderRadius: '6px',
                                            padding: '10px 20px',
                                            fontSize: '13px',
                                            cursor: 'pointer',
                                            fontWeight: 'bold',
                                            minWidth: '70px'
                                        }}
                                    >
                                        6mm
                                    </button>
                                    <button
                                        onClick={() => {
                                            setSelectedBulkThickness(20);
                                            // 現在選択中の全チューブに太さを適用
                                            const newThickness = {};
                                            selectedTubes.forEach(index => {
                                                newThickness[index] = 20;
                                            });
                                            setPathThickness(prev => ({ ...prev, ...newThickness }));
                                        }}
                                        style={{
                                            backgroundColor: selectedBulkThickness === 20 ? '#10b981' : '#6b7280',
                                            color: 'white',
                                            border: `1px solid ${selectedBulkThickness === 20 ? '#10b981' : '#6b7280'}`,
                                            borderRadius: '6px',
                                            padding: '10px 20px',
                                            fontSize: '13px',
                                            cursor: 'pointer',
                                            fontWeight: 'bold',
                                            minWidth: '70px'
                                        }}
                                    >
                                        8mm
                                    </button>
                                </div>
                            </div>
                        )}


                        {/* 完了・キャンセルボタン */}
                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                            <button
                                className="bulk-modal-complete-button"
                                onClick={() => {
                                    // 完了: 現在の設定で確定
                                    setShowBulkColorModal(false);
                                    setIsCanvasSelectionMode(false);
                                    setSelectedTubes(new Set());
                                    setSelectedBulkThickness(null);
                                    setSelectedBulkColor(null);
                                    setOriginalPathSettings({}); // 元の設定データをクリア
                                    setSidebarVisible(true); // サイドバーを復活
                                }}
                            >
                                完了
                            </button>
                            <button
                                className="bulk-modal-cancel-button"
                                onClick={() => {
                                    // キャンセル: 全ての選択中チューブを元の設定に戻す
                                    selectedTubes.forEach(index => {
                                        if (originalPathSettings[index]) {
                                            setPathColors(prev => ({ 
                                                ...prev, 
                                                [index]: originalPathSettings[index].color 
                                            }));
                                            setPathThickness(prev => ({ 
                                                ...prev, 
                                                [index]: originalPathSettings[index].thickness 
                                            }));
                                        }
                                    });
                                    
                                    setShowBulkColorModal(false);
                                    setIsCanvasSelectionMode(false);
                                    setSelectedTubes(new Set());
                                    setSelectedBulkThickness(null);
                                    setSelectedBulkColor(null);
                                    setOriginalPathSettings({}); // 元の設定データをクリア
                                    setSidebarVisible(true); // サイドバーを復活
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

            {/* 3D処理進捗モーダル */}
            {isProcessing3D && (
                <div className="processing-overlay">
                    <div className="processing-modal">
                        <div className="processing-content">
                            <div className="processing-spinner"></div>
                            
                            <h3>3Dモデル生成中...</h3>
                            
                            <div className="progress-bar-container">
                                <div className="progress-bar">
                                    <div
                                        className="progress-fill"
                                        style={{ width: `${processing3DProgress}%` }}
                                    ></div>
                                </div>
                                <div className="progress-text">
                                    {Math.round(processing3DProgress)}% 完了
                                </div>
                            </div>
                            
                            <div className="processing-message">
                                {processing3DMessage}
                            </div>
                            
                            <div className="processing-tips">
                                <h4>処理時間を短縮するコツ</h4>
                                <ul className="tips-list">
                                    <li className="tip-item">色数の少ないシンプルな画像を使用</li>
                                    <li className="tip-item">適切なレイヤー数</li>
                                    <li className="tip-item">画像サイズを2000px以下に調整</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default Costomize;