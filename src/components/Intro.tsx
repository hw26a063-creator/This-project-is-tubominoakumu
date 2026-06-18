/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { audioManager } from '../utils/audio';

interface IntroProps {
  onIntroComplete: () => void;
}

const INTRO_TEXTS = [
  "ここは……どこ？ わたしの部屋じゃない……",
  "真っ暗で……ひえひえする。だれもいないのかな……？",
  "（……ゴゴゴ……、遠くから不気味で重い物音が聴こえる）",
  "……こわい。おうちへ、帰らなきゃ。中央にあるおおきい扉から外に出られるのかな？",
  "でも、あそこに なにか おそろしい影 がいる……。",
  "走ったら、あの子たちに気づかれちゃう。足音を聞かせるわけにはいかないな……。",
  "それに、光をきらうおばけもいるみたい。あの子がいるときは、懐中電灯を消して『あるいて』やり過ごさなきゃ……。",
  "……カバンをひらけば、お薬がはいってる。ポーズボタンや [ Esc ] でカバンをひらいている間、おばけは動けないはず……。",
  "がんばって 4つ の『鍵のピース』を集めて、あくむを終わらせよう！"
];

export default function Intro({ onIntroComplete }: IntroProps) {
  const [currentLine, setCurrentLine] = useState<number>(0);
  const [typedText, setTypedText] = useState<string>('');
  const [isTyping, setIsTyping] = useState<boolean>(true);

  // 心拍音を静かに流し始める
  useEffect(() => {
    audioManager.resume();
    audioManager.setHeartbeatBPM(50); // 静かな50BPM
    audioManager.startHeartbeat();

    return () => {
      // イントロが終わっても基本は心音を使い続けるが、ここで一旦クリアすることはない（ゲーム本体で管理）
    };
  }, []);

  useEffect(() => {
    let charIndex = 0;
    const targetText = INTRO_TEXTS[currentLine];
    setTypedText('');
    setIsTyping(true);

    const timer = setInterval(() => {
      if (charIndex < targetText.length) {
        setTypedText((prev) => prev + targetText.charAt(charIndex));
        charIndex++;
      } else {
        setIsTyping(false);
        clearInterval(timer);
      }
    }, 45); // 1文字あたり45ms

    return () => clearInterval(timer);
  }, [currentLine]);

  const handleNext = () => {
    audioManager.playFlashlightClick();
    if (isTyping) {
      // 即座に全表示
      setTypedText(INTRO_TEXTS[currentLine]);
      setIsTyping(false);
    } else {
      // 次の行へ
      if (currentLine < INTRO_TEXTS.length - 1) {
        setCurrentLine((prev) => prev + 1);
      } else {
        onIntroComplete();
      }
    }
  };

  const handleSkip = () => {
    audioManager.playFlashlightClick();
    onIntroComplete();
  };

  return (
    <div 
      className="relative flex flex-col justify-between items-center min-h-screen w-full bg-stone-950 text-stone-100 p-8 select-none font-sans"
      id="intro_container"
      onClick={handleNext}
    >
      {/* 画面全体の心拍フラッシュ（赤いベールがうっすら輝く） */}
      <div 
        className="absolute inset-0 bg-red-950/10 pointer-events-none mix-blend-color-burn animate-pulse"
        id="heartbeat_flash"
      />

      {/* スキップ */}
      <div className="w-full max-w-2xl flex justify-end z-10" id="intro_header">
        <button
          id="skip_intro_button"
          onClick={(e) => {
            e.stopPropagation();
            handleSkip();
          }}
          className="text-stone-500 hover:text-stone-300 text-xs font-semibold cursor-pointer border border-stone-800 bg-stone-900 px-3 py-1.5 rounded-lg focus:outline-none"
        >
          すきっぷ &rArr;
        </button>
      </div>

      {/* テキストダイアログ */}
      <div className="w-full max-w-2xl my-auto flex flex-col justify-center min-h-48 z-10" id="intro_narrative">
        <div 
          className="bg-stone-900/40 border border-stone-800/80 rounded-2xl p-8 md:p-10 space-y-4 backdrop-blur-sm min-h-40 relative shadow-inner"
          id="narration_box"
        >
          {/* かわいいホラー調・つぼみちゃんのアイコン */}
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
              <ChevronRight size={14} />
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
