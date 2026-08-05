import { useEffect, useState } from 'react';
import { getKyivDateKey, millisecondsUntilNextKyivDay } from '../lib/time';

export function useKyivDay(): string {
  const [dayKey, setDayKey] = useState(() => getKyivDateKey());

  useEffect(() => {
    let midnightTimer: number | undefined;

    const syncDay = () => {
      const nextDayKey = getKyivDateKey();
      setDayKey((currentDayKey) => (
        currentDayKey === nextDayKey ? currentDayKey : nextDayKey
      ));
    };

    const scheduleMidnightSync = () => {
      if (midnightTimer !== undefined) window.clearTimeout(midnightTimer);
      midnightTimer = window.setTimeout(() => {
        syncDay();
        scheduleMidnightSync();
      }, millisecondsUntilNextKyivDay());
    };

    const syncAndReschedule = () => {
      syncDay();
      scheduleMidnightSync();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') syncAndReschedule();
    };

    syncAndReschedule();
    window.addEventListener('focus', syncAndReschedule);
    window.addEventListener('online', syncAndReschedule);
    window.addEventListener('pageshow', syncAndReschedule);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (midnightTimer !== undefined) window.clearTimeout(midnightTimer);
      window.removeEventListener('focus', syncAndReschedule);
      window.removeEventListener('online', syncAndReschedule);
      window.removeEventListener('pageshow', syncAndReschedule);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return dayKey;
}
