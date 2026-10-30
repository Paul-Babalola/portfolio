/* GlareHover — vanilla JS port of ReactBits GlareHover (JS-CSS) */
(function (global) {
  'use strict';

  const smootherstep = t => t * t * t * (t * (t * 6 - 15) + 10);
  const bump = (t, center, half) => {
    const d = Math.abs(t - center);
    return d >= half ? 0 : smootherstep(1 - d / half);
  };
  const PROFILES = {
    streak: (t, s) => bump(t, 0.5, 0.06 + 0.16 * s) + 0.32 * bump(t, 0.5, 0.5),
    twin: (t, s) => bump(t, 0.36, 0.08 + 0.18 * s) + 0.85 * bump(t, 0.7, 0.03 + 0.06 * s) + 0.26 * bump(t, 0.5, 0.5),
    sheen: (t, s) => 0.55 * bump(t, 0.5, 0.25 + 0.25 * s) + 0.3 * bump(t, 0.5, 0.5)
  };

  function buildGradient(color, opacity, variant, softness) {
    const profile = PROFILES[variant] || PROFILES.streak;
    const stops = Array.from({ length: 33 }, (_, i) => {
      const t = i / 32;
      const a = Math.round(Math.min(1, profile(t, softness) * opacity) * 1000) / 10;
      return `color-mix(in srgb, ${color} ${a}%, transparent) ${(t * 100).toFixed(1)}%`;
    });
    return `linear-gradient(90deg, ${stops.join(', ')})`;
  }

  const ease = t => (1 - Math.cos(Math.PI * t)) / 2;

  /**
   * initGlareHover(element, options) → destroy()
   * Adds a glare/streak effect to an element. The element must have
   * position:relative, overflow:hidden, and isolation:isolate (set by this fn).
   */
  function initGlareHover(element, opts) {
    const s = Object.assign({
      glareColor: '#ffffff',
      glareOpacity: 0.5,
      glareAngle: -45,
      glareSize: 30,
      softness: 0.6,
      variant: 'streak',
      blendMode: 'screen',
      rimGlint: true,
      mode: 'hover',         /* 'hover' | 'follow' | 'click' | 'loop' */
      transitionDuration: 650,
      interval: 3,
      playOnce: false,
      intro: false,
    }, opts || {});

    /* Ensure element has required styles */
    const orig = element.style.cssText;
    element.style.position = element.style.position || 'relative';
    element.style.overflow = 'hidden';
    element.style.isolation = 'isolate';

    const glare = document.createElement('span');
    glare.className = 'glare-hover__glare';
    const band = document.createElement('span');
    band.className = 'glare-hover__band';
    const rim = document.createElement('span');
    rim.className = 'glare-hover__rim';
    const rimBand = document.createElement('span');
    rimBand.className = 'glare-hover__band glare-hover__band--rim';

    glare.style.cssText = 'position:absolute;inset:0;z-index:2;border-radius:inherit;opacity:0;pointer-events:none;';
    glare.style.mixBlendMode = s.blendMode;
    band.style.cssText = 'position:absolute;top:50%;left:50%;will-change:transform;';
    rim.style.cssText = [
      'position:absolute;inset:0;padding:1px;border-radius:inherit;',
      '-webkit-mask-image:linear-gradient(#000 0 0),linear-gradient(#000 0 0);',
      '-webkit-mask-clip:content-box,border-box;',
      '-webkit-mask-composite:xor;',
      'mask-image:linear-gradient(#000 0 0),linear-gradient(#000 0 0);',
      'mask-clip:content-box,border-box;',
      'mask-composite:exclude;'
    ].join('');
    rimBand.style.cssText = 'position:absolute;top:50%;left:50%;will-change:transform;';

    const glareGrad = buildGradient(s.glareColor, s.glareOpacity, s.variant, s.softness);
    const rimGrad = buildGradient(s.glareColor, Math.min(1, s.glareOpacity * 1.8), s.variant, s.softness);
    band.style.background = glareGrad;
    rimBand.style.background = rimGrad;

    glare.appendChild(band);
    if (s.rimGlint) { rim.appendChild(rimBand); glare.appendChild(rim); }
    element.appendChild(glare);

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const geometry = { band: 0, reach: 0, ux: 0, uy: -1, angle: 0 };
    const state = { pos: 0, velocity: 0, target: 0, presence: 0, presenceTarget: 0, sweep: null, visible: true };
    let raf = 0, last = 0, timer = 0;

    const allBands = () => [band, s.rimGlint ? rimBand : null].filter(Boolean);

    const write = () => {
      const transform = `translate(-50%, -50%) rotate(${geometry.angle - 90}deg) translateX(${state.pos.toFixed(2)}px)`;
      allBands().forEach(b => b.style.transform = transform);
      glare.style.opacity = state.presence.toFixed(3);
    };

    const measure = () => {
      const { glareAngle, glareSize } = s;
      const w = element.clientWidth;
      const h = element.clientHeight;
      const rad = (glareAngle * Math.PI) / 180;
      const ux = Math.sin(rad), uy = -Math.cos(rad);
      const diagonal = Math.hypot(w, h);
      const bw = Math.max(8, (diagonal * glareSize) / 100);
      const reach = (Math.abs(w * ux) + Math.abs(h * uy)) / 2 + bw / 2 + 2;
      const resting = !state.sweep && s.mode !== 'follow';
      Object.assign(geometry, { band: bw, reach, ux, uy, angle: glareAngle });
      allBands().forEach(b => { b.style.width = bw + 'px'; b.style.height = (diagonal + bw) + 'px'; });
      if (resting) state.pos = state.pos > 0 ? reach : -reach;
      write();
    };

    const frame = now => {
      const dt = Math.min(0.05, (now - last) / 1000 || 0);
      last = now;
      let moving = false;
      if (state.sweep) {
        const sw = state.sweep;
        const t = Math.min(1, (now - sw.start) / sw.duration);
        state.pos = sw.from + (sw.to - sw.from) * ease(t);
        if (t < 1) moving = true;
        else state.sweep = null;
      } else if (s.mode === 'follow') {
        const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
        const h = dt / steps;
        for (let i = 0; i < steps; i++) {
          state.velocity += (170 * (state.target - state.pos) - 24 * state.velocity) * h;
          state.pos += state.velocity * h;
        }
        const tau = state.presenceTarget > state.presence ? 0.18 : 0.4;
        state.presence += (state.presenceTarget - state.presence) * (1 - Math.exp(-dt / tau));
        moving = Math.abs(state.target - state.pos) > 0.05 || Math.abs(state.velocity) > 0.05 ||
          Math.abs(state.presenceTarget - state.presence) > 0.002;
        if (!moving) state.presence = state.presenceTarget;
      }
      write();
      raf = moving ? requestAnimationFrame(frame) : 0;
    };

    const wake = () => {
      if (raf) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };

    const sweepFn = sign => {
      if (reduced || !geometry.reach) return;
      const end = sign * geometry.reach;
      const from = state.sweep || Math.abs(state.pos) < geometry.reach ? state.pos : -end;
      if (from === end) return;
      const share = Math.abs(end - from) / (2 * geometry.reach);
      state.sweep = { from, to: end, start: performance.now(), duration: Math.max(120, s.transitionDuration * share) };
      wake();
    };

    const along = event => {
      const rect = element.getBoundingClientRect();
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      return dx * geometry.ux + dy * geometry.uy;
    };

    const onEnter = event => {
      if (s.mode === 'hover') sweepFn(along(event) > 0 ? -1 : 1);
      if (s.mode === 'follow') {
        if (state.presence < 0.02) {
          state.pos = Math.max(-geometry.reach, Math.min(geometry.reach, along(event)));
          state.velocity = 0;
        }
        state.presenceTarget = reduced ? 0 : 1;
        state.target = Math.max(-geometry.reach, Math.min(geometry.reach, along(event)));
        wake();
      }
    };
    const onMove = event => {
      if (s.mode === 'follow') {
        state.target = Math.max(-geometry.reach, Math.min(geometry.reach, along(event)));
        wake();
      }
    };
    const onLeave = event => {
      if (s.mode === 'hover' && !s.playOnce) sweepFn(along(event) > 0 ? 1 : -1);
      if (s.mode === 'follow') { state.presenceTarget = 0; wake(); }
    };
    const onDown = event => {
      if (s.mode === 'click') sweepFn(along(event) > 0 ? -1 : 1);
    };

    const schedule = () => {
      clearTimeout(timer);
      if (s.mode !== 'loop' || reduced) return;
      timer = setTimeout(() => {
        if (state.visible && !document.hidden) sweepFn(1);
        schedule();
      }, Math.max(500, s.interval * 1000));
    };

    element.addEventListener('pointerenter', onEnter);
    element.addEventListener('pointermove', onMove);
    element.addEventListener('pointerleave', onLeave);
    element.addEventListener('pointerdown', onDown);

    const ro = new ResizeObserver(measure);
    ro.observe(element);

    const io = new IntersectionObserver(([entry]) => {
      state.visible = entry.isIntersecting;
      if (entry.isIntersecting && s.intro && !element._glareIntroPlayed) {
        element._glareIntroPlayed = true;
        sweepFn(1);
      }
    }, { threshold: 0.4 });
    io.observe(element);

    state.presence = s.mode === 'follow' ? 0 : 1;
    state.presenceTarget = state.presence;
    state.pos = -1e4;
    measure();
    schedule();

    return function destroy() {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      ro.disconnect();
      io.disconnect();
      element.removeEventListener('pointerenter', onEnter);
      element.removeEventListener('pointermove', onMove);
      element.removeEventListener('pointerleave', onLeave);
      element.removeEventListener('pointerdown', onDown);
      glare.remove();
    };
  }

  global.initGlareHover = initGlareHover;
})(window);
