import { Sparkles } from 'lucide-react';
import { DutyPlannerPage } from '../components/DutyPlannerPage';

export function HandoverPage() {
  return (
    <DutyPlannerPage
      planType="handover"
      eyebrow="Щовівторка"
      title="Здача зміни"
      description="Чек-лист здачі зміни на вибраний вівторок. Відповідального можна обрати лише серед офіціантів, які цього дня стоять у робочому графіку."
      icon={Sparkles}
    />
  );
}
