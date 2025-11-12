import React, { useState, useEffect } from 'react';

const RealTime3DProgressModal = ({ isVisible, onComplete, preview3DData, isRemounting }) => {
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('3Dモデル生成を開始しています...');
  const [stage, setStage] = useState('初期化開始');

  useEffect(() => {
    if (!isVisible) {
      // モーダルが非表示になった時に状態をリセット
      setProgress(0);
      setMessage('3Dモデル生成を開始しています...');
      setStage('初期化開始');
      return;
    }

    // モーダル表示時に即座に0%にリセット
    setProgress(0);
    setMessage('3Dモデル生成を開始しています...');
    setStage('初期化開始');

    const handleProgressUpdate = (event) => {
      const { stage: newStage, progress: newProgress, message: newMessage } = event.detail;
      if (newStage) setStage(newStage);
      
      // 進捗は絶対に戻らないようにする
      setProgress(prev => Math.max(prev, newProgress));
      setMessage(newMessage);
      
      if (newProgress >= 100) {
        // モバイル版で3Dプレビューデータがある場合、完了後にshow3DPreviewイベントを再発火
        if (preview3DData) {
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('show3DPreview', {
              detail: preview3DData
            }));
            onComplete?.();
          }, 300);
        } else {
          setTimeout(() => onComplete?.(), 300);
        }
      }
    };

    window.addEventListener('3DProgressUpdate', handleProgressUpdate);
    return () => window.removeEventListener('3DProgressUpdate', handleProgressUpdate);
  }, [isVisible, onComplete]);

  if (!isVisible) return null;

  return (
    <div className="processing-overlay">
      <div className="processing-modal">
        <div className="processing-content">
          <div className="processing-spinner"></div>
          
          <h3>{isRemounting ? '3Dモデルを再構築中...' : '3Dモデル生成中...'}</h3>
          
          <div className="progress-bar-container">
            <div className="progress-bar">
              <div className="progress-fill" key={isVisible} style={{ width: `${progress}%` }}></div>
            </div>
            <div className="progress-text">{Math.round(progress)}% 完了</div>
          </div>
          
          <div className="processing-message">{message}</div>
          
          
          <div className="processing-tips">
            <h4>処理段階について</h4>
            <ul className="tips-list">
              <li className="tip-item">より複雑なモデルは、処理時間が長くなります</li>
              <li className="tip-item">3Dモデルは表示用に最適化されております</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RealTime3DProgressModal;