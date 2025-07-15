import React, { useState } from 'react';
import './NeonDrawingGuideModal.css';

const NeonDrawingGuideModal = ({ isOpen, onClose }) => {
  const [currentPage, setCurrentPage] = useState(1);

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
              {/* コンテンツは空白 */}
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