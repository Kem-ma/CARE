import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Progress, StatusPill } from '../components/ui';
import { typeName, useI18n } from '../i18n';
import { trackReport } from '../lib/api';
import { errorText } from '../lib/errors';
import { formatTime } from '../lib/incidents';

export default function Track() {
  const [params, setParams] = useSearchParams();
  const { t, lang } = useI18n();
  const initial = params.get('ref') || '';
  const [ref, setRef] = useState(initial);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function lookup(code) {
    setBusy(true);
    setError(null);
    setReport(null);
    try {
      setReport(await trackReport(code));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (initial) lookup(initial);
    // Only when the page opens with a code already in the link
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onSubmit(event) {
    event.preventDefault();
    if (!ref.trim()) return;
    setParams({ ref: ref.trim() });
    lookup(ref.trim());
  }

  return (
    <div className="page">
      <h1>{t('track.title')}</h1>
      <p className="sub">{t('track.sub')}</p>

      <form className="lookup" style={{ marginTop: 0 }} onSubmit={onSubmit}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            className="inp mono"
            style={{ flex: 1, minWidth: 200, textTransform: 'uppercase' }}
            aria-label={t('lookup.aria')}
            placeholder={t('lookup.ph')}
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            maxLength={20}
          />
          <button className="btn primary" type="submit" disabled={busy}>{busy ? t('track.checking') : t('lookup.btn')}</button>
        </div>
      </form>

      {error && (
        <p className="errors" style={{ marginTop: 18 }} role="alert">
          {error.status === 404 ? t('track.notFound') : errorText(error, t)}
        </p>
      )}

      {report && (
        <article className="rep" style={{ marginTop: 22 }}>
          <div className="top">
            <span className="ty">{typeName(t, report.incidentType)}</span>
            <span className="meta">{t('track.submitted', { time: formatTime(report.createdAt, lang) })}</span>
          </div>
          <StatusPill status={report.status} />
          <Progress status={report.status} />
        </article>
      )}

      <p className="fine" style={{ marginTop: 22 }}>
        {t('track.note')} <Link to="/">{t('track.home')}</Link>
      </p>
    </div>
  );
}
