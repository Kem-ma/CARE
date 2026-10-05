import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { teamName } from '../components/StaffTools';
import { Callout, Progress, StatusPill } from '../components/ui';
import { typeName, useI18n } from '../i18n';
import { answerQuestion, trackReport } from '../lib/api';
import { errorText } from '../lib/errors';
import { formatTime } from '../lib/incidents';

// One question from a team, answered once. Nothing about the reporter is shown or asked for.
function Question({ code, question, onAnswered }) {
  const { t, lang } = useI18n();
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const text = question.template ? t(`q.${question.template}`) : question.text;

  async function send(event) {
    event.preventDefault();
    if (!answer.trim()) {
      setError({ key: 'track.answerEmpty' });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await answerQuestion(code, question.questionId, answer.trim());
      onAnswered();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="question">
      <div className="fine">{t('track.questionFrom', { team: teamName(t, question.team) })} · {formatTime(question.askedAt, lang)}</div>
      <p className="qtext">{text}</p>
      {question.answer ? (
        <p className="fine">{t('track.yourAnswer', { answer: question.answer })}</p>
      ) : (
        <form onSubmit={send}>
          <textarea className="inp" aria-label={t('track.answerLabel')} maxLength={500} placeholder={t('track.answerPh')}
            value={answer} onChange={(e) => { setAnswer(e.target.value); setError(null); }} />
          {error && <Callout tone="warn">{errorText(error, t)}</Callout>}
          <p className="fine">{t('track.answerWarning')}</p>
          <button className="btn small primary" disabled={busy}>{busy ? t('auth.wait') : t('track.answerBtn')}</button>
        </form>
      )}
    </div>
  );
}

export default function Track() {
  const [params, setParams] = useSearchParams();
  const { t, lang } = useI18n();
  const initial = params.get('ref') || '';
  const [ref, setRef] = useState(initial);
  const [code, setCode] = useState('');   // the code the shown report was found with
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function lookup(value) {
    setBusy(true);
    setError(null);
    setReport(null);
    try {
      setReport(await trackReport(value));
      setCode(value);
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

      {report?.questions?.length > 0 && (
        <section className="questions">
          <h2>{t('track.questionsTitle')}</h2>
          <p className="fine">{t('track.questionsNote')}</p>
          {report.questions.map((q) => (
            <Question key={q.questionId} code={code} question={q} onAnswered={() => lookup(code)} />
          ))}
        </section>
      )}

      <p className="fine" style={{ marginTop: 22 }}>
        {t('track.note')} <Link to="/">{t('track.home')}</Link>
      </p>
    </div>
  );
}
