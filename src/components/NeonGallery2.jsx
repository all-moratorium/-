import React, { useState } from 'react';
import { Info } from 'lucide-react';
import Gallery3D, { modelConfigs } from './Gallery3D';
import './neon-gallery2.css';

// サンプルデータ2
const neonModels2 = [
  {
    id: 16,
    title: "Flamingo Neon Sign",
    price: "¥19,500",
    image: "https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?w=800&q=80",
    size: "500mm × 600mm × 50mm",
    tube8mmCount: 2,
    tube6mmCount: 3,
    tube8mmLength: "2,200mm",
    tube6mmLength: "1,700mm",
    tubeColorOff: "ピンククリア",
    basePlateColor: "透明アクリル",
    type: "インテリア"
  },
  {
    id: 17,
    title: "Sushi Restaurant Sign",
    price: "¥26,000",
    image: "https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=800&q=80",
    size: "750mm × 400mm × 60mm",
    tube8mmCount: 4,
    tube6mmCount: 2,
    tube8mmLength: "3,100mm",
    tube6mmLength: "1,600mm",
    tubeColorOff: "レッドクリア",
    basePlateColor: "マットブラック",
    type: "店舗サイン"
  },
  {
    id: 18,
    title: "Palm Tree Sign",
    price: "¥17,800",
    image: "https://images.unsplash.com/photo-1523712999610-f77fbcfc3843?w=800&q=80",
    size: "450mm × 700mm × 55mm",
    tube8mmCount: 2,
    tube6mmCount: 4,
    tube8mmLength: "2,000mm",
    tube6mmLength: "2,200mm",
    tubeColorOff: "グリーンクリア",
    basePlateColor: "透明アクリル",
    type: "インテリア"
  },
  {
    id: 19,
    title: "Ice Cream Cone",
    price: "¥14,200",
    image: "https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=800&q=80",
    size: "400mm × 550mm × 50mm",
    tube8mmCount: 2,
    tube6mmCount: 2,
    tube8mmLength: "1,800mm",
    tube6mmLength: "1,500mm",
    tubeColorOff: "ピンククリア",
    basePlateColor: "マットホワイト",
    type: "店舗サイン"
  },
  {
    id: 20,
    title: "Gym Dumbbell Sign",
    price: "¥20,500",
    image: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=80",
    size: "600mm × 350mm × 55mm",
    tube8mmCount: 3,
    tube6mmCount: 2,
    tube8mmLength: "2,400mm",
    tube6mmLength: "1,400mm",
    tubeColorOff: "ブルークリア",
    basePlateColor: "マットブラック",
    type: "店舗サイン"
  },
  {
    id: 21,
    title: "Rainbow Cloud",
    price: "¥23,000",
    image: "https://images.unsplash.com/photo-1516205651411-aef33a44f7c2?w=800&q=80",
    size: "700mm × 400mm × 50mm",
    tube8mmCount: 5,
    tube6mmCount: 3,
    tube8mmLength: "3,500mm",
    tube6mmLength: "1,800mm",
    tubeColorOff: "マルチカラー",
    basePlateColor: "透明アクリル",
    type: "インテリア"
  },
  {
    id: 22,
    title: "Camera Icon Sign",
    price: "¥16,800",
    image: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&q=80",
    size: "500mm × 400mm × 50mm",
    tube8mmCount: 2,
    tube6mmCount: 3,
    tube8mmLength: "2,000mm",
    tube6mmLength: "1,700mm",
    tubeColorOff: "イエロークリア",
    basePlateColor: "マットブラック",
    type: "インテリア"
  },
  {
    id: 23,
    title: "Ramen Bowl Sign",
    price: "¥21,500",
    image: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800&q=80",
    size: "550mm × 450mm × 60mm",
    tube8mmCount: 3,
    tube6mmCount: 3,
    tube8mmLength: "2,600mm",
    tube6mmLength: "1,900mm",
    tubeColorOff: "オレンジクリア",
    basePlateColor: "ウッド調",
    type: "店舗サイン"
  },
  {
    id: 24,
    title: "Wave Pattern",
    price: "¥18,000",
    image: "https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=800&q=80",
    size: "800mm × 300mm × 50mm",
    tube8mmCount: 4,
    tube6mmCount: 2,
    tube8mmLength: "3,200mm",
    tube6mmLength: "1,200mm",
    tubeColorOff: "ブルークリア",
    basePlateColor: "透明アクリル",
    type: "インテリア"
  },
  {
    id: 25,
    title: "Wine Glass Sign",
    price: "¥17,500",
    image: "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800&q=80",
    size: "400mm × 600mm × 50mm",
    tube8mmCount: 2,
    tube6mmCount: 2,
    tube8mmLength: "1,900mm",
    tube6mmLength: "1,600mm",
    tubeColorOff: "パープルクリア",
    basePlateColor: "マットブラック",
    type: "店舗サイン"
  },
  {
    id: 26,
    title: "Anchor Marine Sign",
    price: "¥19,200",
    image: "https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800&q=80",
    size: "500mm × 550mm × 55mm",
    tube8mmCount: 3,
    tube6mmCount: 2,
    tube8mmLength: "2,300mm",
    tube6mmLength: "1,500mm",
    tubeColorOff: "ブルークリア",
    basePlateColor: "ウッド調",
    type: "インテリア"
  },
  {
    id: 27,
    title: "Bicycle Shop Sign",
    price: "¥22,800",
    image: "https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=800&q=80",
    size: "650mm × 400mm × 55mm",
    tube8mmCount: 3,
    tube6mmCount: 3,
    tube8mmLength: "2,700mm",
    tube6mmLength: "1,800mm",
    tubeColorOff: "グリーンクリア",
    basePlateColor: "マットホワイト",
    type: "店舗サイン"
  },
  {
    id: 28,
    title: "Rocket Ship Sign",
    price: "¥24,000",
    image: "https://images.unsplash.com/photo-1516849841032-87cbac4d88f7?w=800&q=80",
    size: "400mm × 700mm × 60mm",
    tube8mmCount: 3,
    tube6mmCount: 4,
    tube8mmLength: "2,500mm",
    tube6mmLength: "2,000mm",
    tubeColorOff: "ホワイトクリア",
    basePlateColor: "マットブラック",
    type: "インテリア"
  },
  {
    id: 29,
    title: "Donut Shop Sign",
    price: "¥16,500",
    image: "https://images.unsplash.com/photo-1551024601-bec78aea704b?w=800&q=80",
    size: "500mm × 500mm × 50mm",
    tube8mmCount: 2,
    tube6mmCount: 3,
    tube8mmLength: "2,000mm",
    tube6mmLength: "1,800mm",
    tubeColorOff: "ピンククリア",
    basePlateColor: "透明アクリル",
    type: "店舗サイン"
  },
  {
    id: 30,
    title: "Mountain Peak Sign",
    price: "¥20,000",
    image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80",
    size: "700mm × 350mm × 50mm",
    tube8mmCount: 3,
    tube6mmCount: 2,
    tube8mmLength: "2,800mm",
    tube6mmLength: "1,400mm",
    tubeColorOff: "ブルークリア",
    basePlateColor: "ウッド調",
    type: "インテリア"
  }
];

export default function NeonGallery2({ onPreloadingChange }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const [currentGalleryModel, setCurrentGalleryModel] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const currentModel = neonModels2[currentIndex];

  // Gallery3Dからモデル情報を受け取る
  const handleModelChange = (modelInfo) => {
    setCurrentGalleryModel(modelInfo);
  };

  const nextModel = () => {
    setCurrentIndex((prev) => (prev + 1) % modelConfigs.length);
    setShowDetails(false);
  };

  const prevModel = () => {
    setCurrentIndex((prev) => (prev - 1 + modelConfigs.length) % modelConfigs.length);
    setShowDetails(false);
  };

  // プロジェクトファイルダウンロード機能
  const downloadProjectFile = (modelName) => {
    if (isDownloading) return;

    setIsDownloading(true);

    const fileName = `${modelName}　プロジェクトファイル.json`;
    const filePath = `/neon sample json/${fileName}`;

    fetch(filePath)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.blob();
      })
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      })
      .catch(error => {
        console.error('プロジェクトファイルのダウンロードエラー:', error);
        alert('プロジェクトファイルのダウンロードに失敗しました。');
      })
      .finally(() => {
        setIsDownloading(false);
      });
  };

  const handleDownload = () => {
    if (currentGalleryModel && currentGalleryModel.name) {
      downloadProjectFile(currentGalleryModel.name);
    } else {
      alert(`${currentModel.title}のダウンロードを開始します`);
    }
  };

  return (
    <div className="neon-gallery2">
      {/* メインコンテンツ */}
      <main className="main-content2">
        {/* モデルカウンター */}
        <div className="model-counter2">
          <span className="counter-text2">
            {currentIndex + 1} / {modelConfigs.length}
          </span>
          <span className="model-type2">{currentGalleryModel?.theme || currentModel.type}</span>
        </div>

        {/* 3Dモデル表示エリア */}
        <div className="model-display2">
          {/* モデル画像 */}
          <div className="model-image-container2">
            <div className="image-overlay2">
              <Gallery3D
                hideUI={true}
                currentModelIndex={currentIndex}
                onModelChange={handleModelChange}
                onPreloadingChange={onPreloadingChange}
              />
            </div>
          </div>
        </div>

        {/* タイトルとアクションボタン */}
        <div className="title-actions2">
          <h2 className="model-title2">
            {currentGalleryModel?.name || currentModel.title}
          </h2>

          <div className="action-buttons2">
            <button onClick={handleDownload} className="download-button2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 15.577L8.462 12.038L9.877 10.623L11 11.746V5h2v6.746l1.123-1.123l1.415 1.415L12 15.577zM2 17h20v2H2v-2z"/>
              </svg>
              プロジェクトファイルをダウンロード(無料)
            </button>

            <button onClick={() => setShowDetails(!showDetails)} className="info-button2">
              <Info size={20} />
            </button>
          </div>
        </div>

        {/* 詳細情報 */}
        <div className={`details-container2 ${showDetails ? 'details-visible2' : ''}`}>
          <div className="details-content2">
            {/* 画像セクション */}
            <div className="details-image-section2">
              <img
                src={currentGalleryModel?.imagePath || currentModel.image}
                alt={currentGalleryModel?.name || currentModel.title}
                className="details-image2"
              />
              <div className="details-image-overlay2"></div>

              {/* 価格とタイプオーバーレイ */}
              <div className="price-overlay2">
                <div className="price-content2">
                  <div>
                    <p className="price-label2">価格</p>
                    <p className="price-value2">{currentModel.price}</p>
                  </div>
                  <div className="type-badge2">
                    <span className="type-text2">{currentModel.type}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* パラメーター情報 */}
            <div className="parameters-section2">
              {/* サイズ情報 */}
              <div className="parameter-group2">
                <div className="parameter-header2">
                  <div className="parameter-line2"></div>
                  <h3 className="parameter-title2">サイズ</h3>
                </div>
                <div className="parameter-content2">
                  <p className="parameter-value2">{currentModel.size}</p>
                </div>
              </div>

              <div className="parameter-divider2"></div>

              {/* チューブ情報 */}
              <div className="parameter-group2">
                <div className="parameter-header2">
                  <div className="parameter-line2"></div>
                  <h3 className="parameter-title2">チューブ仕様</h3>
                </div>
                <div className="parameter-content2">
                  <div className="tube-item2">
                    <div className="tube-label2">
                      <div className="tube-dot2"></div>
                      <span className="tube-name2">8mmチューブ</span>
                    </div>
                    <div className="tube-values2">
                      <div className="tube-length2">{currentModel.tube8mmLength}</div>
                      <div className="tube-count2">× {currentModel.tube8mmCount}本</div>
                    </div>
                  </div>
                  <div className="tube-item2">
                    <div className="tube-label2">
                      <div className="tube-dot2"></div>
                      <span className="tube-name2">6mmチューブ</span>
                    </div>
                    <div className="tube-values2">
                      <div className="tube-length2">{currentModel.tube6mmLength}</div>
                      <div className="tube-count2">× {currentModel.tube6mmCount}本</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="parameter-divider2"></div>

              {/* カラー情報 */}
              <div className="parameter-group2">
                <div className="parameter-header2">
                  <div className="parameter-line2"></div>
                  <h3 className="parameter-title2">カラー</h3>
                </div>
                <div className="parameter-content2">
                  <div className="color-item2">
                    <div className="color-label2">
                      <div className="tube-dot2"></div>
                      <span className="color-name2">OFF時チューブ</span>
                    </div>
                    <span className="color-value2">{currentModel.tubeColorOff}</span>
                  </div>
                  <div className="color-item2">
                    <div className="color-label2">
                      <div className="tube-dot2"></div>
                      <span className="color-name2">ベースプレート</span>
                    </div>
                    <span className="color-value2">{currentModel.basePlateColor}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* サムネイルナビゲーション */}
        <div className="thumbnail-container2">
          {modelConfigs.map((model, index) => (
            <button
              key={model.id}
              onClick={() => {
                setCurrentIndex(index);
                setShowDetails(false);
              }}
              className={`thumbnail2 ${index === currentIndex ? 'thumbnail-active2' : ''}`}
            >
              <img
                src={model.imagePath}
                alt={model.name}
                className="thumbnail-image2"
              />
            </button>
          ))}
        </div>

        {/* 将来の機能プレースホルダー */}
        <div className="coming-soon2">
          <h3 className="coming-soon-title2">
            <span className="coming-soon-badge2">Coming Soon</span>
            クリエイター機能
          </h3>
          <p className="coming-soon-text2">
            あなたのオリジナルネオンサインを公開して、他のユーザーと共有できるようになります。
          </p>
        </div>
      </main>
    </div>
  );
}
