from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"Missing pattern: {label}")
    return text.replace(old, new, 1)


# Show registration approvals in the admin overview.
path = Path("src/pages/AdminPage.tsx")
text = path.read_text()
text = replace_once(
    text,
    "import { secureApi } from '../lib/secureApi';",
    "import { RegistrationAdminPanel } from '../components/RegistrationAdminPanel';\nimport { secureApi } from '../lib/secureApi';",
    "admin import",
)
text = replace_once(
    text,
    "          </section>\n\n          <section className=\"admin-grid-v2\">",
    "          </section>\n\n          <RegistrationAdminPanel />\n\n          <section className=\"admin-grid-v2\">",
    "registration panel",
)
path.write_text(text)


# Return a useful pending-approval message only after the submitted password
# successfully authenticates against the pending Supabase Auth account.
path = Path("supabase/functions/tiflis-auth-migrate/index.ts")
text = path.read_text()
old = '''    if (!legacy || legacy.fired === true) {
      await registerFailure(keyHash);
      await sleep(450);
      return json({ ok: false, error: "Невірний логін або пароль" }, 401);
    }
'''
new = '''    if (!legacy) {
      const { data: pending } = await admin
        .from("registration_requests")
        .select("auth_user_id,status")
        .ilike("login", login)
        .eq("status", "pending")
        .limit(1)
        .maybeSingle();
      if (pending?.auth_user_id) {
        const { data: authRecord } = await admin.auth.admin.getUserById(String(pending.auth_user_id));
        const pendingEmail = authRecord.user?.email || null;
        if (pendingEmail) {
          const { data: pendingSignIn } = await authClient.auth.signInWithPassword({ email: pendingEmail, password });
          if (pendingSignIn.session) {
            return json({ ok: false, error: "Реєстрація очікує підтвердження адміністратора" }, 403);
          }
        }
      }
      await registerFailure(keyHash);
      await sleep(450);
      return json({ ok: false, error: "Невірний логін або пароль" }, 401);
    }

    if (legacy.fired === true) {
      await registerFailure(keyHash);
      await sleep(450);
      return json({ ok: false, error: "Невірний логін або пароль" }, 401);
    }
'''
text = replace_once(text, old, new, "pending registration login")
path.write_text(text)
