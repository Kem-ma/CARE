import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LockIcon } from '../components/icons';
import { Progress, StatusPill } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { typeName, useI18n } from '../i18n';
import { myReports } from '../lib/api';
import { errorText } from '../lib/errors';
import { formatTime } from '../lib/incidents';

function TrackingLookup() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [ref, setRef] = useState('');

  function onSubmit(event) {
    event.preventDefault();
    if (ref.trim()) navigate(`/track?ref=${encodeURIComponent(ref.trim())}`);
  }

  return (
    <div className="lookup">
      <span className="lbl">{t('lookup.label')}</span>
      <form onSubmit={onSubmit}>
        <input
          className="inp"
          aria-label={t('lookup.aria')}
          placeholder={t('lookup.ph')}
          value={ref}
          onChange={(e) => setRef(e.target.value)}
          maxLength={20}
        />
        <button className="btn secondary" type="submit">{t('lookup.btn')}</button>
      </form>
    </div>
  );
}

export default function MyReports() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { t, lang } = useI18n();
  const [reports, setReports] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await myReports();
      setReports(data.reports);
    } catch (err) {
      setError(err);
    }
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  if (loading) return <div className="page"><p className="state" role="status">{t('common.loading')}</p></div>;

  if (!user) {
    return (
      <div className="page">
        <h1>{t('mine.title')}</h1>
        <p className="sub">{t('mine.sub')}</p>
        <div className="gate">
          <h2>{t('mine.gateTitle')}</h2>
          <p>{t('mine.gateText')}</p>
          <Link className="btn primary" to="/sign-in?next=/my-reports">{t('nav.signIn')}</Link>
        </div>
        <TrackingLookup />
      </div>
    );
  }

  return (
    <div className="page">
      <div className="rhead">
        <div>
          <h1>{t('mine.title')}</h1>
          <p className="sub" style={{ margin: 0 }}>{t('mine.track')}</p>
        </div>
        <span className="private"><LockIcon /> {t('mine.private')}</span>
      </div>

      {error && (
        <p className="errors" role="alert">
          {errorText(error, t)} <button className="lnk" onClick={load}>{t('common.tryAgain')}</button>
        </p>
      )}
      {!reports && !error && <p className="state" role="status">{t('mine.loading')}</p>}
      {reports && reports.length === 0 && (
        <div className="gate">
          <h2>{t('mine.emptyTitle')}</h2>
          <p>{t('mine.emptyText')}</p>
        </div>
      )}

      <div className="list">
        {reports?.map((report) => (
          <article className="rep" key={report.reportId}>
            <div className="top">
              <span className="ty">{typeName(t, report.incidentType)}</span>
              <span className="meta">{[report.city, report.quarter].filter(Boolean).join(', ')} · {formatTime(report.createdAt, lang)}</span>
            </div>
            <StatusPill status={report.status} />
            <Progress status={report.status} />
            <div className="meta" style={{ gridColumn: '1 / -1' }}>{t('mine.code', { code: report.trackingRef })}</div>
          </article>
        ))}
      </div>

      <div className="actions" style={{ marginTop: 24 }}>
        <button className="btn primary" onClick={() => navigate('/report/location')}>{t('landing.report')}</button>
        {reports && <button className="btn plain" onClick={load}>{t('mine.refresh')}</button>}
      </div>
    </div>
  );
}
