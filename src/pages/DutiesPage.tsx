import { ClipboardCheck } from 'lucide-react';
import { DutyPlannerPage } from '../components/DutyPlannerPage';

export function DutiesPage() {
  return (
    <DutyPlannerPage
      planType="daily"
      eyebrow="Робота на день"
      title="Щоденні обов’язки"
      description="Адміністратор обирає дату, бачить тільки офіціантів із робочою зміною в графіку, розподіляє обов’язки та зони й надсилає персональні повідомлення в Telegram."
      icon={ClipboardCheck}
    />
  );
}
