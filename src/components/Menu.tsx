/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Volume2, VolumeX, HelpCircle, Play } from 'lucide-react';
import { audioManager } from '../utils/audio';
import keyVisual from '../assets/images/tsubomi_nightmare_keyvisual_1781678853210.jpg';

interface MenuProps {
  onStart: () => void;
}

export default function Menu({ onStart }: MenuProps) {
  const [selectedIndex, setSelectedIndex] = useState<number>(0); // 0: すたーと, 1: るーる
  const [showRule, setShowRule] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // キービジュアルの画像パス。画像生成で作成されたものを利用
  const keyVisualPath = keyVisual;

  useEffect(() => {
    // 最初のインタラクションでオーディオをアンロックする。
    const handleInteract = () => {
      audioManager.resume();
    };
    window.addEventListener('click', handleInteract);
    window.addEventListener('keydown', handleInteract);
    
    setIsMuted(audioManager.getIsMuted());

    return () => {
      window.removeEventListener('click', handleInteract);
      window.removeEventListener('keydown', handleInteract);
    };
  }, []);

  // キーボードでのメニュー選択
  useEffect(() => {
    if (showRule) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 'w' || e.key === 'ArrowUp') {
        audioManager.playFlashlightClick();
        setSelectedIndex((prev) => (prev === 0 ? 1 : 0));
      } else if (key === 's' || e.key === 'ArrowDown') {
        audioManager.playFlashlightClick();
        setSelectedIndex((prev) => (prev === 1 ? 0 : 1));
      } else if (e.key === 'Enter' || e.key === ' ') {
        audioManager.playFlashlightClick();
        handleSelection();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, showRule]);

  const handleSelection = () => {
    if (selectedIndex === 0) {
      onStart();
    } else {
      setShowRule(true);
    }
  };

  const toggleMute = () => {
    const muted = audioManager.toggleMute();
    setIsMuted(muted);
    audioManager.playFlashlightClick();
  };

  return (
    <div 
      className="relative flex flex-col items-center justify-between min-h-screen w-full bg-stone-950 text-stone-200 p-6 select-none overflow-hidden font-sans"
      id="menu_container"
    >
      {/* 懐中電灯のような光のうごき（バックグラウンドエフェクト） */}
      <div 
        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-amber-500/5 rounded-full filter blur-[100px] pointer-events-none animate-pulse"
        id="bg_glow"
      />

      {/* ヘッダーマスタ音量 */}
      <div className="w-full max-w-4xl flex justify-between items-center z-10" id="menu_header">
        <span className="font-mono text-xs text-stone-500 mt-2">v1.1.0 // tsubomi_no_me</span>
        <button 
          id="mute_button"
          onClick={toggleMute}
          className="p-2 bg-stone-900 border border-stone-800 hover:bg-stone-800 rounded-lg text-stone-400 hover:text-stone-200 transition-colors cursor-pointer flex items-center gap-1.5 focus:outline-none"
        >
          {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          <span className="text-xs font-mono">{isMuted ? 'MUTE ON' : 'MUTE OFF'}</span>
        </button>
      </div>

      {/* メインセクション：キービジュアル ＆ タイトル */}
      <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16 w-full max-w-4xl my-auto z-10" id="menu_main">
        
        {/* 左側：AI Studioで生成した不気味かわいいキービジュアル */}
        <div className="relative w-72 h-72 md:w-80 md:h-80 rounded-2xl border-4 border-stone-800/80 shadow-[0_0_30px_rgba(0,0,0,0.8)] overflow-hidden scale-95 hover:scale-100 transition-transform duration-500" id="key_visual_wrapper">
          <img 
            id="key_visual_img"
            src={keyVisualPath} 
            alt="つぼみのめ"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover brightness-[0.8] contrast-[1.1]"
            onError={(e) => {
              // 画像がない場合のフォールバック（不気味な赤と黒のグラデーションに少女の影）
              e.currentTarget.style.display = 'none';
              const parent = e.currentTarget.parentElement;
              if (parent) {
                parent.className = "w-72 h-72 md:w-80 md:h-80 bg-gradient-to-tr from-red-950 via-stone-950 to-stone-900 rounded-2xl border-4 border-stone-800 shadow-[0_0_30px_rgba(0,0,0,0.8)] flex items-center justify-center relative";
                const text = document.createElement('div');
                text.className = "text-center p-4 font-mono select-none text-red-500/60";
                text.innerHTML = "<div class='text-4xl mb-4 font-semibold'>つぼみのめ</div><div class='text-[10px]'>あくむのなかへ</div>";
                parent.appendChild(text);
              }
            }}
          />
          {/* 血がにじみ出るような暗がりエフェクト */}
          <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-transparent to-transparent opacity-60 pointer-events-none" />
        </div>

        {/* 右側：タイトル ＆ ボタン */}
        <div className="flex flex-col items-center md:items-start text-center md:text-left" id="title_and_buttons">
          <div className="space-y-1 mb-8" id="title_banner">
            <p className="text-red-500 font-mono tracking-[0.5em] text-sm font-semibold pl-1">精神病棟ステルスホラー</p>
            <h1 className="text-5xl md:text-6xl font-bold tracking-wider text-rose-100 font-sans [text-shadow:0_4px_12px_rgba(251,113,133,0.3)] animate-pulse">
              つぼみのめ
            </h1>
            <p className="text-xs text-stone-500 italic mt-2">"おとはしないで、あそこにだれかいるの"</p>
          </div>

          <div className="flex flex-col gap-4 w-56 font-sans justify-center md:justify-start" id="button_group">
            {/* すたーとボタン */}
            <button
              id="start_button"
              onClick={() => {
                audioManager.playFlashlightClick();
                onStart();
              }}
              onMouseEnter={() => setSelectedIndex(0)}
              className={`group relative flex items-center justify-between px-6 py-3 rounded-xl border text-lg transition-all duration-300 transform leading-none cursor-pointer focus:outline-none ${
                selectedIndex === 0
                  ? 'bg-rose-950/40 border-rose-500 text-rose-100 scale-105 shadow-[0_0_15px_rgba(244,63,94,0.25)] translate-x-1'
                  : 'bg-stone-900/60 border-stone-800 text-stone-400 hover:text-stone-300 hover:border-stone-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <Play size={18} className={selectedIndex === 0 ? 'text-rose-400' : 'text-stone-500'} />
                <span className="font-semibold select-none pr-2">すたーと</span>
              </div>
              {selectedIndex === 0 && (
                <div className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-ping" />
              )}
            </button>

            {/* るーるボタン */}
            <button
              id="rule_button"
              onClick={() => {
                audioManager.playFlashlightClick();
                setShowRule(true);
              }}
              onMouseEnter={() => setSelectedIndex(1)}
              className={`group relative flex items-center justify-between px-6 py-3 rounded-xl border text-lg transition-all duration-300 transform leading-none cursor-pointer focus:outline-none ${
                selectedIndex === 1
                  ? 'bg-rose-950/40 border-rose-500 text-rose-100 scale-105 shadow-[0_0_15px_rgba(244,63,94,0.25)] translate-x-1'
                  : 'bg-stone-900/60 border-stone-800 text-stone-400 hover:text-stone-300 hover:border-stone-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <HelpCircle size={18} className={selectedIndex === 1 ? 'text-rose-400' : 'text-stone-500'} />
                <span className="font-semibold select-none pr-2">るーる</span>
              </div>
              {selectedIndex === 1 && (
                <div className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-ping" />
              )}
            </button>
          </div>
          
          <div className="mt-8 text-[11px] text-stone-600 font-mono hidden md:block" id="keyboard_hints">
            [ W ] [ S ] で選択、 [ Enter ] で決定。
          </div>
        </div>
      </div>

      {/* フッター */}
      <div className="w-full text-center text-xs text-stone-600 z-10 select-none pb-2" id="menu_footer">
        © 2026 つぼみのめ開発室. イヤホンでのプレイを強く推奨します。
      </div>

      {/* るーるダイアログポータル */}
      {showRule && (
        <div 
          className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in"
          id="rule_modal"
          onClick={() => {
            audioManager.playFlashlightClick();
            setShowRule(false);
          }}
        >
          <div 
            className="w-full max-w-xl bg-stone-900 border border-stone-800 rounded-2xl p-6 md:p-8 space-y-6 shadow-2xl relative select-text"
            id="rule_modal_content"
            onClick={(e) => e.stopPropagation()} // 閉じるのを防ぐ
          >
            <div className="border-b border-stone-800 pb-3" id="rule_title_area">
              <h2 className="text-2xl font-bold font-sans text-rose-400 flex items-center gap-2">
                🛸 あくむのるーる
              </h2>
            </div>

            <div className="space-y-4 text-stone-300 text-sm leading-relaxed max-h-[60vh] overflow-y-auto pr-2" id="rule_body">
              <div>
                <p className="font-semibold text-rose-300 mb-1">🏥 ストーリー</p>
                <p className="text-xs text-stone-400">
                  主人公の女の子「つぼみちゃん」は精神病院の患者です。幻覚によって、不気味で怖いあくむの世界に包まれてしまいました。襲いかかる怪異から逃れ、薄暗い精神病院から脱出しましょう。
                </p>
              </div>

              <div>
                <p className="font-semibold text-rose-300 mb-1">🎮 基本操作</p>
                <div className="grid grid-cols-2 gap-2 text-xs border border-stone-800 bg-stone-950 p-2.5 rounded-lg">
                  <div><span className="text-amber-400 font-mono">[W/A/S/D]</span> または <span className="text-amber-400 font-mono">[↑/←/↓/→]</span>: 移動</div>
                  <div><span className="text-amber-400 font-mono">[Shift]</span>: 走る（足音が発生）</div>
                  <div><span className="text-amber-400 font-mono">[F]</span> または <span className="text-amber-400 font-mono">[Space]</span>: ライトのON/OFF</div>
                  <div><span className="text-amber-400 font-mono">[Esc]</span>: バッグを開く／閉じる（ポーズ）</div>
                </div>
                <p className="text-[11px] text-stone-500 mt-1">※スマートフォンでは、画面上にタッチパッドや各ボタンが表示されます。</p>
              </div>

              <div>
                <p className="font-semibold text-rose-300 mb-1">👁️ 大切な2つのジレンマ</p>
                <ol className="list-decimal list-inside space-y-2 text-xs text-stone-400 pl-1">
                  <li>
                    <strong className="text-stone-300">走るか、歩くか :</strong> 走るとスタミナを消費し、大きな足音を立てます。視界は少し広がりますが、
                    <strong className="text-red-400">「盲目の聴覚モンスター」</strong>が音に超高速で反応し、あなたの元へ向かって来ます。
                  </li>
                  <li>
                    <strong className="text-stone-300">照らすか、消すか :</strong> 懐中電灯は暗闇を照らし進路を特定できますが、
                    <strong className="text-red-400">「光を嫌う幽霊」</strong>に直接光を当てると襲いかかってきます。幽霊の近くを歩く時は、ライトを「消して」やり過ごす必要があります。
                  </li>
                </ol>
              </div>

              <div>
                <p className="font-semibold text-rose-300 mb-1">⏳ 正気度（SAN値）と回復</p>
                <p className="text-xs text-stone-400">
                  モンスターに追われたり近くにいると、心音が速くなり <strong>SAN値</strong> が減少します。SAN値が0になるとショック死してしまいます。
                  マップの光るところを調べて <strong className="text-indigo-400">「小さいかいふく薬」「大きいかいふく薬」</strong> を拾い、バッグ(<kbd className="text-amber-400 px-1 border border-stone-700 bg-stone-950 text-[10px] rounded">Esc</kbd>)から使いましょう。バッグを開いている時は時が止まります。
                </p>
              </div>

              <div>
                <p className="font-semibold text-rose-300 mb-1">🚪 脱出条件 と セーブ</p>
                <p className="text-xs text-stone-400 font-semibold mb-1">
                  マップ上に散らばる「4つの鍵のピース」をすべて回収し、中央の扉に到達すれば脱出（クリア）です。
                </p>
                <p className="text-xs text-stone-400">
                  モンスターに「捕まると1撃でゲームオーバー」となり、部屋のベッドから起き上がります。
                  ただし、<strong>鍵のピースを入手した時点でその部屋のベッドに自動セーブ</strong>されます。リスタート時は、セーブした状態の持ち物（鍵・回復薬）を引き継いだまま、その部屋のベッドから目覚め、モンスターの位置がリセットされます。ベッドやクローゼットのアイコンはマップに表示されるので困ったら隠れましょう。
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-stone-800" id="rule_footer">
              <button
                id="close_rule_button"
                onClick={() => {
                  audioManager.playFlashlightClick();
                  setShowRule(false);
                }}
                className="px-5 py-2 bg-stone-800 hover:bg-stone-700 active:scale-95 text-stone-200 text-xs rounded-xl transition-all cursor-pointer font-semibold"
              >
                とじる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
