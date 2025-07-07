import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';
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
    const cachedModelsRef = useRef({}); // 複数GLBモデルをキャッシュ

    const [loading, setLoading] = useState(true);
    const [modelScales, setModelScales] = useState({});

    // 個別モデル設定（各モデルごとにパラメーター管理）
    const modelConfigs = [
        {
            id: "darts-bar-1",
            name: "ダーツバー1",
            glbPath: '/models/neon sample glb/my-neon-sign-optimized (31).glb',
            imagePath: '/ダーツバー2d.png',
            description: "ダーツバーのネオンサイン1",
            modelScale: 0.0070,
            imageScale: 5.2,
            sideModelScale: 1.5, // 中央から外れた時の3Dモデルサイズ // スケール値のみ指定、比率は自動保持
            icon: "🎯",
            theme: "darts"
        },
        {
            id: "darts-bar-2", 
            name: "ダーツバー2",
            glbPath: '/models/neon sample glb/my-neon-sign-optimized (32).glb',
            imagePath: '/ラーメン2d.png',
            description: "ダーツバーのネオンサイン2",
            modelScale: 0.006,
            imageScale: 4.5,
            sideModelScale: 1.3, // 中央から外れた時の3Dモデルサイズ
            icon: "🎯",
            theme: "darts"
        },
        {
            id: "ramen",
            name: "ラーメン", 
            glbPath: '/models/neon sample glb/ラーメン.glb',
            imagePath: '/ラーメン2d.png',
            description: "ラーメンのネオンサイン1",
            modelScale: 0.006,
            imageScale: 4.5,
            sideModelScale: 1.3, // 中央から外れた時の3Dモデルサイズ
            icon: "�",
            theme: "ramen"
        },
        {
            id: "cocktail-1",
            name: "カクテル1",
            glbPath: '/models/neon sample glb/my-neon-sign-optimized (53).glb', 
            imagePath: '/ダーツバー2d.png',
            description: "カクテルバーのネオンサイン1",
            modelScale: 0.005,
            imageScale: 6,
            sideModelScale: 1.2, // 中央から外れた時の3Dモデルサイズ
            icon: "🍸",
            theme: "cocktail"
        },
        {
            id: "ボウリング",
            name: "ボウリング",
            glbPath: '/models/neon sample glb/ボウリング.glb',
            imagePath: 'ボウリング2d.png', 
            description: "ボウリングのネオンサイン",
            modelScale: 0.0075,
            imageScale: 4.45,
            sideModelScale: 1.5, // 中央から外れた時の3Dモデルサイズ
            icon: " Bowling",
            theme: "bowling"
        },
        {
            id: "corvette-2",
            name: "コルベット2", 
            glbPath: '/models/neon sample glb/my-neon-sign-optimized (36).glb',
            imagePath: '/ダーツバー2d.png',
            description: "コルベットのネオンサイン2", 
            modelScale: 0.008,
            imageScale: 5.8,
            sideModelScale: 1.2, // 中央から外れた時の3Dモデルサイズ
            icon: "🚗",
            theme: "car"
        },
        {
            id: "sample-on",
            name: "サンプルON",
            glbPath: '/models/neon sample glb/my-neon-sign-optimized (53).glb',
            imagePath: '/ダーツバー2d.png',
            description: "サンプルネオン（点灯）",
            modelScale: 0.006,
            imageScale: 6,
            sideModelScale: 1.2, // 中央から外れた時の3Dモデルサイズ
            icon: "💡",
            theme: "sample"
        },
        {
            id: "sports car", 
            name: "スポーツカー",
            glbPath: '/models/neon sample glb/my-neon-sign-optimized (38).glb',
            imagePath: '/スポーツカー2d.png',
            description: "スポーツカーのネオンサイン",
            modelScale: 0.0048,
            imageScale: 5.8,
            sideModelScale: 1.5, // 中央から外れた時の3Dモデルサイズ
            icon: "🚗",
            theme: "car"
        }
    ];

    // 使用するモデルデータ
    const paintingData = models.length > 0 ? models : modelConfigs;

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

    // 指定されたGLBモデルを読み込んでキャッシュ
    const loadCachedModel = useCallback((modelPath) => {
        if (cachedModelsRef.current[modelPath]) {
            return Promise.resolve(cachedModelsRef.current[modelPath]);
        }

        return new Promise((resolve, reject) => {
            const loader = new GLTFLoader();
            const dracoLoader = new DRACOLoader();
            dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
            loader.setDRACOLoader(dracoLoader);

            loader.load(
                modelPath,
                (gltf) => {
                    cachedModelsRef.current[modelPath] = gltf.scene;
                    resolve(gltf.scene);
                },
                (progress) => {
                    console.log(`GLBローディング進捗 (${modelPath}):`, (progress.loaded / progress.total * 100) + '%');
                },
                (error) => {
                    console.error(`GLBローディングエラー (${modelPath}):`, error);
                    reject(error);
                }
            );
        });
    }, []);

    const createNeonModel = useCallback((data, index, setIndex = 0) => {
        const group = new THREE.Group();

        // モデル設定から直接パスとスケールを取得
        const modelPath = data.glbPath;
        const modelKey = `${data.id}_${index}_${setIndex}`;

        // キャッシュされたモデルをクローンして使用
        loadCachedModel(modelPath).then((originalModel) => {
            const model = originalModel.clone();
            
            // 個別スケール値を取得（設定値 > カスタム値 > デフォルト値の順）
            const customScale = modelScales[modelKey] || data.modelScale || 0.006;
            model.scale.set(customScale, customScale, customScale);
            
            // モデルを中央に配置
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            model.position.sub(center);
            
            group.add(model);
        }).catch((error) => {
            console.error('GLBモデルのクローンエラー:', error);
        });

        const setOffset = setIndex * paintingData.length * spacing;
        group.position.x = index * spacing + setOffset;
        group.position.y = 0; // 全て同じ高さに統一

        group.userData = {
            originalIndex: index,
            setIndex: setIndex,
            originalScale: 1,
            targetScale: 1,
            paintingData: data,
            modelKey: modelKey
        };

        return group;
    }, [paintingData, loadCachedModel, modelScales]);

    // 画像プレーンを作成（遠くのモデル用）
    const createImagePlane = useCallback((data, index, setIndex = 0) => {
        const group = new THREE.Group();
        
        // ネオンサイン画像を読み込んで表示（比率を自動保持）
        const imagePath = data.imagePath;
        const textureLoader = new THREE.TextureLoader();
        
        // 仮のプレーンを作成（画像読み込み後にサイズ調整）
        const planeGeometry = new THREE.PlaneGeometry(1, 1);
        const planeMaterial = new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 0, // 初期状態で透明
            visible: false // 初期状態で非表示
        });
        
        textureLoader.load(imagePath, (texture) => {
            texture.colorSpace = THREE.SRGBColorSpace;
            planeMaterial.map = texture;
            
            // 画像の元比率を取得
            const aspectRatio = texture.image.width / texture.image.height;
            const scale = data.imageScale || 6;
            
            // 比率を保ったままサイズ調整
            if (aspectRatio >= 1) {
                // 横長画像：幅をscaleにして高さを比率で調整
                planeGeometry.scale(scale, scale / aspectRatio, 1);
            } else {
                // 縦長画像：高さをscaleにして幅を比率で調整
                planeGeometry.scale(scale * aspectRatio, scale, 1);
            }
            
            // 画像が読み込まれてから表示
            planeMaterial.opacity = 0.9;
            planeMaterial.visible = true;
            planeMaterial.needsUpdate = true;
        });
        
        const plane = new THREE.Mesh(planeGeometry, planeMaterial);
        group.add(plane);

        const setOffset = setIndex * paintingData.length * spacing;
        group.position.x = index * spacing + setOffset;
        group.position.y = 0; // 全て同じ高さに統一

        group.userData = {
            originalIndex: index,
            setIndex: setIndex,
            originalScale: 1,
            targetScale: 1,
            paintingData: data,
            modelKey: `${data.id}_${index}_${setIndex}`,
            isImage: true
        };

        return group;
    }, [paintingData]);

    const createModels = useCallback(() => {
        const allModels = [];
        
        // 3セット作成して継ぎ目なく繋がるように配置
        for (let set = 0; set < 3; set++) {
            for (let i = 0; i < paintingData.length; i++) {
                const modelConfig = paintingData[i];
                const position = (set - 1) * paintingData.length + i;
                
                if (set === 1 && i === 0) {
                    // 中央のセットの最初のモデルを3Dモデルに
                    const neonModel = createNeonModel(modelConfig, position, 0);
                    allModels.push(neonModel);
                    sceneRef.current.add(neonModel);
                } else {
                    // その他は全て画像プレーン
                    const imagePlane = createImagePlane(modelConfig, position, 0);
                    allModels.push(imagePlane);
                    sceneRef.current.add(imagePlane);
                }
            }
        }
        
        allModelsRef.current = allModels;
    }, [createNeonModel, createImagePlane, paintingData]);

    const getCenterModel = useCallback(() => {
        const allModels = allModelsRef.current;
        if (!allModels.length) return null;

        return allModels.reduce((closest, current) => {
            const closestDistance = Math.abs(closest.position.x);
            const currentDistance = Math.abs(current.position.x);
            return currentDistance < closestDistance ? current : closest;
        });
    }, []);

    // 中央モデルを3Dモデルに切り替え、他のモデルを画像プレーンに戻す
    const updateCenterModel = useCallback(() => {
        const centerModel = getCenterModel();
        if (!centerModel) return;

        // 全てのモデルを画像プレーンに戻す
        allModelsRef.current.forEach(model => {
            if (model !== centerModel && !model.userData.isImage) {
                // 3Dモデルを画像プレーンに変更
                model.children.forEach(child => {
                    model.remove(child);
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) child.material.dispose();
                });

                // ネオンサイン画像プレーンを追加
                const paintingData = model.userData.paintingData;
                const imagePath = paintingData.imagePath;
                
                const textureLoader = new THREE.TextureLoader();
                const planeGeometry = new THREE.PlaneGeometry(1, 1);
                const planeMaterial = new THREE.MeshBasicMaterial({
                    transparent: true,
                    opacity: 0, // 初期状態で透明
                    visible: false // 初期状態で非表示
                });
                
                textureLoader.load(imagePath, (texture) => {
                    texture.colorSpace = THREE.SRGBColorSpace;
                    planeMaterial.map = texture;
                    
                    // 画像の元比率を取得
                    const aspectRatio = texture.image.width / texture.image.height;
                    const scale = paintingData.imageScale || 6;
                    
                    // 比率を保ったままサイズ調整
                    if (aspectRatio >= 1) {
                        // 横長画像：幅をscaleにして高さを比率で調整
                        planeGeometry.scale(scale, scale / aspectRatio, 1);
                    } else {
                        // 縦長画像：高さをscaleにして幅を比率で調整
                        planeGeometry.scale(scale * aspectRatio, scale, 1);
                    }
                    
                    // 画像が読み込まれてから表示
                    planeMaterial.opacity = 0.9;
                    planeMaterial.visible = true;
                    planeMaterial.needsUpdate = true;
                });
                
                const plane = new THREE.Mesh(planeGeometry, planeMaterial);
                model.add(plane);
                model.userData.isImage = true;
            }
        });

        // 現在の中央が画像プレーンの場合、3Dモデルに置き換え
        if (centerModel.userData.isImage === true) {
            const paintingData = centerModel.userData.paintingData;
            const modelPath = paintingData.glbPath;

            // 既存の子要素をクリア
            centerModel.children.forEach(child => {
                centerModel.remove(child);
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });

            // 3Dモデルを非同期で読み込み（即座に画像プレーンをクリア）
            loadCachedModel(modelPath).then((originalModel) => {
                const model = originalModel.clone();
                
                // 個別スケール値を取得（設定値 > カスタム値 > デフォルト値の順）
                const modelKey = centerModel.userData.modelKey;
                const customScale = modelScales[modelKey] || paintingData.modelScale || 0.006;
                model.scale.set(customScale, customScale, customScale);
                
                const box = new THREE.Box3().setFromObject(model);
                const center = box.getCenter(new THREE.Vector3());
                model.position.sub(center);
                
                centerModel.add(model);
                centerModel.userData.isImage = false;
            }).catch((error) => {
                console.error('中央モデル更新エラー:', error);
            });
        }
    }, [getCenterModel, loadCachedModel, modelScales]);

    const adjustForSeamlessLoop = useCallback(() => {
        const setLength = paintingData.length * spacing;

        allModelsRef.current.forEach((model) => {
            // セットの境界を越えた場合のみループ
            if (model.position.x >= setLength) {
                model.position.x -= setLength * 3;
            } else if (model.position.x <= -setLength) {
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
            const isImagePlane = model.userData.isImage;

            if (isCenterModel) {
                model.userData.targetScale = 1.40;
                updateModelOpacity(model, 1.0);
            } else if (distanceFromCamera < spacing * 2.5) {
                // 設定値から縮小サイズを取得（デフォルトは1.2）
                const sideScale = model.userData.paintingData?.sideModelScale || 1.2;
                const scale = Math.max(1, sideScale - (distanceFromCamera / (spacing * 3)));
                model.userData.targetScale = scale;
                updateModelOpacity(model, 1.0);
            } else {
                model.userData.targetScale = 1;
                updateModelOpacity(model, 1.0);
            }

            // 画像プレーンは静的（スケールアニメーションなし）
            if (!isImagePlane) {
                model.scale.x = model.scale.x + (model.userData.targetScale - model.scale.x) * 0.1;
                model.scale.y = model.scale.y + (model.userData.targetScale - model.scale.y) * 0.1;
                model.scale.z = model.scale.z + (model.userData.targetScale - model.scale.z) * 0.1;
            }
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
        const scaleControls = document.getElementById('scaleControls');

        if (tooltipRight && tooltipLeft && tooltipImage && tooltipTitle && tooltipDescription) {
            tooltipImage.textContent = data.icon;
            tooltipImage.className = `tooltip-image ${data.theme}`;
            tooltipRight.classList.add('show');
            
            tooltipTitle.textContent = data.name;
            tooltipDescription.textContent = data.description;
            
            // 中央モデルのスケール制御を表示
            const centerModel = getCenterModel();
            if (centerModel && scaleControls) {
                const modelKey = centerModel.userData.modelKey;
                const currentScale = modelScales[modelKey] || 0.006;
                scaleControls.style.display = 'block';
                const scaleInput = document.getElementById('scaleInput');
                if (scaleInput) {
                    scaleInput.value = (currentScale * 1000).toFixed(1); // 0.006 -> 6.0 for display
                }
            }
            
            tooltipLeft.classList.add('show');
            
            isTooltipShownRef.current = true;
        }
    }, [getCenterModel, modelScales]);

    const hideTooltip = useCallback(() => {
        const tooltipRight = document.getElementById('hoverTooltipRight');
        const tooltipLeft = document.getElementById('hoverTooltipLeft');
        const scaleControls = document.getElementById('scaleControls');
        
        if (tooltipRight) {
            tooltipRight.classList.remove('show');
        }
        if (tooltipLeft) {
            tooltipLeft.classList.remove('show');
        }
        if (scaleControls) {
            scaleControls.style.display = 'none';
        }
        isTooltipShownRef.current = false;
    }, []);

    // 動的にモデルを追加する関数（削除は不要）
    const addModelIfNeeded = useCallback((direction) => {
        // 3セット構成なので動的追加は不要
        // adjustForSeamlessLoopでループ処理を行う
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
                // アニメーション完了後に即座にループ調整
                adjustForSeamlessLoop();
                // 新しい中央モデルに3Dモデルを更新
                updateCenterModel();
                updateModelPositions();
                isTransitioningRef.current = false;
            }
        };

        animateTransition();
    }, [hideClickPrompt, hideTooltip, updateCenterModel, adjustForSeamlessLoop, updateModelPositions]);

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
            const isImagePlane = model.userData.isImage;
            
            if (model === currentCenterModel && !isImagePlane) {
                // 中央の3Dモデルのみアニメーション（マウス追従を高速化）
                model.rotation.y += (targetRotationRef.current.y - model.rotation.y) * 0.1;
                model.rotation.x += (targetRotationRef.current.x - model.rotation.x) * 0.1;
                model.position.y = 0; // 中央モデルも同じ高さに固定
            } else if (!isImagePlane) {
                // 3Dモデルは回転をリセット（高速化）
                model.rotation.y += (0 - model.rotation.y) * 0.10;
                model.rotation.x += (0 - model.rotation.x) * 0.10;
                model.position.y = 0; // 他のモデルも同じ高さに固定
            }
            // 画像プレーンは完全に静止
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
                
                if (Math.abs(mouseRef.current.x) <= 0.4 && Math.abs(mouseRef.current.y) <= 0.8) {
                    targetRotationRef.current.y = mouseRef.current.x * 0.5;
                    targetRotationRef.current.x = -mouseRef.current.y * 0.5;
                } else {
                    targetRotationRef.current.y += (0 - targetRotationRef.current.y) * 0.15;
                    targetRotationRef.current.x += (0 - targetRotationRef.current.x) * 0.15;
                }
                
                checkHover(event);
            } else {
                targetRotationRef.current.y += (0 - targetRotationRef.current.y) * 0.15;
                targetRotationRef.current.x += (0 - targetRotationRef.current.x) * 0.15;
            }
        };

        const handleMouseLeave = () => {
            targetRotationRef.current.y += (0 - targetRotationRef.current.y) * 0.15;
            targetRotationRef.current.x += (0 - targetRotationRef.current.x) * 0.15;
            
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
        const handleScaleChange = (event) => {
            const newScale = parseFloat(event.target.value) / 1000; // 6.0 -> 0.006
            const centerModel = getCenterModel();
            if (centerModel) {
                const modelKey = centerModel.userData.modelKey;
                setModelScales(prev => ({ ...prev, [modelKey]: newScale }));
                
                // 即座にスケールを更新
                centerModel.children.forEach(child => {
                    if (child.scale && child.type === 'Group') {
                        // グループ全体のスケールを設定
                        child.scale.set(newScale, newScale, newScale);
                        
                        // スケール変更後、モデルを中央に再配置
                        try {
                            const box = new THREE.Box3().setFromObject(child);
                            if (box.min.x !== Infinity && box.max.x !== -Infinity) {
                                const center = box.getCenter(new THREE.Vector3());
                                child.position.sub(center);
                            }
                        } catch (error) {
                            // エラーの場合は位置をリセット
                            child.position.set(0, 0, 0);
                        }
                    } else if (child.scale) {
                        // 単一メッシュの場合
                        child.scale.set(newScale, newScale, newScale);
                    }
                });
                
                // スケール値の表示を更新
                const scaleValue = document.getElementById('scaleValue');
                if (scaleValue) {
                    scaleValue.textContent = event.target.value;
                }
            }
        };

        const addButtonEvents = () => {
            const prevBtn = document.getElementById('prevBtn');
            const nextBtn = document.getElementById('nextBtn');
            const scaleInput = document.getElementById('scaleInput');
            if (prevBtn) prevBtn.addEventListener('click', handlePrevClick);
            if (nextBtn) nextBtn.addEventListener('click', handleNextClick);
            if (scaleInput) scaleInput.addEventListener('input', handleScaleChange);
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
            const scaleInput = document.getElementById('scaleInput');
            if (prevBtn) prevBtn.removeEventListener('click', handlePrevClick);
            if (nextBtn) nextBtn.removeEventListener('click', handleNextClick);
            if (scaleInput) scaleInput.removeEventListener('input', handleScaleChange);
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
                <div className="scale-controls" id="scaleControls" style={{display: 'none'}}>
                    <label htmlFor="scaleInput">スケール: </label>
                    <input 
                        type="range" 
                        id="scaleInput" 
                        min="1" 
                        max="15" 
                        step="0.1" 
                        defaultValue="6.0"
                    />
                    <span id="scaleValue">6.0</span>
                </div>
            </div>
        </div>
    );
};

export default Gallery3D;