// These names must match the routing rules seeded by DataStack (csirs/data_stack.py).
export const INCIDENT_TYPES = [
  'Child abuse',
  'Underage marriage',
  'Kidnapping',
  'Gender-based violence',
  'Femicide',
  'Murder',
  'Burglary',
  'Theft',
  'Road accident',
];

// Types that must include a guardian or next-of-kin phone number (FR-1.9).
export const NEEDS_GUARDIAN = new Set(['Child abuse', 'Underage marriage', 'Kidnapping']);

export const STATUS_CLASS = {
  PENDING_EVIDENCE: 'pend',
  SUBMITTED: 'sub',
  ACKNOWLEDGED: '',
  IN_PROGRESS: 'wip',
  RESOLVED: 'fin',
  FALSE_REPORT: 'no',
};

// How many of the four progress segments are filled
export const STATUS_STEP = {
  PENDING_EVIDENCE: 0,
  SUBMITTED: 1,
  ACKNOWLEDGED: 2,
  IN_PROGRESS: 3,
  RESOLVED: 4,
  FALSE_REPORT: 4,
};

export function formatTime(epochSeconds, lang) {
  const date = new Date(Number(epochSeconds) * 1000);
  return date.toLocaleString(lang, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function timeAgo(epochSeconds, t) {
  const seconds = Math.max(0, Math.floor(Date.now() / 1000 - Number(epochSeconds)));
  if (seconds < 60) return t('ago.s', { n: seconds });
  if (seconds < 3600) return t('ago.m', { n: Math.floor(seconds / 60) });
  if (seconds < 86400) return t('ago.h', { n: Math.floor(seconds / 3600) });
  return t('ago.d', { n: Math.floor(seconds / 86400) });
}
