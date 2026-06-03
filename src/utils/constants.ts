// ─── Game Constants ───
export const MAP_SIZE = 2200;
export const GAME_DURATION = 120;
export const BOT_COUNT = 3;
export const INITIAL_PLAYER_RADIUS = 24;
export const MAX_HOLE_RADIUS = 300;

export const LEVEL_THRESHOLDS = [0, 50, 180, 480, 1100, 2400];
export const LEVEL_RADII = [24, 38, 54, 76, 108, 148];
export const LEVEL_NAMES = [
  'Sub-Singularity',
  'Gravity Cluster',
  'Cyber Vortex',
  'Dark Singularity',
  'Mega Devourer',
  'Abyssal God',
];

export const SIZE_TIER_LABELS = [
  'BIGGER!',
  'MASSIVE!',
  'COLOSSAL!',
  'UNSTOPPABLE!',
  'GODLIKE!',
];

// ─── Speed ───
export function getBaseSpeed(radius: number): number {
  const base = 6.5;
  const scale = Math.max(0.65, 1.1 - radius / 350);
  return base * scale;
}

// ─── Quality ───
export enum Quality {
  LOW = 0,
  MEDIUM = 1,
  HIGH = 2,
}

export function detectQuality(): Quality {
  const isMobile = window.innerWidth < 768 || 'ontouchstart' in window;
  if (isMobile) return Quality.LOW;
  if (window.devicePixelRatio > 1.5) return Quality.HIGH;
  return Quality.MEDIUM;
}

export function isMobileDevice(): boolean {
  return window.innerWidth < 768 || 'ontouchstart' in window;
}

// ─── Game State ───
export enum GameState {
  LOADING = 'LOADING',
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER',
}

// ─── Object Types ───
export interface ObjectType {
  id: string;
  size: number;
  score: number;
  growth: number;
  color: string;
  neonColor: string;
  symbol: string;
  isMoving: boolean;
  geometryType: 'box' | 'cylinder' | 'cone' | 'composite';
  heightScale: number;
}

export interface MapDefinition {
  id: string;
  name: string;
  themeColor: string;
  groundColor: string;
  gridColor: string;
  objects: Record<string, ObjectType>;
}

export const MAP_DEFINITIONS: MapDefinition[] = [
  {
    id: 'M1_DOWNTOWN',
    name: 'Downtown City',
    themeColor: '#0A0A12',
    groundColor: '#0A0A12',
    gridColor: '#1E1E3F',
    objects: {
      TRASH: { id: 'TRASH', size: 12, score: 5, growth: 0.8, color: '#6B7280', neonColor: '#9CA3AF', symbol: '🗑️', isMoving: false, geometryType: 'cylinder', heightScale: 0.8 },
      BENCH: { id: 'BENCH', size: 16, score: 10, growth: 1.2, color: '#B45309', neonColor: '#D97706', symbol: '🪑', isMoving: false, geometryType: 'box', heightScale: 0.5 },
      TREE: { id: 'TREE', size: 24, score: 20, growth: 2.0, color: '#059669', neonColor: '#10B981', symbol: '🌳', isMoving: false, geometryType: 'cone', heightScale: 2.0 },
      CAR: { id: 'CAR', size: 36, score: 45, growth: 3.5, color: '#2563EB', neonColor: '#3B82F6', symbol: '🚗', isMoving: true, geometryType: 'composite', heightScale: 0.7 },
      BUS: { id: 'BUS', size: 55, score: 80, growth: 5.0, color: '#D97706', neonColor: '#F59E0B', symbol: '🚌', isMoving: true, geometryType: 'box', heightScale: 1.2 },
      SHOP: { id: 'SHOP', size: 75, score: 150, growth: 7.5, color: '#DC2626', neonColor: '#EF4444', symbol: '🏪', isMoving: false, geometryType: 'box', heightScale: 2.0 },
      RESTAURANT: { id: 'RESTAURANT', size: 105, score: 250, growth: 10.0, color: '#7C3AED', neonColor: '#8B5CF6', symbol: '🍔', isMoving: false, geometryType: 'box', heightScale: 2.5 },
      SKYSCRAPER: { id: 'SKYSCRAPER', size: 145, score: 400, growth: 15.0, color: '#B8860B', neonColor: '#FFD700', symbol: '🏢', isMoving: false, geometryType: 'box', heightScale: 4.0 },
    },
  },
  {
    id: 'M6_SPACE',
    name: 'Space Colony',
    themeColor: '#050510',
    groundColor: '#050510',
    gridColor: '#1A1A3F',
    objects: {
      CORE: { id: 'CORE', size: 12, score: 5, growth: 0.8, color: '#6B7280', neonColor: '#9CA3AF', symbol: '🔋', isMoving: false, geometryType: 'cylinder', heightScale: 0.6 },
      ROBOT: { id: 'ROBOT', size: 16, score: 10, growth: 1.2, color: '#B45309', neonColor: '#D97706', symbol: '🤖', isMoving: true, geometryType: 'box', heightScale: 1.0 },
      ROVER: { id: 'ROVER', size: 24, score: 20, growth: 2.0, color: '#059669', neonColor: '#10B981', symbol: '🚙', isMoving: true, geometryType: 'composite', heightScale: 0.6 },
      SPACECRAFT: { id: 'SPACECRAFT', size: 36, score: 45, growth: 3.5, color: '#2563EB', neonColor: '#3B82F6', symbol: '🛸', isMoving: true, geometryType: 'cone', heightScale: 0.5 },
      LAB: { id: 'LAB', size: 55, score: 80, growth: 5.0, color: '#D97706', neonColor: '#F59E0B', symbol: '🧪', isMoving: false, geometryType: 'box', heightScale: 1.5 },
      DOME: { id: 'DOME', size: 75, score: 150, growth: 7.5, color: '#DC2626', neonColor: '#EF4444', symbol: '🔮', isMoving: false, geometryType: 'cylinder', heightScale: 1.5 },
      STATION: { id: 'STATION', size: 105, score: 250, growth: 10.0, color: '#7C3AED', neonColor: '#8B5CF6', symbol: '🛰️', isMoving: false, geometryType: 'box', heightScale: 3.0 },
      MOTHERSHIP: { id: 'MOTHERSHIP', size: 145, score: 400, growth: 15.0, color: '#B8860B', neonColor: '#FFD700', symbol: '🌌', isMoving: false, geometryType: 'box', heightScale: 4.5 },
    },
  },
];

// ─── Powerup Types ───
export interface PowerupType {
  type: string;
  color: string;
  neonColor: string;
  symbol: string;
  label: string;
}

export const POWERUP_TYPES: Record<string, PowerupType> = {
  MAGNET: { type: 'MAGNET', color: '#FF3300', neonColor: '#FF5533', symbol: '🧲', label: 'GRAVITY OVERLOAD' },
  SPEED: { type: 'SPEED', color: '#33FF33', neonColor: '#55FF55', symbol: '⚡', label: 'WARP BOOST' },
  MULTIPLIER: { type: 'MULTIPLIER', color: '#FFCC00', neonColor: '#FFDD33', symbol: '💎', label: 'DARK ENERGY' },
};

// ─── Skins ───
export interface SkinDef {
  id: string;
  name: string;
  desc: string;
  cost: number;
  primary: string;
  secondary: string;
}

export const SKINS: SkinDef[] = [
  { id: 'NEON', name: 'CRT Singularity', desc: 'Default amber event horizon core', cost: 0, primary: '#7B2FFF', secondary: '#FF2FBE' },
  { id: 'PLASMA', name: 'Arcade Flare', desc: 'Fiery red solar loops & pixel sparkles', cost: 100, primary: '#FF3300', secondary: '#FFCC00' },
  { id: 'MATRIX', name: '8-Bit Grid', desc: 'Retro green binary code cascade', cost: 250, primary: '#33FF33', secondary: '#006600' },
  { id: 'COSMIC', name: 'VGA Nebula', desc: 'VGA purple space-dust galaxy core', cost: 500, primary: '#CC00FF', secondary: '#3399FF' },
  { id: 'GLITCH', name: 'Scanline Aberration', desc: 'Glitching scanline aberration border', cost: 1000, primary: '#FFFFFF', secondary: '#FF0033' },
];

// ─── Bot Names ───
export const BOT_NAMES = ['AlphaVoid', 'PixelSuck', 'GigaSuck'];
export const BOT_COLORS = ['#BF00FF', '#00FFFF', '#FFEA00'];

// ─── Design System Colors ───
export const COLORS = {
  primary: '#7B2FFF',
  accent: '#FF2FBE',
  accent2: '#2FF5FF',
  bgDark: 'rgba(5, 5, 15, 0.85)',
  glassSurface: 'rgba(255, 255, 255, 0.04)',
  glassBorder: 'rgba(255, 255, 255, 0.08)',
  voidDark: '#0D0015',
  voidMid: '#1A0030',
};
