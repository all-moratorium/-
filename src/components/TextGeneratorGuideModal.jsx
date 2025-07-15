import React, { useState } from 'react';
import './TextGeneratorGuideModal.css';

const TextGeneratorGuideModal = ({ isOpen, onClose }) => {
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
              {/* コンテンツは空白 */}
            </div>
          </div>

          {/* ページ2 */}
          <div className={`text-generator-guide-page ${currentPage === 2 ? 'active' : ''}`}>
            <div className="text-generator-guide-content">
              {/* コンテンツは空白 */}
            </div>
          </div>

          {/* ページ3 */}
          <div className={`text-generator-guide-page ${currentPage === 3 ? 'active' : ''}`}>
            <div className="text-generator-guide-content">
              {/* コンテンツは空白 */}
            </div>
          </div>
        </div>

        {/* ナビゲーション */}
        <div className="text-generator-guide-navigation">
          <button 
            className="text-generator-nav-button prev" 
            onClick={prevPage}
            disabled={currentPage === 1}
          >
            ← 前のページ
          </button>
          
          <div className="text-generator-page-indicator">
            <span className={`text-generator-dot ${currentPage === 1 ? 'active' : ''}`}></span>
            <span className={`text-generator-dot ${currentPage === 2 ? 'active' : ''}`}></span>
            <span className={`text-generator-dot ${currentPage === 3 ? 'active' : ''}`}></span>
            <span className="text-generator-page-text">{currentPage}/3</span>
          </div>
          
          <button 
            className="text-generator-nav-button next" 
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

export default TextGeneratorGuideModal;