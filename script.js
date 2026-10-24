try { var t = localStorage.getItem('cgpa-theme') || (matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light'); document.documentElement.dataset.theme = t } catch (e) { }

/* ---------- Config ---------- */
const GUEST_KEY = 'cgpa-v1', USERS = 'cgpa-users', SESSION = 'cgpa-session';
// Signed-in email (or null for guest). Each account gets its own saved data.
let user = (() => { try { const e = sessionStorage.getItem(SESSION) || localStorage.getItem(SESSION); return e && (JSON.parse(localStorage.getItem(USERS) || '{}')[e]) ? e : null } catch (x) { return null } })();
const dataKey = () => user ? GUEST_KEY + ':' + user : GUEST_KEY;
const GRADES = ['A', 'B', 'C', 'D', 'E', 'F'];
const POINTS = { 5: { A: 5, B: 4, C: 3, D: 2, E: 1, F: 0 }, 4: { A: 4, B: 3, C: 2, D: 1, E: 0, F: 0 } };
const RANGES = { A: '70–100', B: '60–69', C: '50–59', D: '45–49', E: '40–44', F: '0–39' };
const CLASSES = [[4.5, 'First Class'], [3.5, 'Second Class Upper'], [2.4, 'Second Class Lower'], [1.5, 'Third Class'], [1, 'Pass'], [0, 'Below Pass']];
const $ = (s, r = document) => r.querySelector(s);
const reduced = matchMedia('(prefers-reduced-motion:reduce)').matches;
let uid = Date.now();
const id = () => ++uid;

/* ---------- Storage ---------- */
const blank = () => ({ scale: 5, prev: { cgpa: '', units: '' }, target: { cgpa: '', units: '' }, semesters: [newSem('100L First Semester')] });
function newSem(name) { return { id: id(), name, courses: [newCourse(), newCourse(), newCourse()] }; }
function newCourse() { return { id: id(), code: '', title: '', unit: '', score: '', grade: '' }; }
function load() { try { return Object.assign(blank(), JSON.parse(localStorage.getItem(dataKey()))) } catch (e) { return blank() } }
function save() { try { localStorage.setItem(dataKey(), JSON.stringify(S)) } catch (e) { } }
let S = load();

/* ---------- Calculations ---------- */
const gradeFromScore = s => s >= 70 ? 'A' : s >= 60 ? 'B' : s >= 50 ? 'C' : s >= 45 ? 'D' : s >= 40 ? 'E' : 'F';
function semStats(sem) {
  let u = 0, q = 0;
  sem.courses.forEach(c => { const n = +c.unit; if (n > 0 && c.grade) { u += n; q += n * POINTS[S.scale][c.grade]; } });
  return { u, q, gpa: u ? q / u : 0 };
}
function totals() {
  let u = +S.prev.units || 0, q = (+S.prev.cgpa || 0) * u;
  S.semesters.forEach(s => { const t = semStats(s); u += t.u; q += t.q; });
  return { u, q, cgpa: u ? q / u : 0 };
}
const norm5 = v => v * 5 / S.scale;               // map any scale to 5.0 for classification
const classIndex = v => CLASSES.findIndex(c => norm5(v) >= c[0]);

/* ---------- UI helpers ---------- */
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2200); }
function countUp(el, to, dec = 2) {
  const from = el._v || 0; el._v = to;
  if (reduced) { el.textContent = to.toFixed(dec); return; }
  const t0 = performance.now();
  (function step(t) { const p = Math.min((t - t0) / 600, 1), e = 1 - Math.pow(1 - p, 3); el.textContent = (from + (to - from) * e).toFixed(dec); if (p < 1) requestAnimationFrame(step); })(t0);
}
function shake(el) { el.classList.remove('err'); void el.offsetWidth; el.classList.add('err'); }
document.addEventListener('click', e => {           // button ripple
  const b = e.target.closest('.btn'); if (!b || reduced) return;
  const r = b.getBoundingClientRect(), d = Math.max(r.width, r.height), s = document.createElement('span');
  s.className = 'ripple'; s.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
  b.appendChild(s); setTimeout(() => s.remove(), 600);
});

/* ---------- Render semesters (structure only) ---------- */
const gradeOpts = () => '<option value="">Grade</option>' + GRADES.map(g => `<option>${g}</option>`).join('');
function rowHTML(c) {
  return `<div class="row" data-id="${c.id}">
    <input class="code" placeholder="CSC 201" aria-label="Course code" value="${esc(c.code)}">
    <input class="title" placeholder="Course title" aria-label="Course title" value="${esc(c.title)}">
    <input class="unit" type="number" min="1" max="6" inputmode="numeric" placeholder="Units" aria-label="Credit units" value="${c.unit}">
    <input class="score" type="number" min="0" max="100" inputmode="numeric" placeholder="Score" aria-label="Score out of 100" value="${c.score}">
    <select class="grade" aria-label="Grade">${gradeOpts().replace(`<option>${c.grade}</option>`, `<option selected>${c.grade}</option>`)}</select>
    <button class="x" aria-label="Remove course" title="Remove course">×</button></div>`;
}
const esc = s => String(s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
function renderSems() {
  $('#semList').innerHTML = S.semesters.map(s => `
    <article class="sem" data-sem="${s.id}">
      <div class="sem-h"><input class="sname" aria-label="Semester name" value="${esc(s.name)}"><span class="gpa-chip">GPA <b class="sgpa">0.00</b></span>
        <button class="btn danger delsem" aria-label="Delete semester">Delete</button></div>
      <div class="rows">${s.courses.map(rowHTML).join('')}</div>
      <div class="sem-foot"><button class="btn addrow add-row">+ Add course</button></div>
    </article>`).join('') || '<p class="hint">No semesters yet. Add one to start.</p>';
  update();
}

/* ---------- Events: semesters ---------- */
const findSem = el => S.semesters.find(s => s.id == el.closest('.sem').dataset.sem);
const findCourse = el => findSem(el).courses.find(c => c.id == el.closest('.row').dataset.id);

$('#addSem').onclick = () => {
  const n = S.semesters.length, lvl = (Math.floor(n / 2) + 1) * 100;
  S.semesters.push(newSem(`${lvl}L ${n % 2 ? 'Second' : 'First'} Semester`)); save(); renderSems();
  $('#semList').lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'center' });
};
$('#semList').addEventListener('click', e => {
  const sem = e.target.closest('.sem'); if (!sem) return;
  if (e.target.closest('.addrow')) {
    const s = findSem(sem), c = newCourse(); s.courses.push(c); save();
    sem.querySelector('.rows').insertAdjacentHTML('beforeend', rowHTML(c)); update();
  }
  if (e.target.closest('.x')) {
    const row = e.target.closest('.row'), s = findSem(row);
    s.courses = s.courses.filter(c => c.id != row.dataset.id); save();
    row.classList.add('out-anim'); setTimeout(() => { row.remove(); update(); }, reduced ? 0 : 280);
  }
  if (e.target.closest('.delsem')) {
    S.semesters = S.semesters.filter(s => s.id != sem.dataset.sem); save();
    sem.style.transition = '.3s'; sem.style.opacity = 0; setTimeout(renderSems, reduced ? 0 : 300);
  }
});
$('#semList').addEventListener('input', e => {
  const t = e.target, sem = t.closest('.sem'); if (!sem) return;
  if (t.classList.contains('sname')) { findSem(t).name = t.value; save(); return; }
  const c = findCourse(t), row = t.closest('.row');
  if (t.classList.contains('code')) c.code = t.value;
  if (t.classList.contains('title')) c.title = t.value;
  if (t.classList.contains('unit')) {
    c.unit = t.value; const n = +t.value;
    if (t.value !== '' && (n < 1 || n > 6 || !Number.isInteger(n))) { shake(t); toast('Credit units must be a whole number from 1 to 6'); c.unit = ''; }
  }
  if (t.classList.contains('score')) {
    c.score = t.value; const n = +t.value;
    if (t.value === '') { /* keep manual grade */ }
    else if (n < 0 || n > 100) { shake(t); toast('Score must be between 0 and 100'); c.score = ''; }
    else { c.grade = gradeFromScore(n); row.querySelector('.grade').value = c.grade; }
  }
  if (t.classList.contains('grade')) { c.grade = t.value; c.score = ''; row.querySelector('.score').value = ''; }
  save(); update();
});

/* ---------- Other inputs ---------- */
$('#scale').value = S.scale;
$('#scale').onchange = e => { S.scale = +e.target.value; save(); update(); toast(`Switched to the ${S.scale}.0 scale`); };
['pCgpa:prev.cgpa', 'pUnits:prev.units', 'tCgpa:target.cgpa', 'tUnits:target.units'].forEach(p => {
  const [el, path] = p.split(':'), [a, b] = path.split('.'); $('#' + el).value = S[a][b];
  $('#' + el).oninput = e => { if (+e.target.value < 0) { e.target.value = ''; shake(e.target); } S[a][b] = e.target.value; save(); update(); };
});


/* ---------- Bottom tabs and grade-responsive colours ---------- */
function goToPage(page) {
  document.querySelectorAll('.app-page').forEach(el => el.classList.toggle('page-active', el.dataset.page === page));
  document.querySelectorAll('.bottom-tab').forEach(btn => {
    const active = btn.dataset.go === page;
    btn.classList.toggle('active', active);
    if (active) btn.setAttribute('aria-current', 'page'); else btn.removeAttribute('aria-current');
  });
  window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
}
document.querySelectorAll('.bottom-tab').forEach(btn => btn.addEventListener('click', () => goToPage(btn.dataset.go)));
document.querySelectorAll('.hero-cta a[href="#semesters"]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); goToPage('courses'); }));
function applyGradeColours(T) {
  // Match the broad colour progression shown in the reference: high results are green,
  // then blue, yellow, orange and red as the overall result falls.
  const v = T && T.u ? norm5(T.cgpa) : null;
  const colour = v === null ? 'blue' : v >= 4 ? 'green' : v >= 3 ? 'blue' : v >= 2 ? 'yellow' : v >= 1 ? 'orange' : 'red';
  document.documentElement.dataset.grade = colour;
  document.querySelectorAll('.row[data-id]').forEach(row => {
    const grade = (row.querySelector('.grade')?.value || '').toLowerCase();
    row.classList.remove('grade-a', 'grade-b', 'grade-c', 'grade-d', 'grade-e', 'grade-f');
    if (grade) row.classList.add('grade-' + grade);
  });
}

/* ---------- Update results (no re-render, keeps focus) ---------- */
let lastClass = -1, charts = {};
function update() {
  const T = totals(), idx = T.u ? classIndex(T.cgpa) : -1;
  applyGradeColours(T);
  S.semesters.forEach(s => { const el = document.querySelector(`[data-sem="${s.id}"] .sgpa`); if (el) countUp(el, semStats(s).gpa); });
  countUp($('#cgpa'), T.cgpa); countUp($('#cgpa2'), T.cgpa);
  $('#ring').style.strokeDashoffset = 326.7 * (1 - Math.min(T.cgpa / S.scale, 1));
  const name = idx < 0 ? 'Add a course to begin' : CLASSES[idx][1];
  $('#cls').textContent = name; $('#cls2').textContent = idx < 0 ? '' : name;
  let pct = 0, next = '';
  if (idx === 0) { pct = 100; next = 'You are in the top class. Keep it up.'; }
  else if (idx > 0) {
    const lo = CLASSES[idx][0], hi = CLASSES[idx - 1][0], v = norm5(T.cgpa);
    pct = (v - lo) / (hi - lo) * 100; const need = (hi * S.scale / 5 - T.cgpa).toFixed(2);
    next = `${need} more CGPA points to ${CLASSES[idx - 1][1]}`;
  }
  $('#meter').style.width = pct + '%'; $('#next').textContent = next;
  if (idx === 0 && lastClass > 0) confetti();
  lastClass = idx;

  // stats
  const withUnits = S.semesters.map(s => ({ s, st: semStats(s) })).filter(x => x.st.u);
  $('#sUnits').textContent = T.u; $('#sQp').textContent = T.q.toFixed(1); $('#sSems').textContent = withUnits.length;
  const best = withUnits.sort((a, b) => b.st.gpa - a.st.gpa)[0];
  $('#sBest').textContent = best ? best.st.gpa.toFixed(2) : '–';
  planner(T); drawCharts();
}
function planner(T) {
  const tg = parseFloat(S.target.cgpa), ru = parseInt(S.target.units), out = $('#tOut');
  out.classList.remove('bad');
  if (!(tg >= 0) || !(ru > 0)) { out.textContent = 'Fill in both fields to see what you need.'; return; }
  const need = (tg * (T.u + ru) - T.q) / ru;
  if (need > S.scale) { out.classList.add('bad'); out.textContent = `Not reachable. You would need ${need.toFixed(2)}, above the maximum of ${S.scale.toFixed(1)}.`; }
  else if (need <= 0) out.textContent = 'You have already secured this target, even with zero-point grades.';
  else out.textContent = `Average a GPA of ${need.toFixed(2)} over your next ${ru} units to finish on ${tg.toFixed(2)}.`;
}

/* ---------- Charts ---------- */
function drawCharts() {
  if (typeof Chart === 'undefined') return;
  const css = getComputedStyle(document.documentElement), acc = css.getPropertyValue('--acc').trim(), mute = css.getPropertyValue('--mute').trim(), line = css.getPropertyValue('--line').trim();
  const labels = S.semesters.map((s, i) => s.name || 'Sem ' + (i + 1)), gpas = S.semesters.map(s => +semStats(s).gpa.toFixed(2));
  const dist = GRADES.map(g => S.semesters.reduce((n, s) => n + s.courses.filter(c => c.grade === g && +c.unit > 0).length, 0));
  const opts = {
    responsive: true, maintainAspectRatio: false, animation: { duration: reduced ? 0 : 800 }, plugins: { legend: { display: false }, title: { display: true, color: mute } },
    scales: { x: { ticks: { color: mute }, grid: { color: line } }, y: { ticks: { color: mute, precision: 0 }, grid: { color: line }, beginAtZero: true } }
  };
  const make = (key, cfg) => {
    if (charts[key]) { Object.assign(charts[key].data, cfg.data); charts[key].options = cfg.options; charts[key].update(); }
    else charts[key] = new Chart($('#' + key), cfg);
  };
  make('lineChart', {
    type: 'line', data: { labels, datasets: [{ data: gpas, borderColor: acc, backgroundColor: acc + '33', fill: true, tension: .35, pointRadius: 4 }] },
    options: { ...opts, plugins: { ...opts.plugins, title: { ...opts.plugins.title, text: 'GPA per semester' } }, scales: { ...opts.scales, y: { ...opts.scales.y, max: S.scale } } }
  });
  make('barChart', {
    type: 'bar', data: { labels: GRADES, datasets: [{ data: dist, backgroundColor: acc, borderRadius: 6 }] },
    options: { ...opts, plugins: { ...opts.plugins, title: { ...opts.plugins.title, text: 'Grade distribution' } } }
  });
}

/* ---------- Theme ---------- */
$('#theme').onclick = e => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next; try { localStorage.setItem('cgpa-theme', next); } catch (x) { }
  const b = e.currentTarget; b.classList.add('spin'); setTimeout(() => b.classList.remove('spin'), 500);
  setIcon(); drawCharts();
};
const setIcon = () => $('.ti').textContent = document.documentElement.dataset.theme === 'dark' ? '☾' : '☀';
setIcon();

/* ---------- Actions ---------- */
$('#print').onclick = () => window.print();
$('#copy').onclick = async () => {
  const T = totals(), lines = S.semesters.map(s => `${s.name}: GPA ${semStats(s).gpa.toFixed(2)} (${semStats(s).u} units)`);
  const txt = `CGPA Summary (${S.scale}.0 scale)\n${lines.join('\n')}\nTotal units: ${T.u}\nCGPA: ${T.cgpa.toFixed(2)} - ${T.u ? CLASSES[classIndex(T.cgpa)][1] : 'n/a'}`;
  try { await navigator.clipboard.writeText(txt); toast('Summary copied'); } catch (e) { toast('Copy is not available in this browser'); }
};
$('#reset').onclick = () => $('#dlg').showModal();
$('#no').onclick = () => $('#dlg').close();
$('#yes').onclick = () => {
  S = blank(); save(); $('#dlg').close(); lastClass = -1; $('#scale').value = 5;
  ['pCgpa', 'pUnits', 'tCgpa', 'tUnits'].forEach(i => $('#' + i).value = ''); renderSems(); toast('All data cleared');
};

/* ---------- Confetti (First Class only) ---------- */
function confetti() {
  if (reduced) return;
  const cv = $('#confetti'), ctx = cv.getContext('2d'); cv.width = innerWidth; cv.height = innerHeight;
  const cols = ['#3ddc97', '#f2a900', '#4f8cff', '#ff6b6b'];
  const ps = Array.from({ length: 120 }, () => ({ x: Math.random() * cv.width, y: -20, vx: (Math.random() - .5) * 4, vy: 2 + Math.random() * 4, s: 4 + Math.random() * 6, c: cols[Math.random() * 4 | 0] }));
  let f = 0;
  (function tick() {
    ctx.clearRect(0, 0, cv.width, cv.height);
    ps.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += .05; ctx.fillStyle = p.c; ctx.fillRect(p.x, p.y, p.s, p.s * .6); });
    if (++f < 140) requestAnimationFrame(tick); else ctx.clearRect(0, 0, cv.width, cv.height);
  })();
  toast('First Class. Well done!');
}

/* ---------- Legend + scroll reveal ---------- */
$('#legend').innerHTML = GRADES.map(g => `<span>${g}: ${RANGES[g]}</span>`).join('');
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('seen'); io.unobserve(e.target); } }), { threshold: .1 });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));

/* ---------- Accounts (stored on this device only) ---------- */
const enc = new TextEncoder();
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function hashPw(pw, salt) {                       // PBKDF2 so no plain password is ever stored
  const k = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  return b64(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' }, k, 256));
}
const getUsers = () => { try { return JSON.parse(localStorage.getItem(USERS)) || {} } catch (e) { return {} } };
const setUsers = u => localStorage.setItem(USERS, JSON.stringify(u));
const authDlg = $('#auth'), acctDlg = $('#acct');
let mode = 'login', fails = 0, lockUntil = 0;

function syncInputs() {
  $('#scale').value = S.scale;
  $('#pCgpa').value = S.prev.cgpa; $('#pUnits').value = S.prev.units;
  $('#tCgpa').value = S.target.cgpa; $('#tUnits').value = S.target.units;
}
function afterSwitch() {
  S = load(); syncInputs(); lastClass = -1; renderSems(); updateAuthUI();
  goToPage("home");
}
function updateAuthUI() {
  const u = user && getUsers()[user];
  $('#authBtn').textContent = u ? u.name.split(' ')[0] : 'Log in';
  $('#authBtn').classList.toggle('primary', !u);
  $('#authBtn').setAttribute('aria-label', u ? 'Account menu' : 'Log in');
  $('#heroSignup').hidden = !!u;
}
function setMode(m) {
  mode = m; const su = m === 'signup';
  $('#tabLogin').classList.toggle('on', !su); $('#tabSignup').classList.toggle('on', su);
  $('#tabLogin').setAttribute('aria-selected', !su); $('#tabSignup').setAttribute('aria-selected', su);
  $('#lName').hidden = !su; $('#lConf').hidden = !su;
  $('#forgot').hidden = su;
  $('#authTitle').textContent = su ? 'Create your account' : 'Welcome back';
  $('#authSub').textContent = su ? 'Your current semesters will be saved to the new account.' : 'Log in to load your saved semesters.';
  $('#authGo').textContent = su ? 'Create account' : 'Log in';
  $('#aPw').autocomplete = su ? 'new-password' : 'current-password';
  $('#authErr').textContent = '';
}
function openAuth(m) { $('#authForm').reset(); $('#aPw').type = $('#aConf').type = 'password'; setMode(m); authDlg.showModal(); $('#aEmail').focus(); }
function signIn(email, remember) {
  user = email;
  try { localStorage.removeItem(SESSION); sessionStorage.removeItem(SESSION); (remember ? localStorage : sessionStorage).setItem(SESSION, email); } catch (x) { }
  authDlg.close(); afterSwitch();
}
function signOut() {
  user = null; try { localStorage.removeItem(SESSION); sessionStorage.removeItem(SESSION); } catch (x) { }
  acctDlg.close(); afterSwitch(); toast('Logged out');
}

$('#authBtn').onclick = () => {
  if (!user) return openAuth('login');
  const u = getUsers()[user]; $('#acName').textContent = u.name; $('#acMail').textContent = user; acctDlg.showModal();
};
$('#heroSignup').onclick = () => openAuth('signup');
$('#tabLogin').onclick = () => setMode('login');
$('#tabSignup').onclick = () => setMode('signup');
$('#guest').onclick = () => authDlg.close();
$('#acClose').onclick = () => acctDlg.close();
$('#logout').onclick = signOut;
$('#aShow').onchange = e => { $('#aPw').type = $('#aConf').type = e.target.checked ? 'text' : 'password'; };

$('#authForm').addEventListener('submit', async e => {
  e.preventDefault();
  const err = m => { $('#authErr').textContent = m; shake($('#authForm')); };
  if (!(window.crypto && crypto.subtle)) return err('Accounts need a secure context. Open the site over https or localhost.');
  const email = $('#aEmail').value.trim().toLowerCase(), pw = $('#aPw').value, users = getUsers();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err('Enter a valid email address.');
  if (mode === 'signup') {
    const name = $('#aName').value.trim();
    if (name.length < 2) return err('Enter your name.');
    if (pw.length < 8 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return err('Password needs 8+ characters with at least one letter and one number.');
    if (pw !== $('#aConf').value) return err('Passwords do not match.');
    if (users[email]) return err('An account with this email already exists. Try logging in.');
    const salt = crypto.getRandomValues(new Uint8Array(16));
    users[email] = { name, salt: b64(salt), hash: await hashPw(pw, salt), created: Date.now() };
    setUsers(users);
    if (!user) { try { localStorage.setItem(GUEST_KEY + ':' + email, JSON.stringify(S)); } catch (x) { } } // carry guest work into the account
    signIn(email, $('#aRem').checked); toast('Account created. Your work is saved to it.');
    showRecovery(await setRecovery(email));
  } else {
    if (Date.now() < lockUntil) return err('Too many attempts. Wait 30 seconds and try again.');
    const u = users[email];
    const ok = u && (await hashPw(pw, unb64(u.salt))) === u.hash;
    if (!ok) { if (++fails >= 5) { lockUntil = Date.now() + 30000; fails = 0; } return err('Email or password is incorrect.'); }
    fails = 0; signIn(email, $('#aRem').checked); toast('Welcome back, ' + u.name.split(' ')[0]);
    if (!u.rhash) showRecovery(await setRecovery(email));
  }
});

let armed = false;
$('#delAcct').onclick = e => {
  const b = e.currentTarget;
  if (!armed) { armed = true; b.textContent = 'Click again to confirm'; setTimeout(() => { armed = false; b.textContent = 'Delete account'; }, 4000); return; }
  armed = false; b.textContent = 'Delete account';
  const users = getUsers(); delete users[user]; setUsers(users);
  try { localStorage.removeItem(GUEST_KEY + ':' + user); } catch (x) { }
  signOut(); toast('Account deleted');
};
document.querySelectorAll('dialog').forEach(d => d.addEventListener('click', e => {   // click outside to close
  const r = d.getBoundingClientRect();
  if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close();
}));

renderSems(); updateAuthUI();
goToPage("home");

/* ---------- Friendly button ripple interaction ---------- */
(() => {
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return;
  document.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    const rect = button.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'tap-ripple';
    ripple.style.left = `${event.clientX ? event.clientX - rect.left : rect.width / 2}px`;
    ripple.style.top = `${event.clientY ? event.clientY - rect.top : rect.height / 2}px`;
    button.appendChild(ripple);
    window.setTimeout(() => ripple.remove(), 650);
  });
})();



/* ---------- Me dashboard: profile, goals, history, preferences and backup ---------- */
const PROFILE_KEY = 'cgpa-profile-v2';
const profileKey = () => PROFILE_KEY + (user ? ':' + user : ':guest');
const defaultProfile = () => ({ name: '', school: '', department: '', course: '', level: '', matric: '', goal: '', avatar: '' });
function readProfile() { try { return Object.assign(defaultProfile(), JSON.parse(localStorage.getItem(profileKey()) || '{}')) } catch (e) { return defaultProfile() } }
function saveProfileData(p) { try { localStorage.setItem(profileKey(), JSON.stringify(p)); return true } catch (e) { toast('Could not save profile. The photo may be too large.'); return false } }
function refreshMe() {
  const p = readProfile(), T = totals(), idx = T.u ? classIndex(T.cgpa) : -1;
  $('#profileName').value = p.name; $('#profileSchool').value = p.school; $('#profileDepartment').value = p.department; $('#profileCourse').value = p.course; $('#profileLevel').value = p.level; $('#profileMatric').value = p.matric; $('#profileGoal').value = p.goal;
  $('#profileGreeting').textContent = p.name ? 'Hello, ' + p.name.trim().split(/\s+/)[0] + ' 👋' : 'Hello, student 👋';
  const av = $('#profileAvatar'); av.textContent = p.name ? (p.name.trim()[0] || 'S').toUpperCase() : 'S'; av.style.backgroundImage = p.avatar ? `url("${p.avatar}")` : ''; av.style.color = p.avatar ? 'transparent' : 'var(--bg)';
  $('#meCgpa').textContent = T.cgpa.toFixed(2); $('#meClass').textContent = idx < 0 ? 'Not available' : CLASSES[idx][1]; $('#meUnits').textContent = T.u; const filled = S.semesters.map(s => semStats(s)).filter(x => x.u); $('#meBest').textContent = filled.length ? Math.max(...filled.map(x => x.gpa)).toFixed(2) : '–';
  const goal = +p.goal, max = S.scale, pct = goal > 0 ? Math.min(100, T.cgpa / goal * 100) : 0; $('#goalProgress').style.width = pct + '%'; $('#goalProgressText').textContent = goal > 0 ? `${pct.toFixed(0)}% of ${goal.toFixed(2)}` : 'Set a target below';
  const history = $('#semesterHistory'); history.innerHTML = S.semesters.map((s, i) => ({ s, i, st: semStats(s) })).filter(x => x.st.u).map(x => `<div class="history-item"><span>${esc(x.s.name || 'Semester ' + (x.i + 1))}</span><b>GPA ${x.st.gpa.toFixed(2)} · ${x.st.u} units</b></div>`).join('') || '<p class="fine">Your recorded semesters will appear here.</p>';
  const achievements = []; if (T.u) achievements.push('📚 First courses added'); if (filled.length >= 2) achievements.push('🗓️ Multi-semester tracker'); if (T.cgpa >= 4.5 * S.scale / 5 && T.u) achievements.push('🏆 First Class range'); if (goal > 0 && T.cgpa >= goal) achievements.push('🎯 Target reached'); $('#achievementList').innerHTML = achievements.map(a => `<span class="achievement">${a}</span>`).join('') || '<span class="fine">Achievements appear as you record progress.</span>';
  $('#prefScale').value = S.scale; $('#accountStatus').textContent = user ? `Signed in locally as ${user}.` : 'You are using the calculator as a guest.'; $('#accountAction').textContent = user ? 'Open account options' : 'Log in / create account';
}
function storeProfileFromFields() { const p = readProfile(); for (const [key, id] of Object.entries({ name: 'profileName', school: 'profileSchool', department: 'profileDepartment', course: 'profileCourse', level: 'profileLevel', matric: 'profileMatric' })) p[key] = $('#' + id).value.trim(); saveProfileData(p); refreshMe(); }
$('#saveProfile').onclick = () => { storeProfileFromFields(); toast('Student profile saved'); };
$('#editProfileBtn').onclick = () => { $('#profileName').focus(); $('#profileName').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' }); };
$('#clearProfile').onclick = () => { if (!confirm('Clear your student profile details? Your academic records will remain.')) return; const p = defaultProfile(); saveProfileData(p); refreshMe(); toast('Profile cleared'); };
$('#saveGoal').onclick = () => { const p = readProfile(); p.goal = $('#profileGoal').value; saveProfileData(p); S.target.cgpa = p.goal; $('#tCgpa').value = p.goal; save(); update(); refreshMe(); toast('Academic goal saved'); };
$('#openPlan').onclick = () => goToPage('plan');
$('#prefTheme').onclick = () => $('#theme').click();
$('#prefScale').onchange = e => { $('#scale').value = e.target.value; $('#scale').dispatchEvent(new Event('change')); refreshMe(); };
function setAnimations(enabled) { document.body.classList.toggle('animations-off', !enabled); try { localStorage.setItem('cgpa-animations', enabled ? 'on' : 'off') } catch (e) { } $('#animToggle').checked = enabled; }
$('#animToggle').onchange = e => { setAnimations(e.target.checked); toast(e.target.checked ? 'Animations enabled' : 'Animations paused'); };
$('#resetPrefs').onclick = () => { if (!confirm('Reset theme, grading scale and animation preferences? Your course records will stay.')) return; try { localStorage.removeItem('cgpa-theme'); localStorage.removeItem('cgpa-animations') } catch (e) { } document.documentElement.dataset.theme = matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light'; S.scale = 5; save(); syncInputs(); $('#scale').value = 5; setIcon(); setAnimations(true); update(); refreshMe(); toast('Preferences reset'); };
$('#exportData').onclick = () => { const payload = { format: 'cgpa-calculator-backup', version: 2, exportedAt: new Date().toISOString(), academicData: S, profile: readProfile(), theme: document.documentElement.dataset.theme, animations: !document.body.classList.contains('animations-off') }; downloadFile('cgpa-backup-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(payload, null, 2), 'application/json'); toast('Backup exported'); };
function downloadFile(name, content, type) { const blob = new Blob([content], { type }), url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
$('#importFile').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { const obj = JSON.parse(await f.text()); const data = obj.academicData || obj; if (!data || !Array.isArray(data.semesters) || !data.prev || !data.target) throw Error('This file is not a valid CGPA backup.'); if (!confirm('Import this backup and replace the current academic records? Export a backup first if needed.')) return; S = Object.assign(blank(), data); save(); if (obj.profile) saveProfileData(Object.assign(defaultProfile(), obj.profile)); if (obj.theme) { document.documentElement.dataset.theme = obj.theme; localStorage.setItem('cgpa-theme', obj.theme); setIcon() } if (typeof obj.animations === 'boolean') setAnimations(obj.animations); syncInputs(); renderSems(); refreshMe(); toast('Backup imported successfully'); } catch (err) { toast(err.message || 'Could not read this backup') } finally { e.target.value = ''; } };
$('#exportCsv').onclick = () => { const rows = [['Semester', 'Course code', 'Course title', 'Credit units', 'Score', 'Grade', 'Grade points']]; S.semesters.forEach(s => s.courses.forEach(c => rows.push([s.name, c.code, c.title, c.unit, c.score, c.grade, c.grade ? POINTS[S.scale][c.grade] : '']))); const csv = rows.map(r => r.map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(',')).join('\r\n'); downloadFile('cgpa-courses.csv', csv, 'text/csv;charset=utf-8;'); toast('Course CSV exported'); };
$('#clearAcademicData').onclick = () => { if (!confirm('Clear all semesters, courses, previous CGPA and target planner data? This cannot be undone.')) return; S = blank(); save(); syncInputs(); renderSems(); refreshMe(); toast('Academic records cleared'); };
$('#accountAction').onclick = () => { if (user) { $('#authBtn').click() } else openAuth('login') };
$('#privacyInfo').onclick = () => alert('Privacy: profile and academic records are saved in this browser using local storage. They are not sent to a cloud service by this page. Anyone with access to this browser profile may be able to access saved data. Export a backup before clearing browser data.');
$('#howWorks').onclick = () => { const d = $('#howDetails'); d.hidden = !d.hidden; $('#howWorks').textContent = d.hidden ? 'How calculations work' : 'Hide calculation guide'; };
$('#avatarFile').onchange = async e => { const f = e.target.files[0]; if (!f) return; if (!f.type.startsWith('image/')) { toast('Choose an image file'); return } if (f.size > 2 * 1024 * 1024) { toast('Choose a photo smaller than 2 MB'); e.target.value = ''; return } const reader = new FileReader(); reader.onload = () => { const p = readProfile(); p.avatar = reader.result; saveProfileData(p); refreshMe(); toast('Profile photo updated') }; reader.readAsDataURL(f); e.target.value = ''; };
// A field change is retained locally too, so an accidental tab switch does not lose profile edits.
['profileName', 'profileSchool', 'profileDepartment', 'profileCourse', 'profileLevel', 'profileMatric'].forEach(id => $('#' + id).addEventListener('change', storeProfileFromFields));
const originalUpdate = update; update = function () { originalUpdate(); if ($('#meCgpa')) refreshMe(); };
const originalAfterSwitch = afterSwitch; afterSwitch = function () { originalAfterSwitch(); refreshMe(); };
// Rebuild background balls with varied sizes and quicker, gentle motion.
(function makeOrbs() { const wrap = document.createElement('div'); wrap.className = 'floating-orbs'; wrap.setAttribute('aria-hidden', 'true'); const sizes = [14, 20, 26, 32, 40, 48, 58, 72]; for (let i = 0; i < 22; i++) { const o = document.createElement('span'); o.className = 'orb'; const size = sizes[i % sizes.length]; o.style.width = size + 'px'; o.style.height = size + 'px'; o.style.left = (3 + Math.random() * 94) + '%'; o.style.top = (4 + Math.random() * 90) + '%'; o.style.setProperty('--dur', (3.2 + Math.random() * 3.4) + 's'); o.style.setProperty('--delay', (-Math.random() * 5) + 's'); o.style.setProperty('--dx', (-35 + Math.random() * 70) + 'px'); o.style.setProperty('--dy', (-35 + Math.random() * 70) + 'px'); wrap.appendChild(o) } document.body.prepend(wrap); let enabled = true; try { enabled = localStorage.getItem('cgpa-animations') !== 'off' } catch (e) { } setAnimations(enabled); })();
refreshMe();
/* ---------- Password reset (recovery code) + account transfer ---------- */
const RC_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const resetDlg = $('#resetDlg'), recDlg = $('#recDlg');
const normCode = c => String(c).toUpperCase().replace(/[^A-Z0-9]/g, '');
const goodPw = p => p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p);
let rFails = 0, rLock = 0;

function makeRecoveryCode() {
  const a = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(a, b => RC_CHARS[b % 32]).join('').match(/.{4}/g).join('-');
}
async function setRecovery(email) {
  const users = getUsers(), code = makeRecoveryCode(), salt = crypto.getRandomValues(new Uint8Array(16));
  users[email].rsalt = b64(salt); users[email].rhash = await hashPw(normCode(code), salt);
  setUsers(users); return code;
}
function showRecovery(code) { $('#recCode').textContent = code; recDlg.showModal(); }

$('#recCopy').onclick = async () => { try { await navigator.clipboard.writeText($('#recCode').textContent); toast('Code copied'); } catch (x) { toast('Could not copy. Write it down instead.'); } };
$('#recDone').onclick = () => { recDlg.close(); $('#recCode').textContent = ''; };
$('#recoveryBtn').onclick = async () => {
  if (!user || !confirm('Generate a new recovery code? Your old code will stop working.')) return;
  acctDlg.close(); showRecovery(await setRecovery(user));
};

$('#forgot').onclick = () => {
  $('#resetForm').reset(); $('#resetErr').textContent = '';
  $('#rEmail').value = $('#aEmail').value.trim();
  authDlg.close(); resetDlg.showModal(); ($('#rEmail').value ? $('#rCode') : $('#rEmail')).focus();
};
$('#resetCancel').onclick = () => { resetDlg.close(); openAuth('login'); };

$('#resetForm').addEventListener('submit', async e => {
  e.preventDefault();
  const err = m => { $('#resetErr').textContent = m; shake($('#resetForm')); };
  if (!(window.crypto && crypto.subtle)) return err('Needs a secure context. Open the site over https or localhost.');
  if (Date.now() < rLock) return err('Too many attempts. Wait 30 seconds and try again.');
  const email = $('#rEmail').value.trim().toLowerCase(), code = normCode($('#rCode').value), pw = $('#rPw').value;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err('Enter a valid email address.');
  if (code.length !== 12) return err('Enter the 12-character recovery code.');
  if (!goodPw(pw)) return err('Password needs 8+ characters with at least one letter and one number.');
  if (pw !== $('#rConf').value) return err('Passwords do not match.');
  const users = getUsers(), u = users[email];
  if (u && !u.rhash) return err('This account has no recovery code yet. Log in on the device where you made it, then use "New recovery code".');
  const ok = u && (await hashPw(code, unb64(u.rsalt))) === u.rhash;
  if (!ok) { if (++rFails >= 5) { rLock = Date.now() + 30000; rFails = 0; } return err('Email or recovery code is incorrect.'); }
  rFails = 0;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  u.salt = b64(salt); u.hash = await hashPw(pw, salt);
  setUsers(users);
  resetDlg.close(); signIn(email, true);
  toast('Password reset. Save your new recovery code.');
  showRecovery(await setRecovery(email));
});

/* Move an account to another device (e.g. laptop -> phone) */
$('#exportAcct').onclick = () => {
  const rec = getUsers()[user]; if (!rec) return;
  const payload = {
    format: 'gradepilot-account', version: 1, email: user, record: rec,
    data: localStorage.getItem(GUEST_KEY + ':' + user), profile: localStorage.getItem('cgpa-profile-v2:' + user)
  };
  downloadFile('gradepilot-account.json', JSON.stringify(payload), 'application/json');
  toast('Account file downloaded. Keep it private.');
};
$('#importAcct').onclick = () => $('#importAcctFile').click();
$('#importAcctFile').onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const o = JSON.parse(await f.text());
    if (o.format !== 'gradepilot-account' || typeof o.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(o.email) || !o.record || !o.record.hash || !o.record.salt) throw Error('This is not a valid account file.');
    const users = getUsers();
    if (users[o.email] && !confirm('An account with this email already exists on this device. Replace it?')) return;
    users[o.email] = o.record; setUsers(users);
    if (typeof o.data === 'string') localStorage.setItem(GUEST_KEY + ':' + o.email, o.data);
    if (typeof o.profile === 'string') localStorage.setItem('cgpa-profile-v2:' + o.email, o.profile);
    $('#aEmail').value = o.email; setMode('login'); $('#aPw').focus();
    toast('Account imported. Log in with your password.');
  } catch (err) { $('#authErr').textContent = err.message || 'Could not read this file.'; }
  finally { e.target.value = ''; }
};