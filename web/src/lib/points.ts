export const POINT_CATEGORIES = [
  'EVENT',
  'SOCIAL',
  'COMMUNITY',
  'CONTENT',
  'VIEWS',
  'REFERRAL',
  'ADJUSTMENT',
] as const;

export type PointCategoryKey = (typeof POINT_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<PointCategoryKey, string> = {
  EVENT: 'Завозы и события',
  SOCIAL: 'Социальность',
  COMMUNITY: 'Вклад в жизнь KRUG',
  CONTENT: 'Контент и медиа',
  VIEWS: 'Бонусы за просмотры',
  REFERRAL: 'Рефералы',
  ADJUSTMENT: 'Корректировка',
};

export const KIND_LABELS: Record<string, string> = {
  AWARD: 'Начисление',
  ADJUSTMENT: 'Корректировка',
  REVERSAL: 'Отмена',
  RESERVE_SHARE: 'В резерв',
  RESERVE_WITHDRAW: 'Вывод из резерва',
  SEASON_SETTLEMENT: 'Зачёт резерва',
};

/** Суммы хранятся в сотых долях балла. */
export const UNIT = 100;
export const STEP = 5 * UNIT;
export const SHORT_AMOUNT = UNIT / 2;
export const ADJUSTMENT_STEP = UNIT / 2;
export const MIN_WITHDRAW = 10 * UNIT;
export const RESERVE_PERCENT = 30;

export function formatPoints(hundredths: number, signed = false): string {
  const sign = hundredths < 0 ? '-' : signed && hundredths > 0 ? '+' : '';
  const abs = Math.abs(hundredths);
  const whole = Math.floor(abs / UNIT);
  const rest = abs % UNIT;
  const fraction = rest === 0 ? '' : `,${String(rest).padStart(2, '0').replace(/0$/, '')}`;
  return `${sign}${whole}${fraction}`;
}

/** Разбирает «5», «0,5», «-10.5» в сотые доли. null, если это не число. */
export function parsePoints(input: string): number | null {
  const clean = input.trim().replace(',', '.');
  if (!/^-?\d+(\.\d{1,2})?$/.test(clean)) return null;
  const [whole, fraction = ''] = clean.replace('-', '').split('.');
  const value = Number(whole) * UNIT + Number(fraction.padEnd(2, '0'));
  return clean.startsWith('-') ? -value : value;
}

export function reserveShare(amount: number): number {
  return Math.round((amount * RESERVE_PERCENT) / 100);
}

/** Сумма обычного начисления: кратна 5, либо ровно 0.5 по пресету шортса. */
export function isValidAwardAmount(amount: number, presetAmount: number | null): boolean {
  if (amount <= 0) return false;
  if (amount % STEP === 0) return true;
  return presetAmount !== null && amount === presetAmount && amount === SHORT_AMOUNT;
}

export function isValidPresetAmount(amount: number | null): boolean {
  if (amount === null) return true;
  return amount > 0 && (amount % STEP === 0 || amount === SHORT_AMOUNT);
}

export function isValidAdjustment(amount: number): boolean {
  return amount !== 0 && amount % ADJUSTMENT_STEP === 0;
}

export function isValidWithdraw(amount: number, reserve: number): boolean {
  return amount >= MIN_WITHDRAW && amount % STEP === 0 && amount <= reserve;
}

/** Сколько можно вывести из резерва: наибольшее кратное 5. */
export function maxWithdraw(reserve: number): number {
  const value = Math.floor(reserve / STEP) * STEP;
  return value >= MIN_WITHDRAW ? value : 0;
}
