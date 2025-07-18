<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>レビューコンテナ</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #242424;
            padding: 20px;
        }

        .review-container {
            width: 465px;
            height: 321px;
            background: #111111;
            border-radius: 12px;
            overflow: hidden;
            position: relative;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            transition: width 0.3s ease;
            border: 2px solid rgba(255, 255, 255, 0.2);
        }

        .review-container.sidebar-open {
            width: 392px;
        }

        .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 20px;
            background: #1a1a1a;
            border-bottom: 1px solid #333;
        }

        .header-title {
            color: #fff;
            font-size: 14px;
            font-weight: 600;
            letter-spacing: 0.5px;
        }

        .controls {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .nav-button {
            width: 28px;
            height: 28px;
            background: #333;
            border: none;
            border-radius: 6px;
            color: #fff;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
            font-size: 16px;
        }

        .nav-button:hover {
            background: #ffff00;
            color: #000;
        }

        .indicator {
            display: flex;
            gap: 4px;
        }

        .dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: #555;
            transition: all 0.3s ease;
            cursor: pointer;
        }

        .dot.active {
            background: #ffff00;
            transform: scale(1.2);
        }

        .dot:hover {
            background: #ffff00;
            opacity: 0.7;
        }

        .reviews-wrapper {
            height: calc(100% - 57px);
            overflow: hidden;
            position: relative;
        }

        .reviews-track {
            display: flex;
            height: 100%;
            transition: transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
            will-change: transform;
        }

        .review-item {
            flex: 0 0 200px;
            padding: 12px;
            display: flex;
            flex-direction: column;
            gap: 10px;
            background: linear-gradient(135deg, #2a2a2a, #1a1a1a);
            border: 1px solid #333;
            border-radius: 8px;
            margin: 12px 6px 6px 6px;
        }

        .review-top {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .review-rating {
            display: flex;
            gap: 2px;
        }

        .star {
            color: #ffcc00;
            font-size: 12px;
        }

        .review-date {
            color: #888;
            font-size: 11px;
        }

        .review-image {
            width: 100%;
            height: 120px;
            border-radius: 6px;
            object-fit: cover;
            border: 2px solid #333;
        }

        .review-text {
            color: #ccc;
            font-size: 13px;
            line-height: 1.5;
            overflow: hidden;
            display: -webkit-box;
            -webkit-line-clamp: 3;
            -webkit-box-orient: vertical;
        }

        .toggle-button {
            position: absolute;
            top: -50px;
            left: 0;
            background: #ffcc00;
            color: #000;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 600;
            font-size: 12px;
        }

        .toggle-button:hover {
            background: #ffd700;
        }

        .auto-scroll {
            animation: auto-scroll 40s linear infinite;
        }

        @keyframes auto-scroll {
            0% { transform: translateX(0); }
            100% { transform: translateX(-1250px); }
        }
    </style>
</head>
<body>
    <button class="toggle-button" onclick="toggleSidebar()">サイドバー切替</button>
    
    <div class="review-container" id="reviewContainer">
        <div class="header">
            <div class="header-title">お客様のレビューを抜粋</div>
            <div class="controls">
                <button class="nav-button" onclick="prevReview()">‹</button>
                <div class="indicator">
                    <div class="dot active" onclick="goToSlide(0)"></div>
                    <div class="dot" onclick="goToSlide(1)"></div>
                    <div class="dot" onclick="goToSlide(2)"></div>
                    <div class="dot" onclick="goToSlide(3)"></div>
                    <div class="dot" onclick="goToSlide(4)"></div>
                </div>
                <button class="nav-button" onclick="nextReview()">›</button>
            </div>
        </div>
        
        <div class="reviews-wrapper">
            <div class="reviews-track auto-scroll" id="reviewsTrack">
                <div class="review-item">
                    <div class="review-top">
                        <div class="review-rating">
                            <span class="star">★</span>
                            <span class="star">★</span>
                            <span class="star">★</span>
                            <span class="star">★</span>
                            <span class="star">★</span>
                        </div>
                        <div class="review-date">2024.12.15</div>
                    </div>
                    <img src="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100&h=75&fit=crop" alt="レビュー画像" class="review-image">
                    <div class="review-text">
                        とても使いやすいサービスでした。スタッフの対応も丁寧で、また利用したいと思います。
                    </div>
                </div>

                <div class="review-item">
                    <div class="review-top">
                        <div class="review-rating">
                            <span class="star">★</span>
                            <span class="star">★</span>
                            <span class="star">★</span>
                            <span class="star">★</span>
                            <span class="star">★</span>
                        </div>
                        <div class="review-date">2024.12.10</div>
                    </div>
                    <img src="https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=100&h=75&fit=crop" alt="レビュー画像" class="review-image">
                    <div class="review-text">
                        迅速な対応と高品質なサービスに感動しました。価格も手頃で、コストパフォーマンスが抜群です。
                    </div>
                </div>

                <div class="review-item">
                    <div class="review-top">
                        <div class="review-rating">
                            <span class="star">★</span>
                            <span class="star">★</span>
                            <span class="star">★</span>
                            <span class="star">★</span>
                            <span class="star">☆</span>
                        </div>
                        <div class="review-date">2024.12.8</div>
                    </div>
                    <img src="https://images.unsplash.com/photo-1567306301408-9b74779a11af?w=100&h=75&fit=crop" alt="レビュー画像" class="review-image">
                    <div class="review-text">
                        全体的に満足していますが、もう少し選択肢があるとより良いと思います。
                    </div>
                </div>

                <div class="review-item">
                    <div class="review-top">
                        <div class="review-rating">
                            <span class="star">★</span>
                            <span class="star">★</span>
                            <span class="star">★</span>
                            <span class="star">★</span>
                            <span class="star">★</span>
                        </div>
                        <div class="review-date">2024.12.5</div>
                    </div>
                    <img src="https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=100&h=75&fit=crop" alt="レビュー画像" class="review-image">
                    <div class="review-text">
                        初めて利用しましたが、想像以上の仕上がりでした。細部まで気を配られていて、プロの仕事だと感じました。
                    </div>
                </div>

                <div class="review-item">
                    <div class="review-top">
                        <div class="review-rating">
                            <span class="star">★</span>
                            <span class="star">★</span>
                            <span class="star">★</span>
                            <span class="star">★</span>
                            <span class="star">★</span>
                        </div>
                        <div class="review-date">2024.12.3</div>
                    </div>
                    <img src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=100&h=75&fit=crop" alt="レビュー画像" class="review-image">
                    <div class="review-text">
                        長年お世話になっています。安定した品質とサービスで、いつも安心して任せられます。
                    </div>
                </div>

                <!-- 無限スクロール用複製 -->
                <div class="review-item">
                    <div class="review-top">
                        <div class="review-rating">
                            <span class="star">★</span>
                            <span class="star">★</span>
                            <span class="star">★</span>
                            <span class="star">★</span>
                            <span class="star">★</span>
                        </div>
                        <div class="review-date">2024.12.15</div>
                    </div>
                    <img src="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100&h=75&fit=crop" alt="レビュー画像" class="review-image">
                    <div class="review-text">
                        とても使いやすいサービスでした。スタッフの対応も丁寧で、また利用したいと思います。
                    </div>
                </div>

                <div class="review-item">
                    <div class="review-top">
                        <div class="review-rating">
                            <span class="star">★</span>
                            <span class="star">★</span>
                            <span class="star">★</span>
                            <span class="star">★</span>
                            <span class="star">★</span>
                        </div>
                        <div class="review-date">2024.12.10</div>
                    </div>
                    <img src="https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=100&h=75&fit=crop" alt="レビュー画像" class="review-image">
                    <div class="review-text">
                        迅速な対応と高品質なサービスに感動しました。価格も手頃で、コストパフォーマンスが抜群です。
                    </div>
                </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        let currentIndex = 0;
        const totalReviews = 5;
        let isSidebarOpen = false;
        const track = document.getElementById('reviewsTrack');

        function toggleSidebar() {
            const container = document.getElementById('reviewContainer');
            isSidebarOpen = !isSidebarOpen;
            
            if (isSidebarOpen) {
                container.classList.add('sidebar-open');
            } else {
                container.classList.remove('sidebar-open');
            }
        }

        function updateIndicators() {
            const dots = document.querySelectorAll('.dot');
            dots.forEach((dot, index) => {
                dot.classList.toggle('active', index === currentIndex);
            });
        }

        function stopAutoScroll() {
            isAutoScrolling = false;
            track.classList.remove('auto-scroll');
        }

        function startAutoScroll() {
            isAutoScrolling = true;
            track.classList.add('auto-scroll');
        }

        function goToSlide(index) {
            currentIndex = index;
            const offset = -index * 200;
            track.style.transform = `translateX(${offset}px)`;
            updateIndicators();
        }

        function prevReview() {
            currentIndex = (currentIndex - 1 + totalReviews) % totalReviews;
            const offset = -currentIndex * 200;
            track.style.transform = `translateX(${offset}px)`;
            updateIndicators();
        }

        function nextReview() {
            currentIndex = (currentIndex + 1) % totalReviews;
            const offset = -currentIndex * 200;
            track.style.transform = `translateX(${offset}px)`;
            updateIndicators();
        }

        // アニメーション終了時に無限ループを実現
        track.addEventListener('animationiteration', () => {
            if (isAutoScrolling) {
                currentIndex = (currentIndex + 1) % totalReviews;
                updateIndicators();
            }
        });

        // 初期化
        updateIndicators();
    </script>
</body>
</html>