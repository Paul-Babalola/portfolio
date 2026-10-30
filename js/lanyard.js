/* Lanyard — vanilla JS Three.js port of ReactBits Lanyard (JS-CSS) */
/* Requires: three@0.176+ loaded as THREE global via CDN */
(function (global) {
  'use strict';

  const CARD_SIZES = { portrait: [1.6, 2.25], landscape: [2.25, 1.6] };
  const ANCHORS = { left: 0.27, center: 0.5, right: 0.73 };
  const THICKNESS = 0.018, BEVEL = 0.007;
  const JOINTS = 4, NODE_WEIGHT = 1 / 0.05, MAX_STEP = 1 / 960, ITERATIONS = 2;
  const SAMPLES = 72, FOV = 24;
  const STRAP_WIDTH = 0.36, RING_RADIUS = 0.095, RING_TUBE = 0.0135;
  const EYELET_RADIUS = 0.036, CLAMP_BODY = 0.15, FACE_WIDTH = 1024;
  const FLIP_SPIN = 9;

  const FINISHES = {
    glossy:      { roughness: 0.42, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06, foil: 0, anisotropy: 0 },
    matte:       { roughness: 0.85, metalness: 0, clearcoat: 0, clearcoatRoughness: 0.6,  foil: 0, anisotropy: 0 },
    holographic: { roughness: 0.3,  metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04, foil: 1, anisotropy: 0 },
    metallic:    { roughness: 0.36, metalness: 0.75,clearcoat:0.5,clearcoatRoughness:0.18,foil: 0, anisotropy: 0.7 }
  };
  const METALS = {
    silver: { color: '#d9dce2', roughness: 0.16 },
    gold:   { color: '#e4b965', roughness: 0.2 },
    graphite:{ color: '#4d4f55', roughness: 0.28 }
  };
  const BAND_COLUMNS = [0, 0.07, 0.93, 1];
  const BAND_BEND = [-0.95, -0.28, 0.28, 0.95];

  const FOIL_VERTEX_HEAD = `varying vec2 vFoilUv;varying vec3 vFoilX;varying vec3 vFoilY;`;
  const FOIL_VERTEX_BODY = `vFoilUv=uv;vFoilX=normalize((modelViewMatrix*vec4(1,0,0,0)).xyz);vFoilY=normalize((modelViewMatrix*vec4(0,1,0,0)).xyz);`;
  const FOIL_FRAGMENT_HEAD = `uniform float foilStrength;uniform float foilAspect;uniform vec3 foilKey;uniform vec3 foilFill;uniform vec3 foilTop;varying vec2 vFoilUv;varying vec3 vFoilX;varying vec3 vFoilY;float foilHash(vec2 p){p=fract(p*vec2(234.34,435.345));p+=dot(p,p+34.23);return fract(p.x*p.y);}float foilBump(float t,float c,float w){float x=(t-c)/w;return max(0.,1.-x*x);}vec3 foilSpectrum(float t){return vec3(foilBump(t,.82,.32)+.4*foilBump(t,.02,.12),foilBump(t,.5,.26),foilBump(t,.18,.24));}vec3 foilGrating(float u,float s){vec3 col=vec3(0.);for(int m=1;m<=2;m++){float o=float(m);float t=(s*abs(u)/o-.38)/.32;col+=foilSpectrum(t)/o;}return col;}vec3 foilShard(vec2 p){vec2 base=floor(p);float best=9.;float edge=9.;vec2 id=base;for(int j=-1;j<=1;j++){for(int i=-1;i<=1;i++){vec2 cell=base+vec2(float(i),float(j));vec2 site=cell+vec2(foilHash(cell),foilHash(cell+7.31))*.9+.05;float d=length(site-p);if(d<best){edge=best;best=d;id=cell;}else if(d<edge){edge=d;}}}return vec3(foilHash(id+3.17),foilHash(id+11.73),edge-best);}`;
  const FOIL_FRAGMENT_BODY = `if(foilStrength>0.){vec3 fv=normalize(vViewPosition);vec3 fn=normalize(normal);vec2 fp=vec2(vFoilUv.x,vFoilUv.y*foilAspect);vec3 shard=foilShard(fp*26.);vec2 ray=fp-vec2(-1.6,2.6*foilAspect);float angle=atan(ray.y,ray.x)+(shard.x-.5)*.16;vec3 grating=normalize(vFoilX*cos(angle)+vFoilY*sin(angle));float spacing=1.7*(.95+shard.y*.1);vec3 rainbow=foilGrating(dot(foilKey+fv,grating),spacing);rainbow+=.6*foilGrating(dot(foilTop+fv,grating),spacing);rainbow*=.8+.2*smoothstep(0.,.04,shard.z);rainbow=max(rainbow-.35*min(rainbow.r,min(rainbow.g,rainbow.b)),0.);vec2 grid=fp*64.;vec2 cell=floor(grid);vec2 jitter=vec2(foilHash(cell+1.7),foilHash(cell+9.2));float flake=smoothstep(.32,.06,length(fract(grid)-jitter*.6-.2))*step(.45,foilHash(cell+4.4));vec3 facet=normalize(fn+(vFoilX*(jitter.x-.5)+vFoilY*(jitter.y-.5))*.8);float glint=pow(max(dot(reflect(-foilKey,facet),fv),0.),28.)+.7*pow(max(dot(reflect(-foilTop,facet),fv),0.),28.);float fine=1.-smoothstep(.35,.9,max(fwidth(grid.x),fwidth(grid.y)));vec3 sparkle=flake*glint*fine*(vec3(.7)+foilGrating(dot(foilKey+fv,grating)+jitter.x*.4,spacing));float ink=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));float foil=foilStrength*(.08+.92*smoothstep(.04,.7,ink));float facing=clamp(dot(fn,fv),0.,1.);float tint=clamp(dot(rainbow,vec3(.4)),0.,1.);outgoingLight=outgoingLight*(1.-foil*(.3+.32*tint))+(rainbow*.62*(.4+.6*facing)+sparkle*1.6)*foil;}`;

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const mix = (a, b, t) => a + (b - a) * t;

  function parseColor(value, fallback) {
    try {
      const ctx = document.createElement('canvas').getContext('2d');
      ctx.fillStyle = '#000000'; ctx.fillStyle = value;
      const r = ctx.fillStyle;
      if (r.startsWith('#')) { const n = parseInt(r.slice(1), 16); return [((n>>16)&255)/255,((n>>8)&255)/255,(n&255)/255]; }
      const parts = r.match(/[\d.]+/g);
      if (!parts || parts.length < 3) return fallback;
      return [+parts[0]/255, +parts[1]/255, +parts[2]/255];
    } catch { return fallback; }
  }
  const luminance = rgb => 0.2126*rgb[0] + 0.7152*rgb[1] + 0.0722*rgb[2];
  const toCss = (rgb, a=1) => `rgba(${Math.round(rgb[0]*255)},${Math.round(rgb[1]*255)},${Math.round(rgb[2]*255)},${a})`;

  function seeded(start) {
    let state = start >>> 0;
    return () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t^(t>>>15), t|1);
      t ^= t + Math.imul(t^(t>>>7), t|61);
      return ((t^(t>>>14))>>>0) / 4294967296;
    };
  }

  function traceRoundedRect(path, x, y, w, h, r) {
    const k = r * 0.4477;
    path.moveTo(x+r, y);
    path.lineTo(x+w-r, y);
    path.bezierCurveTo(x+w-k,y,x+w,y+k,x+w,y+r);
    path.lineTo(x+w, y+h-r);
    path.bezierCurveTo(x+w,y+h-k,x+w-k,y+h,x+w-r,y+h);
    path.lineTo(x+r, y+h);
    path.bezierCurveTo(x+k,y+h,x,y+h-k,x,y+h-r);
    path.lineTo(x, y+r);
    path.bezierCurveTo(x,y+k,x+k,y,x+r,y);
  }

  function loadImage(cache, url) {
    if (!url) return Promise.resolve(null);
    if (cache.has(url)) return cache.get(url);
    const p = new Promise(res => { const img = new Image(); img.crossOrigin='anonymous'; img.decoding='async'; img.onload=()=>res(img); img.onerror=()=>res(null); img.src=url; });
    cache.set(url, p); return p;
  }

  function cardLayout(orientation, cornerRadius) {
    const [width, height] = CARD_SIZES[orientation] || CARD_SIZES.portrait;
    const radius = mix(0.03, Math.min(width, height)*0.2, clamp(cornerRadius, 0, 1));
    const slot = { width: 0.34, height: 0.07, y: height/2 - 0.13 };
    const ringY = height/2 - 0.055;
    return { width, height, radius, slot, ringY, hangY: ringY + RING_RADIUS };
  }

  function buildCardGeometry(layout, T) {
    const { width, height, radius, slot } = layout;
    const outline = new T.Shape();
    traceRoundedRect(outline, -width/2+BEVEL, -height/2+BEVEL, width-BEVEL*2, height-BEVEL*2, Math.max(radius-BEVEL, 0.005));
    const hole = new T.Path();
    traceRoundedRect(hole, -slot.width/2-BEVEL, slot.y-slot.height/2-BEVEL, slot.width+BEVEL*2, slot.height+BEVEL*2, slot.height/2+BEVEL);
    outline.holes.push(hole);
    const body = new T.ExtrudeGeometry(outline, { depth: THICKNESS, bevelEnabled: true, bevelThickness: BEVEL, bevelSize: BEVEL, bevelSegments: 5, curveSegments: 24 });
    body.translate(0, 0, -THICKNESS/2);
    const face = new T.ShapeGeometry(outline, 24);
    const position = face.getAttribute('position'), uv = face.getAttribute('uv');
    for (let i = 0; i < position.count; i++) uv.setXY(i, (position.getX(i)+width/2)/width, (position.getY(i)+height/2)/height);
    uv.needsUpdate = true;
    return { body, face };
  }

  function buildBandGeometry(count, T) {
    const columns = BAND_COLUMNS.length;
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(new Float32Array(count*columns*3), 3));
    geo.setAttribute('normal',   new T.BufferAttribute(new Float32Array(count*columns*3), 3));
    geo.setAttribute('uv',       new T.BufferAttribute(new Float32Array(count*columns*2), 2));
    const index = [];
    for (let i = 0; i < count-1; i++) for (let c = 0; c < columns-1; c++) { const a=i*columns+c; index.push(a,a+columns,a+1,a+1,a+columns,a+columns+1); }
    geo.setIndex(index);
    return geo;
  }

  function buildEnvironment(renderer, T) {
    const scene = new T.Scene();
    scene.background = new T.Color(0.035, 0.035, 0.04);
    const geo = new T.PlaneGeometry(1, 1);
    const materials = [];
    const panel = (intensity, pos, scale, rot=0) => {
      const mat = new T.MeshBasicMaterial({ color: new T.Color(intensity, intensity, intensity), side: T.DoubleSide });
      materials.push(mat);
      const mesh = new T.Mesh(geo, mat);
      mesh.position.set(...pos); mesh.scale.set(scale[0], scale[1], 1); mesh.lookAt(0,0,0); mesh.rotateZ(rot);
      scene.add(mesh);
    };
    panel(2.6,[0,4.5,8],[9,4]); panel(6,[-5.5,0.5,7],[0.9,14]); panel(4,[5,-0.5,8],[0.6,14]);
    panel(3.5,[0,-1,9],[24,0.35],Math.PI/3); panel(2.5,[1,2.5,9],[24,0.2],Math.PI/3);
    panel(1.4,[0,6,-6],[12,4]); panel(0.5,[0,-7,1],[16,6]); panel(0.9,[8,0,-2],[4,10]);
    const pmrem = new T.PMREMGenerator(renderer);
    const target = pmrem.fromScene(scene, 0.035);
    pmrem.dispose(); geo.dispose(); materials.forEach(m => m.dispose());
    return target;
  }

  function buildGrainTexture(T) {
    const size = 128;
    const canvas = document.createElement('canvas'); canvas.width=size; canvas.height=size;
    const ctx = canvas.getContext('2d');
    const random = seeded(7);
    const field = Float32Array.from({length:size*size}, ()=>random());
    const h = (x,y) => { let s=0; for(let j=-1;j<=1;j++) for(let i=-1;i<=1;i++) s+=field[((y+j+size)%size)*size+((x+i+size)%size)]; return (s/9)*1.6; };
    const img = ctx.createImageData(size,size);
    for(let y=0;y<size;y++) for(let x=0;x<size;x++){
      const nx=h((x-1+size)%size,y)-h((x+1)%size,y), ny=h(x,(y-1+size)%size)-h(x,(y+1)%size);
      const len=Math.hypot(nx,ny,1); const i=(y*size+x)*4;
      img.data[i]=((nx/len)*.5+.5)*255; img.data[i+1]=((ny/len)*.5+.5)*255;
      img.data[i+2]=((1/len)*.5+.5)*255; img.data[i+3]=255;
    }
    ctx.putImageData(img,0,0);
    const tex = new T.CanvasTexture(canvas);
    tex.colorSpace = T.SRGBColorSpace;
    tex.wrapS = T.RepeatWrapping; tex.wrapT = T.RepeatWrapping; tex.repeat.set(5,7);
    return tex;
  }

  function buildWeaveTexture(T) {
    const size=128, threads=8;
    const random=seeded(19);
    const fiber=Float32Array.from({length:size*size},()=>random());
    const profile = f => Math.sqrt(Math.max(0, 1-4*f*f));
    const ht = (x,y)=>{
      const px=((x%size)+size)%size, py=((y%size)+size)%size;
      const u=(px/size)*threads, v=(py/size)*threads;
      const cu=Math.floor(u), cv=Math.floor(v), fu=u-cu-.5, fv=v-cv-.5;
      const lift=(cu+cv)%2===0;
      const warp=profile(fu)*(0.55+0.45*Math.cos(fv*Math.PI*(lift?1:0.6)));
      const weft=profile(fv)*(0.55+0.45*Math.cos(fu*Math.PI*(lift?0.6:1)));
      return (lift?Math.max(warp,weft*0.7):Math.max(weft,warp*0.7))+fiber[py*size+px]*0.08;
    };
    const data=new Uint8Array(size*size*4);
    for(let y=0;y<size;y++) for(let x=0;x<size;x++){
      const nx=(ht(x-1,y)-ht(x+1,y))*1.6, ny=(ht(x,y-1)-ht(x,y+1))*1.6;
      const len=Math.hypot(nx,ny,1); const i=(y*size+x)*4;
      data[i]=((nx/len)*.5+.5)*255; data[i+1]=((ny/len)*.5+.5)*255;
      data[i+2]=((1/len)*.5+.5)*255; data[i+3]=255;
    }
    const tex=new T.DataTexture(data,size,size);
    tex.wrapS=T.RepeatWrapping; tex.wrapT=T.RepeatWrapping;
    tex.magFilter=T.LinearFilter; tex.minFilter=T.LinearMipmapLinearFilter;
    tex.generateMipmaps=true; tex.needsUpdate=true;
    return tex;
  }

  function createSimulation(T) {
    const vectors = () => Array.from({length:JOINTS+1}, ()=>new T.Vector3());
    return {
      nodes: vectors(), previous: vectors(), velocities: vectors(),
      lengths: new Float64Array(JOINTS), impulses: new Float64Array(JOINTS),
      rest: 1, anchor: new T.Vector3(),
      body: {
        position: new T.Vector3(), previous: new T.Vector3(), velocity: new T.Vector3(),
        quaternion: new T.Quaternion(), previousQuaternion: new T.Quaternion(),
        angular: new T.Vector3(), mass: 1, inverseInertia: new T.Vector3(1,1,1),
        hang: new T.Vector3()
      },
      grab: null, turn: 0, twist: 0, twistRaw: 0, calm: 0
    };
  }

  function makeScratch(T) {
    return { a:new T.Vector3(),b:new T.Vector3(),c:new T.Vector3(),d:new T.Vector3(),
             e:new T.Vector3(),f:new T.Vector3(),g:new T.Vector3(),
             pin:new T.Vector3(),q:new T.Quaternion(),r:new T.Quaternion() };
  }

  /* Physics helpers */
  function applyInverseInertia(body, vector, out, scratch) {
    scratch.r.copy(body.quaternion).invert();
    out.copy(vector).applyQuaternion(scratch.r);
    out.set(out.x*body.inverseInertia.x, out.y*body.inverseInertia.y, out.z*body.inverseInertia.z);
    return out.applyQuaternion(body.quaternion);
  }
  function rotateBody(q, w) {
    const {x:qx,y:qy,z:qz,w:qw}=q;
    q.x+=.5*(w.x*qw+w.y*qz-w.z*qy); q.y+=.5*(w.y*qw+w.z*qx-w.x*qz);
    q.z+=.5*(w.z*qw+w.x*qy-w.y*qx); q.w+=.5*(-w.x*qx-w.y*qy-w.z*qz);
    q.normalize();
  }
  function bodyWeight(body, r, normal, scratch) {
    const rn=scratch.c.crossVectors(r,normal);
    return 1/body.mass+rn.dot(applyInverseInertia(body,rn,scratch.d,scratch));
  }
  function pushBody(body, r, impulse, scratch) {
    body.position.addScaledVector(impulse, 1/body.mass);
    rotateBody(body.quaternion, applyInverseInertia(body,scratch.e.crossVectors(r,impulse),scratch.f,scratch));
  }

  function solveSegment(sim, i, h, physics, scratch) {
    const {nodes,body}=sim;
    const a=nodes[i], wa=i===0?0:NODE_WEIGHT, last=i===JOINTS-1;
    const r=scratch.g;
    let b=nodes[i+1];
    if(last){r.copy(body.hang).applyQuaternion(body.quaternion);b=scratch.b.copy(body.position).add(r);}
    const delta=scratch.a.subVectors(b,a); const length=delta.length();
    const stretch=length-sim.rest;
    if(stretch<=0||length<1e-9)return;
    const normal=delta.divideScalar(length);
    const wb=last?bodyWeight(body,r,normal,scratch):NODE_WEIGHT;
    const rate=(length-sim.lengths[i])/h;
    const tension=physics.hold*Math.tanh((physics.stiffness*stretch)/physics.hold)+physics.spring*stretch+physics.bandDamping*Math.max(0,rate);
    const room=tension*h*h-sim.impulses[i];
    if(room<=0)return;
    const lambda=Math.min(stretch/(wa+wb),room);
    sim.impulses[i]+=lambda;
    if(wa)a.addScaledVector(normal,lambda*wa);
    if(last)pushBody(body,r,normal.multiplyScalar(-lambda),scratch);
    else b.addScaledVector(normal,-lambda*wb);
  }

  function solvePin(body, grab, target, scratch) {
    const r=scratch.g.copy(grab.local).applyQuaternion(body.quaternion);
    const delta=scratch.a.copy(target).sub(body.position).sub(r);
    const distance=delta.length();
    if(distance<1e-9)return;
    const normal=delta.divideScalar(distance);
    const lambda=distance/bodyWeight(body,r,normal,scratch);
    pushBody(body,r,normal.multiplyScalar(lambda),scratch);
  }

  function placeHanging(sim, layout, intro, T) {
    const {nodes,previous,velocities,body,anchor}=sim;
    nodes[0].copy(anchor);
    for(let i=1;i<=JOINTS;i++){nodes[i].copy(nodes[i-1]);if(intro)nodes[i].x+=sim.rest;else nodes[i].y-=sim.rest;}
    body.quaternion.identity();
    if(intro)body.quaternion.setFromAxisAngle(new T.Vector3(0,0,1),Math.PI/2);
    body.hang.set(0,layout.hangY,0);
    const offset=new T.Vector3().copy(body.hang).applyQuaternion(body.quaternion);
    body.position.copy(nodes[JOINTS]).sub(offset);
    body.previous.copy(body.position); body.previousQuaternion.copy(body.quaternion);
    body.velocity.set(0,0,0); body.angular.set(0,0,0);
    for(let i=0;i<=JOINTS;i++){previous[i].copy(nodes[i]);velocities[i].set(0,0,0);}
    sim.lengths.fill(sim.rest); sim.turn=0; sim.twist=0; sim.twistRaw=0; sim.calm=0;
  }

  function configureSimulation(sim, layout) {
    const{width,height}=layout, t=THICKNESS+BEVEL*2;
    sim.body.mass=1;
    sim.body.inverseInertia.set(12/(height*height+t*t),12/(width*width+t*t),12/(width*width+height*height));
    sim.body.hang.set(0,layout.hangY,0);
  }

  function stepSimulation(sim, dt, physics, time, scratch) {
    const steps=Math.max(1,Math.ceil(dt/MAX_STEP-1e-6)), h=dt/steps;
    const{nodes,previous,velocities,body}=sim;
    const windX=physics.breeze*(Math.sin(time*.53)*.7+Math.sin(time*1.31+1.7)*.3)*3;
    const windZ=physics.breeze*Math.sin(time*.37+.6)*2;
    const grab=sim.grab, pin=scratch.pin;
    const nodeDrag=Math.exp(-physics.nodeDrag*h);
    const linearDrag=Math.exp(-physics.linearDrag*h);
    const angularDrag=Math.exp(-physics.angularDrag*h);
    for(let s=0;s<steps;s++){
      for(let i=1;i<JOINTS;i++){const v=velocities[i];v.y-=physics.gravity*h;v.x+=windX*h;v.z+=windZ*h;previous[i].copy(nodes[i]);nodes[i].addScaledVector(v,h);}
      body.previous.copy(body.position); body.previousQuaternion.copy(body.quaternion);
      const q=body.quaternion;
      if(grab){
        const turn=scratch.q.copy(grab.rotation).multiply(scratch.r.copy(q).invert());
        if(turn.w<0)turn.set(-turn.x,-turn.y,-turn.z,-turn.w);
        const torque=scratch.a.set(turn.x,turn.y,turn.z).multiplyScalar(2*physics.grip);
        torque.addScaledVector(body.angular,-physics.gripDamping);
        body.angular.addScaledVector(applyInverseInertia(body,torque,scratch.b,scratch),h);
      }
      const up=scratch.a.set(0,1,0).applyQuaternion(q);
      const front=scratch.b.set(-up.x*up.z,-up.y*up.z,1-up.z*up.z);
      if(front.lengthSq()>1e-3){
        const facing=scratch.d.set(0,0,1).applyQuaternion(q);
        const raw=Math.atan2(scratch.e.crossVectors(front,facing).dot(up),front.dot(facing));
        let turned=raw-sim.twistRaw;
        if(turned>Math.PI)turned-=Math.PI*2;else if(turned<-Math.PI)turned+=Math.PI*2;
        sim.twist+=turned; sim.twistRaw=raw;
      }
      if(!grab){const spin=body.angular.dot(up);body.angular.addScaledVector(up,(physics.twist*(sim.turn-sim.twist)-physics.twistDamping*spin)*h);}
      body.velocity.y-=physics.gravity*h; body.velocity.x+=windX*.35*h; body.velocity.z+=windZ*.35*h;
      body.position.addScaledVector(body.velocity,h);
      rotateBody(body.quaternion,scratch.f.copy(body.angular).multiplyScalar(h));
      sim.impulses.fill(0);
      if(grab)pin.lerpVectors(grab.from,grab.target,(s+1)/steps);
      for(let iteration=0;iteration<ITERATIONS;iteration++){for(let i=0;i<JOINTS;i++)solveSegment(sim,i,h,physics,scratch);if(grab)solvePin(body,grab,pin,scratch);}
      for(let i=1;i<JOINTS;i++){const v=velocities[i].subVectors(nodes[i],previous[i]).divideScalar(h).multiplyScalar(nodeDrag);v.multiplyScalar(1/(1+physics.nodeAir*v.length()*h));}
      body.velocity.subVectors(body.position,body.previous).divideScalar(h);
      const dq=scratch.q.copy(body.previousQuaternion).invert().premultiply(body.quaternion);
      body.angular.set(dq.x,dq.y,dq.z).multiplyScalar((2/h)*(dq.w<0?-1:1));
      const normal=scratch.a.set(0,0,1).applyQuaternion(body.quaternion);
      const across=body.velocity.dot(normal);
      const along=scratch.b.copy(body.velocity).addScaledVector(normal,-across);
      along.multiplyScalar(1/(1+physics.air*along.length()*h));
      body.velocity.copy(along).addScaledVector(normal,across/(1+physics.broadside*Math.abs(across)*h)).multiplyScalar(linearDrag);
      body.angular.multiplyScalar(angularDrag/(1+physics.spinAir*body.angular.length()*h));
      if(body.velocity.lengthSq()>3600)body.velocity.setLength(60);
      if(body.angular.lengthSq()>1600)body.angular.setLength(40);
      nodes[JOINTS].copy(body.hang).applyQuaternion(body.quaternion).add(body.position);
      for(let i=0;i<JOINTS;i++)sim.lengths[i]=nodes[i].distanceTo(nodes[i+1]);
    }
    if(grab)grab.from.copy(grab.target);
    let energy=body.velocity.lengthSq()+body.angular.lengthSq()*.3;
    for(let i=1;i<JOINTS;i++)energy+=velocities[i].lengthSq()*.05;
    sim.calm=energy<2e-4?sim.calm+dt:0;
  }

  /**
   * initLanyard(container, options) → { update(opts), destroy() }
   *
   * @param {HTMLElement} container  Sized container div (width + height required)
   * @param {object}      opts       Same props as the React Lanyard component
   */
  function initLanyard(container, opts) {
    const T = global.THREE;
    if (!T) { console.warn('Lanyard: THREE not found'); return null; }

    let settings = Object.assign({
      frontImage: null, backImage: null, imageFit: 'cover',
      cardColor: '#ffffff', orientation: 'portrait', finish: 'glossy',
      cornerRadius: 0.3, size: 0.6, anchor: 'center',
      strapLength: 0.5, strapImage: null, strapColor: '#111111',
      strapWidth: 0.65, metal: 'silver',
      gravity: 1, damping: 0.5, elasticity: 0.5, breeze: 0.5,
      interactive: true, intro: true,
    }, opts || {});

    let renderer;
    try {
      renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch { return null; }
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.NeutralToneMapping;
    renderer.toneMappingExposure = 1;
    const canvas = renderer.domElement;
    canvas.className = 'lanyard-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    container.appendChild(canvas);

    const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const scene = new T.Scene();
    const environment = buildEnvironment(renderer, T);
    scene.environment = environment.texture;
    const camera = new T.PerspectiveCamera(FOV, 1, 0.1, 200);
    const keyLight = new T.DirectionalLight(0xffffff, 1.6); keyLight.position.set(-2.5,4,6);
    const fillLight = new T.DirectionalLight(0xffffff, 0.35); fillLight.position.set(3,-1,4);
    scene.add(keyLight, fillLight);

    const imageCache = new Map();
    const images = { front: null, back: null, strap: null };
    const frontCanvas = document.createElement('canvas');
    const backCanvas  = document.createElement('canvas');
    const strapCanvas = document.createElement('canvas');

    const makeCanvasTex = (cvs) => {
      const tex = new T.CanvasTexture(cvs);
      tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = anisotropy; return tex;
    };
    const frontTexture = makeCanvasTex(frontCanvas);
    const backTexture  = makeCanvasTex(backCanvas);
    const strapTexture = makeCanvasTex(strapCanvas);
    strapTexture.wrapS = T.ClampToEdgeWrapping; strapTexture.wrapT = T.RepeatWrapping;
    const grain = buildGrainTexture(T);
    const weave = buildWeaveTexture(T);

    const foilUniforms = {
      foilStrength: {value:0}, foilAspect:{value:1.4},
      foilKey:{value:new T.Vector3()}, foilFill:{value:new T.Vector3()}, foilTop:{value:new T.Vector3()}
    };
    const injectFoil = shader => {
      Object.assign(shader.uniforms, foilUniforms);
      shader.vertexShader   = shader.vertexShader.replace('#include <common>',`#include <common>\n${FOIL_VERTEX_HEAD}`).replace('#include <project_vertex>',`#include <project_vertex>\n${FOIL_VERTEX_BODY}`);
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>',`#include <common>\n${FOIL_FRAGMENT_HEAD}`).replace('#include <opaque_fragment>',`${FOIL_FRAGMENT_BODY}\n#include <opaque_fragment>`);
    };

    const frontMaterial = new T.MeshPhysicalMaterial({ map: frontTexture, normalMap: grain, normalScale: new T.Vector2(0.06, 0.06) });
    const backMaterial  = new T.MeshPhysicalMaterial({ map: backTexture,  normalMap: grain, normalScale: new T.Vector2(0.06, 0.06) });
    frontMaterial.onBeforeCompile = injectFoil; backMaterial.onBeforeCompile = injectFoil;
    const edgeMaterial  = new T.MeshPhysicalMaterial();
    const metalMaterial = new T.MeshStandardMaterial({ metalness: 1 });
    const bandMaterial  = new T.MeshPhysicalMaterial({ map: strapTexture, normalMap: weave, normalScale: new T.Vector2(0.7,0.7), roughness: 0.68, sheen: 1, sheenRoughness: 0.42, sheenColor: new T.Color(0.32,0.32,0.34), side: T.DoubleSide });

    const cardGroup = new T.Group();
    const bodyMesh  = new T.Mesh(undefined, edgeMaterial);
    const frontMesh = new T.Mesh(undefined, frontMaterial);
    const backMesh  = new T.Mesh(undefined, backMaterial);
    const ring = new T.Mesh(new T.TorusGeometry(RING_RADIUS, RING_TUBE, 18, 72), metalMaterial);
    ring.rotation.y = Math.PI/2 - 0.7;
    cardGroup.add(bodyMesh, frontMesh, backMesh, ring);
    scene.add(cardGroup);

    const bandGeometry = buildBandGeometry(SAMPLES, T);
    const band = new T.Mesh(bandGeometry, bandMaterial);
    band.frustumCulled = false; scene.add(band);

    const clampGroup = new T.Group();
    const buildClampGeo = w => {
      const shape = new T.Shape(); const cw = w*1.16;
      traceRoundedRect(shape,-cw/2+.014,-CLAMP_BODY/2+.014,cw-.028,CLAMP_BODY-.028,.024);
      const geo = new T.ExtrudeGeometry(shape,{depth:.02,bevelEnabled:true,bevelThickness:.014,bevelSize:.014,bevelSegments:6,curveSegments:10});
      geo.translate(0,0,-.01); return geo;
    };
    const clampMesh = new T.Mesh(buildClampGeo(STRAP_WIDTH), metalMaterial);
    clampMesh.position.y = EYELET_RADIUS + CLAMP_BODY/2 - .004;
    const eyelet = new T.Mesh(new T.TorusGeometry(EYELET_RADIUS, .0105, 14, 40), metalMaterial);
    clampGroup.add(clampMesh, eyelet); scene.add(clampGroup);

    const sim = createSimulation(T);
    const scratch = makeScratch(T);
    const controls = [], mouth = new T.Vector3(), tuck = new T.Vector3();
    const curve = new T.CatmullRomCurve3(controls, false, 'centripetal');
    const view = { width:1, height:1 };
    let layout = cardLayout('portrait', 0.3);
    let applied = {}, strapScale = STRAP_WIDTH, tileRatio = 2;
    let raf = 0, last = performance.now(), time = 0, visible = true, alive = true, placed = false;
    let hovering = false, press = null, imageToken = 0;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    const drawFitted = (ctx, image, w, h, fit) => {
      const scale=(fit==='contain'?Math.min:Math.max)(w/image.width,h/image.height);
      ctx.drawImage(image,(w-image.width*scale)/2,(h-image.height*scale)/2,image.width*scale,image.height*scale);
    };
    const paintFace = (cvs, image, color, fit) => {
      const ctx=cvs.getContext('2d');
      ctx.fillStyle=toCss(color); ctx.fillRect(0,0,cvs.width,cvs.height);
      if(image)drawFitted(ctx,image,cvs.width,cvs.height,fit);
    };
    const paintStrap = (cvs, image, color) => {
      const across=192, along=image?Math.max(64,Math.round((image.width/image.height)*across)):across*2;
      cvs.width=across; cvs.height=along;
      const ctx=cvs.getContext('2d');
      ctx.fillStyle=toCss(color); ctx.fillRect(0,0,across,along);
      if(image){ctx.save();ctx.translate(across,0);ctx.rotate(Math.PI/2);ctx.drawImage(image,0,0,along,across);ctx.restore();return along/across;}
      const ink=luminance(color)>.5?[0,0,0]:[1,1,1];
      ctx.fillStyle=toCss(ink,.05); for(let y=0;y<along;y+=4)ctx.fillRect(0,y,across,1);
      ctx.fillStyle=toCss(ink,.2); for(let y=0;y<along;y+=14){ctx.fillRect(across*.075,y,2,8);ctx.fillRect(across*.925-2,y,2,8);}
      return along/across;
    };

    const paintFaces = () => {
      const s=settings, color=parseColor(s.cardColor,[1,1,1]);
      const w=FACE_WIDTH, h=Math.round(FACE_WIDTH*layout.height/layout.width);
      if(frontCanvas.width!==w||frontCanvas.height!==h){frontCanvas.width=w;frontCanvas.height=h;backCanvas.width=w;backCanvas.height=h;frontTexture.dispose();backTexture.dispose();}
      paintFace(frontCanvas,images.front,color,s.imageFit);
      paintFace(backCanvas,images.back||images.front,color,s.imageFit);
      frontTexture.needsUpdate=true; backTexture.needsUpdate=true; start();
    };
    const repaintStrap = () => {
      const s=settings;
      tileRatio=paintStrap(strapCanvas,images.strap,parseColor(s.strapColor,[.07,.07,.07]));
      weave.repeat.set(2,2*tileRatio); strapTexture.dispose(); strapTexture.needsUpdate=true; start();
    };
    const frameView = () => {
      const s=settings, aspect=view.width/view.height;
      let viewHeight=layout.height/clamp(s.size,.15,.9);
      const minWidth=layout.width/.72;
      if(viewHeight*aspect<minWidth)viewHeight=minWidth/aspect;
      camera.aspect=aspect;
      camera.position.set(0,0,viewHeight/2/Math.tan(FOV*Math.PI/360));
      camera.lookAt(0,0,0); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
      foilUniforms.foilKey.value.set(-2.5,4,6).normalize().transformDirection(camera.matrixWorldInverse);
      foilUniforms.foilFill.value.set(3,-1,4).normalize().transformDirection(camera.matrixWorldInverse);
      foilUniforms.foilTop.value.set(.5,4.5,8).normalize().transformDirection(camera.matrixWorldInverse);
      const anchorX=((ANCHORS[s.anchor]??0.5)-.5)*(viewHeight*aspect);
      const anchorY=viewHeight/2+.2;
      const cardTop=viewHeight/2-viewHeight*mix(.12,.42,clamp(s.strapLength,0,1));
      const hangTop=cardTop+(layout.hangY-layout.height/2);
      sim.anchor.set(anchorX,anchorY,0);
      sim.rest=(anchorY-hangTop)/JOINTS;
      configureSimulation(sim,layout);
      sim.nodes[0].copy(sim.anchor); sim.previous[0].copy(sim.anchor);
    };

    const apply = () => {
      const s=settings;
      const layoutKey=`${s.orientation}|${s.cornerRadius}`;
      if(layoutKey!==applied.layoutKey){
        layout=cardLayout(s.orientation,s.cornerRadius);
        const geo=buildCardGeometry(layout,T);
        if(bodyMesh.geometry)bodyMesh.geometry.dispose(); if(frontMesh.geometry)frontMesh.geometry.dispose(); if(backMesh.geometry)backMesh.geometry.dispose();
        bodyMesh.geometry=geo.body; frontMesh.geometry=geo.face; backMesh.geometry=geo.face.clone();
        frontMesh.position.z=THICKNESS/2+BEVEL+.0006; backMesh.rotation.y=Math.PI; backMesh.position.z=-(THICKNESS/2+BEVEL+.0006);
        ring.position.set(0,layout.ringY,0); applied.framingKey='';
      }
      const framingKey=`${layoutKey}|${s.size}|${s.anchor}|${s.strapLength}|${view.width}|${view.height}`;
      if(framingKey!==applied.framingKey){
        frameView();
        if(!placed){placeHanging(sim,layout,s.intro&&!reducedMotion,T);placed=true;}
        else if(layoutKey!==applied.layoutKey){placeHanging(sim,layout,false,T);}
      }
      const imageKey=`${s.frontImage}|${s.backImage}|${s.strapImage}`;
      if(imageKey!==applied.imageKey){
        const token=++imageToken;
        Promise.all([loadImage(imageCache,s.frontImage),loadImage(imageCache,s.backImage),loadImage(imageCache,s.strapImage)])
          .then(([front,back,strap])=>{if(!alive||token!==imageToken)return;images.front=front;images.back=back;images.strap=strap;paintFaces();repaintStrap();});
      }
      const faceKey=`${layoutKey}|${s.cardColor}|${s.imageFit}`;
      if(faceKey!==applied.faceKey)paintFaces();
      if(s.strapColor!==applied.strapColor)repaintStrap();
      const finish=FINISHES[s.finish]||FINISHES.glossy;
      const card=parseColor(s.cardColor,[1,1,1]);
      [frontMaterial,backMaterial].forEach(mat=>{mat.roughness=finish.roughness;mat.metalness=finish.metalness;mat.clearcoat=finish.clearcoat;mat.clearcoatRoughness=finish.clearcoatRoughness;mat.anisotropy=finish.anisotropy;});
      foilUniforms.foilStrength.value=finish.foil; foilUniforms.foilAspect.value=layout.height/layout.width;
      edgeMaterial.color.setRGB(card[0]*.92,card[1]*.92,card[2]*.92,T.SRGBColorSpace);
      edgeMaterial.roughness=Math.min(finish.roughness,.35); edgeMaterial.metalness=finish.metalness; edgeMaterial.clearcoat=1; edgeMaterial.clearcoatRoughness=.08;
      const metalLook=METALS[s.metal]||METALS.silver; metalMaterial.color.set(metalLook.color); metalMaterial.roughness=metalLook.roughness;
      strapScale=STRAP_WIDTH*clamp(s.strapWidth,.4,2);
      if(strapScale!==applied.strapScale){clampMesh.geometry.dispose();clampMesh.geometry=buildClampGeo(strapScale);}
      canvas.style.touchAction=s.interactive?'pan-y':'auto';
      applied={layoutKey,framingKey,imageKey,faceKey,strapColor:s.strapColor,strapScale}; start();
    };

    const points=Array.from({length:SAMPLES},()=>new T.Vector3());
    const sides=Array.from({length:SAMPLES},()=>new T.Vector3());
    const bends=BAND_BEND.map(a=>[Math.cos(a),Math.sin(a)]);
    const work={tangent:new T.Vector3(),toCamera:new T.Vector3(),basis:new T.Matrix4(),up:new T.Vector3(),across:new T.Vector3(),facing:new T.Vector3(),end:new T.Vector3()};

    const updateBand=()=>{
      const hang=sim.nodes[JOINTS], reach=EYELET_RADIUS+CLAMP_BODY+.05;
      let guide=JOINTS-1;
      while(guide>0&&sim.nodes[guide].distanceTo(hang)<reach*1.1)guide--;
      const axis=work.up.subVectors(sim.nodes[guide],hang);
      if(axis.lengthSq()<1e-8)axis.set(0,1,0).applyQuaternion(sim.body.quaternion);
      axis.normalize();
      mouth.copy(hang).addScaledVector(axis,reach); tuck.copy(hang).addScaledVector(axis,EYELET_RADIUS+CLAMP_BODY*.35);
      controls.length=0; for(let i=0;i<=guide;i++)controls.push(sim.nodes[i]); controls.push(mouth,tuck);
      curve.updateArcLengths();
      for(let i=0;i<SAMPLES;i++)curve.getPointAt(i/(SAMPLES-1),points[i]);
      const length=curve.getLength(), held=1-mouth.distanceTo(tuck)/Math.max(length,.001);
      const pos=bandGeometry.getAttribute('position'), norm=bandGeometry.getAttribute('normal'), uv=bandGeometry.getAttribute('uv');
      const columns=BAND_COLUMNS.length, restLength=sim.rest*JOINTS, repeats=restLength/(strapScale*tileRatio);
      const width=strapScale/Math.pow(Math.max(1,length/Math.max(restLength,.001)),.35);
      const{tangent,toCamera,across,facing}=work;
      for(let i=0;i<SAMPLES;i++){
        tangent.subVectors(points[Math.min(SAMPLES-1,i+1)],points[Math.max(0,i-1)]);
        if(tangent.lengthSq()<1e-12)tangent.set(0,-1,0); tangent.normalize();
        toCamera.subVectors(camera.position,points[i]).normalize();
        const side=sides[i].crossVectors(toCamera,tangent);
        if(side.lengthSq()<1e-10)side.copy(i>0?sides[i-1]:scratch.a.set(1,0,0)); side.normalize();
        if(i>0&&side.dot(sides[i-1])<0)side.negate();
        const angle=-sim.twist*Math.pow(Math.min(1,(i/(SAMPLES-1))/held),1.3);
        facing.crossVectors(tangent,side);
        across.copy(side).multiplyScalar(Math.cos(angle)).addScaledVector(facing,Math.sin(angle));
        facing.crossVectors(tangent,across);
        const p=points[i], v=(1-i/(SAMPLES-1))*repeats;
        for(let c=0;c<columns;c++){
          const k=i*columns+c, offset=(BAND_COLUMNS[c]-.5)*width;
          const[bendCos,bendSin]=bends[c];
          pos.setXYZ(k,p.x+across.x*offset,p.y+across.y*offset,p.z+across.z*offset);
          norm.setXYZ(k,facing.x*bendCos+across.x*bendSin,facing.y*bendCos+across.y*bendSin,facing.z*bendCos+across.z*bendSin);
          uv.setXY(k,BAND_COLUMNS[c],v);
        }
      }
      work.end.copy(across);
      pos.needsUpdate=true; norm.needsUpdate=true; uv.needsUpdate=true;
      across.copy(work.end).addScaledVector(axis,-work.end.dot(axis)).normalize();
      facing.crossVectors(across,axis).normalize();
      work.basis.makeBasis(across,axis,facing);
      clampGroup.quaternion.setFromRotationMatrix(work.basis); clampGroup.position.copy(hang);
    };

    const getPhysics=()=>{
      const s=settings;
      const gravity=40*clamp(s.gravity,0,3), weight=Math.max(gravity,20);
      const springy=clamp(s.elasticity,0,1), settle=clamp(s.damping,0,1);
      return{gravity,hold:weight*mix(2.2,5.5,springy),stiffness:weight*10*JOINTS,spring:weight*mix(.1,.4,springy)*JOINTS,bandDamping:weight*mix(.3,.08,springy)*JOINTS,linearDrag:.25*Math.pow(16,settle),angularDrag:.5*Math.pow(12,settle),air:.15,broadside:.5,spinAir:.03,nodeDrag:2,nodeAir:.2,twist:30,twistDamping:3,grip:40,gripDamping:6,breeze:reducedMotion?0:clamp(s.breeze,0,1)};
    };

    const renderFrame=()=>{
      cardGroup.position.copy(sim.body.position); cardGroup.quaternion.copy(sim.body.quaternion);
      updateBand(); renderer.render(scene,camera);
    };

    const tick=now=>{
      raf=0; if(!alive)return;
      const dt=Math.min(1/30,Math.max(1/240,(now-last)/1000)); last=now; time+=dt;
      const physics=getPhysics();
      stepSimulation(sim,dt,physics,time,scratch);
      if(!Number.isFinite(sim.body.position.x+sim.body.position.y+sim.body.position.z+sim.body.quaternion.w)){sim.grab=null;placeHanging(sim,layout,false,T);}
      renderFrame();
      const resting=sim.calm>1.2&&!sim.grab&&physics.breeze===0;
      if(visible&&!resting)raf=requestAnimationFrame(tick);
    };

    const start=()=>{if(raf||!visible||!alive)return;sim.calm=0;last=performance.now();raf=requestAnimationFrame(tick);};

    /* Interaction */
    const raycaster=new T.Raycaster(), pointer=new T.Vector2();
    const toPointer=e=>{
      const rect=canvas.getBoundingClientRect();
      pointer.set(((e.clientX-rect.left)/rect.width)*2-1,-((e.clientY-rect.top)/rect.height)*2+1);
      raycaster.setFromCamera(pointer,camera);
    };
    const pickCard=()=>{
      cardGroup.updateMatrixWorld();
      return raycaster.intersectObjects([bodyMesh,frontMesh,backMesh],false)[0]||null;
    };
    const setCursor=v=>{if(canvas.style.cursor!==v)canvas.style.cursor=v;};
    const flip=point=>{
      const body=sim.body, up=scratch.a.set(0,1,0).applyQuaternion(body.quaternion);
      let dir=sim.turn>0?-1:1;
      if(sim.turn===0){const away=scratch.c.subVectors(point,camera.position).normalize();dir=scratch.b.subVectors(point,body.position).cross(away).dot(up)<0?-1:1;}
      sim.turn=sim.turn===0?Math.PI*dir:0; body.angular.addScaledVector(up,FLIP_SPIN*dir);
    };
    const onPtrDown=e=>{if(!settings.interactive||e.button>0)return;toPointer(e);const hit=pickCard();if(!hit)return;sim.grab={local:hit.point.clone().sub(sim.body.position).applyQuaternion(sim.body.quaternion.clone().invert()),rotation:sim.body.quaternion.clone(),reach:hit.distance,from:hit.point.clone(),target:hit.point.clone()};press={x:e.clientX,y:e.clientY,time:performance.now(),point:hit.point.clone()};canvas.setPointerCapture?.(e.pointerId);setCursor('grabbing');e.preventDefault();start();};
    const onPtrMove=e=>{if(!settings.interactive)return;toPointer(e);if(sim.grab){if(press&&Math.hypot(e.clientX-press.x,e.clientY-press.y)>6)press=null;raycaster.ray.at(sim.grab.reach,sim.grab.target);start();return;}if(e.pointerType==='touch')return;hovering=!!pickCard();setCursor(hovering?'grab':'');};
    const onPtrUp=e=>{if(!sim.grab)return;sim.grab=null;if(press&&e.type==='pointerup'&&performance.now()-press.time<450)flip(press.point);press=null;canvas.releasePointerCapture?.(e.pointerId);setCursor(hovering&&e.pointerType!=='touch'?'grab':'');start();};
    const onTouchStart=e=>{if(!settings.interactive||e.touches.length!==1)return;toPointer(e.touches[0]);if(pickCard())e.preventDefault();};
    canvas.addEventListener('pointerdown',onPtrDown);
    canvas.addEventListener('pointermove',onPtrMove);
    canvas.addEventListener('pointerup',onPtrUp);
    canvas.addEventListener('pointercancel',onPtrUp);
    canvas.addEventListener('lostpointercapture',onPtrUp);
    canvas.addEventListener('touchstart',onTouchStart,{passive:false});

    const resize=()=>{
      view.width=Math.max(1,container.clientWidth); view.height=Math.max(1,container.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
      renderer.setSize(view.width,view.height,false); apply(); renderFrame();
    };
    const ro=new ResizeObserver(resize); ro.observe(container);
    const io=new IntersectionObserver(([e])=>{visible=e.isIntersecting;if(visible)start();}); io.observe(container);
    const onVis=()=>{if(!document.hidden)start();}; document.addEventListener('visibilitychange',onVis);
    resize();

    return {
      update(newOpts) { Object.assign(settings, newOpts); apply(); },
      destroy() {
        alive=false; cancelAnimationFrame(raf);
        ro.disconnect(); io.disconnect(); document.removeEventListener('visibilitychange',onVis);
        canvas.removeEventListener('pointerdown',onPtrDown); canvas.removeEventListener('pointermove',onPtrMove);
        canvas.removeEventListener('pointerup',onPtrUp); canvas.removeEventListener('pointercancel',onPtrUp);
        canvas.removeEventListener('lostpointercapture',onPtrUp); canvas.removeEventListener('touchstart',onTouchStart);
        [bodyMesh,frontMesh,backMesh,ring,clampMesh,eyelet,band].forEach(m=>m.geometry?.dispose());
        [frontMaterial,backMaterial,edgeMaterial,metalMaterial,bandMaterial].forEach(m=>m.dispose());
        [frontTexture,backTexture,strapTexture,grain,weave].forEach(t=>t.dispose());
        environment.dispose(); renderer.dispose(); canvas.remove();
      }
    };
  }

  global.initLanyard = initLanyard;
})(window);
