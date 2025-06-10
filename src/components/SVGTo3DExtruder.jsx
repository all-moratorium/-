// SVGTo3DExtruder.js - マーカー非表示 + 進行状況表示版
import React, { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom'; 
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import './SVGTo3DExtruder.css';

// SVGパスから点を取得するヘルパー関数（直線強化バージョン）
function getPointsFromCurve(curve, pointsCount = 10) {
  if (!curve.getPoints) return [];
  
  // 直線の検出をより厳密に
  const isLine = curve.type === 'LineCurve' || curve.type === 'LineCurve3';
  
  // 近似直線の検出（始点と終点がほぼ一直線上にある場合）
  if (!isLine && curve.v1 && curve.v2) {
    const dx = curve.v2.x - curve.v1.x;
    const dy = curve.v2.y - curve.v1.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    // 中間点をサンプリングして直線かどうか確認
    if (dist > 0.1) {
      const midPoints = curve.getPoints(3); // 少数点でチェック
      if (midPoints.length >= 3) {
        const mid = midPoints[1];
        // 中間点が始点と終点を結ぶ直線上にあるかチェック
        const t = ((mid.x - curve.v1.x) * dx + (mid.y - curve.v1.y) * dy) / (dist * dist);
        const projX = curve.v1.x + t * dx;
        const projY = curve.v1.y + t * dy;
        const deviation = Math.sqrt((mid.x - projX) * (mid.x - projX) + (mid.y - projY) * (mid.y - projY));
        
        // 偏差が小さければ直線として扱う（閾値を小さくして直線検出を強化）
        if (deviation < 0.01 * dist) {
          return [curve.v1, curve.v2]; // 直線として扱う
        }
      }
    }
  }
  
  // 厳密な直線の場合は始点と終点のみを返す
  return isLine ? [curve.v1, curve.v2] : curve.getPoints(pointsCount);
}

// 形状の面積を計算するヘルパー関数
function calculateShapeArea(shape) {
  if (!shape || !shape.curves || shape.curves.length === 0) return 0;

  let area = 0;
  const points = [];

  shape.curves.forEach(curve => {
    // 改良された点取得関数を使用
    const curvePoints = getPointsFromCurve(curve, 5);
    if (points.length === 0) {
      points.push(...curvePoints);
    } else {
      points.push(...curvePoints.slice(1)); // 最初の点は重複するので除外
    }
  });

  if (points.length < 3) return 0;

  // 多角形の面積計算（シューレースの公式）
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    sum += (current.x * next.y - next.x * current.y);
  }

  area = Math.abs(sum) / 2;
  return area;
}

// マーカーかどうかを判定するヘルパー関数
function isMarkerPath(path, svgViewBoxWidth, svgViewBoxHeight) {
  // パスの色情報を取得
  const pathColor = path.color;
  const pathStyle = path.userData?.style || {};
  
  // 1. マーカー色の判定（印刷業界でよく使われる色）
  const markerColors = [
    '#FF00FF', '#ff00ff', // マゼンタ
    '#00FFFF', '#00ffff', // シアン  
    '#FF0000', '#ff0000', // 赤
    '#000000', '#000'     // 黒（小さい要素の場合）
  ];
  
  // 色による判定
  if (pathColor) {
    const colorHex = `#${pathColor.getHexString()}`;
    if (markerColors.includes(colorHex.toUpperCase())) {
      // 色がマーカー色の場合、サイズも確認
      const shapes = SVGLoader.createShapes(path);
      if (shapes && shapes.length > 0) {
        const totalArea = shapes.reduce((sum, shape) => sum + calculateShapeArea(shape), 0);
        const viewBoxArea = svgViewBoxWidth * svgViewBoxHeight;
        const areaRatio = totalArea / viewBoxArea;
        
        // 全体の面積の1%以下の小さな要素はマーカーとみなす
        if (areaRatio < 0.01) {
          return true;
        }
      }
    }
  }
  
  // 2. パスの名前やクラスによる判定
  const pathName = path.userData?.node?.getAttribute?.('id') || 
                   path.userData?.node?.getAttribute?.('class') || '';
  const markerKeywords = ['marker', 'registration', 'align', 'crop', 'corner', 'guide'];
  
  if (pathName && markerKeywords.some(keyword => 
    pathName.toLowerCase().includes(keyword))) {
    return true;
  }
  
  // 3. 位置による判定（四隅に配置された小さな要素）
  const shapes = SVGLoader.createShapes(path);
  if (shapes && shapes.length > 0) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    shapes.forEach(shape => {
      shape.curves.forEach(curve => {
        const points = getPointsFromCurve(curve, 5);
        points.forEach(point => {
          minX = Math.min(minX, point.x);
          minY = Math.min(minY, point.y);
          maxX = Math.max(maxX, point.x);
          maxY = Math.max(maxY, point.y);
        });
      });
    });
    
    const elementWidth = maxX - minX;
    const elementHeight = maxY - minY;
    const elementArea = elementWidth * elementHeight;
    const viewBoxArea = svgViewBoxWidth * svgViewBoxHeight;
    
    // 小さな要素で、かつ四隅付近に配置されているかチェック
    if (elementArea / viewBoxArea < 0.005) { // 全体の0.5%以下
      const margin = Math.min(svgViewBoxWidth, svgViewBoxHeight) * 0.1; // 10%のマージン
      
      const isNearCorner = 
        // 左上角
        (minX < margin && minY < margin) ||
        // 右上角
        (maxX > svgViewBoxWidth - margin && minY < margin) ||
        // 左下角
        (minX < margin && maxY > svgViewBoxHeight - margin) ||
        // 右下角
        (maxX > svgViewBoxWidth - margin && maxY > svgViewBoxHeight - margin);
      
      if (isNearCorner) {
        return true;
      }
    }
  }
  
  return false;
}

const SVGTo3DExtruder = forwardRef(({ 
  svgLayersData = [], 
  originalImageAspectRatio, 
  onNavigateToInfo, 
  hideNavigationButton = false, 
  onDimensionsUpdate 
}, ref) => {
  // サイドバーの表示/非表示を管理するステート
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const mountRef = useRef(null);
  const fileInputRefs = useRef([]);
  const [svgFiles, setSvgFiles] = useState([]);
  const [layerThickness, setLayerThickness] = useState(2); // 初期値を2mmに変更
  const [modelWidth, setModelWidth] = useState(150); // 初期値を150mmに変更
  const [showGrid, setShowGrid] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);
  const [error, setError] = useState(null);
  const [layerCount, setLayerCount] = useState(0); // 初期値を0に変更
  const [layerColors, setLayerColors] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false); // モーダル表示状態
  const [isEffectStopped, setIsEffectStopped] = useState(false); // エフェクト停止状態
  const [processingProgress, setProcessingProgress] = useState(0); // 処理進行状況
  const [isProcessing, setIsProcessing] = useState(false); // 処理中フラグ
  
  // カメラ状態保持用
  const [savedCameraState, setSavedCameraState] = useState(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const meshGroupRef = useRef(null);
  const wallPlaneRef = useRef(null);
  const wallGridHelperRef = useRef(null);
  const svgContentsRef = useRef(Array(10).fill(null)); // 10層分の配列を初期化
  const loadedRoomModelRef = useRef(null);
  
  // レンダリング要求管理用のref
  const needsRenderRef = useRef(false);
  const renderTimeoutRef = useRef(null);
  // 🔥 コンポーネントのマウント状態を追跡
  const isMountedRef = useRef(false);

  const DEFAULT_LAYER_COLORS = [
    0x4287f5, 0xf54242, 0x42f54e, 0xf5d142, 0xf542f2, 0x42f5d1, 0xa142f5,
    0xff8c00, 0x00ced1, 0x8a2be2
  ];

  // 🔥 完全なリソースクリーンアップ関数
  const disposeResources = useCallback(() => {
    console.log('🧹 リソースクリーンアップ開始');
    
    // レンダリングループを停止
    if (renderTimeoutRef.current) {
      if (typeof renderTimeoutRef.current === 'number') {
        clearTimeout(renderTimeoutRef.current);
      } else {
        cancelAnimationFrame(renderTimeoutRef.current);
      }
      renderTimeoutRef.current = null;
    }
    needsRenderRef.current = false;

    // OrbitControlsのクリーンアップ
    if (controlsRef.current) {
      controlsRef.current.removeEventListener('change', requestRender);
      controlsRef.current.dispose();
      controlsRef.current = null;
    }

    // Room modelのクリーンアップ
    if (loadedRoomModelRef.current && sceneRef.current) {
      sceneRef.current.remove(loadedRoomModelRef.current);
      loadedRoomModelRef.current.traverse(object => {
        if (object.isMesh) {
          if (object.geometry) {
            object.geometry.dispose();
          }
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach(material => {
                if (material.map) material.map.dispose();
                material.dispose();
              });
            } else {
              if (object.material.map) object.material.map.dispose();
              object.material.dispose();
            }
          }
        }
      });
      loadedRoomModelRef.current = null;
    }

    // メッシュグループのクリーンアップ
    if (meshGroupRef.current) {
      while (meshGroupRef.current.children.length > 0) {
        const layerGroup = meshGroupRef.current.children[0];
        meshGroupRef.current.remove(layerGroup);
        layerGroup.traverse(object => {
          if (object.isMesh) {
            if (object.geometry) {
              object.geometry.dispose();
            }
            if (object.material) {
              if (Array.isArray(object.material)) {
                object.material.forEach(material => {
                  if (material.map) material.map.dispose();
                  material.dispose();
                });
              } else {
                if (object.material.map) object.material.map.dispose();
                object.material.dispose();
              }
            }
          }
        });
      }
      meshGroupRef.current = null;
    }

    // シーン全体のクリーンアップ
    if (sceneRef.current) {
      sceneRef.current.traverse(object => {
        if (object.isMesh) {
          if (object.geometry) {
            object.geometry.dispose();
          }
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach(material => {
                if (material.map) material.map.dispose();
                material.dispose();
              });
            } else {
              if (object.material.map) object.material.map.dispose();
              object.material.dispose();
            }
          }
        }
      });
      
      // シーンからすべてのオブジェクトを削除
      while(sceneRef.current.children.length > 0) {
        sceneRef.current.remove(sceneRef.current.children[0]);
      }
      sceneRef.current = null;
    }

    // レンダラーのクリーンアップ
    if (rendererRef.current) {
      // レンダラーのDOMElementを削除
      if (rendererRef.current.domElement && rendererRef.current.domElement.parentNode) {
        rendererRef.current.domElement.parentNode.removeChild(rendererRef.current.domElement);
      }
      
      // WebGLコンテキストを強制的に失わせる
      const gl = rendererRef.current.getContext();
      if (gl) {
        const extension = gl.getExtension('WEBGL_lose_context');
        if (extension) {
          extension.loseContext();
        }
      }
      
      rendererRef.current.dispose();
      rendererRef.current = null;
    }

    // カメラの参照をクリア
    cameraRef.current = null;
    wallPlaneRef.current = null;
    wallGridHelperRef.current = null;

    console.log('🧹 リソースクリーンアップ完了');
  }, []);

  // レンダリングを要求する関数（マウント状態をチェック）
  const requestRender = useCallback(() => {
    if (!isMountedRef.current || !needsRenderRef.current) {
      needsRenderRef.current = true;
      
      // 既存のタイムアウトをクリア
      if (renderTimeoutRef.current) {
        if (typeof renderTimeoutRef.current === 'number') {
          clearTimeout(renderTimeoutRef.current);
        } else {
          cancelAnimationFrame(renderTimeoutRef.current);
        }
      }
      
      // 次のフレームでレンダリング実行
      renderTimeoutRef.current = requestAnimationFrame(() => {
        if (isMountedRef.current && needsRenderRef.current && rendererRef.current && sceneRef.current && cameraRef.current) {
          try {
            rendererRef.current.render(sceneRef.current, cameraRef.current);
          } catch (error) {
            console.error('レンダリングエラー:', error);
          }
          needsRenderRef.current = false;
        }
        renderTimeoutRef.current = null;
      });
    }
  }, []);

  const hexToColorString = useCallback((hexColor) => {
    if (typeof hexColor !== 'number') return '#000000';
    return '#' + hexColor.toString(16).padStart(6, '0');
  }, []);

  const colorStringToHex = useCallback((colorString) => {
    return parseInt(colorString.replace('#', ''), 16);
  }, []);

  useEffect(() => {
    setLayerColors(prevColors => {
      const newColors = [...prevColors];
      if (newColors.length < layerCount) {
        // 配列を拡張。新しい要素はundefinedになり、processAllSVGsのフォールバックが使われる
        newColors.length = layerCount;
      } else if (newColors.length > layerCount) {
        // 配列を縮小
        newColors.length = layerCount;
      }
      return newColors;
    });

    // svgContentsRef と svgFiles ステートを新しいlayerCountに合わせてリサイズ
    const newSvgContents = Array(layerCount).fill(null);
    svgContentsRef.current.forEach((content, i) => {
      if (i < layerCount) newSvgContents[i] = content;
    });
    svgContentsRef.current = newSvgContents;

    setSvgFiles(prevSvgFiles => {
      const newFiles = [...prevSvgFiles];
      if (newFiles.length < layerCount) {
        newFiles.length = layerCount; // 拡張、新しい要素は undefined
        for (let i = prevSvgFiles.length; i < layerCount; i++) {
          newFiles[i] = null; // またはUIで必要な場合はデフォルトのプレースホルダ
        }
      } else if (newFiles.length > layerCount) {
        newFiles.length = layerCount;
      }
      return newFiles;
    });
    
    // UIが削除されたため、fileInputRefs は厳密には不要かもしれないが、
    // handleFileChange が残っている場合は整合性のために保持
    fileInputRefs.current = Array(layerCount).fill(null).map((_, i) => fileInputRefs.current[i] || React.createRef());

    // processAllSVGs の呼び出しはここでは行わない
  }, [layerCount]);

  useEffect(() => {
    if (typeof onDimensionsUpdate === 'function' && 
        originalImageAspectRatio && 
        typeof modelWidth === 'number' && 
        typeof layerThickness === 'number' && 
        typeof layerCount === 'number' &&
        layerCount > 0 &&
        modelWidth > 0 &&
        originalImageAspectRatio > 0) {
          
      const calculatedHeight = modelWidth / originalImageAspectRatio;
      const calculatedThickness = layerCount * layerThickness;
      
      onDimensionsUpdate(modelWidth, calculatedHeight, calculatedThickness);
    } else if (typeof onDimensionsUpdate === 'function') {
      // If conditions aren't met (e.g., no layers, no image), send zero/default values
      onDimensionsUpdate(modelWidth > 0 ? modelWidth : 0, 0, 0);
    }
  }, [modelWidth, originalImageAspectRatio, layerCount, layerThickness, onDimensionsUpdate]);

  // 🔥 メインのThree.js初期化Effect（マウント状態管理を追加）
  useEffect(() => {
    if (!mountRef.current) return;
    
    isMountedRef.current = true;
    console.log('🚀 Three.js 初期化開始');
    
    // 既存のDOMElementをクリア
    while (mountRef.current.firstChild) {
      mountRef.current.removeChild(mountRef.current.firstChild);
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x242424);
    sceneRef.current = scene;

    // 全体的な明るさを底上げするためにHemisphereLightを追加
    const hemisphereLight = new THREE.HemisphereLight(
      0xffffff, // 空の色 (白)
      0x888888, // 地面の色 (少し明るいグレー)
      1.0       // 光の強さ (1.0から試してみましょう)
    );
    scene.add(hemisphereLight);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      logarithmicDepthBuffer: true,
      powerPreference: "high-performance"
    });
    // 🎨 ピクセル比を最大2.0まで上げる（4K対応）
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.setClearColor(0x242424); // 背景色を固定 (36,36,36)
    renderer.shadowMap.enabled = false; 
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const camera = new THREE.PerspectiveCamera(50, mountRef.current.clientWidth / mountRef.current.clientHeight, 0.1, 20000);
    // 🔥 保存された状態があれば復元、なければデフォルト
    if (savedCameraState) {
      camera.position.copy(savedCameraState.position);
      if (savedCameraState.target && controlsRef.current) {
        controlsRef.current.target.copy(savedCameraState.target);
      }
    } else {
      camera.position.set(0, 0, 1500);
    }
    cameraRef.current = camera;

    const gridCellSize = 50;
    const gridCount = 60;
    const wallWidth = gridCellSize * gridCount;
    const wallHeight = gridCellSize * gridCount;
    const wallDepth = 10;

    const wallPlaneGeometry = new THREE.BoxGeometry(wallWidth, wallHeight, wallDepth);
    const wallPlaneMaterial = new THREE.MeshPhongMaterial({ color: 0xf0f0f0, shininess: 10 });
    const wallPlane = new THREE.Mesh(wallPlaneGeometry, wallPlaneMaterial);
    wallPlane.name = "wallPlane";
    wallPlane.position.set(0, 0, -(wallDepth / 2));
    scene.add(wallPlane);
    wallPlaneRef.current = wallPlane;

    const wallGridHelper = new THREE.GridHelper(Math.max(wallWidth, wallHeight), gridCount, 0x0000ff, 0x808080);
    wallGridHelper.rotation.x = Math.PI / 2;
    wallGridHelper.position.set(0, 0, 0.1);
    if (wallGridHelper.material) {
      wallGridHelper.material.opacity = 0.25;
      wallGridHelper.material.transparent = true;
    }
    scene.add(wallGridHelper);
    wallGridHelperRef.current = wallGridHelper;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0); // 注視点を少し上に設定 (z座標を100に)
    controls.maxDistance = 9000; // ズームアウトの最大距離を設定
    controls.minDistance = 20; // ズームインの最小距離を設定（物体にめり込まないように）
    
    // 視点移動を180度までに制限
    controls.minPolarAngle = 0; // 上方向の視点制限（0度）
    controls.maxPolarAngle = Math.PI; // 下方向の視点制限（180度）
    controls.minAzimuthAngle = -Math.PI / 2; // 左方向の視点制限（-90度）
    controls.maxAzimuthAngle = Math.PI / 2; // 右方向の視点制限（90度）
    
    // 物体にめり込まないように設定
    controls.enableDamping = true; // カメラの動きを滑らかに
    controls.dampingFactor = 0.12; // 滑らかさの度合い
    
    controls.update(); // 初期ターゲットと制約を適用
    controlsRef.current = controls;
    controls.enablePan = false; // パン操作を無効化
    controls.target.set(0, 0, 0); // 注視点を少し上に固定

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(wallWidth / 4, wallHeight / 4, Math.max(wallWidth, wallHeight) / 2);
    directionalLight.target = wallPlane;
    scene.add(directionalLight);
    scene.add(directionalLight.target);

    const group = new THREE.Group();
    group.name = "SVGModelLayersParent";
    scene.add(group);
    meshGroupRef.current = group;

    camera.lookAt(scene.position);

    // OrbitControlsの変更イベントでレンダリングを要求（毎フレームではなく変更時のみ）
    controls.addEventListener('change', requestRender);

    // 初期レンダリング
    requestRender();

    // 🔥 クリーンアップ関数
    return () => {
      console.log('🧹 Three.js クリーンアップ開始');
      isMountedRef.current = false;
      disposeResources();
    };
  }, [requestRender, disposeResources]);

  useEffect(() => {
    if (wallGridHelperRef.current) {
      wallGridHelperRef.current.visible = showGrid;
      requestRender(); // 状態変更時のみレンダリング
    }
  }, [showGrid, requestRender]);

  // processAllSVGsCallback（マーカー除外 + 進行状況表示機能付き）
  const processAllSVGsCallback = useCallback(async (adjustCamera = true) => {
    if (!sceneRef.current || !meshGroupRef.current || !wallPlaneRef.current || !isMountedRef.current) return;

    setIsProcessing(true);
    setProcessingProgress(0);

    // 既存のモデルをクリア
    while (meshGroupRef.current.children.length > 0) {
        const layerGroup = meshGroupRef.current.children[0];
        meshGroupRef.current.remove(layerGroup);
        layerGroup.traverse(object => {
            if (object.geometry) object.geometry.dispose();
            if (object.material) {
                (Array.isArray(object.material) ? object.material : [object.material]).forEach(mat => {
                    if (mat.map) mat.map.dispose();
                    mat.dispose();
                });
            }
        });
    }
    meshGroupRef.current.position.set(0, 0, 0);
    meshGroupRef.current.rotation.set(0, 0, 0);
    meshGroupRef.current.scale.set(1, 1, 1);

    setProcessingProgress(10);

    const validLayersData = svgContentsRef.current
        .map((content, index) => content ? { content, internalProcessingIndex: index } : null)
        .filter(Boolean);

    if (validLayersData.length === 0) {
        setPreviewReady(false);
        setIsProcessing(false);
        setProcessingProgress(0);
        requestRender();
        return;
    }

    setProcessingProgress(20);

    try {
        const wallFrontZ_scene = wallPlaneRef.current.position.z + (wallPlaneRef.current.geometry.parameters.depth / 2);
        const layerModelsInfo = [];

        setProcessingProgress(30);

        // レイヤー処理の進行状況を計算
        const totalLayers = validLayersData.length;
        let processedLayers = 0;

        for (const layerData of validLayersData) {
            const { content: svgContent, internalProcessingIndex: internalIdx } = layerData;
            
            // 各レイヤーの処理進行状況を更新（30%-80%の範囲）
            const layerProgress = 30 + (processedLayers / totalLayers) * 50;
            setProcessingProgress(Math.round(layerProgress));
            
            const loader = new SVGLoader();
            const parsedSVG = loader.parse(svgContent);
            const currentLayerModel = new THREE.Group();
            currentLayerModel.name = `LayerModel_${internalIdx}`;

            if (!parsedSVG.paths || parsedSVG.paths.length === 0 || !parsedSVG.xml) {
                console.warn(`Layer ${internalIdx} has no paths or XML data.`);
                processedLayers++;
                continue;
            }

            // SVGのviewBox属性から、全レイヤー共通の基準となる寸法を取得
            const viewBoxAttr = parsedSVG.xml.getAttribute("viewBox");
            if (!viewBoxAttr) {
                console.warn(`Layer ${internalIdx} is missing viewBox attribute.`);
                processedLayers++;
                continue;
            }

            const parts = viewBoxAttr.split(' ').map(parseFloat);
            const [svgViewBoxMinX, svgViewBoxMinY, svgViewBoxWidth, svgViewBoxHeight] = parts;

            // スケールとオフセットを「viewBox」のみを基準に計算する
            const scale = modelWidth / svgViewBoxWidth;
            
            // Y軸はSVGLoaderによって反転されるため、その後の回転を考慮してオフセットを計算
            const offsetX = -(svgViewBoxMinX + svgViewBoxWidth / 2);
            const offsetY = -(svgViewBoxMinY + svgViewBoxHeight / 2);

            // マーカーを除外してパスをフィルタリング
            const filteredPaths = parsedSVG.paths.filter(path => 
              !isMarkerPath(path, svgViewBoxWidth, svgViewBoxHeight)
            );

            console.log(`Layer ${internalIdx}: 元のパス数: ${parsedSVG.paths.length}, マーカー除外後: ${filteredPaths.length}`);

            // フィルタリングされたパスを処理してジオメトリを生成
            filteredPaths.forEach((path) => {
                const shapes = SVGLoader.createShapes(path);
                if (!shapes || shapes.length === 0) return;

                const layerColorHexVal = layerColors[internalIdx] ?? DEFAULT_LAYER_COLORS[internalIdx % DEFAULT_LAYER_COLORS.length];
                const materialColor = new THREE.Color(layerColorHexVal);
                const material = new THREE.MeshPhongMaterial({
                    color: materialColor,
                    side: THREE.DoubleSide,
                    shininess: 30,
                    specular: 0x222222,
                    emissive: materialColor,
                    emissiveIntensity: 0.2
                });

                shapes.forEach((shape) => {
                    const extrudeSettings = { depth: layerThickness, bevelEnabled: false };
                    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
                    const mesh = new THREE.Mesh(geometry, material);
                    currentLayerModel.add(mesh);
                });
            });

            if (currentLayerModel.children.length === 0) {
                processedLayers++;
                continue;
            }

            // 計算したスケールとオフセットを適用
            currentLayerModel.position.set(offsetX, offsetY, 0);
            currentLayerModel.scale.set(scale, scale, 1);
            currentLayerModel.rotation.x = Math.PI; // SVGのY軸（下向き）をThree.jsのY軸（上向き）に合わせるための回転
            
            layerModelsInfo.push({ model: currentLayerModel, internalIdx, actualThickness: layerThickness });
            processedLayers++;
        }

        setProcessingProgress(85);

        if (layerModelsInfo.length === 0) {
            setError('有効なレイヤーから3Dモデルを生成できませんでした。');
            setPreviewReady(false);
            setIsProcessing(false);
            setProcessingProgress(0);
            requestRender();
            return;
        }

        // 順番にソートしてシーンに追加
        layerModelsInfo.sort((a, b) => a.internalIdx - b.internalIdx).forEach(info => meshGroupRef.current.add(info.model));

        setProcessingProgress(90);

        // Z軸方向（厚さ方向）に各レイヤーを配置
        let accumulatedThickness = 0;
        layerModelsInfo.forEach(info => {
            info.model.position.z = accumulatedThickness + (info.actualThickness / 2);
            accumulatedThickness += info.actualThickness;
        });

        setProcessingProgress(95);

        // グループ全体の最終的な位置調整
        meshGroupRef.current.updateMatrixWorld(true);
        const groupBoundingBox = new THREE.Box3().setFromObject(meshGroupRef.current);
        const groupCenter = groupBoundingBox.getCenter(new THREE.Vector3());

        // グループ全体を原点に移動
        meshGroupRef.current.position.x -= groupCenter.x;
        meshGroupRef.current.position.y -= groupCenter.y;
        
        // 壁面に接するようにZ位置を調整
        const zDifferenceToWall = groupBoundingBox.min.z - wallFrontZ_scene;
        meshGroupRef.current.position.z -= zDifferenceToWall;

        setProcessingProgress(98);

        // カメラ調整
        if (adjustCamera && cameraRef.current && controlsRef.current) {
            meshGroupRef.current.updateMatrixWorld(true);
            const modelOverallBox = new THREE.Box3().setFromObject(meshGroupRef.current);
            const modelCenter = modelOverallBox.getCenter(new THREE.Vector3());
            const modelSize = modelOverallBox.getSize(new THREE.Vector3());

            controlsRef.current.target.copy(modelCenter);
            if (modelSize.lengthSq() > 0) {
                const maxDim = Math.max(modelSize.x, modelSize.y, modelSize.z);
                const fov = cameraRef.current.fov * (Math.PI / 180);
                let cameraDistance = Math.abs(maxDim / (2 * Math.tan(fov / 2)));
                cameraDistance *= 1.8;
                cameraRef.current.position.set(modelCenter.x, modelCenter.y, modelCenter.z + cameraDistance);
            }
            controlsRef.current.update();
        }

        setProcessingProgress(100);
        
        // 100%表示を少し保持してから完了状態に
        setTimeout(() => {
            setPreviewReady(true);
            setError(null);
            setIsProcessing(false);
            setProcessingProgress(0);
        }, 500);

    } catch (err) {
        console.error('SVG processing error:', err);
        setError(`SVGの処理中にエラー: ${err.message}`);
        setPreviewReady(false);
        setIsProcessing(false);
        setProcessingProgress(0);
    } finally {
        requestRender();
    }
  }, [layerThickness, modelWidth, layerColors, requestRender]);

  // svgLayersData (propsから渡されるデータ) が変更されたときの処理
  useEffect(() => {
    if (!isMountedRef.current) return;
    
    if (svgLayersData && svgLayersData.length > 0) {
      console.log('SVGTo3DExtruder: svgLayersData prop changed. Processing raster layers.');
      // TODO: svgLayersData を適切に processAllSVGsCallback で扱えるようにする
      processAllSVGsCallback(false); // カメラ調整をしないように変更
    } else if (svgContentsRef.current.some(content => content !== null)){
      // svgLayersDataがない場合で、かつファイルからSVGが読み込まれている場合
      processAllSVGsCallback(false); // カメラ調整をしないように変更
    } else {
      // データがない場合はシーンをクリア（または何もしない）
      if (meshGroupRef.current) {
        while (meshGroupRef.current.children.length > 0) {
          const layerGroup = meshGroupRef.current.children[0];
          meshGroupRef.current.remove(layerGroup);
          // Dispose geometries and materials if necessary
          layerGroup.traverse(child => {
            if (child.isMesh) {
              child.geometry?.dispose();
              if (Array.isArray(child.material)) {
                child.material.forEach(m => m.dispose());
              } else {
                child.material?.dispose();
              }
            }
          });
        }
      }
      requestRender(); // 状態変更時のみレンダリング
    }
  }, [svgLayersData, processAllSVGsCallback, requestRender]);

  // Room model loading effect
  useEffect(() => {
    if (!sceneRef.current || !isMountedRef.current) return;

    const scene = sceneRef.current; // Get scene from ref
    const gltfLoader = new GLTFLoader();
    const modelPath = '/models/room.black.glb';

    gltfLoader.load(
      modelPath,
      (gltf) => {
        if (!isMountedRef.current) return; // マウント状態チェック
        
        if (loadedRoomModelRef.current) {
          scene.remove(loadedRoomModelRef.current); // Use the scene variable defined above
        }

        const loadedScene = gltf.scene;

        // Remove any cameras from the loaded GLB scene
        const camerasToRemove = [];
        loadedScene.traverse((object) => {
          if (object.isCamera) {
            camerasToRemove.push(object);
          }
        });
        camerasToRemove.forEach(cam => {
          if (cam.parent) {
            cam.parent.remove(cam);
          }
        });

        loadedRoomModelRef.current = loadedScene;
        scene.add(loadedRoomModelRef.current); // Use the scene variable defined above
        const model = loadedRoomModelRef.current;

        // Rotate the model to orient the dark back wall correctly
        model.rotation.y = -Math.PI / 2; // Rotate -90 degrees (or 270 deg) around Y-axis
        model.updateMatrixWorld(true);  // Update world matrix after rotation

        // --- Restore Model Scaling Logic ---
        // 1. Get model's size after rotation for scaling purposes
        const initialModelBoxForScaling = new THREE.Box3().setFromObject(model);
        const modelSizeForScaling = new THREE.Vector3();
        initialModelBoxForScaling.getSize(modelSizeForScaling);
        console.log('Original (rotated, pre-scale) room dimensions (W, H, D):', modelSizeForScaling.x.toFixed(2), modelSizeForScaling.y.toFixed(2), modelSizeForScaling.z.toFixed(2));

        // 2. Get grid dimensions
        const currentWallPlane = wallPlaneRef.current;
        let gridWidth = currentWallPlane.geometry.parameters.width;
        let gridHeight = currentWallPlane.geometry.parameters.height;
        
        // Fallback if dimensions are not on geometry (props might be another source if available)
        if (!gridWidth) gridWidth = 1000; 
        if (!gridHeight) gridHeight = 600;

        // 3. Calculate scaleFactor
        let scaleFactor = 1;
        if (modelSizeForScaling.x > 0.001 && modelSizeForScaling.y > 0.001) {
          const scaleX = gridWidth / modelSizeForScaling.x;
          const scaleY = gridHeight / modelSizeForScaling.y;
          scaleFactor = Math.min(scaleX, scaleY) * 0.9; // Fit with 10% margin
        } else if (modelSizeForScaling.z > 0.001) { // Fallback if X or Y is very small (e.g. a flat plane)
          const arbitraryGridDepth = Math.min(gridWidth, gridHeight);
          scaleFactor = (arbitraryGridDepth / modelSizeForScaling.z) * 0.9;
        }
        // Prevent scale from being zero, negative, or NaN/Infinity
        if (scaleFactor <= 0 || !isFinite(scaleFactor)) {
          console.warn("Calculated scaleFactor is invalid, defaulting to 0.1. Model size:", modelSizeForScaling);
          scaleFactor = 0.1; 
        }
        // --- End of Restored Model Scaling Logic ---

        // --- User Defined Scale Adjustment ---
        // The 'scaleFactor' calculated above is what makes the model fit the grid (e.g., represents 270cm for the user).
        // The user wants this part to actually represent 910cm.
        const currentVisualRepresentsCm = 270.0;
        const modelPartTrueSizeCm = 910.0;
        const finalScaleFactor = scaleFactor * (modelPartTrueSizeCm / currentVisualRepresentsCm);

        model.scale.set(finalScaleFactor, finalScaleFactor, finalScaleFactor);
        model.updateMatrixWorld(true); // Apply scale and update all world matrices

        // --- For X/Y centering: Bounding box of the entire scaled and rotated model ---
        const overallScaledRotatedModelBox = new THREE.Box3().setFromObject(model);
        const overallModelCenter = new THREE.Vector3();
        overallScaledRotatedModelBox.getCenter(overallModelCenter);

        // --- Find RoomBackWall ---
        let roomBackWallObject = null;
        model.traverse((child) => {
          if (child.isMesh && child.name === 'RoomBackWall') {
            roomBackWallObject = child;
          }
        });

        const gridSurfaceZ = wallPlaneRef.current.position.z; // Typically 0

        // 3. Position model
        model.position.x = -overallModelCenter.x; // Center X based on overall model
        model.position.y = -overallModelCenter.y; // Center Y based on overall model

        if (roomBackWallObject) {
          // This box is in coordinates relative to the model's origin, after model's rotation & scaling.
          const wallWorldBox = new THREE.Box3().setFromObject(roomBackWallObject);
          
          const fineTuneZOffset = 94.925; // Fine-tuned: current offset (94.675) + 0.25 further down.
          // Align RoomBackWall's front surface to gridSurfaceZ, then push back by fineTuneZOffset.
          model.position.z = gridSurfaceZ - wallWorldBox.min.z - fineTuneZOffset;
          // console.log(`Positioned using RoomBackWall. Model Z: ${model.position.z.toFixed(2)}, Wall front in model space: ${wallWorldBox.min.z.toFixed(2)}, Offset: ${fineTuneZOffset}`);
        } else {
          console.warn('RoomBackWall object not found. Using overall model for Z positioning. Check name in Blender.');
          // Fallback: Use rearmost Z of the entire model relative to its origin.
          const overallModelMinZ = overallScaledRotatedModelBox.min.z; 
          model.position.z = gridSurfaceZ - overallModelMinZ; // No arbitrary offset for now.
        }

        // Hide the original preview wall if the room model is loaded
        if (wallPlaneRef.current) {
          wallPlaneRef.current.visible = false;
        }

        requestRender(); // 状態変更時のみレンダリング
      },
      undefined, // onProgress
      (error) => {
        console.error('Error loading room.black.glb:', error);
        setError('room.black.glb の読み込みに失敗しました: ' + modelPath + ' エラー: ' + error.message); 
      }
    );

    return () => {
      // Room model specific cleanup is handled in disposeResources
    };
  }, [sceneRef, rendererRef, cameraRef, wallPlaneRef, requestRender]);

  // 毎フレームのアニメーションループを削除し、必要な時だけ更新するようにする
  useEffect(() => {
    // コントロールの初期設定のみ行い、毎フレームループは削除
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }

    // クリーンアップ関数でタイムアウトをクリア
    return () => {
      if (renderTimeoutRef.current) {
        if (typeof renderTimeoutRef.current === 'number') {
          clearTimeout(renderTimeoutRef.current);
        } else {
          cancelAnimationFrame(renderTimeoutRef.current);
        }
        renderTimeoutRef.current = null;
      }
    };
  }, []);

  const handleFileChange = (event, internalArrayIndex) => {
    const file = event.target.files[0];
    if (!file || !file.type.includes('svg')) {
      setError(file ? 'SVGファイルを選択してください。' : null);
      if (event.target) event.target.value = null;
      // ファイル選択がキャンセルされたり不適切なファイルだった場合でも再描画してエラー表示を更新
      requestRender();
      return;
    }
    setSvgFiles(prev => { const newFiles = [...prev]; newFiles[internalArrayIndex] = file; return newFiles; });
    setPreviewReady(false);
    const reader = new FileReader();
    reader.onload = (e) => {
      svgContentsRef.current[internalArrayIndex] = e.target.result;
      processAllSVGsCallback(false); // カメラ調整をしないように変更
    };
    reader.onerror = () => { 
      setError('ファイルの読み込みに失敗しました。'); 
      if (event.target) event.target.value = null; 
      requestRender();
    };
    reader.readAsText(file);
  };

  const handleLayerColorChange = (internalArrayIndex, colorString) => {
    setLayerColors(prev => {
      const newColors = [...prev];
      newColors[internalArrayIndex] = colorStringToHex(colorString);
      return newColors;
    });
    // 即座更新を削除 - ボタン押下時のみ更新
  };

  const handleParameterChange = (setterFunction, value) => {
    setterFunction(value);
    // processAllSVGs is no longer called directly here.
    // The useEffect listening to layerThickness/modelWidth will handle it.
  };

  useEffect(() => {
    const handleResize = () => {
      if (cameraRef.current && rendererRef.current && mountRef.current?.clientWidth > 0 && mountRef.current?.clientHeight > 0) {
        const { clientWidth, clientHeight } = mountRef.current;
        cameraRef.current.aspect = clientWidth / clientHeight;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(clientWidth, clientHeight);
        requestRender(); // リサイズ時のみレンダリング
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [requestRender]);

  // Calculate dimensions for display
  let finalDisplayWidth = "N/A";
  // Display width only if modelWidth is positive AND layers exist
  if (modelWidth > 0 && layerCount > 0) {
    finalDisplayWidth = `${modelWidth.toFixed(1)} mm`;
  }

  let finalDisplayHeight = "N/A";
  // Display height only if aspect ratio is valid, modelWidth is positive, AND layers exist
  if (originalImageAspectRatio && originalImageAspectRatio > 0 && modelWidth > 0 && layerCount > 0) {
    let calculatedHeight = modelWidth / originalImageAspectRatio;
    if (calculatedHeight > 750) {
      calculatedHeight = 750; // Cap height at 750mm
    }
    finalDisplayHeight = `${calculatedHeight.toFixed(1)} mm`;
  }

  let finalDisplayThickness = "N/A";
  // Display thickness only if layers exist and layerThickness is positive
  if (layerCount > 0 && layerThickness > 0) {
    const totalThickness = layerThickness * layerCount;
    finalDisplayThickness = `${totalThickness.toFixed(1)} mm`;
  }

  // 外部から呼び出せるメソッドを公開
  useImperativeHandle(ref, () => ({
    // カメラ状態を保存
    saveCameraState: () => {
      if (cameraRef.current && controlsRef.current) {
        setSavedCameraState({
          position: cameraRef.current.position.clone(),
          target: controlsRef.current.target.clone()
        });
        return true;
      }
      return false;
    },

    // カメラ状態を復元
    restoreCameraState: () => {
      if (savedCameraState && cameraRef.current && controlsRef.current) {
        cameraRef.current.position.copy(savedCameraState.position);
        controlsRef.current.target.copy(savedCameraState.target);
        controlsRef.current.update();
        requestRender();
        return true;
      }
      return false;
    },
    // SVGデータを直接設定するメソッド
    setLayerSvgContent: (svgContent, layerIndex, fileName = null) => {
      if (layerIndex < 0 || layerIndex >= layerCount) {
        console.error(`Invalid layer index: ${layerIndex}. Valid range is 0-${layerCount - 1}`);
        return false;
      }

      // SVGコンテンツを設定
      svgContentsRef.current[layerIndex] = svgContent;
      
      // ファイル情報を更新
      setSvgFiles(prev => {
        const newFiles = [...prev];
        newFiles[layerIndex] = {
          name: fileName || `Layer ${layerIndex + 1} (auto-generated)`,
          isPlaceholder: true
        };
        return newFiles;
      });

      // 3Dモデルを更新（カメラ位置も調整）
      // processAllSVGs の呼び出しはここでは行わない
      return true;
    },
    
    // レイヤーの色を設定するメソッド
    setLayerColor: (colorHex, layerIndex) => {
      if (layerIndex < 0 || layerIndex >= layerCount) {
        console.error(`Invalid layer index: ${layerIndex}. Valid range is 0-${layerCount - 1}`);
        return false;
      }
      
      // 色を設定
      setLayerColors(prev => {
        const newColors = [...prev];
        newColors[layerIndex] = colorStringToHex(colorHex);
        return newColors;
      });
      
      // SVGが存在する場合は3Dモデルを更新（カメラ位置は調整しない）
      // processAllSVGs の呼び出しはここでは行わない
      return true;
    },
    
    // レイヤー数を設定するメソッド
    setLayerCount: (count) => {
      if (count < 1 || count > 10) {
        console.error(`Invalid layer count: ${count}. Valid range is 1-10`);
        return false;
      }
      
      // svgContentsRefも更新する
      if (svgContentsRef.current.length < count) {
        svgContentsRef.current = [...svgContentsRef.current, ...Array(count - svgContentsRef.current.length).fill(null)];
      }
      
      // handleParameterChange を使わず直接ステートを更新
      setLayerCount(count); 
      console.log(`レイヤー数を${count}に設定しました。svgContentsRefの長さ:`, svgContentsRef.current.length);
      return true;
    },
    triggerModelUpdate: () => {
      if (typeof processAllSVGsCallback === 'function' && sceneRef.current && isMountedRef.current) {
        processAllSVGsCallback(true); // this will trigger render in its finally block
      }
    },
    // 🔥 リソースを強制的にクリーンアップするメソッド
    forceCleanup: () => {
      console.log('🧹 強制クリーンアップ実行');
      disposeResources();
    }
    // useImperativeHandle の依存配列には、これらのメソッドが使用する値や関数を含める
    // processAllSVGs, layerCount (ステート値), colorStringToHex など
  }), [processAllSVGsCallback, layerCount, colorStringToHex, setLayerCount, savedCameraState, requestRender, disposeResources]); // Use memoized callback

  const handleOpenModal = () => {
    setIsModalOpen(true);
    // setIsEffectStopped(true); // モーダル表示時にエフェクトを止める必要がなくなるためコメントアウトまたは削除
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setIsEffectStopped(true); // モーダルを閉じたらエフェクトを停止し、そのままにする
  };
  
  // JSX Return - この部分は必ずコンポーネント関数内にある必要があります
  return (
    <div className="extruder-container">
      {isModalOpen && createPortal(
        <div className="modal-overlay-svg-extruder"> {/* LaserCutImageProcessor と区別するため別クラス名 */}
          <div className="modal-content-svg-extruder">
            <div className="modal-content-svg-extruder-inner">
              <h2>3Dプレビューガイド</h2>
              <div className="notice-section">
                <div className="section-title">
                  <div className="section-icon">1</div>
                  3Dモデルについて
                </div>
                <p>
                  こちらの3Dプレビューは、レイヤーごとの画像を単純に積層して生成したものです。このプロセスでは、レイヤーが黒に近い色の場合に、本来積層されるべきではない部分が塗りつぶされて積層される場合がありますが、注文の際はレイヤーごとの画像をもう一から目視で確認し、より丁寧にレイヤーの層を生成致します。四隅のマーカーは3Dプレビューでは自動的に除外されます。
                </p>
              </div>
              <div className="notice-section">
                <div className="section-title">
                  <div className="section-icon">2</div>
                  各レイヤー厚
                </div>
                <p>
                  スライダーを動かして、積層される各レイヤーの厚みを変更します。
                </p>
              </div>

              <div className="notice-section">
                <div className="section-title">
                  <div className="section-icon">3</div>
                  モデル幅
                </div>
                <p>
                  スライダーを動かして、生成される3Dモデル全体の幅を変更します。幅を変更すると、画像の縦横比を保ったまま高さも自動的に調整されます。
                </p>
              </div>
              <div className="notice-section">
                <div className="section-title">
                  <div className="section-icon">4</div>
                  加工プロセスについて
                </div>
                <p>
                  細かい調整が可能ですが、機械の精度や素材、組み立ての許容度を考慮して、再検討したのち、デザインを変更する場合がございます。生成された画像が細かすぎたり、特殊な形状や処理をお求めの方は、特注料金がかかる場合がございます。その際は逐一ご連絡させていただきますのでご安心ください。
                </p>
              </div>
              <div className="notice-section">
                <div className="section-title">
                  <div className="section-icon">5</div>
                  特注対応について
                </div>
                <p>
                  より大きなサイズでの製作や、現行の解像度ではご期待に沿えない場合は、お気軽にお問い合わせください。ご要望に合わせ、最適な仕様とお見積りをご提案いたします。
                </p>
              </div>

              <button 
                onClick={handleCloseModal} 
                className="modal-confirm-button-svg-extruder"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {!hideNavigationButton && (
        <>
          <div className={`extruder-sidebar ${sidebarVisible ? '' : 'collapsed'}`}>
            <button
              onClick={handleOpenModal}
              className={`info-button3 modal-trigger-button ${isEffectStopped ? 'stopped' : ''}`}
            >
            </button>
            <button 
              className="sidebar-toggle-button"
              onClick={() => setSidebarVisible(!sidebarVisible)}
              aria-label={sidebarVisible ? '閉じる' : '開く'}
            >
              {sidebarVisible ? '▲' : '▼'}
            </button>
            <div className="dimensions-display-container control-item-group">
              <div className="control-item-title">モデルの寸法</div>
              <div className="dimension-item">
                <span className="dimension-label">幅 </span>
                <span className="dimension-value">{finalDisplayWidth}</span>
              </div>
              <div className="dimension-item">
                <span className="dimension-label">高さ</span>
                <span className="dimension-value">{finalDisplayHeight}</span>
              </div>
              <div className="dimension-item">
                <span className="dimension-label">厚さ</span>
                <span className="dimension-value">{finalDisplayThickness}</span>
              </div>
              <div className="dimension-item-caption">
                ※幅、高さは最大750mmまで
              </div>
            </div>

            <div className="sliders-absolute-container">
              <div className="extruder-section extruder-slider-section">
                <div className="extruder-label">各レイヤー厚 {layerThickness.toFixed(0)}mm</div>
                <input
                  type="range" min="2" step="1" max="10" value={layerThickness}
                  onChange={(e) => handleParameterChange(setLayerThickness, parseFloat(e.target.value))}
                  className="extruder-slider"
                />
              </div>

              <div className="extruder-section extruder-slider-section">
                <div className="extruder-label">モデル幅 {modelWidth}mm</div>
                <input
                  type="range"
                  min="150"
                  max="750"
                  step="10"
                  value={modelWidth}
                  onChange={(e) => {
                    const newWidthAttempt = parseInt(e.target.value, 10); // Value from slider (150-750, step 10)

                    let effectiveMaxAllowedWidth = 750; // Default to slider's own max (750)

                    if (originalImageAspectRatio && originalImageAspectRatio > 0 && layerCount > 0) {
                      // Calculate the width that would make the height exactly 750mm
                      const widthToReach750Height = Math.floor(750 * originalImageAspectRatio);
                      
                      // This calculated width must be at least the slider's minimum (150)
                      const practicalWidthFor750Height = Math.max(150, widthToReach750Height);
                      
                      // The effective maximum width is the lesser of the slider's max (750)
                      // and this practical width for 750mm height.
                      effectiveMaxAllowedWidth = Math.min(750, practicalWidthFor750Height);
                    }

                    // The value from the slider (newWidthAttempt) should not exceed this effectiveMaxAllowedWidth.
                    // newWidthAttempt is already >= 150 (slider's min) due to slider properties.
                    const actualNewWidth = Math.min(newWidthAttempt, effectiveMaxAllowedWidth);
                    
                    setModelWidth(actualNewWidth);
                  }}
                  className="extruder-slider"
                />
              </div>
            </div>

          
            {svgFiles.some(file => file) && previewReady && (<div className="extruder-success-message">プレビュー準備完了</div>)}

            {/* Proceed to Product Info Button - only shown when hideNavigationButton is false */}
            {!hideNavigationButton && (
              <div className="proceed-button-container">
                <button 
                  className="proceed-button"
                  onClick={() => {
                    if (onNavigateToInfo) {
                      onNavigateToInfo();
                    } else {
                      console.warn('onNavigateToInfo prop not provided to SVGTo3DExtruder');
                    }
                  }}
                >
                  商品情報へ進む
                </button>
              </div>
            )}
          </div>
        </>
      )}
      <div className="extruder-viewport" ref={mountRef}></div>
    </div>
  );
});

export default SVGTo3DExtruder;