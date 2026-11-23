/* ═══════════════════════════════════════════
   MAREK ŠEVELA — MAIN SCRIPT
   ═══════════════════════════════════════════ */

/* ── Navbar scroll effect ── */
const navbar = document.getElementById('navbar');

window.addEventListener('scroll', () => {
  if (window.scrollY > 30) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }
}, { passive: true });


/* ── Mobile menu ── */
const menuBtn    = document.getElementById('menuBtn');
const mobileMenu = document.getElementById('mobileMenu');

menuBtn.addEventListener('click', () => {
  menuBtn.classList.toggle('open');
  mobileMenu.classList.toggle('open');
});

function closeMobileMenu() {
  menuBtn.classList.remove('open');
  mobileMenu.classList.remove('open');
}

// Close on outside click
document.addEventListener('click', (e) => {
  if (!menuBtn.contains(e.target) && !mobileMenu.contains(e.target)) {
    closeMobileMenu();
  }
});


/* ── Scroll reveal ── */
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const delay = entry.target.style.animationDelay
          ? parseFloat(entry.target.style.animationDelay) * 1000
          : 0;
        setTimeout(() => {
          entry.target.classList.add('visible');
        }, delay);
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
);

document.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));


/* ── Active nav link on scroll ── */
const sections  = document.querySelectorAll('section[id]');
const navLinks  = document.querySelectorAll('.nav-link');

const sectionObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        navLinks.forEach((link) => {
          link.style.color = '';
          if (link.getAttribute('href') === `#${entry.target.id}`) {
            link.style.color = '#a78bfa';
          }
        });
      }
    });
  },
  { threshold: 0.4 }
);

sections.forEach((s) => sectionObserver.observe(s));


/* ── Smooth scroll (fallback for older browsers) ── */
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener('click', function (e) {
    // když běží plynulé scrollování z motion.js, posouvání řeší ono
    if (window.__lenisActive) return;
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});


/* ── Contact form ── */
const form          = document.getElementById('contactForm');
const submitBtn     = document.getElementById('submitBtn');
const submitText    = document.getElementById('submitText');
const submitLoading = document.getElementById('submitLoading');
const formSuccess   = document.getElementById('formSuccess');
const formError     = document.getElementById('formError');

if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // souhlas se zpracováním údajů musí být zaškrtnutý
    const souhlas = document.getElementById('souhlas');
    if (souhlas && !souhlas.checked) {
      souhlas.focus();
      return;
    }

    submitText.classList.add('hidden');
    submitLoading.classList.remove('hidden');
    submitBtn.disabled = true;

    const data = new FormData(form);
    data.set('odeslano', new Date().toLocaleString('cs-CZ'));
    data.set('_subject', 'Nová poptávka z webu mareksevela.com');
    // technická pole, která do e-mailu nepatří
    data.delete('form-name');
    data.delete('bot-field');

    try {
      // Poptávka jde na Formspree — službu, která formuláře přijímá a ukládá.
      // Funguje odkudkoliv (GitHub Pages, Netlify, vlastní hosting), protože
      // nezávisí na tom, kde web bydlí.
      const response = await fetch('https://formspree.io/f/xvzwlbak', {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: data,
      });

      if (!response.ok) throw new Error('Server error');

      form.reset();
      formSuccess.classList.remove('hidden');
      formError.classList.add('hidden');
      setTimeout(() => formSuccess.classList.add('hidden'), 6000);
    } catch {
      formError.classList.remove('hidden');
      formSuccess.classList.add('hidden');
      setTimeout(() => formError.classList.add('hidden'), 8000);
    } finally {
      submitText.classList.remove('hidden');
      submitLoading.classList.add('hidden');
      submitBtn.disabled = false;
    }
  });
}


/* ── Kurzor ──
   Zář kolem kurzoru i vlastní ukazatel řeší motion.js.
   Kdyby se motion.js nenačetl, zůstane obyčejný kurzor prohlížeče. */
