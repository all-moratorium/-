import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import './Gallery3D.css';

const Gallery3D = ({ models = [] }) => {
    const containerRef = useRef(null);
    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const rendererRef = useRef(null);
    const allModelsRef = useRef([]);
    const mouseRef = useRef({ x: 0, y: 0 });
    const targetRotationRef = useRef({ x: 0, y: 0 });
    const isTransitioningRef = useRef(false);
    const raycasterRef = useRef(new THREE.Raycaster());
    const mouseVectorRef = useRef(new THREE.Vector2());
    const isHoveringModelRef = useRef(false);
    const isTooltipShownRef = useRef(false);
    const autoSwitchTimerRef = useRef(null);
    const lastInteractionTimeRef = useRef(Date.now());
    const isInitializedRef = useRef(false); // 初期化フラグを追加
    const resizeTimeoutRef = useRef(null); // リサイズのデバウンス用

    const [loading, setLoading] = useState(true);

    // デフォルトの絵画情報（modelsが空の場合に使用）
    const defaultPaintingData = [
        {
            name: "Ethereal Hummingbird",
            description: "美しい虹色の羽を持つ幻想的なハチドリ。光と影が織りなす神秘的な世界を表現しています。",
            color: 0x4a9eff,
            frameColor: 0x8b4513,
            icon: "🦜",
            theme: "hummingbird",
            width: 1.8,
            height: 2.4
        },
        {
            name: "Steampunk Guardian",
            description: "蒸気とギアで動く機械の守護者。古き良き時代の技術と未来への憧れが融合した作品です。",
            color: 0xd4af37,
            frameColor: 0x2f4f4f,
            icon: "⚙️",
            theme: "steampunk",
            width: 2.4,
            height: 1.8
        },
        {
            name: "Lunar Scorpion",
            description: "月の光を纏う神秘的なサソリ。夜の静寂の中で輝く銀色の美しさを表現しています。",
            color: 0xc0c0c0,
            frameColor: 0x1e1e1e,
            icon: "🦂",
            theme: "scorpion",
            width: 2.0,
            height: 2.0
        },
        {
            name: "Mystic Cottage",
            description: "魔法使いが住む小さな家。温かな光に包まれた、ファンタジーの世界への入り口です。",
            color: 0x8b4513,
            frameColor: 0x654321,
            icon: "🏠",
            theme: "cottage",
            width: 2.6,
            height: 1.6
        },
        {
            name: "Crimson Dragon",
            description: "炎を操る古代の竜。力強さと美しさを兼ね備えた、伝説の生き物を描いた傑作です。",
            color: 0xff4500,
            frameColor: 0x800000,
            icon: "🐉",
            theme: "dragon",
            width: 1.6,
            height: 2.8
        }
    ];

    // 使用するモデルデータ
    const paintingData = models.length > 0 ? models : defaultPaintingData;

    // モデル間の間隔
    const spacing = 9;

    const setupLighting = useCallback(() => {
        const scene = sceneRef.current;
        if (!scene) return;

        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        scene.add(ambientLight);

        const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
        mainLight.position.set(5, 10, 5);
        mainLight.castShadow = true;
        mainLight.shadow.mapSize.width = 2048;
        mainLight.shadow.mapSize.height = 2048;
        scene.add(mainLight);

        const rimLight = new THREE.DirectionalLight(0x6699ff, 0.4);
        rimLight.position.set(-5, 5, -5);
        scene.add(rimLight);

        const spotLight = new THREE.SpotLight(0xffffff, 0.8);
        spotLight.position.set(0, 8, 6);
        spotLight.angle = Math.PI / 6;
        spotLight.penumbra = 0.3;
        spotLight.decay = 2;
        spotLight.distance = 20;
        scene.add(spotLight);

        const frontLight = new THREE.DirectionalLight(0xffffff, 0.5);
        frontLight.position.set(0, 5, 10);
        scene.add(frontLight);

        const leftLight = new THREE.DirectionalLight(0xffccaa, 0.3);
        leftLight.position.set(-8, 3, 3);
        scene.add(leftLight);

        const rightLight = new THREE.DirectionalLight(0xaaccff, 0.3);
        rightLight.position.set(8, 3, 3);
        scene.add(rightLight);

        const bottomLight = new THREE.DirectionalLight(0xffffff, 0.4);
        bottomLight.position.set(0, -5, 5);
        scene.add(bottomLight);

        const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
        backLight.position.set(0, 5, -10);
        scene.add(backLight);
    }, []);

    const createPainting = useCallback((data, index, setIndex = 0) => {
        const group = new THREE.Group();

        const frameWidth = data.width * 2.1;
        const frameHeight = data.height * 2.1;
        const frameDepth = 0.1;

        const canvasGeometry = new THREE.PlaneGeometry(frameWidth * 0.8, frameHeight * 0.8);
        const canvasMaterial = new THREE.MeshPhysicalMaterial({
            color: new THREE.Color(data.color).multiplyScalar(1.2),
            roughness: 0.9,
            metalness: 0.05,
            emissive: new THREE.Color(data.color).multiplyScalar(0.02)
        });
        const canvas = new THREE.Mesh(canvasGeometry, canvasMaterial);
        canvas.position.z = frameDepth / 2 + 0.01;
        group.add(canvas);

        const frameGeometry = new THREE.BoxGeometry(frameWidth, frameHeight, frameDepth);
        const frameMaterial = new THREE.MeshPhysicalMaterial({
            color: new THREE.Color(data.frameColor).multiplyScalar(1.1),
            roughness: 0.8,
            metalness: 0.1
        });
        const frame = new THREE.Mesh(frameGeometry, frameMaterial);
        frame.castShadow = true;
        frame.receiveShadow = true;
        group.add(frame);

        const setOffset = setIndex * paintingData.length * spacing;
        group.position.x = index * spacing + setOffset;
        group.position.y = -0.5;

        group.userData = {
            originalIndex: index,
            setIndex: setIndex,
            originalScale: 1,
            targetScale: 1,
            paintingData: data
        };

        return group;
    }, [paintingData]);

    const createModels = useCallback(() => {
        const allModels = [];
        for (let setIndex = -1; setIndex <= 1; setIndex++) {
            for (let i = 0; i < paintingData.length; i++) {
                const painting = createPainting(paintingData[i], i, setIndex);
                allModels.push(painting);
                sceneRef.current.add(painting);
            }
        }
        allModelsRef.current = allModels;
    }, [createPainting, paintingData]);

    const getCenterModel = useCallback(() => {
        const allModels = allModelsRef.current;
        if (!allModels.length) return null;

        return allModels.reduce((closest, current) => {
            const closestDistance = Math.abs(closest.position.x);
            const currentDistance = Math.abs(current.position.x);
            return currentDistance < closestDistance ? current : closest;
        });
    }, []);

    const adjustForSeamlessLoop = useCallback(() => {
        const setLength = paintingData.length * spacing;

        allModelsRef.current.forEach((model) => {
            if (model.position.x > setLength * 1.5) {
                model.position.x -= setLength * 3;
            } else if (model.position.x < -setLength * 1.5) {
                model.position.x += setLength * 3;
            }
        });
    }, [paintingData.length]);

    const updateModelOpacity = useCallback((model, opacity) => {
        model.children.forEach(child => {
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(mat => {
                        mat.opacity = mat.opacity + (opacity - mat.opacity) * 0.1;
                        mat.transparent = true;
                    });
                } else {
                    child.material.opacity = child.material.opacity + (opacity - child.material.opacity) * 0.1;
                    child.material.transparent = true;
                }
            }
        });
    }, []);

    const updateModelPositions = useCallback(() => {
        const allModels = allModelsRef.current;
        if (!allModels.length) return;

        const centerModel = getCenterModel();

        allModels.forEach((model) => {
            const distanceFromCamera = Math.abs(model.position.x);
            const isCenterModel = model === centerModel;

            if (isCenterModel) {
                model.userData.targetScale = 1.65;
                updateModelOpacity(model, 1.0);
            } else if (distanceFromCamera < spacing * 2.5) {
                const scale = Math.max(1, 1.3 - (distanceFromCamera / (spacing * 3)));
                model.userData.targetScale = scale;
                updateModelOpacity(model, 1.0);
            } else {
                model.userData.targetScale = 1;
                updateModelOpacity(model, 1.0);
            }

            model.scale.x = model.scale.x + (model.userData.targetScale - model.scale.x) * 0.1;
            model.scale.y = model.scale.y + (model.userData.targetScale - model.scale.y) * 0.1;
            model.scale.z = model.scale.z + (model.userData.targetScale - model.scale.z) * 0.1;
        });
    }, [getCenterModel, updateModelOpacity]);

    const showClickPrompt = useCallback(() => {
        const clickPrompt = document.getElementById('clickPrompt');
        if (clickPrompt) {
            clickPrompt.classList.add('show');
        }
    }, []);

    const hideClickPrompt = useCallback(() => {
        const clickPrompt = document.getElementById('clickPrompt');
        if (clickPrompt) {
            clickPrompt.classList.remove('show');
        }
    }, []);

    const showTooltip = useCallback((data) => {
        const tooltipRight = document.getElementById('hoverTooltipRight');
        const tooltipLeft = document.getElementById('hoverTooltipLeft');
        const tooltipImage = document.getElementById('tooltipImage');
        const tooltipTitle = document.getElementById('tooltipTitle');
        const tooltipDescription = document.getElementById('tooltipDescription');

        if (tooltipRight && tooltipLeft && tooltipImage && tooltipTitle && tooltipDescription) {
            tooltipImage.textContent = data.icon;
            tooltipImage.className = `tooltip-image ${data.theme}`;
            tooltipRight.classList.add('show');
            
            tooltipTitle.textContent = data.name;
            tooltipDescription.textContent = data.description;
            tooltipLeft.classList.add('show');
            
            isTooltipShownRef.current = true;
        }
    }, []);

    const hideTooltip = useCallback(() => {
        const tooltipRight = document.getElementById('hoverTooltipRight');
        const tooltipLeft = document.getElementById('hoverTooltipLeft');
        
        if (tooltipRight) {
            tooltipRight.classList.remove('show');
        }
        if (tooltipLeft) {
            tooltipLeft.classList.remove('show');
        }
        isTooltipShownRef.current = false;
    }, []);

    const switchToModel = useCallback((direction) => {
        if (isTransitioningRef.current) return;

        isTransitioningRef.current = true;

        if (isHoveringModelRef.current) {
            isHoveringModelRef.current = false;
            hideClickPrompt();
        }
        if (isTooltipShownRef.current) {
            hideTooltip();
        }

        const moveDistance = spacing * direction;
        const startPositions = allModelsRef.current.map(model => model.position.x);

        let progress = 0;
        const duration = 800;
        const startTime = Date.now();

        const animateTransition = () => {
            const elapsed = Date.now() - startTime;
            progress = Math.min(elapsed / duration, 1);

            const easeInOutCubic = progress < 0.5
                ? 4 * progress * progress * progress
                : 1 - Math.pow(-2 * progress + 2, 3) / 2;

            allModelsRef.current.forEach((model, index) => {
                model.position.x = startPositions[index] - moveDistance * easeInOutCubic;
            });

            if (progress < 1) {
                requestAnimationFrame(animateTransition);
            } else {
                adjustForSeamlessLoop();
                updateModelPositions();
                isTransitioningRef.current = false;
            }
        };

        animateTransition();
    }, [hideClickPrompt, hideTooltip, adjustForSeamlessLoop, updateModelPositions]);

    const recordUserInteraction = useCallback(() => {
        lastInteractionTimeRef.current = Date.now();
        if (autoSwitchTimerRef.current) {
            clearTimeout(autoSwitchTimerRef.current);
        }
        autoSwitchTimerRef.current = setTimeout(() => {
            if (!isTransitioningRef.current && !isTooltipShownRef.current) {
                switchToModel(1);
            }
            recordUserInteraction();
        }, 25000);
    }, [switchToModel]);

    const checkHover = useCallback((event) => {
        const rect = rendererRef.current.domElement.getBoundingClientRect();
        const mouseX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        const mouseY = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        mouseVectorRef.current.x = mouseX;
        mouseVectorRef.current.y = mouseY;

        raycasterRef.current.setFromCamera(mouseVectorRef.current, cameraRef.current);

        const centerModel = getCenterModel();
        if (!centerModel) {
            hideClickPrompt();
            return;
        }

        const intersects = raycasterRef.current.intersectObjects(centerModel.children, true);

        if (intersects.length > 0 && !isTransitioningRef.current) {
            if (!isHoveringModelRef.current) {
                showClickPrompt();
                isHoveringModelRef.current = true;
            }
        } else {
            if (isHoveringModelRef.current) {
                hideClickPrompt();
                isHoveringModelRef.current = false;
            }
        }
    }, [getCenterModel, showClickPrompt, hideClickPrompt]);

    const animate = useCallback(() => {
        if (!isInitializedRef.current) return;
        
        requestAnimationFrame(animate);

        const currentCenterModel = getCenterModel();

        allModelsRef.current.forEach(model => {
            if (model === currentCenterModel) {
                model.rotation.y += (targetRotationRef.current.y - model.rotation.y) * 0.03;
                model.rotation.x += (targetRotationRef.current.x - model.rotation.x) * 0.03;
                model.position.y = 0 + Math.sin(Date.now() * 0.0015) * 0.05;
            } else {
                model.rotation.y += (0 - model.rotation.y) * 0.03;
                model.rotation.x += (0 - model.rotation.x) * 0.03;
                model.position.y += (0 - model.position.y) * 0.05;
            }
        });

        updateModelPositions();

        if (rendererRef.current && sceneRef.current && cameraRef.current) {
            rendererRef.current.render(sceneRef.current, cameraRef.current);
        }
    }, [getCenterModel, updateModelPositions]);

    // リサイズ処理を最適化
    const updateRendererSize = useCallback(() => {
        if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;

        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;

        // サイズが変わっていない場合は何もしない
        if (rendererRef.current.domElement.width === width && 
            rendererRef.current.domElement.height === height) {
            return;
        }

        rendererRef.current.setSize(width, height);
        cameraRef.current.aspect = width / height;
        cameraRef.current.updateProjectionMatrix();
    }, []);

    useEffect(() => {
        if (!containerRef.current || isInitializedRef.current) return;

        isInitializedRef.current = true;

        // シーン作成
        sceneRef.current = new THREE.Scene();

        // カメラ作成
        cameraRef.current = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
        cameraRef.current.position.set(0, 0, 8);

        // レンダラー作成
        rendererRef.current = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        rendererRef.current.shadowMap.enabled = true;
        rendererRef.current.shadowMap.type = THREE.PCFSoftShadowMap;
        containerRef.current.appendChild(rendererRef.current.domElement);

        // 初期サイズ設定
        updateRendererSize();

        // ライティング
        setupLighting();

        // モデル作成
        createModels();
        updateModelPositions();

        // アニメーションループ開始
        animate();

        // 自動切り替えタイマー開始
        recordUserInteraction();

        setLoading(false);

        // イベントリスナー
        const handleMouseMove = (event) => {
            if (!isInitializedRef.current) return;
            
            recordUserInteraction();
            const rect = rendererRef.current.domElement.getBoundingClientRect();
            
            const isInsideRenderer = event.clientX >= rect.left && 
                                   event.clientX <= rect.right && 
                                   event.clientY >= rect.top && 
                                   event.clientY <= rect.bottom;
            
            if (isInsideRenderer) {
                mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
                mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
                
                if (Math.abs(mouseRef.current.x) <= 0.8 && Math.abs(mouseRef.current.y) <= 0.8) {
                    targetRotationRef.current.y = mouseRef.current.x * 0.5;
                    targetRotationRef.current.x = -mouseRef.current.y * 0.5;
                } else {
                    targetRotationRef.current.y += (0 - targetRotationRef.current.y) * 0.05;
                    targetRotationRef.current.x += (0 - targetRotationRef.current.x) * 0.05;
                }
                
                checkHover(event);
            } else {
                targetRotationRef.current.y += (0 - targetRotationRef.current.y) * 0.05;
                targetRotationRef.current.x += (0 - targetRotationRef.current.x) * 0.05;
            }
        };

        const handleMouseLeave = () => {
            targetRotationRef.current.y += (0 - targetRotationRef.current.y) * 0.05;
            targetRotationRef.current.x += (0 - targetRotationRef.current.x) * 0.05;
            
            if (isHoveringModelRef.current) {
                isHoveringModelRef.current = false;
                hideClickPrompt();
            }
        };

        const handleClick = (event) => {
            if (!isInitializedRef.current) return;
            
            recordUserInteraction();
            const rect = rendererRef.current.domElement.getBoundingClientRect();
            mouseVectorRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouseVectorRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            raycasterRef.current.setFromCamera(mouseVectorRef.current, cameraRef.current);

            const centerModel = getCenterModel();
            if (!centerModel) {
                if (isTooltipShownRef.current) hideTooltip();
                return;
            }

            const intersects = raycasterRef.current.intersectObjects(centerModel.children, true);

            if (intersects.length > 0) {
                if (isTooltipShownRef.current) {
                    hideTooltip();
                } else {
                    showTooltip(centerModel.userData.paintingData);
                }
            } else {
                if (isTooltipShownRef.current) {
                    hideTooltip();
                }
            }
        };

        const handlePrevClick = () => {
            recordUserInteraction();
            if (!isTransitioningRef.current) {
                switchToModel(-1);
                hideTooltip();
                hideClickPrompt();
            }
        };

        const handleNextClick = () => {
            recordUserInteraction();
            if (!isTransitioningRef.current) {
                switchToModel(1);
                hideTooltip();
                hideClickPrompt();
            }
        };

        const handleKeyDown = (event) => {
            recordUserInteraction();
            switch (event.code) {
                case 'ArrowLeft':
                    handlePrevClick();
                    break;
                case 'ArrowRight':
                    handleNextClick();
                    break;
                default:
                    break;
            }
        };

        // デバウンス付きリサイズハンドラー
        const handleResize = () => {
            if (resizeTimeoutRef.current) {
                clearTimeout(resizeTimeoutRef.current);
            }
            resizeTimeoutRef.current = setTimeout(() => {
                updateRendererSize();
            }, 0); // 約60FPS相
        };

        // ResizeObserverを使用してコンテナのリサイズを監視
        const resizeObserver = new ResizeObserver(handleResize);
        
        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseleave', handleMouseLeave);
        
        const container = containerRef.current;
        if (container) {
            container.addEventListener('click', handleClick);
        }
        
        // ボタンイベントは少し遅延して追加
        const addButtonEvents = () => {
            const prevBtn = document.getElementById('prevBtn');
            const nextBtn = document.getElementById('nextBtn');
            if (prevBtn) prevBtn.addEventListener('click', handlePrevClick);
            if (nextBtn) nextBtn.addEventListener('click', handleNextClick);
        };
        
        setTimeout(addButtonEvents, 100);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            isInitializedRef.current = false;
            
            // クリーンアップ
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseleave', handleMouseLeave);
            if (container) {
                container.removeEventListener('click', handleClick);
            }
            const prevBtn = document.getElementById('prevBtn');
            const nextBtn = document.getElementById('nextBtn');
            if (prevBtn) prevBtn.removeEventListener('click', handlePrevClick);
            if (nextBtn) nextBtn.removeEventListener('click', handleNextClick);
            document.removeEventListener('keydown', handleKeyDown);
            resizeObserver.disconnect();
            clearTimeout(autoSwitchTimerRef.current);
            clearTimeout(resizeTimeoutRef.current);
            
            // Three.jsリソースのクリーンアップ
            if (containerRef.current && rendererRef.current && rendererRef.current.domElement) {
                containerRef.current.removeChild(rendererRef.current.domElement);
            }
            if (sceneRef.current) {
                sceneRef.current.clear();
            }
            if (rendererRef.current) {
                rendererRef.current.dispose();
            }
        };

    }, []); // 依存配列を空にして初期化は一度だけ実行

    return (
        <div id="container" ref={containerRef}>
            <div className="background-strip" id="backgroundStrip"></div>
            {loading && <div className="loading" id="loading">ギャラリーを読み込み中...</div>}
            <div className="navigation nav-left" id="prevBtn">‹</div>
            <div className="navigation nav-right" id="nextBtn">›</div>

            <div className="click-prompt" id="clickPrompt">クリックで詳細</div>

            <div className="hover-tooltip-right" id="hoverTooltipRight">
                <div className="tooltip-image" id="tooltipImage"></div>
            </div>

            <div className="hover-tooltip-left" id="hoverTooltipLeft">
                <div className="tooltip-title" id="tooltipTitle"></div>
                <div className="tooltip-description" id="tooltipDescription"></div>
            </div>
        </div>
    );
};

export default Gallery3D;