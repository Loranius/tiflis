import {
  ArrowRight,
  Banknote,
  CalendarDays,
  ClipboardList,
  LockKeyhole,
  ShieldCheck,
  Soup,
  UserRound,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router';
import { useAuth } from '../auth/AuthProvider';
import './login.css';

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
            <article className="login-feature-v3">
              <CalendarDays size={21} />
              <strong>Графік</strong>
              <span>Зміни всієї команди</span>
            </article>
            <article className="login-feature-v3">
              <Soup size={21} />
              <strong>Меню</strong>
              <span>Стоп-лист і склад страв</span>
            </article>
            <article className="login-feature-v3">
              <ClipboardList size={21} />
              <strong>Резерви</strong>
              <span>Зали, столи й таймлайн</span>
            </article>
            <article className="login-feature-v3">
              <Banknote size={21} />
              <strong>Каса</strong>
              <span>Виручка та особистий результат</span>
            </article>
          </div>
        </div>

        <div className="login-showcase-footer-v3">
          <span><strong>Театральна, 20</strong> · Вінниця</span>
          <span>Тифліс Staff Portal v2</span>
        </div>
      </section>

      <section className="login-access-v3">
        <div className="login-card-v3">
          <div className="login-mobile-brand-v3">
            <div className="login-brand-mark-v3">თ</div>
            <div className="login-brand-copy-v3">
              <strong>Тифліс</strong>
              <span>портал персоналу</span>
            </div>
          </div>

          <div className="login-heading-v3">
            <span className="eyebrow">Захищений вхід</span>
            <h2>Почати зміну</h2>
            <p>Введи свій робочий логін і пароль. Після входу портал відкриє інструменти відповідно до твоєї ролі.</p>
          </div>

          <form className="login-form-v3" onSubmit={submit}>
            <label className="login-field-v3">
              <span>Логін</span>
              <div className="login-input-v3">
                <UserRound size={18} />
                <input
                  autoComplete="username"
                  value={loginValue}
                  onChange={(event) => setLoginValue(event.target.value)}
                  placeholder="Робочий логін"
                  required
                />
              </div>
            </label>

            <label className="login-field-v3">
              <span>Пароль</span>
              <div className="login-input-v3">
                <LockKeyhole size={18} />
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

            {error ? <div className="login-error-v3" role="alert">{error}</div> : null}

            <button className="login-submit-v3" type="submit" disabled={submitting}>
              <span>{submitting ? 'Перевіряємо доступ…' : 'Увійти до порталу'}</span>
              {!submitting ? <ArrowRight size={18} /> : null}
            </button>
          </form>

          <div className="login-security-v3">
            <ShieldCheck size={19} />
            <p>Перший вхід безпечно переносить твій акаунт на Supabase Auth. Пароль не зберігається в браузері.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
