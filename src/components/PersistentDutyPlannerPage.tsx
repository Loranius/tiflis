import type { LucideIcon } from 'lucide-react';
import { useLayoutEffect, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useAuth } from '../auth/AuthProvider';
import type { DutyPlanType } from '../lib/dutyPlannerClient';
import { DutyPlannerPage } from './DutyPlannerPage';

interface PersistentDutyPlannerPageProps {
  planType: DutyPlanType;
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

interface PlannerHost {
  ownerId: string;
  planType: DutyPlanType;
  container: HTMLDivElement;
  root: Root;
}

const hosts = new Map<string, PlannerHost>();
let parkingLot: HTMLDivElement | null = null;

function hostKey(ownerId: string, planType: DutyPlanType): string {
  return `${ownerId}:${planType}`;
}

function getParkingLot(): HTMLDivElement {
  if (parkingLot?.isConnected) return parkingLot;

  parkingLot = document.createElement('div');
  parkingLot.id = 'tiflis-persistent-planner-parking';
  parkingLot.hidden = true;
  parkingLot.setAttribute('aria-hidden', 'true');
  document.body.appendChild(parkingLot);
  return parkingLot;
}

function removeOtherOwners(ownerId: string) {
  for (const [key, host] of hosts) {
    if (host.ownerId === ownerId) continue;
    host.root.unmount();
    host.container.remove();
    hosts.delete(key);
  }
}

function getOrCreateHost(
  ownerId: string,
  props: PersistentDutyPlannerPageProps,
): PlannerHost {
  const key = hostKey(ownerId, props.planType);
  const existing = hosts.get(key);
  if (existing) {
    existing.root.render(<DutyPlannerPage {...props} />);
    return existing;
  }

  const container = document.createElement('div');
  container.className = `persistent-duty-planner-host is-${props.planType}`;
  const root = createRoot(container);
  const host: PlannerHost = {
    ownerId,
    planType: props.planType,
    container,
    root,
  };

  hosts.set(key, host);
  root.render(<DutyPlannerPage {...props} />);
  return host;
}

export function PersistentDutyPlannerPage(props: PersistentDutyPlannerPageProps) {
  const { user } = useAuth();
  const mountRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (!user || !mountRef.current) return;

    removeOtherOwners(user.id);
    const host = getOrCreateHost(user.id, props);
    host.container.hidden = false;
    mountRef.current.appendChild(host.container);

    return () => {
      host.container.hidden = true;
      getParkingLot().appendChild(host.container);
    };
  }, [props.description, props.eyebrow, props.icon, props.planType, props.title, user]);

  return <div className="persistent-duty-planner-slot" ref={mountRef} />;
}
