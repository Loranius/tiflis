import { ArrowRight, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router';
import { useAuth } from '../auth/AuthProvider';

export function LoginPage() {
  const { user, login } = useAuth();
  const [loginValue, setLoginValue] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/today" replace />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(loginValue.trim(), password);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не вдалося увійти');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-hero" aria-hidden="true">
        <div className="hero-orbit hero-orbit-one" />
        <div className="hero-orbit hero-orbit-two" />
        <div className="hero-copy">
          <span className="eyebrow">Внутрішній портал команди</span>
          <h1>Тифліс</h1>
          <p>Графік, каса, меню, резерви й робочі інструменти в одному захищеному просторі.</p>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <div className="login-logo">თ</div>
          <div className="login-heading">
            <span className="eyebrow">Тифліс · v2</span>
            <h2>Вхід для персоналу</h2>
            <p>Використай свій звичний логін і пароль зі старого порталу.</p>
          </div>

          <form className="login-form" onSubmit={submit}>
            <label>
              <span>Логін</span>
              <input
                autoComplete="username"
                value={loginValue}
                onChange={(event) => setLoginValue(event.target.value)}
                placeholder="Як у старому порталі"
                required
              />
            </label>
            <label>
              <span>Пароль</span>
              <div className="input-with-icon">
                <LockKeyhole size={17} />
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Твій пароль"
                  required
                />
              </div>
            </label>

            {error ? <div className="form-error" role="alert">{error}</div> : null}

            <button className="primary-button" type="submit" disabled={submitting}>
              <span>{submitting ? 'Перевіряємо…' : 'Увійти'}</span>
              {!submitting ? <ArrowRight size={18} /> : null}
            </button>
          </form>

          <div className="security-note">
            <ShieldCheck size={18} />
            <p>Під час першого входу акаунт автоматично переходить на Supabase Auth. Пароль у браузері не зберігається.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
