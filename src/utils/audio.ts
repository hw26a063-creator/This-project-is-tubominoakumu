/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  // 定期実行タイマー
  private heartbeatInterval: any = null;
  private pannerNodeMap: Map<string, StereoPannerNode> = new Map();
  private monsterGainMap: Map<string, GainNode> = new Map();
  private activeOscillators: Map<string, Set<OscillatorNode>> = new Map();

  // 内部状態
  private isMuted: boolean = false;
  private currentHeartbeatRate: number = 60; // BPM

  constructor() {
    // ユーザーインタラクションにより初期化されるまで待機
  }

  private init() {
    if (this.ctx) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioContextClass();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.3, this.ctx.currentTime); // マスタ音量控えめ
      this.masterGain.connect(this.ctx.destination);
    } catch (e) {
      console.error('Web Audio API is not supported in this browser', e);
    }
  }

  public resume() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setVolume(volume: number) {
    this.init();
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(volume, this.ctx.currentTime);
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.3, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  // --- 不気味な効果音 ---

  // 懐中電灯 ON/OFF
  public playFlashlightClick() {
    this.resume();
    if (!this.ctx || this.isMuted) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.masterGain!);

    // カチッというクリック音
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.05);

    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.06);
  }

  // 足音
  public playFootstep(isDashing: boolean) {
    this.resume();
    if (!this.ctx || this.isMuted) return;

    // 低音のトントンという軽い音 + ダッシュ時は若干鋭い音
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);

    osc.type = 'sine';
    const baseFreq = isDashing ? 120 : 80;
    osc.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(10, this.ctx.currentTime + 0.12);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(150, this.ctx.currentTime);

    const volume = isDashing ? 0.25 : 0.08;
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.13);
  }

  // アイテム取得音
  public playItemCollect() {
    this.resume();
    if (!this.ctx || this.isMuted) return;

    const now = this.ctx.currentTime;
    const notes = [440, 554.37, 659.25, 880]; // A4, C#5, E5, A5
    const duration = 0.08;

    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.05);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.1, now + idx * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + duration);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(now + idx * 0.05);
      osc.stop(now + idx * 0.05 + duration);
    });
  }

  // アイテム使用音
  public playUseMedicine() {
    this.resume();
    if (!this.ctx || this.isMuted) return;

    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6 (安らぐ音)
    const duration = 0.3;

    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.08, now + idx * 0.08 + 0.05);
      gain.gain.linearRampToValueAtTime(0.001, now + idx * 0.08 + duration);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + duration);
    });
  }

  // ロッカー/ベッドに隠れる、出る
  public playHideTransition() {
    this.resume();
    if (!this.ctx || this.isMuted) return;

    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);

    // 低いバタンというドア音
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(30, this.ctx.currentTime + 0.2);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(60, this.ctx.currentTime);

    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.22);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.23);
  }

  // ベッドに入ったり出たりするガサゴソ（擦れ）音
  public playBedTransition() {
    this.resume();
    if (!this.ctx || this.isMuted) return;

    try {
      const duration = 0.4;
      const bufferSize = this.ctx.sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      
      // ホワイトノイズの生成
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const source = this.ctx.createBufferSource();
      source.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      // 布の摩擦音。300Hz-800Hzの中低域メインのバンドパスフィルターにする
      filter.frequency.setValueAtTime(400, this.ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(280, this.ctx.currentTime + duration);
      filter.Q.setValueAtTime(2.5, this.ctx.currentTime);

      const gain = this.ctx.createGain();
      
      // ガサ、ゴソ、と2回こすれる山を演出する
      const now = this.ctx.currentTime;
      gain.gain.setValueAtTime(0, now);
      
      // 1山目（ガサッ）
      gain.gain.linearRampToValueAtTime(0.25, now + 0.05);
      gain.gain.linearRampToValueAtTime(0.05, now + 0.15);
      
      // 2山目（ゴソッ）
      gain.gain.linearRampToValueAtTime(0.18, now + 0.22);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain!);

      source.start(now);
      source.stop(now + duration);
    } catch (e) {
      console.warn('Failed to play bed transition audio:', e);
    }
  }

  // 心拍音ループ開始（距離やパニック度によってテンポ自動調整）
  public startHeartbeat() {
    this.resume();
    if (this.heartbeatInterval) return;

    const tick = () => {
      this.playHeartbeatOnce();
      
      // 次の鼓動までのウェイト(BPMに基づく)
      const bpm = this.currentHeartbeatRate;
      const intervalMs = (60 / bpm) * 1000;
      this.heartbeatInterval = setTimeout(tick, intervalMs);
    };

    tick();
  }

  public setHeartbeatBPM(bpm: number) {
    // 最小50、最大180
    this.currentHeartbeatRate = Math.max(50, Math.min(180, bpm));
  }

  public stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearTimeout(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private playHeartbeatOnce() {
    if (!this.ctx || this.isMuted) return;

    const now = this.ctx.currentTime;
    
    // 心拍音は「トックン、トックン」と2回一組で鳴る
    const playStroke = (delay: number, volume: number) => {
      const osc = this.ctx!.createOscillator();
      const filter = this.ctx!.createBiquadFilter();
      const gain = this.ctx!.createGain();

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain!);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(55, now + delay); // 重低音 55Hz (A1)
      osc.frequency.exponentialRampToValueAtTime(10, now + delay + 0.15);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(90, now + delay);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(volume, now + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.16);

      osc.start(now + delay);
      osc.stop(now + delay + 0.17);
    };

    // 1回目：大きめ、2回目：やや小さく近く
    const intensity = this.currentHeartbeatRate / 120; // パニック時ほど大きくなる
    const baseVol = Math.min(0.25, 0.08 + intensity * 0.15);

    playStroke(0, baseVol);
    playStroke(0.18, baseVol * 0.7);
  }

  // --- モンスターの唸り声（3Dパンニング） ---
  // directionAngle: プレイヤーから見たモンスターの角度（radian、上が0で時計回り）
  // distanceRatio: 0 (密着) 〜 1 (遠方)
  public updateMonsterAudio(monsterId: string, type: 'HEARING' | 'LIGHT_SENSITIVE', directionAngle: number, distanceRatio: number, isChasing: boolean) {
    this.resume();
    if (!this.ctx || this.isMuted) return;

    // 1. PannerNode と GainNode をモンスターごとに作成・維持
    let panner = this.pannerNodeMap.get(monsterId);
    let gainNode = this.monsterGainMap.get(monsterId);

    if (!panner || !gainNode) {
      panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : (this.ctx as any).createPanner();
      gainNode = this.ctx.createGain();

      gainNode.connect(panner);
      panner.connect(this.masterGain!);

      this.pannerNodeMap.set(monsterId, panner);
      this.monsterGainMap.set(monsterId, gainNode);
      this.activeOscillators.set(monsterId, new Set());
    }

    // 左右パンの設定 (角度から -1:左 〜 1:右 をマッピング)
    const panValue = Math.sin(directionAngle);
    if ((panner as StereoPannerNode).pan) {
      (panner as StereoPannerNode).pan.setValueAtTime(panValue, this.ctx.currentTime);
    }

    // 距離に応じた音量減衰 (近いほどでかい)
    const baseVolume = isChasing ? 0.35 : 0.15;
    const currentGain = Math.max(0, (1 - distanceRatio)) * baseVolume;
    gainNode.gain.setValueAtTime(currentGain, this.ctx.currentTime);

    // 唸り声オシレーターの制御。一定時間ごと、または咆哮が必要なときにオシレーターを作成・駆動する
    const activeOscs = this.activeOscillators.get(monsterId)!;
    
    // まだ鳴っていない、または極めて近いときに新たな唸りを生成
    if (activeOscs.size < 2 && Math.random() < (isChasing ? 0.05 : 0.02)) {
      this.triggerGrowlEffect(monsterId, type, gainNode, isChasing);
    }
  }

  private triggerGrowlEffect(monsterId: string, type: 'HEARING' | 'LIGHT_SENSITIVE', targetNode: AudioNode, isChasing: boolean) {
    if (!this.ctx || !this.activeOscillators.has(monsterId)) return;

    const activeOscs = this.activeOscillators.get(monsterId)!;
    const now = this.ctx.currentTime;
    const duration = isChasing ? 0.8 : 1.5;

    // 唸り声を重厚にするために2重オシレーターを使う
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const pulseGain = this.ctx.createGain();

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(pulseGain);
    pulseGain.connect(targetNode);

    // 音の種類を設定
    // 盲目の聴覚モンスター：野獣のような低周波のうなり、光の幽霊：ゴーストのような高めのうなり
    const baseFreq = type === 'HEARING' ? (isChasing ? 45 : 35) : (isChasing ? 110 : 80);
    
    osc1.type = type === 'HEARING' ? 'sawtooth' : 'triangle';
    osc1.frequency.setValueAtTime(baseFreq, now);
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(baseFreq * 1.5 + (Math.random() * 5), now);

    // 周波数を揺らして気持ち悪いビブラート
    osc1.frequency.linearRampToValueAtTime(baseFreq * (isChasing ? 1.6 : 1.1), now + duration * 0.5);
    osc1.frequency.linearRampToValueAtTime(baseFreq * 0.8, now + duration);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(200, now);
    filter.frequency.exponentialRampToValueAtTime(type === 'HEARING' ? 300 : 700, now + duration * 0.4);
    filter.Q.setValueAtTime(5, now);

    pulseGain.gain.setValueAtTime(0.001, now);
    pulseGain.gain.linearRampToValueAtTime(0.15, now + 0.1);
    pulseGain.gain.linearRampToValueAtTime(0.1, now + duration * 0.5);
    pulseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    activeOscs.add(osc1);
    activeOscs.add(osc2);

    osc1.start(now);
    osc2.start(now);

    osc1.stop(now + duration);
    osc2.stop(now + duration);

    setTimeout(() => {
      activeOscs.delete(osc1);
      activeOscs.delete(osc2);
    }, duration * 1000 + 100);
  }

  // モンスターが消えた時・死んだ時にサウンドオブジェクトを破棄
  public removeMonsterAudio(monsterId: string) {
    const activeOscs = this.activeOscillators.get(monsterId);
    if (activeOscs) {
      activeOscs.forEach(o => { try { o.stop(); } catch(e){} });
      this.activeOscillators.delete(monsterId);
    }
    this.pannerNodeMap.delete(monsterId);
    this.monsterGainMap.delete(monsterId);
  }

  // すべての環境音を一時停止
  public stopAll() {
    this.stopHeartbeat();
    
    // すべてのモンスター音をリセット
    this.activeOscillators.forEach((oscs) => {
      oscs.forEach(o => { try { o.stop(); } catch(e){} });
    });
    this.activeOscillators.clear();
    this.monsterGainMap.clear();
    this.pannerNodeMap.clear();
  }

  // ゲームオーバー時の怖い音
  public playGameOverJingle() {
    this.stopAll();
    this.resume();
    if (!this.ctx || this.isMuted) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);

    // 暗転、急降下する不協和音ズシーン
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.linearRampToValueAtTime(30, now + 1.2);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(300, now);
    filter.frequency.exponentialRampToValueAtTime(50, now + 1.0);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

    osc.start(now);
    osc.stop(now + 1.6);
  }

  // ゲームクリア時の不思議な浄化チャイム
  public playClearJingle() {
    this.stopAll();
    this.resume();
    if (!this.ctx || this.isMuted) return;

    const now = this.ctx.currentTime;
    // メジャーセブンスコード
    const notes = [261.63, 329.63, 392.00, 493.88, 523.25]; // C4, E4, G4, B4, C5
    
    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.12);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.12, now + idx * 0.12 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 1.2);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(now + idx * 0.12);
      osc.stop(now + idx * 0.12 + 1.5);
    });
  }
}

export const audioManager = new AudioManager();
