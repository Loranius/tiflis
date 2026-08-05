import { ClipboardCheck } from 'lucide-react';
import { PersistentDutyPlannerPage } from '../components/PersistentDutyPlannerPage';

export function DutiesPage() {
  return (
    <PersistentDutyPlannerPage
      planType="daily"
      eyebrow="Робота на день"
      title="Щоденні обов’язки"
      description="Адміністратор обирає дату, бачить тільки офіціантів із робочою зміною в графіку, розподіляє обов’язки та зони й надсилає персональні повідомлення в Telegram."
      icon={ClipboardCheck}
    />
  );
}
