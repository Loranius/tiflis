import { readFile, writeFile } from 'node:fs/promises';

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Patch target not found: ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`Patch target is not unique: ${label}`);
  return source.slice(0, first) + after + source.slice(first + before.length);
}

const pagePath = 'src/pages/SchedulePage.tsx';
let page = await readFile(pagePath, 'utf8');

page = replaceOnce(
  page,
  `const ROLE_LABELS: Record<string, string> = {
  admin: 'Адміністрація', waiter: 'Офіціанти', bar: 'Бар', chef: 'Шеф-кухарі', cook: 'Кухня',
  hostess: 'Хостес', runner: 'Ранери', sommelier: 'Сомельє', staff: 'Команда',
};`,
  `const ROLE_LABELS: Record<string, string> = {
  admin: 'Адміністрація', waiter: 'Офіціанти', bar: 'Бар', chef: 'Шеф-кухарі', cook: 'Кухня',
  hostess: 'Хостес', runner: 'Ранери', sommelier: 'Сомельє', staff: 'Команда',
};
const PERSON_ROLE_LABELS: Record<string, string> = {
  admin: 'Адміністратор', sysadmin: 'Системний адміністратор', waiter: 'Офіціант',
  bar: 'Бармен', chef: 'Шеф-кухар', cook: 'Кухар', hostess: 'Хостес',
  runner: 'Ранер', sommelier: 'Сомельє', trainee: 'Стажер', staff: 'Працівник',
};`,
  'person role labels',
);

page = replaceOnce(
  page,
  `function roleLabel(role: string): string {
  return ROLE_LABELS[role] || role;
}`,
  `function roleLabel(role: string): string {
  return ROLE_LABELS[role] || role;
}

function staffRoleTitle(staff: ScheduleStaff): string {
  const roles = staffRoles(staff);
  if (roles.includes('waiter') && roles.includes('bar')) return 'Бармен-офіціант';
  if (roles.includes('waiter') && roles.includes('sommelier')) return 'Сомельє-офіціант';
  if (roles.includes('waiter') && roles.includes('hostess')) return 'Хостес-офіціант';
  if (roles.includes('waiter') && roles.includes('runner')) return 'Ранер-офіціант';
  return roles.map((role) => PERSON_ROLE_LABELS[role] || role).join(' · ') || 'Працівник';
}`,
  'staff role title',
);

page = replaceOnce(
  page,
  `<small>{staffRoles(staff).map(roleLabel).join(' · ')}</small>`,
  `<small>{staffRoleTitle(staff)}</small>`,
  'schedule person role',
);

await writeFile(pagePath, page, 'utf8');

const cssPath = 'src/pages/schedule.css';
let css = await readFile(cssPath, 'utf8');
css = replaceOnce(
  css,
  `.schedule-table-scroll{max-width:100%;overflow:auto;overscroll-behavior:contain;scrollbar-color:rgba(215,182,108,.24) transparent}`,
  `.schedule-table-scroll{max-width:100%;overflow-x:auto;overflow-y:visible;overscroll-behavior-x:contain;overscroll-behavior-y:auto;touch-action:pan-x pan-y;-webkit-overflow-scrolling:touch;scrollbar-color:rgba(215,182,108,.24) transparent}`,
  'schedule scroll behavior',
);
await writeFile(cssPath, css, 'utf8');

console.log('Phase 4 schedule patch applied.');
