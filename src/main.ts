import './styles/index.css';
import { Game } from './core/Game';

// ─── Entry Point ───
const container = document.getElementById('app')!;
const game = new Game(container);
