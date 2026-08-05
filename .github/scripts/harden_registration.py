from pathlib import Path


def replace_all_required(text: str, old: str, new: str, minimum: int, label: str) -> str:
    count = text.count(old)
    if count < minimum:
        raise SystemExit(f"Missing replacements for {label}: expected at least {minimum}, got {count}")
    return text.replace(old, new)


path = Path("supabase/functions/tiflis-registration-api/index.ts")
text = path.read_text()
text = replace_all_required(text, '.ilike("login", login)', '.eq("login", login)', 4, "exact registration login lookup")
text = text.replace(
    '''    if (updateError) throw updateError;
    await admin.from("audit_log").insert({ actor_id: currentAdmin.legacyId, actor_name: currentAdmin.name, action: "registration_approve", entity_type: "registration_request", entity_id: requestId, summary: `Погоджено реєстрацію ${request.login} · роль ${role}` });
''',
    '''    if (updateError) {
      await Promise.allSettled([
        admin.from("staff_profiles").delete().eq("user_id", request.auth_user_id),
        admin.from("users").delete().eq("id", id),
      ]);
      throw updateError;
    }
    await admin.from("audit_log").insert({ actor_id: currentAdmin.legacyId, actor_name: currentAdmin.name, action: "registration_approve", entity_type: "registration_request", entity_id: requestId, summary: `Погоджено реєстрацію ${request.login} · роль ${role}` });
''',
    1,
)
path.write_text(text)

path = Path("supabase/functions/tiflis-auth-migrate/index.ts")
text = path.read_text()
if '.ilike("login", login)' not in text:
    raise SystemExit("Missing pending registration login lookup")
text = text.replace('.ilike("login", login)', '.eq("login", login)', 1)
path.write_text(text)
