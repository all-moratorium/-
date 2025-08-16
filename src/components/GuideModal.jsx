import React, { useState, useEffect } from 'react';
import './GuideModal.css';

const GuideModal = ({ isOpen, onClose }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [animatedPages, setAnimatedPages] = useState(new Set());

  useEffect(() => {
    if (isOpen) {
      // そのページが既にアニメーション済みの場合はスキップ
      if (animatedPages.has(currentPage)) {
        return;
      }

      // ページごとに個別にアニメーションをリセット
      if (currentPage === 1) {
        // 1ページ目のアニメーションをリセット
        const featureCards = document.querySelectorAll('.feature-card.fade-in');
        featureCards.forEach(card => {
          card.classList.remove('animate');
        });
        
        // 少し待ってから1ページ目のアニメーション開始
        const timer = setTimeout(() => {
          featureCards.forEach(card => {
            card.classList.add('animate');
          });
          // アニメーション完了をマーク
          setAnimatedPages(prev => new Set(prev).add(1));
        }, 150);
        return () => clearTimeout(timer);
        
      } else if (currentPage === 2) {
        // 2ページ目のアニメーションをリセット
        const useCaseCards = document.querySelectorAll('.use-case-card.fade-in');
        useCaseCards.forEach(card => {
          card.classList.remove('animate');
        });
        
        // 少し待ってから2ページ目のアニメーション開始
        const timer = setTimeout(() => {
          useCaseCards.forEach(card => {
            card.classList.add('animate');
          });
          // アニメーション完了をマーク
          setAnimatedPages(prev => new Set(prev).add(2));
        }, 150);
        return () => clearTimeout(timer);
        
      } else if (currentPage === 3) {
        // 3ページ目のアニメーションをリセット
        const page3Cards = document.querySelectorAll('.page3-fade-in');
        page3Cards.forEach(card => {
          card.classList.remove('animate');
        });
        
        // 少し待ってから3ページ目のアニメーション開始
        const timer = setTimeout(() => {
          page3Cards.forEach(card => {
            card.classList.add('animate');
          });
          // アニメーション完了をマーク
          setAnimatedPages(prev => new Set(prev).add(3));
        }, 150);
        return () => clearTimeout(timer);
      }
    }
  }, [isOpen, currentPage, animatedPages]);

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
    setAnimatedPages(new Set()); // アニメーション履歴をリセット
    onClose();
  };

  return (
    <div className="guide-modal-overlay">
      <div className="guide-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* ヘッダー */}
        <div className="guide-modal-header">
          <div className="guide-header">
            <h2 className="guide-title">はじめに</h2>
          </div>
          <button className="guide-modal-close" onClick={resetAndClose}>
            ×
          </button>
        </div>

        {/* ページコンテンツエリア */}
        <div className="guide-modal-body">
          {/* ページ1 */}
          <div className={`guide-page ${currentPage === 1 ? 'active' : ''}`}>
          <div className="guide-header">
            <h3 className="guide-subtitle">Image To LED Neon Signへようこそ</h3>
          </div>
            
            {/* 横長画像枠 */}
            <div className="guide-hero-image">
              <div className="image-placeholder">画像準備中</div>
            </div>

            <h4 className="guide-section-title">このサイトでできること</h4>
            
            <div className="guide-features">
              <div className="feature-card fade-in">
                <div className="feature-icon">
                  <div className="icon-placeholder"></div>
                </div>
                <div className="feature-text">
                  完全オリジナルの<br />
                  あなただけの<br />
                  ネオンサインを作成
                </div>
              </div>
              
              <div className="feature-card fade-in">
                <div className="feature-icon">
                  <div className="icon-placeholder"></div>
                </div>
                <div className="feature-text">
                  作成したネオンサインの<br />
                  データは<br />
                  保存・読み込み可能
                </div>
              </div>
              
              <div className="feature-card fade-in">
                <div className="feature-icon">
                  <div className="icon-placeholder"></div>
                </div>
                <div className="feature-text">
                  高精細な3Dプレビュー<br />
                  で完成形を事前確認
                </div>
              </div>
              
              <div className="feature-card fade-in">
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

        {/* ページ2 */}
        <div className={`guide-page ${currentPage === 2 ? 'active' : ''}`}>
          <div className="guide-header">
            <h3 className="guide-subtitle">推奨される使用例</h3>
          </div>
            
            <div className="guide-use-cases">
              <div className="use-case-card fade-in">
                <div className="use-case-title">店舗のサインボード・看板</div>
                <div className="use-case-image">
                  <div className="image-placeholder">画像準備中</div>
                </div>
              </div>
              
              <div className="use-case-card fade-in">
                <div className="use-case-title">イベントの装飾・演出</div>
                <div className="use-case-image">
                  <div className="image-placeholder">画像準備中</div>
                </div>
              </div>
              
              <div className="use-case-card fade-in">
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

        {/* ページ3 */}
        <div className={`guide-page guide-page-3 ${currentPage === 3 ? 'active' : ''}`}>
            
            <div className="guide-getting-started">
              <h3 className="guide-subtitle">その他事項</h3>
              
              <div className="guide-info-section page3-fade-in">
                <h3 className="guide-info-title">ガイドを開く</h3>
                <div className="info-icon">
                  <div className="guide-info-button"></div>
                </div>
                <div className="guide-info-text">
                  それぞれのページには「i」マークの<br />
                  ガイドボタンが配置されています。<br />
                  <br />
                  こちらをクリックすることでいつでも<br />ガイドを
                  開くことができます。
                </div>
              </div>

              <div className="guide-info-section page3-fade-in">
                <h3 className="guide-info-title">全画面表示について</h3>
                <div className="mobile-only-text">※モバイル版のみ</div>
                <div className="mobile-screenshot">
                  <div className="image-placeholder">スマホスクリーンショット</div>
                </div>
                <div className="guide-info-text">
                検索バーを非表示にして全画面表示したい<br />場合は、ブラウザの「ホーム画面に追加」<br />機能をご利用ください。
                </div>
              </div>

              <div className="creation-section sample-data-main-section page3-fade-in">
                <h3 className="sample-data-title">サンプルデータの読み込み方法</h3>
                <div className="sample-data-images-top">
                  <div className="sample-data-image-group">
                    <div className="sample-category-label">ネオン下絵</div>
                    <div className="sample-data-image-small">
                      <div className="image-placeholder">サンプル画像1</div>
                    </div>
                    <div className="sample-instruction-item">
                 下絵のみのデータが読み込まれます。
                    </div>
                  </div>
                  <div className="sample-data-image-group">
                    <div className="sample-category-label">色 / 仕様のカスタマイズ</div>
                    <div className="sample-data-image-small">
                      <div className="image-placeholder">サンプル画像2</div>
                    </div>
                    <div className="sample-instruction-item">
                     色 / 仕様のデータ、加えてネオン下絵に<br />下絵のデータが読み込まれます。
                    </div>
                  </div>
                </div>
                <div className="sample-data-image-bottom">
                  <div className="image-placeholder">サンプル画像3</div>
                </div>
                <div className="sample-instruction-item">
                 サンプルデータは色仕様のカスタマイズデータ<br />ですので、どちらでも読み込み可能です。
                </div>
              </div>

              <div className="guide-info-section data-storage-section page3-fade-in">
                <h3 className="guide-info-title">データの保存について</h3>
                <div className="guide-info-text">
                  <div className="list-item">
                    <span className="triangle-icon">▶</span> 一時データはお使いのデバイスの<br />セッションストレージに保存されます。<br /><br />
                  </div>
                  <div className="list-item">
                    <span className="triangle-icon">▶</span> ブラウザのタブを閉じると全てのデータ<br />が消失します。<br /><br />
                  </div>
                  <div className="list-item">
                    <span className="triangle-icon">▶</span> そのため作業中は定期的にプロジェクト<br />ファイルをダウンロードしてデバイスに<br />保存することを推奨します。<br /><br />
                  </div>
                </div>
              </div>

              <div className="guide-info-section creation-start-section page3-fade-in">
                <h3 className="guide-info-title">作成開始</h3>
                <div className="creation-start-image">
                  <div className="image-placeholder">アプリスクリーンショット</div>
                </div>
                <div className="creation-start-text">
                  画面真ん中下の「早速作成する」<br />
                  ボタンを押して作成開始
                </div>
              </div>
            </div>
          </div>
        </div>

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