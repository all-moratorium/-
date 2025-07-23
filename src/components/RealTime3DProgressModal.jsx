import React, { useState, useEffect } from 'react';

const RealTime3DProgressModal = ({ isVisible, onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('3Dモデル生成を開始しています...');
  const [stage, setStage] = useState('初期化開始');

  useEffect(() => {
    if (!isVisible) return;

    // モーダル表示時に強制的に0%にリセット
    setProgress(0);
    setMessage('3Dモデル生成を開始しています...');
    setStage('初期化開始');

    const handleProgressUpdate = (event) => {
      const { stage: newStage, progress: newProgress, message: newMessage } = event.detail;
      if (newStage) setStage(newStage);
      setProgress(newProgress);
      setMessage(newMessage);
      
      if (newProgress >= 100) {
        setTimeout(() => onComplete?.(), 500);
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
          
          <h3>3Dモデル生成中...</h3>
          
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
              <li className="tip-item">ご不明な点があれば、お気軽にお問い合わせください</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RealTime3DProgressModal;