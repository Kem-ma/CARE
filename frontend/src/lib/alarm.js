// The audible alert for admins: a two-tone siren, generated in the browser (no audio file).
// It rings for up to 3 minutes per report, or until that report is acknowledged.
export const ALARM_MS = 3 * 60 * 1000;

let context = null;
let timer = null;
let high = false;
const active = new Map(); // reportId -> when it stops ringing (ms)
const muted = new Set();  // reports the admin silenced by hand

// Browsers only allow sound after a click, so the dashboard calls this from a button.
export function unlockAudio() {
  if (!context) context = new (window.AudioContext || window.webkitAudioContext)();
  if (context.state === 'suspended') context.resume();
  return context.state === 'running';
}

function beep() {
  if (!context || context.state !== 'running') return;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = 'square';
  oscillator.frequency.value = high ? 880 : 660;
  gain.gain.value = 0.12;
  oscillator.connect(gain).connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.4);
}

function tick() {
  const now = Date.now();
  for (const [id, until] of active) if (until <= now) active.delete(id);
  if (active.size === 0) {
    clearInterval(timer);
    timer = null;
    return;
  }
  high = !high;
  beep();
}

export function startAlarm(reportId, remainingMs = ALARM_MS) {
  if (active.has(reportId) || muted.has(reportId)) return;
  active.set(reportId, Date.now() + remainingMs);
  if (!timer) {
    timer = setInterval(tick, 700);
    tick();
  }
}

// Keep only the alarms for reports that are still unacknowledged.
export function syncAlarms(unacknowledgedIds) {
  for (const id of [...active.keys()]) if (!unacknowledgedIds.has(id)) active.delete(id);
  for (const id of [...muted]) if (!unacknowledgedIds.has(id)) muted.delete(id);
}

export function muteAll() {
  for (const id of active.keys()) muted.add(id);
  active.clear();
}

export const isRinging = () => active.size > 0;
