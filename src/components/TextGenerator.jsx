import React, { useState, useRef, useCallback, useEffect } from 'react';
import './TextGenerator.css';
import TextGeneratorGuideModal from './TextGeneratorGuideModal.jsx';

// SessionStorageからデータを安全に読み込む関数
const safeGetFromSessionStorage = (key, fallback = null) => {
    try {
        const item = sessionStorage.getItem(key);
        return item ? JSON.parse(item) : fallback;
    } catch (error) {
        console.error(`SessionStorage読み込みエラー (${key}):`, error);
        return fallback;
    }
};

// 初期状態を取得する関数
const getInitialTextGeneratorState = () => {
    const savedData = safeGetFromSessionStorage('textGeneratorData');
    
    return {
        inputText: savedData?.inputText || '',
        selectedFont: savedData?.selectedFont || 'cudi',
        fontSize: savedData?.fontSize || 60,
        letterSpacing: savedData?.letterSpacing || 0,
        strokeWidth: savedData?.strokeWidth || 3,
        selectedNeonColor: savedData?.selectedNeonColor || '#00ffff'
    };
};

const TextGenerator = ({ onNavigateToCustomize, isGuideEffectStopped, onGuideEffectStop }) => {
    const initialState = getInitialTextGeneratorState();
    
    const [inputText, setInputText] = useState(initialState.inputText);
    const [selectedFont, setSelectedFont] = useState(initialState.selectedFont);
    const [fontSize, setFontSize] = useState(initialState.fontSize);
    const [letterSpacing, setLetterSpacing] = useState(initialState.letterSpacing);
    const [strokeWidth, setStrokeWidth] = useState(initialState.strokeWidth);
    const [selectedNeonColor, setSelectedNeonColor] = useState(initialState.selectedNeonColor || '#00ffff');
    const canvasRef = useRef(null);
    const [generatedPaths, setGeneratedPaths] = useState([]);
    const textAreaRef = useRef(null);
    const isInitialized = useRef(false);
    const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);
    const [isMobileSidebarVisible, setIsMobileSidebarVisible] = useState(true);
    const [isFontSelectorOpen, setIsFontSelectorOpen] = useState(false);
    const [isLetterSpacingSelectorOpen, setIsLetterSpacingSelectorOpen] = useState(false);
    
    // キャンバスサイズの状態
    const [canvasWidth, setCanvasWidth] = useState(window.innerWidth);
    const [canvasHeight, setCanvasHeight] = useState(window.innerHeight);

    const allFonts = [
        { name: 'cudi', font: 'Dancing Script, cursive', tags: ['人気', '筆記体'] },
        { name: 'george', font: 'Kaushan Script, cursive', tags: ['人気', '筆記体'] },
        { name: 'pop', font: 'Pacifico, cursive', tags: ['人気', 'ポップ'] },
        { name: 'offset', font: 'Sacramento, cursive', tags: ['筆記体', '装飾'] },
        { name: 'britney', font: 'Satisfy, cursive', tags: ['筆記体'] },
        { name: 'jay', font: 'Yellowtail, cursive', tags: ['筆記体'] },
        { name: 'baby', font: 'Indie Flower, cursive', tags: ['手書き', 'カジュアル'] },
        { name: 'knowles', font: 'Caveat, cursive', tags: ['手書き', 'カジュアル'] },
        { name: 'lana', font: 'Amatic SC, cursive', tags: ['シンプル', '手書き'] },
        { name: 'snoop', font: 'Shadows Into Light, cursive', tags: ['手書き'] },
        { name: 'travis', font: 'Architects Daughter, cursive', tags: ['手書き'] },
        { name: 'quavo', font: 'Griffy, cursive', tags: ['ユニーク'] },
        { name: 'drizzy', font: 'Monoton, cursive', tags: ['人気', 'ネオン'] },
        { name: 'robert', font: 'Audiowide, cursive', tags: ['未来', 'テック'] },
        { name: 'script3', font: 'Courgette, cursive', tags: ['筆記体'] },
        { name: 'script4', font: 'Leckerli One, cursive', tags: ['筆記体'] },
        { name: 'script6', font: 'Cookie, cursive', tags: ['筆記体'] },
        { name: 'script7', font: 'Tangerine, cursive', tags: ['筆記体', '装飾'] },
        { name: 'script8', font: 'Handlee, cursive', tags: ['手書き'] },
        { name: 'script11', font: 'Nothing You Could Do, cursive', tags: ['手書き'] },
        { name: 'script15', font: 'Reenie Beanie, cursive', tags: ['手書き'] },
        { name: 'script16', font: 'Arizonia, cursive', tags: ['筆記体'] },
        { name: 'script19', font: 'Rouge Script, cursive', tags: ['筆記体'] },
        { name: 'script20', font: 'Marck Script, cursive', tags: ['筆記体'] },
        { name: 'script21', font: 'Clicker Script, cursive', tags: ['筆記体'] },
        { name: 'script22', font: 'Mrs Saint Delafield, cursive', tags: ['筆記体'] },
        { name: 'script25', font: 'Butterfly Kids, cursive', tags: ['装飾'] },
        { name: 'script27', font: 'Dawning of a New Day, cursive', tags: ['筆記体'] },
        { name: 'script29', font: 'Amatic SC, cursive', tags: ['シンプル', '手書き'] },
        { name: 'Weekender', font: 'Comfortaa, cursive', tags: ['モダン'] },
        { name: 'Neonscript', font: 'Monoton, cursive', tags: ['人気', 'ネオン'] },
        { name: 'Photogenic', font: 'Great Vibes, cursive', tags: ['筆記体', '装飾'] },
        { name: 'Rocket', font: 'Faster One, cursive', tags: ['未来', 'テック'] },
        { name: 'Signature', font: 'Allura, cursive', tags: ['筆記体', '装飾'] },
        { name: 'Sorrento', font: 'Amatic SC, cursive', tags: ['シンプル', '手書き'] },
        { name: 'ClassicType', font: 'Alex Brush, cursive', tags: ['筆記体'] },
        { name: 'Neo Tokyo', font: 'Orbitron, cursive', tags: ['未来', 'テック'] },
        { name: 'MONACO', font: 'Sacramento, cursive', tags: ['筆記体'] },
        { name: 'SIMPLICITY', font: 'Satisfy, cursive', tags: ['筆記体'] },
        { name: 'Typewriter', font: 'Courier Prime, cursive', tags: ['レトロ'] },
        { name: 'Majorca', font: 'Satisfy, cursive', tags: ['筆記体'] },
        { name: 'Manhattan', font: 'Kaushan Script, cursive', tags: ['筆記体'] },
        { name: 'NEONLITE', font: 'Syncopate, cursive', tags: ['未来', 'テック'] },
        { name: 'SCIFI', font: 'Audiowide, cursive', tags: ['未来', 'テック'] },
        { name: 'VANCOUVER', font: 'Caveat, cursive', tags: ['手書き'] },
        { name: 'WestCoast', font: 'Surfer, cursive', tags: ['カジュアル'] },
        { name: 'jp1', font: 'Noto Sans JP, sans-serif', tags: ['日本語対応', 'ベーシック', '人気'] },
        { name: 'jp2', font: 'Noto Serif JP, serif', tags: ['日本語対応', 'ベーシック'] },
        { name: 'jp5', font: 'Kosugi, sans-serif', tags: ['日本語対応', 'ベーシック'] },
        { name: 'jp6', font: 'Kosugi Maru, sans-serif', tags: ['日本語対応', 'ベーシック'] },
        { name: 'jp9', font: 'Hachi Maru Pop, cursive', tags: ['日本語対応', 'ポップ'] },
        { name: 'jp10', font: 'Kiwi Maru, cursive', tags: ['日本語対応', 'ポップ'] },
        { name: 'jp12', font: 'Stick, sans-serif', tags: ['日本語対応', 'ユニーク'] },
        { name: 'jp16', font: 'Train One, cursive', tags: ['日本語対応', 'ポップ'] },
        { name: 'jp20', font: 'New Tegomin, serif', tags: ['日本語対応', '伝統'] },
        { name: 'jp21', font: 'Yomogi, cursive', tags: ['日本語対応', '伝統'] },
        { name: 'jp24', font: 'Kaisei Opti, serif', tags: ['日本語対応', '伝統'] },
        { name: 'jp47', font: 'Gamja Flower, cursive', tags: ['日本語対応', 'ゲーム'] },
        { name: 'jp48', font: 'Shizuru, cursive', tags: ['日本語対応', 'ゲーム'] }
    ];

    // フォント名からフォントファミリーを取得する関数
    const getFontFamily = (fontName) => {
        const fontMap = {
            'cudi': 'Dancing Script, cursive',
            'george': 'Kaushan Script, cursive',
            'pop': 'Pacifico, cursive',
            'offset': 'Sacramento, cursive',
            'britney': 'Satisfy, cursive',
            'jay': 'Yellowtail, cursive',
            'baby': 'Indie Flower, cursive',
            'knowles': 'Caveat, cursive',
            'lana': 'Amatic SC, cursive',
            'snoop': 'Shadows Into Light, cursive',
            'travis': 'Architects Daughter, cursive',
            'quavo': 'Griffy, cursive',
            'drizzy': 'Monoton, cursive',
            'robert': 'Audiowide, cursive',
            'script3': 'Courgette, cursive',
            'script4': 'Leckerli One, cursive',
            'script6': 'Cookie, cursive',
            'script7': 'Tangerine, cursive',
            'script8': 'Handlee, cursive',
            'script11': 'Nothing You Could Do, cursive',
            'script15': 'Reenie Beanie, cursive',
            'script16': 'Arizonia, cursive',
            'script19': 'Rouge Script, cursive',
            'script20': 'Marck Script, cursive',
            'script21': 'Clicker Script, cursive',
            'script22': 'Mrs Saint Delafield, cursive',
            'script25': 'Butterfly Kids, cursive',
            'script27': 'Dawning of a New Day, cursive',
            'script29': 'Amatic SC, cursive',
            'Weekender': 'Comfortaa, cursive',
            'Neonscript': 'Monoton, cursive',
            'Photogenic': 'Great Vibes, cursive',
            'Rocket': 'Faster One, cursive',
            'Signature': 'Allura, cursive',
            'Sorrento': 'Amatic SC, cursive',
            'ClassicType': 'Alex Brush, cursive',
            'Neo Tokyo': 'Orbitron, cursive',
            'MONACO': 'Sacramento, cursive',
            'SIMPLICITY': 'Satisfy, cursive',
            'Typewriter': 'Courier Prime, cursive',
            'Majorca': 'Satisfy, cursive',
            'Manhattan': 'Kaushan Script, cursive',
            'NEONLITE': 'Syncopate, cursive',
            'SCIFI': 'Audiowide, cursive',
            'VANCOUVER': 'Caveat, cursive',
            'WestCoast': 'Surfer, cursive',
            // 日本語フォント - 厳選9種類
            'jp1': 'Noto Sans JP, sans-serif',
            'jp2': 'Noto Serif JP, serif',
            'jp5': 'Kosugi, sans-serif',
            'jp6': 'Kosugi Maru, sans-serif',
            'jp9': 'Hachi Maru Pop, cursive',
            'jp10': 'Kiwi Maru, cursive',
            'jp12': 'Stick, sans-serif',
            'jp16': 'Train One, cursive',
            'jp20': 'New Tegomin, serif',
            'jp21': 'Yomogi, cursive',
            'jp24': 'Kaisei Opti, serif',
            'jp47': 'Gamja Flower, cursive',
            'jp48': 'Shizuru, cursive'
        };
        return fontMap[fontName] || 'Arial, sans-serif';
    };

    // 利用可能なフォント一覧を更新
    const availableFonts = allFonts.map(font => font.name);

    // ネオン色パレット（Costomizeと同じ色）
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

    // キャンバスサイズを画面100%に設定
    const updateCanvasSize = useCallback(() => {
        const newWidth = window.innerWidth;
        const newHeight = window.innerHeight;
        
        setCanvasWidth(newWidth);
        setCanvasHeight(newHeight);
    }, []);

    // テキストからSVGパスを生成する関数
    const generateTextToSVG = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        
        // キャンバスの変換をリセット
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        
        // devicePixelRatioを再適用
        const pixelRatio = window.devicePixelRatio || 1;
        ctx.scale(pixelRatio, pixelRatio);
        
        // キャンバスを完全にクリア
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        
        // テキストが空の場合はSampleを表示
        const displayText = inputText.trim() || 'Sample';
        
        // テキストが空の場合は背景のみ描画
        if (!inputText.trim()) {
            // グラデーション背景を描画
            const gradient = ctx.createRadialGradient(canvasWidth/2, canvasHeight/2, 0, canvasWidth/2, canvasHeight/2, Math.max(canvasWidth, canvasHeight) * 0.7);
            gradient.addColorStop(0, '#f8f9fa');
            gradient.addColorStop(0.3, '#e9ecef');
            gradient.addColorStop(0.7, '#dee2e6');
            gradient.addColorStop(1, '#adb5bd');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);
            
            // 微細なパターンを追加
            ctx.save();
            ctx.globalAlpha = 0.03;
            ctx.strokeStyle = '#495057';
            ctx.lineWidth = 1;
            const lineSpacing = 50;
            // 斑の線パターン
            for (let x = 0; x < canvasWidth; x += lineSpacing) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, canvasHeight);
                ctx.stroke();
            }
            for (let y = 0; y < canvasHeight; y += lineSpacing) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(canvasWidth, y);
                ctx.stroke();
            }
            ctx.restore();
        }

        // フォント設定 - フォント名からフォントファミリーを取得
        const fontFamily = getFontFamily(selectedFont);
        ctx.font = `${fontSize}px ${fontFamily}`;
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = strokeWidth;
        
        // 文字間隔の設定
        ctx.letterSpacing = `${letterSpacing}px`;
        
        // テキストの幅を測定
        const textMetrics = ctx.measureText(displayText);
        const textWidth = textMetrics.width + (displayText.length - 1) * letterSpacing;
        const textHeight = fontSize;
        
        // 表示領域の定義（キャンバス内の四角形エリア）
        const isMobile = window.innerWidth <= 1280 || navigator.maxTouchPoints > 0;
        
        let displayAreaWidth, displayAreaHeight, displayAreaLeft, displayAreaTop;
        
        if (isMobile) {
            // スマホ: 画面中央に配置
            displayAreaWidth = canvasWidth * 0.6;
            displayAreaHeight = canvasHeight * 0.6;
            displayAreaLeft = (canvasWidth - displayAreaWidth) / 2;
            displayAreaTop = (canvasHeight - displayAreaHeight) / 2;
        } else {
            // デスクトップ: サイドバーを考慮した配置
            const rightSidebarWidth = Math.min(window.innerWidth * 0.24, 500); // 右サイドバー（27%、最大500px）
            const leftSidebarWidth = 250; // 左サイドバー（固定幅）
            const availableCanvasWidth = canvasWidth - rightSidebarWidth - leftSidebarWidth;
            
            // 表示領域を利用可能幅の70%に設定し、中央配置
            displayAreaWidth = availableCanvasWidth * 0.7;
            displayAreaHeight = canvasHeight * 0.7;
            displayAreaLeft = leftSidebarWidth + (availableCanvasWidth - displayAreaWidth) / 2;
            displayAreaTop = (canvasHeight - displayAreaHeight) / 2;
        }
        
        const displayAreaRight = displayAreaLeft + displayAreaWidth;
        const displayAreaBottom = displayAreaTop + displayAreaHeight;
        
        // 改行を考慮したテキスト全体のサイズ計算
        const textLines = displayText.split('\n');
        let maxLineWidth = 0;
        textLines.forEach(line => {
            const lineWidth = ctx.measureText(line).width;
            if (lineWidth > maxLineWidth) maxLineWidth = lineWidth;
        });
        
        const lineHeight = fontSize * 1.2;
        const totalTextHeight = fontSize + (textLines.length - 1) * lineHeight;
        
        // 表示領域に収まるようにスケール調整
        const scaleByWidth = displayAreaWidth / maxLineWidth;
        const scaleByHeight = displayAreaHeight / totalTextHeight;
        const scale = Math.min(scaleByWidth, scaleByHeight, 4); // 5倍まで許可
    
        // 中央位置計算
        const centerX = displayAreaLeft + displayAreaWidth / 2;
        const centerY = displayAreaTop + displayAreaHeight / 2;
        
        // 選択した色の濃いバージョンを作成
        const hexToRgb = (hex) => {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            } : null;
        };
        
        const rgb = hexToRgb(selectedNeonColor);
        const darkerColor = rgb ? 
            `rgb(${Math.floor(rgb.r * 0.085)}, ${Math.floor(rgb.g * 0.085)}, ${Math.floor(rgb.b * 0.085)})` : 
            '#111827';
        
        // グラデーション背景を作成
        const gradient = ctx.createLinearGradient(0, 0, canvasWidth, canvasHeight);
        gradient.addColorStop(0, '#050505');
        gradient.addColorStop(0.5, darkerColor);
        gradient.addColorStop(1, '#050505');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        
        
        
        // ネオン発光テキスト描画
        ctx.save();
        ctx.scale(scale, scale);
        ctx.font = `${fontSize}px ${fontFamily}`;
        
        // 改行対応のテキスト描画
        const scaledLineHeight = lineHeight * scale;
        const scaledTotalHeight = totalTextHeight * scale;
        const startYPos = (centerY - scaledTotalHeight / 2 + fontSize * scale * 0.8) / scale;
        
        textLines.forEach((line, index) => {
            // 各行の幅を測定して中央揃え
            const lineWidth = ctx.measureText(line).width;
            const lineCenterX = (centerX - (lineWidth * scale / 2)) / scale;
            const yPos = startYPos + (index * lineHeight);
            
            // ネオン発光エフェクト（元の太さを保持）
            ctx.shadowColor = selectedNeonColor;
            ctx.shadowBlur = 20;
            ctx.fillStyle = selectedNeonColor;
            ctx.fillText(line, lineCenterX, yPos);
            
            ctx.shadowBlur = 10;
            ctx.fillText(line, lineCenterX, yPos);
            
            // メインテキスト（選択された色）
            ctx.shadowBlur = 0;
            ctx.fillStyle = selectedNeonColor;
            ctx.fillText(line, lineCenterX, yPos);
        });
        ctx.restore();
        
        // 簡易的なパス生成（改行対応）
        const paths = [];
        const scaledFontSize = fontSize * scale;
        
        textLines.forEach((line, lineIndex) => {
            const lineWidth = ctx.measureText(line).width * scale;
            const lineCenterX = centerX - lineWidth / 2;
            const lineY = centerY - (scaledTotalHeight / 2) + (lineIndex * scaledLineHeight);
            
            // 各行を矩形パスとして近似
            const linePath = {
                points: [
                    { x: lineCenterX, y: lineY - scaledFontSize * 0.7 },
                    { x: lineCenterX + lineWidth, y: lineY - scaledFontSize * 0.7 },
                    { x: lineCenterX + lineWidth, y: lineY + scaledFontSize * 0.3 },
                    { x: lineCenterX, y: lineY + scaledFontSize * 0.3 }
                ],
                mode: 'stroke',
                type: 'line'
            };
            
            paths.push(linePath);
        });
        
        setGeneratedPaths(paths);
    }, [inputText, selectedFont, fontSize, letterSpacing, strokeWidth, selectedNeonColor, canvasWidth, canvasHeight]);

    // 画像出力とネオン下絵への移動
    const exportAsImage = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const displayText = inputText.trim() || 'Sample';
        
        // 新しいキャンバスを作成してテキストだけを描画
        const exportCanvas = document.createElement('canvas');
        const ctx = exportCanvas.getContext('2d');
        
        // フォント設定
        const fontFamily = getFontFamily(selectedFont);
        ctx.font = `${fontSize}px ${fontFamily}`;
        ctx.letterSpacing = `${letterSpacing}px`;
        
        // 改行を考慮したテキスト全体のサイズ計算
        const textLines = displayText.split('\n');
        let maxLineWidth = 0;
        textLines.forEach(line => {
            const lineWidth = ctx.measureText(line).width;
            if (lineWidth > maxLineWidth) maxLineWidth = lineWidth;
        });
        
        const lineHeight = fontSize * 1.2;
        const totalTextHeight = fontSize + (textLines.length - 1) * lineHeight;
        
        // より正確なバウンディングボックスを計算
        const textMetrics = ctx.measureText(displayText);
        const actualLeft = Math.abs(textMetrics.actualBoundingBoxLeft || 0);
        const actualTop = textMetrics.actualBoundingBoxAscent || fontSize * 0.8;
        const actualBottom = textMetrics.actualBoundingBoxDescent || fontSize * 0.2;
        
        const textWidth = maxLineWidth + actualLeft;
        const textHeight = totalTextHeight + actualBottom;
        
        // 高解像度対応（8倍サイズで描画）
        const scale = 8;
        const minPadding = 2; // 最小限の余白（2px）
        exportCanvas.width = (textWidth + minPadding * 2) * scale;
        exportCanvas.height = (textHeight + minPadding * 2) * scale;
        
        // 高DPI対応とアンチエイリアス設定
        ctx.scale(scale, scale);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.textRenderingOptimization = 'optimizeQuality';
        
        // 背景を透明に（何も描画しない）
        ctx.clearRect(0, 0, textWidth + minPadding * 2, textHeight + minPadding * 2);
        
        // 改行対応のテキスト描画
        ctx.font = `${fontSize}px ${fontFamily}`;
        ctx.fillStyle = '#000000';
        ctx.textBaseline = 'alphabetic';
        ctx.letterSpacing = `${letterSpacing}px`;
        
        textLines.forEach((line, index) => {
            // 各行の幅を測定して中央揃え
            const lineWidth = ctx.measureText(line).width;
            const centerX = (textWidth + minPadding * 2) / 2 - lineWidth / 2;
            const yPos = actualTop + minPadding + (index * lineHeight);
            ctx.fillText(line, centerX, yPos);
        });
        
        // 画像データを取得
        const dataURL = exportCanvas.toDataURL('image/png');
        
        // ネオン下絵に画像データを渡してページ移動
        window.dispatchEvent(new CustomEvent('navigateToNeonDrawing', {
            detail: {
                backgroundImage: dataURL,
                imageName: `${displayText.replace(/\n/g, '_')}_text.png`,
                resetView: true // 初期視点で表示
            }
        }));
        
        // 少し待ってからモーダルを開く
        setTimeout(() => {
            window.dispatchEvent(new CustomEvent('openBgModal'));
        }, 100);
    }, [inputText, selectedFont, fontSize, letterSpacing]);

    // フォント画像ダウンロード関数
    const downloadFontImage = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const displayText = inputText.trim() || 'Sample';
        
        // 新しいキャンバスを作成してテキストだけを描画
        const exportCanvas = document.createElement('canvas');
        const ctx = exportCanvas.getContext('2d');
        
        // フォント設定
        const fontFamily = getFontFamily(selectedFont);
        ctx.font = `${fontSize}px ${fontFamily}`;
        ctx.letterSpacing = `${letterSpacing}px`;
        
        // 改行を考慮したテキスト全体のサイズ計算
        const textLines = displayText.split('\n');
        let maxLineWidth = 0;
        textLines.forEach(line => {
            const lineWidth = ctx.measureText(line).width;
            if (lineWidth > maxLineWidth) maxLineWidth = lineWidth;
        });
        
        const lineHeight = fontSize * 1.2;
        const totalTextHeight = fontSize + (textLines.length - 1) * lineHeight;
        
        // より正確なバウンディングボックスを計算
        const textMetrics = ctx.measureText(displayText);
        const actualLeft = Math.abs(textMetrics.actualBoundingBoxLeft || 0);
        const actualTop = textMetrics.actualBoundingBoxAscent || fontSize * 0.8;
        const actualBottom = textMetrics.actualBoundingBoxDescent || fontSize * 0.2;
        
        const textWidth = maxLineWidth + actualLeft;
        const textHeight = totalTextHeight + actualBottom;
        
        // 高解像度対応（devicePixelRatioも考慮した8倍サイズで描画）
        const pixelRatio = window.devicePixelRatio || 1;
        const scale = 8 * pixelRatio;
        const minPadding = 2; // 最小限の余白（2px）
        exportCanvas.width = (textWidth + minPadding * 2) * scale;
        exportCanvas.height = (textHeight + minPadding * 2) * scale;
        
        // 高DPI対応とアンチエイリアス設定
        ctx.scale(scale, scale);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.textRenderingOptimization = 'optimizeQuality';
        
        // 背景を透明に（何も描画しない）
        ctx.clearRect(0, 0, textWidth + minPadding * 2, textHeight + minPadding * 2);
        
        // 改行対応のテキスト描画
        ctx.font = `${fontSize}px ${fontFamily}`;
        ctx.fillStyle = '#000000';
        ctx.textBaseline = 'alphabetic';
        ctx.letterSpacing = `${letterSpacing}px`;
        
        textLines.forEach((line, index) => {
            // 各行の幅を測定して中央揃え
            const lineWidth = ctx.measureText(line).width;
            const centerX = (textWidth + minPadding * 2) / 2 - lineWidth / 2;
            const yPos = actualTop + minPadding + (index * lineHeight);
            ctx.fillText(line, centerX, yPos);
        });
        
        // 画像をダウンロード
        const dataURL = exportCanvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = dataURL;
        link.download = `${displayText.replace(/\n/g, '_')}_font.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, [inputText, selectedFont, fontSize, letterSpacing]);

    // SVG出力関数
    const exportAsSVG = useCallback(() => {
        const displayText = inputText.trim() || 'Sample';
        const fontFamily = getFontFamily(selectedFont);
        
        // 仮のキャンバスでテキストサイズを測定
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.font = `${fontSize}px ${fontFamily}`;
        tempCtx.letterSpacing = `${letterSpacing}px`;
        
        const textMetrics = tempCtx.measureText(displayText);
        const textWidth = textMetrics.width;
        const textHeight = fontSize;
        
        // SVG作成
        const svgContent = `
<svg xmlns="http://www.w3.org/2000/svg" width="${textWidth + 100}" height="${textHeight * 1.6}" viewBox="0 0 ${textWidth + 100} ${textHeight * 1.6}">
  <rect width="100%" height="100%" fill="#ffffff"/>
  <text x="50" y="${textHeight * 1.1}" font-family="${fontFamily}" font-size="${fontSize}" fill="#000000" letter-spacing="${letterSpacing}px">${displayText}</text>
</svg>`.trim();
        
        // SVGをダウンロード
        const blob = new Blob([svgContent], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${displayText}_text.svg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, [inputText, selectedFont, fontSize, letterSpacing]);

    // カスタマイズページに送る関数
    const sendToCustomize = useCallback(() => {
        if (generatedPaths.length === 0) {
            alert('まずテキストを生成してください');
            return;
        }

        const displayText = inputText.trim() || 'Sample';
        const svgData = {
            paths: generatedPaths,
            metadata: {
                originalText: displayText,
                font: selectedFont,
                fontSize: fontSize,
                letterSpacing: letterSpacing,
                strokeWidth: strokeWidth
            }
        };

        // カスタマイズページに遷移して、データを渡す
        if (onNavigateToCustomize) {
            onNavigateToCustomize(svgData);
        }
    }, [generatedPaths, inputText, selectedFont, fontSize, letterSpacing, strokeWidth, onNavigateToCustomize]);

    // キャンバスサイズを初期化・リサイズ時に更新
    useEffect(() => {
        updateCanvasSize();
        const handleResize = () => {
            updateCanvasSize();
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [updateCanvasSize]);

    // キャンバスサイズ変更時にテキストを再描画
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            generateTextToSVG();
        }, 50);
        return () => clearTimeout(timeoutId);
    }, [canvasWidth, canvasHeight, generateTextToSVG]);

    // LocalStorageに状態を保存する関数
    const saveToLocalStorage = useCallback(() => {
        if (!isInitialized.current) return;
        
        try {
            const dataToSave = {
                inputText,
                selectedFont,
                fontSize,
                letterSpacing,
                strokeWidth,
                selectedNeonColor
            };
            sessionStorage.setItem('textGeneratorData', JSON.stringify(dataToSave));
        } catch (error) {
            console.error('SessionStorage保存エラー:', error);
        }
    }, [inputText, selectedFont, fontSize, letterSpacing, strokeWidth]);

    // 初期化フラグを設定
    useEffect(() => {
        isInitialized.current = true;
    }, []);

    // 状態変更時にLocalStorageに保存（デバウンス付き）
    useEffect(() => {
        if (isInitialized.current) {
            const timeoutId = setTimeout(() => {
                saveToLocalStorage();
            }, 300); // 300ms デバウンス
            return () => clearTimeout(timeoutId);
        }
    }, [inputText, selectedFont, fontSize, letterSpacing, strokeWidth, selectedNeonColor, saveToLocalStorage]);

    // 入力値が変更されたら自動で再生成
    useEffect(() => {
        updateCanvasSize();
        generateTextToSVG();
    }, [inputText, selectedFont, fontSize, letterSpacing, strokeWidth, selectedNeonColor, generateTextToSVG, updateCanvasSize]);

    // キャンバスのdevicePixelRatio対応設定
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const pixelRatio = window.devicePixelRatio || 1;
        
        // 物理解像度を設定（pixelRatio倍）
        canvas.width = canvasWidth * pixelRatio;
        canvas.height = canvasHeight * pixelRatio;
        
        // CSS上のサイズを設定
        canvas.style.width = canvasWidth + 'px';
        canvas.style.height = canvasHeight + 'px';
        
        // 描画コンテキストをpixelRatio倍にスケール
        const ctx = canvas.getContext('2d');
        ctx.scale(pixelRatio, pixelRatio);
        
        // 即座に再描画
        generateTextToSVG();
    }, [canvasWidth, canvasHeight, generateTextToSVG]);

    return (
        <div className="text-generator-app-container">
            {/* メインキャンバスエリア */}
            <div className="text-generator-canvas-area">
                <canvas
                    ref={canvasRef}
                    className="text-generator-main-canvas"
                />
                {/* キャンバス右下のダウンロードボタン */}
                <button
                    onClick={downloadFontImage}
                    className="text-generator-canvas-download-button"
                >
                    テキスト画像を保存
                </button>
            </div>

            {/* サイドバー閉じた時のみ表示するトグルボタン */}
            {(navigator.maxTouchPoints > 0) && !isMobileSidebarVisible && (
                <button 
                    className="text-generator-mobile-toggle-fixed"
                    onClick={() => setIsMobileSidebarVisible(!isMobileSidebarVisible)}
                >
                    ▼
                </button>
            )}

            {/* 右サイドバー */}
            <div className={`text-generator-sidebar ${!isMobileSidebarVisible ? 'hidden' : ''}`}>
                <div className="text-generator-header">
                    <h2 className="text-generator-title">テキストから生成</h2>
                    <div 
                        className={`text-generator-guide-button ${isGuideEffectStopped ? 'stopped' : ''}`}
                        onClick={() => {
                            setIsGuideModalOpen(true);
                            setTimeout(() => {
                                onGuideEffectStop?.();
                            }, 150);
                        }}
                    ></div>
                    <button 
                        className="text-generator-mobile-toggle"
                        onClick={() => setIsMobileSidebarVisible(!isMobileSidebarVisible)}
                    >
                        ▲
                    </button>
                </div>
                <div className="text-input-tools-title">テキストを入力</div>
                <div className="text-input-description">
                    ネオンサインにしたいテキストを以下に入力
                </div>
                <div className="text-generator-control-group">
                    <textarea
                        ref={textAreaRef}
                        id="textInput"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="⚡ここから入力してください..."
                        className="text-input"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck="false"
                    />
                    <div className="text-input-help">
                        Enter, Returnキーで改行できます。キャンバスにも改行が反映されます。
                    </div>
                    {inputText.length > 30 && (
                        <div className="character-limit-warning">
                            30文字以上のカスタムネオンについては、お見積りいたしますのでお問い合わせください。
                        </div>
                    )}
                </div>

                <div className="font-preview-tools-title">フォントを選択</div>
                <div className="font-selector-container">
                    <div 
                        className="font-selector-button"
                        onClick={() => setIsFontSelectorOpen(!isFontSelectorOpen)}
                    >
                        <div className="selected-font-preview">
                            <div 
                                className="selected-font-text"
                                style={{ fontFamily: getFontFamily(selectedFont) }}
                            >
                                {selectedFont}
                            </div>
                        </div>
                        <div className={`font-selector-arrow ${isFontSelectorOpen ? 'open' : ''}`}>
                            ▼
                        </div>
                    </div>
                    
                    {isFontSelectorOpen && (
                        <div className="font-preview-container">
                            <div className="font-preview-grid">
                                {allFonts.map((fontItem) => (
                                    <div className="font-item-wrapper" key={fontItem.name}>
                                        <div 
                                            className={`font-preview-item ${selectedFont === fontItem.name ? 'selected' : ''}`}
                                            onClick={() => setSelectedFont(fontItem.name)}
                                        >
                                            <div 
                                                className="font-preview-text"
                                                style={{ fontFamily: fontItem.font }}
                                            >
                                                {inputText || 'Sample'}
                                            </div>
                                            <div className="font-tags">
                                                {fontItem.tags.filter(tag => tag === '人気' || tag === '日本語対応').map((tag, index) => (
                                                    <span key={index} className={`font-tag ${tag === '人気' ? 'popular' : tag === '日本語対応' ? 'japanese' : ''}`}>
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="font-name">{fontItem.name}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="neon-color-tools-title">色を選択</div>
                <div className="neon-color-palette">
                    {neonPresetColors.map((color) => (
                        <div 
                            key={color} 
                            className={`neon-color-item-wrapper ${selectedNeonColor === color ? 'selected' : ''}`}
                            onClick={() => setSelectedNeonColor(color)}
                        >
                            <div 
                                className="neon-color-item"
                                style={{ 
                                    backgroundColor: color,
                                    border: '2px solid #6b7280'
                                }}
                                title={colorNameMap[color] || color}
                            />
                            <div className="neon-color-name">{colorNameMap[color] || color}</div>
                        </div>
                    ))}
                </div>
                
                <div className="color-selection-note">
                    ※ こちらの色はプレビュー用です。実際のご注文時には、ネオン下絵で画像に沿ったネオンパスを描画して、色仕様のカスタマイズで色や太さを細かく指定可能です。
                </div>

                <div className="font-preview-tools-title">文字間隔を調整</div>
                <div className="letter-spacing-selector-container">
                    <div 
                        className="letter-spacing-selector-button"
                        onClick={() => setIsLetterSpacingSelectorOpen(!isLetterSpacingSelectorOpen)}
                    >
                        <div className="letter-spacing-preview">
                            <span className="letter-spacing-selector-label">スペース</span>
                            <span className="letter-spacing-value">{letterSpacing}px</span>
                        </div>
                        <div className={`letter-spacing-arrow ${isLetterSpacingSelectorOpen ? 'open' : ''}`}>
                            ▼
                        </div>
                    </div>
                    
                    {isLetterSpacingSelectorOpen && (
                        <div className="letter-spacing-slider-container">
                            <div className="letter-spacing-slider-label">スペース: {letterSpacing}px</div>
                            <input
                                id="letterSpacingSlider"
                                type="range"
                                min="0"
                                max="75"
                                value={letterSpacing}
                                onChange={(e) => setLetterSpacing(parseInt(e.target.value))}
                                className="letter-spacing-slider"
                            />
                        </div>
                    )}
                </div>


                <div className="text-generator-buttons-container">
                    <button
                        onClick={exportAsImage}
                        className="text-generator-export-button"
                    >
                        下絵作成へ進む
                    </button>
                </div>
            </div>

            {/* ガイドモーダル */}
            <TextGeneratorGuideModal 
                isOpen={isGuideModalOpen} 
                onClose={() => setIsGuideModalOpen(false)} 
            />
        </div>
    );
};

export default TextGenerator;