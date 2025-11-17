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
        selectedFont: savedData?.selectedFont || 'Dance',
        fontSize: savedData?.fontSize || 60,
        letterSpacing: savedData?.letterSpacing || 0,
        strokeWidth: savedData?.strokeWidth || 3,
        selectedNeonColor: savedData?.selectedNeonColor || '#ffffff'
    };
};

const TextGenerator = ({ onNavigateToCustomize, isGuideEffectStopped, onGuideEffectStop, sidebarExpanded = true }) => {
    const initialState = getInitialTextGeneratorState();
    
    const [inputText, setInputText] = useState(initialState.inputText);
    const [selectedFont, setSelectedFont] = useState(initialState.selectedFont);
    const [fontSize, setFontSize] = useState(initialState.fontSize);
    const [letterSpacing, setLetterSpacing] = useState(initialState.letterSpacing);
    const [strokeWidth, setStrokeWidth] = useState(initialState.strokeWidth);
    const [selectedNeonColor, setSelectedNeonColor] = useState(initialState.selectedNeonColor || '#ffffff');
    const canvasRef = useRef(null);
    const [generatedPaths, setGeneratedPaths] = useState([]);
    const textAreaRef = useRef(null);
    const isInitialized = useRef(false);
    const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);
    const [isMobileSidebarVisible, setIsMobileSidebarVisible] = useState(true);
    const [isFontSelectorOpen, setIsFontSelectorOpen] = useState(false);
    const [isLetterSpacingSelectorOpen, setIsLetterSpacingSelectorOpen] = useState(false);
    const [fontFilter, setFontFilter] = useState('all');
    
    // キャンバスサイズの状態
    const [canvasWidth, setCanvasWidth] = useState(window.innerWidth);
    const [canvasHeight, setCanvasHeight] = useState(window.innerHeight);
    
    // アニメーション用の左サイドバー幅
    const [animatedLeftSidebarWidth, setAnimatedLeftSidebarWidth] = useState(sidebarExpanded ? 250 : 70);
    const animationFrameRef = useRef(null);
    
    // モバイル版アニメーション用の表示エリア位置とサイズ
    const [animatedDisplayAreaLeft, setAnimatedDisplayAreaLeft] = useState(
        isMobileSidebarVisible ? (window.innerWidth - 300) * 0.15 : window.innerWidth * 0.2
    );
    const [animatedDisplayAreaWidth, setAnimatedDisplayAreaWidth] = useState(
        isMobileSidebarVisible ? (window.innerWidth - 300) * 0.7 : window.innerWidth * 0.6
    );
    const [animatedDisplayAreaHeight, setAnimatedDisplayAreaHeight] = useState(
        window.innerHeight * (isMobileSidebarVisible ? 0.7 : 0.6)
    );
    const mobileAnimationFrameRef = useRef(null);
    const previousOrientationRef = useRef(window.innerHeight > window.innerWidth ? 'portrait' : 'landscape');
    const [shouldAnimateButton, setShouldAnimateButton] = useState(true);

    const allFonts = [
        // 手書き
        { name: 'Sketch', font: 'Indie Flower, cursive', tags: ['人気', '手書き', 'カジュアル'] },
        { name: 'Quick Note', font: 'Caveat, cursive', tags: ['手書き', 'カジュアル'] },
        { name: 'Simple Hand', font: 'Amatic SC, cursive', tags: ['シンプル', '手書き'] },
        { name: 'Shadow', font: 'Shadows Into Light, cursive', tags: ['手書き'] },
        { name: 'Blueprint', font: 'Architects Daughter, cursive', tags: ['手書き'] },
        { name: 'Friendly', font: 'Handlee, cursive', tags: ['手書き'] },
        { name: 'Spontaneous', font: 'Nothing You Could Do, cursive', tags: ['手書き'] },
        { name: 'Quirky', font: 'Reenie Beanie, cursive', tags: ['手書き'] },
        { name: 'Rough', font: 'Bad Script, cursive', tags: ['手書き', 'カジュアル'] },
        { name: 'Dreamy', font: 'Over the Rainbow, cursive', tags: ['手書き', 'カジュアル'] },
        // 装飾/レトロ
        { name: 'Sweet', font: 'Cookie, cursive', tags: ['人気', '筆記体'] },
        { name: 'Citrus', font: 'Tangerine, cursive', tags: ['筆記体', '装飾'] },
        { name: 'Tasty', font: 'Leckerli One, cursive', tags: ['筆記体'] },
        { name: 'Garden', font: 'Courgette, cursive', tags: ['筆記体'] },
        { name: 'Playful', font: 'Butterfly Kids, cursive', tags: ['装飾'] },
        { name: 'Retro Star', font: 'Geostar, cursive', tags: ['装飾', 'レトロ'] },
        { name: 'Bold Vintage', font: 'Warnes, cursive', tags: ['装飾', 'ボールド'] },
        { name: 'Tulip', font: 'Tulpen One, cursive', tags: ['装飾', 'レトロ'] },
        { name: 'Frosty', font: 'Snowburst One, cursive', tags: ['装飾', 'ユニーク'] },
        { name: 'Outlined', font: 'Kumar One Outline, cursive', tags: ['アウトライン', '装飾'] },
        { name: 'Pop Art', font: 'Londrina Outline, cursive', tags: ['アウトライン', 'ポップ'] },
        // 未来/テック
        { name: 'Neon Line', font: 'Monoton, cursive', tags: ['人気', 'ネオン'] },
        { name: 'Futuristic', font: 'Audiowide, cursive', tags: ['人気', '未来', 'テック'] },
        { name: 'Orbit', font: 'Orbitron, cursive', tags: ['未来', 'テック'] },
        { name: 'Digital', font: 'Syncopate, cursive', tags: ['未来', 'テック'] },
        { name: 'Chrome', font: 'Michroma, sans-serif', tags: ['未来', 'テック'] },
        { name: 'Tech', font: 'Petch, sans-serif', tags: ['モダン', 'テック'] },
        { name: 'Slim Future', font: 'Megrim, cursive', tags: ['未来', 'ユニーク'] },
        // モダン/幾何学
        { name: 'Comfort', font: 'Comfortaa, cursive', tags: ['人気', 'モダン'] },
        { name: 'Modern Slab', font: 'Josefin Slab, serif', tags: ['セリフ', 'エレガント'] },
        { name: 'Moonlight', font: 'Tsukimi Rounded, sans-serif', tags: ['モダン', '丸ゴシック'] },
        { name: 'Geometric', font: 'Geo, sans-serif', tags: ['幾何学', 'モダン'] },
        { name: 'Balance', font: 'Chakra, sans-serif', tags: ['モダン', 'クリーン'] },
        { name: 'Ultra Thin', font: 'Bungee Hairline, cursive', tags: ['細線', 'モダン'] },
        // その他
        { name: 'Pacific', font: 'Pacifico, cursive', tags: ['人気', 'ポップ'] },
        { name: 'Gothic', font: 'Griffy, cursive', tags: ['人気', 'ユニーク'] },
        { name: 'Typewriter', font: 'Courier Prime, cursive', tags: ['レトロ'] },
        { name: 'Neon Drip', font: 'Neonderthaw, cursive', tags: ['ネオン', 'ユニーク'] },
        { name: 'Sport', font: 'Offside, cursive', tags: ['スポーツ', 'カジュアル'] },
        { name: 'Champion', font: 'Tourney, cursive', tags: ['スポーツ', 'ダイナミック'] },
        // 筆記体
        { name: 'Dance', font: 'Dancing Script, cursive', tags: ['人気', '筆記体'] },
        { name: 'Elegant Flow', font: 'Sacramento, cursive', tags: ['人気', '筆記体', '装飾'] },
        { name: 'Sunset', font: 'Yellowtail, cursive', tags: ['筆記体'] },
        { name: 'Arizona', font: 'Arizonia, cursive', tags: ['筆記体'] },
        { name: 'Rouge', font: 'Rouge Script, cursive', tags: ['筆記体'] },
        { name: 'Classic', font: 'Marck Script, cursive', tags: ['筆記体'] },
        { name: 'Click', font: 'Clicker Script, cursive', tags: ['筆記体'] },
        { name: 'Delafield', font: 'Mrs Saint Delafield, cursive', tags: ['筆記体'] },
        { name: 'New Dawn', font: 'Dawning of a New Day, cursive', tags: ['筆記体'] },
        { name: 'Vibes', font: 'Great Vibes, cursive', tags: ['人気', '筆記体', '装飾'] },
        { name: 'Allure', font: 'Allura, cursive', tags: ['筆記体', '装飾'] },
        { name: 'Brush', font: 'Alex Brush, cursive', tags: ['人気', '筆記体'] },
        { name: 'French', font: 'Monsieur La Doulaise, cursive', tags: ['筆記体', '装飾'] },
        { name: 'Imperial', font: 'Imperial Script, cursive', tags: ['筆記体', '装飾'] },
        { name: 'Guilty', font: 'Mea Culpa, cursive', tags: ['筆記体'] },
        { name: 'Storm', font: 'Hurricane, cursive', tags: ['筆記体', 'ダイナミック'] },
        { name: 'Breeze', font: 'WindSong, cursive', tags: ['筆記体', 'エレガント'] },
        { name: 'Romantic', font: 'Lovers Quarrel, cursive', tags: ['筆記体', 'ロマンティック'] },
        { name: 'Grypen', font: 'Qwitcher Grypen, cursive', tags: ['筆記体', 'エレガント'] },
        { name: 'Fiesta', font: 'Ole, cursive', tags: ['筆記体', 'カジュアル'] },
        // 日本語対応フォント
        { name: 'Noto Sans', font: 'Noto Sans JP, sans-serif', tags: ['日本語対応', 'ベーシック', '人気'] },
        { name: 'Noto Serif', font: 'Noto Serif JP, serif', tags: ['日本語対応', 'ベーシック'] },
        { name: 'Kosugi', font: 'Kosugi, sans-serif', tags: ['日本語対応', 'ベーシック'] },
        { name: 'Pop Round', font: 'Hachi Maru Pop, cursive', tags: ['日本語対応', 'ポップ'] },
        { name: 'Kiwi', font: 'Kiwi Maru, cursive', tags: ['日本語対応', 'ポップ'] },
        { name: 'Stick', font: 'Stick, sans-serif', tags: ['日本語対応', 'ユニーク'] },
        { name: 'Train', font: 'Train One, cursive', tags: ['日本語対応', 'ポップ'] },
        { name: 'Tegomin', font: 'New Tegomin, serif', tags: ['日本語対応', '伝統'] },
        { name: 'Yomogi', font: 'Yomogi, cursive', tags: ['日本語対応', '伝統'] },
        { name: 'Kaisei', font: 'Kaisei Opti, serif', tags: ['日本語対応', '伝統'] },
        { name: 'Gamja', font: 'Gamja Flower, cursive', tags: ['日本語対応', 'ゲーム'] },
        { name: 'Shizuru', font: 'Shizuru, cursive', tags: ['日本語対応', 'ゲーム'] },
        { name: 'Klee', font: 'Klee One, cursive', tags: ['日本語対応', '手書き'] },
        { name: 'Yuji', font: 'Yuji Mai, serif', tags: ['日本語対応', '手書き'] },
        { name: 'Lubrifont', font: 'WDXL Lubrifont JP N, sans-serif', tags: ['日本語対応', 'モダン'] }
    ];

    // フォント名からフォントファミリーを取得する関数
    const getFontFamily = (fontName) => {
        const fontMap = {
            // 手書き
            'Sketch': 'Indie Flower, cursive',
            'Quick Note': 'Caveat, cursive',
            'Simple Hand': 'Amatic SC, cursive',
            'Shadow': 'Shadows Into Light, cursive',
            'Blueprint': 'Architects Daughter, cursive',
            'Friendly': 'Handlee, cursive',
            'Spontaneous': 'Nothing You Could Do, cursive',
            'Quirky': 'Reenie Beanie, cursive',
            'Rough': 'Bad Script, cursive',
            'Dreamy': 'Over the Rainbow, cursive',
            // 装飾/レトロ
            'Sweet': 'Cookie, cursive',
            'Citrus': 'Tangerine, cursive',
            'Tasty': 'Leckerli One, cursive',
            'Garden': 'Courgette, cursive',
            'Playful': 'Butterfly Kids, cursive',
            'Retro Star': 'Geostar, cursive',
            'Bold Vintage': 'Warnes, cursive',
            'Tulip': 'Tulpen One, cursive',
            'Frosty': 'Snowburst One, cursive',
            'Outlined': 'Kumar One Outline, cursive',
            'Pop Art': 'Londrina Outline, cursive',
            // 未来/テック
            'Neon Line': 'Monoton, cursive',
            'Futuristic': 'Audiowide, cursive',
            'Orbit': 'Orbitron, cursive',
            'Digital': 'Syncopate, cursive',
            'Chrome': 'Michroma, sans-serif',
            'Tech': 'Petch, sans-serif',
            'Slim Future': 'Megrim, cursive',
            // モダン/幾何学
            'Comfort': 'Comfortaa, cursive',
            'Modern Slab': 'Josefin Slab, serif',
            'Moonlight': 'Tsukimi Rounded, sans-serif',
            'Geometric': 'Geo, sans-serif',
            'Balance': 'Chakra, sans-serif',
            'Ultra Thin': 'Bungee Hairline, cursive',
            // その他
            'Pacific': 'Pacifico, cursive',
            'Gothic': 'Griffy, cursive',
            'Typewriter': 'Courier Prime, cursive',
            'Neon Drip': 'Neonderthaw, cursive',
            'Sport': 'Offside, cursive',
            'Champion': 'Tourney, cursive',
            // 筆記体
            'Dance': 'Dancing Script, cursive',
            'Elegant Flow': 'Sacramento, cursive',
            'Sunset': 'Yellowtail, cursive',
            'Arizona': 'Arizonia, cursive',
            'Rouge': 'Rouge Script, cursive',
            'Classic': 'Marck Script, cursive',
            'Click': 'Clicker Script, cursive',
            'Delafield': 'Mrs Saint Delafield, cursive',
            'New Dawn': 'Dawning of a New Day, cursive',
            'Vibes': 'Great Vibes, cursive',
            'Allure': 'Allura, cursive',
            'Brush': 'Alex Brush, cursive',
            'French': 'Monsieur La Doulaise, cursive',
            'Imperial': 'Imperial Script, cursive',
            'Guilty': 'Mea Culpa, cursive',
            'Storm': 'Hurricane, cursive',
            'Breeze': 'WindSong, cursive',
            'Romantic': 'Lovers Quarrel, cursive',
            'Grypen': 'Qwitcher Grypen, cursive',
            'Fiesta': 'Ole, cursive',
            // 日本語フォント
            'Noto Sans': 'Noto Sans JP, sans-serif',
            'Noto Serif': 'Noto Serif JP, serif',
            'Kosugi': 'Kosugi, sans-serif',
            'Pop Round': 'Hachi Maru Pop, cursive',
            'Kiwi': 'Kiwi Maru, cursive',
            'Stick': 'Stick, sans-serif',
            'Train': 'Train One, cursive',
            'Tegomin': 'New Tegomin, serif',
            'Yomogi': 'Yomogi, cursive',
            'Kaisei': 'Kaisei Opti, serif',
            'Gamja': 'Gamja Flower, cursive',
            'Shizuru': 'Shizuru, cursive',
            'Klee': 'Klee One, cursive',
            'Yuji': 'Yuji Mai, serif',
            'Lubrifont': 'WDXL Lubrifont JP N, sans-serif'
        };
        return fontMap[fontName] || 'Arial, sans-serif';
    };

    // フォントのフィルター・ソート処理
    const getFilteredAndSortedFonts = () => {
        let filtered = [...allFonts];

        // フィルター適用
        if (fontFilter === 'all') {
            // 全て：カテゴリ順（元の順序）
            return filtered;
        } else if (fontFilter === '人気') {
            // 人気：人気タグがあるものだけを表示（すでに人気順）
            return filtered.filter(font => font.tags.includes('人気'));
        } else if (fontFilter === '日本語対応') {
            // 日本語：日本語対応フォントを上に
            return filtered.filter(font => font.tags.includes('日本語対応'));
        }

        return filtered;
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
        ctx.strokeStyle = '#ffffff';
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
            // スマホ: サイドバー状態に応じて配置（アニメーション対応）
            displayAreaWidth = animatedDisplayAreaWidth;
            displayAreaHeight = animatedDisplayAreaHeight;
            displayAreaLeft = animatedDisplayAreaLeft;
            displayAreaTop = (canvasHeight - displayAreaHeight) / 2;
        } else {
            // デスクトップ: サイドバーを考慮した配置
            const rightSidebarWidth = Math.min(window.innerWidth * 0.24, 500); // 右サイドバー（27%、最大500px）
            const leftSidebarWidth = animatedLeftSidebarWidth; // アニメーション中の左サイドバー幅を使用
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
            `rgb(${Math.floor(rgb.r * 0.10)}, ${Math.floor(rgb.g * 0.10)}, ${Math.floor(rgb.b * 0.10)})` : 
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
    }, [inputText, selectedFont, fontSize, letterSpacing, strokeWidth, selectedNeonColor, canvasWidth, canvasHeight, animatedLeftSidebarWidth, animatedDisplayAreaLeft, animatedDisplayAreaWidth, animatedDisplayAreaHeight]);

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
        const minPadding = 8; // 余白8px
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
        ctx.textBaseline = 'alphabetic';
        ctx.letterSpacing = `${letterSpacing}px`;
        
        textLines.forEach((line, index) => {
            // 各行の幅を測定して中央揃え
            const lineWidth = ctx.measureText(line).width;
            const centerX = (textWidth + minPadding * 2) / 2 - lineWidth / 2;
            const yPos = actualTop + minPadding + (index * lineHeight);
            
            // グレー単色
            ctx.fillStyle = '#b0b0b0';
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
        const minPadding = 8; // 余白8px
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
        ctx.textBaseline = 'alphabetic';
        ctx.letterSpacing = `${letterSpacing}px`;
        
        textLines.forEach((line, index) => {
            // 各行の幅を測定して中央揃え
            const lineWidth = ctx.measureText(line).width;
            const centerX = (textWidth + minPadding * 2) / 2 - lineWidth / 2;
            const yPos = actualTop + minPadding + (index * lineHeight);
            
            // グレー単色
            ctx.fillStyle = '#b0b0b0';
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
  <text x="50" y="${textHeight * 1.1}" font-family="${fontFamily}" font-size="${fontSize}" fill="#000000" stroke="#ffffff" stroke-width="3" letter-spacing="${letterSpacing}px">${displayText}</text>
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

    // サイドバー状態変更時のスムーズなアニメーション
    useEffect(() => {
        const targetWidth = sidebarExpanded ? 250 : 70;
        const startWidth = animatedLeftSidebarWidth;
        const startTime = Date.now();
        const duration = 300; // 0.3秒
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeProgress = 1 - Math.pow(1 - progress, 3); // easeOutCubic
            
            const currentWidth = startWidth + (targetWidth - startWidth) * easeProgress;
            setAnimatedLeftSidebarWidth(currentWidth);
            
            if (progress < 1) {
                animationFrameRef.current = requestAnimationFrame(animate);
            }
        };
        
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
        
        if (Math.abs(targetWidth - startWidth) > 1) {
            animationFrameRef.current = requestAnimationFrame(animate);
        } else {
            setAnimatedLeftSidebarWidth(targetWidth);
        }
        
        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [sidebarExpanded]);

    // モバイルサイドバー状態変更時のスムーズなアニメーション
    useEffect(() => {
        const currentOrientation = canvasHeight > canvasWidth ? 'portrait' : 'landscape';
        const orientationChanged = previousOrientationRef.current !== currentOrientation;
        
        // 画面向きが変わった場合は前回の向きを更新
        if (orientationChanged) {
            previousOrientationRef.current = currentOrientation;
        }
        
        const targetLeft = isMobileSidebarVisible 
            ? (canvasWidth - 300) * 0.15  // サイドバー開：左エリアの15%位置
            : canvasWidth * 0.2;          // サイドバー閉：画面の20%位置
            
        const targetWidth = isMobileSidebarVisible 
            ? (canvasWidth - 300) * 0.7   // サイドバー開：左エリアの70%
            : canvasWidth * 0.6;          // サイドバー閉：画面の60%
            
        const targetHeight = canvasHeight * (isMobileSidebarVisible ? 0.7 : 0.6);
        
        // 画面向きが変わった時は即座に位置を更新（アニメーションなし）
        if (orientationChanged) {
            setAnimatedDisplayAreaLeft(targetLeft);
            setAnimatedDisplayAreaWidth(targetWidth);
            setAnimatedDisplayAreaHeight(targetHeight);
            setShouldAnimateButton(false);
            // 少し遅延してアニメーションを再開
            setTimeout(() => setShouldAnimateButton(true), 100);
            return;
        }
            
        const startLeft = animatedDisplayAreaLeft;
        const startWidth = animatedDisplayAreaWidth;
        const startHeight = animatedDisplayAreaHeight;
        const startTime = Date.now();
        const duration = 300; // 0.3秒
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // イージング関数（ease-out）
            const easeOut = 1 - Math.pow(1 - progress, 3);
            
            const currentLeft = startLeft + (targetLeft - startLeft) * easeOut;
            const currentWidth = startWidth + (targetWidth - startWidth) * easeOut;
            const currentHeight = startHeight + (targetHeight - startHeight) * easeOut;
            
            setAnimatedDisplayAreaLeft(currentLeft);
            setAnimatedDisplayAreaWidth(currentWidth);
            setAnimatedDisplayAreaHeight(currentHeight);
            
            if (progress < 1) {
                mobileAnimationFrameRef.current = requestAnimationFrame(animate);
            }
        };
        
        if (mobileAnimationFrameRef.current) {
            cancelAnimationFrame(mobileAnimationFrameRef.current);
        }
        
        animate();
        
        return () => {
            if (mobileAnimationFrameRef.current) {
                cancelAnimationFrame(mobileAnimationFrameRef.current);
            }
        };
    }, [isMobileSidebarVisible, canvasWidth, canvasHeight]);

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
    }, [inputText, selectedFont, fontSize, letterSpacing, strokeWidth, selectedNeonColor, generateTextToSVG, updateCanvasSize, animatedLeftSidebarWidth]);


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
                    style={
                        window.innerWidth > 1280 && navigator.maxTouchPoints === 0 
                        ? {
                            left: `calc(${sidebarExpanded ? '250px' : '70px'} + (100vw - min(24vw, 500px) - ${sidebarExpanded ? '250px' : '70px'}) / 2)`,
                            transition: 'left 0.3s ease'
                          }
                        : {
                            left: isMobileSidebarVisible 
                                ? 'calc((100vw - 300px) / 2)'
                                : '50%',
                            transition: shouldAnimateButton ? 'left 0.3s ease' : 'none'
                          }
                    }
                >
                    テキスト画像を保存
                </button>
            </div>


            {/* 右サイドバー */}
            <div className={`text-generator-sidebar ${isMobileSidebarVisible ? '' : 'collapsed'}`}>
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
                        <div className={`triangle ${isMobileSidebarVisible ? 'triangle-down' : 'triangle-up'}`}></div>
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
                            <div className="font-filter-bar">
                                <div className="filter-chips">
                                    <button
                                        className={`filter-chip ${fontFilter === 'all' ? 'active' : ''}`}
                                        onClick={() => setFontFilter('all')}
                                    >
                                        全て
                                    </button>
                                    <button
                                        className={`filter-chip ${fontFilter === '人気' ? 'active' : ''}`}
                                        onClick={() => setFontFilter('人気')}
                                    >
                                        人気
                                    </button>
                                    <button
                                        className={`filter-chip ${fontFilter === '日本語対応' ? 'active' : ''}`}
                                        onClick={() => setFontFilter('日本語対応')}
                                    >
                                        日本語
                                    </button>
                                </div>
                            </div>
                            <div className="font-preview-grid">
                                {getFilteredAndSortedFonts().map((fontItem) => (
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
                    ※ こちらの色はプレビュー用です。実際のご注文時には、ネオン下絵で画像に沿ったネオンパスを描画して、色 / 仕様のカスタマイズで色や太さを細かく指定します。
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