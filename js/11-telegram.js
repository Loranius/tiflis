const EDGE_URL = 'https://duzfttrrzeqvxpfnyxfg.supabase.co/functions/v1/quick-responder';
const PORTAL_KEY = 'tiflis_internal';

// Отримати токен бота з налаштувань
function getTgToken() {
  return DB.get('tg_bot_token') || localStorage.getItem('tiflis_tg_token') || '';
}

// ── Відправка особистого повідомлення через Telegram Bot API ─────
async function tgSendPersonal(chatId, text) {
  if (!chatId) return;
  const token = getTgToken();

  // Спочатку пряме відправлення через Bot API якщо є токен
  if (token) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
      });
      const data = await res.json();
      if (data.ok) return;
      console.warn('TG direct API error:', data.description);
    } catch(e) { console.warn('TG direct API failed:', e); }
  }

  // Fallback: Edge Function
  try {
    await fetch(EDGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-portal-key': PORTAL_KEY },
      body: JSON.stringify({ action: 'send_personal', chat_id: chatId, text })
    });
  } catch(e) { console.error('TG personal send error (both methods failed):', e); }
}

// ── Відправка фото через Telegram Bot API ────────────────────────
async function tgSendPhoto(chatId, photoUrl, caption) {
  if (!chatId || !photoUrl) return;
  const token = getTgToken();
  if (!token) return;

  // chat_id завжди числовий — Telegram вимагає число для sendPhoto
  const numericChatId = Number(chatId);
  if (!numericChatId) { console.warn('tgSendPhoto: некоректний chat_id:', chatId); return; }

  // Крок 1: sendPhoto напряму
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: numericChatId,
        photo: photoUrl,
        caption: (caption || '').replace(/<[^>]+>/g, '').slice(0, 1024),
      })
    });
    const data = await res.json();
    if (data.ok) return;
    console.warn('TG sendPhoto failed:', data.error_code, data.description);
  } catch(e) { console.warn('TG sendPhoto fetch error:', e); }

  // Крок 2: fallback — текст + URL без parse_mode (щоб & в URL не ламав парсер)
  try {
    const plainCaption = (caption || '').replace(/<[^>]+>/g, '').slice(0, 900);
    const msgText = (plainCaption ? plainCaption + '\n\n' : '') + photoUrl;
    const res2 = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: numericChatId,
        text: msgText.slice(0, 4096),
        disable_web_page_preview: false
      })
    });
    const data2 = await res2.json();
    if (data2.ok) return;
    console.warn('TG photo text-fallback error:', data2.error_code, data2.description);
  } catch(e) { console.warn('TG photo text-fallback failed:', e); }
}

// ── Розсилка фото по ролях ───────────────────────────────────────
async function tgBroadcastPhoto(photoUrl, caption, roles) {
  const token = getTgToken();
  const allUsers = DB.get('users', []).filter(u => !u.fired);
  let sent = 0, skipped = 0;
  for (const u of allUsers) {
    if (roles && roles.length > 0) {
      if (!roles.includes(u.role) && !roles.includes(u.role2)) continue;
    }
    const destId = u.chat_id || u.tg_id;
    if (!destId) { skipped++; continue; }
    await tgSendPhoto(destId, photoUrl, caption);
    sent++;
  }
  if (skipped > 0 && sent === 0) {
    console.warn(`tgBroadcastPhoto: жодного chat_id. Пропущено ${skipped} користувачів — попросіть їх написати /start боту.`);
  }
  return { sent, skipped };
}

// ── Розсилка по ролях ────────────────────────────────────────────
async function tgBroadcast(text, roles) {
  const token = getTgToken();

  if (token) {
    // Прямий send по кожному користувачу з chat_id
    const allUsers = DB.get('users', []).filter(u => !u.fired);
    let sent = 0;
    for (const u of allUsers) {
      if (roles && roles.length > 0) {
        if (!roles.includes(u.role) && !roles.includes(u.role2)) continue;
      }
      const destId = u.chat_id || u.tg_id;
      if (!destId) continue;
      await tgSendPersonal(destId, text);
      sent++;
    }
    // Повертаємось тільки якщо реально щось надіслали
    if (sent > 0) return;
    // Якщо токен є але у всіх відсутній chat_id — падаємо у fallback нижче
  }

  // Fallback: Edge Function broadcast
  try {
    const res = await fetch(EDGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-portal-key': PORTAL_KEY },
      body: JSON.stringify({ action: 'broadcast', text, roles })
    });
    if (res.ok) return;
  } catch(e) { console.error('TG broadcast via edge error:', e); }
}

