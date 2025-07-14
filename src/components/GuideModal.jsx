import React, { useState } from 'react';
import './GuideModal.css';

const GuideModal = ({ isOpen, onClose }) => {
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
    <div className="guide-modal-overlay" onClick={resetAndClose}>
      <div className="guide-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* 閉じるボタン */}
        <button className="guide-modal-close" onClick={resetAndClose}>
          ×
        </button>

        {/* ページ1 */}
        {currentPage === 1 && (
          <div className="guide-page">
            <div className="guide-header">
              <h2 className="guide-title">はじめに</h2>
              <h3 className="guide-subtitle">Image To LED Neon Signへようこそ</h3>
            </div>
            
            {/* 横長画像枠 */}
            <div className="guide-hero-image">
              <div className="image-placeholder">画像準備中</div>
            </div>

            <h4 className="guide-section-title">このサイトでできること</h4>
            
            <div className="guide-features">
              <div className="feature-card">
                <div className="feature-icon">
                  <div className="icon-placeholder"></div>
                </div>
                <div className="feature-text">
                  完全オリジナルの<br />
                  あなただけの<br />
                  ネオンサインを作成
                </div>
              </div>
              
              <div className="feature-card">
                <div className="feature-icon">
                  <div className="icon-placeholder"></div>
                </div>
                <div className="feature-text">
                  作成したネオンサインの<br />
                  データは<br />
                  保存・読み込み可能
                </div>
              </div>
              
              <div className="feature-card">
                <div className="feature-icon">
                  <div className="icon-placeholder"></div>
                </div>
                <div className="feature-text">
                  高精細な3Dプレビュー<br />
                  で完成形を事前確認
                </div>
              </div>
              
              <div className="feature-card">
                <div className="feature-icon">
                  <div className="icon-placeholder"></div>
                </div>
                <div className="feature-text">
                  完成したネオンサイン<br />
                  はそのまま注文可能！
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ページ2 */}
        {currentPage === 2 && (
          <div className="guide-page">
            <div className="guide-header">
              <h2 className="guide-title">はじめに</h2>
              <h3 className="guide-subtitle">推奨される使用例</h3>
            </div>
            
            <div className="guide-use-cases">
              <div className="use-case-card">
                <div className="use-case-title">店舗のサインボード・看板</div>
                <div className="use-case-image">
                  <div className="image-placeholder">画像準備中</div>
                </div>
              </div>
              
              <div className="use-case-card">
                <div className="use-case-title">イベントの装飾・演出</div>
                <div className="use-case-image">
                  <div className="image-placeholder">画像準備中</div>
                </div>
              </div>
              
              <div className="use-case-card">
                <div className="use-case-title">オフィス・お部屋のインテリア</div>
                <div className="use-case-image">
                  <div className="image-placeholder">画像準備中</div>
                </div>
              </div>
            </div>

            <div className="guide-warning">
              <h4>著作権・商標に関する注意事項</h4>
              <p>
                ご注文いただくデザインに、第三者が著作権・商標権などの権利を有する画像・ロゴ・キャラクター等を含む場合は、必ず権利者の許諾を得た上でご利用ください。<br />
                権利侵害に関するトラブルについて、当サイトは一切の責任を負いかねます。
              </p>
            </div>
          </div>
        )}

        {/* ページ3 */}
        {currentPage === 3 && (
          <div className="guide-page">
            <div className="guide-header">
              <h2 className="guide-title">はじめに</h2>
            </div>
            
            <div className="guide-getting-started">
              <div className="guide-section">
                <h3>ガイドを開く</h3>
                <div className="guide-info-section">
                  <div className="info-icon">
                    <div className="icon-placeholder">i</div>
                  </div>
                  <div className="info-text">
                    それぞれのページには「i」マークの<br />
                    ガイドボタンが配置されています。<br />
                    <br />
                    こちらをクリックすることでガイドを<br />
                    開くことができます。
                  </div>
                </div>
              </div>

              <div className="guide-section">
                <h3>作成開始</h3>
                <div className="creation-section">
                  <div className="creation-image">
                    <div className="image-placeholder">アプリスクリーンショット</div>
                  </div>
                  <div className="creation-text">
                    画面真ん中下の「早速作成する」<br />
                    ボタンを押して作成開始
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ナビゲーション */}
        <div className="guide-navigation">
          <button 
            className="nav-button prev" 
            onClick={prevPage}
            disabled={currentPage === 1}
          >
            ← 前のページ
          </button>
          
          <div className="page-indicator">
            <span className={`dot ${currentPage === 1 ? 'active' : ''}`}></span>
            <span className={`dot ${currentPage === 2 ? 'active' : ''}`}></span>
            <span className={`dot ${currentPage === 3 ? 'active' : ''}`}></span>
            <span className="page-text">{currentPage}/3</span>
          </div>
          
          <button 
            className="nav-button next" 
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

export default GuideModal;