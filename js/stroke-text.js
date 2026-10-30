/* StrokeText — GSAP-based SVG stroke draw animation (requires gsap + ScrollTrigger CDN) */
(function (global) {
  'use strict';

  /**
   * initStrokeText(element, options) → destroy()
   *
   * Animates text with an SVG stroke-draw effect.
   * The stroke draws in first, then the original element fades in.
   *
   * @param {HTMLElement} element  Target heading/text element
   * @param {object} [opts]
   *   strokeColor    string  Stroke colour  (#a5b4fc)
   *   strokeWidth    number  px (1.5)
   *   duration       number  Stroke draw seconds (1.6)
   *   delay          number  Start delay (0)
   *   trigger        string  'mount' | 'scroll'
   *   ease           string  GSAP ease ('power2.inOut')
   */
  function initStrokeText(element, opts) {
    if (!window.gsap) return null;

    const s = Object.assign({
      strokeColor: '#a5b4fc',
      strokeWidth: 1.5,
      duration: 1.6,
      delay: 0,
      trigger: 'mount',
      ease: 'power2.inOut',
    }, opts || {});

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (reduce) return null;

    const text = element.textContent.trim();
    if (!text) return null;

    const cs = getComputedStyle(element);

    /* Store original styles */
    const origOpacity = element.style.opacity;
    element.style.opacity = '0';
    element.style.position = 'relative';

    /* Build SVG overlay */
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.cssText = [
      'position:absolute;', 'top:0;', 'left:0;',
      'width:100%;', 'height:100%;',
      'overflow:visible;', 'pointer-events:none;',
      'z-index:1;'
    ].join('');

    const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    textEl.textContent = text;
    textEl.style.fontFamily = cs.fontFamily;
    textEl.style.fontSize = cs.fontSize;
    textEl.style.fontWeight = cs.fontWeight;
    textEl.style.letterSpacing = cs.letterSpacing;
    textEl.style.fill = 'none';
    textEl.style.stroke = s.strokeColor;
    textEl.style.strokeWidth = s.strokeWidth + 'px';
    textEl.style.strokeLinejoin = 'round';
    textEl.setAttribute('x', '0');
    textEl.setAttribute('y', cs.fontSize); /* baseline approx */
    textEl.setAttribute('dominant-baseline', 'auto');

    svg.appendChild(textEl);
    element.appendChild(svg);

    let cleanup = null;

    function animate() {
      const textLength = textEl.getComputedTextLength();
      /* Use 3× the text length to ensure the dasharray covers the full outline perimeter */
      const dashLen = Math.max(textLength * 3, 3000);

      textEl.style.strokeDasharray = dashLen;
      textEl.style.strokeDashoffset = dashLen;

      const triggerOpts = s.trigger === 'scroll' && window.ScrollTrigger ? {
        scrollTrigger: { trigger: element, start: 'top 85%', once: true }
      } : {};

      const tl = gsap.timeline({ delay: s.delay, ...triggerOpts });

      tl.to(textEl, {
        strokeDashoffset: 0,
        duration: s.duration,
        ease: s.ease,
      }).to(svg, {
        opacity: 0,
        duration: 0.35,
        ease: 'power2.in',
        onStart() { gsap.to(element, { opacity: 1, duration: 0.4, ease: 'power2.out' }); }
      }, `-=${s.duration * 0.25}`);

      cleanup = () => { tl.kill(); svg.remove(); element.style.opacity = origOpacity; };
    }

    /* Wait one frame for layout before measuring text */
    requestAnimationFrame(() => requestAnimationFrame(animate));

    return function destroy() { cleanup?.(); };
  }

  global.initStrokeText = initStrokeText;
})(window);
