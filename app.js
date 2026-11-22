/* Miswan Quran Academy — app.js
   Vervangt de Flask-backend: praat met Supabase en vult de pagina's.
   style.css / dashboard.css / main.js blijven ongewijzigd. */
(function () {
  'use strict';
  var CFG = window.MISWAN_CONFIG;
  var sb = window.supabase.createClient(CFG.url, CFG.key);

  /* ── helpers ─────────────────────────────────────────────────────────── */
  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var waLink = function (p) { return 'https://wa.me/' + encodeURIComponent(String(p || '').replace(/\+/g, '')); };
  var MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var p2 = function (n) { return String(n).padStart(2, '0'); };
  function fmtDate(iso, withYear) {
    var d = new Date(iso);
    return p2(d.getDate()) + ' ' + MON[d.getMonth()] + (withYear === false ? '' : ' ' + d.getFullYear());
  }
  function fmtDateTime(iso) {
    var d = new Date(iso);
    return fmtDate(iso) + ' – ' + p2(d.getHours()) + ':' + p2(d.getMinutes());
  }
  var LEVEL = { beginner: 'Beginner', basic: 'Basic Quran', advanced: 'Advanced / Hifz', children: 'Children' };
  var PLAN  = { starter: 'Starter', monthly: 'Monthly Package', children: 'Children' };
  var cap = function (s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); };
  var levelLabel = function (l) { return LEVEL[l] || cap(l); };
  var planLabel  = function (p) { return PLAN[p] || cap(p); };
  var initial = function (n) { return Array.from(String(n || '?'))[0] || '?'; };
  var tags = function (sp) {
    return String(sp).split(',').map(function (s) { return '<span class="tag">' + esc(s.trim()) + '</span>'; }).join('');
  };
  function fd(form) {
    var o = {};
    new FormData(form).forEach(function (v, k) { o[k] = String(v).trim(); });
    return o;
  }
  async function must(promise) {
    var r = await promise;
    if (r.error) throw r.error;
    return r.data || [];
  }
  async function countOf(promise) {
    var r = await promise;
    if (r.error) throw r.error;
    return r.count || 0;
  }

  var style = document.createElement('style');
  style.textContent = '[hidden]{display:none!important}';
  document.head.appendChild(style);

  /* ── flash messages (zelfde .alert markup als voorheen) ──────────────── */
  function flash(msg, cat) {
    var slot = $('#flash-slot');
    if (!slot) {
      slot = document.createElement('div');
      slot.className = 'flash-stack';
      slot.id = 'flash-slot';
      document.body.appendChild(slot);
    }
    var el = document.createElement('div');
    el.className = 'alert alert-' + (cat || 'success');
    var st = slot.getAttribute('data-alert-style');
    if (st) el.setAttribute('style', st);
    el.textContent = msg;
    slot.appendChild(el);
    setTimeout(function () {
      el.style.transition = 'opacity .4s';
      el.style.opacity = '0';
      setTimeout(function () { el.remove(); }, 400);
    }, 5000);
    el.addEventListener('click', function () { el.remove(); });
  }
  function flashNext(msg, cat) {
    try { sessionStorage.setItem('miswan_flash', JSON.stringify([msg, cat || 'success'])); } catch (e) {}
  }
  function showQueuedFlash() {
    try {
      var raw = sessionStorage.getItem('miswan_flash');
      if (raw) { sessionStorage.removeItem('miswan_flash'); var a = JSON.parse(raw); flash(a[0], a[1]); }
    } catch (e) {}
  }

  /* ── sessie / profiel ────────────────────────────────────────────────── */
  async function getSession() { return (await sb.auth.getSession()).data.session; }
  async function getProfile(uid) {
    var r = await sb.from('profiles').select('*').eq('id', uid).maybeSingle();
    return r.data || null;
  }
  async function guard(kind) {
    var s = await getSession();
    if (!s) { flashNext('Please log in to continue.', 'warning'); location.replace('login.html'); return null; }
    var p = await getProfile(s.user.id);
    if (!p) { await sb.auth.signOut({ scope: 'local' }); location.replace('login.html'); return null; }
    try { sessionStorage.setItem('miswan_role_' + p.id, p.role); } catch (e) {}
    if (kind === 'admin' && p.role !== 'admin') { location.replace('403.html'); return null; }
    if (kind === 'student' && p.role === 'admin') { location.replace('admin.html'); return null; }
    var g = $('#guard-style'); if (g) g.remove();
    $$('.sidebar-user').forEach(function (el) { el.textContent = p.name; });
    return p;
  }

  async function updateNav() {
    var links = $('#nav-links');
    var s = await getSession();
    if (links && s) {
      var role = null;
      try { role = sessionStorage.getItem('miswan_role_' + s.user.id); } catch (e) {}
      if (!role) {
        var p = await getProfile(s.user.id);
        role = p ? p.role : 'student';
        try { sessionStorage.setItem('miswan_role_' + s.user.id, role); } catch (e) {}
      }
      var items = $$('li', links);
      if (items.length >= 2) { items[items.length - 1].remove(); items[items.length - 2].remove(); }
      links.insertAdjacentHTML('beforeend',
        '<li><a href="' + (role === 'admin' ? 'admin.html' : 'dashboard.html') + '">Dashboard</a></li>' +
        '<li><a href="#logout" class="nav-cta">Log out</a></li>');
    }
    $$('.nav-links a').forEach(function (a) {
      if (a.pathname === location.pathname) a.classList.add('active');
    });
  }

  document.addEventListener('click', async function (e) {
    var a = e.target.closest('a[href="#logout"]');
    if (!a) return;
    e.preventDefault();
    await sb.auth.signOut({ scope: 'local' });
    Object.keys(sessionStorage).forEach(function (k) { if (k.indexOf('miswan_role_') === 0) sessionStorage.removeItem(k); });
    location.href = 'index.html';
  });

  function onSubmit(id, fn) {
    var f = document.getElementById(id);
    if (!f) return;
    f.addEventListener('submit', async function (e) {
      e.preventDefault();
      var btn = $('button[type=submit]', f);
      if (btn) btn.disabled = true;
      try { await fn(f); }
      catch (err) { console.error(err); flash('Something went wrong: ' + (err.message || 'please try again.'), 'danger'); }
      finally { if (btn) btn.disabled = false; }
    });
  }

  /* ── validatie (port van security.py) ────────────────────────────────── */
  function validatePassword(pw) {
    if (pw.length < 8) return 'Password must be at least 8 characters.';
    if (!/[A-Z]/.test(pw)) return 'Password must contain at least one uppercase letter.';
    if (!/[0-9]/.test(pw)) return 'Password must contain at least one number.';
    return null;
  }
  var validateEmail = function (e) { return /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(e); };

  /* ── rate limiting (login) ───────────────────────────────────────────── */
  var LOCK = 300000, MAXA = 5;
  function attempts() {
    try { var now = Date.now(); return JSON.parse(localStorage.getItem('miswan_attempts') || '[]').filter(function (t) { return now - t < LOCK; }); }
    catch (e) { return []; }
  }
  function recordAttempt() { var a = attempts(); a.push(Date.now()); try { localStorage.setItem('miswan_attempts', JSON.stringify(a)); } catch (e) {} return a.length; }
  function clearAttempts() { try { localStorage.removeItem('miswan_attempts'); } catch (e) {} }

  /* ── kaart-templates (zelfde markup als de Jinja-templates) ──────────── */
  function teacherCard(t, bioMax) {
    var h = '<div class="teacher-card"><div class="teacher-avatar">' + esc(initial(t.name)) + '</div><h3>' + esc(t.name) + '</h3>';
    if (t.title) h += '<div class="teacher-title">' + esc(t.title) + '</div>';
    if (t.speciality) h += '<div class="teacher-specs">' + tags(t.speciality) + '</div>';
    if (t.bio) {
      var b = t.bio;
      if (bioMax && b.length > bioMax) b = b.slice(0, bioMax) + '…';
      h += '<p>' + esc(b) + '</p>';
    }
    if (t.experience) h += '<div class="teacher-exp">' + esc(t.experience) + ' of teaching experience</div>';
    return h + '</div>';
  }
  function teacherCardWide(t) {
    var h = '<div class="teacher-card" style="text-align:left">' +
      '<div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.25rem">' +
      '<div class="teacher-avatar">' + esc(initial(t.name)) + '</div><div>' +
      '<h3 style="margin-bottom:.2rem">' + esc(t.name) + '</h3>';
    if (t.title) h += '<div class="teacher-title">' + esc(t.title) + '</div>';
    if (t.experience) h += '<div style="color:var(--muted);font-size:.78rem;margin-top:.2rem">' + esc(t.experience) + ' experience</div>';
    h += '</div></div>';
    if (t.speciality) h += '<div class="teacher-specs" style="justify-content:flex-start;margin-bottom:.75rem">' + tags(t.speciality) + '</div>';
    if (t.bio) h += '<p style="color:var(--muted);font-size:.9rem;line-height:1.7">' + esc(t.bio) + '</p>';
    return h + '</div>';
  }
  function testimonialCard(t) {
    return '<div class="testimonial-card"><div class="stars">' + '★'.repeat(t.rating || 0) + '</div>' +
      '<blockquote>"' + esc(t.text) + '"</blockquote><div class="testimonial-author">' +
      '<div class="author-avatar">' + esc(initial(t.name)) + '</div><div>' +
      '<div class="author-name">' + esc(t.name) + '</div>' +
      '<div class="author-meta">' + esc(t.role || '') + (t.country ? ' · ' + esc(t.country) : '') + '</div></div></div></div>';
  }
  async function loadTeachers(limit) {
    var q = sb.from('teachers').select('*').eq('active', true).order('sort_order').order('id');
    if (limit) q = q.limit(limit);
    return await must(q);
  }
  async function loadTestimonials(limit) {
    var q = sb.from('testimonials').select('*').eq('visible', true).order('sort_order').order('id');
    if (limit) q = q.limit(limit);
    return await must(q);
  }
  function fillGrid(sectionId, gridId, items, render) {
    if (!items.length) return;
    $('#' + gridId).innerHTML = items.map(render).join('');
    $('#' + sectionId).hidden = false;
  }

  /* ── publieke formulieren ────────────────────────────────────────────── */
  function bookingForm(id, status, okMsg) {
    onSubmit(id, async function (f) {
      var d = fd(f);
      if (!d.name || !d.phone) { flash('Name and phone number are required.', 'danger'); return; }
      var row = { name: d.name, phone: d.phone, email: d.email || '', country: d.country || '', age: d.age || '',
                  level: d.level || '', course: d.course || '', message: d.message || '' };
      if (status) row.status = status;
      var r = await sb.from('trial_bookings').insert(row);
      if (r.error) throw r.error;
      flash(okMsg, 'success');
      f.reset();
    });
  }

  var pages = {};
  var current = function () {};

  pages.home = async function () {
    fillGrid('home-teachers', 'home-teachers-grid', await loadTeachers(4), function (t) { return teacherCard(t, 110); });
    fillGrid('home-testimonials', 'home-testimonials-grid', await loadTestimonials(6), testimonialCard);
  };
  pages.about = async function () {
    fillGrid('about-teachers', 'about-teachers-grid', await loadTeachers(), function (t) { return teacherCard(t); });
  };
  pages.teachers = async function () {
    var items = await loadTeachers();
    if (items.length) { $('#teachers-grid').innerHTML = items.map(teacherCardWide).join(''); $('#teachers-grid').hidden = false; }
    else $('#teachers-empty').hidden = false;
  };
  pages.testimonials = async function () {
    var items = await loadTestimonials();
    if (items.length) { $('#testimonials-grid').innerHTML = items.map(testimonialCard).join(''); $('#testimonials-grid').hidden = false; }
    else $('#testimonials-empty').hidden = false;
  };
  pages.contact = function () {
    onSubmit('contact-form', async function (f) {
      var d = fd(f);
      if (!d.name || !d.message) { flash('Name and message are required.', 'danger'); return; }
      var r = await sb.from('contact_messages').insert({ name: d.name, email: d.email || '', phone: d.phone || '', subject: d.subject || '', message: d.message });
      if (r.error) throw r.error;
      flash("Thank you! We'll be in touch within 24 hours. Jazakallahu Khayran.", 'success');
      f.reset();
    });
  };
  pages['book-trial'] = function () {
    bookingForm('trial-form', null, 'Your free trial has been booked! We will contact you within 24 hours. Insha Allah.');
  };
  pages.enroll = function () {
    bookingForm('enroll-form', 'enrolled', 'Enrollment submitted! We will contact you within 24 hours. Jazakallahu Khayran.');
  };

  /* ── auth-pagina's ───────────────────────────────────────────────────── */
  async function redirectIfLoggedIn() {
    var s = await getSession();
    if (!s) return;
    var p = await getProfile(s.user.id);
    if (p) location.replace(p.role === 'admin' ? 'admin.html' : 'dashboard.html');
  }

  pages.login = async function () {
    await redirectIfLoggedIn();
    onSubmit('login-form', async function (f) {
      if (attempts().length >= MAXA) { flash('Too many failed attempts. Please wait 5 minutes.', 'danger'); return; }
      var email = f.elements.email.value.trim().toLowerCase(), pw = f.elements.password.value;
      if (!email || !pw) { flash('Please fill in all fields.', 'danger'); return; }
      var r = await sb.auth.signInWithPassword({ email: email, password: pw });
      if (r.error || !r.data.user) {
        var rem = MAXA - recordAttempt();
        flash(rem > 0 ? 'Incorrect email or password. ' + rem + ' attempt(s) remaining.' : 'Too many failed attempts. Please wait 5 minutes.', 'danger');
        return;
      }
      var p = await getProfile(r.data.user.id);
      await sb.auth.signOut({ scope: 'local' });
      if (!p) { flash('Account not found. Please contact us.', 'warning'); return; }
      if (p.status === 'paused') { flash('Your account has been paused. Please contact us.', 'warning'); return; }
      var o = await sb.auth.signInWithOtp({ email: email, options: { shouldCreateUser: false } });
      if (o.error) { flash('Could not send verification email: ' + o.error.message, 'danger'); return; }
      sessionStorage.setItem('miswan_2fa', JSON.stringify({ email: email, name: p.name }));
      clearAttempts();
      flashNext('A 6-digit verification code has been sent to ' + email + '. Check your inbox.', 'success');
      location.href = 'verify.html';
    });
  };

  pages.verify = function () {
    var pending = null;
    try { pending = JSON.parse(sessionStorage.getItem('miswan_2fa') || 'null'); } catch (e) {}
    if (!pending) { location.replace('login.html'); return; }
    $('#verify-email').textContent = pending.email;
    onSubmit('codeForm', async function (f) {
      var code = '';
      for (var i = 1; i <= 6; i++) code += (f.elements['d' + i].value || '').trim();
      if (code.length !== 6 || !/^\d{6}$/.test(code)) { flash('Please enter the complete 6-digit code.', 'danger'); return; }
      var r = await sb.auth.verifyOtp({ email: pending.email, token: code, type: 'email' });
      if (r.error || !r.data.user) { flash('Invalid or expired code. Please try again.', 'danger'); return; }
      var p = await getProfile(r.data.user.id);
      if (!p || p.status === 'paused') {
        await sb.auth.signOut({ scope: 'local' });
        flashNext(p ? 'Your account has been paused. Please contact us.' : 'User not found. Please try again.', p ? 'warning' : 'danger');
        location.replace('login.html');
        return;
      }
      sessionStorage.removeItem('miswan_2fa');
      try { sessionStorage.setItem('miswan_role_' + p.id, p.role); } catch (e) {}
      flashNext('Welcome back! You are now logged in.', 'success');
      location.href = p.role === 'admin' ? 'admin.html' : 'dashboard.html';
    });
    onSubmit('resendForm', async function () {
      var o = await sb.auth.signInWithOtp({ email: pending.email, options: { shouldCreateUser: false } });
      if (o.error) { flash('Could not send verification email: ' + o.error.message, 'danger'); return; }
      flash('A new code has been sent to your email.', 'success');
    });
  };

  pages.register = async function () {
    await redirectIfLoggedIn();
    onSubmit('register-form', async function (f) {
      var d = fd(f), pw = f.elements.password.value, pw2 = f.elements.password2.value;
      var email = (d.email || '').toLowerCase();
      if (!d.name || !email || !pw) { flash('Name, email and password are required.', 'danger'); return; }
      if (!validateEmail(email)) { flash('Please enter a valid email address.', 'danger'); return; }
      if (pw !== pw2) { flash('Passwords do not match.', 'danger'); return; }
      var bad = validatePassword(pw);
      if (bad) { flash(bad, 'danger'); return; }
      var r = await sb.auth.signUp({ email: email, password: pw,
        options: { data: { name: d.name, phone: d.phone || '', country: d.country || '', level: d.level || 'beginner' } } });
      if (r.error) {
        flash(/registered|exists/i.test(r.error.message) ? 'This email is already registered.' : r.error.message, 'danger');
        return;
      }
      if (!r.data.session) { flashNext('Account created. Please log in.', 'success'); location.href = 'login.html'; return; }
      flashNext('Welcome to Miswan Academy! Barak Allahu feek.', 'success');
      location.href = 'dashboard.html';
    });
  };

  /* ── studentenportaal ────────────────────────────────────────────────── */
  var dash = function (id) { return $('#' + id); };
  var teacherName = function (x) { return x.teacher ? esc(x.teacher.name) : '—'; };

  pages.dashboard = async function () {
    var p = await guard('student'); if (!p) return;
    dash('first-name').textContent = (p.name || '').trim().split(/\s+/)[0];
    if (p.status === 'paused') dash('paused-banner').hidden = false;
    var res = await Promise.all([
      must(sb.from('enrollments').select('*, teacher:teachers(name)').eq('student_id', p.id).order('id')),
      must(sb.from('schedules').select('*, teacher:teachers(name)').eq('student_id', p.id).order('id'))
    ]);
    var enr = res[0], sch = res[1];
    dash('st-level').textContent = levelLabel(p.level);
    dash('st-plan').textContent = planLabel(p.plan);
    dash('st-enr').textContent = enr.length;
    dash('st-sch').textContent = sch.length;
    if (sch.length) {
      dash('dash-schedules').innerHTML = '<div class="box"><div class="box-header"><h2>Upcoming Lessons</h2><a href="dashboard-schedule.html" style="font-size:.8rem;color:var(--green)">View all →</a></div>' +
        '<table><thead><tr><th>Course</th><th>Teacher</th><th>Day</th><th>Time</th></tr></thead><tbody>' +
        sch.map(function (s) { return '<tr><td><strong>' + esc(s.lesson_type) + '</strong></td><td>' + teacherName(s) + '</td><td>' + esc(s.day) + '</td><td>' + esc(s.time) + '</td></tr>'; }).join('') +
        '</tbody></table></div>';
    }
    if (enr.length) {
      dash('dash-enrollments').innerHTML = '<div class="box"><div class="box-header"><h2>My Courses</h2><a href="dashboard-lessons.html" style="font-size:.8rem;color:var(--green)">View all →</a></div>' +
        '<table><thead><tr><th>Course</th><th>Teacher</th><th>Method</th></tr></thead><tbody>' +
        enr.map(function (e) { return '<tr><td><strong>' + esc(e.lesson_type) + '</strong></td><td>' + teacherName(e) + '</td><td><span class="badge badge-active">' + esc(e.method) + '</span></td></tr>'; }).join('') +
        '</tbody></table></div>';
    }
  };

  pages.lessons = async function () {
    var p = await guard('student'); if (!p) return;
    var enr = await must(sb.from('enrollments').select('*, teacher:teachers(name)').eq('student_id', p.id).order('id'));
    dash('lessons-root').innerHTML = enr.length
      ? '<table><thead><tr><th>Course</th><th>Teacher</th><th>Method</th><th>Enrolled since</th></tr></thead><tbody>' +
        enr.map(function (e) { return '<tr><td><strong>' + esc(e.lesson_type) + '</strong></td><td>' + teacherName(e) + '</td><td><span class="badge badge-active">' + esc(e.method) + '</span></td><td style="color:#5a7263;font-size:.8rem">' + fmtDate(e.created_at) + '</td></tr>'; }).join('') + '</tbody></table>'
      : '<div class="empty-state"><p>No lessons enrolled yet.</p><a href="contact.html" style="color:var(--green);font-weight:600">Contact us to get started →</a></div>';
  };

  pages.schedule = async function () {
    var p = await guard('student'); if (!p) return;
    var sch = await must(sb.from('schedules').select('*, teacher:teachers(name)').eq('student_id', p.id).order('day').order('time'));
    dash('schedule-root').innerHTML = sch.length
      ? '<table><thead><tr><th>Day</th><th>Time</th><th>Course</th><th>Teacher</th></tr></thead><tbody>' +
        sch.map(function (s) { return '<tr><td><strong>' + esc(s.day) + '</strong></td><td>' + esc(s.time) + '</td><td>' + esc(s.lesson_type) + '</td><td>' + teacherName(s) + '</td></tr>'; }).join('') + '</tbody></table>'
      : '<div class="empty-state"><p>No lessons scheduled yet.</p><a href="contact.html" style="color:var(--green);font-weight:600">Contact us to schedule →</a></div>';
  };

  /* ── admin: gedeelde stukken ─────────────────────────────────────────── */
  function statusForm(b, pad) {
    var opts = ['new', 'contacted', 'enrolled', 'cancelled'].map(function (s) {
      return '<option value="' + s + '"' + (b.status === s ? ' selected' : '') + '>' + s + '</option>';
    }).join('');
    return '<form method="POST" data-action="booking-status" data-id="' + esc(b.id) + '" style="display:flex;gap:.3rem;align-items:center">' +
      '<select name="status" style="font-size:.72rem;padding:' + pad + ';border:1px solid #d0e4d7;border-radius:5px">' + opts + '</select>' +
      '<button type="submit" class="btn-sm btn-edit">Save</button></form>';
  }
  function pauseForm(s, label, confirmText) {
    return '<form style="display:inline" method="POST" data-action="student-pause" data-id="' + esc(s.id) + '" data-status="' + esc(s.status) +
      '" data-confirm="' + esc(confirmText) + '"><button type="submit" class="btn-sm btn-pause">' + label + '</button></form>';
  }
  function deleteStudentForm(s) {
    return '<form style="display:inline" method="POST" data-action="student-delete" data-id="' + esc(s.id) + '" data-name="' + esc(s.name) +
      '" data-confirm="' + esc('Permanently delete ' + s.name + '? This cannot be undone.') + '"><button type="submit" class="btn-sm btn-delete">Delete</button></form>';
  }
  function addDot(href) {
    var a = $('.sidebar a[href="' + href + '"]');
    if (a) a.insertAdjacentHTML('beforeend', '<span class="unread-dot"></span>');
  }
  var studentIdFromUrl = function () { return new URLSearchParams(location.search).get('id'); };

  /* ── admin: dashboard ────────────────────────────────────────────────── */
  pages.admin = async function () {
    var p = await guard('admin'); if (!p) return;
    var r = await Promise.all([
      must(sb.from('profiles').select('*').eq('role', 'student').order('created_at', { ascending: false })),
      must(sb.from('trial_bookings').select('*').order('created_at', { ascending: false }).limit(10)),
      countOf(sb.from('trial_bookings').select('id', { count: 'exact', head: true }).eq('is_read', false)),
      countOf(sb.from('contact_messages').select('id', { count: 'exact', head: true }).eq('is_read', false)),
      countOf(sb.from('teachers').select('id', { count: 'exact', head: true }).eq('active', true))
    ]);
    var studs = r[0], books = r[1], nb = r[2], nm = r[3], tc = r[4];
    dash('st-total').textContent = studs.length;
    dash('st-active').textContent = studs.filter(function (s) { return s.status === 'active'; }).length;
    dash('st-paused').textContent = studs.filter(function (s) { return s.status === 'paused'; }).length;
    dash('st-teachers').textContent = tc;
    dash('st-nb').textContent = nb; dash('st-nb').style.color = nb > 0 ? '#1d4ed8' : '#1a6b3c';
    dash('st-nm').textContent = nm; dash('st-nm').style.color = nm > 0 ? '#b91c1c' : '#1a6b3c';
    if (nb > 0) addDot('admin-bookings.html');
    if (nm > 0) addDot('admin-messages.html');

    if (books.length) {
      dash('adm-bookings').innerHTML = '<div class="box"><div class="box-header"><h2>Recent Trial Bookings</h2><a href="admin-bookings.html" style="font-size:.8rem;color:var(--green)">View all →</a></div>' +
        '<table><thead><tr><th>Name</th><th>Phone</th><th>Country</th><th>Course</th><th>Status</th><th>Date</th><th>Action</th></tr></thead><tbody>' +
        books.map(function (b) {
          return '<tr><td><strong>' + esc(b.name) + '</strong></td><td><a href="' + waLink(b.phone) + '" style="color:var(--green)">' + esc(b.phone) + '</a></td>' +
            '<td style="color:#5a7263">' + esc(b.country || '—') + '</td><td style="color:#5a7263;font-size:.8rem">' + esc(b.course || '—') + '</td>' +
            '<td><span class="badge badge-' + esc(b.status) + '">' + esc(b.status) + '</span></td>' +
            '<td style="color:#5a7263;font-size:.78rem">' + fmtDate(b.created_at, false) + '</td><td>' + statusForm(b, '.2rem .4rem') + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }
    dash('adm-students').innerHTML = studs.length
      ? '<table><thead><tr><th>Name</th><th>Email</th><th>Country</th><th>Level</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead><tbody>' +
        studs.map(function (s) {
          var paused = s.status === 'paused';
          return '<tr><td><a href="admin-student-detail.html?id=' + encodeURIComponent(s.id) + '" style="font-weight:600;color:#1a2a1e">' + esc(s.name) + '</a></td>' +
            '<td style="color:#5a7263;font-size:.82rem">' + esc(s.email) + '</td><td style="color:#5a7263">' + esc(s.country || '—') + '</td>' +
            '<td><span class="badge badge-' + esc(s.level) + '">' + esc(levelLabel(s.level)) + '</span></td>' +
            '<td><span class="badge badge-' + esc(s.status) + '">' + esc(s.status) + '</span></td>' +
            '<td style="color:#5a7263;font-size:.78rem">' + fmtDate(s.created_at) + '</td>' +
            '<td><div class="actions"><a href="admin-student-edit.html?id=' + encodeURIComponent(s.id) + '" class="btn-sm btn-edit">Edit</a>' +
            pauseForm(s, paused ? 'Reactivate' : 'Pause', (paused ? 'Reactivate' : 'Pause') + ' ' + s.name + '?') + deleteStudentForm(s) + '</div></td></tr>';
        }).join('') + '</tbody></table>'
      : '<div class="empty-state"><p>No students yet. <a href="admin-student-new.html" style="color:var(--green)">Add the first one →</a></p></div>';
  };
  pages.admin.reload = true;

  /* ── admin: student toevoegen / bewerken ─────────────────────────────── */
  async function studentForm(editId) {
    var p = await guard('admin'); if (!p) return;
    var f = $('#student-form'), s = null;
    if (editId) {
      var r = await sb.from('profiles').select('*').eq('id', editId).eq('role', 'student').maybeSingle();
      s = r.data;
      if (!s) { flashNext('Student not found.', 'danger'); location.replace('admin.html'); return; }
      ['name', 'email', 'phone', 'country', 'level', 'plan', 'notes'].forEach(function (k) { f.elements[k].value = s[k] || ''; });
      f.elements.email.readOnly = true;
    }
    onSubmit('student-form', async function () {
      var d = fd(f), pw = f.elements.password.value.trim();
      if (!editId) {
        var email = (d.email || '').toLowerCase();
        if (!d.name || !email || !pw) { flash('Name, email and password are required.', 'danger'); return; }
        // tweede client zonder sessie, zodat de admin ingelogd blijft
        var tmp = window.supabase.createClient(CFG.url, CFG.key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'miswan-tmp' } });
        var r = await tmp.auth.signUp({ email: email, password: pw, options: { data: { name: d.name, phone: d.phone || '', country: d.country || '', level: d.level || 'beginner' } } });
        if (r.error) { flash(/registered|exists/i.test(r.error.message) ? 'Email already registered.' : r.error.message, 'danger'); return; }
        var upd = await sb.from('profiles').update({ plan: d.plan, notes: d.notes || '', status: 'active' }).eq('id', r.data.user.id);
        if (upd.error) throw upd.error;
        flashNext(d.name + ' added successfully.', 'success');
      } else {
        var u = await sb.from('profiles').update({ name: d.name, phone: d.phone || '', country: d.country || '', level: d.level, plan: d.plan, notes: d.notes || '' }).eq('id', editId);
        if (u.error) throw u.error;
        if (pw) {
          var rp = await sb.rpc('admin_set_password', { uid: editId, pw: pw });
          if (rp.error) { flash('Could not change password: ' + rp.error.message, 'danger'); return; }
        }
        flashNext('Student updated.', 'success');
      }
      location.href = 'admin.html';
    });
  }
  pages['admin-student-new']  = function () { return studentForm(null); };
  pages['admin-student-edit'] = function () { return studentForm(studentIdFromUrl()); };

  /* ── admin: student detail ───────────────────────────────────────────── */
  pages['admin-student-detail'] = async function () {
    var p = await guard('admin'); if (!p) return;
    var id = studentIdFromUrl();
    var r = await sb.from('profiles').select('*').eq('id', id).eq('role', 'student').maybeSingle();
    var s = r.data;
    if (!s) { flashNext('Student not found.', 'danger'); location.replace('admin.html'); return; }
    var res = await Promise.all([
      must(sb.from('schedules').select('*, teacher:teachers(name)').eq('student_id', id).order('day').order('time')),
      must(sb.from('enrollments').select('*, teacher:teachers(name)').eq('student_id', id).order('id'))
    ]);
    var sch = res[0], enr = res[1];
    document.title = s.name + ' – Miswan Academy';
    dash('sd-name').textContent = s.name;
    var lbl = 'font-size:.7rem;color:#5a7263;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.25rem';
    var cell = function (l, inner) { return '<div><div style="' + lbl + '">' + l + '</div>' + inner + '</div>'; };
    var paused = s.status === 'paused';
    var h = '<div class="box" style="margin-bottom:1.5rem"><div class="box-body">' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:1rem;margin-bottom:1.25rem">' +
      cell('Email', '<div>' + esc(s.email) + '</div>') +
      cell('Phone', '<div><a href="' + (s.phone ? waLink(s.phone) : 'https://wa.me/') + '" style="color:#25d366">' + esc(s.phone || '—') + '</a></div>') +
      cell('Country', '<div>' + esc(s.country || '—') + '</div>') +
      cell('Level', '<div><span class="badge badge-' + esc(s.level) + '">' + esc(levelLabel(s.level)) + '</span></div>') +
      cell('Plan', '<div style="font-size:.88rem">' + esc(planLabel(s.plan)) + '</div>') +
      cell('Status', '<div><span class="badge badge-' + esc(s.status) + '">' + esc(s.status) + '</span></div>') +
      cell('Joined', '<div style="font-size:.88rem">' + fmtDate(s.created_at) + '</div>') + '</div>';
    if (s.notes) h += '<div style="padding-top:1rem;border-top:1px solid #e0e9e3"><div style="' + lbl.replace('.25rem', '.35rem') + '">Notes</div><p style="color:#5a7263;font-size:.88rem">' + esc(s.notes) + '</p></div>';
    h += '<div style="display:flex;gap:.75rem;margin-top:1.25rem;padding-top:1.25rem;border-top:1px solid #e0e9e3;flex-wrap:wrap">' +
      '<a href="admin-student-edit.html?id=' + encodeURIComponent(s.id) + '" class="btn-sm btn-edit">Edit</a>' +
      pauseForm(s, paused ? 'Reactivate' : 'Pause Account', (paused ? 'Reactivate' : 'Pause') + ' account?') + deleteStudentForm(s) + '</div></div></div>';
    h += '<div class="box" style="margin-bottom:1.5rem"><div class="box-header"><h2>Schedule</h2></div>' + (sch.length
      ? '<table><thead><tr><th>Day</th><th>Time</th><th>Lesson</th><th>Teacher</th></tr></thead><tbody>' + sch.map(function (x) { return '<tr><td><strong>' + esc(x.day) + '</strong></td><td>' + esc(x.time) + '</td><td>' + esc(x.lesson_type) + '</td><td>' + teacherName(x) + '</td></tr>'; }).join('') + '</tbody></table>'
      : '<div class="empty-state">No lessons scheduled yet.</div>') + '</div>';
    h += '<div class="box"><div class="box-header"><h2>Enrollments</h2></div>' + (enr.length
      ? '<table><thead><tr><th>Course</th><th>Teacher</th><th>Method</th><th>Since</th></tr></thead><tbody>' + enr.map(function (e) { return '<tr><td><strong>' + esc(e.lesson_type) + '</strong></td><td>' + teacherName(e) + '</td><td>' + esc(e.method) + '</td><td style="color:#5a7263;font-size:.8rem">' + fmtDate(e.created_at) + '</td></tr>'; }).join('') + '</tbody></table>'
      : '<div class="empty-state">No enrollments yet.</div>') + '</div>';
    dash('detail-root').innerHTML = h;
  };

  /* ── admin: teachers ─────────────────────────────────────────────────── */
  pages['admin-teachers'] = async function () {
    var p = await guard('admin'); if (!p) return;
    var ts = await must(sb.from('teachers').select('*').order('sort_order').order('created_at', { ascending: false }));
    dash('adm-teachers').innerHTML = ts.length
      ? '<table><thead><tr><th>Name</th><th>Title</th><th>Speciality</th><th>Experience</th><th>Status</th><th>Actions</th></tr></thead><tbody>' +
        ts.map(function (t) {
          var dim = 'style="color:#5a7263;font-size:.8rem"';
          return '<tr><td><strong>' + esc(t.name) + '</strong></td><td ' + dim + '>' + esc(t.title || '—') + '</td><td ' + dim + '>' + esc(t.speciality || '—') + '</td><td ' + dim + '>' + esc(t.experience || '—') + '</td>' +
            '<td><span class="badge ' + (t.active ? 'badge-active' : 'badge-paused') + '">' + (t.active ? 'Active' : 'Inactive') + '</span></td>' +
            '<td><div class="actions"><form method="POST" style="display:inline" data-action="teacher-toggle" data-id="' + esc(t.id) + '" data-active="' + t.active + '"><button type="submit" class="btn-sm btn-pause">' + (t.active ? 'Deactivate' : 'Activate') + '</button></form>' +
            '<form method="POST" style="display:inline" data-action="teacher-delete" data-id="' + esc(t.id) + '" data-confirm="' + esc('Delete ' + t.name + '?') + '"><button type="submit" class="btn-sm btn-delete">Delete</button></form></div></td></tr>';
        }).join('') + '</tbody></table>'
      : '<div class="empty-state">No teachers yet. Add the first one above.</div>';
  };
  function teacherFormInit() {
    onSubmit('teacher-form', async function (f) {
      var d = fd(f);
      if (!d.name) { flash('Name is required.', 'danger'); return; }
      var r = await sb.from('teachers').insert({ name: d.name, title: d.title || '', bio: d.bio || '', speciality: d.speciality || '', experience: d.experience || '' });
      if (r.error) throw r.error;
      flash(d.name + ' added.', 'success');
      f.reset();
      await current();
    });
  }

  /* ── admin: testimonials ─────────────────────────────────────────────── */
  pages['admin-testimonials'] = async function () {
    var p = await guard('admin'); if (!p) return;
    var ts = await must(sb.from('testimonials').select('*').order('sort_order').order('created_at', { ascending: false }));
    dash('adm-testimonials').innerHTML = ts.length
      ? '<table><thead><tr><th>Name</th><th>Role</th><th>Country</th><th>Rating</th><th>Text</th><th>Visible</th><th>Actions</th></tr></thead><tbody>' +
        ts.map(function (t) {
          var txt = t.text || '';
          return '<tr><td><strong>' + esc(t.name) + '</strong></td><td style="color:#5a7263">' + esc(t.role || '—') + '</td><td style="color:#5a7263">' + esc(t.country || '—') + '</td>' +
            '<td style="color:#c9a84c">' + '★'.repeat(t.rating) + '</td>' +
            '<td style="color:#5a7263;font-size:.8rem;max-width:220px">' + esc(txt.slice(0, 80)) + (txt.length > 80 ? '…' : '') + '</td>' +
            '<td><span class="badge ' + (t.visible ? 'badge-active' : 'badge-paused') + '">' + (t.visible ? 'Visible' : 'Hidden') + '</span></td>' +
            '<td><div class="actions"><form method="POST" style="display:inline" data-action="testimonial-toggle" data-id="' + esc(t.id) + '" data-visible="' + t.visible + '"><button type="submit" class="btn-sm btn-pause">' + (t.visible ? 'Hide' : 'Show') + '</button></form>' +
            '<form method="POST" style="display:inline" data-action="testimonial-delete" data-id="' + esc(t.id) + '" data-confirm="Delete this testimonial?"><button type="submit" class="btn-sm btn-delete">Delete</button></form></div></td></tr>';
        }).join('') + '</tbody></table>'
      : '<div class="empty-state">No testimonials yet. Add the first one above.</div>';
  };
  function testimonialFormInit() {
    onSubmit('testimonial-form', async function (f) {
      var d = fd(f);
      if (!d.name || !d.text) { flash('Name and text are required.', 'danger'); return; }
      var r = await sb.from('testimonials').insert({ name: d.name, role: d.role || '', country: d.country || '', text: d.text, rating: parseInt(d.rating, 10) || 5 });
      if (r.error) throw r.error;
      flash('Testimonial added.', 'success');
      f.reset();
      await current();
    });
  }

  /* ── admin: schedule ─────────────────────────────────────────────────── */
  pages['admin-schedule'] = async function () {
    var p = await guard('admin'); if (!p) return;
    var res = await Promise.all([
      must(sb.from('schedules').select('*, student:profiles(name), teacher:teachers(name)').order('day').order('time')),
      must(sb.from('profiles').select('id,name').eq('role', 'student').eq('status', 'active').order('name')),
      must(sb.from('teachers').select('id,name').eq('active', true).order('name'))
    ]);
    var sch = res[0];
    var keepS = dash('sel-student').value, keepT = dash('sel-teacher').value;
    dash('sel-student').innerHTML = '<option value="">— Select student —</option>' + res[1].map(function (s) { return '<option value="' + esc(s.id) + '">' + esc(s.name) + '</option>'; }).join('');
    dash('sel-teacher').innerHTML = '<option value="">— Select teacher —</option>' + res[2].map(function (t) { return '<option value="' + esc(t.id) + '">' + esc(t.name) + '</option>'; }).join('');
    dash('sel-student').value = keepS; dash('sel-teacher').value = keepT;
    dash('adm-schedules').innerHTML = sch.length
      ? '<table><thead><tr><th>Student</th><th>Teacher</th><th>Course</th><th>Day</th><th>Time</th><th>Action</th></tr></thead><tbody>' +
        sch.map(function (s) {
          return '<tr><td><strong>' + esc(s.student ? s.student.name : '') + '</strong></td><td>' + teacherName(s) + '</td><td>' + esc(s.lesson_type) + '</td><td>' + esc(s.day) + '</td><td>' + esc(s.time) + '</td>' +
            '<td><form method="POST" data-action="schedule-delete" data-id="' + esc(s.id) + '" data-confirm="Remove this lesson?"><button type="submit" class="btn-sm btn-delete">Remove</button></form></td></tr>';
        }).join('') + '</tbody></table>'
      : '<div class="empty-state">No lessons scheduled yet.</div>';
  };
  function scheduleFormInit() {
    onSubmit('schedule-form', async function (f) {
      var d = fd(f);
      if (!d.student_id || !d.teacher_id) { flash('Please select a student and a teacher.', 'danger'); return; }
      var r = await sb.from('schedules').insert({ student_id: d.student_id, teacher_id: parseInt(d.teacher_id, 10), day: d.day || '', time: d.time || '', lesson_type: d.lesson_type || '' });
      if (r.error) throw r.error;
      flash('Lesson scheduled.', 'success');
      await current();
    });
  }

  /* ── admin: bookings & messages ──────────────────────────────────────── */
  pages['admin-bookings'] = async function () {
    var p = await guard('admin'); if (!p) return;
    var bs = await must(sb.from('trial_bookings').select('*').order('created_at', { ascending: false }));
    dash('adm-bookings-list').innerHTML = bs.length
      ? '<table><thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Country</th><th>Age/Level</th><th>Course</th><th>Message</th><th>Status</th><th>Date</th><th>Update</th></tr></thead><tbody>' +
        bs.map(function (b) {
          return '<tr style="' + (b.is_read ? '' : 'background:#fffdf0') + '"><td><strong>' + esc(b.name) + '</strong></td>' +
            '<td><a href="' + waLink(b.phone) + '" style="color:#25d366;font-weight:600">' + esc(b.phone) + '</a></td>' +
            '<td style="color:#5a7263;font-size:.8rem">' + esc(b.email || '—') + '</td><td style="color:#5a7263">' + esc(b.country || '—') + '</td>' +
            '<td style="color:#5a7263;font-size:.78rem">' + esc(b.age || '—') + ' / ' + esc(b.level || '—') + '</td>' +
            '<td style="font-size:.8rem;color:#1a2a1e">' + esc(b.course || '—') + '</td>' +
            '<td style="color:#5a7263;font-size:.78rem;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc((b.message || '').slice(0, 60)) + '</td>' +
            '<td><span class="badge badge-' + esc(b.status) + '">' + esc(b.status) + '</span></td>' +
            '<td style="color:#5a7263;font-size:.78rem">' + fmtDate(b.created_at) + '</td><td>' + statusForm(b, '.25rem .45rem') + '</td></tr>';
        }).join('') + '</tbody></table>'
      : '<div class="empty-state">No trial bookings yet. Share the website link to get your first booking!</div>';
    sb.from('trial_bookings').update({ is_read: true }).eq('is_read', false).then(function () {});
  };
  pages['admin-messages'] = async function () {
    var p = await guard('admin'); if (!p) return;
    var ms = await must(sb.from('contact_messages').select('*').order('created_at', { ascending: false }));
    dash('adm-messages').innerHTML = ms.length
      ? ms.map(function (m) {
          return '<div class="box" style="margin-bottom:1rem;' + (m.is_read ? '' : 'border-left:3px solid var(--green)') + '"><div class="box-body">' +
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.75rem;flex-wrap:wrap;gap:.5rem"><div>' +
            '<strong style="font-size:.95rem">' + esc(m.name) + '</strong><div style="color:#5a7263;font-size:.8rem;margin-top:.1rem">' +
            (m.email ? '<a href="mailto:' + esc(m.email) + '" style="color:var(--green)">' + esc(m.email) + '</a>' : '') +
            (m.phone ? ' · <a href="' + waLink(m.phone) + '" style="color:#25d366">' + esc(m.phone) + '</a>' : '') +
            (m.subject ? ' · <em>' + esc(m.subject) + '</em>' : '') + '</div></div>' +
            '<div style="color:#5a7263;font-size:.75rem">' + fmtDateTime(m.created_at) + '</div></div>' +
            '<p style="color:#2d3e35;font-size:.9rem;line-height:1.75;white-space:pre-wrap">' + esc(m.message) + '</p></div></div>';
        }).join('')
      : '<div class="box"><div class="empty-state">No contact messages yet.</div></div>';
    sb.from('contact_messages').update({ is_read: true }).eq('is_read', false).then(function () {});
  };

  /* ── admin: knoppen in tabellen (vervangt de POST-forms) ─────────────── */
  var actions = {
    'booking-status': async function (f) {
      await must(sb.from('trial_bookings').update({ status: f.elements.status.value }).eq('id', f.dataset.id));
      flashNext('Status updated.', 'success'); location.href = 'admin-bookings.html';
    },
    'student-pause': async function (f) {
      var next = f.dataset.status === 'paused' ? 'active' : 'paused';
      await must(sb.from('profiles').update({ status: next }).eq('id', f.dataset.id));
      flash('Account ' + (next === 'paused' ? 'paused' : 'reactivated') + '.', 'success'); await current();
    },
    'student-delete': async function (f) {
      var r = await sb.rpc('admin_delete_user', { uid: f.dataset.id });
      if (r.error) throw r.error;
      if (document.body.dataset.page === 'admin-student-detail') { flashNext(f.dataset.name + ' deleted.', 'success'); location.href = 'admin.html'; }
      else { flash(f.dataset.name + ' deleted.', 'success'); await current(); }
    },
    'teacher-toggle': async function (f) {
      var next = f.dataset.active !== 'true';
      await must(sb.from('teachers').update({ active: next }).eq('id', f.dataset.id));
      flash('Teacher ' + (next ? 'activated' : 'deactivated') + '.', 'success'); await current();
    },
    'teacher-delete': async function (f) {
      await must(sb.from('teachers').delete().eq('id', f.dataset.id));
      flash('Teacher removed.', 'success'); await current();
    },
    'testimonial-toggle': async function (f) {
      var next = f.dataset.visible !== 'true';
      await must(sb.from('testimonials').update({ visible: next }).eq('id', f.dataset.id));
      flash('Testimonial ' + (next ? 'shown' : 'hidden') + '.', 'success'); await current();
    },
    'testimonial-delete': async function (f) {
      await must(sb.from('testimonials').delete().eq('id', f.dataset.id));
      flash('Testimonial removed.', 'success'); await current();
    },
    'schedule-delete': async function (f) {
      await must(sb.from('schedules').delete().eq('id', f.dataset.id));
      flash('Lesson removed.', 'success'); await current();
    }
  };
  document.addEventListener('submit', async function (e) {
    var f = e.target.closest('form[data-action]');
    if (!f) return;
    e.preventDefault();
    if (f.dataset.confirm && !window.confirm(f.dataset.confirm)) return;
    try { await actions[f.dataset.action](f); }
    catch (err) { console.error(err); flash('Something went wrong: ' + (err.message || 'please try again.'), 'danger'); }
  });

  /* ── start ───────────────────────────────────────────────────────────── */
  async function init() {
    showQueuedFlash();
    var page = document.body.getAttribute('data-page');
    if (page === 'admin-teachers') teacherFormInit();
    if (page === 'admin-testimonials') testimonialFormInit();
    if (page === 'admin-schedule') scheduleFormInit();
    var fn = pages[page];
    if (fn) {
      current = fn;
      try { await fn(); } catch (err) { console.error(err); flash('Something went wrong: ' + (err.message || 'please try again.'), 'danger'); var g = $('#guard-style'); if (g) g.remove(); }
    }
    updateNav();
  }
  init();
})();
