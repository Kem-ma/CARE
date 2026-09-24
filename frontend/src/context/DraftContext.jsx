import { createContext, useCallback, useContext, useMemo, useState } from 'react';

// The report being written. It lives only in memory: nothing is saved to the device, so a
// half-finished report can't be found later on a shared phone.
const emptyDraft = {
  type: '',
  city: '',
  quarter: '',
  guardian: '',
  descType: 'text', // 'text' | 'voice'
  text: '',
  audio: null,      // { blob, mime, seconds, url }
  photo: null,      // { blob, url }
  locState: 'unknown', // 'unknown' | 'granted' | 'denied'
  reading: null,    // { lat, lng, accuracy, capturedAt }
};

const DraftContext = createContext(null);

export function DraftProvider({ children }) {
  const [draft, setDraft] = useState(emptyDraft);

  const update = useCallback((patch) => setDraft((current) => ({ ...current, ...patch })), []);

  const reset = useCallback(() => {
    setDraft((current) => {
      if (current.photo?.url) URL.revokeObjectURL(current.photo.url);
      if (current.audio?.url) URL.revokeObjectURL(current.audio.url);
      return emptyDraft;
    });
  }, []);

  const value = useMemo(() => ({ draft, update, reset }), [draft, update, reset]);
  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

export const useDraft = () => useContext(DraftContext);
