import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { CopyShader } from 'three/examples/jsm/shaders/CopyShader.js';
import './NeonSVGTo3DExtruder.css';

const NeonSVGTo3DExtruder = () => {
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
  const animationIdRef = useRef(null);

  // State for UI controls
  const [color, setColor] = useState('#ff0088');
  const [backgroundColor, setBackgroundColor] = useState('#000000');
  const [emissiveValue, setEmissiveValue] = useState(1.0);
  const [glowValue, setGlowValue] = useState(1.8);
  const [scatterStrength, setScatterStrength] = useState(0.05);
  const [tubeSize, setTubeSize] = useState(0.04);
  const [animationSpeed, setAnimationSpeed] = useState(0.0);
  const [flickerEnabled, setFlickerEnabled] = useState(false);
  const [rotationEnabled, setRotationEnabled] = useState(false);
  const [wallLightsEnabled, setWallLightsEnabled] = useState(true);

  // Define layers for selective rendering
  const ENTIRE_SCENE_LAYER = 0;
  const BLOOM_SCENE_LAYER = 1;


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
    static loadFromFile(file, callback) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const svgText = e.target.result;
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
        const elements = this.extractElements(svgDoc);
        callback(elements);
      };
      reader.readAsText(file);
    }
    
    static extractElements(svgDoc) {
      const elements = [];
      const allSvgElements = svgDoc.querySelectorAll('path, circle, rect, line, polyline, polygon');
      const scale = 0.01;

      allSvgElements.forEach(element => {
        const dataType = element.getAttribute('data-type');
        const fill = element.getAttribute('fill');
        const stroke = element.getAttribute('stroke');
        const isFilled = fill && fill !== 'none';
        
        const isPathLikeElement = ['path', 'rect', 'circle', 'polygon'].includes(element.tagName.toLowerCase());

        if (dataType === 'base' || (isFilled && isPathLikeElement && dataType !== 'neon')) {
          console.warn('SVG element identified as base/filled shape and skipped for neon tube generation:', element);
          return;
        }

        if (!stroke || stroke === 'none') {
          if (element.tagName.toLowerCase() !== 'line' && element.tagName.toLowerCase() !== 'polyline') {
            console.warn('SVG element skipped as it has no stroke attribute and is not a line/polyline, thus not suitable for neon tube:', element);
            return;
          }
        }

        const points = this.elementToPathPoints(element, scale);
        if (points.length > 0) {
          elements.push({
            type: 'neon',
            points: points,
            stroke: stroke || '#ffffff',
            strokeWidth: parseFloat(element.getAttribute('stroke-width') || '1')
          });
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
                  const p0 = new THREE.Vector2(currentX, currentY);
                  const p1 = new THREE.Vector2(type === 'C' ? coords[i] : currentX + coords[i], type === 'C' ? coords[i+1] : currentY + coords[i+1]);
                  const p2 = new THREE.Vector2(type === 'C' ? coords[i+2] : currentX + coords[i+2], type === 'C' ? coords[i+3] : currentY + coords[i+3]);
                  const p3 = new THREE.Vector2(type === 'C' ? coords[i+4] : currentX + coords[i+4], type === 'C' ? coords[i+5] : currentY + coords[i+5]);
                  
                  const curve = new THREE.CubicBezierCurve(p0, p1, p2, p3);
                  const curvePoints = curve.getPoints(30);
                  curvePoints.forEach(p => points.push(new THREE.Vector3(p.x * scale, -p.y * scale, 0)));
                  
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
      const segments = 64;
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

  // SimpleOrbitControls class
  class SimpleOrbitControls {
    constructor(camera, domElement) {
      this.camera = camera;
      this.domElement = domElement;
      this.isMouseDown = false;
      this.mouseX = 0;
      this.mouseY = 0;
      this.targetX = 0;
      this.targetY = 0;
      this.rotationX = 0;
      this.rotationY = 0;
      this.distance = 8;

      this.addEventListeners();
    }
    
    addEventListeners() {
      this.domElement.addEventListener('mousedown', (e) => {
        this.isMouseDown = true;
        this.mouseX = e.clientX;
        this.mouseY = e.clientY;
        e.preventDefault();
      });
      
      this.domElement.addEventListener('mousemove', (e) => {
        if (!this.isMouseDown) return;
        
        const deltaX = e.clientX - this.mouseX;
        const deltaY = e.clientY - this.mouseY;
        
        this.targetX += deltaX * 0.01;
        this.targetY += deltaY * 0.01;
        
        this.mouseX = e.clientX;
        this.mouseY = e.clientY;
      });
      
      this.domElement.addEventListener('mouseup', () => {
        this.isMouseDown = false;
      });
      
      this.domElement.addEventListener('wheel', (e) => {
        this.distance += e.deltaY * 0.01;
        this.distance = Math.max(2, Math.min(20, this.distance));
        e.preventDefault();
      });

      this.domElement.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
          this.isMouseDown = true;
          this.mouseX = e.touches[0].clientX;
          this.mouseY = e.touches[0].clientY;
        }
        e.preventDefault();
      });

      this.domElement.addEventListener('touchmove', (e) => {
        if (!this.isMouseDown || e.touches.length !== 1) return;
        
        const deltaX = e.touches[0].clientX - this.mouseX;
        const deltaY = e.touches[0].clientY - this.mouseY;
        
        this.targetX += deltaX * 0.01;
        this.targetY += deltaY * 0.01;
        
        this.mouseX = e.touches[0].clientX;
        this.mouseY = e.touches[0].clientY;
      });

      this.domElement.addEventListener('touchend', () => {
        this.isMouseDown = false;
      });
    }
    
    update() {
      this.rotationX += (this.targetX - this.rotationX) * 0.05;
      this.rotationY += (this.targetY - this.rotationY) * 0.05;
      this.rotationY = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.rotationY));
      
      const x = Math.sin(this.rotationX) * Math.cos(this.rotationY) * this.distance;
      const y = Math.sin(this.rotationY) * this.distance;
      const z = Math.cos(this.rotationX) * Math.cos(this.rotationY) * this.distance;
      
      this.camera.position.set(x, y, z);
      this.camera.lookAt(0, 0, 0);
    }
  }


  const createNeonTube = useCallback((points, materialIndex, svgColor) => {
    if (points.length < 2) return;

    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.1);
    const radialSegments = 16;
    const tubularSegments = Math.max(100, points.length * 12);
    
    const geometry = new THREE.TubeGeometry(curve, tubularSegments, tubeSize, radialSegments, false);

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

    const neonMaterial = new THREE.ShaderMaterial({
      uniforms: {
        baseColor: { value: tubeColor },
        emissiveIntensity: { value: emissiveValue }  // 元に戻す
      },
      vertexShader: neonVertexShader,
      fragmentShader: neonFragmentShader
    });

    const neonTube = new THREE.Mesh(geometry, neonMaterial);
    neonTube.castShadow = true;
    neonTube.receiveShadow = true;
    neonTube.layers.enable(BLOOM_SCENE_LAYER);
    if (neonGroupRef.current) {
      neonGroupRef.current.add(neonTube);
    }

    const capGeometry = new THREE.CircleGeometry(tubeSize, radialSegments);
    
    const startCap = new THREE.Mesh(capGeometry, neonMaterial.clone());
    const endCap = new THREE.Mesh(capGeometry, neonMaterial.clone());

    const startPoint = curve.getPointAt(0);
    const startTangent = curve.getTangentAt(0).normalize();
    startCap.position.copy(startPoint);
    startCap.lookAt(startPoint.clone().add(startTangent.negate()));
    startCap.layers.enable(BLOOM_SCENE_LAYER);
    if (neonGroupRef.current) {
      neonGroupRef.current.add(startCap);
    }

    const endPoint = curve.getPointAt(1);
    const endTangent = curve.getTangentAt(1).normalize();
    endCap.position.copy(endPoint);
    endCap.lookAt(endPoint.clone().add(endTangent));
    endCap.layers.enable(BLOOM_SCENE_LAYER);
    if (neonGroupRef.current) {
      neonGroupRef.current.add(endCap);
    }

    neonMaterialsRef.current.push({
      main: neonMaterial,
      baseColor: tubeColor.clone(),
      caps: [startCap, endCap]
    });
  }, [tubeSize, emissiveValue, BLOOM_SCENE_LAYER, neonVertexShader, neonFragmentShader]);

  const loadSVGFile = useCallback((file) => {
    SimpleSVGLoader.loadFromFile(file, (elementsData) => {
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
        if (elementData.type === 'neon') {
          if (elementData.points.length > 1) {
            createNeonTube(elementData.points, index, elementData.stroke);
          }
        }
      });
      
      sceneRef.current.add(neonGroupRef.current);
      
      const box = new THREE.Box3().setFromObject(neonGroupRef.current);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      
      neonGroupRef.current.position.sub(center);

      const maxDim = Math.max(size.x, size.y, size.z);
      controlsRef.current.distance = maxDim * 1.8;
    });
  }, [createNeonTube]);

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
    neonMaterialsRef.current.forEach(materialSet => {
      if (materialSet.main.uniforms && materialSet.main.uniforms.emissiveIntensity) {
        materialSet.main.uniforms.emissiveIntensity.value = emissiveValue;
        materialSet.caps.forEach(cap => {
          if (cap.material.uniforms && cap.material.uniforms.emissiveIntensity) {
            cap.material.uniforms.emissiveIntensity.value = emissiveValue;
          }
        });
      }
    });
  }, [emissiveValue]);

  const updateBackground = useCallback(() => {
    const bgColor = new THREE.Color(backgroundColor);
    if (sceneRef.current) {
      sceneRef.current.background = bgColor;
    }
  }, [backgroundColor]);

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
    setBackgroundColor('#000000');
    setEmissiveValue(1.0);
    setGlowValue(1.7);
    setScatterStrength(1.40);
    setTubeSize(0.04);
    setAnimationSpeed(0.0);
    setFlickerEnabled(false);
    setRotationEnabled(false);
    setWallLightsEnabled(true);

    if (controlsRef.current) {
      controlsRef.current.rotationX = 0;
      controlsRef.current.rotationY = 0;
      controlsRef.current.targetX = 0;
      controlsRef.current.targetY = 0;
      controlsRef.current.distance = 8;
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
    updateBackground();
  }, [updateBackground]);

  useEffect(() => {
    updateGlow();
  }, [updateGlow, glowValue]);

  useEffect(() => {
    updateScatterStrength();
  }, [updateScatterStrength, scatterStrength]);

  // Initialize Three.js scene
  useEffect(() => {
    if (!mountRef.current) return;
    
    console.log('Initializing Three.js scene...');
    
    // Clear any existing content
    while (mountRef.current.firstChild) {
      mountRef.current.removeChild(mountRef.current.firstChild);
    }

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(backgroundColor);
    sceneRef.current = scene;
    console.log('Scene background set to:', backgroundColor);

    // Camera setup
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 8);
    camera.lookAt(0, 0, 0);
    camera.layers.enable(ENTIRE_SCENE_LAYER);
    camera.layers.enable(BLOOM_SCENE_LAYER);
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    console.log('WebGL renderer created:', renderer);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    rendererRef.current = renderer;
    mountRef.current.appendChild(renderer.domElement);
    console.log('Renderer added to DOM');

    // シンプルなブルーム設定
    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      glowValue,
      scatterStrength,
      0.85
    );
    composer.addPass(bloomPass);
    
    composerRef.current = composer;
    unrealBloomPassRef.current = bloomPass;
    
    // 初期化直後にパラメータを強制設定
    bloomPass.strength = glowValue;
    bloomPass.threshold = scatterStrength;
    console.log('Bloom parameters force set:', { strength: bloomPass.strength, threshold: bloomPass.threshold });
    console.log('Simple bloom setup complete');
    
    // Controls
    const controls = new SimpleOrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.3);
    ambientLight.layers.enable(ENTIRE_SCENE_LAYER);
    scene.add(ambientLight);

    // Wall lights
    const wallLightColor = 0xffffff;
    const wallLightIntensity = 0.00005;
    const wallLightDistance = 500;
    const wallSizeHalf = 40 / 2;
    const wallZPosition = -0.8 - (0.1 / 2);

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

    // Wall
    const wallThickness = 0.1;
    const wallSize = 40;
    const planeGeometry = new THREE.BoxGeometry(wallSize, wallSize, wallThickness);
    const planeMaterial = new THREE.MeshStandardMaterial({ color: 0xc0c0c0, roughness: 0.8, metalness: 0.2 });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = 0;
    plane.position.z = wallZPosition;
    plane.receiveShadow = true;
    plane.layers.enable(ENTIRE_SCENE_LAYER);
    scene.add(plane);

    // Initialize neon group
    neonGroupRef.current = new THREE.Group();
    scene.add(neonGroupRef.current);

    // Animation loop
    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);
      
      controls.update();

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
        composerRef.current.render();
      } else {
        renderer.render(scene, camera);
      }
    };

    animate();

    // Handle window resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      if (composerRef.current) {
        composerRef.current.setSize(window.innerWidth, window.innerHeight);
      }
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
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
      
      // Clean up composer
      if (composerRef.current) {
        composerRef.current.dispose();
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

  const handleFileChange = (e) => {
    if (e.target.files.length > 0) {
      loadSVGFile(e.target.files[0]);
    }
  };

  const colorPresets = ['#ff0088', '#00ff88', '#0088ff', '#ffff00', '#ff4400'];
  const backgroundPresets = ['#000000', '#1a1a2e', '#0f3460', '#16213e', '#2d1b69'];

  return (
    <div className="neon-container">
      <div ref={mountRef} className="neon-canvas-mount" />
      
      {/* Controls Panel */}
      <div className="controls-panel">
        <div className="control-group">
          <label className="control-label">SVGファイル読み込み:</label>
          <input
            type="file"
            accept=".svg"
            onChange={handleFileChange}
            className="file-input"
          />
        </div>
        
        <div className="control-group">
          <label className="control-label">メインカラー:</label>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="color-input"
          />
          <div className="color-presets">
            {colorPresets.map((preset) => (
              <div
                key={preset}
                className="color-preset"
                style={{ backgroundColor: preset }}
                onClick={() => setColor(preset)}
              />
            ))}
          </div>
        </div>
        
        <div className="control-group">
          <label className="control-label">発光強度: {emissiveValue.toFixed(1)}</label>
          <input
            type="range"
            min="0"
            max="20"
            step="0.5"
            value={emissiveValue}
            onChange={(e) => setEmissiveValue(parseFloat(e.target.value))}
            className="slider"
          />
        </div>
        
        <div className="control-group">
          <label className="control-label">グロー強度: {glowValue.toFixed(1)}</label>
          <input
            type="range"
            min="0"
            max="3"
            step="0.1"
            value={glowValue}
            onChange={(e) => setGlowValue(parseFloat(e.target.value))}
            className="slider"
          />
        </div>
        
        <div className="control-group">
          <label className="control-label">拡散光強度: {scatterStrength.toFixed(2)}</label>
          <input
            type="range"
            min="0"
            max="2"
            step="0.05"
            value={scatterStrength}
            onChange={(e) => setScatterStrength(parseFloat(e.target.value))}
            className="slider"
          />
        </div>
        
        <div className="control-group">
          <label className="control-label">チューブ太さ: {tubeSize.toFixed(3)}</label>
          <input
            type="range"
            min="0.01"
            max="0.15"
            step="0.005"
            value={tubeSize}
            onChange={(e) => setTubeSize(parseFloat(e.target.value))}
            className="slider"
          />
        </div>

        <div className="control-group">
          <label className="control-label">背景色:</label>
          <input
            type="color"
            value={backgroundColor}
            onChange={(e) => setBackgroundColor(e.target.value)}
            className="color-input"
          />
          <div className="color-presets">
            {backgroundPresets.map((preset) => (
              <div
                key={preset}
                className="color-preset"
                style={{ backgroundColor: preset }}
                onClick={() => setBackgroundColor(preset)}
              />
            ))}
          </div>
        </div>
        
        <div className="control-group">
          <label className="control-label">アニメーション速度: {animationSpeed.toFixed(1)}</label>
          <input
            type="range"
            min="0"
            max="3"
            step="0.1"
            value={animationSpeed}
            onChange={(e) => setAnimationSpeed(parseFloat(e.target.value))}
            className="slider"
          />
        </div>
        
        <div className="button-group">
          <button
            onClick={() => setFlickerEnabled(!flickerEnabled)}
            className="control-button"
          >
            {flickerEnabled ? 'チラつき停止' : 'チラつき効果'}
          </button>
          <button
            onClick={() => setRotationEnabled(!rotationEnabled)}
            className="control-button"
          >
            {rotationEnabled ? '回転停止' : '回転効果'}
          </button>
          <button
            onClick={resetScene}
            className="control-button"
          >
            リセット
          </button>
          <button
            onClick={toggleWallLights}
            className="control-button"
          >
            {wallLightsEnabled ? '壁ライトをオフ' : '壁ライトをオン'}
          </button>
        </div>
      </div>
      
      <div className="info-text">
        ドラッグ: 回転 | ホイール: ズーム | リアルなネオンサイン
      </div>
    </div>
  );
};

export default NeonSVGTo3DExtruder;