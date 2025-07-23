import React, { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import * as THREE from 'three';
import Preview3DGuideModal from './Preview3DGuideModal.jsx';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import animationManager from '../utils/AnimationManager';
import './NeonSVGTo3DExtruder.css';

const NeonSVGTo3DExtruder = forwardRef(({ neonSvgData, backgroundColor = '#242424', modelData, onNavigateToInfo, isGuideEffectStopped, onGuideEffectStop }, ref) => {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const neonGroupRef = useRef(null);
  const neonMaterialsRef = useRef([]);
  const composerRef = useRef(null);
  const unrealBloomPassRef = useRef(null);
  const wallLightsRef = useRef([]);
  const rectAreaLightRef = useRef(null); // 面光源参照
  const animationIdRef = useRef(null);
  const loadedRoomModelRef = useRef(null);
  const wallPlaneRef = useRef(null);
  const backgroundColorRef = useRef(backgroundColor);
  const animationCleanupRef = useRef(null); // AnimationManager用クリーンアップ関数
  
  // マウント状態とカメラ状態保持用
  const isMountedRef = useRef(false);
  const [savedCameraState, setSavedCameraState] = useState(null);

  // State for UI controls
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);
  
  // Model data state
  const [calculatedModelData, setCalculatedModelData] = useState(null);
  
  // Calculate path length function (same as Customize component)
  const calculatePathLength = (pathObj) => {
    if (!pathObj || !pathObj.points || pathObj.points.length < 2) return 0;
    
    let totalLength = 0;
    const points = pathObj.points;
    
    for (let i = 0; i < points.length - 1; i++) {
      const dx = points[i + 1].x - points[i].x;
      const dy = points[i + 1].y - points[i].y;
      totalLength += Math.sqrt(dx * dx + dy * dy);
    }
    
    return totalLength;
  };
  const [color, setColor] = useState('#ff0088');
  const [emissiveValue, setEmissiveValue] = useState(1.0);
  const [glowValue, setGlowValue] = useState(0.50);
  const [scatterStrength, setScatterStrength] = useState(0.00);
  const [tubeSize, setTubeSize] = useState(0.04);
  const [animationSpeed, setAnimationSpeed] = useState(0.0);
  const [flickerEnabled, setFlickerEnabled] = useState(false);
  const [rotationEnabled, setRotationEnabled] = useState(false);
  const [wallLightsEnabled, setWallLightsEnabled] = useState(true);
  const [rectAreaLightEnabled, setRectAreaLightEnabled] = useState(false); // 面光源オン/オフ状態
  const [neonPowerState, setNeonPowerState] = useState(true); // ネオンパワーオン/オフ状態
  const [offTubeColor, setOffTubeColor] = useState('matching'); // OFF時のチューブカラー設定

  // Define layers for selective rendering
  const ENTIRE_SCENE_LAYER = 0;
  const BLOOM_SCENE_LAYER = 1;

  useEffect(() => {
    backgroundColorRef.current = backgroundColor;
  }, [backgroundColor]);
  
  // Listen for model data from Customize component
  useEffect(() => {
    const handleShow3DPreview = (event) => {
      const data = event.detail;
      if (data && data.paths) {
        // Calculate model data
        const strokePaths = data.paths.filter(pathObj => {
          if (!pathObj || pathObj.mode !== 'stroke') return false;
          const lengthCm = calculatePathLength(pathObj) / 25 * 10;
          return lengthCm > 0.7; // 0.7cm以下は除外
        });
        const totalLengthPx = strokePaths.reduce((total, pathObj) => total + calculatePathLength(pathObj), 0);
        const totalLengthCm = Math.round(totalLengthPx / 25 * 10) / 10; // Convert px to cm
        
        // Calculate 8mm and 6mm tube lengths and counts based on thickness
        let tubeLength8mm = 0;
        let tubeLength6mm = 0;
        let tubeCount8mm = 0;
        let tubeCount6mm = 0;
        
        strokePaths.forEach(pathObj => {
          const pathIndex = data.paths.indexOf(pathObj);
          const thickness = data.pathThickness[pathIndex] || data.strokeWidthsPx?.strokeLine || 15;
          const lengthPx = calculatePathLength(pathObj);
          const lengthCm = Math.round(lengthPx / 25 * 10) / 10;
          
          // 0.7cm以下の短いパスはスキップ
          if (lengthCm <= 0.7) return;
          
          if (thickness >= 20) {
            tubeLength8mm += lengthCm;
            tubeCount8mm += 1;
          } else {
            tubeLength6mm += lengthCm;
            tubeCount6mm += 1;
          }
        });
        
        // Calculate model size from SVG dimensions
        const modelWidth = data.svgSizeCm?.width || 0;
        const modelHeight = data.svgSizeCm?.height || 0;
        
        // Get base color from path colors (find fill paths)
        const fillPaths = data.paths.filter(pathObj => pathObj && pathObj.mode === 'fill');
        let baseColor = '透明アクリル'; // default
        
        // Check all possible fill color keys instead of relying on path index
        let fillColor = null;
        Object.keys(data.pathColors).forEach(key => {
          if (key.endsWith('_fill')) {
            const color = data.pathColors[key];
            if (color && color !== 'transparent') {
              fillColor = color;
            }
          }
        });
        
        console.log(`3D Preview Debug - found fillColor: ${fillColor}`);
        if (fillColor === 'transparent' || !fillColor) {
          baseColor = '透明アクリル';
        } else if (fillColor === '#000000') {
          baseColor = '黒色アクリル';
        } else {
          baseColor = '透明アクリル'; // fallback for other colors (white not supported)
        }
        
        // Determine type (indoor/outdoor) - default to indoor for now
        // Determine type (indoor/outdoor) based on user selection
        const modelType = data.installationEnvironment === 'outdoor' ? '屋外 - IP67防水' : '屋内 - 非防水';
        
        setCalculatedModelData({
          tubeLength8mm: tubeLength8mm * 10, // Convert to mm for display calculation
          tubeLength6mm: tubeLength6mm * 10, // Convert to mm for display calculation
          totalLength: totalLengthCm * 10, // Convert to mm for display calculation
          tubeCount8mm: tubeCount8mm,
          tubeCount6mm: tubeCount6mm,
          totalTubeCount: tubeCount8mm + tubeCount6mm,
          modelWidth: modelWidth * 10, // Convert cm to mm
          modelHeight: modelHeight * 10, // Convert cm to mm
          baseColor: baseColor,
          modelType: modelType,
          isGenerated: true // Flag to indicate model has been generated
        });
        
        // ネオンパワー状態を更新
        setNeonPowerState(data.neonPower !== undefined ? data.neonPower : true);
        // OFF時のチューブカラー設定を更新
        setOffTubeColor(data.offTubeColor || 'matching');
      }
    };
    
    window.addEventListener('show3DPreview', handleShow3DPreview);
    return () => window.removeEventListener('show3DPreview', handleShow3DPreview);
  }, [calculatePathLength]);


  // Custom Shader for Neon Tubes
  const neonVertexShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const neonFragmentShader = `
    uniform vec3 baseColor;
    uniform float emissiveIntensity;

    void main() {
      gl_FragColor = vec4(baseColor * emissiveIntensity, 1.0);
    }
  `;

  // SimpleSVGLoader class (same as original)
  class SimpleSVGLoader {
    static loadFromFile(file, callback, customScale) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const svgText = e.target.result;
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
        const elements = this.extractElements(svgDoc, customScale);
        callback(elements);
      };
      reader.readAsText(file);
    }
    
    static extractElements(svgDoc, customScale = 0.01) {
      const elements = [];
      const allSvgElements = svgDoc.querySelectorAll('path, circle, rect, line, polyline, polygon');
      const scale = customScale;

      allSvgElements.forEach(element => {
        const dataType = element.getAttribute('data-type');
        const fill = element.getAttribute('fill');
        const stroke = element.getAttribute('stroke');
        const isFilled = fill && fill !== 'none';
        
        const isPathLikeElement = ['path', 'rect', 'circle', 'polygon'].includes(element.tagName.toLowerCase());

        // data-type属性を優先的にチェック
        if (dataType === 'neon') {
          // ネオンチューブの処理
          const points = this.elementToPathPoints(element, scale);
          const strokeWidth = element.getAttribute('stroke-width');
          if (points.length > 0) {
            elements.push({
              type: 'neon',
              points: points,
              strokeWidth: strokeWidth ? parseFloat(strokeWidth) : null,
              stroke: stroke || '#ffffff'
            });
          }
        } else if (dataType === 'base') {
          // 土台の処理
          const points = this.elementToPathPoints(element, scale);
          if (points.length > 0) {
            elements.push({
              type: 'base',
              points: points,
              fill: fill
            });
          }
        } else {
          // 従来のロジック（データ型が指定されていない場合）
          // Fill要素（土台）の処理
          if (isFilled && isPathLikeElement && stroke === 'none') {
            const points = this.elementToPathPoints(element, scale);
            if (points.length > 0) {
              elements.push({
                type: 'base',
                points: points,
                fill: fill
              });
            }
          }
          // Stroke要素（ネオンチューブ）の処理 - fillがない場合のみ
          else if (stroke && stroke !== 'none' && (!isFilled || fill === 'none')) {
            const points = this.elementToPathPoints(element, scale);
            const strokeWidth = element.getAttribute('stroke-width');
            if (points.length > 0) {
              elements.push({
                type: 'neon',
                points: points,
                strokeWidth: strokeWidth ? parseFloat(strokeWidth) : null,
                stroke: stroke || '#ffffff'
              });
            }
          }
        }
      });
      
      return elements;
    }
    
    static elementToPathPoints(element, scale) {
      const points = [];
      const tagName = element.tagName.toLowerCase();
      
      switch (tagName) {
        case 'path':
          return this.parsePathDToPoints(element.getAttribute('d'), scale);
        case 'circle':
          return this.createCirclePoints(
            parseFloat(element.getAttribute('cx') || '0'),
            parseFloat(element.getAttribute('cy') || '0'),
            parseFloat(element.getAttribute('r') || '0'),
            scale
          );
        case 'rect':
          return this.createRectPoints(
            parseFloat(element.getAttribute('x') || '0'),
            parseFloat(element.getAttribute('y') || '0'),
            parseFloat(element.getAttribute('width') || '0'),
            parseFloat(element.getAttribute('height') || '0'),
            scale
          );
        case 'line':
          return [
            new THREE.Vector3(
              parseFloat(element.getAttribute('x1') || '0') * scale,
              -parseFloat(element.getAttribute('y1') || '0') * scale,
              0
            ),
            new THREE.Vector3(
              parseFloat(element.getAttribute('x2') || '0') * scale,
              -parseFloat(element.getAttribute('y2') || '0') * scale,
              0
            )
          ];
        case 'polyline':
        case 'polygon':
          const pointsString = element.getAttribute('points');
          if (!pointsString) return [];
          const coords = pointsString.split(/[\s,]+/).map(Number).filter(n => !isNaN(n));
          for (let i = 0; i < coords.length; i += 2) {
            if (i + 1 < coords.length) {
              points.push(new THREE.Vector3(coords[i] * scale, -coords[i+1] * scale, 0));
            }
          }
          if (tagName === 'polygon' && points.length > 0) {
            points.push(points[0].clone());
          }
          return points;
      }
      
      return points;
    }
    
    static parsePathDToPoints(d, scale) {
      if (!d) return [];
      
      const points = [];
      const commands = d.match(/[MmLlHhVvCcSsQqTtAaZz][^MmLlHhVvCcSsQqTtAaZz]*/g);
      let currentX = 0, currentY = 0;
      
      if (commands) {
        commands.forEach(command => {
          const type = command[0];
          const coords = command.slice(1).trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n));
          
          switch (type.toLowerCase()) {
            case 'm':
              if (coords.length >= 2) {
                if (type === 'M') {
                  currentX = coords[0];
                  currentY = coords[1];
                } else {
                  currentX += coords[0];
                  currentY += coords[1];
                }
                points.push(new THREE.Vector3(currentX * scale, -currentY * scale, 0));
              }
              break;
            case 'l':
              for (let i = 0; i < coords.length; i += 2) {
                if (i + 1 < coords.length) {
                  if (type === 'L') {
                    currentX = coords[i];
                    currentY = coords[i + 1];
                  } else {
                    currentX += coords[i];
                    currentY += coords[i + 1];
                  }
                  points.push(new THREE.Vector3(currentX * scale, -currentY * scale, 0));
                }
              }
              break;
            case 'h':
              for (let i = 0; i < coords.length; i++) {
                if (type === 'H') {
                  currentX = coords[i];
                } else {
                  currentX += coords[i];
                }
                points.push(new THREE.Vector3(currentX * scale, -currentY * scale, 0));
              }
              break;
            case 'v':
              for (let i = 0; i < coords.length; i++) {
                if (type === 'V') {
                  currentY = coords[i];
                } else {
                  currentY += coords[i];
                }
                points.push(new THREE.Vector3(currentX * scale, -currentY * scale, 0));
              }
              break;
            case 'c':
              for (let i = 0; i < coords.length; i += 6) {
                if (i + 5 < coords.length) {
                  const p3 = new THREE.Vector2(type === 'C' ? coords[i+4] : currentX + coords[i+4], type === 'C' ? coords[i+5] : currentY + coords[i+5]);
                  
                  // NeonDrawingApp方式：効率的処理 - 30ポイント展開をスキップ、終点のみ追加
                  points.push(new THREE.Vector3(p3.x * scale, -p3.y * scale, 0));
                  
                  currentX = p3.x;
                  currentY = p3.y;
                }
              }
              break;
            case 'z':
              if (points.length > 0) {
                points.push(points[0].clone());
              }
              break;
          }
        });
      }
      
      return points;
    }
    
    static createCirclePoints(cx, cy, r, scale) {
      const points = [];
      const segments = 32;
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        points.push(new THREE.Vector3(
          (cx + Math.cos(angle) * r) * scale,
          -(cy + Math.sin(angle) * r) * scale,
          0
        ));
      }
      return points;
    }
    
    static createRectPoints(x, y, width, height, scale) {
      return [
        new THREE.Vector3(x * scale, -y * scale, 0),
        new THREE.Vector3((x + width) * scale, -y * scale, 0),
        new THREE.Vector3((x + width) * scale, -(y + height) * scale, 0),
        new THREE.Vector3(x * scale, -(y + height) * scale, 0),
        new THREE.Vector3(x * scale, -y * scale, 0)
      ];
    }
  }



  // 土台作成関数
  const createBase = useCallback((points, fillColor) => {
    const shape = new THREE.Shape();
    
    if (points.length < 3) return null;
    
    // 強制的にポイント数を削減
    const maxPoints = 450;
    const simplifiedPoints = [];
    const step = Math.max(1, Math.floor(points.length / maxPoints));
    
    for (let i = 0; i < points.length; i += step) {
      simplifiedPoints.push(points[i]);
    }
    
    // 最後の点を必ず含める（形状を閉じるため）
    if (simplifiedPoints[simplifiedPoints.length - 1] !== points[points.length - 1]) {
      simplifiedPoints.push(points[points.length - 1]);
    }
    
    console.log(`土台ポイント削減: ${points.length} → ${simplifiedPoints.length}ポイント`);
    
    shape.moveTo(simplifiedPoints[0].x, simplifiedPoints[0].y);
    for (let i = 1; i < simplifiedPoints.length; i++) {
      shape.lineTo(simplifiedPoints[i].x, simplifiedPoints[i].y);
    }
    shape.closePath();
    
    const extrudeSettings = {
      depth: 7, // 7mm厚
      bevelEnabled: false
    };
    
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    
    // アクリル風マテリアル
    let material;
    if (fillColor === 'transparent' || fillColor === 'none') {
      // 透明アクリル - 反射を抑制してネオンチューブの色を保護
      material = new THREE.MeshPhongMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.02,
        shininess: 3000,
        specular: 0x888888,
        reflectivity: 0.03,
        side: THREE.DoubleSide
      });
    } else if (fillColor === 'black' || fillColor === '#000000' || fillColor === '#000') {
      // 黒いアクリル
      material = new THREE.MeshPhongMaterial({
        color: 0x111111,
        transparent: false,
        opacity: 0.8,
        shininess: 3000,
        specular: 0x333333
      });
    } else {
      // その他の色のアクリル - 適度な反射に調整
      material = new THREE.MeshPhongMaterial({
        color: fillColor || 0x888888,
        transparent: true,
        opacity: 0.7,
        shininess: 50,
        specular: 0x444444
      });
    }
    
    const baseMesh = new THREE.Mesh(geometry, material);
    baseMesh.position.z = 7; // 土台を7mm前に移動
    baseMesh.receiveShadow = false;
    baseMesh.layers.set(ENTIRE_SCENE_LAYER);
    
    // 土台にはクリッピングプレーンを適用しない（既にMeshPhongMaterialなので問題なし）
    
    return baseMesh;
  }, []);

  const createNeonTube = useCallback((points, materialIndex, svgColor, strokeWidthPx) => {
    if (points.length < 2) return;

    // 太さをピクセル単位からmm単位に変換
    let actualTubeSizeMm = tubeSize; // デフォルト値
    if (strokeWidthPx && neonSvgData && neonSvgData.gridSizePx) {
      // カスタマイズのピクセル→mm変換: gridSizePx = 4cm なので 1px = 40mm / gridSizePx
      const pixelToMm = (4 * 10) / neonSvgData.gridSizePx; // 4cm = 40mm
      actualTubeSizeMm = (strokeWidthPx * pixelToMm) / 2; // 半径なので÷2
      
      console.log(`太さ変換: ${strokeWidthPx}px → ${actualTubeSizeMm}mm (1px = ${pixelToMm}mm)`);
    }

    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.1);
    // スマホ版では解像度を大幅削減
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const radialSegments = isMobile ? 6 : 12;
    const tubularSegments = isMobile ? Math.max(20, points.length * 2) : Math.max(100, points.length * 6);
    
    const geometry = new THREE.TubeGeometry(curve, tubularSegments, actualTubeSizeMm, radialSegments, false);

    let tubeColor;
    if (svgColor && svgColor !== 'none') {
      try {
        tubeColor = new THREE.Color(svgColor);
      } catch (e) {
        console.warn('Invalid SVG color, falling back to default.', svgColor);
        const colors = ['#ff0088', '#00ff88', '#0088ff', '#ffff00', '#ff4400'];
        tubeColor = new THREE.Color(colors[materialIndex % colors.length]);
      }
    } else {
      const colors = ['#ff0088', '#00ff88', '#0088ff', '#ffff00', '#ff4400'];
      tubeColor = new THREE.Color(colors[materialIndex % colors.length]);
    }

    // クリッピングプレーン：チューブを全部切るテスト（Z=20mm以下をカット）
    const clippingPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -20);
    
    const neonMaterial = new THREE.ShaderMaterial({
      uniforms: {
        baseColor: { value: tubeColor },
        emissiveIntensity: { value: emissiveValue }
      },
      vertexShader: neonVertexShader,
      fragmentShader: neonFragmentShader,
      clippingPlanes: [clippingPlane],
      transparent: false,  // 完全に非透明
      opacity: 1.0        // 不透明度100%
    });

    const neonTube = new THREE.Mesh(geometry, neonMaterial);
    neonTube.castShadow = false;
    neonTube.layers.set(BLOOM_SCENE_LAYER); // Set layer for blooming

    const capGeometry = new THREE.SphereGeometry(actualTubeSizeMm * 1.0, 20, 20);
    
    // 各キャップに個別のマテリアルを作成
    const startCapMaterial = new THREE.ShaderMaterial({
      uniforms: {
        baseColor: { value: tubeColor.clone() },
        emissiveIntensity: { value: emissiveValue }
      },
      vertexShader: neonVertexShader,
      fragmentShader: neonFragmentShader,
      clippingPlanes: [clippingPlane],
      transparent: false,
      opacity: 1.0
    });
    
    const endCapMaterial = new THREE.ShaderMaterial({
      uniforms: {
        baseColor: { value: tubeColor.clone() },
        emissiveIntensity: { value: emissiveValue }
      },
      vertexShader: neonVertexShader,
      fragmentShader: neonFragmentShader,
      clippingPlanes: [clippingPlane],
      transparent: false,
      opacity: 1.0
    });

    const startCap = new THREE.Mesh(capGeometry, startCapMaterial);
    startCap.position.copy(points[0]);
    startCap.layers.set(BLOOM_SCENE_LAYER);

    const endCap = new THREE.Mesh(capGeometry, endCapMaterial);
    endCap.position.copy(points[points.length - 1]);
    endCap.layers.set(BLOOM_SCENE_LAYER);

    const group = new THREE.Group();
    group.add(neonTube);
    group.add(startCap);
    group.add(endCap);
    
    // チューブ全体をZ=16mmに移動（土台上面14mm + 余白2mm）
    group.position.z = 16;
    
    neonMaterialsRef.current[materialIndex] = {
      main: neonMaterial,
      caps: [
        { material: startCapMaterial },
        { material: endCapMaterial }
      ]
    };

    return group;
  }, [emissiveValue, tubeSize, neonVertexShader, neonFragmentShader, neonSvgData]);


  const loadSVGFile = useCallback((file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const svgText = e.target.result;
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
      
      // SVGのviewBox属性から寸法を取得
      const svgElement = svgDoc.querySelector('svg');
      const viewBoxAttr = svgElement ? svgElement.getAttribute('viewBox') : null;
      
      let calculatedScale = 0.01; // デフォルト値
      
      if (viewBoxAttr && neonSvgData && neonSvgData.svgSizeCm) {
        const parts = viewBoxAttr.split(' ').map(parseFloat);
        const [, , svgViewBoxWidth, svgViewBoxHeight] = parts;
        
        // カスタマイズで設定されたCMサイズを使用してスケールを計算
        // SVGTo3DExtruderと同じ方式：実際のmm / SVGのviewBox幅
        const actualWidthMm = neonSvgData.svgSizeCm.width * 10; // cmをmmに変換
        calculatedScale = actualWidthMm / svgViewBoxWidth;
        
        console.log('SVG viewBox幅:', svgViewBoxWidth, 'px');
        console.log('実際の幅:', actualWidthMm, 'mm');
        console.log('計算されたスケール:', calculatedScale);
        console.log('SVGサイズ(cm):', neonSvgData.svgSizeCm);
      } else if (neonSvgData && neonSvgData.gridSizePx) {
        // フォールバック：グリッドベースの計算
        const customizePixelToMm = 4 * 10 / neonSvgData.gridSizePx; // 4cm = 40mm, グリッドサイズで割る
        const neonUnitToMm = 5 * 10 / 50; // 5cm = 50mm, 50Three.js単位で割る
        calculatedScale = customizePixelToMm / neonUnitToMm;
        
        console.log('フォールバック計算 - カスタマイズ: 1px =', customizePixelToMm, 'mm');
        console.log('フォールバック計算 - ネオン3D: 1単位 =', neonUnitToMm, 'mm');
        console.log('フォールバック計算 - スケール:', calculatedScale);
      }
      
      // 処理開始 - 0%
      window.dispatchEvent(new CustomEvent('3DProgressUpdate', {
        detail: { progress: 0, message: '処理を開始しています...' }
      }));
      
      // SVGデータ解析開始 - 30%
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('3DProgressUpdate', {
          detail: { progress: 30, message: 'SVGパスデータを解析中...' }
        }));
        
        const elementsData = SimpleSVGLoader.extractElements(svgDoc, calculatedScale);
        
        // 3Dジオメトリ生成開始 - 60%
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('3DProgressUpdate', {
            detail: { progress: 60, message: '3Dモデルを構築中...' }
          }));
          
          // ジオメトリ生成処理を非同期化
          requestAnimationFrame(() => {
            // 元のloadFromFileのコールバック処理を実行
            if (neonGroupRef.current) {
              sceneRef.current.remove(neonGroupRef.current);
              neonGroupRef.current.children.forEach(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                  if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                  } else {
                    child.material.dispose();
                  }
                }
              });
            }
            neonMaterialsRef.current = [];

            neonGroupRef.current = new THREE.Group();
            
            elementsData.forEach((elementData, index) => {
              if (elementData.type === 'base') {
                // 土台の処理
                if (elementData.points.length > 2) {
                  // Use the correct baseColor from calculatedModelData instead of elementData.fill
                  const correctFillColor = calculatedModelData?.baseColor === '黒色アクリル' ? '#000000' : 'transparent';
                  const baseMesh = createBase(elementData.points, correctFillColor);
                  if (baseMesh) {
                    neonGroupRef.current.add(baseMesh);
                  }
                }
              } else if (elementData.type === 'neon') {
                // ネオンチューブの処理
                if (elementData.points.length > 1) {
                  const neonTubeGroup = createNeonTube(elementData.points, index, elementData.stroke, elementData.strokeWidth);
                  if (neonTubeGroup) {
                    neonGroupRef.current.add(neonTubeGroup);
                  }
                }
              }
            });
            
            sceneRef.current.add(neonGroupRef.current);
            
            const box = new THREE.Box3().setFromObject(neonGroupRef.current);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            
            neonGroupRef.current.position.sub(center);

            const maxDim = Math.max(size.x, size.y, size.z);
            const distance = maxDim * 1.8;
            cameraRef.current.position.z = distance;
            
            // デバッグ: 処理された要素数をログ出力
            console.log(`SimpleSVGLoader processed ${elementsData.length} elements:`);
            elementsData.forEach((element, index) => {
              console.log(`  Element ${index}: type=${element.type}, points=${element.points.length}, stroke=${element.stroke}, fill=${element.fill}`);
              // 最初の5つのポイントをログ出力して形状を確認
              if (element.points.length > 0) {
                const firstFewPoints = element.points.slice(0, Math.min(5, element.points.length));
                console.log(`    First points:`, firstFewPoints.map(p => `(${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)})`));
              }
            });

            // マテリアル適用 - 90%
            window.dispatchEvent(new CustomEvent('3DProgressUpdate', {
              detail: { progress: 90, message: 'ネオンマテリアルを適用中...' }
            }));
            
            updateEmissive();
            
            // レンダリング完了 - 100%
            window.dispatchEvent(new CustomEvent('3DProgressUpdate', {
              detail: { progress: 100, message: '3Dモデル生成完了' }
            }));
          });
        });
      });
      
      window.dispatchEvent(new CustomEvent('NeonRenderingCompleted'));
    };
    reader.readAsText(file);
  }, [createNeonTube, createBase, neonSvgData]);

  const updateColor = useCallback(() => {
    const colorObj = new THREE.Color(color);
    
    neonMaterialsRef.current.forEach(materialSet => {
      if (materialSet.main.uniforms && materialSet.main.uniforms.baseColor) {
        materialSet.main.uniforms.baseColor.value.copy(colorObj);
      }
      materialSet.baseColor.copy(colorObj);
      materialSet.caps.forEach(cap => {
        if (cap.material.uniforms && cap.material.uniforms.baseColor) {
          cap.material.uniforms.baseColor.value.copy(colorObj);
        }
      });
    });
  }, [color]);

  const updateEmissive = useCallback(() => {
    // グローが0以下の場合はネオンOFF、それ以上はON
    const isNeonOn = glowValue > 0;
    const actualEmissiveValue = isNeonOn ? emissiveValue : 0;
    
    neonMaterialsRef.current.forEach(materialSet => {
      if (materialSet.main.uniforms && materialSet.main.uniforms.emissiveIntensity) {
        materialSet.main.uniforms.emissiveIntensity.value = actualEmissiveValue;
        
        // OFF時かつoffTubeColorが'white'の場合は白色
        if (!isNeonOn && offTubeColor === 'white') {
          // 元の色を保存（初回のみ）
          if (!materialSet.originalColor) {
            materialSet.originalColor = materialSet.main.uniforms.baseColor.value.getHex();
          }
          materialSet.main.uniforms.baseColor.value.setHex(0xffffff);
        } else if (isNeonOn && materialSet.originalColor !== undefined) {
          // ON時に元の色を復元
          materialSet.main.uniforms.baseColor.value.setHex(materialSet.originalColor);
        }
        
        materialSet.caps.forEach(cap => {
          if (cap.material.uniforms && cap.material.uniforms.emissiveIntensity) {
            cap.material.uniforms.emissiveIntensity.value = actualEmissiveValue;
            
            // キャップの色も同様に変更
            if (!isNeonOn && offTubeColor === 'white') {
              if (!cap.originalColor) {
                cap.originalColor = cap.material.uniforms.baseColor.value.getHex();
              }
              cap.material.uniforms.baseColor.value.setHex(0xffffff);
            } else if (isNeonOn && cap.originalColor !== undefined) {
              cap.material.uniforms.baseColor.value.setHex(cap.originalColor);
            }
          }
        });
      }
    });
  }, [emissiveValue, glowValue, offTubeColor]);


  const updateGlow = useCallback(() => {
    if (unrealBloomPassRef.current) {
      unrealBloomPassRef.current.strength = glowValue;
    }
  }, [glowValue]);

  const updateScatterStrength = useCallback(() => {
    if (unrealBloomPassRef.current) {
      unrealBloomPassRef.current.threshold = scatterStrength;
    }
  }, [scatterStrength]);

  const toggleWallLights = useCallback(() => {
    setWallLightsEnabled(prev => {
      const newState = !prev;
      wallLightsRef.current.forEach(light => {
        light.visible = newState;
      });
      return newState;
    });
  }, []);

  const toggleRectAreaLight = useCallback(() => {
    setRectAreaLightEnabled(prev => {
      const newState = !prev;
      if (rectAreaLightRef.current) {
        rectAreaLightRef.current.visible = newState;
      }
      return newState;
    });
  }, []);

  const resetScene = useCallback(() => {
    if (neonGroupRef.current) {
      sceneRef.current.remove(neonGroupRef.current);
      neonGroupRef.current.children.forEach(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    }
    neonMaterialsRef.current = [];
    neonGroupRef.current = new THREE.Group();
    sceneRef.current.add(neonGroupRef.current);

    setColor('#ff0088');
    setEmissiveValue(1.0);
    setGlowValue(1.7);
    setScatterStrength(1.40);
    setTubeSize(0.04);
    setAnimationSpeed(0.0);
    setFlickerEnabled(false);
    setRotationEnabled(false);
    setWallLightsEnabled(true);

    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0);
      // 画面サイズに対してモデルが適切に収まる視点を計算
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;
      const padding = 200; // 周囲の余白
      
      // モデルのサイズを考慮した適切な距離を計算
      const modelSize = 1000; // 想定されるモデルサイズ
      const scaleX = (screenWidth - padding * 2) / modelSize;
      const scaleY = (screenHeight - padding * 2) / modelSize;
      const optimalScale = Math.min(scaleX, scaleY, 1);
      
      // 最適な視点距離を計算
      const optimalDistance = Math.max(1200, modelSize / optimalScale);
      cameraRef.current.position.set(0, 0, optimalDistance);
      controlsRef.current.update();
    }

    wallLightsRef.current.forEach(light => {
      light.visible = true;
    });
  }, []);

  // Effects for updating Three.js based on state changes
  useEffect(() => {
    updateColor();
  }, [updateColor]);

  useEffect(() => {
    updateEmissive();
  }, [updateEmissive]);

  useEffect(() => {
    updateEmissive();
  }, [updateEmissive, glowValue]);

  useEffect(() => {
    updateEmissive();
  }, [updateEmissive, offTubeColor]);

  useEffect(() => {
    updateGlow();
  }, [updateGlow, glowValue]);

  useEffect(() => {
    updateScatterStrength();
  }, [updateScatterStrength, scatterStrength]);

  // Initialize Three.js scene
  useEffect(() => {
    if (!mountRef.current) return;
    
    isMountedRef.current = true;
    console.log('Initializing Three.js scene...');
    
    // リアルタイム進捗イベント: 初期化開始
    window.dispatchEvent(new CustomEvent('3DProgressUpdate', {
      detail: { stage: '初期化開始', progress: 10, message: 'WebGL初期化中...' }
    }));
    
    // Clear any existing content
    while (mountRef.current.firstChild) {
      mountRef.current.removeChild(mountRef.current.firstChild);
    }

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x242424);
    sceneRef.current = scene;
    console.log('Scene background set to: 0x242424');
    
    // リアルタイム進捗イベント: シーン作成完了
    window.dispatchEvent(new CustomEvent('3DProgressUpdate', {
      detail: { stage: 'シーン作成', progress: 30, message: 'Three.jsシーン構築完了' }
    }));

    // RectAreaLight サポート（プリロード済みをチェック）
    // RectAreaLightUniformsLib.init(); // Costomize.jsxでプリロード済み

    // Camera setup - match SVGTo3DExtruder settings
    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 20000);
    // 保存された状態があれば復元、なければ適切な初期視点を設定
    if (savedCameraState) {
      camera.position.copy(savedCameraState.position);
    } else {
      // 画面サイズに対してモデルが適切に収まる視点を計算
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;
      const padding = 200; // 周囲の余白
      
      // モデルのサイズを考慮した適切な距離を計算
      const modelSize = 1000; // 想定されるモデルサイズ
      const scaleX = (screenWidth - padding * 2) / modelSize;
      const scaleY = (screenHeight - padding * 2) / modelSize;
      const optimalScale = Math.min(scaleX, scaleY, 1);
      
      // 最適な視点距離を計算
      const optimalDistance = Math.max(1200, modelSize / optimalScale);
      camera.position.set(0, 0, optimalDistance);
    }
    camera.layers.enable(ENTIRE_SCENE_LAYER);
    camera.layers.enable(BLOOM_SCENE_LAYER);
    cameraRef.current = camera;

    // Renderer setup - match SVGTo3DExtruder settings
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      logarithmicDepthBuffer: true,
      powerPreference: "high-performance"
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x242424);
    renderer.shadowMap.enabled = false;
    renderer.localClippingEnabled = true; // クリッピングプレーンを有効化
    rendererRef.current = renderer;
    mountRef.current.appendChild(renderer.domElement);
    
    // 実際のDOM追加完了を待って進捗更新
    requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent('3DProgressUpdate', {
        detail: { stage: 'レンダラー設定', progress: 25, message: 'WebGLレンダラー初期化完了' }
      }));
    });

    // Post-processing setup for selective bloom
    const renderPass = new RenderPass(scene, camera);

    // ブルーム効果の解像度を標準に（パフォーマンス重視）
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth * 1.0, window.innerHeight * 1.0),
      glowValue, 0, 0
    );
    unrealBloomPassRef.current = bloomPass;

    const bloomComposer = new EffectComposer(renderer);
    bloomComposer.renderToScreen = false;
    bloomComposer.addPass(renderPass);
    bloomComposer.addPass(bloomPass);

    const finalPass = new ShaderPass(
      new THREE.ShaderMaterial({
        uniforms: {
          baseTexture: { value: null },
          bloomTexture: { value: bloomComposer.renderTarget2.texture }
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform sampler2D baseTexture;
          uniform sampler2D bloomTexture;
          varying vec2 vUv;
          void main() {
            gl_FragColor = (texture2D(baseTexture, vUv) + vec4(1.0) * texture2D(bloomTexture, vUv));
          }
        `,
        defines: {}
      }), 'baseTexture'
    );
    finalPass.needsSwap = true;

    const finalComposer = new EffectComposer(renderer);
    finalComposer.addPass(renderPass);
    finalComposer.addPass(finalPass);

    composerRef.current = { bloom: bloomComposer, final: finalComposer };
    
    // エフェクト初期化完了を待って進捗更新
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('3DProgressUpdate', {
        detail: { stage: 'エフェクト設定', progress: 40, message: 'ブルームエフェクト初期化完了' }
      }));
    }, 100);
    
    // Lighting - match SVGTo3DExtruder settings (before controls)

    // Controls - match SVGTo3DExtruder settings
    const controls = new OrbitControls(camera, renderer.domElement);
    // 保存された状態があれば復元、なければデフォルト
    if (savedCameraState && savedCameraState.target) {
      controls.target.copy(savedCameraState.target);
    } else {
      controls.target.set(0, 0, 0);
    }
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
    controls.update();
    controls.enablePan = false;
    controlsRef.current = controls;

    // Wall - match SVGTo3DExtruder settings
    const gridCellSize = 50;
    const gridCount = 60;
    const wallWidth = gridCellSize * gridCount;
    const wallHeight = gridCellSize * gridCount;
    const wallDepth = 10;

    const wallPlaneGeometry = new THREE.BoxGeometry(wallWidth, wallHeight, wallDepth);
    const wallPlaneMaterial = new THREE.MeshPhongMaterial({ color: 0x000000, shininess: 0 }); // SVGTo3DExtruderと同じ色に変更
    const wallPlane = new THREE.Mesh(wallPlaneGeometry, wallPlaneMaterial);
    wallPlane.name = "wallPlane";
    wallPlane.position.set(0, 0, -21); // 壁表面をZ=0に調整
    wallPlane.receiveShadow = false;
    wallPlane.layers.set(ENTIRE_SCENE_LAYER);
    scene.add(wallPlane);
    wallPlaneRef.current = wallPlane;

    // グリッド非表示

    // 壁全体を均等に照らす環境光のみ（反射なし）
    scene.add(new THREE.AmbientLight(0xffffff, 1.2));
    
    // 半球ライトで自然な照明（反射なし）
    const hemisphereLight = new THREE.HemisphereLight(
      0xffffff, // 空の色 (白)
      0xbbbbbb, // 地面の色 (明るいグレー)
      1.2       // 光の強さ
    );
    scene.add(hemisphereLight);
    // 正面からの大きな面光源（10m×4m）
    const rectAreaLight = new THREE.RectAreaLight(0xffffff, 1.2, 1750, 1750);
    rectAreaLight.position.set(0, 0, 500); // 正面から
    rectAreaLight.lookAt(0, 0, 0); // 壁を向く
    rectAreaLight.visible = rectAreaLightEnabled; // 初期状態を設定
    scene.add(rectAreaLight);
    rectAreaLightRef.current = rectAreaLight; // refに保存

    // 部屋の中心に反射しない環境光を追加
    const centerAmbientLight = new THREE.AmbientLight(0xffffff, 0.2);
    scene.add(centerAmbientLight);

    // Wall lights - match SVGTo3DExtruder settings
    const wallLightColor = 0xffffff;
    const wallLightIntensity = 0.00005;
    const wallLightDistance = 2000;
    const wallSizeHalf = wallWidth / 2;

    const wallZPosition = -(wallDepth / 2);
    const lightPositions = [
      new THREE.Vector3(-wallSizeHalf * 3, wallSizeHalf * 3, wallZPosition - 500),
      new THREE.Vector3(-wallSizeHalf * 3, -wallSizeHalf * 3, wallZPosition - 500),
      new THREE.Vector3(wallSizeHalf * 3, -wallSizeHalf * 3, wallZPosition - 500),
    ];

    const wallLights = [];
    lightPositions.forEach(pos => {
      const light = new THREE.PointLight(wallLightColor, wallLightIntensity, wallLightDistance);
      light.position.copy(pos);
      light.layers.enable(ENTIRE_SCENE_LAYER);
      scene.add(light);
      wallLights.push(light);
    });
    wallLightsRef.current = wallLights;

    // Initialize neon group
    neonGroupRef.current = new THREE.Group();
    scene.add(neonGroupRef.current);

    // Animation loop
    const animate = () => {
      
      if (controls.enableDamping) {
        controls.update();
      }

      const baseIntensity = emissiveValue;

      // Neon flicker animation
      if (flickerEnabled && neonMaterialsRef.current.length > 0 && animationSpeed > 0) {
        const time = Date.now() * 0.001 * animationSpeed;
        
        neonMaterialsRef.current.forEach((materialSet, index) => {
          const phaseOffset = index * 0.7;
          const flicker = Math.sin(time * 8 + phaseOffset) * 0.15 + 
                              Math.sin(time * 13 + phaseOffset) * 0.08 +
                              Math.random() * 0.05;
          const intensity = Math.max(0.3, baseIntensity + flicker);
          
          if (materialSet.main.uniforms && materialSet.main.uniforms.emissiveIntensity) {
            materialSet.main.uniforms.emissiveIntensity.value = intensity;
            materialSet.caps.forEach(cap => {
              if (cap.material.uniforms && cap.material.uniforms.emissiveIntensity) {
                cap.material.uniforms.emissiveIntensity.value = intensity;
              }
            });
          }
        });
      } else if (flickerEnabled === false && neonMaterialsRef.current.length > 0) {
        neonMaterialsRef.current.forEach(materialSet => {
          if (materialSet.main.uniforms && materialSet.main.uniforms.emissiveIntensity) {
            materialSet.main.uniforms.emissiveIntensity.value = baseIntensity;
            materialSet.caps.forEach(cap => {
              if (cap.material.uniforms && cap.material.uniforms.emissiveIntensity) {
                cap.material.uniforms.emissiveIntensity.value = baseIntensity;
              }
            });
          }
        });
      }

      // Automatic rotation effect
      if (neonGroupRef.current && rotationEnabled && animationSpeed > 0) {
        neonGroupRef.current.rotation.y += 0.01 * animationSpeed;
        neonGroupRef.current.rotation.x += 0.005 * animationSpeed;
      }

      if (composerRef.current) {
        const originalClearColor = renderer.getClearColor(new THREE.Color());
        const originalClearAlpha = renderer.getClearAlpha();

        // 1. Render bloom scene
        camera.layers.set(BLOOM_SCENE_LAYER);
        scene.background = new THREE.Color(0x000000); // Black background for bloom
        if (wallPlaneRef.current) wallPlaneRef.current.visible = false; // Hide wall for bloom pass
        renderer.setClearColor(0x000000, 0); // Ensure bloom pass renders with black transparent background
        composerRef.current.bloom.render();

        // 2. Render final scene
        camera.layers.set(ENTIRE_SCENE_LAYER);
        scene.background = new THREE.Color(backgroundColorRef.current); // Use the reactive background color
        if (wallPlaneRef.current) wallPlaneRef.current.visible = true; // Show wall for final pass
        renderer.setClearColor(originalClearColor, originalClearAlpha); // Restore original clear color for final pass
        composerRef.current.final.render();
      } else {
        renderer.render(scene, camera);
      }
    };

    // アニメーションをAnimationManagerに登録
    animationCleanupRef.current = animationManager.addCallback(animate, 'NeonSVGTo3DExtruder');
    
    // アニメーションループ開始完了を待って進捗更新
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('3DProgressUpdate', {
        detail: { stage: 'アニメーション開始', progress: 60, message: 'レンダリングループ開始完了' }
      }));
    }, 200);

    // Handle window resize
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      if (composerRef.current) {
        composerRef.current.bloom.setSize(width * 3.0, height * 3.0);
        composerRef.current.final.setSize(width, height);
      }
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      // AnimationManagerからのクリーンアップ
      if (animationCleanupRef.current) {
        animationCleanupRef.current();
        animationCleanupRef.current = null;
      }
      
      window.removeEventListener('resize', handleResize);
      isMountedRef.current = false;
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
        animationIdRef.current = null;
      }
      
      // Clean up Three.js resources
      if (neonGroupRef.current) {
        neonGroupRef.current.children.forEach(child => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(m => m.dispose());
            } else {
              child.material.dispose();
            }
          }
        });
        neonGroupRef.current.clear();
      }
      
      // Clean up room model
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
      
      // Clean up composers
      if (composerRef.current) {
        composerRef.current.bloom.dispose();
        composerRef.current.final.dispose();
        composerRef.current = null;
      }
      
      // Clean up renderer
      if (rendererRef.current) {
        if (mountRef.current && rendererRef.current.domElement) {
          mountRef.current.removeChild(rendererRef.current.domElement);
        }
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
      
      // Clear material references
      neonMaterialsRef.current = [];
      
      console.log('NeonSVGTo3DExtruder cleanup complete');
    };
  }, [ENTIRE_SCENE_LAYER, BLOOM_SCENE_LAYER]);

  // Room model loading effect
  useEffect(() => {
    if (!sceneRef.current) return;

    const scene = sceneRef.current;
    
    // DRACOLoaderを設定
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/'); // DRACOデコーダーのパス（CDN）
    
    const gltfLoader = new GLTFLoader();
    gltfLoader.setDRACOLoader(dracoLoader);
    
    const modelPath = '/models/room.black.neon.glb';

    // Skip room model loading on mobile devices
    if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
      console.log('Skipping room model loading on mobile device');
      return;
    }

    gltfLoader.load(
      modelPath,
      (gltf) => {
        if (loadedRoomModelRef.current) {
          scene.remove(loadedRoomModelRef.current);
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
        scene.add(loadedRoomModelRef.current);
        const model = loadedRoomModelRef.current;

        // Rotate the model to orient the dark back wall correctly
        model.rotation.y = -Math.PI / 2;
        model.updateMatrixWorld(true);

        // Get model's size after rotation for scaling purposes
        const initialModelBoxForScaling = new THREE.Box3().setFromObject(model);
        const modelSizeForScaling = new THREE.Vector3();
        initialModelBoxForScaling.getSize(modelSizeForScaling);

        // Get grid dimensions
        const currentWallPlane = wallPlaneRef.current;
        let gridWidth = currentWallPlane.geometry.parameters.width;
        let gridHeight = currentWallPlane.geometry.parameters.height;
        
        if (!gridWidth) gridWidth = 1000; 
        if (!gridHeight) gridHeight = 600;

        // Calculate scaleFactor
        let scaleFactor = 1;
        if (modelSizeForScaling.x > 0.001 && modelSizeForScaling.y > 0.001) {
          const scaleX = gridWidth / modelSizeForScaling.x;
          const scaleY = gridHeight / modelSizeForScaling.y;
          scaleFactor = Math.min(scaleX, scaleY) * 0.9;
        } else if (modelSizeForScaling.z > 0.001) {
          const arbitraryGridDepth = Math.min(gridWidth, gridHeight);
          scaleFactor = (arbitraryGridDepth / modelSizeForScaling.z) * 0.9;
        }
        if (scaleFactor <= 0 || !isFinite(scaleFactor)) {
          console.warn("Calculated scaleFactor is invalid, defaulting to 0.1. Model size:", modelSizeForScaling);
          scaleFactor = 0.1; 
        }

        // User Defined Scale Adjustment
        const currentVisualRepresentsCm = 270.0;
        const modelPartTrueSizeCm = 910.0;
        const finalScaleFactor = scaleFactor * (modelPartTrueSizeCm / currentVisualRepresentsCm);

        model.scale.set(finalScaleFactor, finalScaleFactor, finalScaleFactor);
        model.updateMatrixWorld(true);

        // For X/Y centering: Bounding box of the entire scaled and rotated model
        const overallScaledRotatedModelBox = new THREE.Box3().setFromObject(model);
        const overallModelCenter = new THREE.Vector3();
        overallScaledRotatedModelBox.getCenter(overallModelCenter);

        // Find RoomBackWall
        let roomBackWallObject = null;
        model.traverse((child) => {
          if (child.isMesh && child.name === 'RoomBackWall') {
            roomBackWallObject = child;
          }
        });

        const gridSurfaceZ = wallPlaneRef.current.position.z;

        // Position model
        model.position.x = -overallModelCenter.x;
        model.position.y = -overallModelCenter.y - 480; 

        if (roomBackWallObject) {
          const wallWorldBox = new THREE.Box3().setFromObject(roomBackWallObject);
          const fineTuneZOffset = 86.5;
          model.position.z = gridSurfaceZ - wallWorldBox.min.z - fineTuneZOffset;
        } else {
          console.warn('RoomBackWall object not found. Using overall model for Z positioning. Check name in Blender.');
          const overallModelMinZ = overallScaledRotatedModelBox.min.z; 
          model.position.z = gridSurfaceZ - overallModelMinZ;
        }

        // Hide the original preview wall if the room model is loaded
        if (wallPlaneRef.current) {
          wallPlaneRef.current.visible = false;
        }
        
        // Set room model to not bloom
        loadedScene.traverse((child) => {
          if (child.isMesh) {
            child.layers.set(ENTIRE_SCENE_LAYER);
          }
        });
      },
      undefined, // onProgress
      (error) => {
        console.error('Error loading room.black.neon.glb:', error);
      }
    );

    return () => {
      // Room model specific cleanup is handled in disposeResources
    };
  }, [sceneRef, wallPlaneRef]);

  const handleFileChange = (e) => {
    if (e.target.files.length > 0) {
      loadSVGFile(e.target.files[0]);
    }
  };

  const colorPresets = ['#ff0088', '#00ff88', '#0088ff', '#ffff00', '#ff4400'];

  // neonSvgDataが変更された時に自動的にSVGをロード
  useEffect(() => {
    if (neonSvgData && neonSvgData.svgContent) {
      console.log('SVGデータを自動ロード中...');
      
      // すぐにロード開始
      const blob = new Blob([neonSvgData.svgContent], { type: 'image/svg+xml' });
      const file = new File([blob], 'neon_sign.svg', { type: 'image/svg+xml' });
      
      // SVGファイルをロード
      loadSVGFile(file);
    }
  }, [neonSvgData, loadSVGFile]);

  // カメラ状態を保存する関数
  const saveCameraState = useCallback(() => {
    if (cameraRef.current && controlsRef.current) {
      setSavedCameraState({
        position: cameraRef.current.position.clone(),
        target: controlsRef.current.target.clone()
      });
      console.log('カメラ状態を保存しました');
      return true;
    }
    return false;
  }, []);

  // カメラ状態を復元する関数
  const restoreCameraState = useCallback(() => {
    if (savedCameraState && cameraRef.current && controlsRef.current) {
      cameraRef.current.position.copy(savedCameraState.position);
      controlsRef.current.target.copy(savedCameraState.target);
      controlsRef.current.update();
      console.log('カメラ状態を復元しました');
      return true;
    }
    return false;
  }, [savedCameraState]);

  // GLBエクスポート機能（379万頂点を大幅削減）
  const exportToGLB = useCallback(() => {
    if (!neonGroupRef.current) {
      console.warn('エクスポートするモデルがありません。');
      return;
    }

    // 379万頂点 → 1万頂点以下に削減
    const exportGroup = new THREE.Group();
    
    neonGroupRef.current.traverse((child) => {
      if (child.isMesh && child.geometry) {
        if (child.geometry.type === 'TubeGeometry') {
          const originalGeometry = child.geometry;
          const originalRadius = originalGeometry.parameters?.radius || 0.04;
          const path = originalGeometry.parameters?.path;
          
          if (path && path.points && path.points.length > 1) {
            // パスポイント数を増やしてなめらかさを向上
            const simplifiedPoints = [];
            const totalPoints = path.points.length;
            const maxPoints = 40; // 10→20に増加
            const step = Math.max(1, Math.floor(totalPoints / maxPoints));
            
            for (let i = 0; i < totalPoints; i += step) {
              simplifiedPoints.push(path.points[i]);
            }
            // 最後の点を必ず含める
            if (simplifiedPoints[simplifiedPoints.length - 1] !== path.points[totalPoints - 1]) {
              simplifiedPoints.push(path.points[totalPoints - 1]);
            }
            
            const simplifiedCurve = new THREE.CatmullRomCurve3(simplifiedPoints, false, 'centripetal', 0.1);
            
            // なめらかさ重視の解像度設定
            const newGeometry = new THREE.TubeGeometry(
              simplifiedCurve,
              Math.max(40, simplifiedPoints.length * 1), // tubularSegments（さらに増加）
              originalRadius,
              8, // radialSegments（10→12に増加
              false
            );
            
            // 色を取得
            let color = new THREE.Color(0xff0088);
            if (child.material && child.material.uniforms && child.material.uniforms.baseColor) {
              color = child.material.uniforms.baseColor.value;
            }
            
            const material = new THREE.MeshBasicMaterial({ color: color });
            const mesh = new THREE.Mesh(newGeometry, material);
            
            // 元の位置とローテーションを適用
            mesh.position.copy(child.position);
            mesh.position.z = 16; // チューブを土台より前面に配置
            mesh.rotation.copy(child.rotation);
            mesh.scale.copy(child.scale);
            
            exportGroup.add(mesh);
            
            console.log(`チューブ簡略化: ${originalGeometry.attributes.position.count}頂点 → ${newGeometry.attributes.position.count}頂点`);
          }
        }
        else if (child.geometry.type === 'SphereGeometry') {
          // キャップ球体も大幅削減
          const originalGeometry = child.geometry;
          const originalRadius = originalGeometry.parameters?.radius || 0.04;
          
          const newGeometry = new THREE.SphereGeometry(originalRadius, 6, 6); // 8x8セグメント（なめらかさ向上）
          
          let color = new THREE.Color(0xff0088);
          if (child.material && child.material.uniforms && child.material.uniforms.baseColor) {
            color = child.material.uniforms.baseColor.value;
          }
          
          const material = new THREE.MeshBasicMaterial({ color: color });
          const mesh = new THREE.Mesh(newGeometry, material);
          
          mesh.position.copy(child.position);
          mesh.position.z = 16; // キャップも土台より前面に配置
          mesh.rotation.copy(child.rotation);
          mesh.scale.copy(child.scale);
          
          exportGroup.add(mesh);
          
          console.log(`球体簡略化: ${originalGeometry.attributes.position.count}頂点 → ${newGeometry.attributes.position.count}頂点`);
        }
        else if (child.geometry.type === 'ExtrudeGeometry') {
          // 土台の元の色を保持
          let baseMaterial;
          if (child.material.type === 'MeshPhongMaterial') {
            // 元のMeshPhongMaterialの設定を保持
            baseMaterial = new THREE.MeshBasicMaterial({
              color: child.material.color,
              transparent: child.material.transparent,
              opacity: child.material.opacity,
              side: child.material.side
            });
          } else {
            // フォールバック
            baseMaterial = new THREE.MeshBasicMaterial({
              color: child.material.color || 0x888888,
              transparent: true,
              opacity: 0.7
            });
          }
          
          const mesh = new THREE.Mesh(child.geometry.clone(), baseMaterial);
          
          mesh.position.copy(child.position);
          mesh.position.z = 7; // 土台を正しい位置に配置
          mesh.rotation.copy(child.rotation);
          mesh.scale.copy(child.scale);
          
          exportGroup.add(mesh);
        }
      }
    });

    // 総頂点数を確認
    let totalVertices = 0;
    exportGroup.traverse((child) => {
      if (child.isMesh && child.geometry) {
        const vertices = child.geometry.attributes.position ? child.geometry.attributes.position.count : 0;
        totalVertices += vertices;
      }
    });
    
    console.log(`エクスポート予定: ${exportGroup.children.length}メッシュ, ${totalVertices}頂点`);

    const exporter = new GLTFExporter();
    
    const options = {
      binary: true,
      embedImages: false,
      includeCustomExtensions: false,
      onlyVisible: true
    };

    exporter.parse(
      exportGroup,
      (result) => {
        const blob = new Blob([result], { type: 'application/octet-stream' });
        const fileSizeMB = (blob.size / (1024 * 1024)).toFixed(2);
        const fileSizeKB = (blob.size / 1024).toFixed(2);
        
        console.log(`GLBファイルサイズ: ${fileSizeMB}MB (${fileSizeKB}KB)`);
        console.log(`削減率: ${((1 - totalVertices / 3792098) * 100).toFixed(1)}%`);
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'my-neon-sign-optimized.glb';
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(URL.createObjectURL(blob));
        
        // クリーンアップ
        exportGroup.traverse((child) => {
          if (child.isMesh) {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
          }
        });
        exportGroup.clear();
        
        console.log('最適化GLBファイルのエクスポートが完了しました');
      },
      (error) => {
        console.error('エクスポートエラー:', error);
        exportGroup.traverse((child) => {
          if (child.isMesh) {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
          }
        });
        exportGroup.clear();
      },
      options
    );
  }, []);

  // 外部から呼び出せるメソッドを公開
  useImperativeHandle(ref, () => ({
    // カメラ状態を保存
    saveCameraState: () => {
      return saveCameraState();
    },
    
    // カメラ状態を復元
    restoreCameraState: () => {
      return restoreCameraState();
    },
    
    // SVGファイルを読み込む
    loadSVGFile: (file) => {
      if (file) {
        loadSVGFile(file);
        return true;
      }
      return false;
    },
    
    // GLBエクスポート
    exportToGLB: () => {
      exportToGLB();
    }
  }), [saveCameraState, restoreCameraState, loadSVGFile, exportToGLB]);

  return (
    <div className="neon-container">
      <div ref={mountRef} className="neon-canvas-mount" />
      
      {/* グロー ON/OFF スイッチ - サイドバー外 */}
      <div className={`neon3d-glow-power-section ${sidebarVisible ? 'sidebar-open' : 'sidebar-closed'}`}>
        <div className="neon3d-glow-power-controls">
          <div className="neon3d-glow-power-status">
            <span className={`neon3d-status-dot ${glowValue > 0 ? 'on' : 'off'}`}></span>
            <span className={`neon3d-glow-status-text ${glowValue > 0 ? 'on' : 'off'}`}>
              {glowValue > 0 ? 'ON' : 'OFF'}
            </span>
          </div>
          <button
            onClick={() => setGlowValue(glowValue > 0 ? 0 : 0.50)}
            className={`neon3d-glow-power-switch ${glowValue > 0 ? 'on' : 'off'}`}
          >
            <div className={`neon3d-glow-switch-handle ${glowValue > 0 ? 'on' : 'off'}`} />
          </button>
        </div>
        
        {/* 照明スイッチを追加 */}
        <div className="neon3d-lighting-controls">
          <span className="neon3d-lighting-label">壁面照明</span>
          <button
            onClick={toggleRectAreaLight}
            className={`neon3d-lighting-toggle ${rectAreaLightEnabled ? 'on' : 'off'}`}
          >
            <span className="neon3d-lighting-text">
              {rectAreaLightEnabled ? 'ON' : 'OFF'}
            </span>
          </button>
        </div>
      </div>
      
      {/* エクスポートボタン - サイドバー外 */}
      <div className="neon3d-export-button-container">
        <button 
          className="neon3d-export-button"
          onClick={exportToGLB}
        >
          GLBファイルとして保存
        </button>
      </div>
      
      {/* Controls Panel */}
      <div className={`controls-panel ${sidebarVisible ? '' : 'collapsed'}`}>
        <button 
          className="sidebar-toggle-button"
          onClick={() => setSidebarVisible(!sidebarVisible)}
          aria-label={sidebarVisible ? '閉じる' : '開く'}
        >
          {sidebarVisible ? '▲' : '▼'}
        </button>

        {/* モデル詳細情報表示 */}
        <div className="neon3d-details-info-container">
          <div className="neon3d-model-details-header">
            <div className="neon3d-info-section-title">モデル詳細情報</div>
            <button
              onClick={() => {
                setIsGuideModalOpen(true);
                setTimeout(() => {
                  onGuideEffectStop?.();
                }, 150);
              }}
              className={`neon3d-guide-button ${isGuideEffectStopped ? 'stopped' : ''}`}
            >
            </button>
          </div>
          <div className="neon3d-dimension-item">
            <span className="neon3d-dimension-label">サイズ(幅x高)</span>
            <span className="neon3d-dimension-value">{calculatedModelData?.isGenerated === true ? `${Math.round(calculatedModelData.modelWidth)}x${Math.round(calculatedModelData.modelHeight)}mm` : 'N/A'}</span>
          </div>
          <div className="neon3d-dimension-item">
            <span className="neon3d-dimension-label">6mmチューブ</span>
            <span className="neon3d-dimension-value">{calculatedModelData?.isGenerated === true ? `${calculatedModelData.tubeCount6mm}本` : 'N/A'}</span>
          </div>
          <div className="neon3d-dimension-item">
            <span className="neon3d-dimension-label">8mmチューブ</span>
            <span className="neon3d-dimension-value">{calculatedModelData?.isGenerated === true ? `${calculatedModelData.tubeCount8mm}本` : 'N/A'}</span>
          </div>
          <div className="neon3d-dimension-item">
            <span className="neon3d-dimension-label">6mmチューブ長さ</span>
            <span className="neon3d-dimension-value">{calculatedModelData?.isGenerated === true ? `${(calculatedModelData.tubeLength6mm / 10).toFixed(1)}cm` : 'N/A'}</span>
          </div>
          <div className="neon3d-dimension-item">
            <span className="neon3d-dimension-label">8mmチューブ長さ</span>
            <span className="neon3d-dimension-value">{calculatedModelData?.isGenerated === true ? `${(calculatedModelData.tubeLength8mm / 10).toFixed(1)}cm` : 'N/A'}</span>
          </div>
          <div className="neon3d-dimension-item">
            <span className="neon3d-dimension-label">OFF時のチューブカラー</span>
            <span className="neon3d-dimension-value">{calculatedModelData?.isGenerated === true ? (offTubeColor === 'white' ? 'ホワイト' : '発光色マッチング') : 'N/A'}</span>
          </div>
          <div className="neon3d-dimension-item">
            <span className="neon3d-dimension-label">ベースプレート色</span>
            <span className="neon3d-dimension-value">{calculatedModelData?.isGenerated === true ? calculatedModelData.baseColor : 'N/A'}</span>
          </div>
          <div className="neon3d-dimension-item">
            <span className="neon3d-dimension-label">タイプ</span>
            <span className="neon3d-dimension-value">{calculatedModelData?.isGenerated === true ? calculatedModelData.modelType : 'N/A'}</span>
          </div>
        </div>

        {/* 商品情報へ進むボタン */}
        <div className="neon3d-proceed-button-container">
          <button 
            className="neon3d-proceed-button"
            onClick={() => {
              if (onNavigateToInfo && calculatedModelData) {
                onNavigateToInfo(calculatedModelData);
              }
            }}
          >
            商品情報へ進む
          </button>
        </div>
      </div>
      
      <div className="info-text">
        ドラッグ: 回転 | ホイール: ズーム | リアルなネオンサイン
      </div>

      {/* ガイドモーダル */}
      <Preview3DGuideModal 
        isOpen={isGuideModalOpen} 
        onClose={() => setIsGuideModalOpen(false)} 
      />
    </div>
  );
});

export default NeonSVGTo3DExtruder;