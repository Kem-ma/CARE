import { createContext, useCallback, useContext, useMemo, useState } from 'react';

// The report being written. It lives only in memory: nothing is saved to the device, so a
// half-finished report can't be found later on a shared phone.
const emptyDraft = {
  type: '',
  danger: null,     // true | false, "Is someone in danger right now?"
  where: '',        // 'IN_TOWN' | 'OUTSIDE' | 'UNSURE'
  town: '',         // where it happened, or the nearest town when outside one
  quarter: '',
  landmark: '',
  guardian: '',
  descType: 'text', // 'text' | 'voice'
  text: '',
  audio: null,      // { blob, mime, seconds, url }
  photo: null,      // { blob, url }
  contact: null,    // null = the default for the type; true | false once the reporter chooses
};

const DraftContext = createContext(null);

export function DraftProvider({ children }) {
  const [draft, setDraft] = useState(emptyDraft);
  // The report just sent, so it can be changed for a few minutes: { reportId, editToken, deadline, view }.
  // Like the draft it lives only in memory, so an anonymous report's edit token never touches the device.
  const [recent, setRecent] = useState(null);

  const update = useCallback((patch) => setDraft((current) => ({ ...current, ...patch })), []);

  const reset = useCallback(() => {
    setDraft((current) => {
      if (current.photo?.url) URL.revokeObjectURL(current.photo.url);
      if (current.audio?.url) URL.revokeObjectURL(current.audio.url);
      return emptyDraft;
    });
  }, []);

  const value = useMemo(() => ({ draft, update, reset, recent, setRecent }), [draft, update, reset, recent]);
  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

export const useDraft = () => useContext(DraftContext);
