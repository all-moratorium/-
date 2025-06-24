import React, { useState, useRef, useCallback, useEffect } from 'react';
import './TextGenerator.css';

const TextGenerator = ({ onNavigateToCustomize }) => {
    const [inputText, setInputText] = useState('');
    const [selectedFont, setSelectedFont] = useState('cudi');
    const [fontSize, setFontSize] = useState(60);
    const [letterSpacing, setLetterSpacing] = useState(0);
    const [strokeWidth, setStrokeWidth] = useState(3);
    const canvasRef = useRef(null);
    const [generatedPaths, setGeneratedPaths] = useState([]);
    const textAreaRef = useRef(null);

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
        
        // 一定の幅・高さを維持するためのスケール調整
        const targetWidth = canvas.width * 0.4; // キャンバス幅の40%を使用
        const targetHeight = canvas.height * 0.25; // キャンバス高さの25%を使用
        
        // 幅と高さの両方を考慮してスケールを計算
        const scaleByWidth = targetWidth / textWidth;
        const scaleByHeight = targetHeight / textHeight;
        const scale = Math.min(scaleByWidth, scaleByHeight); // 小さい方を採用
        
        // スケールを適用したサイズを計算
        const scaledTextWidth = textWidth * scale;
        const scaledTextHeight = textHeight * scale;
        const scaledFontSize = fontSize * scale;
        
        // センタリング位置を計算（左寄せ、縦中央）
        const startX = (canvas.width - scaledTextWidth) / 2 - 210;
        const startY = canvas.height / 2 + scaledFontSize / 3;
        
        // 背景を描画
        ctx.fillStyle = '#f5f5f5';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // スケールを適用してテキスト描画
        ctx.save();
        ctx.scale(scale, scale);
        ctx.font = `${fontSize}px ${fontFamily}`;
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = strokeWidth;
        
        // スケール調整された座標でテキストを描画（塗りつぶし）
        const unscaledX = startX / scale;
        const unscaledY = startY / scale;
        ctx.fillStyle = '#333333';
        ctx.fillText(displayText, unscaledX, unscaledY);
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
            </div>

            {/* 右サイドバー */}
            <div className="text-generator-sidebar">
                <div className="text-generator-header">
                    <h2 className="text-generator-title">テキストから生成</h2>
                    <div className="text-generator-guide-button"></div>
                </div>
                <div className="control-group">
                    <label htmlFor="textInput">テキスト入力</label>
                    <textarea
                        ref={textAreaRef}
                        id="textInput"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="✨ ネオンサインにしたいテキストを入力してください"
                        className="text-input"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck="false"
                    />
                </div>

                <div className="font-preview-container">
                    <h3>フォントプレビュー</h3>
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


                <div className="control-group">
                    <label htmlFor="letterSpacingSlider">文字間隔: {letterSpacing}px</label>
                    <input
                        id="letterSpacingSlider"
                        type="range"
                        min="0"
                        max="50"
                        value={letterSpacing}
                        onChange={(e) => setLetterSpacing(parseInt(e.target.value))}
                        className="slider"
                    />
                </div>


                <div className="action-buttons">
                    <button
                        onClick={generateTextToSVG}
                        className="generate-button"
                        disabled={!inputText.trim()}
                    >
                        プレビュー更新
                    </button>
                    <button
                        onClick={sendToCustomize}
                        className="send-to-customize-button"
                        disabled={generatedPaths.length === 0}
                    >
                        カスタマイズページに送る
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TextGenerator;