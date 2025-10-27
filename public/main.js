// public/main.js
let currentUser = null;

async function fetchMe() {
  try {
    const res = await fetch('/api/me');
    const data = await res.json();
    currentUser = data.username || null;
    updateUIForUser();
  } catch (e) {
    currentUser = null;
    updateUIForUser();
  }
}

function updateUIForUser() {
  const usernameDisplay = document.getElementById('usernameDisplay');
  const avatar = document.getElementById('avatar');
  const miniAvatar = document.getElementById('miniAvatar');
  const loginBtn = document.querySelector('.header-right .btn-ghost');
  const logoutBtn = document.querySelector('.header-right .btn-primary');

  if (currentUser) {
    usernameDisplay.innerText = currentUser;
    const initial = currentUser.charAt(0).toUpperCase();
    if (avatar) avatar.innerText = initial;
    if (miniAvatar) miniAvatar.innerText = initial;
    if (loginBtn) loginBtn.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'inline-block';
  } else {
    usernameDisplay.innerText = 'Anonim';
    if (avatar) avatar.innerText = 'U';
    if (miniAvatar) miniAvatar.innerText = 'U';
    if (loginBtn) loginBtn.style.display = 'inline-block';
    if (logoutBtn) logoutBtn.style.display = 'none';
  }
}

async function loadPosts() {
  const res = await fetch('/api/posts');
  const posts = await res.json();
  const feed = document.getElementById('feed');
  feed.innerHTML = posts.map(p => renderPost(p)).join('');
}

function renderPost(p) {
  const canDelete = currentUser && currentUser === p.username;
  const canReport = !!currentUser;
  return `
    <div class="post" id="post-${p.id}">
      <div class="meta">
        <div class="who">${escapeHtml(p.username)}</div>
        <div class="time">${escapeHtml(p.created_at)}</div>
      </div>
      <div class="content">${escapeHtml(p.content)}</div>
      <div class="actions">
        ${canDelete ? `<button class="btn btn-ghost" onclick="deletePost(${p.id})">Usuń</button>` : ''}
        ${canReport ? `<button class="btn btn-ghost" onclick="reportPost(${p.id})">Zgłoś</button>` : ''}
      </div>
    </div>
  `;
}

function escapeHtml(str){
  if (!str) return '';
  return String(str).replace(/[&<>"'`]/g, s => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','`':'&#96;'
  })[s]);
}

async function deletePost(id) {
  if (!confirm('Na pewno chcesz usunąć ten post?')) return;
  const res = await fetch(`/api/post/${id}`, { method: 'DELETE' });
  const data = await res.json();
  if (!data.success) return alert(data.error || 'Błąd przy usuwaniu');
  loadPosts();
}

async function reportPost(id) {
  const reason = prompt('Podaj powód zgłoszenia (opcjonalnie):') || '';
  const res = await fetch(`/api/report/${id}`, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ reason })
  });
  const data = await res.json();
  if (data.success) alert('Zgłoszono post. Dziękujemy.');
  else alert(data.error || 'Błąd przy zgłoszeniu');
}

async function publish() {
  const ta = document.getElementById('content');
  const content = ta.value.trim();
  if (!content) return alert('Wpisz treść');
  const res = await fetch('/api/post', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ content })
  });
  const data = await res.json();
  if (!data.success) return alert(data.error || 'Błąd publikacji');
  ta.value = '';
  loadPosts();
}

async function loadOnline() {
  try {
    const res = await fetch('/api/online');
    const data = await res.json();
    const el = document.getElementById('online');
    if (el) el.innerText = `Osoby online: ${data.online}`;
  } catch (e) { /* ignore */ }
}

async function logout() {
  await fetch('/api/logout');
  window.location.href = 'login.html';
}

// attach events after DOM loaded
document.addEventListener('DOMContentLoaded', () => {
  const publishBtn = document.getElementById('publishBtn');
  const clearBtn = document.getElementById('clearBtn');
  if (publishBtn) publishBtn.addEventListener('click', (e) => { e.preventDefault(); publish(); });
  if (clearBtn) clearBtn.addEventListener('click', (e) => { e.preventDefault(); document.getElementById('content').value = ''; });

  // initial load
  fetchMe().then(() => {
    loadPosts();
    loadOnline();
    // refresh online & posts periodically
    setInterval(loadOnline, 5000);
    setInterval(loadPosts, 5000);
  });
});
