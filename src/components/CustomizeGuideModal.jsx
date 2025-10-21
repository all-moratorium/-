import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './CustomizeGuideModal.css';

const CustomizeGuideModal = ({ isOpen, onClose }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [lastActiveContainer, setLastActiveContainer] = useState(1);
  const videoRef = useRef(null);
  const videoRef2 = useRef(null);
  const containerRef = useRef(null);
  const containerRef2 = useRef(null);
  const controlsTimeoutRef = useRef(null);

  useEffect(() => {
    const video = currentPage === 1 ? videoRef.current : videoRef2.current;
    
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
  }, [isOpen, currentPage]);

  useEffect(() => {
    const video = currentPage === 1 ? videoRef.current : videoRef2.current;
    if (video && isOpen && (currentPage === 1 || currentPage === 2)) {
      video.currentTime = 0;
      video.play().then(() => {
        setIsPlaying(true);
        setCurrentTime(0);
      }).catch((error) => {
        console.log('Autoplay prevented:', error);
        setIsPlaying(false);
      });
    }
  }, [isOpen, currentPage]);

  useEffect(() => {
    const activeContainer = getActiveContainer();
    
    if (activeContainer !== lastActiveContainer) {
      setLastActiveContainer(activeContainer);
      
      // 現在のページに対応するアクティブな要素を取得
      const currentPageElement = document.querySelector(`.customize-guide-page:nth-child(${currentPage}).active`);
      if (currentPageElement) {
        const activeElement = currentPageElement.querySelector('.customize-content-container.active');
        
        if (activeElement) {
          const contentSection = activeElement.closest('.customize-content-section');
          if (contentSection) {
            const elementTop = activeElement.offsetTop;
            const elementHeight = activeElement.offsetHeight;
            const containerHeight = contentSection.offsetHeight;
            const scrollTop = contentSection.scrollTop;
            
            const elementBottom = elementTop + elementHeight;
            const containerBottom = scrollTop + containerHeight;
            
            if (elementTop < scrollTop || elementBottom > containerBottom) {
              activeElement.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
              });
            }
          }
        }
      }
    }
  }, [currentTime, currentPage, lastActiveContainer]);

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

  const handleVideoClick = () => {
    const video = currentPage === 1 ? videoRef.current : videoRef2.current;
    if (video) {
      if (video.paused) {
        video.play().then(() => {
          setIsPlaying(true);
        }).catch((error) => {
          console.log('Play failed:', error);
        });
      } else {
        video.pause();
        setIsPlaying(false);
      }
    }
  };

  const handleProgressClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percentage = (e.clientX - rect.left) / rect.width;
    const video = currentPage === 1 ? videoRef.current : videoRef2.current;
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
    if (currentTime >= 0 && currentTime < 12) return 1;
    if (currentTime >= 12 && currentTime < 49) return 2;
    if (currentTime >= 49 && currentTime < 77) return 3;
    if (currentTime >= 77) return 4;
    return 1;
  };

  const handleContainerClick = (containerNumber) => {
    const video = currentPage === 1 ? videoRef.current : videoRef2.current;
    if (video) {
      let targetTime = 0;
      switch(containerNumber) {
        case 1: targetTime = 0; break;
        case 2: targetTime = 12; break;
        case 3: targetTime = 49; break;
        case 4: targetTime = 77; break;
      }
      video.currentTime = targetTime;
      setCurrentTime(targetTime);
    }
  };

  const getVideoDuration = () => {
    const video = currentPage === 1 ? videoRef.current : videoRef2.current;
    return video && video.duration ? Math.floor(video.duration) : 0;
  };

  const handleFullscreen = () => {
    const videoSections = document.querySelectorAll('.customize-video-section');
    const activeVideoSection = videoSections[currentPage - 1];
    
    if (activeVideoSection) {
      if (!isFullscreen) {
        if (activeVideoSection.requestFullscreen) {
          activeVideoSection.requestFullscreen();
        } else if (activeVideoSection.webkitRequestFullscreen) {
          activeVideoSection.webkitRequestFullscreen();
        } else if (activeVideoSection.msRequestFullscreen) {
          activeVideoSection.msRequestFullscreen();
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
      setLastActiveContainer(1);
    }
  };

  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
      setLastActiveContainer(1);
    }
  };

  const resetAndClose = () => {
    setCurrentPage(1);
    onClose();
  };

  return createPortal(
    <div className="customize-guide-modal-overlay">
      <div className="customize-guide-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* ヘッダー */}
        <div className="customize-guide-modal-header">
          <div className="customize-guide-header">
            <h2 className="customize-guide-title">色 / 仕様のカスタマイズガイド</h2>
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
                      onClick={handleVideoClick}
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
                  
                  <div 
                    className={`customize-content-container ${getActiveContainer() === 1 ? 'active' : ''}`} 
                    data-time="0-11"
                    onClick={() => handleContainerClick(1)}
                    style={{ cursor: 'pointer' }}
                  >
                    <h4 className="customize-container-title">基本的なキャンバスの操作方法</h4>
                    <p className="customize-container-description">キャンバスの基本的な操作方法は、ネオン下絵のキャンバスの操作方法と全く同じです。</p>
                    <ul className="customize-tips-list">
                      <li className="customize-tips-item">右クリック＋ドラッグで視点移動</li>
                      <li className="customize-tips-item">マウスホイールで拡大 / 縮小</li>
                      <li className="customize-tips-item">「視点リセット」ボタンで視点をリセット</li>
                    </ul>
                  </div>
                  
                  <div 
                    className={`customize-content-container ${getActiveContainer() === 2 ? 'active' : ''}`} 
                    data-time="11-49"
                    onClick={() => handleContainerClick(2)}
                    style={{ cursor: 'pointer' }}
                  >
                    <h4 className="customize-container-title">「キャンバスからチューブを選択」ボタンでチューブを一括設定</h4>
                    
                    <ol className="customize-steps-list">
                      <li className="customize-step-item">キャンバスのチューブをクリックして一括設定するチューブを選択</li>
                      <li className="customize-step-item">選択したチューブの色と太さを選択</li>
                      <li className="customize-step-item">「完了」ボタンで適用</li>
                    </ol>
                  </div>
                  
                  <div 
                    className={`customize-content-container ${getActiveContainer() === 3 ? 'active' : ''}`} 
                    data-time="49-77"
                    onClick={() => handleContainerClick(3)}
                    style={{ cursor: 'pointer' }}
                  >
                    <h4 className="customize-container-title">「ネオンチューブ設定」でチューブを個別に設定</h4>
                    
                    <ol className="customize-steps-list">
                      <li className="customize-step-item">コンテナを選択してキャンバスにハイライト</li>
                      <li className="customize-step-item">キャンバスからチューブを直接選択</li>
                      <li className="customize-step-item">「色を選択」ボタンで色を変更</li>
                      <li className="customize-step-item">太さ項目で太さを変更</li>
                    </ol>
                  </div>
                  
                  <div 
                    className={`customize-content-container ${getActiveContainer() === 4 ? 'active' : ''}`} 
                    data-time="77-99"
                    onClick={() => handleContainerClick(4)}
                    style={{ cursor: 'pointer' }}
                  >
                    <h4 className="customize-container-title">その他の機能</h4>
                    <ul className="customize-tips-list">
                      <li className="customize-tips-item">「一番上に戻る」ボタンで最上へ移動</li>
                      <li className="customize-tips-item">トグルボタンでネオンチューブ設定を最小化</li>
                      <li className="customize-tips-item">ON / OFFスイッチで点灯 / 消灯切り替え</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ページ2 */}
          <div className={`customize-guide-page ${currentPage === 2 ? 'active' : ''}`}>
            <div className="customize-guide-content">
              <div className="customize-modal-content">
                <div className="customize-video-section" onMouseMove={handleMouseMove}>
                  <div className="customize-video-container" ref={containerRef2}>
                    <video 
                      ref={videoRef2}
                      src="/ネオン下絵　ガイドモーダル/カスタマイズガイド2.mp4"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      autoPlay
                      loop
                      muted
                      controls={false}
                      controlsList="nodownload nofullscreen noremoteplayback"
                      disablePictureInPicture
                      onContextMenu={(e) => e.preventDefault()}
                      onClick={handleVideoClick}
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
                    <div className="customize-step-number">2</div>
                    <div className="customize-step-text">PAGE 2</div>
                  </div>
                  <h3 className="customize-guide-title">基本操作ガイド2</h3>
                  
                  <div 
                    className={`customize-content-container ${getActiveContainer() === 1 ? 'active' : ''}`} 
                    data-time="0-12"
                    onClick={() => handleContainerClick(1)}
                    style={{ cursor: 'pointer' }}
                  >
                    <h4 className="customize-container-title">色 / 仕様の情報を保存</h4>
                    <p className="customize-container-description">色 / 仕様の情報を保存することで、次回の作業で同じ設定を再現できます。</p>
                    <ul className="customize-steps-list">
                      <li className="customize-step-item">「保存」ボタンで下絵と色 / 仕様の保存を保存</li>
                      <li className="customize-step-item">保存するファイルの名前を入力</li>
                    </ul>
                  </div>
                  <div 
                    className={`customize-content-container ${getActiveContainer() === 2 ? 'active' : ''}`} 
                    data-time="12-24"
                    onClick={() => handleContainerClick(2)}
                    style={{ cursor: 'pointer' }}
                  >
                    <h4 className="customize-container-title">3Dモデルを生成</h4>
                    <ul className="customize-steps-list">
                      <li className="customize-step-item">「3Dモデル生成」ボタンを押すと3Dモデルが生成され、レンダリング完了後3Dプレビューページに移動</li>
                    </ul>
                  </div>
                  <div className="customize-supplement-container">
                    <h4 className="customize-supplement-title">📝 保存ファイルについて</h4>
                    <ul className="customize-supplement-list">
                      <li className="customize-supplement-item">ネオン下絵で保存したファイルは下絵のみ保存されます</li>
                      <li className="customize-supplement-item">色 / 仕様の保存ファイルは下絵と色 / 仕様の情報が保存されます</li>
                      <li className="customize-supplement-item">色 / 仕様の保存ファイルはどちらのページからでも読み込みできます</li>
                    </ul>
                  </div>
                 
                  
                  
                  
                </div>
              </div>
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
    </div>,
    document.body
  );
};

export default CustomizeGuideModal;