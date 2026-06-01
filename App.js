// CyberVortex.io - A Premium Cyberpunk Endless & Competitive Hole.io Clone
// Fully Optimized with Standard React Native Components using High-Performance Direct DOM Style Ticks,
// Bypassing React render cycles and setNativeProps deprecations for rock-solid 60fps local web and mobile play.
// Features size-progression zooms, steering AI bots, upgrades & persistent skins shop.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  Dimensions,
  PanResponder,
  Animated,
  TouchableOpacity,
  StatusBar,
  Vibration,
  Platform,
  ScrollView,
  TextInput,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Viewport sizes
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// --- Game Constants ---
const MAP_SIZE = 2200;
const GAME_DURATION = 120; // 2 minutes (seconds)
const BOT_COUNT = 3;

const INITIAL_PLAYER_RADIUS = 24;
const MAX_HOLE_RADIUS = 300;
const LEVEL_THRESHOLDS = [0, 50, 180, 480, 1100, 2400];
const LEVEL_RADII = [24, 38, 54, 76, 108, 148];
const LEVEL_NAMES = [
  "Sub-Singularity",
  "Gravity Cluster",
  "Cyber Vortex",
  "Dark Singularity",
  "Mega Devourer",
  "Abyssal God"
];

// Speed decays slightly as you become colossal, but keeping it fun
const getBaseSpeed = (radius) => {
  const base = 6.5; // Lowered base speed slightly to fix high sensitivity feeling
  const scale = Math.max(0.65, 1.10 - (radius / 350)); // Min speed 65% instead of 38% so it doesn't crawl at max size
  return base * scale;
};

const MAP_DEFINITIONS = [
  {
    id: 'M1_DOWNTOWN',
    name: 'Downtown City',
    themeColor: '#2a2a2a',
    objects: {
      TRASH: { id: 'TRASH', size: 12, score: 5, growth: 0.8, color: '#9ca3af', glow: 'rgba(156,163,175,0.8)', symbol: '🗑️' },
      BENCH: { id: 'BENCH', size: 16, score: 10, growth: 1.2, color: '#d97706', glow: 'rgba(217,119,6,0.8)', symbol: '🪑' },
      TREE: { id: 'TREE', size: 24, score: 20, growth: 2.0, color: '#10b981', glow: 'rgba(16,185,129,0.8)', symbol: '🌳' },
      CAR: { id: 'CAR', size: 36, score: 45, growth: 3.5, color: '#3b82f6', glow: 'rgba(59,130,246,0.8)', symbol: '🚗', isMoving: true },
      BUS: { id: 'BUS', size: 55, score: 80, growth: 5.0, color: '#f59e0b', glow: 'rgba(245,158,11,0.8)', symbol: '🚌', isMoving: true },
      SHOP: { id: 'SHOP', size: 75, score: 150, growth: 7.5, color: '#ef4444', glow: 'rgba(239,68,68,0.8)', symbol: '🏪' },
      RESTAURANT: { id: 'RESTAURANT', size: 105, score: 250, growth: 10.0, color: '#8b5cf6', glow: 'rgba(139,92,246,0.8)', symbol: '🍔' },
      SKYSCRAPER: { id: 'SKYSCRAPER', size: 145, score: 400, growth: 15.0, color: '#ffd700', glow: 'rgba(255,215,0,0.8)', symbol: '🏢' },
    }
  },
  {
    id: 'M2_BEACH',
    name: 'Beach Resort',
    themeColor: '#262615',
    objects: {
      CHAIR: { id: 'CHAIR', size: 12, score: 5, growth: 0.8, color: '#9ca3af', glow: 'rgba(156,163,175,0.8)', symbol: '🪑' },
      UMBRELLA: { id: 'UMBRELLA', size: 16, score: 10, growth: 1.2, color: '#d97706', glow: 'rgba(217,119,6,0.8)', symbol: '⛱️' },
      PALM: { id: 'PALM', size: 24, score: 20, growth: 2.0, color: '#10b981', glow: 'rgba(16,185,129,0.8)', symbol: '🌴' },
      BOAT: { id: 'BOAT', size: 36, score: 45, growth: 3.5, color: '#3b82f6', glow: 'rgba(59,130,246,0.8)', symbol: '🚤', isMoving: true },
      STALL: { id: 'STALL', size: 55, score: 80, growth: 5.0, color: '#f59e0b', glow: 'rgba(245,158,11,0.8)', symbol: '🌭' },
      TOWER: { id: 'TOWER', size: 75, score: 150, growth: 7.5, color: '#ef4444', glow: 'rgba(239,68,68,0.8)', symbol: '🗼' },
      VILLA: { id: 'VILLA', size: 105, score: 250, growth: 10.0, color: '#8b5cf6', glow: 'rgba(139,92,246,0.8)', symbol: '🛖' },
      HOTEL: { id: 'HOTEL', size: 145, score: 400, growth: 15.0, color: '#ffd700', glow: 'rgba(255,215,0,0.8)', symbol: '🏨' },
    }
  },
  {
    id: 'M3_INDUSTRIAL',
    name: 'Industrial Zone',
    themeColor: '#1f1f2e',
    objects: {
      BOX: { id: 'BOX', size: 12, score: 5, growth: 0.8, color: '#9ca3af', glow: 'rgba(156,163,175,0.8)', symbol: '📦' },
      BARREL: { id: 'BARREL', size: 16, score: 10, growth: 1.2, color: '#d97706', glow: 'rgba(217,119,6,0.8)', symbol: '🛢️' },
      PIPELINE: { id: 'PIPELINE', size: 24, score: 20, growth: 2.0, color: '#10b981', glow: 'rgba(16,185,129,0.8)', symbol: '🪈' },
      TRUCK: { id: 'TRUCK', size: 36, score: 45, growth: 3.5, color: '#3b82f6', glow: 'rgba(59,130,246,0.8)', symbol: '🚚', isMoving: true },
      CRANE: { id: 'CRANE', size: 55, score: 80, growth: 5.0, color: '#f59e0b', glow: 'rgba(245,158,11,0.8)', symbol: '🏗️' },
      WAREHOUSE: { id: 'WAREHOUSE', size: 75, score: 150, growth: 7.5, color: '#ef4444', glow: 'rgba(239,68,68,0.8)', symbol: '🛖' },
      FACTORY: { id: 'FACTORY', size: 105, score: 250, growth: 10.0, color: '#8b5cf6', glow: 'rgba(139,92,246,0.8)', symbol: '🏭' },
      POWER_STATION: { id: 'POWER_STATION', size: 145, score: 400, growth: 15.0, color: '#ffd700', glow: 'rgba(255,215,0,0.8)', symbol: '⚡' },
    }
  },
  {
    id: 'M4_JAPANESE',
    name: 'Japanese District',
    themeColor: '#2e1a22',
    objects: {
      LANTERN: { id: 'LANTERN', size: 12, score: 5, growth: 0.8, color: '#9ca3af', glow: 'rgba(156,163,175,0.8)', symbol: '🏮' },
      VENDING: { id: 'VENDING', size: 16, score: 10, growth: 1.2, color: '#d97706', glow: 'rgba(217,119,6,0.8)', symbol: '🧃' },
      CHERRY: { id: 'CHERRY', size: 24, score: 20, growth: 2.0, color: '#10b981', glow: 'rgba(16,185,129,0.8)', symbol: '🌸' },
      CAR: { id: 'CAR', size: 36, score: 45, growth: 3.5, color: '#3b82f6', glow: 'rgba(59,130,246,0.8)', symbol: '🚗', isMoving: true },
      STALL: { id: 'STALL', size: 55, score: 80, growth: 5.0, color: '#f59e0b', glow: 'rgba(245,158,11,0.8)', symbol: '🍜' },
      NEON: { id: 'NEON', size: 75, score: 150, growth: 7.5, color: '#ef4444', glow: 'rgba(239,68,68,0.8)', symbol: '🚥' },
      TEMPLE: { id: 'TEMPLE', size: 105, score: 250, growth: 10.0, color: '#8b5cf6', glow: 'rgba(139,92,246,0.8)', symbol: '⛩️' },
      PAGODA: { id: 'PAGODA', size: 145, score: 400, growth: 15.0, color: '#ffd700', glow: 'rgba(255,215,0,0.8)', symbol: '🏯' },
    }
  },
  {
    id: 'M5_UNIVERSITY',
    name: 'University Campus',
    themeColor: '#1a2e22',
    objects: {
      BOOK: { id: 'BOOK', size: 12, score: 5, growth: 0.8, color: '#9ca3af', glow: 'rgba(156,163,175,0.8)', symbol: '📚' },
      BENCH: { id: 'BENCH', size: 16, score: 10, growth: 1.2, color: '#d97706', glow: 'rgba(217,119,6,0.8)', symbol: '🪑' },
      BIKE: { id: 'BIKE', size: 24, score: 20, growth: 2.0, color: '#10b981', glow: 'rgba(16,185,129,0.8)', symbol: '🚲', isMoving: true },
      FOUNTAIN: { id: 'FOUNTAIN', size: 36, score: 45, growth: 3.5, color: '#3b82f6', glow: 'rgba(59,130,246,0.8)', symbol: '⛲' },
      CAFE: { id: 'CAFE', size: 55, score: 80, growth: 5.0, color: '#f59e0b', glow: 'rgba(245,158,11,0.8)', symbol: '☕' },
      DORM: { id: 'DORM', size: 75, score: 150, growth: 7.5, color: '#ef4444', glow: 'rgba(239,68,68,0.8)', symbol: '🏘️' },
      CLASS: { id: 'CLASS', size: 105, score: 250, growth: 10.0, color: '#8b5cf6', glow: 'rgba(139,92,246,0.8)', symbol: '🏫' },
      STADIUM: { id: 'STADIUM', size: 145, score: 400, growth: 15.0, color: '#ffd700', glow: 'rgba(255,215,0,0.8)', symbol: '🏟️' },
    }
  },
  {
    id: 'M6_SPACE',
    name: 'Space Colony',
    themeColor: '#050510',
    objects: {
      CORE: { id: 'CORE', size: 12, score: 5, growth: 0.8, color: '#9ca3af', glow: 'rgba(156,163,175,0.8)', symbol: '🔋' },
      ROBOT: { id: 'ROBOT', size: 16, score: 10, growth: 1.2, color: '#d97706', glow: 'rgba(217,119,6,0.8)', symbol: '🤖', isMoving: true },
      ROVER: { id: 'ROVER', size: 24, score: 20, growth: 2.0, color: '#10b981', glow: 'rgba(16,185,129,0.8)', symbol: '🚙', isMoving: true },
      SPACECRAFT: { id: 'SPACECRAFT', size: 36, score: 45, growth: 3.5, color: '#3b82f6', glow: 'rgba(59,130,246,0.8)', symbol: '🛸', isMoving: true },
      LAB: { id: 'LAB', size: 55, score: 80, growth: 5.0, color: '#f59e0b', glow: 'rgba(245,158,11,0.8)', symbol: '🧪' },
      DOME: { id: 'DOME', size: 75, score: 150, growth: 7.5, color: '#ef4444', glow: 'rgba(239,68,68,0.8)', symbol: '🔮' },
      STATION: { id: 'STATION', size: 105, score: 250, growth: 10.0, color: '#8b5cf6', glow: 'rgba(139,92,246,0.8)', symbol: '🛰️' },
      MOTHERSHIP: { id: 'MOTHERSHIP', size: 145, score: 400, growth: 15.0, color: '#ffd700', glow: 'rgba(255,215,0,0.8)', symbol: '🌌' },
    }
  },
  {
    id: 'M7_MEDIEVAL',
    name: 'Medieval Kingdom',
    themeColor: '#1c2e1c',
    objects: {
      STONE: { id: 'STONE', size: 12, score: 5, growth: 0.8, color: '#9ca3af', glow: 'rgba(156,163,175,0.8)', symbol: '🪨' },
      HAY: { id: 'HAY', size: 16, score: 10, growth: 1.2, color: '#d97706', glow: 'rgba(217,119,6,0.8)', symbol: '🌾' },
      CART: { id: 'CART', size: 24, score: 20, growth: 2.0, color: '#10b981', glow: 'rgba(16,185,129,0.8)', symbol: '🛒', isMoving: true },
      HORSE: { id: 'HORSE', size: 36, score: 45, growth: 3.5, color: '#3b82f6', glow: 'rgba(59,130,246,0.8)', symbol: '🐎', isMoving: true },
      TENT: { id: 'TENT', size: 55, score: 80, growth: 5.0, color: '#f59e0b', glow: 'rgba(245,158,11,0.8)', symbol: '⛺' },
      BLACKSMITH: { id: 'BLACKSMITH', size: 75, score: 150, growth: 7.5, color: '#ef4444', glow: 'rgba(239,68,68,0.8)', symbol: '⚒️' },
      TOWER: { id: 'TOWER', size: 105, score: 250, growth: 10.0, color: '#8b5cf6', glow: 'rgba(139,92,246,0.8)', symbol: '🏰' },
      CASTLE: { id: 'CASTLE', size: 145, score: 400, growth: 15.0, color: '#ffd700', glow: 'rgba(255,215,0,0.8)', symbol: '🏯' },
    }
  },
  {
    id: 'M8_MALL',
    name: 'Mega Mall',
    themeColor: '#2b1c2b',
    objects: {
      BAG: { id: 'BAG', size: 12, score: 5, growth: 0.8, color: '#9ca3af', glow: 'rgba(156,163,175,0.8)', symbol: '🛍️' },
      PLANT: { id: 'PLANT', size: 16, score: 10, growth: 1.2, color: '#d97706', glow: 'rgba(217,119,6,0.8)', symbol: '🪴' },
      CART: { id: 'CART', size: 24, score: 20, growth: 2.0, color: '#10b981', glow: 'rgba(16,185,129,0.8)', symbol: '🛒', isMoving: true },
      KIOSK: { id: 'KIOSK', size: 36, score: 45, growth: 3.5, color: '#3b82f6', glow: 'rgba(59,130,246,0.8)', symbol: '🏪' },
      ESCALATOR: { id: 'ESCALATOR', size: 55, score: 80, growth: 5.0, color: '#f59e0b', glow: 'rgba(245,158,11,0.8)', symbol: '🪜' },
      FOODCOURT: { id: 'FOODCOURT', size: 75, score: 150, growth: 7.5, color: '#ef4444', glow: 'rgba(239,68,68,0.8)', symbol: '🍕' },
      STORE: { id: 'STORE', size: 105, score: 250, growth: 10.0, color: '#8b5cf6', glow: 'rgba(139,92,246,0.8)', symbol: '🏬' },
      GARAGE: { id: 'GARAGE', size: 145, score: 400, growth: 15.0, color: '#ffd700', glow: 'rgba(255,215,0,0.8)', symbol: '🏢' },
    }
  }
];

const POWERUP_TYPES = {
  MAGNET: { type: 'MAGNET', color: '#ff3300', symbol: '🧲', label: 'GRAVITY OVERLOAD' },
  SPEED: { type: 'SPEED', color: '#33ff33', symbol: '⚡', label: 'WARP BOOST' },
  MULTIPLIER: { type: 'MULTIPLIER', color: '#ffcc00', symbol: '💎', label: 'DARK ENERGY' }
};

const SKINS = [
  { id: 'NEON', name: 'CRT Singularity', desc: 'Default amber event horizon core', cost: 0, primary: '#ffcc00', secondary: '#ff6600' },
  { id: 'PLASMA', name: 'Arcade Flare', desc: 'Fiery red solar loops & pixel sparkles', cost: 100, primary: '#ff3300', secondary: '#ffcc00' },
  { id: 'MATRIX', name: '8-Bit Grid', desc: 'Retro green binary code cascade', cost: 250, primary: '#33ff33', secondary: '#006600' },
  { id: 'COSMIC', name: 'VGA Nebula', desc: 'VGA purple space-dust galaxy core', cost: 500, primary: '#cc00ff', secondary: '#3399ff' },
  { id: 'GLITCH', name: 'Scanline Aberration', desc: 'Glitching scanline aberration border', cost: 1000, primary: '#ffffff', secondary: '#ff0033' }
];

const rand = (min, max) => Math.random() * (max - min) + min;

// --- Helper: Ultra-fast styling engine (Handles Web Direct DOM vs Mobile Native fallback) ---
const setStyle = (ref, styles) => {
  if (!ref) return;
  if (Platform.OS === 'web') {
    // Direct DOM manipulation is extremely fast and completely bypasses setNativeProps exceptions
    const el = ref;
    if (styles.left !== undefined) el.style.left = `${styles.left}px`;
    if (styles.top !== undefined) el.style.top = `${styles.top}px`;
    if (styles.width !== undefined) el.style.width = `${styles.width}px`;
    if (styles.height !== undefined) el.style.height = `${styles.height}px`;
    if (styles.borderRadius !== undefined) el.style.borderRadius = `${styles.borderRadius}px`;
    if (styles.opacity !== undefined) el.style.opacity = styles.opacity;
    if (styles.backgroundColor !== undefined) el.style.backgroundColor = styles.backgroundColor;
    if (styles.transformOrigin !== undefined) el.style.transformOrigin = styles.transformOrigin;
    if (styles.transform !== undefined) {
      let transformStr = '';
      styles.transform.forEach(t => {
        if (t.translateX !== undefined) transformStr += ` translateX(${t.translateX}px)`;
        if (t.translateY !== undefined) transformStr += ` translateY(${t.translateY}px)`;
        if (t.scale !== undefined) transformStr += ` scale(${t.scale})`;
        if (t.rotate !== undefined) transformStr += ` rotate(${t.rotate})`;
      });
      el.style.transform = transformStr.trim();
    }
    if (styles.text !== undefined) el.value = styles.text;
  } else {
    // Native Mobile layout edits
    if (ref.setNativeProps) {
      let finalStyles = { ...styles };
      delete finalStyles.text;
      ref.setNativeProps({ style: finalStyles, text: styles.text });
    }
  }
};

const CityBackground = ({ roadColor }) => {
  const blockSize = 260;
  const roadWidth = 60;
  const cellSize = blockSize + roadWidth;
  const count = Math.ceil(MAP_SIZE / cellSize);
  const blocks = [];
  const lines = [];

  for (let i = 0; i < count; i++) {
    for (let j = 0; j < count; j++) {
      blocks.push(
        <View
          key={`block-${i}-${j}`}
          style={{
            position: 'absolute',
            left: j * cellSize + roadWidth,
            top: i * cellSize + roadWidth,
            width: blockSize,
            height: blockSize,
            backgroundColor: '#1a1a1a',
            borderWidth: 4,
            borderColor: '#333',
            borderRadius: 12,
          }}
        />
      );
    }
    
    if (i > 0) {
      lines.push(
        <View key={`h-${i}`} style={{
          position: 'absolute', left: 0, top: i * cellSize + roadWidth / 2 - 2,
          width: MAP_SIZE, height: 4, borderWidth: 2, borderColor: '#fff', borderStyle: 'dashed', opacity: 0.15
        }} />
      );
      lines.push(
        <View key={`v-${i}`} style={{
          position: 'absolute', left: i * cellSize + roadWidth / 2 - 2, top: 0,
          width: 4, height: MAP_SIZE, borderWidth: 2, borderColor: '#fff', borderStyle: 'dashed', opacity: 0.15
        }} />
      );
    }
  }

  return (
    <View style={{ position: 'absolute', width: MAP_SIZE, height: MAP_SIZE, backgroundColor: roadColor, zIndex: -1 }}>
      {blocks}
      {lines}
    </View>
  );
};

function MainApp() {
  // ----------------------------------------------------
  // Lobby Navigation & Skins Shop States
  // ----------------------------------------------------
  const [screen, setScreen] = useState('start'); // start | game | shop | gameover
  const [gameMode, setGameMode] = useState('classic'); // classic | royale | sandbox
  const [selectedMapId, setSelectedMapId] = useState('M1_DOWNTOWN');
  const [darkMatter, setDarkMatter] = useState(0); // currency
  const [unlockedSkins, setUnlockedSkins] = useState(['NEON']);
  const [equippedSkin, setEquippedSkin] = useState('NEON');
  const [highScores, setHighScores] = useState({ classic: 0, royale: 0, sandbox: 0 });

  // ----------------------------------------------------
  // HUD Display States (Reflected at lower frequency)
  // ----------------------------------------------------
  const [hudScore, setHudScore] = useState(0);
  const [hudLevel, setHudLevel] = useState(0);
  const [hudLevelName, setHudLevelName] = useState(LEVEL_NAMES[0]);
  const [hudRadius, setHudRadius] = useState(INITIAL_PLAYER_RADIUS);
  const [hudNextThreshold, setHudNextThreshold] = useState(LEVEL_THRESHOLDS[1]);
  const [hudTimer, setHudTimer] = useState(GAME_DURATION);
  const [hudLeaderboard, setHudLeaderboard] = useState([]);
  const [hudAliveCount, setHudAliveCount] = useState(BOT_COUNT + 1);
  const [activeMagnet, setActiveMagnet] = useState(0);
  const [activeSpeed, setActiveSpeed] = useState(0);
  const [activeMultiplier, setActiveMultiplier] = useState(0);
  const [endGameStats, setEndGameStats] = useState({ placement: 4, score: 0, level: 0, currencyEarned: 0, eatenBots: 0 });

  // Damage screen flash control
  const [damageFlash, setDamageFlash] = useState(false);

  // ----------------------------------------------------
  // View Ref bindings for high-frequency style shifts
  // ----------------------------------------------------
  const mapRef = useRef(null);
  const playerHoleRef = useRef(null);
  const botRefs = useRef([]);
  const objRefs = useRef([]);
  const powerupRefs = useRef([]);
  const particleRefs = useRef([]);
  const floatingTextsRef = useRef([]);
  const floatingTextNodesRef = useRef([]);
  const vortexRotation = useRef(0);

  // ----------------------------------------------------
  // Gameplay Engine References (60fps requestAnimationFrame)
  // ----------------------------------------------------
  const gameLoopId = useRef(null);
  const timerIntervalId = useRef(null);
  const activeKeys = useRef({}); // Active keyboard keys
  const screenShakeTimer = useRef(0);
  const screenShakeIntensity = useRef(0);

  // Player coordinate ref
  const playerRef = useRef({
    x: MAP_SIZE / 2,
    y: MAP_SIZE / 2,
    radius: INITIAL_PLAYER_RADIUS,
    targetRadius: INITIAL_PLAYER_RADIUS,
    score: 0,
    level: 0,
    isAlive: true,
    respawnTimer: 0,
    eatenBotsCount: 0
  });

  // Competitor bot refs
  const botsRef = useRef([]);

  // Scattered city elements refs
  const objectsRef = useRef([]);

  // Active floating physical particles
  const particlesRef = useRef([]);

  // Power-up modules refs
  const powerupsRef = useRef([]);
  const magnetTimer = useRef(0);
  const speedTimer = useRef(0);
  const multiplierTimer = useRef(0);

  // Camera scroll states
  const cameraRef = useRef({
    x: MAP_SIZE / 2,
    y: MAP_SIZE / 2,
    scale: 1.0,
    targetScale: 1.0,
  });

  // Desktop Mouse Drag / Mobile Touch controls steering vectors
  const isDragging = useRef(false);
  const joystickCenter = useRef({ x: 0, y: 0 });
  const joystickVector = useRef({ dx: 0, dy: 0 });

  // ----------------------------------------------------
  // AsyncStorage High Score & Skin Persistence
  // ----------------------------------------------------
  useEffect(() => {
    const loadSavedData = async () => {
      try {
        const savedDarkMatter = await AsyncStorage.getItem('@vortex:dark_matter');
        if (savedDarkMatter !== null) setDarkMatter(parseInt(savedDarkMatter, 10));

        const savedSkins = await AsyncStorage.getItem('@vortex:unlocked_skins');
        if (savedSkins !== null) setUnlockedSkins(JSON.parse(savedSkins));

        const savedEquipped = await AsyncStorage.getItem('@vortex:equipped_skin');
        if (savedEquipped !== null) setEquippedSkin(savedEquipped);

        const savedHighScores = await AsyncStorage.getItem('@vortex:high_scores');
        if (savedHighScores !== null) setHighScores(JSON.parse(savedHighScores));
      } catch (e) {
        console.log('Error loading AsyncStorage:', e);
      }
    };
    loadSavedData();
  }, []);

  const handlePurchaseSkin = async (skin) => {
    if (darkMatter >= skin.cost) {
      const newUnlocked = [...unlockedSkins, skin.id];
      const newDM = darkMatter - skin.cost;
      setUnlockedSkins(newUnlocked);
      setDarkMatter(newDM);
      setEquippedSkin(skin.id);

      try {
        await AsyncStorage.setItem('@vortex:dark_matter', newDM.toString());
        await AsyncStorage.setItem('@vortex:unlocked_skins', JSON.stringify(newUnlocked));
        await AsyncStorage.setItem('@vortex:equipped_skin', skin.id);
      } catch (e) {}
    }
  };

  const handleEquipSkin = async (skinId) => {
    setEquippedSkin(skinId);
    try {
      await AsyncStorage.setItem('@vortex:equipped_skin', skinId);
    } catch (e) {}
  };

  // ----------------------------------------------------
  // Desktop Web Input Listeners (Keyboard & Mouse Drag)
  // ----------------------------------------------------
  useEffect(() => {
    if (Platform.OS === 'web') {
      const handleKeyDown = (e) => {
        const key = e.key.toLowerCase();
        activeKeys.current[key] = true;
      };
      const handleKeyUp = (e) => {
        const key = e.key.toLowerCase();
        activeKeys.current[key] = false;
      };

      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);

      // Mouse drag controls bound directly to the window (prevents focus loss and cuts on boundaries)
      const handleWindowMouseDown = (e) => {
        if (screen === 'game' && playerRef.current.isAlive) {
          isDragging.current = true;
          joystickCenter.current = { x: e.clientX, y: e.clientY };
          joystickVector.current = { dx: 0, dy: 0 };
        }
      };

      const handleWindowMouseMove = (e) => {
        if (isDragging.current) {
          const dx = e.clientX - joystickCenter.current.x;
          const dy = e.clientY - joystickCenter.current.y;
          const dist = Math.hypot(dx, dy);
          const maxRadius = 90;

          const angle = Math.atan2(dy, dx);
          const capped = Math.min(dist, maxRadius);
          const forceX = Math.cos(angle) * (capped / maxRadius);
          const forceY = Math.sin(angle) * (capped / maxRadius);

          joystickVector.current = { dx: forceX, dy: forceY };
        }
      };

      const handleWindowMouseUp = () => {
        isDragging.current = false;
        joystickVector.current = { dx: 0, dy: 0 };
      };

      // Touch drag controls for mobile browsers/emulators
      const handleWindowTouchStart = (e) => {
        if (screen === 'game' && playerRef.current.isAlive && e.touches && e.touches[0]) {
          isDragging.current = true;
          const touch = e.touches[0];
          joystickCenter.current = { x: touch.clientX, y: touch.clientY };
          joystickVector.current = { dx: 0, dy: 0 };
        }
      };

      const handleWindowTouchMove = (e) => {
        if (isDragging.current && e.touches && e.touches[0]) {
          const touch = e.touches[0];
          const dx = touch.clientX - joystickCenter.current.x;
          const dy = touch.clientY - joystickCenter.current.y;
          const dist = Math.hypot(dx, dy);
          const maxRadius = 90;

          const angle = Math.atan2(dy, dx);
          const capped = Math.min(dist, maxRadius);
          const forceX = Math.cos(angle) * (capped / maxRadius);
          const forceY = Math.sin(angle) * (capped / maxRadius);

          joystickVector.current = { dx: forceX, dy: forceY };
        }
      };

      const handleWindowTouchEnd = () => {
        isDragging.current = false;
        joystickVector.current = { dx: 0, dy: 0 };
      };

      window.addEventListener('mousedown', handleWindowMouseDown);
      window.addEventListener('mousemove', handleWindowMouseMove);
      window.addEventListener('mouseup', handleWindowMouseUp);
      window.addEventListener('touchstart', handleWindowTouchStart, { passive: true });
      window.addEventListener('touchmove', handleWindowTouchMove, { passive: true });
      window.addEventListener('touchend', handleWindowTouchEnd, { passive: true });

      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
        window.removeEventListener('mousedown', handleWindowMouseDown);
        window.removeEventListener('mousemove', handleWindowMouseMove);
        window.removeEventListener('mouseup', handleWindowMouseUp);
        window.removeEventListener('touchstart', handleWindowTouchStart);
        window.removeEventListener('touchmove', handleWindowTouchMove);
        window.removeEventListener('touchend', handleWindowTouchEnd);
      };
    }
  }, [screen]); // Clean and re-register when screen transitions to capture correct context variables

  // ----------------------------------------------------
  // Mobile / Touch PanResponder Joysticks
  // ----------------------------------------------------
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event, gestureState) => {
        if (playerRef.current.isAlive) {
          const touchX = event.nativeEvent.pageX || event.nativeEvent.clientX || event.nativeEvent.locationX;
          const touchY = event.nativeEvent.pageY || event.nativeEvent.clientY || event.nativeEvent.locationY;
          joystickCenter.current = { x: touchX, y: touchY };
          joystickVector.current = { dx: 0, dy: 0 };
        }
      },
      onPanResponderMove: (event, gestureState) => {
        const dx = gestureState.dx;
        const dy = gestureState.dy;
        const dist = Math.hypot(dx, dy);
        const maxRadius = 90; // Increased from 50 to lower sensitivity

        const angle = Math.atan2(dy, dx);
        const capped = Math.min(dist, maxRadius);
        const forceX = Math.cos(angle) * (capped / maxRadius);
        const forceY = Math.sin(angle) * (capped / maxRadius);

        joystickVector.current = { dx: forceX, dy: forceY };
      },
      onPanResponderRelease: () => {
        joystickVector.current = { dx: 0, dy: 0 };
      },
    })
  ).current;

  // ----------------------------------------------------
  // Spawner Coordination Algorithms
  // ----------------------------------------------------
  const getSafeSpawn = (radius) => {
    let x, y;
    do {
      x = rand(radius, MAP_SIZE - radius);
      y = rand(radius, MAP_SIZE - radius);
    } while (Math.hypot(x - MAP_SIZE / 2, y - MAP_SIZE / 2) < 300);
    return { x, y };
  };

  const populateMap = () => {
    const list = [];
    let idCounter = 0;

    const currentMap = MAP_DEFINITIONS.find(m => m.id === selectedMapId) || MAP_DEFINITIONS[0];
    const objects = currentMap.objects;
    const keys = Object.keys(objects);
    
    keys.forEach((key) => {
      const type = objects[key];
      let count = 45; // Default small
      if (type.size > 14) count = 35;
      if (type.size > 20) count = 30;
      if (type.size > 30) count = 20;
      if (type.size > 50) count = 12;
      if (type.size > 70) count = 8;
      if (type.size > 100) count = 5;

      for (let i = 0; i < count; i++) {
        const spawn = getSafeSpawn(type.size);
        list.push({
          id: idCounter++,
          type: type.id,
          x: spawn.x,
          y: spawn.y,
          size: type.size,
          symbol: type.symbol,
          color: type.color,
          glow: type.glow,
          isEaten: false,
          swallowProgress: 0,
          eaterX: 0,
          eaterY: 0,
          vx: type.isMoving ? rand(-1.5, 1.5) : 0,
          vy: type.isMoving ? rand(-1.5, 1.5) : 0,
        });
      }
    });

    objectsRef.current = list;
  };

  const triggerScreenShake = (intensity = 8) => {
    screenShakeTimer.current = 15;
    screenShakeIntensity.current = intensity;
  };

  const triggerRedFlash = () => {
    setDamageFlash(true);
    setTimeout(() => setDamageFlash(false), 300);
  };

  const spawnParticles = (x, y, color, count = 15) => {
    const list = particlesRef.current;
    if (list.length > 45) return; // Cap particles to prevent lag
    for (let i = 0; i < count; i++) {
      const angle = rand(0, Math.PI * 2);
      const speed = rand(3, 8);
      list.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        size: rand(3.5, 8.5),
        alpha: 1.0,
        decay: rand(0.02, 0.045)
      });
    }
  };

  // ----------------------------------------------------
  // Init Game Loops
  // ----------------------------------------------------
  const startGame = (mode) => {
    setGameMode(mode);
    setScreen('game');

    // Reset Player coordinates
    playerRef.current = {
      x: MAP_SIZE / 2,
      y: MAP_SIZE / 2,
      radius: INITIAL_PLAYER_RADIUS,
      targetRadius: INITIAL_PLAYER_RADIUS,
      score: 0,
      level: 0,
      isAlive: true,
      respawnTimer: 0,
      eatenBotsCount: 0
    };

    // Reset Competitors coordinates
    const botNames = ["AlphaVoid", "PixelSuck", "GigaSuck"];
    const botColors = ["#bf00ff", "#00ffff", "#ffea00"];
    botsRef.current = Array.from({ length: BOT_COUNT }).map((_, i) => ({
      id: i,
      name: botNames[i],
      color: botColors[i],
      x: rand(200, MAP_SIZE - 200),
      y: rand(200, MAP_SIZE - 200),
      radius: INITIAL_PLAYER_RADIUS,
      targetRadius: INITIAL_PLAYER_RADIUS,
      score: 0,
      level: 0,
      isAlive: true,
      respawnTimer: 0,
      targetTimer: 0,
      vx: 0,
      vy: 0
    }));

        particlesRef.current = [];
        floatingTextsRef.current = [];
    screenShakeTimer.current = 0;
    vortexRotation.current = 0;

    populateMap();

    // Camera initial state
    cameraRef.current = {
      x: MAP_SIZE / 2,
      y: MAP_SIZE / 2,
      scale: 1.0,
      targetScale: 1.0,
    };

    setHudScore(0);
    setHudLevel(0);
    setHudLevelName(LEVEL_NAMES[0]);
    setHudRadius(INITIAL_PLAYER_RADIUS);
    setHudNextThreshold(LEVEL_THRESHOLDS[1]);
    setHudTimer(mode === 'sandbox' ? 0 : GAME_DURATION);
    setHudAliveCount(BOT_COUNT + 1);
    setActiveMagnet(0);
    setActiveSpeed(0);
    setActiveMultiplier(0);

    // Setup clocks
    if (mode !== 'sandbox') {
      let timeLeft = GAME_DURATION;
      timerIntervalId.current = setInterval(() => {
        timeLeft--;
        setHudTimer(timeLeft);

        if (magnetTimer.current > 0) {
          magnetTimer.current = Math.max(0, magnetTimer.current - 1);
          setActiveMagnet(magnetTimer.current);
        }
        if (speedTimer.current > 0) {
          speedTimer.current = Math.max(0, speedTimer.current - 1);
          setActiveSpeed(speedTimer.current);
        }
        if (multiplierTimer.current > 0) {
          multiplierTimer.current = Math.max(0, multiplierTimer.current - 1);
          setActiveMultiplier(multiplierTimer.current);
        }

        // Powerup spawner
        if (timeLeft % 10 === 0 && powerupsRef.current.length < 3) {
          const powerKeys = Object.keys(POWERUP_TYPES);
          const rType = POWERUP_TYPES[powerKeys[Math.floor(rand(0, powerKeys.length))]];
          powerupsRef.current.push({
            type: rType.type,
            x: rand(200, MAP_SIZE - 200),
            y: rand(200, MAP_SIZE - 200),
            color: rType.color,
            symbol: rType.symbol,
            label: rType.label,
            isEaten: false
          });
        }

        if (timeLeft <= 0) {
          endRound();
        }
      }, 1000);
    }

    if (gameLoopId.current) cancelAnimationFrame(gameLoopId.current);
    gameLoopId.current = requestAnimationFrame(gameEngineTick);
  };

  const endRound = async () => {
    if (gameLoopId.current) cancelAnimationFrame(gameLoopId.current);
    if (timerIntervalId.current) clearInterval(timerIntervalId.current);

    const score = playerRef.current.score;
    const level = playerRef.current.level;
    const eatenBots = playerRef.current.eatenBotsCount;

    const leader = [
      { name: "You", score, isPlayer: true },
      ...botsRef.current.map((bot) => ({ name: bot.name, score: bot.score, isPlayer: false }))
    ].sort((a, b) => b.score - a.score);

    const placement = leader.findIndex((item) => item.isPlayer) + 1;

    const reward = Math.floor(score / 9) + (5 - placement) * 22;
    const finalDM = darkMatter + reward;
    setDarkMatter(finalDM);

    setEndGameStats({
      placement,
      score,
      level,
      currencyEarned: reward,
      eatenBots
    });

    setScreen('gameover');

    const newHighs = { ...highScores };
    if (score > highScores[gameMode]) {
      newHighs[gameMode] = score;
      setHighScores(newHighs);
    }

    try {
      await AsyncStorage.setItem('@vortex:dark_matter', finalDM.toString());
      await AsyncStorage.setItem('@vortex:high_scores', JSON.stringify(newHighs));
    } catch (e) {}
  };

  // ----------------------------------------------------
  // Dynamic Game Engine Physics Loop & setNativeProps Shifts
  // ----------------------------------------------------
  const gameEngineTick = () => {
    // 1. Resolve Movements
    let dx = 0;
    let dy = 0;

    if (Platform.OS === 'web') {
      if (activeKeys.current['w'] || activeKeys.current['arrowup']) dy = -1;
      if (activeKeys.current['s'] || activeKeys.current['arrowdown']) dy = 1;
      if (activeKeys.current['a'] || activeKeys.current['arrowleft']) dx = -1;
      if (activeKeys.current['d'] || activeKeys.current['arrowright']) dx = 1;
    }

    // Joystick overrides
    if (joystickVector.current.dx !== 0 || joystickVector.current.dy !== 0) {
      dx = joystickVector.current.dx;
      dy = joystickVector.current.dy;
    }

    const player = playerRef.current;
    if (player.isAlive) {
      let speed = getBaseSpeed(player.radius);
      if (speedTimer.current > 0) speed *= 1.6;

      if (dx !== 0 && dy !== 0) {
        const length = Math.hypot(dx, dy);
        dx /= length;
        dy /= length;
      }

      player.x += dx * speed;
      player.y += dy * speed;

      player.x = Math.max(player.radius, Math.min(MAP_SIZE - player.radius, player.x));
      player.y = Math.max(player.radius, Math.min(MAP_SIZE - player.radius, player.y));
    } else {
      player.respawnTimer -= 16.6;
      if (player.respawnTimer <= 0) {
        const safe = getSafeSpawn(player.radius);
        player.x = safe.x;
        player.y = safe.y;
        player.isAlive = true;
        player.radius = INITIAL_PLAYER_RADIUS;
        player.targetRadius = INITIAL_PLAYER_RADIUS;
        player.level = 0;
      }
    }

    // 2. AI Competitors Steer Math
    const bots = botsRef.current;
    bots.forEach((bot) => {
      if (!bot.isAlive) {
        bot.respawnTimer -= 16.6;
        if (bot.respawnTimer <= 0) {
          const safe = getSafeSpawn(bot.radius);
          bot.x = safe.x;
          bot.y = safe.y;
          bot.isAlive = true;
          bot.radius = INITIAL_PLAYER_RADIUS;
          bot.targetRadius = INITIAL_PLAYER_RADIUS;
          bot.score = Math.floor(bot.score * 0.45);
          bot.level = 0;
        }
        return;
      }

      if (bot.radius < bot.targetRadius) {
        bot.radius = Math.min(bot.targetRadius, bot.radius + 0.35);
      }

      let speed = getBaseSpeed(bot.radius) * 0.96;
      bot.targetTimer -= 16.6;

      let targetX = MAP_SIZE / 2;
      let targetY = MAP_SIZE / 2;
      let scanTarget = false;

      // React to player coordinates
      const distToPlayer = Math.hypot(player.x - bot.x, player.y - bot.y);
      if (player.isAlive && distToPlayer < 350) {
        if (bot.radius > player.radius + 10) {
          targetX = player.x;
          targetY = player.y;
          scanTarget = true;
        } else if (player.radius > bot.radius + 10) {
          const angle = Math.atan2(bot.y - player.y, bot.x - player.x);
          targetX = bot.x + Math.cos(angle) * 220;
          targetY = bot.y + Math.sin(angle) * 220;
          scanTarget = true;
        }
      }

      if (!scanTarget) {
        let bestObj = null;
        let minDist = 450;

        objectsRef.current.forEach((obj) => {
          if (obj.isEaten) return;
          const currentMap = MAP_DEFINITIONS.find(m => m.id === selectedMapId) || MAP_DEFINITIONS[0];
          const type = currentMap.objects[obj.type];
          if (bot.radius < type.size + 3) return;

          const distance = Math.hypot(obj.x - bot.x, obj.y - bot.y);
          if (distance < minDist) {
            minDist = distance;
            bestObj = obj;
          }
        });

        if (bestObj) {
          targetX = bestObj.x;
          targetY = bestObj.y;
          scanTarget = true;
        }
      }

      if (scanTarget) {
        const angle = Math.atan2(targetY - bot.y, targetX - bot.x);
        bot.vx += (Math.cos(angle) * speed - bot.vx) * 0.12;
        bot.vy += (Math.sin(angle) * speed - bot.vy) * 0.12;
      } else {
        if (bot.targetTimer <= 0) {
          const randomAngle = rand(0, Math.PI * 2);
          bot.vx = Math.cos(randomAngle) * speed;
          bot.vy = Math.sin(randomAngle) * speed;
          bot.targetTimer = rand(800, 2500);
        }
      }

      bot.x += bot.vx;
      bot.y += bot.vy;

      bot.x = Math.max(bot.radius, Math.min(MAP_SIZE - bot.radius, bot.x));
      bot.y = Math.max(bot.radius, Math.min(MAP_SIZE - bot.radius, bot.y));
    });

    // 3. Spaghettification & Collisions
    const objects = objectsRef.current;
    objects.forEach((obj) => {
      if (!obj.isEaten && (obj.vx !== 0 || obj.vy !== 0)) {
        obj.x += obj.vx;
        obj.y += obj.vy;
        if (obj.x < 60 || obj.x > MAP_SIZE - 60) obj.vx *= -1;
        if (obj.y < 60 || obj.y > MAP_SIZE - 60) obj.vy *= -1;
      }

      // Handle LERP swallow gravity slides
      if (obj.isEaten && obj.swallowProgress < 1.0) {
        obj.swallowProgress += 0.12;
        if (obj.swallowProgress >= 1.0) {
          const safe = getSafeSpawn(obj.size);
          obj.x = safe.x;
          obj.y = safe.y;
          obj.isEaten = false;
          obj.swallowProgress = 0;
          obj._justRespawned = true;
        }
        return;
      }

      // Player Collisions
      if (player.isAlive) {
        const dx = obj.x - player.x;
        const dy = obj.y - player.y;
        const dist = Math.hypot(dx, dy);

        let pull = player.radius * 1.5;
        if (magnetTimer.current > 0) pull *= 2.0;

        if (dist < pull) {
          const currentMap = MAP_DEFINITIONS.find(m => m.id === selectedMapId) || MAP_DEFINITIONS[0];
          const type = currentMap.objects[obj.type];
          if (player.radius > type.size + 3) {
            // Apply LERP attraction gravity
            const force = Math.max(0.1, 1 - (dist / pull)) * 7;
            const angle = Math.atan2(player.y - obj.y, player.x - obj.x);
            obj.x += Math.cos(angle) * force;
            obj.y += Math.sin(angle) * force;

            if (dist < player.radius * 0.96) {
              obj.isEaten = true;
              obj.swallowProgress = 0.05;
              obj.eaterX = player.x;
              obj.eaterY = player.y;

              spawnParticles(obj.x, obj.y, type.color, 12);
              
              floatingTextsRef.current.push({
                x: obj.x,
                y: obj.y - 15,
                text: `+${type.score * (multiplierTimer.current > 0 ? 2 : 1)}`,
                alpha: 1.0,
                vy: -1.2,
                color: type.color
              });

              let rewardPoints = type.score;
              if (multiplierTimer.current > 0) rewardPoints *= 2;

              player.score += rewardPoints;
              player.targetRadius = Math.min(MAX_HOLE_RADIUS, player.targetRadius + type.growth);

              let oldLevel = player.level;
              for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
                if (player.score >= LEVEL_THRESHOLDS[i]) {
                  player.level = i;
                  break;
                }
              }

              if (player.level > oldLevel) {
                triggerScreenShake(14);
                try { Vibration.vibrate(50); } catch (e) {}
              }

              setHudScore(player.score);
              setHudRadius(Math.floor(player.radius));
              setHudLevel(player.level);
              setHudLevelName(LEVEL_NAMES[player.level]);
              setHudNextThreshold(LEVEL_THRESHOLDS[player.level + 1] || LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1]);
            }
          }
        }
      }

      // Bots Collisions
      bots.forEach((bot) => {
        if (!bot.isAlive || obj.isEaten) return;
        const dx = obj.x - bot.x;
        const dy = obj.y - bot.y;
        const dist = Math.hypot(dx, dy);

        if (dist < bot.radius) {
          const currentMap = MAP_DEFINITIONS.find(m => m.id === selectedMapId) || MAP_DEFINITIONS[0];
          const type = currentMap.objects[obj.type];
          if (bot.radius > type.size + 3) {
            obj.isEaten = true;
            obj.swallowProgress = 0.05;
            obj.eaterX = bot.x;
            obj.eaterY = bot.y;
            bot.score += type.score;
            bot.targetRadius = Math.min(MAX_HOLE_RADIUS, bot.targetRadius + type.growth);

            for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
              if (bot.score >= LEVEL_THRESHOLDS[i]) {
                bot.level = i;
                break;
              }
            }
          }
        }
      });
    });

    // 4. Powerup modules triggers
    const powerups = powerupsRef.current;
    powerups.forEach((pw) => {
      if (pw.isEaten) return;
      if (player.isAlive) {
        const d = Math.hypot(pw.x - player.x, pw.y - player.y);
        if (d < player.radius) {
          pw.isEaten = true;
          spawnParticles(pw.x, pw.y, pw.color, 24);
          triggerScreenShake(10);

          if (pw.type === 'MAGNET') {
            magnetTimer.current = 15;
            setActiveMagnet(15);
          } else if (pw.type === 'SPEED') {
            speedTimer.current = 15;
            setActiveSpeed(15);
          } else if (pw.type === 'MULTIPLIER') {
            multiplierTimer.current = 15;
            setActiveMultiplier(15);
          }
        }
      }

      bots.forEach((bot) => {
        if (!bot.isAlive || pw.isEaten) return;
        const d = Math.hypot(pw.x - bot.x, pw.y - bot.y);
        if (d < bot.radius) {
          pw.isEaten = true;
          spawnParticles(pw.x, pw.y, pw.color, 12);
        }
      });
    });

    // 5. Bot vs Player collisions
    if (player.isAlive) {
      bots.forEach((bot) => {
        if (!bot.isAlive) return;

        const dx = bot.x - player.x;
        const dy = bot.y - player.y;
        const dist = Math.hypot(dx, dy);

        if (dist < Math.max(player.radius, bot.radius)) {
          if (player.radius > bot.radius + 8) {
            bot.isAlive = false;
            bot.respawnTimer = 6000;
            player.eatenBotsCount++;
            player.score += 450;
            player.targetRadius = Math.min(MAX_HOLE_RADIUS, player.targetRadius + 22);
            spawnParticles(bot.x, bot.y, bot.color, 20);
            triggerScreenShake(22);
            try { Vibration.vibrate(60); } catch (e) {}
          } else if (bot.radius > player.radius + 8) {
            player.isAlive = false;
            player.respawnTimer = 3500;
            bot.score += 450;
            bot.targetRadius = Math.min(MAX_HOLE_RADIUS, bot.targetRadius + 22);
            spawnParticles(player.x, player.y, '#00f0ff', 20);
            triggerScreenShake(26);
            triggerRedFlash();
            try { Vibration.vibrate(80); } catch (e) {}
          }
        }
      });
    }

    // Bot vs Bot Devour
    for (let i = 0; i < bots.length; i++) {
      for (let j = 0; j < bots.length; j++) {
        if (i === j) continue;
        const b1 = bots[i];
        const b2 = bots[j];
        if (!b1.isAlive || !b2.isAlive) continue;

        const d = Math.hypot(b2.x - b1.x, b2.y - b1.y);
        if (d < Math.max(b1.radius, b2.radius)) {
          if (b1.radius > b2.radius + 8) {
            b2.isAlive = false;
            b2.respawnTimer = 6000;
            b1.score += 450;
            b1.targetRadius = Math.min(MAX_HOLE_RADIUS, b1.targetRadius + 22);
            spawnParticles(b2.x, b2.y, b2.color, 15);
          }
        }
      }
    }

    // 6. Visual size growth steps
    if (player.radius < player.targetRadius) {
      player.radius = Math.min(player.targetRadius, player.radius + 0.38);
    }

    // 7. Physical particle drift updating
    const particles = particlesRef.current;
    particlesRef.current = particles.filter((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.95;
      p.vy *= 0.95;
      p.alpha -= p.decay;
      return p.alpha > 0.05;
    });

    // Update floating texts
    const fTexts = floatingTextsRef.current;
    floatingTextsRef.current = fTexts.filter((ft) => {
      ft.y += ft.vy;
      ft.alpha -= 0.025;
      return ft.alpha > 0.05;
    });

    vortexRotation.current += 3.5;

    // 8. Update Camera position matrix
    const camera = cameraRef.current;
    if (player.isAlive) {
      camera.x += (player.x - camera.x) * 0.12;
      camera.y += (player.y - camera.y) * 0.12;
    }
    // Dynamic zoom out: allow more zoom out on mobile screens (width < 500)
    const minScale = SCREEN_WIDTH < 500 ? 0.25 : 0.35;
    const targetScale = Math.max(minScale, 1.0 - (player.radius / 240) * 0.65);
    camera.scale += (targetScale - camera.scale) * 0.04;

    // 9. Sync high frequency scores HUD rows
    if (rand(0, 1) < 0.12) {
      const leader = [
        { name: "You", score: player.score, radius: player.radius, isPlayer: true },
        ...bots.map((b) => ({ name: b.name, score: b.score, radius: b.radius, isPlayer: false }))
      ].sort((a, b) => b.score - a.score);
      setHudLeaderboard(leader);

      const aliveCount = (player.isAlive ? 1 : 0) + bots.filter(b => b.isAlive).length;
      setHudAliveCount(aliveCount);
    }

    // 10. High-Performance Direct Styles Updates using setNativeProps
    const scrollX = SCREEN_WIDTH / 2 - camera.x * camera.scale;
    const scrollY = SCREEN_HEIGHT / 2 - camera.y * camera.scale;

    // Apply screen shakes displacement
    let shakeX = 0;
    let shakeY = 0;
    if (screenShakeTimer.current > 0) {
      screenShakeTimer.current--;
      shakeX = rand(-screenShakeIntensity.current, screenShakeIntensity.current);
      shakeY = rand(-screenShakeIntensity.current, screenShakeIntensity.current);
    }

    // A. Move Map viewport wrapper
    if (mapRef.current) {
      setStyle(mapRef.current, {
        transformOrigin: '0 0',
        transform: [
          { translateX: scrollX + shakeX },
          { translateY: scrollY + shakeY },
          { scale: camera.scale },
        ],
      });
    }

    // B. Move Player Singularity
    if (playerHoleRef.current) {
      setStyle(playerHoleRef.current, {
        left: player.x - player.radius,
        top: player.y - player.radius,
        width: player.radius * 2,
        height: player.radius * 2,
        borderRadius: player.radius,
        opacity: player.isAlive ? 1 : 0,
        transform: [{ rotate: `${vortexRotation.current}deg` }, { scale: 1.0 + Math.sin(vortexRotation.current * 0.05) * 0.06 }],
      });
    }

    // C. Move AI Competitors
    bots.forEach((bot) => {
      const ref = botRefs.current[bot.id];
      if (ref) {
        setStyle(ref, {
          left: bot.x - bot.radius,
          top: bot.y - bot.radius,
          width: bot.radius * 2,
          height: bot.radius * 2,
          borderRadius: bot.radius,
          opacity: bot.isAlive ? 1 : 0,
        });
      }
    });

    // D. Move City structures (LERP swallow spaghettification shifts)
    objects.forEach((obj) => {
      // MASSIVE OPTIMIZATION: Only update React Native bridge if the object is moving or eaten
      const isMoving = obj.vx !== 0 || obj.vy !== 0;
      if (!obj.isEaten && !isMoving && !obj._justRespawned) return;
      obj._justRespawned = false;

      const ref = objRefs.current[obj.id];
      if (ref) {
        let size = obj.size;
        let posX = obj.x;
        let posY = obj.y;
        let scale = 1.0;
        let opacity = 1.0;

        if (obj.isEaten) {
          posX = obj.x + (obj.eaterX - obj.x) * obj.swallowProgress;
          posY = obj.y + (obj.eaterY - obj.y) * obj.swallowProgress;
          scale = Math.max(0, 1 - obj.swallowProgress);
          opacity = Math.max(0, 1 - obj.swallowProgress);
        }

        setStyle(ref, {
          left: posX - size,
          top: posY - size,
          width: size * 2,
          height: size * 2,
          transform: [{ scale }],
          opacity,
        });
      }
    });

    // E. Move powerups modules
    powerups.forEach((pw, i) => {
      // Only update opacity if eaten to save bridge calls
      if (pw._lastOpacity === undefined) pw._lastOpacity = 1;
      const targetOpacity = pw.isEaten ? 0 : 1;
      if (pw._lastOpacity !== targetOpacity) {
        pw._lastOpacity = targetOpacity;
        const ref = powerupRefs.current[i];
        if (ref) {
          setStyle(ref, { opacity: targetOpacity });
        }
      }
    });

    // F. Move active physical particles
    const activeParticles = particlesRef.current;
    for (let i = 0; i < 60; i++) {
      const ref = particleRefs.current[i];
      if (ref) {
        const p = activeParticles[i];
        if (p && p.alpha > 0.05) {
          setStyle(ref, {
            left: p.x - p.size / 2,
            top: p.y - p.size / 2,
            width: p.size,
            height: p.size,
            borderRadius: p.size / 2,
            backgroundColor: p.color,
            opacity: p.alpha,
          });
        } else {
          setStyle(ref, { opacity: 0 });
        }
      }
    }

    // G. Move floating texts
    const activeFloatingTexts = floatingTextsRef.current;
    for (let i = 0; i < 15; i++) {
      const ref = floatingTextNodesRef.current[i];
      if (ref) {
        const ft = activeFloatingTexts[i];
        if (ft && ft.alpha > 0.05) {
          setStyle(ref, {
            left: ft.x - 15,
            top: ft.y - 10,
            opacity: ft.alpha,
            text: ft.text,
            color: ft.color,
          });
        } else {
          setStyle(ref, { opacity: 0 });
        }
      }
    }

    gameLoopId.current = requestAnimationFrame(gameEngineTick);
  };

  // ----------------------------------------------------
  // Skin colors evaluator for lobby drawings
  // ----------------------------------------------------
  const activeSkinObj = SKINS.find((s) => s.id === equippedSkin) || SKINS[0];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#030712" />

      {/* ------------------- STARTUP SCREEN ------------------- */}
      {screen === 'start' && (
        <View style={styles.startScreen}>
          <Text style={styles.startTitle} adjustsFontSizeToFit numberOfLines={1}>CYBER<Text style={{ color: '#ff3300' }}>VORTEX</Text>.IO</Text>
          <Text style={styles.startSubtitle}>Neon Singularity Swallowing Abyss</Text>

          <View style={styles.darkMatterHeader}>
            <Text style={styles.darkMatterText}>💎 {darkMatter} DARK MATTER</Text>
          </View>

          {/* Skins horizontal scroll shop slider */}
          <Text style={styles.shopSectionTitle}>SELECT YOUR SINGULARITY SKIN</Text>
          <View style={{ height: 210, width: '100%' }}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.skinsSlider}
            >
              {SKINS.map((skin) => {
                const isUnlocked = unlockedSkins.includes(skin.id);
                const isEquipped = equippedSkin === skin.id;

                return (
                  <View key={skin.id} style={[styles.skinCard, isEquipped && styles.skinCardActive]}>
                    <View style={[styles.skinCircle, { backgroundColor: '#000', borderColor: skin.primary }]}>
                      <View style={[styles.skinInnerGlow, { backgroundColor: skin.secondary, opacity: 0.55 }]} />
                    </View>
                    <Text style={styles.skinCardName}>{skin.name}</Text>
                    <Text style={styles.skinCardDesc}>{skin.desc}</Text>

                    {isEquipped ? (
                      <Text style={styles.skinCardEquipped}>EQUIPPED</Text>
                    ) : isUnlocked ? (
                      <TouchableOpacity
                        style={styles.skinCardBtn}
                        onPress={() => handleEquipSkin(skin.id)}
                      >
                        <Text style={styles.skinCardBtnText}>EQUIP</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={[styles.skinCardBtn, darkMatter < skin.cost && styles.skinCardBtnDisabled]}
                        onPress={() => handlePurchaseSkin(skin)}
                        disabled={darkMatter < skin.cost}
                      >
                        <Text style={styles.skinCardBtnText}>💎 {skin.cost}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </View>

          {/* Map Selection horizontal scroll */}
          <Text style={styles.shopSectionTitle}>SELECT YOUR ARENA</Text>
          <View style={{ height: 150, marginBottom: 16, width: '100%' }}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.skinsSlider}
            >
              {MAP_DEFINITIONS.map((mapInfo) => {
                const isSelected = selectedMapId === mapInfo.id;
                return (
                  <TouchableOpacity
                    key={mapInfo.id}
                    style={[styles.mapCard, isSelected && styles.skinCardActive, { borderColor: isSelected ? '#00f0ff' : '#1f2937' }]}
                    onPress={() => setSelectedMapId(mapInfo.id)}
                  >
                    <View style={[styles.mapPreviewThumb, { backgroundColor: mapInfo.themeColor }]} />
                    <Text style={styles.skinCardName}>{mapInfo.name}</Text>
                    {isSelected && <Text style={styles.skinCardEquipped}>SELECTED</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Play modes grid */}
          <View style={styles.modesContainer}>
            <TouchableOpacity style={styles.modeBtn} onPress={() => startGame('classic')}>
              <Text style={styles.modeBtnTitle}>⚡ CLASSIC RUN</Text>
              <Text style={styles.modeBtnDesc}>2 Minutes dynamic score race against bots</Text>
              <Text style={styles.modeHighScore}>BEST: {highScores.classic} pts</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modeBtn} onPress={() => startGame('royale')}>
              <Text style={styles.modeBtnTitle}>💥 BATTLE ROYALE</Text>
              <Text style={styles.modeBtnDesc}>Outlast competitors in shrinking boundaries</Text>
              <Text style={styles.modeHighScore}>BEST: {highScores.royale} pts</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modeBtn} onPress={() => startGame('sandbox')}>
              <Text style={styles.modeBtnTitle}>🌌 INFINITE SANDBOX</Text>
              <Text style={styles.modeBtnDesc}>Stress-free cosmic void. Grow infinitely.</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ------------------- GAMEPLAY ARENA SCREEN ------------------- */}
      {screen === 'game' && (
        <View 
          style={styles.gameContainer} 
          {...(Platform.OS !== 'web' ? panResponder.panHandlers : {})}
        >
          
          {/* Universal View-based scrollable map wrapper */}
          <View
            ref={mapRef}
            style={[
              styles.worldMap,
              { backgroundColor: MAP_DEFINITIONS.find(m => m.id === selectedMapId)?.themeColor || '#2a2a2a' }
            ]}
          >
            
            {/* New City Blocks Background */}
            <CityBackground roadColor={MAP_DEFINITIONS.find(m => m.id === selectedMapId)?.themeColor || '#2a2a2a'} />

            {/* Glowing Powerups */}
            {powerupsRef.current.map((pw, i) => (
              <View
                key={i}
                ref={(el) => (powerupRefs.current[i] = el)}
                style={[
                  styles.powerupItem,
                  {
                    left: pw.x - 16,
                    top: pw.y - 16,
                    borderColor: pw.color,
                    shadowColor: pw.color,
                  },
                ]}
              >
                <Text style={styles.powerupSymbol}>{pw.symbol}</Text>
                <Text style={styles.powerupLabel}>{pw.label}</Text>
              </View>
            ))}

            {/* Scattered city elements */}
            {objectsRef.current.map((obj) => (
              <View
                key={obj.id}
                ref={(el) => (objRefs.current[obj.id] = el)}
                style={[
                  styles.cityObject,
                  {
                    left: obj.x - obj.size,
                    top: obj.y - obj.size,
                    width: obj.size * 2,
                    height: obj.size * 2,
                    borderColor: obj.color,
                    shadowColor: obj.glow,
                  },
                ]}
              >
                <Text style={{ fontSize: obj.size * 1.25 }}>{obj.symbol}</Text>
              </View>
            ))}

            {/* Competitor AI holes */}
            {botsRef.current.map((bot) => (
              <View
                key={bot.id}
                ref={(el) => (botRefs.current[bot.id] = el)}
                style={[
                  styles.botHole,
                  {
                    left: bot.x - bot.radius,
                    top: bot.y - bot.radius,
                    width: bot.radius * 2,
                    height: bot.radius * 2,
                    borderColor: bot.color,
                    shadowColor: bot.color,
                  },
                ]}
              >
                <View style={styles.botHoleEventHorizon} />
                <View style={styles.botTag}>
                  <Text style={styles.botTagText}>{bot.name}</Text>
                </View>
              </View>
            ))}

            {/* Player black hole singularity */}
            <View
              ref={playerHoleRef}
              style={[
                styles.playerHole,
                {
                  left: playerRef.current.x - playerRef.current.radius,
                  top: playerRef.current.y - playerRef.current.radius,
                  width: playerRef.current.radius * 2,
                  height: playerRef.current.radius * 2,
                  borderColor: activeSkinObj.primary,
                  shadowColor: activeSkinObj.secondary,
                },
              ]}
            >
              <View style={[styles.playerAccretionDisk, { borderColor: activeSkinObj.secondary }]} />
              <View style={styles.playerSingularityCore} />
            </View>

            {/* Pre-allocated active physical particles views */}
            {Array.from({ length: 60 }).map((_, i) => (
              <View
                key={i}
                ref={(el) => (particleRefs.current[i] = el)}
                style={[styles.particleNode, { left: 0, top: 0, opacity: 0 }]}
              />
            ))}

            {/* Pre-allocated active floating text views */}
            {Array.from({ length: 15 }).map((_, i) => (
              <TextInput
                key={`ft_${i}`}
                ref={(el) => (floatingTextNodesRef.current[i] = el)}
                editable={false}
                style={[styles.floatingTextNode, { opacity: 0 }]}
              />
            ))}
          </View>

          {/* Glowing Red Flash Damage Overlay */}
          {damageFlash && <View style={styles.redFlashOverlay} pointerEvents="none" />}



          {/* Minimalist Top-Left HUD */}
          <View style={[styles.topLeftHUD, { pointerEvents: 'none' }]}>
            <View style={styles.pillBox}>
              <Text style={styles.pillTextBig}>
                {gameMode === 'sandbox'
                  ? '∞'
                  : `${Math.floor(hudTimer / 60)}:${(hudTimer % 60).toString().padStart(2, '0')}`}
              </Text>
            </View>
            <View style={styles.pillBox}>
              <Text style={styles.pillTextSmall}>💀 {hudScore}</Text>
            </View>
          </View>

          {/* Minimalist Top-Right Leaderboard */}
          <View style={[styles.topRightHUD, { pointerEvents: 'none' }]}>
            {hudLeaderboard.map((item, index) => {
              let color = '#ffffff';
              if (index === 0) color = '#39ff14'; // Bright Green
              else if (index === 1) color = '#bf00ff'; // Bright Purple
              
              return (
                <View key={index} style={[styles.pillBoxRight, item.isPlayer && styles.pillBoxPlayer]}>
                  <Text style={[styles.pillTextLeaderboard, { color }]}>
                    {index + 1} - {item.score} - {item.name}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Powerup Timer Bars overlay */}
          <View style={styles.powerupTimersBox}>
            {activeMagnet > 0 && (
              <View style={styles.timerRow}>
                <Text style={styles.timerSymbol}>🧲</Text>
                <View style={styles.timerProgressBg}>
                  <View style={[styles.timerProgressFill, { width: `${(activeMagnet / 15) * 100}%`, backgroundColor: '#ff007f' }]} />
                </View>
                <Text style={styles.timerDuration}>{activeMagnet}s</Text>
              </View>
            )}

            {activeSpeed > 0 && (
              <View style={styles.timerRow}>
                <Text style={styles.timerSymbol}>⚡</Text>
                <View style={styles.timerProgressBg}>
                  <View style={[styles.timerProgressFill, { width: `${(activeSpeed / 15) * 100}%`, backgroundColor: '#00f0ff' }]} />
                </View>
                <Text style={styles.timerDuration}>{activeSpeed}s</Text>
              </View>
            )}

            {activeMultiplier > 0 && (
              <View style={styles.timerRow}>
                <Text style={styles.timerSymbol}>💎</Text>
                <View style={styles.timerProgressBg}>
                  <View style={[styles.timerProgressFill, { width: `${(activeMultiplier / 15) * 100}%`, backgroundColor: '#ffd700' }]} />
                </View>
                <Text style={styles.timerDuration}>{activeMultiplier}s</Text>
              </View>
            )}
          </View>

          {/* Sandbox Exit buttons */}
          {gameMode === 'sandbox' && (
            <TouchableOpacity style={styles.exitSandboxBtn} onPress={endRound}>
              <Text style={styles.exitSandboxText}>EXIT LOBBY</Text>
            </TouchableOpacity>
          )}

          {/* Control hints overlay */}
          {Platform.OS === 'web' && (
            <View style={styles.keyboardTipBox}>
              <Text style={styles.keyboardTipText}>⌨️ Use WASD / Arrows or mouse dragging to steer the vortex!</Text>
            </View>
          )}
        </View>
      )}

      {/* ------------------- SCORE SUMMARY SCREEN ------------------- */}
      {screen === 'gameover' && (
        <View style={styles.gameOverScreen}>
          <Text style={styles.gameOverTitle}>ROUND FINISHED</Text>

          <View style={styles.celebrationBox}>
            <Text style={styles.placementMedal}>
              {endGameStats.placement === 1
                ? '🏆 1ST PLACE'
                : endGameStats.placement === 2
                ? '🥈 2ND PLACE'
                : endGameStats.placement === 3
                ? '🥉 3RD PLACE'
                : '🎖️ 4TH PLACE'}
            </Text>
            <Text style={styles.celebrationDesc}>
              {endGameStats.placement === 1
                ? 'Absolute Dominator! Cyber city has been devoured!'
                : 'Stellar work! But Singularity core requires more dark matter.'}
            </Text>
          </View>

          <View style={styles.statsCard}>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>FINAL SCORE</Text>
              <Text style={styles.statValue}>{endGameStats.score} pts</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>MAX LEVEL REACHED</Text>
              <Text style={styles.statValue}>LV.{endGameStats.level + 1}</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>BOTS DEVOUR COUNT</Text>
              <Text style={styles.statValue}>{endGameStats.eatenBots}</Text>
            </View>
            <View style={[styles.statRow, { borderBottomWidth: 0, marginTop: 8 }]}>
              <Text style={styles.statLabel}>DARK MATTER REWARD</Text>
              <Text style={[styles.statValue, { color: '#ffd700' }]}>+💎 {endGameStats.currencyEarned}</Text>
            </View>
          </View>

          <View style={styles.gameOverControls}>
            <TouchableOpacity style={styles.gameOverPlayAgain} onPress={() => startGame(gameMode)}>
              <Text style={styles.gameOverPlayAgainText}>PLAY AGAIN</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.gameOverExit} onPress={() => setScreen('start')}>
              <Text style={styles.gameOverExitText}>EXIT TO LOBBY</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('Crash caught by ErrorBoundary:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#990000', padding: 30, justifyContent: 'center' }}>
          <Text style={{ fontSize: 24, color: 'white', fontWeight: 'bold', marginBottom: 20 }}>APP CRASHED!</Text>
          <Text style={{ fontSize: 16, color: 'white', marginBottom: 10, fontFamily: 'monospace' }}>
            {this.state.error && this.state.error.toString()}
          </Text>
          <ScrollView style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', padding: 10 }}>
            <Text style={{ color: '#ffaaaa', fontFamily: 'monospace' }}>
              {this.state.errorInfo && this.state.errorInfo.componentStack}
            </Text>
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}

// ----------------------------------------------------
// UI Styles (Futuristic Cyberpunk Glassmorphic Accents)
// ----------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
  },
  // --- START SCREEN STYLES ---
  startScreen: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#111',
  },
  startTitle: {
    width: '100%',
    fontSize: 48,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontWeight: '900',
    color: '#ffcc00',
    letterSpacing: 2,
    textShadowColor: '#ff3300',
    textShadowOffset: { width: 4, height: 4 },
    textShadowRadius: 0,
    marginBottom: 4,
    textAlign: 'center',
  },
  startSubtitle: {
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    color: '#33ff33',
    letterSpacing: 2,
    marginTop: 0,
    marginBottom: 28,
    fontWeight: '700',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  darkMatterHeader: {
    backgroundColor: '#222',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderWidth: 2,
    borderColor: '#ffcc00',
    marginBottom: 24,
  },
  darkMatterText: {
    color: '#ffcc00',
    fontSize: 16,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontWeight: '800',
    letterSpacing: 1,
  },
  shopSectionTitle: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    color: '#ffcc00',
    fontWeight: '900',
    marginBottom: 8,
    textAlign: 'center',
  },
  minimapContainer: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 120,
    height: 120,
    backgroundColor: '#000',
    borderWidth: 2,
    borderColor: '#33ff33',
    overflow: 'hidden',
  },
  minimapPlayerDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    backgroundColor: '#ffcc00',
    transform: [{ translateX: -3 }, { translateY: -3 }],
  },
  minimapBotDot: {
    position: 'absolute',
    width: 4,
    height: 4,
    backgroundColor: '#ff3300',
    transform: [{ translateX: -2 }, { translateY: -2 }],
  },
  skinsSlider: {
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  skinCard: {
    width: 140,
    backgroundColor: '#000',
    padding: 12,
    alignItems: 'center',
    marginHorizontal: 8,
    borderWidth: 2,
    borderColor: '#444',
  },
  skinCardActive: {
    borderColor: '#ffcc00',
    backgroundColor: '#222',
  },
  skinCircle: {
    width: 48,
    height: 48,
    borderWidth: 4,
    marginBottom: 10,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  skinInnerGlow: {
    width: '100%',
    height: '100%',
  },
  skinCardName: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 4,
  },
  skinCardDesc: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    color: '#aaa',
    textAlign: 'center',
    lineHeight: 12,
    marginBottom: 10,
    height: 36,
  },
  skinCardEquipped: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontWeight: '800',
    color: '#33ff33',
    marginTop: 4,
  },
  skinCardBtn: {
    backgroundColor: '#333',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: '#fff',
  },
  skinCardBtnDisabled: {
    opacity: 0.5,
    borderColor: '#666',
  },
  skinCardBtnText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontWeight: '700',
  },
  mapCard: {
    width: 140,
    backgroundColor: '#000',
    padding: 12,
    alignItems: 'center',
    marginHorizontal: 8,
    borderWidth: 2,
    borderColor: '#444',
  },
  mapPreviewThumb: {
    width: 80,
    height: 60,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#fff',
  },
  modesContainer: {
    width: '100%',
    marginTop: 10,
    paddingBottom: 20,
    alignItems: 'stretch',
  },
  modeBtn: {
    backgroundColor: '#000',
    padding: 16,
    borderWidth: 2,
    borderColor: '#ffcc00',
    marginBottom: 12,
  },
  modeBtnTitle: {
    fontSize: 18,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontWeight: '900',
    color: '#ffcc00',
    letterSpacing: 1,
  },
  modeBtnDesc: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    color: '#ccc',
    marginTop: 4,
  },
  modeHighScore: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontWeight: '800',
    color: '#33ff33',
    marginTop: 8,
    alignSelf: 'flex-end',
  },

  // --- GAMEPLAY LAYOUT STYLES ---
  gameContainer: {
    flex: 1,
    backgroundColor: '#111',
    overflow: 'hidden',
  },
  worldMap: {
    width: MAP_SIZE,
    height: MAP_SIZE,
    position: 'relative',
    backgroundColor: '#000',
  },
  gridMapBacking: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderWidth: 2,
    borderColor: '#33ff33',
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
    opacity: 0.2,
  },
  cityObject: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  botHole: {
    position: 'absolute',
    borderWidth: 4,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    overflow: 'hidden',
  },
  botHoleEventHorizon: {
    width: '84%',
    height: '84%',
    borderRadius: 1000,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  botTag: {
    position: 'absolute',
    top: -30,
    backgroundColor: '#000',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 2,
    borderColor: '#fff',
  },
  botTagText: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontWeight: '800',
    color: '#fff',
  },
  playerHole: {
    position: 'absolute',
    borderWidth: 4,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
    overflow: 'hidden',
  },
  playerAccretionDisk: {
    width: '90%',
    height: '90%',
    borderRadius: 1000,
    borderWidth: 4,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerSingularityCore: {
    width: '50%',
    height: '50%',
    borderRadius: 1000,
    backgroundColor: '#fff',
  },
  particleNode: {
    position: 'absolute',
    zIndex: 1,
    borderRadius: 0, 
  },
  floatingTextNode: {
    position: 'absolute',
    left: 0,
    top: 0,
    fontSize: 20,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontWeight: '900',
    color: '#ffcc00',
    textShadowColor: '#000',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 0,
    zIndex: 999,
  },
  powerupItem: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderWidth: 2,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 8,
  },
  powerupSymbol: {
    fontSize: 16,
  },
  powerupLabel: {
    position: 'absolute',
    top: -20,
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontWeight: '800',
    color: '#fff',
    width: 120,
    textAlign: 'center',
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 0,
  },
  redFlashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 0, 0, 0.4)',
    zIndex: 9999,
  },

  // --- VIRTUAL JOYSTICK STYLES ---
  virtualJoystick: {
    position: 'absolute',
    width: 80,
    height: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 2,
    borderColor: '#ffcc00',
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ translateX: -40 }, { translateY: -40 }],
    zIndex: 1000,
    pointerEvents: 'none',
  },
  joystickPuck: {
    width: 32,
    height: 32,
    backgroundColor: '#ffcc00',
    borderWidth: 2,
    borderColor: '#fff',
  },

  // --- PREMIUM PILL HUD STYLES ---
  topLeftHUD: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 500,
    alignItems: 'flex-start',
    opacity: 0.85,
  },
  topRightHUD: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 500,
    alignItems: 'flex-end',
    opacity: 0.85,
  },
  pillBox: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.5)',
    marginBottom: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillTextBig: {
    color: '#ffcc00',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize: 16,
    fontWeight: '900',
  },
  pillTextSmall: {
    color: '#fff',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize: 12,
    fontWeight: '800',
  },
  pillBoxRight: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.5)',
    marginBottom: 2,
    minWidth: 100,
    alignItems: 'flex-start',
  },
  pillBoxPlayer: {
    borderColor: '#ffcc00',
    backgroundColor: 'rgba(34,34,34,0.9)',
  },
  pillTextLeaderboard: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontWeight: '800',
  },

  // --- POWERUP TIMER DISPLAY ---
  powerupTimersBox: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    width: 180,
    zIndex: 500,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 2,
    borderColor: '#fff',
    marginBottom: 6,
  },
  timerSymbol: {
    fontSize: 14,
    marginRight: 8,
  },
  timerProgressBg: {
    flex: 1,
    height: 8,
    backgroundColor: '#333',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#fff',
  },
  timerProgressFill: {
    height: '100%',
  },
  timerDuration: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontWeight: '800',
    color: '#fff',
  },
  exitSandboxBtn: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    backgroundColor: '#000',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 2,
    borderColor: '#ff3300',
    zIndex: 500,
  },
  exitSandboxText: {
    color: '#ff3300',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
  keyboardTipBox: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 100,
  },
  keyboardTipText: {
    color: '#fff',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize: 9,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,204,0,0.5)',
    paddingVertical: 4,
    paddingHorizontal: 10,
  },

  // --- GAME OVER SUMMARY SCREEN ---
  gameOverScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#111',
  },
  gameOverTitle: {
    fontSize: 36,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontWeight: '900',
    color: '#ff3300',
    letterSpacing: 2,
    textShadowColor: '#ffcc00',
    textShadowOffset: { width: 4, height: 4 },
    textShadowRadius: 0,
    textAlign: 'center',
  },
  celebrationBox: {
    alignItems: 'center',
    marginVertical: 24,
  },
  placementMedal: {
    fontSize: 32,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontWeight: '900',
    color: '#ffcc00',
  },
  celebrationDesc: {
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    color: '#fff',
    textAlign: 'center',
    marginTop: 12,
    fontWeight: '600',
    paddingHorizontal: 24,
  },
  statsCard: {
    width: '100%',
    backgroundColor: '#000',
    borderWidth: 2,
    borderColor: '#fff',
    padding: 20,
    marginBottom: 32,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#333',
  },
  statLabel: {
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontWeight: '800',
    color: '#aaa',
  },
  statValue: {
    fontSize: 16,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontWeight: '900',
    color: '#fff',
  },
  gameOverControls: {
    width: '100%',
  },
  gameOverPlayAgain: {
    backgroundColor: '#33ff33',
    padding: 16,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    marginBottom: 12,
  },
  gameOverPlayAgainText: {
    color: '#000',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
  },
  gameOverExit: {
    backgroundColor: '#000',
    padding: 16,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
  },
  gameOverExitText: {
    color: '#fff',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize: 16,
    fontWeight: '800',
  },
});
