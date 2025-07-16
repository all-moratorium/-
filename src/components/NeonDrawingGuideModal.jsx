import React, { useState, useRef, useEffect } from 'react';
import './NeonDrawingGuideModal.css';

const NeonDrawingGuideModal = ({ isOpen, onClose }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const videoRef = useRef(null);
  const videoRef2 = useRef(null);
  const videoRef3 = useRef(null);
  const videoRef4 = useRef(null);
  const containerRef = useRef(null);
  const containerRef2 = useRef(null);
  const containerRef3 = useRef(null);
  const containerRef4 = useRef(null);
  const controlsTimeoutRef = useRef(null);

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
    const video = getCurrentVideo();
    if (video && isOpen && currentPage >= 1 && currentPage <= 4) {
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

  const getCurrentVideo = () => {
    switch(currentPage) {
      case 1: return videoRef.current;
      case 2: return videoRef2.current;
      case 3: return videoRef3.current;
      case 4: return videoRef4.current;
      default: return videoRef.current;
    }
  };

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
    const video = getCurrentVideo();
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
    const video = getCurrentVideo();
    return video && video.duration ? Math.floor(video.duration) : 0;
  };

  const handleFullscreen = () => {
    const videoSections = document.querySelectorAll('.neon-drawing-video-section');
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
    if (currentPage < 4) {
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
    <div className="neon-drawing-guide-modal-overlay">
      <div className="neon-drawing-guide-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* ヘッダー */}
        <div className="neon-drawing-guide-modal-header">
          <div className="neon-drawing-guide-header">
            <h2 className="neon-drawing-guide-title">ネオン下絵ガイド</h2>
          </div>
          <button className="neon-drawing-guide-modal-close" onClick={resetAndClose}>
            ×
          </button>
        </div>

        {/* ページコンテンツエリア */}
        <div className="neon-drawing-guide-modal-body">
          {/* ページ1 */}
          <div className={`neon-drawing-guide-page ${currentPage === 1 ? 'active' : ''}`}>
            <div className="neon-drawing-guide-content">
              <div className="neon-drawing-modal-content">
                <div className="neon-drawing-video-section" onMouseMove={handleMouseMove}>
                  <div className="neon-drawing-video-container" ref={containerRef}>
                    <video 
                      ref={videoRef}
                      src="/ネオン下絵　ガイドモーダル/ネオンガイド1.mp4"
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
                  <div className={`neon-drawing-video-controls ${isFullscreen && !showControls ? 'hidden' : ''}`}>
                    <div 
                      className="neon-drawing-video-progress" 
                      onClick={handleProgressClick}
                      onMouseMove={handleProgressMouseMove}
                    >
                      <div className="neon-drawing-progress-bar" style={{ width: `${(currentTime / getVideoDuration()) * 100}%` }}></div>
                    </div>
                    <div className="neon-drawing-video-time">
                      {formatTime(currentTime)} / {formatTime(getVideoDuration())}
                    </div>
                    <button 
                      onClick={handleFullscreen}
                      className="neon-drawing-fullscreen-btn"
                    >
                      {isFullscreen ? '⛶ 全画面終了' : '⛶ 全画面表示'}
                    </button>
                  </div>
                </div>
                <div className="neon-drawing-content-section">
                  <div className="neon-drawing-step-indicator">
                    <div className="neon-drawing-step-number">1</div>
                    <div className="neon-drawing-step-text">PAGE 1</div>
                  </div>
                  <h3 className="neon-drawing-guide-title">基本操作ガイド</h3>
                  
                  <div 
                    className={`neon-drawing-content-container ${getActiveContainer() === 1 ? 'active' : ''}`} 
                    data-time="0-12"
                    onClick={() => handleContainerClick(1)}
                    style={{ cursor: 'pointer' }}
                  >
                    <h4 className="neon-drawing-container-title">基本的なキャンバスの操作方法</h4>
                    <p className="neon-drawing-container-description">キャンバスの基本的な操作方法は、ネオン下絵のキャンバスの操作方法と全く同じです。</p>
                    <ul className="neon-drawing-tips-list">
                      <li className="neon-drawing-tips-item">右クリック＋ドラッグで視点移動</li>
                      <li className="neon-drawing-tips-item">マウスホイールで拡大 / 縮小</li>
                    </ul>
                  </div>
                  
                  <div 
                    className={`neon-drawing-content-container ${getActiveContainer() === 2 ? 'active' : ''}`} 
                    data-time="12-49"
                    onClick={() => handleContainerClick(2)}
                    style={{ cursor: 'pointer' }}
                  >
                    <h4 className="neon-drawing-container-title">線の描き方</h4>
                    <p className="neon-drawing-container-description">ペンツールを使って線を描く方法</p>
                    <ol className="neon-drawing-steps-list">
                      <li className="neon-drawing-step-item">ペンツールを選択</li>
                      <li className="neon-drawing-step-item">クリックして線を描く</li>
                    </ol>
                  </div>
                  
                  <div 
                    className={`neon-drawing-content-container ${getActiveContainer() === 3 ? 'active' : ''}`} 
                    data-time="49-77"
                    onClick={() => handleContainerClick(3)}
                    style={{ cursor: 'pointer' }}
                  >
                    <h4 className="neon-drawing-container-title">色の塗り方</h4>
                    <p className="neon-drawing-container-description">線に色を塗る方法</p>
                    <ol className="neon-drawing-steps-list">
                      <li className="neon-drawing-step-item">色を選択</li>
                      <li className="neon-drawing-step-item">線をクリックして塗りつぶし</li>
                    </ol>
                  </div>
                  
                  <div 
                    className={`neon-drawing-content-container ${getActiveContainer() === 4 ? 'active' : ''}`} 
                    data-time="77-99"
                    onClick={() => handleContainerClick(4)}
                    style={{ cursor: 'pointer' }}
                  >
                    <h4 className="neon-drawing-container-title">保存機能</h4>
                    <ul className="neon-drawing-tips-list">
                      <li className="neon-drawing-tips-item">保存ボタンで作品を保存</li>
                      <li className="neon-drawing-tips-item">読み込みボタンで作品を復元</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ページ2 */}
          <div className={`neon-drawing-guide-page ${currentPage === 2 ? 'active' : ''}`}>
            <div className="neon-drawing-guide-content">
              <div className="neon-drawing-modal-content">
                <div className="neon-drawing-video-section" onMouseMove={handleMouseMove}>
                  <div className="neon-drawing-video-container" ref={containerRef2}>
                    <video 
                      ref={videoRef2}
                      src="/ネオン下絵　ガイドモーダル/ネオンガイド2.mp4"
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
                  <div className={`neon-drawing-video-controls ${isFullscreen && !showControls ? 'hidden' : ''}`}>
                    <div 
                      className="neon-drawing-video-progress" 
                      onClick={handleProgressClick}
                      onMouseMove={handleProgressMouseMove}
                    >
                      <div className="neon-drawing-progress-bar" style={{ width: `${(currentTime / getVideoDuration()) * 100}%` }}></div>
                    </div>
                    <div className="neon-drawing-video-time">
                      {formatTime(currentTime)} / {formatTime(getVideoDuration())}
                    </div>
                    <button 
                      onClick={handleFullscreen}
                      className="neon-drawing-fullscreen-btn"
                    >
                      {isFullscreen ? '⛶ 全画面終了' : '⛶ 全画面表示'}
                    </button>
                  </div>
                </div>
                <div className="neon-drawing-content-section">
                  <div className="neon-drawing-step-indicator">
                    <div className="neon-drawing-step-number">2</div>
                    <div className="neon-drawing-step-text">PAGE 2</div>
                  </div>
                  <h3 className="neon-drawing-guide-title">応用操作ガイド</h3>
                  
                  <div 
                    className={`neon-drawing-content-container ${getActiveContainer() === 1 ? 'active' : ''}`} 
                    data-time="0-12"
                    onClick={() => handleContainerClick(1)}
                    style={{ cursor: 'pointer' }}
                  >
                    <h4 className="neon-drawing-container-title">応用テクニック1</h4>
                    <p className="neon-drawing-container-description">より高度な描画テクニックを学びます。</p>
                    <ul className="neon-drawing-tips-list">
                      <li className="neon-drawing-tips-item">応用テクニック1の説明</li>
                      <li className="neon-drawing-tips-item">応用テクニック2の説明</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ページ3 */}
          <div className={`neon-drawing-guide-page ${currentPage === 3 ? 'active' : ''}`}>
            <div className="neon-drawing-guide-content">
              <div className="neon-drawing-modal-content">
                <div className="neon-drawing-video-section" onMouseMove={handleMouseMove}>
                  <div className="neon-drawing-video-container" ref={containerRef3}>
                    <video 
                      ref={videoRef3}
                      src="/ネオン下絵　ガイドモーダル/ネオンガイド3.mp4"
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
                  <div className={`neon-drawing-video-controls ${isFullscreen && !showControls ? 'hidden' : ''}`}>
                    <div 
                      className="neon-drawing-video-progress" 
                      onClick={handleProgressClick}
                      onMouseMove={handleProgressMouseMove}
                    >
                      <div className="neon-drawing-progress-bar" style={{ width: `${(currentTime / getVideoDuration()) * 100}%` }}></div>
                    </div>
                    <div className="neon-drawing-video-time">
                      {formatTime(currentTime)} / {formatTime(getVideoDuration())}
                    </div>
                    <button 
                      onClick={handleFullscreen}
                      className="neon-drawing-fullscreen-btn"
                    >
                      {isFullscreen ? '⛶ 全画面終了' : '⛶ 全画面表示'}
                    </button>
                  </div>
                </div>
                <div className="neon-drawing-content-section">
                  <div className="neon-drawing-step-indicator">
                    <div className="neon-drawing-step-number">3</div>
                    <div className="neon-drawing-step-text">PAGE 3</div>
                  </div>
                  <h3 className="neon-drawing-guide-title">エフェクト設定</h3>
                  
                  <div 
                    className={`neon-drawing-content-container ${getActiveContainer() === 1 ? 'active' : ''}`} 
                    data-time="0-12"
                    onClick={() => handleContainerClick(1)}
                    style={{ cursor: 'pointer' }}
                  >
                    <h4 className="neon-drawing-container-title">ネオンエフェクト</h4>
                    <p className="neon-drawing-container-description">ネオンエフェクトの設定方法を学びます。</p>
                    <ul className="neon-drawing-tips-list">
                      <li className="neon-drawing-tips-item">エフェクトの種類を選択</li>
                      <li className="neon-drawing-tips-item">強度を調整</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ページ4 */}
          <div className={`neon-drawing-guide-page ${currentPage === 4 ? 'active' : ''}`}>
            <div className="neon-drawing-guide-content">
              <div className="neon-drawing-modal-content">
                <div className="neon-drawing-video-section" onMouseMove={handleMouseMove}>
                  <div className="neon-drawing-video-container" ref={containerRef4}>
                    <video 
                      ref={videoRef4}
                      src="/ネオン下絵　ガイドモーダル/ネオンガイド4.mp4"
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
                  <div className={`neon-drawing-video-controls ${isFullscreen && !showControls ? 'hidden' : ''}`}>
                    <div 
                      className="neon-drawing-video-progress" 
                      onClick={handleProgressClick}
                      onMouseMove={handleProgressMouseMove}
                    >
                      <div className="neon-drawing-progress-bar" style={{ width: `${(currentTime / getVideoDuration()) * 100}%` }}></div>
                    </div>
                    <div className="neon-drawing-video-time">
                      {formatTime(currentTime)} / {formatTime(getVideoDuration())}
                    </div>
                    <button 
                      onClick={handleFullscreen}
                      className="neon-drawing-fullscreen-btn"
                    >
                      {isFullscreen ? '⛶ 全画面終了' : '⛶ 全画面表示'}
                    </button>
                  </div>
                </div>
                <div className="neon-drawing-content-section">
                  <div className="neon-drawing-step-indicator">
                    <div className="neon-drawing-step-number">4</div>
                    <div className="neon-drawing-step-text">PAGE 4</div>
                  </div>
                  <h3 className="neon-drawing-guide-title">完成と出力</h3>
                  
                  <div 
                    className={`neon-drawing-content-container ${getActiveContainer() === 1 ? 'active' : ''}`} 
                    data-time="0-12"
                    onClick={() => handleContainerClick(1)}
                    style={{ cursor: 'pointer' }}
                  >
                    <h4 className="neon-drawing-container-title">作品の仕上げ</h4>
                    <p className="neon-drawing-container-description">作品を完成させて出力する方法を学びます。</p>
                    <ul className="neon-drawing-tips-list">
                      <li className="neon-drawing-tips-item">最終チェック</li>
                      <li className="neon-drawing-tips-item">出力設定</li>
                    </ul>
                  </div>
                  
                  <div className="neon-drawing-supplement-container">
                    <h4 className="neon-drawing-supplement-title">📝 完成後のヒント</h4>
                    <ul className="neon-drawing-supplement-list">
                      <li className="neon-drawing-supplement-item">作品は定期的に保存しましょう</li>
                      <li className="neon-drawing-supplement-item">色の組み合わせを工夫してみましょう</li>
                      <li className="neon-drawing-supplement-item">完成した作品は3Dプレビューで確認できます</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ナビゲーション */}
        <div className="neon-drawing-guide-navigation">
          <button 
            className="neon-drawing-nav-button prev" 
            onClick={prevPage}
            disabled={currentPage === 1}
          >
            ← 前のページ
          </button>
          
          <div className="neon-drawing-dots-container">
            <span className={`neon-drawing-dot ${currentPage === 1 ? 'active' : ''}`}></span>
            <span className={`neon-drawing-dot ${currentPage === 2 ? 'active' : ''}`}></span>
            <span className={`neon-drawing-dot ${currentPage === 3 ? 'active' : ''}`}></span>
            <span className={`neon-drawing-dot ${currentPage === 4 ? 'active' : ''}`}></span>
          </div>
          
          <span className="neon-drawing-page-text">{currentPage}/4</span>
          
          <button 
            className="neon-drawing-nav-button next" 
            onClick={nextPage}
            disabled={currentPage === 4}
          >
            次のページ →
          </button>
        </div>
      </div>
    </div>
  );
};

export default NeonDrawingGuideModal;