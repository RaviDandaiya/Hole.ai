import * as storage from '../utils/storage';

export class MultiplayerLobby {
  private el: HTMLDivElement;
  private onHostCb: ((name: string) => void) | null = null;
  private onJoinCb: ((name: string, code: string) => void) | null = null;
  private onStartCb: (() => void) | null = null;
  private onLeaveCb: (() => void) | null = null;

  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'multiplayer-lobby';
    this.el.className = 'hidden';
    document.getElementById('app')!.appendChild(this.el);
  }

  setCallbacks(
    onHost: (name: string) => void,
    onJoin: (name: string, code: string) => void,
    onStart: () => void,
    onLeave: () => void
  ) {
    this.onHostCb = onHost;
    this.onJoinCb = onJoin;
    this.onStartCb = onStart;
    this.onLeaveCb = onLeave;
  }

  showSetup(): void {
    const savedName = storage.loadData('player_name') || '';
    this.el.innerHTML = `
      <div class="lobby-card">
        <div class="lobby-title">🌐 ONLINE MULTIPLAYER</div>
        
        <div class="lobby-input-group">
          <label class="lobby-label" for="player-name">YOUR PLAYER NAME</label>
          <input type="text" id="player-name" class="lobby-input" placeholder="Enter name..." value="${savedName}" maxlength="12">
        </div>

        <button class="lobby-btn primary" id="btn-host-match">HOST NEW MATCH</button>

        <div class="lobby-divider">OR JOIN WITH CODE</div>

        <div class="lobby-input-group">
          <input type="text" id="room-code" class="lobby-input" style="text-align: center; letter-spacing: 0.2em; text-transform: uppercase;" placeholder="CODE" maxlength="4">
        </div>

        <button class="lobby-btn primary" id="btn-join-match">JOIN MATCH</button>

        <button class="lobby-btn secondary" id="btn-back-menu">BACK TO MAIN MENU</button>
        
        <div id="lobby-error" class="lobby-status" style="color: #EF4444; margin-top: 10px; display: none;"></div>
      </div>
    `;

    this.el.classList.remove('hidden');
    this.setupSetupListeners();
  }

  private setupSetupListeners() {
    const nameInput = this.el.querySelector('#player-name') as HTMLInputElement;
    const codeInput = this.el.querySelector('#room-code') as HTMLInputElement;
    const hostBtn = this.el.querySelector('#btn-host-match') as HTMLButtonElement;
    const joinBtn = this.el.querySelector('#btn-join-match') as HTMLButtonElement;
    const backBtn = this.el.querySelector('#btn-back-menu') as HTMLButtonElement;

    hostBtn.addEventListener('click', () => {
      const name = nameInput.value.trim();
      if (!name) {
        this.showError('Please enter a player name.');
        return;
      }
      storage.saveData('player_name', name);
      this.showConnecting(true);
      this.onHostCb?.(name);
    });

    joinBtn.addEventListener('click', () => {
      const name = nameInput.value.trim();
      const code = codeInput.value.trim().toUpperCase();
      if (!name) {
        this.showError('Please enter a player name.');
        return;
      }
      if (code.length !== 4) {
        this.showError('Please enter a valid 4-character room code.');
        return;
      }
      storage.saveData('player_name', name);
      this.showConnecting(true);
      this.onJoinCb?.(name, code);
    });

    backBtn.addEventListener('click', () => {
      this.hide();
      this.onLeaveCb?.();
    });
  }

  showLobby(roomCode: string, isHost: boolean, players: any[]): void {
    this.el.innerHTML = `
      <div class="lobby-card">
        <div class="lobby-title">ROOM LOBBY</div>

        <div class="lobby-code-box">
          <div class="lobby-code-val" id="lobby-code-display">${roomCode}</div>
          <button class="lobby-code-copy" id="btn-copy-code">COPY</button>
        </div>

        <div class="lobby-label">PLAYERS IN LOBBY (${players.length}/6)</div>
        <div class="lobby-players-list" id="players-list-container">
          <!-- Populated dynamically -->
        </div>

        <div id="lobby-status-msg" class="lobby-status">
          ${isHost ? 'You are the Host. Press Start to play!' : 'Waiting for host to start match...'}
        </div>

        ${isHost ? `<button class="lobby-btn primary" id="btn-start-match">START MATCH</button>` : ''}

        <button class="lobby-btn danger" id="btn-leave-lobby">LEAVE LOBBY</button>
      </div>
    `;

    this.updatePlayersList(players);

    const copyBtn = this.el.querySelector('#btn-copy-code') as HTMLButtonElement;
    const leaveBtn = this.el.querySelector('#btn-leave-lobby') as HTMLButtonElement;

    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(roomCode).then(() => {
        copyBtn.textContent = 'COPIED!';
        setTimeout(() => { copyBtn.textContent = 'COPY'; }, 2000);
      });
    });

    leaveBtn.addEventListener('click', () => {
      this.onLeaveCb?.();
    });

    if (isHost) {
      const startBtn = this.el.querySelector('#btn-start-match') as HTMLButtonElement;
      startBtn.addEventListener('click', () => {
        this.onStartCb?.();
      });
    }

    this.el.classList.remove('hidden');
  }

  updatePlayersList(players: any[]): void {
    const container = this.el.querySelector('#players-list-container');
    if (!container) return;

    container.innerHTML = players.map(p => {
      const hostCls = p.isHost ? ' host' : '';
      return `
        <div class="lobby-player-row${hostCls}">
          <span>${p.name}</span>
        </div>
      `;
    }).join('');
  }

  showConnecting(show: boolean): void {
    const errorEl = this.el.querySelector('#lobby-error') as HTMLDivElement;
    if (errorEl) {
      if (show) {
        errorEl.textContent = 'Connecting...';
        errorEl.style.color = '#2FF5FF';
        errorEl.style.display = 'block';
      } else {
        errorEl.style.display = 'none';
      }
    }
  }

  showError(msg: string): void {
    const errorEl = this.el.querySelector('#lobby-error') as HTMLDivElement;
    if (errorEl) {
      errorEl.textContent = msg;
      errorEl.style.color = '#EF4444';
      errorEl.style.display = 'block';
    }
  }

  hide(): void {
    this.el.classList.add('hidden');
  }
}
