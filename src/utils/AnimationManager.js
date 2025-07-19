/**
 * AnimationManager - 統一アニメーションループ管理
 * 複数のコンポーネントのrequestAnimationFrameを1つのループで管理
 * エラー処理と安全性を重視した設計
 */

class AnimationManager {
  constructor() {
    this.callbacks = new Set();
    this.isRunning = false;
    this.animationId = null;
    this.errorCount = 0;
    this.maxErrors = 10; // 最大エラー許容数
    
    // デバッグ用
    this.stats = {
      totalCallbacks: 0,
      successfulFrames: 0,
      errorFrames: 0,
      startTime: null
    };
  }

  /**
   * アニメーションコールバックを追加
   * @param {Function} callback - 毎フレーム実行される関数
   * @param {string} name - デバッグ用の名前（オプション）
   * @returns {Function} cleanup関数
   */
  addCallback(callback, name = 'anonymous') {
    if (typeof callback !== 'function') {
      console.error('AnimationManager: callback must be a function');
      return () => {}; // 安全なcleanup関数を返す
    }

    // コールバックにメタデータを付与
    const wrappedCallback = () => {
      try {
        callback();
      } catch (error) {
        console.warn(`AnimationManager: Error in callback "${name}":`, error);
        this.errorCount++;
        
        // エラーが多すぎる場合はコールバックを削除
        if (this.errorCount > this.maxErrors) {
          console.error(`AnimationManager: Too many errors, removing callback "${name}"`);
          this.removeCallback(wrappedCallback);
        }
      }
    };
    
    // デバッグ用情報を追加
    wrappedCallback._name = name;
    wrappedCallback._originalCallback = callback;
    
    this.callbacks.add(wrappedCallback);
    this.stats.totalCallbacks++;
    
    console.log(`AnimationManager: Added callback "${name}", total: ${this.callbacks.size}`);
    
    // アニメーションが停止していたら開始
    if (!this.isRunning && this.callbacks.size > 0) {
      this.start();
    }
    
    // cleanup関数を返す
    return () => this.removeCallback(wrappedCallback);
  }

  /**
   * アニメーションコールバックを削除
   * @param {Function} callback - 削除する関数
   */
  removeCallback(callback) {
    const removed = this.callbacks.delete(callback);
    if (removed) {
      const name = callback._name || 'unknown';
      console.log(`AnimationManager: Removed callback "${name}", remaining: ${this.callbacks.size}`);
    }
    
    // コールバックがなくなったら停止
    if (this.callbacks.size === 0) {
      this.stop();
    }
  }

  /**
   * アニメーションループを開始
   */
  start() {
    if (this.isRunning) {
      console.warn('AnimationManager: Already running');
      return;
    }
    
    this.isRunning = true;
    this.stats.startTime = performance.now();
    this.errorCount = 0; // エラーカウントをリセット
    
    console.log('AnimationManager: Starting animation loop');
    this.animate();
  }

  /**
   * アニメーションループを停止
   */
  stop() {
    if (!this.isRunning) {
      return;
    }
    
    this.isRunning = false;
    
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    
    const duration = this.stats.startTime ? performance.now() - this.stats.startTime : 0;
    console.log('AnimationManager: Stopped animation loop', {
      duration: `${duration.toFixed(2)}ms`,
      successfulFrames: this.stats.successfulFrames,
      errorFrames: this.stats.errorFrames
    });
  }

  /**
   * メインアニメーションループ
   */
  animate = () => {
    if (!this.isRunning) {
      return;
    }

    // 全コールバックを実行
    let frameErrors = 0;
    this.callbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        frameErrors++;
        this.stats.errorFrames++;
      }
    });
    
    if (frameErrors === 0) {
      this.stats.successfulFrames++;
    }

    // 次のフレームをスケジュール
    if (this.isRunning && this.callbacks.size > 0) {
      this.animationId = requestAnimationFrame(this.animate);
    } else {
      this.stop();
    }
  }

  /**
   * 現在の状態を取得（デバッグ用）
   */
  getStats() {
    return {
      ...this.stats,
      callbackCount: this.callbacks.size,
      isRunning: this.isRunning,
      errorCount: this.errorCount
    };
  }

  /**
   * 全てのコールバックをクリア
   */
  clear() {
    console.log('AnimationManager: Clearing all callbacks');
    this.callbacks.clear();
    this.stop();
  }
}

// シングルトンインスタンスを作成
const animationManager = new AnimationManager();

// デバッグ用にwindowオブジェクトに追加
if (typeof window !== 'undefined') {
  window.animationManager = animationManager;
}

export default animationManager;