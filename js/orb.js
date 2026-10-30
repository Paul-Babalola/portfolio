/* Orb — vanilla JS WebGL port of ReactBits Orb (JS-CSS variant) */
(function (global) {
  'use strict';

  const INTRO_SECONDS = 1.1;
  const FOCAL = 3.2;

  const VERTEX = `#version 300 es
in vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

  /* FOCAL hardcoded as 3.2 (was template literal in original) */
  const FRAGMENT = `#version 300 es
precision highp float;
uniform vec2 uResolution;
uniform float uTime;
uniform float uRotation;
uniform vec2 uReach;
uniform float uNear;
uniform float uAwake;
uniform vec3 uBackground;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform float uScale;
uniform float uWobble;
uniform float uGlow;
uniform float uBleed;
uniform float uHighlight;
uniform float uSwirl;
uniform float uOrbit;
uniform vec2 uEcho;
uniform float uReveal;
uniform float uOpacity;
uniform float uTrail;
uniform vec2 uTilt;
out vec4 outColor;

vec3 hash33(vec3 p3){
  p3=fract(p3*vec3(0.1031,0.11369,0.13787));
  p3+=dot(p3,p3.yxz+19.19);
  return -1.0+2.0*fract(vec3(p3.x+p3.y,p3.x+p3.z,p3.y+p3.z)*p3.zyx);
}

float snoise3(vec3 p){
  const float K1=0.333333333;
  const float K2=0.166666667;
  vec3 i=floor(p+(p.x+p.y+p.z)*K1);
  vec3 d0=p-(i-(i.x+i.y+i.z)*K2);
  vec3 e=step(vec3(0.0),d0-d0.yzx);
  vec3 i1=e*(1.0-e.zxy);
  vec3 i2=1.0-e.zxy*(1.0-e);
  vec3 d1=d0-(i1-K2);
  vec3 d2=d0-(i2-K1);
  vec3 d3=d0-0.5;
  vec4 h=max(0.6-vec4(dot(d0,d0),dot(d1,d1),dot(d2,d2),dot(d3,d3)),0.0);
  vec4 n=h*h*h*h*vec4(dot(d0,hash33(i)),dot(d1,hash33(i+i1)),dot(d2,hash33(i+i2)),dot(d3,hash33(i+1.0)));
  return dot(vec4(31.316),n);
}

float light1(float intensity,float attenuation,float dist){return intensity/(1.0+dist*attenuation);}
float light2(float intensity,float attenuation,float dist){return intensity/(1.0+dist*dist*attenuation);}

vec4 draw(vec2 uv){
  float rawLen=length(uv);
  vec2 dir=rawLen>0.0001?uv/rawLen:vec2(1.0,0.0);
  float reachAmount=length(uReach);
  vec2 reachDir=reachAmount>0.00001?uReach/reachAmount:vec2(1.0,0.0);
  float facing=exp((dot(dir,reachDir)-1.0)*3.2);
  float len=max(rawLen-reachAmount*facing*smoothstep(0.25,0.65,rawLen),0.0);
  uv=dir*len;
  float ang=atan(dir.y,dir.x);
  float invLen=len>0.0?1.0/len:0.0;
  float near=facing*uNear;
  float bgLuminance=dot(uBackground,vec3(0.299,0.587,0.114));
  float n0=snoise3(vec3(uv*0.65,uTime*0.5))*0.5+0.5;
  float r0=mix(0.8-0.04*uWobble,0.8+0.04*uWobble,n0);
  float d0=distance(uv,(r0*invLen)*uv);
  float v0=light1(1.0,10.0/uGlow,d0);
  v0*=smoothstep(r0*1.05,r0,len);
  float reach=max(uBleed,0.04);
  float innerFade=smoothstep(r0*(1.0-0.2*reach),r0*(1.0-0.05*reach),len);
  v0*=mix(innerFade,1.0,bgLuminance*0.7*min(uBleed,1.0));
  float body=smoothstep(0.8-0.2*reach,0.8,len);
  float cl=cos(ang+uSwirl)*0.5+0.5;
  vec2 pos=vec2(cos(uOrbit),sin(uOrbit))*r0;
  float d=distance(uv,pos);
  vec2 head=vec2(cos(uOrbit),sin(uOrbit));
  float lag=atan(head.x*dir.y-head.y*dir.x,dot(dir,head));
  float trail=uTrail>0.0?smoothstep(0.0,0.35,lag)*exp(-max(lag,0.0)*2.6/uTrail):0.0;
  float v1=(light2(1.5,5.0,d)+trail*0.6)*uHighlight;
  v1*=light1(1.0,50.0,d0);
  float band=v0*smoothstep(1.0,mix(0.6,1.0,n0*0.5),len)*body;
  float heat=pow(clamp(band/0.82,0.0,1.0),3.0);
  float bloom=light2(1.0,160.0/uGlow,max(len-r0,0.0))*smoothstep(0.4,0.0,len-r0)*step(r0,len);
  float v2=smoothstep(1.0,mix(0.6,1.0,n0*0.5),len);
  float v3=body;
  vec3 colBase=mix(uColor1,uColor2,cl);
  float fadeAmount=mix(1.0,0.1,bgLuminance);
  float echoD=abs(len-r0-uEcho.x);
  float echo=light1(1.0,60.0,echoD)*smoothstep(0.12,0.0,echoD)*uEcho.y;
  vec3 darkCol=mix(uColor3,colBase,v0);
  darkCol=(darkCol+v1)*v2*v3*(1.0+uAwake+near*0.35)+mix(colBase,vec3(1.0),0.25)*heat*(0.28+near*0.3);
  darkCol=clamp(darkCol+colBase*(bloom*0.1+echo),0.0,1.0);
  vec3 lightCol=(colBase+v1)*mix(1.0,v2*v3,fadeAmount);
  lightCol=mix(uBackground,lightCol,clamp(v0+echo,0.0,1.0));
  lightCol=mix(lightCol,colBase,clamp(v0,0.0,1.0)*clamp(near*0.4+uAwake,0.0,0.6));
  lightCol=clamp(mix(lightCol,vec3(1.0),clamp(v1*0.35,0.0,0.6)),0.0,1.0);
  vec3 finalCol=mix(darkCol,lightCol,bgLuminance);
  float alpha=max(max(finalCol.r,finalCol.g),finalCol.b);
  return vec4(finalCol/(alpha+1e-5),alpha);
}

vec2 toPlane(vec2 p,out float hit){
  float cx=cos(uTilt.x);float sx=sin(uTilt.x);
  float cy=cos(uTilt.y);float sy=sin(uTilt.y);
  vec3 ex=vec3(cy,0.0,-sy);
  vec3 ey=vec3(sy*sx,cx,cy*sx);
  vec3 normal=vec3(sy*cx,-sx,cy*cx);
  vec3 origin=vec3(0.0,0.0,3.2);
  vec3 ray=vec3(p,-3.2);
  float denom=dot(normal,ray);
  float t=-dot(normal,origin)/(abs(denom)>0.00001?denom:-0.00001);
  hit=t>0.0?1.0:0.0;
  vec3 q=origin+ray*t;
  return vec2(dot(q,ex),dot(q,ey));
}

void main(){
  vec2 uv=(gl_FragCoord.xy-uResolution*0.5)/min(uResolution.x,uResolution.y)*2.0;
  uv*=uScale;
  float hit=1.0;
  if(abs(uTilt.x)+abs(uTilt.y)>0.0001)uv=toPlane(uv,hit);
  float s=sin(uRotation);float c=cos(uRotation);
  uv=vec2(c*uv.x-s*uv.y,s*uv.x+c*uv.y);
  vec4 col=draw(uv);
  float dither=(fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)-0.5)/255.0;
  float alpha=clamp(col.a*hit*uReveal*uOpacity+dither,0.0,1.0);
  outColor=vec4(col.rgb*alpha*alpha,alpha);
}`;

  function cv(value, min, max) { return Math.min(max, Math.max(min, value)); }

  function compile(gl, type, src) {
    const s = gl.createShader(type);
    if (!s) return null;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (gl.getShaderParameter(s, gl.COMPILE_STATUS)) return s;
    gl.deleteShader(s);
    return null;
  }

  function linkProgram(gl) {
    const vert = compile(gl, gl.VERTEX_SHADER, VERTEX);
    const frag = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
    const prog = gl.createProgram();
    if (!vert || !frag || !prog) return null;
    gl.attachShader(prog, vert);
    gl.attachShader(prog, frag);
    gl.bindAttribLocation(prog, 0, 'aPosition');
    gl.linkProgram(prog);
    gl.deleteShader(vert);
    gl.deleteShader(frag);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { gl.deleteProgram(prog); return null; }
    const uniforms = {};
    const count = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < count; i++) {
      const info = gl.getActiveUniform(prog, i);
      if (info) uniforms[info.name] = gl.getUniformLocation(prog, info.name);
    }
    return { program: prog, uniforms };
  }

  /**
   * initOrb(container, options) → destroy()
   * Renders the WebGL orb into container. Returns a cleanup function.
   */
  function initOrb(container, opts) {
    const s = Object.assign({
      colors: ['#9c43fe', '#4cc2e9', '#101499'],
      hue: 0,
      backgroundColor: '#000000',
      size: 1,
      glow: 1,
      bleed: 1,
      wobble: 1,
      highlight: 1,
      trail: 1,
      tiltX: 0,
      tiltY: 0,
      speed: 1,
      hoverIntensity: 1,
      rotateOnHover: true,
      followCursor: true,
      clickPulse: true,
      intro: true,
      opacity: 1,
      paused: false,
    }, opts || {});

    const canvas = document.createElement('canvas');
    canvas.className = 'orb-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    container.appendChild(canvas);

    const gl = canvas.getContext('webgl2', {
      alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false
    });
    if (!gl) { canvas.remove(); return null; }

    const linked = linkProgram(gl);
    if (!linked) { canvas.remove(); return null; }
    const u = linked.uniforms;

    const buf = gl.createBuffer();
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const probe2d = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const colorCache = new Map();

    function parseColor(v) {
      if (colorCache.has(v)) return colorCache.get(v);
      let rgb = [0, 0, 0];
      probe2d.clearRect(0, 0, 1, 1);
      probe2d.fillStyle = '#000';
      probe2d.fillStyle = v;
      probe2d.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = probe2d.getImageData(0, 0, 1, 1).data;
      if (a) rgb = [r / 255, g / 255, b / 255];
      colorCache.set(v, rgb);
      return rgb;
    }

    function shiftHue(rgb, deg) {
      if (!deg) return rgb;
      const a = (deg * Math.PI) / 180, cs = Math.cos(a), sn = Math.sin(a);
      const [r, g, b] = rgb;
      const y = 0.299 * r + 0.587 * g + 0.114 * b;
      const i = 0.596 * r - 0.274 * g - 0.322 * b;
      const q = 0.211 * r - 0.523 * g + 0.312 * b;
      const ni = i * cs - q * sn, nq = i * sn + q * cs;
      return [y + 0.956 * ni + 0.621 * nq, y - 0.272 * ni - 0.647 * nq, y - 1.106 * ni + 1.703 * nq];
    }

    const view = { width: 1, height: 1 };
    const ptr = { x: 0, y: 0, inside: false };
    const st = {
      time: 0, swirl: 0, orbit: 0, echo: 1, rotation: 0,
      hover: 0, near: 0, reachX: 0, reachY: 0, reachSpeedX: 0, reachSpeedY: 0,
      pulse: 0, pulseSpeed: 0,
      kick: s.intro && !reduce ? 2.5 : 0,
      reveal: s.intro && !reduce ? 0 : 1
    };

    let raf = 0, last = 0, visible = true;

    function toOrb(x, y) {
      const side = Math.min(view.width, view.height);
      const scale = 1 / (s.size * (1 + st.pulse));
      let ux = ((x - view.width / 2) / side) * 2 * scale;
      let uy = ((view.height / 2 - y) / side) * 2 * scale;
      const sinR = Math.sin(st.rotation), cosR = Math.cos(st.rotation);
      return [cosR * ux - sinR * uy, sinR * ux + cosR * uy];
    }

    function render() {
      const palette = s.colors;
      const cols = [palette[0] || '#9c43fe', palette[1] || '#4cc2e9', palette[2] || '#101499'];
      const [c1, c2, c3] = cols.map(v => shiftHue(parseColor(v), s.hue));
      const rev = st.reveal, back = rev - 1;
      const grow = 1 + 2.2 * back * back * back + 1.2 * back * back;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(linked.program);
      gl.bindVertexArray(vao);
      gl.uniform2f(u.uResolution, canvas.width, canvas.height);
      gl.uniform1f(u.uTime, st.time);
      gl.uniform2f(u.uReach, st.reachX, st.reachY);
      gl.uniform1f(u.uNear, st.near);
      gl.uniform1f(u.uAwake, st.hover * s.hoverIntensity * 0.18);
      gl.uniform1f(u.uRotation, st.rotation);
      gl.uniform3fv(u.uBackground, parseColor(s.backgroundColor));
      gl.uniform3fv(u.uColor1, c1);
      gl.uniform3fv(u.uColor2, c2);
      gl.uniform3fv(u.uColor3, c3);
      gl.uniform1f(u.uScale, 1 / (s.size * (1 + st.pulse) * (0.62 + 0.38 * grow)));
      gl.uniform1f(u.uWobble, s.wobble);
      gl.uniform1f(u.uGlow, s.glow);
      gl.uniform1f(u.uBleed, s.bleed);
      gl.uniform1f(u.uHighlight, s.highlight);
      gl.uniform2f(u.uEcho, st.echo * 0.55, st.echo < 1 ? (1 - st.echo) ** 2 : 0);
      gl.uniform1f(u.uSwirl, st.swirl);
      gl.uniform1f(u.uOrbit, st.orbit);
      const rv = Math.min(1, rev / 0.55);
      gl.uniform1f(u.uReveal, rv * rv * (3 - 2 * rv));
      gl.uniform1f(u.uOpacity, s.opacity);
      gl.uniform1f(u.uTrail, s.trail);
      gl.uniform2f(u.uTilt, (-s.tiltX * Math.PI) / 180, (s.tiltY * Math.PI) / 180);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function wake() {
      if (!raf && visible && !document.hidden) raf = requestAnimationFrame(tick);
    }

    function tick(now) {
      raf = 0;
      if (!visible || document.hidden) return;
      const dt = last ? cv((now - last) / 1000, 0.0005, 0.05) : 1 / 60;
      last = now;
      if (s.paused) { st.reveal = 1; render(); last = 0; return; }
      const motion = reduce ? 0 : 1;
      const [px, py] = toOrb(ptr.x, ptr.y);
      const dist = Math.hypot(px, py);
      const region = ptr.inside && motion ? cv((1.45 - dist) / 0.4, 0, 1) : 0;
      const zone = region * region * (3 - 2 * region);
      const aimed = zone * cv((dist - 0.15) / 0.45, 0, 1);
      st.hover += (zone - st.hover) * (1 - Math.exp(-dt / 0.16));
      const reach = 0.075 * s.hoverIntensity * aimed;
      const goalX = dist > 0.0001 ? (px / dist) * reach : 0;
      const goalY = dist > 0.0001 ? (py / dist) * reach : 0;
      st.reachSpeedX += (70 * (goalX - st.reachX) - 7 * st.reachSpeedX) * dt;
      st.reachSpeedY += (70 * (goalY - st.reachY) - 7 * st.reachSpeedY) * dt;
      st.reachX += st.reachSpeedX * dt;
      st.reachY += st.reachSpeedY * dt;
      st.near += (aimed * s.hoverIntensity - st.near) * (1 - Math.exp(-dt / 0.12));
      const sp = dt * s.speed * motion;
      st.time += sp;
      st.swirl += sp * 2 * (1 + st.kick);
      st.echo = Math.min(1, st.echo + dt / 1.2);
      if (s.rotateOnHover) st.rotation += dt * 0.3 * st.hover * motion;
      const aim = Math.atan2(py, px);
      const near = zone > 0.5;
      if (s.followCursor && near && motion) {
        const delta = Math.atan2(Math.sin(aim - st.orbit), Math.cos(aim - st.orbit));
        st.orbit += delta * (1 - Math.exp(-dt * 6));
      } else {
        st.orbit -= sp;
      }
      st.orbit = Math.atan2(Math.sin(st.orbit), Math.cos(st.orbit));
      st.pulseSpeed += (-170 * st.pulse - 11 * st.pulseSpeed) * dt;
      st.pulse += st.pulseSpeed * dt;
      st.kick *= Math.exp(-dt * 2.5);
      if (!s.intro || reduce) st.reveal = 1;
      else if (st.reveal < 1) st.reveal = Math.min(1, st.reveal + dt / INTRO_SECONDS);
      render();
      raf = requestAnimationFrame(tick);
    }

    function locate(e) {
      const rect = container.getBoundingClientRect();
      ptr.x = e.clientX - rect.left;
      ptr.y = e.clientY - rect.top;
      ptr.inside = ptr.x >= 0 && ptr.y >= 0 && ptr.x <= rect.width && ptr.y <= rect.height;
    }

    function onMove(e) { locate(e); if (!s.paused) wake(); }
    function onDown(e) {
      locate(e);
      if (!ptr.inside || !s.clickPulse || s.paused || reduce) return;
      const [px, py] = toOrb(ptr.x, ptr.y);
      if (Math.hypot(px, py) > 1) return;
      st.pulseSpeed += 0.9; st.kick = 2.2; st.echo = 0; wake();
    }
    function onUp(e) { if (e.pointerType !== 'mouse') ptr.inside = false; }
    function onLeave() { ptr.inside = false; }
    function onVis() { last = 0; wake(); }

    const ro = new ResizeObserver(() => {
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      view.width = w; view.height = h;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      render(); wake();
    });
    ro.observe(container);

    const io = new IntersectionObserver(entries => {
      visible = entries.some(e => e.isIntersecting);
      if (visible) { last = 0; wake(); }
    });
    io.observe(container);

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    window.addEventListener('pointercancel', onUp, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    document.addEventListener('visibilitychange', onVis);
    ro.disconnect(); ro.observe(container); /* trigger initial resize */

    /* Force an initial resize */
    const w0 = Math.max(1, container.clientWidth);
    const h0 = Math.max(1, container.clientHeight);
    const dpr0 = Math.min(window.devicePixelRatio || 1, 2);
    view.width = w0; view.height = h0;
    canvas.width = Math.round(w0 * dpr0); canvas.height = Math.round(h0 * dpr0);
    render(); wake();

    return function destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect(); io.disconnect();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('visibilitychange', onVis);
      gl.deleteProgram(linked.program);
      gl.deleteBuffer(buf);
      gl.deleteVertexArray(vao);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      canvas.remove();
    };
  }

  global.initOrb = initOrb;
})(window);
