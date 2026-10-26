/* NoY Garden Studio — client-side doodle + silhouette stamps. No network, no checkout. */
(function () {
  const canvas = document.getElementById("garden-canvas");
  const board = document.getElementById("board");
  if (!canvas || !board) return;

  const I18N = window.NoYI18n;
  const paper = document.createElement("canvas");
  const ink = document.createElement("canvas");
  const scratch = document.createElement("canvas");

  const COLORS = {
    ink: "#2c322c",
    garden: "#4d5e4a",
    sage: "#6f8264",
    lilac: "#9a7fa6",
    blush: "#c48984",
    dusk: "#6d5a78"
  };
  const STAMP_TINT = {
    tee: "#6f8264",
    knit: "#4d5e4a",
    sprig: "#9a7fa6",
    leaf: "#5e754c",
    petal: "#d09a96",
    lily: "#8d709c"
  };
  const STAMPS = ["tee", "knit", "sprig", "leaf", "petal", "lily"];

  let ctx = canvas.getContext("2d");
  let paperCtx = paper.getContext("2d");
  let inkCtx = ink.getContext("2d");
  let cssW = 0;
  let cssH = 0;
  let dpr = 1;
  let tool = "draw";
  let color = COLORS.garden;
  let brush = 8;
  let nextSize = 0.2;
  let uid = 1;
  let strokes = [];
  let stamps = [];
  let actions = [];
  let activeStroke = null;
  let dragging = null;
  let dragOrigin = null;
  let selectedId = null;
  let pointerDown = false;
  let currentLang = "en";
  let showChrome = true;

  function t(key) {
    return I18N ? I18N.t(currentLang, key) : key;
  }

  function rgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
  }

  function mixWhite(hex, amount) {
    const n = parseInt(hex.slice(1), 16);
    const mix = function (c) { return Math.round(c + (255 - c) * amount); };
    return "rgb(" + mix((n >> 16) & 255) + "," + mix((n >> 8) & 255) + "," + mix(n & 255) + ")";
  }

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t0 = Math.imul(a ^ (a >>> 15), 1 | a);
      t0 = (t0 + Math.imul(t0 ^ (t0 >>> 7), 61 | t0)) ^ t0;
      return ((t0 ^ (t0 >>> 14)) >>> 0) / 4294967296;
    };
  }

  function announce(key) {
    const live = document.getElementById("live");
    if (!live) return;
    live.textContent = "";
    window.requestAnimationFrame(function () { live.textContent = t(key); });
  }

  function selected() {
    return stamps.find(function (s) { return s.id === selectedId; }) || null;
  }

  function stampBox(s) {
    const size = s.size * Math.min(cssW, cssH);
    return { x: s.x * cssW, y: s.y * cssH, s: size };
  }

  function hitStamp(nx, ny) {
    const px = nx * cssW;
    const py = ny * cssH;
    for (let i = stamps.length - 1; i >= 0; i--) {
      const b = stampBox(stamps[i]);
      if (Math.abs(px - b.x) <= b.s / 2 + 8 && Math.abs(py - b.y) <= b.s / 2 + 8) return stamps[i];
    }
    return null;
  }

  function bringToFront(stamp) {
    const i = stamps.indexOf(stamp);
    if (i >= 0 && i < stamps.length - 1) {
      stamps.splice(i, 1);
      stamps.push(stamp);
    }
  }

  function remember(action) {
    actions.push(action);
    if (actions.length > 40) actions.shift();
  }

  function pointFromEvent(e) {
    const r = canvas.getBoundingClientRect();
    const w = r.width || 1;
    const h = r.height || 1;
    return {
      x: clamp((e.clientX - r.left) / w, 0, 1),
      y: clamp((e.clientY - r.top) / h, 0, 1)
    };
  }

  function paintPaper() {
    paperCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paperCtx.clearRect(0, 0, cssW, cssH);
    paperCtx.fillStyle = "#f6efe6";
    paperCtx.fillRect(0, 0, cssW, cssH);

    function wash(x, y, r, inner) {
      const g = paperCtx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, inner);
      g.addColorStop(1, "rgba(246,239,230,0)");
      paperCtx.fillStyle = g;
      paperCtx.fillRect(0, 0, cssW, cssH);
    }
    wash(cssW * 0.14, cssH * 0.18, Math.max(cssW, cssH) * 0.48, "rgba(233,223,239,0.62)");
    wash(cssW * 0.86, cssH * 0.78, Math.max(cssW, cssH) * 0.42, "rgba(159,175,144,0.28)");
    wash(cssW * 0.72, cssH * 0.12, Math.max(cssW, cssH) * 0.3, "rgba(242,221,217,0.5)");
    wash(cssW * 0.28, cssH * 0.88, Math.max(cssW, cssH) * 0.28, "rgba(196,176,208,0.2)");

    const rand = mulberry32((0x4e6f59 + Math.round(cssW) * 17 + Math.round(cssH) * 13) >>> 0);
    paperCtx.save();
    const fibers = Math.round(cssW * cssH / 14000);
    for (let i = 0; i < fibers; i++) {
      const x = rand() * cssW;
      const y = rand() * cssH;
      paperCtx.strokeStyle = rand() > 0.5 ? "rgba(122,129,118,0.055)" : "rgba(255,250,244,0.35)";
      paperCtx.lineWidth = 1;
      paperCtx.beginPath();
      paperCtx.moveTo(x, y);
      paperCtx.lineTo(x + rand() * 36 - 8, y + rand() * 5 - 2);
      paperCtx.stroke();
    }
    const specks = Math.round(cssW * cssH / 2200);
    for (let j = 0; j < specks; j++) {
      paperCtx.fillStyle = rand() > 0.72 ? "rgba(44,50,44,0.035)" : "rgba(255,250,244,0.4)";
      paperCtx.fillRect(rand() * cssW, rand() * cssH, 1.1, 1.1);
    }
    paperCtx.restore();

    paperCtx.strokeStyle = "rgba(77,94,74,0.14)";
    paperCtx.lineWidth = 1;
    paperCtx.strokeRect(14.5, 14.5, Math.max(0, cssW - 29), Math.max(0, cssH - 29));

    paperCtx.save();
    paperCtx.fillStyle = "rgba(77,94,74,0.3)";
    paperCtx.font = 'italic 500 18px "Cormorant Garamond", Georgia, serif';
    const mark = "NoY";
    const gap = 3.5;
    let width = 0;
    for (const ch of mark) width += paperCtx.measureText(ch).width + gap;
    let x = cssW - 26 - width;
    const y = cssH - 22;
    for (const ch of mark) {
      paperCtx.fillText(ch, x, y);
      x += paperCtx.measureText(ch).width + gap;
    }
    paperCtx.restore();
  }

  function paintStroke(target, s) {
    if (!s.points.length) return;
    const pts = s.points.map(function (p) { return { x: p.x * cssW, y: p.y * cssH }; });
    target.save();
    target.lineCap = "round";
    target.lineJoin = "round";
    target.lineWidth = s.size;
    if (s.erase) {
      target.globalCompositeOperation = "destination-out";
      target.strokeStyle = "#000";
      target.fillStyle = "#000";
    } else {
      target.globalCompositeOperation = "source-over";
      target.strokeStyle = s.color;
      target.fillStyle = s.color;
    }
    if (pts.length === 1) {
      target.beginPath();
      target.arc(pts[0].x, pts[0].y, s.size / 2, 0, Math.PI * 2);
      target.fill();
    } else if (pts.length === 2) {
      target.beginPath();
      target.moveTo(pts[0].x, pts[0].y);
      target.lineTo(pts[1].x, pts[1].y);
      target.stroke();
    } else {
      target.beginPath();
      target.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i].x + pts[i + 1].x) / 2;
        const my = (pts[i].y + pts[i + 1].y) / 2;
        target.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
      }
      const last = pts[pts.length - 1];
      target.lineTo(last.x, last.y);
      target.stroke();
    }
    target.restore();
  }

  function redrawInk() {
    inkCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    inkCtx.clearRect(0, 0, cssW, cssH);
    strokes.forEach(function (s) { paintStroke(inkCtx, s); });
    if (activeStroke) paintStroke(inkCtx, activeStroke);
  }

  function punch(ctx, draw) {
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "#000";
    draw(ctx);
    ctx.restore();
  }

  function paintStampShape(octx, type, size, fillColor) {
    octx.save();
    octx.translate(size / 2, size / 2);
    octx.scale(size / 100, size / 100);
    octx.lineCap = "round";
    octx.lineJoin = "round";
    octx.lineWidth = 150 / size;
    const fill = rgba(fillColor, 0.9);
    const stroke = fillColor;

    octx.save();
    octx.translate(0, 10);
    octx.fillStyle = "rgba(44,50,44,0.07)";
    octx.beginPath();
    octx.ellipse(0, 30, 24, 6, 0, 0, Math.PI * 2);
    octx.fill();
    octx.restore();

    if (type === "tee" || type === "knit") {
      const hem = type === "knit" ? 44 : 36;
      octx.beginPath();
      octx.moveTo(-20, -16);
      octx.bezierCurveTo(-30, -24, -50, -12, -44, 2);
      octx.bezierCurveTo(-40, 12, -30, 8, -24, 12);
      octx.lineTo(-16, hem - 6);
      octx.quadraticCurveTo(0, hem + 8, 16, hem - 6);
      octx.lineTo(24, 12);
      octx.bezierCurveTo(30, 8, 40, 12, 44, 2);
      octx.bezierCurveTo(50, -12, 30, -24, 20, -16);
      octx.quadraticCurveTo(12, -34, 0, -36);
      octx.quadraticCurveTo(-12, -34, -20, -16);
      octx.closePath();
      octx.fillStyle = fill;
      octx.strokeStyle = stroke;
      octx.fill();
      octx.stroke();
      punch(octx, function (p) {
        p.beginPath();
        p.ellipse(0, -20, type === "knit" ? 7 : 8.5, type === "knit" ? 5 : 6, 0, 0, Math.PI * 2);
        p.fill();
      });
      if (type === "knit") {
        octx.strokeStyle = rgba(fillColor, 0.55);
        octx.lineWidth = 120 / size;
        octx.beginPath();
        octx.moveTo(-14, hem - 16);
        octx.quadraticCurveTo(0, hem - 10, 14, hem - 16);
        octx.moveTo(-15, hem - 8);
        octx.quadraticCurveTo(0, hem - 2, 15, hem - 8);
        octx.stroke();
      }
    } else if (type === "sprig") {
      octx.strokeStyle = stroke;
      octx.lineWidth = 170 / size;
      octx.beginPath();
      octx.moveTo(1, 40);
      octx.bezierCurveTo(-4, 16, 8, -4, -1, -30);
      octx.stroke();
      octx.fillStyle = rgba(fillColor, 0.75);
      octx.beginPath();
      octx.ellipse(-14, 6, 11, 5, -0.9, 0, Math.PI * 2);
      octx.ellipse(12, -4, 9, 4.2, 0.8, 0, Math.PI * 2);
      octx.fill();
      [[-10, -32, 10], [8, -26, 8.5], [-1, -16, 7], [14, -12, 6], [-16, -14, 6.5]].forEach(function (b) {
        octx.beginPath();
        octx.fillStyle = fill;
        octx.arc(b[0], b[1], b[2], 0, Math.PI * 2);
        octx.fill();
        octx.beginPath();
        octx.fillStyle = mixWhite(fillColor, 0.62);
        octx.arc(b[0] - 1, b[1] - 1, b[2] * 0.32, 0, Math.PI * 2);
        octx.fill();
      });
    } else if (type === "leaf") {
      octx.beginPath();
      octx.moveTo(0, 40);
      octx.bezierCurveTo(32, 12, 28, -28, 0, -42);
      octx.bezierCurveTo(-28, -28, -32, 12, 0, 40);
      octx.closePath();
      octx.fillStyle = fill;
      octx.strokeStyle = stroke;
      octx.fill();
      octx.stroke();
      octx.beginPath();
      octx.moveTo(0, 32);
      octx.quadraticCurveTo(3, 0, 0, -32);
      octx.moveTo(0, 8);
      octx.lineTo(-12, -2);
      octx.moveTo(0, -6);
      octx.lineTo(11, -16);
      octx.strokeStyle = rgba("#f6efe6", 0.55);
      octx.lineWidth = 130 / size;
      octx.stroke();
    } else if (type === "petal") {
      octx.rotate(-0.5);
      octx.beginPath();
      octx.moveTo(0, 38);
      octx.bezierCurveTo(30, 16, 26, -24, 2, -40);
      octx.bezierCurveTo(-8, -16, -6, 18, 0, 38);
      octx.closePath();
      octx.fillStyle = fill;
      octx.strokeStyle = stroke;
      octx.fill();
      octx.stroke();
      octx.beginPath();
      octx.moveTo(0, 28);
      octx.quadraticCurveTo(4, 0, 1, -28);
      octx.strokeStyle = rgba("#fffaf4", 0.45);
      octx.stroke();
    } else if (type === "lily") {
      octx.save();
      octx.rotate(-0.25);
      octx.fillStyle = rgba(fillColor, 0.32);
      octx.beginPath();
      octx.ellipse(0, 12, 38, 15, 0, 0, Math.PI * 2);
      octx.fill();
      octx.restore();
      for (let i = 0; i < 8; i++) {
        octx.save();
        octx.rotate((Math.PI * 2 * i) / 8 + 0.2);
        octx.beginPath();
        octx.ellipse(0, -18, 6.5, 15, 0, 0, Math.PI * 2);
        octx.fillStyle = rgba(fillColor, i % 2 ? 0.82 : 0.58);
        octx.fill();
        octx.restore();
      }
      octx.beginPath();
      octx.arc(0, 0, 5.5, 0, Math.PI * 2);
      octx.fillStyle = mixWhite(fillColor, 0.4);
      octx.fill();
    }
    octx.restore();
  }

  function drawStamp(dest, type, cx, cy, size, fillColor) {
    const pixel = Math.max(2, Math.ceil(size * dpr));
    if (scratch.width !== pixel || scratch.height !== pixel) {
      scratch.width = pixel;
      scratch.height = pixel;
    }
    const octx = scratch.getContext("2d");
    octx.setTransform(1, 0, 0, 1, 0, 0);
    octx.clearRect(0, 0, scratch.width, scratch.height);
    octx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintStampShape(octx, type, size, fillColor);
    dest.save();
    dest.imageSmoothingEnabled = true;
    dest.drawImage(scratch, cx - size / 2, cy - size / 2, size, size);
    dest.restore();
  }

  function render(chrome) {
    showChrome = chrome !== false;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.drawImage(paper, 0, 0, cssW, cssH);
    ctx.drawImage(ink, 0, 0, cssW, cssH);
    stamps.forEach(function (s) {
      const b = stampBox(s);
      drawStamp(ctx, s.type, b.x, b.y, b.s, s.color);
    });
    if (showChrome && selectedId) {
      const s = selected();
      if (s) {
        const b = stampBox(s);
        ctx.save();
        ctx.strokeStyle = "rgba(154,127,166,0.95)";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(b.x - b.s / 2 - 6, b.y - b.s / 2 - 6, b.s + 12, b.s + 12);
        ctx.restore();
      }
    }
  }

  function exportURL() {
    const off = document.createElement("canvas");
    off.width = canvas.width;
    off.height = canvas.height;
    const octx = off.getContext("2d");
    octx.setTransform(dpr, 0, 0, dpr, 0, 0);
    octx.drawImage(paper, 0, 0, cssW, cssH);
    octx.drawImage(ink, 0, 0, cssW, cssH);
    stamps.forEach(function (s) {
      const b = stampBox(s);
      drawStamp(octx, s.type, b.x, b.y, b.s, s.color);
    });
    return off.toDataURL("image/png");
  }

  function sync() {
    document.querySelectorAll("[data-tool]").forEach(function (btn) {
      const on = btn.getAttribute("data-tool") === tool;
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
    document.querySelectorAll(".swatch").forEach(function (btn) {
      const on = btn.getAttribute("data-color") === color;
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
    const has = !!selected();
    ["stamp-smaller", "stamp-larger", "stamp-remove"].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.disabled = !has;
    });
    const undoBtn = document.getElementById("undo");
    if (undoBtn) undoBtn.disabled = actions.length === 0;
    const sizeInput = document.getElementById("brush-size");
    const sizeVal = document.getElementById("size-val");
    if (sizeInput) {
      sizeInput.setAttribute("aria-valuetext", sizeInput.value);
      if (sizeVal) sizeVal.textContent = sizeInput.value;
    }
    board.setAttribute("data-mode", STAMPS.indexOf(tool) >= 0 ? "stamp" : tool);
  }

  function syncMail() {
    const link = document.getElementById("mail-link");
    if (!link) return;
    const subject = t("gs.mail.subject");
    const body = t("gs.mail.body");
    link.href = "mailto:zhaojinxiu0525@gmail.com?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
  }

  function fit() {
    const rect = board.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    const next = Math.min(window.devicePixelRatio || 1, 2);
    if (w < 2 || h < 2) return;
    if (Math.abs(w - cssW) < 0.5 && Math.abs(h - cssH) < 0.5 && next === dpr && canvas.width) return;
    cssW = w;
    cssH = h;
    dpr = next;
    const pw = Math.max(1, Math.round(w * dpr));
    const ph = Math.max(1, Math.round(h * dpr));
    canvas.width = pw;
    canvas.height = ph;
    paper.width = pw;
    paper.height = ph;
    ink.width = pw;
    ink.height = ph;
    ctx = canvas.getContext("2d");
    paperCtx = paper.getContext("2d");
    inkCtx = ink.getContext("2d");
    paintPaper();
    redrawInk();
    render(true);
  }

  function addPoint(stroke, x, y) {
    const last = stroke.points[stroke.points.length - 1];
    if (last) {
      const dx = (x - last.x) * cssW;
      const dy = (y - last.y) * cssH;
      if (dx * dx + dy * dy < 0.4) return;
    }
    stroke.points.push({ x: x, y: y });
  }

  function undo() {
    if (pointerDown) return;
    const action = actions.pop();
    if (!action) return;
    if (action.type === "stroke") strokes.pop();
    else if (action.type === "place") stamps = stamps.filter(function (s) { return s.id !== action.id; });
    else if (action.type === "move") {
      const s = stamps.find(function (st) { return st.id === action.id; });
      if (s) { s.x = action.from.x; s.y = action.from.y; }
    } else if (action.type === "scale") {
      const s = stamps.find(function (st) { return st.id === action.id; });
      if (s) s.size = action.from;
    } else if (action.type === "remove") {
      stamps.splice(Math.min(action.index, stamps.length), 0, action.stamp);
      selectedId = action.stamp.id;
    } else if (action.type === "clear") {
      strokes = action.strokes;
      stamps = action.stamps;
    }
    if (selectedId && !stamps.some(function (s) { return s.id === selectedId; })) selectedId = null;
    redrawInk();
    render(true);
    sync();
    announce("gs.did.undo");
  }

  function clearAll() {
    if (!strokes.length && !stamps.length) return;
    remember({ type: "clear", strokes: strokes, stamps: stamps });
    strokes = [];
    stamps = [];
    activeStroke = null;
    selectedId = null;
    redrawInk();
    render(true);
    sync();
    announce("gs.did.clear");
  }

  function placeStamp(nx, ny) {
    const stamp = {
      id: uid++,
      type: tool,
      x: clamp(nx, 0.08, 0.92),
      y: clamp(ny, 0.08, 0.92),
      size: nextSize,
      color: color
    };
    stamps.push(stamp);
    selectedId = stamp.id;
    remember({ type: "place", id: stamp.id });
    render(true);
    sync();
    announce("gs.did.place");
    return stamp;
  }

  function scaleSelected(factor) {
    const s = selected();
    if (!s) return;
    const from = s.size;
    const to = clamp(from * factor, 0.08, 0.52);
    if (Math.abs(to - from) < 0.001) return;
    s.size = to;
    nextSize = to;
    remember({ type: "scale", id: s.id, from: from });
    render(true);
    sync();
  }

  function removeSelected() {
    const i = stamps.findIndex(function (s) { return s.id === selectedId; });
    if (i < 0) return;
    const removed = stamps.splice(i, 1)[0];
    remember({ type: "remove", stamp: removed, index: i });
    selectedId = null;
    render(true);
    sync();
    announce("gs.did.remove");
  }

  function download() {
    const url = exportURL();
    const a = document.createElement("a");
    a.href = url;
    a.download = "noy-garden-inspiration.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
    announce("gs.did.download");
  }

  function updateCursor(e) {
    if (dragging) {
      canvas.style.cursor = "grabbing";
      return;
    }
    if (e) {
      const p = pointFromEvent(e);
      if (hitStamp(p.x, p.y)) {
        canvas.style.cursor = "grab";
        return;
      }
    }
    if (tool === "erase") canvas.style.cursor = "cell";
    else if (tool === "draw") canvas.style.cursor = "crosshair";
    else canvas.style.cursor = "copy";
  }

  function paintIcons() {
    document.querySelectorAll("canvas.stamp-icon").forEach(function (icon) {
      const type = icon.parentElement && icon.parentElement.getAttribute("data-tool");
      if (!type || !STAMP_TINT[type]) return;
      const size = 36;
      icon.width = size * 2;
      icon.height = size * 2;
      const ictx = icon.getContext("2d");
      ictx.setTransform(2, 0, 0, 2, 0, 0);
      ictx.clearRect(0, 0, size, size);
      drawStamp(ictx, type, size / 2, size / 2, 30, STAMP_TINT[type]);
    });
  }

  function onPointerDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    if (e.isPrimary === false) return;
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    canvas.focus({ preventScroll: true });
    pointerDown = true;
    const p = pointFromEvent(e);
    const hit = hitStamp(p.x, p.y);
    if (hit) {
      bringToFront(hit);
      selectedId = hit.id;
      dragging = hit;
      dragOrigin = { x: hit.x, y: hit.y };
      render(true);
      sync();
      updateCursor(e);
      return;
    }
    if (STAMPS.indexOf(tool) >= 0) {
      dragging = placeStamp(p.x, p.y);
      dragOrigin = null;
      updateCursor(e);
      return;
    }
    selectedId = null;
    activeStroke = {
      color: color,
      size: brush,
      erase: tool === "erase",
      points: []
    };
    addPoint(activeStroke, p.x, p.y);
    redrawInk();
    render(true);
    sync();
  }

  function onPointerMove(e) {
    if (!pointerDown) {
      updateCursor(e);
      return;
    }
    if (dragging) {
      const p = pointFromEvent(e);
      dragging.x = clamp(p.x, 0.06, 0.94);
      dragging.y = clamp(p.y, 0.06, 0.94);
      render(true);
      updateCursor(e);
      return;
    }
    if (!activeStroke) return;
    const events = typeof e.getCoalescedEvents === "function" ? e.getCoalescedEvents() : [e];
    events.forEach(function (ev) {
      const p = pointFromEvent(ev);
      addPoint(activeStroke, p.x, p.y);
    });
    redrawInk();
    render(true);
  }

  function onPointerUp() {
    if (!pointerDown) return;
    pointerDown = false;
    if (dragging) {
      if (dragOrigin && (Math.abs(dragging.x - dragOrigin.x) > 0.002 || Math.abs(dragging.y - dragOrigin.y) > 0.002)) {
        remember({ type: "move", id: dragging.id, from: dragOrigin });
        sync();
      }
      dragging = null;
      dragOrigin = null;
    }
    if (activeStroke) {
      if (activeStroke.points.length) {
        strokes.push(activeStroke);
        remember({ type: "stroke" });
      }
      activeStroke = null;
      redrawInk();
      render(true);
      sync();
    }
    updateCursor();
  }

  function onKeyDown(e) {
    const meta = e.metaKey || e.ctrlKey;
    if (meta && (e.key === "z" || e.key === "Z") && !e.shiftKey) {
      const tag = e.target && e.target.tagName;
      if (tag === "INPUT" && e.target.type !== "range") return;
      e.preventDefault();
      undo();
      return;
    }
    const tag = e.target && e.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || (e.target && e.target.isContentEditable)) return;
    if (e.key === "Escape") {
      selectedId = null;
      render(true);
      sync();
      return;
    }
    const s = selected();
    if (!s) return;
    const big = e.shiftKey ? 22 : 8;
    if (e.key === "ArrowLeft") { e.preventDefault(); nudge(s, -big / cssW, 0); }
    else if (e.key === "ArrowRight") { e.preventDefault(); nudge(s, big / cssW, 0); }
    else if (e.key === "ArrowUp") { e.preventDefault(); nudge(s, 0, -big / cssH); }
    else if (e.key === "ArrowDown") { e.preventDefault(); nudge(s, 0, big / cssH); }
    else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); removeSelected(); }
    else if (e.key === "+" || e.key === "=") { e.preventDefault(); scaleSelected(1.12); }
    else if (e.key === "-" || e.key === "_") { e.preventDefault(); scaleSelected(1 / 1.12); }
  }

  let nudgeTimer = null;
  let nudgeFrom = null;
  let nudgeId = null;
  function nudge(s, dx, dy) {
    if (nudgeId !== s.id) {
      flushNudge();
      nudgeId = s.id;
      nudgeFrom = { x: s.x, y: s.y };
    }
    s.x = clamp(s.x + dx, 0.06, 0.94);
    s.y = clamp(s.y + dy, 0.06, 0.94);
    render(true);
    window.clearTimeout(nudgeTimer);
    nudgeTimer = window.setTimeout(flushNudge, 280);
  }
  function flushNudge() {
    if (!nudgeFrom || nudgeId == null) return;
    const s = stamps.find(function (st) { return st.id === nudgeId; });
    if (s && (Math.abs(s.x - nudgeFrom.x) > 0.0005 || Math.abs(s.y - nudgeFrom.y) > 0.0005)) {
      remember({ type: "move", id: s.id, from: nudgeFrom });
      sync();
    }
    nudgeFrom = null;
    nudgeId = null;
  }

  function bind() {
    document.querySelectorAll("[data-tool]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        tool = btn.getAttribute("data-tool");
        sync();
        updateCursor();
      });
    });
    document.querySelectorAll(".swatch").forEach(function (btn) {
      btn.addEventListener("click", function () {
        color = btn.getAttribute("data-color");
        sync();
      });
    });
    const sizeInput = document.getElementById("brush-size");
    if (sizeInput) {
      sizeInput.addEventListener("input", function () {
        brush = Number(sizeInput.value) || 8;
        sync();
      });
    }
    document.getElementById("undo").addEventListener("click", undo);
    document.getElementById("clear").addEventListener("click", clearAll);
    document.getElementById("download").addEventListener("click", download);
    document.getElementById("stamp-smaller").addEventListener("click", function () { scaleSelected(1 / 1.12); });
    document.getElementById("stamp-larger").addEventListener("click", function () { scaleSelected(1.12); });
    document.getElementById("stamp-remove").addEventListener("click", removeSelected);

    canvas.addEventListener("pointerdown", onPointerDown, { passive: false });
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", fit);
    if (window.ResizeObserver) new ResizeObserver(fit).observe(board);
  }

  function boot() {
    if (I18N) {
      I18N.bindSwitcher();
      currentLang = I18N.detect();
      I18N.apply(currentLang);
      document.addEventListener("noy:lang", function (e) {
        currentLang = e.detail.lang;
        syncMail();
      });
    }
    syncMail();
    bind();
    sync();
    fit();
    paintIcons();
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        if (!cssW) return;
        paintPaper();
        redrawInk();
        render(true);
      });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
