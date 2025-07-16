import React, { useState, useRef, useEffect } from 'react';
import './CustomizeGuideModal.css';

const CustomizeGuideModal = ({ isOpen, onClose }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const controlsTimeoutRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      const updateTime = () => {
        setCurrentTime(Math.floor(video.currentTime));
      };
      
      const handleEnded = () => {
        setIsPlaying(false);
        setCurrentTime(0);
      };

      const handleLoadedMetadata = () => {
        setCurrentTime(Math.floor(video.currentTime));
      };

      video.addEventListener('timeupdate', updateTime);
      video.addEventListener('ended', handleEnded);
      video.addEventListener('loadedmetadata', handleLoadedMetadata);

      return () => {
        video.removeEventListener('timeupdate', updateTime);
        video.removeEventListener('ended', handleEnded);
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      };
    }
  }, [isOpen]);

  useEffect(() => {
    const video = videoRef.current;
    if (video && isOpen && currentPage === 1) {
      video.currentTime = 0;
      video.play().then(() => {
        setIsPlaying(true);
        setCurrentTime(0);
      });
    }
  }, [isOpen, currentPage]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const fullscreenState = !!document.fullscreenElement;
      setIsFullscreen(fullscreenState);
      if (fullscreenState) {
        setShowControls(true);
        resetControlsTimeout();
      } else {
        setShowControls(true);
        if (controlsTimeoutRef.current) {
          clearTimeout(controlsTimeoutRef.current);
        }
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isFullscreen) {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        }
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen]);

  const resetControlsTimeout = () => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isFullscreen) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  };

  const handleMouseMove = () => {
    if (isFullscreen) {
      setShowControls(true);
      resetControlsTimeout();
    }
  };

  const handleProgressClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percentage = (e.clientX - rect.left) / rect.width;
    const video = videoRef.current;
    if (video) {
      const newTime = percentage * video.duration;
      video.currentTime = newTime;
      setCurrentTime(Math.floor(newTime));
    }
  };

  const handleProgressMouseMove = (e) => {
    if (e.buttons === 1) { // マウス左ボタンが押されている間
      handleProgressClick(e);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getActiveContainer = () => {
    if (currentTime >= 0 && currentTime < 60) return 1;
    if (currentTime >= 60 && currentTime < 150) return 2;
    if (currentTime >= 150 && currentTime < 270) return 3;
    if (currentTime >= 270) return 4;
    return 1;
  };

  const getVideoDuration = () => {
    return videoRef.current && videoRef.current.duration ? Math.floor(videoRef.current.duration) : 0;
  };

  const handleFullscreen = () => {
    const videoSection = document.querySelector('.customize-video-section');
    if (videoSection) {
      if (!isFullscreen) {
        if (videoSection.requestFullscreen) {
          videoSection.requestFullscreen();
        } else if (videoSection.webkitRequestFullscreen) {
          videoSection.webkitRequestFullscreen();
        } else if (videoSection.msRequestFullscreen) {
          videoSection.msRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
          document.msExitFullscreen();
        }
      }
    }
  };

  if (!isOpen) return null;

  const nextPage = () => {
    if (currentPage < 3) {
      setCurrentPage(currentPage + 1);
    }
  };

  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const resetAndClose = () => {
    setCurrentPage(1);
    onClose();
  };

  return (
    <div className="customize-guide-modal-overlay">
      <div className="customize-guide-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* ヘッダー */}
        <div className="customize-guide-modal-header">
          <div className="customize-guide-header">
            <h2 className="customize-guide-title">色仕様のカスタマイズガイド</h2>
          </div>
          <button className="customize-guide-modal-close" onClick={resetAndClose}>
            ×
          </button>
        </div>

        {/* ページコンテンツエリア */}
        <div className="customize-guide-modal-body">
          {/* ページ1 */}
          <div className={`customize-guide-page ${currentPage === 1 ? 'active' : ''}`}>
            <div className="customize-guide-content">
              <div className="customize-modal-content">
                <div className="customize-video-section" onMouseMove={handleMouseMove}>
                  <div className="customize-video-container" ref={containerRef}>
                    <video 
                      ref={videoRef}
                      src="/ネオン下絵　ガイドモーダル/カスタマイズガイド1.mp4"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      autoPlay
                      loop
                      muted
                      controls={false}
                      controlsList="nodownload nofullscreen noremoteplayback"
                      disablePictureInPicture
                      onContextMenu={(e) => e.preventDefault()}
                    />
                  </div>
                  <div className={`customize-video-controls ${isFullscreen && !showControls ? 'hidden' : ''}`}>
                    <div 
                      className="customize-video-progress" 
                      onClick={handleProgressClick}
                      onMouseMove={handleProgressMouseMove}
                    >
                      <div className="customize-progress-bar" style={{ width: `${(currentTime / getVideoDuration()) * 100}%` }}></div>
                    </div>
                    <div className="customize-video-time">
                      {formatTime(currentTime)} / {formatTime(getVideoDuration())}
                    </div>
                    <button 
                      onClick={handleFullscreen}
                      className="customize-fullscreen-btn"
                    >
                      {isFullscreen ? '⛶ 全画面終了' : '⛶ 全画面表示'}
                    </button>
                  </div>
                </div>
                <div className="customize-content-section">
                  <div className="customize-step-indicator">
                    <div className="customize-step-number">1</div>
                    <div className="customize-step-text">PAGE 1</div>
                  </div>
                  <h3 className="customize-guide-title">基本操作ガイド</h3>
                  
                  <div className={`customize-content-container ${getActiveContainer() === 1 ? 'active' : ''}`} data-time="0-60">
                    <h4 className="customize-container-title">基本的な考え方</h4>
                    <p className="customize-container-description">作成したいコンテンツについて、できるだけ具体的に説明してください。AIは詳細な情報を元に、より正確で有用な結果を生成することができます。</p>
                    <p className="customize-container-description">自然言語で自由に記述でき、具体的な要求や制約条件も指定可能です。文章の長さ、書式、トーン、対象読者なども併せて指定すると、より期待に沿った内容が生成されます。</p>
                  </div>
                  
                  <div className={`customize-content-container ${getActiveContainer() === 2 ? 'active' : ''}`} data-time="60-150">
                    <h4 className="customize-container-title">効果的な入力のポイント</h4>
                    <p className="customize-container-description">良いプロンプトを作成するためには、以下の要素を明確にすることが重要です：</p>
                    <ul className="customize-tips-list">
                      <li className="customize-tips-item">何を作成したいか（コンテンツの種類）</li>
                      <li className="customize-tips-item">誰に向けたものか（対象読者・ターゲット）</li>
                      <li className="customize-tips-item">どのような目的で使うか（用途・目標）</li>
                      <li className="customize-tips-item">どの程度の長さや詳しさが必要か</li>
                      <li className="customize-tips-item">どのようなトーンで書いてほしいか</li>
                    </ul>
                  </div>
                  
                  <div className={`customize-content-container ${getActiveContainer() === 3 ? 'active' : ''}`} data-time="150-270">
                    <h4 className="customize-container-title">入力例</h4>
                    <p className="customize-container-description">効果的なプロンプトの例をご紹介します。具体的で詳細な指示ほど、AIはより正確で有用な結果を生成できます。</p>
                    <p className="customize-container-description">「新入社員向けの会社説明資料を作成してください。IT企業の概要、事業内容、働く環境について、A4サイズ3ページ程度で、親しみやすく分かりやすい文体でお願いします。」</p>
                    <p className="customize-container-description">さらに詳しく指定する場合：「弊社（従業員100名のWeb制作会社）の新入社員向け会社説明資料を作成してください。会社の歴史・ミッション、主要サービス（Webサイト制作、アプリ開発、デジタルマーケティング）、社内制度（フレックス制度、リモートワーク、研修制度）について説明し、新入社員が安心して働けることを伝えたいです。A4サイズ3ページ、見出しと箇条書きを使った読みやすい構成で、温かみのある文体でお願いします。」</p>
                  </div>
                  
                  <div className={`customize-content-container ${getActiveContainer() === 4 ? 'active' : ''}`} data-time="270-330">
                    <h4 className="customize-container-title">よくある注意点</h4>
                    <p className="customize-container-description">以下のような曖昧な指示は避け、具体的な要求を心がけましょう：</p>
                    <ul className="customize-tips-list">
                      <li className="customize-tips-item">「いい感じの資料を作って」→ 具体的な用途と要件を明記</li>
                      <li className="customize-tips-item">「短めで」→ 文字数や分量を具体的に指定</li>
                      <li className="customize-tips-item">「分かりやすく」→ 対象読者のレベルを明確に</li>
                      <li className="customize-tips-item">「おしゃれに」→ 求めるデザインの方向性を詳しく</li>
                    </ul>
                    <p className="customize-container-description">詳細な説明を入力するほど、AIがあなたの意図を正確に理解し、高品質なコンテンツを生成できるようになります。遠慮せずに、思っていることを具体的に書いてください。</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ページ2 */}
          <div className={`customize-guide-page ${currentPage === 2 ? 'active' : ''}`}>
            <div className="customize-guide-content">
              {/* コンテンツは空白 */}
            </div>
          </div>

          {/* ページ3 */}
          <div className={`customize-guide-page ${currentPage === 3 ? 'active' : ''}`}>
            <div className="customize-guide-content">
              {/* コンテンツは空白 */}
            </div>
          </div>
        </div>

        {/* ナビゲーション */}
        <div className="customize-guide-navigation">
          <button 
            className="customize-nav-button prev" 
            onClick={prevPage}
            disabled={currentPage === 1}
          >
            ← 前のページ
          </button>
          
          <div className="customize-page-indicator">
            <span className={`customize-dot ${currentPage === 1 ? 'active' : ''}`}></span>
            <span className={`customize-dot ${currentPage === 2 ? 'active' : ''}`}></span>
            <span className={`customize-dot ${currentPage === 3 ? 'active' : ''}`}></span>
            <span className="customize-page-text">{currentPage}/3</span>
          </div>
          
          <button 
            className="customize-nav-button next" 
            onClick={nextPage}
            disabled={currentPage === 3}
          >
            次のページ →
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomizeGuideModal;