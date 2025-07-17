import React, { useState, useRef, useEffect } from 'react';
import './TextGeneratorGuideModal.css';

const TextGeneratorGuideModal = ({ isOpen, onClose }) => {
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
      
      const activeElement = document.querySelector('.text-generator-content-container.active');
      
      if (activeElement) {
        const contentSection = activeElement.closest('.text-generator-content-section');
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
    // 仮の実装 - 後で具体的なコンテンツに合わせて調整
    if (currentTime >= 0 && currentTime < 30) return 1;
    if (currentTime >= 30 && currentTime < 60) return 2;
    if (currentTime >= 60) return 3;
    return 1;
  };

  const handleContainerClick = (containerNumber) => {
    const video = getCurrentVideo();
    if (video) {
      let targetTime = 0;
      switch(containerNumber) {
        case 1: targetTime = 0; break;
        case 2: targetTime = 30; break;
        case 3: targetTime = 60; break;
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
    const videoSection = document.querySelector('.text-generator-video-section');
    
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

  return (
    <div className="text-generator-guide-modal-overlay">
      <div className="text-generator-guide-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* ヘッダー */}
        <div className="text-generator-guide-modal-header">
          <div className="text-generator-guide-header">
            <h2 className="text-generator-guide-title">テキストから生成ガイド</h2>
          </div>
          <button className="text-generator-guide-modal-close" onClick={resetAndClose}>
            ×
          </button>
        </div>

        {/* ページコンテンツエリア */}
        <div className="text-generator-guide-modal-body">
          {/* ページ1 */}
          <div className={`text-generator-guide-page ${currentPage === 1 ? 'active' : ''}`}>
            <div className="text-generator-guide-content">
              <div className="text-generator-modal-content">
                <div className="text-generator-video-section" onMouseMove={handleMouseMove}>
                  <div className="text-generator-video-container" ref={containerRef}>
                    <video 
                      ref={videoRef}
                      src="/ネオン下絵　ガイドモーダル/サンプル動画テキスト.mp4"
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
                  <div className={`text-generator-video-controls ${isFullscreen && !showControls ? 'hidden' : ''}`}>
                    <div 
                      className="text-generator-video-progress" 
                      onClick={handleProgressClick}
                      onMouseMove={handleProgressMouseMove}
                    >
                      <div className="text-generator-progress-bar" style={{ width: `${(currentTime / getVideoDuration()) * 100}%` }}></div>
                    </div>
                    <div className="text-generator-video-time">
                      {formatTime(currentTime)} / {formatTime(getVideoDuration())}
                    </div>
                    <button 
                      onClick={handleFullscreen}
                      className="text-generator-fullscreen-btn"
                    >
                      {isFullscreen ? '⛶ 全画面終了' : '⛶ 全画面表示'}
                    </button>
                  </div>
                </div>
                <div className="text-generator-content-section">
                  <div className="text-generator-step-indicator">
                    <div className="text-generator-step-number">1</div>
                    <div className="text-generator-step-text">PAGE 1</div>
                  </div>
                  <h3 className="text-generator-guide-title">テキストから生成ガイド</h3>
                  
                  <div 
                    className={`text-generator-content-container ${getActiveContainer() === 1 ? 'active' : ''}`} 
                    data-time="0-30"
                    onClick={() => handleContainerClick(1)}
                    style={{ cursor: 'pointer' }}
                  >
                    <h4 className="text-generator-container-title">テキスト入力</h4>
                    <p className="text-generator-container-description">AIが画像を生成するためのテキストを入力します。</p>
                    <ul className="text-generator-tips-list">
                      <li className="text-generator-tips-item">具体的な説明を入力</li>
                      <li className="text-generator-tips-item">スタイルを指定</li>
                    </ul>
                  </div>
                  
                  <div 
                    className={`text-generator-content-container ${getActiveContainer() === 2 ? 'active' : ''}`} 
                    data-time="30-60"
                    onClick={() => handleContainerClick(2)}
                    style={{ cursor: 'pointer' }}
                  >
                    <h4 className="text-generator-container-title">画像生成</h4>
                    <ol className="text-generator-steps-list">
                      <li className="text-generator-step-item">AIが画像を生成</li>
                      <li className="text-generator-step-item">結果を確認</li>
                    </ol>
                  </div>

                  <div 
                    className={`text-generator-content-container ${getActiveContainer() === 3 ? 'active' : ''}`} 
                    data-time="60-90"
                    onClick={() => handleContainerClick(3)}
                    style={{ cursor: 'pointer' }}
                  >
                    <h4 className="text-generator-container-title">活用方法</h4>
                    <ol className="text-generator-steps-list">
                      <li className="text-generator-step-item">背景として使用</li>
                      <li className="text-generator-step-item">ネオンサインの下絵作成</li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ページ2 */}
          <div className={`text-generator-guide-page ${currentPage === 2 ? 'active' : ''}`}>
            <div className="text-generator-guide-content">
              <div className="text-generator-modal-content">
                <div className="text-generator-content-section">
                  <div className="text-generator-step-indicator">
                    <div className="text-generator-step-number">2</div>
                    <div className="text-generator-step-text">PAGE 2</div>
                  </div>
                  <h3 className="text-generator-guide-title">準備中</h3>
                </div>
              </div>
            </div>
          </div>

          {/* ページ3 */}
          <div className={`text-generator-guide-page ${currentPage === 3 ? 'active' : ''}`}>
            <div className="text-generator-guide-content">
              <div className="text-generator-modal-content">
                <div className="text-generator-content-section">
                  <div className="text-generator-step-indicator">
                    <div className="text-generator-step-number">3</div>
                    <div className="text-generator-step-text">PAGE 3</div>
                  </div>
                  <h3 className="text-generator-guide-title">準備中</h3>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ナビゲーション */}
        <div className="text-generator-guide-navigation">
          <button 
            className="text-generator-nav-button prev" 
            onClick={prevPage}
            disabled={true}
          >
            ← 前のページ
          </button>
          
          <div className="text-generator-page-indicator">
            <span className="text-generator-dot active"></span>
            <span className="text-generator-page-text">1/1</span>
          </div>
          
          <button 
            className="text-generator-nav-button next" 
            onClick={nextPage}
            disabled={true}
          >
            次のページ →
          </button>
        </div>
      </div>
    </div>
  );
};

export default TextGeneratorGuideModal;