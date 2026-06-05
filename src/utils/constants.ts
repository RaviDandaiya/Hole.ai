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
  // Starts fast (size 24) and decays moderately to a min scale of 0.60 at max size (300)
  const base = 18.0;
  const scale = Math.max(0.60, 1.15 - radius / 400);
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
    themeColor: 'radial-gradient(circle, #1E1E3F 0%, #0A0A12 100%)',
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
    id: 'M2_VINTAGE',
    name: 'Retro Arcade',
    themeColor: 'radial-gradient(circle, #3D103D 0%, #1A051A 100%)',
    groundColor: '#1A051A',
    gridColor: '#D946EF',
    objects: {
      CRT_MONITOR: { id: 'CRT_MONITOR', size: 12, score: 5, growth: 0.8, color: '#2B2B2B', neonColor: '#FF55FF', symbol: '📺', isMoving: false, geometryType: 'box', heightScale: 0.9 },
      JOYSTICK: { id: 'JOYSTICK', size: 16, score: 10, growth: 1.2, color: '#E11D48', neonColor: '#F43F5E', symbol: '🕹️', isMoving: false, geometryType: 'cylinder', heightScale: 1.4 },
      CASSETTE: { id: 'CASSETTE', size: 24, score: 20, growth: 2.0, color: '#CA8A04', neonColor: '#FACC15', symbol: '📼', isMoving: false, geometryType: 'box', heightScale: 0.5 },
      ARCADE_CABINET: { id: 'ARCADE_CABINET', size: 36, score: 45, growth: 3.5, color: '#1E1B4B', neonColor: '#6366F1', symbol: '👾', isMoving: true, geometryType: 'box', heightScale: 2.2 },
      RETRO_CONSOLE: { id: 'RETRO_CONSOLE', size: 55, score: 80, growth: 5.0, color: '#3F3F46', neonColor: '#EC4899', symbol: '🎮', isMoving: true, geometryType: 'box', heightScale: 0.7 },
      FLOPPY_DISK: { id: 'FLOPPY_DISK', size: 75, score: 150, growth: 7.5, color: '#1D4ED8', neonColor: '#60A5FA', symbol: '💾', isMoving: false, geometryType: 'box', heightScale: 0.4 },
      JUKEBOX: { id: 'JUKEBOX', size: 105, score: 250, growth: 10.0, color: '#B45309', neonColor: '#F59E0B', symbol: '📻', isMoving: false, geometryType: 'cylinder', heightScale: 2.3 },
      ARCADE_HALL: { id: 'ARCADE_HALL', size: 145, score: 400, growth: 15.0, color: '#2E1065', neonColor: '#D946EF', symbol: '🏰', isMoving: false, geometryType: 'box', heightScale: 3.5 },
    },
  },
  {
    id: 'M3_MODERN',
    name: 'Neo Metropolis',
    themeColor: 'radial-gradient(circle, #203540 0%, #051015 100%)',
    groundColor: '#051015',
    gridColor: '#06B6D4',
    objects: {
      SMART_BIN: { id: 'SMART_BIN', size: 12, score: 5, growth: 0.8, color: '#E2E8F0', neonColor: '#2FF5FF', symbol: '🗑️', isMoving: false, geometryType: 'cylinder', heightScale: 1.1 },
      HOLOGRAM_STAND: { id: 'HOLOGRAM_STAND', size: 16, score: 10, growth: 1.2, color: '#CBD5E1', neonColor: '#00FFFF', symbol: '🗼', isMoving: false, geometryType: 'cone', heightScale: 2.0 },
      CHARGING_STATION: { id: 'CHARGING_STATION', size: 24, score: 20, growth: 2.0, color: '#94A3B8', neonColor: '#10B981', symbol: '🔋', isMoving: false, geometryType: 'box', heightScale: 1.6 },
      ELECTRIC_CAR: { id: 'ELECTRIC_CAR', size: 36, score: 45, growth: 3.5, color: '#FFFFFF', neonColor: '#2FF5FF', symbol: '🚗', isMoving: true, geometryType: 'composite', heightScale: 0.7 },
      AUTONOMOUS_BUS: { id: 'AUTONOMOUS_BUS', size: 55, score: 80, growth: 5.0, color: '#F1F5F9', neonColor: '#8B5CF6', symbol: '🚌', isMoving: true, geometryType: 'box', heightScale: 1.3 },
      SMART_HOME: { id: 'SMART_HOME', size: 75, score: 150, growth: 7.5, color: '#E2E8F0', neonColor: '#3B82F6', symbol: '🏠', isMoving: false, geometryType: 'box', heightScale: 2.2 },
      RESEARCH_LAB: { id: 'RESEARCH_LAB', size: 105, score: 250, growth: 10.0, color: '#F8FAFC', neonColor: '#EF4444', symbol: '🏢', isMoving: false, geometryType: 'box', heightScale: 3.0 },
      GLASS_SKYSCRAPER: { id: 'GLASS_SKYSCRAPER', size: 145, score: 400, growth: 15.0, color: '#0F172A', neonColor: '#00E5FF', symbol: '🏙️', isMoving: false, geometryType: 'box', heightScale: 5.0 },
    },
  },
  {
    id: 'M4_TOXIC',
    name: 'Toxic Wasteland',
    themeColor: 'radial-gradient(circle, #1C3317 0%, #0B140A 100%)',
    groundColor: '#0B140A',
    gridColor: '#84CC16',
    objects: {
      SLIME_MUG: { id: 'SLIME_MUG', size: 12, score: 5, growth: 0.8, color: '#4D7C0F', neonColor: '#A3E635', symbol: '🧪', isMoving: false, geometryType: 'cylinder', heightScale: 0.9 },
      WARNING_SIGN: { id: 'WARNING_SIGN', size: 16, score: 10, growth: 1.2, color: '#CA8A04', neonColor: '#EAB308', symbol: '⚠️', isMoving: false, geometryType: 'box', heightScale: 1.8 },
      WASTE_DRUM: { id: 'WASTE_DRUM', size: 24, score: 20, growth: 2.0, color: '#15803D', neonColor: '#22C55E', symbol: '🛢️', isMoving: false, geometryType: 'cylinder', heightScale: 1.5 },
      MUTANT_BUG: { id: 'MUTANT_BUG', size: 36, score: 45, growth: 3.5, color: '#B91C1C', neonColor: '#EF4444', symbol: '🪲', isMoving: true, geometryType: 'cylinder', heightScale: 0.6 },
      CLEANUP_DRONE: { id: 'CLEANUP_DRONE', size: 55, score: 80, growth: 5.0, color: '#475569', neonColor: '#A855F7', symbol: '🛸', isMoving: true, geometryType: 'cone', heightScale: 0.8 },
      HAZMAT_SHELTER: { id: 'HAZMAT_SHELTER', size: 75, score: 150, growth: 7.5, color: '#334155', neonColor: '#CA8A04', symbol: '⛺', isMoving: false, geometryType: 'box', heightScale: 1.6 },
      SLIME_VATS: { id: 'SLIME_VATS', size: 105, score: 250, growth: 10.0, color: '#1E293B', neonColor: '#A3E635', symbol: '🏭', isMoving: false, geometryType: 'cylinder', heightScale: 2.2 },
      COOLING_TOWER: { id: 'COOLING_TOWER', size: 145, score: 400, growth: 15.0, color: '#0F172A', neonColor: '#22C55E', symbol: '☢️', isMoving: false, geometryType: 'cylinder', heightScale: 4.2 },
    },
  },
  {
    id: 'M5_MATRIX',
    name: 'Digital Matrix',
    themeColor: 'radial-gradient(circle, #0F3D0F 0%, #030F03 100%)',
    groundColor: '#030F03',
    gridColor: '#22C55E',
    objects: {
      BIT_NODE: { id: 'BIT_NODE', size: 12, score: 5, growth: 0.8, color: '#052E16', neonColor: '#22C55E', symbol: '🟢', isMoving: false, geometryType: 'box', heightScale: 0.8 },
      CODE_FRAGMENT: { id: 'CODE_FRAGMENT', size: 16, score: 10, growth: 1.2, color: '#14532D', neonColor: '#4ADE80', symbol: '📄', isMoving: false, geometryType: 'box', heightScale: 1.3 },
      GLITCH_CUBE: { id: 'GLITCH_CUBE', size: 24, score: 20, growth: 2.0, color: '#0F291E', neonColor: '#34D399', symbol: '🧊', isMoving: false, geometryType: 'box', heightScale: 1.0 },
      DATA_PACKET: { id: 'DATA_PACKET', size: 36, score: 45, growth: 3.5, color: '#064E3B', neonColor: '#059669', symbol: '📦', isMoving: true, geometryType: 'box', heightScale: 0.7 },
      FIREWALL_NODE: { id: 'FIREWALL_NODE', size: 55, score: 80, growth: 5.0, color: '#7F1D1D', neonColor: '#EF4444', symbol: '🔥', isMoving: true, geometryType: 'cone', heightScale: 2.2 },
      SECURITY_DAEMON: { id: 'SECURITY_DAEMON', size: 75, score: 150, growth: 7.5, color: '#022C22', neonColor: '#F43F5E', symbol: '😈', isMoving: false, geometryType: 'box', heightScale: 1.8 },
      DATABASE_NODE: { id: 'DATABASE_NODE', size: 105, score: 250, growth: 10.0, color: '#065F46', neonColor: '#10b981', symbol: '🗄️', isMoving: false, geometryType: 'cylinder', heightScale: 3.0 },
      MAINFRAME_TOWER: { id: 'MAINFRAME_TOWER', size: 145, score: 400, growth: 15.0, color: '#022C22', neonColor: '#39FF14', symbol: '🖥️', isMoving: false, geometryType: 'box', heightScale: 4.8 },
    },
  },
  {
    id: 'M6_SPACE',
    name: 'Space Colony',
    themeColor: 'radial-gradient(circle, #1F1138 0%, #050510 100%)',
    groundColor: '#050510',
    gridColor: '#6366F1',
    objects: {
      CORE: { id: 'CORE', size: 12, score: 5, growth: 0.8, color: '#4B5563', neonColor: '#9CA3AF', symbol: '🔋', isMoving: false, geometryType: 'cylinder', heightScale: 0.6 },
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
  FREEZE: { type: 'FREEZE', color: '#00F5FF', neonColor: '#33FFFF', symbol: '❄️', label: 'CHRONO FREEZE' },
  GHOST: { type: 'GHOST', color: '#E0115F', neonColor: '#FF00FF', symbol: '👻', label: 'VOID PHASE' },
  PULSE: { type: 'PULSE', color: '#FFFFFF', neonColor: '#DDDDDD', symbol: '🌀', label: 'VOID PULSE' },
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

// ─── Custom Trails ───
export interface TrailDef {
  id: string;
  name: string;
  desc: string;
  cost: number;
  primary: string;
  secondary: string;
}

export const TRAILS: TrailDef[] = [
  { id: 'SPARKS', name: 'Default Sparks', desc: 'Standard neon vortex grid particles', cost: 0, primary: '#7B2FFF', secondary: '#2FF5FF' },
  { id: 'FIRE', name: 'Plasma Firewall', desc: 'Fiery arcade orange thermal loops', cost: 200, primary: '#FF5500', secondary: '#FFCC00' },
  { id: 'MATRIX', name: '8-Bit Code Cascade', desc: 'Retro green digital streams', cost: 400, primary: '#33FF33', secondary: '#004400' },
  { id: 'COSMIC', name: 'Galaxy Stardust', desc: 'Glowing nebula dust particles', cost: 600, primary: '#CC00FF', secondary: '#00FFFF' }
];

// ─── Starting Perks ───
export interface PerkDef {
  id: string;
  name: string;
  desc: string;
  cost: number;
  effect: 'size' | 'magnet' | 'speed';
  label: string;
}

export const PERKS: PerkDef[] = [
  { id: 'SIZE_PERK', name: 'Gravity Surge', desc: 'Start the match with +5 size bonus', cost: 250, effect: 'size', label: '+5 START SIZE' },
  { id: 'MAGNET_PERK', name: 'Overcharged Core', desc: 'Increase magnet range by +25%', cost: 350, effect: 'magnet', label: '+25% MAGNET RANGE' },
  { id: 'SPEED_PERK', name: 'Tachyon Glide', desc: 'Increase base movement speed by +15%', cost: 450, effect: 'speed', label: '+15% SPEED BOOST' }
];
