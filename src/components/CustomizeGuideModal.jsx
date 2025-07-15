import React, { useState } from 'react';
import './CustomizeGuideModal.css';

const CustomizeGuideModal = ({ isOpen, onClose }) => {
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
              {/* コンテンツは空白 */}
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