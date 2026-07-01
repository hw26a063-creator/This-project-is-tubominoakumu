/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { audioManager } from '../utils/audio';
import { Home, Sparkles, MessageSquare } from 'lucide-react';

interface WhiteRoomProps {
  onQuit: () => void;
}

interface Vector2D {
  x: number;
  y: number;
}

interface RoomObject {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  description: string;
}

export default function WhiteRoom({ onQuit }: WhiteRoomProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [playerPosition, setPlayerPosition] = useState<Vector2D>({ x: 250, y: 350 });
  const [playerAngle, setPlayerAngle] = useState<number>(Math.PI / 2); // 下向き
  const [activeMessage, setActiveMessage] = useState<string | null>(
    "……ここは？ 悪夢が……消えた？ 手が、自分のものではないような……"
  );
  const [interactingObject, setInteractingObject] = useState<RoomObject | null>(null);

  // キャラクター（つぼみではなく別の男、白衣の医師。名前は「榊原」等）
  // 榊原 (Sakakibara) のステータス
  const playerSpeed = 3;

  // 部屋のオブジェクトたち（綺麗な白い病院の一室）
  const objects: RoomObject[] = [
    {
      id: 'bed',
      name: '清潔な白いベッド',
      x: 80,
      y: 100,
      width: 120,
      height: 80,
      color: '#ffffff',
      description: '真っ白でシミひとつないベッド。先ほどまでうなされていた錆びた鉄格子のベッドとは、まるで違っている。'
    },
    {
      id: 'desk',
      name: '診察用のデスク',
      x: 350,
      y: 150,
      width: 100,
      height: 60,
      color: '#e2e8f0',
      description: 'カルテが整然と置かれたデスク。ディスプレイには、いくつかの患者データが表示されている……。'
    },
    {
      id: 'chair',
      name: '丸いパイプ椅子',
      x: 380,
      y: 230,
      width: 40,
      height: 40,
      color: '#94a3b8',
      description: 'カウンセリング用の椅子。ひんやりとしていて、現実感を伝えてくる。'
    },
    {
      id: 'plant',
      name: '青々とした観葉植物',
      x: 440,
      y: 80,
      width: 40,
      height: 40,
      color: '#22c55e',
      description: '生き生きと葉を伸ばすパキラの鉢植え。あの濁った世界には、生きた緑など一切存在しなかった。'
    },
    {
      id: 'window',
      name: '大きなガラス窓',
      x: 200,
      y: 30,
      width: 150,
      height: 10,
      color: '#93c5fd',
      description: '窓の外には、暖かな午後の太陽の光が降り注いでいる。穏やかな街並みが見える。夢の中の嵐は、嘘のようだ。'
    },
    {
      id: 'door',
      name: '診察室の重厚なドア',
      x: 220,
      y: 470,
      width: 80,
      height: 15,
      color: '#b45309',
      description: '外の廊下へと続くドア。今はまだ、ここから出る心の準備ができていない。自分自身の「現実」と、つぼみの「悪夢」の繋がりを考え直さなければ……。'
    }
  ];

  // キー入力状態
  const keysPressed = useRef<{ [key: string]: boolean }>({});

  useEffect(() => {
    // 起動時にBGMを停止（白くて静かで、どこか非現実的な環境音）
    audioManager.stopAll();

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      keysPressed.current[key] = true;
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        keysPressed.current[e.key] = true;
      }

      // EキーまたはEnterキーで最寄りのオブジェクトと会話・調べる
      if (key === 'e' || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (interactingObject) {
          audioManager.playFlashlightClick();
          setActiveMessage(`【${interactingObject.name}】\n${interactingObject.description}`);
        } else {
          setActiveMessage(null);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      keysPressed.current[key] = false;
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        keysPressed.current[e.key] = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [interactingObject]);

  // ゲームループ
  useEffect(() => {
    let animationId: number;
    let currentX = playerPosition.x;
    let currentY = playerPosition.y;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const update = () => {
      let dx = 0;
      let dy = 0;

      // 移動入力
      if (keysPressed.current['w'] || keysPressed.current['arrowup']) {
        dy -= 1;
      }
      if (keysPressed.current['s'] || keysPressed.current['arrowdown']) {
        dy += 1;
      }
      if (keysPressed.current['a'] || keysPressed.current['arrowleft']) {
        dx -= 1;
      }
      if (keysPressed.current['d'] || keysPressed.current['arrowright']) {
        dx += 1;
      }

      if (dx !== 0 || dy !== 0) {
        // 対角線移動の速度補正
        const length = Math.hypot(dx, dy);
        const moveX = (dx / length) * playerSpeed;
        const moveY = (dy / length) * playerSpeed;

        let nextX = currentX + moveX;
        let nextY = currentY + moveY;

        // 部屋の範囲（境界）衝突判定 (部屋サイズ: 幅500, 高さ500)
        const margin = 20;
        if (nextX < margin) nextX = margin;
        if (nextX > 500 - margin) nextX = 500 - margin;
        if (nextY < 50) nextY = 50; // 上壁マージン
        if (nextY > 500 - margin) nextY = 500 - margin;

        // オブジェクトとの衝突判定
        let hit = false;
        for (const obj of objects) {
          // 衝突円/短形判定。簡略化して短形のAABB判定
          const objMargin = 12;
          if (
            nextX > obj.x - objMargin &&
            nextX < obj.x + obj.width + objMargin &&
            nextY > obj.y - objMargin &&
            nextY < obj.y + obj.height + objMargin
          ) {
            hit = true;
            break;
          }
        }

        if (!hit) {
          currentX = nextX;
          currentY = nextY;
          setPlayerPosition({ x: currentX, y: currentY });
        }

        // プレイヤー角度の更新
        const angle = Math.atan2(moveY, moveX);
        setPlayerAngle(angle);
      }

      // 近くのインタラクション可能オブジェクトを探す
      let closestObj: RoomObject | null = null;
      let minDist = 60; // 60px以内

      for (const obj of objects) {
        // オブジェクトの中心
        const cx = obj.x + obj.width / 2;
        const cy = obj.y + obj.height / 2;
        const dist = Math.hypot(currentX - cx, currentY - cy);
        if (dist < minDist) {
          minDist = dist;
          closestObj = obj;
        }
      }
      setInteractingObject(closestObj);

      // --- 描画 (Canvas Rendering) ---
      ctx.clearRect(0, 0, 500, 500);

      // 1. 床（明るいモダンな薄いグレー・木のフローリングタイル風）
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, 500, 500);

      // グリッド線（綺麗なフロアタイル）
      ctx.strokeStyle = '#f1f5f9';
      ctx.lineWidth = 2;
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

      // 2. 壁 (上部、影)
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(0, 0, 500, 45);

      // 窓から差し込む美しい太陽光（エフェクト）
      ctx.fillStyle = 'rgba(253, 224, 71, 0.15)';
      ctx.beginPath();
      ctx.moveTo(180, 45);
      ctx.lineTo(370, 45);
      ctx.lineTo(440, 500);
      ctx.lineTo(120, 500);
      ctx.closePath();
      ctx.fill();

      // 3. 部屋の家具・オブジェクトの描画
      objects.forEach(obj => {
        // 影
        ctx.fillStyle = 'rgba(148, 163, 184, 0.2)';
        ctx.fillRect(obj.x + 4, obj.y + 4, obj.width, obj.height);

        // 本体
        ctx.fillStyle = obj.color;
        ctx.fillRect(obj.x, obj.y, obj.width, obj.height);

        // 枠線
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);

        // 家具のデザイン（個別ディテール）
        if (obj.id === 'bed') {
          // 枕
          ctx.fillStyle = '#e2e8f0';
          ctx.fillRect(obj.x + 10, obj.y + 10, 30, 25);
          ctx.strokeRect(obj.x + 10, obj.y + 10, 30, 25);
          // シーツの折り返しライン
          ctx.beginPath();
          ctx.moveTo(obj.x + 50, obj.y);
          ctx.lineTo(obj.x + 50, obj.y + obj.height);
          ctx.stroke();
        } else if (obj.id === 'desk') {
          // ディスプレイ
          ctx.fillStyle = '#475569';
          ctx.fillRect(obj.x + 30, obj.y + 10, 40, 6);
          ctx.fillRect(obj.x + 45, obj.y + 16, 10, 10);
          // カルテ
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(obj.x + 10, obj.y + 35, 15, 18);
        } else if (obj.id === 'plant') {
          // 観葉植物の葉
          ctx.fillStyle = '#16a34a';
          ctx.beginPath();
          ctx.arc(obj.x + 20, obj.y + 15, 12, 0, Math.PI * 2);
          ctx.fill();
        } else if (obj.id === 'window') {
          // 窓のサッシ
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(obj.x, obj.y, obj.width, 3);
        } else if (obj.id === 'chair') {
          // 丸型
          ctx.fillStyle = '#64748b';
          ctx.beginPath();
          ctx.arc(obj.x + 20, obj.y + 20, 14, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }

        // 調べられる範囲内にある場合、インタラクション表示の枠線を強調する
        if (interactingObject?.id === obj.id) {
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 2.5;
          ctx.strokeRect(obj.x - 2, obj.y - 2, obj.width + 4, obj.height + 4);
        }
      });

      // 4. プレイヤー（操作キャラ：つぼみではなく、大人の黒いセーターを着た人物、またはサカキ先生）の描画
      // 影
      ctx.fillStyle = 'rgba(71, 85, 105, 0.25)';
      ctx.beginPath();
      ctx.arc(currentX, currentY + 12, 14, 0, Math.PI * 2);
      ctx.fill();

      // 体（黒いシックなセーター、白衣、知的な佇まい）
      ctx.fillStyle = '#1e293b'; // 濃いチャコールグレー/黒のコート
      ctx.beginPath();
      ctx.arc(currentX, currentY + 4, 12, 0, Math.PI * 2);
      ctx.fill();

      // 白衣の襟やシャツのディテールを小さくドット絵的に描画
      ctx.fillStyle = '#ffffff'; // インナーのシャツ
      ctx.fillRect(currentX - 2, currentY + 1, 4, 6);

      // 頭部
      ctx.fillStyle = '#fbcfe8'; // やや明るめのスキンカラー（つぼみとは違うトーン）
      ctx.beginPath();
      ctx.arc(currentX, currentY - 12, 9, 0, Math.PI * 2);
      ctx.fill();

      // 髪（落ち着いた茶色/黒の短髪）
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(currentX, currentY - 13, 10, Math.PI, Math.PI * 2);
      ctx.fill();
      // サイドの髪の毛先
      ctx.fillRect(currentX - 10, currentY - 13, 3, 6);
      ctx.fillRect(currentX + 7, currentY - 13, 3, 6);

      // メガネ（知的な医師キャラクターの証）
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(currentX - 3, currentY - 12, 2, 0, Math.PI * 2);
      ctx.arc(currentX + 3, currentY - 12, 2, 0, Math.PI * 2);
      ctx.stroke();
      // メガネのブリッジ
      ctx.beginPath();
      ctx.moveTo(currentX - 1, currentY - 12);
      ctx.lineTo(currentX + 1, currentY - 12);
      ctx.stroke();

      // 足
      ctx.fillStyle = '#334155';
      ctx.fillRect(currentX - 6, currentY + 14, 4, 8);
      ctx.fillRect(currentX + 2, currentY + 14, 4, 8);

      // 向いている方向を示す小さな指標 (白衣の背中など)
      const lookX = currentX + Math.cos(playerAngle) * 8;
      const lookY = currentY + Math.sin(playerAngle) * 8;
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(lookX, lookY, 3, 0, Math.PI * 2);
      ctx.fill();

      animationId = requestAnimationFrame(update);
    };

    update();

    return () => cancelAnimationFrame(animationId);
  }, [playerPosition, playerAngle]);

  return (
    <div 
      className="fixed inset-0 bg-stone-100 flex flex-col items-center justify-center p-4 z-30 select-none text-stone-800"
      id="white_room_container"
    >
      {/* 優しい環境演出のためのオーラ・背景ぼかし */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,1)_0%,rgba(241,245,249,1)_100%)] pointer-events-none" />

      {/* メインウィンドウ */}
      <div 
        className="w-full max-w-[540px] bg-white border border-slate-200 rounded-3xl p-4 md:p-6 shadow-xl relative z-40 space-y-4 flex flex-col items-center"
        id="white_room_window"
      >
        {/* ヘッダー */}
        <div className="w-full flex justify-between items-center border-b border-slate-100 pb-2" id="white_room_header">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-400" />
            <span className="font-bold text-slate-700 text-sm tracking-wider font-sans"></span>
          </div>
          <button 
            id="white_room_btn_title"
            onClick={onQuit}
            className="flex items-center gap-1.5 px-3 py-1 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs text-slate-500 font-semibold cursor-pointer transition-all"
          >
            <Home size={12} /> タイトルへ
          </button>
        </div>

        {/* キャンバス */}
        <div className="relative border border-slate-200 rounded-2xl overflow-hidden bg-slate-50 aspect-square w-full max-w-[460px]">
          <canvas 
            ref={canvasRef} 
            width={500} 
            height={500} 
            className="w-full h-full block"
          />

          {/* インタラクション吹き出しガイド */}
          {interactingObject && (
            <div 
              className="absolute left-1/2 -translate-x-1/2 top-4 bg-emerald-500 text-white text-[10px] md:text-xs font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 animate-bounce"
              id="interaction_tip"
            >
              <MessageSquare size={12} />
              <span>「{interactingObject.name}」を調べる [Enter / Space]</span>
            </div>
          )}
        </div>

        {/* テキストメッセージボックス */}
        <div 
          className="w-full bg-slate-50 border border-slate-100 p-3 rounded-2xl min-h-[72px] text-xs sm:text-sm text-slate-600 leading-relaxed font-sans flex flex-col justify-center relative"
          id="white_room_msg_box"
        >
          {activeMessage ? (
            <div className="whitespace-pre-wrap">
              {activeMessage}
            </div>
          ) : (
            <div className="text-slate-400 italic text-center">
              [WASD]キー または 矢印キーで移動できます。近くの家具に近づいて調べてみましょう。
            </div>
          )}
          
          <div className="absolute right-3 bottom-2 text-[9px] font-mono text-slate-300">
            [操作キャラ: 榊 医師]
          </div>
        </div>

        {/* 演出用フッター */}
        <div className="w-full text-center text-[10px] text-slate-400 font-medium tracking-wide border-t border-slate-50 pt-2" id="white_room_footer">
          つぼみの悪夢の深層から、何かが繋がり始めている……
        </div>
      </div>
    </div>
  );
}
