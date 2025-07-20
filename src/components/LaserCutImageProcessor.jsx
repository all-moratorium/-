import React, { useState, useEffect, useCallback, useRef, createRef } from 'react';
import './LaserCutImageProcessor_cleaned.css'; // 通常のCSSファイルをインポート
import Gallery3D from './Gallery3D';
import NeonDrawingApp from './NeonDrawingApp'; // ネオン下絵コンポーネントをインポート
import Costomize from './Costomize'; // カスタマイズコンポーネントをインポート
import NeonSVGTo3DExtruder from './NeonSVGTo3DExtruder'; // ネオンSVG3Dエクストルーダーコンポーネントをインポート
import TextGenerator from './TextGenerator'; // テキスト生成コンポーネントをインポート
import GuideModal from './GuideModal.jsx'; // ガイドモーダルコンポーネントをインポート
import HomeLeftBottm from './HomeLeftBottm.jsx'; // レビューコンポーネントをインポート




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
        { num: 'STEP 0', title: 'テキストから生成' },
        { num: 'STEP 1', title: '画像 / 下絵から生成' },
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
        '60種類以上のフォント選択と直感的な操作'
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
                            title="テキストから生成"
                            description="文字テキストのLEDネオンサインを作成したい方向け"
                            features={step0_features}
                            note="※生成したテキスト下絵は背景画像としてSTEP1の背景画像に読み込まれます"
                            onClick={() => onSelect('textGeneration')}
                            accentColor="yellow"
                        />
                        <ChoiceBox
                            stepTitle="STEP1"
                            title="画像 / 下絵から生成"
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
  
  // NeonDrawingAppの状態変更を処理する関数（パス削除・復活時の調整を含む）
  const handleNeonDrawingStateChange = useCallback((newState) => {
    // pathDeletedIndexが含まれている場合はCostomizeStateも調整
    if (newState && newState.pathDeletedIndex !== undefined) {
      const deletedIndex = newState.pathDeletedIndex;
      
      // CustomizeStateのpathColors, pathThicknessも調整
      if (customizeState) {
        const currentPathColors = customizeState.pathColors || {};
        const currentPathThickness = customizeState.pathThickness || {};
        
        // 削除インデックス以降のキーを1つずつ前にずらす
        const newPathColors = {};
        const newPathThickness = {};
        
        Object.keys(currentPathColors).forEach(key => {
          const index = parseInt(key);
          if (index < deletedIndex) {
            newPathColors[key] = currentPathColors[key];
          } else if (index > deletedIndex) {
            newPathColors[index - 1] = currentPathColors[key];
          }
        });
        
        Object.keys(currentPathThickness).forEach(key => {
          const index = parseInt(key);
          if (index < deletedIndex) {
            newPathThickness[key] = currentPathThickness[key];
          } else if (index > deletedIndex) {
            newPathThickness[index - 1] = currentPathThickness[key];
          }
        });
        
        // CustomizeStateを更新
        setCustomizeState({
          ...customizeState,
          pathColors: newPathColors,
          pathThickness: newPathThickness
        });
      }
      
      // pathDeletedIndexを除いてNeonDrawingStateを更新
      const { pathDeletedIndex, ...stateWithoutDeletedIndex } = newState;
      setNeonDrawingState(stateWithoutDeletedIndex);
    } else if (newState && newState.pathRestoredIndex !== undefined) {
      // パス復活時の処理
      const restoredIndex = newState.pathRestoredIndex;
      
      // CustomizeStateのpathColors, pathThicknessも調整
      if (customizeState) {
        const currentPathColors = customizeState.pathColors || {};
        const currentPathThickness = customizeState.pathThickness || {};
        
        // 復活インデックス以降のキーを1つずつ後ろにずらす
        const newPathColors = {};
        const newPathThickness = {};
        
        Object.keys(currentPathColors).forEach(key => {
          const index = parseInt(key);
          if (index < restoredIndex) {
            newPathColors[key] = currentPathColors[key];
          } else if (index >= restoredIndex) {
            newPathColors[index + 1] = currentPathColors[key];
          }
        });
        
        Object.keys(currentPathThickness).forEach(key => {
          const index = parseInt(key);
          if (index < restoredIndex) {
            newPathThickness[key] = currentPathThickness[key];
          } else if (index >= restoredIndex) {
            newPathThickness[index + 1] = currentPathThickness[key];
          }
        });
        
        // CustomizeStateを更新
        setCustomizeState({
          ...customizeState,
          pathColors: newPathColors,
          pathThickness: newPathThickness
        });
      }
      
      // pathRestoredIndexを除いてNeonDrawingStateを更新
      const { pathRestoredIndex, ...stateWithoutRestoredIndex } = newState;
      setNeonDrawingState(stateWithoutRestoredIndex);
    } else {
      // 通常の状態更新
      setNeonDrawingState(newState);
    }
  }, [customizeState]);
  
  // Costomizeコンポーネントの状態変更を処理する関数（パス削除・復活時の調整を含む）
  const handleCustomizeStateChange = useCallback((newState) => {
    // pathDeletedIndexが含まれている場合はパス削除の処理を行う
    if (newState && newState.pathDeletedIndex !== undefined) {
      const deletedIndex = newState.pathDeletedIndex;
      
      // 現在のCustomizeStateからpathColors, pathThicknessを取得
      const currentPathColors = customizeState?.pathColors || {};
      const currentPathThickness = customizeState?.pathThickness || {};
      
      // 削除インデックス以降のキーを1つずつ前にずらす
      const newPathColors = {};
      const newPathThickness = {};
      
      // 削除されたインデックスより前のキーはそのまま保持
      Object.keys(currentPathColors).forEach(key => {
        const index = parseInt(key);
        if (index < deletedIndex) {
          newPathColors[key] = currentPathColors[key];
        } else if (index > deletedIndex) {
          // 削除されたインデックスより後のキーは1つ前にずらす
          newPathColors[index - 1] = currentPathColors[key];
        }
        // index === deletedIndex の場合は削除（何もしない）
      });
      
      Object.keys(currentPathThickness).forEach(key => {
        const index = parseInt(key);
        if (index < deletedIndex) {
          newPathThickness[key] = currentPathThickness[key];
        } else if (index > deletedIndex) {
          // 削除されたインデックスより後のキーは1つ前にずらす
          newPathThickness[index - 1] = currentPathThickness[key];
        }
        // index === deletedIndex の場合は削除（何もしない）
      });
      
      // pathDeletedIndexを除いて状態を更新
      const { pathDeletedIndex, ...stateWithoutDeletedIndex } = newState;
      setCustomizeState({
        ...stateWithoutDeletedIndex,
        pathColors: newPathColors,
        pathThickness: newPathThickness
      });
    } else if (newState && newState.pathRestoredIndex !== undefined) {
      // パス復活時の処理
      const restoredIndex = newState.pathRestoredIndex;
      
      // 現在のCustomizeStateからpathColors, pathThicknessを取得
      const currentPathColors = customizeState?.pathColors || {};
      const currentPathThickness = customizeState?.pathThickness || {};
      
      // 復活インデックス以降のキーを1つずつ後ろにずらす
      const newPathColors = {};
      const newPathThickness = {};
      
      Object.keys(currentPathColors).forEach(key => {
        const index = parseInt(key);
        if (index < restoredIndex) {
          newPathColors[key] = currentPathColors[key];
        } else if (index >= restoredIndex) {
          // 復活インデックス以降のキーは1つ後ろにずらす
          newPathColors[index + 1] = currentPathColors[key];
        }
      });
      
      Object.keys(currentPathThickness).forEach(key => {
        const index = parseInt(key);
        if (index < restoredIndex) {
          newPathThickness[key] = currentPathThickness[key];
        } else if (index >= restoredIndex) {
          // 復活インデックス以降のキーは1つ後ろにずらす
          newPathThickness[index + 1] = currentPathThickness[key];
        }
      });
      
      // pathRestoredIndexを除いて状態を更新
      const { pathRestoredIndex, ...stateWithoutRestoredIndex } = newState;
      setCustomizeState({
        ...stateWithoutRestoredIndex,
        pathColors: newPathColors,
        pathThickness: newPathThickness
      });
    } else {
      // 通常の状態更新
      setCustomizeState(newState);
    }
  }, []);
  
  // カスタマイズで読み込まれたファイルデータをネオン下絵で共有するための状態
  const [sharedFileData, setSharedFileData] = useState(null);
  
  // NeonSVGTo3DExtruderの状態を保存
  const [neonSvgData, setNeonSvgData] = useState(null);
  const [neonCameraState, setNeonCameraState] = useState(null);
  const [neonPreviewImageDataURL, setNeonPreviewImageDataURL] = useState(null);
  const [neonCalculatedModelData, setNeonCalculatedModelData] = useState(null);
  const [customizeCanvasImageDataURL, setCustomizeCanvasImageDataURL] = useState(null);
  
  const [previewBgColor, setPreviewBgColor] = useState('rgba(0, 0, 0, 0)'); // プレビュー背景色（初期値は透明）
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [expandedModels, setExpandedModels] = useState([]);
  const [layerSvgs, setLayerSvgs] = useState([]);
  const [sampleNeonOn, setSampleNeonOn] = useState(true); // ネオンサンプルのON/OFF状態
  const [showCreationModal, setShowCreationModal] = useState(false); // 作成方法選択モーダル
  const [sampleImagesLoaded, setSampleImagesLoaded] = useState(true); // サンプル画像のロード状態
  const neonSvgTo3DExtruderRef = useRef(null); // NeonSVGTo3DExtruderへのrefを追加
  const [isGenerating3D, setIsGenerating3D] = useState(false);
  const [autoStart3DGeneration, setAutoStart3DGeneration] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [svgGenerationProgress, setSvgGenerationProgress] = useState(0);
const [svgProcessingMessage, setSvgProcessingMessage] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false); // メインのモーダル用
  const [isLayerInfoModalOpen, setIsLayerInfoModalOpen] = useState(false); // レイヤー情報モーダル用の状態
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false); // ガイドモーダル用の状態
  // ボタンのエフェクト制御用の状態変数
  const [isEffectStopped, setIsEffectStopped] = useState(false);
  const [isLayerInfoButtonEffectStopped, setIsLayerInfoButtonEffectStopped] = useState(false);
  const [isTextGeneratorGuideEffectStopped, setIsTextGeneratorGuideEffectStopped] = useState(false);
  const [isNeonDrawingGuideEffectStopped, setIsNeonDrawingGuideEffectStopped] = useState(false);
  const [isCustomizeGuideEffectStopped, setIsCustomizeGuideEffectStopped] = useState(false);
  const [isPreview3DGuideEffectStopped, setIsPreview3DGuideEffectStopped] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const [productQuantity, setProductQuantity] = useState(1);
  const [quantityInputText, setQuantityInputText] = useState('1');
  const [productDimensions, setProductDimensions] = useState({ width: 0, height: 0, thickness: 0 });

  const handleDimensionsUpdate = useCallback((width, height, thickness) => {
    setProductDimensions({ width, height, thickness });
  }, []);
  
  
  
  // ページ遷移イベントリスナー統合
  useEffect(() => {
    const handleShowCustomize = (event) => {
      // 🔥 ネオン3Dプレビューから離れる時にカメラ状態を保存
      if (currentPage === 'neonSvg3dPreview' && neonSvgTo3DExtruderRef.current) {
        console.log('ネオンカメラ状態を保存中...');
        const saveResult = neonSvgTo3DExtruderRef.current.saveCameraState();
        if (saveResult) {
          console.log('ネオンカメラ状態を保存しました');
        }
      }
      
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

    const handleRequestPageTransition = () => {
      // ネオン3Dプレビューに移動 - カメラ状態を保存せずに適切な初期視点を設定
      setCurrentPage('neonSvg3dPreview');
    };

    const handleRequestInfoPageTransition = () => {
      setCurrentPage('info'); // 商品情報ページに移動
    };

    const handleCustomizeCanvasImage = (event) => {
      if (event.detail && event.detail.canvasImageDataURL) {
        setCustomizeCanvasImageDataURL(event.detail.canvasImageDataURL);
      }
    };
    
    // カスタマイズコンポーネントからのファイル読み込みデータを受け取る
    const handleSharedFileData = (event) => {
      if (event.detail && event.detail.fileData) {
        setSharedFileData(event.detail.fileData);
      }
    };
    
    // カスタマイズで新しいファイルが読み込まれたときにcustomizeSvgDataをクリア
    const handleClearCustomizeState = () => {
      setCustomizeSvgData(null); // ネオン下絵からのデータもクリア
    };

    window.addEventListener('showCustomize', handleShowCustomize);
    window.addEventListener('navigateToNeonDrawing', handleNavigateToNeonDrawing);
    window.addEventListener('show3DPreview', handleShow3DPreview);
    window.addEventListener('RequestPageTransitionTo3DPreview', handleRequestPageTransition);
    window.addEventListener('RequestPageTransitionToInfo', handleRequestInfoPageTransition);
    window.addEventListener('customizeCanvasImage', handleCustomizeCanvasImage);
    window.addEventListener('sharedFileDataLoaded', handleSharedFileData);
    window.addEventListener('clearCustomizeState', handleClearCustomizeState);

    return () => {
      window.removeEventListener('showCustomize', handleShowCustomize);
      window.removeEventListener('navigateToNeonDrawing', handleNavigateToNeonDrawing);
      window.removeEventListener('show3DPreview', handleShow3DPreview);
      window.removeEventListener('RequestPageTransitionTo3DPreview', handleRequestPageTransition);
      window.removeEventListener('RequestPageTransitionToInfo', handleRequestInfoPageTransition);
      window.removeEventListener('customizeCanvasImage', handleCustomizeCanvasImage);
      window.removeEventListener('sharedFileDataLoaded', handleSharedFileData);
      window.removeEventListener('clearCustomizeState', handleClearCustomizeState);
    };
  }, []);
  
  // ホームページに戻ってもデータはクリアしない（作業継続のため）
  // データクリアは明示的な操作（新しいファイル読み込み等）でのみ行う

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






 

  // Toggle sidebar
  const toggleSidebar = () => {
    setSidebarExpanded(!sidebarExpanded);
  };

  // Toggle mobile sidebar
  const toggleMobileSidebar = () => {
    setMobileSidebarOpen(!mobileSidebarOpen);
  };

  const sampleModels = [
    {
      name: "蝶々",
      image: "/neon sample pictures/蝶々2d.png",
      description: "美しい蝶々のデザイン。色とりどりの羽根が印象的で、現代的な空間にエレガンスを添えます。シンプルな光の色味と、まるで本当に羽ばたいているようなそうい優雅さ、繊細、オレンジの光彩が幻想的な雰囲気を醸し出しています。"
    },
    {
      name: "ユニコーン",
      image: "/neon sample pictures/ユニコーン2d.png",
      description: "幻想的なユニコーンのネオンサイン。美しいデザインが特徴的です。"
    },
    {
      name: "バラ",
      image: "/neon sample pictures/バラ2d.png",
      description: "エレガントなバラのデザイン。ロマンチックな雰囲気を演出します。"
    },
    {
      name: "コーヒー",
      image: "/neon sample pictures/コーヒー2d.png",
      description: "カフェにぴったりなコーヒーカップのデザイン。温かみのある光が魅力的です。"
    },
    {
      name: "スポーツカー",
      image: "/neon sample pictures/スポーツカー2d.png",
      description: "スタイリッシュなスポーツカーのシルエット。モダンな空間にぴったりです。"
    },
    {
      name: "ラーメン",
      image: "/neon sample pictures/ラーメン2d.png",
      description: "ラーメン店におすすめの温かみのあるデザイン。食欲をそそる光が特徴です。"
    }
  ];

  const toggleModelDescription = (index) => {
    setExpandedModels(prev => {
      const newExpanded = [...prev];
      newExpanded[index] = !newExpanded[index];
      return newExpanded;
    });
  };

  const downloadProjectFile = (modelName) => {
    // プロジェクトファイルのダウンロード機能
    const link = document.createElement('a');
    link.href = `/neon sample json/${modelName}　プロジェクトファイル.json`;
    link.download = `${modelName}_プロジェクトファイル.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Navigate to page
  const navigateTo = (page) => {
    setCurrentPage(page);
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
    

    
    // 🔥 画像処理は3Dモデル生成時のみ実行
  };
  
  // ガイドモーダルを開く関数
  const handleOpenModal = () => {
    console.log('ガイドモーダルを開きます');
    setIsGuideModalOpen(true);
    setTimeout(() => {
      setIsEffectStopped(true);
    }, 150);
  };

  // ガイドモーダルを閉じる関数
  const handleCloseGuideModal = () => {
    console.log('ガイドモーダルを閉じます');
    setIsGuideModalOpen(false);
    setIsEffectStopped(true);
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
            
            {/* Desktop Layout */}
            <h1 className="page-title">Image To LED Neon Sign</h1>
            
            <div className="preview-container">
              <Gallery3D />
            </div>
            
            {/* Mobile Layout */}
            <div className="mobile-content">
              {/* Hero Section - Placeholder for animation/video */}
              <div className="mobile-hero-section">
                <div>アニメーション/動画エリア<br />（未実装）</div>
              </div>
              
              {/* Title */}
              <div className="mobile-title">Image To LED Neon Sign</div>
              
              {/* Guide Button */}
              <div style={{textAlign: 'center', margin: '30px 0'}}>
                <button 
                  onClick={handleOpenModal}
                  className={`info-button ${isEffectStopped ? 'stopped' : ''}`}
                  style={{
                    width: '28px',
                    height: '28px',
                    fontSize: '16px',
                    display: 'inline-block',
                    marginRight: '2px'
                  }}
                >
                </button>
                <span style={{color: 'white', fontSize: '14px', verticalAlign: 'middle'}}>
                  一度お読みください
                </span>
              </div>
              
              {/* Create Button */}
              <button
                onClick={() => setShowCreationModal(true)}
                className="mobile-create-button"
              >
                さっそく作成する
              </button>
              
              
              {/* Review Section */}
              <div style={{
                margin: '20px 15px',
                width: 'calc(100% - 30px)',
                height: 'calc(100vw - 30px)',
                maxHeight: '350px',
                overflow: 'visible'
              }}>
                <HomeLeftBottm />
              </div>
              
              {/* Sample Models Section */}
              <div style={{margin: '20px 15px', color: 'white'}}>
                <h3 style={{marginBottom: '15px', fontSize: '18px', fontWeight: 'bold'}}>サンプルモデル</h3>
                <div className="mobile-sample-models-grid">
                  {sampleModels.map((model, index) => (
                    <div key={index} className="mobile-sample-model-item">
                      <div className="mobile-sample-image-container">
                        <img 
                          src={model.image}
                          alt={model.name}
                          className="mobile-sample-image"
                        />
                      </div>
                      <div className="mobile-sample-bottom-row">
                        <div className="mobile-sample-title">{model.name}</div>
                        <button 
                          className="mobile-sample-toggle"
                          onClick={() => toggleModelDescription(index)}
                        >
                          {expandedModels[index] ? '▲' : '▼'}
                        </button>
                      </div>
                      {expandedModels[index] && (
                        <div className="mobile-sample-description">
                          {model.description}
                        </div>
                      )}
                      <button 
                        className="download-project-btn"
                        onClick={() => downloadProjectFile(model.name)}
                      >
                        プロジェクトファイルをダウンロード
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="home-bottom-layout">
              {/* 左下の大きなコンテナ */}
              <div className="bottom-left-container">
                <HomeLeftBottm />
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
            isGuideEffectStopped={isTextGeneratorGuideEffectStopped}
            onGuideEffectStop={() => setIsTextGeneratorGuideEffectStopped(true)}
          />
        );
      case 'neonDrawing':
        return <NeonDrawingApp 
          initialState={neonDrawingState} 
          onStateChange={handleNeonDrawingStateChange}
          sharedFileData={sharedFileData}
          onSharedFileDataProcessed={() => setSharedFileData(null)}
          isGuideEffectStopped={isNeonDrawingGuideEffectStopped}
          onGuideEffectStop={() => setIsNeonDrawingGuideEffectStopped(true)}
        />;
      case 'customize':
        return <Costomize 
          svgData={customizeSvgData} 
          initialState={customizeState}
          onStateChange={handleCustomizeStateChange}
          isGuideEffectStopped={isCustomizeGuideEffectStopped}
          onGuideEffectStop={() => setIsCustomizeGuideEffectStopped(true)}
        />;
      case 'neonSvg3dPreview':
        return null; // NeonSVGTo3DExtruderはルートレベルで表示
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
                      
                      <img className="product-image" src={customizeCanvasImageDataURL || neonPreviewImageDataURL} alt="プレビュー" />
                      
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
                                <span className="spec-label">OFF時のチューブカラー</span>
                                <span className="spec-value">{neonModelData ? (neonModelData.offTubeColor === 'white' ? 'ホワイト' : '発光色マッチング') : '---'}</span>
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
                            <span className="timeline-time">{'---営業日'}</span>
                          </div>
                          <div className="timeline-item">
                            <span className="timeline-step">配送期間</span>
                            <span className="timeline-time">{'---営業日'}</span>
                          </div>
                          <div className="timeline-item total-time">
                            <span className="timeline-step">合計</span>
                            <span className="timeline-time">{'---営業日'}</span>
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
                          autoComplete="off"
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
                      <span id="base-price">{'---'}</span>
                    </div>
                    <div className="price-item">
                      <span>製品価格</span>
                      <span id="product-price">{'---'}</span>
                    </div>
                    <div className="price-item">
                      <span>配送費</span>
                      <span id="shipping-cost">{'---'}</span>
                    </div>
                    <div className="price-item">
                      <span>数量割引</span>
                      <span id="quantity-discount">{'---'}</span>
                    </div>
                    <div className="price-item">
                      <span>小計</span>
                      <span id="subtotal">{'---'}</span>
                    </div>
                    <div className="price-item total" style={{fontSize: '1.5rem', color: '#00ff80'}}>
                      <span>合計金額</span>
                      <span id="total-price">{'---'}</span>
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
                  <div className="product-info-feature-card" style={{maxWidth: '350px', margin: '0 auto'}}>
                    <div className="product-info-feature-icon">🛡️</div>
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
    console.log(`商品ID: Unknown Product、数量: ${productQuantity}個をカートに追加しました。`);
    // モーダルを閉じるなどの追加処理があればここに
  };

  const openContactForm = () => {
    console.log('openContactForm called');
    // Implement actual logic later
  };



  // Effect to update estimate when productQuantity changes
  useEffect(() => {
    if (currentPage === 'info') { // Only call if on the info page
      updateEstimate();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productQuantity, currentPage]); // Assuming updateEstimate is stable or memoized

  // サンプル画像は即座に表示

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



  return (
    <div className={`app-container ${sidebarExpanded ? 'sidebar-open-for-preview' : ''}`}>
      {/* Background image - 3Dプレビューページ以外で表示 */}
      {currentPage !== 'neonSvg3dPreview' && (
        <div className="background">
          {/* <div className="particles" id="particles"></div> */}
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
          isGuideEffectStopped={isPreview3DGuideEffectStopped}
          onGuideEffectStop={() => setIsPreview3DGuideEffectStopped(true)}
        />
      </div>
      
      {/* Main layout */}
      <div className="layout-container">
        {/* Mobile Header */}
        <div className="mobile-header">
          <button className="mobile-menu-button" onClick={toggleMobileSidebar}>
            ☰
          </button>
          <div className="mobile-header-logo">ロゴ</div>
        </div>

        {/* Mobile Sidebar Overlay */}
        {mobileSidebarOpen && <div className="mobile-sidebar-overlay" onClick={toggleMobileSidebar}></div>}

        {/* Sidebar */}
        <div className={`sidebar ${sidebarExpanded ? "expanded" : "collapsed"} ${mobileSidebarOpen ? "mobile-open" : ""}`}>
            <div className="sidebar-content">
                <div className="logo-container">
                    <div className="logo">ロゴ</div>
                    <button className="sidebar-toggle" onClick={toggleSidebar}>
                        {sidebarExpanded ? '◀' : '▶'}
                    </button>
                </div>
                <nav className="sidebar-nav">
                    <button className={currentPage === 'home' ? "nav-item active" : "nav-item"} onClick={() => { setCurrentPage('home'); setMobileSidebarOpen(false); }}>
                        <div className="nav-icon">
                            <svg viewBox="0 0 24 24">
                                <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
                            </svg>
                        </div>
                        <span className="nav-text">ホーム</span>
                        <div className="tooltip">ホーム</div>
                    </button>
                    <button className={currentPage === 'textGeneration' ? "nav-item active" : "nav-item"} onClick={() => { setCurrentPage('textGeneration'); setMobileSidebarOpen(false); }}>
                        <div className="nav-icon">
                            A
                        </div>
                        <span className="nav-text">テキストから生成</span>
                        <div className="tooltip">テキストから生成</div>
                    </button>
                    <button className={currentPage === 'neonDrawing' ? "nav-item active" : "nav-item"} onClick={() => { setCurrentPage('neonDrawing'); setMobileSidebarOpen(false); }}>
                        <div className="nav-icon">
                            <svg viewBox="0 0 24 24">
                            <path d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42"/>
                            </svg>
                        </div>
                        <span className="nav-text">ネオン下絵</span>
                        <div className="tooltip">ネオン下絵</div>
                    </button>
                    <button className={currentPage === 'customize' ? "nav-item active" : "nav-item"} onClick={() => { setCurrentPage('customize'); setMobileSidebarOpen(false); }}>
                        <div className="nav-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="3"/>
                                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                            </svg>
                        </div>
                        <span className="nav-text">色 / 仕様のカスタマイズ</span>
                        <div className="tooltip">色 / 仕様のカスタマイズ</div>
                    </button>
                    <button className={currentPage === 'neonSvg3dPreview' ? "nav-item active" : "nav-item"} onClick={() => { setCurrentPage('neonSvg3dPreview'); setMobileSidebarOpen(false); }}>
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
                    <button className={currentPage === 'info' ? "nav-item active" : "nav-item"} onClick={() => { setCurrentPage('info'); setMobileSidebarOpen(false); }}>
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
      

      
      {/* ガイドモーダル */}
      <GuideModal 
        isOpen={isGuideModalOpen} 
        onClose={handleCloseGuideModal} 
      />

    </div>
  );
};

export default LaserCutImageProcessor;
