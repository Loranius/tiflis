import {
  Check,
  ChevronLeft,
  ChevronRight,
  MessageSquarePlus,
  RefreshCw,
  Send,
  Sparkles,
  Undo2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ROLE_OPTIONS,
  addDays,
  addHandoverNote,
  broadcastOperations,
  escapeTelegram,
  formatDate,
  formatMoment,
  loadOperations,
  localIso,
  resolveHandoverNote,
  roleLabel,
  type HandoverNote,
  type OperationsResponse,
  type Priority,
} from '../lib/operationsClient';
import './operations-pages.css';

interface NoteEditor {
  title: string;
  body: string;
  priority: Priority;
  roleScope: string[];
}

function weekTuesday(value: string): string {
  const date = new Date(`${value}T12:00:00`);
  const day = date.getDay();
  date.setDate(date.getDate() + (2 - day));
  return localIso(date);
}

function initialEditor(): NoteEditor {
  return { title: '', body: '', priority: 'medium', roleScope: [] };
}

export function HandoverPage() {
  const [date, setDate] = useState(() => weekTuesday(localIso()));
  const [data, setData] = useState<OperationsResponse | null>(null);
  const [editor, setEditor] = useState<NoteEditor | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await loadOperations(date));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не вдалося завантажити передачу зміни.');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { void load(); }, [load]);

  const activeNotes = useMemo(
    () => (data?.notes || []).filter((note) => !note.resolved_at),
    [data],
  );
  const resolvedNotes = useMemo(
    () => (data?.notes || []).filter((note) => Boolean(note.resolved_at)),
    [data],
  );

  async function saveNote() {
    if (!editor || !editor.title.trim() || !editor.body.trim()) {
      setError('Вкажіть заголовок і текст питання.');
      return;
    }
    setPublishing(true);
    setError(null);
    try {
      await addHandoverNote({
        date,
        title: editor.title,
        body: editor.body,
        priority: editor.priority,
        roleScope: editor.roleScope,
      });
      setEditor(null);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Питання не додано.');
    } finally {
      setPublishing(false);
    }
  }

  async function setResolved(note: HandoverNote, resolved: boolean) {
    setSavingId(note.id);
    setError(null);
    try {
      await resolveHandoverNote(note.id, resolved);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Статус питання не оновлено.');
    } finally {
      setSavingId(null);
    }
  }

  async function publishHandover() {
    if (!data?.permissions.canResolveAny) return;
    setPublishing(true);
    setError(null);
    setNotice(null);
    try {
      const lines = activeNotes.length
        ? activeNotes.map((note) => {
          const scope = note.role_scope?.length ? ` · ${note.role_scope.map(roleLabel).join(', ')}` : '';
          return `• <b>${escapeTelegram(note.title)}</b>${escapeTelegram(scope)}\n${escapeTelegram(note.body)}`;
        }).join('\n\n')
        : 'Незавершених питань немає.';
      const response = await broadcastOperations(
        `<b>Здача зміни · ${escapeTelegram(formatDate(date, true))}</b>\n\n${lines}`,
      );
      setNotice(`Передачу зміни надіслано: ${response.sent}; без Telegram: ${response.skipped}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не вдалося відправити передачу зміни.');
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="ops-page-v3">
      <section className="ops-page-hero-v3 is-handover">
        <div><span className="eyebrow">Щовівторка</span><h2>Здача зміни</h2><p>Незавершені питання, відповідальні ролі, закриття виконаних пунктів і одна готова Telegram-публікація для всієї команди.</p></div>
        <div className="ops-page-mark-v3"><Sparkles size={34} /></div>
      </section>

      <section className="ops-toolbar-v3">
        <div className="ops-date-nav-v3">
          <button type="button" onClick={() => setDate((value) => addDays(value, -7))} aria-label="Попередній вівторок"><ChevronLeft size={18} /></button>
          <label><span>Вівторок</span><input type="date" value={date} onChange={(event) => setDate(weekTuesday(event.target.value))} /></label>
          <button type="button" onClick={() => setDate((value) => addDays(value, 7))} aria-label="Наступний вівторок"><ChevronRight size={18} /></button>
          <button type="button" className="is-accent" onClick={() => setDate(weekTuesday(localIso()))}>Цей тиждень</button>
        </div>
        <div className="ops-toolbar-actions-v3">
          <button type="button" onClick={() => setEditor(initialEditor())}><MessageSquarePlus size={17} /> Додати питання</button>
          {data?.permissions.canResolveAny ? <button type="button" className="ops-send-v3" onClick={() => void publishHandover()} disabled={publishing}>{publishing ? <RefreshCw size={17} className="is-spinning" /> : <Send size={17} />} У Telegram</button> : null}
        </div>
      </section>

      {error ? <div className="ops-alert-v3 is-error" role="alert"><span>{error}</span><button type="button" onClick={() => setError(null)}><X size={16} /></button></div> : null}
      {notice ? <div className="ops-alert-v3 is-success"><span>{notice}</span><button type="button" onClick={() => setNotice(null)}><X size={16} /></button></div> : null}
      {loading ? <div className="ops-loading-v3"><RefreshCw size={23} className="is-spinning" /><span>Збираємо передачу зміни…</span></div> : null}

      {!loading && data ? (
        <div className="ops-handover-layout-v3">
          <main className="ops-notes-v3">
            <header><div><span className="eyebrow">{formatDate(date, true)}</span><h3>Незавершені питання · {activeNotes.length}</h3></div></header>
            <div>{activeNotes.map((note) => <article key={note.id} className={`priority-${note.priority} ${note.pinned ? 'is-pinned' : ''}`}><header><div><strong>{note.title}</strong><span>{note.author_name} · {formatMoment(note.created_at)}</span></div><span className="ops-priority-v3">{note.priority}</span></header><p>{note.body}</p><footer><span>{note.role_scope?.length ? note.role_scope.map(roleLabel).join(' · ') : 'Для всієї команди'}</span>{data.permissions.canResolveAny || note.author_id === data.me.id ? <button type="button" onClick={() => void setResolved(note, true)} disabled={savingId === note.id}><Check size={15} /> Закрити</button> : null}</footer></article>)}{!activeNotes.length ? <div className="ops-empty-v3"><Sparkles size={29} /><strong>Передача зміни чиста</strong><span>Незавершених питань на цей вівторок немає.</span></div> : null}</div>
          </main>

          <aside className="ops-resolved-v3">
            <header><span className="eyebrow">Архів тижня</span><h3>Закриті · {resolvedNotes.length}</h3></header>
            <div>{resolvedNotes.map((note) => <article key={note.id}><div><strong>{note.title}</strong><span>{note.resolved_by || 'Команда'} · {formatMoment(note.resolved_at)}</span></div>{data.permissions.canResolveAny ? <button type="button" onClick={() => void setResolved(note, false)} disabled={savingId === note.id} aria-label="Повернути питання"><Undo2 size={15} /></button> : null}</article>)}{!resolvedNotes.length ? <p>Закритих питань у вибраному тижні ще немає.</p> : null}</div>
          </aside>
        </div>
      ) : null}

      {editor ? (
        <div className="ops-editor-backdrop-v3" onMouseDown={() => !publishing && setEditor(null)}>
          <section className="ops-editor-v3" role="dialog" aria-modal="true" aria-label="Нове питання передачі зміни" onMouseDown={(event) => event.stopPropagation()}>
            <header><div><span className="eyebrow">Нове питання</span><h3>{formatDate(date)}</h3></div><button type="button" onClick={() => setEditor(null)} disabled={publishing}><X size={19} /></button></header>
            <label><span>Заголовок</span><input value={editor.title} maxLength={180} onChange={(event) => setEditor({ ...editor, title: event.target.value })} placeholder="Що потрібно передати наступній зміні?" /></label>
            <label><span>Деталі</span><textarea value={editor.body} maxLength={3000} onChange={(event) => setEditor({ ...editor, body: event.target.value })} placeholder="Контекст, що вже зроблено і що залишається…" /></label>
            <label><span>Пріоритет</span><select value={editor.priority} onChange={(event) => setEditor({ ...editor, priority: event.target.value as Priority })}><option value="low">Низький</option><option value="medium">Звичайний</option><option value="high">Високий</option><option value="critical">Критичний</option></select></label>
            <fieldset><legend>Для яких ролей</legend><div>{ROLE_OPTIONS.map(([key, label]) => <label key={key}><input type="checkbox" checked={editor.roleScope.includes(key)} onChange={(event) => setEditor({ ...editor, roleScope: event.target.checked ? [...editor.roleScope, key] : editor.roleScope.filter((role) => role !== key) })} /><span>{label}</span></label>)}</div><small>Без вибору — для всієї команди.</small></fieldset>
            <footer><button type="button" onClick={() => setEditor(null)} disabled={publishing}>Скасувати</button><button type="button" className="is-primary" onClick={() => void saveNote()} disabled={publishing}>{publishing ? <RefreshCw size={17} className="is-spinning" /> : <Check size={17} />} Зберегти питання</button></footer>
          </section>
        </div>
      ) : null}
    </div>
  );
}
