// ╔═══════════════════════════════════════════════════════════════╗
// ║  [2/13]  ЗАВАНТАЖЕННЯ ЗОБРАЖЕНЬ (Supabase Storage)            ║
// ╚═══════════════════════════════════════════════════════════════╝
// Compress & upload a File to Supabase Storage, return public URL
async function uploadImageFile(file, bucket, folder) {
  // Client-side resize to max 900px, quality 0.82
  const compressed = await new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = e => { img.src = e.target.result; };
    img.onload = () => {
      const MAX = 900;
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else        { w = Math.round(w * MAX / h); h = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Compression failed')), 'image/jpeg', 0.82);
    };
    img.onerror = reject;
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const ext = 'jpg';
  const name = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const compressedFile = new File([compressed], name, { type: 'image/jpeg' });
  return sb.uploadImage(bucket, name, compressedFile);
}

// Render an upload button that triggers hidden file input; calls onUrl(url) with the result
function renderUploadBtn(inputId, bucket, folder, onUrl, label = '📁 Завантажити фото') {
  return `<label class="btn btn-outline btn-sm upload-label" style="cursor:pointer;display:inline-flex;align-items:center;gap:6px">
    <input type="file" id="${inputId}" accept="image/*" style="display:none"
      onchange="handleImageUpload(this,'${bucket}','${folder}','${onUrl}')">
    ${label}
  </label>`;
}

// Called by onchange on file inputs in modals
async function handleImageUpload(input, bucket, folder, callbackName) {
  const file = input.files[0];
  if (!file) return;
  const btn = input.closest('label');
  if (btn) { btn.style.opacity = '.5'; btn.style.pointerEvents = 'none'; }
  const spinner = document.createElement('span');
  spinner.id = 'upload-spinner';
  spinner.style.cssText = 'font-size:11px;color:var(--gold);margin-left:8px';
  spinner.textContent = '⏳ Завантаження...';
  if (btn) btn.after(spinner);
  try {
    const url = await uploadImageFile(file, bucket, folder);
    // Call the registered callback
    if (typeof window[callbackName] === 'function') window[callbackName](url);
  } catch(e) {
    console.error('Upload error:', e);
    toast('Помилка завантаження: ' + e.message, 'error');
  } finally {
    if (btn) { btn.style.opacity = ''; btn.style.pointerEvents = ''; }
    document.getElementById('upload-spinner')?.remove();
  }
}

