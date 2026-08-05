import { ClipboardCheck, Sparkles } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { DutyPlannerPage } from '../components/DutyPlannerPage';
import './duties-page.css';

type DutiesTab = 'daily' | 'handover';

export function DutiesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab: DutiesTab = searchParams.get('tab') === 'handover' ? 'handover' : 'daily';

  function selectTab(tab: DutiesTab) {
    setSearchParams(tab === 'daily' ? {} : { tab: 'handover' }, { replace: true });
  }

  return (
    <div className="duties-page-v1">
      <nav className="duties-page-tabs-v1" role="tablist" aria-label="Розділи обов’язків">
        <button
          id="duties-tab-daily"
          type="button"
          role="tab"
          aria-selected={activeTab === 'daily'}
          aria-controls="duties-panel"
          className={`duties-page-tab-v1${activeTab === 'daily' ? ' is-active' : ''}`}
          onClick={() => selectTab('daily')}
        >
          <span aria-hidden="true"><ClipboardCheck size={18} /></span>
          <span><strong>Щоденні обов’язки</strong><small>Обов’язки та робочі зони</small></span>
        </button>

        <button
          id="duties-tab-handover"
          type="button"
          role="tab"
          aria-selected={activeTab === 'handover'}
          aria-controls="duties-panel"
          className={`duties-page-tab-v1${activeTab === 'handover' ? ' is-active' : ''}`}
          onClick={() => selectTab('handover')}
        >
          <span aria-hidden="true"><Sparkles size={18} /></span>
          <span><strong>Здача зміни</strong><small>Окремий чек-лист на вівторок</small></span>
        </button>
      </nav>

      <section
        id="duties-panel"
        role="tabpanel"
        aria-labelledby={activeTab === 'daily' ? 'duties-tab-daily' : 'duties-tab-handover'}
      >
        {activeTab === 'daily' ? (
          <DutyPlannerPage
            key="daily"
            planType="daily"
            eyebrow="Робота на день"
            title="Щоденні обов’язки"
            description="Адміністратор обирає дату, бачить тільки офіціантів із робочою зміною в графіку, розподіляє обов’язки та зони й надсилає персональні повідомлення в Telegram."
            icon={ClipboardCheck}
          />
        ) : (
          <DutyPlannerPage
            key="handover"
            planType="handover"
            eyebrow="Щовівторка"
            title="Здача зміни"
            description="Чек-лист здачі зміни на вибраний вівторок. Відповідального можна обрати лише серед офіціантів, які цього дня стоять у робочому графіку."
            icon={Sparkles}
          />
        )}
      </section>
    </div>
  );
}
