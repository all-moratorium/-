import React, { useState, useEffect, useRef } from 'react';
import './HomeLeftBottom.css';

const HomeLeftBottom = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoScrolling, setIsAutoScrolling] = useState(true);
  const trackRef = useRef(null);
  const totalReviews = 5;

  const reviews = [
    {
      rating: 5,
      date: "2024.12.15",
      image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100&h=75&fit=crop",
      text: "とても使いやすいサービスでした。スタッフの対応も丁寧で、また利用したいと思います。"
    },
    {
      rating: 5,
      date: "2024.12.10",
      image: "https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=100&h=75&fit=crop",
      text: "迅速な対応と高品質なサービスに感動しました。価格も手頃で、コストパフォーマンスが抜群です。"
    },
    {
      rating: 4,
      date: "2024.12.8",
      image: "https://images.unsplash.com/photo-1567306301408-9b74779a11af?w=100&h=75&fit=crop",
      text: "全体的に満足していますが、もう少し選択肢があるとより良いと思います。"
    },
    {
      rating: 5,
      date: "2024.12.5",
      image: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=100&h=75&fit=crop",
      text: "初めて利用しましたが、想像以上の仕上がりでした。細部まで気を配られていて、プロの仕事だと感じました。"
    },
    {
      rating: 5,
      date: "2024.12.3",
      image: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=100&h=75&fit=crop",
      text: "長年お世話になっています。安定した品質とサービスで、いつも安心して任せられます。"
    }
  ];



  const renderStars = (rating) => {
    const stars = [];
    for (let i = 0; i < 5; i++) {
      stars.push(
        <span key={i} className="hlb-star">
          {i < rating ? '★' : '☆'}
        </span>
      );
    }
    return stars;
  };

  const renderReviewItem = (review, key) => (
    <div key={key} className="hlb-review-item">
      <div className="hlb-review-top">
        <div className="hlb-review-rating">
          {renderStars(review.rating)}
        </div>
        <div className="hlb-review-date">{review.date}</div>
      </div>
      <img src={review.image} alt="レビュー画像" className="hlb-review-image" />
      <div className="hlb-review-text">
        {review.text}
      </div>
    </div>
  );

  useEffect(() => {
    const track = trackRef.current;
    if (track) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const index = parseInt(entry.target.dataset.index);
              if (!isNaN(index)) {
                setCurrentIndex(index % totalReviews);
              }
            }
          });
        },
        {
          root: track.parentElement,
          threshold: 0.5,
        }
      );

      const items = track.querySelectorAll('.hlb-review-item');
      items.forEach((item, index) => {
        item.setAttribute('data-index', index.toString());
        observer.observe(item);
      });

      return () => {
        observer.disconnect();
      };
    }
  }, [totalReviews]);

  return (
    <div className="hlb-wrapper">
      <div className="hlb-review-container">
        <div className="hlb-header">
          <div className="hlb-header-title">お客様のレビューを抜粋</div>
          <div className="hlb-controls">
            <div className="hlb-indicator">
              {[...Array(totalReviews)].map((_, index) => (
                <div
                  key={index}
                  className={`hlb-dot ${index === currentIndex ? 'hlb-active' : ''}`}
                />
              ))}
            </div>
          </div>
        </div>
        
        <div className="hlb-reviews-wrapper">
          <div 
            className={`hlb-reviews-track ${isAutoScrolling ? 'hlb-auto-scroll' : ''}`} 
            ref={trackRef}
          >
            {reviews.map((review, index) => renderReviewItem(review, index))}
            {/* 無限スクロール用複製 */}
            {reviews.map((review, index) => renderReviewItem(review, `duplicate-${index}`))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomeLeftBottom;