import React, { useState, useRef, useEffect } from 'react';
import './NeonDrawingGuideModal.css';

const NeonDrawingGuideModal = ({ isOpen, onClose }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const videoRef = useRef(null);

  useEffect(() => {
    if (currentPage === 1 && videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play();
    }
  }, [currentPage]);

  const handleFullscreen = () => {
    if (videoRef.current) {
      videoRef.current.style.position = 'fixed';
      videoRef.current.style.top = '20px';
      videoRef.current.style.left = '20px';
      videoRef.current.style.width = 'calc(100vw - 40px)';
      videoRef.current.style.height = 'calc(100vh - 40px)';
      videoRef.current.style.zIndex = '9999';
      videoRef.current.style.objectFit = 'contain';
      videoRef.current.style.backgroundColor = 'black';
      videoRef.current.style.borderRadius = '8px';
      
      const exitFullscreen = (e) => {
        if (e.key === 'Escape' || e.type === 'click') {
          videoRef.current.style.position = '';
          videoRef.current.style.top = '';
          videoRef.current.style.left = '';
          videoRef.current.style.width = '100%';
          videoRef.current.style.height = 'auto';
          videoRef.current.style.zIndex = '';
          videoRef.current.style.objectFit = '';
          videoRef.current.style.backgroundColor = '';
          videoRef.current.style.borderRadius = '8px';
          
          document.removeEventListener('keydown', exitFullscreen);
          videoRef.current.removeEventListener('click', exitFullscreen);
        }
      };
      
      document.addEventListener('keydown', exitFullscreen);
      videoRef.current.addEventListener('click', exitFullscreen);
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
              <div className="neon-drawing-video-section">
                <video 
                  ref={videoRef}
                  autoPlay
                  loop
                  muted
                  className="neon-drawing-video"
                >
                  <source src="/ネオン下絵　ガイドモーダル/サンプル動画1.mp4" type="video/mp4" />
                  お使いのブラウザは動画をサポートしていません。
                </video>
                <button 
                  onClick={handleFullscreen}
                  className="neon-drawing-fullscreen-btn"
                >
                  ⛶ 全画面表示
                </button>
              </div>
              <div className="neon-drawing-text-section">
                <h3>ネオン下絵の描き方</h3>
                <p>
                  この動画では、ネオン下絵の基本的な描き方を説明しています。
                </p>
                <ul>
                  <li>ペンツールを使って線を描く</li>
                  <li>色を選択して塗りつぶす</li>
                  <li>ネオン効果を適用する</li>
                </ul>
              </div>
            </div>
          </div>

          {/* ページ2 */}
          <div className={`neon-drawing-guide-page ${currentPage === 2 ? 'active' : ''}`}>
            <div className="neon-drawing-guide-content">
              {/* コンテンツは空白 */}
            </div>
          </div>

          {/* ページ3 */}
          <div className={`neon-drawing-guide-page ${currentPage === 3 ? 'active' : ''}`}>
            <div className="neon-drawing-guide-content">
              {/* コンテンツは空白 */}
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
            <span className="neon-drawing-page-text">{currentPage}/3</span>
          </div>
          
          <button 
            className="neon-drawing-nav-button next" 
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

export default NeonDrawingGuideModal;