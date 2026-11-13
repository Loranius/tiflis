import type { DutyPlanType } from './dutyPlannerClient';

export type StoredDutySelections = Record<string, string>;
export type StoredZoneSelections = Record<string, string[]>;
/** Zone bookings as typed in the form, keyed `${zone_key}:${slot}`. */
export interface StoredBooking {
  time: string;
  /** Adults, as typed. */
  guests: string;
  /** Children, as typed; '0' or empty means none. */
  children: string;
  name: string;
  menu: boolean;
  /** Banquet advance, ₴, as typed (halls only). */
  advance: string;
  /** Перерахунок: the whole bill is already paid, no advance (halls only). */
  paid: boolean;
}
export type StoredBookings = Record<string, StoredBooking>;

export interface DutyPlannerDraftSnapshot {
  duties: StoredDutySelections;
  zones: StoredZoneSelections;
  bookings?: StoredBookings;
}

interface StoredDraft extends DutyPlannerDraftSnapshot {
  updatedAt: number;
}

const STORAGE_PREFIX = 'tiflis.duty-planner.v1';
const DRAFT_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const memoryStorage = new Map<string, string>();

function storageKey(ownerId: string, planType: DutyPlanType, suffix: string): string {
  return `${STORAGE_PREFIX}:${ownerId}:${planType}:${suffix}`;
}

function readValue(key: string): string | null {
  try {
    return window.localStorage.getItem(key) ?? memoryStorage.get(key) ?? null;
  } catch {
    return memoryStorage.get(key) ?? null;
  }
}

function writeValue(key: string, value: string) {
  memoryStorage.set(key, value);
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // The in-memory fallback still preserves the draft while the portal is open.
  }
}

function removeValue(key: string) {
  memoryStorage.delete(key);
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Storage may be unavailable in a restricted WebView.
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeDuties(value: unknown): StoredDutySelections | null {
  if (!isObject(value)) return null;
  const result: StoredDutySelections = {};
  for (const [key, assigneeId] of Object.entries(value)) {
    if (typeof assigneeId === 'string') result[key] = assigneeId;
  }
  return result;
}

function normalizeZones(value: unknown): StoredZoneSelections | null {
  if (!isObject(value)) return null;
  const result: StoredZoneSelections = {};
  for (const [key, assignees] of Object.entries(value)) {
    if (!Array.isArray(assignees)) continue;
    result[key] = assignees
      .filter((assigneeId): assigneeId is string => typeof assigneeId === 'string')
      .slice(0, 3);
  }
  return result;
}

function normalizeBookings(value: unknown): StoredBookings {
  if (!isObject(value)) return {};
  const result: StoredBookings = {};
  for (const [key, booking] of Object.entries(value)) {
    if (!isObject(booking)) continue;
    result[key] = {
      time: typeof booking.time === 'string' ? booking.time : '',
      guests: typeof booking.guests === 'string' ? booking.guests : '',
      children: typeof booking.children === 'string' ? booking.children : '0',
      name: typeof booking.name === 'string' ? booking.name : '',
      menu: booking.menu === true,
      advance: typeof booking.advance === 'string' ? booking.advance : '',
      paid: booking.paid === true,
    };
  }
  return result;
}

export function readDutyPlannerDate(
  ownerId: string,
  planType: DutyPlanType,
): string | null {
  const value = readValue(storageKey(ownerId, planType, 'last-date'));
  return value && DATE_PATTERN.test(value) ? value : null;
}

export function rememberDutyPlannerDate(
  ownerId: string,
  planType: DutyPlanType,
  date: string,
) {
  if (DATE_PATTERN.test(date)) writeValue(storageKey(ownerId, planType, 'last-date'), date);
}

export function readDutyPlannerDraft(
  ownerId: string,
  planType: DutyPlanType,
  date: string,
): DutyPlannerDraftSnapshot | null {
  const key = storageKey(ownerId, planType, `draft:${date}`);
  const raw = readValue(key);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isObject(parsed) || typeof parsed.updatedAt !== 'number') {
      removeValue(key);
      return null;
    }
    if (Date.now() - parsed.updatedAt > DRAFT_TTL_MS) {
      removeValue(key);
      return null;
    }

    const duties = normalizeDuties(parsed.duties);
    const zones = normalizeZones(parsed.zones);
    if (!duties || !zones) {
      removeValue(key);
      return null;
    }
    return { duties, zones, bookings: normalizeBookings(parsed.bookings) };
  } catch {
    removeValue(key);
    return null;
  }
}

export function rememberDutyPlannerDraft(
  ownerId: string,
  planType: DutyPlanType,
  date: string,
  snapshot: DutyPlannerDraftSnapshot,
) {
  const stored: StoredDraft = {
    duties: snapshot.duties,
    zones: snapshot.zones,
    bookings: snapshot.bookings ?? {},
    updatedAt: Date.now(),
  };
  writeValue(storageKey(ownerId, planType, `draft:${date}`), JSON.stringify(stored));
}

export function clearDutyPlannerDraft(
  ownerId: string,
  planType: DutyPlanType,
  date: string,
) {
  removeValue(storageKey(ownerId, planType, `draft:${date}`));
}
