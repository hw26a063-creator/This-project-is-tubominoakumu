/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { audioManager } from '../utils/audio';

interface EscapeTalkProps {
  onComplete: () => void;
}

interface DialogueLine {
  speaker: string;
  text: string;
}

const DIALOGUE_LINES: DialogueLine[] = [
  { speaker: '知っている気がする声', text: '「つぼみ？どうしてこんなところにいるの。」' },
  { speaker: '知っている気がする声', text: '「戻らないとダメだよ」' },
  { speaker: 'つぼみ', text: '「だれ？」' },
  { speaker: '知っている気がする声', text: '「そっか…いいの。戻ってくれたら嬉しいな。」' },
  { speaker: 'つぼみ', text: '「わからないよ。怖いよここからでないと」' },
  { speaker: '知っている気がする声', text: '「…」' },
  { speaker: '知っている気がする声', text: '「大丈夫、大丈夫だから.…」' },
  { speaker: 'つぼみ', text: '「うん…わかった。」' },
  { speaker: '', text: '(そのまま連れて行かれた)' }
];

export default function EscapeTalk({ onComplete }: EscapeTalkProps) {
  const [currentLineIndex, setCurrentLineIndex] = useState<number>(0);
  const [typedText, setTypedText] = useState<string>('');
  const [isTyping, setIsTyping] = useState<boolean>(true);
  const [isFadingOut, setIsFadingOut] = useState<boolean>(false);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const textIndexRef = useRef<number>(0);
  const currentTextRef = useRef<string>('');

  const currentLine = DIALOGUE_LINES[currentLineIndex];

  // タイピングアニメーションの起動
  useEffect(() => {
    // 最初に不穏な低心拍の心拍音のみ流す
    audioManager.stopAll();
    audioManager.setHeartbeatBPM(50);
    audioManager.startHeartbeat();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    startTyping(currentLine.text);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentLineIndex]);

  const startTyping = (fullText: string) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    setTypedText('');
    setIsTyping(true);
    textIndexRef.current = 0;
    currentTextRef.current = '';

    timerRef.current = setInterval(() => {
      if (textIndexRef.current < fullText.length) {
        currentTextRef.current += fullText[textIndexRef.current];
        setTypedText(currentTextRef.current);
        textIndexRef.current++;
        
        // 1文字ごとに小さなクリック音
        if (textIndexRef.current % 2 === 0) {
          audioManager.playFootstep(false); // 控えめな足音音源などを再利用してコトコト音にする
        }
      } else {
        if (timerRef.current) clearInterval(timerRef.current);
        setIsTyping(false);
      }
    }, 85); // 1文字85ms
  };

  const handleNext = () => {
    if (isTyping) {
      // タイピング中の場合、タイマーをクリアして全文字を即座に表示
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      setTypedText(currentLine.text);
      setIsTyping(false);
      audioManager.playFlashlightClick();
    } else {
      // タイピングが終わっている場合、次のセリフへ進む
      audioManager.playFlashlightClick();
      if (currentLineIndex < DIALOGUE_LINES.length - 1) {
        setCurrentLineIndex(prev => prev + 1);
      } else {
        // すべての対話が終わった
        triggerComplete();
      }
    }
  };

  const triggerComplete = () => {
    setIsFadingOut(true);
    audioManager.stopAll();
    setTimeout(() => {
      onComplete();
    }, 2000); // 2秒のホワイトアウトフェード
  };

  return (
    <div 
      className={`fixed inset-0 bg-stone-950 flex flex-col items-center justify-center p-4 z-40 select-none text-stone-200 transition-all duration-[2000ms] ${
        isFadingOut ? 'bg-white text-stone-900' : ''
      }`}
      id="escape_talk_container"
      onClick={handleNext}
    >
      {/* 画面全体のうっすら赤い・ノイジーな環境演出 */}
      <div className="absolute inset-0 bg-radial-gradient(circle_at_center,rgba(127,29,29,0.1)_0%,rgba(0,0,0,0.4)_100%) pointer-events-none" />

      {/* ノベルゲーム風のメッセージボックス */}
      <div 
        className="w-full max-w-lg bg-stone-900/80 border-2 border-stone-800 rounded-3xl p-6 md:p-8 space-y-4 shadow-2xl relative z-50 flex flex-col min-h-[220px] justify-between cursor-pointer"
        id="escape_talk_box"
      >
        <div className="space-y-3">
          {/* 話し手 (スピーカー) の表示 */}
          {currentLine.speaker ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold tracking-widest text-rose-400 bg-rose-950/40 px-3 py-1 rounded-full border border-rose-900/60 font-sans">
                {currentLine.speaker}
              </span>
            </div>
          ) : (
            <div className="h-6" /> // 空白調整
          )}

          {/* 対話テキスト */}
          <div className="min-h-[90px] flex items-center">
            <p className="text-base sm:text-lg leading-relaxed text-stone-200 font-sans whitespace-pre-wrap font-medium">
              {typedText}
              {isTyping && (
                <span className="inline-block w-2.5 h-4 ml-1 bg-rose-500 animate-pulse" />
              )}
            </p>
          </div>
        </div>

        {/* タップして進むガイド */}
        <div className="w-full text-right" id="escape_talk_guide">
          {!isTyping ? (
            <span className="text-[10px] text-stone-500 font-semibold tracking-wider animate-pulse font-sans">
              [画面をタップ、または Enter / Space キーで進む]
            </span>
          ) : (
            <span className="text-[10px] text-stone-600 font-semibold tracking-wider font-sans">
              [タップでスキップ]
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
