import React, { useState, useRef, useEffect } from 'react';
import './CustomizeGuideModal.css';

const CustomizeGuideModal = ({ isOpen, onClose }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
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
    if (currentTime >= 0 && currentTime < 60) return 1;
    if (currentTime >= 60 && currentTime < 150) return 2;
    if (currentTime >= 150 && currentTime < 270) return 3;
    if (currentTime >= 270) return 4;
    return 1;
  };

  const handleContainerClick = (containerNumber) => {
    const video = currentPage === 1 ? videoRef.current : videoRef2.current;
    if (video) {
      let targetTime = 0;
      switch(containerNumber) {
        case 1: targetTime = 0; break;
        case 2: targetTime = 60; break;
        case 3: targetTime = 150; break;
        case 4: targetTime = 270; break;
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
                  
                  <div 
                    className={`customize-content-container ${getActiveContainer() === 1 ? 'active' : ''}`} 
                    data-time="0-60"
                    onClick={() => handleContainerClick(1)}
                    style={{ cursor: 'pointer' }}
                  >
                    <h4 className="customize-container-title">基本的なキャンバスの操作方法</h4>
                    <p className="customize-container-description">キャンバスの基本的な操作方法は、ネオン下絵のキャンバスの操作方法と全く同じです。</p>
                    <p className="customize-container-description">右クリック＋ドラッグで視点移動</p>
                    <p className="customize-container-description">マウスホイールで拡大 / 縮小</p>
                  </div>
                  
                  <div 
                    className={`customize-content-container ${getActiveContainer() === 2 ? 'active' : ''}`} 
                    data-time="60-150"
                    onClick={() => handleContainerClick(2)}
                    style={{ cursor: 'pointer' }}
                  >
                    <h4 className="customize-container-title">「キャンバスからチューブを選択」ボタンでチューブを一括設定</h4>
                    <p className="customize-container-description">キャンバスのチューブをクリックして一括設定するチューブを選択</p>
                    <p className="customize-container-description">選択したチューブの入と太さを選択</p>
                    <p className="customize-container-description">「完了」ボタンで適用</p>
                  </div>
                  
                  <div 
                    className={`customize-content-container ${getActiveContainer() === 3 ? 'active' : ''}`} 
                    data-time="150-270"
                    onClick={() => handleContainerClick(3)}
                    style={{ cursor: 'pointer' }}
                  >
                    <h4 className="customize-container-title">「ネオンチューブ設定」ではチューブを個別に設定可能</h4>
                    <p className="customize-container-description">コンテナを選択してキャンバスにハイライト</p>
                    <p className="customize-container-description">キャンバスからチューブを直接選択して編集</p>
                    <p className="customize-container-description">「色を選択」ボタンで色を変更</p>
                    <p className="customize-container-description">太さ項目で太さを変更</p>
                  </div>
                  
                  <div 
                    className={`customize-content-container ${getActiveContainer() === 4 ? 'active' : ''}`} 
                    data-time="270-330"
                    onClick={() => handleContainerClick(4)}
                    style={{ cursor: 'pointer' }}
                  >
                    <h4 className="customize-container-title">その他の機能</h4>
                    <p className="customize-container-description">「一番上に戻る」ボタンで最上へ移動</p>
                    <p className="customize-container-description">トグルボタンでネオンチューブ設定を最小化</p>
                    <p className="customize-container-description"> ON / OFFスイッチで点灯 / 消灯切り替え</p>
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
                  <h3 className="customize-guide-title">基本操作ガイド</h3>
                  
                  <div 
                    className={`customize-content-container ${getActiveContainer() === 1 ? 'active' : ''}`} 
                    data-time="0-60"
                    onClick={() => handleContainerClick(1)}
                    style={{ cursor: 'pointer' }}
                  >
                    <h4 className="customize-container-title">基本的なキャンバスの操作方法</h4>
                    <p className="customize-container-description">キャンバスの基本的な操作方法は、ネオン下絵のキャンバスの操作方法と全く同じです。</p>
                    <p className="customize-container-description">右クリック＋ドラッグで視点移動</p>
                    <p className="customize-container-description">マウスホイールで拡大 / 縮小</p>
                  </div>
                  
                  <div 
                    className={`customize-content-container ${getActiveContainer() === 2 ? 'active' : ''}`} 
                    data-time="60-150"
                    onClick={() => handleContainerClick(2)}
                    style={{ cursor: 'pointer' }}
                  >
                    <h4 className="customize-container-title">「キャンバスからチューブを選択」ボタンでチューブを一括設定</h4>
                    <p className="customize-container-description">キャンバスのチューブをクリックして一括設定するチューブを選択</p>
                    <p className="customize-container-description">選択したチューブの入と太さを選択</p>
                    <p className="customize-container-description">「完了」ボタンで適用</p>
                  </div>
                  
                  <div 
                    className={`customize-content-container ${getActiveContainer() === 3 ? 'active' : ''}`} 
                    data-time="150-270"
                    onClick={() => handleContainerClick(3)}
                    style={{ cursor: 'pointer' }}
                  >
                    <h4 className="customize-container-title">「ネオンチューブ設定」ではチューブを個別に設定可能</h4>
                    <p className="customize-container-description">コンテナを選択してキャンバスにハイライト</p>
                    <p className="customize-container-description">キャンバスからチューブを直接選択して編集</p>
                    <p className="customize-container-description">「色を選択」ボタンで色を変更</p>
                    <p className="customize-container-description">太さ項目で太さを変更</p>
                  </div>
                  
                  <div 
                    className={`customize-content-container ${getActiveContainer() === 4 ? 'active' : ''}`} 
                    data-time="270-330"
                    onClick={() => handleContainerClick(4)}
                    style={{ cursor: 'pointer' }}
                  >
                    <h4 className="customize-container-title">その他の機能</h4>
                    <p className="customize-container-description">「一番上に戻る」ボタンで最上へ移動</p>
                    <p className="customize-container-description">トグルボタンでネオンチューブ設定を最小化</p>
                    <p className="customize-container-description"> ON / OFFスイッチで点灯 / 消灯切り替え</p>
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
          
          <div className="customize-dots-container">
            <span className={`customize-dot ${currentPage === 1 ? 'active' : ''}`}></span>
            <span className={`customize-dot ${currentPage === 2 ? 'active' : ''}`}></span>
            <span className={`customize-dot ${currentPage === 3 ? 'active' : ''}`}></span>
          </div>
          
          <span className="customize-page-text">{currentPage}/3</span>
          
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