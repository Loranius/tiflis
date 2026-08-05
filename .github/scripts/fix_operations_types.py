from pathlib import Path

path = Path('supabase/functions/tiflis-operations-api/index.ts')
text = path.read_text()

old_actor = '''async function actor(client: ReturnType<typeof createClient>, legacyId: string): Promise<LegacyUser> {
  const { data, error } = await client
    .from("users")
    .select("id,login,display_name,role,role2,avatar,fired")
    .eq("id", legacyId)
    .single();
  if (error || !data || data.fired === true) throw error || new Error("Staff member not found");
  return data as LegacyUser;
}'''
new_actor = '''async function actor(client: any, legacyId: string): Promise<LegacyUser> {
  const { data, error } = await client
    .from("users")
    .select("id,login,display_name,role,role2,avatar,fired")
    .eq("id", legacyId)
    .single();
  const user = data as LegacyUser | null;
  if (error || !user || user.fired === true) throw error || new Error("Staff member not found");
  return user;
}'''

if old_actor not in text:
    raise SystemExit('actor helper pattern not found')
text = text.replace(old_actor, new_actor, 1)

old_audit = '''async function audit(
  client: ReturnType<typeof createClient>,'''
new_audit = '''async function audit(
  client: any,'''
if old_audit not in text:
    raise SystemExit('audit helper pattern not found')
text = text.replace(old_audit, new_audit, 1)

path.write_text(text)
