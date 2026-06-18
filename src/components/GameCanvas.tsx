/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { Play, RotateCcw, Volume2, VolumeX, Eye, EyeOff, Radio, Smartphone, HelpCircle } from 'lucide-react';
import { GameMap, Player, Monster, Item, HideSpot, Obstacle, GameState } from '../types';
import { audioManager } from '../utils/audio';

interface GameCanvasProps {
  isPaused: boolean;
  onPauseToggle: () => void;
  playerState: Player;
  setPlayerState: React.Dispatch<React.SetStateAction<Player>>;
  map: GameMap;
  setMap: React.Dispatch<React.SetStateAction<GameMap>>;
  onGameOver: () => void;
  onGameClear: () => void;
}

export default function GameCanvas({
  isPaused,
  onPauseToggle,
  playerState,
  setPlayerState,
  map,
  setMap,
  onGameOver,
  onGameClear
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // つぼみちゃんのスプライト画像をロード（tubomi2.pngを最優先、なければtubomi1.pngにフォールバック、白背景は自動的に透過カット処理）
  const tubomiImageRef = useRef<HTMLImageElement | HTMLCanvasElement | null>(null);
  const [tubomiLoaded, setTubomiLoaded] = useState<boolean>(false);

  // 外周から連結している白背景をBFS（幅優先探索）で検出し、さらに境界部分にアンチエイリアスのエッジスムージング（半透明フェザー処理）を適用して、白いチラつきを完全に除去するプロフェッショナル背景透過システム
  const removeWhiteBackground = (img: HTMLImageElement): HTMLCanvasElement => {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    ctx.drawImage(img, 0, 0);

    try {
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      const w = canvas.width;
      const h = canvas.height;

      // 3x3分割のセルの大きさを予測
      const cellW = w / 3;
      const cellH = h / 3;
      const clearTopHeight = 82; // 確実にキャラクターの頭（リボン）を傷つけず、文字を完全に除去する高さ

      // 前処理：各セルの上部 82px にある方向指示文字（「前」「後」など）を完全に透明化する
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          for (let cy = 0; cy < clearTopHeight; cy++) {
            for (let cx = 0; cx < cellW; cx++) {
              const px = Math.floor(c * cellW + cx);
              const py = Math.floor(r * cellH + cy);
              if (px < w && py < h) {
                const idx = (py * w + px) * 4;
                // 純粋な透明白に事前に塗りつぶすことで、描画されるのを100%防ぎ、白背景BFSの伝播を助けます
                data[idx] = 255;
                data[idx + 1] = 255;
                data[idx + 2] = 255;
                data[idx + 3] = 0;
              }
            }
          }
        }
      }

      // 訪問済みフラグ (0: 未訪問, 1: 訪問済み/背景部分として確定)
      const visited = new Uint8Array(w * h);
      const queue: number[] = [];

      // 許容閾値を広めに設定（明るさが180以上の「白に近いアンチエイリアスの濁り」まで外周から繋がっていれば透過背景とする）
      const threshold = 75; // 255 - 75 = 180
      const isWhiteLike = (idx: number): boolean => {
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const a = data[idx + 3];
        if (a < 10) return false; // すでにほぼ透明なピクセルはスキップ

        return r >= 180 && g >= 180 && b >= 180;
      };

      // 外周ピクセル（最上列、最下列、最左列、最右列）から探索を開始
      for (let x = 0; x < w; x++) {
        // 最上列
        let idxTop = x * 4;
        if (isWhiteLike(idxTop)) {
          queue.push(x);
          visited[x] = 1;
        }
        // 最下列
        const botOfs = (h - 1) * w + x;
        let idxBot = botOfs * 4;
        if (isWhiteLike(idxBot)) {
          queue.push(botOfs);
          visited[botOfs] = 1;
        }
      }

      for (let y = 1; y < h - 1; y++) {
        // 最左列
        const leftOfs = y * w;
        let idxLeft = leftOfs * 4;
        if (isWhiteLike(idxLeft)) {
          queue.push(leftOfs);
          visited[leftOfs] = 1;
        }
        // 最右列
        const rightOfs = y * w + w - 1;
        let idxRight = rightOfs * 4;
        if (isWhiteLike(idxRight)) {
          queue.push(rightOfs);
          visited[rightOfs] = 1;
        }
      }

      // BFS探索による洪水流 (Flood Fill) 実装 - 連結した白背景を全て特定
      let head = 0;
      while (head < queue.length) {
        const curr = queue[head++];
        const cx = curr % w;
        const cy = Math.floor(curr / w);

        // 対象ピクセルを完全に透明化
        const pixelIdx = curr * 4;
        data[pixelIdx + 3] = 0;

        // 4近傍を走査
        const neighbors = [
          [cx - 1, cy],
          [cx + 1, cy],
          [cx, cy - 1],
          [cx, cy + 1]
        ];

        for (let i = 0; i < neighbors.length; i++) {
          const nx = neighbors[i][0];
          const ny = neighbors[i][1];
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            const nofs = ny * w + nx;
            if (visited[nofs] === 0) {
              const nidx = nofs * 4;
              if (isWhiteLike(nidx)) {
                queue.push(nofs);
                visited[nofs] = 1;
              }
            }
          }
        }
      }

      // 【超高画質化・エッジスムージング処理】
      // 背景透過（visited === 1）に隣接するキャラクターの「フチ（輪郭線）」付近のピクセルをなめらかにフェザー処理します。
      // これにより、縮小描画されたときの白いチラつき（アンチエイリアスのゴミ残り）を100%消失させます。
      const edgeRadius = 2; // 周囲2ピクセルまでチェックしてフェザー化
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const ofs = y * w + x;
          if (visited[ofs] === 1) continue; // すでに完全に背景として透明化した部分はスキップ

          const idx = ofs * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const a = data[idx + 3];
          if (a === 0) continue;

          // このピクセルが透明化された背景領域に近接しているか調査
          let isNearTransparent = false;
          for (let dy = -edgeRadius; dy <= edgeRadius; dy++) {
            for (let dx = -edgeRadius; dx <= edgeRadius; dx++) {
              const nx = x + dx;
              const ny = y + dy;
              if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                if (visited[ny * w + nx] === 1) {
                  isNearTransparent = true;
                  break;
                }
              }
            }
            if (isNearTransparent) break;
          }

          if (isNearTransparent) {
            // 境界付近で白に近い明るい色（RGB値が高めのアンチエイリアス部分）を滑らかにブレンド
            const avg = (r + g + b) / 3;
            if (avg > 130) {
              // avgが130〜255の間で滑らかにアルファ（不透明度）を落とし、グラデーション透過させます。
              const ratio = Math.max(0, Math.min(1, (255 - avg) / (255 - 130)));
              data[idx + 3] = Math.floor(a * ratio * 0.82); // 境界のなじみをさらに良くするため、少しだけアルファを絞る
            }
          }
        }
      }

      ctx.putImageData(imgData, 0, 0);
      console.log(`BFS clear bg count: ${queue.length} pixels transparentized with high-quality edge smoothing.`);
    } catch (e) {
      console.warn("BFS Background removal failed, falling back to safe simple filter:", e);
      // 万が一 CORS 設定等でブラウザ制限が発生した場合のフォールバック・シンプルなピクセル透過フィルタ
      try {
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
          const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
          if (avg > 200) {
            data[i + 3] = 0;
          }
        }
        ctx.putImageData(imgData, 0, 0);
      } catch (e2) {
        console.error("Fallback simple filter failed:", e2);
      }
    }

    return canvas;
  };

  useEffect(() => {
    const img2 = new Image();
    img2.crossOrigin = 'anonymous'; // CORSの制約を回避するため追加
    
    // イベントハンドラーを先に設定してロード競合やキャッシュでの失敗を回避
    img2.onload = () => {
      console.log("Successfully loaded /tubomi2.png. Stripping white background...");
      const processed = removeWhiteBackground(img2);
      tubomiImageRef.current = processed;
      setTubomiLoaded(true);
    };
    
    img2.onerror = () => {
      console.log("Failed to load /tubomi2.png, trying fallback to /tubomi1.png");
      const img1 = new Image();
      img1.crossOrigin = 'anonymous'; // CORSの制約を回避するため追加
      img1.onload = () => {
        console.log("Successfully loaded /tubomi1.png as fallback. Stripping white background...");
        const processed = removeWhiteBackground(img1);
        tubomiImageRef.current = processed;
        setTubomiLoaded(true);
      };
      img1.onerror = (e) => {
        console.warn("Failed to load both /tubomi2.png and /tubomi1.png. Falling back to vector graphics.", e);
      };
      img1.src = '/tubomi1.png';
    };

    // ロード開始
    img2.src = '/tubomi2.png';
  }, []);
  
  // モンスターの状態
  const [monsters, setMonsters] = useState<Monster[]>([]);
  
  // 最新の値をリアルタイムゲームループ層へ Stale させずに渡すための Ref
  const playerStateRef = useRef<Player>(playerState);
  const monstersRef = useRef<Monster[]>(monsters);
  const mapRef = useRef<GameMap>(map);
  const isPausedRef = useRef<boolean>(isPaused);
  const hudSyncCounter = useRef<number>(0);

  // 外部（リスタート、リスポーン、ベッド隠れ/脱出、ライトスイッチング、薬使用など）による状態変化を検知して Ref を同期
  const lastX = useRef<number>(playerState.x);
  const lastY = useRef<number>(playerState.y);
  const isLocalCoords = Math.abs(playerState.x - playerStateRef.current.x) < 8 && Math.abs(playerState.y - playerStateRef.current.y) < 8;
  const otherStatesMatch = 
    playerState.isHiding === playerStateRef.current.isHiding &&
    playerState.flashlightOn === playerStateRef.current.flashlightOn &&
    playerState.smallMedsCount === playerStateRef.current.smallMedsCount &&
    playerState.largeMedsCount === playerStateRef.current.largeMedsCount &&
    playerState.san === playerStateRef.current.san;

  if (!isLocalCoords || !otherStatesMatch || (playerState.x === 65 && playerState.y === 95)) {
    playerStateRef.current = playerState;
  }
  lastX.current = playerState.x;
  lastY.current = playerState.y;

  monstersRef.current = monsters;
  mapRef.current = map;
  isPausedRef.current = isPaused;
  
  const lastFootstepTime = useRef<number>(0);
  const lastHidingToggleTime = useRef<number>(0);
  
  // 操作入力状態
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  
  // スマホ操作のタッチ状態
  const joystickCenter = useRef<{ x: number; y: number } | null>(null);
  const joystickCurrent = useRef<{ x: number; y: number } | null>(null);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [touchDashing, setTouchDashing] = useState<boolean>(false);

  // パニック状態かどうかのクライアント側ステート（UI表示や心拍変更用）
  const [panicLevel, setPanicLevel] = useState<number>(0); // 0 (安全) 〜 100 (最大)
  const isBreathless = useRef<boolean>(false);
  const breathlessTimer = useRef<number>(0);

  // 初回プレイヤーセットアップ ＆ モンスター生成、デバイス検知
  useEffect(() => {
    // デバイス簡易検知
    const checkMobile = () => {
      setIsMobile('ontouchstart' in window || navigator.maxTouchPoints > 0);
    };
    checkMobile();

    // モンスターの初期化 (2種類 x 2体 = 4体配置)
    const initialMonsters: Monster[] = [
      // 1. 盲目の聴覚モンスターA (北東エリア巡回)
      {
        id: 'monster_hearing_1',
        type: 'HEARING',
        x: 950,
        y: 250,
        speed: 1.2,
        angle: 0,
        state: 'PATROL',
        targetX: 950,
        targetY: 250,
        patrolPath: [
          { x: 950, y: 150 },
          { x: 1100, y: 150 },
          { x: 1100, y: 400 },
          { x: 800, y: 400 },
          { x: 800, y: 250 },
        ],
        patrolIndex: 0,
        searchTimer: 0
      },
      // 2. 盲目の聴覚モンスターB (南西エリア巡回)
      {
        id: 'monster_hearing_2',
        type: 'HEARING',
        x: 250,
        y: 950,
        speed: 1.2,
        angle: Math.PI,
        state: 'PATROL',
        targetX: 250,
        targetY: 950,
        patrolPath: [
          { x: 250, y: 950 },
          { x: 150, y: 950 },
          { x: 150, y: 750 },
          { x: 450, y: 750 },
          { x: 450, y: 950 },
        ],
        patrolIndex: 0,
        searchTimer: 0
      },
      // 3. 光を嫌う幽霊A (南東エリア巡回)
      {
        id: 'monster_light_1',
        type: 'LIGHT_SENSITIVE',
        x: 950,
        y: 950,
        speed: 0.9,
        angle: Math.PI / 2,
        state: 'PATROL',
        targetX: 950,
        targetY: 950,
        patrolPath: [
          { x: 950, y: 950 },
          { x: 950, y: 700 },
          { x: 1100, y: 700 },
          { x: 1100, y: 1050 },
          { x: 800, y: 1050 },
        ],
        patrolIndex: 0,
        searchTimer: 0
      },
      // 4. 光を嫌う幽霊B (廊下中央など広く浮遊)
      {
        id: 'monster_light_2',
        type: 'LIGHT_SENSITIVE',
        x: 600,
        y: 350,
        speed: 0.8,
        angle: 0,
        state: 'PATROL',
        targetX: 600,
        targetY: 350,
        patrolPath: [
          { x: 600, y: 350 },
          { x: 300, y: 350 },
          { x: 300, y: 200 },
          { x: 900, y: 200 },
          { x: 900, y: 350 },
        ],
        patrolIndex: 0,
        searchTimer: 0
      }
    ];

    setMonsters(initialMonsters);
    monstersRef.current = initialMonsters;
    audioManager.resume();
    audioManager.setHeartbeatBPM(60);
    audioManager.startHeartbeat();

    return () => {
      audioManager.stopAll();
    };
  }, []);

  // キーボードイベントのバインド
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const key = e.key.toLowerCase();
      
      // ポーズ（Esc）
      if (key === 'escape') {
        e.preventDefault();
        onPauseToggle();
        return;
      }

      // ライト切り替え (F / Space)
      if (key === 'f' || key === ' ') {
        e.preventDefault();
        if (!isPaused && !playerState.isHiding) {
          audioManager.playFlashlightClick();
          setPlayerState(prev => ({
            ...prev,
            flashlightOn: !prev.flashlightOn
          }));
        }
      }

      // 隠れる / 出る (E)
      if (key === 'e') {
        e.preventDefault();
        if (!isPaused) {
          toggleHidingState();
        }
        return;
      }

      keysPressed.current[key] = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      keysPressed.current[key] = false;
    };

    const handleBlur = () => {
      keysPressed.current = {};
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [isPaused, playerState.isHiding, onPauseToggle, toggleHidingState]);

  // モニター用：心音のテンポ制御 ＆ SAN値の自然減少等のゲームループ
  useEffect(() => {
    if (isPaused) {
      audioManager.stopAll();
      return;
    }
    
    audioManager.startHeartbeat();

    let lastTime = performance.now();
    let animationFrameId: number;

    const gameLoop = (time: number) => {
      const deltaTime = (time - lastTime) / 1000; // 秒に変換
      lastTime = time;

      // 瞬間的な長遅延での大ジャンプ・すり抜けを抑制 (最大100ms)
      const cappedDt = Math.min(deltaTime, 0.1);

      updateGame(cappedDt);
      renderGame();

      animationFrameId = requestAnimationFrame(gameLoop);
    };

    animationFrameId = requestAnimationFrame(gameLoop);
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPaused]);

  // --- ゲーム更新ロジック ---
  const updateGame = (dt: number) => {
    if (isPaused) return;

    const player = playerStateRef.current;
    const monsters = monstersRef.current;
    const map = mapRef.current;

    // 1. スタミナと息切れの処理
    if (isBreathless.current) {
      breathlessTimer.current -= dt;
      if (breathlessTimer.current <= 0) {
        isBreathless.current = false;
      }
    }

    // 2. 移動ベクトルの算出 (PCキー入力 & スマホジョイスティック)
    let dx = 0;
    let dy = 0;

    if (!player.isHiding) {
      if (keysPressed.current['w'] || keysPressed.current['arrowup']) dy -= 1;
      if (keysPressed.current['s'] || keysPressed.current['arrowdown']) dy += 1;
      if (keysPressed.current['a'] || keysPressed.current['arrowleft']) dx -= 1;
      if (keysPressed.current['d'] || keysPressed.current['arrowright']) dx += 1;

      // スマホジョイスティック入力の上書き
      if (joystickCenter.current && joystickCurrent.current) {
        const jx = joystickCurrent.current.x - joystickCenter.current.x;
        const jy = joystickCurrent.current.y - joystickCenter.current.y;
        const dist = Math.hypot(jx, jy);
        if (dist > 5) {
          dx = jx / dist;
          dy = jy / dist;
        }
      }
    }

    let isMoving = dx !== 0 || dy !== 0;

    // ダッシュ判定 (Shiftキー or スマホタッチダッシュ)
    const shiftPressed = keysPressed.current['shift'];
    const wantToDash = (shiftPressed || touchDashing) && isMoving && !isBreathless.current && !player.isHiding;
    
    // パニック検知
    let closestDistToMonster = 9999;
    let activeChasing = false;

    monsters.forEach(m => {
      const dist = Math.hypot(m.x - player.x, m.y - player.y);
      if (dist < closestDistToMonster) closestDistToMonster = dist;
      if (m.state === 'CHASE') activeChasing = true;
    });

    // 恐怖によるパニック具合。距離250px以下で徐々にパニック
    const threatDist = 280;
    let computedPanic = 0;
    if (closestDistToMonster < threatDist) {
      computedPanic = (1 - (closestDistToMonster / threatDist)) * 100;
    }
    setPanicLevel(computedPanic);

    // パニックレベルに合わせて心音BPMを変更 (最小60BPM 〜 最大180BPM)
    const heartBpm = 60 + (computedPanic / 100) * 120;
    audioManager.setHeartbeatBPM(heartBpm);

    // スタミナの増減
    let nextStamina = player.stamina;
    const staminaDrainNormal = 16 * dt; // 1秒間に16消費
    const staminaDrainPanic = 32 * dt;  // パニック時は2倍消費
    
    if (wantToDash) {
      const drain = activeChasing || computedPanic > 30 ? staminaDrainPanic : staminaDrainNormal;
      nextStamina = Math.max(0, player.stamina - drain);
      if (nextStamina <= 0) {
        isBreathless.current = true;
        breathlessTimer.current = 2.5; // 2.5秒息切れ
        audioManager.playFlashlightClick(); // パリッとした息切れ感
      }
    } else {
      nextStamina = Math.min(100, player.stamina + 25 * dt); // 1秒間に25回復
    }

    // プレイヤー速度決定
    let speed = 0;
    if (isMoving && !player.isHiding) {
      speed = wantToDash ? 130 * dt : 65 * dt; // 通常時 65px/s、ダッシュ時 130px/s
    }

    // 足音音響の定期生成
    const footstepRate = wantToDash ? 0.3 : 0.6; // ダッシュ時は0.3秒おき、歩きは0.6秒おき
    const now = performance.now();
    if (isMoving && !player.isHiding) {
      if (now - lastFootstepTime.current > footstepRate * 1000) {
        audioManager.playFootstep(wantToDash);
        lastFootstepTime.current = now;
      }
    }

    // 3. プレイヤー位置の更新（壁との衝突判定）
    let nextX = player.x;
    let nextY = player.y;
    let playerAngle = player.angle;

    if (isMoving && speed > 0) {
      // 三角形正規化
      const length = Math.hypot(dx, dy);
      const moveX = (dx / length) * speed;
      const moveY = (dy / length) * speed;

      playerAngle = Math.atan2(dy, dx);

      // X方向の当たり判定
      if (!checkCollision(player.x + moveX, player.y, 12)) {
        nextX = player.x + moveX;
      }
      // Y方向の当たり判定
      if (!checkCollision(nextX, player.y + moveY, 12)) {
        nextY = player.y + moveY;
      }

      // マップ端制限
      nextX = Math.max(15, Math.min(map.width - 15, nextX));
      nextY = Math.max(15, Math.min(map.height - 15, nextY));
    }

    // SAN値（正気度）の減少
    // モンスターに追われている、または急接近しているとゆっくりSAN値が減る (パニック状態が30%以上のとき)
    let nextSan = player.san;
    if (!player.isHiding) {
      if (activeChasing) {
        nextSan = Math.max(0, player.san - 6 * dt); // 追跡時は1秒に6%減少
      } else if (computedPanic > 20) {
        nextSan = Math.max(0, player.san - (computedPanic / 100) * 3 * dt);
      }
    }

    // SAN値が0になるとその場でゲームオーバー
    if (nextSan <= 0) {
      audioManager.playGameOverJingle();
      onGameOver();
      return;
    }

    // 4. モンスターAIの更新
    const updatedMonsters = monsters.map(m => {
      let mX = m.x;
      let mY = m.y;
      let mState = m.state;
      let mSpeed = m.speed;
      let mTargetX = m.targetX;
      let mTargetY = m.targetY;
      let mPatrolIndex = m.patrolIndex;
      let mSearchTimer = m.searchTimer;
      let mLastKnownPlayerX = m.lastKnownPlayerX;
      let mLastKnownPlayerY = m.lastKnownPlayerY;

      const distToPlayer = Math.hypot(mX - player.x, mY - player.y);

      // --- 全モンスター共通：プレイヤーと衝突したら捕獲ゲームオーバー ---
      if (distToPlayer < 18 && !player.isHiding) {
        // 即座にゲームオーバー
        audioManager.playGameOverJingle();
        onGameOver();
      }

      // 隠れている時の追跡遮断
      if (player.isHiding && mState === 'CHASE') {
        mState = 'SEARCH';
        mSearchTimer = 3.0; // 3秒うろうろして見失う
        mTargetX = player.x + (Math.random() * 80 - 40);
        mTargetY = player.y + (Math.random() * 80 - 40);
      }

      // --- 各モンスター特有の索敵ロジック ---
      if (m.type === 'HEARING') {
        // 盲目の聴覚モンスター：プレイヤーが走り(Dash)、かつ近接距離450px以内にいるとき、その方向を察知
        if (wantToDash && distToPlayer < 450 && !player.isHiding) {
          mState = 'CHASE';
          mTargetX = player.x;
          mTargetY = player.y;
          mLastKnownPlayerX = player.x;
          mLastKnownPlayerY = player.y;
        }
      } else if (m.type === 'LIGHT_SENSITIVE') {
        // 光を嫌う幽霊：プレイヤーの懐中電灯ON、かつ幽霊がプレイヤーの懐中電灯錐体（扇形）の中にいると怒る
        if (player.flashlightOn && !player.isHiding && distToPlayer < 240) {
          // 懐中電灯のビーム範囲に入っているかを角度で判定
          // プレイヤーとモンスターの角度
          const angleToMonster = Math.atan2(mY - player.y, mX - player.x);
          let angleDiff = Math.abs(angleToMonster - playerAngle);
          // 角度差を補正
          if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;

          // 懐中電灯の照射角度（約35度 = 0.6ラジアン)
          if (angleDiff < 0.6) {
            // 壁に遮られていないかもチェック
            const hitWall = checkLineOfSightCollision(player.x, player.y, mX, mY);
            if (!hitWall) {
              mState = 'CHASE';
              mTargetX = player.x;
              mTargetY = player.y;
              mLastKnownPlayerX = player.x;
              mLastKnownPlayerY = player.y;
            }
          }
        }
      }

      // --- 状態ごとの行動処理 ---
      if (mState === 'CHASE') {
        mSpeed = m.type === 'HEARING' ? 1.9 : 1.5; // 聴覚タイプは突進が超絶速い、幽霊もそこそこ速い
        
        // 常に最新のプレイヤー座標に向かい続ける（見えている／聞いている間はリアルタイム追跡）
        if (!player.isHiding) {
          mTargetX = player.x;
          mTargetY = player.y;
          mLastKnownPlayerX = player.x;
          mLastKnownPlayerY = player.y;
        }

        // あまりにもプレイヤーから遠ざかったら見失う (3)
        if (distToPlayer > 480) {
          mState = 'SEARCH';
          mSearchTimer = 3.5;
        }
      } else if (mState === 'SEARCH') {
        mSpeed = 0.7; // 捜索中はゆっくりキョロキョロ
        mSearchTimer -= dt;

        // 捜索目標についたら、その付近にランダムに次の捜索先をセット
        if (Math.hypot(mX - mTargetX, mY - mTargetY) < 12) {
          if (mLastKnownPlayerX !== undefined && mLastKnownPlayerY !== undefined) {
            mTargetX = mLastKnownPlayerX + (Math.random() * 120 - 60);
            mTargetY = mLastKnownPlayerY + (Math.random() * 120 - 60);
          }
        }

        if (mSearchTimer <= 0) {
          mState = 'PATROL';
          // 近くのパトロールノードに復帰
          mTargetX = m.patrolPath[mPatrolIndex].x;
          mTargetY = m.patrolPath[mPatrolIndex].y;
        }
      } else {
        // PATROL (通常状態)
        mSpeed = m.type === 'HEARING' ? 0.9 : 0.65; // 聞き耳は早歩き、幽霊はゆらゆら
        const currentPatrolNode = m.patrolPath[mPatrolIndex];
        mTargetX = currentPatrolNode.x;
        mTargetY = currentPatrolNode.y;

        // ノード到達判定
        if (Math.hypot(mX - mTargetX, mY - mTargetY) < 10) {
          mPatrolIndex = (mPatrolIndex + 1) % m.patrolPath.length;
          const nextNode = m.patrolPath[mPatrolIndex];
          mTargetX = nextNode.x;
          mTargetY = nextNode.y;
        }
      }

      // 位置移動
      const toTargetAngle = Math.atan2(mTargetY - mY, mTargetX - mX);
      const mvX = Math.cos(toTargetAngle) * mSpeed * 50 * dt;
      const mvY = Math.sin(toTargetAngle) * mSpeed * 50 * dt;

      // モンスターは壁を擦り抜けられる幽霊、または壁衝突のある聴覚タイプで分ける
      if (m.type === 'HEARING') {
        // 聴覚モンスターは壁にぶつかる
        if (!checkCollision(mX + mvX, mY, 14)) {
          mX += mvX;
        } else {
          // 壁にあたったらランダムにパトロール先を切り替えて這いずり方向転換
          if (mState === 'PATROL') {
            mPatrolIndex = (mPatrolIndex + 1) % m.patrolPath.length;
          }
        }
        if (!checkCollision(mX, mY + mvY, 14)) {
          mY += mvY;
        }
      } else {
        // 幽霊はすり抜ける（病院らしくすり抜け浮遊するので極めて恐ろしい！）
        mX += mvX;
        mY += mvY;
      }

      const currentAngle = toTargetAngle;

      // --- 音響情報（3Dパンニング）の更新 ---
      // プレイヤーからモンスターの方向と距離比
      const hearingMaxRange = 400;
      const mRelAngle = Math.atan2(mY - player.y, mX - player.x) - playerAngle;
      const distRatio = Math.min(1, distToPlayer / hearingMaxRange);
      
      audioManager.updateMonsterAudio(
        m.id, 
        m.type, 
        mRelAngle, 
        distRatio, 
        mState === 'CHASE'
      );

      return {
        ...m,
        x: mX,
        y: mY,
        angle: currentAngle,
        state: mState,
        speed: mSpeed,
        targetX: mTargetX,
        targetY: mTargetY,
        patrolIndex: mPatrolIndex,
        searchTimer: mSearchTimer,
        lastKnownPlayerX: mLastKnownPlayerX,
        lastKnownPlayerY: mLastKnownPlayerY
      };
    });

    monstersRef.current = updatedMonsters;

    // 5. アイテムの回収 ＆ 隠れスポットの遷移
    let nextSmallMeds = player.smallMedsCount;
    let nextLargeMeds = player.largeMedsCount;
    const nextKeysCollected = [...player.keysCollected];

    // マップ上の残アイテム衝突判定
    const updatedItems = map.items.map(item => {
      if (item.collected) return item;

      // プレイヤーとアイテムの近接距離
      const d = Math.hypot(item.x - nextX, item.y - nextY);
      if (d < 22 && !player.isHiding) {
        audioManager.playItemCollect();
        
        // 進捗セーブのフラグ
        let shouldTriggerSave = false;

        if (item.type === 'SMALL_MEDICINE') {
          nextSmallMeds++;
        } else if (item.type === 'LARGE_MEDICINE') {
          nextLargeMeds++;
        } else if (item.type === 'KEY_PIECE') {
          // どのピースか (ID末尾から判定 0〜3)
          const indexIdx = parseInt(item.id.replace('key_piece_', ''), 10);
          if (!isNaN(indexIdx) && indexIdx >= 0 && indexIdx < 4) {
            nextKeysCollected[indexIdx] = true;
            shouldTriggerSave = true; // 鍵取得時にセーブ
          }
        }

        // セーブ処理
        let saveCoords = {
          saveX: player.saveX,
          saveY: player.saveY,
          saveKeys: player.saveKeysCollected,
          saveSm: player.saveSmallMedsCount,
          saveLg: player.saveLargeMedsCount
        };

        if (shouldTriggerSave) {
          // 鍵を拾った部屋を新しい復活セーブポイントとする
          // 最も近いベッドの位置をセーブ地点に指定（自動ベッドセーブ）
          let closestBed = map.hideSpots[0]; // 初期値
          let minBedD = 99999;
          map.hideSpots.forEach(h => {
            const hD = Math.hypot(h.x - item.x, h.y - item.y);
            if (hD < minBedD) {
              minBedD = hD;
              closestBed = h;
            }
          });
          // ベッドの少し正面にセーブ座標
          saveCoords.saveX = closestBed.x + closestBed.width / 2;
          saveCoords.saveY = closestBed.y + closestBed.height + 25;
          saveCoords.saveKeys = [...nextKeysCollected];
          saveCoords.saveSm = nextSmallMeds;
          saveCoords.saveLg = nextLargeMeds;
        }

        player.smallMedsCount = nextSmallMeds;
        player.largeMedsCount = nextLargeMeds;
        player.keysCollected = nextKeysCollected;
        if (shouldTriggerSave) {
          player.saveX = saveCoords.saveX;
          player.saveY = saveCoords.saveY;
          player.saveKeysCollected = saveCoords.saveKeys;
          player.saveSmallMedsCount = saveCoords.saveSm;
          player.saveLargeMedsCount = saveCoords.saveLg;
        }

        return { ...item, collected: true };
      }
      return item;
    });

    if (JSON.stringify(updatedItems) !== JSON.stringify(map.items)) {
      setMap(prev => ({ ...prev, items: updatedItems }));
    }

    // 6. 脱出条件（4つのピースをすべて持ち中央扉 (600,600) に入る）
    const allKeysCollected = nextKeysCollected.every(k => k === true);
    if (allKeysCollected) {
      const exitDist = Math.hypot(nextX - map.exitX, nextY - map.exitY);
      if (exitDist < 35) {
        audioManager.playClearJingle();
        onGameClear();
        return;
      }
    }

    // 更新値をプレイヤー状態に上書き
    player.x = nextX;
    player.y = nextY;
    player.angle = playerAngle;
    player.stamina = nextStamina;
    player.san = nextSan;

    // React HUD 同期の Throttling (3フレームに1回)
    hudSyncCounter.current++;
    if (hudSyncCounter.current >= 3) {
      hudSyncCounter.current = 0;
      setPlayerState({
        ...player
      });
    }
  };

  // 隠れる/出るの切り替え
  function toggleHidingState() {
    const now = performance.now();
    if (now - lastHidingToggleTime.current < 500) {
      return; // 500ms以内の連続押下（チャタリング）を防止
    }
    lastHidingToggleTime.current = now;

    const map = mapRef.current;
    const p = playerStateRef.current;
    let nextPlayerState = { ...p };

    if (p.isHiding) {
      // 外に出る
      audioManager.playHideTransition();
      const spot = map.hideSpots.find(h => h.id === p.hidingInId);
      let outX = p.x;
      let outY = p.y;
      if (spot) {
        if (spot.type === 'BED') {
          outX = spot.x + spot.width / 2;
          outY = spot.y + spot.height + 25;
        } else {
          outX = spot.x + spot.width / 2;
          outY = spot.y + spot.height + 22;
        }
      }
      nextPlayerState = {
        ...p,
        x: outX,
        y: outY,
        isHiding: false,
        hidingInId: null
      };
    } else {
      // 付近に隠れスポットがあるか探す
      const spot = map.hideSpots.find(h => {
        // スポットの矩形境界に対するプレイヤーの最短距離を計算
        const closestX = Math.max(h.x, Math.min(p.x, h.x + h.width));
        const closestY = Math.max(h.y, Math.min(p.y, h.y + h.height));
        const d = Math.hypot(p.x - closestX, p.y - closestY);
        // 境界から45px以内ならスムーズに入れるように判定を緩和
        return d < 45;
      });

      if (spot) {
        audioManager.playHideTransition();
        // モンスターが近くにいる状態で隠れた場合、少し離れた位置をモンスターの追跡目標にする（追跡遮断）
        nextPlayerState = {
          ...p,
          isHiding: true,
          hidingInId: spot.id,
          flashlightOn: false, // 隠れるときは自動でライトを消す
          x: spot.x + spot.width / 2, // スポット中心に固定
          y: spot.y + spot.height / 2
        };
      }
    }

    // Ref と React State を同時に即時更新
    playerStateRef.current = nextPlayerState;
    setPlayerState(nextPlayerState);
  }

  // 1本線の遮蔽物チェック（光のレイとモンスターの間に壁があるか）
  const checkLineOfSightCollision = (x1: number, y1: number, x2: number, y2: number): boolean => {
    // 粗いレイキャスト
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.floor(dist / 10);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const rx = x1 + (x2 - x1) * t;
      const ry = y1 + (y2 - y1) * t;
      if (checkCollision(rx, ry, 6)) {
        return true; // 壁に衝突した
      }
    }
    return false;
  };

  // 外枠や障害物との衝突判定
  const checkCollision = (px: number, py: number, radius: number): boolean => {
    const map = mapRef.current;
    // マップ境界
    if (px - radius < 0 || px + radius > map.width || py - radius < 0 || py + radius > map.height) {
      return true;
    }

    for (let i = 0; i < map.obstacles.length; i++) {
      const obs = map.obstacles[i];
      // 矩形との距離
      const closestX = Math.max(obs.x, Math.min(px, obs.x + obs.width));
      const closestY = Math.max(obs.y, Math.min(py, obs.y + obs.height));
      const distanceX = px - closestX;
      const distanceY = py - closestY;
      const distanceSquared = (distanceX * distanceX) + (distanceY * distanceY);
      
      if (distanceSquared < (radius * radius)) {
        return true; // 衝突あり
      }
    }
    return false;
  };

  // --- HTML5 CANVAS 描画処理 ---
  const renderGame = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const playerState = playerStateRef.current;
    const monsters = monstersRef.current;
    const map = mapRef.current;

    // Viewportの中心をプレイヤー座標(x, y)に合わせるためのオフセット
    const viewWidth = canvas.width;
    const viewHeight = canvas.height;
    
    // カメラの追従
    const cameraX = Math.max(viewWidth / 2, Math.min(map.width - viewWidth / 2, playerState.x));
    const cameraY = Math.max(viewHeight / 2, Math.min(map.height - viewHeight / 2, playerState.y));

    const transX = viewWidth / 2 - cameraX;
    const transY = viewHeight / 2 - cameraY;

    // 1. 背景の塗りつぶし（コンクリートの不気味な薄汚れ床）
    ctx.fillStyle = '#0c0a09'; // ほぼ漆黒に近いブラウン
    ctx.fillRect(0, 0, viewWidth, viewHeight);

    // カメラトランスフォームの開始
    ctx.save();
    ctx.translate(transX, transY);

    // リノリウム／病院の古いタイルフロア風のライン描画
    ctx.strokeStyle = '#1c1917';
    ctx.lineWidth = 1;
    const tileSize = 60;
    for (let x = 0; x < map.width; x += tileSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, map.height);
      ctx.stroke();
    }
    for (let y = 0; y < map.height; y += tileSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(map.width, y);
      ctx.stroke();
    }

    // 部屋名テキストなどをうっすら描画（ホラー演出）
    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = 'rgba(120,113,108,0.15)';
    ctx.fillText("隔離室 // W-102", 100, 100);
    ctx.fillText("ナースステーション", 510, 480);
    ctx.fillText("手術室 // AREA-B", 920, 150);
    ctx.fillText("薬品保管庫", 930, 800);
    ctx.fillText("患者A・B大部屋", 150, 750);
    ctx.fillText("中央脱出扉", 565, 545);

    // 2. 脱出扉（中央）を描画
    ctx.fillStyle = '#2d060e'; // 錆びついて血のにじんだ赤扉
    ctx.fillRect(map.exitX - 30, map.exitY - 10, 60, 20);
    ctx.strokeStyle = '#fdba74'; // 金色フレーム
    ctx.lineWidth = 2;
    ctx.strokeRect(map.exitX - 30, map.exitY - 10, 60, 20);
    // 扉の隙間
    ctx.fillStyle = '#78716c';
    ctx.fillRect(map.exitX - 1, map.exitY - 10, 2, 20);

    // 4つの星飾りのようなピース受け皿
    ctx.fillStyle = '#450a0a';
    for (let i = 0; i < 4; i++) {
      const px = map.exitX - 20 + i * 13;
      ctx.beginPath();
      ctx.arc(px, map.exitY, 3, 0, Math.PI * 2);
      ctx.fill();
      // もし鍵パーツがあれば光る
      if (playerState.keysCollected[i]) {
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(px, map.exitY, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#450a0a';
      }
    }

    // 3. 隠れスポットの描画
    map.hideSpots.forEach(h => {
      ctx.fillStyle = h.type === 'BED' ? '#1e293b' : '#334155'; // 暗い青ベッド or 暗い引き出し
      ctx.fillRect(h.x, h.y, h.width, h.height);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#475569';
      ctx.strokeRect(h.x, h.y, h.width, h.height);

      if (h.type === 'BED') {
        // 布の部分シーツ
        ctx.fillStyle = '#38bdf8'; // かすかに明るいシーツ（可愛い怖いの調和）
        ctx.fillRect(h.x + 2, h.y + 2, h.width - 4, h.height / 2.5);
        ctx.fillStyle = '#cbd5e1'; // 白い枕
        ctx.fillRect(h.x + 4, h.y + 4, h.width - 8, 8);
      } else {
        // 引き出し取っ手
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(h.x + h.width / 2 - 6, h.y + h.height - 8, 12, 3);
      }
    });

    // 4. 壁（障害物）の描画
    map.obstacles.forEach(o => {
      ctx.fillStyle = o.color || '#1c1917'; // コンクリートの堅牢なグレー黒
      ctx.fillRect(o.x, o.y, o.width, o.height);
      ctx.strokeStyle = '#2e2a24'; // レンガ風ボーダー
      ctx.lineWidth = 1;
      ctx.strokeRect(o.x, o.y, o.width, o.height);
    });

    // 5. アイテムの描画（ピチピチ光る）
    map.items.forEach(item => {
      if (item.collected) return;

      const alpha = 0.6 + Math.sin(performance.now() / 150) * 0.4;
      
      if (item.type === 'SMALL_MEDICINE') {
        ctx.fillStyle = `rgba(99, 102, 241, ${alpha})`; // インディゴ
        ctx.beginPath();
        ctx.arc(item.x, item.y, 6, 0, Math.PI * 2);
        ctx.fill();
        // 薬カプセル
        ctx.fillStyle = '#e0e7ff';
        ctx.fillRect(item.x - 3, item.y - 1, 6, 2);
      } else if (item.type === 'LARGE_MEDICINE') {
        ctx.fillStyle = `rgba(139, 92, 246, ${alpha})`; // バイオレット
        ctx.beginPath();
        ctx.arc(item.x, item.y, 8, 0, Math.PI * 2);
        ctx.fill();
        // 十字
        ctx.fillStyle = '#fff';
        ctx.fillRect(item.x - 4, item.y - 1, 8, 2);
        ctx.fillRect(item.x - 1, item.y - 4, 2, 8);
      } else if (item.type === 'KEY_PIECE') {
        ctx.fillStyle = `rgba(245, 158, 11, ${alpha})`; // ゴールド
        ctx.beginPath();
        ctx.arc(item.x, item.y, 10, 0, Math.PI * 2);
        ctx.fill();
        // カギ of 星印
        ctx.fillStyle = '#fff';
        ctx.font = '10px sans-serif';
        ctx.fillText("🗝️", item.x - 5, item.y + 4);
      }
    });

    // 6. モンスターの描画
    monsters.forEach(m => {
      const dist = Math.hypot(m.x - playerState.x, m.y - playerState.y);
      let isVisible = false;

      if (dist < 45) {
        isVisible = true; // 超密接
      } else if (playerState.flashlightOn && !playerState.isHiding) {
        const angleToMonster = Math.atan2(m.y - playerState.y, m.x - playerState.x);
        let angleDiff = Math.abs(angleToMonster - playerState.angle);
        if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;
        if (angleDiff < 0.6 && dist < 240) {
          // 壁がない場合のみ
          isVisible = !checkLineOfSightCollision(playerState.x, playerState.y, m.x, m.y);
        }
      }

      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.rotate(m.angle);

      if (isVisible) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)'; // 黒いスライムの影
        ctx.beginPath();
        ctx.arc(0, 0, 15, 0, Math.PI * 2);
        ctx.fill();

        if (m.type === 'HEARING') {
          ctx.strokeStyle = '#e11d48'; // 深紅
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-10, -10); ctx.lineTo(15, 0); ctx.lineTo(-10, 10);
          ctx.stroke();
          ctx.fillStyle = '#be123c';
          ctx.fillRect(-15, -12, 6, 24);
        } else {
          ctx.strokeStyle = '#a21caf'; // マゼンタ
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(-15, -15); ctx.lineTo(12, -5); ctx.lineTo(12, 5); ctx.lineTo(-15, 15);
          ctx.closePath();
          ctx.stroke();
          ctx.fillStyle = '#fb00ff';
          ctx.beginPath();
          ctx.arc(5, -4, 2, 0, Math.PI * 2);
          ctx.arc(5, 4, 2, 0, Math.PI * 2);
          ctx.fill();
        }

        if (m.state === 'CHASE') {
          ctx.restore();
          ctx.save();
          ctx.translate(m.x, m.y);
          ctx.fillStyle = '#ef4444';
          ctx.font = 'bold 15px sans-serif';
          ctx.fillText("❗", -4, -20);
        }
      } else {
        if (m.state === 'CHASE') {
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(0, 0, 12 + Math.sin(performance.now() / 50) * 8, 0, Math.PI * 2);
          ctx.stroke();
        } else if (m.type === 'HEARING' && Math.random() < 0.05) {
          ctx.strokeStyle = 'rgba(244, 63, 94, 0.15)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(0, 0, 24, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.restore();
    });

    // 7. プレイヤー（つぼみちゃん）の描画
    if (!playerState.isHiding) {
      ctx.save();
      ctx.translate(playerState.x, playerState.y);

      const now = performance.now();
      const isMoving = 
        keysPressed.current['w'] || keysPressed.current['a'] || keysPressed.current['s'] || keysPressed.current['d'] ||
        keysPressed.current['arrowup'] || keysPressed.current['arrowdown'] || keysPressed.current['arrowleft'] || keysPressed.current['arrowright'] ||
        joystickCenter.current !== null;

      const isDashing = playerState.isDashing;

      let dir: 'DOWN' | 'UP' | 'RIGHT' | 'LEFT' = 'DOWN';
      const angle = playerState.angle;
      if (angle >= -Math.PI / 4 && angle < Math.PI / 4) {
        dir = 'RIGHT';
      } else if (angle >= Math.PI / 4 && angle < 3 * Math.PI / 4) {
        dir = 'DOWN';
      } else if (angle >= -3 * Math.PI / 4 && angle < -Math.PI / 4) {
        dir = 'UP';
      } else {
        dir = 'LEFT';
      }

      const bounce = isMoving
        ? (isDashing ? Math.sin(now * 0.024) * 1.6 : Math.sin(now * 0.015) * 1.0)
        : Math.sin(now * 0.0035) * 0.45;

      const legStep = isMoving
        ? (isDashing ? Math.sin(now * 0.024) * 4.5 : Math.sin(now * 0.015) * 3.2)
        : 0;

      const ribbonAnim = isMoving ? Math.sin(now * 0.006) * 1.2 : 0;
      
      const headX = 0;
      const headY = bounce * 0.7;
      const bodyY = bounce;

      const drawPart = (
        drawFn: () => void,
        fillColor: string,
        strokeColor: string = '#140510',
        lineWidth: number = 2.5
      ) => {
        ctx.save();
        ctx.beginPath();
        drawFn();
        ctx.fillStyle = fillColor;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = lineWidth;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.fill();
        ctx.restore();
      };

      const useSprite = tubomiImageRef.current !== null;

      if (useSprite) {
        const img = tubomiImageRef.current!;
        const imgW = img.width;
        const imgH = img.height;

        let spriteMode: '3x3' | '3x4' | '1x1' = '3x3';
        const ratio = imgW / imgH;

        if (imgW > 0 && imgH > 0) {
          if (Math.abs(ratio - 0.75) < 0.15) {
            spriteMode = '3x4'; // 4方向歩行グラフィック (3列4行、比率0.75)
          } else if (ratio > 1.3 || ratio < 0.7) {
            spriteMode = '1x1'; // 単一の立ち絵・イラスト
          } else {
            spriteMode = '3x3'; // 8方向スプライト (3列3行、比率1.0)
          }
        }

        // キャラクターの現在の角度 (0 - 2PI)
        let normAngle = playerState.angle;
        while (normAngle < 0) normAngle += Math.PI * 2;
        while (normAngle >= Math.PI * 2) normAngle -= Math.PI * 2;

        const step = Math.PI / 4;
        const halfStep = step / 2;
        
        let shiftedAngle = normAngle + halfStep;
        if (shiftedAngle >= Math.PI * 2) shiftedAngle -= Math.PI * 2;
        const bucket = Math.floor(shiftedAngle / step);

        let col = 0;
        let row = 0;
        let sw = imgW;
        let sh = imgH;
        let flashlightOffsetX = 0;
        let flashlightOffsetY = 0;
        let needFlipX = false; // 3x3 の一部セルで左右反転を用いて空白セルを補うフラグ

        if (spriteMode === '3x3') {
          sw = imgW / 3;
          sh = imgH / 3;
          switch (bucket) {
            case 0: // 右
              col = 2; row = 0; // 「右」セル - row:0, col:2
              flashlightOffsetX = 10;
              flashlightOffsetY = 4;
              break;
            case 1: // 右下
              col = 1; row = 0; // 「右前」セル - row:0, col:1
              flashlightOffsetX = 8;
              flashlightOffsetY = 8;
              break;
            case 2: // 下 (正面)
              col = 1; row = 2; // 「前」正面セル - row:2, col:1
              flashlightOffsetX = 4;
              flashlightOffsetY = 10;
              break;
            case 3: // 左下
              col = 0; row = 2; // 「左前」セル - row:2, col:0
              flashlightOffsetX = -8;
              flashlightOffsetY = 8;
              break;
            case 4: // 左
              col = 0; row = 1; // 「左」セル - row:1, col:0
              flashlightOffsetX = -10;
              flashlightOffsetY = 4;
              break;
            case 5: // 左上
              col = 1; row = 1; // 「左後」セル - row:1, col:1
              flashlightOffsetX = -8;
              flashlightOffsetY = -8;
              break;
            case 6: // 上 (背面)
              col = 0; row = 0; // 「後」背面セル - row:0, col:0
              flashlightOffsetX = -4;
              flashlightOffsetY = -10;
              break;
            case 7: // 右上
              col = 2; row = 1; // 「右後」セル - row:1, col:2
              flashlightOffsetX = 8;
              flashlightOffsetY = -8;
              break;
          }
        } else if (spriteMode === '3x4') {
          // 3列4行（正面、左、右、背面）
          sw = imgW / 3;
          sh = imgH / 4;
          
          // 歩行アニメフレーム: 0, 1, 2, 1
          const animFrame = isMoving ? Math.floor(now / 150) % 4 : 1;
          col = animFrame === 3 ? 1 : animFrame;

          // 行判定 (0:下向き(正面), 1:左向き, 2:右向き, 3:上向き(背面))
          switch (bucket) {
            case 0: // 右
              row = 2;
              flashlightOffsetX = 10;
              flashlightOffsetY = 4;
              break;
            case 1: // 右下
              row = 0;
              flashlightOffsetX = 8;
              flashlightOffsetY = 8;
              break;
            case 2: // 下
              row = 0;
              flashlightOffsetX = 2;
              flashlightOffsetY = 10;
              break;
            case 3: // 左下
              row = 0;
              flashlightOffsetX = -8;
              flashlightOffsetY = 8;
              break;
            case 4: // 左
              row = 1;
              flashlightOffsetX = -10;
              flashlightOffsetY = 4;
              break;
            case 5: // 左上
              row = 3;
              flashlightOffsetX = -8;
              flashlightOffsetY = -8;
              break;
            case 6: // 上
              row = 3;
              flashlightOffsetX = -2;
              flashlightOffsetY = -10;
              break;
            case 7: // 右上
              row = 3;
              flashlightOffsetX = 8;
              flashlightOffsetY = -8;
              break;
          }
        } else {
          // 1x1単一画像
          sw = imgW;
          sh = imgH;
          col = 0;
          row = 0;
          flashlightOffsetX = Math.cos(playerState.angle) * 12;
          flashlightOffsetY = Math.sin(playerState.angle) * 12;
        }

        const dw = 32;
        const dh = 32;

        ctx.save();
        ctx.translate(0, bounce);

        // 各画像モードに合わせた左右反転処理
        let scaleX = 1;
        if (spriteMode === '1x1') {
          if (normAngle > Math.PI / 2 && normAngle < 3 * Math.PI / 2) {
            scaleX = -1;
          }
        } else if (spriteMode === '3x3') {
          if (needFlipX) {
            scaleX = -1;
          }
        }

        if (scaleX !== 1) {
          ctx.scale(scaleX, 1);
        }

        if (isMoving) {
          const tilt = Math.sin(now * 0.015) * 0.05 * scaleX;
          ctx.rotate(tilt);
        }

        ctx.drawImage(
          img,
          col * sw, row * sh, sw, sh,
          -dw / 2, -dh / 2 - 2, dw, dh
        );

        ctx.restore();

        if (playerState.flashlightOn) {
          ctx.save();
          const lightX = flashlightOffsetX;
          const lightY = flashlightOffsetY + bounce;
          ctx.beginPath();
          ctx.arc(lightX, lightY, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = '#fef08a';
          ctx.shadowBlur = 8;
          ctx.shadowColor = '#fde047';
          ctx.fill();
          ctx.restore();
        }
      } else {
        if (dir === 'DOWN') {
          // ==================== 【正面・下向き】 ====================
          // --- 1. 後ろ側の足（奥のブーツ - 左足） ---
          const lFootY = bodyY + 11.5 + (isMoving ? legStep : 0);
          drawPart(() => {
            ctx.arc(-3.5, lFootY, 2.5, 0, Math.PI * 2);
          }, '#451a03');

          // --- 2. 前側の足（手前のブーツ - 右足） ---
          const rFootY = bodyY + 11.5 + (isMoving ? -legStep : 0);
          drawPart(() => {
            ctx.arc(3.5, rFootY, 2.5, 0, Math.PI * 2);
          }, '#78350f');

          // --- 3. 髪の後ろの大きな赤いリボン（両サイドに広がる大きなリボン） ---
          const ribXLeft = -6;
          const ribXRight = 6;
          const ribY = headY - 1.5;

          // 左羽
          drawPart(() => {
            ctx.moveTo(0, ribY);
            ctx.quadraticCurveTo(ribXLeft - 7, ribY - 10 + ribbonAnim, ribXLeft - 11, ribY - 4 + ribbonAnim);
            ctx.quadraticCurveTo(ribXLeft - 6, ribY + 4, 0, ribY);
          }, '#ef4444');
          // 右羽
          drawPart(() => {
            ctx.moveTo(0, ribY);
            ctx.quadraticCurveTo(ribXRight + 7, ribY - 10 + ribbonAnim, ribXRight + 11, ribY - 4 + ribbonAnim);
            ctx.quadraticCurveTo(ribXRight + 6, ribY + 4, 0, ribY);
          }, '#ef4444');
          // 結び目
          drawPart(() => {
            ctx.arc(0, ribY, 2.5, 0, Math.PI * 2);
          }, '#be123c');

          // --- 4. 体・ピンクのコートと白インナー（前向きお洋服） ---
          // コートの本体
          drawPart(() => {
            ctx.beginPath();
            ctx.arc(0, bodyY + 4.5, 6, 0, Math.PI * 2); // ポンチョ感
          }, '#fda4af');

          // 正面の白インナーシャツ/襟元
          drawPart(() => {
            ctx.moveTo(-2.5, bodyY + 0.5);
            ctx.lineTo(2.5, bodyY + 0.5);
            ctx.lineTo(1.5, bodyY + 5.5);
            ctx.lineTo(-1.5, bodyY + 5.5);
            ctx.closePath();
          }, '#ffffff');

          // 白インナーの中央 of 黒い小さなタイ/リボン
          drawPart(() => {
            ctx.arc(0, bodyY + 2.5, 1.2, 0, Math.PI * 2);
          }, '#1e293b');

          // マフラー/襟ふわふわ
          drawPart(() => {
            ctx.arc(-2.5, bodyY, 2.5, 0, Math.PI * 2);
            ctx.arc(2.5, bodyY, 2.5, 0, Math.PI * 2);
          }, '#ffe4e6');

          // こげ茶プリーツスカート
          drawPart(() => {
            ctx.moveTo(-5.5, bodyY + 7.5);
            ctx.lineTo(5.5, bodyY + 7.5);
            ctx.lineTo(7.5, bodyY + 11.5);
            ctx.lineTo(-7.5, bodyY + 11.5);
            ctx.closePath();
          }, '#3a221d');

          // --- 5. 頭部（可愛いマロンブラウンの髪 & 丸い輪郭） ---
          // 後ろ髪
          drawPart(() => {
            ctx.arc(0, headY, 8.5, 0, Math.PI * 2);
          }, '#8f5c38');

          // お顔（肌色スキン）
          drawPart(() => {
            ctx.arc(0, headY, 7.0, 0, Math.PI * 2);
          }, '#ffe5d9');

          // 前髪・サイド（耳は完全に隠れており、マッシュ調のおしとやかボブ）
          drawPart(() => {
            // 左サイド〜前髪〜右サイド
            ctx.moveTo(-7.5, headY - 1.5);
            ctx.quadraticCurveTo(-6.5, headY - 7.5, 0, headY - 7.5);
            ctx.quadraticCurveTo(6.5, headY - 7.5, 7.5, headY - 1.5);
            // 前髪の束（ギザギザと分け目）
            ctx.quadraticCurveTo(4.5, headY, 3, headY + 1.5);
            ctx.quadraticCurveTo(1.5, headY - 1.0, 0, headY - 1.0);
            ctx.quadraticCurveTo(-1.5, headY + 1.5, -4, headY);
            ctx.quadraticCurveTo(-6, headY, -7.5, headY - 1.5);
            ctx.closePath();
          }, '#8f5c38');

          // 前髪ハイライト・少し明るいブラウン
          drawPart(() => {
            ctx.moveTo(-4, headY - 4.5);
            ctx.quadraticCurveTo(0, headY - 4.0, 4, headY - 4.5);
            ctx.lineTo(2, headY - 3.5);
            ctx.quadraticCurveTo(0, headY - 3.0, -2, headY - 3.5);
            ctx.closePath();
          }, '#c19a6b');

          // --- 6. うるうるの大きな黒目（左右の目） ---
          const drawDownEye = (ex: number) => {
            // 白目
            drawPart(() => {
              ctx.arc(ex, headY, 2.0, 0, Math.PI * 2);
            }, '#ffffff');
            // 黒目
            drawPart(() => {
              ctx.arc(ex, headY + 0.3, 1.2, 0, Math.PI * 2);
            }, '#1e293b');
            // キラメキ
            ctx.save();
            ctx.beginPath();
            ctx.arc(ex + 0.5, headY - 0.4, 0.5, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            ctx.restore();

            // 頬のぽわっと赤み
            ctx.save();
            const blush = ctx.createRadialGradient(ex, headY + 1.8, 0, ex, headY + 1.8, 2.2);
            blush.addColorStop(0, 'rgba(244, 63, 94, 0.6)');
            blush.addColorStop(1, 'rgba(244, 63, 94, 0.0)');
            ctx.beginPath();
            ctx.arc(ex, headY + 1.8, 2.2, 0, Math.PI * 2);
            ctx.fillStyle = blush;
            ctx.fill();
            ctx.restore();
          };

          drawDownEye(-3.0); // 左目
          drawDownEye(3.0);  // 右目

          // お口
          ctx.save();
          ctx.strokeStyle = '#3a221d';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(-1, headY + 2.8);
          ctx.quadraticCurveTo(0, headY + 3.6, 1, headY + 2.8);
          ctx.stroke();
          ctx.restore();

          // --- 7. 手と懐中電灯（下方向に照らす） ---
          const handX = 4.0;
          const handY = bodyY + 4.5;
          // おてて
          drawPart(() => {
            ctx.arc(handX, handY, 1.8, 0, Math.PI * 2);
          }, '#be123c');
          // 懐中電灯本体
          drawPart(() => {
            ctx.rect(handX - 1.2, handY, 2.4, 3.5);
          }, '#78716c');
          drawPart(() => {
            ctx.rect(handX - 2.0, handY + 3.5, 4.0, 2);
          }, '#e2e8f0');

          if (playerState.flashlightOn) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(handX, handY + 5.5, 2.0, 0, Math.PI * 2);
            ctx.fillStyle = '#fef08a';
            ctx.shadowBlur = 8;
            ctx.shadowColor = '#fde047';
            ctx.fill();
            ctx.restore();
          }
        } else if (dir === 'UP') {
          // ==================== 【後ろ姿・上向き】 ====================
          // --- 1. 後ろ側の足（奥のブーツ） ---
          const lFootY = bodyY + 11.5 + (isMoving ? legStep : 0);
          drawPart(() => {
            ctx.arc(-3.5, lFootY, 2.5, 0, Math.PI * 2);
          }, '#451a03');

          // --- 2. 前側の足（手前のブーツ） ---
          const rFootY = bodyY + 11.5 + (isMoving ? -legStep : 0);
          drawPart(() => {
            ctx.arc(3.5, rFootY, 2.5, 0, Math.PI * 2);
          }, '#78350f');

          // --- 3. 後ろ髪 (後頭部丸ごとブラウン) ---
          drawPart(() => {
            ctx.arc(0, headY, 8.5, 0, Math.PI * 2);
          }, '#8f5c38');

          // 後ろ髪の結び目束・おさげ表現、髪のウェーブ質感
          drawPart(() => {
            ctx.moveTo(-5, headY + 3);
            ctx.quadraticCurveTo(0, headY + 7.5, 5, headY + 3);
            ctx.quadraticCurveTo(0, headY + 4.5, -5, headY + 3);
            ctx.closePath();
          }, '#5f3f2d');

          // --- 4. 後頭部の大きい赤いリボン (しっかり真ん中に配置) ---
          const ribY = headY - 4.5;
          const ribXLeft = -6;
          const ribXRight = 6;
          // 左羽
          drawPart(() => {
            ctx.moveTo(0, ribY);
            ctx.quadraticCurveTo(ribXLeft - 6, ribY - 11 + ribbonAnim, ribXLeft - 10, ribY - 5 + ribbonAnim);
            ctx.quadraticCurveTo(ribXLeft - 5, ribY + 3, 0, ribY);
          }, '#ef4444');
          // 右羽
          drawPart(() => {
            ctx.moveTo(0, ribY);
            ctx.quadraticCurveTo(ribXRight + 6, ribY - 11 + ribbonAnim, ribXRight + 10, ribY - 5 + ribbonAnim);
            ctx.quadraticCurveTo(ribXRight + 5, ribY + 3, 0, ribY);
          }, '#ef4444');
          // 結び目
          drawPart(() => {
            ctx.arc(0, ribY, 2.6, 0, Math.PI * 2);
          }, '#be123c');

          // --- 5. 体・ピンクのお洋服 (後ろから見たコート) ---
          drawPart(() => {
            ctx.beginPath();
            ctx.arc(0, bodyY + 4.5, 6, 0, Math.PI * 2);
          }, '#fda4af');

          // 首元の襟（ふわふわ白い襟）
          drawPart(() => {
            ctx.beginPath();
            ctx.arc(-2, bodyY, 2.2, 0, Math.PI * 2);
            ctx.arc(2, bodyY, 2.2, 0, Math.PI * 2);
          }, '#ffe4e6');

          // スカート
          drawPart(() => {
            ctx.moveTo(-5.5, bodyY + 7.5);
            ctx.lineTo(5.5, bodyY + 7.5);
            ctx.lineTo(7.5, bodyY + 11.5);
            ctx.lineTo(-7.5, bodyY + 11.5);
            ctx.closePath();
          }, '#3a221d');

          // --- 6. 懐中電灯 (後ろ姿、上方向に照らす) ---
          const handX = -4.0;
          const handY = bodyY + 4.5;
          // 手
          drawPart(() => {
            ctx.arc(handX, handY, 1.8, 0, Math.PI * 2);
          }, '#be123c');
          // 懐中電灯上
          drawPart(() => {
            ctx.rect(handX - 1.2, handY - 3.5, 2.4, 3.5);
          }, '#78716c');
          drawPart(() => {
            ctx.rect(handX - 2.0, handY - 5.5, 4.0, 2);
          }, '#e2e8f0');

          if (playerState.flashlightOn) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(handX, handY - 5.5, 2.0, 0, Math.PI * 2);
            ctx.fillStyle = '#fef08a';
            ctx.shadowBlur = 8;
            ctx.shadowColor = '#fde047';
            ctx.fill();
            ctx.restore();
          }
        } else {
          // ==================== 【横向きプロファイル (LEFT/RIGHT)】 ====================
          ctx.save();
          if (dir === 'LEFT') {
            ctx.scale(-1, 1); // 左向きの場合は完全に反転させて描画
          }

          // --- 1. 後ろ側の足（奥のブーツ） ---
          drawPart(() => {
            const lx = -4 - (isMoving ? 1 : 0);
            const ly = bodyY + 11.5 - legStep;
            ctx.arc(lx, ly, 3, 0, Math.PI * 2);
          }, '#451a03');

          // --- 2. 前側の足（手前のブーツ） ---
          drawPart(() => {
            const rx = -3 - (isMoving ? 1 : 0);
            const ry = bodyY + 11.5 + legStep;
            ctx.arc(rx, ry, 3.2, 0, Math.PI * 2);
          }, '#78350f');

          // --- 3. 髪の後ろの大きな赤いリボン（後ろ側になびくおめかしリボン） ---
          const ribX = headX - 5.5;
          const ribY = headY;
          // 上側のリボン
          drawPart(() => {
            ctx.moveTo(ribX, ribY);
            ctx.quadraticCurveTo(ribX - 6, ribY - 8 + ribbonAnim, ribX - 8, ribY - 5 + ribbonAnim);
            ctx.quadraticCurveTo(ribX - 4, ribY - 2, ribX, ribY);
          }, '#ef4444');
          // 下側のリボン
          drawPart(() => {
            ctx.moveTo(ribX, ribY);
            ctx.quadraticCurveTo(ribX - 6, ribY + 8 - ribbonAnim, ribX - 8, ribY + 5 - ribbonAnim);
            ctx.quadraticCurveTo(ribX - 4, ribY + 2, ribX, ribY);
          }, '#ef4444');
          // 結び目
          drawPart(() => {
            ctx.arc(ribX, ribY, 2.2, 0, Math.PI * 2);
          }, '#be123c');

          // --- 4. 体・ピンクのコート ---
          const bodyX = -2;
          const bodyH = 10;
          drawPart(() => {
            ctx.arc(bodyX, bodyY + 4.5, bodyH / 2, 0, Math.PI * 2);
          }, '#fda4af');

          // 白いもこもこマフラー襟
          drawPart(() => {
            ctx.arc(bodyX + 2, bodyY + 1.0, 3.5, 0, Math.PI * 2);
          }, '#ffe4e6');

          // スカート
          drawPart(() => {
            ctx.rect(bodyX - 3.5, bodyY + 8.5, 7.5, 3);
          }, '#3a221d');

          // --- 5. 頭部（栗色ボブ＆顔） ---
          drawPart(() => {
            ctx.arc(headX - 1.5, headY, 8.5, 0, Math.PI * 2);
          }, '#8f5c38');

          // お顔（肌色スキン）
          drawPart(() => {
            ctx.arc(headX + 2.5, headY, 6.5, -Math.PI / 2, Math.PI / 2);
            ctx.lineTo(headX, headY + 6.5);
            ctx.lineTo(headX, headY - 6.5);
            ctx.closePath();
          }, '#ffe5d9');

          // 前髪・おしとやかサイドヘア
          drawPart(() => {
            ctx.moveTo(headX + 1, headY - 6.5);
            ctx.quadraticCurveTo(headX + 4.5, headY - 3, headX + 4.5, headY);
            ctx.quadraticCurveTo(headX + 4.5, headY + 3, headX + 1, headY + 6.5);
            ctx.lineTo(headX - 1.5, headY + 6.5);
            ctx.lineTo(headX - 1.5, headY - 6.5);
            ctx.closePath();
          }, '#8f5c38');

          // 前髪ハイライト
          drawPart(() => {
            ctx.moveTo(headX + 1.5, headY - 3.5);
            ctx.quadraticCurveTo(headX + 3.8, headY, headX + 1.5, headY + 3.5);
            ctx.closePath();
          }, '#c19a6b');

          // 後ろ髪のコロンとした内巻き
          drawPart(() => {
            ctx.arc(headX - 4, headY, 5.5, 0, Math.PI * 2);
          }, '#5f3f2d');

          // --- 6. うるうるの右プロフィール目 ---
          const drawProfileEye = (ey: number) => {
            // 白目ベース
            drawPart(() => {
              ctx.arc(headX + 4.0, headY + ey, 2.2, 0, Math.PI * 2);
            }, '#ffffff');
            // 黒目
            drawPart(() => {
              ctx.arc(headX + 4.5, headY + ey + 0.3, 1.3, 0, Math.PI * 2);
            }, '#1e293b');

            // キラメキ
            ctx.save();
            ctx.beginPath();
            ctx.arc(headX + 5.2, headY + ey - 0.4, 0.6, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            ctx.restore();

            // チーク
            ctx.save();
            const blushGradHeight = ctx.createRadialGradient(
              headX + 3.5, headY + ey + 1.6, 0,
              headX + 3.5, headY + ey + 1.6, 2.5
            );
            blushGradHeight.addColorStop(0, 'rgba(244, 63, 94, 0.65)');
            blushGradHeight.addColorStop(1, 'rgba(244, 63, 94, 0.0)');
            ctx.beginPath();
            ctx.arc(headX + 3.5, headY + ey + 1.6, 2.5, 0, Math.PI * 2);
            ctx.fillStyle = blushGradHeight;
            ctx.fill();
            ctx.restore();
          };

          drawProfileEye(0.0);

          // --- 7. 手と懐中電灯（右方向に照らす） ---
          const handX = headX + 3.0;
          const handY = headY + 4.0;
          // 手
          drawPart(() => {
            ctx.arc(handX, handY, 1.8, 0, Math.PI * 2);
          }, '#be123c');
          // 懐中電灯プロファイル
          drawPart(() => {
            ctx.rect(handX + 1.0, handY - 1.2, 3.5, 2.4);
          }, '#78716c');
          drawPart(() => {
            ctx.rect(handX + 4.5, handY - 2.0, 1.8, 4.0);
          }, '#e2e8f0');

          if (playerState.flashlightOn) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(handX + 6.3, handY, 2.0, 0, Math.PI * 2);
            ctx.fillStyle = '#fef08a';
            ctx.shadowBlur = 8;
            ctx.shadowColor = '#fde047';
            ctx.fill();
            ctx.restore();
          }

          ctx.restore(); // scale反転の終了
        }
      }
    } else {
      // 隠れている時のプレイヤー位置（うっすら半透明 zzz マーク）
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText("しーっ...", playerState.x - 18, playerState.y - 15);
    }

    ctx.restore(); // トランスフォームの終了

    // --- 8. 懐中電灯（シャドウマスク）シェーダーの適用 ---
    // 別レイヤーに黒い幕を貼り、懐中電灯の位置にあわせて「くり抜く（Destination-Out / ソースオーバーのグラデーション）」
    // これにより、病院の薄暗いホラー夜廻風の完璧なビジュアルが瞬時に完成します。
    ctx.save();
    
    // バックグラウンド全体を暗闇に包む
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = viewWidth;
    shadowCanvas.height = viewHeight;
    const sCtx = shadowCanvas.getContext('2d')!;

    sCtx.fillStyle = '#090504'; // ほぼ漆黒
    sCtx.fillRect(0, 0, viewWidth, viewHeight);

    // プレイヤー中心（スクリーン座標）
    const screenPX = playerState.x + transX;
    const screenPY = playerState.y + transY;

    if (!playerState.isHiding) {
      sCtx.save();
      // 元画像を透明にくり抜く「destination-out」指定
      sCtx.globalCompositeOperation = 'destination-out';

      // A. 近接自己視野（懐中電灯を消していても、足元だけはうっすら見える 20px 程度）
      const selfGlow = sCtx.createRadialGradient(screenPX, screenPY, 0, screenPX, screenPY, 32);
      selfGlow.addColorStop(0, 'rgba(0,0,0,1.0)');
      selfGlow.addColorStop(0.8, 'rgba(0,0,0,0.8)');
      selfGlow.addColorStop(1, 'rgba(0,0,0,0.0)');

      sCtx.fillStyle = selfGlow;
      sCtx.beginPath();
      sCtx.arc(screenPX, screenPY, 32, 0, Math.PI * 2);
      sCtx.fill();

      // B. 懐中電灯の光線（ONのとき）
      if (playerState.flashlightOn) {
        // 懐中電灯の到達距離を大幅アップ（ダッシュ時360px、歩行時290px、よりはっきり遠くまで）
        const lightDist = playerState.isDashing ? 360 : 290;
        const angleWidth = playerState.isDashing ? 0.45 : 0.62; // ダッシュ時は視界が前に集中、歩きは広範囲
        
        const startAng = playerState.angle - angleWidth;
        const endAng = playerState.angle + angleWidth;

        // 扇形のパスを切り出す
        sCtx.beginPath();
        sCtx.moveTo(screenPX, screenPY);
        sCtx.arc(screenPX, screenPY, lightDist, startAng, endAng);
        sCtx.lineTo(screenPX, screenPY);
        sCtx.closePath();

        // 放射グラデーションで、懐中電灯の光源側が明るく、先に行くほど薄く・ぼやけるようにくり抜く
        // より明るくはっきり見えるよう、アルファ値を高く（1.0〜0.85を幅広く設定）
        const beamGlow = sCtx.createRadialGradient(
          screenPX, screenPY, 10,
          screenPX + Math.cos(playerState.angle) * (lightDist * 0.75),
          screenPY + Math.sin(playerState.angle) * (lightDist * 0.75),
          lightDist * 0.55
        );
        beamGlow.addColorStop(0, 'rgba(0,0,0,1.0)');
        beamGlow.addColorStop(0.5, 'rgba(0,0,0,1.0)'); // 5割程度まで完全に明瞭
        beamGlow.addColorStop(0.85, 'rgba(0,0,0,0.92)'); // 先端の近くまでくっきり明るく
        beamGlow.addColorStop(1, 'rgba(0,0,0,0.0)');

        sCtx.fillStyle = beamGlow;
        sCtx.fill();
        
        // 周辺光の漏れ（柔らかい110px円に拡大、足元の視認性を向上）
        const ambientGlow = sCtx.createRadialGradient(screenPX, screenPY, 0, screenPX, screenPY, 110);
        ambientGlow.addColorStop(0, 'rgba(0,0,0,0.85)'); // 足元を確実に明るく
        ambientGlow.addColorStop(0.5, 'rgba(0,0,0,0.45)');
        ambientGlow.addColorStop(1, 'rgba(0,0,0,0.0)');
        sCtx.fillStyle = ambientGlow;
        sCtx.beginPath();
        sCtx.arc(screenPX, screenPY, 110, 0, Math.PI * 2);
        sCtx.fill();
      }
      sCtx.restore();
    } else {
      // C. 隠れている時（極めて狭い視野、周囲15pxのみがかすかに見える）
      sCtx.save();
      sCtx.globalCompositeOperation = 'destination-out';
      const hideGlow = sCtx.createRadialGradient(screenPX, screenPY, 0, screenPX, screenPY, 25);
      hideGlow.addColorStop(0, 'rgba(0,0,0,1.0)');
      hideGlow.addColorStop(1, 'rgba(0,0,0,0.0)');
      sCtx.fillStyle = hideGlow;
      sCtx.beginPath();
      sCtx.arc(screenPX, screenPY, 25, 0, Math.PI * 2);
      sCtx.fill();
      sCtx.restore();
    }

    // 作成したくり抜きレイヤー(ShadowCanvas)を実際のCanvasへ合成
    ctx.drawImage(shadowCanvas, 0, 0);

    // 懐中電灯が点灯中で隠れていない場合、くりぬいた部分にリアルな光線コーン（電球色のビーム）をうっすら重ねる
    if (playerState.flashlightOn && !playerState.isHiding) {
      ctx.save();
      const lightDist = playerState.isDashing ? 360 : 290;
      const angleWidth = playerState.isDashing ? 0.45 : 0.62;
      const startAng = playerState.angle - angleWidth;
      const endAng = playerState.angle + angleWidth;
      const screenPX = playerState.x + transX;
      const screenPY = playerState.y + transY;

      // 扇形のパスを定義
      ctx.beginPath();
      ctx.moveTo(screenPX, screenPY);
      ctx.arc(screenPX, screenPY, lightDist, startAng, endAng);
      ctx.lineTo(screenPX, screenPY);
      ctx.closePath();

      // 明るい黄白色の光線グラデーションで、暗闇を劇的・美麗に照らす
      const lightBeamGlow = ctx.createRadialGradient(
        screenPX, screenPY, 10,
        screenPX + Math.cos(playerState.angle) * (lightDist * 0.75),
        screenPY + Math.sin(playerState.angle) * (lightDist * 0.75),
        lightDist * 0.6
      );
      // 光源近くをさらに明るくし、遠くまでしっかりとビームが見える強度に調整
      lightBeamGlow.addColorStop(0, 'rgba(255, 250, 220, 0.32)');
      lightBeamGlow.addColorStop(0.3, 'rgba(255, 250, 220, 0.18)');
      lightBeamGlow.addColorStop(0.7, 'rgba(255, 250, 220, 0.08)');
      lightBeamGlow.addColorStop(1, 'rgba(0, 0, 0, 0.0)');

      ctx.fillStyle = lightBeamGlow;
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();

    // --- 9. ミニマップ (右上のエレガントな半透明窓) ---
    const mmSize = 100;
    const mmPadding = 15;
    const mmX = viewWidth - mmSize - mmPadding;
    const mmY = mmPadding;

    ctx.save();
    // 枠
    ctx.fillStyle = 'rgba(28,25,23,0.7)';
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1.5;
    ctx.fillRect(mmX, mmY, mmSize, mmSize);
    ctx.strokeRect(mmX, mmY, mmSize, mmSize);

    // ドットをマッピングする倍率 (1200 → 100px)
    const mmScale = mmSize / map.width;

    // プレイヤーのドット
    const mpx = mmX + playerState.x * mmScale;
    const mpy = mmY + playerState.y * mmScale;
    ctx.fillStyle = '#38bdf8'; // 青いつぼみドット
    ctx.beginPath();
    ctx.arc(mpx, mpy, 3, 0, Math.PI * 2);
    ctx.fill();

    // 隠れスポットのマップ表示
    map.hideSpots.forEach(h => {
      const hx = mmX + (h.x + h.width / 2) * mmScale;
      const hy = mmY + (h.y + h.height / 2) * mmScale;
      ctx.fillStyle = h.type === 'BED' ? '#38bdf8' : '#818cf8'; // ベッドは水色、クローゼットは青
      ctx.font = '7px sans-serif';
      ctx.fillText(h.type === 'BED' ? "🛏️" : "🚪", hx - 4, hy + 3);
    });

    // 中央脱出扉
    const ex = mmX + map.exitX * mmScale;
    const ey = mmY + map.exitY * mmScale;
    ctx.fillStyle = '#e11d48'; // 脱出扉の赤いドット
    ctx.fillRect(ex - 3, ey - 3, 6, 6);

    // カギの回収先
    map.items.forEach(item => {
      if (item.collected || item.type !== 'KEY_PIECE') return;
      const ix = mmX + item.x * mmScale;
      const iy = mmY + item.y * mmScale;
      ctx.fillStyle = '#fbbf24'; // 金の鍵ドット
      ctx.beginPath();
      ctx.arc(ix, iy, 1.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // タイトル「MAP」
    ctx.fillStyle = '#78716c';
    ctx.font = 'bold 8px monospace';
    ctx.fillText("MINIMAP", mmX + 4, mmY + 10);

    ctx.restore();

    // 10. パニック画面ノイズ・血走る境界線
    if (panicLevel > 15) {
      ctx.save();
      const alpha = (panicLevel / 100) * 0.45; // 最大0.45の濃さ
      const pulseSize = 20 + Math.sin(performance.now() / 100) * 12;

      // 四隅の内側シャドウ (ビネット効果) 
      const vignette = ctx.createRadialGradient(
        viewWidth/2, viewHeight/2, viewWidth/4,
        viewWidth/2, viewHeight/2, viewWidth/1.3
      );
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(0.7, `rgba(127, 29, 29, ${alpha * 0.3})`);
      vignette.addColorStop(1, `rgba(153, 27, 27, ${alpha})`);

      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, viewWidth, viewHeight);
      ctx.restore();
    }

    // 11. セーブメッセージ（鍵獲得後に数秒フェード描画）
    // （今回は鍵を拾うロジックで直接親状態を保存するので不要）
  };

  // 隠れるアクションのトリガー関数
  const toggleHidingTap = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleHidingState();
  };

  // アイテムのクイックキー/ポーズバッグでの使用
  const handleItemQuickUse = (e: React.MouseEvent, type: 'SMALL' | 'LARGE') => {
    e.stopPropagation();
    if (type === 'SMALL' && playerState.smallMedsCount > 0 && playerState.san < 100) {
      audioManager.playUseMedicine();
      setPlayerState(prev => ({
        ...prev,
        san: Math.min(100, prev.san + 30),
        smallMedsCount: prev.smallMedsCount - 1
      }));
    } else if (type === 'LARGE' && playerState.largeMedsCount > 0 && playerState.san < 100) {
      audioManager.playUseMedicine();
      setPlayerState(prev => ({
        ...prev,
        san: Math.min(100, prev.san + 80),
        largeMedsCount: prev.largeMedsCount - 1
      }));
    }
  };

  return (
    <div 
      className="relative flex flex-col justify-center items-center bg-stone-950 w-full min-h-screen overflow-hidden text-stone-200 select-none"
      id="game_viewport_root"
    >
      {/* 1. キャンバス */}
      <canvas 
        id="game_canvas"
        ref={canvasRef}
        width={768}
        height={540}
        className="border-4 border-stone-900 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.85)] max-w-full aspect-[4/3] bg-zinc-950"
      />

      {/* 2. ゲーム中UI (ヘッダーバー: SAN値, スタミナ, 鍵ピース) */}
      <div 
        className="absolute top-4 left-4 right-4 max-w-xl mx-auto flex items-center justify-between gap-4 bg-stone-900/80 backdrop-blur-md border border-stone-800 p-3 px-4 rounded-2xl shadow-xl z-20 pointer-events-auto"
        id="game_hud"
      >
        {/* 正気度 (SAN) */}
        <div className="flex flex-col items-start gap-1" id="hud_san_area">
          <div className="text-[10px] uppercase font-mono tracking-wider text-stone-400">正気度 (SAN)</div>
          <div className="flex items-center gap-2">
            <div className={`text-base font-bold font-mono ${playerState.san < 25 ? 'text-rose-500 animate-pulse font-black' : 'text-stone-100'}`}>
              {Math.round(playerState.san)}%
            </div>
            <div className="w-24 h-2 bg-stone-950 rounded-full overflow-hidden border border-stone-800 flex">
              <div 
                style={{ width: `${playerState.san}%` }}
                className={`h-full transition-all duration-300 ${playerState.san < 30 ? 'bg-rose-600 animate-pulse' : 'bg-rose-400'}`}
              />
            </div>
          </div>
        </div>

        {/* スタミナ (STAMINA) */}
        <div className="flex flex-col items-start gap-1" id="hud_stamina_area">
          <div className="text-[10px] uppercase font-mono tracking-wider text-stone-400">スタミナ</div>
          <div className="flex items-center gap-2">
            <div className={`text-base font-bold font-mono ${isBreathless.current ? 'text-amber-500 animate-pulse' : 'text-stone-100'}`}>
              {Math.round(playerState.stamina)}%
            </div>
            <div className="w-24 h-2 bg-stone-950 rounded-full overflow-hidden border border-stone-800 flex">
              <div 
                style={{ width: `${playerState.stamina}%` }}
                className={`h-full transition-all duration-200 ${isBreathless.current ? 'bg-amber-600 animate-ping' : 'bg-emerald-500'}`}
              />
            </div>
          </div>
        </div>

        {/* 鍵ピース進行 (4つスロット) */}
        <div className="flex flex-col items-center gap-1" id="hud_keys_area">
          <div className="text-[10px] uppercase font-mono tracking-wider text-stone-400">鍵</div>
          <div className="flex gap-1.5" id="hud_key_indicator">
            {playerState.keysCollected.map((collected, i) => (
              <div 
                key={i} 
                id={`hud_key_icon_${i}`}
                className={`w-4 h-4 rounded border flex items-center justify-center text-[8px] transition-all duration-300 ${
                  collected 
                    ? 'border-amber-400 bg-amber-500/20 text-amber-300 shadow-[0_0_5px_rgba(245,158,11,0.3)] font-bold' 
                    : 'border-stone-800 bg-stone-950 text-stone-700'
                }`}
              >
                🗝️
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. モバイルバーチャルコントロール (スマホのみ表示) */}
      {isMobile && (
        <div 
          className="absolute inset-x-0 bottom-6 max-w-md mx-auto flex items-end justify-between px-6 z-30"
          id="mobile_virtual_controls"
        >
          {/* A. 仮想ジョイスティック (タッチ駆動) */}
          <div 
            id="mobile_joystick_container"
            className="w-28 h-28 bg-stone-900/65 border border-stone-800 backdrop-blur-sm rounded-full flex items-center justify-center touch-none select-none relative"
            onTouchStart={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const touch = e.touches[0];
              const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
              joystickCenter.current = center;
              joystickCurrent.current = { x: touch.clientX, y: touch.clientY };
            }}
            onTouchMove={(e) => {
              if (joystickCenter.current) {
                const touch = e.touches[0];
                joystickCurrent.current = { x: touch.clientX, y: touch.clientY };
              }
            }}
            onTouchEnd={() => {
              joystickCenter.current = null;
              joystickCurrent.current = null;
            }}
          >
            {/* ジョイスティック内部ノブ */}
            <div 
              style={{
                transform: joystickCenter.current && joystickCurrent.current
                  ? `translate(${
                      Math.max(-30, Math.min(30, joystickCurrent.current.x - joystickCenter.current.x))
                    }px, ${
                      Math.max(-30, Math.min(30, joystickCurrent.current.y - joystickCenter.current.y))
                    }px)`
                  : 'translate(0px, 0px)'
              }}
              className="w-10 h-10 bg-rose-500 rounded-full shadow-lg border border-rose-400/50 pointer-events-none transition-transform duration-75 flex items-center justify-center text-xs font-bold text-white/50"
            >
              🕹️
            </div>
          </div>

          {/* B. アクションボタン群 */}
          <div className="flex flex-col gap-3 items-end" id="mobile_buttons_column">
            
            {/* パース・バッグ */}
            <div className="flex gap-2">
              <button
                id="mob_btn_pause"
                onClick={onPauseToggle}
                className="w-11 h-11 bg-stone-900/80 border border-stone-800 text-stone-300 rounded-2xl flex items-center justify-center text-xs' font-bold focus:outline-none"
              >
                🎒
              </button>

              {/* 隠れるボタン（ベッド/クローゼットの付近の時のみ大きく浮き上がる） */}
              <button
                id="mob_btn_hide"
                onClick={toggleHidingTap}
                className={`w-11 h-11 rounded-2xl flex items-center justify-center border font-bold text-lg focus:outline-none ${
                  playerState.isHiding 
                    ? 'bg-sky-500 border-sky-400 text-white animate-bounce' 
                    : 'bg-stone-900/80 border-stone-800 text-stone-400'
                }`}
              >
                🚪
              </button>
            </div>

            <div className="flex gap-2">
              {/* クイック回復薬（小） */}
              {playerState.smallMedsCount > 0 && (
                <button
                  id="mob_btn_quick_small"
                  onClick={(e) => handleItemQuickUse(e, 'SMALL')}
                  className="w-12 h-12 bg-indigo-950/80 border border-indigo-700 text-stone-200 rounded-2xl flex flex-col items-center justify-center text-[10px] focus:outline-none relative"
                >
                  <span>💊</span>
                  <span className="text-[8px] font-bold text-indigo-300">x{playerState.smallMedsCount}</span>
                </button>
              )}

              {/* クイック回復薬（大） */}
              {playerState.largeMedsCount > 0 && (
                <button
                  id="mob_btn_quick_large"
                  onClick={(e) => handleItemQuickUse(e, 'LARGE')}
                  className="w-12 h-12 bg-violet-950/80 border border-violet-700 text-stone-200 rounded-2xl flex flex-col items-center justify-center text-[10px] focus:outline-none"
                >
                  <span>🧪</span>
                  <span className="text-[8px] font-bold text-violet-300">x{playerState.largeMedsCount}</span>
                </button>
              )}

              {/* ライトON/OFF */}
              <button
                id="mob_btn_light"
                onClick={() => {
                  if (!playerState.isHiding) {
                    audioManager.playFlashlightClick();
                    setPlayerState(prev => ({ ...prev, flashlightOn: !prev.flashlightOn }));
                  }
                }}
                className={`w-14 h-14 rounded-full flex items-center justify-center border text-base font-bold focus:outline-none ${
                  playerState.flashlightOn 
                    ? 'bg-amber-400 border-amber-300 text-stone-950 shadow-[0_0_15px_rgba(251,191,36,0.5)]' 
                    : 'bg-stone-900/80 border-stone-800 text-stone-500'
                }`}
              >
                🔦
              </button>

              {/* ダッシュ (Shift) ホールド */}
              <button
                id="mob_btn_dash"
                onTouchStart={() => setTouchDashing(true)}
                onTouchEnd={() => setTouchDashing(false)}
                className={`w-14 h-14 rounded-full flex items-center justify-center border text-base font-bold select-none focus:outline-none ${
                  touchDashing && !isBreathless.current
                    ? 'bg-rose-600 border-rose-500 text-white shadow-[0_0_15px_rgba(225,29,72,0.5)] scale-95' 
                    : 'bg-stone-900/80 border-stone-800 text-stone-400'
                }`}
              >
                🏃
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. PC用の簡易ホットキーガイド (左下底) */}
      {!isMobile && (
        <div 
          className="absolute bottom-4 left-4 flex gap-4 text-[10px] text-stone-500 font-mono tracking-wider pointer-events-none z-10"
          id="pc_controls_legend"
        >
          <div><kbd className="text-amber-500 font-bold px-1 bg-stone-900 border border-stone-800 rounded">WASD / 矢印</kbd> 移 動</div>
          <div><kbd className="text-amber-500 font-bold px-1 bg-stone-900 border border-stone-800 rounded">Shift</kbd> 走 る (音)</div>
          <div><kbd className="text-amber-500 font-bold px-1 bg-stone-900 border border-stone-800 rounded">F / Space</kbd> かいちゅう電灯</div>
          <div><kbd className="text-amber-500 font-bold px-1 bg-stone-900 border border-stone-800 rounded">E</kbd> ベッド等に隠れる / 出る</div>
          <div><kbd className="text-amber-500 font-bold px-1 bg-stone-900 border border-stone-800 rounded">Esc</kbd> かばん (ポーズ)</div>
        </div>
      )}

      {/* ポーズボタン (PC環境でも右下にポーズ用の押しボタンを配置してあげると親切) */}
      <button
        id="quick_pc_pause_btn"
        onClick={onPauseToggle}
        className="absolute bottom-4 right-4 text-stone-500 border border-stone-800 bg-stone-900 p-2.5 rounded-2xl hover:text-stone-300 cursor-pointer hidden sm:flex items-center gap-1 text-[11px] font-sans font-semibold focus:outline-none"
      >
        <span>🎒 カバンをひらく (Esc)</span>
      </button>
    </div>
  );
}
