/* Survivor's Frontier — interactivity: snowfall, NPC dialogue, reveals, projects */
(function () {
  'use strict';

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ================= Snowfall (hardware-accelerated canvas) ================= */
  var canvas = document.getElementById('snow-canvas');
  if (canvas && !reducedMotion) {
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var flakes = [];
    var W = 0, H = 0;

    function resize() {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function makeFlake(randomY) {
      var depth = Math.random(); // 0 = far, 1 = near
      return {
        x: Math.random() * W,
        y: randomY ? Math.random() * H : -8,
        r: 1 + depth * 2.6,
        speed: 0.25 + depth * 0.75,     // slow, ambient drift
        drift: (Math.random() - 0.5) * 0.4,
        phase: Math.random() * Math.PI * 2,
        alpha: 0.15 + depth * 0.35      // semi-transparent
      };
    }

    function initFlakes() {
      var count = Math.min(140, Math.floor(W * H / 14000));
      flakes = [];
      for (var i = 0; i < count; i++) flakes.push(makeFlake(true));
    }

    var t = 0;
    function tick() {
      t += 0.01;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#ffffff';
      for (var i = 0; i < flakes.length; i++) {
        var f = flakes[i];
        f.y += f.speed;
        f.x += f.drift + Math.sin(t + f.phase) * 0.3;
        if (f.y > H + 8) { flakes[i] = makeFlake(false); f = flakes[i]; }
        if (f.x > W + 8) f.x = -8;
        if (f.x < -8) f.x = W + 8;
        ctx.globalAlpha = f.alpha;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      requestAnimationFrame(tick);
    }

    resize();
    initFlakes();
    window.addEventListener('resize', function () { resize(); initFlakes(); });
    requestAnimationFrame(tick);
  }

  /* ================= NPC dialogue system ================= */
  var lines = [
    "Welcome to the frontier, traveler! ❄️ I'm your guide. This village belongs to Tribhuwan Singh — a Software Developer with 4 years of experience surviving enterprise-scale winters.",
    "His main campaign? Four years at IBM, Seattle — taming high-throughput APIs that handle 100K+ daily records at 99.9% reliability. The 📜 Main Quests hub holds the full log.",
    "He forged asynchronous AWS Lambda ETL pipelines moving 1M+ records a day, slashed API latency 40% with Redis, and cut security vulnerabilities by 90%. Legendary loot.",
    "Right now he's leveling up a Cybersecurity specialization at Westcliff University — and building Last-Sanctuary, his own survival game. Check the 🎒 Inventory and 🗺️ Expeditions hubs!",
    "Your mission: explore the village. Click any quest hub below to begin. Good luck out there, survivor. 🔥"
  ];

  var idx = 0;
  var typing = null;
  var textEl = document.getElementById('npc-text');
  var nextBtn = document.getElementById('npc-next');
  var progEl = document.getElementById('npc-progress');

  function showLine(i, instant) {
    if (typing) { clearInterval(typing); typing = null; }
    var line = lines[i];
    progEl.textContent = (i + 1) + ' / ' + lines.length;
    nextBtn.textContent = i === lines.length - 1 ? 'Restart ↺' : 'Continue ▸';
    textEl.classList.remove('done');
    if (instant || reducedMotion) {
      textEl.textContent = line;
      textEl.classList.add('done');
      return;
    }
    textEl.textContent = '';
    var pos = 0;
    typing = setInterval(function () {
      pos += 2; // two chars per tick keeps it snappy
      textEl.textContent = line.slice(0, pos);
      if (pos >= line.length) {
        clearInterval(typing);
        typing = null;
        textEl.classList.add('done');
      }
    }, 18);
  }

  if (textEl && nextBtn) {
    nextBtn.addEventListener('click', function () {
      if (typing) { showLine(idx, true); return; } // skip animation
      idx = (idx + 1) % lines.length;
      showLine(idx);
    });
    showLine(0);
  }

  /* ================= Mobile HUD toggle ================= */
  var toggle = document.getElementById('hud-toggle');
  var nav = document.getElementById('hud-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        nav.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ================= Scroll reveal + XP bars ================= */
  var revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('visible'); });
  }

  /* ================= Expedition Archives (GitHub projects) ================= */
  var ICONS = { Python: '🐍', 'C#': '🎮', Java: '☕', JavaScript: '📜', TypeScript: '🔷', HTML: '🌐', 'Jupyter Notebook': '📓', R: '📈', PowerShell: '⚙️', default: '🧭' };

  // Static fallback (used if the GitHub API is rate-limited or offline)
  var FALLBACK = [
    { name: 'Last-Sanctuary', description: 'Current expedition: a mobile survival game in active development — the inspiration for this portfolio’s theme.', html_url: 'https://github.com/tsmanral', language: 'C#', stargazers_count: 0 },
    { name: 'ai-security-log-agent', description: 'AI-powered agent for security log analysis and threat detection.', html_url: 'https://github.com/tsmanral/ai-security-log-agent', language: 'Python', stargazers_count: 1 },
    { name: 'Sensing-target-Obstacle-detection-and-Obstacle-Avoidance-in-a-3D-shoot-and-target-game', description: 'Reinforcement-learning agent (TensorFlow + Unity ML-Agents) that detects and avoids obstacles in a 3D shoot-and-target game.', html_url: 'https://github.com/tsmanral/Sensing-target-Obstacle-detection-and-Obstacle-Avoidance-in-a-3D-shoot-and-target-game', language: 'C#', stargazers_count: 9 },
    { name: 'Author-Prediction-Using-Deep-Learning-Models', description: 'Six deep-learning models compared for author-prediction accuracy.', html_url: 'https://github.com/tsmanral/Author-Prediction-Using-Deep-Learning-Models', language: 'Jupyter Notebook', stargazers_count: 2 },
    { name: 'CO2-Emission-Pattern-Recognition', description: 'Interactive analysis and graphical visualization of CO2 emission patterns.', html_url: 'https://github.com/tsmanral/CO2-Emission-Pattern-Recognition', language: 'R', stargazers_count: 0 },
    { name: 'Predicting-Restaurants-Popularity-Based-On-Yelp-Dataset', description: 'Predicting restaurant popularity with the Yelp open dataset.', html_url: 'https://github.com/tsmanral/Predicting-Restaurants-Popularity-Based-On-Yelp-Dataset', language: 'Jupyter Notebook', stargazers_count: 1 }
  ];

  function prettyName(name) {
    var n = name.replace(/[-_]+/g, ' ');
    if (n.length > 60) n = n.slice(0, 57) + '…';
    return n;
  }

  function renderProjects(repos) {
    var grid = document.getElementById('proj-grid');
    if (!grid) return;
    grid.innerHTML = '';
    repos.forEach(function (r) {
      var a = document.createElement('a');
      a.className = 'proj reveal';
      a.href = r.html_url;
      a.target = '_blank';
      a.rel = 'noopener';

      var banner = document.createElement('div');
      banner.className = 'proj__banner';
      banner.textContent = ICONS[r.language] || ICONS.default;

      var body = document.createElement('div');
      body.className = 'proj__body';

      var name = document.createElement('span');
      name.className = 'proj__name';
      name.textContent = prettyName(r.name);

      var desc = document.createElement('span');
      desc.className = 'proj__desc';
      desc.textContent = r.description || 'A field expedition — open the repository for the full report.';

      var meta = document.createElement('span');
      meta.className = 'proj__meta';
      if (r.language) {
        var lang = document.createElement('span');
        lang.className = 'chip chip--blue';
        lang.textContent = r.language;
        meta.appendChild(lang);
      }
      if (r.stargazers_count > 0) {
        var stars = document.createElement('span');
        stars.className = 'chip chip--amber';
        stars.textContent = '⭐ ' + r.stargazers_count;
        meta.appendChild(stars);
      }
      var open = document.createElement('span');
      open.className = 'chip chip--green';
      open.textContent = 'Open repo →';
      meta.appendChild(open);

      body.appendChild(name);
      body.appendChild(desc);
      body.appendChild(meta);
      a.appendChild(banner);
      a.appendChild(body);
      grid.appendChild(a);
      // Cards are injected after the initial observer pass — just show them.
      a.classList.add('visible');
    });
  }

  function loadProjects() {
    if (!window.fetch) { renderProjects(FALLBACK); return; }
    fetch('https://api.github.com/users/tsmanral/repos?per_page=100&sort=updated')
      .then(function (res) {
        if (!res.ok) throw new Error('GitHub API ' + res.status);
        return res.json();
      })
      .then(function (repos) {
        var filtered = repos
          .filter(function (r) { return !r.fork && r.name !== 'tsmanral' && r.name !== 'tsmanral.github.io'; })
          .sort(function (a, b) {
            return (b.stargazers_count - a.stargazers_count) || (new Date(b.pushed_at) - new Date(a.pushed_at));
          })
          .slice(0, 12);
        renderProjects(filtered.length ? filtered : FALLBACK);
      })
      .catch(function () { renderProjects(FALLBACK); });
  }

  loadProjects();

  /* ================= Footer year ================= */
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
})();
