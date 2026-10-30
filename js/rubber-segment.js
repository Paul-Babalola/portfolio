/* RubberSegment — vanilla JS spring-physics nav indicator (replaces CSS transition) */
(function (global) {
  'use strict';

  function springStep(current, target, velocity, stiffness, damping, dt) {
    const force = stiffness * (target - current) - damping * velocity;
    const newVel = velocity + force * dt;
    const newPos = current + newVel * dt;
    return { pos: newPos, vel: newVel };
  }

  /**
   * initRubberSegment(navLinksEl, indicatorEl) → { moveTo(linkEl), destroy() }
   *
   * Upgrades the existing nav indicator to use dual-edge spring physics with a
   * rubber-band stretch effect. The left and right edges spring independently,
   * creating a "rubber" stretch when jumping between segments.
   */
  function initRubberSegment(navLinksEl, indicatorEl) {
    if (!navLinksEl || !indicatorEl) return null;

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (reduce) {
      /* Reduced motion: just the instant move, no spring */
      return {
        moveTo(link) {
          if (!link) return;
          const lr = navLinksEl.getBoundingClientRect();
          const lk = link.getBoundingClientRect();
          indicatorEl.style.left = (lk.left - lr.left) + 'px';
          indicatorEl.style.width = lk.width + 'px';
          indicatorEl.classList.add('visible');
        },
        destroy() {}
      };
    }

    /* Spring parameters */
    const STIFFNESS = 260;
    const DAMPING = 26;
    /* Leading edge has higher stiffness so it snaps fast; trailing creates the rubber stretch */
    const LEAD_STIFFNESS = 380;
    const LEAD_DAMPING = 30;

    let targetLeft = 0, targetRight = 0;
    let edgeL = { pos: 0, vel: 0 }, edgeR = { pos: 0, vel: 0 };
    let moving = false, dir = 0;
    let raf = 0, last = 0;

    function getSegmentRect(link) {
      const lr = navLinksEl.getBoundingClientRect();
      const lk = link.getBoundingClientRect();
      return { left: lk.left - lr.left, right: (lk.left - lr.left) + lk.width };
    }

    function applyEdges() {
      const left = edgeL.pos;
      const width = edgeR.pos - edgeL.pos;
      indicatorEl.style.left = left + 'px';
      indicatorEl.style.width = Math.max(0, width) + 'px';
      indicatorEl.classList.add('visible');
    }

    function frame(now) {
      raf = 0;
      const dt = Math.min(last ? (now - last) / 1000 : 1 / 60, 1 / 30);
      last = now;

      /* Leading and trailing edges depend on movement direction */
      let leading, trailing;
      if (dir >= 0) {
        /* Moving right: right edge leads, left edge trails */
        trailing = springStep(edgeL.pos, targetLeft, edgeL.vel, STIFFNESS, DAMPING, dt);
        leading  = springStep(edgeR.pos, targetRight, edgeR.vel, LEAD_STIFFNESS, LEAD_DAMPING, dt);
      } else {
        /* Moving left: left edge leads, right edge trails */
        leading  = springStep(edgeL.pos, targetLeft, edgeL.vel, LEAD_STIFFNESS, LEAD_DAMPING, dt);
        trailing = springStep(edgeR.pos, targetRight, edgeR.vel, STIFFNESS, DAMPING, dt);
      }
      /* Assign back in order depending on direction */
      if (dir >= 0) {
        edgeL = { pos: trailing.pos, vel: trailing.vel };
        edgeR = { pos: leading.pos, vel: leading.vel };
      } else {
        edgeL = { pos: leading.pos, vel: leading.vel };
        edgeR = { pos: trailing.pos, vel: trailing.vel };
      }
      applyEdges();

      const restL = Math.abs(edgeL.pos - targetLeft) < 0.3 && Math.abs(edgeL.vel) < 0.5;
      const restR = Math.abs(edgeR.pos - targetRight) < 0.3 && Math.abs(edgeR.vel) < 0.5;
      if (restL && restR) {
        edgeL.pos = targetLeft; edgeL.vel = 0;
        edgeR.pos = targetRight; edgeR.vel = 0;
        applyEdges();
        last = 0; moving = false;
      } else {
        moving = true;
        raf = requestAnimationFrame(frame);
      }
    }

    function wake() { if (!raf) raf = requestAnimationFrame(frame); }

    function moveTo(link) {
      if (!link) return;
      const { left, right } = getSegmentRect(link);
      /* Determine direction from current position */
      const currentCenter = (edgeL.pos + edgeR.pos) / 2;
      const newCenter = (left + right) / 2;
      dir = newCenter >= currentCenter ? 1 : -1;
      targetLeft = left;
      targetRight = right;
      wake();
    }

    /* Initialize edges to a hidden position */
    edgeL.pos = -100; edgeR.pos = -100;

    return {
      moveTo,
      destroy() { cancelAnimationFrame(raf); }
    };
  }

  global.initRubberSegment = initRubberSegment;
})(window);
