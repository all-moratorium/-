import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './NeonDrawingGuideModal.css';

const NeonDrawingGuideModal = ({ isOpen, onClose }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [lastActiveContainer, setLastActiveContainer] = useState(1);
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
    const activeContainer = getActiveContainer();
    
    if (activeContainer !== lastActiveContainer) {
      setLastActiveContainer(activeContainer);
      
      // 現在のページに対応するアクティブな要素を取得
      const currentPageElement = document.querySelector(`.neon-drawing-guide-page:nth-child(${currentPage}).active`);
      if (currentPageElement) {
        const activeElement = currentPageElement.querySelector('.neon-drawing-content-container.active');
        
        if (activeElement) {
          const contentSection = activeElement.closest('.neon-drawing-content-section');
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
    if (currentPage === 1) {
      if (currentTime >= 0 && currentTime < 11) return 1;
      if (currentTime >= 11 && currentTime < 15) return 2;
      if (currentTime >= 15 && currentTime < 37) return 3;
      if (currentTime >= 37 && currentTime < 63) return 4;
      if (currentTime >= 63 && currentTime < 86) return 5;
      if (currentTime >= 86 && currentTime < 97) return 6;
      if (currentTime >= 97 && currentTime < 109) return 7;
      if (currentTime >= 109) return 8;
      return 1;
    } else if (currentPage === 2) {
      if (currentTime >= 0 && currentTime < 35) return 1;
      if (currentTime >= 35 && currentTime < 111) return 2;
      return 1;
    } else if (currentPage === 3) {
      if (currentTime >= 0 && currentTime < 26) return 1;
      if (currentTime >= 26 && currentTime < 99) return 2;
      if (currentTime >= 99 && currentTime < 118) return 3;
      if (currentTime >= 118 && currentTime < 133) return 4;
      if (currentTime >= 133 && currentTime < 148) return 5;
      if (currentTime >= 148) return 6;
      return 1;
    } else if (currentPage === 4) {
      if (currentTime >= 0 && currentTime < 51) return 1;
      if (currentTime >= 51 && currentTime < 70) return 2;
      if (currentTime >= 70) return 3;
      return 1;
    }
    return 1;
  };

  const handleContainerClick = (containerNumber) => {
    const video = getCurrentVideo();
    if (video) {
      let targetTime = 0;
      if (currentPage === 1) {
        switch(containerNumber) {
          case 1: targetTime = 0; break;
          case 2: targetTime = 11; break;
          case 3: targetTime = 15; break;
          case 4: targetTime = 37; break;
          case 5: targetTime = 63; break;
          case 6: targetTime = 86; break;
          case 7: targetTime = 97; break;
          case 8: targetTime = 109; break;
        }
      } else if (currentPage === 2) {
        switch(containerNumber) {
          case 1: targetTime = 0; break;
          case 2: targetTime = 35; break;
        }
      } else if (currentPage === 3) {
        switch(containerNumber) {
          case 1: targetTime = 0; break;
          case 2: targetTime = 26; break;
          case 3: targetTime = 99; break;
          case 4: targetTime = 118; break;
          case 5: targetTime = 133; break;
          case 6: targetTime = 148; break;
        }
      } else if (currentPage === 4) {
        switch(containerNumber) {
          case 1: targetTime = 0; break;
          case 2: targetTime = 51; break;
          case 3: targetTime = 70; break;
        }
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
          <div className={`neon-drawing-guide-page active ${currentPage !== 1 ? 'hidden' : ''}`}>
            <div className="neon-drawing-guide-content">
              <div className="neon-drawing-modal-content">
                <div className="neon-drawing-video-section" onMouseMove={handleMouseMove}>
                  <div className="neon-drawing-video-container" ref={containerRef}>
                    <div className="video-loader-wrapper">
                      <div className="video-loader"></div>
                    </div>
                    <video
                      ref={videoRef}
                      src="/ネオン下絵　ガイドモーダル/ネオン下絵ガイド1.mp4"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      autoPlay
                      loop
                      muted
                      controls={false}
                      controlsList="nodownload nofullscreen noremoteplayback"
                      disablePictureInPicture
                      onContextMenu={(e) => e.preventDefault()}
                      onClick={handleVideoClick}
                      onLoadedData={(e) => e.target.previousElementSibling.style.display = 'none'}
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
                    data-time="0-11"
                    onClick={() => handleContainerClick(1)}
                    style={{ cursor: 'pointer' }}
                  >
                    <h4 className="neon-drawing-container-title">基本的なキャンバスの操作方法</h4>
                    <p className="neon-drawing-container-description"></p>
                    <ul className="neon-drawing-tips-list">
                      <li className="neon-drawing-tips-item">右クリック＋ドラッグで視点移動</li>
                      <li className="neon-drawing-tips-item">マウスホイールで拡大 / 縮小</li>
                      <li className="neon-drawing-tips-item">「視点リセット」ボタンで視点をリセット</li>
                    </ul>
                  </div>
                  
                  <div 
                    className={`neon-drawing-content-container ${getActiveContainer() === 2 ? 'active' : ''}`} 
                    data-time="11-15"
                    onClick={() => handleContainerClick(2)}
                    style={{ cursor: 'pointer' }}
                  >
                    <h4 className="neon-drawing-container-title">描画モード</h4>
                    <p className="neon-drawing-container-description">現在の描画モードは「ネオンチューブ」テキストの上のステータスバーで確認できます</p>
                    <ol className="neon-drawing-steps-list">
                      <li className="neon-drawing-tips-item">チューブパス描画モード</li>
                      <li className="neon-drawing-tips-item">ベースプレート描画モード</li>
                      <li className="neon-drawing-tips-item">点修正モード</li>
                      <li className="neon-drawing-tips-item">点削除モード</li>
                      <li className="neon-drawing-tips-item">パス削除モード</li>
                    </ol>
                  </div>
                  
                  <div 
                    className={`neon-drawing-content-container ${getActiveContainer() === 3 ? 'active' : ''}`} 
                    data-time="15-37"
                    onClick={() => handleContainerClick(3)}
                    style={{ cursor: 'pointer' }}
                  >
                    <h4 className="neon-drawing-container-title">キャンバスに描画</h4>
                    <ol className="neon-drawing-steps-list">
                      <li className="neon-drawing-step-item">キャンバス上に左クリックで点を描画</li>
                      <li className="neon-drawing-step-item">「←戻る」ボタンで一つ前の状態に戻る</li>
                      <li className="neon-drawing-step-item">「進む→」ボタンで一つ前の状態に戻る</li>
                    </ol>
                  </div>
                  <div 
                    className={`neon-drawing-content-container ${getActiveContainer() === 4 ? 'active' : ''}`} 
                    data-time="37-63"
                    onClick={() => handleContainerClick(4)}
                    style={{ cursor: 'pointer' }}
                  >
                    <h4 className="neon-drawing-container-title">キャンバス上の点を修正</h4>
                    <ol className="neon-drawing-steps-list">
                      <li className="neon-drawing-step-item">「点修正」ボタンで選択した点を修正</li>
                      <li className="neon-drawing-step-item">ステータスが「点修正モードアクティブ中」に</li>
                      <li className="neon-drawing-step-item">左クリック＋ドラッグで点を修正</li>
                      <li className="neon-drawing-step-item">もう一度「点修正」ボタンを押して修正ツールを解除</li>
                      <li className="neon-drawing-step-item">ステータスが「チューブパス描画中」に戻る</li>
                    </ol>
                  </div>
                  <div 
                    className={`neon-drawing-content-container ${getActiveContainer() === 5 ? 'active' : ''}`} 
                    data-time="63-86"
                    onClick={() => handleContainerClick(5)}
                    style={{ cursor: 'pointer' }}
                  >
                    <h4 className="neon-drawing-container-title">キャンバス上の点を削除</h4>
                    <ol className="neon-drawing-steps-list">
                      <li className="neon-drawing-step-item">「点削除」ボタンで選択した点を削除</li>
                      <li className="neon-drawing-step-item">ステータスが「点削除モードアクティブ中」に</li>
                      <li className="neon-drawing-step-item">左クリックで点を削除</li>
                      <li className="neon-drawing-step-item">もう一度「点削除」ボタンを押して削除ツールを解除</li>
                      <li className="neon-drawing-step-item">ステータスが「チューブパス描画中」に戻る</li>
                    </ol>
                  </div>
                  <div 
                    className={`neon-drawing-content-container ${getActiveContainer() === 6 ? 'active' : ''}`} 
                    data-time="86-97"
                    onClick={() => handleContainerClick(6)}
                    style={{ cursor: 'pointer' }}
                  >
                    <h4 className="neon-drawing-container-title">キャンバス上のパスを削除</h4>
                    <ol className="neon-drawing-steps-list">
                      <li className="neon-drawing-step-item">「パス削除」ボタンで選択した点を削除</li>
                      <li className="neon-drawing-step-item">ステータスが「パス削除モードアクティブ中」に</li>
                      <li className="neon-drawing-step-item">左クリックでパスを削除</li>
                      <li className="neon-drawing-step-item">もう一度「パス削除」ボタンを押して削除ツールを解除</li>
                      <li className="neon-drawing-step-item">ステータスが「チューブパス描画中」に戻る</li>
                    </ol>
                  </div>


                  <div 
                    className={`neon-drawing-content-container ${getActiveContainer() === 7 ? 'active' : ''}`} 
                    data-time="97-109"
                    onClick={() => handleContainerClick(7)}
                    style={{ cursor: 'pointer' }}
                  >
                    <h4 className="neon-drawing-container-title">新たなパスを描画</h4>
                    <ol className="neon-drawing-steps-list">
                      <li className="neon-drawing-step-item">「新しいパス」ボタンを押して新たなパスを描画</li>
                      <li className="neon-drawing-step-item">ステータスが「チューブパス2描画中」に</li>
                      <li className="neon-drawing-step-item">キャンバス上に左クリックで新たなパスの点を描画</li>
                    </ol>
                  </div>
                  <div 
                    className={`neon-drawing-content-container ${getActiveContainer() === 8 ? 'active' : ''}`} 
                    data-time="109-114"
                    onClick={() => handleContainerClick(8)}
                    style={{ cursor: 'pointer' }}
                  >
                    <h4 className="neon-drawing-container-title">キャンバス上の全ての要素を削除する</h4>
                    <ol className="neon-drawing-steps-list">
                      <li className="neon-drawing-step-item">「すべてクリア」ボタンを押してキャンバスのすべての要素をクリア</li>
                    </ol>
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
                      src="/ネオン下絵　ガイドモーダル/ネオン下絵ガイド　1.webm"
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
                  <h3 className="neon-drawing-guide-title">ネオンチューブパスを描画する</h3>
                  <div 
                    className={`neon-drawing-content-container ${getActiveContainer() === 1 ? 'active' : ''}`} 
                    data-time="0-35"
                    onClick={() => handleContainerClick(1)}
                    style={{ cursor: 'pointer' }}
                  >
                    <h4 className="neon-drawing-container-title">背景画像を追加</h4>
                    <ol className="neon-drawing-steps-list">
                      <li className="neon-drawing-step-item">「背景画像」ボタンで背景画像を追加</li>
                      <li className="neon-drawing-step-item">「画像サイズ」スライダーで画像の大きさを最大に</li>
                      <li className="neon-drawing-step-item">「X / Y 位置」スライダーで画像の位置を移動</li>
                      <li className="neon-drawing-step-item">「透明度」スライダーで画像の透明度を変更</li>
                      <li className="neon-drawing-step-item">「適用」ボタンで背景画像設定を完了</li>
                    </ol>
                  </div>
                  <div 
                    className={`neon-drawing-content-container ${getActiveContainer() === 2 ? 'active' : ''}`} 
                    data-time="35-111"
                    onClick={() => handleContainerClick(2)}
                    style={{ cursor: 'pointer' }}
                  >
                    <h4 className="neon-drawing-container-title">ネオンパスを描画</h4>
                    <ol className="neon-drawing-steps-list">
                      <li className="neon-drawing-step-item">ステータスが「チューブパス描画中」であることを確認</li>
                      <li className="neon-drawing-step-item">ネオンチューブパスを描画開始</li>
                    </ol>
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
                  <h3 className="neon-drawing-guide-title">ベースプレートを描画～下絵完成</h3>
                  
                  <div 
                    className={`neon-drawing-content-container ${getActiveContainer() === 1 ? 'active' : ''}`} 
                    data-time="0-26"
                    onClick={() => handleContainerClick(1)}
                    style={{ cursor: 'pointer' }}
                  >
                    <h4 className="neon-drawing-container-title">ベースプレート描画モードに切り替え</h4>
                    <ol className="neon-drawing-steps-list">
                      <li className="neon-drawing-step-item">「背景画像」ボタンで背景画像を追加</li>
                      <li className="neon-drawing-step-item">「適用」ボタンで背景画像設定を完了</li>
                      <li className="neon-drawing-step-item">「ベースプレート」ボタンでベースプレート描画モードに切り替え</li>
                    </ol>
                  </div>
                  <div 
                    className={`neon-drawing-content-container ${getActiveContainer() === 2 ? 'active' : ''}`} 
                    data-time="26-99"
                    onClick={() => handleContainerClick(2)}
                    style={{ cursor: 'pointer' }}
                  >
                    <h4 className="neon-drawing-container-title">ベースプレート描画モードの種類</h4>
                    <p className="neon-drawing-container-description">「ベースプレート」ボタンでベースプレートの描画タイプを選択できます、描画タイプは以下の4通りです。</p>
                    <ol className="neon-drawing-steps-list">
                      <li className="neon-drawing-tips-item">スプライン : 配置した点をを曲線で結ぶ面のベースプレートを作成</li>
                      <li className="neon-drawing-tips-item">直線 : 配置した点をを直線で結ぶ面のベースプレートを作成</li>
                      <li className="neon-drawing-tips-item">自動(長方形) : 全てのネオンパスを囲む長方形のベースプレートを自動で作成</li>
                      <li className="neon-drawing-tips-item">自動(形状) : 全てのネオンパスを囲む形状のベースプレートを自動で作成</li>
                    </ol>
                  </div>
                  <div 
                    className={`neon-drawing-content-container ${getActiveContainer() === 3 ? 'active' : ''}`} 
                    data-time="99-118"
                    onClick={() => handleContainerClick(3)}
                    style={{ cursor: 'pointer' }}
                  >
                    <h4 className="neon-drawing-container-title">「拡大縮小」ボタンでネオンサイン全体のスケールを調整</h4>
                    <p className="neon-drawing-container-description">最大サイズの画像で下絵を描いた後、こちらで最終的な商品寸法を調整します</p>
                    <ol className="neon-drawing-steps-list">
                      <li className="neon-drawing-tips-item">「倍率」スライダーでスケール調整</li>
                      <li className="neon-drawing-tips-item">数値ボックスに直接入力でスケール調整</li>
                    </ol>
                  </div>
                  <div 
                    className={`neon-drawing-content-container ${getActiveContainer() === 4 ? 'active' : ''}`} 
                    data-time="118-133"
                    onClick={() => handleContainerClick(4)}
                    style={{ cursor: 'pointer' }}
                  >
                    <h4 className="neon-drawing-container-title">「太さプレビュー」セレクタで完成品のチューブの太さを確認</h4>
                    <ol className="neon-drawing-steps-list">
                      <li className="neon-drawing-tips-item">下絵で描画したチューブを実際のスケールで確認</li>
                    </ol>
                  </div>
                  <div 
                    className={`neon-drawing-content-container ${getActiveContainer() === 5 ? 'active' : ''}`} 
                    data-time="133-148"
                    onClick={() => handleContainerClick(5)}
                    style={{ cursor: 'pointer' }}
                  >
                    <h4 className="neon-drawing-container-title">下絵を保存</h4>
                    <p className="neon-drawing-container-description">下絵を保存することで、次回の作業で同じ設定を再現できます。</p>
                    <ul className="neon-drawing-steps-list">
                      <li className="neon-drawing-step-item">「保存」ボタンで下絵を保存</li>
                      <li className="neon-drawing-step-item">保存するファイルの名前を入力</li>
                    </ul>
                  </div>
                  <div 
                    className={`neon-drawing-content-container ${getActiveContainer() === 6 ? 'active' : ''}`} 
                    data-time="148-151"
                    onClick={() => handleContainerClick(6)}
                    style={{ cursor: 'pointer' }}
                  >
                    <h4 className="neon-drawing-container-title">色 / 仕様のカスタマイズへ進む</h4>
                    <ul className="neon-drawing-steps-list">
                      <li className="neon-drawing-step-item">「カスタマイズへ進む」ボタンで色 / 仕様のカスタマイズへ進む</li>
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
                  <h3 className="neon-drawing-guide-title">テキストから背景画像を生成した場合</h3>
                  
                  <div 
                    className={`neon-drawing-content-container ${getActiveContainer() === 1 ? 'active' : ''}`} 
                    data-time="0-51"
                    onClick={() => handleContainerClick(1)}
                    style={{ cursor: 'pointer' }}
                  >
                    <h4 className="neon-drawing-container-title">ネオンパスを描画</h4>
                    <p className="neon-drawing-container-description">テキストから背景画像を生成した場合でも、通常の背景と同じようにネオンパスを描画します</p>
                    <ul className="neon-drawing-steps-list">
                      <li className="neon-drawing-step-item">ステータスが「チューブパス描画中」であることを確認</li>
                      <li className="neon-drawing-step-item">チューブパスをテキスト背景画像に沿って描画開始</li>
                    </ul>
                  </div>
                  <div 
                    className={`neon-drawing-content-container ${getActiveContainer() === 2 ? 'active' : ''}`} 
                    data-time="51-70"
                    onClick={() => handleContainerClick(2)}
                    style={{ cursor: 'pointer' }}
                  >
                    <h4 className="neon-drawing-container-title">ベースプレートを描画、スケールを調整</h4>
                    <p className="neon-drawing-container-description">ここでは自動(長方形)で作成していますが、他のお好みのもので構いません。詳しくはPAGE 3をご確認ください。</p>
                    <ul className="neon-drawing-steps-list">
                      <li className="neon-drawing-step-item">ベースプレートを描画</li>
                      <li className="neon-drawing-step-item">スケールを調整</li>
                    </ul>
                  </div>
                  <div 
                    className={`neon-drawing-content-container ${getActiveContainer() === 3 ? 'active' : ''}`} 
                    data-time="70-72"
                    onClick={() => handleContainerClick(3)}
                    style={{ cursor: 'pointer' }}
                  >
                    <h4 className="neon-drawing-container-title">色 / 仕様のカスタマイズへ進む</h4>
                    <ul className="neon-drawing-steps-list">
                      <li className="neon-drawing-step-item">「カスタマイズへ進む」ボタンで色 / 仕様のカスタマイズへ進む</li>
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
          
          <div className="neon-drawing-page-indicator">
            <span className={`neon-drawing-dot ${currentPage === 1 ? 'active' : ''}`}></span>
            <span className={`neon-drawing-dot ${currentPage === 2 ? 'active' : ''}`}></span>
            <span className={`neon-drawing-dot ${currentPage === 3 ? 'active' : ''}`}></span>
            <span className={`neon-drawing-dot ${currentPage === 4 ? 'active' : ''}`}></span>
            <span className="neon-drawing-page-text">{currentPage}/4</span>
          </div>
          
          <button 
            className="neon-drawing-nav-button next" 
            onClick={nextPage}
            disabled={currentPage === 4}
          >
            次のページ →
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default NeonDrawingGuideModal;