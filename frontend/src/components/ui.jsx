import { useI18n } from '../i18n';
import { STATUS_CLASS, STATUS_STEP } from '../lib/incidents';
import { CheckIcon, InfoIcon } from './icons';

export function Callout({ tone = 'info', children }) {
  return (
    <div className={`callout ${tone}`} role={tone === 'warn' ? 'alert' : undefined}>
      {tone === 'good' ? <CheckIcon size={16} /> : <InfoIcon />}
      <span>{children}</span>
    </div>
  );
}

function useStatusLabel() {
  const { t } = useI18n();
  return (status) => {
    const key = `status.${status}`;
    const label = t(key);
    return label === key ? status : label;
  };
}

export function StatusPill({ status }) {
  const label = useStatusLabel();
  return <span className={`pill ${STATUS_CLASS[status] ?? ''}`}>{label(status)}</span>;
}

const STEP_KEYS = ['step.submitted', 'step.acknowledged', 'step.inProgress', 'step.resolved'];

export function Progress({ status }) {
  const { t } = useI18n();
  const label = useStatusLabel();
  const filled = STATUS_STEP[status] ?? 0;
  return (
    <>
      <div className="prog" role="img" aria-label={t('progress.aria', { status: label(status) })}>
        {STEP_KEYS.map((key, index) => (
          <span key={key} className={index < filled ? 'f' : ''} />
        ))}
      </div>
      <div className="prog-l" aria-hidden="true">
        {STEP_KEYS.map((key) => (
          <span key={key}>{t(key)}</span>
        ))}
      </div>
    </>
  );
}

export function ErrorList({ title, items }) {
  if (!items.length) return null;
  return (
    <div className="errors" role="alert">
      <b>{title}</b>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
