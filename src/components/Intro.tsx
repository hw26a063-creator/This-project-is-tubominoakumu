/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from 'react';
import { ChevronRight } from 'lucide-react';
import { audioManager } from '../utils/audio';

interface IntroProps {
  onIntroComplete: () => void;
}

const INTRO_TEXTS = [
  "……う、ううん……。ここはどこ……？ わたしの部屋じゃない……。",
  "真っ暗で、すこしカビ臭くて……ひえひえする。お父さんも、お母さんも、だれもいないの……？",
  "（……ゴゴゴ……。廊下の奥から、ずり、ずりと何かが這いずる不気味な音が響く）",
  "おうちへ帰らなきゃ。まんなかにある、あの大きな扉からお外に出られるかな？",
  "……泣かないぞ。よし、ゆっくり、足音をたてずに歩いていこう……！"
];

export default function Intro({ onIntroComplete }: IntroProps) {
  const [currentLine, setCurrentLine] = useState<number>(0);
  const [typedText, setTypedText] = useState<string>('');
  const [isTyping, setIsTyping] = useState<boolean>(true);
  const timerRef = useRef<any>(null);

  // 心拍音を静かに流し始める
  useEffect(() => {
    audioManager.resume();
    audioManager.setHeartbeatBPM(48); // 静かな48BPM (目覚め時の不安な鼓動)
    audioManager.startHeartbeat();

    return () => {
      // イントロ終了時は心拍音のペースアップなどのため一旦止めず、ゲーム本編側で管理されます
    };
  }, []);

  useEffect(() => {
    const targetText = INTRO_TEXTS[currentLine];
    setTypedText('');
    setIsTyping(true);

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    let currentIndex = 0;
    // テキスト表示速度。読点や三点リーダでほんの少し間をあけることで、恐怖と息づかいを演出
    timerRef.current = setInterval(() => {
      currentIndex++;
      if (currentIndex <= targetText.length) {
        setTypedText(targetText.slice(0, currentIndex));
      } else {
        setIsTyping(false);
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }
    }, 55); // 1文字あたり55msで少しゆっくり緊迫感を持たせる

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [currentLine]);

  const handleNext = () => {
    audioManager.playFlashlightClick();
    if (isTyping) {
      // 即座に全表示し、タイマーをクリアする
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setTypedText(INTRO_TEXTS[currentLine]);
      setIsTyping(false);
    } else {
      // 次の行へ
      if (currentLine < INTRO_TEXTS.length - 1) {
        setCurrentLine((prev) => prev + 1);
        
        // 3ページ目（異音）で心拍BPMを少し上げる演出
        if (currentLine === 1) {
          audioManager.setHeartbeatBPM(68); // 異音を聞いてドキドキし始める
        } else if (currentLine === 3) {
          audioManager.setHeartbeatBPM(52); // 目的を持って少し落ち着く
        }
      } else {
        onIntroComplete();
      }
    }
  };

  const handleSkip = () => {
    audioManager.playFlashlightClick();
    onIntroComplete();
  };

  // 1〜3ページ目はノイズ強度を高く、4ページ目以降は静かな恐怖へ
  const noiseOpacity = currentLine <= 2 ? '0.22' : '0.04';

  return (
    <div 
      className="relative flex flex-col justify-between items-center min-h-screen w-full bg-stone-950 text-stone-100 p-8 select-none font-sans overflow-hidden"
      id="intro_container"
      onClick={handleNext}
    >
      {/* 没入感を高めるカスタムCSS（赤いアナログテレビノイズと走査線エフェクト） */}
      <style>{`
        @keyframes tv-noise {
          0% { transform: translate(0, 0); }
          10% { transform: translate(-1%, -1.5%); }
          20% { transform: translate(-2%, 1%); }
          30% { transform: translate(1.5%, -2%); }
          40% { transform: translate(-1.5%, 2.5%); }
          50% { transform: translate(-1%, 1%); }
          60% { transform: translate(2%, -1%); }
          70% { transform: translate(1%, 1.5%); }
          80% { transform: translate(-1.5%, -2%); }
          90% { transform: translate(1%, -1%); }
          100% { transform: translate(0, 0); }
        }
        .crt-noise {
          background-image: radial-gradient(circle, transparent 40%, rgba(0,0,0,0.85)),
                            repeating-linear-gradient(0deg, rgba(220, 38, 38, 0.15) 0px, rgba(220, 38, 38, 0.15) 1px, transparent 1px, transparent 3px);
          animation: tv-noise 0.2s infinite;
        }
      `}</style>

      {/* 画面全体の心拍フラッシュ（赤いベールがうっすら輝く） */}
      <div 
        className="absolute inset-0 bg-red-950/15 pointer-events-none mix-blend-color-burn animate-pulse z-0"
        id="heartbeat_flash"
      />

      {/* アナログ赤いノイズレイヤー（現在のページに応じてフェードアウト） */}
      <div 
        className="absolute inset-0 pointer-events-none crt-noise z-0 transition-opacity duration-1000"
        style={{ opacity: noiseOpacity }}
        id="red_noise_overlay"
      />

      {/* スキップ */}
      <div className="w-full max-w-2xl flex justify-end z-10" id="intro_header">
        <button
          id="skip_intro_button"
          onClick={(e) => {
            e.stopPropagation();
            handleSkip();
          }}
          className="text-stone-400 hover:text-stone-200 text-xs font-semibold cursor-pointer border border-stone-800 bg-stone-900/80 hover:bg-stone-900 px-3 py-1.5 rounded-lg focus:outline-none transition-colors"
        >
          すきっぷ &rArr;
        </button>
      </div>

      {/* テキストダイアログ */}
      <div className="w-full max-w-2xl my-auto flex flex-col justify-center min-h-48 z-10" id="intro_narrative">
        <div 
          className="bg-stone-950/80 border border-stone-800/80 rounded-2xl p-8 md:p-10 space-y-4 backdrop-blur-md min-h-40 relative shadow-2xl transition-all"
          id="narration_box"
        >
          {/* キャラクター名ラベル */}
          <div className="flex items-center gap-3 border-b border-stone-800/80 pb-3 mb-2" id="tsubomi_teller">
            <span id="tsubomi_text" className="text-rose-400 text-xs font-semibold tracking-widest font-mono">つぼみちゃん</span>
          </div>

          <p id="typed_paragraph" className="text-stone-200 text-base md:text-lg leading-relaxed font-sans min-h-16 whitespace-pre-wrap">
            {typedText}
          </p>
          
          {/* 入力待ちチカチカマーク */}
          {!isTyping && (
            <div className="absolute bottom-4 right-4 flex items-center text-rose-500 text-xs animate-bounce" id="wait_input">
              <span>タップしてつぎへ</span>
              <ChevronRight size={14} className="ml-1" />
            </div>
          )}
        </div>
      </div>

      {/* フッター */}
      <div className="text-zinc-600 text-[10px] sm:text-xs z-10 font-mono tracking-wider" id="intro_footer">
        どこにだれがいるかわからない。ゆっくり、あしおとをたてずにあるいていこう。
      </div>
    </div>
  );
}

