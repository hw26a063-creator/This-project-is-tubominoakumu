/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Sparkles, ArrowLeft, LogOut, Package, Key, Map as MapIcon } from 'lucide-react';
import { audioManager } from '../utils/audio';

interface PauseMenuProps {
  smallMedsCount: number;
  largeMedsCount: number;
  currentSan: number;
  keysCollected: boolean[]; // size 4
  notesCollected: boolean[]; // size 4
  onUseMedicine: (type: 'SMALL' | 'LARGE') => void;
  onResume: () => void;
  onQuit: () => void;
  initialTab?: 'MAIN' | 'BAG' | 'MAP';
  playerX?: number;
  playerY?: number;
}

export default function PauseMenu({
  smallMedsCount,
  largeMedsCount,
  currentSan,
  keysCollected,
  notesCollected,
  onUseMedicine,
  onResume,
  onQuit,
  initialTab = 'MAIN',
  playerX = 65,
  playerY = 95
}: PauseMenuProps) {
  const [activeTab, setActiveTab] = useState<'MAIN' | 'BAG' | 'MAP'>(initialTab);
  const [mainSelectedIndex, setMainSelectedIndex] = useState<number>(0); // 0: かばん, 1: 地図, 2: もどる, 3: おわる
  const [bagSelectedIndex, setBagSelectedIndex] = useState<number>(0);   // 0: 小さい薬, 1: 大きい薬, 2: もどる
  const [selectedNoteIndex, setSelectedNoteIndex] = useState<number | null>(null);

  useEffect(() => {
    setActiveTab(initialTab);
    if (initialTab === 'MAP') {
      setMainSelectedIndex(1);
    } else if (initialTab === 'BAG') {
      setMainSelectedIndex(0);
    }
  }, [initialTab]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      
      if (activeTab === 'MAIN') {
        if (key === 'w' || e.key === 'ArrowUp') {
          e.preventDefault();
          audioManager.playFlashlightClick();
          setMainSelectedIndex((prev) => (prev === 0 ? 3 : prev - 1));
        } else if (key === 's' || e.key === 'ArrowDown') {
          e.preventDefault();
          audioManager.playFlashlightClick();
          setMainSelectedIndex((prev) => (prev === 3 ? 0 : prev + 1));
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          audioManager.playFlashlightClick();
          handleMainSelect();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          audioManager.playFlashlightClick();
          onResume();
        } else if (key === 'm') {
          e.preventDefault();
          audioManager.playFlashlightClick();
          onResume(); // 地図をトグルで閉じる
        }
      } else if (activeTab === 'BAG') {
        if (key === 'w' || e.key === 'ArrowUp') {
          e.preventDefault();
          audioManager.playFlashlightClick();
          setBagSelectedIndex((prev) => (prev === 0 ? 2 : prev - 1));
        } else if (key === 's' || e.key === 'ArrowDown') {
          e.preventDefault();
          audioManager.playFlashlightClick();
          setBagSelectedIndex((prev) => (prev === 2 ? 0 : prev + 1));
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleBagSelect();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          audioManager.playFlashlightClick();
          setActiveTab('MAIN');
        }
      } else if (activeTab === 'MAP') {
        if (e.key === 'Escape' || key === 'm') {
          e.preventDefault();
          audioManager.playFlashlightClick();
          onResume(); // 地図をトグルで閉じる
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          audioManager.playFlashlightClick();
          setActiveTab('MAIN');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, mainSelectedIndex, bagSelectedIndex, smallMedsCount, largeMedsCount, currentSan, onResume]);

  const handleMainSelect = () => {
    if (mainSelectedIndex === 0) {
      setActiveTab('BAG');
      setBagSelectedIndex(0);
    } else if (mainSelectedIndex === 1) {
      setActiveTab('MAP');
    } else if (mainSelectedIndex === 2) {
      onResume();
    } else if (mainSelectedIndex === 3) {
      onQuit();
    }
  };

  const handleBagSelect = () => {
    if (bagSelectedIndex === 0) {
      if (smallMedsCount > 0) {
        if (currentSan >= 100) {
          audioManager.playFlashlightClick();
        } else {
          audioManager.playUseMedicine();
          onUseMedicine('SMALL');
        }
      } else {
        audioManager.playFlashlightClick();
      }
    } else if (bagSelectedIndex === 1) {
      if (largeMedsCount > 0) {
        if (currentSan >= 100) {
          audioManager.playFlashlightClick();
        } else {
          audioManager.playUseMedicine();
          onUseMedicine('LARGE');
        }
      } else {
        audioManager.playFlashlightClick();
      }
    } else if (bagSelectedIndex === 2) {
      audioManager.playFlashlightClick();
      setActiveTab('MAIN');
    }
  };

  // 鍵ピースの座標
  const keyCoords = [
    { name: '隔離室奥', x: 240, y: 80 },
    { name: '手術小部屋', x: 1100, y: 280 },
    { name: '大部屋奥', x: 90, y: 1100 },
    { name: '倉庫最深部', x: 1110, y: 1110 }
  ];

  return (
    <div 
      className="fixed inset-0 bg-transparent flex items-center justify-center p-4 z-40 select-none font-sans"
      id="pause_overlay"
    >
      {/* うっすらぼやける不気味でノスタルジックなスリット背景 */}
      <div className="absolute inset-0 bg-stone-950/85 backdrop-blur-md pointer-events-none" />

      {/* ポーズカード本体：マップタブのときは横幅を大きくして見やすくする */}
      <div 
        className={`w-full bg-stone-900 border-2 border-stone-800 rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl relative z-50 text-stone-200 transition-all duration-300 ${
          activeTab === 'MAP' ? 'max-w-2xl' : 'max-w-md'
        }`}
        id="pause_box"
      >
        {/* ヘッダー */}
        <div className="flex justify-between items-center border-b border-stone-800 pb-3" id="pause_box_header">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
            <h2 className="text-xl font-bold tracking-wider text-rose-300">
              {activeTab === 'MAIN' ? 'めにゅー' : activeTab === 'BAG' ? 'かばん（インベントリ）' : '病棟案内図（MAP）'}
            </h2>
          </div>
          {activeTab !== 'MAIN' && (
            <button
              onClick={() => {
                audioManager.playFlashlightClick();
                setActiveTab('MAIN');
              }}
              className="text-xs text-stone-500 hover:text-stone-300 flex items-center gap-1 transition-colors px-2 py-1 rounded border border-stone-800 hover:border-stone-700 cursor-pointer"
            >
              <ArrowLeft size={12} /> MAIN
            </button>
          )}
        </div>

        {/* SAN値ゲージを一時停止時にも親切に表示 */}
        {activeTab !== 'MAP' && (
          <div className="bg-stone-950/60 border border-stone-800/60 p-3 rounded-2xl flex items-center justify-between gap-4" id="pause_san_monitor">
            <div className="text-xs font-semibold text-stone-400">現在の正気度 (SAN)</div>
            <div className="flex-1 max-w-[180px] h-3 bg-stone-900 rounded-full overflow-hidden border border-stone-800">
              <div 
                style={{ width: `${currentSan}%` }}
                className={`h-full transition-all duration-300 ${
                  currentSan > 50 ? 'bg-indigo-500' : currentSan > 20 ? 'bg-amber-500' : 'bg-red-600 animate-pulse'
                }`}
              />
            </div>
            <div className={`text-xs font-mono font-bold ${
              currentSan > 50 ? 'text-indigo-400' : currentSan > 20 ? 'text-amber-400' : 'text-red-500 font-extrabold animate-bounce'
            }`}>
              {Math.round(currentSan)}%
            </div>
          </div>
        )}

        {/* メインメニュー */}
        {activeTab === 'MAIN' ? (
          <div className="flex flex-col gap-3 py-2" id="main_menu_buttons">
            {/* かばんを開く */}
            <button
              id="pause_btn_bag"
              onClick={() => {
                audioManager.playFlashlightClick();
                setActiveTab('BAG');
                setBagSelectedIndex(0);
              }}
              onMouseEnter={() => setMainSelectedIndex(0)}
              className={`flex items-center justify-between px-5 py-3 rounded-xl border transition-all cursor-pointer text-left focus:outline-none ${
                mainSelectedIndex === 0
                  ? 'bg-rose-950/30 border-rose-500 text-rose-100 scale-102 pl-6'
                  : 'bg-stone-950/50 border-stone-800/80 text-stone-400'
              }`}
            >
              <div className="flex items-center gap-3">
                <Package size={18} className={mainSelectedIndex === 0 ? 'text-rose-400' : 'text-stone-500'} />
                <div className="leading-none">
                  <span className="font-semibold block text-sm">かばん</span>
                  <span className="text-[10px] text-stone-500 mt-1 block">お薬の使用、鍵のピース確認</span>
                </div>
              </div>
              <span className="text-xs font-mono text-rose-500/80 font-bold">{smallMedsCount + largeMedsCount} 個</span>
            </button>

            {/* 地図を開く */}
            <button
              id="pause_btn_map"
              onClick={() => {
                audioManager.playFlashlightClick();
                setActiveTab('MAP');
              }}
              onMouseEnter={() => setMainSelectedIndex(1)}
              className={`flex items-center justify-between px-5 py-3 rounded-xl border transition-all cursor-pointer text-left focus:outline-none ${
                mainSelectedIndex === 1
                  ? 'bg-rose-950/30 border-rose-500 text-rose-100 scale-102 pl-6'
                  : 'bg-stone-950/50 border-stone-800/80 text-stone-400'
              }`}
            >
              <div className="flex items-center gap-3">
                <MapIcon size={18} className={mainSelectedIndex === 1 ? 'text-rose-400' : 'text-stone-500'} />
                <div className="leading-none">
                  <span className="font-semibold block text-sm">案内図 (MAP)</span>
                  <span className="text-[10px] text-stone-500 mt-1 block">現在位置と病棟の部屋名を確認</span>
                </div>
              </div>
            </button>

            {/* ゲームに戻る */}
            <button
              id="pause_btn_resume"
              onClick={() => {
                audioManager.playFlashlightClick();
                onResume();
              }}
              onMouseEnter={() => setMainSelectedIndex(2)}
              className={`flex items-center justify-between px-5 py-3 rounded-xl border transition-all cursor-pointer text-left focus:outline-none ${
                mainSelectedIndex === 2
                  ? 'bg-rose-950/30 border-rose-500 text-rose-100 scale-102 pl-6'
                  : 'bg-stone-950/50 border-stone-800/80 text-stone-400'
              }`}
            >
              <div className="flex items-center gap-3">
                <ArrowLeft size={18} className={mainSelectedIndex === 2 ? 'text-rose-400' : 'text-stone-500'} />
                <div className="leading-none">
                  <span className="font-semibold block text-sm">もどる</span>
                  <span className="text-[10px] text-stone-500 mt-1 block">あくむの探索をつづける [Esc / M]</span>
                </div>
              </div>
            </button>

            {/* ゲームを終わる */}
            <button
              id="pause_btn_quit"
              onClick={() => {
                audioManager.playFlashlightClick();
                onQuit();
              }}
              onMouseEnter={() => setMainSelectedIndex(3)}
              className={`flex items-center justify-between px-5 py-3 rounded-xl border transition-all cursor-pointer text-left focus:outline-none ${
                mainSelectedIndex === 3
                  ? 'bg-red-950/30 border-red-500 text-red-300 scale-102 pl-6'
                  : 'bg-stone-950/50 border-stone-800/80 text-stone-400'
              }`}
            >
              <div className="flex items-center gap-3">
                <LogOut size={18} className="text-red-500" />
                <div className="leading-none">
                  <span className="font-semibold block text-sm text-red-400">おわる</span>
                  <span className="text-[10px] text-stone-500 mt-1 block">タイトル画面へもどる</span>
                </div>
              </div>
            </button>
          </div>
        ) : activeTab === 'BAG' ? (
          /* かばん（インベントリ）画面 */
          <div className="space-y-4" id="bag_sub_menu">
            {/* カギの回収スロット表示 */}
            <div className="bg-stone-950 p-4 border border-stone-800/80 rounded-2xl" id="keys_slots_container">
              <span className="text-xs text-stone-400 font-semibold mb-2 block flex items-center gap-1">
                <Key size={14} className="text-amber-500" /> 脱出の鍵のピース (4つ集めて中央へ)
              </span>
              <div className="grid grid-cols-4 gap-2 mt-2" id="key_slots_grid">
                {keysCollected.map((collected, idx) => (
                  <div 
                    key={idx}
                    id={`key_slot_${idx}`}
                    className={`h-12 border-2 rounded-xl flex items-center justify-center transition-all ${
                      collected 
                        ? 'bg-amber-950/30 border-amber-500 text-amber-200 shadow-[0_0_8px_rgba(245,158,11,0.2)]' 
                        : 'bg-stone-900 border-stone-800 text-stone-600'
                    }`}
                  >
                    <Key size={18 + (idx % 2) * 2} className={collected ? 'animate-pulse text-amber-400' : ''} />
                  </div>
                ))}
              </div>
            </div>

            {/* お薬ラインナップ */}
            <div className="flex flex-col gap-3" id="pharmacy_items_container">
              {/* 小さい薬 */}
              <button
                id="bag_btn_med_small"
                onClick={() => {
                  setBagSelectedIndex(0);
                  handleBagSelect();
                }}
                onMouseEnter={() => setBagSelectedIndex(0)}
                className={`flex items-center justify-between p-3 rounded-xl border text-left cursor-pointer transition-all focus:outline-none ${
                  bagSelectedIndex === 0
                    ? 'bg-indigo-950/30 border-indigo-500 text-indigo-100 pl-4.5 scale-[1.01]'
                    : 'bg-stone-950/30 border-stone-850 text-stone-400'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold border ${
                    bagSelectedIndex === 0 ? 'bg-indigo-950 border-indigo-500' : 'bg-stone-900 border-stone-800'
                  }`}>
                    💊
                  </div>
                  <div>
                    <span className="font-semibold block text-sm">小さいかいふく薬</span>
                    <span className="text-[10px] text-stone-500 mt-0.5 block">SAN値を <strong className="text-indigo-400">30</strong> 回復する薬</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold font-mono text-zinc-300">{smallMedsCount} 個</div>
                  {smallMedsCount > 0 && currentSan < 100 && bagSelectedIndex === 0 && (
                    <span className="text-[9px] text-indigo-400 animate-pulse font-semibold">決定で使用</span>
                  )}
                </div>
              </button>

              {/* 大きい薬 */}
              <button
                id="bag_btn_med_large"
                onClick={() => {
                  setBagSelectedIndex(1);
                  handleBagSelect();
                }}
                onMouseEnter={() => setBagSelectedIndex(1)}
                className={`flex items-center justify-between p-3 rounded-xl border text-left cursor-pointer transition-all focus:outline-none ${
                  bagSelectedIndex === 1
                    ? 'bg-indigo-950/30 border-indigo-500 text-indigo-100 pl-4.5 scale-[1.01]'
                    : 'bg-stone-950/30 border-stone-850 text-stone-400'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold border ${
                    bagSelectedIndex === 1 ? 'bg-indigo-950 border-indigo-500' : 'bg-stone-900 border-stone-800'
                  }`}>
                    🧪
                  </div>
                  <div>
                    <span className="font-semibold block text-sm">大きいかいふく薬</span>
                    <span className="text-[10px] text-stone-500 mt-0.5 block">SAN値を <strong className="text-indigo-400">80</strong> 回復するお薬</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold font-mono text-zinc-300">{largeMedsCount} 個</div>
                  {largeMedsCount > 0 && currentSan < 100 && bagSelectedIndex === 1 && (
                    <span className="text-[9px] text-indigo-400 animate-pulse font-semibold">決定で使用</span>
                  )}
                </div>
              </button>

            {/* メモ用紙 */}
            <div className="bg-stone-950/60 p-4 border border-stone-800/80 rounded-2xl" id="notes_container">
              <span className="text-xs text-stone-400 font-semibold mb-2 block flex items-center gap-1">
                📝 拾ったメモ用紙 (タップで中身を読む)
              </span>
              <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1 text-xs" id="notes_list">
                {[
                  { name: '診察記録の切れ端(1)', desc: '「……102号室の患者\n◼️状が◼️◼️◼️◼️◼️で◼️◼️◼️◼️◼️◼️◼️◼️◼️である◼️◼️観察が◼️要\n◼️◼️(読めないや)……」', loc: 'カウンセリング室' },
                  { name: '診察記録の切れ端(2)', desc: '「……◼️◼️・◼️◼️◼️◼️◼️◼️◼️◼️化。◼️人はこれを『◼️◼️◼️◼️◼️◼️』と◼️◼️、◼️◼️◼️◼️◼️◼️に(読めないや)……」', loc: '医師当直室' },
                  { name: 'カレンダーの切れ端', desc: '「21日に赤い二重丸とケーキのイラストが描かれている」', loc: '面会室' },
                  { name: '破られた日記の1ページ', desc: '「……大丈夫、大丈夫だから. . .ずっとそばにいるよ、つぼみ……。」', loc: 'ボイラー室' }
                ].map((note, idx) => {
                  const collected = notesCollected ? notesCollected[idx] : false;
                  return (
                    <div 
                      key={idx} 
                      onClick={() => {
                        if (collected) {
                          audioManager.playFlashlightClick();
                          setSelectedNoteIndex(idx);
                        }
                      }}
                      className={`p-2.5 rounded-xl border transition-all ${
                        collected 
                          ? 'bg-emerald-950/20 border-emerald-800/60 text-emerald-100 cursor-pointer hover:bg-emerald-950/40 hover:border-emerald-500' 
                          : 'bg-stone-900/40 border-stone-800/60 text-stone-600 select-none'
                      }`}
                    >
                      <div className="flex justify-between font-bold text-[10px]">
                        <span>{note.name}</span>
                        <span className={collected ? 'text-emerald-400 font-sans animate-pulse' : 'text-stone-700 font-sans'}>
                          {collected ? '【所持: タップで読む】' : `【未回収: ${note.loc}】`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 戻るボタン */}
            <button
              id="bag_btn_back_main"
              onClick={() => {
                audioManager.playFlashlightClick();
                setActiveTab('MAIN');
              }}
              onMouseEnter={() => setBagSelectedIndex(2)}
              className={`flex justify-center items-center gap-1.5 py-2 mt-1 rounded-xl border text-center text-xs font-semibold cursor-pointer transition-all focus:outline-none ${
                bagSelectedIndex === 2
                  ? 'bg-stone-800 border-stone-600 text-stone-100'
                  : 'bg-stone-950/50 border-stone-900 text-stone-500'
              }`}
            >
              <ArrowLeft size={14} /> MAINにもどる
            </button>
            </div>
          </div>
        ) : (
          /* マップ（病棟案内図）画面 */
          <div className="space-y-4" id="map_sub_menu">
            <div className="relative w-full max-w-[420px] aspect-square max-h-[420px] mx-auto bg-stone-950 border border-stone-800 rounded-2xl overflow-hidden shadow-inner flex items-center justify-center p-2">
              <svg viewBox="0 0 1200 1200" className="w-full h-full text-stone-400 select-none">
                {/* グリッド・方眼背景 */}
                <defs>
                  <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
                    <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#1c1917" strokeWidth="1.5" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />

                {/* 病院の極太外壁 */}
                <rect x="0" y="0" width="1200" height="1200" fill="none" stroke="#2e2a24" strokeWidth="30" />

                {/* 各部屋の描画 (9つのエリアをSVGレイアウトに落とし込む) */}
                {/* 1. 北西：隔離病棟 (W-102) */}
                <g>
                  <rect x="15" y="15" width="305" height="245" fill="rgba(28, 25, 23, 0.6)" stroke="#44403c" strokeWidth="3" />
                  <text x="167" y="120" fill="#a8a29e" fontSize="24" fontWeight="bold" textAnchor="middle">隔離病棟</text>
                  <text x="167" y="150" fill="#78716c" fontSize="16" fontFamily="monospace" textAnchor="middle">WARD W-102</text>
                </g>

                {/* 2. 中北：面会室 */}
                <g>
                  <rect x="450" y="15" width="300" height="165" fill="rgba(28, 25, 23, 0.6)" stroke="#44403c" strokeWidth="3" />
                  <text x="600" y="85" fill="#a8a29e" fontSize="24" fontWeight="bold" textAnchor="middle">面会室</text>
                  <text x="600" y="115" fill="#78716c" fontSize="16" fontFamily="monospace" textAnchor="middle">VISITOR ROOM</text>
                </g>

                {/* 3. 北東：手術室・薬品庫 */}
                <g>
                  <rect x="860" y="15" width="325" height="335" fill="rgba(28, 25, 23, 0.6)" stroke="#44403c" strokeWidth="3" />
                  <text x="1022" y="160" fill="#a8a29e" fontSize="24" fontWeight="bold" textAnchor="middle">手術室・薬品庫</text>
                  <text x="1022" y="190" fill="#78716c" fontSize="16" fontFamily="monospace" textAnchor="middle">OPERATING AREA-B</text>
                </g>

                {/* 4. 中西：カウンセリング室 (W-103) */}
                <g>
                  <rect x="15" y="380" width="245" height="180" fill="rgba(28, 25, 23, 0.6)" stroke="#44403c" strokeWidth="3" />
                  <text x="137" y="460" fill="#a8a29e" fontSize="24" fontWeight="bold" textAnchor="middle">カウンセリング室</text>
                  <text x="137" y="490" fill="#78716c" fontSize="16" fontFamily="monospace" textAnchor="middle">WARD W-103</text>
                </g>

                {/* 5. 中央：ナースステーション & 脱出扉 */}
                <g>
                  <rect x="500" y="480" width="200" height="100" fill="rgba(127, 29, 29, 0.15)" stroke="#ef4444" strokeWidth="3" strokeDasharray="6 4" />
                  <text x="600" y="525" fill="#fca5a5" fontSize="22" fontWeight="bold" textAnchor="middle">ナースステーション</text>
                  <text x="600" y="555" fill="#ef4444" fontSize="16" fontWeight="bold" fontFamily="monospace" textAnchor="middle">★ 中央脱出扉 ★</text>
                </g>

                {/* 6. 中東：医師当直室 */}
                <g>
                  <rect x="940" y="450" width="245" height="200" fill="rgba(28, 25, 23, 0.6)" stroke="#44403c" strokeWidth="3" />
                  <text x="1062" y="540" fill="#a8a29e" fontSize="24" fontWeight="bold" textAnchor="middle">医師当直・診察室</text>
                  <text x="1062" y="570" fill="#78716c" fontSize="16" fontFamily="monospace" textAnchor="middle">STAFF ROOM</text>
                </g>

                {/* 7. 南西：大部屋病室 (W-104) */}
                <g>
                  <rect x="15" y="860" width="425" height="325" fill="rgba(28, 25, 23, 0.6)" stroke="#44403c" strokeWidth="3" />
                  <text x="227" y="1010" fill="#a8a29e" fontSize="24" fontWeight="bold" textAnchor="middle">大部屋病室</text>
                  <text x="227" y="1040" fill="#78716c" fontSize="16" fontFamily="monospace" textAnchor="middle">WARD W-104</text>
                </g>

                {/* 8. 中南：ボイラー室 */}
                <g>
                  <rect x="480" y="980" width="240" height="205" fill="rgba(28, 25, 23, 0.6)" stroke="#44403c" strokeWidth="3" />
                  <text x="600" y="1070" fill="#a8a29e" fontSize="24" fontWeight="bold" textAnchor="middle">ボイラー室</text>
                  <text x="600" y="1100" fill="#78716c" fontSize="16" fontFamily="monospace" textAnchor="middle">BOILER ROOM</text>
                </g>

                {/* 9. 南東：資材倉庫 */}
                <g>
                  <rect x="740" y="800" width="445" height="385" fill="rgba(28, 25, 23, 0.6)" stroke="#44403c" strokeWidth="3" />
                  <text x="962" y="980" fill="#a8a29e" fontSize="24" fontWeight="bold" textAnchor="middle">資材倉庫</text>
                  <text x="962" y="1010" fill="#78716c" fontSize="16" fontFamily="monospace" textAnchor="middle">STORAGE AREA</text>
                </g>

                {/* 迷路の通路境界線のヒント（うっすらしたガイドライン） */}
                <path d="M 320 260 L 320 860 M 860 350 L 860 800 M 15 260 L 450 260 M 750 180 L 1185 180" fill="none" stroke="#292524" strokeWidth="4" strokeDasharray="8 6" />

                {/* 脱出扉マーク */}
                <rect x="570" y="470" width="60" height="20" fill="#ef4444" rx="2" />
                <text x="600" y="485" fill="#ffffff" fontSize="14" fontWeight="bold" textAnchor="middle">EXIT</text>

                {/* 4つの未回収鍵ピースの位置をプロット（恐怖の導線） */}
                {keyCoords.map((kc, idx) => {
                  const collected = keysCollected[idx];
                  return (
                    <g key={idx}>
                      {!collected ? (
                        <>
                          <circle cx={kc.x} cy={kc.y} r="32" fill="rgba(245, 158, 11, 0.15)" className="animate-pulse" />
                          <circle cx={kc.x} cy={kc.y} r="10" fill="#f59e0b" />
                          <text x={kc.x} y={kc.y + 6} fill="#78350f" fontSize="16" fontWeight="bold" textAnchor="middle">🔑</text>
                          <text x={kc.x} y={kc.y - 18} fill="#f59e0b" fontSize="12" fontWeight="bold" textAnchor="middle">ピース {idx + 1}</text>
                        </>
                      ) : (
                        <>
                          <circle cx={kc.x} cy={kc.y} r="10" fill="#10b981" />
                          <text x={kc.x} y={kc.y + 6} fill="#ffffff" fontSize="12" fontWeight="bold" textAnchor="middle">✓</text>
                        </>
                      )}
                    </g>
                  );
                })}

                {/* プレイヤーの現在位置マーク (ピンポンアニメーション) */}
                <g>
                  {/* アニメーション用パルスサークル */}
                  <circle cx={playerX} cy={playerY} r="35" fill="rgba(239, 68, 68, 0.25)">
                    <animate attributeName="r" values="15;45;15" dur="1.8s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.8;0.1;0.8" dur="1.8s" repeatCount="indefinite" />
                  </circle>
                  <circle cx={playerX} cy={playerY} r="12" fill="#ef4444" stroke="#ffffff" strokeWidth="2" />
                  <text x={playerX} y={playerY - 20} fill="#fca5a5" fontSize="16" fontWeight="extrabold" textAnchor="middle" filter="drop-shadow(0px 1px 3px rgba(0,0,0,0.8))">
                    つぼみ (現在地)
                  </text>
                </g>
              </svg>
            </div>

            {/* 戻るボタン */}
            <button
              id="map_btn_back_main"
              onClick={() => {
                audioManager.playFlashlightClick();
                setActiveTab('MAIN');
              }}
              className="w-full flex justify-center items-center gap-1.5 py-2.5 rounded-xl border border-stone-800 hover:border-stone-700 bg-stone-950/50 hover:bg-stone-900 text-stone-400 hover:text-stone-200 text-xs font-semibold cursor-pointer transition-all focus:outline-none"
            >
              <ArrowLeft size={14} /> MAINにもどる
            </button>
          </div>
        )}

        {/* 下部操作案内 */}
        <div className="text-center font-mono text-[10px] text-stone-600 border-t border-stone-800/50 pt-3" id="pause_footer">
          {activeTab === 'MAIN' 
            ? '[W/S] 選択 [Enter] 決定 / [Esc / M] ゲームに戻る' 
            : activeTab === 'BAG'
            ? '[W/S] 選択 [Enter] 使用 / [Esc] 戻る'
            : '[Esc / M] ゲームに戻る / [Enter] メインに戻る'}
        </div>
      </div>

      {/* 選択したメモ用紙のポップアップ表示 */}
      {selectedNoteIndex !== null && (() => {
        const notes = [
          { name: '診察記録の切れ端(1)', desc: '「……102号室の患者\n◼️状が◼️◼️◼️◼️◼️で◼️◼️◼️◼️◼️◼️◼️◼️◼️である◼️◼️観察が◼️要\n◼️◼️(読めないや)……」' },
          { name: '診察記録の切れ端(2)', desc: '「……◼️◼️・◼️◼️◼️◼️◼️◼️◼️◼️化。◼️人はこれを『◼️◼️◼️◼️◼️◼️』と◼️◼️、◼️◼️◼️◼️◼️◼️に(読めないや)……」' },
          { name: 'カレンダーの切れ端', desc: '「21日に赤い二重丸とケーキのイラストが描かれている」' },
          { name: '破られた日記の1ページ', desc: '「……大丈夫、大丈夫だから. . .ずっとそばにいるよ、つぼみ……。」' }
        ];
        const selectedNote = notes[selectedNoteIndex];
        return (
          <div 
            className="absolute inset-0 bg-black/90 flex items-center justify-center p-4 z-50 animate-fade-in cursor-pointer animate-duration-300"
            onClick={() => {
              audioManager.playFlashlightClick();
              setSelectedNoteIndex(null);
            }}
            id="bag_note_detail_overlay"
          >
            <div 
              className="w-full max-w-xs bg-amber-50/95 text-stone-900 border-4 border-amber-900/35 rounded-2xl p-5 shadow-[0_0_30px_rgba(0,0,0,0.9)] relative cursor-pointer transform rotate-[-0.5deg] hover:rotate-0 transition-transform duration-300 flex flex-col justify-between min-h-[260px]"
              onClick={(e) => e.stopPropagation()}
              id="bag_note_detail_paper"
            >
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-b from-amber-200/40 to-transparent" />
              
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-dashed border-amber-900/20 pb-1.5">
                  <span className="text-[10px] font-bold text-amber-800 tracking-wider font-mono">
                    📝 {selectedNote.name}
                  </span>
                  <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-amber-200/50 text-amber-950 font-bold font-sans">
                    カバンの中身
                  </span>
                </div>

                <div className="py-1 text-stone-800 leading-relaxed font-sans text-xs md:text-sm whitespace-pre-wrap font-medium">
                  {selectedNote.desc}
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <button
                  id="close_bag_note_btn"
                  onClick={() => {
                    audioManager.playFlashlightClick();
                    setSelectedNoteIndex(null);
                  }}
                  className="w-full py-2 bg-amber-900 hover:bg-amber-950 text-amber-50 font-bold text-[10px] rounded-lg shadow-md transition-all cursor-pointer font-sans text-center"
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
