import { useEffect, useState } from 'react';
import { typeName, useI18n } from '../i18n';
import { getStats } from '../lib/api';
import { errorText } from '../lib/errors';
import { formatTime } from '../lib/incidents';

function Metric({ label, value, note }) {
  return (
    <div className="metric">
      <div className="k">{label}</div>
      <div className="big">{value}</div>
      {note && <div className="fine">{note}</div>}
    </div>
  );
}

// Public figures on how reports were handled over the last 30 days: totals, rates and times only.
// Never a report, a place below the region, or anything about a person.
export default function Statistics() {
  const { t, lang } = useI18n();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getStats().then(setStats, setError);
  }, []);

  // Numbers in the reader's own format: "2.5" and "93%" in English, "2,5" and "93 %" in French
  const pct = (value) => (value === null || value === undefined ? '—'
    : new Intl.NumberFormat(lang, { style: 'percent' }).format(value / 100));
  const num = (value) => new Intl.NumberFormat(lang).format(value);
  const types = stats ? Object.entries(stats.byType) : [];
  const largest = Math.max(1, ...types.map(([, n]) => n ?? 0));

  return (
    <div className="page">
      <h1>{t('stats.title')}</h1>
      <p className="sub">{t('stats.sub', { days: stats?.periodDays ?? 30 })}</p>

      {error && <p className="errors" role="alert">{errorText(error, t)}</p>}
      {!stats && !error && <p className="state" role="status">{t('common.loading')}</p>}

      {stats && (
        <>
          <div className="metrics">
            <Metric label={t('stats.incidents')} value={stats.incidents}
              note={stats.linkedDuplicates ? t('stats.linked', { n: stats.linkedDuplicates }) : null} />
            <Metric label={t('stats.acknowledged')} value={pct(stats.acknowledgedPercent)} />
            <Metric label={t('stats.median')}
              value={stats.medianMinutesToAcknowledge === null ? '—' : t('stats.minutes', { n: num(stats.medianMinutesToAcknowledge) })} />
            <Metric label={t('stats.onTime')} value={pct(stats.urgentWithinFiveMinutesPercent)} note={t('stats.onTimeNote')} />
          </div>

          <h2>{t('stats.outcomes')}</h2>
          <div className="metrics">
            {Object.entries(stats.outcomes).map(([key, n]) => (
              <Metric key={key} label={t(`stats.outcome.${key}`)} value={n} />
            ))}
          </div>

          <h2>{t('stats.byType')}</h2>
          {types.length === 0 && <p className="state">{t('stats.none')}</p>}
          <ul className="bars">
            {types.map(([type, n]) => (
              <li key={type}>
                <span className="bl">{typeName(t, type)}</span>
                <span className="bar"><i style={{ width: `${n === null ? 4 : Math.round((100 * n) / largest)}%` }} /></span>
                <span className="bn">{n === null ? t('stats.few', { n: stats.smallCount }) : n}</span>
              </li>
            ))}
          </ul>

          <p className="fine" style={{ marginTop: 22 }}>
            {t('stats.privacy', { n: stats.smallCount })} {t('stats.updated', { time: formatTime(stats.generatedAt, lang) })}
          </p>
        </>
      )}
    </div>
  );
}
