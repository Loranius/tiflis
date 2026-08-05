import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  CalendarDays,
  ClipboardList,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  Soup,
  UserPlus,
  UserRound,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router';
import { useAuth } from '../auth/AuthProvider';
import {
  confirmPasswordReset,
  registerPortalUser,
  requestPasswordReset,
} from '../lib/publicAuthApi';
import './login.css';
import './auth-flow.css';

type AccessMode = 'login' | 'register' | 'forgot';
type ResetStep = 'request' | 'confirm';

export function LoginPage() {
  const { user, login } = useAuth();
  const [mode, setMode] = useState<AccessMode>('login');
  const [resetStep, setResetStep] = useState<ResetStep>('request');
  const [loginValue, setLoginValue] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/today" replace />;

  function switchMode(next: AccessMode) {
    setMode(next);
    setError('');
    setSuccess('');
    setPassword('');
    setPasswordConfirm('');
    if (next !== 'forgot') {
      setResetCode('');
      setResetStep('request');
    }
  }

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);
    try {
      await login(loginValue.trim(), password);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не вдалося увійти');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');
    if (password !== passwordConfirm) {
      setError('Паролі не збігаються.');
      return;
    }
    setSubmitting(true);
    try {
      const response = await registerPortalUser({
        displayName: displayName.trim(),
        login: loginValue.trim(),
        password,
        passwordConfirm,
      });
      setSuccess(response.message || 'Заявку на реєстрацію надіслано адміністратору.');
      setPassword('');
      setPasswordConfirm('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Заявку не надіслано.');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitResetRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);
    try {
      const response = await requestPasswordReset(loginValue.trim());
      setSuccess(response.message || 'Код надіслано у Telegram.');
      setResetStep('confirm');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Код не надіслано.');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitResetConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');
    if (password !== passwordConfirm) {
      setError('Нові паролі не збігаються.');
      return;
    }
    setSubmitting(true);
    try {
      const response = await confirmPasswordReset({
        login: loginValue.trim(),
        code: resetCode.trim(),
        password,
        passwordConfirm,
      });
      setSuccess(response.message || 'Пароль оновлено.');
      setPassword('');
      setPasswordConfirm('');
      window.setTimeout(() => switchMode('login'), 1600);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Пароль не оновлено.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page-v3">
      <section className="login-showcase-v3">
        <div className="login-brand-v3">
          <div className="login-brand-mark-v3">თ</div>
          <div className="login-brand-copy-v3">
            <strong>Тифліс</strong>
            <span>ресторан · Вінниця</span>
          </div>
        </div>

        <div className="login-story-v3">
          <span className="eyebrow">Внутрішній простір команди</span>
          <h1>Уся зміна — в одному ритмі.</h1>
          <p>Графік, сервіс, меню, резерви та каса зібрані в єдиному робочому порталі ресторану.</p>
          <div className="login-feature-grid-v3" aria-label="Можливості порталу">
            <article className="login-feature-v3"><CalendarDays size={21} /><strong>Графік</strong><span>Зміни всієї команди</span></article>
            <article className="login-feature-v3"><Soup size={21} /><strong>Меню</strong><span>Склад і подача страв</span></article>
            <article className="login-feature-v3"><ClipboardList size={21} /><strong>Резерви</strong><span>Зали, столи й таймлайн</span></article>
            <article className="login-feature-v3"><Banknote size={21} /><strong>Каса</strong><span>Виручка та особистий результат</span></article>
          </div>
        </div>

        <div className="login-showcase-footer-v3">
          <span><strong>Театральна, 20</strong> · Вінниця</span>
          <span>Тифліс Staff Portal v2</span>
        </div>
      </section>

      <section className="login-access-v3">
        <div className="login-card-v3 auth-card-v4">
          <div className="login-mobile-brand-v3">
            <div className="login-brand-mark-v3">თ</div>
            <div className="login-brand-copy-v3"><strong>Тифліс</strong><span>портал персоналу</span></div>
          </div>

          {mode !== 'forgot' ? (
            <div className="auth-tabs-v4" role="tablist" aria-label="Доступ до порталу">
              <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'is-active' : ''} onClick={() => switchMode('login')}>
                <KeyRound size={16} /> Увійти
              </button>
              <button type="button" role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'is-active' : ''} onClick={() => switchMode('register')}>
                <UserPlus size={16} /> Реєстрація
              </button>
            </div>
          ) : null}

          <div className="login-heading-v3">
            <span className="eyebrow">{mode === 'login' ? 'Захищений вхід' : mode === 'register' ? 'Новий працівник' : 'Відновлення доступу'}</span>
            <h2>{mode === 'login' ? 'Почати зміну' : mode === 'register' ? 'Подати заявку' : resetStep === 'request' ? 'Забули пароль?' : 'Введіть код'}</h2>
            <p>{mode === 'login'
              ? 'Введи свій робочий логін і пароль.'
              : mode === 'register'
                ? 'Створи логін і пароль. Доступ відкриється після підтвердження адміністратора.'
                : resetStep === 'request'
                  ? 'Введи логін. Одноразовий код і нагадування логіна прийдуть у прив’язаний Telegram.'
                  : 'Код діє 10 хвилин. Після перевірки задай новий пароль.'}</p>
          </div>

          {mode === 'login' ? (
            <form className="login-form-v3" onSubmit={submitLogin}>
              <AuthField label="Логін" icon={<UserRound size={18} />}><input autoComplete="username" value={loginValue} onChange={(event) => setLoginValue(event.target.value)} placeholder="Робочий логін" required /></AuthField>
              <AuthField label="Пароль" icon={<LockKeyhole size={18} />}><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Твій пароль" required /></AuthField>
              <button className="auth-forgot-link-v4" type="button" onClick={() => switchMode('forgot')}>Забули пароль?</button>
              <Feedback error={error} success={success} />
              <SubmitButton busy={submitting} label="Увійти до порталу" busyLabel="Перевіряємо доступ…" />
            </form>
          ) : null}

          {mode === 'register' ? (
            <form className="login-form-v3" onSubmit={submitRegistration}>
              <AuthField label="Ім’я в порталі" icon={<UserRound size={18} />}><input autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Наприклад, Дмитро" minLength={2} maxLength={120} required /></AuthField>
              <AuthField label="Логін для входу" icon={<KeyRound size={18} />}><input autoComplete="username" value={loginValue} onChange={(event) => setLoginValue(event.target.value)} placeholder="Літери, цифри, крапка або _" minLength={2} maxLength={40} required /></AuthField>
              <AuthField label="Пароль" icon={<LockKeyhole size={18} />}><input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Мінімум 8 символів, літера і цифра" minLength={8} required /></AuthField>
              <AuthField label="Повторіть пароль" icon={<ShieldCheck size={18} />}><input type="password" autoComplete="new-password" value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} placeholder="Ще раз той самий пароль" minLength={8} required /></AuthField>
              <Feedback error={error} success={success} />
              <SubmitButton busy={submitting} label="Надіслати заявку" busyLabel="Створюємо заявку…" />
            </form>
          ) : null}

          {mode === 'forgot' ? (
            <form className="login-form-v3" onSubmit={resetStep === 'request' ? submitResetRequest : submitResetConfirm}>
              <button className="auth-back-v4" type="button" onClick={() => switchMode('login')}><ArrowLeft size={16} /> Назад до входу</button>
              <AuthField label="Логін" icon={<UserRound size={18} />}><input autoComplete="username" value={loginValue} onChange={(event) => setLoginValue(event.target.value)} placeholder="Робочий логін" required readOnly={resetStep === 'confirm'} /></AuthField>
              {resetStep === 'confirm' ? (
                <>
                  <AuthField label="Код із Telegram" icon={<KeyRound size={18} />}><input inputMode="numeric" autoComplete="one-time-code" value={resetCode} onChange={(event) => setResetCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6 цифр" pattern="\d{6}" required /></AuthField>
                  <AuthField label="Новий пароль" icon={<LockKeyhole size={18} />}><input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Мінімум 8 символів" minLength={8} required /></AuthField>
                  <AuthField label="Повторіть пароль" icon={<ShieldCheck size={18} />}><input type="password" autoComplete="new-password" value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} placeholder="Повторіть новий пароль" minLength={8} required /></AuthField>
                </>
              ) : null}
              <Feedback error={error} success={success} />
              <SubmitButton busy={submitting} label={resetStep === 'request' ? 'Надіслати код у Telegram' : 'Зберегти новий пароль'} busyLabel="Перевіряємо…" />
              {resetStep === 'confirm' ? <button className="auth-forgot-link-v4" type="button" onClick={() => setResetStep('request')}>Надіслати новий код</button> : null}
            </form>
          ) : null}

          <div className="login-security-v3">
            <ShieldCheck size={19} />
            <p>Паролі зберігаються тільки в Supabase Auth у захищеному вигляді. Адміністратор не бачить ваш пароль.</p>
          </div>
        </div>
      </section>
    </main>
  );
}

function AuthField({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <label className="login-field-v3"><span>{label}</span><div className="login-input-v3">{icon}{children}</div></label>;
}

function Feedback({ error, success }: { error: string; success: string }) {
  return <>{error ? <div className="login-error-v3" role="alert">{error}</div> : null}{success ? <div className="auth-success-v4" role="status">{success}</div> : null}</>;
}

function SubmitButton({ busy, label, busyLabel }: { busy: boolean; label: string; busyLabel: string }) {
  return <button className="login-submit-v3" type="submit" disabled={busy}><span>{busy ? busyLabel : label}</span>{!busy ? <ArrowRight size={18} /> : null}</button>;
}
