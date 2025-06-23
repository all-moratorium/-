import React, { useState, useRef, useCallback, useEffect } from 'react';
import './TextGenerator.css';

const TextGenerator = ({ onNavigateToCustomize }) => {
    const [inputText, setInputText] = useState('');
    const [selectedFont, setSelectedFont] = useState('Arial');
    const [fontSize, setFontSize] = useState(60);
    const [letterSpacing, setLetterSpacing] = useState(0);
    const [strokeWidth, setStrokeWidth] = useState(3);
    const canvasRef = useRef(null);
    const [generatedPaths, setGeneratedPaths] = useState([]);

    // 利用可能なフォント一覧
    const availableFonts = [
        'Arial',
        'Arial Black',
        'Impact',
        'Times New Roman',
        'Georgia',
        'Courier New',
        'Comic Sans MS',
        'Trebuchet MS',
        'Verdana',
        'Helvetica'
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
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            setGeneratedPaths([]);
            return;
        }

        // フォント設定
        ctx.font = `${fontSize}px ${selectedFont}`;
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = strokeWidth;
        
        // 文字間隔の設定
        ctx.letterSpacing = `${letterSpacing}px`;
        
        // テキストの幅を測定
        const textMetrics = ctx.measureText(inputText);
        const textWidth = textMetrics.width + (inputText.length - 1) * letterSpacing;
        const textHeight = fontSize;
        
        // 一定の幅・高さを維持するためのスケール調整
        const targetWidth = canvas.width * 0.6; // キャンバス幅の60%を使用
        const targetHeight = canvas.height * 0.25; // キャンバス高さの25%を使用
        
        // 幅と高さの両方を考慮してスケールを計算
        const scaleByWidth = targetWidth / textWidth;
        const scaleByHeight = targetHeight / textHeight;
        const scale = Math.min(scaleByWidth, scaleByHeight); // 小さい方を採用
        
        // スケールを適用したサイズを計算
        const scaledTextWidth = textWidth * scale;
        const scaledTextHeight = textHeight * scale;
        const scaledFontSize = fontSize * scale;
        
        // センタリング位置を計算（キャンバス全体の真ん中）
        const startX = (canvas.width - scaledTextWidth) / 2;
        const startY = (canvas.height + scaledTextHeight) / 2;
        
        // 背景を描画
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // スケールを適用してテキスト描画
        ctx.save();
        ctx.scale(scale, scale);
        ctx.font = `${fontSize}px ${selectedFont}`;
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = strokeWidth;
        
        // スケール調整された座標でテキストを描画
        const unscaledX = startX / scale;
        const unscaledY = startY / scale;
        ctx.strokeText(inputText, unscaledX, unscaledY);
        ctx.restore();
        
        // 簡易的なパス生成
        const paths = [];
        let currentX = startX;
        
        for (let i = 0; i < inputText.length; i++) {
            const char = inputText[i];
            ctx.font = `${fontSize}px ${selectedFont}`;
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
                <div className="control-group">
                    <label htmlFor="textInput">テキスト入力</label>
                    <input
                        id="textInput"
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="ここにテキストを入力..."
                        className="text-input"
                    />
                </div>

                <div className="control-group">
                    <label htmlFor="fontSelect">フォント選択</label>
                    <select
                        id="fontSelect"
                        value={selectedFont}
                        onChange={(e) => setSelectedFont(e.target.value)}
                        className="font-select"
                    >
                        {availableFonts.map(font => (
                            <option key={font} value={font} style={{ fontFamily: font }}>
                                {font}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="control-group">
                    <label htmlFor="fontSizeSlider">フォントサイズ: {fontSize}px</label>
                    <input
                        id="fontSizeSlider"
                        type="range"
                        min="20"
                        max="200"
                        value={fontSize}
                        onChange={(e) => setFontSize(parseInt(e.target.value))}
                        className="slider"
                    />
                </div>

                <div className="control-group">
                    <label htmlFor="letterSpacingSlider">文字間隔: {letterSpacing}px</label>
                    <input
                        id="letterSpacingSlider"
                        type="range"
                        min="-10"
                        max="50"
                        value={letterSpacing}
                        onChange={(e) => setLetterSpacing(parseInt(e.target.value))}
                        className="slider"
                    />
                </div>

                <div className="control-group">
                    <label htmlFor="strokeWidthSlider">線の太さ: {strokeWidth}px</label>
                    <input
                        id="strokeWidthSlider"
                        type="range"
                        min="1"
                        max="10"
                        value={strokeWidth}
                        onChange={(e) => setStrokeWidth(parseInt(e.target.value))}
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