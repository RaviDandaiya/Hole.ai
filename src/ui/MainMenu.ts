import { SKINS, MAP_DEFINITIONS, SkinDef, MapDefinition, TRAILS, PERKS, TrailDef, PerkDef } from '../utils/constants';
import * as storage from '../utils/storage';

export type GameMode = 'classic' | 'royale' | 'sandbox' | 'multiplayer';
export type MenuCallback = (mode: GameMode, mapId: string, skinId: string) => void;

export class MainMenu {
  private el: HTMLDivElement;
  private onPlay: MenuCallback | null = null;
  private selectedMapId: string;
  private equippedSkin: string;
  private darkMatter: number;
  private unlockedSkins: string[];
  private highScores: Record<string, number>;
  private unlockedTrails: string[] = [];
  private equippedTrail: string = 'SPARKS';
  private unlockedPerks: string[] = [];
  private activePerk: string = '';

  constructor() {
    this.selectedMapId = MAP_DEFINITIONS[0].id;
    this.equippedSkin = storage.getEquippedSkin();
    this.darkMatter = storage.getDarkMatter();
    this.unlockedSkins = storage.getUnlockedSkins();
    this.highScores = storage.getHighScores();
    this.unlockedTrails = storage.getUnlockedTrails();
    this.equippedTrail = storage.getEquippedTrail();
    this.unlockedPerks = storage.getUnlockedPerks();
    this.activePerk = storage.getActivePerk();

    this.el = document.createElement('div');
    this.el.id = 'main-menu';
    document.getElementById('app')!.appendChild(this.el);
    this.render();
  }

  setOnPlay(cb: MenuCallback): void { this.onPlay = cb; }

  show(): void {
    this.darkMatter = storage.getDarkMatter();
    this.unlockedSkins = storage.getUnlockedSkins();
    this.equippedSkin = storage.getEquippedSkin();
    this.highScores = storage.getHighScores();
    this.unlockedTrails = storage.getUnlockedTrails();
    this.equippedTrail = storage.getEquippedTrail();
    this.unlockedPerks = storage.getUnlockedPerks();
    this.activePerk = storage.getActivePerk();
    this.el.classList.remove('hidden');
    this.render();
  }

  hide(): void { this.el.classList.add('hidden'); }

  private render(): void {
    const skinCards = SKINS.map(s => {
      const unlocked = this.unlockedSkins.includes(s.id);
      const equipped = this.equippedSkin === s.id;
      const active = equipped ? ' active' : '';
      let btnHtml: string;
      if (equipped) btnHtml = `<button class="skin-btn equipped">EQUIPPED</button>`;
      else if (unlocked) btnHtml = `<button class="skin-btn" data-equip="${s.id}">EQUIP</button>`;
      else btnHtml = `<button class="skin-btn" data-buy="${s.id}" ${this.darkMatter < s.cost ? 'disabled' : ''}>💎 ${s.cost}</button>`;
      return `<div class="skin-card${active}">
        <div class="skin-circle" style="color:${s.primary};border-color:${s.primary}"><div style="position:absolute;inset:4px;border-radius:50%;background:${s.secondary};opacity:0.5"></div></div>
        <div class="skin-name">${s.name}</div>
        <div class="skin-desc">${s.desc}</div>
        ${btnHtml}
      </div>`;
    }).join('');

    const trailCards = TRAILS.map(t => {
      const unlocked = this.unlockedTrails.includes(t.id);
      const equipped = this.equippedTrail === t.id;
      const active = equipped ? ' active' : '';
      let btnHtml: string;
      if (equipped) btnHtml = `<button class="skin-btn equipped">EQUIPPED</button>`;
      else if (unlocked) btnHtml = `<button class="skin-btn" data-equip-trail="${t.id}">EQUIP</button>`;
      else btnHtml = `<button class="skin-btn" data-buy-trail="${t.id}" ${this.darkMatter < t.cost ? 'disabled' : ''}>💎 ${t.cost}</button>`;
      return `<div class="skin-card${active}">
        <div class="skin-circle" style="color:${t.primary};border-color:${t.primary}"><div style="position:absolute;inset:4px;border-radius:50%;background:${t.secondary};opacity:0.5"></div></div>
        <div class="skin-name">${t.name}</div>
        <div class="skin-desc">${t.desc}</div>
        ${btnHtml}
      </div>`;
    }).join('');

    const perkCards = PERKS.map(p => {
      const unlocked = this.unlockedPerks.includes(p.id);
      const equipped = this.activePerk === p.id;
      const active = equipped ? ' active' : '';
      let btnHtml: string;
      if (equipped) btnHtml = `<button class="skin-btn equipped" data-deactivate-perk="${p.id}">DEACTIVATE</button>`;
      else if (unlocked) btnHtml = `<button class="skin-btn" data-equip-perk="${p.id}">ACTIVATE</button>`;
      else btnHtml = `<button class="skin-btn" data-buy-perk="${p.id}" ${this.darkMatter < p.cost ? 'disabled' : ''}>💎 ${p.cost}</button>`;
      return `<div class="skin-card${active}">
        <div class="skin-circle" style="color:#FFD700;border-color:#FFD700;display:flex;align-items:center;justify-content:center;font-size:20px">🌟</div>
        <div class="skin-name">${p.name}</div>
        <div class="skin-desc">${p.desc}</div>
        ${btnHtml}
      </div>`;
    }).join('');

    const mapCards = MAP_DEFINITIONS.map(m => {
      const active = this.selectedMapId === m.id ? ' active' : '';
      return `<div class="map-card${active}" data-map="${m.id}">
        <div class="map-preview" style="background:${m.themeColor}"></div>
        <div class="map-name">${m.name}</div>
      </div>`;
    }).join('');

    this.el.innerHTML = `
      <div class="menu-title">CYBER<span>VORTEX</span></div>
      <div class="menu-subtitle">Consume Everything.</div>
      <div class="menu-currency">💎 ${this.darkMatter} DARK MATTER</div>

      <div class="menu-section-title">SELECT SINGULARITY SKIN</div>
      <div class="skin-scroll">${skinCards}</div>

      <div class="menu-section-title">SELECT COSMETIC TRAIL</div>
      <div class="skin-scroll">${trailCards}</div>

      <div class="menu-section-title">CHOOSE STARTING PERK</div>
      <div class="skin-scroll">${perkCards}</div>

      <div class="menu-section-title">SELECT ARENA</div>
      <div class="map-scroll">${mapCards}</div>

      <div class="mode-buttons">
        <div class="mode-btn" data-mode="classic">
          <div class="mode-btn-title">⚡ CLASSIC RUN</div>
          <div class="mode-btn-desc">2 minute score race against bots</div>
          <div class="mode-btn-high">BEST: ${this.highScores.classic || 0} pts</div>
        </div>
        <div class="mode-btn" data-mode="royale">
          <div class="mode-btn-title">💥 BATTLE ROYALE</div>
          <div class="mode-btn-desc">Outlast competitors in shrinking boundaries</div>
          <div class="mode-btn-high">BEST: ${this.highScores.royale || 0} pts</div>
        </div>
        <div class="mode-btn" data-mode="multiplayer" style="border-color: var(--accent); background: rgba(255, 47, 190, 0.05)">
          <div class="mode-btn-title" style="color: var(--accent)">🌐 ONLINE MULTIPLAYER</div>
          <div class="mode-btn-desc">Play in real-time online against your friends</div>
        </div>
        <div class="mode-btn" data-mode="sandbox">
          <div class="mode-btn-title">🌌 INFINITE SANDBOX</div>
          <div class="mode-btn-desc">Stress-free cosmic void. Grow infinitely.</div>
        </div>
      </div>
    `;

    // Event listeners
    this.el.querySelectorAll('[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = (btn as HTMLElement).dataset.mode as GameMode;
        this.onPlay?.(mode, this.selectedMapId, this.equippedSkin);
      });
    });

    this.el.querySelectorAll('[data-map]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedMapId = (btn as HTMLElement).dataset.map!;
        this.render();
      });
    });

    // Skins listeners
    this.el.querySelectorAll('[data-equip]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.equippedSkin = (btn as HTMLElement).dataset.equip!;
        storage.setEquippedSkin(this.equippedSkin);
        this.render();
      });
    });

    this.el.querySelectorAll('[data-buy]').forEach(btn => {
      btn.addEventListener('click', () => {
        const skinId = (btn as HTMLElement).dataset.buy!;
        const skin = SKINS.find(s => s.id === skinId);
        if (!skin || this.darkMatter < skin.cost) return;
        this.darkMatter -= skin.cost;
        this.unlockedSkins.push(skinId);
        this.equippedSkin = skinId;
        storage.setDarkMatter(this.darkMatter);
        storage.setUnlockedSkins(this.unlockedSkins);
        storage.setEquippedSkin(skinId);
        this.render();
      });
    });

    // Trails listeners
    this.el.querySelectorAll('[data-equip-trail]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.equippedTrail = (btn as HTMLElement).dataset.equipTrail!;
        storage.setEquippedTrail(this.equippedTrail);
        this.render();
      });
    });

    this.el.querySelectorAll('[data-buy-trail]').forEach(btn => {
      btn.addEventListener('click', () => {
        const trailId = (btn as HTMLElement).dataset.buyTrail!;
        const trail = TRAILS.find(t => t.id === trailId);
        if (!trail || this.darkMatter < trail.cost) return;
        this.darkMatter -= trail.cost;
        this.unlockedTrails.push(trailId);
        this.equippedTrail = trailId;
        storage.setDarkMatter(this.darkMatter);
        storage.setUnlockedTrails(this.unlockedTrails);
        storage.setEquippedTrail(trailId);
        this.render();
      });
    });

    // Perks listeners
    this.el.querySelectorAll('[data-equip-perk]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activePerk = (btn as HTMLElement).dataset.equipPerk!;
        storage.setActivePerk(this.activePerk);
        this.render();
      });
    });

    this.el.querySelectorAll('[data-deactivate-perk]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activePerk = '';
        storage.setActivePerk('');
        this.render();
      });
    });

    this.el.querySelectorAll('[data-buy-perk]').forEach(btn => {
      btn.addEventListener('click', () => {
        const perkId = (btn as HTMLElement).dataset.buyPerk!;
        const perk = PERKS.find(p => p.id === perkId);
        if (!perk || this.darkMatter < perk.cost) return;
        this.darkMatter -= perk.cost;
        this.unlockedPerks.push(perkId);
        this.activePerk = perkId;
        storage.setDarkMatter(this.darkMatter);
        storage.setUnlockedPerks(this.unlockedPerks);
        storage.setActivePerk(perkId);
        this.render();
      });
    });
  }
}
