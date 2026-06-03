const STORAGE_PREFIX = '@cybervortex:';

export function saveData(key: string, value: string): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, value);
  } catch (e) {
    console.warn('Failed to save data:', e);
  }
}

export function loadData(key: string): string | null {
  try {
    return localStorage.getItem(STORAGE_PREFIX + key);
  } catch (e) {
    console.warn('Failed to load data:', e);
    return null;
  }
}

export function saveNumber(key: string, value: number): void {
  saveData(key, value.toString());
}

export function loadNumber(key: string, fallback: number = 0): number {
  const raw = loadData(key);
  if (raw === null) return fallback;
  const parsed = parseInt(raw, 10);
  return isNaN(parsed) ? fallback : parsed;
}

export function saveJSON<T>(key: string, value: T): void {
  saveData(key, JSON.stringify(value));
}

export function loadJSON<T>(key: string, fallback: T): T {
  const raw = loadData(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// ─── Convenience accessors ───
export function getDarkMatter(): number {
  return loadNumber('dark_matter', 0);
}

export function setDarkMatter(value: number): void {
  saveNumber('dark_matter', value);
}

export function getUnlockedSkins(): string[] {
  return loadJSON<string[]>('unlocked_skins', ['NEON']);
}

export function setUnlockedSkins(skins: string[]): void {
  saveJSON('unlocked_skins', skins);
}

export function getEquippedSkin(): string {
  return loadData('equipped_skin') || 'NEON';
}

export function setEquippedSkin(skinId: string): void {
  saveData('equipped_skin', skinId);
}

export function getHighScores(): Record<string, number> {
  return loadJSON<Record<string, number>>('high_scores', { classic: 0, royale: 0, sandbox: 0 });
}

export function setHighScores(scores: Record<string, number>): void {
  saveJSON('high_scores', scores);
}

// Trails
export function getUnlockedTrails(): string[] {
  return loadJSON<string[]>('unlocked_trails', ['SPARKS']);
}

export function setUnlockedTrails(trails: string[]): void {
  saveJSON('unlocked_trails', trails);
}

export function getEquippedTrail(): string {
  return loadData('equipped_trail') || 'SPARKS';
}

export function setEquippedTrail(trailId: string): void {
  saveData('equipped_trail', trailId);
}

// Perks
export function getUnlockedPerks(): string[] {
  return loadJSON<string[]>('unlocked_perks', []);
}

export function setUnlockedPerks(perks: string[]): void {
  saveJSON('unlocked_perks', perks);
}

export function getActivePerk(): string {
  return loadData('active_perk') || '';
}

export function setActivePerk(perkId: string): void {
  saveData('active_perk', perkId);
}
