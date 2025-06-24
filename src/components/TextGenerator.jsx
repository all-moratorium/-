import React, { useState, useRef, useCallback, useEffect } from 'react';
import './TextGenerator.css';

// LocalStorageからデータを安全に読み込む関数
const safeGetFromLocalStorage = (key, fallback = null) => {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : fallback;
    } catch (error) {
        console.error(`LocalStorage読み込みエラー (${key}):`, error);
        return fallback;
    }
};

// 初期状態を取得する関数
const getInitialTextGeneratorState = () => {
    const savedData = safeGetFromLocalStorage('textGeneratorData');
    
    return {
        inputText: savedData?.inputText || '',
        selectedFont: savedData?.selectedFont || 'cudi',
        fontSize: savedData?.fontSize || 60,
        letterSpacing: savedData?.letterSpacing || 0,
        strokeWidth: savedData?.strokeWidth || 3
    };
};

const TextGenerator = ({ onNavigateToCustomize }) => {
    const initialState = getInitialTextGeneratorState();
    
    const [inputText, setInputText] = useState(initialState.inputText);
    const [selectedFont, setSelectedFont] = useState(initialState.selectedFont);
    const [fontSize, setFontSize] = useState(initialState.fontSize);
    const [letterSpacing, setLetterSpacing] = useState(initialState.letterSpacing);
    const [strokeWidth, setStrokeWidth] = useState(initialState.strokeWidth);
    const canvasRef = useRef(null);
    const [generatedPaths, setGeneratedPaths] = useState([]);
    const textAreaRef = useRef(null);
    const isInitialized = useRef(false);

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

    // キャンバスサイズを画面100%に設定
    const updateCanvasSize = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }, []);

    // テキストからSVGパスを生成する関数
    const generateTextToSVG = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        
        // キャンバスを完全にクリア
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // テキストが空の場合はSampleを表示
        const displayText = inputText.trim() || 'Sample';
        
        // テキストが空の場合は背景のみ描画
        if (!inputText.trim()) {
            ctx.fillStyle = '#f5f5f5';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
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
        
        // 改行を考慮した高さ計算
        const lines = displayText.split('\n');
        const lineHeight = fontSize * 1.2;
        const totalTextHeightWithLines = (lines.length - 1) * lineHeight + textHeight;
        
        // 一定の幅・高さを維持するためのスケール調整
        const targetWidth = canvas.width * 0.4; // キャンバス幅の40%を使用
        const targetHeight = canvas.height * 0.8; // キャンバス高さの80%を使用（改行対応）
        
        // 幅と高さの両方を考慮してスケールを計算
        const scaleByWidth = targetWidth / textWidth;
        const scaleByHeight = targetHeight / totalTextHeightWithLines;
        const scale = Math.min(scaleByWidth, scaleByHeight); // 小さい方を採用
        
        // スケールを適用したサイズを計算
        const scaledTextWidth = textWidth * scale;
        const scaledTextHeight = textHeight * scale;
        const scaledFontSize = fontSize * scale;
        
        // 左右のサイドバーを考慮した真ん中の位置を計算
        const rightSidebarWidth = window.innerWidth * 0.27; // 右サイドバー（27%）
        const leftSidebarWidth = 50; // 左サイドバー（固定幅）
        const availableWidth = canvas.width - rightSidebarWidth - leftSidebarWidth; // 利用可能な幅
        const centerX = leftSidebarWidth + availableWidth / 2; // 利用可能エリアの中央
        
        const startX = centerX - scaledTextWidth / 2;
        const startY = canvas.height / 2 + scaledFontSize / 5;
        
        // 背景を描画
        ctx.fillStyle = '#f5f5f5';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // スケールを適用してテキスト描画
        ctx.save();
        ctx.scale(scale, scale);
        ctx.font = `${fontSize}px ${fontFamily}`;
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = strokeWidth;
        
        // 改行対応のテキスト描画
        const unscaledX = startX / scale;
        const unscaledY = startY / scale;
        ctx.fillStyle = '#333333';
        
        // 改行対応のテキスト描画
        const textLines = displayText.split('\n');
        const textLineHeight = fontSize * 1.2; // 行間
        
        // フォントグループ全体の高さを計算
        const totalHeight = (textLines.length - 1) * textLineHeight;
        // フォントグループの中央がキャンバス中央に来るように開始Y位置を調整
        const startYPos = unscaledY - (totalHeight / 2);
        
        // 既に定義された変数を使用してキャンバス中央位置を計算
        const canvasCenterX = leftSidebarWidth + availableWidth / 2;
        
        textLines.forEach((line, index) => {
            // 各行の幅を測定して中央揃え
            const lineWidth = ctx.measureText(line).width;
            const lineCenterX = (canvasCenterX - (lineWidth * scale / 2)) / scale;
            const yPos = startYPos + (index * textLineHeight);
            ctx.fillText(line, lineCenterX, yPos);
        });
        ctx.restore();
        
        // 簡易的なパス生成
        const paths = [];
        let currentX = startX;
        
        for (let i = 0; i < displayText.length; i++) {
            const char = displayText[i];
            ctx.font = `${fontSize}px ${fontFamily}`;
            const charWidth = ctx.measureText(char).width * scale;
            
            // 各文字を矩形パスとして近似
            const charPath = {
                points: [
                    { x: currentX, y: startY - scaledFontSize * 0.7 },
                    { x: currentX + charWidth, y: startY - scaledFontSize * 0.7 },
                    { x: currentX + charWidth, y: startY + scaledFontSize * 0.3 },
                    { x: currentX, y: startY + scaledFontSize * 0.3 }
                ],
                mode: 'stroke',
                type: 'line'
            };
            
            paths.push(charPath);
            currentX += charWidth + (letterSpacing * scale);
        }
        
        setGeneratedPaths(paths);
    }, [inputText, selectedFont, fontSize, letterSpacing, strokeWidth]);

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
        
        // テキストサイズを正確に測定
        ctx.letterSpacing = `${letterSpacing}px`;
        const textMetrics = ctx.measureText(displayText);
        
        // より正確なバウンディングボックスを計算
        const actualLeft = Math.abs(textMetrics.actualBoundingBoxLeft || 0);
        const actualRight = textMetrics.actualBoundingBoxRight || textMetrics.width;
        const actualTop = textMetrics.actualBoundingBoxAscent || fontSize * 0.8;
        const actualBottom = textMetrics.actualBoundingBoxDescent || fontSize * 0.2;
        
        const textWidth = actualLeft + actualRight;
        const textHeight = actualTop + actualBottom;
        
        // 高解像度対応（4倍サイズで描画）
        const scale = 4;
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
        
        // テキストを描画（正確な位置に配置）
        ctx.font = `${fontSize}px ${fontFamily}`;
        ctx.fillStyle = '#000000';
        ctx.textBaseline = 'alphabetic';
        ctx.letterSpacing = `${letterSpacing}px`;
        ctx.fillText(displayText, actualLeft + minPadding, actualTop + minPadding);
        
        // 画像データを取得
        const dataURL = exportCanvas.toDataURL('image/png');
        
        // ネオン下絵に画像データを渡してページ移動
        window.dispatchEvent(new CustomEvent('navigateToNeonDrawing', {
            detail: {
                backgroundImage: dataURL,
                imageName: `${displayText}_text.png`
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
        
        // テキストサイズを正確に測定
        ctx.letterSpacing = `${letterSpacing}px`;
        const textMetrics = ctx.measureText(displayText);
        
        // より正確なバウンディングボックスを計算
        const actualLeft = Math.abs(textMetrics.actualBoundingBoxLeft || 0);
        const actualRight = textMetrics.actualBoundingBoxRight || textMetrics.width;
        const actualTop = textMetrics.actualBoundingBoxAscent || fontSize * 0.8;
        const actualBottom = textMetrics.actualBoundingBoxDescent || fontSize * 0.2;
        
        const textWidth = actualLeft + actualRight;
        const textHeight = actualTop + actualBottom;
        
        // 高解像度対応（4倍サイズで描画）
        const scale = 4;
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
        
        // テキストを描画（正確な位置に配置）
        ctx.font = `${fontSize}px ${fontFamily}`;
        ctx.fillStyle = '#000000';
        ctx.textBaseline = 'alphabetic';
        ctx.letterSpacing = `${letterSpacing}px`;
        ctx.fillText(displayText, actualLeft + minPadding, actualTop + minPadding);
        
        // 画像をダウンロード
        const dataURL = exportCanvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = dataURL;
        link.download = `${displayText}_font.png`;
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
            // リサイズ後にテキストを再描画
            setTimeout(() => generateTextToSVG(), 10);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [updateCanvasSize, generateTextToSVG]);

    // LocalStorageに状態を保存する関数
    const saveToLocalStorage = useCallback(() => {
        if (!isInitialized.current) return;
        
        try {
            const dataToSave = {
                inputText,
                selectedFont,
                fontSize,
                letterSpacing,
                strokeWidth
            };
            localStorage.setItem('textGeneratorData', JSON.stringify(dataToSave));
        } catch (error) {
            console.error('LocalStorage保存エラー:', error);
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
    }, [inputText, selectedFont, fontSize, letterSpacing, strokeWidth, saveToLocalStorage]);

    // 入力値が変更されたら自動で再生成
    useEffect(() => {
        updateCanvasSize();
        generateTextToSVG();
    }, [inputText, selectedFont, fontSize, letterSpacing, strokeWidth, generateTextToSVG, updateCanvasSize]);

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
                    画像を保存
                </button>
            </div>

            {/* 右サイドバー */}
            <div className="text-generator-sidebar">
                <div className="text-generator-header">
                    <h2 className="text-generator-title">テキストから生成</h2>
                    <div className="text-generator-guide-button"></div>
                </div>
                <div className="text-input-tools-title">テキスト入力</div>
                <div className="text-generator-control-group">
                    <textarea
                        ref={textAreaRef}
                        id="textInput"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="✨ネオンサインにしたいテキストを入力してください（Enterで改行）"
                        className="text-input"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck="false"
                    />
                    <div className="text-input-help">
                        💡 Enterキーで改行できます。キャンバスにも改行が反映されます。
                    </div>
                    {inputText.length > 30 && (
                        <div className="character-limit-warning">
                            30文字以上のカスタムネオンについては、お見積りいたしますのでお問い合わせください。
                        </div>
                    )}
                </div>

                <div className="font-preview-tools-title">フォントプレビュー</div>
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


                <div className="text-generator-control-group">
                    <div className="letter-spacing-label">文字間隔調整: {letterSpacing}px</div>
                    <input
                        id="letterSpacingSlider"
                        type="range"
                        min="0"
                        max="50"
                        value={letterSpacing}
                        onChange={(e) => setLetterSpacing(parseInt(e.target.value))}
                        className="letter-spacing-slider"
                    />
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
        </div>
    );
};

export default TextGenerator;