import { Sparkles } from 'lucide-react';
import { PersistentDutyPlannerPage } from '../components/PersistentDutyPlannerPage';

export function HandoverPage() {
  return (
    <PersistentDutyPlannerPage
      planType="handover"
      eyebrow="Щовівторка"
      title="Здача зміни"
      description="Чек-лист здачі зміни на вибраний вівторок. Відповідального можна обрати лише серед офіціантів, які цього дня стоять у робочому графіку."
      icon={Sparkles}
    />
  );
}
