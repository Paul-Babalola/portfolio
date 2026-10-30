/* MorphSlider — vanilla WebGL2 port of ReactBits MorphSlider (no OGL dependency) */
(function (global) {
  'use strict';

  const TRANSITIONS = { melt: 0, ripple: 1, shear: 2, swirl: 3 };

  const VERTEX = `#version 300 es
in vec2 position;
in vec2 uv;
out vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position, 0.0, 1.0); }`;

  /* Adapted from MorphSlider fragment shader: texture2D→texture, varying→in, gl_FragColor→outColor */
  const FRAGMENT = `#version 300 es
precision highp float;

uniform sampler2D tCurrent;
uniform sampler2D tNext;
uniform vec2 uResolution;
uniform vec2 uCurrentSize;
uniform vec2 uNextSize;
uniform float uProgress;
uniform float uDir;
uniform int uMode;
uniform float uIntensity;
uniform float uScale;
uniform float uAberration;
uniform float uDrift;
uniform float uTime;
uniform float uReduce;
uniform vec2 uPointer;

in vec2 vUv;
out vec4 outColor;

const float PI = 3.14159265359;

float hash11(float p){p=fract(p*0.1031);p*=p+33.33;p*=p+p;return fract(p);}
float hash21(vec2 p){vec3 p3=fract(vec3(p.xyx)*0.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
float noise(vec2 p){vec2 i=floor(p);vec2 f=fract(p);vec2 u=f*f*(3.0-2.0*f);float a=hash21(i);float b=hash21(i+vec2(1,0));float c=hash21(i+vec2(0,1));float d=hash21(i+vec2(1,1));return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);}
float fbm(vec2 p){float v=0.0;float a=0.5;for(int i=0;i<5;i++){v+=a*noise(p);p*=2.0;a*=0.5;}return v;}
mat2 rot(float a){float s=sin(a);float c=cos(a);return mat2(c,-s,s,c);}

vec2 coverUV(vec2 uv,vec2 res,vec2 img){
  float rA=res.x/max(res.y,1.0);float iA=img.x/max(img.y,0.0001);
  vec2 s=vec2(1.0);float ratio=rA/max(iA,0.0001);
  if(ratio>1.0)s.y=1.0/ratio;else s.x=ratio;
  return(uv-0.5)*s+0.5;
}

void main(){
  float p=clamp(uProgress,0.0,1.0);
  float env=sin(p*PI);
  vec2 uv=vUv;
  uv+=vec2(sin(uTime*0.25+uv.y*4.0),cos(uTime*0.22+uv.x*4.0))*uDrift*0.008;
  uv=(uv-0.5)*(1.0-uDrift*0.02*sin(uTime*0.4))+0.5;
  vec2 uvC=uv;vec2 uvN=uv;
  float m=smoothstep(0.0,1.0,p);
  if(uReduce<0.5){
    if(uMode==3){
      vec2 c=uv-0.5;float r=length(c);
      float ang=env*uIntensity*3.5*(1.0-r);
      uvC=rot(ang)*c+0.5;uvN=rot(-ang)*c+0.5;m=smoothstep(0.0,1.0,p);
    } else if(uMode==1){
      float d=distance(uv,uPointer);float ring=p*1.6;
      float wave=sin((d-ring)*30.0)*env;
      vec2 dir=normalize(uv-uPointer+1e-4);
      vec2 disp=dir*wave*uIntensity*0.25;
      uvC=uv+disp;uvN=uv+disp*0.6;
      m=1.0-smoothstep(ring-0.03,ring+0.03,d);
    } else if(uMode==2){
      float slices=14.0;float row=floor(uv.y*slices);float rnd=hash11(row);
      vec2 disp=vec2((rnd-0.5)*env*uIntensity*0.6,0.0);
      uvC=uv+disp;uvN=uv+disp;
      float localX=uDir>0.0?uv.x:1.0-uv.x;
      float th=p*1.5-0.25+(rnd-0.5)*0.25;
      m=1.0-smoothstep(th-0.06,th+0.06,localX);
    } else {
      float nn=fbm(uv*uScale+uTime*0.03);float warp=fbm(uv*uScale*1.7-uTime*0.02);
      vec2 g=vec2(nn,warp)-0.5;
      uvC=uv+g*uIntensity*0.5*p;uvN=uv-g*uIntensity*0.5*(1.0-p);
      m=smoothstep(nn-0.15,nn+0.15,p);
    }
  }
  vec2 sC=coverUV(uvC,uResolution,uCurrentSize);
  vec2 sN=coverUV(uvN,uResolution,uNextSize);
  float ca=uReduce<0.5?uAberration*env*0.03:0.0;
  vec3 colC=vec3(texture(tCurrent,sC+vec2(ca,0.0)).r,texture(tCurrent,sC).g,texture(tCurrent,sC-vec2(ca,0.0)).b);
  vec3 colN=vec3(texture(tNext,sN+vec2(ca,0.0)).r,texture(tNext,sN).g,texture(tNext,sN-vec2(ca,0.0)).b);
  vec3 col=mix(colC,colN,m);
  float vig=smoothstep(1.25,0.25,length(uv-0.5));
  col=mix(col,vec3(0.04,0.04,0.05),(1.0-vig)*0.28);
  outColor=vec4(col,1.0);
}`;

  function compileShader(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { gl.deleteShader(s); return null; }
    return s;
  }

  function linkProgram(gl, vertSrc, fragSrc) {
    const v = compileShader(gl, gl.VERTEX_SHADER, vertSrc);
    const f = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc);
    const p = gl.createProgram();
    gl.attachShader(p, v); gl.attachShader(p, f);
    gl.linkProgram(p);
    gl.deleteShader(v); gl.deleteShader(f);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { gl.deleteProgram(p); return null; }
    return p;
  }

  function getUniforms(gl, prog) {
    const uniforms = {};
    const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(prog, i);
      if (info) uniforms[info.name] = gl.getUniformLocation(prog, info.name);
    }
    return uniforms;
  }

  function makeFallbackTex(gl) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([24, 24, 28, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    return tex;
  }

  function loadTex(gl, url) {
    const tex = makeFallbackTex(gl);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const size = [1, 1];
    img.onload = () => {
      size[0] = img.naturalWidth || 1; size[1] = img.naturalHeight || 1;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    };
    img.src = url;
    return { tex, size };
  }

  /**
   * initMorphSlider(container, items, options) → { next(), prev(), goTo(dir), destroy() }
   *
   * @param {HTMLElement} container  Element to render the slider into
   * @param {Array<{image:string, caption?:string}>} items  Image array
   * @param {object} [opts]  transition, intensity, scale, aberration, drift,
   *                          autoplay, autoplayDelay, loop, duration, ease
   */
  function initMorphSlider(container, items, opts) {
    if (!items || items.length === 0) return null;

    const s = Object.assign({
      transition: 'melt',
      intensity: 0.55,
      scale: 2.4,
      aberration: 0.35,
      drift: 0.4,
      duration: 1.1,
      ease: null,
      autoplay: false,
      autoplayDelay: 4,
      loop: true,
      showCaptions: true,
      showControls: true,
      showIndicators: true,
    }, opts || {});

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    /* Canvas */
    const canvas = document.createElement('canvas');
    canvas.className = 'morph-slider-canvas';
    canvas.style.cssText = 'display:block;width:100%;height:100%;cursor:grab;';
    container.style.position = 'relative';
    container.style.overflow = 'hidden';
    container.appendChild(canvas);

    const gl = canvas.getContext('webgl2', { alpha: false, antialias: true });
    if (!gl) { canvas.remove(); return null; }

    const prog = linkProgram(gl, VERTEX, FRAGMENT);
    if (!prog) { canvas.remove(); return null; }
    const u = getUniforms(gl, prog);

    /* Full-screen triangle geometry */
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vbuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbuf);
    /* position + uv for a fullscreen triangle covering [0,0]→[1,1] UV */
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,  0, 0,
       3, -1,  2, 0,
      -1,  3,  0, 2
    ]), gl.STATIC_DRAW);
    const posLoc = gl.getAttribLocation(prog, 'position');
    const uvLoc  = gl.getAttribLocation(prog, 'uv');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(uvLoc);
    gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 16, 8);

    /* Load textures */
    const textures = items.map(item => loadTex(gl, item.image));

    /* State */
    let current = 0, progress = 0, animating = false;
    let currentNext = 0, currentDir = 1;
    let dragActive = false, dragStart = 0, dragWidth = 1;
    let raf = 0, last = 0, time = 0;
    let autoTimer = null;
    let onIndexChange = null;

    const w = { width: 1, height: 1 };

    function resize() {
      const rect = container.getBoundingClientRect();
      w.width = Math.max(1, rect.width);
      w.height = Math.max(1, rect.height);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width  = Math.round(w.width * dpr);
      canvas.height = Math.round(w.height * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
    }

    function render() {
      gl.useProgram(prog);
      gl.bindVertexArray(vao);

      const curTex = textures[current];
      const nxtTex = textures[wrap(current + currentDir)];

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, curTex.tex);
      gl.uniform1i(u.tCurrent, 0);
      gl.uniform2fv(u.uCurrentSize, curTex.size);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, nxtTex.tex);
      gl.uniform1i(u.tNext, 1);
      gl.uniform2fv(u.uNextSize, nxtTex.size);

      gl.uniform2f(u.uResolution, canvas.width, canvas.height);
      gl.uniform1f(u.uProgress, progress);
      gl.uniform1f(u.uDir, currentDir);
      gl.uniform1i(u.uMode, TRANSITIONS[s.transition] ?? 0);
      gl.uniform1f(u.uIntensity, s.intensity);
      gl.uniform1f(u.uScale, s.scale);
      gl.uniform1f(u.uAberration, s.aberration);
      gl.uniform1f(u.uDrift, s.drift);
      gl.uniform1f(u.uTime, time);
      gl.uniform1f(u.uReduce, reduce ? 1 : 0);
      gl.uniform2f(u.uPointer, 0.5, 0.5);

      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    const ease = t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; /* ease-in-out quad */

    function tick(now) {
      raf = 0;
      const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
      last = now;
      time += dt;
      if (animating) {
        progress += dt / (reduce ? Math.min(s.duration, 0.4) : s.duration);
        if (progress >= 1) {
          progress = 0; animating = false;
          current = wrap(current + currentDir);
          onIndexChange?.(current);
          scheduleAutoplay();
        }
      }
      render();
      if (animating || dragActive) raf = requestAnimationFrame(tick);
      else { last = 0; /* Keep rendering for drift animation */ if (s.drift > 0) raf = requestAnimationFrame(tick); }
    }

    function wake() { if (!raf) raf = requestAnimationFrame(tick); }

    function wrap(i) { const n = items.length; return ((i % n) + n) % n; }

    function goTo(dir) {
      if (animating || items.length < 2) return;
      if (!s.loop) { const raw = current + dir; if (raw < 0 || raw > items.length - 1) return; }
      currentDir = dir;
      progress = 0;
      animating = true;
      onIndexChange?.(wrap(current + dir));
      wake();
    }

    function scheduleAutoplay() {
      clearTimeout(autoTimer);
      if (!s.autoplay) return;
      autoTimer = setTimeout(() => goTo(1), Math.max(1, s.autoplayDelay) * 1000);
    }

    /* Drag */
    canvas.addEventListener('pointerdown', e => {
      const rect = canvas.getBoundingClientRect();
      dragStart = e.clientX;
      dragWidth = rect.width || 1;
      dragActive = true;
      canvas.style.cursor = 'grabbing';
      wake();
    }, { passive: true });
    window.addEventListener('pointermove', e => {
      if (!dragActive) return;
      const ndx = (e.clientX - dragStart) / dragWidth;
      currentDir = ndx < 0 ? 1 : -1;
      progress = Math.min(Math.abs(ndx), 1);
      onIndexChange?.(progress > 0.5 ? wrap(current + currentDir) : current);
      wake();
    }, { passive: true });
    function endDrag() {
      if (!dragActive) return;
      dragActive = false;
      canvas.style.cursor = 'grab';
      if (progress > 0.4) {
        animating = true;
        /* Continue animation from current progress */
      } else {
        currentDir = 1; progress = 0;
        onIndexChange?.(current);
      }
    }
    window.addEventListener('pointerup', endDrag, { passive: true });
    window.addEventListener('pointercancel', endDrag, { passive: true });

    /* Resize */
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    /* Caption + indicators + controls */
    let captionEl = null, dots = [], indicatorState = { current: 0 };

    if (s.showCaptions && items.some(i => i.caption)) {
      captionEl = document.createElement('div');
      captionEl.className = 'morph-slider-caption';
      items.forEach((item, i) => {
        if (!item.caption) return;
        const span = document.createElement('span');
        span.className = 'morph-slider-caption-text' + (i === 0 ? ' is-active' : '');
        span.textContent = item.caption;
        captionEl.appendChild(span);
      });
      container.appendChild(captionEl);
    }

    if (s.showIndicators && items.length > 1) {
      const dotsEl = document.createElement('div');
      dotsEl.className = 'morph-slider-indicators';
      dotsEl.setAttribute('role', 'tablist');
      items.forEach((_, i) => {
        const btn = document.createElement('button');
        btn.className = 'morph-slider-dot' + (i === 0 ? ' is-active' : '');
        btn.type = 'button';
        btn.setAttribute('aria-label', `Slide ${i + 1}`);
        btn.addEventListener('click', () => {
          if (i === current || animating) return;
          goTo(i > current ? 1 : -1);
        });
        dots.push(btn);
        dotsEl.appendChild(btn);
      });
      container.appendChild(dotsEl);
    }

    if (s.showControls && items.length > 1) {
      const ctrlEl = document.createElement('div');
      ctrlEl.className = 'morph-slider-controls';
      const arrowSvg = dir => `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="${dir<0?'M15 5l-7 7 7 7':'M9 5l7 7-7 7'}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      [[-1,'Previous'],[ 1,'Next']].forEach(([d, label]) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'morph-slider-btn';
        btn.setAttribute('aria-label', label + ' slide');
        btn.innerHTML = arrowSvg(d);
        btn.addEventListener('click', () => goTo(d));
        ctrlEl.appendChild(btn);
      });
      container.appendChild(ctrlEl);
    }

    onIndexChange = idx => {
      indicatorState.current = idx;
      if (captionEl) {
        Array.from(captionEl.children).forEach((span, i) => span.classList.toggle('is-active', i === idx));
      }
      dots.forEach((dot, i) => dot.classList.toggle('is-active', i === idx));
    };

    /* CSS variables for caption/dot transitions */
    container.style.setProperty('--ms-swap', (s.duration * 0.66).toFixed(3) + 's');
    container.style.setProperty('--ms-dot',  (s.duration * 0.45).toFixed(3) + 's');

    scheduleAutoplay();
    wake();

    return {
      next()    { goTo(1); },
      prev()    { goTo(-1); },
      goTo(d)   { goTo(d); },
      destroy() {
        cancelAnimationFrame(raf);
        clearTimeout(autoTimer);
        ro.disconnect();
        gl.deleteProgram(prog);
        gl.deleteBuffer(vbuf);
        gl.deleteVertexArray(vao);
        textures.forEach(({ tex }) => gl.deleteTexture(tex));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        canvas.remove();
        captionEl?.remove();
      }
    };
  }

  global.initMorphSlider = initMorphSlider;
})(window);
