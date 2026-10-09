// These lists must match backend/csirs/routing.py, which decides where reports go.
export const INCIDENT_TYPES = [
  'Kidnapping',
  'Murder',
  'Road accident',
  'Fire',
  'Child abuse',
  'Gender-based violence',
  'Femicide',
  'Rape',
  'Underage marriage',
  'Theft',
  'Burglary',
  'Other',
];

// Types that must include a guardian or next-of-kin phone number (FR-1.9).
export const NEEDS_GUARDIAN = new Set(['Child abuse', 'Underage marriage', 'Kidnapping']);

// Types where the photo may be left out (routing.py: photoOptional). Every other type needs one.
export const PHOTO_OPTIONAL = new Set(['Theft']);

// Types handled by MINPROFF. Their reporters aren't contacted unless they choose to be.
export const MINPROFF_TYPES = new Set(['Child abuse', 'Gender-based violence', 'Femicide', 'Underage marriage']);

// This version covers one region. The reporter can't choose another.
export const REGION = 'South-West';
export const TOWNS = ['Buea', 'Limbe', 'Kumba', 'Tiko', 'Mamfe', 'Bangem', 'Mundemba', 'Fontem', 'Ekondo-Titi'];

// Where it happened, in the reporter's words. The reporter's own location is never collected.
export const WHERE = ['IN_TOWN', 'OUTSIDE', 'UNSURE'];

export const PRIORITY_CLASS = { URGENT: 'urgent', HIGH: 'high', STANDARD: 'standard' };
// Urgent and high reports ring the dashboard alarm; standard ones wait in the queue.
export const RINGS = new Set(['URGENT', 'HIGH']);

// Every team a report can be transferred to (backend/csirs/routing.py)
export const TEAMS = [
  'minproff.national',
  ...TOWNS.map((town) => `police.${town.toLowerCase()}`),
  'gendarmerie.south-west',
  ...TOWNS.map((town) => `hospital.${town.toLowerCase()}`),
  'fire.20th-group',
];
export const PRIORITIES = ['URGENT', 'HIGH', 'STANDARD'];
// Ready-made questions staff can ask (backend: QUESTION_TEMPLATES). The reporter reads them in their language.
export const QUESTION_TEMPLATES = ['location', 'injured', 'ongoing', 'vehicle', 'people', 'direction'];
export const MAX_QUESTIONS = 3;
export const REFER_METHODS = ['PHONE', 'RADIO', 'IN_PERSON', 'OTHER'];

// The short reference staff read aloud, as the backend makes it
export const shortRef = (id) => {
  const compact = (id || '').replace(/-/g, '').toUpperCase().slice(0, 8);
  return `${compact.slice(0, 4)}-${compact.slice(4)}`;
};

// A report's town: older reports stored it as "city"
export const townOf = (location) => location?.town || location?.city || '';

export const STATUS_CLASS = {
  PENDING_EVIDENCE: 'pend',
  SUBMITTED: 'sub',
  ACKNOWLEDGED: '',
  IN_PROGRESS: 'wip',
  RESOLVED: 'fin',
  FALSE_REPORT: 'no',
  WITHDRAWN: 'no',
  CLOSED_NO_ACTION: 'fin',
  LINKED: '',
};

// How many of the four progress segments are filled
export const STATUS_STEP = {
  PENDING_EVIDENCE: 0,
  SUBMITTED: 1,
  ACKNOWLEDGED: 2,
  IN_PROGRESS: 3,
  RESOLVED: 4,
  FALSE_REPORT: 4,
  WITHDRAWN: 1,
  CLOSED_NO_ACTION: 4,
  LINKED: 1,
};

// Statuses in which a reporter may still add information (and, while SUBMITTED, edit or withdraw)
export const OPEN_STATUSES = new Set(['SUBMITTED', 'ACKNOWLEDGED', 'IN_PROGRESS']);

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
