import { readFile, writeFile } from 'node:fs/promises';

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Patch target not found: ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`Patch target is not unique: ${label}`);
  return source.slice(0, first) + after + source.slice(first + before.length);
}

const pagePath = 'src/pages/StaffPage.tsx';
let page = await readFile(pagePath, 'utf8');

page = replaceOnce(
  page,
  `  const [selected, setSelected] = useState<StaffMember | null>(null);
  const [editor, setEditor] = useState<StaffEditor | null>(null);`,
  `  const [selected, setSelected] = useState<StaffMember | null>(null);
  const [portrait, setPortrait] = useState<StaffMember | null>(null);
  const [editor, setEditor] = useState<StaffEditor | null>(null);`,
  'portrait state',
);

page = replaceOnce(
  page,
  `<div className="staff-detail-hero-v2"><div className="staff-detail-avatar-v2">{selected.avatar ? <img src={selected.avatar} alt={selected.displayName} /> : <span>{initials(selected.displayName)}</span>}</div><div><span className="eyebrow">{selected.displayRole || roleLabel(selected.role)}</span><h3>{selected.displayName}</h3><p>@{selected.login}{selected.nick ? \` · «\${selected.nick}»\` : ''}</p></div><button type="button" onClick={() => setSelected(null)}><X size={19} /></button></div>`,
  `<div className="staff-detail-hero-v2"><button type="button" className="staff-detail-avatar-v2" onClick={() => setPortrait(selected)} aria-label={\`Відкрити фото \${selected.displayName} на весь екран\`}>{selected.avatar ? <img src={selected.avatar} alt={selected.displayName} /> : <span>{initials(selected.displayName)}</span>}<i>Розгорнути</i></button><div><span className="eyebrow">{selected.displayRole || roleLabel(selected.role)}</span><h3>{selected.displayName}</h3><p>@{selected.login}{selected.nick ? \` · «\${selected.nick}»\` : ''}</p></div><button type="button" onClick={() => setSelected(null)}><X size={19} /></button></div>`,
  'detail avatar button',
);

page = replaceOnce(
  page,
  `      {editor ? <div className="staff-sheet-backdrop-v2" onMouseDown={() => !saving && setEditor(null)}><section className="staff-editor-sheet-v2" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>`,
  `      {portrait ? <div className="staff-portrait-backdrop-v3" onMouseDown={() => setPortrait(null)}><section className="staff-portrait-sheet-v3" role="dialog" aria-modal="true" aria-label={\`Фото \${portrait.displayName}\`} onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="staff-portrait-close-v3" onClick={() => setPortrait(null)} aria-label="Закрити фото"><X size={22} /></button>
        <div className={\`staff-portrait-media-v3 \${portrait.avatar ? 'has-photo' : 'has-initials'}\`}>
          {portrait.avatar ? <img src={portrait.avatar} alt={portrait.displayName} /> : <span>{initials(portrait.displayName)}</span>}
        </div>
        <footer className="staff-portrait-copy-v3">
          <span className="eyebrow">{portrait.displayRole || [roleLabel(portrait.role), portrait.role2 ? roleLabel(portrait.role2) : null].filter(Boolean).join(' · ')}</span>
          <h3>{portrait.displayName}</h3>
          <blockquote>{portrait.credo ? `“${portrait.credo}”` : 'Життєве кредо не вказано.'}</blockquote>
        </footer>
      </section></div> : null}

      {editor ? <div className="staff-sheet-backdrop-v2" onMouseDown={() => !saving && setEditor(null)}><section className="staff-editor-sheet-v2" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>`,
  'fullscreen portrait modal',
);

await writeFile(pagePath, page, 'utf8');

const cssPath = 'src/pages/staff.css';
let css = await readFile(cssPath, 'utf8');
css += `

/* Fullscreen staff portrait */
.staff-detail-avatar-v2{position:relative;padding:0;border:1px solid rgba(215,182,108,.25);cursor:zoom-in}
.staff-detail-avatar-v2>i{position:absolute;right:5px;bottom:5px;padding:4px 6px;border-radius:7px;background:rgba(5,10,7,.78);color:#f4d98e;font-size:6px;font-style:normal;font-weight:850;letter-spacing:.05em;text-transform:uppercase;opacity:0;transition:opacity .16s ease}
.staff-detail-avatar-v2:hover>i,.staff-detail-avatar-v2:focus-visible>i{opacity:1}
.staff-detail-avatar-v2:focus-visible{outline:2px solid rgba(215,182,108,.55);outline-offset:3px}
.staff-portrait-backdrop-v3{position:fixed;inset:0;z-index:1800;display:grid;place-items:center;padding:0;background:rgba(2,5,3,.96);backdrop-filter:blur(14px)}
.staff-portrait-sheet-v3{position:relative;width:100vw;height:100dvh;max-width:none;max-height:none;display:grid;grid-template-rows:minmax(0,1fr) auto;overflow:hidden;border:0;border-radius:0;background:radial-gradient(circle at 50% 25%,rgba(126,34,49,.22),transparent 38%),#080d0a;color:var(--text)}
.staff-portrait-close-v3{position:fixed;top:max(16px,env(safe-area-inset-top));right:max(16px,env(safe-area-inset-right));z-index:2;width:46px;height:46px;display:grid;place-items:center;border:1px solid rgba(255,255,255,.14);border-radius:15px;background:rgba(5,10,7,.78);color:#fff;cursor:pointer;backdrop-filter:blur(10px)}
.staff-portrait-media-v3{min-height:0;display:grid;place-items:center;overflow:hidden;padding:max(70px,calc(env(safe-area-inset-top) + 58px)) clamp(16px,4vw,54px) 20px}
.staff-portrait-media-v3 img{width:100%;height:100%;max-width:1200px;max-height:100%;object-fit:contain;filter:drop-shadow(0 24px 55px rgba(0,0,0,.45))}
.staff-portrait-media-v3.has-initials>span{width:min(58vw,330px);aspect-ratio:1;display:grid;place-items:center;border:1px solid rgba(215,182,108,.3);border-radius:34%;background:radial-gradient(circle at 35% 24%,rgba(215,182,108,.2),transparent 35%),linear-gradient(145deg,var(--wine),#35121a);color:#fff;font-family:'Prata',serif;font-size:clamp(54px,14vw,120px);box-shadow:0 30px 80px rgba(0,0,0,.4)}
.staff-portrait-copy-v3{display:grid;justify-items:center;gap:7px;padding:20px clamp(18px,5vw,54px) max(24px,env(safe-area-inset-bottom));border-top:1px solid rgba(215,182,108,.16);background:linear-gradient(180deg,rgba(8,13,10,.74),#080d0a);text-align:center}
.staff-portrait-copy-v3 h3{margin:0;font-family:'Prata',serif;font-size:clamp(25px,5vw,42px);font-weight:400}
.staff-portrait-copy-v3 blockquote{max-width:760px;margin:5px 0 0;color:#d9e1da;font-family:'Prata',serif;font-size:clamp(14px,2.4vw,20px);line-height:1.65}
@media(max-width:760px){.staff-portrait-backdrop-v3.tiflis-modal-backdrop{top:0!important;width:100vw!important;height:100dvh!important;padding:0!important;overflow:hidden!important}.staff-portrait-sheet-v3.tiflis-modal-surface{position:relative!important;width:100vw!important;max-width:none!important;height:100dvh!important;max-height:none!important;margin:0!important;border:0!important;border-radius:0!important;overflow:hidden!important}.staff-detail-avatar-v2>i{opacity:1}}
`;
await writeFile(cssPath, css, 'utf8');

console.log('Phase 6 staff portrait patch applied.');
