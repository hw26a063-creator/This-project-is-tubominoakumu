/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { audioManager } from '../utils/audio';
import { Home, ChevronLeft, ChevronRight, BookOpen } from 'lucide-react';

interface WhiteRoomProps {
  onQuit: () => void;
}

interface Vector2D {
  x: number;
  y: number;
}

type CutsceneStep =
  | 'intro'              // 登場。看護師「こちらの部屋です」
  | 'intro_reply'        // 男性「あぁ…ありがとう」
  | 'walk_to_bed'        // ベッドへ移動中 (自動歩行アニメーション)
  | 'place_flower'       // 花を置く。男性「………」
  | 'nurse_ask'          // 看護師「失礼を承知で申し上げますが、お迎えに行かなくてよろしいのですか？」
  | 'man_reply'          // 男性「いや、大丈夫ありがとう。」
  | 'nurse_leave_talk'   // 看護師「失礼しました。」
  | 'nurse_walking_out'  // 看護師がドアへ向かって歩く (自動歩行アニメーション)
  | 'man_walk_to_desk'   // 男性がデスクへ向かって歩く (自動歩行アニメーション)
  | 'read_memo'          // デスクのメモを読む (何ページかに分かれた本・カルテ風のUI)
  | 'fade_to_white'      // 白い画面へのフェード
  | 'girls_talk_1'       // 「つぼみってなに？」
  | 'girls_talk_2'       // 「まだ咲いてないお花のことだよ。」
  | 'girls_talk_3'       // 「わたしさ！つぼみのしおり持ってるよ。」
  | 'girls_talk_4'       // 「どれどれ？わー綺麗だね」
  | 'girls_talk_5'       // 「うふふ」
  | 'girls_talk_6'       // 「そうでしょ」
  | 'thank_you';         // Thank you for playing! ＆ タイトルへ戻る

export default function WhiteRoom({ onQuit }: WhiteRoomProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [step, setStep] = useState<CutsceneStep>('intro');
  const [manPos, setManPos] = useState<Vector2D>({ x: 260, y: 440 }); // ドア近くから登場
  const [nursePos, setNursePos] = useState<Vector2D>({ x: 290, y: 410 }); // ドア近くに待機
  const [manAngle, setManAngle] = useState<number>(-Math.PI / 2); // 上向き
  const [nurseAngle, setNurseAngle] = useState<number>(Math.PI); // 左向き

  const [nurseVisible, setNurseVisible] = useState<boolean>(true);
  const [flowerInHand, setFlowerInHand] = useState<boolean>(true);
  const [flowerOnBed, setFlowerOnBed] = useState<boolean>(false);
  const [memoOpen, setMemoOpen] = useState<boolean>(false);
  const [memoPage, setMemoPage] = useState<number>(0);
  const [whiteScreenFade, setWhiteScreenFade] = useState<number>(0); // 0から1のフェード率

  // 歩行アニメーションの足ふり
  const [walkCycle, setWalkCycle] = useState<number>(0);

  // キャラクター移動速度
  const animSpeed = 0.1;

  // 各種定数の座標
  const bedStandPos = { x: 170, y: 150 }; // ベッドの右側
  const deskStandPos = { x: 310, y: 180 }; // デスクの左側
  const doorPos = { x: 260, y: 520 }; // 退出用(ドア外へ)

  // カルテ（メモ）の内容
  const memoPages = [
    {
      title: "102号室の患者記録",
      subtitle: "小児認知症について",
      content: "小児認知症（Childhood Dementia）は、進行性の脳損傷を特徴とする、主に遺伝性の代謝異常や希少疾患（100種類以上）に起因する疾患群の総称である。\n\n高齢期の認知症が加齢やアルツハイマー病等の神経変性疾患を主因とするのに対し、小児認知症は中枢神経系の発達途上または完成直後に神経変性が開始する点で、病態および社会的アプローチが大きく異なる。"
    },
    {
      title: "102号室の患者記録",
      subtitle: "初期症状と経過",
      content: "【初期症状】\n当初は注意欠陥、または多動性を伴う発達障害を疑われて来院。落ち着きのなさ、集中力の欠如、軽度の言語遅滞が見られた。しかし、その後の経過は「未発達」ではなく、明らかに機能の低下を示している。\n\n20XX年5月9日\n半年前まで話せていた日常会話が完全に消失。現在は意味をなさない単語を発するのみ。\n親族の認知が不可能になっている模様。鏡に映る自身の姿に対しても強い恐怖と混乱を示す。"
    },
    {
      title: "102号室の患者記録",
      subtitle: "経過観察（中〜後期）",
      content: "20XX年8月14日\n歩行時のふらつきが顕著。スプーンを持つ等の微細な手指の動作が不可能となった。\n夜間の睡眠障害が激化。暗闇の中を目的なく徘徊し、静止させようとすると激しい拒絶（自傷・他害を伴うパニック）を起こす。\n\n20XX年2月21日\n週に数回、突発的な全身性の痙攣発作（てんかん様発作）を発症。抗発作薬の効きが悪い。\n視覚および聴覚の反応が鈍化している。脳の萎縮が感覚野まで及んでいる可能性が高い。これは大人の認知症の進行速度を遥かに上回る。"
    },
    {
      title: "102号室の患者記録",
      subtitle: "担当医の所感",
      content: "【担当医の所感】\n昨日までできていたことが、朝起きるとできなくなっている。\n今日は空を見つめている。\n現時点で進行を止める手立てはない。やがて自発的な呼吸や嚥下（飲み込み）もできなくなるだろう。"
    }
  ];

  // 音声演出・初期化
  useEffect(() => {
    // 悪夢から覚め、静謐な静けさを演出するためにBGMを一度クリア
    audioManager.stopAll();
  }, []);

  // 白フェードインや自動アニメーションを処理するメインループ
  useEffect(() => {
    let animationId: number;
    let localMan = { ...manPos };
    let localNurse = { ...nursePos };
    let currentWalk = 0;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const gameLoop = () => {
      // 1. 各ステップに応じた自動移動アニメーションの更新
      let walkActive = false;

      if (step === 'walk_to_bed') {
        // 男性がベッドへ移動
        const dx = bedStandPos.x - localMan.x;
        const dy = bedStandPos.y - localMan.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 2) {
          localMan.x += (dx / dist) * animSpeed;
          localMan.y += (dy / dist) * animSpeed;
          setManPos({ x: localMan.x, y: localMan.y });
          setManAngle(Math.atan2(dy, dx));
          walkActive = true;
        } else {
          // 到着
          setManPos(bedStandPos);
          setManAngle(Math.PI); // 左向き（ベッドの方を向く）
          setStep('place_flower');
        }
      } else if (step === 'nurse_walking_out') {
        // 看護師がドア外へ歩いて消える
        const dx = doorPos.x - localNurse.x;
        const dy = doorPos.y - localNurse.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 2) {
          localNurse.x += (dx / dist) * animSpeed;
          localNurse.y += (dy / dist) * animSpeed;
          setNursePos({ x: localNurse.x, y: localNurse.y });
          setNurseAngle(Math.atan2(dy, dx));
          walkActive = true;
        } else {
          // 退室完了
          setNurseVisible(false);
          setStep('man_walk_to_desk');
        }
      } else if (step === 'man_walk_to_desk') {
        // 男性が机まで移動
        const dx = deskStandPos.x - localMan.x;
        const dy = deskStandPos.y - localMan.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 2) {
          localMan.x += (dx / dist) * animSpeed;
          localMan.y += (dy / dist) * animSpeed;
          setManPos({ x: localMan.x, y: localMan.y });
          setManAngle(Math.atan2(dy, dx));
          walkActive = true;
        } else {
          // 到着
          setManPos(deskStandPos);
          setManAngle(-Math.PI / 2); // 上向き（デスクの方を向く）
          setStep('read_memo');
          setMemoOpen(true);
        }
      }

      if (walkActive) {
        currentWalk += 0.15;
        setWalkCycle(currentWalk);
      } else {
        setWalkCycle(0);
      }

      // 2. 描画処理 (Canvas Rendering)
      ctx.clearRect(0, 0, 500, 500);

      // 床 (優しい白〜薄いグレーのフロアタイル)
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, 500, 500);

      // タイルグリッド
      ctx.strokeStyle = '#f1f5f9';
      ctx.lineWidth = 1.5;
      for (let i = 0; i <= 500; i += 50) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, 500);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(500, i);
        ctx.stroke();
      }

      // 上部の壁と陰影
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(0, 0, 500, 45);

      // 大きな窓から差し込む神聖で暖かな光
      ctx.fillStyle = 'rgba(253, 224, 71, 0.12)';
      ctx.beginPath();
      ctx.moveTo(180, 45);
      ctx.lineTo(320, 45);
      ctx.lineTo(420, 500);
      ctx.lineTo(100, 500);
      ctx.closePath();
      ctx.fill();

      // 窓
      ctx.fillStyle = '#93c5fd';
      ctx.fillRect(200, 30, 100, 10);
      ctx.strokeStyle = '#ffffff';
      ctx.strokeRect(200, 30, 100, 10);

      // 観葉植物 (x: 440, y: 80)
      ctx.fillStyle = 'rgba(148, 163, 184, 0.2)';
      ctx.fillRect(444, 84, 30, 30);
      ctx.fillStyle = '#a16207'; // 鉢
      ctx.fillRect(440, 95, 30, 15);
      ctx.fillStyle = '#22c55e'; // 葉
      ctx.beginPath();
      ctx.arc(455, 85, 12, 0, Math.PI * 2);
      ctx.fill();

      // 丸椅子 (x: 370, y: 220)
      ctx.fillStyle = 'rgba(148, 163, 184, 0.15)';
      ctx.beginPath();
      ctx.arc(390, 240, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.arc(390, 236, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#64748b';
      ctx.stroke();

      // デスク (x: 340, y: 140)
      ctx.fillStyle = 'rgba(148, 163, 184, 0.2)';
      ctx.fillRect(344, 144, 100, 55);
      ctx.fillStyle = '#e2e8f0'; // デスク
      ctx.fillRect(340, 140, 100, 55);
      ctx.strokeStyle = '#94a3b8';
      ctx.strokeRect(340, 140, 100, 55);

      // デスクの上のPCカルテ
      ctx.fillStyle = '#ffffff'; // カルテメモ用紙
      ctx.fillRect(355, 155, 16, 22);
      ctx.strokeStyle = '#cbd5e1';
      ctx.strokeRect(355, 155, 16, 22);
      // PCモニター
      ctx.fillStyle = '#334155';
      ctx.fillRect(385, 145, 35, 5);
      ctx.fillRect(397, 150, 10, 10);

      // ドア (x: 220, y: 485)
      ctx.fillStyle = '#78350f';
      ctx.fillRect(220, 485, 80, 15);

      // ベッド (x: 60, y: 100)
      ctx.fillStyle = 'rgba(148, 163, 184, 0.25)';
      ctx.fillRect(64, 104, 110, 80);
      ctx.fillStyle = '#ffffff'; // 白い清潔なシーツ
      ctx.fillRect(60, 100, 110, 80);
      ctx.strokeStyle = '#94a3b8';
      ctx.strokeRect(60, 100, 110, 80);

      // 枕
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(70, 115, 20, 50);
      ctx.strokeRect(70, 115, 20, 50);

      // 布団の折り返し
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(95, 100, 75, 80);
      ctx.strokeRect(95, 100, 75, 80);

      // ガーベラの花束（ベッドに置かれた後）
      if (flowerOnBed) {
        // 花の茎 (緑)
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(115, 140);
        ctx.lineTo(135, 145);
        ctx.stroke();

        // 鮮やかなガーベラの花 (オレンジやピンク、赤)
        const colors = ['#f97316', '#ec4899', '#ef4444'];
        const offsets = [
          { dx: -4, dy: -4 },
          { dx: 3, dy: -2 },
          { dx: -1, dy: 4 }
        ];
        offsets.forEach((offset, idx) => {
          ctx.fillStyle = colors[idx];
          ctx.beginPath();
          ctx.arc(115 + offset.dx, 140 + offset.dy, 4, 0, Math.PI * 2);
          ctx.fill();
          // 中央の芯
          ctx.fillStyle = '#fef08a';
          ctx.beginPath();
          ctx.arc(115 + offset.dx, 140 + offset.dy, 1.5, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // 3. 看護師キャラクターの描画
      if (nurseVisible) {
        // 影
        ctx.fillStyle = 'rgba(71, 85, 105, 0.2)';
        ctx.beginPath();
        ctx.arc(localNurse.x, localNurse.y + 11, 12, 0, Math.PI * 2);
        ctx.fill();

        // ナース服 (薄いピンク＆白)
        ctx.fillStyle = '#fce7f3';
        ctx.beginPath();
        ctx.arc(localNurse.x, localNurse.y + 2, 10, 0, Math.PI * 2);
        ctx.fill();
        // エプロン (白い部分)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(localNurse.x - 4, localNurse.y + 2, 8, 8);

        // 頭
        ctx.fillStyle = '#fed7aa';
        ctx.beginPath();
        ctx.arc(localNurse.x, localNurse.y - 12, 8, 0, Math.PI * 2);
        ctx.fill();

        // お団子ヘア
        ctx.fillStyle = '#78350f';
        ctx.beginPath();
        ctx.arc(localNurse.x, localNurse.y - 13, 9, Math.PI, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(localNurse.x + 6, localNurse.y - 16, 3, 0, Math.PI * 2);
        ctx.fill();

        // ナースキャップ (白い小さな長方形)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(localNurse.x - 4, localNurse.y - 23, 8, 4);

        // 足
        const walkOffset = Math.sin(walkCycle) * 3;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(localNurse.x - 4, localNurse.y + 10 + (step === 'nurse_walking_out' ? walkOffset : 0), 3, 6);
        ctx.fillRect(localNurse.x + 1, localNurse.y + 10 + (step === 'nurse_walking_out' ? -walkOffset : 0), 3, 6);
      }

      // 4. 男性（医師：榊）キャラクターの描画
      // 影
      ctx.fillStyle = 'rgba(71, 85, 105, 0.25)';
      ctx.beginPath();
      ctx.arc(localMan.x, localMan.y + 12, 14, 0, Math.PI * 2);
      ctx.fill();

      // 体（黒いシックなセーター ＆ 白衣コート）
      ctx.fillStyle = '#1e293b'; // インナーの黒
      ctx.beginPath();
      ctx.arc(localMan.x, localMan.y + 4, 12, 0, Math.PI * 2);
      ctx.fill();
      // 上に羽織る白衣 (左右の白いラインで表現)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(localMan.x - 11, localMan.y, 4, 12);
      ctx.fillRect(localMan.x + 7, localMan.y, 4, 12);

      // 頭部
      ctx.fillStyle = '#fbcfe8';
      ctx.beginPath();
      ctx.arc(localMan.x, localMan.y - 12, 9, 0, Math.PI * 2);
      ctx.fill();

      // 髪（落ち着いた黒髪）
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(localMan.x, localMan.y - 13, 10, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(localMan.x - 10, localMan.y - 13, 3, 6);
      ctx.fillRect(localMan.x + 7, localMan.y - 13, 3, 6);

      // メガネ
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(localMan.x - 3, localMan.y - 12, 2, 0, Math.PI * 2);
      ctx.arc(localMan.x + 3, localMan.y - 12, 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(localMan.x - 1, localMan.y - 12);
      ctx.lineTo(localMan.x + 1, localMan.y - 12);
      ctx.stroke();

      // 足
      const manWalkOffset = Math.sin(walkCycle) * 3;
      ctx.fillStyle = '#334155';
      const isManMoving = (step === 'walk_to_bed' || step === 'man_walk_to_desk');
      ctx.fillRect(localMan.x - 5, localMan.y + 14 + (isManMoving ? manWalkOffset : 0), 3, 8);
      ctx.fillRect(localMan.x + 2, localMan.y + 14 + (isManMoving ? -manWalkOffset : 0), 3, 8);

      // ガーベラの花束（男が手に持っている間）
      if (flowerInHand) {
        // 茎
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(localMan.x - 6, localMan.y + 4);
        ctx.lineTo(localMan.x - 14, localMan.y + 1);
        ctx.stroke();

        // 鮮やかなオレンジの花束
        const colors = ['#f97316', '#ec4899', '#ef4444'];
        const offsets = [
          { dx: -15, dy: -2 },
          { dx: -13, dy: 3 },
          { dx: -17, dy: 4 }
        ];
        offsets.forEach((offset, idx) => {
          ctx.fillStyle = colors[idx];
          ctx.beginPath();
          ctx.arc(localMan.x + offset.dx, localMan.y + offset.dy, 3.5, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      animationId = requestAnimationFrame(gameLoop);
    };

    gameLoop();

    return () => cancelAnimationFrame(animationId);
  }, [step, manPos, nursePos, flowerInHand, flowerOnBed, nurseVisible]);

  // クリック・キーボードでストーリーを進める処理
  const advanceStory = () => {
    // 自動アニメーション中はクリックを受け付けない
    if (step === 'walk_to_bed' || step === 'nurse_walking_out' || step === 'man_walk_to_desk') {
      return;
    }

    audioManager.playFlashlightClick(); // パチリと静かな進行音

    switch (step) {
      case 'intro':
        setStep('intro_reply');
        break;
      case 'intro_reply':
        setStep('walk_to_bed'); // 自動でベッドへ歩き出す
        break;
      case 'place_flower':
        // 花を置く動作
        setFlowerInHand(false);
        setFlowerOnBed(true);
        setStep('nurse_ask');
        break;
      case 'nurse_ask':
        setStep('man_reply');
        break;
      case 'man_reply':
        setStep('nurse_leave_talk');
        break;
      case 'nurse_leave_talk':
        setStep('nurse_walking_out'); // 自動で看護師退室
        break;
      case 'read_memo':
        // メモを開く (メモウィンドウはすでに表示されている)
        break;
      case 'girls_talk_1':
        setStep('girls_talk_2');
        break;
      case 'girls_talk_2':
        setStep('girls_talk_3');
        break;
      case 'girls_talk_3':
        setStep('girls_talk_4');
        break;
      case 'girls_talk_4':
        setStep('girls_talk_5');
        break;
      case 'girls_talk_5':
        setStep('girls_talk_6');
        break;
      case 'girls_talk_6':
        // 白フェードして Thank you 画面へ
        setStep('thank_you');
        break;
      default:
        break;
    }
  };

  // カルテ（メモ）を閉じる処理
  const closeMemoAndFade = () => {
    setMemoOpen(false);
    setStep('fade_to_white');

    // 徐々に白画面へフェードさせるタイマー
    let opacity = 0;
    const interval = setInterval(() => {
      opacity += 0.05;
      if (opacity >= 1) {
        opacity = 1;
        clearInterval(interval);
        // 女の子の会話シーン1へ進む
        setTimeout(() => {
          setStep('girls_talk_1');
        }, 1500);
      }
      setWhiteScreenFade(opacity);
    }, 50);
  };

  // セリフ表示用の話者名とテキストの取得
  const getSpeakerAndText = () => {
    switch (step) {
      case 'intro':
        return { speaker: '看護師', text: '「こちらの部屋です。」' };
      case 'intro_reply':
        return { speaker: '男性', text: '「あぁ…ありがとう」' };
      case 'walk_to_bed':
        return { speaker: '', text: '（ベッドのほうへゆっくりと歩み寄る……）' };
      case 'place_flower':
        return { speaker: '男性', text: '「………」\n\n(ベッドの上に鮮やかなガーベラの花束を供えた)' };
      case 'nurse_ask':
        return { speaker: '看護師', text: '「失礼を承知で申し上げますが、お迎えに行かなくてよろしいのですか？」' };
      case 'man_reply':
        return { speaker: '男性', text: '「いや、大丈夫ありがとう。」' };
      case 'nurse_leave_talk':
        return { speaker: '看護師', text: '「失礼しました。」' };
      case 'nurse_walking_out':
        return { speaker: '', text: '（看護師は一礼し、静かに扉の向こうへ去っていった……）' };
      case 'man_walk_to_desk':
        return { speaker: '', text: '（机のカルテへと向かう……）' };
      case 'read_memo':
        return { speaker: '', text: '（机の上に広げられたカルテを手に取った。102号室――つぼみの医療データだ）' };
      default:
        return { speaker: '', text: '' };
    }
  };

  const currentDialog = getSpeakerAndText();
  const isAutoScene = step === 'walk_to_bed' || step === 'nurse_walking_out' || step === 'man_walk_to_desk';

  return (
    <div 
      className="fixed inset-0 bg-stone-100 flex flex-col items-center justify-center p-4 z-30 select-none text-stone-800"
      id="white_room_container"
    >
      {/* 優しい環境演出のためのオーラ・背景ぼかし */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,1)_0%,rgba(241,245,249,1)_100%)] pointer-events-none" />

      {/* メインウィンドウ (カットシーン中は中央に配置) */}
      {step !== 'girls_talk_1' && step !== 'girls_talk_2' && step !== 'girls_talk_3' && step !== 'girls_talk_4' && step !== 'girls_talk_5' && step !== 'girls_talk_6' && step !== 'thank_you' && (
        <div 
          className="w-full max-w-[540px] bg-white border border-slate-200 rounded-3xl p-4 md:p-6 shadow-xl relative z-40 space-y-4 flex flex-col items-center transition-all duration-700"
          id="white_room_window"
          onClick={advanceStory}
        >
          {/* ヘッダー */}
          <div className="w-full flex justify-between items-center border-b border-slate-100 pb-2" id="white_room_header">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-400" />
              <span className="font-bold text-slate-500 text-[11px] md:text-xs tracking-wider font-sans uppercase">
                102号室・病棟
              </span>
            </div>
            <button 
              id="white_room_btn_title"
              onClick={(e) => {
                e.stopPropagation();
                onQuit();
              }}
              className="flex items-center gap-1.5 px-3 py-1 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs text-slate-500 font-semibold cursor-pointer transition-all"
            >
              <Home size={12} /> タイトルへ
            </button>
          </div>

          {/* キャンバス */}
          <div className="relative border border-slate-200 rounded-2xl overflow-hidden bg-slate-50 aspect-square w-full max-w-[460px] cursor-pointer">
            <canvas 
              ref={canvasRef} 
              width={500} 
              height={500} 
              className="w-full h-full block"
            />

            {/* ナラティブガイダンス：オート中以外は「クリックで進む」チップを表示 */}
            {!isAutoScene && !memoOpen && (
              <div 
                className="absolute bottom-3 right-3 bg-slate-900/80 backdrop-blur-sm text-white text-[10px] px-3 py-1.5 rounded-lg flex items-center gap-1.5 animate-pulse"
                id="click_anywhere_tip"
              >
                <span>クリック / タップで進む ❯</span>
              </div>
            )}
          </div>

          {/* テキストメッセージボックス */}
          <div 
            className={`w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl min-h-[96px] text-xs sm:text-sm text-slate-700 leading-relaxed font-sans flex flex-col justify-between relative transition-all ${
              isAutoScene ? 'opacity-80' : 'hover:border-slate-300'
            }`}
            id="white_room_msg_box"
          >
            <div>
              {currentDialog.speaker && (
                <div className="font-bold text-emerald-600 mb-1 font-sans text-xs md:text-sm tracking-wide">
                  【{currentDialog.speaker}】
                </div>
              )}
              <div className="whitespace-pre-wrap text-slate-800 font-medium">
                {currentDialog.text}
              </div>
            </div>
            
            {!isAutoScene && !memoOpen && (
              <div className="text-right text-[10px] font-bold text-slate-300 animate-bounce mt-1">
                ▼ Click to continue
              </div>
            )}
          </div>
        </div>
      )}

      {/* メモ（患者カルテ）のダイアログ表示 */}
      {memoOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in"
          id="memo_overlay"
        >
          <div className="w-full max-w-md bg-stone-50 border-4 border-stone-200/90 rounded-2xl shadow-2xl p-6 relative flex flex-col justify-between min-h-[460px] text-stone-800 font-sans">
            
            {/* クリップボードの留め具風デザイン */}
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-32 h-8 bg-stone-300 rounded-b-lg border-2 border-stone-400 flex items-center justify-center text-[10px] font-bold text-stone-600 uppercase tracking-widest shadow-inner">
              CLINICAL CHART
            </div>

            <div className="space-y-4 pt-4">
              <div className="flex justify-between items-center border-b-2 border-stone-300 pb-2">
                <span className="text-xs font-bold text-stone-500 tracking-wider font-mono">
                  {memoPages[memoPage].title}
                </span>
                <span className="text-xs font-mono px-2 py-0.5 bg-stone-200 rounded-full font-bold text-stone-600">
                  PAGE {memoPage + 1} / {memoPages.length}
                </span>
              </div>

              <h2 className="text-lg font-bold text-stone-900 tracking-tight flex items-center gap-2">
                <BookOpen size={18} className="text-stone-700" />
                {memoPages[memoPage].subtitle}
              </h2>

              <p className="text-xs md:text-sm text-stone-700 leading-relaxed whitespace-pre-wrap font-sans bg-white/50 p-4 rounded-xl border border-stone-200 shadow-inner h-[240px] overflow-y-auto">
                {memoPages[memoPage].content}
              </p>
            </div>

            {/* ナビゲーションフッター */}
            <div className="flex justify-between items-center border-t border-stone-200 pt-4 mt-4">
              <button
                disabled={memoPage === 0}
                onClick={() => {
                  audioManager.playFlashlightClick();
                  setMemoPage(prev => prev - 1);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-200 hover:bg-stone-300 disabled:opacity-30 rounded-lg text-xs font-bold transition-all text-stone-700"
              >
                <ChevronLeft size={14} /> 前へ
              </button>

              {memoPage < memoPages.length - 1 ? (
                <button
                  onClick={() => {
                    audioManager.playFlashlightClick();
                    setMemoPage(prev => prev + 1);
                  }}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-stone-800 text-stone-100 hover:bg-stone-900 rounded-lg text-xs font-bold transition-all"
                >
                  次へ <ChevronRight size={14} />
                </button>
              ) : (
                <button
                  onClick={() => {
                    audioManager.playClearJingle();
                    closeMemoAndFade();
                  }}
                  className="px-5 py-2 bg-emerald-600 text-white hover:bg-emerald-700 font-bold rounded-lg text-xs tracking-wider transition-all shadow-md animate-pulse cursor-pointer"
                >
                  記録を閉じる ❯
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 真っ白なフェードイン画面（女の子たちの会話・エンディング用） */}
      {whiteScreenFade > 0 && (
        <div 
          className="fixed inset-0 bg-white flex flex-col items-center justify-center z-50 p-6 text-stone-900"
          style={{ opacity: whiteScreenFade }}
          onClick={advanceStory}
        >
          {/* 女の子二人の会話シーン */}
          {(step === 'girls_talk_1' || step === 'girls_talk_2' || step === 'girls_talk_3' || step === 'girls_talk_4' || step === 'girls_talk_5' || step === 'girls_talk_6') && (
            <div className="max-w-md w-full space-y-8 flex flex-col justify-center min-h-[200px] cursor-pointer">

              <div className="bg-stone-50/60 border border-stone-100 p-6 rounded-2xl shadow-sm text-center space-y-6">
                
                {step === 'girls_talk_1' && (
                  <div className="animate-fade-in py-6">
                    <p className="text-sm md:text-base font-bold text-stone-800 leading-relaxed animate-pulse">
                      「つぼみってなに？」
                    </p>
                  </div>
                )}

                {step === 'girls_talk_2' && (
                  <div className="animate-fade-in py-6">
                    <p className="text-sm md:text-base font-bold text-stone-800 leading-relaxed animate-pulse">
                      「まだ咲いてないお花のことだよ。」
                    </p>
                  </div>
                )}

                {step === 'girls_talk_3' && (
                  <div className="animate-fade-in py-6">
                    <p className="text-sm md:text-base font-bold text-stone-800 leading-relaxed animate-pulse">
                      「わたしさ！つぼみのしおり持ってるよ。」
                    </p>
                  </div>
                )}

                {step === 'girls_talk_4' && (
                  <div className="animate-fade-in py-6">
                    <p className="text-sm md:text-base font-bold text-stone-800 leading-relaxed animate-pulse">
                      「どれどれ？わー綺麗だね」
                    </p>
                  </div>
                )}

                {step === 'girls_talk_5' && (
                  <div className="animate-fade-in py-6">
                    <p className="text-sm md:text-base font-bold text-stone-800 leading-relaxed animate-pulse">
                      「うふふ」
                    </p>
                  </div>
                )}

                {step === 'girls_talk_6' && (
                  <div className="animate-fade-in py-6">
                    <p className="text-sm md:text-base font-bold text-stone-800 leading-relaxed animate-pulse">
                      「そうでしょ」
                    </p>
                  </div>
                )}

              </div>

              <div className="text-center text-[10px] text-stone-300 font-bold animate-pulse">
                画面をクリック / タップして進む
              </div>
            </div>
          )}

          {/* Thank you for playing! 画面 */}
          {step === 'thank_you' && (
            <div className="max-w-md w-full text-center space-y-12 animate-fade-in py-10">
              <div className="space-y-4">
                <h1 className="text-3xl md:text-4xl font-extrabold tracking-widest text-slate-800 font-sans uppercase animate-pulse">
                  Thank you for playing!
                </h1>
                <div className="w-16 h-0.5 bg-emerald-500 mx-auto rounded-full mt-4 animate-bounce" />
              </div>

              {/* タイトルに戻るボタン */}
              <div className="pt-6">
                <button
                  onClick={() => {
                    audioManager.playClearJingle();
                    onQuit();
                  }}
                  className="px-8 py-3 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs tracking-widest uppercase rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105 cursor-pointer border border-slate-700 flex items-center justify-center gap-2 mx-auto"
                >
                  <Home size={14} />
                  タイトル画面に戻る
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
