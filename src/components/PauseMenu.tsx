/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Sparkles, ArrowLeft, LogOut, Package, Key } from 'lucide-react';
import { audioManager } from '../utils/audio';

interface PauseMenuProps {
  smallMedsCount: number;
  largeMedsCount: number;
  currentSan: number;
  keysCollected: boolean[]; // size 4
  onUseMedicine: (type: 'SMALL' | 'LARGE') => void;
  onResume: () => void;
  onQuit: () => void;
}

export default function PauseMenu({
  smallMedsCount,
  largeMedsCount,
  currentSan,
  keysCollected,
  onUseMedicine,
  onResume,
  onQuit
}: PauseMenuProps) {
  const [activeTab, setActiveTab] = useState<'MAIN' | 'BAG'>('MAIN');
  const [mainSelectedIndex, setMainSelectedIndex] = useState<number>(0); // 0: かばん, 1: もどる, 2: おわる
  const [bagSelectedIndex, setBagSelectedIndex] = useState<number>(0);   // 0: 小さい薬, 1: 大きい薬, 2: もどる

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (activeTab === 'MAIN') {
        if (key === 'w' || e.key === 'ArrowUp') {
          audioManager.playFlashlightClick();
          setMainSelectedIndex((prev) => (prev === 0 ? 2 : prev - 1));
        } else if (key === 's' || e.key === 'ArrowDown') {
          audioManager.playFlashlightClick();
          setMainSelectedIndex((prev) => (prev === 2 ? 0 : prev + 1));
        } else if (e.key === 'Enter' || e.key === ' ') {
          audioManager.playFlashlightClick();
          handleMainSelect();
        } else if (e.key === 'Escape') {
          audioManager.playFlashlightClick();
          onResume();
        }
      } else {
        // BAG TAB
        if (key === 'w' || e.key === 'ArrowUp') {
          audioManager.playFlashlightClick();
          setBagSelectedIndex((prev) => (prev === 0 ? 2 : prev - 1));
        } else if (key === 's' || e.key === 'ArrowDown') {
          audioManager.playFlashlightClick();
          setBagSelectedIndex((prev) => (prev === 2 ? 0 : prev + 1));
        } else if (e.key === 'Enter' || e.key === ' ') {
          handleBagSelect();
        } else if (e.key === 'Escape') {
          audioManager.playFlashlightClick();
          setActiveTab('MAIN');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, mainSelectedIndex, bagSelectedIndex, smallMedsCount, largeMedsCount, currentSan]);

  const handleMainSelect = () => {
    if (mainSelectedIndex === 0) {
      setActiveTab('BAG');
      setBagSelectedIndex(0);
    } else if (mainSelectedIndex === 1) {
      onResume();
    } else if (mainSelectedIndex === 2) {
      onQuit();
    }
  };

  const handleBagSelect = () => {
    if (bagSelectedIndex === 0) {
      if (smallMedsCount > 0) {
        if (currentSan >= 100) {
          // すでに満タン
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

  return (
    <div 
      className="fixed inset-0 bg-transparent flex items-center justify-center p-4 z-40 select-none font-sans"
      id="pause_overlay"
    >
      {/* うっすらぼやける不気味でノスタルジックなスリット背景 */}
      <div className="absolute inset-0 bg-stone-950/85 backdrop-blur-md pointer-events-none" />

      {/* ポーズカード本体 */}
      <div 
        className="w-full max-w-md bg-stone-900 border-2 border-stone-800 rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl relative z-50 text-stone-200"
        id="pause_box"
      >
        {/* ヘッダー */}
        <div className="flex justify-between items-center border-b border-stone-800 pb-3" id="pause_box_header">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
            <h2 className="text-xl font-bold tracking-wider text-rose-300">
              {activeTab === 'MAIN' ? 'めにゅー' : 'かばん（インベントリ）'}
            </h2>
          </div>
        </div>

        {/* SAN値ゲージを一時停止時にも親切に表示 */}
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

        {/* メインメニュー */}
        {activeTab === 'MAIN' ? (
          <div className="flex flex-col gap-4 py-2" id="main_menu_buttons">
            {/* かばんを開く */}
            <button
              id="pause_btn_bag"
              onClick={() => {
                audioManager.playFlashlightClick();
                setActiveTab('BAG');
                setBagSelectedIndex(0);
              }}
              onMouseEnter={() => setMainSelectedIndex(0)}
              className={`flex items-center justify-between px-5 py-3.5 rounded-xl border transition-all cursor-pointer text-left focus:outline-none ${
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

            {/* ゲームに戻る */}
            <button
              id="pause_btn_resume"
              onClick={() => {
                audioManager.playFlashlightClick();
                onResume();
              }}
              onMouseEnter={() => setMainSelectedIndex(1)}
              className={`flex items-center justify-between px-5 py-3.5 rounded-xl border transition-all cursor-pointer text-left focus:outline-none ${
                mainSelectedIndex === 1
                  ? 'bg-rose-950/30 border-rose-500 text-rose-100 scale-102 pl-6'
                  : 'bg-stone-950/50 border-stone-800/80 text-stone-400'
              }`}
            >
              <div className="flex items-center gap-3">
                <ArrowLeft size={18} className={mainSelectedIndex === 1 ? 'text-rose-400' : 'text-stone-500'} />
                <div className="leading-none">
                  <span className="font-semibold block text-sm">もどる</span>
                  <span className="text-[10px] text-stone-500 mt-1 block">あくむの探索をつづける</span>
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
              onMouseEnter={() => setMainSelectedIndex(2)}
              className={`flex items-center justify-between px-5 py-3.5 rounded-xl border transition-all cursor-pointer text-left focus:outline-none ${
                mainSelectedIndex === 2
                  ? 'bg-red-950/30 border-red-500 text-red-300 scale-102 pl-6'
                  : 'bg-stone-950/50 border-stone-800/80 text-stone-400'
              }`}
            >
              <div className="flex items-center gap-3">
                <LogOut size={18} className="text-red-500" />
                <div className="leading-none">
                  <span className="font-semibold block text-sm text-red-400">おわる</span>
                  <span className="text-[10px] text-stone-500 mt-1 block">タイトル画面へもどる (今回の進捗は破棄)</span>
                </div>
              </div>
            </button>
          </div>
        ) : (
          /* かばん（インベントリ）画面 */
          <div className="space-y-6" id="bag_sub_menu">
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
                    <Key size={collectSize(idx)} className={collected ? 'animate-pulse text-amber-400' : ''} />
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
                className={`flex items-center justify-between p-3.5 rounded-xl border text-left cursor-pointer transition-all focus:outline-none ${
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
                className={`flex items-center justify-between p-3.5 rounded-xl border text-left cursor-pointer transition-all focus:outline-none ${
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

              {/* 戻るボタン */}
              <button
                id="bag_btn_back_main"
                onClick={() => {
                  audioManager.playFlashlightClick();
                  setActiveTab('MAIN');
                }}
                onMouseEnter={() => setBagSelectedIndex(2)}
                className={`flex justify-center items-center gap-1.5 py-2.5 mt-2.5 rounded-xl border text-center text-xs font-semibold cursor-pointer transition-all focus:outline-none ${
                  bagSelectedIndex === 2
                    ? 'bg-stone-800 border-stone-600 text-stone-100'
                    : 'bg-stone-950/50 border-stone-900 text-stone-500'
                }`}
              >
                <ArrowLeft size={14} /> MAINにもどる
              </button>
            </div>
          </div>
        )}

        {/* 下部操作案内 */}
        <div className="text-center font-mono text-[10px] text-stone-600 border-t border-stone-800/50 pt-3" id="pause_footer">
          {activeTab === 'MAIN' 
            ? '[W/S] 選択 [Enter] 決定 / [Esc] ゲームに戻る' 
            : '[W/S] 選択 [Enter] 使用 / [Esc] 戻る'}
        </div>
      </div>
    </div>
  );
}

// 鍵ピーススロットの大きさをちょっと変える
function collectSize(idx: number): number {
  return 18 + (idx % 2) * 2;
}
