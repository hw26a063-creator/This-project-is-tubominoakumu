/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { GameState, Player, GameMap, HideSpot, Item, Obstacle } from './types';
import Menu from './components/Menu';
import Intro from './components/Intro';
import PauseMenu from './components/PauseMenu';
import GameCanvas from './components/GameCanvas';
import { audioManager } from './utils/audio';
import { RotateCcw } from 'lucide-react';

// --- マップ構造定義 (1200 x 1200 px の精神病院病院) ---
const MAP_WIDTH = 1200;
const MAP_HEIGHT = 1200;

// 壁の定義（障害物）
const INITIAL_OBSTACLES: Obstacle[] = [
  // 1. 周辺境界の極太外壁 (Canvas側でも制御しているが、明示的に。プレイヤー突抜け防止)
  { x: 0, y: 0, width: MAP_WIDTH, height: 15, color: '#1c1917' },
  { x: 0, y: 0, width: 15, height: MAP_HEIGHT, color: '#1c1917' },
  { x: 0, y: MAP_HEIGHT - 15, width: MAP_WIDTH, height: 15, color: '#1c1917' },
  { x: MAP_WIDTH - 15, y: 0, width: 15, height: MAP_HEIGHT, color: '#1c1917' },

  // 2. 中央脱出扉室 (ナースステーション周辺。迷路の中心部分)
  { x: 500, y: 480, width: 80, height: 15 },
  { x: 620, y: 480, width: 80, height: 15 },
  { x: 500, y: 580, width: 200, height: 15 },
  { x: 500, y: 480, width: 15, height: 100 },
  { x: 685, y: 480, width: 15, height: 100 },

  // 3. 北西エリア（つぼみのスタート個室 & 隔離病棟）
  { x: 15, y: 260, width: 320, height: 20 }, // 南側仕切り
  { x: 320, y: 15, width: 20, height: 260 },  // 東側仕切り
  // 個室内仕切り
  { x: 140, y: 15, width: 15, height: 120 },
  { x: 15, y: 120, width: 100, height: 15 },

  // 4. 北東エリア（薬品庫、手術室。細かめの廊下仕切り）
  { x: 860, y: 15, width: 20, height: 350 },   // 西側仕切り
  { x: 860, y: 350, width: 325, height: 20 },  // 南側仕切り
  // 小部屋
  { x: 860, y: 180, width: 150, height: 15 },
  { x: 1010, y: 180, width: 15, height: 100 },

  // 5. 南西エリア（大部屋病室 W-104 & レクリエーション室）
  { x: 15, y: 860, width: 440, height: 20 },   // 北側仕切り
  { x: 440, y: 700, width: 20, height: 485 },  // 東側仕切り
  // 病室内ベッド間セパレーター
  { x: 150, y: 860, width: 15, height: 160 },
  { x: 300, y: 860, width: 15, height: 160 },

  // 6. 南東エリア（物置、死体安置室またはボイラー室）
  { x: 740, y: 800, width: 445, height: 20 },  // 北側仕切り
  { x: 740, y: 800, width: 20, height: 385 },  // 西側仕切り
  // 物置個室
  { x: 960, y: 820, width: 15, height: 180 },
  { x: 740, y: 1000, width: 140, height: 15 },

  // 7. マップ中央の迷路化用のランダムなブロックウォール
  { x: 300, y: 460, width: 80, height: 80 },  // 中間左ブロック
  { x: 820, y: 460, width: 80, height: 80 },  // 中間右ブロック
  { x: 560, y: 240, width: 80, height: 60 },  // 中間上ブロック
];

// 隠れスポット
const INITIAL_HIDE_SPOTS: HideSpot[] = [
  // 各セクターのベッド/クローゼット
  { id: 'spot_bed_1', type: 'BED', x: 40, y: 40, width: 50, height: 30 },     // セクター1：つぼみの初期室
  { id: 'spot_bed_2', type: 'BED', x: 1080, y: 40, width: 50, height: 30 },   // セクター2：手術病室奥
  { id: 'spot_closet_1', type: 'CLOSET', x: 220, y: 920, width: 35, height: 38 }, // セクター3：南西大部屋
  { id: 'spot_closet_2', type: 'CLOSET', x: 820, y: 1080, width: 35, height: 38 } // セクター4：南東倉庫
];

// アイテムの配置
const INITIAL_ITEMS: Item[] = [
  // 1. 脱出に必要な鍵ピース 4枚 (4隅の最も奥に配置し、ステルスの動線を作る)
  { id: 'key_piece_0', type: 'KEY_PIECE', x: 240, y: 80, collected: false, pulseTimer: 0 },    // 北西 隔離室
  { id: 'key_piece_1', type: 'KEY_PIECE', x: 1100, y: 280, collected: false, pulseTimer: 0 },  // 北東 手術小部屋
  { id: 'key_piece_2', type: 'KEY_PIECE', x: 90, y: 1100, collected: false, pulseTimer: 0 },   // 南西 大部屋の奥
  { id: 'key_piece_3', type: 'KEY_PIECE', x: 1110, y: 1110, collected: false, pulseTimer: 0 }, // 南東 倉庫の最深部

  // 2. 小さい薬 (SAN値 30回復)
  { id: 'med_sm_1', type: 'SMALL_MEDICINE', x: 500, y: 150, collected: false, pulseTimer: 0 },
  { id: 'med_sm_2', type: 'SMALL_MEDICINE', x: 800, y: 300, collected: false, pulseTimer: 0 },
  { id: 'med_sm_3', type: 'SMALL_MEDICINE', x: 60, y: 650, collected: false, pulseTimer: 0 },
  { id: 'med_sm_4', type: 'SMALL_MEDICINE', x: 1120, y: 550, collected: false, pulseTimer: 0 },
  { id: 'med_sm_5', type: 'SMALL_MEDICINE', x: 650, y: 950, collected: false, pulseTimer: 0 },

  // 3. 大きい薬 (SAN値 80回復)
  { id: 'med_lg_1', type: 'LARGE_MEDICINE', x: 950, y: 60, collected: false, pulseTimer: 0 },
  { id: 'med_lg_2', type: 'LARGE_MEDICINE', x: 50, y: 920, collected: false, pulseTimer: 0 },
  { id: 'med_lg_3', type: 'LARGE_MEDICINE', x: 1040, y: 900, collected: false, pulseTimer: 0 }
];

export default function App() {
  const [gameState, setGameState] = useState<GameState>('TITLE');
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // 復活・目覚め時の一時的なメッセージエフェクト
  const [nightmareMessage, setNightmareMessage] = useState<string | null>(null);

  // つぼみの初期セーブ座標（ベッド spot_bed_1 の正面。 40,40 のベッドに対して (65, 95)）
  const initialSpawnX = 65;
  const initialSpawnY = 95;

  // プレイヤーのコアステータス
  const [playerState, setPlayerState] = useState<Player>({
    x: initialSpawnX,
    y: initialSpawnY,
    angle: Math.PI / 2, // 下向き
    speed: 0,
    isDashing: false,
    stamina: 100,
    san: 100,
    flashlightOn: true,
    isHiding: false,
    hidingInId: null,
    keysCollected: [false, false, false, false],
    smallMedsCount: 0,
    largeMedsCount: 0,

    // セーブ用の領域
    saveX: initialSpawnX,
    saveY: initialSpawnY,
    saveKeysCollected: [false, false, false, false],
    saveSmallMedsCount: 0,
    saveLargeMedsCount: 0
  });

  const [map, setMap] = useState<GameMap>({
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    obstacles: INITIAL_OBSTACLES,
    spawnX: initialSpawnX,
    spawnY: initialSpawnY,
    exitX: 600, // マップ中央の脱出扉
    exitY: 530,
    exitWidth: 60,
    exitHeight: 20,
    hideSpots: INITIAL_HIDE_SPOTS,
    items: INITIAL_ITEMS
  });

  // ゲームの開始
  const handleStartGame = () => {
    // 状態の完全初期化
    setPlayerState({
      x: initialSpawnX,
      y: initialSpawnY,
      angle: Math.PI / 2,
      speed: 0,
      isDashing: false,
      stamina: 100,
      san: 100,
      flashlightOn: true,
      isHiding: false,
      hidingInId: null,
      keysCollected: [false, false, false, false],
      smallMedsCount: 1, // 最初からカバンに1つ持たせておく（優しい設計）
      largeMedsCount: 0,

      saveX: initialSpawnX,
      saveY: initialSpawnY,
      saveKeysCollected: [false, false, false, false],
      saveSmallMedsCount: 1,
      saveLargeMedsCount: 0
    });

    // マップアイテムのリセット
    setMap(prev => ({
      ...prev,
      items: INITIAL_ITEMS.map(i => ({ ...i, collected: false }))
    }));

    setGameState('INTRO');
    setIsPaused(false);
  };

  // イントロ完了 → 本編開始
  const handleIntroComplete = () => {
    setGameState('PLAYING');
    audioManager.setHeartbeatBPM(65);
    audioManager.startHeartbeat();
  };

  // ポーズの切り替え (Esc やボタンクリック)
  const handlePauseToggle = () => {
    audioManager.playFlashlightClick();
    setIsPaused(prev => {
      const next = !prev;
      if (next) {
        audioManager.stopAll();
      } else {
        audioManager.startHeartbeat();
      }
      return next;
    });
  };

  // ポーズ内：カバンでお薬を使用
  const handleUseMedicine = (type: 'SMALL' | 'LARGE') => {
    setPlayerState(prev => {
      let nextSan = prev.san;
      let nextSmall = prev.smallMedsCount;
      let nextLarge = prev.largeMedsCount;

      if (type === 'SMALL') {
        nextSan = Math.min(100, prev.san + 30);
        nextSmall = Math.max(0, prev.smallMedsCount - 1);
      } else {
        nextSan = Math.min(100, prev.san + 80);
        nextLarge = Math.max(0, prev.largeMedsCount - 1);
      }

      return {
        ...prev,
        san: nextSan,
        smallMedsCount: nextSmall,
        largeMedsCount: nextLarge
      };
    });
  };

  // ポーズ内：タイトルメニューに戻る
  const handleQuitGame = () => {
    audioManager.stopAll();
    setGameState('TITLE');
    setIsPaused(false);
  };

  // 敵に捕まる or SAN値0でショック死 (即ベッドから復活)
  const handleGameOver = () => {
    setGameState('GAMEOVER');
    audioManager.stopAll();
  };

  // ベッドから目覚め（セーブデータからのリスタート）
  const handleRespawn = () => {
    audioManager.playFlashlightClick();
    
    // セーブされた情報からプレイヤーポジションとアイテムを復帰
    setPlayerState(prev => ({
      ...prev,
      x: prev.saveX,
      y: prev.saveY,
      angle: Math.PI / 2, // 下向き
      isDashing: false,
      stamina: 100,
      san: 100, // SAN値全快
      isHiding: false,
      hidingInId: null,
      flashlightOn: true,
      keysCollected: [...prev.saveKeysCollected],
      smallMedsCount: prev.saveSmallMedsCount,
      largeMedsCount: prev.saveLargeMedsCount
    }));

    // 回収済みアイテムの整合性修正（回収した鍵や回復薬はセーブ状態を維持、セーブされていないゴミアイテムはもとに戻す）
    // セーブされた鍵
    const savedKeys = playerState.saveKeysCollected;
    
    setMap(prev => {
      const updatedItems = prev.items.map(item => {
        if (item.type === 'KEY_PIECE') {
          const idx = parseInt(item.id.replace('key_piece_', ''), 10);
          // もしセーブされた鍵リストに入っていれば collected = true、そうでなければ false にして再配置
          return {
            ...item,
            collected: idx >= 0 && idx < 4 ? savedKeys[idx] : false
          };
        } else {
          // 回復薬など：セーブされていない薬は再配置される
          // （鍵を入手したタイミングの持ち物・マップが保存されていると考えるので、今回のセーブ時に拾っていない薬は復活する）
          // つぼみのカバン薬合計とマップ上が矛盾しないように、回収フラグをリセットするなど行います。
          // シンプル化のため、今回は鍵以外の拾った薬はベッド復活時にマップ上へそのまま再配置されます。
          return {
            ...item,
            collected: false // 薬は何度でも湧き直す優しいあくむ設定
          };
        }
      });
      return { ...prev, items: updatedItems };
    });

    setGameState('PLAYING');
    setIsPaused(false);

    // ドット絵ホラー特有の不気味なテキスト表示
    setNightmareMessage("「……あ、また同じベッド。悪夢から醒められないの……？」");
    setTimeout(() => {
      setNightmareMessage(null);
    }, 4000);
  };

  // ゲームクリア
  const handleGameClear = () => {
    setGameState('CLEAR');
    audioManager.stopAll();
  };

  // ミュート
  const toggleMute = () => {
    const muted = audioManager.toggleMute();
    setIsMuted(muted);
    audioManager.playFlashlightClick();
  };

  return (
    <main 
      className="relative w-full min-h-screen bg-stone-950 font-sans text-stone-100 overflow-hidden"
      id="app_root"
    >
      {/* 1. タイトル/メニュー */}
      {gameState === 'TITLE' && (
        <Menu onStart={handleStartGame} />
      )}

      {/* 2. イントロノベル */}
      {gameState === 'INTRO' && (
        <Intro onIntroComplete={handleIntroComplete} />
      )}

      {/* 3. ゲーム本編 (Canvas & ループ) */}
      {(gameState === 'PLAYING' || isPaused) && (
        <div className="relative w-full h-full" id="game_container">
          <GameCanvas
            isPaused={isPaused}
            onPauseToggle={handlePauseToggle}
            playerState={playerState}
            setPlayerState={setPlayerState}
            map={map}
            setMap={setMap}
            onGameOver={handleGameOver}
            onGameClear={handleGameClear}
          />

          {/* 復活時の一時モノローグメッセージテキスト */}
          {nightmareMessage && (
            <div 
              className="absolute left-1/2 -translate-x-1/2 bottom-32 bg-stone-950/90 border border-stone-800 text-rose-300 text-xs sm:text-sm p-4 px-6 rounded-2xl shadow-xl z-30 animate-pulse font-medium min-w-80 text-center select-none"
              id="nightmare_overlay_text"
            >
              {nightmareMessage}
            </div>
          )}

          {/* ポーズ / カバンオーバーレイ */}
          {isPaused && (
            <PauseMenu
              smallMedsCount={playerState.smallMedsCount}
              largeMedsCount={playerState.largeMedsCount}
              currentSan={playerState.san}
              keysCollected={playerState.keysCollected}
              onUseMedicine={handleUseMedicine}
              onResume={handlePauseToggle}
              onQuit={handleQuitGame}
            />
          )}
        </div>
      )}

      {/* 4. ゲームオーバー画面 */}
      {gameState === 'GAMEOVER' && (
        <div 
          className="fixed inset-0 bg-stone-950/95 flex flex-col justify-center items-center p-6 z-50 text-center space-y-8 select-none"
          id="gameover_screen"
        >
          <div className="space-y-2" id="go_header">
            <h1 className="text-red-600 text-6xl md:text-7xl font-extrabold font-sans tracking-wide animate-pulse">
              ショック死
            </h1>
            <p className="text-stone-400 text-xs font-mono py-1.5 uppercase tracking-widest">[ SANITY DEPLETED // SHOCKED ]</p>
          </div>

          <div className="max-w-md bg-stone-900 border border-stone-800/80 p-6 rounded-2xl space-y-4 shadow-2xl text-stone-300 text-sm leading-relaxed" id="go_quote_box">
            <p className="italic text-rose-300">
              「冷たい手の感触……。
              耳元での不気味なささやき声が止まらない……。
              わたしの頭が狂っておかしくなっちゃう……！」
            </p>
            <div className="text-xs text-stone-500 font-mono mt-1 pt-1 border-t border-stone-850">
              ※つぼみちゃんはあくむの中で意識を失い、隔離部屋のベッドで目覚める記憶が残っています。
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4" id="go_actions">
            {/* ベッドからやり直すボタン（セーブ値を保持） */}
            <button
              id="go_btn_retry"
              onClick={handleRespawn}
              className="px-8 py-3.5 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white rounded-xl shadow-lg font-bold text-lg transform hover:-translate-y-0.5 transition-all cursor-pointer flex items-center justify-center gap-2 focus:outline-none"
            >
              <RotateCcw size={20} />
              <span>ベッドからやりなおす</span>
            </button>

            {/* タイトルに戻る */}
            <button
              id="go_btn_title"
              onClick={handleQuitGame}
              className="px-8 py-3.5 bg-stone-900 border border-stone-800 hover:bg-stone-800 active:scale-95 text-stone-400 rounded-xl font-semibold text-base transition-all cursor-pointer focus:outline-none"
            >
              タイトルへ戻る
            </button>
          </div>
        </div>
      )}

      {/* 5. クリア（脱出）画面 */}
      {gameState === 'CLEAR' && (
        <div 
          className="fixed inset-0 bg-gradient-to-t from-stone-950 via-stone-900 to-indigo-950/80 flex flex-col justify-center items-center p-6 z-50 text-center space-y-8 select-none"
          id="clear_screen"
        >
          {/* 星をちりばめるような癒やしエフェクト */}
          <div className="absolute top-1/3 w-80 h-80 bg-cyan-500/10 rounded-full filter blur-[80px] animate-pulse pointer-events-none" />

          <div className="space-y-2 z-10" id="clear_header">
            <span className="text-cyan-400 font-mono text-sm tracking-[0.4em] font-bold">CONGRATULATIONS</span>
            <h1 className="text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-teal-200 via-cyan-100 to-indigo-200 tracking-wider font-sans drop-shadow-[0_2px_10px_rgba(34,211,238,0.4)]">
              あくむからの解放
            </h1>
          </div>

          <div 
            className="max-w-md bg-stone-900/80 backdrop-blur border border-cyan-900/50 p-6 md:p-8 rounded-3xl space-y-4 shadow-2xl text-stone-300 text-sm md:text-base leading-relaxed z-10"
            id="clear_narrative_box"
          >
            <p className="text-zinc-200 font-sans">
              つぼみちゃんは 4枚の鍵を集め、
              病棟中央の巨大な扉を開け放しました。
            </p>
            <p className="italic text-teal-300 text-sm mt-3">
              「……ひかり……？
              あ、眩しい。お耳のカツカツする這う音も、もう聞こえない。
              あくむは終わったんだ……。パパ、ママ、お家に連れてって……」
            </p>
            <div className="text-xs text-stone-500 font-mono mt-4 pt-3 border-t border-stone-850">
              つぼみは静かに目を覚ましました。
              そこは本当の、明るい朝の日差しがさしこむ自分の部屋でした。
            </div>
          </div>

          <button
            id="clear_btn_menu"
            onClick={handleQuitGame}
            className="px-10 py-4 bg-teal-600 hover:bg-teal-500 active:scale-95 text-stone-950 font-bold rounded-2xl shadow-[0_0_20px_rgba(13,148,136,0.3)] hover:shadow-[0_0_30px_rgba(13,148,136,0.5)] transform hover:-translate-y-0.5 transition-all text-lg cursor-pointer z-10 focus:outline-none"
          >
            タイトルに戻る
          </button>
        </div>
      )}
    </main>
  );
}
