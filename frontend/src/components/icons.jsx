const base = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round', viewBox: '0 0 24 24', 'aria-hidden': true };

export const CameraIcon = ({ size = 26 }) => (
  <svg {...base} width={size} height={size} strokeWidth="1.7">
    <path d="M4 8h3l1.6-2.4h6.8L17 8h3v11H4z" />
    <circle cx="12" cy="13.5" r="3.6" />
  </svg>
);

export const MicIcon = ({ size = 18 }) => (
  <svg {...base} width={size} height={size} strokeWidth="2">
    <rect x="9" y="3" width="6" height="12" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </svg>
);

export const StopIcon = ({ size = 16 }) => (
  <svg {...base} width={size} height={size} strokeWidth="2" fill="currentColor">
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);

export const LockIcon = ({ size = 14 }) => (
  <svg {...base} width={size} height={size} strokeWidth="2">
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);

export const CheckIcon = ({ size = 22 }) => (
  <svg {...base} width={size} height={size} strokeWidth="2.4">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

export const InfoIcon = ({ size = 16 }) => (
  <svg {...base} width={size} height={size} strokeWidth="2">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8v.01" />
  </svg>
);

export const PinIcon = ({ size = 30 }) => (
  <svg {...base} width={size} height={size} strokeWidth="1.7">
    <path d="M12 21s-7-6.2-7-11.2A7 7 0 0 1 19 9.8C19 14.8 12 21 12 21z" />
    <circle cx="12" cy="10" r="2.6" />
  </svg>
);
