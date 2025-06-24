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

    const fontCategories = {
        '英語フォント - 筆記体・手書き': [
        { name: 'cudi', font: 'Dancing Script, cursive' },
        { name: 'george', font: 'Kaushan Script, cursive' },
        { name: 'pop', font: 'Pacifico, cursive' },
        { name: 'offset', font: 'Sacramento, cursive' },
        { name: 'britney', font: 'Satisfy, cursive' },
        { name: 'jay', font: 'Yellowtail, cursive' },
        { name: 'baby', font: 'Indie Flower, cursive' },
        { name: 'knowles', font: 'Caveat, cursive' },
        { name: 'lana', font: 'Amatic SC, cursive' },
        { name: 'snoop', font: 'Shadows Into Light, cursive' },
        { name: 'travis', font: 'Architects Daughter, cursive' },
        { name: 'quavo', font: 'Griffy, cursive' },
        { name: 'drizzy', font: 'Monoton, cursive' },
        { name: 'robert', font: 'Audiowide, cursive' },
        { name: 'script3', font: 'Courgette, cursive' },
        { name: 'script4', font: 'Leckerli One, cursive' },
        { name: 'script6', font: 'Cookie, cursive' },
        { name: 'script7', font: 'Tangerine, cursive' },
        { name: 'script8', font: 'Handlee, cursive' },
        { name: 'script11', font: 'Nothing You Could Do, cursive' },
        { name: 'script15', font: 'Reenie Beanie, cursive' },
        { name: 'script16', font: 'Arizonia, cursive' },
        { name: 'script19', font: 'Rouge Script, cursive' },
        { name: 'script20', font: 'Marck Script, cursive' },
        { name: 'script21', font: 'Clicker Script, cursive' },
        { name: 'script22', font: 'Mrs Saint Delafield, cursive' },
        { name: 'script25', font: 'Butterfly Kids, cursive' },
        { name: 'script27', font: 'Dawning of a New Day, cursive' },
        { name: 'script29', font: 'Amatic SC, cursive' },
        { name: 'Weekender', font: 'Comfortaa, cursive' },
        { name: 'Neonscript', font: 'Monoton, cursive' },
        { name: 'Photogenic', font: 'Great Vibes, cursive' },
        { name: 'Rocket', font: 'Faster One, cursive' },
        { name: 'Signature', font: 'Allura, cursive' },
        { name: 'Sorrento', font: 'Amatic SC, cursive' },
        { name: 'ClassicType', font: 'Alex Brush, cursive' },
        { name: 'Neo Tokyo', font: 'Orbitron, cursive' },
        { name: 'MONACO', font: 'Sacramento, cursive' },
        { name: 'SIMPLICITY', font: 'Satisfy, cursive' },
        { name: 'Typewriter', font: 'Courier Prime, cursive' },
        { name: 'Majorca', font: 'Satisfy, cursive' },
        { name: 'Manhattan', font: 'Kaushan Script, cursive' },
        { name: 'NEONLITE', font: 'Syncopate, cursive' },
        { name: 'SCIFI', font: 'Audiowide, cursive' },
        { name: 'VANCOUVER', font: 'Caveat, cursive' },
        { name: 'WestCoast', font: 'Surfer, cursive' }
        ],
        '日本語フォント - ベーシック': [
        { name: 'jp1', font: 'Noto Sans JP, sans-serif' },
        { name: 'jp2', font: 'Noto Serif JP, serif' },
        { name: 'jp5', font: 'Kosugi, sans-serif' },
        { name: 'jp6', font: 'Kosugi Maru, sans-serif' }
        ],
        '日本語フォント - 装飾・ポップ': [
        { name: 'jp9', font: 'Hachi Maru Pop, cursive' },
        { name: 'jp10', font: 'Kiwi Maru, cursive' },
        { name: 'jp12', font: 'Stick, sans-serif' },
        { name: 'jp16', font: 'Train One, cursive' }
        ],
        '日本語フォント - ユニーク・伝統': [
        { name: 'jp20', font: 'New Tegomin, serif' },
        { name: 'jp21', font: 'Yomogi, cursive' },
        { name: 'jp24', font: 'Kaisei Opti, serif' }
        ],
        '日本語フォント - ゲーム・未来': [
        { name: 'jp47', font: 'Gamja Flower, cursive' },
        { name: 'jp48', font: 'Shizuru, cursive' }
        ]
    };

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

    // 利用可能なフォント一覧を更新（FontPreviewコンポーネントと同期）
    const availableFonts = [
        'cudi', 'george', 'pop', 'offset', 'britney', 
        'jay', 'baby', 'knowles', 'lana', 'snoop', 'travis', 'quavo', 
        'drizzy', 'robert', 'script3', 
        'script4', 'script6', 'script7', 'script8', 'script11',
        'script15', 'script16', 'script19', 'script20',
        'script21', 'script22', 'script25', 'script27',
        'script29', 'Weekender', 'Neonscript', 'Photogenic', 
        'Rocket', 'Signature', 'Sorrento', 'ClassicType', 
        'Neo Tokyo', 'MONACO', 'SIMPLICITY', 'Typewriter', 
        'Majorca', 'Manhattan', 'NEONLITE', 
        'SCIFI', 'VANCOUVER', 'WestCoast', 'jp1', 'jp2', 'jp5', 'jp6', 
        'jp9', 'jp10', 'jp12', 'jp16', 'jp20', 
        'jp21', 'jp24', 'jp47', 'jp48'
    ];

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
        
        // テキストが空の場合は背景のみ描画して終了
        if (!inputText.trim()) {
            ctx.fillStyle = '#f5f5f5';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            setGeneratedPaths([]);
            return;
        }

        // フォント設定 - フォント名からフォントファミリーを取得
        const fontFamily = getFontFamily(selectedFont);
        ctx.font = `${fontSize}px ${fontFamily}`;
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = strokeWidth;
        
        // 文字間隔の設定
        ctx.letterSpacing = `${letterSpacing}px`;
        
        // テキストの幅を測定
        const textMetrics = ctx.measureText(inputText);
        const textWidth = textMetrics.width + (inputText.length - 1) * letterSpacing;
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
        const startX = (canvas.width - scaledTextWidth) / 2 - 190;
        const startY = canvas.height / 2 + scaledFontSize / 4;
        
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
        ctx.fillText(inputText, unscaledX, unscaledY);
        ctx.restore();
        
        // 簡易的なパス生成
        const paths = [];
        let currentX = startX;
        
        for (let i = 0; i < inputText.length; i++) {
            const char = inputText[i];
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

        const svgData = {
            paths: generatedPaths,
            metadata: {
                originalText: inputText,
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
        const handleResize = () => updateCanvasSize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [updateCanvasSize]);

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
                    <input
                        id="textInput"
                        type="text"
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
                    <div className="font-preview-categories">
                        {Object.entries(fontCategories).map(([categoryName, fonts]) => (
                            <div key={categoryName} className="font-category">
                                <h4 className="category-title">{categoryName}</h4>
                                <div className="font-preview-grid">
                                    {fonts.map((fontItem) => (
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
                                            </div>
                                            <div className="font-name">{fontItem.name}</div>
                                        </div>
                                    ))}
                                </div>
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