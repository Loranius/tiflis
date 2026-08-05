import { readFile, writeFile } from 'node:fs/promises';

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Patch target not found: ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`Patch target is not unique: ${label}`);
  return source.slice(0, first) + after + source.slice(first + before.length);
}

const cashPath = 'src/pages/CashPage.tsx';
let cash = await readFile(cashPath, 'utf8');

cash = replaceOnce(cash, "  Medal,\n", '', 'remove obsolete Medal import');

cash = replaceOnce(
  cash,
  "import { useAuth } from '../auth/AuthProvider';\n",
  "import { useAuth } from '../auth/AuthProvider';\nimport { CashLeaderboard } from '../components/CashLeaderboard';\n",
  'CashLeaderboard import',
);

cash = replaceOnce(
  cash,
  `interface LeaderboardRow {
  userId: string;
  name: string;
  rank: number;
  total: number | null;
  relative: number;
  mine: boolean;
}`,
  `interface LeaderboardRow {
  userId: string;
  name: string;
  rank: number;
  total: number | null;
  relative: number;
  mine: boolean;
  avatar: string | null;
  role: string;
  role2: string | null;
}`,
  'leaderboard response type',
);

const oldLeaderboard = `      {!loading && data && tab === 'leaderboard' ? <section className="cash-leaderboard-card-v2">
        <div className="cash-section-heading-v2"><div><span className="eyebrow">Командна динаміка</span><h3>Топ каси</h3></div><Medal size={24} /></div>
        <div className="cash-leaderboard-periods-v3" role="group" aria-label="Період топу каси">
          {([['first', '1–14 + ставка 15'], ['second', \`15–\${daysInMonth}\`], ['month', 'Увесь місяць'], ['year', String(monthDate.getFullYear())]] as const).map(([key, label]) => <button type="button" key={key} className={leaderboardPeriod === key ? 'is-active' : ''} onClick={() => setLeaderboardPeriod(key)}>{label}</button>)}
        </div>
        <p className="cash-period-explain-v3">{leaderboardPeriod === 'first' ? '4% каси за 1–14 число + ставки за робочі дні 1–15.' : leaderboardPeriod === 'second' ? \`4% каси за 15–\${daysInMonth} число + ставки за робочі дні 16–\${daysInMonth}.\` : leaderboardPeriod === 'year' ? 'Загальна розрахункова виплата за вибраний рік.' : 'Повна розрахункова виплата за місяць.'}</p>
        <div className="cash-leaderboard-list-v2">{data.leaderboard.map((row) => <article className={\`\${row.mine ? 'is-mine' : ''} \${row.rank === 1 ? 'is-leader' : ''}\`} key={row.userId}><span className="cash-rank-v2">{row.rank <= 3 ? ['🥇', '🥈', '🥉'][row.rank - 1] : \`#\${row.rank}\`}</span><span className="cash-leader-avatar-v2">{initials(row.name)}</span><div><strong>{row.name}{row.mine ? ' · ви' : ''}</strong><span><i style={{ width: \`\${Math.max(4, row.relative)}%\` }} /></span></div><b>{row.total === null ? 'позиція' : money(row.total)}</b></article>)}</div>
        {!data.me.canViewAll ? <p className="cash-privacy-note-v2">Суми інших працівників приховані — видно лише позицію.</p> : null}
      </section> : null}`;

const newLeaderboard = `      {!loading && data && tab === 'leaderboard' ? (
        <CashLeaderboard
          rows={data.leaderboard}
          period={leaderboardPeriod}
          daysInMonth={daysInMonth}
          year={monthDate.getFullYear()}
          canViewAll={data.me.canViewAll}
          onPeriodChange={setLeaderboardPeriod}
        />
      ) : null}`;

cash = replaceOnce(cash, oldLeaderboard, newLeaderboard, 'leaderboard JSX');
await writeFile(cashPath, cash, 'utf8');

const securePath = 'supabase/functions/tiflis-secure-api/index.ts';
let secure = await readFile(securePath, 'utf8');

secure = replaceOnce(
  secure,
  `serviceClient.from("cash").select("id,user_id,date,cash,tips,first_cash").gte("date", range.start).lt("date", range.end).order("date", { ascending: true }),`,
  `serviceClient.from("cash").select("id,user_id,date,cash,tips,first_cash").eq("user_id", viewStaff.id).gte("date", range.start).lt("date", range.end).order("date", { ascending: true }),`,
  'personal cash query scope',
);

secure = replaceOnce(
  secure,
  `      const maxTotal = totals[0]?.total || 0;
      const leaderboard = totals.map(({ staff, total }, index) => ({
        userId: staff.id,
        name: staff.display_name || staff.login,
        rank: index + 1,
        total: isAdmin(profile) || staff.id === profile.legacy_user_id ? Math.round(total * 100) / 100 : null,
        relative: maxTotal > 0 ? Math.round((total / maxTotal) * 1000) / 10 : 0,
        mine: staff.id === profile.legacy_user_id,
      }));`,
  `      const maxTotal = totals[0]?.total || 0;
      const adminView = isAdmin(profile);
      const leaderboard = totals.map(({ staff, total }, index) => {
        const mine = staff.id === profile.legacy_user_id;
        const exactRelative = maxTotal > 0 ? Math.round((total / maxTotal) * 1000) / 10 : 0;
        const relative = adminView || mine
          ? exactRelative
          : Math.max(0, Math.min(100, Math.round(exactRelative / 5) * 5));
        return {
          userId: staff.id,
          name: staff.display_name || staff.login,
          rank: index + 1,
          total: adminView || mine ? Math.round(total * 100) / 100 : null,
          relative,
          mine,
          avatar: staff.avatar,
          role: normalizeRole(staff.role),
          role2: staff.role2 ? normalizeRole(staff.role2) : null,
        };
      });`,
  'privacy-first leaderboard payload',
);

await writeFile(securePath, secure, 'utf8');
console.log('Phase 2 cash privacy patch applied successfully.');
