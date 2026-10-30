/* AnimatedContent — GSAP ScrollTrigger scroll reveal (replaces IntersectionObserver) */
/* Requires: gsap + ScrollTrigger loaded via CDN */
(function (global) {
  'use strict';

  /**
   * initAnimatedContent(opts) → destroy()
   *
   * Animates all .reveal elements into view using GSAP ScrollTrigger.
   * @param {object} [opts]
   *   distance    number  px to travel from start position (100)
   *   direction   string  'vertical' | 'horizontal' (vertical)
   *   duration    number  seconds (0.8)
   *   ease        string  GSAP ease string ('power3.out')
   *   stagger     number  seconds between siblings (0.08)
   *   threshold   number  fraction of element visible before triggering (0 = top hits viewport)
   *   start       string  ScrollTrigger start override ('top 88%')
   */
  function initAnimatedContent(opts) {
    const gsap = global.gsap;
    const ScrollTrigger = global.ScrollTrigger;
    if (!gsap || !ScrollTrigger) return null;

    const reduce = global.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (reduce) {
      /* Just make everything visible instantly */
      document.querySelectorAll('.reveal').forEach(el => {
        el.style.opacity = '1';
        el.style.transform = 'none';
        el.classList.add('revealed');
      });
      return null;
    }

    const s = Object.assign({
      distance: 100,
      direction: 'vertical',
      duration: 0.8,
      ease: 'power3.out',
      stagger: 0.08,
      start: 'top 88%',
    }, opts || {});

    /* Compute from/to based on direction */
    const axis = s.direction === 'horizontal' ? 'x' : 'y';
    const fromVars = { opacity: 0, [axis]: s.distance };
    const toVars   = { opacity: 1, [axis]: 0, duration: s.duration, ease: s.ease };

    /* Group siblings so they stagger together */
    const triggers = [];
    const elements = document.querySelectorAll('.reveal');
    if (!elements.length) return null;

    /* Group contiguous siblings under the same parent */
    const groups = [];
    let currentGroup = null;
    elements.forEach(el => {
      if (currentGroup && currentGroup.parent === el.parentNode) {
        currentGroup.els.push(el);
      } else {
        currentGroup = { parent: el.parentNode, els: [el] };
        groups.push(currentGroup);
      }
    });

    groups.forEach(group => {
      /* Use first element as scroll trigger anchor */
      const first = group.els[0];
      gsap.fromTo(group.els, fromVars, {
        ...toVars,
        stagger: s.stagger,
        scrollTrigger: {
          trigger: first,
          start: s.start,
          once: true,
          onEnter() { group.els.forEach(el => el.classList.add('revealed')); }
        }
      });
    });

    return function destroy() {
      ScrollTrigger.getAll().forEach(t => t.kill());
    };
  }

  global.initAnimatedContent = initAnimatedContent;
})(window);
