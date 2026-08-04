import { ArrowRight, Blocks, Database, ShieldCheck } from 'lucide-react';

interface ModulePageProps {
  title: string;
  description: string;
  source: string;
  nextStep: string;
}

export function ModulePage({ title, description, source, nextStep }: ModulePageProps) {
  return (
    <div className="module-page">
      <section className="module-hero">
        <div className="module-icon"><Blocks size={28} /></div>
        <div>
          <span className="eyebrow">Міграція модуля</span>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </section>

      <section className="migration-grid">
        <article className="migration-card">
          <Database size={22} />
          <span>Джерело логіки</span>
          <strong>{source}</strong>
          <p>Функції переносимо окремими сервісами й компонентами, а не копіюємо монолітний JavaScript.</p>
        </article>
        <article className="migration-card">
          <ShieldCheck size={22} />
          <span>Модель безпеки</span>
          <strong>Supabase Auth + RLS</strong>
          <p>Кожна дія отримує явне право доступу, а привілейовані операції виконуються на сервері.</p>
        </article>
        <article className="migration-card migration-card-accent">
          <ArrowRight size={22} />
          <span>Наступний крок</span>
          <strong>{nextStep}</strong>
          <p>Ця сторінка вже входить до нового роутера й ACL, тому модуль можна наповнювати без перебудови оболонки.</p>
        </article>
      </section>
    </div>
  );
}
