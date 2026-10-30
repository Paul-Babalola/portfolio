/* TargetCursor — vanilla JS port of ReactBits TargetCursor (JS-CSS) */
(function (global) {
  'use strict';

  const CORNER_ANGLES = [0, 90, 180, 270];
  const QUARTER = Math.PI / 2;

  function spring(state, goal, stiffness, damping, dt) {
    const steps = 2, h = dt / steps;
    for (let i = 0; i < steps; i++) {
      state.v += (stiffness * (goal - state.x) - damping * state.v) * h;
      state.x += state.v * h;
    }
  }

  /**
   * initTargetCursor(options) → destroy()
   * Injects a fullscreen reticle cursor overlay onto document.body.
   * Elements with class `cursor-target` (or the configured selector) receive
   * snap-bracket treatment. Add `data-cursor-label="Open"` for a label.
   */
  function initTargetCursor(opts) {
    const s = Object.assign({
      targetSelector: '.cursor-target',
      cursorColor: '#ffffff',
      cursorColorOnTarget: null,
      spinDuration: 2,
      hoverDuration: 0.2,
      parallaxOn: true,
      hideDefaultCursor: true,
      size: 36,
      cornerSize: 12,
      thickness: 3,
      padding: 6,
      matchRadius: true,
      dotSize: 4,
      blendMode: 'difference',
      showLabel: true,
      clickEffect: true,
      zone: null,
    }, opts || {});

    /* Only activate on fine pointer devices */
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return null;

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    /* Build overlay DOM */
    const root = document.createElement('div');
    root.className = 'target-cursor';
    root.style.cssText = `position:fixed;inset:0;z-index:2147483647;pointer-events:none;mix-blend-mode:${s.blendMode};opacity:0;`;
    root.setAttribute('aria-hidden', 'true');

    const cornerEls = CORNER_ANGLES.map(() => {
      const c = document.createElement('span');
      c.className = 'target-cursor__corner';
      c.style.cssText = 'position:absolute;top:0;left:0;box-sizing:border-box;border-style:solid;will-change:transform;';
      c.style.borderColor = s.cursorColor;
      root.appendChild(c);
      return c;
    });

    const dotEl = document.createElement('span');
    dotEl.className = 'target-cursor__dot';
    dotEl.style.cssText = 'position:absolute;top:0;left:0;border-radius:50%;will-change:transform;';
    dotEl.style.background = s.cursorColor;
    root.appendChild(dotEl);

    const labelEl = document.createElement('span');
    labelEl.className = 'target-cursor__label';
    labelEl.style.cssText = 'position:absolute;top:0;left:0;color:inherit;font-size:12px;font-weight:500;line-height:1;white-space:nowrap;opacity:0;will-change:transform,opacity;';
    root.appendChild(labelEl);

    document.body.appendChild(root);

    /* State */
    const ptr = { x: 0, y: 0, inside: false, seen: false, pressed: false };
    const centerX = { x: 0, v: 0 }, centerY = { x: 0, v: 0 };
    const halfW = { x: 0, v: 0 }, halfH = { x: 0, v: 0 };
    const radius = { x: 0, v: 0 };
    const turn = { x: 0, v: 0 };
    const lock = { x: 0, v: 0 };
    const press = { x: 0, v: 0 };
    const presence = { x: 0, v: 0 };

    let target = null, targetRadius = 0, quarter = 0, spinSpeed = 0;
    let raf = 0, last = 0, lastLabel = '', lastColor = '';

    const styleSheet = document.createElement('style');
    document.head.appendChild(styleSheet);

    const hideCursor = () => {
      const rule = s.hideDefaultCursor && ptr.inside ? 'html, html * { cursor: none !important; }' : '';
      if (styleSheet.textContent !== rule) styleSheet.textContent = rule;
    };

    const findTarget = (x, y, element) => {
      const node = element || document.elementFromPoint(x, y);
      return node?.closest?.(s.targetSelector) || null;
    };

    const lockOn = next => {
      if (next === target) return;
      target = next;
      if (target) {
        quarter = Math.round(turn.x / QUARTER);
        targetRadius = parseFloat(getComputedStyle(target).borderTopLeftRadius) || 0;
        spinSpeed = 0;
      }
    };

    const tick = now => {
      raf = 0;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      if (target && !target.isConnected) lockOn(null);
      const rect = target ? target.getBoundingClientRect() : null;
      const locked = !!rect && ptr.inside;
      const snapW = 4.6 / s.hoverDuration;
      const snapK = snapW * snapW;
      const snapC = 2 * 0.62 * snapW;
      spring(presence, ptr.inside ? 1 : 0, 260, 32, dt);
      spring(lock, locked ? 1 : 0, snapK, 2 * snapW, dt);
      spring(press, ptr.pressed && s.clickEffect ? 1 : 0, 900, 40, dt);
      let goalX = ptr.x, goalY = ptr.y;
      let goalW = s.size / 2, goalH = s.size / 2;
      let goalR = Math.min(2, s.cornerSize / 4);
      if (locked) {
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const lean = s.parallaxOn ? 0.08 : 0;
        goalX = cx + (ptr.x - cx) * lean;
        goalY = cy + (ptr.y - cy) * lean;
        const odd = Math.abs(quarter) % 2 === 1;
        const w = rect.width / 2 + s.padding;
        const h = rect.height / 2 + s.padding;
        goalW = odd ? h : w;
        goalH = odd ? w : h;
        goalR = s.matchRadius ? Math.min(targetRadius + Math.max(0, s.padding), s.cornerSize) : 0;
      }
      if (!ptr.inside && presence.x < 0.01) ptr.seen = false;
      if (!ptr.seen) {
        centerX.x = goalX; centerY.x = goalY;
        halfW.x = goalW; halfH.x = goalH;
        ptr.seen = ptr.inside;
      }
      const follow = locked ? snapK : 2200;
      const followC = locked ? snapC : 2 * Math.sqrt(2200);
      spring(centerX, goalX, follow, followC, dt);
      spring(centerY, goalY, follow, followC, dt);
      spring(halfW, goalW, snapK, snapC, dt);
      spring(halfH, goalH, snapK, snapC, dt);
      spring(radius, goalR, snapK, 2 * snapW, dt);
      if (locked) {
        spring(turn, quarter * QUARTER, snapK, snapC, dt);
      } else {
        const speed = s.spinDuration > 0 && !reduce ? (Math.PI * 2) / s.spinDuration : 0;
        spinSpeed += (speed - spinSpeed) * (1 - Math.exp(-dt * 3));
        turn.v = spinSpeed;
        turn.x += spinSpeed * dt;
      }
      const squeeze = 1 - press.x * 0.14;
      const cos = Math.cos(turn.x), sin = Math.sin(turn.x);
      const w = Math.max(0, halfW.x) * squeeze;
      const h = Math.max(0, halfH.x) * squeeze;
      const local = [[-w,-h],[w,-h],[w,h],[-w,h]];
      const r = Math.max(0, Math.min(radius.x, s.cornerSize));
      const degrees = (turn.x * 180) / Math.PI;
      let left = Infinity, top = Infinity;
      cornerEls.forEach((corner, i) => {
        const [lx, ly] = local[i];
        const x = centerX.x + lx * cos - ly * sin;
        const y = centerY.x + lx * sin + ly * cos;
        left = Math.min(left, x); top = Math.min(top, y);
        corner.style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) rotate(${(CORNER_ANGLES[i] + degrees).toFixed(2)}deg)`;
        corner.style.width = s.cornerSize + 'px';
        corner.style.height = s.cornerSize + 'px';
        corner.style.borderWidth = `${s.thickness}px 0 0 ${s.thickness}px`;
        corner.style.borderTopLeftRadius = r.toFixed(2) + 'px';
      });
      const dotScale = 1 - press.x * 0.35;
      dotEl.style.transform = `translate3d(${ptr.x}px,${ptr.y}px,0) translate(-50%,-50%) scale(${dotScale.toFixed(3)})`;
      dotEl.style.width = s.dotSize + 'px'; dotEl.style.height = s.dotSize + 'px';
      const text = s.showLabel && target ? (target.getAttribute('data-cursor-label') || '') : '';
      if (text && text !== lastLabel) labelEl.textContent = text;
      if (text) lastLabel = text;
      const shown = text ? Math.max(0, Math.min(1, lock.x)) : 0;
      labelEl.style.transform = `translate3d(${left.toFixed(2)}px,${(top - 8).toFixed(2)}px,0) translateY(-100%) translateY(${((1-shown)*4).toFixed(2)}px)`;
      labelEl.style.opacity = shown.toFixed(3);
      const mix = s.cursorColorOnTarget ? Math.round(Math.max(0, Math.min(1, lock.x)) * 100) : 0;
      const color = mix ? `color-mix(in oklab,${s.cursorColorOnTarget} ${mix}%,${s.cursorColor})` : s.cursorColor;
      if (color !== lastColor) {
        root.style.setProperty('--target-cursor-color', color);
        cornerEls.forEach(c => c.style.borderColor = color);
        dotEl.style.background = color;
        labelEl.style.color = color;
        lastColor = color;
      }
      root.style.opacity = Math.max(0, Math.min(1, presence.x)).toFixed(3);
      const resting = !ptr.inside && presence.x < 0.002 && Math.abs(presence.v) < 0.002 &&
        Math.abs(lock.x) < 0.002 && Math.abs(press.x) < 0.002;
      const spinning = ptr.inside && !locked && spinSpeed > 0.0001;
      const moving = Math.abs(centerX.v) + Math.abs(centerY.v) + Math.abs(halfW.v) +
        Math.abs(halfH.v) + Math.abs(turn.v) > 0.01 ||
        Math.abs(goalX - centerX.x) + Math.abs(goalY - centerY.x) > 0.05 ||
        Math.abs(lock.v) + Math.abs(press.v) + Math.abs(presence.v) > 0.001;
      if (!resting && (spinning || moving || locked)) raf = requestAnimationFrame(tick);
      else last = 0;
    };

    const wake = () => { if (!raf) raf = requestAnimationFrame(tick); };

    const onPointerMove = e => {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      ptr.x = e.clientX; ptr.y = e.clientY;
      let inside = true;
      if (s.zone) {
        const zr = s.zone.getBoundingClientRect();
        inside = e.clientY >= zr.top && e.clientY <= zr.bottom &&
                 e.clientX >= zr.left && e.clientX <= zr.right;
      }
      if (inside !== ptr.inside) { ptr.inside = inside; hideCursor(); }
      lockOn(findTarget(ptr.x, ptr.y, e.target));
      wake();
    };
    const onPointerDown = e => { if (e.pointerType && e.pointerType !== 'mouse') return; ptr.pressed = true; wake(); };
    const onPointerUp = () => { ptr.pressed = false; wake(); };
    const onLeave = () => { ptr.inside = false; ptr.pressed = false; lockOn(null); hideCursor(); wake(); };
    const onScroll = () => { if (!ptr.inside) return; lockOn(findTarget(ptr.x, ptr.y)); wake(); };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    window.addEventListener('blur', onLeave);

    return function destroy() {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('scroll', onScroll, { capture: true });
      document.documentElement.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('blur', onLeave);
      styleSheet.remove();
      root.remove();
    };
  }

  global.initTargetCursor = initTargetCursor;
})(window);
