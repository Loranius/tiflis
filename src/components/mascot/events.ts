/** Fired by the cash screen after the viewer saved their own day (read by Хінкалик). */
export const CASH_SAVED_EVENT = 'tiflis:cash-saved';
export interface CashSavedDetail { amount: number; average: number | null }
