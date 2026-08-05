from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'Missing pattern: {label}')
    return text.replace(old, new, 1)


# ACL and page metadata
path = Path('src/lib/acl.ts')
text = path.read_text()
text = replace_once(
    text,
    "export type PageKey = 'today' | 'schedule' | 'cash' | 'menu' | 'reserve' | 'staff' | 'admin';",
    "export type PageKey = 'today' | 'schedule' | 'cash' | 'menu' | 'reserve' | 'staff' | 'duties' | 'handover' | 'admin';",
    'page key',
)
text = text.replace("title: 'Меню та стоп-лист'", "title: 'Меню ресторану'")
text = replace_once(
    text,
    "  admin: {\n    path: '/admin',",
    """  duties: {
    path: '/duties',
    title: 'Щоденні обов’язки',
    shortTitle: 'Обов’язки',
    roles: ['sysadmin', 'admin', 'chef', 'cook', 'waiter', 'bar', 'hostess', 'runner'],
  },
  handover: {
    path: '/handover',
    title: 'Здача зміни',
    shortTitle: 'Здача зміни',
    roles: ['sysadmin', 'admin', 'chef', 'cook', 'waiter', 'bar', 'hostess', 'runner'],
  },
  admin: {
    path: '/admin',""",
    'page definitions',
)
path.write_text(text)

# Lazy page loaders
path = Path('src/lib/pageLoaders.ts')
text = path.read_text()
text = replace_once(
    text,
    "export const loadStaffPage = () => import('../pages/StaffPage');\nexport const loadAdminPage",
    "export const loadStaffPage = () => import('../pages/StaffPage');\nexport const loadDutiesPage = () => import('../pages/DutiesPage');\nexport const loadHandoverPage = () => import('../pages/HandoverPage');\nexport const loadAdminPage",
    'loader exports',
)
text = replace_once(
    text,
    "  staff: loadStaffPage,\n  admin: loadAdminPage,",
    "  staff: loadStaffPage,\n  duties: loadDutiesPage,\n  handover: loadHandoverPage,\n  admin: loadAdminPage,",
    'loader map',
)
path.write_text(text)

# Routes
path = Path('src/App.tsx')
text = path.read_text()
text = replace_once(
    text,
    "  loadDashboardPage,\n  loadLoginPage,",
    "  loadDashboardPage,\n  loadDutiesPage,\n  loadHandoverPage,\n  loadLoginPage,",
    'app loader imports',
)
text = replace_once(
    text,
    "const StaffPage = lazy(() => loadStaffPage().then((module) => ({ default: module.StaffPage })));\nconst AdminPage",
    "const StaffPage = lazy(() => loadStaffPage().then((module) => ({ default: module.StaffPage })));\nconst DutiesPage = lazy(() => loadDutiesPage().then((module) => ({ default: module.DutiesPage })));\nconst HandoverPage = lazy(() => loadHandoverPage().then((module) => ({ default: module.HandoverPage })));\nconst AdminPage",
    'lazy pages',
)
text = replace_once(
    text,
    "          <Route path=\"/staff\" element={<ProtectedPage page=\"staff\"><StaffPage /></ProtectedPage>} />\n          <Route path=\"/admin\"",
    "          <Route path=\"/staff\" element={<ProtectedPage page=\"staff\"><StaffPage /></ProtectedPage>} />\n          <Route path=\"/duties\" element={<ProtectedPage page=\"duties\"><DutiesPage /></ProtectedPage>} />\n          <Route path=\"/handover\" element={<ProtectedPage page=\"handover\"><HandoverPage /></ProtectedPage>} />\n          <Route path=\"/admin\"",
    'routes',
)
path.write_text(text)

# Navigation
path = Path('src/components/AppShell.tsx')
text = path.read_text()
text = replace_once(text, "  ClipboardList,\n  Home,", "  ClipboardCheck,\n  ClipboardList,\n  Home,", 'clipboard icon')
text = replace_once(text, "  MoreHorizontal,\n  Settings,", "  MessageSquarePlus,\n  MoreHorizontal,\n  Settings,", 'handover icon')
text = replace_once(
    text,
    "  staff: Users,\n  admin: Settings,",
    "  staff: Users,\n  duties: ClipboardCheck,\n  handover: MessageSquarePlus,\n  admin: Settings,",
    'icon map',
)
text = replace_once(
    text,
    "  'reserve',\n  'admin',",
    "  'reserve',\n  'duties',\n  'handover',\n  'admin',",
    'desktop order',
)
text = replace_once(
    text,
    "const preferredWarmOrder: PageKey[] = ['schedule', 'cash', 'menu', 'reserve', 'staff', 'admin'];",
    "const preferredWarmOrder: PageKey[] = ['schedule', 'cash', 'menu', 'reserve', 'duties', 'handover', 'staff', 'admin'];",
    'warm order',
)
path.write_text(text)

# Operations API: allow admins to inspect/generate a selected employee's duties.
path = Path('supabase/functions/tiflis-operations-api/index.ts')
text = path.read_text()
text = replace_once(
    text,
    "      const date = parseDate(body.date);\n      if (!date) return json(req, { ok: false, error: \"Invalid date\" }, 400);\n\n      const [templatesResult",
    """      const date = parseDate(body.date);
      if (!date) return json(req, { ok: false, error: "Invalid date" }, 400);
      const requestedUserId = typeof body.user_id === "string" ? body.user_id.trim().slice(0, 120) : "";
      const subject = hasRole(profile, ADMIN_ROLES) && requestedUserId
        ? await actor(service, requestedUserId)
        : current;
      const subjectRoles = [normalizeRole(subject.role), normalizeRole(subject.role2)]
        .filter((role, index, all) => Boolean(role) && all.indexOf(role) === index);

      const [templatesResult""",
    'operations subject',
)
text = replace_once(
    text,
    '.eq("work_date", date).eq("assignee_id", current.id),',
    '.eq("work_date", date).eq("assignee_id", subject.id),',
    'subject assignments',
)
text = replace_once(
    text,
    'const ownShift = (scheduleResult.data ?? []).find((row) => String(row.user_id) === current.id)?.shift || null;',
    'const ownShift = (scheduleResult.data ?? []).find((row) => String(row.user_id) === subject.id)?.shift || null;',
    'subject shift',
)
text = replace_once(
    text,
    'return intersects(template.role_scope, roles) && (!template.shift_codes?.length || template.shift_codes.includes(String(ownShift || "")));',
    'return intersects(template.role_scope, subjectRoles) && (!template.shift_codes?.length || template.shift_codes.includes(String(ownShift || "")));',
    'subject roles',
)
text = replace_once(
    text,
    '            assignee_id: current.id,',
    '            assignee_id: subject.id,',
    'subject assignment creation',
)
text = replace_once(
    text,
    "        me: {\n          id: current.id,\n          name: current.display_name || current.login,\n          roles,\n          shift: ownShift,\n        },\n        permissions:",
    """        me: {
          id: current.id,
          name: current.display_name || current.login,
          roles,
          shift: (scheduleResult.data ?? []).find((row) => String(row.user_id) === current.id)?.shift || null,
        },
        subject: {
          id: subject.id,
          name: subject.display_name || subject.login,
          roles: subjectRoles,
          shift: ownShift,
        },
        permissions:""",
    'subject response',
)
path.write_text(text)
