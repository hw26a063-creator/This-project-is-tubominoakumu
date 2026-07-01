/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type GameState = 'TITLE' | 'RULE' | 'INTRO' | 'PLAYING' | 'GAMEOVER' | 'CLEAR' | 'WHITE_ROOM' | 'ESCAPE_TALK';

export type MonsterType = 'HEARING' | 'LIGHT_SENSITIVE';
export type MonsterState = 'PATROL' | 'CHASE' | 'SEARCH';

export interface Monster {
  id: string;
  type: MonsterType;
  x: number;
  y: number;
  speed: number;
  angle: number;
  state: MonsterState;
  targetX: number;
  targetY: number;
  patrolPath: { x: number; y: number }[];
  patrolIndex: number;
  searchTimer: number; // 追跡を見失ったときの捜索タイマー（秒）
  lastKnownPlayerX?: number;
  lastKnownPlayerY?: number;
}

export type ItemType = 'SMALL_MEDICINE' | 'LARGE_MEDICINE' | 'KEY_PIECE' | 'NOTE';

export interface Item {
  id: string;
  type: ItemType;
  x: number;
  y: number;
  collected: boolean;
  pulseTimer: number; // アニメーション用
}

export interface HideSpot {
  id: string;
  type: 'BED' | 'CLOSET';
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Obstacle {
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
}

export interface Player {
  x: number;
  y: number;
  angle: number;
  speed: number;
  isDashing: boolean;
  stamina: number; // 0 to 100
  san: number; // 0 to 100
  flashlightOn: boolean;
  isHiding: boolean;
  hidingInId: string | null;
  keysCollected: boolean[]; // size 4, true if key piece 0,1,2,3 is collected
  smallMedsCount: number;
  largeMedsCount: number;
  notesCollected: boolean[]; // size 4, true if note 0,1,2,3 is collected
  
  // セーブ用（捕まった時のリスタート位置）
  saveX: number;
  saveY: number;
  saveKeysCollected: boolean[];
  saveSmallMedsCount: number;
  saveLargeMedsCount: number;
  saveNotesCollected: boolean[];
}

export interface GameMap {
  width: number;
  height: number;
  obstacles: Obstacle[];
  spawnX: number; // 初期スポーン
  spawnY: number;
  exitX: number;  // 脱出扉
  exitY: number;
  exitWidth: number;
  exitHeight: number;
  hideSpots: HideSpot[];
  items: Item[];
}
