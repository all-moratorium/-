import React, { useState, useEffect, useCallback, useRef, createRef } from 'react';
import './LaserCutImageProcessor_cleaned.css'; // 通常のCSSファイルをインポート
import Gallery3D from './Gallery3D';
import NeonDrawingApp from './NeonDrawingApp'; // ネオン下絵コンポーネントをインポート
import Costomize from './Costomize'; // カスタマイズコンポーネントをインポート
import NeonSVGTo3DExtruder from './NeonSVGTo3DExtruder'; // ネオンSVG3Dエクストルーダーコンポーネントをインポート
import TextGenerator from './TextGenerator'; // テキスト生成コンポーネントをインポート
import GuideModal from './GuideModal.jsx'; // ガイドモーダルコンポーネントをインポート
import HomeLeftBottm from './HomeLeftBottm.jsx'; // レビューコンポーネントをインポート
import RealTime3DProgressModal from './RealTime3DProgressModal.jsx'; // リアルタイム3D進捗モーダル
import { Home, Type, Edit3, Settings, Eye, Package } from 'lucide-react';
import { FaCcVisa, FaCcMastercard, FaCcAmex, FaPaypal, FaFacebookF, FaInstagram, FaTiktok, FaLinkedinIn } from 'react-icons/fa';
import { FaXTwitter } from 'react-icons/fa6';




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
                <div className="creation-modal-header">
                    <h2 className="creation-modal-header-title">作成方法を選択</h2>
                    <button onClick={onClose} className="creation-modal-close-button">
                        ×
                    </button>
                </div>
                <button onClick={onClose} className="creation-modal-close-button">
                    ×
                </button>
                <div className="creation-modal-inner">
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

// TypeWriter クラス
class TypeWriter {
  constructor(element, speed = 50) {
    this.element = element;
    this.speed = speed;
    this.paused = false;
    this.cancelled = false;
  }
  
  async type(text) {
    if (this.cancelled) return;
    
    this.element.innerHTML = '';
    // 改行を分割して処理
    const parts = text.split('\n');
    
    // カーソルを表示
    const cursor = '<span class="typing-cursor"></span>';
    this.element.innerHTML = cursor;
    
    for (let partIndex = 0; partIndex < parts.length; partIndex++) {
      if (this.cancelled) return;
      
      const part = parts[partIndex];
      
      // 各文字をタイピング
      for (let i = 0; i < part.length; i++) {
        if (this.cancelled) return;
        if (this.paused) await this.waitForResume();
        
        // カーソルを削除してから文字を追加し、再度カーソルを追加
        this.element.innerHTML = this.element.innerHTML.replace(cursor, '') + part.charAt(i) + cursor;
        await this.delay(this.speed);
      }
      
      // 最後の部分でなければ改行を追加
      if (partIndex < parts.length - 1) {
        if (this.cancelled) return;
        this.element.innerHTML = this.element.innerHTML.replace(cursor, '') + '<br />' + cursor;
        await this.delay(this.speed);
      }
    }
    
    if (this.cancelled) return;
    
    // タイピング完了後、少し待ってからカーソルを削除
    await this.delay(1200);
    if (!this.cancelled) {
      this.element.innerHTML = this.element.innerHTML.replace(cursor, '');
    }
  }
  
  cancel() {
    this.cancelled = true;
  }
  
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  waitForResume() {
    return new Promise(resolve => {
      const checkResume = () => {
        if (!this.paused) resolve();
        else setTimeout(checkResume, 50);
      };
      checkResume();
    });
  }
}

const LaserCutImageProcessor = () => {
  // UI state variables
  const [currentPage, setCurrentPage] = useState('home'); // 'home', 'textGeneration', 'info', 'neonDrawing', 'customize', 'neonSvg3dPreview'
  const [customizeSvgData, setCustomizeSvgData] = useState(null); // カスタマイズ用SVGデータ
  
  // タイピングアニメーション用state
  const [isTyping, setIsTyping] = useState(false);
  const listRef1 = useRef(null);
  const listRef2 = useRef(null);
  const typewriter1Ref = useRef(null);
  const typewriter2Ref = useRef(null);
  
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
  const [isColorTube, setIsColorTube] = useState(false); // チューブタイプ（false: WHITE, true: COLOR）
  const [showCreationModal, setShowCreationModal] = useState(false); // 作成方法選択モーダル
  const [sampleImagesLoaded, setSampleImagesLoaded] = useState(true); // サンプル画像のロード状態
  const neonSvgTo3DExtruderRef = useRef(null); // NeonSVGTo3DExtruderへのrefを追加
  const sampleImageRef = useRef(null); // サンプル画像への参照
  const [isGenerating3D, setIsGenerating3D] = useState(false);
  const [autoStart3DGeneration, setAutoStart3DGeneration] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [isPreloadingModels, setIsPreloadingModels] = useState(false); // 3Dモデルプリロード中フラグ
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
  // スマホ版3Dプレビュー動的マウント制御
  const [isMobile3DPreviewMounted, setIsMobile3DPreviewMounted] = useState(false);
  const [isDesktop3DPreviewMounted, setIsDesktop3DPreviewMounted] = useState(false);
  // リアルタイム3D進捗モーダル制御
  const [isRealTime3DProgressVisible, setIsRealTime3DProgressVisible] = useState(false);
  const [isRemountingModel, setIsRemountingModel] = useState(false);
  const [isPreview3DGuideEffectStopped, setIsPreview3DGuideEffectStopped] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const [productQuantity, setProductQuantity] = useState(1);
  const [isMobile, setIsMobile] = useState(false);
  const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight);
  const [can3DPreview, setCan3DPreview] = useState(window.innerWidth > window.innerHeight || window.innerWidth >= 768);
  const [quantityInputText, setQuantityInputText] = useState('1');
  const [productDimensions, setProductDimensions] = useState({ width: 0, height: 0, thickness: 0 });
  
  // モバイル版用：3Dプレビューデータを一時保存
  const [tempMobile3DData, setTempMobile3DData] = useState(null);

  const handleDimensionsUpdate = useCallback((width, height, thickness) => {
    setProductDimensions({ width, height, thickness });
  }, []);
  
  // フェード遷移でサンプル画像を切り替える関数
  const handleSampleNeonToggle = useCallback(() => {
    if (!sampleImageRef.current) return;
    
    // フェードアウト開始
    sampleImageRef.current.classList.add('fade-transition');
    
    // 0.2秒後に画像を切り替え
    setTimeout(() => {
      setSampleNeonOn(prev => !prev);
      
      // フェードイン（fade-transitionクラスを削除）
      if (sampleImageRef.current) {
        sampleImageRef.current.classList.remove('fade-transition');
      }
    }, 200);
  }, []);

  // チューブタイプを切り替える関数
  const handleSelectTubeType = useCallback((type) => {
    const newIsColorTube = (type === 'color');
    
    // 同じ選択の場合は何もしない
    if (newIsColorTube === isColorTube) {
      return;
    }
    
    setIsColorTube(newIsColorTube);
  }, [isColorTube]);
  
  
  // タイピングアニメーション開始（ホームページ表示時毎回）
  useEffect(() => {
    let isCancelled = false;
    
    if (currentPage === 'home') {
      const startTyping = async () => {
        if (isCancelled) return;
        setIsTyping(true);
        
        const text1 = '線を描いて、色を選んで、太さを決める。ネオンのカタチを \nゼロから作れる、オーダーメイドLEDサインツール。';
        const text2 = 'ロゴや文字だけじゃ物足りない？完全オリジナルの形状を\n思い通りに作ってそのまま注文できます。';
        
        // 必ず両方をクリアしてから順番通りにタイピング
        if (listRef1.current) listRef1.current.innerHTML = '';
        if (listRef2.current) listRef2.current.innerHTML = '';
        
        // 1番目のテキストをタイピング
        if (listRef1.current && !isCancelled) {
          const typewriter1 = new TypeWriter(listRef1.current, 60);
          typewriter1Ref.current = typewriter1;
          await typewriter1.type(text1);
        }
        
        // キャンセルされていなければ2番目のテキストに進む
        if (isCancelled) return;
        
        // 500ms待機後、2番目のテキストをタイピング
        await new Promise(resolve => setTimeout(resolve,300));
        
        if (listRef2.current && !isCancelled) {
          const typewriter2 = new TypeWriter(listRef2.current, 60);
          typewriter2Ref.current = typewriter2;
          await typewriter2.type(text2);
        }
        
        if (!isCancelled) {
          setIsTyping(false);
        }
      };
      
      // 少し遅延してからタイピング開始
      const timer = setTimeout(startTyping, 1000);
      
      return () => {
        isCancelled = true;
        clearTimeout(timer);
        // 実行中のタイピングをキャンセル
        if (typewriter1Ref.current) {
          typewriter1Ref.current.cancel();
          typewriter1Ref.current = null;
        }
        if (typewriter2Ref.current) {
          typewriter2Ref.current.cancel();
          typewriter2Ref.current = null;
        }
        // テキストを完全にクリア
        if (listRef1.current) listRef1.current.innerHTML = '';
        if (listRef2.current) listRef2.current.innerHTML = '';
        setIsTyping(false);
      };
    }
  }, [currentPage]);

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
        
        // モバイル版用にデータを一時保存
        setTempMobile3DData(event.detail);
        
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
      // リアルタイムでモバイル判定（stateに依存しない）
      const isMobileNow = window.innerWidth <= 1280 || navigator.maxTouchPoints > 0;
      
      // 新規生成時はリマウントフラグをfalse（これが優先される）
      setIsRemountingModel(false);
      // リアルタイム進捗モーダルを表示
      setIsRealTime3DProgressVisible(true);
      
      // マウント状態を設定（新規生成として扱うため）
      if (isMobileNow) {
        setIsMobile3DPreviewMounted(true);
      } else {
        setIsDesktop3DPreviewMounted(true);
      }
      
      // ネオン3Dプレビューに移動 - カメラ状態を保存せずに適切な初期視点を設定
      setCurrentPage('neonSvg3dPreview');
    };

    const handleRequestInfoPageTransition = () => {
      setCurrentPage('info'); // 商品情報ページに移動
    };

    const handleRequestNeonDrawingPageTransition = () => {
      setCurrentPage('neonDrawing'); // ネオン下絵ページに移動
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
    window.addEventListener('RequestPageTransitionToNeonDrawing', handleRequestNeonDrawingPageTransition);
    window.addEventListener('customizeCanvasImage', handleCustomizeCanvasImage);
    window.addEventListener('sharedFileDataLoaded', handleSharedFileData);
    window.addEventListener('clearCustomizeState', handleClearCustomizeState);

    return () => {
      window.removeEventListener('showCustomize', handleShowCustomize);
      window.removeEventListener('navigateToNeonDrawing', handleNavigateToNeonDrawing);
      window.removeEventListener('show3DPreview', handleShow3DPreview);
      window.removeEventListener('RequestPageTransitionTo3DPreview', handleRequestPageTransition);
      window.removeEventListener('RequestPageTransitionToInfo', handleRequestInfoPageTransition);
      window.removeEventListener('RequestPageTransitionToNeonDrawing', handleRequestNeonDrawingPageTransition);
      window.removeEventListener('customizeCanvasImage', handleCustomizeCanvasImage);
      window.removeEventListener('sharedFileDataLoaded', handleSharedFileData);
      window.removeEventListener('clearCustomizeState', handleClearCustomizeState);
    };
  }, [isMobile]);

  // 画面向きの変更を検出
  useEffect(() => {
    const handleOrientationChange = () => {
      const previousLandscape = isLandscape;
      const newLandscape = window.innerWidth > window.innerHeight;
      const isTablet = window.innerWidth >= 768;
      
      setIsLandscape(newLandscape);
      setCan3DPreview(newLandscape || isTablet);
      
      // 3Dプレビューページが開いている時のみ処理
      if (isMobile && currentPage === 'neonSvg3dPreview' && neonSvgData) {
        if (isTablet) {
          // タブレット: 縦→横、横→縦どちらでもリマウント
          if (previousLandscape !== newLandscape && isMobile3DPreviewMounted) {
            setIsMobile3DPreviewMounted(false);
            setTimeout(() => {
              setIsRemountingModel(true);
              setIsRealTime3DProgressVisible(true);
              setIsMobile3DPreviewMounted(true);
            }, 100);
          }
        } else {
          // スマホ: 縦→横はリマウント、横→縦はアンマウント
          if (!previousLandscape && newLandscape) {
            // 縦→横: リマウント
            if (isMobile3DPreviewMounted) {
              setIsMobile3DPreviewMounted(false);
              setTimeout(() => {
                setIsRemountingModel(true);
                setIsRealTime3DProgressVisible(true);
                setIsMobile3DPreviewMounted(true);
              }, 100);
            }
          } else if (previousLandscape && !newLandscape) {
            // 横→縦: アンマウント
            setIsMobile3DPreviewMounted(false);
            setIsRealTime3DProgressVisible(false);
          }
        }
      }
    };

    window.addEventListener('resize', handleOrientationChange);
    window.addEventListener('orientationchange', handleOrientationChange);

    return () => {
      window.removeEventListener('resize', handleOrientationChange);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, [isLandscape, isMobile, currentPage, neonSvgData, isMobile3DPreviewMounted]);

  // 3Dプレビューのマウント/アンマウント処理（モバイル・デスクトップ共通）
  useEffect(() => {
    if (isMobile && currentPage === 'neonSvg3dPreview') {
      // モバイルで3Dプレビューページに遷移した時（横画面または横幅768px以上の場合）
      if (neonSvgData && !isMobile3DPreviewMounted && !isRealTime3DProgressVisible && can3DPreview) {
        // 既存のモデルデータがあり、現在進捗モーダルが表示されていない場合かつ3D表示可能な場合のみ再構築
        setIsRemountingModel(true);
        setIsRealTime3DProgressVisible(true);
        setIsMobile3DPreviewMounted(true);
      }
      // 既にマウントされている場合は何もしない（画面向き変更時の再マウントを防ぐ）
    } else if (isMobile && currentPage !== 'neonSvg3dPreview' && isMobile3DPreviewMounted) {
      // 3Dプレビューページ以外に遷移した時はスマホ版3Dコンポーネントをアンマウント
      setIsMobile3DPreviewMounted(false);
    }
    
    // デスクトップ版の3Dプレビューマウント制御
    if (!isMobile && currentPage === 'neonSvg3dPreview') {
      // デスクトップで3Dプレビューページに遷移した時
      if (neonSvgData && !isDesktop3DPreviewMounted && !isRealTime3DProgressVisible) {
        // 既存のモデルデータがあり、現在進捗モーダルが表示されていない場合のみ再構築
        setIsRemountingModel(true);
        setIsRealTime3DProgressVisible(true);
        setIsDesktop3DPreviewMounted(true);
      }
    } else if (!isMobile && currentPage !== 'neonSvg3dPreview' && isDesktop3DPreviewMounted) {
      // 3Dプレビューページ以外に遷移した時はデスクトップ版3Dコンポーネントをアンマウント
      setIsDesktop3DPreviewMounted(false);
    }
    
    // 3Dプレビューページ以外に遷移した時は進捗モーダルを閉じる
    if (currentPage !== 'neonSvg3dPreview' && isRealTime3DProgressVisible) {
      setIsRealTime3DProgressVisible(false);
    }
  }, [currentPage, isMobile, isMobile3DPreviewMounted, isDesktop3DPreviewMounted, isRealTime3DProgressVisible, neonSvgData]);

  // 画面向き変更時の3Dプレビュー処理
  useEffect(() => {
    if (isMobile && currentPage === 'neonSvg3dPreview' && neonSvgData) {
      // 3Dプレビューページで画面向きが変更された時
      if (can3DPreview && !isMobile3DPreviewMounted && !isRealTime3DProgressVisible) {
        // 3D表示可能になったが、まだマウントされていない場合のみマウント
        setIsRemountingModel(true);
        setIsRealTime3DProgressVisible(true);
        setIsMobile3DPreviewMounted(true);
      }
    }
  }, [can3DPreview, isMobile, currentPage, neonSvgData, isMobile3DPreviewMounted, isRealTime3DProgressVisible]);

  // モバイルデバイス検出
  useEffect(() => {
    const checkMobile = () => {
      const isMobileDevice = window.innerWidth <= 1280 || navigator.maxTouchPoints > 0;
      setIsMobile(isMobileDevice);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
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
            {window.innerWidth > 1280 && navigator.maxTouchPoints === 0 && <Gallery3D onPreloadingChange={setIsPreloadingModels} />}
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
                    marginRight: '1px'
                  }}
                >
                </button>
                <span style={{color: 'white', fontSize: '15px', verticalAlign: 'middle'}}>
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
                <h2 className="step-message">理想のLEDネオンサインを作成</h2>
                <div className="order-message">
                  <ul className="feature-list">
                    <li><span className="triangle-icon">▶</span><span ref={listRef1}></span></li>
                    <li><span className="triangle-icon">▶</span><span ref={listRef2}></span></li>
                  </ul>
                </div>
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
                      ref={sampleImageRef}
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
                  {/* スライド式チューブタイプセレクター */}
                  <div className="control-section">
                    <div className="control-title" style={{marginBottom: '1px'}}>Tube Type</div>
                    <div className="power-note" style={{marginBottom: '15px'}}>※電源OFF時</div>
                    <div className="neon-track">
                      <div className={`neon-thumb ${isColorTube ? 'color' : ''}`}></div>
                      <div className="neon-option left" onClick={() => handleSelectTubeType('white')}>
                        <div className="neon-tube-icon white-neon"></div>
                        <span>WHITE</span>
                      </div>
                      <div className="neon-option right" onClick={() => handleSelectTubeType('color')}>
                        <div className="neon-tube-icon color-neon"></div>
                        <span>COLOR</span>
                      </div>
                    </div>
                  </div>

                  {/* 円形パワーボタン */}
                  <div className="control-section">
                    <div className="control-title power-title" style={{marginBottom: '12px'}}>Power</div>
                    <div className="circle-track">
                      <div className={`circle-thumb ${sampleNeonOn ? 'on' : ''}`} onClick={handleSampleNeonToggle}>
                        <svg className="power-icon" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>
                          <line x1="12" y1="2" x2="12" y2="12"></line>
                        </svg>
                      </div>
                    </div>
                    <div 
                      className="power-label" 
                      style={{
                        color: sampleNeonOn ? '#10b981' : '#9ca3af', 
                        textShadow: sampleNeonOn ? '0 0 5px rgba(16, 185, 129, 0.5)' : 'none'
                      }}
                    >
                      {sampleNeonOn ? 'ON' : 'OFF'}
                    </div>
                  </div>
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
            sidebarExpanded={sidebarExpanded}
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
          sidebarExpanded={sidebarExpanded}
        />;
      case 'neonSvg3dPreview':
        if (isMobile && !neonSvgData) {
          return null; // モバイルno-model状態は下のオーバーレイで処理
        }
        return null; // デスクトップではNeonSVGTo3DExtruderがルートレベルで表示
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
                    <h2 className="product-specs-title">仕様</h2>
                    
                    <div className="product-container-vertical">
                      
                      {(customizeCanvasImageDataURL || neonPreviewImageDataURL) && (
                        <img className="product-image" src={customizeCanvasImageDataURL || neonPreviewImageDataURL} alt="プレビュー" />
                      )}
                      
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
                                <span className="spec-value">{neonModelData ? (neonModelData.offTubeColor === 'white' ? 'ホワイト' : '発光色') : '---'}</span>
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
                        placeholder="色の指定、特別な仕上げ、その他ご要望がございましたらこちらへお書きください。" 
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
                    <div className="price-item total" style={{fontSize: '1.5rem', color: '#10b981', textShadow: '0 0 5px rgba(16, 185, 129, 0.6)'}}>
                      <span>予想見積価格</span>
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
                  <div className="product-info-feature-card">
                    <h4>品質保証</h4>
                    <img src="/ホーム画像/今のガイドモーダル三ページ目.png" alt="品質保証" />
                    <p>厳格な品質管理のもと、不良品は無償で再製作いたします。安心してご利用ください。</p>
                  </div>
                  
                  <div className="product-info-feature-card">
                    <h4>特注・大量注文のご相談</h4>
                    <img src="/ホーム画像/今のガイドモーダル三ページ目.png" alt="相談" />
                    <p>より大きなサイズや特殊な仕様、大量注文については個別にお見積もりいたします。</p>
                  </div>

                  <div className="product-info-feature-card">
                    <h4>スピード制作</h4>
                    <img src="/ホーム画像/今のガイドモーダル三ページ目.png" alt="スピード" />
                    <p>デザイン確定後、最短5営業日でお届け。お急ぎの場合はご相談ください。</p>
                  </div>
                </div>
              </div>
              
              <div className="product-info-footer">
                <div className="footer-main">
                  {/* 左側：ロゴとSNS */}
                  <div className="footer-logo-section">
                    <div className="footer-logo">
                      <h2 className="neon-logo">GG NEON</h2>
                      <p className="logo-subtitle">カスタムLEDネオンサインの専門店</p>
                    </div>
                    <div className="social-icons">
                      <a href="#facebook"><FaFacebookF /></a>
                      <a href="#instagram"><FaInstagram /></a>
                      <a href="#x"><FaXTwitter /></a>
                      <a href="#linkedin"><FaLinkedinIn /></a>
                      <a href="#tiktok"><FaTiktok /></a>
                    </div>
                  </div>
                  
                  {/* 右側2列 */}
                  <div className="footer-sections">
                    <div className="footer-section">
                      <h4>商品カテゴリー</h4>
                      <ul>
                        <li><a href="#custom-neon">カスタムネオンサイン</a></li>
                        <li><a href="#store-signs">店舗用サイン</a></li>
                        <li><a href="#event-signs">イベント用サイン</a></li>
                        <li><a href="#interior-signs">インテリア用サイン</a></li>
                        <li><a href="#rgb-led">RGB LEDサイン</a></li>
                      </ul>
                    </div>
                    
                    <div className="footer-section">
                      <h4>サポート</h4>
                      <ul>
                        <li><a href="#contact">お問い合わせ</a></li>
                        <li><a href="#shipping">配送について</a></li>
                        <li><a href="#returns">返品・交換</a></li>
                        <li><a href="#warranty">保証について</a></li>
                        <li><a href="#support">取り付けサポート</a></li>
                      </ul>
                    </div>
                  </div>
                </div>
                
                {/* 支払い方法 */}
                <div className="payment-section">
                  <h5>お支払い方法</h5>
                  <div className="payment-icons">
                    <img src="/icons/visa.svg" alt="Visa" className="payment-icon" />
                    <img src="/icons/mc_symbol.svg" alt="Mastercard" className="payment-icon" />
                    <img src="/icons/American Express BB Logo.jpg" alt="American Express" className="payment-icon" />
                    <img src="/icons/jcb-logomark-img-03.webp" alt="JCB" className="payment-icon" />
                    <img src="/icons/Logo_RakutenPay_Horizontal.png" alt="Rakuten Pay" className="payment-icon" />
                    <img src="/icons/paypay_3_rgb.png" alt="PayPay" className="payment-icon" />
                    <img src="/icons/Apple_Pay_Mark_RGB_041619.svg" alt="Apple Pay" className="payment-icon" />
                  </div>
                </div>
                
                {/* ボーダーライン */}
                <div className="footer-divider"></div>
                
                {/* 法的リンク */}
                <div className="footer-legal">
                  <div className="legal-links">
                    <a href="#privacy">プライバシーポリシー</a>
                    <a href="#terms">利用規約</a>
                    <a href="#tokusho">特定商取引法</a>
                    <a href="#sitemap">サイトマップ</a>
                  </div>
                </div>
                
                {/* コピーライト */}
                <div className="footer-copyright">
                  <p>© 2025 GG NEON. All rights reserved.</p>
                </div>
                
                {/* 最下部テキスト */}
                <div className="footer-bottom-text">
                  <p>カスタムLEDネオンサインの配送・販売</p>
                </div>
              </div>
            </div>
          );
      default:
        return null;
    }
  };

  // スクロールアニメーション用のIntersection Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // 1つ目が見えたら全部のカードにanimateクラスを追加
            const allCards = document.querySelectorAll('.product-info-feature-card');
            allCards.forEach((card) => {
              card.classList.add('animate');
            });
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px'
      }
    );

    // ページロード時にfade-inクラスを追加
    const cards = document.querySelectorAll('.product-info-feature-card');
    cards.forEach((card) => {
      card.classList.add('fade-in');
    });
    
    // 1つ目のカードだけ監視
    if (cards.length > 0) {
      observer.observe(cards[0]);
    }

    return () => {
      if (cards.length > 0) {
        observer.unobserve(cards[0]);
      }
    };
  }, [currentPage]);

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
      
      {/* NeonSVGTo3DExtruder and Mobile No-Model State */}
      {currentPage === 'neonSvg3dPreview' && (
        <div className="neon-3d-extruder-container">
          {/* Mobile No-Model State */}
          {isMobile && !neonSvgData ? (
            <div className="preview3d-mobile-empty-state">
              <div className="preview3d-mobile-empty-content">
                <div className="preview3d-mobile-empty-title">
                  3Dプレビュー
                </div>
                <video 
                  className="preview3d-mobile-empty-video"
                  autoPlay 
                  loop 
                  muted 
                  playsInline
                >
                  <source src="/ネオン下絵　ガイドモーダル/3Dプレビューガイド.mp4" type="video/mp4" />
                  お使いのブラウザは動画の再生に対応していません。
                </video>
                <div className="preview3d-mobile-empty-description">
                  このページを表示するには、色仕様のカスタマイズからデータを作成して、<br></br>「3Dモデル生成」ボタンを押してください。
                </div>
                <button 
                  onClick={() => setCurrentPage('customize')}
                  className="preview3d-mobile-empty-button"
                >
                  色 / 仕様のカスタマイズへ
                </button>
              </div>
            </div>
          ) : !isMobile && !neonSvgData ? (
            /* Desktop No-Model State */
            <div className={`preview3d-empty-state-desktop ${sidebarExpanded ? 'left-sidebar-visible' : 'left-sidebar-collapsed'}`}>
              <div className="preview3d-empty-content-desktop">
                <div className="preview3d-empty-title-desktop">
                  3Dプレビュー
                </div>
                <div className="preview3d-empty-video-wrapper">
                  <video 
                    className="preview3d-empty-video"
                    autoPlay 
                    loop 
                    muted 
                    playsInline
                  >
                    <source src="/ネオン下絵　ガイドモーダル/3Dプレビューガイド.mp4" type="video/mp4" />
                    お使いのブラウザは動画の再生に対応していません。
                  </video>
                </div>
                <div className="preview3d-empty-description-desktop">
                  このページを表示するには、色仕様のカスタマイズからデータを作成して、<br></br>「3Dモデル生成」ボタンを押してください。
                </div>
                <button 
                  className="preview3d-empty-button-desktop"
                  onClick={() => setCurrentPage('customize')}
                >
                  色 / 仕様のカスタマイズへ
                </button>
              </div>
            </div>
          ) : (
            /* 3D Extruder Component */
            ((isMobile && isMobile3DPreviewMounted) || (!isMobile && isDesktop3DPreviewMounted)) && (
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
            )
          )}
        </div>
      )}
      
      {/* リアルタイム3D進捗モーダル */}
      <RealTime3DProgressModal 
        isVisible={isRealTime3DProgressVisible}
        onComplete={() => {
          setIsRealTime3DProgressVisible(false);
          setIsRemountingModel(false);
        }}
        preview3DData={tempMobile3DData}
        isRemounting={isRemountingModel}
      />
      
      {/* Main layout */}
      <div className="layout-container">
        {/* Mobile Header */}
        <div className={`mobile-header ${['textGeneration', 'neonDrawing', 'customize', 'neonSvg3dPreview'].includes(currentPage) ? 'mobile-header-minimal' : ''} ${mobileSidebarOpen ? 'sidebar-open' : ''}`}>
          {['textGeneration', 'neonDrawing', 'customize', 'neonSvg3dPreview'].includes(currentPage) && !can3DPreview && (
            <div className="rotation-message">
              <div className="rotation-icon"></div>
              <div className="rotation-text">横画面でご利用ください</div>
            </div>
          )}
          <div className="mobile-menu-button-wrapper">
            <button className="mobile-menu-button" onClick={toggleMobileSidebar}>
              ☰
            </button>
            <div className="mobile-menu-button-protection" onClick={(e) => e.stopPropagation()}></div>
          </div>
          <div className="mobile-header-logo">ロゴ</div>
        </div>

        {/* Mobile Sidebar Overlay */}
        {mobileSidebarOpen && <div className="mobile-sidebar-overlay" onClick={toggleMobileSidebar}></div>}

        {/* Sidebar */}
        <div className={`sidebar ${sidebarExpanded ? "expanded" : "collapsed"} ${mobileSidebarOpen ? "mobile-open" : ""} ${['textGeneration', 'neonDrawing', 'customize', 'neonSvg3dPreview'].includes(currentPage) ? 'mobile-header-minimal-sidebar' : ''}`}>
            <div className="floating-glow"></div>
            <div className="sidebar-content">
                <div className="logo-container">
                    {sidebarExpanded && (
                        <div className="logo-area">
                            <span className="logo">NEON</span>
                        </div>
                    )}
                    <button 
                        className="sidebar-toggle" 
                        onClick={toggleSidebar}
                        disabled={currentPage === 'home' && isPreloadingModels}
                        style={currentPage === 'home' && isPreloadingModels ? { pointerEvents: 'none', opacity: 0.5 } : {}}
                    >
                        <div className={`sidebar-triangle ${sidebarExpanded ? 'triangle-left' : 'triangle-right'}`}></div>
                    </button>
                </div>
                <nav className="sidebar-nav">
                    <button className={currentPage === 'home' ? "nav-item active" : "nav-item"} onClick={() => { setCurrentPage('home'); setMobileSidebarOpen(false); }}>
                        <div className="nav-icon">
                            <Home />
                        </div>
                        <span className="nav-text">ホーム</span>
                        {!sidebarExpanded && (
                            <div className="tooltip">ホーム</div>
                        )}
                    </button>
                    <button className={currentPage === 'textGeneration' ? "nav-item active" : "nav-item"} onClick={() => { setCurrentPage('textGeneration'); setMobileSidebarOpen(false); }}>
                        <div className="nav-icon">
                            <Type />
                        </div>
                        <span className="nav-text">テキストから生成</span>
                        {!sidebarExpanded && (
                            <div className="tooltip">テキストから生成</div>
                        )}
                    </button>
                    <button className={currentPage === 'neonDrawing' ? "nav-item active" : "nav-item"} onClick={() => { setCurrentPage('neonDrawing'); setMobileSidebarOpen(false); }}>
                        <div className="nav-icon">
                            <Edit3 />
                        </div>
                        <span className="nav-text">ネオン下絵</span>
                        {!sidebarExpanded && (
                            <div className="tooltip">ネオン下絵</div>
                        )}
                    </button>
                    <button className={currentPage === 'customize' ? "nav-item active" : "nav-item"} onClick={() => { setCurrentPage('customize'); setMobileSidebarOpen(false); }}>
                        <div className="nav-icon">
                            <Settings />
                        </div>
                        <span className="nav-text">色 / 仕様のカスタマイズ</span>
                        {!sidebarExpanded && (
                            <div className="tooltip">色 / 仕様のカスタマイズ</div>
                        )}
                    </button>
                    <button className={currentPage === 'neonSvg3dPreview' ? "nav-item active" : "nav-item"} onClick={() => { 
                      setCurrentPage('neonSvg3dPreview'); 
                      setMobileSidebarOpen(false); 
                    }}>
                        <div className="nav-icon">
                            <Eye />
                        </div>
                        <span className="nav-text">3Dプレビュー</span>
                        {!sidebarExpanded && (
                            <div className="tooltip">3Dプレビュー</div>
                        )}
                    </button>
                    <button className={currentPage === 'info' ? "nav-item active" : "nav-item"} onClick={() => { setCurrentPage('info'); setMobileSidebarOpen(false); }}>
                        <div className="nav-icon">
                            <Package />
                        </div>
                        <span className="nav-text">商品情報</span>
                        {!sidebarExpanded && (
                            <div className="tooltip">商品情報</div>
                        )}
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
