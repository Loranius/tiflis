import { secureApi } from './secureApi';

export type DutyPlanType = 'daily' | 'handover';
export type DutyStatus = 'pending' | 'done';

export interface DutyDefinition {
  key: string;
  title: string;
}

export interface ZoneDefinition {
  key: string;
  title: string;
}

export interface WorkingWaiter {
  id: string;
  name: string;
  shift: string;
  avatar: string | null;
  telegramLinked: boolean;
}

export interface DutyAssignment {
  id: number;
  plan_type: DutyPlanType;
  work_date: string;
  duty_key: string;
  assignee_id: string;
  assignee_name: string;
  assignee_shift: string | null;
  assignee_working: boolean;
  status: DutyStatus;
  completed_by: string | null;
  completed_at: string | null;
}

export interface ZoneAssignment {
  id: number;
  work_date: string;
  zone_key: string;
  slot: number;
  assignee_id: string;
  assignee_name: string;
  assignee_shift: string | null;
  assignee_working: boolean;
}

export interface DutyPublication {
  plan_type: DutyPlanType;
  work_date: string;
  published_by: string | null;
  published_at: string;
  telegram_sent: number;
  telegram_skipped: number;
}

export interface DutyPlanResponse {
  ok: true;
  planType: DutyPlanType;
  date: string;
  definitions: DutyDefinition[];
  zones: ZoneDefinition[];
  workingWaiters: WorkingWaiter[];
  assignments: DutyAssignment[];
  zoneAssignments: ZoneAssignment[];
  publication: DutyPublication | null;
  me: {
    id: string;
    name: string;
    shift: string | null;
  };
  permissions: { canManage: boolean };
}

export interface DutyPlanDraft {
  assignments: { duty_key: string; assignee_id: string }[];
  zones: { zone_key: string; slot: number; assignee_id: string }[];
}

export function loadDutyPlan(planType: DutyPlanType, date: string): Promise<DutyPlanResponse> {
  return secureApi<DutyPlanResponse>({
    action: 'planner_bootstrap',
    plan_type: planType,
    date,
  }, 'tiflis-duty-planner-api');
}

export function saveDutyPlan(
  planType: DutyPlanType,
  date: string,
  draft: DutyPlanDraft,
): Promise<{ ok: true; result: { duty_count: number; zone_count: number } }> {
  return secureApi({
    action: 'planner_save',
    plan_type: planType,
    date,
    assignments: draft.assignments,
    zones: draft.zones,
  }, 'tiflis-duty-planner-api');
}

export function publishDutyPlan(
  planType: DutyPlanType,
  date: string,
): Promise<{ ok: true; sent: number; skipped: number; recipients: string[] }> {
  return secureApi({
    action: 'planner_publish',
    plan_type: planType,
    date,
  }, 'tiflis-duty-planner-api');
}

export function setPlannedDutyStatus(
  assignmentId: number,
  status: DutyStatus,
): Promise<{ ok: true; assignment: { id: number; status: DutyStatus } }> {
  return secureApi({
    action: 'planner_set_status',
    assignment_id: assignmentId,
    status,
  }, 'tiflis-duty-planner-api');
}
