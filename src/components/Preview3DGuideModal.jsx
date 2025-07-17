import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './Preview3DGuideModal.css';

const Preview3DGuideModal = ({ isOpen, onClose }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [lastActiveContainer, setLastActiveContainer] = useState(1);
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const controlsTimeoutRef = useRef(null);

  const getCurrentVideo = () => {
    return videoRef.current;
  };

  useEffect(() => {
    const video = getCurrentVideo();
    
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
    const activeContainer = getActiveContainer();
    
    if (activeContainer !== lastActiveContainer) {
      setLastActiveContainer(activeContainer);
      
      const activeElement = document.querySelector('.preview3d-content-container.active');
      
      if (activeElement) {
        const contentSection = activeElement.closest('.preview3d-content-section');
        if (contentSection) {
          const elementTop = activeElement.offsetTop;
          const elementHeight = activeElement.offsetHeight;
          const containerHeight = contentSection.offsetHeight;
          const scrollTop = contentSection.scrollTop;
          
          const elementBottom = elementTop + elementHeight;
          const containerBottom = scrollTop + containerHeight;
          
          if (elementTop < scrollTop || elementBottom > containerBottom) {
            contentSection.scrollTo({
              top: elementTop - containerHeight / 2 + elementHeight / 2,
              behavior: 'smooth'
            });
          }
        }
      }
    }
  }, [currentTime, currentPage, lastActiveContainer]);

  useEffect(() => {
    const video = getCurrentVideo();
    if (video && isOpen) {
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
    const video = getCurrentVideo();
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
    const video = getCurrentVideo();
    if (video) {
      const newTime = percentage * video.duration;
      video.currentTime = newTime;
      setCurrentTime(Math.floor(newTime));
    }
  };

  const handleProgressMouseMove = (e) => {
    if (e.buttons === 1) {
      handleProgressClick(e);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getActiveContainer = () => {
    if (currentTime >= 0 && currentTime < 31) return 1;
    if (currentTime >= 31) return 2;
    return 1;
  };

  const handleContainerClick = (containerNumber) => {
    const video = getCurrentVideo();
    if (video) {
      let targetTime = 0;
      switch(containerNumber) {
        case 1: targetTime = 0; break;
        case 2: targetTime = 31; break;
      }
      video.currentTime = targetTime;
      setCurrentTime(targetTime);
    }
  };

  const getVideoDuration = () => {
    const video = getCurrentVideo();
    return video && video.duration ? Math.floor(video.duration) : 0;
  };

  const handleFullscreen = () => {
    const videoSection = document.querySelector('.preview3d-video-section');
    
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
    // 将来のページ追加用
  };

  const prevPage = () => {
    // 将来のページ追加用
  };

  const resetAndClose = () => {
    onClose();
  };

  return createPortal(
    <div className="preview3d-guide-modal-overlay">
      <div className="preview3d-guide-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* ヘッダー */}
        <div className="preview3d-guide-modal-header">
          <div className="preview3d-guide-header">
            <h2 className="preview3d-guide-title">3Dプレビューガイド</h2>
          </div>
          <button className="preview3d-guide-modal-close" onClick={resetAndClose}>
            ×
          </button>
        </div>

        {/* ページコンテンツエリア */}
        <div className="preview3d-guide-modal-body">
          {/* ページ1 */}
          <div className="preview3d-guide-page active">
            <div className="preview3d-guide-content">
              <div className="preview3d-modal-content">
                <div className="preview3d-video-section" onMouseMove={handleMouseMove}>
                  <div className="preview3d-video-container" ref={containerRef}>
                    <video 
                      ref={videoRef}
                      src="/ネオン下絵　ガイドモーダル/3Dプレビューガイド.mp4"
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
                  <div className={`preview3d-video-controls ${isFullscreen && !showControls ? 'hidden' : ''}`}>
                    <div 
                      className="preview3d-video-progress" 
                      onClick={handleProgressClick}
                      onMouseMove={handleProgressMouseMove}
                    >
                      <div className="preview3d-progress-bar" style={{ width: `${(currentTime / getVideoDuration()) * 100}%` }}></div>
                    </div>
                    <div className="preview3d-video-time">
                      {formatTime(currentTime)} / {formatTime(getVideoDuration())}
                    </div>
                    <button 
                      onClick={handleFullscreen}
                      className="preview3d-fullscreen-btn"
                    >
                      {isFullscreen ? '⛶ 全画面終了' : '⛶ 全画面表示'}
                    </button>
                  </div>
                </div>
                <div className="preview3d-content-section">
                  <div className="preview3d-step-indicator">
                    <div className="preview3d-step-number">1</div>
                    <div className="preview3d-step-text">PAGE 1</div>
                  </div>
                  <h3 className="preview3d-guide-title">3Dプレビューガイド</h3>
                  
                  <div 
                    className={`preview3d-content-container ${getActiveContainer() === 1 ? 'active' : ''}`} 
                    data-time="0-31"
                    onClick={() => handleContainerClick(1)}
                    style={{ cursor: 'pointer' }}
                  >
                    <h4 className="preview3d-container-title">操作ガイド</h4>
                    <ul className="preview3d-tips-list">
                      <li className="preview3d-tips-item">左クリック＋ドラッグで視点移動</li>
                      <li className="preview3d-tips-item">マウスホイールで拡大 / 縮小</li>
                      <li className="preview3d-tips-item">ON / OFFスイッチで点灯 / 消灯切り替え</li>
                      <li className="preview3d-tips-item">壁面照明スイッチで裏面を照らす外部光源を追加</li>
                    </ul>
                  </div>
                  
                  <div 
                    className={`preview3d-content-container ${getActiveContainer() === 2 ? 'active' : ''}`} 
                    data-time="31-32"
                    onClick={() => handleContainerClick(2)}
                    style={{ cursor: 'pointer' }}
                  >
                    <h4 className="preview3d-container-title">商品情報へ進む</h4>
                    <ol className="preview3d-steps-list">
                      <li className="preview3d-step-item">「商品情報へ進む」ボタンを押すと商品情報ページに移動し、そこで仕様を確認 / 注文が可能です。</li>
                    </ol>
                  </div>

                </div>
              </div>
            </div>
          </div>

        </div>

        {/* ナビゲーション */}
        <div className="preview3d-guide-navigation">
          <button 
            className="preview3d-nav-button prev" 
            onClick={prevPage}
            disabled={true}
          >
            ← 前のページ
          </button>
          
          <div className="preview3d-page-indicator">
            <span className="preview3d-dot active"></span>
            <span className="preview3d-page-text">1/1</span>
          </div>
          
          <button 
            className="preview3d-nav-button next" 
            onClick={nextPage}
            disabled={true}
          >
            次のページ →
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default Preview3DGuideModal;