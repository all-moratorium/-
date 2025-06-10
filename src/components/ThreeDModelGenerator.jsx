import React, { useState, useEffect } from 'react';
import './ThreeDModelGenerator.css';
import { Potrace } from 'potrace';

const ThreeDModelGenerator = ({ layers, onComplete, onStart, onProgressUpdate, autoStart = false }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [layerSvgs, setLayerSvgs] = useState([]);
  const [progress, setProgress] = useState(0);
  const [processingMessage, setProcessingMessage] = useState('');

  const potraceParams = {
    turdSize: 40,
    optTolerance: 0.3,
    turnPolicy: Potrace.TURNPOLICY_MINORITY,
    alphaMax: 1.0,
    optCurve: true,
  };

  useEffect(() => {
    if (autoStart && layers.length > 0 && !isGenerating) {
      console.log('Starting SVG conversion with autoStart:', autoStart);
      convertLayersToSvg();
    }
  }, [autoStart]);

  // 🔥 **最適化1: 進捗更新をスロットル化**
  let lastProgressTime = 0;
  
  // 進捗の最大値を追跡するリファレンス
  const maxProgressRef = React.useRef(0);
  
  // スロットル関数の実装
  const throttle = (func, limit) => {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  };
  
  const updateProgress = (progress, message) => {
    // 進捗が後退しないようにする - リファレンスを使用
    const newProgress = Math.max(maxProgressRef.current, progress);
    maxProgressRef.current = newProgress;
    setProgress(newProgress);
    setProcessingMessage(message);
    if (onProgressUpdate) onProgressUpdate(newProgress, message);
  };

  // 進捗更新を間引く
  const throttledProgressUpdate = throttle(updateProgress, 100);

  // パスの大まかな面積を計算する関数（細すぎるパスを除去するため）
  const calculatePathArea = (pathData) => {
    const commandRegex = /([MLHVCSQTAZ])([^MLHVCSQTAZ]*)/gi;
    const points = [];
    let match;
    let currentX = 0, currentY = 0;

    while ((match = commandRegex.exec(pathData)) !== null) {
      const command = match[1].toUpperCase();
      const paramsString = match[2].trim();
      if (!paramsString) continue;
      
      const params = paramsString.split(/[\s,]+/).map(str => {
        const num = Number(str);
        return isNaN(num) ? 0 : num;
      });

      switch (command) {
        case 'M':
        case 'L':
          if (params.length >= 2) {
            currentX = params[0];
            currentY = params[1];
            points.push({ x: currentX, y: currentY });
          }
          break;
        case 'H':
          if (params.length >= 1) {
            currentX = params[0];
            points.push({ x: currentX, y: currentY });
          }
          break;
        case 'V':
          if (params.length >= 1) {
            currentY = params[0];
            points.push({ x: currentX, y: currentY });
          }
          break;
      }
    }

    if (points.length < 3) return 0;

    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      area += points[i].x * points[j].y;
      area -= points[j].x * points[i].y;
    }
    return Math.abs(area) / 2;
  };

  const distance = (p1, p2) => Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));

  const simplifyPath = (pathData) => {
    // 既存のsimplifyPath実装...（省略）
    const commandRegex = /([MLHVCSQTAZ])([^MLHVCSQTAZ]*)/gi;
    const commands = [];
    let match;

    while ((match = commandRegex.exec(pathData)) !== null) {
      const command = match[1];
      const paramsString = match[2].trim();
      const params = paramsString === "" ? [] : paramsString.split(/[\s,]+/).map(str => {
        const num = Number(str);
        return isNaN(num) ? 0 : num;
      });
      commands.push({ cmd: command, params });
    }

    if (commands.length === 0) return "";

    const simplifiedCommands = [];
    let currentAbsX = 0;
    let currentAbsY = 0;
    let subPathStartX = 0;
    let subPathStartY = 0;
    const MIN_DISTANCE_FOR_CLOSURE = 1.0;
    const LINE_SIMPLIFICATION_TOLERANCE = 1.5;
    let lastProcessedMovableX = 0;
    let lastProcessedMovableY = 0;

    for (let i = 0; i < commands.length; i++) {
      const currentCmdObj = commands[i];
      let cmdChar = currentCmdObj.cmd;
      let params = [...currentCmdObj.params];
      let nextAbsX = currentAbsX;
      let nextAbsY = currentAbsY;
      const isRelative = cmdChar === cmdChar.toLowerCase();
      const cmdUpper = cmdChar.toUpperCase();

      if (cmdUpper === 'M' && simplifiedCommands.length > 0) {
        const lastSimplifiedCmd = simplifiedCommands[simplifiedCommands.length - 1];
        if (lastSimplifiedCmd.cmd.toUpperCase() !== 'Z' && lastSimplifiedCmd.cmd.toUpperCase() !== 'M') {
          if (distance({ x: currentAbsX, y: currentAbsY }, { x: subPathStartX, y: subPathStartY }) < MIN_DISTANCE_FOR_CLOSURE) {
            if (simplifiedCommands.length > 0 && simplifiedCommands[simplifiedCommands.length-1].cmd.toUpperCase() !== 'M') {
              simplifiedCommands.push({ cmd: 'Z', params: [] });
            }
          }
        }
      }

      let addCurrentCommand = true;
      switch (cmdUpper) {
        case 'M':
          nextAbsX = params[0]; nextAbsY = params[1];
          if (isRelative) { nextAbsX += currentAbsX; nextAbsY += currentAbsY; }
          subPathStartX = nextAbsX; subPathStartY = nextAbsY;
          lastProcessedMovableX = nextAbsX; lastProcessedMovableY = nextAbsY;
          break;
        case 'L':
          nextAbsX = params[0]; nextAbsY = params[1];
          if (isRelative) { nextAbsX += currentAbsX; nextAbsY += currentAbsY; }
          if (distance({ x: currentAbsX, y: currentAbsY }, { x: nextAbsX, y: nextAbsY }) < LINE_SIMPLIFICATION_TOLERANCE) addCurrentCommand = false;
          else { lastProcessedMovableX = nextAbsX; lastProcessedMovableY = nextAbsY; }
          break;
        case 'H':
          nextAbsX = params[0]; if (isRelative) { nextAbsX += currentAbsX; }
          nextAbsY = currentAbsY;
          if (Math.abs(currentAbsX - nextAbsX) < LINE_SIMPLIFICATION_TOLERANCE) addCurrentCommand = false;
          else { lastProcessedMovableX = nextAbsX; }
          break;
        case 'V':
          nextAbsY = params[0]; if (isRelative) { nextAbsY += currentAbsY; }
          nextAbsX = currentAbsX;
          if (Math.abs(currentAbsY - nextAbsY) < LINE_SIMPLIFICATION_TOLERANCE) addCurrentCommand = false;
          else { lastProcessedMovableY = nextAbsY; }
          break;
        case 'C':
          nextAbsX = params[4]; nextAbsY = params[5];
          if (isRelative) { nextAbsX += currentAbsX; nextAbsY += currentAbsY; }
          lastProcessedMovableX = nextAbsX; lastProcessedMovableY = nextAbsY;
          break;
        case 'S':
        case 'Q':
          nextAbsX = params[2]; nextAbsY = params[3];
          if (isRelative) { nextAbsX += currentAbsX; nextAbsY += currentAbsY; }
          lastProcessedMovableX = nextAbsX; lastProcessedMovableY = nextAbsY;
          break;
        case 'T':
          nextAbsX = params[0]; nextAbsY = params[1];
          if (isRelative) { nextAbsX += currentAbsX; nextAbsY += currentAbsY; }
          if (distance({ x: currentAbsX, y: currentAbsY }, { x: nextAbsX, y: nextAbsY }) < LINE_SIMPLIFICATION_TOLERANCE) addCurrentCommand = false;
          else { lastProcessedMovableX = nextAbsX; lastProcessedMovableY = nextAbsY; }
          break;
        case 'A':
          nextAbsX = params[5]; nextAbsY = params[6];
          if (isRelative) { nextAbsX += currentAbsX; nextAbsY += currentAbsY; }
          lastProcessedMovableX = nextAbsX; lastProcessedMovableY = nextAbsY;
          break;
        case 'Z':
          nextAbsX = subPathStartX; nextAbsY = subPathStartY;
          if (simplifiedCommands.length > 0 && simplifiedCommands[simplifiedCommands.length -1].cmd.toUpperCase() === 'Z') addCurrentCommand = false;
          lastProcessedMovableX = nextAbsX; lastProcessedMovableY = nextAbsY;
          break;
        default:
          addCurrentCommand = false;
          break;
      }
      if (addCurrentCommand) {
        simplifiedCommands.push({ cmd: cmdChar, params: params, absX: nextAbsX, absY: nextAbsY });
      }
      currentAbsX = lastProcessedMovableX;
      currentAbsY = lastProcessedMovableY;
    }

    if (simplifiedCommands.length > 0) {
        const lastSimplifiedCmd = simplifiedCommands[simplifiedCommands.length - 1];
        if (lastSimplifiedCmd.cmd.toUpperCase() !== 'Z' && lastSimplifiedCmd.cmd.toUpperCase() !== 'M') {
            let currentSubPathActualStartX = 0, currentSubPathActualStartY = 0, foundM = false;
            for(let k = simplifiedCommands.length - 1; k >=0; k--){
                if(simplifiedCommands[k].cmd.toUpperCase() === 'M'){
                    currentSubPathActualStartX = simplifiedCommands[k].absX;
                    currentSubPathActualStartY = simplifiedCommands[k].absY;
                    foundM = true;
                    break;
                }
            }
            if (foundM && distance({ x: currentAbsX, y: currentAbsY }, { x: currentSubPathActualStartX, y: currentSubPathActualStartY }) < MIN_DISTANCE_FOR_CLOSURE) {
                simplifiedCommands.push({ cmd: 'Z', params: [] });
            }
        }
    }

    let resultPathString = '';
    simplifiedCommands.forEach(cmdToBuild => {
      const paramString = cmdToBuild.params.map(p => parseFloat(p.toFixed(2))).join(' ');
      resultPathString += cmdToBuild.cmd + (paramString ? ' ' + paramString : '') + ' ';
    });
    return resultPathString.trim().replace(/\s\s+/g, ' ');
  };
  
  const postProcessSVG = (svgInputText) => {
    if (!svgInputText) return "";
    const pathRegex = /<path[^>]*d="([^"]*)"[^>]*>/g;
    let result = svgInputText;
    const pathsToReplace = [];

    let tempSvgTextForParsing = svgInputText;
    let match;
    while ((match = pathRegex.exec(tempSvgTextForParsing)) !== null) {
      const fullPathTag = match[0];
      const originalPathData = match[1];
      const simplifiedPathData = simplifyPath(originalPathData);
      
      const pathArea = calculatePathArea(simplifiedPathData);
      const MIN_PATH_AREA = 50;
      
      if (simplifiedPathData.length < 3 || pathArea < MIN_PATH_AREA) {
        pathsToReplace.push({ oldTag: fullPathTag, newTag: "" });
      } else {
        const newPathTag = fullPathTag.replace(`d="${originalPathData}"`, `d="${simplifiedPathData}"`);
        pathsToReplace.push({ oldTag: fullPathTag, newTag: newPathTag });
      }
    }
    pathsToReplace.forEach(replacement => {
      result = result.replace(replacement.oldTag, replacement.newTag);
    });
    return result.replace(/<desc>.*<\/desc>/g, '');
  };

  const addMarkerToSvg = (svgString, imageWidth, imageHeight) => {
    if (!svgString) return "";
    const MARKER_SIZE = 1;
    let vbWidth = imageWidth, vbHeight = imageHeight, vbMinX = 0, vbMinY = 0;

    const viewBoxMatch = svgString.match(/viewBox="([^"]*)"/);
    if (viewBoxMatch?.[1]) {
      const parts = viewBoxMatch[1].split(/[,\s]+/);
      if (parts.length === 4) {
        [vbMinX, vbMinY, vbWidth, vbHeight] = parts.map(parseFloat);
      }
    }

    const timestamp = Date.now();
    const markers = [
      `<rect x="${vbMinX}" y="${vbMinY}" width="${MARKER_SIZE}" height="${MARKER_SIZE}" fill="transparent" id="alignment-marker-tl-${timestamp}" />`,
      `<rect x="${vbMinX + vbWidth - MARKER_SIZE}" y="${vbMinY}" width="${MARKER_SIZE}" height="${MARKER_SIZE}" fill="transparent" id="alignment-marker-tr-${timestamp}" />`,
      `<rect x="${vbMinX}" y="${vbMinY + vbHeight - MARKER_SIZE}" width="${MARKER_SIZE}" height="${MARKER_SIZE}" fill="transparent" id="alignment-marker-bl-${timestamp}" />`,
      `<rect x="${vbMinX + vbWidth - MARKER_SIZE}" y="${vbMinY + vbHeight - MARKER_SIZE}" width="${MARKER_SIZE}" height="${MARKER_SIZE}" fill="transparent" id="alignment-marker-br-${timestamp}" />`,
    ].join('');

    const closingSvgTagIndex = svgString.lastIndexOf("</svg>");
    if (closingSvgTagIndex !== -1) {
      return svgString.substring(0, closingSvgTagIndex) + markers + svgString.substring(closingSvgTagIndex);
    }
    return svgString + markers;
  };

  const generateFullBlackImageData = (width, height) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, width, height);
    
    return ctx.getImageData(0, 0, width, height);
  };

  // 🔥 **最適化2: 非同期Potrace処理**
  const processPotraceAsync = (imageData, params) => {
    return new Promise((resolve, reject) => {
      // メインスレッドに制御を戻してからPotrace実行
      setTimeout(() => {
        try {
          const tracer = new Potrace();
          tracer.setParameters(params);
          tracer.loadImage(imageData, (err) => {
            if (err) return reject(err);
            const svgString = tracer.getSVG();
            resolve(svgString);
          });
        } catch (error) {
          reject(error);
        }
      }, 0);
    });
  };

  // 🔥 **最適化3: 処理の分割と非同期化**
  const convertLayersToSvg = async () => {
    if (layers.length === 0 || isGenerating) return;
    
    console.log('Starting SVG conversion for', layers.length, 'layers using Potrace.');
    setIsGenerating(true);
    setProgress(0);
    setProcessingMessage('変換を開始しています...');
    setLayerSvgs([]);
    if (onStart) onStart();
    
    const svgArray = new Array(layers.length);
    
    try {
      // 🔥 各レイヤーを順次処理（並列処理ではなく）
      for (let index = 0; index < layers.length; index++) {
        const layer = layers[index];
        
        // 進捗計算を改善 - 各レイヤーの開始時と完了時の進捗を明確に分ける
        // 各レイヤーに割り当てる進捗の幅を計算
        const progressPerLayer = 80 / layers.length;
        const baseProgress = 5 + (index * progressPerLayer); // 5%から開始して各レイヤーに割り当てる
        const layerProgress = baseProgress + progressPerLayer;
        
        // 🔥 進捗更新をスロットル化
        throttledProgressUpdate(baseProgress, `レイヤー ${index + 1}/${layers.length} を処理中...`);

        try {
          // 🔥 画像読み込みを非同期化
          const img = await new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error(`Image loading failed for layer ${index + 1}`));
            image.src = layer.dataURL;
          });

          // 🔥 Canvas操作を分割
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d', { alpha: true });
          ctx.drawImage(img, 0, 0);
          
          // メインスレッドに制御を戻す
          await new Promise(resolve => setTimeout(resolve, 0));

          let svgString;
          let finalSvgString;

          if (index === layers.length - 1) {
            // 最下層処理
            throttledProgressUpdate(baseProgress + 2, `レイヤー ${index + 1}: ベースレイヤーを処理中...`);
            const blackImageData = generateFullBlackImageData(img.width, img.height);
            
            // 🔥 非同期Potrace処理
            svgString = await processPotraceAsync(blackImageData, potraceParams);
            
            const optimizedSvgString = postProcessSVG(svgString);
            finalSvgString = addMarkerToSvg(optimizedSvgString, img.width, img.height);
          } else {
            // 通常レイヤー処理
            throttledProgressUpdate(baseProgress + 2, `レイヤー ${index + 1}: 形状をトレース中...`);
            let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          
            // 純白（#ffffff）の場合は色を反転させる
            if (layer.color === '#ffffff' || layer.color === '#FFFFFF') {
              const data = imageData.data;
              for (let i = 0; i < data.length; i += 4) {
                const alpha = data[i + 3];
                if (alpha > 0) { // 透明でない部分
                  // 白色を黒色に変換
                  data[i] = 0;     // R
                  data[i + 1] = 0; // G  
                  data[i + 2] = 0; // B
                  // アルファ値はそのまま
                }
              }
              imageData = new ImageData(data, canvas.width, canvas.height);
            }
            
            // 🔥 非同期Potrace処理
            svgString = await processPotraceAsync(imageData, potraceParams);
            
            const optimizedSvgString = postProcessSVG(svgString);
            finalSvgString = addMarkerToSvg(optimizedSvgString, img.width, img.height);
          }
          
          // 🔥 メモリ解放
          canvas.width = 0;
          canvas.height = 0;
          
          const blob = new Blob([finalSvgString], { type: 'image/svg+xml' });
          const downloadUrl = URL.createObjectURL(blob);
          
          svgArray[index] = {
            svg: finalSvgString,
            color: layer.color,
            index: index,
            downloadUrl: downloadUrl,
            fileName: `layer_${index + 1}.svg`,
          };
          
        } catch (error) {
          console.error(`Layer ${index + 1} processing error:`, error);
          svgArray[index] = null;
        }
        
        // 🔥 レイヤー完了時に進捗更新 - より滑らかな進行のために調整
        throttledProgressUpdate(layerProgress, `レイヤー ${index + 1} 完了`);
        
        // 🔥 メインスレッドに制御を戻してUIの応答性を保つ
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      // 最終処理の進捗をより細かく表示
      throttledProgressUpdate(90, 'ファイルを最終処理中...');
      await new Promise(resolve => setTimeout(resolve, 200)); // 視覚的な遅延を追加
      
      const validSvgs = svgArray.filter(item => item !== null);
      setLayerSvgs(validSvgs);
      
      throttledProgressUpdate(95, 'レイヤーを最適化中...');
      await new Promise(resolve => setTimeout(resolve, 200)); // 視覚的な遅延を追加
      
      throttledProgressUpdate(98, '最終確認中...');
      await new Promise(resolve => setTimeout(resolve, 200)); // 視覚的な遅延を追加
      
      throttledProgressUpdate(100, '生成完了');
      
      // 🔥 最終完了処理を非同期化 - 完了メッセージを十分に表示するため遅延を延長
      await new Promise(resolve => setTimeout(resolve, 100)); // 「生成完了」メッセージを表示する時間を確保
      
      setIsGenerating(false);
      if (onComplete) onComplete(validSvgs);
      
    } catch (error) {
      console.error('SVG変換中にエラーが発生しました:', error);
      setIsGenerating(false);
      alert('SVG変換中にエラーが発生しました。');
    }
  };

  const renderProgressIndicator = () => {
    if (!isGenerating) return null;
    return (
      <div className="processing-overlay-3d">
        <div className="processing-modal-3d">
          <div className="processing-content-3d">
            <div className="progress-bar-container-3d">
              <div className="progress-bar-3d" style={{ width: `${progress}%` }}></div>
            </div>
            <div className="progress-message-3d">
              {Math.round(progress)}% - {processingMessage}
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  const downloadSvg = (svgContent, fileName) => {
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName || 'download.svg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const renderSvgPreview = () => {
    return (
      <div className="svg-preview-container">
        <div className="svg-layers-grid">
          {layerSvgs.map((layerSvgData) => {
            if (!layerSvgData) return null;
            return (
              <div key={layerSvgData.index} className="svg-layer-preview">
                <div className="svg-layer-header" style={{ backgroundColor: layerSvgData.color }}>
                  <span className="layer-number">レイヤー {layerSvgData.index + 1}</span>
                </div>
                <div className="svg-preview-content">
                  <div
                    className="svg-content"
                    dangerouslySetInnerHTML={{ __html: layerSvgData.svg }}
                  />
                  <button
                    className="download-svg-button"
                    onClick={() => downloadSvg(layerSvgData.svg, layerSvgData.fileName)}
                  >
                    SVGダウンロード
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="three-d-model-generator">
      {renderProgressIndicator()}
      <button
        onClick={convertLayersToSvg}
        disabled={isGenerating || layers.length === 0}
        className="start-conversion-button"
      >
        {isGenerating ? `変換中... ${progress.toFixed(0)}%` : 'SVGに変換開始'}
      </button>
      {!isGenerating && layerSvgs.length > 0 && renderSvgPreview()}
    </div>
  );
};

export default ThreeDModelGenerator;