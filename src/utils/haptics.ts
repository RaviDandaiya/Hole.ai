export function vibrateSmall(): void {
  try { navigator.vibrate?.(10); } catch {}
}

export function vibrateMedium(): void {
  try { navigator.vibrate?.(25); } catch {}
}

export function vibrateLarge(): void {
  try { navigator.vibrate?.([30, 10, 30]); } catch {}
}

export function vibrateSizeUp(): void {
  try { navigator.vibrate?.([50, 20, 80]); } catch {}
}

export function vibrateGameOver(): void {
  try { navigator.vibrate?.([100, 50, 100, 50, 200]); } catch {}
}

export function vibrateBotKill(): void {
  try { navigator.vibrate?.(60); } catch {}
}
