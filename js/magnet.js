/* Magnet — vanilla JS port of ReactBits Magnet (JS-CSS) */
(function (global) {
  'use strict';

  const DEFAULT_SPRING = { stiffness: 170, damping: 16, mass: 1 };

  function smoothstep(edge0, edge1, v) {
    const t = Math.min(1, Math.max(0, (v - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }

  /* Global shared registry + pointer field so all magnets share one listener */
  const registry = new Set();
  const field = { pointer: null, owner: null };
  let detachGlobal = null;

  function reach(rect, pointer) {
    const dx = pointer.x - (rect.left + rect.width / 2);
    const dy = pointer.y - (rect.top + rect.height / 2);
    const outside = Math.hypot(
      Math.max(0, Math.abs(dx) - rect.width / 2),
      Math.max(0, Math.abs(dy) - rect.height / 2)
    );
    return { dx, dy, outside };
  }

  function arbitrate() {
    let winner = null, nearest = Infinity, closest = Infinity;
    for (const entry of registry) {
      const s = entry.settings;
      let near = null;
      if (field.pointer && !s.disabled && !entry.reduce) {
        near = reach(entry.wrapper.getBoundingClientRect(), field.pointer);
        if (near.outside > s.padding) near = null;
      }
      if (!s.exclusive) { if (near || entry.active) entry.wake(); continue; }
      if (!near) continue;
      const center = Math.hypot(near.dx, near.dy);
      if (near.outside < nearest || (near.outside === nearest && center < closest)) {
        winner = entry; nearest = near.outside; closest = center;
      }
    }
    const previous = field.owner;
    field.owner = winner;
    if (previous && previous !== winner) previous.wake();
    if (winner) winner.wake();
  }

  function attachGlobals() {
    const onMove = e => {
      if (e.pointerType === 'touch') return;
      field.pointer = { x: e.clientX, y: e.clientY };
      arbitrate();
    };
    const onLeave = () => { field.pointer = null; arbitrate(); };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('scroll', arbitrate, { passive: true, capture: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    window.addEventListener('blur', onLeave);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('scroll', arbitrate, { capture: true });
      document.documentElement.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('blur', onLeave);
    };
  }

  /**
   * initMagnet(element, options) → destroy()
   * Wraps element in a magnet container; returns cleanup function.
   */
  function initMagnet(element, opts) {
    const o = Object.assign({
      padding: 100,
      disabled: false,
      magnetStrength: 2,
      maxOffset: null,
      exclusive: true,
      axis: 'both',
      tilt: 0,
      scale: 1,
      spring: {}
    }, opts || {});

    const s = {
      padding: Math.max(0, o.padding),
      disabled: o.disabled,
      strength: Math.max(0.1, o.magnetStrength),
      maxOffset: o.maxOffset,
      exclusive: o.exclusive,
      axis: o.axis,
      tilt: o.tilt,
      scale: o.scale,
      stiffness: Math.max(1, o.spring?.stiffness ?? DEFAULT_SPRING.stiffness),
      damping: Math.max(0, o.spring?.damping ?? DEFAULT_SPRING.damping),
      mass: Math.max(0.01, o.spring?.mass ?? DEFAULT_SPRING.mass),
    };

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:relative;display:inline-block;';
    const inner = document.createElement('div');
    inner.style.willChange = 'transform';
    element.parentNode.insertBefore(wrapper, element);
    wrapper.appendChild(inner);
    inner.appendChild(element);

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const cur = { x: 0, y: 0, tiltX: 0, tiltY: 0, scale: 1 };
    const vel = { x: 0, y: 0, tiltX: 0, tiltY: 0, scale: 0 };
    let active = false, raf = 0, last = 0;

    function solve(target, dt) {
      let resting = true;
      for (const key of Object.keys(cur)) {
        const force = s.stiffness * (target[key] - cur[key]) - s.damping * vel[key];
        vel[key] += (force / s.mass) * dt;
        cur[key] += vel[key] * dt;
        const eps = key === 'scale' ? 0.001 : 0.05;
        if (Math.abs(target[key] - cur[key]) > eps || Math.abs(vel[key]) > eps) resting = false;
      }
      return resting;
    }

    function measure() {
      const target = { x: 0, y: 0, tiltX: 0, tiltY: 0, scale: 1 };
      if (s.disabled || reduce || !field.pointer) return { target, engaged: false };
      if (s.exclusive && field.owner !== entry) return { target, engaged: false };
      const rect = wrapper.getBoundingClientRect();
      const { dx, dy, outside } = reach(rect, field.pointer);
      if (outside > s.padding) return { target, engaged: false };
      const pull = s.padding > 0 ? 1 - smoothstep(s.padding * 0.5, s.padding, outside) : 1;
      let x = s.axis === 'y' ? 0 : (dx / s.strength) * pull;
      let y = s.axis === 'x' ? 0 : (dy / s.strength) * pull;
      if (s.maxOffset != null) {
        const len = Math.hypot(x, y);
        if (len > s.maxOffset) { x *= s.maxOffset / len; y *= s.maxOffset / len; }
      }
      const nx = Math.max(-1, Math.min(1, dx / Math.max(rect.width / 2, 1)));
      const ny = Math.max(-1, Math.min(1, dy / Math.max(rect.height / 2, 1)));
      target.x = x; target.y = y;
      target.tiltX = -ny * s.tilt * pull;
      target.tiltY = nx * s.tilt * pull;
      target.scale = 1 + (s.scale - 1) * pull;
      return { target, engaged: true };
    }

    function apply() {
      const { x, y, tiltX, tiltY, scale: sc } = cur;
      const turned = Math.abs(tiltX) > 0.01 || Math.abs(tiltY) > 0.01;
      inner.style.transform =
        `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0)` +
        (turned ? ` perspective(800px) rotateX(${tiltX.toFixed(2)}deg) rotateY(${tiltY.toFixed(2)}deg)` : '') +
        (Math.abs(sc - 1) > 0.0005 ? ` scale(${sc.toFixed(4)})` : '');
    }

    function frame(now) {
      raf = 0;
      const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
      last = now;
      const { target, engaged } = measure();
      if (engaged !== active) {
        active = engaged; entry.active = engaged;
        wrapper.toggleAttribute('data-magnet-active', engaged);
      }
      const steps = Math.ceil(dt / (1 / 120));
      let resting = true;
      for (let i = 0; i < steps; i++) resting = solve(target, dt / steps);
      if (resting) {
        for (const k of Object.keys(cur)) { cur[k] = target[k]; vel[k] = 0; }
      }
      apply();
      if (!resting) raf = requestAnimationFrame(frame);
      else last = 0;
    }

    const entry = {
      wrapper, settings: s, reduce, active: false,
      wake() { if (!raf) raf = requestAnimationFrame(frame); }
    };
    registry.add(entry);
    if (!detachGlobal) detachGlobal = attachGlobals();

    return function destroy() {
      cancelAnimationFrame(raf);
      registry.delete(entry);
      if (field.owner === entry) field.owner = null;
      if (!registry.size && detachGlobal) { detachGlobal(); detachGlobal = null; }
      if (inner.parentNode === wrapper && wrapper.parentNode) {
        while (inner.firstChild) wrapper.parentNode.insertBefore(inner.firstChild, wrapper);
        wrapper.remove();
      }
    };
  }

  global.initMagnet = initMagnet;
})(window);
