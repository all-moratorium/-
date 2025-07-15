import React, { useState } from 'react';
import './Preview3DGuideModal.css';

const Preview3DGuideModal = ({ isOpen, onClose }) => {
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
          <div className={`preview3d-guide-page ${currentPage === 1 ? 'active' : ''}`}>
            <div className="preview3d-guide-content">
              {/* コンテンツは空白 */}
            </div>
          </div>

          {/* ページ2 */}
          <div className={`preview3d-guide-page ${currentPage === 2 ? 'active' : ''}`}>
            <div className="preview3d-guide-content">
              {/* コンテンツは空白 */}
            </div>
          </div>

          {/* ページ3 */}
          <div className={`preview3d-guide-page ${currentPage === 3 ? 'active' : ''}`}>
            <div className="preview3d-guide-content">
              {/* コンテンツは空白 */}
            </div>
          </div>
        </div>

        {/* ナビゲーション */}
        <div className="preview3d-guide-navigation">
          <button 
            className="preview3d-nav-button prev" 
            onClick={prevPage}
            disabled={currentPage === 1}
          >
            ← 前のページ
          </button>
          
          <div className="preview3d-page-indicator">
            <span className={`preview3d-dot ${currentPage === 1 ? 'active' : ''}`}></span>
            <span className={`preview3d-dot ${currentPage === 2 ? 'active' : ''}`}></span>
            <span className={`preview3d-dot ${currentPage === 3 ? 'active' : ''}`}></span>
            <span className="preview3d-page-text">{currentPage}/3</span>
          </div>
          
          <button 
            className="preview3d-nav-button next" 
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

export default Preview3DGuideModal;