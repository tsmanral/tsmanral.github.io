/* Survivor's Frontier — playable village (vanilla HTML5 Canvas, no libraries)
   Walk with WASD / arrows / click-to-move. Approach an NPC and press E
   (or tap the NPC) to open the matching portfolio section. */
(function () {
  'use strict';

  var canvas = document.getElementById('game-canvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- World / assets ---------- */
  var map = new Image();
  map.src = 'img/village-map.png';
  var explorer = new Image();
  explorer.src = 'img/arctic-explorer.png';

  var world = { w: 1376, h: 768 };     // updated from image once loaded
  var ZOOM = 1.25;                     // camera zoom relative to "cover" scale

  /* ---------- Entities (positions as fractions of map size) ---------- */
  var NPCS = [
    { id: 'guide',    fx: 0.40, fy: 0.62, emoji: '🧭', name: 'Arctic Explorer', tag: 'GUIDE',        action: 'dialogue' },
    { id: 'elder',    fx: 0.475, fy: 0.50, emoji: '🧓', name: 'Village Elder',   tag: 'MAIN QUESTS',  action: 'modal', section: 'quests',      blurb: 'Sit by the fire, traveler. Let me tell you of Tribhuwan’s campaigns at IBM…' },
    { id: 'board',    fx: 0.295, fy: 0.47, emoji: '📌', name: 'Job Board',       tag: 'EXPEDITIONS',  action: 'modal', section: 'expeditions', blurb: 'Field reports pinned by fellow survivors — pulled live from GitHub.' },
    { id: 'camp',     fx: 0.30, fy: 0.20, emoji: '🎓', name: 'Training Camp',   tag: 'EDUCATION',    action: 'modal', section: 'training',    blurb: 'Two master’s degrees earned in these halls — data analytics and cybersecurity.' },
    { id: 'shop',     fx: 0.755, fy: 0.33, emoji: '🎒', name: 'Supply Shop',     tag: 'INVENTORY',    action: 'modal', section: 'inventory',   blurb: 'Browse the equipment collected over four years on the frontier.' },
    { id: 'signal',   fx: 0.76, fy: 0.62, emoji: '📡', name: 'Signal Tower',    tag: 'CONTACT',      action: 'modal', section: 'signal',      blurb: 'Light the signal fire — email, LinkedIn, GitHub, or grab the resume scroll.' },
    { id: 'scroll',   fx: 0.55, fy: 0.75, emoji: '📄', name: 'Resume Scroll',   tag: 'DOWNLOAD',     action: 'resume' }
  ];

  var GUIDE_LINES = [
    "Welcome to the frontier, traveler! ❄️ You can walk around this village — WASD, arrow keys, or just click where you want to go.",
    "This outpost belongs to Tribhuwan Singh — a Software Developer with 4 years of experience surviving enterprise-scale winters at IBM.",
    "Visit the 🧓 Village Elder by the bonfire for his work history, the 📌 Job Board for GitHub expeditions, and the 🎓 Training Camp for his degrees.",
    "The 🎒 Supply Shop holds his skill inventory, and the 📡 Signal Tower is how you reach him. The 📄 Resume Scroll? Take a copy, it's free.",
    "Off you go, survivor. The bonfire keeps the path warm. 🔥"
  ];

  var player = {
    x: 0, y: 0, r: 20,
    speed: 170,
    target: null,       // click-to-move destination {x, y, npc?}
    keys: {},
    moving: false,
    step: 0
  };

  var cam = { x: 0, y: 0, scale: 1 };
  var nearNpc = null;
  var promptEl = document.getElementById('game-prompt');
  var hintEl = document.getElementById('game-hint');
  var hero = document.getElementById('basecamp');
  var hintDismissed = false;

  /* ---------- Sizing ---------- */
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var vw = 0, vh = 0;

  function resize() {
    var rect = hero.getBoundingClientRect();
    vw = rect.width;
    vh = rect.height;
    canvas.width = vw * dpr;
    canvas.height = vh * dpr;
    canvas.style.width = vw + 'px';
    canvas.style.height = vh + 'px';
    cam.scale = Math.max(vw / world.w, vh / world.h) * ZOOM;
  }

  map.onload = function () {
    world.w = map.naturalWidth;
    world.h = map.naturalHeight;
    player.x = world.w * 0.44;
    player.y = world.h * 0.66;
    resize();
  };

  window.addEventListener('resize', resize);
  resize();

  /* ---------- Input: keyboard ---------- */
  var KEYMAP = {
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right'
  };

  function heroInView() {
    var r = hero.getBoundingClientRect();
    return r.bottom > 120 && r.top < window.innerHeight - 120;
  }

  document.addEventListener('keydown', function (e) {
    if (modalOpen() || dialogueOpen()) {
      if (e.code === 'Escape') { closeModal(); closeDialogue(); }
      return;
    }
    if (!heroInView()) return;
    var dir = KEYMAP[e.code];
    if (dir) {
      player.keys[dir] = true;
      player.target = null;
      dismissHint();
      e.preventDefault();
    }
    if ((e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Space') && nearNpc) {
      interact(nearNpc);
      e.preventDefault();
    }
  });

  document.addEventListener('keyup', function (e) {
    var dir = KEYMAP[e.code];
    if (dir) player.keys[dir] = false;
  });

  /* ---------- Input: click / tap to move ---------- */
  canvas.addEventListener('pointerdown', function (e) {
    if (modalOpen() || dialogueOpen()) return;
    dismissHint();
    var rect = canvas.getBoundingClientRect();
    var wx = (e.clientX - rect.left) / cam.scale + cam.x;
    var wy = (e.clientY - rect.top) / cam.scale + cam.y;

    // Tapped an NPC? Walk to it, then auto-interact.
    var hit = null;
    for (var i = 0; i < NPCS.length; i++) {
      var n = NPCS[i];
      if (Math.hypot(wx - n.x, wy - n.y) < 46) { hit = n; break; }
    }
    if (hit) {
      if (Math.hypot(player.x - hit.x, player.y - hit.y) < 80) { interact(hit); return; }
      player.target = { x: hit.x, y: hit.y + 40, npc: hit };
    } else {
      player.target = { x: wx, y: wy };
    }
  });

  function dismissHint() {
    if (!hintDismissed && hintEl) {
      hintDismissed = true;
      hintEl.style.opacity = '0';
      setTimeout(function () { hintEl.hidden = true; }, 600);
    }
  }

  /* ---------- Dialogue system (guide + NPC blurbs) ---------- */
  var dlgEl = document.getElementById('game-dialogue');
  var textEl = document.getElementById('npc-text');
  var nextBtn = document.getElementById('npc-next');
  var closeBtn = document.getElementById('dialogue-close');
  var nameEl = document.getElementById('dialogue-name');
  var tagEl = document.getElementById('dialogue-tag');
  var progEl = document.getElementById('npc-progress');

  var dlg = { lines: [], idx: 0, typing: null, after: null };

  function dialogueOpen() { return dlgEl && !dlgEl.hidden; }

  function openDialogue(name, tag, lines, after) {
    dlg.lines = lines;
    dlg.idx = 0;
    dlg.after = after || null;
    nameEl.textContent = name;
    tagEl.textContent = tag;
    dlgEl.hidden = false;
    showLine(0);
  }

  function closeDialogue() {
    if (!dialogueOpen()) return;
    if (dlg.typing) { clearInterval(dlg.typing); dlg.typing = null; }
    dlgEl.hidden = true;
  }

  function showLine(i, instant) {
    if (dlg.typing) { clearInterval(dlg.typing); dlg.typing = null; }
    var line = dlg.lines[i];
    progEl.textContent = dlg.lines.length > 1 ? (i + 1) + ' / ' + dlg.lines.length : '';
    var last = i === dlg.lines.length - 1;
    nextBtn.textContent = last ? (dlg.after ? 'Open ▸' : 'Done ✓') : 'Continue ▸';
    textEl.classList.remove('done');
    if (instant || reducedMotion) {
      textEl.textContent = line;
      textEl.classList.add('done');
      return;
    }
    textEl.textContent = '';
    var pos = 0;
    dlg.typing = setInterval(function () {
      pos += 2;
      textEl.textContent = line.slice(0, pos);
      if (pos >= line.length) {
        clearInterval(dlg.typing);
        dlg.typing = null;
        textEl.classList.add('done');
      }
    }, 18);
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', function () {
      if (dlg.typing) { showLine(dlg.idx, true); return; }
      if (dlg.idx >= dlg.lines.length - 1) {
        var after = dlg.after;
        closeDialogue();
        if (after) after();
        return;
      }
      dlg.idx++;
      showLine(dlg.idx);
    });
  }
  if (closeBtn) closeBtn.addEventListener('click', closeDialogue);

  /* ---------- Modal (clones portfolio sections) ---------- */
  var modalEl = document.getElementById('modal');
  var modalContent = document.getElementById('modal-content');
  var modalClose = document.getElementById('modal-close');

  function modalOpen() { return modalEl && !modalEl.hidden; }

  function openModal(sectionId) {
    var src = document.getElementById(sectionId);
    if (!src) return;
    modalContent.innerHTML = '';
    var clone = src.querySelector('.zone__inner').cloneNode(true);
    clone.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('visible'); });
    modalContent.appendChild(clone);
    modalEl.hidden = false;
    document.body.style.overflow = 'hidden';
    modalClose.focus();
  }

  function closeModal() {
    if (!modalOpen()) return;
    modalEl.hidden = true;
    document.body.style.overflow = '';
    canvas.focus({ preventScroll: true });
  }

  if (modalClose) modalClose.addEventListener('click', closeModal);
  if (modalEl) modalEl.addEventListener('click', function (e) { if (e.target === modalEl) closeModal(); });

  /* ---------- Interactions ---------- */
  function interact(npc) {
    player.target = null;
    if (npc.action === 'dialogue') {
      openDialogue(npc.name, npc.tag, GUIDE_LINES);
    } else if (npc.action === 'resume') {
      openDialogue(npc.name, npc.tag, ['A weathered scroll detailing every campaign. Take a copy with you, survivor. 📄'], function () {
        var a = document.createElement('a');
        a.href = 'assets/Tribhuwan_Singh_Resume.pdf';
        a.download = 'Tribhuwan_Singh_Resume.pdf';
        document.body.appendChild(a);
        a.click();
        a.remove();
      });
    } else if (npc.action === 'modal') {
      openDialogue(npc.name, npc.tag, [npc.blurb], function () { openModal(npc.section); });
    }
  }

  /* ---------- Game loop ---------- */
  var last = performance.now();

  function update(dt) {
    // NPC world positions (map may have loaded after init)
    for (var i = 0; i < NPCS.length; i++) {
      NPCS[i].x = NPCS[i].fx * world.w;
      NPCS[i].y = NPCS[i].fy * world.h;
    }

    var vx = 0, vy = 0;
    if (player.keys.up) vy -= 1;
    if (player.keys.down) vy += 1;
    if (player.keys.left) vx -= 1;
    if (player.keys.right) vx += 1;

    if (vx || vy) {
      var len = Math.hypot(vx, vy);
      player.x += (vx / len) * player.speed * dt;
      player.y += (vy / len) * player.speed * dt;
      player.moving = true;
    } else if (player.target) {
      var dx = player.target.x - player.x;
      var dy = player.target.y - player.y;
      var dist = Math.hypot(dx, dy);
      if (dist < 6) {
        var npc = player.target.npc;
        player.target = null;
        player.moving = false;
        if (npc) interact(npc);
      } else {
        player.x += (dx / dist) * player.speed * dt;
        player.y += (dy / dist) * player.speed * dt;
        player.moving = true;
      }
    } else {
      player.moving = false;
    }

    if (player.moving) player.step += dt * 10;

    // Clamp inside world
    var m = 40;
    player.x = Math.min(world.w - m, Math.max(m, player.x));
    player.y = Math.min(world.h - m, Math.max(m, player.y));

    // Camera follows player, clamped to world
    var viewW = vw / cam.scale;
    var viewH = vh / cam.scale;
    cam.x = Math.min(Math.max(player.x - viewW / 2, 0), Math.max(world.w - viewW, 0));
    cam.y = Math.min(Math.max(player.y - viewH / 2, 0), Math.max(world.h - viewH, 0));

    // Nearest interactable
    nearNpc = null;
    var best = 90;
    for (var j = 0; j < NPCS.length; j++) {
      var d = Math.hypot(player.x - NPCS[j].x, player.y - NPCS[j].y);
      if (d < best) { best = d; nearNpc = NPCS[j]; }
    }
    if (promptEl) {
      if (nearNpc && !dialogueOpen() && !modalOpen()) {
        promptEl.hidden = false;
        promptEl.innerHTML = '';
        var b = document.createElement('b');
        b.textContent = nearNpc.emoji + ' ' + nearNpc.name;
        promptEl.appendChild(b);
        promptEl.appendChild(document.createTextNode(' — press E or tap to interact'));
      } else {
        promptEl.hidden = true;
      }
    }
  }

  function draw(t) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, vw, vh);
    ctx.save();
    ctx.scale(cam.scale, cam.scale);
    ctx.translate(-cam.x, -cam.y);

    // World
    if (map.complete && map.naturalWidth) {
      ctx.drawImage(map, 0, 0, world.w, world.h);
    } else {
      ctx.fillStyle = '#0a1470';
      ctx.fillRect(cam.x, cam.y, vw / cam.scale, vh / cam.scale);
    }

    // Night-time tint so UI colors pop
    ctx.fillStyle = 'rgba(0, 4, 80, 0.30)';
    ctx.fillRect(cam.x - 4, cam.y - 4, vw / cam.scale + 8, vh / cam.scale + 8);

    var pulse = reducedMotion ? 1 : (1 + Math.sin(t / 400) * 0.08);

    // NPC markers
    for (var i = 0; i < NPCS.length; i++) {
      var n = NPCS[i];
      var isNear = nearNpc === n;

      // Ground ring
      ctx.beginPath();
      ctx.ellipse(n.x, n.y + 18, 22 * (isNear ? pulse : 1), 9 * (isNear ? pulse : 1), 0, 0, Math.PI * 2);
      ctx.fillStyle = isNear ? 'rgba(254, 179, 0, 0.45)' : 'rgba(0, 229, 255, 0.28)';
      ctx.fill();

      // Emoji
      ctx.font = '30px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(n.emoji, n.x, n.y - (isNear && !reducedMotion ? 4 + Math.sin(t / 250) * 3 : 0));

      // Name plate
      ctx.font = '700 11px Quicksand, sans-serif';
      var label = n.name;
      var tw = ctx.measureText(label).width + 14;
      ctx.fillStyle = isNear ? 'rgba(254, 179, 0, 0.92)' : 'rgba(0, 3, 65, 0.75)';
      roundRect(ctx, n.x - tw / 2, n.y - 46, tw, 17, 8);
      ctx.fill();
      ctx.fillStyle = isNear ? '#432c00' : '#c3f5ff';
      ctx.fillText(label, n.x, n.y - 37);
    }

    // Click target marker
    if (player.target && !player.target.npc) {
      ctx.beginPath();
      ctx.arc(player.target.x, player.target.y, 8 * pulse, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.8)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Player token (circular-cropped explorer portrait)
    var bob = player.moving && !reducedMotion ? Math.abs(Math.sin(player.step)) * 5 : 0;
    var px = player.x, py = player.y - bob;

    ctx.beginPath();
    ctx.ellipse(px, player.y + 20, 16, 7, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(px, py, player.r, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    if (explorer.complete && explorer.naturalWidth) {
      // Crop the character's head/torso region from the source art
      ctx.drawImage(explorer, 300, 140, 440, 440, px - player.r, py - player.r, player.r * 2, player.r * 2);
    } else {
      ctx.fillStyle = '#feb300';
      ctx.fillRect(px - player.r, py - player.r, player.r * 2, player.r * 2);
    }
    ctx.restore();

    ctx.beginPath();
    ctx.arc(px, py, player.r, 0, Math.PI * 2);
    ctx.strokeStyle = '#feb300';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.restore();
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function loop(now) {
    var dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    update(dt);
    draw(now);
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
})();
