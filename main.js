/* Miswan Quran Academy — main.js */

// ── Nav hamburger ──
(function () {
  var btn = document.querySelector('.hamburger');
  var nav = document.getElementById('nav-links');
  if (btn && nav) {
    btn.addEventListener('click', function () {
      nav.classList.toggle('open');
      document.body.style.overflow = nav.classList.contains('open') ? 'hidden' : '';
    });
    // Close on link click
    nav.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        nav.classList.remove('open');
        document.body.style.overflow = '';
      });
    });
  }
})();

// ── FAQ accordion ──
document.querySelectorAll('.faq-question').forEach(function (btn) {
  btn.addEventListener('click', function () {
    var answer = btn.nextElementSibling;
    var isOpen = btn.classList.contains('open');
    // Close all
    document.querySelectorAll('.faq-question').forEach(function (b) {
      b.classList.remove('open');
      b.nextElementSibling.classList.remove('open');
    });
    if (!isOpen) {
      btn.classList.add('open');
      answer.classList.add('open');
    }
  });
});

// ── Auto-dismiss alerts ──
document.querySelectorAll('.alert').forEach(function (el) {
  setTimeout(function () {
    el.style.transition = 'opacity .4s';
    el.style.opacity = '0';
    setTimeout(function () { el.remove(); }, 400);
  }, 5000);
  el.addEventListener('click', function () { el.remove(); });
});

// ── Scroll-based nav highlight ──
(function () {
  var links = document.querySelectorAll('.nav-links a');
  var path  = window.location.pathname;
  links.forEach(function (a) {
    if (a.getAttribute('href') === path) a.classList.add('active');
  });
})();
