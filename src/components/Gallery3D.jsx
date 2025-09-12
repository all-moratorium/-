import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';
import animationManager from '../utils/AnimationManager';
import './Gallery3D.css';

const Gallery3D = ({ models = [], onPreloadingChange }) => {
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
    const preloadStatusRef = useRef({}); // プリロード状況を管理
    const animationCleanupRef = useRef(null); // AnimationManager用クリーンアップ関数
    const wiggleAnimationRef = useRef(null); // 揺れアニメーション停止用

    const [loading, setLoading] = useState(true);
    const [modelScales, setModelScales] = useState({});
    const [preloadProgress, setPreloadProgress] = useState(0); // プリロード進行状況
    const [isPreloading, setIsPreloading] = useState(false); // プリロード中フラグ
    
    // プリロード状態が変更された時に親コンポーネントに通知
    useEffect(() => {
        if (onPreloadingChange) {
            onPreloadingChange(isPreloading);
        }
    }, [isPreloading, onPreloadingChange]);

    // 個別モデル設定（各モデルごとにパラメーター管理）
    const modelConfigs = [
        
        {
            id: "butterfly",
            name: "蝶々",
            glbPath: '/models/neon sample glb/蝶々.glb',
            imagePath: '/neon sample pictures/蝶々2d.png',
            description: "蝶々のネオンサイン",
            modelScale: 0.0065,
            imageScale: 5.7,
            sideModelScale: 1.4, // 中央から外れた時の3Dモデルサイズ
            icon: "🦋",
            theme: "butterfly"
        },
        {
            id: "coffee", 
            name: "コーヒー",
            glbPath: '/models/neon sample glb/コーヒー.glb',
            imagePath: '/neon sample pictures/コーヒー2d.png',
            description: "コーヒーのネオンサイン1",
            modelScale: 0.015,
            imageScale: 5.3,
            sideModelScale: 1.4, // 中央から外れた時の3Dモデルサイズ
            icon: "🎯",
            theme: "coffee"
        },
       
        {
            id: "ramen",
            name: "ラーメン", 
            glbPath: '/models/neon sample glb/ラーメン.glb',
            imagePath: '/neon sample pictures/ラーメン2d.png',
            description: "ラーメンのネオンサイン1",
            modelScale: 0.006,
            imageScale: 4.9,
            sideModelScale: 1.4, // 中央から外れた時の3Dモデルサイズ
            icon: "�",
            theme: "ramen"
        },
        
       
        
        {
            id: "happy halloween",
            name: "ハッピーハロウィン",
            glbPath: '/models/neon sample glb/ハッピーハロウィン.glb', 
            imagePath: '/neon sample pictures/ハッピーハロウィン2d.png',
            description: "ハッピーハロウィンのネオンサイン",
            modelScale: 0.0085,
            imageScale: 6.5,
            sideModelScale: 1.5, // 中央から外れた時の3Dモデルサイズ
            icon: "🎃",
            theme: "halloween"
        },

        {
            id: "bowling",
            name: "ボウリング",
            glbPath: '/models/neon sample glb/ボウリング.glb',
            imagePath: '/neon sample pictures/ボウリング2d.png', 
            description: "ボウリングのネオンサイン",
            modelScale: 0.0075,
            imageScale: 5.1,
            sideModelScale: 1.5, // 中央から外れた時の3Dモデルサイズ
            icon: " Bowling",
            theme: "bowling"
        },
        {
            id: "unicorn",
            name: "ユニコーン", 
            glbPath: '/models/neon sample glb/ユニコーン.glb',
            imagePath: '/neon sample pictures/ユニコーン2d.png',
            description: "ユニコーンのネオンサイン", 
            modelScale: 0.0072,
            imageScale: 6.2,
            sideModelScale: 1.5, // 中央から外れた時の3Dモデルサイズ
            icon: "🦄",
            theme: "unicorn"
        },
        {
            id: "happy birthday",
            name: "ハッピーバースデイ", 
            glbPath: '/models/neon sample glb/ハッピーバースデイ.glb',
            imagePath: '/neon sample pictures/ハッピーバースデイ2d.png',
            description: "ハッピーバースデイのネオンサイン", 
            modelScale: 0.0085,
            imageScale: 6.9,
            sideModelScale: 1.5, // 中央から外れた時の3Dモデルサイズ
            icon: "🎂",
            theme: "birthday"
        },
       
        {
            id: "cocktail",
            name: "カクテル",
            glbPath: '/models/neon sample glb/カクテル.glb',
            imagePath: '/neon sample pictures/カクテル2d.png',
            description: "カクテルのネオンサイン1",
            modelScale: 0.0065,
            imageScale: 5.5,
            sideModelScale: 1.5, // 中央から外れた時の3Dモデルサイズ // スケール値のみ指定、比率は自動保持
            icon: "�",
            theme: "cocktail"
        },
        {
            id: "rose",
            name: "バラ",
            glbPath: '/models/neon sample glb/バラ.glb',
            imagePath: '/neon sample pictures/バラ2d.png',
            description: "バラのネオンサイン1",
            modelScale: 0.0056,
            imageScale: 6.2,
            sideModelScale: 1.5, // 中央から外れた時の3Dモデルサイズ // スケール値のみ指定、比率は自動保持
            icon: "�",
            theme: "rose"
        },
        
        {
            id: "sports car", 
            name: "スポーツカー",
            glbPath: '/models/neon sample glb/スポーツカー.glb',
            imagePath: '/neon sample pictures/スポーツカー2d.png',
            description: "スポーツカーのネオンサイン",
            modelScale: 0.0048,
            imageScale: 6.8,
            sideModelScale: 1.5, // 中央から外れた時の3Dモデルサイズ
            icon: "🚗",
            theme: "car"
        },
        {
            id: "darts-bar",
            name: "ダーツバー",
            glbPath: '/models/neon sample glb/ダーツバー.glb',
            imagePath: '/neon sample pictures/ダーツバー2d.png',
            description: "ダーツバーのネオンサイン1",
            modelScale: 0.0068,
            imageScale: 5.8,
            sideModelScale: 1.5, // 中央から外れた時の3Dモデルサイズ // スケール値のみ指定、比率は自動保持
            icon: "🎯",
            theme: "darts"
        },
        {
            id: "onair", 
            name: "オンエア",
            glbPath: '/models/neon sample glb/オンエア.glb',
            imagePath: '/neon sample pictures/オンエア2d.png',
            description: "オンエアのネオンサイン1",
            modelScale: 0.0086,
            imageScale: 5.2,
            sideModelScale: 1.4, // 中央から外れた時の3Dモデルサイズ
            icon: "",
            theme: "onair"
        },
        
        {
            id: "light blue hair",
            name: "ライトブルーヘアー",
            glbPath: '/models/neon sample glb/ライトブルーヘアー.glb',
            imagePath: '/neon sample pictures/ライトブルーヘアー2d.png',
            description: "ライトブルーヘアーのネオンサイン",
            modelScale: 0.0058,
            imageScale: 6,
            sideModelScale: 1.5, // 中央から外れた時の3Dモデルサイズ
            icon: "",
            theme: "light blue hair"
        },
        
       
    ];

    // 使用するモデルデータ
    const paintingData = models.length > 0 ? models : modelConfigs;

    // モデル間の間隔（モバイル版では狭くする）
    const isMobileDevice = window.innerWidth <= 1280 || navigator.maxTouchPoints > 0;
    const spacing = isMobileDevice ? 6.5 : 9;

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

    // 全モデルとサンプル画像をプリロードする関数
    const preloadAllModels = useCallback(async () => {
        setIsPreloading(true);
        setPreloadProgress(0);
        
        const totalModels = modelConfigs.length;
        const totalImages = 2; // sample.demo.on.png, sample.demo.off.png
        const totalAssets = totalModels + totalImages;
        let loadedCount = 0;
        
        console.log('全ネオンサインモデルと画像のプリロードを開始...');
        
        try {
            // モデルとサンプル画像を並列でプリロード
            const allPromises = [
                // モデルのプリロード
                ...modelConfigs.map(async (config) => {
                    try {
                        await loadCachedModel(config.glbPath);
                        loadedCount++;
                        setPreloadProgress((loadedCount / totalAssets) * 100);
                        console.log(`モデルプリロード完了: ${config.name} (${loadedCount}/${totalAssets})`);
                    } catch (error) {
                        console.error(`モデルプリロード失敗: ${config.name}`, error);
                        loadedCount++; // エラーでもカウントを進める
                        setPreloadProgress((loadedCount / totalAssets) * 100);
                    }
                }),
                // サンプル画像のプリロード
                new Promise(async (resolve) => {
                    try {
                        const img1 = new Image();
                        img1.onload = () => {
                            loadedCount++;
                            setPreloadProgress((loadedCount / totalAssets) * 100);
                            console.log(`画像プリロード完了: sample.demo.on.png (${loadedCount}/${totalAssets})`);
                        };
                        img1.src = '/sample.demo.on.png';
                    } catch (error) {
                        console.error('sample.demo.on.png プリロード失敗:', error);
                        loadedCount++;
                        setPreloadProgress((loadedCount / totalAssets) * 100);
                    }
                    resolve();
                }),
                new Promise(async (resolve) => {
                    try {
                        const img2 = new Image();
                        img2.onload = () => {
                            loadedCount++;
                            setPreloadProgress((loadedCount / totalAssets) * 100);
                            console.log(`画像プリロード完了: sample.demo.off.png (${loadedCount}/${totalAssets})`);
                        };
                        img2.src = '/sample.demo.off.png';
                    } catch (error) {
                        console.error('sample.demo.off.png プリロード失敗:', error);
                        loadedCount++;
                        setPreloadProgress((loadedCount / totalAssets) * 100);
                    }
                    resolve();
                })
            ];

            await Promise.all(allPromises);
            
            console.log('全モデルと画像のプリロードが完了しました');
        } catch (error) {
            console.error('プリロード中にエラーが発生しました:', error);
        } finally {
            setIsPreloading(false);
        }
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
            planeMaterial.opacity = 1.0;
            planeMaterial.visible = true;
            planeMaterial.needsUpdate = true;
        });
        
        const plane = new THREE.Mesh(planeGeometry, planeMaterial);
        plane.rotation.set(0, 0, 0);
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
        // 既存のモデルをシーンから削除
        if (allModelsRef.current.length > 0) {
            allModelsRef.current.forEach(model => {
                if (model && sceneRef.current) {
                    sceneRef.current.remove(model);
                    // メモリリーク防止のためジオメトリとマテリアルも破棄
                    if (model.geometry) model.geometry.dispose();
                    if (model.material) {
                        if (Array.isArray(model.material)) {
                            model.material.forEach(mat => mat.dispose());
                        } else {
                            model.material.dispose();
                        }
                    }
                }
            });
            allModelsRef.current = [];
        }

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
                    planeMaterial.opacity = 1.0;
                    planeMaterial.visible = true;
                    planeMaterial.needsUpdate = true;
                });
                
                const plane = new THREE.Mesh(planeGeometry, planeMaterial);
                plane.rotation.set(0, 0, 0);
                model.add(plane);
                model.userData.isImage = true;
                // グループのスケールを1に戻す
                model.scale.set(1, 1, 1);
                model.userData.targetScale = 1;
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
                
                // 新しいモデルが中央に来たら視点を初期化
                targetRotationRef.current.x = 0;
                targetRotationRef.current.y = 0;
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

        if (tooltipRight && tooltipLeft && tooltipImage && tooltipTitle && tooltipDescription) {
            // 画像パスを生成（名前から対応する画像ファイルを取得）
            // 「ライトブルーヘアー」は「ライトブルーヘア」になっているので調整
            const imageName = data.name === 'ライトブルーヘアー' ? 'ライトブルーヘア' : data.name;
            const imagePath = `/neon sample on image/${imageName}　サンプルイメージ.png`;
            
            // 既存の内容をクリア
            tooltipImage.innerHTML = '';
            tooltipImage.className = 'tooltip-image';
            
            // 画像要素を作成
            const img = document.createElement('img');
            img.src = imagePath;
            img.alt = `${data.name}のサンプル`;
            img.style.cssText = `
                width: 100%;
                height: 100%;
                object-fit: cover;
                border-radius: 12px;
            `;
            
            // 画像読み込みエラー時のフォールバック
            img.onerror = () => {
                tooltipImage.textContent = data.icon || '🎨';
                tooltipImage.className = `tooltip-image ${data.theme}`;
            };
            
            tooltipImage.appendChild(img);
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

    // プロジェクトファイルダウンロード機能
    const [isDownloading, setIsDownloading] = useState(false);

    const downloadProjectFile = useCallback((modelName) => {
        if (isDownloading) return; // ダウンロード中は処理しない
        
        setIsDownloading(true);
        
        // モデル名からJSONファイル名を生成
        const fileName = `${modelName}　プロジェクトファイル.json`;
        const filePath = `/neon sample json/${fileName}`;
        
        // ファイルをダウンロード
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
                link.style.display = 'none';
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
    }, [isDownloading]);

    // ダウンロードボタンのハンドラー
    const handleDownloadProject = () => {
        console.log('ダウンロードボタンがクリックされました');
        const centerModel = getCenterModel();
        if (centerModel) {
            const modelName = centerModel.userData.paintingData.name;
            console.log('ダウンロード開始:', modelName);
            downloadProjectFile(modelName);
        }
    };

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
                // 視点を初期化（まっすぐ正面向き）
                targetRotationRef.current.x = 0;
                targetRotationRef.current.y = 0;
                
                // モバイル版でのみ、左右に揺れるアニメーションでタッチ操作をアピール
                if (isMobileDevice) {
                    let startTime = performance.now();
                    const delayStart = 200; // 0.2秒待機
                    const stepDuration = 200; // 各段階0.2秒間（さらに早く）
                    
                    const wiggleAnimation = (currentTime) => {
                        const elapsed = currentTime - startTime;
                        
                        if (elapsed < delayStart) {
                            requestAnimationFrame(wiggleAnimation);
                            return;
                        }
                        
                        const animationTime = elapsed - delayStart;
                        
                        if (wiggleAnimationRef.current === wiggleAnimation) {
                            if (animationTime < stepDuration) {
                                // 右に回転（20度 = 0.3491ラジアン）
                                const progress = animationTime / stepDuration;
                                const easeProgress = 0.5 - 0.5 * Math.cos(progress * Math.PI); // イージング
                                targetRotationRef.current.y = 0.3491 * easeProgress;
                                requestAnimationFrame(wiggleAnimation);
                            } else if (animationTime < stepDuration * 2) {
                                // 左に回転（-20度 = -0.3491ラジアン）
                                const progress = (animationTime - stepDuration) / stepDuration;
                                const easeProgress = 0.5 - 0.5 * Math.cos(progress * Math.PI); // イージング
                                targetRotationRef.current.y = 0.3491 - (0.6982 * easeProgress); // 0.3491から-0.3491へ
                                requestAnimationFrame(wiggleAnimation);
                            } else if (animationTime < stepDuration * 3) {
                                // 正面に戻る（0ラジアン）
                                const progress = (animationTime - stepDuration * 2) / stepDuration;
                                const easeProgress = 0.5 - 0.5 * Math.cos(progress * Math.PI); // イージング
                                targetRotationRef.current.y = -0.3491 + (0.3491 * easeProgress); // -0.3491から0へ
                                requestAnimationFrame(wiggleAnimation);
                            } else {
                                // アニメーション終了
                                targetRotationRef.current.y = 0;
                                wiggleAnimationRef.current = null;
                            }
                        } else {
                            // 停止された場合
                            targetRotationRef.current.y = 0;
                            wiggleAnimationRef.current = null;
                        }
                    };
                    
                    wiggleAnimationRef.current = wiggleAnimation;
                    requestAnimationFrame(wiggleAnimation);
                }
                
                isTransitioningRef.current = false;
            }
        };

        animateTransition();
    }, [hideClickPrompt, hideTooltip, updateCenterModel, adjustForSeamlessLoop, updateModelPositions]);

    const recordUserInteraction = useCallback(() => {
        lastInteractionTimeRef.current = Date.now();
        
        // 揺れアニメーション中なら停止
        if (wiggleAnimationRef.current) {
            wiggleAnimationRef.current = null;
            targetRotationRef.current.x = 0;
            targetRotationRef.current.y = 0;
        }
        
        if (autoSwitchTimerRef.current) {
            clearTimeout(autoSwitchTimerRef.current);
        }
        autoSwitchTimerRef.current = setTimeout(() => {
            if (!isTransitioningRef.current && !isTooltipShownRef.current) {
                // 自動切り替えでも視点をリセット
                targetRotationRef.current.x = 0;
                targetRotationRef.current.y = 0;
                switchToModel(1);
            }
            recordUserInteraction();
        }, 25000);
    }, [switchToModel]);

    const checkHover = useCallback((event) => {
        // モバイル版では無効化
        if (isMobileDevice) return;
        
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
    }, [getCenterModel, showClickPrompt, hideClickPrompt, isMobileDevice]);

    const animate = useCallback(() => {
        if (!isInitializedRef.current) return;

        const currentCenterModel = getCenterModel();

        allModelsRef.current.forEach(model => {
            const isImagePlane = model.userData.isImage;
            
            if (model === currentCenterModel && !isImagePlane && !isTransitioningRef.current) {
                // 中央の3Dモデルの回転アニメーション（PC・モバイル共通）
                model.rotation.y += (targetRotationRef.current.y - model.rotation.y) * 0.1;
                model.rotation.x += (targetRotationRef.current.x - model.rotation.x) * 0.1;
                model.position.y = 0;
            } else if (isImagePlane) {
                // 画像プレーンは常に正面向きに固定
                if (model.rotation.x !== 0 || model.rotation.y !== 0 || model.rotation.z !== 0) {
                    model.rotation.set(0, 0, 0);
                }
            }
            // 他のモデルは完全に静止（処理しない）
        });

        updateModelPositions();

        if (rendererRef.current && sceneRef.current && cameraRef.current) {
            rendererRef.current.render(sceneRef.current, cameraRef.current);
        }
    }, [getCenterModel, updateModelPositions, isMobileDevice]);

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
        rendererRef.current.setPixelRatio(Math.min(window.devicePixelRatio, 3));
        rendererRef.current.shadowMap.enabled = true;
        rendererRef.current.shadowMap.type = THREE.PCFSoftShadowMap;
        containerRef.current.appendChild(rendererRef.current.domElement);

        // 初期サイズ設定
        updateRendererSize();

        // ライティング
        setupLighting();

        // 全デバイスでプリロードを実行
        preloadAllModels().then(() => {
            // モデル作成
            createModels();
            updateModelPositions();
            
            // 初期視点を正面向きに設定
            targetRotationRef.current.x = 0;
            targetRotationRef.current.y = 0;
            
            // アニメーションをAnimationManagerに登録
            animationCleanupRef.current = animationManager.addCallback(animate, 'Gallery3D');
            
            // 自動切り替えタイマー開始（初回揺れアニメーション後に実行）
            setLoading(false);
            
            // モバイル版でのみ、初回読み込み後に揺れアニメーション
            if (isMobileDevice) {
                // setLoadingを先に実行してから確実にアニメーション開始
                setTimeout(() => {
                    if (!wiggleAnimationRef.current) { // 重複実行防止
                        let startTime = performance.now();
                        const delayStart = 300; // 0.3秒待機（短縮）
                        const stepDuration = 200; // 各段階0.2秒間（さらに早く）
                
                const initialWiggleAnimation = (currentTime) => {
                    const elapsed = currentTime - startTime;
                    
                    if (elapsed < delayStart) {
                        requestAnimationFrame(initialWiggleAnimation);
                        return;
                    }
                    
                    const animationTime = elapsed - delayStart;
                    
                    if (wiggleAnimationRef.current === initialWiggleAnimation) {
                        if (animationTime < stepDuration) {
                            // 右に回転（20度 = 0.3491ラジアン）
                            const progress = animationTime / stepDuration;
                            const easeProgress = 0.5 - 0.5 * Math.cos(progress * Math.PI); // イージング
                            targetRotationRef.current.y = 0.3491 * easeProgress;
                            requestAnimationFrame(initialWiggleAnimation);
                        } else if (animationTime < stepDuration * 2) {
                            // 左に回転（-20度 = -0.3491ラジアン）
                            const progress = (animationTime - stepDuration) / stepDuration;
                            const easeProgress = 0.5 - 0.5 * Math.cos(progress * Math.PI); // イージング
                            targetRotationRef.current.y = 0.3491 - (0.6982 * easeProgress); // 0.3491から-0.3491へ
                            requestAnimationFrame(initialWiggleAnimation);
                        } else if (animationTime < stepDuration * 3) {
                            // 正面に戻る（0ラジアン）
                            const progress = (animationTime - stepDuration * 2) / stepDuration;
                            const easeProgress = 0.5 - 0.5 * Math.cos(progress * Math.PI); // イージング
                            targetRotationRef.current.y = -0.3491 + (0.3491 * easeProgress); // -0.3491から0へ
                            requestAnimationFrame(initialWiggleAnimation);
                        } else {
                            // アニメーション終了、自動切り替えタイマーを開始
                            targetRotationRef.current.y = 0;
                            wiggleAnimationRef.current = null;
                            recordUserInteraction(); // ここでタイマー開始
                        }
                    } else {
                        // 停止された場合
                        targetRotationRef.current.y = 0;
                        wiggleAnimationRef.current = null;
                    }
                };
                
                        wiggleAnimationRef.current = initialWiggleAnimation;
                        requestAnimationFrame(initialWiggleAnimation);
                    }
                }, 500); // 0.5秒後に実行（確実にローディング完了後）
            }
        });

        // イベントリスナー
        const handleMouseMove = (event) => {
            if (!isInitializedRef.current || isMobileDevice) return;
            
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
            
            // モバイル版ではクリック詳細表示を無効化
            if (isMobileDevice) return;
            
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
                // 回転をリセット
                targetRotationRef.current.x = 0;
                targetRotationRef.current.y = 0;
                switchToModel(-1);
                hideTooltip();
                hideClickPrompt();
            }
        };

        const handleNextClick = () => {
            recordUserInteraction();
            if (!isTransitioningRef.current) {
                // 回転をリセット
                targetRotationRef.current.x = 0;
                targetRotationRef.current.y = 0;
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

        // モバイル版タッチイベント
        let touchStartX = 0;
        let touchStartY = 0;
        let isDragging = false;
        let isRotating = false;
        
        const handleTouchStart = (event) => {
            if (!isMobileDevice || !isInitializedRef.current) return;
            
            recordUserInteraction();
            const touch = event.touches[0];
            touchStartX = touch.clientX;
            touchStartY = touch.clientY;
            isDragging = false;
            isRotating = false;
        };
        
        const handleTouchMove = (event) => {
            if (!isMobileDevice || !isInitializedRef.current) return;
            
            const touch = event.touches[0];
            const deltaX = touch.clientX - touchStartX;
            const deltaY = touch.clientY - touchStartY;
            
            // ドラッグの閾値を超えた場合
            if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
                isDragging = true;
            }
            
            if (isDragging) {
                event.preventDefault(); // スクロールを防止
                
                const rect = rendererRef.current.domElement.getBoundingClientRect();
                const normalizedX = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
                const normalizedY = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
                
                // 範囲内でのタッチで回転を適用（感度アップ）
                if (Math.abs(normalizedX) <= 1.0 && Math.abs(normalizedY) <= 1.0) {
                    targetRotationRef.current.y = normalizedX * 1.2;
                    targetRotationRef.current.x = -normalizedY * 1.2;
                    isRotating = true;
                }
            }
        };
        
        const handleTouchEnd = (event) => {
            if (!isMobileDevice || !isInitializedRef.current) return;
            
            // 回転していた場合は滑らかに中央に戻す
            if (isRotating) {
                const startRotationY = targetRotationRef.current.y;
                const startRotationX = targetRotationRef.current.x;
                const startTime = performance.now();
                const returnDuration = 600; // 戻るアニメーション時間
                
                const returnToCenter = (currentTime) => {
                    const elapsed = currentTime - startTime;
                    const progress = Math.min(elapsed / returnDuration, 1);
                    
                    // イージングアウト効果
                    const easeProgress = 1 - Math.pow(1 - progress, 3);
                    
                    targetRotationRef.current.y = startRotationY * (1 - easeProgress);
                    targetRotationRef.current.x = startRotationX * (1 - easeProgress);
                    
                    if (progress < 1) {
                        requestAnimationFrame(returnToCenter);
                    } else {
                        targetRotationRef.current.x = 0;
                        targetRotationRef.current.y = 0;
                    }
                };
                
                requestAnimationFrame(returnToCenter);
            }
            
            // スワイプでモデル切り替え（回転していない場合のみ）
            if (isDragging && !isRotating) {
                const touchEndX = event.changedTouches[0].clientX;
                const deltaX = touchEndX - touchStartX;
                
                if (Math.abs(deltaX) > 50) {
                    if (deltaX > 0) {
                        // 右スワイプ（前のモデル）
                        handlePrevClick();
                    } else {
                        // 左スワイプ（次のモデル）
                        handleNextClick();
                    }
                }
            }
            
            isDragging = false;
            isRotating = false;
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseleave', handleMouseLeave);
        
        const container = containerRef.current;
        if (container) {
            container.addEventListener('click', handleClick);
            
            // タッチイベントを追加
            if (isMobileDevice) {
                container.addEventListener('touchstart', handleTouchStart, { passive: false });
                container.addEventListener('touchmove', handleTouchMove, { passive: false });
                container.addEventListener('touchend', handleTouchEnd, { passive: false });
            }
        }
        


        const addButtonEvents = () => {
            const prevBtn = document.getElementById('prevBtn');
            const nextBtn = document.getElementById('nextBtn');
            
            // 既存のイベントリスナーを削除してから追加
            if (prevBtn) {
                prevBtn.removeEventListener('click', handlePrevClick);
                prevBtn.addEventListener('click', handlePrevClick);
            }
            if (nextBtn) {
                nextBtn.removeEventListener('click', handleNextClick);
                nextBtn.addEventListener('click', handleNextClick);
            }
            // ダウンロードボタンのイベントリスナー追加は削除（ReactのonClickを使用）
        };
        
        setTimeout(addButtonEvents, 100);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            isInitializedRef.current = false;
            
            // AnimationManagerからのクリーンアップ
            if (animationCleanupRef.current) {
                animationCleanupRef.current();
                animationCleanupRef.current = null;
            }
            
            // クリーンアップ
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseleave', handleMouseLeave);
            if (container) {
                container.removeEventListener('click', handleClick);
                
                // タッチイベントのクリーンアップ
                if (isMobileDevice) {
                    container.removeEventListener('touchstart', handleTouchStart);
                    container.removeEventListener('touchmove', handleTouchMove);
                    container.removeEventListener('touchend', handleTouchEnd);
                }
            }
            const prevBtn = document.getElementById('prevBtn');
            const nextBtn = document.getElementById('nextBtn');
            if (prevBtn) prevBtn.removeEventListener('click', handlePrevClick);
            if (nextBtn) nextBtn.removeEventListener('click', handleNextClick);
            // ダウンロードボタンのクリーンアップは不要（ReactのonClickを使用）
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
            {loading && (
                <div className="loading" id="loading">
                    {isPreloading ? (
                        <>
                            ネオンサインモデルを読み込み中...<br/>
                            <div style={{fontSize: '14px', marginTop: '10px'}}>
                                進行状況: {Math.round(preloadProgress)}%
                            </div>
                        </>
                    ) : (
                        'ギャラリーを読み込み中...'
                    )}
                </div>
            )}
            <div className="navigation nav-left" id="prevBtn">‹</div>
            <div className="navigation nav-right" id="nextBtn">›</div>

            <div className="click-prompt" id="clickPrompt">クリックで詳細</div>

            <div className="hover-tooltip-right" id="hoverTooltipRight">
                <div className="tooltip-image" id="tooltipImage"></div>
            </div>

            <div className="hover-tooltip-left" id="hoverTooltipLeft">
                <div className="tooltip-title" id="tooltipTitle"></div>
                <div className="tooltip-description" id="tooltipDescription"></div>
                <button 
                    className="download-project-btn" 
                    id="downloadProjectBtn"
                    onClick={handleDownloadProject}
                >
                    プロジェクトファイルをダウンロード
                </button>
            </div>
        </div>
    );
};

export default Gallery3D;