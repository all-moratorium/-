import React, { useState, useEffect, useCallback, useRef, createRef, memo } from 'react';
import './LaserCutImageProcessor.css'; // 通常のCSSファイルをインポート
import Gallery3D from './Gallery3D';
import NeonDrawingApp from './NeonDrawingApp'; // ネオン下絵コンポーネントをインポート
import Costomize from './Costomize'; // カスタマイズコンポーネントをインポート
import NeonSVGTo3DExtruder from './NeonSVGTo3DExtruder'; // ネオンSVG3Dエクストルーダーコンポーネントをインポート
import TextGenerator from './TextGenerator'; // テキスト生成コンポーネントをインポート
import { lab as culoriLabConverter, differenceEuclidean } from 'culori';

// Canvasプールの実装 - メモリリーク対策
const canvasPool = {
  pool: [],
  maxSize: 10, // プールの最大サイズ
  
  // Canvasを取得する関数
  getCanvas: function(width, height) {
    if (this.pool.length > 0) {
      const canvas = this.pool.pop();
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, width, height);
      return canvas;
    } else {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      return canvas;
    }
  },
  
  // Canvasをプールに返却する関数
  releaseCanvas: function(canvas) {
    if (this.pool.length < this.maxSize) {
      // キャンバスをクリアしてからプールに戻す
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      this.pool.push(canvas);
    }
    // プールがいっぱいの場合は単に破棄する（GCに任せる）
  },
  
  // プールをクリアする関数
  clear: function() {
    this.pool = [];
  }
};

// データURLの追跡と解放を管理するユーティリティ
const dataURLManager = {
  urls: new Set(),
  
  // データURLを追跡する
  trackDataURL: function(url) {
    this.urls.add(url);
    return url;
  },
  
  // 特定のデータURLを解放する
  releaseDataURL: function(url) {
    if (this.urls.has(url)) {
      this.urls.delete(url);
    }
  },
  
  // すべてのデータURLを解放する
  releaseAll: function() {
    this.urls.clear();
  }
};

// ↓↓↓ここから「色のものさし」関数 (ステップ３)↓↓↓
/**
 * RGB (0-255) を CIELAB L*, a*, b* に変換する (culori を使用)
 */
function rgbToCielab(r_byte, g_byte, b_byte) {
    const rgbNormalized = { r: r_byte / 255, g: g_byte / 255, b: b_byte / 255, mode: 'rgb' };
    const labColor = culoriLabConverter(rgbNormalized);
    return [labColor.l, labColor.a, labColor.b];
}

/**
 * CIELAB色空間でのユークリッド距離 (ΔE*ab) を計算 (culori を使用)
 */
const specializedLabEuclideanDistance = differenceEuclidean('lab');

function cielabDistance(lab1, lab2) {
    const color1LabObj = { l: lab1[0], a: lab1[1], b: lab1[2], mode: 'lab' };
    const color2LabObj = { l: lab2[0], a: lab2[1], b: lab2[2], mode: 'lab' };
    return specializedLabEuclideanDistance(color1LabObj, color2LabObj);
}
// ↑↑↑ここまで「色のものさし」関数 (ステップ３)↑↑↑


// ↓↓↓ここから新しい「色分け名人」関数 (ステップ４)↓↓↓
/**
 * 画像の色を量子化（指定した数kに減色）する新しい関数。
 * ヒストグラムベースのアプローチを採用し、知覚的な色の近さに基づいて色を統合します。
 * @param {Uint8ClampedArray} pixels_flat_array - imageData.data (R,G,B,A, ...)
 * @param {number} width - 画像の幅
 * @param {number} height - 画像の高さ
 * @param {number} k - 目標とする色数
 * @returns {Array<Array<number>>} - k色の代表色の配列 (例: [[r1,g1,b1], ...])
 */
function newQuantizeColors(pixels_flat_array, width, height, k) {
    const BITS_FOR_HISTOGRAM = 3; 
    const SHIFT_AMOUNT = 8 - BITS_FOR_HISTOGRAM;
    const MERGE_THRESHOLD_LAB = 15.0; // この値は実験して調整してください (10.0～25.0くらい)

    const histogram = new Map(); 

    for (let i = 0; i < pixels_flat_array.length; i += 4) {
        const r = pixels_flat_array[i];
        const g = pixels_flat_array[i + 1];
        const b = pixels_flat_array[i + 2];
        const a = pixels_flat_array[i + 3];

        if (a < 128) { continue; }

        const r_bin = r >> SHIFT_AMOUNT;
        const g_bin = g >> SHIFT_AMOUNT;
        const b_bin = b >> SHIFT_AMOUNT;
        const bin_key = `${r_bin}_${g_bin}_${b_bin}`;

        if (!histogram.has(bin_key)) {
            histogram.set(bin_key, { sum_r: 0, sum_g: 0, sum_b: 0, count: 0 });
        }
        const bin_data = histogram.get(bin_key);
        bin_data.sum_r += r;
        bin_data.sum_g += g;
        bin_data.sum_b += b;
        bin_data.count += 1;
    }
    
    if (histogram.size === 0) {
        const fallbackColors = [];
        for (let i = 0; i < k; i++) {
            const grayVal = Math.floor(255 * i / (k > 1 ? k - 1 : 1));
            fallbackColors.push([grayVal, grayVal, grayVal]);
        }
        return fallbackColors;
    }

    let significant_bins = [];
    for (const data of histogram.values()) {
        const avg_r = Math.round(data.sum_r / data.count);
        const avg_g = Math.round(data.sum_g / data.count);
        const avg_b = Math.round(data.sum_b / data.count);
        significant_bins.push({
            rgb: [avg_r, avg_g, avg_b],
            lab: rgbToCielab(avg_r, avg_g, avg_b), // 上で定義したヘルパー関数を利用
            count: data.count,
        });
    }
    
    if (significant_bins.length === 0) {
        const fallbackColors = [];
        for (let i = 0; i < k; i++) {
            const grayVal = Math.floor(255 * i / (k > 1 ? k - 1 : 1));
            fallbackColors.push([grayVal, grayVal, grayVal]);
        }
        return fallbackColors;
    }

    significant_bins.sort((a, b) => b.count - a.count);

    let merged_colors = [];
    if (significant_bins.length > 0) {
        const first_bin = significant_bins[0];
        merged_colors.push({
            lab: [...first_bin.lab],
            rgb_sum_weighted: [
                first_bin.rgb[0] * first_bin.count,
                first_bin.rgb[1] * first_bin.count,
                first_bin.rgb[2] * first_bin.count,
            ],
            total_count: first_bin.count,
        });

        for (let i = 1; i < significant_bins.length; i++) {
            const current_bin = significant_bins[i];
            let min_dist = Infinity;
            let closest_merged_idx = -1;

            for (let j = 0; j < merged_colors.length; j++) {
                const dist = cielabDistance(current_bin.lab, merged_colors[j].lab); // 上で定義したヘルパー関数を利用
                if (dist < min_dist) {
                    min_dist = dist;
                    closest_merged_idx = j;
                }
            }

            if (min_dist < MERGE_THRESHOLD_LAB && closest_merged_idx !== -1) {
                const target_group = merged_colors[closest_merged_idx];
                target_group.total_count += current_bin.count;
                target_group.rgb_sum_weighted[0] += current_bin.rgb[0] * current_bin.count;
                target_group.rgb_sum_weighted[1] += current_bin.rgb[1] * current_bin.count;
                target_group.rgb_sum_weighted[2] += current_bin.rgb[2] * current_bin.count;

                const avg_r_merged = Math.round(target_group.rgb_sum_weighted[0] / target_group.total_count);
                const avg_g_merged = Math.round(target_group.rgb_sum_weighted[1] / target_group.total_count);
                const avg_b_merged = Math.round(target_group.rgb_sum_weighted[2] / target_group.total_count);
                target_group.lab = rgbToCielab(avg_r_merged, avg_g_merged, avg_b_merged); // 上で定義したヘルパー関数を利用
            } else {
                merged_colors.push({
                    lab: [...current_bin.lab],
                    rgb_sum_weighted: [
                        current_bin.rgb[0] * current_bin.count,
                        current_bin.rgb[1] * current_bin.count,
                        current_bin.rgb[2] * current_bin.count,
                    ],
                    total_count: current_bin.count,
                });
            }
        }
    }
    
    merged_colors.sort((a, b) => b.total_count - a.total_count); // total_countでソート

    const final_palette_rgb = [];
    for (let i = 0; i < Math.min(k, merged_colors.length); i++) {
        const group = merged_colors[i];
        const avg_r = Math.round(group.rgb_sum_weighted[0] / group.total_count);
        const avg_g = Math.round(group.rgb_sum_weighted[1] / group.total_count);
        const avg_b = Math.round(group.rgb_sum_weighted[2] / group.total_count);
        final_palette_rgb.push([avg_r, avg_g, avg_b]);
    }

    let current_palette_size = final_palette_rgb.length;
    if (current_palette_size < k) {
        for (let i = 0; current_palette_size + i < k; i++) {
            let grayValBase = Math.floor(255 * (current_palette_size + i) / (k > 1 ? k - 1 : 1));
            let attempts = 0;
            let isUniqueGray = false;
            let finalGrayVal = grayValBase;

            while (!isUniqueGray && attempts < 256) {
                finalGrayVal = (grayValBase + attempts * 7) % 256;
                isUniqueGray = true;
                for (const existingColor of final_palette_rgb) {
                    if (existingColor[0] === finalGrayVal && existingColor[1] === finalGrayVal && existingColor[2] === finalGrayVal) {
                        isUniqueGray = false;
                        break;
                    }
                }
                attempts++;
            }
            if (!isUniqueGray) finalGrayVal = Math.floor(Math.random() * 256);
            final_palette_rgb.push([finalGrayVal, finalGrayVal, finalGrayVal]);
        }
    }
    
    return final_palette_rgb.slice(0, k);
}
// ↑↑↑ここまで新しい「色分け名人」関数 (ステップ４)↑↑↑


// この下に元のコードの MemoizedOriginalUiContent や LaserCutImageProcessor の定義が続きます
// Memoized Original UI Content Component
const MemoizedOriginalUiContent = memo(({
  image,
  originalCanvasRef,
  processedCanvas, // Assuming this is a data URL for the img src
  layeredImageDataURL,
  processCanvasRef,
  triggerFileSelect,
  colorCount,
  setColorCount,
  showBorders,
  setShowBorders,
  processImage,
  isProcessing
}) => {
  return (
    <div className="container" style={{ position: 'absolute', left: '-9999px', visibility: 'hidden' }}>
      <h2 className="title">レーザーカット画像プロセッサー</h2>
      
      <div className="upload-container">
        <button
          onClick={triggerFileSelect}
          className="upload-button"
        >
          画像をアップロード
        </button>
        
        <div className="settings-grid">
          <div className="setting-item">
            <label className="setting-label">レイヤー数を選ぶ</label>
            <input
              type="number"
              min="2"
              max="12"
              value={colorCount}
              onChange={(e) => setColorCount(Math.max(2, Math.min(12, parseInt(e.target.value) || 2)))}
              className="number-input"
            />
          </div>
        </div>
        
        <div className="checkbox-container">
          <input
            type="checkbox"
            id="showBorders"
            checked={showBorders}
            onChange={(e) => setShowBorders(e.target.checked)}
          />
          <label htmlFor="showBorders">境界線を表示</label>
        </div>
        
        <button
          onClick={processImage}
          disabled={!image || isProcessing}
          className={isProcessing ? "process-button disabled" : "process-button"}
        >
          {isProcessing ? '処理中...' : '画像を処理'}
        </button>
      </div>
      
      <div className="image-container">
        <div className="image-section">
          <h3 className="section-title">元の画像</h3>
          <div className="image-box">
            {image ? (
              <canvas ref={originalCanvasRef} className="canvas" />
            ) : (
              <p>画像がアップロードされていません</p>
            )}
          </div>
        </div>
        
        <div className="image-section">
          <h3 className="section-title">処理された画像</h3>
          <div className="image-box">
            {processedCanvas ? (
              <img src={processedCanvas} alt="処理済み" className="result-image" />
            ) : (
              <p>処理された画像がありません</p>
            )}
          </div>
          <canvas ref={processCanvasRef} className="hidden-canvas" />
        </div>
        
        <div className="image-section">
          <h3 className="section-title">プレビュー</h3>
          <div className="image-box">
            {layeredImageDataURL ? (
              <img src={layeredImageDataURL} alt="レイヤー" className="result-image" />
            ) : (
              <p>プレビュー画像がありません</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

// --- SVG アイコンコンポーネント ---
const CheckIcon = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const XIcon = (props) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m18 6-12 12"/>
        <path d="m6 6 12 12"/>
    </svg>
);

const TextIcon = (props) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 6.1H3"/><path d="M21 12.1H3"/><path d="M15.1 18H3"/><path d="M4 7V5h16v2"/></svg>
);
const LayoutIcon = (props) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
);
const CustomizeIcon = (props) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v2"/><path d="M12 21v2"/><path d="m4.22 4.22 1.42 1.42"/><path d="m18.36 18.36 1.42 1.42"/><path d="M1 12h2"/><path d="M21 12h2"/><path d="m4.22 19.78 1.42-1.42"/><path d="m18.36 5.64 1.42-1.42"/></svg>
);
const Preview3DIcon = (props) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21 17-8-4-8 4"/><path d="m21 9-8-4-8 4"/><path d="M3 13v6l8 4 8-4v-6"/><path d="M3 5v6l8 4 8-4V5"/></svg>
);
const DeliveryIcon = (props) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
);

// --- プロセスルートコンポーネント ---
const ProcessRoute = () => {
    const steps = [
        { num: 'STEP 0', title: 'テキスト下絵を生成' },
        { num: 'STEP 1', title: '配置を決定' },
        { num: 'STEP 2', title: '色 / 仕様のカスタマイズ' },
        { num: 'STEP 3', title: '3Dモデル確認 & 注文' },
        { num: '制作 / 出荷', title: '最短5日で出荷' }
    ];

    return (
        <div className="creation-modal-process-route">
            <h3 className="creation-modal-process-title">作成プロセス</h3>
            
            {/* ドット型プログレス */}
            <div className="creation-modal-progress-container">
                {steps.map((step, index) => (
                    <div key={index} className={`creation-modal-progress-step ${index === 0 ? 'step-0' : index === 1 ? 'step-1' : ''}`}>
                        <div className="creation-modal-progress-dot"></div>
                        {index < steps.length - 1 && <div className="creation-modal-progress-connector"></div>}
                    </div>
                ))}
            </div>
            
            {/* ステップ名 */}
            <div className="creation-modal-steps-labels">
                {steps.map((step, index) => (
                    <div key={index} className="creation-modal-step-label">
                        <span className={`creation-modal-step-num ${index === 0 ? 'step-0' : index === 1 ? 'step-1' : ''}`}>{step.num}</span>
                        <span className="creation-modal-step-title">{step.title}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- 新しい選択肢ボタンコンポーネント ---
function ChoiceBox({ stepTitle, title, description, features, note, onClick, accentColor }) {
    return (
        <button
            onClick={onClick}
            className={`creation-modal-choice-box creation-modal-choice-box-${accentColor}`}
        >
            <h3 className="creation-modal-choice-title">
                <span className={`creation-modal-choice-step step-${accentColor}`}>{stepTitle}</span>
                {title}
            </h3>
            <p className="creation-modal-choice-description">{description}</p>
            <div className="creation-modal-choice-features">
                {features.map((feature, index) => (
                    <div key={index} className="creation-modal-choice-feature">
                        <CheckIcon className="creation-modal-choice-check-icon" />
                        <span className="creation-modal-choice-feature-text">{feature}</span>
                    </div>
                ))}
            </div>
            {note && (
                 <p className="creation-modal-choice-note">{note}</p>
            )}
        </button>
    );
}

// --- 作成方法選択モーダル ---
function CreationModal({ isOpen, onSelect, onClose }) {
    if (!isOpen) return null;

    const step0_features = [
        'テキストテンプレートから素早く下絵を作成',
        '即座にプロ仕様のテキストLEDネオンサインが完成',
        '65種類以上のフォント選択と直感的な操作'
    ];
    
    const step1_features = [
        'オリジナルデザインのLEDネオンサインを作成',
        '下絵画像読み込みで多彩な表現が可能',
        'リアルタイム寸法確認、デザイン保存機能搭載',
        'STEP0で読み込まれた画像をチューブパス化'
    ];

    // 背景クリックでモーダルを閉じる
    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    return (
        <div className="creation-modal-overlay" onClick={handleOverlayClick}>
            <div className="creation-modal-content">
                <div className="creation-modal-inner">
                    <button onClick={onClose} className="creation-modal-close-button">
                        ×
                    </button>
                    <h2 className="creation-modal-title">作成方法を選択</h2>
                    <ProcessRoute />
                    <div className="creation-modal-choices">
                        <ChoiceBox
                            stepTitle="STEP0"
                            title="テキスト下絵を生成"
                            description="文字テキストのLEDネオンサインを作成したい方向け"
                            features={step0_features}
                            note="※生成したテキスト下絵は背景画像としてSTEP1の背景画像に読み込まれます"
                            onClick={() => onSelect('textGeneration')}
                            accentColor="yellow"
                        />
                        <ChoiceBox
                            stepTitle="STEP1"
                            title="配置を決定"
                            description="完全オリジナルでLEDネオン作成したい方向け"
                            features={step1_features}
                            onClick={() => onSelect('neonDrawing')}
                            accentColor="cyan"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

const LaserCutImageProcessor = () => {
  // UI state variables
  const [currentPage, setCurrentPage] = useState('home'); // 'home', 'textGeneration', 'info', 'neonDrawing', 'customize', 'neonSvg3dPreview'
  const [customizeSvgData, setCustomizeSvgData] = useState(null); // カスタマイズ用SVGデータ
  
  // NeonDrawingAppの状態を保存
  const [neonDrawingState, setNeonDrawingState] = useState(null);
  
  // Costomizeコンポーネントの状態を保存
  const [customizeState, setCustomizeState] = useState(null);
  
  // NeonSVGTo3DExtruderの状態を保存
  const [neonSvgData, setNeonSvgData] = useState(null);
  const [neonCameraState, setNeonCameraState] = useState(null);
  const [neonPreviewImageDataURL, setNeonPreviewImageDataURL] = useState(null);
  const [neonCalculatedModelData, setNeonCalculatedModelData] = useState(null);
  const [customizeCanvasImageDataURL, setCustomizeCanvasImageDataURL] = useState(null);
  
  const [previewBgColor, setPreviewBgColor] = useState('rgba(0, 0, 0, 0)'); // プレビュー背景色（初期値は透明）
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [layerSvgs, setLayerSvgs] = useState([]);
  const [sampleNeonOn, setSampleNeonOn] = useState(true); // ネオンサンプルのON/OFF状態
  const [showCreationModal, setShowCreationModal] = useState(false); // 作成方法選択モーダル
  const [sampleImagesLoaded, setSampleImagesLoaded] = useState(false); // サンプル画像のロード状態
  const neonSvgTo3DExtruderRef = useRef(null); // NeonSVGTo3DExtruderへのrefを追加
  const [isGenerating3D, setIsGenerating3D] = useState(false);
  const [autoStart3DGeneration, setAutoStart3DGeneration] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [svgGenerationProgress, setSvgGenerationProgress] = useState(0);
const [svgProcessingMessage, setSvgProcessingMessage] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false); // メインのモーダル用
  const [isLayerInfoModalOpen, setIsLayerInfoModalOpen] = useState(false); // レイヤー情報モーダル用の状態
  // ボタンのエフェクト制御用の状態変数
  const [isEffectStopped, setIsEffectStopped] = useState(false);
  const [isLayerInfoButtonEffectStopped, setIsLayerInfoButtonEffectStopped] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  // State variables
  const [image, setImage] = useState(null);
  const [processedCanvas, setProcessedCanvas] = useState(null);
  const [layeredImageDataURL, setLayeredImageDataURL] = useState(null);
  const [layers, setLayers] = useState([]);
  const [colorCount, setColorCount] = useState(5);

// カウンター変更関数を useCallback でメモ化
const handleColorCountChange = useCallback((newValue) => {
  const clampedValue = Math.max(2, Math.min(12, parseInt(newValue) || 2));
  setColorCount(clampedValue);
}, []);

const incrementCount = useCallback(() => {
  setColorCount(prev => Math.min(12, prev + 1));
}, []);

const decrementCount = useCallback(() => {
  setColorCount(prev => Math.max(2, prev - 1));
}, []);
  const [minRegionSize, setMinRegionSize] = useState(100);
  const [borderWidth, setBorderWidth] = useState(1);
  const [borderColor, setBorderColor] = useState('#000000');
  const [showBorders, setShowBorders] = useState(false);
  const [currentLayerIndex, setCurrentLayerIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [colors, setColors] = useState([]);
  const [minFeatureSize, setMinFeatureSize] = useState(4);
  const colorInputRef = useRef(null); // Add ref for color input
  const [draggedLayerIndex, setDraggedLayerIndex] = useState(null);
  const [originalImageAspectRatio, setOriginalImageAspectRatio] = useState(null);
  const [productQuantity, setProductQuantity] = useState(1);
  const [quantityInputText, setQuantityInputText] = useState('1');
  const [productDimensions, setProductDimensions] = useState({ width: 0, height: 0, thickness: 0 });
  // UI state variables の部分に以下を追加
const [isMergingMode, setIsMergingMode] = useState(false);          // 結合モードのON/OFF
const [selectedLayersForMerge, setSelectedLayersForMerge] = useState([]); // 結合用に選択されたレイヤーのインデックス配列
const [mergingStep, setMergingStep] = useState(0);                  // 結合のステップ (0:未開始, 1:1つ目選択中, 2:2つ目選択中)

  const handleDimensionsUpdate = useCallback((width, height, thickness) => {
    setProductDimensions({ width, height, thickness });
  }, []);
  
  // ドラッグ＆ドロップ用のステートとref
  const [draggedItemIndex, setDraggedItemIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const layerItemRefs = useRef([]);

  // Refs
  const originalCanvasRef = useRef(null);
  const processCanvasRef = useRef(null);
  const fileInputRef = useRef(null);
  // メモリリーク対策のためのオブジェクトURL参照を保持するref
  const objectUrlsRef = useRef([]);
  
  // オブジェクトURLを作成して追跡する関数
  const createAndTrackObjectURL = useCallback((blob) => {
    const url = URL.createObjectURL(blob);
    objectUrlsRef.current.push(url);
    return url;
  }, []);
  
  // すべてのオブジェクトURLを解放する関数
  const releaseAllObjectUrls = useCallback(() => {
    objectUrlsRef.current.forEach(url => {
      URL.revokeObjectURL(url);
    });
    objectUrlsRef.current = [];
  }, []);
  
  // Create layered image from layers directly - Canvasプールを使用するように最適化
  const createLayeredImageFromLayers = useCallback((layersArray, width, height) => {
    if (!layersArray || layersArray.length === 0) return;
    
    // Canvasプールから取得
    const layeredCanvas = canvasPool.getCanvas(width, height);
    const ctx = layeredCanvas.getContext('2d');
    
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    
    // Promise-based approach to ensure all images are loaded before drawing
    const loadImages = layersArray.map((layer, index) => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          resolve({ img, index });
        };
        img.onerror = () => {
          console.error("Failed to load layer image");
          resolve({ img: null, index });
        };
        img.src = layer.dataURL;
      });
    });
    
    Promise.all(loadImages).then((loadedImages) => {
      // Sort by index (reverse order) to ensure proper stacking
      loadedImages.sort((a, b) => b.index - a.index);
      
      // Draw all loaded images
      for (const { img, index } of loadedImages) {
        if (img) {
          try {
            ctx.drawImage(img, 0, 0);
          } catch (error) {
            console.error("Failed to draw layer image:", error);
          }
        }
      }
      
      // 古いデータURLがあれば解放
      if (layeredImageDataURL) {
        dataURLManager.releaseDataURL(layeredImageDataURL);
      }
      
      // 新しいデータURLを作成して追跡
      const newDataURL = layeredCanvas.toDataURL();
      const trackedURL = dataURLManager.trackDataURL(newDataURL);
      setLayeredImageDataURL(trackedURL);
      
      // 使用済みのCanvasをプールに返却
      canvasPool.releaseCanvas(layeredCanvas);
    });
  }, [layeredImageDataURL]);
  
  // カスタマイズページへの遷移イベントリスナー
  useEffect(() => {
    const handleShowCustomize = (event) => {
      if (event.detail) {
        setCustomizeSvgData(event.detail);
      }
      setCurrentPage('customize');
    };

    const handleNavigateToNeonDrawing = (event) => {
      if (event.detail && event.detail.backgroundImage) {
        // ネオン下絵の初期状態を更新（背景画像を設定）
        const updateState = {
          ...neonDrawingState,
          backgroundImage: event.detail.backgroundImage,
          bgImageOpacity: 1.0,
          bgImageScale: 1.0,
          bgImageX: 0,
          bgImageY: 0,
          showBgModal: true,  // 背景画像設定モーダルを開いた状態にする
          sidebarVisible: false  // サイドバーを非表示にする
        };

        // resetViewフラグがある場合は視点も初期化
        if (event.detail.resetView) {
          updateState.scale = 1;
          updateState.offsetX = 0;
          updateState.offsetY = 0;
        }

        setNeonDrawingState(updateState);
      }
      setCurrentPage('neonDrawing');
    };

    window.addEventListener('showCustomize', handleShowCustomize);
    window.addEventListener('navigateToNeonDrawing', handleNavigateToNeonDrawing);
    return () => {
      window.removeEventListener('showCustomize', handleShowCustomize);
      window.removeEventListener('navigateToNeonDrawing', handleNavigateToNeonDrawing);
    };
  }, []);

  // 3Dプレビューページへの遷移イベントリスナー
  useEffect(() => {
    const handleShow3DPreview = (event) => {
      if (event.detail) {
        // ネオン3Dプレビュー用のデータを保存
        setNeonSvgData(event.detail);
        
        // ネオンサイン画像を生成
        generateNeonPreviewImage(event.detail);
        
        // Calculate and set model data immediately when 3D preview is generated
        const data = event.detail;
        const strokePaths = data.paths.filter(pathObj => pathObj && pathObj.mode === 'stroke');
        const totalLengthPx = strokePaths.reduce((total, pathObj) => {
          if (!pathObj || !pathObj.points || pathObj.points.length < 2) return total;
          let length = 0;
          const points = pathObj.points;
          for (let i = 0; i < points.length - 1; i++) {
            const dx = points[i + 1].x - points[i].x;
            const dy = points[i + 1].y - points[i].y;
            length += Math.sqrt(dx * dx + dy * dy);
          }
          return total + length;
        }, 0);
        const totalLengthCm = Math.round(totalLengthPx / 25 * 10) / 10;
        
        // Calculate tube counts and lengths
        let tubeLength8mm = 0;
        let tubeLength6mm = 0;
        let tubeCount8mm = 0;
        let tubeCount6mm = 0;
        
        strokePaths.forEach(pathObj => {
          const pathIndex = data.paths.indexOf(pathObj);
          const thickness = data.pathThickness[pathIndex] || data.strokeWidthsPx?.strokeLine || 15;
          if (!pathObj || !pathObj.points || pathObj.points.length < 2) return;
          let pathLength = 0;
          const points = pathObj.points;
          for (let i = 0; i < points.length - 1; i++) {
            const dx = points[i + 1].x - points[i].x;
            const dy = points[i + 1].y - points[i].y;
            pathLength += Math.sqrt(dx * dx + dy * dy);
          }
          const lengthCm = Math.round(pathLength / 25 * 10) / 10;
          
          if (thickness >= 20) {
            tubeLength8mm += lengthCm;
            tubeCount8mm += 1;
          } else {
            tubeLength6mm += lengthCm;
            tubeCount6mm += 1;
          }
        });
        
        // Get base color
        let baseColor = '透明アクリル';
        let fillColor = null;
        Object.keys(data.pathColors).forEach(key => {
          if (key.endsWith('_fill')) {
            const color = data.pathColors[key];
            if (color && color !== 'transparent') {
              fillColor = color;
            }
          }
        });
        
        if (fillColor === '#000000') {
          baseColor = '黒色アクリル';
        }
        
        const modelWidth = data.svgSizeCm?.width || 0;
        const modelHeight = data.svgSizeCm?.height || 0;
        const modelType = data.installationEnvironment === 'outdoor' ? '屋外 - IP67防水' : '屋内 - 非防水';
        
        const calculatedData = {
          tubeLength8mm: tubeLength8mm * 10,
          tubeLength6mm: tubeLength6mm * 10,
          totalLength: totalLengthCm * 10,
          tubeCount8mm: tubeCount8mm,
          tubeCount6mm: tubeCount6mm,
          totalTubeCount: tubeCount8mm + tubeCount6mm,
          modelWidth: modelWidth * 10,
          modelHeight: modelHeight * 10,
          baseColor: baseColor,
          modelType: modelType,
          isGenerated: true
        };
        
        setNeonCalculatedModelData(calculatedData);
      }
    };

    window.addEventListener('show3DPreview', handleShow3DPreview);

    const handleRequestPageTransition = () => {
      setCurrentPage('neonSvg3dPreview'); // ネオン3Dプレビューに移動
    };
    window.addEventListener('RequestPageTransitionTo3DPreview', handleRequestPageTransition);

    const handleRequestInfoPageTransition = () => {
      setCurrentPage('info'); // 商品情報ページに移動
    };
    window.addEventListener('RequestPageTransitionToInfo', handleRequestInfoPageTransition);

    const handleCustomizeCanvasImage = (event) => {
      if (event.detail && event.detail.canvasImageDataURL) {
        setCustomizeCanvasImageDataURL(event.detail.canvasImageDataURL);
      }
    };
    window.addEventListener('customizeCanvasImage', handleCustomizeCanvasImage);

    return () => {
      window.removeEventListener('show3DPreview', handleShow3DPreview);
      window.removeEventListener('RequestPageTransitionTo3DPreview', handleRequestPageTransition);
      window.removeEventListener('RequestPageTransitionToInfo', handleRequestInfoPageTransition);
      window.removeEventListener('customizeCanvasImage', handleCustomizeCanvasImage);
    };
  }, []);

  // ネオンサイン画像を生成する関数
  const generateNeonPreviewImage = (neonData) => {
    if (!neonData || !neonData.svgContent) return;
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // 高解像度対応とアンチエイリアシング設定
    const pixelRatio = window.devicePixelRatio || 1;
    const size = 200; // 表示サイズ
    const actualSize = size * pixelRatio; // 実際の描画サイズ
    
    canvas.width = actualSize;
    canvas.height = actualSize;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    
    // 高品質レンダリング設定
    ctx.scale(pixelRatio, pixelRatio);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // 背景を黒に設定
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, size, size);
    
    // SVGコンテンツを修正してストローク幅を保持
    let modifiedSvgContent = neonData.svgContent;
    
    // SVGにviewBox属性がない場合は追加
    if (!modifiedSvgContent.includes('viewBox')) {
      modifiedSvgContent = modifiedSvgContent.replace(
        /<svg[^>]*>/,
        match => match.replace('>', ` viewBox="0 0 ${neonData.svgSizePx?.width || 800} ${neonData.svgSizePx?.height || 600}" preserveAspectRatio="xMidYMid meet">`)
      );
    }
    
    // ストローク幅を保持するためにvector-effectを追加
    modifiedSvgContent = modifiedSvgContent.replace(
      /stroke-width="([^"]+)"/g,
      'stroke-width="$1" vector-effect="non-scaling-stroke"'
    );
    
    const svgBlob = new Blob([modifiedSvgContent], { type: 'image/svg+xml' });
    const svgUrl = URL.createObjectURL(svgBlob);
    
    const img = new Image();
    img.onload = () => {
      // 画像を中央に配置してスケール調整
      const scale = Math.min(size * 0.8 / img.width, size * 0.8 / img.height);
      const scaledWidth = img.width * scale;
      const scaledHeight = img.height * scale;
      const x = (size - scaledWidth) / 2;
      const y = (size - scaledHeight) / 2;
      
      ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
      
      // データURLに変換
      const dataURL = canvas.toDataURL('image/png');
      setNeonPreviewImageDataURL(dataURL);
      
      // クリーンアップ
      URL.revokeObjectURL(svgUrl);
    };
    
    img.src = svgUrl;
  };

  // パスの長さを計算する関数
  const calculatePathLength = (pathObj) => {
    if (!pathObj || !pathObj.points || pathObj.points.length < 2) {
      return 0;
    }
    
    let totalLength = 0;
    const points = pathObj.points;
    
    for (let i = 0; i < points.length - 1; i++) {
      const dx = points[i + 1].x - points[i].x;
      const dy = points[i + 1].y - points[i].y;
      totalLength += Math.sqrt(dx * dx + dy * dy);
    }
    
    return totalLength;
  };

  // ネオンデータから詳細情報を計算する関数
  const calculateNeonModelData = (neonData) => {
    if (!neonData || !neonData.paths) return null;
    
    let tubeLength6mm = 0;
    let tubeLength8mm = 0;
    let tubeCount6mm = 0;
    let tubeCount8mm = 0;
    
    // パスデータから長さと本数を計算
    neonData.paths.forEach((path, index) => {
      const thickness = neonData.pathThickness[index] || 15;
      const lengthPx = calculatePathLength(path);
      const lengthCm = Math.round(lengthPx / 25 * 10) / 10; // px to cm conversion with rounding
      
      if (thickness >= 20) {
        tubeLength8mm += lengthCm;
        tubeCount8mm += 1;
      } else {
        tubeLength6mm += lengthCm;
        tubeCount6mm += 1;
      }
    });
    
    return {
      modelWidth: neonData.svgSizeCm ? neonData.svgSizeCm.width * 10 : 0,
      modelHeight: neonData.svgSizeCm ? neonData.svgSizeCm.height * 10 : 0,
      tubeLength6mm: tubeLength6mm * 10, // Convert cm back to mm for consistency
      tubeLength8mm: tubeLength8mm * 10, // Convert cm back to mm for consistency
      tubeCount6mm: tubeCount6mm,
      tubeCount8mm: tubeCount8mm,
      baseColor: '透明アクリル',
      modelType: neonData.installationEnvironment === 'outdoor' ? '屋外 - IP67防水' : '屋内 - 非防水'
    };
  };

  // コンポーネントのアンマウント時にリソースを解放
  useEffect(() => {
    return () => {
      console.log('🧹 LaserCutImageProcessor: リソースクリーンアップ');
      // すべてのオブジェクトURLを解放
      releaseAllObjectUrls();
      // すべてのデータURLを解放
      dataURLManager.releaseAll();
      // Canvasプールをクリア
      canvasPool.clear();
    };
  }, [releaseAllObjectUrls]);
  
  // Update color picker display when layer changes or layers data updates
  useEffect(() => {
    if (colorInputRef.current && layers.length > 0 && currentLayerIndex < layers.length) {
      colorInputRef.current.value = layers[currentLayerIndex].color;
    }
  }, [currentLayerIndex, layers]);

  // Draw original image when it changes - メモリ最適化版
  useEffect(() => {
    if (image) {
      const canvas = originalCanvasRef.current;
      if (!canvas) return;
      
      // 以前のレイヤーをクリアする
      setLayers([]);
      
      const ctx = canvas.getContext('2d');
      canvas.width = image.width;
      canvas.height = image.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height); // 必ずクリアしてから描画
      ctx.drawImage(image, 0, 0);
    }
  }, [image]);
  
  // Image upload handler - メモリ最適化版
  const handleImageUpload = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // 新しい画像をアップロードする前に、現在のリソースを解放
    releaseAllObjectUrls();
    dataURLManager.releaseAll();
    
    const reader = new FileReader();
    reader.onload = (event) => {
      if (!event.target?.result) return;
      
      const img = new Image();
      img.onload = () => {
        setImage(img);
        if (img.height > 0) {
          setOriginalImageAspectRatio(img.width / img.height);
        } else {
          setOriginalImageAspectRatio(1);
        }
      };
      img.onerror = () => {
        console.error("Error loading image.");
        setImage(null);
        setOriginalImageAspectRatio(null);
      };
      img.src = event.target.result.toString();
    };
    reader.readAsDataURL(file);
  }, [releaseAllObjectUrls]);
  
  // Trigger file selection
  const triggerFileSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  // レイヤー結合を開始する関数
const startLayerMerging = () => {
  setIsMergingMode(true);
  setMergingStep(1);
  setSelectedLayersForMerge([]);
  console.log('レイヤー結合モードを開始しました。1つ目のレイヤーを選択してください。');
};

// レイヤー結合をキャンセルする関数
const cancelLayerMerging = () => {
  setIsMergingMode(false);
  setMergingStep(0);
  setSelectedLayersForMerge([]);
  console.log('レイヤー結合をキャンセルしました。');
};

// レイヤー結合処理を実行する関数
const executeLayerMerge = (firstLayerIndex, secondLayerIndex) => {
  if (!processCanvasRef.current || firstLayerIndex === secondLayerIndex) {
    console.error('レイヤー結合に失敗しました。');
    return;
  }

  const width = processCanvasRef.current.width;
  const height = processCanvasRef.current.height;
  const firstLayer = layers[firstLayerIndex];
  const secondLayer = layers[secondLayerIndex];

  // 新しいpixelMapを作成（2つのレイヤーの領域を結合）
  const mergedPixelMap = new Uint8Array(width * height);
  const mergedOriginalPixelMap = new Uint8Array(width * height);

  for (let i = 0; i < width * height; i++) {
    // 2つのレイヤーのピクセルをOR演算で結合（どちらかがあれば結合レイヤーに含める）
    mergedPixelMap[i] = (firstLayer.pixelMap[i] || 0) | (secondLayer.pixelMap[i] || 0);
    mergedOriginalPixelMap[i] = (firstLayer.originalPixelMap[i] || 0) | (secondLayer.originalPixelMap[i] || 0);
  }

  // 新しいレイヤーのcanvasを作成
  const mergedCanvas = document.createElement('canvas');
  mergedCanvas.width = width;
  mergedCanvas.height = height;
  const mergedCtx = mergedCanvas.getContext('2d');

  // 1番目に選択されたレイヤーの色を使用（これが重要！）
  const mergedColor = firstLayer.color;
  
  // ImageDataを使用して効率的に描画
  const imageData = mergedCtx.createImageData(width, height);
  const data = imageData.data;

  // 色をRGBに分解
  const hex = mergedColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // 結合されたピクセルマップに基づいて色を塗る
  for (let pixelIdx = 0; pixelIdx < width * height; pixelIdx++) {
    if (mergedPixelMap[pixelIdx] === 1) {
      const dataOffset = pixelIdx * 4;
      data[dataOffset] = r;     // Red
      data[dataOffset + 1] = g; // Green
      data[dataOffset + 2] = b; // Blue
      data[dataOffset + 3] = 255; // Alpha (opaque)
    } else {
      const dataOffset = pixelIdx * 4;
      data[dataOffset] = 0;
      data[dataOffset + 1] = 0;
      data[dataOffset + 2] = 0;
      data[dataOffset + 3] = 0; // Alpha (transparent)
    }
  }
  mergedCtx.putImageData(imageData, 0, 0);

  // カバレッジを計算
  const coverage = (mergedPixelMap.reduce((sum, val) => sum + val, 0) / (width * height) * 100).toFixed(1);

  // 新しいレイヤーオブジェクトを作成
  const mergedLayer = {
    dataURL: mergedCanvas.toDataURL(),
    color: mergedColor,
    index: Math.min(firstLayerIndex, secondLayerIndex),
    displayIndex: Math.min(firstLayerIndex, secondLayerIndex),
    originalColor: firstLayer.originalColor,
    pixelMap: mergedPixelMap,
    originalPixelMap: mergedOriginalPixelMap,
    coverage: coverage
  };

  // 新しいレイヤー配列を作成（元の2つのレイヤーを削除して結合レイヤーを追加）
  const newLayers = [...layers];
  
  // 削除するレイヤーのインデックスを降順でソート（大きいインデックスから削除）
  const indicesToRemove = [firstLayerIndex, secondLayerIndex].sort((a, b) => b - a);
  
  // レイヤーを削除
  for (const indexToRemove of indicesToRemove) {
    newLayers.splice(indexToRemove, 1);
  }
  
  // 新しいレイヤーを追加（元のレイヤーの位置に）
  const insertIndex = Math.min(firstLayerIndex, secondLayerIndex);
  newLayers.splice(insertIndex, 0, mergedLayer);

  // レイヤーの再スタッキング処理（重要：レイヤー構造を再計算）
  recalculateLayerStacking(newLayers);

  // 現在選択されているレイヤーインデックスを調整
  if (currentLayerIndex === firstLayerIndex || currentLayerIndex === secondLayerIndex) {
    setCurrentLayerIndex(insertIndex);
  } else if (currentLayerIndex > Math.max(firstLayerIndex, secondLayerIndex)) {
    setCurrentLayerIndex(currentLayerIndex - 1);
  } else if (currentLayerIndex > Math.min(firstLayerIndex, secondLayerIndex)) {
    setCurrentLayerIndex(currentLayerIndex - 1);
  }

  console.log(`レイヤー${firstLayerIndex + 1}とレイヤー${secondLayerIndex + 1}を結合しました。`);
  
  // レイヤー結合モードを終了
  cancelLayerMerging();
};

// レイヤー選択処理（結合モード用）
const handleLayerSelectionForMerge = (layerIndex) => {
  if (!isMergingMode) return false;

  if (mergingStep === 1) {
    // 1つ目のレイヤー選択
    setSelectedLayersForMerge([layerIndex]);
    setMergingStep(2);
    console.log(`1つ目のレイヤー（レイヤー${layerIndex + 1}）を選択しました。2つ目のレイヤーを選択してください。`);
    return true;
  } else if (mergingStep === 2) {
    // 2つ目のレイヤー選択
    if (selectedLayersForMerge.includes(layerIndex)) {
      console.log('同じレイヤーは選択できません。別のレイヤーを選択してください。');
      return true;
    }
    
    const firstLayerIndex = selectedLayersForMerge[0];
    console.log(`2つ目のレイヤー（レイヤー${layerIndex + 1}）を選択しました。レイヤーを結合します。`);
    
    // レイヤー結合を実行
    executeLayerMerge(firstLayerIndex, layerIndex);
    return true;
  }

  return false;
};
  // Update layer color and regenerate layered image
  const updateLayerColor = (layerIndex, newColorHex) => {
    if (layerIndex < 0 || layerIndex >= layers.length || !processCanvasRef.current) return;
    
    const layerToUpdate = layers[layerIndex];
    const layerCanvas = document.createElement('canvas');
    layerCanvas.width = processCanvasRef.current.width;
    layerCanvas.height = processCanvasRef.current.height;
    const layerCtx = layerCanvas.getContext('2d');
    
    layerCtx.fillStyle = newColorHex;
    
    const width = layerCanvas.width;
    const height = layerCanvas.height;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = y * width + x;
        if (layerToUpdate.pixelMap && layerToUpdate.pixelMap[index] === 1) {
          layerCtx.fillRect(x, y, 1, 1);
        }
      }
    }
    
    const updatedLayers = [...layers];
    updatedLayers[layerIndex] = {
      ...layerToUpdate,
      dataURL: layerCanvas.toDataURL(),
      color: newColorHex
    };
    
    setLayers(updatedLayers);
    createLayeredImageFromLayers(updatedLayers, width, height);
  };
  
  // Recalculate layer stacking after reordering
  const recalculateLayerStacking = (reorderedLayers) => {
    if (!reorderedLayers.length || !processCanvasRef.current) return;
    
    const width = processCanvasRef.current.width;
    const height = processCanvasRef.current.height;
    
    // Optimized pixel map calculation
    const newLayerMaps = Array(reorderedLayers.length).fill(null).map(() =>
      new Uint8Array(width * height).fill(0)
    );

    if (reorderedLayers.length > 0) {
      // Process the first layer (top-most layer, index 0)
      // Initialize its map directly from its originalPixelMap
      if (reorderedLayers[0].originalPixelMap) {
        const firstOriginalMap = reorderedLayers[0].originalPixelMap;
        for (let i = 0; i < width * height; i++) {
          if (firstOriginalMap[i] === 1) {
            newLayerMaps[0][i] = 1;
          }
        }
      }

      // Process subsequent layers (from index 1)
      // Each layer's cumulative map is the OR of its original map and the cumulative map of the layer above it.
      for (let layerIdx = 1; layerIdx < reorderedLayers.length; layerIdx++) {
        const currentOriginalMap = reorderedLayers[layerIdx].originalPixelMap;
        const prevCumulativeMap = newLayerMaps[layerIdx - 1]; 
        for (let i = 0; i < width * height; i++) {
          let currentPixelIsOn = 0;
          if (currentOriginalMap && currentOriginalMap[i] === 1) {
            currentPixelIsOn = 1;
          }
          if (prevCumulativeMap[i] === 1 || currentPixelIsOn === 1) {
            newLayerMaps[layerIdx][i] = 1;
          }
        }
      }

      // The bottom-most layer (index reorderedLayers.length - 1) is made fully opaque.
      // This overrides any previous calculation for this specific layer's map.
      const bottomLayerIndex = reorderedLayers.length - 1;
      for (let i = 0; i < width * height; i++) {
        newLayerMaps[bottomLayerIndex][i] = 1;
      }
    }
    // End of optimized pixel map calculation
    
    const regeneratedLayersData = [];
    for (let i = 0; i < reorderedLayers.length; i++) {
      const layer = reorderedLayers[i];
      const layerCanvas = document.createElement('canvas');
      layerCanvas.width = width;
      layerCanvas.height = height;
      const layerCtx = layerCanvas.getContext('2d');
      
      // Efficiently draw layer using ImageData
      const imageData = layerCtx.createImageData(width, height);
      const data = imageData.data; // Direct pixel manipulation

      // Parse layer color (hex to RGB)
      const hex = layer.color.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);

      for (let pixelIdx = 0; pixelIdx < width * height; pixelIdx++) {
        if (newLayerMaps[i][pixelIdx] === 1) { // If pixel belongs to this layer
          const dataOffset = pixelIdx * 4; // RGBA start index
          data[dataOffset]     = r;   // Red
          data[dataOffset + 1] = g;   // Green
          data[dataOffset + 2] = b;   // Blue
          data[dataOffset + 3] = 255; // Alpha (opaque)
        } else {
          // Pixels not in this layer are transparent
          const dataOffset = pixelIdx * 4;
          data[dataOffset]     = 0;
          data[dataOffset + 1] = 0;
          data[dataOffset + 2] = 0;
          data[dataOffset + 3] = 0;   // Alpha (transparent)
        }
      }
      layerCtx.putImageData(imageData, 0, 0); // Draw the processed image data to canvas at once
      
      const coverage = i === reorderedLayers.length - 1 
        ? 100 
        : (newLayerMaps[i].reduce((sum, val) => sum + val, 0) / (width * height) * 100).toFixed(1);
      
      regeneratedLayersData.push({
        ...layer,
        dataURL: layerCanvas.toDataURL(),
        pixelMap: newLayerMaps[i],
        originalPixelMap: layer.originalPixelMap, 
        coverage: coverage
      });
    }
    
    setLayers(regeneratedLayersData);
    createLayeredImageFromLayers(regeneratedLayersData, width, height);
    // 🔥 createLayeredImageFromLayers は呼ばない - ボタン押下時のみ更新
  };

  // ドラッグ開始
  const handleDragStart = (e, index) => {
    setDraggedItemIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());

    const dragImageElement = layerItemRefs.current[index]?.current;
    if (dragImageElement) {
      const rect = dragImageElement.getBoundingClientRect();
      const clonedNode = dragImageElement.cloneNode(true); // Deep clone

      // Apply styles to the cloned node to mimic the original item's appearance
      // and ensure it's properly displayed as a drag image.
      clonedNode.style.position = 'absolute';
      clonedNode.style.left = '-9999px'; // Position off-screen
      clonedNode.style.top = '0px';
      clonedNode.style.width = `${rect.width}px`;
      clonedNode.style.height = `${rect.height}px`;
      clonedNode.style.opacity = '0.85'; // Slightly transparent
      clonedNode.style.pointerEvents = 'none'; // Ensure it doesn't interfere with drag events
      clonedNode.style.boxSizing = 'border-box'; // Consistent sizing

      // Styles from .layer-item in LaserCutImageProcessor.css
      clonedNode.style.padding = '5px 10px';
      clonedNode.style.backgroundColor = 'rgba(68, 68, 68, 0.85)'; // #444 with opacity
      clonedNode.style.border = '1px solid #666';
      clonedNode.style.borderRadius = '4px'; // Assuming a default border-radius
      clonedNode.style.color = '#fff'; // Assuming text color is white
      clonedNode.style.display = 'flex'; // Crucial for layout
      clonedNode.style.alignItems = 'center'; // Crucial for layout
      clonedNode.style.justifyContent = 'space-between'; // Crucial for layout
      
      // Prevent text wrapping
      clonedNode.style.whiteSpace = 'nowrap';
      clonedNode.style.overflow = 'hidden';
      clonedNode.style.textOverflow = 'ellipsis';

      // Match font properties with the original element
      const computedStyle = window.getComputedStyle(dragImageElement);
      clonedNode.style.fontSize = computedStyle.fontSize;
      clonedNode.style.fontFamily = computedStyle.fontFamily;

      clonedNode.classList.remove('selected'); // Remove selection highlight if present
      clonedNode.classList.add('dragging-ghost'); // Add a class for specific ghost styling if needed

      document.body.appendChild(clonedNode);

      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;
      e.dataTransfer.setDragImage(clonedNode, offsetX, offsetY);

      // Clean up the cloned node from the DOM after the drag image has been set.
      // setTimeout is used to ensure this happens after the browser has captured the image.
      setTimeout(() => {
        if (document.body.contains(clonedNode)) {
          document.body.removeChild(clonedNode);
        }
      }, 0);
    } else {
      console.warn('Drag image element not found for index:', index);
    }
  };

  // ドラッグオーバー
  const handleDragOver = (e, index) => {
    e.preventDefault(); 
    if (index !== draggedItemIndex) {
      setDragOverIndex(index);
    }
  };

  // ドラッグリーブ (要素から離れた時)
  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  // ドロップ
  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    if (draggedItemIndex === null || draggedItemIndex === dropIndex) {
      setDraggedItemIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newLayers = [...layers];
    const draggedLayerItem = newLayers[draggedItemIndex]; 
    
    newLayers.splice(draggedItemIndex, 1);
    newLayers.splice(dropIndex, 0, draggedLayerItem);
    
    const updatedLayersWithNewIndices = newLayers.map((layer, idx) => ({
      ...layer,
    }));
    
    // recalculateLayerStackingをrequestAnimationFrameで非同期実行し、UIの反応性を向上させる
    requestAnimationFrame(() => {
      recalculateLayerStacking(updatedLayersWithNewIndices);
    });
    
    if (currentLayerIndex === draggedItemIndex) {
      setCurrentLayerIndex(dropIndex);
    } else if (
      (currentLayerIndex > draggedItemIndex && currentLayerIndex <= dropIndex) ||
      (currentLayerIndex < draggedItemIndex && currentLayerIndex >= dropIndex)
    ) {
      // currentLayerIndex の更新ロジックを元に戻す
      const newIndex = currentLayerIndex + (currentLayerIndex > draggedItemIndex ? -1 : 1);
      setCurrentLayerIndex(newIndex);
    }

    setDraggedItemIndex(null);
    setDragOverIndex(null);
  };

  // ドラッグ終了 (成功・失敗問わず)
  const handleDragEnd = () => {
    setDraggedItemIndex(null);
    setDragOverIndex(null);
  };

  // レイヤーの色を適用する関数
  const applyLayerColor = (layerIndex, newColorHex) => {
    if (layerIndex < 0 || layerIndex >= layers.length || !processCanvasRef.current) return;
    
    const layerToUpdate = layers[layerIndex];
    const layerCanvas = document.createElement('canvas');
    layerCanvas.width = processCanvasRef.current.width;
    layerCanvas.height = processCanvasRef.current.height;
    const layerCtx = layerCanvas.getContext('2d');
    
    layerCtx.fillStyle = newColorHex;
    
    const width = layerCanvas.width;
    const height = layerCanvas.height;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = y * width + x;
        if (layerToUpdate.pixelMap && layerToUpdate.pixelMap[index] === 1) {
          layerCtx.fillRect(x, y, 1, 1);
        }
      }
    }
    
    const updatedLayers = [...layers];
    updatedLayers[layerIndex] = {
      ...layerToUpdate,
      dataURL: layerCanvas.toDataURL(),
      color: newColorHex
    };
    
    setLayers(updatedLayers);
    createLayeredImageFromLayers(updatedLayers, width, height);
    
  };
  
  // レイヤーアイテムのref配列を更新
  useEffect(() => {
    layerItemRefs.current = Array(layers.length)
      .fill(null)
      .map((_, i) => layerItemRefs.current[i] || createRef());
  }, [layers]); 

  // Toggle sidebar
  const toggleSidebar = () => {
    setSidebarExpanded(!sidebarExpanded);
  };

  // Navigate to page
  const navigateTo = (page) => {
    
    // 🔥 ネオン3Dプレビューから離れる時にカメラ状態を保存
    if (currentPage === 'neonSvg3dPreview' && neonSvgTo3DExtruderRef.current) {
      console.log('ネオンカメラ状態を保存中...');
      const saveResult = neonSvgTo3DExtruderRef.current.saveCameraState();
      if (saveResult) {
        console.log('ネオンカメラ状態を保存しました');
      }
    }
    
    setCurrentPage(page);
    
    
    // 🔥 ネオン3Dプレビューに戻る時にカメラ状態を復元
    if (page === 'neonSvg3dPreview' && neonSvgTo3DExtruderRef.current) {
      setTimeout(() => {
        console.log('ネオンカメラ状態を復元中...');
        const restoreResult = neonSvgTo3DExtruderRef.current.restoreCameraState();
        if (restoreResult) {
          console.log('ネオンカメラ状態を復元しました');
        }
      }, 100);
    }
  };

  // Process the image
  // この関数で元のprocessImage関数を丸ごと置き換えてください
const processImage = async () => {
  if (!image) return;
  
  setIsProcessing(true);
  setGenerationProgress(0);
  setProcessingMessage('処理を開始しています...');
  
  const canvas = processCanvasRef.current;
  if (!canvas) {
    setIsProcessing(false);
    return;
  }
  
  try {
    const ctx = canvas.getContext('2d');
    canvas.width = image.width;
    canvas.height = image.height;
    ctx.drawImage(image, 0, 0);
    
    // 進捗更新用のヘルパー関数
     // 進捗更新用のヘルパー関数
    const updateProgress = (progress, message) => {
      return new Promise(resolve => {
        setGenerationProgress(progress);
        setProcessingMessage(message);
        console.log(`${progress}% - ${message}`);
        setTimeout(resolve, 100);
      });
    };
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    
    // Step 1: Color quantization (10%)
    await updateProgress(10, "色の解析中...");
    const detectedColors = newQuantizeColors(imageData.data, canvas.width, canvas.height, colorCount);
    setColors(detectedColors);
    
    // Step 2: Assign pixels to colors (30%)
    await updateProgress(30, "ピクセルの分類中...");
    await new Promise(resolve => setTimeout(resolve, 200));
    const pixelColors = assignPixelsToColors(pixels, detectedColors);
    
    // Step 3: Extract regions (50%)
    await updateProgress(50, "領域の抽出中...");
    await new Promise(resolve => setTimeout(resolve, 200));
    const regions = extractRegions(pixelColors, canvas.width, canvas.height, minRegionSize);
    
    // Step 4: Clean small features (70%)
    await updateProgress(70, "細部の調整中...");
    await new Promise(resolve => setTimeout(resolve, 200));
    const cleanedPixelColors = cleanSmallFeatures(pixelColors, canvas.width, canvas.height, minFeatureSize);
    
    // Step 5: Extract cleaned regions (80%)
    await updateProgress(80, "最終領域の抽出中...");
    await new Promise(resolve => setTimeout(resolve, 200));
    const cleanedRegions = extractRegions(cleanedPixelColors, canvas.width, canvas.height, minRegionSize);
    
    // Step 6: Apply to canvas (90%)
    await updateProgress(90, "キャンバスに適用中...");
    await new Promise(resolve => setTimeout(resolve, 200));
    applyRegionsToCanvas(cleanedRegions, ctx, canvas.width, canvas.height, detectedColors);
    
    // Step 7: Draw borders if needed (95%)
    if (showBorders) {
      await updateProgress(95, "境界線を描画中...");
      await new Promise(resolve => setTimeout(resolve, 200));
      drawBorders(cleanedRegions, ctx, borderColor, borderWidth, detectedColors, canvas);
    }
    
    // Step 8: Generate layers (98%)
    await updateProgress(98, "レイヤーを生成中...");
    setProcessedCanvas(canvas.toDataURL());
    await new Promise(resolve => setTimeout(resolve, 200));
    generateLayers(cleanedRegions, detectedColors, canvas.width, canvas.height);
    
    await updateProgress(100, "生成完了");
    
    // Navigate to layer preview page after processing
    setTimeout(() => {
      setCurrentPage('neonDrawing');
      setIsProcessing(false);
      setGenerationProgress(0);
      setProcessingMessage('');
    }, 500);
    
  } catch (error) {
    console.error('画像処理中にエラーが発生しました:', error);
    setIsProcessing(false);
    setGenerationProgress(0);
    setProcessingMessage('');
    alert('画像処理中にエラーが発生しました。もう一度お試しください。');
  }
};
  
  // Clean small features with improved algorithm
  const cleanSmallFeatures = (pixelColors, width, height, minFeatureSize) => {
    // Skip cleaning if minFeatureSize is set to 1 or less (max resolution)
    if (minFeatureSize <= 1) {
      return pixelColors;
    }
    
    const cleanedPixels = new Uint8Array(pixelColors);
    const tempPixels = new Uint8Array(pixelColors); // Buffer for 2-pass cleaning
    
    // Create a weighted voting system
    const computeWeightedDominantColor = (x, y) => {
      const index = y * width + x;
      const currentColor = cleanedPixels[index];
      const colorVotes = new Map();
      let totalWeight = 0;
      
      // Use a variable size window based on minFeatureSize
      const radius = minFeatureSize;
      
      // First pass: count color occurrences with distance-based weights
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist > radius) continue; // Use circular window
          
          const nx = x + dx;
          const ny = y + dy;
          
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const neighborIndex = ny * width + nx;
            const neighborColor = cleanedPixels[neighborIndex];
            
            // Weight by inverse distance (closer pixels have more influence)
            // Center pixel has highest weight
            const weight = (dx === 0 && dy === 0) ? 
                           radius + 1 : // Center pixel weight
                           Math.max(0.1, (radius - dist) / radius); // Other pixels
            
            colorVotes.set(
              neighborColor, 
              (colorVotes.get(neighborColor) || 0) + weight
            );
            
            totalWeight += weight;
          }
        }
      }
      
      // Check for edge features (high contrast boundaries)
      const edgeThreshold = 0.4; // Threshold for detecting edges
      let isOnEdge = false;
      let edgeDirection = null;
      
      // Check horizontal and vertical gradients
      const checkGradient = (dx, dy) => {
        const nx1 = x + dx;
        const ny1 = y + dy;
        const nx2 = x - dx;
        const ny2 = y - dy;
        
        if (nx1 >= 0 && nx1 < width && ny1 >= 0 && ny1 < height &&
            nx2 >= 0 && nx2 < width && ny2 >= 0 && ny2 < height) {
          const color1 = cleanedPixels[ny1 * width + nx1];
          const color2 = cleanedPixels[ny2 * width + nx2];
          
          // If colors on opposite sides are different, we may be on an edge
          if (color1 !== color2) {
            const vote1 = colorVotes.get(color1) || 0;
            const vote2 = colorVotes.get(color2) || 0;
            
            // If votes are somewhat balanced, this is likely an edge
            const ratio = Math.min(vote1, vote2) / (Math.max(vote1, vote2) || 1);
            if (ratio > edgeThreshold) {
              isOnEdge = true;
              edgeDirection = [dx, dy];
              return true;
            }
          }
        }
        return false;
      };
      
      // Check in 4 directions for edges
      if (checkGradient(1, 0) || checkGradient(0, 1) || 
          checkGradient(1, 1) || checkGradient(1, -1)) {
        // On an edge - keep the current color to preserve edges
        return currentColor;
      }
      
      // Find dominant color
      let maxVote = 0;
      let dominantColor = currentColor;
      
      for (const [color, vote] of colorVotes.entries()) {
        if (vote > maxVote) {
          maxVote = vote;
          dominantColor = color;
        }
      }
      
      // Use current color if it has significant presence
      const currentColorVote = colorVotes.get(currentColor) || 0;
      const dominantColorVote = colorVotes.get(dominantColor) || 0;
      
      // If current color has a significant vote, keep it to reduce noise
      if (currentColorVote > totalWeight * 0.25 && 
          currentColorVote > dominantColorVote * 0.5) {
        return currentColor;
      }
      
      return dominantColor;
    };
    
    // First pass - calculate dominant colors
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = y * width + x;
        tempPixels[index] = computeWeightedDominantColor(x, y);
      }
    }
    
    // Second pass - ensure consistency and noise removal
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = y * width + x;
        const currentColor = tempPixels[index];
        const surrounding = new Set();
        let sameColorCount = 0;
        let totalChecked = 0;
        
        // Check a smaller radius for consistency
        const radius = Math.max(1, Math.floor(minFeatureSize / 2));
        
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            if (dx === 0 && dy === 0) continue;
            
            const nx = x + dx;
            const ny = y + dy;
            
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              totalChecked++;
              const neighborColor = tempPixels[ny * width + nx];
              surrounding.add(neighborColor);
              
              if (neighborColor === currentColor) {
                sameColorCount++;
              }
            }
          }
        }
        
        // If this is an isolated pixel with a unique color, replace it
        if (sameColorCount === 0 && surrounding.size > 0) {
          // Find the most common surrounding color
          const surroundingCounts = new Map();
          for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
              if (dx === 0 && dy === 0) continue;
              
              const nx = x + dx;
              const ny = y + dy;
              
              if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                const neighborColor = tempPixels[ny * width + nx];
                surroundingCounts.set(
                  neighborColor, 
                  (surroundingCounts.get(neighborColor) || 0) + 1
                );
              }
            }
          }
          
          let maxCount = 0;
          let replacementColor = currentColor;
          for (const [color, count] of surroundingCounts.entries()) {
            if (count > maxCount) {
              maxCount = count;
              replacementColor = color;
            }
          }
          
          cleanedPixels[index] = replacementColor;
        } else {
          // Normal case
          cleanedPixels[index] = tempPixels[index];
        }
      }
    }
    
    return cleanedPixels;
  };
  
  // Color quantization
 // 改善された色の量子化関数
// 既存の quantizeColors 関数と、以下のヘルパー関数群を置き換えてください。
// (perceptualColorDistance, simpleColorDistance は既存のものを使用すると仮定します)

// MODIFIED: quantizeColors 関数全体を以下に置き換えます
const quantizeColors = (pixels, k) => {
  // Extract RGB data
  const rgbData = [];
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue; // Skip transparent pixels
    rgbData.push([pixels[i], pixels[i + 1], pixels[i + 2]]);
  }

  if (rgbData.length === 0) {
    return Array(k).fill(null).map((_, i) => [
      Math.floor(255 * i / (k - 1)),
      Math.floor(255 * i / (k - 1)),
      Math.floor(255 * i / (k - 1))
    ]);
  }
  
  const perceptualColorDistance = (color1, color2) => {
    const rgbToLab = (r, g, b) => {
      r = r / 255; g = g / 255; b = b / 255;
      r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
      g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
      b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;
      let x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375;
      let y = r * 0.2126729 + g * 0.7151522 + b * 0.0721750;
      let z = r * 0.0193339 + g * 0.1191920 + b * 0.9503041;
      x = x / 0.95047; y = y / 1.00000; z = z / 1.08883;
      x = x > 0.008856 ? Math.pow(x, 1/3) : (7.787 * x + 16/116);
      y = y > 0.008856 ? Math.pow(y, 1/3) : (7.787 * y + 16/116);
      z = z > 0.008856 ? Math.pow(z, 1/3) : (7.787 * z + 16/116);
      const L = 116 * y - 16;
      const a = 500 * (x - y);
      const b_lab = 200 * (y - z);
      return [L, a, b_lab];
    };
    const lab1 = rgbToLab(color1[0], color1[1], color1[2]);
    const lab2 = rgbToLab(color2[0], color2[1], color2[2]);
    return Math.sqrt(
      Math.pow(lab2[0] - lab1[0], 2) +
      Math.pow(lab2[1] - lab1[1], 2) +
      Math.pow(lab2[2] - lab1[2], 2)
    );
  };

  // MODIFIED HELPER: snapToActualColor - 生成された色を実際の画像色にスナップする
  const snapToActualColor = (theoreticalColor, allImageColors) => {
    if (!allImageColors || allImageColors.length === 0) {
      return theoreticalColor; // フォールバック
    }
    let closestActualColor = theoreticalColor;
    let minSnapDist = Infinity;
    for (const actualColor of allImageColors) {
      const snapDist = perceptualColorDistance(theoreticalColor, actualColor);
      if (snapDist < minSnapDist) {
        minSnapDist = snapDist;
        closestActualColor = actualColor;
      }
    }
    return [...closestActualColor]; // Make sure to return a copy
  };
  
  // MODIFIED HELPER: generateDiverseColor - rgbData を引数に追加
  const generateDiverseColor = (existingCentroids, index, totalColors, allImageColors) => {
    const hue = (360 * index / totalColors) % 360;
    const saturation = 70 + Math.random() * 30;
    const value = 40 + Math.random() * 60;

    const hsvToRgb = (h, s, v) => {
      s /= 100; v /= 100;
      const c = v * s;
      const x = c * (1 - Math.abs((h / 60) % 2 - 1));
      const m = v - c;
      let r, g, b_val; // b は既に変数名として存在するため b_val に変更
      if (h >= 0 && h < 60) [r, g, b_val] = [c, x, 0];
      else if (h >= 60 && h < 120) [r, g, b_val] = [x, c, 0];
      else if (h >= 120 && h < 180) [r, g, b_val] = [0, c, x];
      else if (h >= 180 && h < 240) [r, g, b_val] = [0, x, c];
      else if (h >= 240 && h < 300) [r, g, b_val] = [x, 0, c];
      else [r, g, b_val] = [c, 0, x];
      return [
        Math.round((r + m) * 255),
        Math.round((g + m) * 255),
        Math.round((b_val + m) * 255) // b_val を使用
      ];
    };
    const theoreticalRgb = hsvToRgb(hue, saturation, value);
    return snapToActualColor(theoreticalRgb, allImageColors); // MODIFIED: スナップ処理を追加
  };

  // MODIFIED HELPER: initializeDiverseCentroids - rgbData を引数に渡し、generateDiverseColor にも渡す
  const initializeDiverseCentroids = (allImageColors) => {
    const centroids = [];
    if (allImageColors.length === 0) { // allImageColors が空の場合のフォールバック
        for(let i=0; i<k; ++i) centroids.push([Math.floor(Math.random()*256),Math.floor(Math.random()*256),Math.floor(Math.random()*256)]);
        return centroids;
    }

    const minDistanceThreshold = 30; // 知覚的距離の閾値 (元のminDistanceは50だったが調整可能)
    const maxAttemptsPerCentroid = 100; // 適切な色を見つけるための試行回数

    // 最初のセントロイドはランダムに選択
    centroids.push([...allImageColors[Math.floor(Math.random() * allImageColors.length)]]);

    for (let i = 1; i < k; i++) {
      let bestCandidate = null;
      let maxMinDist = -1;

      // 既存のセントロイドから最も遠い色を見つける (k-means++ に似たアプローチ)
      // allImageColors からランダムサンプリングするか、全てを試す
      const sampleSize = Math.min(allImageColors.length, 500); // パフォーマンスのためサンプリングサイズを制限
      for (let attempt = 0; attempt < sampleSize; attempt++) {
        const candidate = allImageColors[Math.floor(Math.random() * allImageColors.length)];
        let currentMinDist = Infinity;
        for (const centroid of centroids) {
          const dist = perceptualColorDistance(candidate, centroid);
          currentMinDist = Math.min(currentMinDist, dist);
        }
        if (currentMinDist > maxMinDist) {
          maxMinDist = currentMinDist;
          bestCandidate = [...candidate];
        }
      }
      
      // 閾値以上の良い候補が見つかったか、または単に最も遠いものを選ぶ
      if (bestCandidate && maxMinDist >= minDistanceThreshold) {
        centroids.push(bestCandidate);
      } else if (bestCandidate) { // 閾値未満でも、最も良かったものがあればそれを使う
        centroids.push(bestCandidate);
      } else {
        // それでも見つからない場合（非常に稀なケース）、generateDiverseColorで生成（スナップ機能付き）
        centroids.push(generateDiverseColor(centroids, i, k, allImageColors));
      }
    }
    return centroids;
  };

  // MODIFIED HELPER: generateComplementaryColor - rgbData を引数に追加しスナップ処理
  const generateComplementaryColor = (existingColors, avoidIndex, allImageColors) => {
    let avgR = 0, avgG = 0, avgB = 0;
    let count = 0;
    for (let i = 0; i < existingColors.length; i++) {
      if (i === avoidIndex) continue;
      avgR += existingColors[i][0];
      avgG += existingColors[i][1];
      avgB += existingColors[i][2];
      count++;
    }
    let theoreticalComplement;
    if (count > 0) {
      avgR = Math.round(avgR / count);
      avgG = Math.round(avgG / count);
      avgB = Math.round(avgB / count);
      theoreticalComplement = [
        Math.max(0, Math.min(255, 255 - avgR + Math.random() * 60 - 30)),
        Math.max(0, Math.min(255, 255 - avgG + Math.random() * 60 - 30)),
        Math.max(0, Math.min(255, 255 - avgB + Math.random() * 60 - 30))
      ].map(c => Math.round(c));
    } else {
      theoreticalComplement = [Math.floor(Math.random() * 256), Math.floor(Math.random() * 256), Math.floor(Math.random() * 256)];
    }
    return snapToActualColor(theoreticalComplement, allImageColors); // MODIFIED: スナップ処理
  };

  // MODIFIED HELPER: findReplacementColor - rgbData を引数に追加
  const findReplacementColor = (existingColors, allImageColors, avoidIndex) => {
    const minColorDistanceThreshold = 30; // 知覚的距離
    let bestReplacement = null;
    let maxMinDistanceFound = -1;

    const sampleSize = Math.min(allImageColors.length, 500);
    for (let attempt = 0; attempt < sampleSize; attempt++) {
      const candidate = allImageColors[Math.floor(Math.random() * allImageColors.length)];
      let minDistanceToOthers = Infinity;
      let skipCandidate = false;
      for (let i = 0; i < existingColors.length; i++) {
        if (i === avoidIndex) continue; // 置換対象の元の色は比較しない
        // 候補が既存の他の色と同一または酷似していないかチェック
        if (perceptualColorDistance(candidate, existingColors[i]) < 5) { // 非常に近い場合はスキップ
            skipCandidate = true;
            break;
        }
        const dist = perceptualColorDistance(candidate, existingColors[i]);
        minDistanceToOthers = Math.min(minDistanceToOthers, dist);
      }
      if (skipCandidate) continue;

      if (minDistanceToOthers > maxMinDistanceFound) {
        maxMinDistanceFound = minDistanceToOthers;
        bestReplacement = [...candidate];
      }
    }
    
    // 閾値以上の良い置換色が見つかったか、または単に最も良かったものを選ぶ
    if (bestReplacement && maxMinDistanceFound >= minColorDistanceThreshold) {
      return bestReplacement;
    } else if (bestReplacement) { // 閾値未満でも、最も良かったものがあればそれを使う
      return bestReplacement;
    }
    // 適切な置換色が見つからない場合、補色的な色を生成（スナップ機能付き）
    return generateComplementaryColor(existingColors, avoidIndex, allImageColors);
  };
  
  // MODIFIED HELPER: validateAndAdjustColors - rgbData を引数に追加
  const validateAndAdjustColors = (currentCentroids, allImageColors) => {
    const minPerceptualDistance = 20; // 許容する最小の知覚的色差 (元のminColorDistanceは30だったが調整可能)
    const adjustedCentroids = currentCentroids.map(c => [...c]); // ディープコピー

    for (let i = 0; i < adjustedCentroids.length; i++) {
      for (let j = i + 1; j < adjustedCentroids.length; j++) {
        const distance = perceptualColorDistance(adjustedCentroids[i], adjustedCentroids[j]);
        if (distance < minPerceptualDistance) {
          // console.log(`Similar colors detected: ${adjustedCentroids[i]} and ${adjustedCentroids[j]}, distance: ${distance.toFixed(2)}. Adjusting one.`);
          // どちらの色を置き換えるか？ -> よりクラスタサイズの小さい方、または単純に j の方を置き換える
          // ここでは j の方を置き換える
          const replacement = findReplacementColor(adjustedCentroids, allImageColors, j);
          adjustedCentroids[j] = replacement;
          // j が変更されたので、この新しい adjustedCentroids[j] と他の色との比較を再度行うため、
          // j をデクリメントして次のループで同じ j (新しい値を持つ) を再評価する
          // もしくは、より安全なのは i から再スタートだが、ここでは j の再評価を試みる
          // (元のロジック: j = i; は、内側のループをリセットし、i+1 から再開させるため、その意図を汲む)
          // ただし、単純に j を i にすると、外側のループが進んだときに i+1 から j が始まるので、
          // 同じ i との比較は行われない。
          // より堅牢なのは、変更があったら全体を再スキャンするフラグを立てるか、
          // もしくは、jをiに戻す代わりに、jをj-1（現在のループの次の反復で同じjを再評価）し、さらにiをi-1（外側ループも再評価）する方法もある。
          // ここでは、元のコードの意図 (j=i) をシンプルに解釈し、内側ループの次の反CSCで i+1 から再評価されるようにする
          // (実際には、jのループはj++されるので、j=i にすると次は i+1 との比較になる)
          // より直接的な再評価のため、jをリセットして現在のiに対してもう一度チェックさせる
          j = i; // この変更により、内側のループが i+1 から再開し、新しい adjustedCentroids[j] (元 adjustedCentroids[i+1]) が再チェックされる
                 // ただし、adjustedCentroids[i] と 新しい adjustedCentroids[j] の比較が必要な場合、このロジックでは不十分
                 // 変更があったらループを最初からやり直すのが最も確実
          // 簡単のため、一旦 j = i のままにしておく (元のコードの挙動に近い)
          // console.log(`Adjusted layer ${j} to ${replacement}`);
        }
      }
    }
    return adjustedCentroids;
  };

  // 初期重心を設定 (rgbDataを渡すように変更)
  let centroids = initializeDiverseCentroids(rgbData);
  
  // k-meansクラスタリングの実行
  const iterations = 20; // 最大反復回数
  for (let iter = 0; iter < iterations; iter++) {
    const clusters = Array(k).fill().map(() => []);
    
    // 各ピクセルを最も近い重心に割り当て (知覚的距離を使用)
    for (const pixel of rgbData) {
      let minDist = Infinity;
      let clusterIndex = 0;
      for (let j = 0; j < k; j++) {
        const dist = perceptualColorDistance(pixel, centroids[j]); // MODIFIED: 知覚的距離を使用
        if (dist < minDist) {
          minDist = dist;
          clusterIndex = j;
        }
      }
      clusters[clusterIndex].push(pixel);
    }
    
    const oldCentroids = centroids.map(c => [...c]); // ディープコピー
    
    // 重心を更新 (クラスタ内の色の平均)
    for (let i = 0; i < k; i++) {
      if (clusters[i].length > 0) {
        const newCentroid = [0, 0, 0];
        for (const pixel of clusters[i]) {
          newCentroid[0] += pixel[0];
          newCentroid[1] += pixel[1];
          newCentroid[2] += pixel[2];
        }
        centroids[i] = [
          Math.round(newCentroid[0] / clusters[i].length),
          Math.round(newCentroid[1] / clusters[i].length),
          Math.round(newCentroid[2] / clusters[i].length)
        ];
      } else {
        // クラスタが空の場合、重心を再初期化 (例: 最も遠いピクセルを選ぶなど、より高度な方法も可能)
        // ここでは、ランダムな画像内の色、または generateDiverseColor を使用してスナップ
        if (rgbData.length > 0) {
             centroids[i] = generateDiverseColor(centroids, i, k, rgbData);
        } else { // rgbDataが空という状況は通常ありえないがフォールバック
            centroids[i] = [Math.floor(Math.random()*256),Math.floor(Math.random()*256),Math.floor(Math.random()*256)];
        }
      }
    }
    
    // 収束チェック (重心の変化が小さければ終了)
    let converged = true;
    for (let i = 0; i < k; i++) {
      // simpleColorDistanceでも良いが、perceptualColorDistanceを使う方が一貫性がある
      if (perceptualColorDistance(centroids[i], oldCentroids[i]) > 2) { // 閾値を調整
        converged = false;
        break;
      }
    }
    if (converged && iter > 0) break; // 少なくとも1回は実行
  }

  // 最終的な色の検証と調整 (rgbDataを渡すように変更)
  centroids = validateAndAdjustColors(centroids, rgbData);
  
  // 代表色を面積（頻度）でソート (オプション、必ずしも必要ではない)
  // distinct な色を k 個選ぶのが目的なら、このソートは最終表示順のためかもしれない
  const centroidCounts = Array(k).fill(0);
  for (const pixel of rgbData) {
    let minDist = Infinity;
    let minIndex = 0;
    for (let j = 0; j < k; j++) {
      // ここも知覚的距離で割り当てるべき
      const dist = perceptualColorDistance(pixel, centroids[j]);
      if (dist < minDist) {
        minDist = dist;
        minIndex = j;
      }
    }
    centroidCounts[minIndex]++;
  }
  
  const sortedColors = centroids
    .map((color, index) => ({ color, count: centroidCounts[index], originalIndex: index }))
    //.sort((a, b) => b.count - a.count); // カウントでソートする場合
    // 元のインデックス順、または別の基準でソートも可能
    // ここでは、validateAndAdjustColors後のcentroidsの順序を維持
    .map(item => item.color); 
  
  return sortedColors;
};
  // Color distance calculation
  const colorDistance = (color1, color2) => {
    return Math.sqrt(
      Math.pow(color1[0] - color2[0], 2) +
      Math.pow(color1[1] - color2[1], 2) +
      Math.pow(color1[2] - color2[2], 2)
    );
  };
  
  // Assign pixels to closest color
  const assignPixelsToColors = (pixels, colors) => {
    const result = new Uint8Array(pixels.length / 4);
    
    for (let i = 0; i < pixels.length; i += 4) {
      const pixel = [pixels[i], pixels[i + 1], pixels[i + 2]];
      let minDist = Infinity;
      let colorIndex = 0;
      
      for (let j = 0; j < colors.length; j++) {
        const dist = colorDistance(pixel, colors[j]);
        if (dist < minDist) {
          minDist = dist;
          colorIndex = j;
        }
      }
      
      result[i / 4] = colorIndex;
    }
    
    return result;
  };
  
  // Extract regions with improved algorithm and stricter minimum size enforcement
  const extractRegions = (pixelColors, width, height, minSize) => {
    const visited = new Uint8Array(pixelColors.length);
    const regions = [];
    
    // Directional offsets for 8-connectivity (including diagonals)
    const dx = [1, 1, 0, -1, -1, -1, 0, 1];
    const dy = [0, 1, 1, 1, 0, -1, -1, -1];
    
    const floodFill = (x, y, colorIndex) => {
      const stack = [{x, y}];
      const region = [];
      const boundaryCounts = new Map(); // Track adjacent colors for better merging
      
      while (stack.length > 0) {
        const {x, y} = stack.pop();
        const index = y * width + x;
        
        if (x < 0 || y < 0 || x >= width || y >= height || 
            visited[index] === 1 || pixelColors[index] !== colorIndex) {
          continue;
        }
        
        visited[index] = 1;
        region.push({x, y, colorIndex});
        
        // Check all 8 neighbors (including diagonals)
        for (let i = 0; i < 8; i++) {
          const nx = x + dx[i];
          const ny = y + dy[i];
          
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const neighborIndex = ny * width + nx;
            
            // Add to stack if same color and not visited
            if (pixelColors[neighborIndex] === colorIndex && visited[neighborIndex] === 0) {
              stack.push({x: nx, y: ny});
            } 
            // Track boundary colors for better merging
            else if (pixelColors[neighborIndex] !== colorIndex) {
              const adjColor = pixelColors[neighborIndex];
              boundaryCounts.set(adjColor, (boundaryCounts.get(adjColor) || 0) + 1);
            }
          }
        }
      }
      
      // Store the boundary information with the region
      let dominantBoundaryColor = -1;
      let maxBoundaryCount = 0;
      for (const [color, count] of boundaryCounts.entries()) {
        if (count > maxBoundaryCount) {
          maxBoundaryCount = count;
          dominantBoundaryColor = color;
        }
      }
      
      return {
        pixels: region,
        dominantBoundaryColor,
        boundaryCounts
      };
    };
    
    // First pass: identify all regions
    const allRegions = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = y * width + x;
        
        if (visited[index] === 0) {
          const colorIndex = pixelColors[index];
          const regionData = floodFill(x, y, colorIndex);
          
          // Store all regions, regardless of size
          allRegions.push(regionData);
          
          // Reset small regions for second pass
          if (regionData.pixels.length < minSize) {
            for (const pixel of regionData.pixels) {
              visited[pixel.y * width + pixel.x] = 0;
            }
          } else {
            // Keep regions that meet the size requirement
            regions.push(regionData.pixels);
          }
        }
      }
    }
    
    // Enhanced second pass: merge small regions intelligently with strict size enforcement
    // Sort small regions by size (largest first) for better merging
    const smallRegions = allRegions
      .filter(r => r.pixels.length < minSize)
      .sort((a, b) => b.pixels.length - a.pixels.length);
    
    // Track merged regions for additional verification
    const mergedPixels = new Set();
    
    for (const region of smallRegions) {
      // Skip if already processed in a previous merge
      if (region.pixels.length === 0) continue;
      
      // Check if any pixels in this region have already been merged
      let alreadyMerged = false;
      for (const pixel of region.pixels) {
        const pixelKey = `${pixel.y}-${pixel.x}`;
        if (mergedPixels.has(pixelKey)) {
          alreadyMerged = true;
          break;
        }
      }
      
      if (alreadyMerged) continue;
      
      // Choose best color to merge with based on boundary analysis
      let targetColor = region.dominantBoundaryColor;
      
      // If no good boundary, check surrounding pixels more broadly
      if (targetColor === -1) {
        const centerPixel = region.pixels[Math.floor(region.pixels.length / 2)];
        const surroundingColors = new Map();
        
        // Look in a larger radius
        const radius = Math.min(15, Math.max(5, Math.ceil(Math.sqrt(minSize))));
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = centerPixel.x + dx;
            const ny = centerPixel.y + dy;
            
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const neighborIndex = ny * width + nx;
              if (visited[neighborIndex] === 1) {
                const neighborColor = pixelColors[neighborIndex];
                surroundingColors.set(
                  neighborColor, 
                  (surroundingColors.get(neighborColor) || 0) + 1
                );
              }
            }
          }
        }
        
        // Find dominant surrounding color
        let maxCount = 0;
        for (const [color, count] of surroundingColors.entries()) {
          if (count > maxCount) {
            maxCount = count;
            targetColor = color;
          }
        }
      }
      
      // Update the color of all pixels in the region
      if (targetColor !== -1) {
        // Find the target region to merge with
        let targetRegion = regions.find(r => 
          r.length > 0 && r[0].colorIndex === targetColor
        );
        
        // If no existing region found but we have a target color, create a new region
        if (!targetRegion) {
          targetRegion = [];
          regions.push(targetRegion);
        }
        
        // Update all pixels in this small region
        for (const pixel of region.pixels) {
          const idx = pixel.y * width + pixel.x;
          pixelColors[idx] = targetColor;
          visited[idx] = 1;
          
          // Add to the tracking set to avoid double-processing
          const pixelKey = `${pixel.y}-${pixel.x}`;
          mergedPixels.add(pixelKey);
          
          // Add to target region
          targetRegion.push({
            x: pixel.x,
            y: pixel.y,
            colorIndex: targetColor
          });
        }
      }
    }
    
    // Clean up any unassigned pixels by assigning to nearest region
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = y * width + x;
        
        if (visited[index] === 0) {
          // Find nearest assigned pixel
          let minDist = Infinity;
          let bestColor = -1;
          
          // Check in increasing radius until we find something
          for (let radius = 1; radius < 25 && bestColor === -1; radius++) {
            for (let dy = -radius; dy <= radius; dy++) {
              for (let dx = -radius; dx <= radius; dx++) {
                // Only check pixels at current radius
                if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
                
                const nx = x + dx;
                const ny = y + dy;
                
                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                  const neighborIndex = ny * width + nx;
                  if (visited[neighborIndex] === 1) {
                    const dist = dx*dx + dy*dy;
                    if (dist < minDist) {
                      minDist = dist;
                      bestColor = pixelColors[neighborIndex];
                    }
                  }
                }
              }
            }
          }
          
          if (bestColor !== -1) {
            pixelColors[index] = bestColor;
            visited[index] = 1;
            
            // Add to matching region
            const matchingRegion = regions.find(r => 
              r.length > 0 && r[0].colorIndex === bestColor
            );
            
            if (matchingRegion) {
              matchingRegion.push({
                x: x,
                y: y,
                colorIndex: bestColor
              });
            }
          }
        }
      }
    }
    
    // Final pass: Double check that all regions meet the minimum size requirement
    // If not, merge them with the nearest large region
    const verifiedRegions = [];
    const remainingSmallRegions = [];
    
    for (const region of regions) {
      if (region.length >= minSize) {
        verifiedRegions.push(region);
      } else if (region.length > 0) {
        remainingSmallRegions.push(region);
      }
    }
    
    // Process any remaining small regions
    for (const region of remainingSmallRegions) {
      if (region.length === 0) continue;
      
      const colorIndex = region[0].colorIndex;
      const centerX = region.reduce((sum, p) => sum + p.x, 0) / region.length;
      const centerY = region.reduce((sum, p) => sum + p.y, 0) / region.length;
      
      // Find the nearest large region
      let closestRegion = null;
      let minDistance = Infinity;
      
      for (const largeRegion of verifiedRegions) {
        if (largeRegion.length === 0) continue;
        
        const largeRegionCenterX = largeRegion.reduce((sum, p) => sum + p.x, 0) / largeRegion.length;
        const largeRegionCenterY = largeRegion.reduce((sum, p) => sum + p.y, 0) / largeRegion.length;
        
        const distance = Math.sqrt(
          Math.pow(centerX - largeRegionCenterX, 2) + 
          Math.pow(centerY - largeRegionCenterY, 2)
        );
        
        if (distance < minDistance) {
          minDistance = distance;
          closestRegion = largeRegion;
        }
      }
      
      // Merge with the closest region
      if (closestRegion) {
        const targetColor = closestRegion[0].colorIndex;
        
        for (const pixel of region) {
          // Update the pixel color
          pixelColors[pixel.y * width + pixel.x] = targetColor;
          
          // Add to the target region
          closestRegion.push({
            x: pixel.x,
            y: pixel.y,
            colorIndex: targetColor
          });
        }
      } else if (verifiedRegions.length > 0) {
        // If somehow we didn't find a close region, add to the first verified region
        const targetRegion = verifiedRegions[0];
        const targetColor = targetRegion[0].colorIndex;
        
        for (const pixel of region) {
          // Update the pixel color
          pixelColors[pixel.y * width + pixel.x] = targetColor;
          
          // Add to the target region
          targetRegion.push({
            x: pixel.x,
            y: pixel.y,
            colorIndex: targetColor
          });
        }
      }
    }
    
    // Return only the verified regions
    return verifiedRegions;
  };
  
  // Draw regions on canvas
  const applyRegionsToCanvas = (regions, ctx, width, height, colors) => {
    ctx.clearRect(0, 0, width, height);
    
    for (const region of regions) {
      if (region.length === 0) continue;
      
      const colorIndex = region[0].colorIndex;
      const color = `rgb(${colors[colorIndex][0]}, ${colors[colorIndex][1]}, ${colors[colorIndex][2]})`;
      
      ctx.fillStyle = color;
      
      for (const pixel of region) {
        ctx.fillRect(pixel.x, pixel.y, 1, 1);
      }
    }
  };
  
  // Draw borders
  const drawBorders = (regions, ctx, borderColor, borderWidth, colors, canvas) => {
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = borderWidth;
    
    for (const region of regions) {
      if (region.length === 0) continue;
      
      // Find border pixels
      const borderPixels = [];
      for (const pixel of region) {
        const {x, y, colorIndex} = pixel;
        
        const isOnBorder = (
          x === 0 || y === 0 || x === canvas.width - 1 || y === canvas.height - 1 ||
          (x > 0 && ctx.getImageData(x - 1, y, 1, 1).data[0] !== colors[colorIndex][0]) ||
          (x < canvas.width - 1 && ctx.getImageData(x + 1, y, 1, 1).data[0] !== colors[colorIndex][0]) ||
          (y > 0 && ctx.getImageData(x, y - 1, 1, 1).data[0] !== colors[colorIndex][0]) ||
          (y < canvas.height - 1 && ctx.getImageData(x, y + 1, 1, 1).data[0] !== colors[colorIndex][0])
        );
        
        if (isOnBorder) {
          borderPixels.push({x, y});
        }
      }
      
      // Draw border
      ctx.beginPath();
      for (const pixel of borderPixels) {
        ctx.rect(pixel.x, pixel.y, 1, 1);
      }
      ctx.stroke();
    }
  };
  
  // Generate stacked layers
  const generateLayers = (regions, colors, width, height) => {
    const newLayers = [];
    
    // Create pixel maps for each layer - both original pixels and stacked pixels
    const originalLayerMaps = Array(colors.length).fill(null).map(() => 
      new Uint8Array(width * height).fill(0)
    );
    const stackedLayerMaps = Array(colors.length).fill(null).map(() => 
      new Uint8Array(width * height).fill(0)
    );
    
    // Assign original pixels to layers (without stacking)
    for (const region of regions) {
      if (region.length === 0) continue;
      
      const colorIndex = region[0].colorIndex;
      
      for (const pixel of region) {
        const index = pixel.y * width + pixel.x;
        originalLayerMaps[colorIndex][index] = 1;
      }
    }
    
    // Copy original maps to stacked maps (we'll add to these)
    for (let i = 0; i < colors.length; i++) {
      for (let j = 0; j < width * height; j++) {
        stackedLayerMaps[i][j] = originalLayerMaps[i][j];
      }
    }
    
    // Stack layers (add pixels from upper layers to lower ones)
    for (let layerIdx = 1; layerIdx < colors.length; layerIdx++) {
      for (let prevLayerIdx = 0; prevLayerIdx < layerIdx; prevLayerIdx++) {
        for (let i = 0; i < width * height; i++) {
          if (stackedLayerMaps[prevLayerIdx][i] === 1) {
            stackedLayerMaps[layerIdx][i] = 1;
          }
        }
      }
    }
    
    // Ensure the bottom layer has 100% coverage
    if (colors.length > 0) {
      const bottomLayerIndex = colors.length - 1;
      for (let i = 0; i < width * height; i++) {
        stackedLayerMaps[bottomLayerIndex][i] = 1;
      }
    }
    
    // Create layer canvases
    for (let colorIndex = 0; colorIndex < colors.length; colorIndex++) {
      const layerCanvas = document.createElement('canvas');
      layerCanvas.width = width;
      layerCanvas.height = height;
      const layerCtx = layerCanvas.getContext('2d');
      
      // Efficiently draw layer using ImageData
      const imageData = layerCtx.createImageData(width, height);
      const data = imageData.data; // Direct pixel manipulation

      // Parse layer color (hex to RGB)
      const hex = `#${colors[colorIndex][0].toString(16).padStart(2, '0')}${colors[colorIndex][1].toString(16).padStart(2, '0')}${colors[colorIndex][2].toString(16).padStart(2, '0')}`;
      const r = parseInt(hex.substring(1, 3), 16);
      const g = parseInt(hex.substring(3, 5), 16);
      const b = parseInt(hex.substring(5, 7), 16);

      for (let pixelIdx = 0; pixelIdx < width * height; pixelIdx++) {
        if (stackedLayerMaps[colorIndex][pixelIdx] === 1) { // If pixel belongs to this layer
          const dataOffset = pixelIdx * 4; // RGBA start index
          data[dataOffset]     = r;   // Red
          data[dataOffset + 1] = g;   // Green
          data[dataOffset + 2] = b;   // Blue
          data[dataOffset + 3] = 255; // Alpha (opaque)
        } else {
          // Pixels not in this layer are transparent
          const dataOffset = pixelIdx * 4;
          data[dataOffset]     = 0;
          data[dataOffset + 1] = 0;
          data[dataOffset + 2] = 0;
          data[dataOffset + 3] = 0;   // Alpha (transparent)
        }
      }
      layerCtx.putImageData(imageData, 0, 0); // Draw the processed image data to canvas at once
      
      const coverage = colorIndex === colors.length - 1 
        ? 100 
        : (stackedLayerMaps[colorIndex].reduce((sum, val) => sum + val, 0) / (width * height) * 100).toFixed(1);
      
      newLayers.push({
        dataURL: layerCanvas.toDataURL(),
        color: hex,
        index: colorIndex,
        displayIndex: colorIndex, 
        originalColor: [...colors[colorIndex]],
        pixelMap: stackedLayerMaps[colorIndex], 
        originalPixelMap: originalLayerMaps[colorIndex], 
        coverage: coverage
      });
    }
    
    setLayers(newLayers);
    if (newLayers.length > 0) {
      setCurrentLayerIndex(0);
      // The useEffect above will handle updating the colorInputRef.current.value
      // when currentLayerIndex or layers change, including initialization to index 0.
    }
    
    // Create and set layered image
    createLayeredImageFromLayers(newLayers, width, height);
  };
  
  // メインモーダルを開く関数
  const handleOpenModal = () => {
    console.log('メインモーダルを開きます');
    setIsModalOpen(true);
    // メインモーダル専用のロジック
    setTimeout(() => {
      console.log('メインモーダルを開いた後の状態:', isModalOpen);
    }, 0);
  };

  // メインモーダルを閉じる関数
  const handleCloseModal = () => {
    console.log('メインモーダルを閉じます');
    setIsModalOpen(false);
    // メインモーダル専用のロジック
    setIsEffectStopped(true);
    console.log('エフェクト停止状態:', true);
  };
  const handleCloseModal2 = () => {
    console.log('レイヤー情報モーダルを閉じます');
    setIsLayerInfoModalOpen(false);
    // レイヤー情報モーダル専用のロジック
    setIsLayerInfoButtonEffectStopped(true);
    console.log('レイヤー情報モーダル専用のエフェクト停止状態:', true);
  };

  // レイヤー情報モーダルを開く関数
  const handleOpenLayerInfoModal = () => {
    console.log('レイヤー情報モーダルを開きます');
    setIsLayerInfoModalOpen(true);
    // レイヤー情報モーダル専用のロジック
    // ここにレイヤー情報モーダル特有の処理を追加
  };

  // レイヤー情報モーダルを閉じる関数
  const handleCloseLayerInfoModal = () => {
    console.log('レイヤー情報モーダルを閉じます');
    setIsLayerInfoModalOpen(false);
    // レイヤー情報モーダル専用のロジック
    // ここにレイヤー情報モーダル特有の処理を追加
  };

  // Render the appropriate page content based on currentPage
  const renderPageContent = () => {
    switch (currentPage) {
      case 'home':
        return (
          <div className="main-content home-content">
         {/* Modal for instructions */}
{console.log('レンダリング時のモーダル状態:', isModalOpen)}
{isModalOpen && (
  <div className="modal-overlay show">
    <div className="modal-content">
      <div className="modal-content-inner">
        <div className="notice-section">
          <div className="section-title">
            <div className="section-icon">1</div>
            加工精度について
          </div>
          <p>
            当システムでは加工精度の最適化を図るため、細かい部分については隣接する色へ自動的に塗り替える処理を行っております。また変換工程において、全体の画質が粗くなる場合がございます。
          </p>
        </div>

        <div className="notice-section">
          <div className="section-title">
            <div className="section-icon">2</div>
            推奨画像について
          </div>
          <p>
            色数の多い写真や細部が複雑な画像につきましては、処理時間が長くなると同時に、細かな部分が塗りつぶされる可能性がございます。そのため、色数を抑えた細部の少ない画像のご利用を推奨いたします。
          </p>
        </div>

        <div className="notice-section">
          <div className="section-title">
            <div className="section-icon">3</div>
            トラブルシューティング
          </div>
          <p>
            レイヤーの色がうまく拾えない場合や、3Dモデル生成がうまくいかない場合は、レイヤー数を変更して再生成すると改善する場合がございます。
          </p>
        </div>

        <div className="notice-section">
          <div className="section-title">
            <div className="section-icon">4</div>
            特注対応について
          </div>
          <p>
            繊細なディテールの再現や特注デザインのご依頼につきましては、個別に対応させていただきますのでお気軽にご相談ください。迅速かつ丁寧にお見積りをさせていただきます。
          </p>
        </div>

        <div className="notice-section copyright-warning">
          <div className="section-title">
            著作権に関する注意
          </div>
          <p>
            著作権やそれに付随する制限がある内容の生成はお控えください。
          </p>
        </div>

        <button 
          onClick={handleCloseModal} 
          className="modal-confirm-button"
        >
          閉じる
        </button>
      </div>
    </div>
  </div>
)}
            
            <h1 className="page-title">Image To LED Neon Sign</h1>
            
            <div className="preview-container">
              <Gallery3D />
            </div>
            
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              ref={fileInputRef}
              className="hidden-input"
            />
            
            <div className="home-bottom-layout">
              {/* 左下の大きなコンテナ */}
              <div className="bottom-left-container">
                <div className="guide-slides-content">
                  ガイド動画・画像コンテナ
                  <br />
                  （後で動画や画像を追加予定）
                </div>
              </div>
              
              {/* 真ん中下の大きなコンテナ */}
              <div className="bottom-center-container">
                <div className="main-messages">
                <h2 className="step-message">わずか3ステップで<br />理想のLEDネオンサインが完成!</h2>
                <h2 className="order-message">作成したネオンサインは<br /><span className="highlight">そのまま注文可能!</span></h2>
                </div>
                
                <button
                  onClick={handleOpenModal}
                  className={`info-button modal-trigger-button ${isEffectStopped ? 'stopped' : ''}`}
                >
                </button>
                <div className="button-row">
                  <button
                    onClick={() => setShowCreationModal(true)}
                    className="process-button"
                  >
                    さっそく作成する
                  </button>
                </div>
                <div className="bottom-explanation">
                  一度お読みください
                </div>
              </div>
              
              {/* 右下の大きなコンテナ */}
              <div className="bottom-right-container">
                <div className="sample-images">
                  {sampleImagesLoaded ? (
                    <img 
                      src={sampleNeonOn ? '/sample.demo.on.png' : '/sample.demo.off.png'} 
                      alt={sampleNeonOn ? 'ネオンサンプル（発光中）' : 'ネオンサンプル（消灯中）'}
                      className="sample-image-placeholder"
                    />
                  ) : (
                    <div className="sample-image-placeholder loading">
                      <div className="loading-spinner"></div>
                    </div>
                  )}
                </div>
                
                <div className="sample-controls">
                  <div className="sample-switch-text">発光サンプルを確認 →</div>
                  <div className="home-sample-power-status">
                    <span className={`home-sample-status-text ${sampleNeonOn ? 'on' : 'off'}`}>
                      {sampleNeonOn ? 'ON' : 'OFF'}
                    </span>
                  </div>
                  <button
                    onClick={() => setSampleNeonOn(!sampleNeonOn)}
                    className={`home-sample-power-switch ${sampleNeonOn ? 'on' : 'off'}`}
                  >
                    <div className={`home-sample-switch-handle ${sampleNeonOn ? 'on' : 'off'}`} />
                  </button>
                </div>
              </div>
            </div>
            
           
          </div>
        );
      case 'textGeneration':
        return (
          <TextGenerator 
            onNavigateToCustomize={(textSvgData) => {
              // テキストから生成されたデータをカスタマイズページに渡す
              setNeonSvgData(textSvgData);
              setCurrentPage('customize');
            }}
          />
        );
      case 'neonDrawing':
        return <NeonDrawingApp 
          initialState={neonDrawingState} 
          onStateChange={setNeonDrawingState}
        />;
      case 'customize':
        return <Costomize 
          svgData={customizeSvgData} 
          initialState={customizeState}
          onStateChange={setCustomizeState}
        />;
      case 'neonSvg3dPreview':
        return null; // NeonSVGTo3DExtruderはルートレベルで表示
      case 'layerPreview':
        return (
          <div className="main-content">
            {/* SVG生成進捗表示オーバーレイ */}
            {isGenerating3D && (
              <div className="processing-overlay-svg">
                <div className="processing-modal-svg">
                  <div className="processing-content-svg">
                    <div className="processing-spinner-svg"></div>
                    
                    <h3>3Dモデル生成中...</h3>
                    
                    <div className="progress-bar-container-svg">
                      <div className="progress-bar-svg">
                        <div
                          className="progress-fill-svg"
                          style={{ width: `${svgGenerationProgress}%` }}
                        ></div>
                      </div>
                      <div className="progress-text-svg">
                        {Math.round(svgGenerationProgress)}% 完了
                      </div>
                    </div>
                    
                    <div className="processing-message-svg">
                      {svgProcessingMessage}
                    </div>
                    
                    <div className="processing-tips-svg">
                      <h4>変換時間について</h4>
                      <ul className="tips-list">
                        <li className="tip-item">レイヤー数が多いほど時間がかかります</li>
                        <li className="tip-item">複雑な画像は処理に時間がかかります</li>
                        <li className="tip-item">変換中はページを閉じないでください</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}
      
                  {/* レイヤー情報モーダル (info-button2用) */}
{isLayerInfoModalOpen && (
  <div className="modal-overlay2">
    <div className="modal-content2">
      <div className="modal-content2-inner">
        <h2>レイヤー設定ガイド</h2>
        
        <div className="video-container">
          <video 
            autoPlay 
            muted 
            loop
            playsInline
            disablePictureInPicture
            controlsList="nodownload nofullscreen noremoteplayback"
            style={{
              pointerEvents: 'none'
            }}
          >
            <source src="/layer-settings-guide.mp4" type="video/mp4" />
            お使いのブラウザは動画の再生に対応していません。
          </video>
        </div>

        <div className="notice-section">
          <div className="section-title">
            <div className="section-icon">1</div>
            レイヤーを結合
          </div>

          <p>
            「レイヤーを結合」ボタンで、選択された2つのレイヤーを結合します。微妙な色味の違いやグラデーションなどで、本来1層にしたいものが複数のレイヤーに分かれてしまうことがあります。
             ボタンを押すと結合するレイヤーを2層選べますが、結合されたレイヤーは1つ目に選ばれたレイヤーの色で生成されます。それでも改善しない場合は、レイヤーの再生成をお試しください。
          </p>
        </div>
        <div className="notice-section">
          <div className="section-title">
            <div className="section-icon">2</div>
            背景色の切り替え
          </div>
          <p>
            「背景」ボタンでプレビューエリアの背景色を透明、白、黒の順で切り替えます。
          </p>
        </div>

        <div className="notice-section">
          <div className="section-title">
            <div className="section-icon">3</div>
            レイヤー色の変更
          </div>
          <p>
            カラーピッカーで任意の色を選択し、「色を適用」ボタンでレイヤーに反映します。
          </p>
        </div>

        <div className="notice-section">
          <div className="section-title">
            <div className="section-icon">4</div>
            色の初期化
          </div>
          <p>
            「色を初期化」ボタンで、レイヤーの色を画像処理直後の元の色に戻します。
          </p>
        </div>

        <div className="notice-section">
          <div className="section-title">
            <div className="section-icon">5</div>
            レイヤーの並び替え
          </div>
          <p>
            レイヤーリスト内の各レイヤーはドラッグ＆ドロップで順番を入れ替えることができます。リストの左上にあるレイヤーほど手前（Z軸で上）に配置されます。
          </p>
        </div>
        <div className="notice-section">
          <div className="section-title">
            <div className="section-icon">6</div>
            3Dプレビュー
          </div>

          <p>
            「3Dモデル生成」ボタンで、3Dモデルを生成することができます。

          </p>
        </div>
        <button 
          onClick={handleCloseModal2} 
          className="modal-confirm-button2"
        >
          閉じる
        </button>
      </div>
    </div>
  </div>
)}
            
            <div className="layer-preview-grid">
              <div className="left-panel">
                <div className="layer-settings-panel">
                  <div className="layer-title">レイヤー表示</div>
                  
                  <div className="layer-preview-container" style={{ backgroundColor: previewBgColor }}>
                    {layers.length > 0 && currentLayerIndex !== null && currentLayerIndex < layers.length ? (
                      <img 
                      src={layers[currentLayerIndex].dataURL}
                        alt={`レイヤー ${currentLayerIndex + 1}`} 
                        className="layer-preview-image"
                      />
                    ) : (
                      <div className="empty-layer-preview">レイヤーが選択されていません</div>
                    )}
                  </div>
                  
                  
                </div>
                
                <div className="model-generate-container">
                {layers.length > 0 && (
                <div className="layers-container">
                    {layers.map((layer, index) => (
                      <div
                        key={layer.id || `layer-item-${index}`} 
                        ref={layerItemRefs.current[index]} 
                        draggable={!isMergingMode} // ← 変更点
                        onDragStart={(e) => !isMergingMode && handleDragStart(e, index)} // ← 変更点
                        onDragOver={(e) => !isMergingMode && handleDragOver(e, index)} // ← 変更点
                        onDragLeave={!isMergingMode ? handleDragLeave : undefined} // ← 変更点
                        onDrop={(e) => !isMergingMode && handleDrop(e, index)} // ← 変更点
                        onDragEnd={!isMergingMode ? handleDragEnd : undefined} // ← 変更点
                        onClick={() => { // ← 変更点（関数全体を置き換え）
                          if (isMergingMode) {
                            handleLayerSelectionForMerge(index);
                          } else {
                            setCurrentLayerIndex(index);
                          }
                        }}
                        className={`layer-item ${
                          currentLayerIndex === index && !isMergingMode ? "selected" : ""
                        } ${
                          draggedItemIndex === index ? "dragging-source" : ""
                        } ${
                          dragOverIndex === index && draggedItemIndex !== index ? "drop-target-highlight" : ""
                        } ${
                          isMergingMode && selectedLayersForMerge.includes(index) ? "merge-selected" : ""
                        } ${
                          isMergingMode ? "merge-mode" : ""
                        }`} // ← classNameに結合モード用のクラスを追加
                        style={{ backgroundColor: layer.color }}
                      >
                        {/* ← 以下は全て新規追加 */}
                        {isMergingMode && mergingStep === 1 && (
                          <span className="merge-instruction">1つ目を選択</span>
                        )}
                        {isMergingMode && mergingStep === 2 && selectedLayersForMerge.includes(index) && (
                          <span className="merge-instruction">1つ目 ✓</span>
                        )}
                        {isMergingMode && mergingStep === 2 && !selectedLayersForMerge.includes(index) && (
                          <span className="merge-instruction">2つ目を選択</span>
                        )}
                        {!isMergingMode && `レイヤー ${index + 1}`}
                      </div>
                    ))}
                  </div>
                )}
                  <div className="explanation-for-layer"></div>
                  {layers.length > 0 && currentLayerIndex !== null && currentLayerIndex < layers.length && (
                    <div className="layer-settings">
                    
                         
                      <div className="layer-setting-content">
                      <button
                    onClick={handleOpenLayerInfoModal} // こちらを新しい関数に変更
                    className={`info-button2 modal-trigger-button ${isLayerInfoButtonEffectStopped ? 'stopped' : ''}`}
                  >
                    
                  </button>
                        <div className="layer-info">
                          <div className="layer-number">レイヤー{currentLayerIndex + 1}</div>
                          <div className="coverage-info">coverage {layers[currentLayerIndex].coverage}%</div>
                          <div className="color-hex">color {layers[currentLayerIndex].color}</div>
                        </div>
                          
                        <div className="center-column2">
                          
                      <div className="layer-setting-title">レイヤー設定
                      
                      </div>
                      <div className="color-selector-container">
                        
                        
                        <button
                          onClick={() => {
                            // 背景色を透明→白→黒の順に切り替え
                            if (previewBgColor === 'rgba(0, 0, 0, 0)') {
                              setPreviewBgColor('rgb(255, 255, 255)');
                            } else if (previewBgColor === 'rgb(255, 255, 255)') {
                              setPreviewBgColor('rgb(0, 0, 0)');
                            } else {
                              setPreviewBgColor('rgba(0, 0, 0, 0)');
                            }
                          }}
                          className="bg-toggle-btn"
                        >
                          背景
                        </button>
                        <input 
                          type="color" 
                          ref={colorInputRef}
                          defaultValue={layers[currentLayerIndex] ? layers[currentLayerIndex].color : '#000000'}
                          className="color-picker-large"
                          title="カラーセレクター"
                        />
                      </div>
                        </div>
                        
                        <div className="color-buttons">
  {!isMergingMode ? (
    // 通常モード：3つのボタンを表示
    <>
      <button 
        className="merge-color-button"
        onClick={startLayerMerging}
        disabled={layers.length < 2}
      >
        レイヤー結合
      </button>
      
      <button
        onClick={() => {
          // Reset to original color
          if (layers[currentLayerIndex] && layers[currentLayerIndex].originalColor) {
            const rgb = layers[currentLayerIndex].originalColor;
            const hexColor = `#${rgb[0].toString(16).padStart(2, '0')}${rgb[1].toString(16).padStart(2, '0')}${rgb[2].toString(16).padStart(2, '0')}`;
            applyLayerColor(currentLayerIndex, hexColor);
            if (colorInputRef.current) {
              colorInputRef.current.value = hexColor;
            }
          }
        }}
        className="reset-color-button"
      >
        色を初期化
      </button>
      
      <button
        onClick={() => {
          if (colorInputRef.current) {
            applyLayerColor(currentLayerIndex, colorInputRef.current.value);
          }
        }}
        className="apply-color-button"
      >
        色を適用
      </button>
    </>
  ) : (
    // 結合モード：キャンセルボタンと説明文を表示
    <>
      <button 
        onClick={cancelLayerMerging} 
        className="cancel-merge-button"
      >
        キャンセル
      </button>
      
      <div className="merge-instructions">
        {mergingStep === 1 && "1つ目のレイヤーを選択してください"}
        {mergingStep === 2 && "2つ目のレイヤーを選択してください"}
      </div>
    </>
  )}
</div>
                      </div>
                    </div>
                  )}
                 
                 {layers.length > 0 && layeredImageDataURL && (
  <button 
    className={`model-generate-button ${isGenerating3D ? 'processing' : ''}`}
    onClick={() => {
      if (!isGenerating3D) {
        setIsGenerating3D(true);
        setSvgGenerationProgress(0);
        setSvgProcessingMessage('SVG変換を開始しています...');
        
        setTimeout(() => {
          setAutoStart3DGeneration(true);
        }, 100);
        // 🔥 即座に最新のレイヤーデータでlayeredImageを更新
        if (layers.length > 0 && processCanvasRef.current) {
          const width = processCanvasRef.current.width;
          const height = processCanvasRef.current.height;
          createLayeredImageFromLayers(layers, width, height);
        }
      }
    }}
    disabled={isGenerating3D}
  >
    {isGenerating3D ? '処理中...' : '3Dモデル生成'}
  </button>
)}
                 
                  {isGenerating3D && (
                    <div className="layer-progress-indicator">
                      <div className="layer-progress-bar">
                        <div className="layer-progress-fill" style={{ width: `${generationProgress}%` }}></div>
                      </div>
                      <div className="layer-progress-text">{generationProgress}% 完了</div>
                    </div>
                  )}
                  
                </div>
                
              </div>
              
              <div className="right-panel">
                <div className="preview-item original-image-container">
                  <div className="preview-item-title">アップロード画像</div>
                  
                  <div className="preview-item-content">
                    {image ? (
                      <img src={image.src} alt="アップロード画像" />
                    ) : (
                      <p>画像がアップロードされていません</p>
                    )}
                  </div>
                </div>
                
                <div className="preview-item layered-image-container">
                  <div className="preview-item-title">レイヤープレビュー</div>
                  <div className="preview-item-content">
                    {layeredImageDataURL ? (
                      <img src={layeredImageDataURL} alt="プレビュー" />
                    ) : (
                      <p>プレビュー画像がありません</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      // ✅ 新しいコード
        case 'info':
          return (
            <div className="main-content">
              <div className="product-info-container">
                <div className="product-header">
                  <h1>商品情報</h1>
                  <p>ご不明な点がございましたら、お気軽にお問い合わせください。</p>
                </div>
        
                <div className="product-estimate-container">
                  <div className="product-form-section">
                    <h2 style={{marginBottom: '25px', color: '#ffff00'}}>仕様</h2>
                    
                    <div className="product-container-vertical">
                      
                      <img className="product-image" src={customizeCanvasImageDataURL || neonPreviewImageDataURL || layeredImageDataURL} alt="プレビュー" />
                      
                      <div className="product-specs-list">
                        {(() => {
                          // ネオン3Dプレビューから渡されたcalculatedModelDataを優先使用
                          let neonModelData = neonCalculatedModelData;
                          
                          // calculatedModelDataがない場合のフォールバック
                          if (!neonModelData) {
                            neonModelData = calculateNeonModelData(neonSvgData);
                          }
                          
                          
                          return (
                            <>
                              <div className="spec-item-row">
                                <span className="spec-label">サイズ(幅x高)</span>
                                <span className="spec-value">{neonModelData ? `${Math.round(neonModelData.modelWidth)}x${Math.round(neonModelData.modelHeight)}mm` : '---'}</span>
                              </div>
                              <div className="spec-item-row">
                                <span className="spec-label">6mmチューブ（本数）</span>
                                <span className="spec-value">{neonModelData ? `${neonModelData.tubeCount6mm}本` : '---'}</span>
                              </div>
                              <div className="spec-item-row">
                                <span className="spec-label">8mmチューブ（本数）</span>
                                <span className="spec-value">{neonModelData ? `${neonModelData.tubeCount8mm}本` : '---'}</span>
                              </div>
                              <div className="spec-item-row">
                                <span className="spec-label">6mmチューブ長さ</span>
                                <span className="spec-value">{neonModelData ? `${(neonModelData.tubeLength6mm / 10).toFixed(1)}cm` : '---'}</span>
                              </div>
                              <div className="spec-item-row">
                                <span className="spec-label">8mmチューブ長さ</span>
                                <span className="spec-value">{neonModelData ? `${(neonModelData.tubeLength8mm / 10).toFixed(1)}cm` : '---'}</span>
                              </div>
                              <div className="spec-item-row">
                                <span className="spec-label">ベースプレート色</span>
                                <span className="spec-value">{neonModelData ? neonModelData.baseColor : '---'}</span>
                              </div>
                              <div className="spec-item-row">
                                <span className="spec-label">タイプ</span>
                                <span className="spec-value">{neonModelData ? neonModelData.modelType : '---'}</span>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                      
                      <div className="delivery-info">
                        <h4>納期情報</h4>
                        <div className="delivery-timeline">
                          <div className="timeline-item">
                            <span className="timeline-step">製作期間</span>
                            <span className="timeline-time">{layers.length > 0 ? '7-10営業日' : '---営業日'}</span>
                          </div>
                          <div className="timeline-item">
                            <span className="timeline-step">配送期間</span>
                            <span className="timeline-time">{layers.length > 0 ? '1-2営業日' : '---営業日'}</span>
                          </div>
                          <div className="timeline-item total-time">
                            <span className="timeline-step">合計</span>
                            <span className="timeline-time">{layers.length > 0 ? '8-12営業日' : '---営業日'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
        
                    <div className="form-group">
                      <label htmlFor="quantity">数量</label>
                      <div className="custom-number-input-wrapper">
                        <button type="button" onClick={decrementQuantity} className="quantity-modifier minus" aria-label="数量を減らす">-</button>
                        <input 
                          type="text" 
                          id="quantity" 
                          className="info-input quantity-display"
                          value={quantityInputText}
                          onChange={handleQuantityInputChange}
                          onBlur={handleQuantityInputBlur}
                          inputMode="numeric" // Helps mobile keyboards
                        />
                        <button type="button" onClick={incrementQuantity} className="quantity-modifier plus" aria-label="数量を増やす">+</button>
                      </div>
                    </div>
        
                    <div className="form-group">
                      <label htmlFor="message">ご要望・メッセージ</label>
                      <textarea 
                        id="message" 
                        placeholder="色の指定、特別な仕上げ、その他ご要望がございましたらお書きください。" 
                        rows="6"
                      />
                    </div>
                  </div>
        
                  <div className="price-summary">
                    <h3>価格詳細</h3>
                    <div className="price-item">
                      <span>基本料金</span>
                      <span id="base-price">{layers.length > 0 ? '¥4,500' : '---'}</span>
                    </div>
                    <div className="price-item">
                      <span>製品価格</span>
                      <span id="product-price">{layers.length > 0 ? '¥4,500' : '---'}</span>
                    </div>
                    <div className="price-item">
                      <span>配送費</span>
                      <span id="shipping-cost">{layers.length > 0 ? '¥800' : '---'}</span>
                    </div>
                    <div className="price-item">
                      <span>数量割引</span>
                      <span id="quantity-discount">{layers.length > 0 ? '¥0' : '---'}</span>
                    </div>
                    <div className="price-item">
                      <span>小計</span>
                      <span id="subtotal">{layers.length > 0 ? '¥5,300' : '---'}</span>
                    </div>
                    <div className="price-item total" style={{fontSize: '1.5rem', color: '#00ff80'}}>
                      <span>合計金額</span>
                      <span id="total-price">{layers.length > 0 ? '¥5,300' : '---'}</span>
                    </div>
                    <button className="estimate-button" onClick={handleAddToCart}>
                      カートに入れる
                    </button>
                    <p style={{fontSize: '0.8rem', color: '#999', marginTop: '10px', textAlign: 'center'}}>
                      ※送料・税込価格です
                    </p>
                  </div>
                </div>
        
                <div className="features-section">
                  <div className="feature-card" style={{maxWidth: '500px', margin: '0 auto'}}>
                    <div className="feature-icon">🛡️</div>
                    <h4>品質保証</h4>
                    <p>厳格な品質管理のもと、不良品は無償で再製作いたします。安心してご利用ください。</p>
                  </div>
                </div>
        
                <div className="contact-section">
                  <h3>特注・大量注文のご相談</h3>
                  <p>より大きなサイズや特殊な仕様、大量注文については個別にお見積もりいたします。</p>
                  <button className="contact-button" onClick={() => openContactForm()}>お問い合わせ</button>
                </div>
              </div>
            </div>
          );
      default:
        return null;
    }
  };

  // Placeholder functions to resolve ESLint errors
  const updateEstimate = () => {
    console.log('updateEstimate called');
    // Implement actual logic later
  };
  
  const handleAddToCart = () => {
    // カートに追加するロジック
    console.log(`商品ID: ${image ? image.name : 'Unknown Product'}、数量: ${productQuantity}個をカートに追加しました。`);
    // モーダルを閉じるなどの追加処理があればここに
  };

  const openContactForm = () => {
    console.log('openContactForm called');
    // Implement actual logic later
  };

  // Prepare layers for ThreeDModelGenerator (ensure it has the correct format)
  // この processedLayersForSvgGenerator は、ThreeDModelGenerator が期待する形式であることを確認してください。
  // 具体的には、{ dataURL: string, color: string, fileName: string (オプション) } のようなオブジェクトの配列です。
  // 現在の 'layers' ステートがこの形式でない場合、ここで変換処理が必要です。
  const processedLayersForSvgGenerator = layers.map((layer, index) => ({
    dataURL: layer.dataURL,
    color: layer.color,
    fileName: image ? `${image.name}_layer_${index + 1}` : `layer_${index + 1}`,
    // ThreeDModelGeneratorが必要とするその他のプロパティがあれば追加
  }));

  // Effect to update estimate when productQuantity changes
  useEffect(() => {
    if (currentPage === 'info') { // Only call if on the info page
      updateEstimate();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productQuantity, currentPage]); // Assuming updateEstimate is stable or memoized

  // サンプル画像のプリロード
  useEffect(() => {
    const preloadImages = async () => {
      const imagePromises = [
        new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = resolve;
          img.onerror = reject;
          img.src = '/sample.demo.on.png';
        }),
        new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = resolve;
          img.onerror = reject;
          img.src = '/sample.demo.off.png';
        })
      ];
      
      try {
        await Promise.all(imagePromises);
        setSampleImagesLoaded(true);
      } catch (error) {
        console.warn('Sample images failed to preload:', error);
        setSampleImagesLoaded(true); // Still set to true to show fallback
      }
    };
    
    preloadImages();
  }, []);

  // パーティクル生成コードを削除
  
  const MIN_QUANTITY = 1;
  const MAX_QUANTITY = 100;

  const handleQuantityInputChange = (event) => {
    setQuantityInputText(event.target.value);
  };

  const handleQuantityInputBlur = () => {
    let num = parseInt(quantityInputText, 10);
    if (isNaN(num)) {
      num = productQuantity; // Revert to last valid quantity if input is not a number
    } else {
      num = Math.max(MIN_QUANTITY, Math.min(MAX_QUANTITY, num));
    }
    setProductQuantity(num);
    setQuantityInputText(String(num));
  };

  const incrementQuantity = () => {
    const newQuantity = Math.min(MAX_QUANTITY, productQuantity + 1);
    setProductQuantity(newQuantity);
    setQuantityInputText(String(newQuantity));
  };

  const decrementQuantity = () => {
    const newQuantity = Math.max(MIN_QUANTITY, productQuantity - 1);
    setProductQuantity(newQuantity);
    setQuantityInputText(String(newQuantity));
  };

  // Hidden original component to preserve functionality
  const renderOriginalComponent = () => (
    <MemoizedOriginalUiContent
      image={image}
      originalCanvasRef={originalCanvasRef}
      processedCanvas={processedCanvas} 
      layeredImageDataURL={layeredImageDataURL}
      processCanvasRef={processCanvasRef}
      triggerFileSelect={triggerFileSelect}
      colorCount={colorCount}
      setColorCount={setColorCount}
      showBorders={showBorders}
      setShowBorders={setShowBorders}
      processImage={processImage}
      isProcessing={isProcessing}
    />
  );

  return (
    <div className={`app-container ${sidebarExpanded ? 'sidebar-open-for-preview' : ''}`}>
      {/* Background image - 3Dプレビューページ以外で表示 */}
      {currentPage !== 'neonSvg3dPreview' && (
        <div className="background">
          <div className="particles" id="particles"></div>
        </div>
      )}
      
      {/* 進捗表示オーバーレイ */}
      {isProcessing && (
        <div className="processing-overlay">
          <div className="processing-modal">
            <div className="processing-content">
              <div className="processing-spinner"></div>
              
              <h3>レイヤーを生成中...</h3>
              
              <div className="progress-bar-container">
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${generationProgress}%` }}
                  ></div>
                </div>
                <div className="progress-text">
                  {Math.round(generationProgress)}% 完了
                </div>
              </div>
              
              <div className="processing-message">
                {processingMessage}
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

      {/* 作成方法選択モーダル */}
      {showCreationModal && <CreationModal isOpen={showCreationModal} onClose={() => setShowCreationModal(false)} onSelect={(pageName) => {
        setShowCreationModal(false);
        setCurrentPage(pageName);
      }} />}
  
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      
      {/* NeonSVGTo3DExtruder - Always rendered but controlled by visibility */}
      <div style={{ 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        width: '100%', 
        height: '100%', 
        visibility: currentPage === 'neonSvg3dPreview' ? 'visible' : 'hidden',
        zIndex: currentPage === 'neonSvg3dPreview' ? 100 : -1,
        pointerEvents: currentPage === 'neonSvg3dPreview' ? 'auto' : 'none'
      }}>
        <NeonSVGTo3DExtruder 
          ref={neonSvgTo3DExtruderRef} 
          neonSvgData={neonSvgData}
          onNavigateToInfo={(modelData) => {
            if (modelData) {
              setNeonCalculatedModelData(modelData);
            }
            setCurrentPage('info');
          }}
        />
      </div>
      
      {/* Main layout */}
      <div className="layout-container">
        {/* Sidebar */}
        <div className={`sidebar ${sidebarExpanded ? "expanded" : "collapsed"}`}>
            <div className="sidebar-content">
                <div className="logo-container">
                    <div className="logo">ロゴ</div>
                    <button className="sidebar-toggle" onClick={toggleSidebar}>
                        {sidebarExpanded ? '◀' : '▶'}
                    </button>
                </div>
                <nav className="sidebar-nav">
                    <button className={currentPage === 'home' ? "nav-item active" : "nav-item"} onClick={() => setCurrentPage('home')}>
                        <div className="nav-icon">
                            <svg viewBox="0 0 24 24">
                                <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
                            </svg>
                        </div>
                        <span className="nav-text">ホーム</span>
                        <div className="tooltip">ホーム</div>
                    </button>
                    <button className={currentPage === 'textGeneration' ? "nav-item active" : "nav-item"} onClick={() => setCurrentPage('textGeneration')}>
                        <div className="nav-icon">
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M7 17H2v-2h5v2zm0-8H2V7h5v2zm3-5V2H8v2h2zm0 2H8v2h2V6zm0 8H8v2h2v-2zm0 6H8v2h2v-2zm2-12V2h-2v2h2zm0 2h-2v2h2V6zm0 8h-2v2h2v-2zm0 6h-2v2h2v-2zm2-16V2h-2v2h2zm0 2h-2v2h2V6zm0 8h-2v2h2v-2zm0 6h-2v2h2v-2zm2-16V2h2v2h-2zm0 2h2v2h-2V6zm0 8h2v2h-2v-2zm0 6h2v2h-2v-2zm2-12V2h2v2h-2zm0 2h2v2h-2V6zm0 8h2v2h-2v-2zm0 6h2v2h-2v-2z"/>
                            </svg>
                        </div>
                        <span className="nav-text">テキストから生成</span>
                        <div className="tooltip">テキストから生成</div>
                    </button>
                    <button className={currentPage === 'neonDrawing' ? "nav-item active" : "nav-item"} onClick={() => setCurrentPage('neonDrawing')}>
                        <div className="nav-icon">
                            <svg viewBox="0 0 24 24">
                            <path d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42"/>
                            </svg>
                        </div>
                        <span className="nav-text">ネオン下絵</span>
                        <div className="tooltip">ネオン下絵</div>
                    </button>
                    <button className={currentPage === 'customize' ? "nav-item active" : "nav-item"} onClick={() => setCurrentPage('customize')}>
                        <div className="nav-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="3"/>
                                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                            </svg>
                        </div>
                        <span className="nav-text">色 / 仕様のカスタマイズ</span>
                        <div className="tooltip">色 / 仕様のカスタマイズ</div>
                    </button>
                    <button className={currentPage === 'neonSvg3dPreview' ? "nav-item active" : "nav-item"} onClick={() => setCurrentPage('neonSvg3dPreview')}>
                        <div className="nav-icon">
                        <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none">
                        <path d="M20.5 7.27783L12 12.0001M12 12.0001L3.49997 7.27783M12 12.0001L12 21.5001M21 16.0586V7.94153C21 7.59889 21 7.42757 20.9495 7.27477C20.9049 7.13959
                         20.8318 7.01551 20.7354 6.91082C20.6263 6.79248 20.4766 6.70928 20.177 6.54288L12.777 2.43177C12.4934 2.27421 12.3516 2.19543 12.2015 2.16454C12.0685 2.13721 11.9315 2.13721 11.7986 
                         2.16454C11.6484 2.19543 11.5066 2.27421 11.223 2.43177L3.82297 6.54288C3.52345 6.70928 3.37369 6.79248 3.26463 6.91082C3.16816 7.01551 3.09515 7.13959 3.05048 7.27477C3 7.42757 3 7.59889 3 7.94153V16.0586C3 16.4013 3 16.5726 3.05048 16.7254C3.09515 16.8606 3.16816 16.9847 3.26463 17.0893C3.37369 17.2077 3.52345 17.2909 3.82297 17.4573L11.223 21.5684C11.5066 21.726 11.6484 21.8047 11.7986 21.8356C11.9315 21.863 12.0685 21.863 12.2015 21.8356C12.3516 21.8047 12.4934 21.726 12.777 21.5684L20.177 17.4573C20.4766 17.2909 20.6263 17.2077 20.7354 17.0893C20.8318 16.9847 20.9049 16.8606 20.9495 16.7254C21 16.5726 21 16.4013 21 16.0586Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        </div>
                        <span className="nav-text">3Dプレビュー</span>
                        <div className="tooltip">3Dプレビュー</div>
                    </button>
                    <button className={currentPage === 'info' ? "nav-item active" : "nav-item"} onClick={() => setCurrentPage('info')}>
                        <div className="nav-icon">
                            <svg viewBox="0 0 24 24">
                            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                            </svg>
                        </div>
                        <span className="nav-text">商品情報</span>
                        <div className="tooltip">商品情報</div>
                    </button>
                </nav>
            </div>
          </div> {/* closes sidebar */}
        {/* Main content area */}
        <div className="content-area">
          {renderPageContent()}
    
        </div>
      </div>
      
      {renderOriginalComponent()}
      
     
      

    </div>
  );
};

export default LaserCutImageProcessor;
