import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PinIcon } from '../components/icons';
import { useDraft } from '../context/DraftContext';
import { useI18n } from '../i18n';
import { getLocation } from '../lib/location';

export default function LocationStep() {
  const navigate = useNavigate();
  const { draft, update } = useDraft();
  const { t } = useI18n();
  const [phase, setPhase] = useState('explain'); // 'explain' | 'asking' | 'failed'
  const [reason, setReason] = useState('unavailable');

  // Already shared earlier in this visit: go straight to the form
  useEffect(() => {
    if (draft.locState === 'granted') navigate('/report', { replace: true });
  }, [draft.locState, navigate]);

  async function ask() {
    setPhase('asking');
    try {
      const reading = await getLocation();
      update({ locState: 'granted', reading });
      navigate('/report', { replace: true });
    } catch (error) {
      setReason(error.code || 'unavailable');
      setPhase('failed');
    }
  }

  function continueWithout() {
    update({ locState: 'denied', reading: null });
    navigate('/report');
  }

  if (phase === 'failed') {
    return (
      <div className="page">
        <div className="gate" style={{ textAlign: 'left', borderStyle: 'solid' }}>
          <span className="chip alert" style={{ marginBottom: 12 }}>{t('loc.failedChip')}</span>
          <h2>{t('loc.failedTitle')}</h2>
          <p style={{ maxWidth: '56ch' }}>{t(`loc.err.${reason}`)}</p>
          <p style={{ maxWidth: '56ch' }}>{t('loc.failedText')}</p>
          <div className="actions">
            <button className="btn primary" onClick={ask}>{t('loc.tryAgain')}</button>
            <button className="btn plain" onClick={continueWithout}>{t('loc.continueWithout')}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="locicon"><PinIcon /></div>
      <h1>{t('loc.title')}</h1>
      <p className="sub" style={{ maxWidth: '54ch' }}>{t('loc.sub')}</p>
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="row">
          <span className="k">{t('loc.why.k')}</span>
          <span className="v">{t('loc.why.v')}</span>
        </div>
        <div className="row">
          <span className="k">{t('loc.off.k')}</span>
          <span className="v">{t('loc.off.v')}</span>
        </div>
      </div>
      <div className="actions">
        <button className="btn primary" onClick={ask} disabled={phase === 'asking'}>
          {phase === 'asking' ? t('loc.waiting') : t('loc.turnOn')}
        </button>
      </div>
    </div>
  );
}
