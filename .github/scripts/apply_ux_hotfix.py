from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"Missing pattern: {label}")
    return text.replace(old, new, 1)


cash_path = Path("src/pages/CashPage.tsx")
cash = cash_path.read_text()
cash = cash.replace("  Plus,\n", "")
cash = replace_once(
    cash,
    "type CashTab = 'overview' | 'entries' | 'leaderboard' | 'team';\n",
    "type CashTab = 'overview' | 'entries' | 'leaderboard' | 'team';\ntype LeaderboardPeriod = 'first' | 'second' | 'month' | 'year';\n",
    "cash period type",
)
cash = replace_once(
    cash,
    "  leaderboard: LeaderboardRow[];\n  ratings: StaffRating[];",
    "  leaderboard: LeaderboardRow[];\n  leaderboardPeriod?: LeaderboardPeriod;\n  ratings: StaffRating[];",
    "cash response period",
)

summary_pattern = re.compile(
    r"function summarize\(entries: CashEntry\[\], extras: ExtraWage\[\], month: string, fromDay: number, toDay: number\) \{.*?\n\}\n\nexport function CashPage",
    re.S,
)
summary_replacement = """function inDayRange(value: string, month: string, fromDay: number, toDay: number): boolean {
  return value >= dateForDay(month, fromDay) && value <= dateForDay(month, toDay);
}

function summarizePayroll(
  entries: CashEntry[],
  extras: ExtraWage[],
  month: string,
  cashFrom: number,
  cashTo: number,
  baseFrom: number,
  baseTo: number,
  extraFrom = baseFrom,
  extraTo = baseTo,
) {
  const cashEntries = entries.filter((entry) => inDayRange(entry.date, month, cashFrom, cashTo));
  const baseEntries = entries.filter((entry) => inDayRange(entry.date, month, baseFrom, baseTo));
  const scopedExtras = extras.filter((entry) => inDayRange(entry.date, month, extraFrom, extraTo));
  const cash = cashEntries.reduce((sum, entry) => sum + asNumber(entry.cash), 0);
  const tips = cashEntries.reduce((sum, entry) => sum + asNumber(entry.tips), 0);
  const extra = scopedExtras.reduce((sum, entry) => sum + asNumber(entry.amount), 0);
  const workDays = baseEntries.filter((entry) => asNumber(entry.cash) > 0 || asNumber(entry.tips) > 0).length;
  return { cash, tips, extra, workDays, wage: cash * 0.04 + workDays * 200 + extra };
}

export function CashPage"""
cash, count = summary_pattern.subn(summary_replacement, cash, count=1)
if count != 1:
    raise SystemExit("Could not replace cash summary")

cash = replace_once(
    cash,
    "  const [tab, setTab] = useState<CashTab>('overview');\n",
    "  const [tab, setTab] = useState<CashTab>('overview');\n  const [leaderboardPeriod, setLeaderboardPeriod] = useState<LeaderboardPeriod>('first');\n",
    "cash period state",
)
cash = replace_once(
    cash,
    "  const [editor, setEditor] = useState<DayEditorState | null>(null);",
    """  const [editor, setEditor] = useState<DayEditorState>(() => {
    const now = new Date();
    return {
      date: `${monthKey(now)}-${String(now.getDate()).padStart(2, '0')}`,
      cash: '', tips: '', extra: '', note: '',
    };
  });""",
    "inline editor state",
)
cash = replace_once(
    cash,
    "  const requestId = useRef(0);",
    "  const requestId = useRef(0);\n  const quickEntryRef = useRef<HTMLElement | null>(null);",
    "quick entry ref",
)
cash = replace_once(
    cash,
    "        action: 'cash_bootstrap', month, user_id: viewUserId,",
    "        action: 'cash_bootstrap', month, user_id: viewUserId, leaderboard_period: leaderboardPeriod,",
    "leaderboard request",
)
cash = replace_once(cash, "  }, [month, viewUserId]);", "  }, [leaderboardPeriod, month, viewUserId]);", "load deps")
cash = replace_once(
    cash,
    "  const fullMonth = useMemo(() => summarize(entries, extras, month, 1, daysInMonth), [daysInMonth, entries, extras, month]);\n  const firstHalf = useMemo(() => summarize(entries, extras, month, 1, Math.min(14, daysInMonth)), [daysInMonth, entries, extras, month]);\n  const secondHalf = useMemo(() => summarize(entries, extras, month, 15, daysInMonth), [daysInMonth, entries, extras, month]);",
    "  const fullMonth = useMemo(() => summarizePayroll(entries, extras, month, 1, daysInMonth, 1, daysInMonth), [daysInMonth, entries, extras, month]);\n  const firstHalf = useMemo(() => summarizePayroll(entries, extras, month, 1, Math.min(14, daysInMonth), 1, Math.min(15, daysInMonth), 1, Math.min(15, daysInMonth)), [daysInMonth, entries, extras, month]);\n  const secondHalf = useMemo(() => summarizePayroll(entries, extras, month, 15, daysInMonth, Math.min(16, daysInMonth), daysInMonth, Math.min(16, daysInMonth), daysInMonth), [daysInMonth, entries, extras, month]);",
    "payroll periods",
)
cash = replace_once(
    cash,
    "  function openDay(date: string) {",
    """  useEffect(() => {
    if (!editor.date.startsWith(`${month}-`)) openDay(defaultDate);
  }, [defaultDate, month]);

  function openDay(date: string) {""",
    "editor month sync",
)
cash = replace_once(
    cash,
    "  async function saveDay() {\n    if (!editor || !data) return;",
    """  function selectDay(date: string) {
    openDay(date);
    window.requestAnimationFrame(() => quickEntryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  async function saveDay() {
    if (!data) return;""",
    "inline save",
)
cash = cash.replace("      setEditor(null);\n      await load();", "      await load();", 1)
cash = replace_once(
    cash,
    "  async function deleteDay() {\n    if (!editor || !data) return;",
    "  async function deleteDay() {\n    if (!data) return;",
    "inline delete",
)
cash = cash.replace(
    "      setEditor(null);\n      await load();",
    "      setEditor({ ...editor, cash: '', tips: '', extra: '', note: '' });\n      await load();",
    1,
)
cash = re.sub(
    r"\n\s*\{canEdit \? <button type=\"button\" className=\"cash-add-button\".*?</button> : null\}",
    "",
    cash,
    count=1,
)

quick_entry = """      {!loading && data && canEdit ? (
        <section className="cash-quick-entry-v3" ref={quickEntryRef}>
          <header>
            <div><span className="eyebrow">Денний запис</span><h3>{formatDay(editor.date)}</h3><p>{selectedStaff?.name || 'Моя каса'} · базова ставка 200 ₴ за робочий день</p></div>
            <label><span>Дата</span><input type="date" value={editor.date} min={`${month}-01`} max={`${month}-${String(daysInMonth).padStart(2, '0')}`} onChange={(event) => openDay(event.target.value)} /></label>
          </header>
          <div className="cash-quick-fields-v3">
            <label><span>Каса, ₴</span><input inputMode="decimal" type="number" min="0" value={editor.cash} onChange={(event) => setEditor({ ...editor, cash: event.target.value })} placeholder="0" /></label>
            <label><span>Чайові, ₴</span><input inputMode="decimal" type="number" min="0" value={editor.tips} onChange={(event) => setEditor({ ...editor, tips: event.target.value })} placeholder="0" /></label>
            <label><span>Додаткова ставка / доплата, ₴</span><input inputMode="decimal" type="number" min="0" value={editor.extra} onChange={(event) => setEditor({ ...editor, extra: event.target.value })} placeholder="0" /></label>
            <label className="is-wide"><span>Причина доплати</span><input type="text" maxLength={300} value={editor.note} onChange={(event) => setEditor({ ...editor, note: event.target.value })} placeholder="Банкет, підміна, додаткові години…" /></label>
          </div>
          <footer>
            <div><span>Орієнтовно за день</span><strong>{money(asNumber(editor.cash) * 0.04 + (asNumber(editor.cash) > 0 || asNumber(editor.tips) > 0 ? 200 : 0) + asNumber(editor.extra))}</strong></div>
            <div className="cash-quick-actions-v3">{entryByDate.has(editor.date) || extraByDate.has(editor.date) ? <button type="button" className="is-danger" onClick={() => void deleteDay()} disabled={saving}><Trash2 size={17} /> Очистити</button> : null}<button type="button" className="is-primary" onClick={() => void saveDay()} disabled={saving}>{saving ? <RefreshCw size={17} className="is-spinning" /> : <Check size={17} />} Зберегти день</button></div>
          </footer>
        </section>
      ) : null}

"""
cash = replace_once(
    cash,
    '      <nav className="cash-tabs-v2" aria-label="Розділи каси">',
    quick_entry + '      <nav className="cash-tabs-v2" aria-label="Розділи каси">',
    "quick entry insertion",
)
cash = cash.replace("onClick={() => canEdit && openDay(date)}", "onClick={() => canEdit && selectDay(date)}")
cash = cash.replace("onClick={() => canEdit && openDay(entry.date)}", "onClick={() => canEdit && selectDay(entry.date)}")

leaderboard_pattern = re.compile(
    r"\{!loading && data && tab === 'leaderboard' \? <section className=\"cash-leaderboard-card-v2\">.*?</section> : null\}",
    re.S,
)
leaderboard_replacement = """{!loading && data && tab === 'leaderboard' ? <section className="cash-leaderboard-card-v2">
        <div className="cash-section-heading-v2"><div><span className="eyebrow">Командна динаміка</span><h3>Топ каси</h3></div><Medal size={24} /></div>
        <div className="cash-leaderboard-periods-v3" role="group" aria-label="Період топу каси">
          {([['first', '1–14 + ставка 15'], ['second', `15–${daysInMonth}`], ['month', 'Увесь місяць'], ['year', String(monthDate.getFullYear())]] as const).map(([key, label]) => <button type="button" key={key} className={leaderboardPeriod === key ? 'is-active' : ''} onClick={() => setLeaderboardPeriod(key)}>{label}</button>)}
        </div>
        <p className="cash-period-explain-v3">{leaderboardPeriod === 'first' ? '4% каси за 1–14 число + ставки за робочі дні 1–15.' : leaderboardPeriod === 'second' ? `4% каси за 15–${daysInMonth} число + ставки за робочі дні 16–${daysInMonth}.` : leaderboardPeriod === 'year' ? 'Загальна розрахункова виплата за вибраний рік.' : 'Повна розрахункова виплата за місяць.'}</p>
        <div className="cash-leaderboard-list-v2">{data.leaderboard.map((row) => <article className={`${row.mine ? 'is-mine' : ''} ${row.rank === 1 ? 'is-leader' : ''}`} key={row.userId}><span className="cash-rank-v2">{row.rank <= 3 ? ['🥇', '🥈', '🥉'][row.rank - 1] : `#${row.rank}`}</span><span className="cash-leader-avatar-v2">{initials(row.name)}</span><div><strong>{row.name}{row.mine ? ' · ви' : ''}</strong><span><i style={{ width: `${Math.max(4, row.relative)}%` }} /></span></div><b>{row.total === null ? 'позиція' : money(row.total)}</b></article>)}</div>
        {!data.me.canViewAll ? <p className="cash-privacy-note-v2">Суми інших працівників приховані — видно лише позицію.</p> : null}
      </section> : null}"""
cash, count = leaderboard_pattern.subn(leaderboard_replacement, cash, count=1)
if count != 1:
    raise SystemExit("Could not replace leaderboard")

cash, count = re.subn(
    r"\n\s*\{editor \? <div className=\"cash-sheet-backdrop-v2\".*?</div> : null\}\n",
    "\n",
    cash,
    count=1,
    flags=re.S,
)
if count != 1:
    raise SystemExit("Could not remove old cash modal")
cash_path.write_text(cash)

schedule_path = Path("src/pages/SchedulePage.tsx")
schedule = schedule_path.read_text()
schedule = replace_once(
    schedule,
    "interface PickerState {\n  staff: ScheduleStaff;\n  date: string;\n  value: ShiftCode;\n}",
    "interface PickerState {\n  staff: ScheduleStaff;\n  date: string;\n  value: ShiftCode;\n  anchor: { left: number; top: number };\n}",
    "picker interface",
)
schedule = replace_once(
    schedule,
    "  function openPicker(staff: ScheduleStaff, date: string) {\n    if (canEditStaff(staff)) setPicker({ staff, date, value: entries[cellKey(staff.id, date)] || '' });\n  }",
    """  function openPicker(staff: ScheduleStaff, date: string, target: HTMLButtonElement) {
    if (!canEditStaff(staff)) return;
    const rect = target.getBoundingClientRect();
    const width = Math.min(360, window.innerWidth - 24);
    const left = Math.max(12, Math.min(window.innerWidth - width - 12, rect.left + rect.width / 2 - width / 2));
    const preferredTop = rect.bottom + 8;
    const top = Math.max(12, Math.min(window.innerHeight - 330, preferredTop));
    setPicker({ staff, date, value: entries[cellKey(staff.id, date)] || '', anchor: { left, top } });
  }""",
    "picker positioning",
)
schedule = schedule.replace(
    "onClick={() => openPicker(staff, date)}",
    "onClick={(event) => openPicker(staff, date, event.currentTarget)}",
)
schedule = replace_once(
    schedule,
    '<section className="schedule-picker-sheet" role="dialog"',
    '<section className="schedule-picker-sheet" style={{ left: picker.anchor.left, top: picker.anchor.top }} role="dialog"',
    "picker style",
)
schedule_path.write_text(schedule)

menu_path = Path("src/pages/MenuPage.tsx")
menu = menu_path.read_text()
menu = menu.replace("  const [stopsOnly, setStopsOnly] = useState(false);\n", "")
menu = menu.replace("      if (stopsOnly && !item.stopped) return false;\n", "")
menu = menu.replace(", stopsOnly]);", "]);" )
menu = re.sub(
    r"\n\s*<button type=\"button\" className=\{stopsOnly \? 'is-danger-active' : ''\}.*?</button>",
    "",
    menu,
    count=1,
)
menu = menu.replace("        <article><AlertTriangle size={19} /><span>У стопі</span><strong>{metrics.stopped}</strong></article>\n", "")
menu = re.sub(
    r"\n\s*\{data\?\.permissions\.canToggleStop \? <button type=\"button\" className=\{`menu-stop-button-v2.*?</button> : null\}",
    "",
    menu,
    count=1,
)
menu = re.sub(
    r"\{data\?\.permissions\.canToggleStop \? <button type=\"button\" className=\{selected\.stopped \? 'is-return' : 'is-stop'\}.*?</button> : <span />\}",
    "<span />",
    menu,
    count=1,
)
menu = re.sub(
    r"\n\s*async function toggleStop\(item: MenuItem, stopped: boolean\) \{.*?\n  \}\n",
    "\n",
    menu,
    count=1,
    flags=re.S,
)
menu = menu.replace(
    "Швидкий пошук по 315 позиціях, фото, склад, алергени, час кухні та живий стоп-лист без перезавантажень.",
    "Швидкий пошук по 315 позиціях, фото, склад, алергени та час кухні без зайвих службових перемикачів.",
)
menu_path.write_text(menu)

index_path = Path("index.html")
index = index_path.read_text()
index = replace_once(
    index,
    "    <title>Тифліс · портал персоналу</title>\n",
    "    <title>Тифліс · портал персоналу</title>\n    <link rel=\"icon\" href=\"data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 64 64%27%3E%3Crect width=%2764%27 height=%2764%27 rx=%2718%27 fill=%27%23111b15%27/%3E%3Ctext x=%2732%27 y=%2744%27 text-anchor=%27middle%27 font-size=%2740%27 fill=%27%23d7b66c%27%3E%E1%83%97%3C/text%3E%3C/svg%3E\" />\n",
    "favicon",
)
index_path.write_text(index)

Path("src/pages/cash.css").write_text(Path("src/pages/cash.css").read_text() + """

/* Inline daily cash entry */
.cash-quick-entry-v3{scroll-margin-top:110px;display:grid;gap:18px;padding:22px;border:1px solid rgba(215,182,108,.22);border-radius:22px;background:linear-gradient(145deg,rgba(215,182,108,.07),var(--surface));box-shadow:var(--shadow)}
.cash-quick-entry-v3>header,.cash-quick-entry-v3>footer{display:flex;align-items:center;justify-content:space-between;gap:18px}.cash-quick-entry-v3 h3{margin:6px 0 4px;font-family:'Prata',serif;font-size:27px;font-weight:400}.cash-quick-entry-v3 p{margin:0;color:var(--muted);font-size:11px}.cash-quick-entry-v3 label{display:grid;gap:7px}.cash-quick-entry-v3 label>span{color:var(--muted);font-size:10px;font-weight:800;text-transform:uppercase}.cash-quick-entry-v3 input{width:100%;height:46px;padding:0 13px;border:1px solid var(--border);border-radius:13px;outline:0;background:var(--surface-2);color:var(--text)}.cash-quick-entry-v3 input:focus{border-color:rgba(215,182,108,.5);box-shadow:0 0 0 4px rgba(215,182,108,.07)}.cash-quick-fields-v3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.cash-quick-fields-v3 .is-wide{grid-column:1/-1}.cash-quick-entry-v3>footer>div:first-child{display:grid;gap:3px}.cash-quick-entry-v3>footer>div:first-child span{color:var(--muted);font-size:10px;text-transform:uppercase}.cash-quick-entry-v3>footer>div:first-child strong{color:var(--gold);font-size:24px}.cash-quick-actions-v3{display:flex;gap:8px}.cash-quick-actions-v3 button{min-height:44px;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:0 15px;border:1px solid var(--border);border-radius:13px;font-weight:850;cursor:pointer}.cash-quick-actions-v3 .is-primary{border:0;background:linear-gradient(135deg,#d7b66c,#b99045);color:#17150f}.cash-quick-actions-v3 .is-danger{background:rgba(239,124,124,.08);color:#ffaaaa}.cash-leaderboard-periods-v3{display:flex;flex-wrap:wrap;gap:7px;margin:0 0 10px}.cash-leaderboard-periods-v3 button{min-height:38px;padding:0 12px;border:1px solid var(--border);border-radius:11px;background:var(--surface-2);color:var(--muted);font-size:10px;font-weight:850;cursor:pointer}.cash-leaderboard-periods-v3 button.is-active{border-color:rgba(215,182,108,.3);background:var(--gold-soft);color:var(--gold)}.cash-period-explain-v3{margin:0 0 16px;color:var(--muted);font-size:11px;line-height:1.6}
@media(max-width:760px){.cash-quick-entry-v3{padding:16px;border-radius:18px}.cash-quick-entry-v3>header,.cash-quick-entry-v3>footer{align-items:stretch;flex-direction:column}.cash-quick-entry-v3>header>label{width:100%}.cash-quick-fields-v3{grid-template-columns:1fr}.cash-quick-fields-v3 .is-wide{grid-column:auto}.cash-quick-actions-v3{width:100%}.cash-quick-actions-v3 button{flex:1}.cash-leaderboard-periods-v3{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}.cash-leaderboard-periods-v3 button{padding:7px}}
""")

Path("src/pages/schedule.css").write_text(Path("src/pages/schedule.css").read_text() + """
/* Anchored schedule picker */
.schedule-picker-backdrop{display:block;padding:0;background:transparent;backdrop-filter:none}.schedule-picker-sheet{position:fixed;width:min(360px,calc(100vw - 24px));max-height:min(420px,calc(100vh - 24px));padding:16px;border-radius:18px;box-shadow:0 24px 70px rgba(0,0,0,.55);animation:picker-pop .16s ease-out}.schedule-picker-heading{margin-bottom:12px}.schedule-picker-heading h3{font-size:20px}.schedule-picker-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.schedule-picker-grid button{min-height:64px;padding:10px}.schedule-picker-grid button strong{font-size:15px}@keyframes picker-pop{from{opacity:0;transform:translateY(-4px) scale(.98)}}@media(max-width:640px){.schedule-picker-backdrop{padding:0}.schedule-picker-sheet{width:min(360px,calc(100vw - 24px));max-height:min(420px,calc(100vh - 24px));padding:14px;border-radius:17px}.schedule-picker-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
""")

Path("src/pages/menu.css").write_text(Path("src/pages/menu.css").read_text() + """
/* Menu without stop-list controls; preserve full photo composition */
.menu-metrics-v2{grid-template-columns:repeat(3,minmax(0,1fr))}.menu-stop-button-v2,.menu-card-media-v2>b{display:none!important}.menu-card-media-v2 img{object-fit:contain!important;padding:6px;background:#101812}.menu-detail-media-v2 img{object-fit:contain!important;padding:10px;background:#101812}.menu-card-media-v2{background:#101812}.menu-detail-media-v2{background:#101812}@media(max-width:760px){.menu-metrics-v2{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:520px){.menu-metrics-v2{grid-template-columns:1fr}.menu-card-media-v2 img{padding:4px}.menu-detail-media-v2 img{padding:6px}}
""")
