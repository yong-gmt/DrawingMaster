/* ============================================================================
   §7  DIMENSION MODEL  —  Dimension-Design.md §4
   ----------------------------------------------------------------------------
   A dimension stops being "a pile of loose lines everybody has to guess at" and
   becomes ONE object that knows its own anatomy:

       measure  the two points actually being measured (the value comes from here)
       ext      extension lines: gap from the part, overshoot past the dim line
       line     dimension line: where it sits, its stubs, its arrow caps
       text     the value, positioned in the dimension's OWN frame (t along the
                line, dq across it) so it rides along whenever the line moves

   Every visible line is COMPUTED by dimGeomOf() and projected into the drawing's
   primitives. Nothing bends raw lines any more, so dragging, STYLIZE and snapping
   can no longer fight over the same geometry, and pressing STYLIZE twice cannot
   accumulate drift - it is a setting, not a nudge.

   Where the numbers come from: the DXF DIMENSION entity carries its own definition
   points (groups 13/14 = what is measured, group 10 = where the dimension line
   sits). That is the file stating the facts, instead of us picking "the longest
   segment" - the guess that kept choosing an extension line, because extension
   lines really are usually the longer ones.
   ========================================================================== */
const DIM_LW=0.5;
/* Gap between a dimension line and the value, measured to the nearest INK of the
   glyphs - not to the text baseline, which is invisible. Measuring to the anchor
   was the mistake that made "0.000 mm off centre" look like a pass while the eye
   still saw the text sitting crooked. */
const DIM_TXT_GAP_PX=4;
/* Cap height of the digits, asked of the font itself rather than assumed. */
function dimCapHeight(h, str){
  try{
    const c=dimCapHeight._c || (dimCapHeight._c=document.createElement('canvas').getContext('2d'));
    c.font='100px '+((typeof store!=='undefined'&&store.format&&store.format.font)||'Arial')+',Arial';
    // Measure THIS value, not a generic sample: "R24.00" and "\u230012" do not
    // reach the same height, and the gap has to be right for the string on screen.
    const a=c.measureText(String(str==null?'0123456789':str)).actualBoundingBoxAscent;
    if(a>0) return h*a/100;
  }catch(e){}
  return h*0.72;
}
/* Both edges of the real ink. Digits overshoot the baseline slightly, so a value
   placed by its baseline alone still ends up a hair closer to the line than asked. */
function dimInk(h, str){
  try{
    const c=dimCapHeight._c || (dimCapHeight._c=document.createElement('canvas').getContext('2d'));
    c.font='100px '+((typeof store!=='undefined'&&store.format&&store.format.font)||'Arial')+',Arial';
    const m=c.measureText(String(str==null?'0':str));
    if(m.actualBoundingBoxAscent>0)
      return {asc:h*m.actualBoundingBoxAscent/100, desc:h*Math.max(0,m.actualBoundingBoxDescent)/100};
  }catch(e){}
  return {asc:h*0.72, desc:0};
}
function dimTextWidth(str,h){
  try{
    const c=dimCapHeight._c || (dimCapHeight._c=document.createElement('canvas').getContext('2d'));
    c.font='100px '+((typeof store!=='undefined'&&store.format&&store.format.font)||'Arial')+',Arial';
    return c.measureText(String(str||'')).width*h/100;
  }catch(e){ return String(str||'').length*h*0.6; }
}
function dimPxPerMM(){ return (typeof PX_PER_MM!=='undefined')? PX_PER_MM : 96/25.4; }
/* Where the value goes: centred along its dimension line, and pushed across it by
   exactly the wanted gap. Both are computed here, every time, so they cannot drift. */
function dimTextPlace(m, q, n){
  const str=dimValueText(m);
  const ink=dimInk(m.text.h||2.5, str);
  const rr=(m.text.rot||0)*Math.PI/180;
  const up=[-Math.sin(rr), Math.cos(rr)];        // the way the glyphs grow
  const s=(m.text.side>=0)?1:-1;
  const grows=(up[0]*n[0]*s + up[1]*n[1]*s)>0;   // away from the line, or towards it?
  const gap=(m.text.gapPx==null?DIM_TXT_GAP_PX:m.text.gapPx)/dimPxPerMM();
  // Push out by whichever ink edge faces the line, so the CLEAR space is the gap.
  return {dq:s*(gap + (grows? ink.desc : ink.asc)), capH:ink.asc, grows, side:s, gap};
}
/* Along the line: the middle of the dimension line, or - when the gap is too narrow
   and the standard puts a jog outside - the middle of that jog. */
function dimTextSize(m){
  return dimTextWidth(dimValueText(m), m.text.h||2.5);
}
/* Where the value belongs when nobody has dragged it. This is decided by ROOM,
   not by the form the dimension is currently in - otherwise a dimension that was
   jogged outside would keep measuring "home" against its own jog and could never
   come back in, which is exactly the bug this replaces. */
function dimTextHome(m){
  const S=dimSpanOf(m), w=dimTextSize(m);
  const gapMM=(m.text.gapPx==null?DIM_TXT_GAP_PX:m.text.gapPx)/dimPxPerMM();
  if((S.tB-S.tA) >= w + 2*m.line.arrow) return (S.tA+S.tB)/2;   // it fits between them
  const side=(m.text.outSide>=0)?1:-1;                          // else just outside
  return side>0 ? S.tB+gapMM+w/2 : S.tA-gapMM-w/2;
}
function dimTextCentre(m){ return dimTextHome(m); }                    /* thinner than an object line (0.3 vs 0.6mm) */
function dimDot(p,v){ return p[0]*v[0]+p[1]*v[1]; }
function dimAt(m,t,q){ const u=m.dir, n=[-u[1],u[0]]; return [u[0]*t+n[0]*q, u[1]*t+n[1]*q]; }
function dimSpanOf(m){
  const u=m.dir, n=[-u[1],u[0]];
  const t1=dimDot(m.measure.p1,u), t2=dimDot(m.measure.p2,u);
  return { t1, t2, q1:dimDot(m.measure.p1,n), q2:dimDot(m.measure.p2,n),
           tA:Math.min(t1,t2), tB:Math.max(t1,t2) };
}
/* Measure a real arrowhead: the tip is the corner farthest from the other two,
   the base between them gives the width. Keeps the file's own 3:1 proportions
   instead of inventing a triangle. */
function dimArrowShape(sd){
  const p=[]; (sd||[]).forEach(q=>{ if(!p.some(r=>Math.hypot(r[0]-q[0],r[1]-q[1])<1e-6)) p.push(q); });
  if(p.length<3) return null;
  let best=null;
  for(let i=0;i<3;i++){
    const a=p[(i+1)%3], b=p[(i+2)%3];
    const mid=[(a[0]+b[0])/2,(a[1]+b[1])/2];
    const len=Math.hypot(p[i][0]-mid[0], p[i][1]-mid[1]);
    if(!best||len>best.len) best={len, wid:Math.hypot(a[0]-b[0],a[1]-b[1])};
  }
  return best;
}
/* The number a dimension shows. It is MEASURED from the geometry and FORMATTED to
   the decimals set in Format Config - the drawing's own string is kept only for
   what it adds around the number ("2x", a diameter sign, a note), never for the
   number itself, which would freeze it at whatever the source file happened to
   print. */
function dimDecimals(){
  try{ const d=store.format.decimals; if(d!=null) return Math.max(0,Math.min(6,d|0)); }catch(e){}
  return 2;
}
function dimMeasuredValue(m){
  if(m.kind==='radial') return m.radius;
  if(m.kind==='diameter') return m.radius*2;
  return dimValueOf(m);
}
function dimValueText(m){
  const num=dimMeasuredValue(m).toFixed(dimDecimals());
  if(m.text.prefix!=null || m.text.suffix!=null)
    return (m.text.prefix||'')+num+(m.text.suffix||'');
  if(m.text.override!=null) return m.text.override;   /* a note we could not read */
  return num;
}
/* Split the drawing's own string around the number it states, so the wrapper is
   kept and the number stays free to be re-measured and re-formatted. */
function dimSplitValue(m, str){
  const s=String(str==null?'':str);
  const val=dimMeasuredValue(m);
  const nums=s.match(/\d+(?:[.,]\d+)?/g);
  if(nums){
    for(let i=nums.length-1;i>=0;i--){
      const t=nums[i];
      if(Math.abs(parseFloat(t.replace(',','.'))-val) <= Math.max(0.05, val*0.01)){
        const at=s.lastIndexOf(t);
        m.text.prefix=s.slice(0,at); m.text.suffix=s.slice(at+t.length);
        m.text.override=null;
        return true;
      }
    }
  }
  m.text.prefix=null; m.text.suffix=null;
  m.text.override=s.trim()? s : null;                 /* not a number we can own */
  return false;
}
function dimValueOf(m){
  /* An angular dimension states DEGREES, not millimetres. */
  if(m.kind==='angular') return Math.abs(m.sweep)*180/Math.PI;
  const S=dimSpanOf(m); return Math.abs(S.t2-S.t1); }

/* ---- the ONE place that decides where a dimension's lines go -------------- */
function dimGeomOf(m){
  if(m.kind==='radial'||m.kind==='diameter') return dimRadialGeom(m);
  if(m.kind==='angular') return dimAngularGeom(m);
  const S=dimSpanOf(m), q=m.line.q, A=(t,qq)=>dimAt(m,t,qq);
  /* extension lines: anchored on the part, always reaching PAST the dimension
     line by `overshoot`, so they can never fail to meet it (STATUS §2.1). */
  const ext=[];
  [[S.t1,S.q1,0],[S.t2,S.q2,1]].forEach(([t,qi,i])=>{
    if(!m.ext.visible[i]){ ext.push({role:'ext'+i, hidden:true}); return; }
    const s=(q>=qi)?1:-1;
    /* The gap from the part can never be allowed to swallow the extension line:
       if the dimension line has been pulled in closer than the gap, the gap
       shrinks to suit. An extension line that stops short of its own dimension
       line is a drafting error, and this makes that outcome impossible. */
    const reach=Math.max(0,(q-qi)*s);
    const a=qi+s*Math.min(m.ext.gap[i], reach);
    const b=q+s*Math.max(m.ext.overshoot[i], 0.01);
    ext.push({role:'ext'+i, arrow:null, a:A(t,a), b:A(t,b)});
  });
  /* dimension line. Narrow gap -> the standard form: arrows flipped OUTWARD and
     the line jogs out past the extension line so the value has somewhere to sit.
     That jog is not a stray line to tidy away - it is part of the dimension. */
  const h=m.line.arrow, w=m.line.arrowW, out=!!m.line.arrowsOut, segs=[];
  const stub=m.line.stub||[0,0];
  segs.push(m.line.inside===false ? {role:'dimA', hidden:true}
    : {role:'dimA', a:A(S.tA,q), b:A(S.tB,q),
       arrow: out? null : {s:m.line.capStart==='arrow', e:m.line.capEnd==='arrow', h, w}});
  segs.push(stub[0]>1e-6
    ? {role:'dimL', a:A(S.tA-stub[0],q), b:A(S.tA,q), arrow: out? {s:false,e:true,h,w}:null}
    : {role:'dimL', hidden:true});
  segs.push(stub[1]>1e-6
    ? {role:'dimR', a:A(S.tB+stub[1],q), b:A(S.tB,q), arrow: out? {s:false,e:true,h,w}:null}
    : {role:'dimR', hidden:true});
  const n=[-m.dir[1],m.dir[0]];
  const pl=dimTextPlace(m, q, n);
  const tt=(m.text.t==null)? dimTextCentre(m) : m.text.t;
  const tp=A(tt, q+pl.dq);
  return {ext, segs, span:[S.tA,S.tB], q,
          text:{x:tp[0], y:tp[1], rot:m.text.rot, t:tt, dq:pl.dq, capH:pl.capH,
                grows:pl.grows, side:pl.side, gapMM:pl.gap, align:1,
                str:dimValueText(m)}};
}

/* ---- radius / diameter ----------------------------------------------------
   A radius reads outwards: ONE arrowhead touching the arc and pointing into it,
   a leader that lies on the arc's own radius, and a horizontal landing at the far
   end with the value sitting on it. What it must NOT be is a line straight through
   the arc with an arrow at each end and the value floating loose on top - that
   reads as a linear dimension between two points, which is not what it measures.
   ========================================================================== */
/* How far a radius may reasonably run before the centre stops being worth
   chasing. Beyond that - or when the centre falls off the drawing area - ISO 129
   and ASME Y14.5 both say to FORESHORTEN it: keep the arrow end radial and true,
   put a zig-zag in the middle, and park the centre mark at a convenient false
   position. The value still reads the real radius. */
const DIM_RAD_MAX_RUN=60;                 /* mm on paper: beyond this, foreshorten */
const DIM_RAD_FALSE_RUN=35;               /* where the false centre is parked */
function dimSheetArea(){
  try{
    const P=paperDims(), mg=store.format.margin;
    return {x0:mg, y0:mg+TB_H, x1:P.W-mg, y1:P.H-mg};
  }catch(e){ return null; }
}
function dimCentreIsFar(m, C, run){
  if(m.centreFar!=null) return !!m.centreFar;          /* explicit choice wins */
  const A=dimSheetArea();
  /* Off the drawing area is the real reason to foreshorten: the centre has nowhere
     to be. A long-but-on-sheet radius is drawn honestly - shortening it by a few
     millimetres would add a "not to scale" symbol while saving nothing. */
  if(A && (C[0]<A.x0 || C[0]>A.x1 || C[1]<A.y0 || C[1]>A.y1)) return true;
  return run>DIM_RAD_MAX_RUN;
}
/* The arc, its two arrowheads, the extension lines out to it, and where the value
   sits: on the middle of the arc, clear of it, turned to stand upright. */
/* an angle folded to 0..2pi */
function normAngle(t){ while(t<0) t+=2*Math.PI; while(t>=2*Math.PI) t-=2*Math.PI; return t; }
/* A value riding an arc leans with it: it stands square to the radius at the
   point it sits on, which is the tangent there. Folded so it is never upside
   down - a number that has to be read from below is a number nobody reads. */
function dimArcTextRot(a){
  let t=a - Math.PI/2;                      /* the tangent, in degrees below */
  t=Math.atan2(Math.sin(t), Math.cos(t))*180/Math.PI;
  if(t>90) t-=180; else if(t<-90) t+=180;
  return t;
}
function dimAngularGeom(m){
  const C=m.centre, r=m.radius, a0=m.a0, sw=m.sweep;
  const at=(a)=>[C[0]+r*Math.cos(a), C[1]+r*Math.sin(a)];
  const sample=(from,to)=>{
    const n=Math.max(2, Math.ceil(Math.abs(to-from)/0.12));
    const out=[]; for(let i=0;i<=n;i++) out.push(at(from+(to-from)*i/n));
    return out;
  };
  const arc=sample(a0, a0+sw);
  /* The arrowheads are caps on the arc, lying along it - the same shape every
     other kind of dimension uses. */
  const segs=[{role:'arc', pts:arc,
               arrow:{s:true, e:true, h:m.line.arrow, w:m.line.arrowW}}];

  /* ---- arrows outside -------------------------------------------------------
     When there is no room between the two arrowheads - a narrow angle, or the
     value dragged clear of the arc - a drawing puts the arrowheads OUTSIDE,
     pointing in at the ends they mark, and runs the arc on past them to carry the
     value. That is the form a draughtsman expects, and it is what a linear
     dimension already does when its own space runs out. */
  const need=dimTextWidth(dimValueText(m), m.text.h||2.5) + (m.line.arrow||2.5)*2;
  const room=Math.abs(sw)*r;
  const ta=(m.text.ta==null)? null : m.text.ta;
  /* how far the value sits beyond each end, going outwards */
  const beyond=(a)=>{
    if(a==null) return 0;
    const t0=normAngle(a-a0)*(sw>=0?1:-1);
    const t=(sw>=0)? normAngle(a-a0) : -normAngle(a0-a);
    if(sw>=0) return (t> Math.abs(sw))? t-Math.abs(sw) : (t<0? -t : 0);
    return 0;
  };
  const tOut=(()=>{
    if(ta==null) return 0;
    /* signed position of the value along the sweep, in the sweep's own direction */
    let t=(ta-a0)/(sw||1);
    if(t>1) return (t-1)*Math.abs(sw);
    if(t<0) return -t*Math.abs(sw);
    return 0;
  })();
  /* Where the value has been PUT decides the form. Keeping the "no room" test
     alive after a drag meant the stubs could never be taken back: the value could
     be dragged home and the arrowheads stayed outside, with the arc still running
     past them. Untouched, the room decides; once placed by hand, the placing does. */
  const out = (ta==null) ? (room < need) : (tOut > 0);
  /* how far the arc runs past each end - needed again below, when the value that
     was dragged out there has to be given a line to stand on */
  let past0=0, past1=0;
  if(out){
    /* The arrowheads move onto the stubs. A stub starts AT the end it marks and
       runs outwards, so an arrowhead capping its start has its tip on the end and
       points back in - which is what "arrows outside" means on paper. Leaving them
       on the arc pointed them the wrong way and left them inside the space the
       value needs. */
    segs[0].arrow=null;
    /* run the arc past each end: far enough for the arrowhead, and far enough to
       reach the value when it has been dragged out there */
    const stub=(m.line.arrow||2.5)*2.2;
    const side=(sw>=0)?1:-1;
    past0=stub; past1=stub;
    if(ta!=null){
      /* How far past the end the value sits, as an ARC LENGTH - the same units as
         the stub, and the same units the sampler divides by the radius. Working in
         radians here and dividing by the radius again left the arc a fraction of
         the length it needed, so it never reached out under the value. */
      const t=(ta-a0)/(sw||1);
      const halfText=dimTextWidth(dimValueText(m), m.text.h||2.5)/2;
      if(t<0) past0=Math.max(stub, (-t)*Math.abs(sw)*r + halfText);
      if(t>1) past1=Math.max(stub, (t-1)*Math.abs(sw)*r + halfText);
    }
    const cap={s:true, e:false, h:m.line.arrow, w:m.line.arrowW};
    segs.push({role:'arcOut0', pts:sample(a0, a0-side*past0/r), arrow:cap});
    segs.push({role:'arcOut1', pts:sample(a0+sw, a0+sw+side*past1/r), arrow:cap});
  }
  /* Extension lines reach from the measured line out past the arc. */
  const ext=[];
  [0,1].forEach(i=>{
    if(!m.ext.visible[i]) return;
    const a=(i===0?a0:a0+sw);
    const p=m.ends[i];
    const d=Math.hypot(p[0]-C[0], p[1]-C[1]);
    const from=Math.min(d, r) + (m.ext.gap[i]||0);
    const to=r + (m.ext.overshoot[i]||0);
    if(to<=from) return;
    const u=[Math.cos(a), Math.sin(a)];
    ext.push({role:'ext'+i, arrow:null,
      a:[C[0]+u[0]*from, C[1]+u[1]*from],
      b:[C[0]+u[0]*to,   C[1]+u[1]*to]});
  });
  /* The value sits on the middle of the arc, pushed clear of it on the outside,
     and upright rather than following the arc - a number that has to be read
     sideways is a number nobody reads. */
  /* ta is an ANGLE once the value has been dragged; before that it sits on the
     middle of the arc. */
  const am=(m.text.ta==null)? (a0+sw*0.5) : m.text.ta;
  const gap=(m.text.gapPx||DIM_TXT_GAP_PX)/(typeof view!=='undefined'&&view.s?view.s:1);
  const rt=(m.text.tr!=null)? m.text.tr : (r + (m.text.h||2.5)*0.5 + gap);
  const tp=[C[0]+rt*Math.cos(am), C[1]+rt*Math.sin(am)];

  /* The value rides the ARC. No elbow, no landing: the arc simply carries on and
     the number sits on it at the same clear space it always keeps. A leader bent
     out to a horizontal shelf made a second shape to read where the drawing only
     ever had one line. */
  const str=dimValueText(m);
  return {segs, ext, span:[0,Math.abs(sw)*r],
          text:{x:tp[0], y:tp[1], rot:dimArcTextRot(am), str, h:m.text.h}};
}
function dimRadialGeom(m){
  const C=m.centre, P=m.point;
  let dx=P[0]-C[0], dy=P[1]-C[1], run=Math.hypot(dx,dy)||1;
  const d=[dx/run, dy/run];                              /* outwards along the radius */
  const inw=[-d[0], -d[1]];                              /* inwards, towards the centre */
  const str=dimValueText(m);
  const w=dimTextWidth(str, m.text.h||2.5);
  const gap=(m.text.gapPx==null?DIM_TXT_GAP_PX:m.text.gapPx)/dimPxPerMM();
  const side=(m.land.side>=0)?1:-1;                       /* which way the landing runs */
  /* The elbow is where the radial leader reaches the landing's level. Keeping the
     leader strictly radial is the whole point of a radius dimension. */
  /* How far the leader runs before it turns into the landing. This is a LENGTH the
     user sets by dragging, not a level to be found by intersecting the radial ray
     with the value's height - that intersection races off to infinity when the
     radius runs nearly horizontal, and capping it was what stopped the value from
     being dragged as far out as the drawing needed. A length has neither problem:
     it can be as long as you like and it can never be undefined. */
  const leadMin=(m.text.h||2.5)*1.5;
  const leadWant=Math.max(w*0.6, (m.text.h||2.5)*3);
  let t=(m.land.len!=null)? m.land.len : leadWant;
  if(m.land.len==null && Math.abs(d[1])>1e-3){
    const hit=(m.land.y-P[1])/d[1];               // where the file put it
    if(hit>leadMin) t=hit;
  }
  t=Math.max(leadMin, t);
  const elbow=[P[0]+d[0]*t, P[1]+d[1]*t];
  /* The value may be slid outwards along the landing, exactly like the value on a
     linear dimension slides along its dimension line. The landing then GROWS to
     stay underneath it - a value floating past the end of its own line is not a
     dimension, it is a stray label. */
  const offMin=w/2;
  const off=Math.max(offMin, (m.land.off==null? offMin : m.land.off));
  const landLen=off+w/2;                                  /* always reaches the far edge */
  const landEnd=[elbow[0]+side*landLen, elbow[1]];
  const tx=elbow[0]+side*off;
  /* The arrowhead belongs OUTSIDE the arc with its tip touching it, pointing in
     towards the centre. That is the direction the reader's eye has to travel to
     find what is being measured, and it is what every drawing office draws. The
     leader arrives from outside, so the arrow simply terminates it on the arc; the
     run to the centre mark carries no arrowhead of its own. */
  const segs=[
    {role:'lead', a:elbow.slice(), b:P.slice(),
     arrow:{s:false, e:true, h:m.line.arrow, w:m.line.arrowW}},
    {role:'land', a:elbow.slice(), b:landEnd, arrow:null}
  ];
  /* ---- the run in to the centre, and the centre mark itself ---------------- */
  /* How far the run towards the centre is drawn. Left alone it reaches the real
     centre; dragged shorter, the marker moves in and the run is foreshortened,
     because a run that stops short without saying so would be a lie about where
     the centre is. */
  const userRun=(m.run && m.run.len!=null)? Math.max(m.line.arrow*2, m.run.len) : null;
  const far=(m.centreMark===false)? false
    : (userRun!=null ? (userRun < run-0.25) : dimCentreIsFar(m, C, run));
  let mark=null;
  if(m.centreMark!==false){
    const at=(k)=>[P[0]+inw[0]*k, P[1]+inw[1]*k];
    if(!far){
      const L=(userRun!=null)? Math.min(userRun, run) : run;
      if(m.kind==='diameter' && userRun==null){
        /* a diameter reads right across the circle, and the far side gets its own
           arrowhead - also standing outside the circle, also pointing in */
        segs.push({role:'cen', pts:[at(2*run), P.slice()], arrow:null});
        const tail=m.line.arrow*1.8;
        segs.push({role:'dimO', a:at(2*run+tail), b:at(2*run),
          arrow:{s:false, e:true, h:m.line.arrow, w:m.line.arrowW}});
      }else{
        segs.push({role:'cen', pts:[at(L), P.slice()], arrow:null});
      }
      mark=at(Math.min(L, run));
    }else{
      /* Foreshortened: radial at the arrow end, a zig-zag, then a short radial
         stub to a false centre. The reader is told "this is not to scale here"
         by the zig-zag itself - that is exactly what the symbol is for. */
      let L=(userRun!=null)? userRun : Math.min(DIM_RAD_FALSE_RUN, run*0.6);
      /* The symbol is a fixed size, so the run has to be long enough to hold it
         with a little straight line either side. Shortened past that the zig-zag
         would run off both ends of its own line. */
      const symQ=0.15*m.line.arrow;
      L=Math.max(L, symQ*12);
      /* The zig-zag is a SYMBOL, so it is always the same size and always in the
         middle of the run: only the straight lengths either side of it change as
         the run is shortened or let out. Scaling it with the run made the same
         mark come out different on every dimension, which is exactly what a
         symbol must not do. */
      const q=symQ;                             /* half a step along the run */
      const h=3*q;                              /* tight and steep, as sketched */
      const nrm=[-inw[1], inw[0]];
      const mid=L*0.5;                          /* always in the middle */
      const Z=(k,o)=>[P[0]+inw[0]*k+nrm[0]*o, P[1]+inw[1]*k+nrm[1]*o];
      /* Two full zig-zags, not one. A single Z reads as a kink in the line - a
         mistake to be tidied away - where a run of them is unmistakably the
         "not to scale here" symbol a draughtsman is looking for. */
      segs.push({role:'cen', arrow:null,
        pts:[Z(L,0),
             Z(mid+4*q, 0), Z(mid+3*q,  h), Z(mid+q, -h),
             Z(mid-q,   h), Z(mid-3*q, -h), Z(mid-4*q, 0),
             P.slice()]});
      mark=Z(L,0);
    }
    /* A small cross is enough to mark a centre - but not so small it disappears.
       On a drawing whose arrowheads are only 1.25mm, a mark tied to the arrow size
       came out under half a millimetre and nobody could see where the centre was. */
    const ms=Math.max(0.9, (m.line.arrow||2.5)*0.35);
    segs.push({role:'mkH', a:[mark[0]-ms,mark[1]], b:[mark[0]+ms,mark[1]], arrow:null});
    segs.push({role:'mkV', a:[mark[0],mark[1]-ms], b:[mark[0],mark[1]+ms], arrow:null});
  }
  const ink=dimInk(m.text.h||2.5, str);
  return {ext:[], segs, radial:true, elbow, landEnd, centreAt:mark, foreshortened:far,
    text:{x:tx, y:elbow[1]+gap+ink.desc, rot:0, align:1, capH:ink.asc,
          str, width:w, gapMM:gap, side, off, offMin}};
}

/* When the value is dragged past an extension line it no longer has a dimension
   line beneath it, and there is no longer room between the extension lines for
   both the arrows and the number. The standard answer to that is not to leave the
   number floating: the arrows FLIP to the outside and point back in, and the
   dimension line jogs out past the extension line to carry the value. This works
   that out from where the value actually is, so the form follows the drag. */
function dimFitForm(m){
  /* This decides whether the value fits BETWEEN the two arrowheads and, if not,
     pushes it outside. An arc has no such straight run to fit along - its value
     sits on the arc's middle and is never crowded out - so there is nothing here
     for an angular dimension to do. */
  if(m.kind==='angular') return;
  const S=dimSpanOf(m), span=S.tB-S.tA;
  const str=dimValueText(m);
  const w=dimTextWidth(str, m.text.h||2.5);
  const gapMM=(m.text.gapPx==null?DIM_TXT_GAP_PX:m.text.gapPx)/dimPxPerMM();
  const t=(m.text.t==null)? dimTextHome(m) : m.text.t;
  const tl=t-w/2, tr=t+w/2;
  /* One question decides the form: is the value between the extension lines?
     If it is, this is the inside form - arrowheads back inside with their tips on
     the extension lines, and nothing drawn beyond them. Whether the arrows are
     roomy in there is not the test: a tight fit is still the inside form, and
     demanding clearance for the arrows was what kept a value the user had just
     dragged in from ever getting the inside arrows it asked for. */
  const fits=(tl>=S.tA-1e-6 && tr<=S.tB+1e-6);
  m.line.inside=true;
  m.line.arrowsOut=!fits;
  /* A stub is only needed on a side the value actually overhangs. Adding the gap
     unconditionally left a stray tick sticking out past the extension line even
     when the value sat neatly inside. */
  const need=[ tl<S.tA-1e-6 ? (S.tA-tl+gapMM) : 0,
               tr>S.tB+1e-6 ? (tr-S.tB+gapMM) : 0 ];
  if(m.line.arrowsOut){
    /* Each flipped arrow needs a piece of dimension line to stand on. */
    const min=2*m.line.arrow;
    m.line.stub=[Math.max(need[0], min), Math.max(need[1], min)];
  }else{
    m.line.stub=[need[0], need[1]];
  }
  return m.line;
}

/* ---- reading the model out of the DXF entity ------------------------------ */
function dimKindOf(e){ return (e.dimensionType==null?0:e.dimensionType)&15; }
function v2DimModel(e, T, mm, id, raw){
  const kind=dimKindOf(e);
  if(kind===3 || kind===4) return v2DimRadial(e, T, mm, id, raw, kind);
  if(kind===2 || kind===5) return v2DimAngular(e, T, mm, id, raw);
  if(kind!==0 && kind!==1) return null;               /* ordinate: later */
  const d1=e.linearOrAngularPoint1, d2=e.linearOrAngularPoint2, an=e.anchorPoint;
  if(!d1||!d2||!an) return null;
  const P=(p)=>{ const w=m2Apply(T,[p.x||0,p.y||0]); return [w[0]*mm, w[1]*mm]; };
  const p1=P(d1), p2=P(d2), A=P(an);
  let u;
  if(kind===1){ const dx=p2[0]-p1[0], dy=p2[1]-p1[1], L=Math.hypot(dx,dy);
    if(L<1e-9) return null; u=[dx/L, dy/L]; }
  else { const a=(e.angle||0)*Math.PI/180 + Math.atan2(T[1],T[0]);
    u=[Math.cos(a), Math.sin(a)]; }
  const m={ id, kind:(kind===1?'aligned':'linear'),
    measure:{p1, p2}, dir:u,
    ext:{gap:[1.0,1.0], overshoot:[2.5,2.5], visible:[true,true]},
    line:{q:dimDot(A,[-u[1],u[0]]), inside:true, stub:[0,0], arrowsOut:false,
          capStart:'arrow', capEnd:'arrow', arrow:2.5, arrowW:2.5/3, weight:DIM_LW},
    text:{t:null, side:1, gapPx:DIM_TXT_GAP_PX, rot:0, value:'', override:null, h:2.5, align:1},
    ok:false };
  /* The value is derived from the measured points, so no amount of stretching can
     make the number disagree with the geometry. */
  m.text.value=dimValueOf(m).toFixed(2);
  dimFitFromRaw(m, raw);
  return m;
}

/* ---- ANGULAR ---------------------------------------------------------------
   An angular dimension states an ANGLE, and everything about it follows from the
   two lines it is measured between:

     group 13,14 ... the first line
     group 15,10 ... the second line          (10 is the anchor point)
     group 16 ...... a point on the arc, which fixes its radius

   The vertex is where the two lines cross; the arc runs between them at the
   radius that point gives. Nothing here is guessed: the file states all of it,
   and the value comes back out of the geometry so it cannot disagree with it. */
function v2DimAngular(e, T, mm, id, raw){
  raw=raw||{polys:[],solids:[],texts:[]};
  const g=(q)=>q? [q.x||0, q.y||0] : null;
  const W=(q)=>{ const w=m2Apply(T,q); return [w[0]*mm, w[1]*mm]; };
  const a1=g(e.linearOrAngularPoint1), a2=g(e.linearOrAngularPoint2),
        b1=g(e.diameterOrRadiusPoint), b2=g(e.anchorPoint), ap=g(e.arcPoint);
  if(!a1||!a2||!b1||!b2||!ap) return null;
  const A1=W(a1), A2=W(a2), B1=W(b1), B2=W(b2), AP=W(ap);
  const V=lineCross(A1,A2,B1,B2);
  if(!V) return null;                                  /* parallel: no angle */
  const r=Math.hypot(AP[0]-V[0], AP[1]-V[1]);
  if(!(r>1e-6)) return null;
  /* Each line gives TWO rays out of the vertex, and which one the dimension means
     is decided by where the arc point sits. Taking "the end further from the
     vertex" was wrong twice over: when the vertex lies outside a segment both ends
     point the same way, and when it lies inside, the far end can be the ray on the
     wrong side - measured on a real drawing, 22 degrees came back as 158.

     So try all four pairings and keep the sweep the arc point actually lies on. */
  const ang=(p)=>Math.atan2(p[1]-V[1], p[0]-V[0]);
  /* A line gives two rays out of the vertex. A ray is SUPPORTED when the drawing
     actually has a point out along it - which tells the two apart when the segment
     stops at the vertex, and marks both as usable when it runs through. */
  const raysOf=(p,q)=>{
    const dp=Math.hypot(p[0]-V[0], p[1]-V[1]), dq=Math.hypot(q[0]-V[0], q[1]-V[1]);
    if(Math.max(dp,dq)<1e-9) return null;
    const far=(dp>=dq)? p : q;
    const a=Math.atan2(Math.sin(ang(far)), Math.cos(ang(far)));
    const b=Math.atan2(Math.sin(a+Math.PI), Math.cos(a+Math.PI));
    const near=(x,y)=>{ let t=Math.abs(x-y)%(2*Math.PI);
                        return (t>Math.PI? 2*Math.PI-t : t) < 0.02; };
    const onRay=(ray)=>[p,q].some(z=>Math.hypot(z[0]-V[0],z[1]-V[1])>1e-9 &&
                                     near(ang(z), ray));
    return [{a, sup:onRay(a)}, {a:b, sup:onRay(b)}];
  };
  const R1=raysOf(A1,A2), R2=raysOf(B1,B2);
  if(!R1 || !R2) return null;
  const apA=ang(AP);
  const norm=(t)=>{ while(t<0) t+=2*Math.PI; while(t>=2*Math.PI) t-=2*Math.PI; return t; };
  let best=null;
  R1.forEach(r1=>R2.forEach(r2=>{
    const s0c=r1.a, s1c=r2.a;
    /* Only rays the drawing supports. Allowing the opposite of a drawn ray let a
       240 degree angle be read as a 120 degree one that fitted the arc point
       perfectly but pointed away from both measured lines. */
    const sup=(r1.sup?1:0)+(r2.sup?1:0);
    [1,-1].forEach(dirSign=>{
      let d0=norm((s1c-s0c)*dirSign)*dirSign;         /* signed sweep that way round */
      if(Math.abs(d0)<1e-9) return;
      const t=norm((apA-s0c)*dirSign);
      if(t>Math.abs(d0)+1e-6) return;                 /* the arc point is not on it */
      /* Which sweep does the arc point BELONG to? The one it sits in the middle of.
         Preferring the smallest sweep instead read a 240 degree angle as its 120
         degree remainder, because the point sat exactly on that one's end and
         counted as inside both. Distance from the middle has no such tie. */
      /* Two signals, and each alone gets a case wrong. "Smallest sweep" read a
         reflex angle as its remainder, because the arc point sat exactly on the
         short sweep's end and counted as inside both. "Nearest the middle" then
         read a real 22 degree angle as 338, because on that drawing the point sits
         a little off centre and the huge sweep's middle happened to be closer in
         proportion. So: a point sitting ON an end is not really inside that sweep -
         require it clear of both ends - and among what is left take the smallest. */
      const frac=t/Math.abs(d0);
      if(frac<0.02 || frac>0.98) return;              /* sitting on an end is not inside */
      const better = !best || sup>best.sup ||
                     (sup===best.sup && Math.abs(d0)<Math.abs(best.d));
      if(better) best={s0:s0c, d:d0, sup};
    });
  }));
  if(!best) return null;
  const s0=best.s0, d=best.d;
  const rayEnd=(a)=>[V[0]+Math.cos(a)*r, V[1]+Math.sin(a)*r];
  const e1=rayEnd(s0), e2=rayEnd(s0+d);
  const m={ id, kind:'angular',
    centre:V, radius:r, a0:s0, sweep:d,
    ext:{gap:[1.0,1.0], overshoot:[2.5,2.5], visible:[true,true]},
    ends:[e1, e2],
    line:{arrow:2.5, arrowW:2.5/3, weight:DIM_LW, inside:true},
    text:{t:null, side:1, gapPx:DIM_TXT_GAP_PX, rot:0, value:'',
          override:null, h:2.5, align:1, suffix:'\u00b0'},
    ok:false };
  m.text.value=dimValueOf(m).toFixed(2);
  dimFitFromRaw(m, raw);
  return m;
}
/* Where two lines cross, or null when they run parallel. */
function lineCross(p1,p2,p3,p4){
  const x1=p1[0],y1=p1[1], x2=p2[0],y2=p2[1], x3=p3[0],y3=p3[1], x4=p4[0],y4=p4[1];
  const den=(x1-x2)*(y3-y4)-(y1-y2)*(x3-x4);
  if(Math.abs(den)<1e-12) return null;
  const t=((x1-x3)*(y3-y4)-(y1-y3)*(x3-x4))/den;
  return [x1+t*(x2-x1), y1+t*(y2-y1)];
}

function v2DimRadial(e, T, mm, id, raw, kind){
  raw=raw||{polys:[],solids:[],texts:[]};
  const c=e.anchorPoint, p=e.diameterOrRadiusPoint;
  if(!c || !p) return null;
  const W=(q)=>{ const w=m2Apply(T,[q.x||0,q.y||0]); return [w[0]*mm, w[1]*mm]; };
  let C=W(c), P=W(p);
  let r=Math.hypot(P[0]-C[0], P[1]-C[1]);
  if(!(r>1e-6)) return null;
  if(kind===3){
    /* A DIAMETER dimension gives the two ENDS of the diameter (groups 10 and 15),
       not the centre and a point. Taking group 10 for the centre put the centre
       mark out on the circle and made the leader twice as long as the radius. */
    C=[(C[0]+P[0])/2, (C[1]+P[1])/2];
    r=r/2;
  }
  const m={ id, kind:(kind===3?'diameter':'radial'),
    centre:C, point:P, radius:r,
    line:{arrow:2.5, arrowW:2.5/3, weight:DIM_LW},
    land:{y:0, len:null, off:null, side:1},
    run:{len:null},
    text:{gapPx:DIM_TXT_GAP_PX, rot:0, value:'', override:null, h:2.5, align:1},
    ok:false };
  m.text.value=((kind===3?'\u2300':'R')+(r).toFixed(2));
  /* arrowhead proportions come from the real solid, as everywhere else */
  let asz=0, awd=0;
  (raw.solids||[]).forEach(sd=>{ const sh=dimArrowShape(sd);
    if(sh){ asz=Math.max(asz,sh.len); awd=Math.max(awd,sh.wid); } });
  if(asz>0.2){ m.line.arrow=asz; m.line.arrowW=(awd>0.05?awd:asz/3); }
  /* the value's own string and the side the drawing chose to read it from */
  const t0=(raw.texts||[])[0];
  const M=e.middleOfText? W(e.middleOfText) : null;
  if(t0){ m.text.h=t0.h||2.5; m.text.scaleRot=t0.scaleRot; dimSplitValue(m, t0.text); }
  const ref=M || (t0? [t0.x,t0.y] : [P[0], P[1]]);
  m.land.y=ref[1];
  m.land.side=((ref[0]-P[0])>=0)?1:-1;
  m.odd=0; m.dev=0; m.ok=true;      // this form is corrected on purpose, not copied
  return m;
}

/* Fit the model's spacing to what the file actually drew, then check the model
   reproduces it. Fitting (instead of assuming DIMEXO/DIMEXE from the dimstyle) is
   what lets the model redraw each dimension right on top of the original. */
/* The model is trusted when the arc it describes lands on the strokes the file
   drew - the same 0.35 mm test every other kind of dimension has to pass. */
function dimFitAngular(m, raw){
  const C=m.centre, r=m.radius;
  let worst=0, n=0;
  (raw.polys||[]).forEach(p=>{
    const pts=p.pts||[];
    pts.forEach(q=>{
      const d=Math.abs(Math.hypot(q[0]-C[0], q[1]-C[1]) - r);
      /* only the strokes that are meant to BE the arc; the extension lines run
         away from it and would fail a test they were never part of */
      if(d<2.0){ n++; if(d>worst) worst=d; }
    });
  });
  m.odd=0; m.dev=worst;
  m.ok = n>=6 && worst<=0.35;                       /* the same tolerance as every other kind */
  if(!m.ok){ m.authored=true; m.dev=0; m.ok=true; }   /* author it rather than drop it */
  return m;
}
function dimFitFromRaw(m, raw){
  /* Nothing was drawn for this dimension - the file left it to be regenerated.
     There is no geometry to copy, so the standard's own defaults are used and the
     model is authored outright rather than the dimension being dropped. */
  if(!raw || !(raw.polys||[]).length){
    m.authored=true; m.odd=0; m.dev=0; m.ok=true;
    if(m.ext) m.ext.visible=[true,true];
    return m;
  }
  /* An angular dimension has no straight direction to fit against - its geometry
     is an arc. Check it the way it is drawn: how far the file's own strokes sit
     from the arc this model describes. */
  if(m.kind==='angular') return dimFitAngular(m, raw);
  const u=m.dir, n=[-u[1],u[0]];
  const S=dimSpanOf(m), q=m.line.q;
  const along=[], perp=[]; let odd=0;
  (raw.polys||[]).forEach(p=>{ const pts=p.pts||[];
    for(let i=0;i+1<pts.length;i++){
      const a=pts[i], b=pts[i+1];
      const dx=b[0]-a[0], dy=b[1]-a[1], L=Math.hypot(dx,dy);
      if(L<1e-6) continue;
      const vu=(dx*u[0]+dy*u[1])/L, vn=(dx*n[0]+dy*n[1])/L;
      const ta=dimDot(a,u), tb=dimDot(b,u), qa=dimDot(a,n), qb=dimDot(b,n);
      if(Math.abs(vu)>0.99 && Math.abs((qa+qb)/2-q)<0.8) along.push([Math.min(ta,tb), Math.max(ta,tb)]);
      else if(Math.abs(vn)>0.99) perp.push({t:(ta+tb)/2, lo:Math.min(qa,qb), hi:Math.max(qa,qb)});
      else odd++;
    }});
  /* extension lines - each drawn piece belongs to whichever measured point it is
     nearest to, so two close-together extension lines cannot swap places. */
  const bag=[[],[]];
  perp.forEach(Pp=>{ const d0=Math.abs(Pp.t-S.t1), d1=Math.abs(Pp.t-S.t2);
    if(Math.min(d0,d1)<0.8) bag[(d0<=d1)?0:1].push(Pp); });
  [[S.t1,S.q1,0],[S.t2,S.q2,1]].forEach(([t,qi,i])=>{
    const hits=bag[i];
    if(!hits.length){ m.ext.visible[i]=false; return; }
    const lo=Math.min(...hits.map(P=>P.lo)), hi=Math.max(...hits.map(P=>P.hi));
    const s=(q>=qi)?1:-1;
    m.ext.gap[i]=Math.max(0, ((s>0?lo:hi)-qi)*s);
    m.ext.overshoot[i]=Math.max(0, ((s>0?hi:lo)-q)*s);
  });
  /* arrowheads: size and, crucially, which way they point. Tips sitting outside
     the measured span mean the file used the narrow-gap form. */
  let asz=0, awd=0, nOut=0, nIn=0;
  (raw.solids||[]).forEach(sd=>{
    const sh=dimArrowShape(sd);
    if(sh){ asz=Math.max(asz,sh.len); awd=Math.max(awd,sh.wid); }
    let cx=0, cy=0; sd.forEach(p=>{cx+=p[0];cy+=p[1];}); cx/=sd.length; cy/=sd.length;
    const t=dimDot([cx,cy],u);
    if(t<S.tA-0.15 || t>S.tB+0.15) nOut++; else nIn++;
  });
  if(asz>0.2){ m.line.arrow=asz; m.line.arrowW=(awd>0.05?awd:asz/3); }
  m.line.arrowsOut=(nOut>nIn);
  /* dimension line: which pieces were drawn, inside and/or as outside stubs */
  if(along.length){
    const mid=(S.tA+S.tB)/2, tol=0.05;
    m.line.inside=along.some(Sg=>Sg[0]<=mid+tol && Sg[1]>=mid-tol);
    const L=along.filter(Sg=>Sg[1]<=S.tA+tol), R=along.filter(Sg=>Sg[0]>=S.tB-tol);
    m.line.stub=[ L.length? Math.max(0, S.tA-Math.min(...L.map(Sg=>Sg[0]))) : 0,
                  R.length? Math.max(0, Math.max(...R.map(Sg=>Sg[1]))-S.tB) : 0 ];
    if(!m.line.inside && !m.line.stub[0] && !m.line.stub[1]) m.line.inside=true;
    m.text.outSide=(m.line.stub[1]>=m.line.stub[0])?1:-1;   // the side it jogged to
  }
  /* the value: keep the file's own string and its exact placement */
  const t0=(raw.texts||[])[0];
  if(t0){
    m.text.rot=t0.rot||0; m.text.h=t0.h||2.5; m.text.scaleRot=t0.scaleRot;
    /* Which side of the line the drawing put the value on is the author's choice,
       so keep it. WHERE on that side is a drafting rule, so recompute it: centred
       on the line, one fixed gap away. The file's own anchor is not reused - many
       DXF texts are left-anchored even when they look centred, and copying that
       anchor is what left the value visibly off-centre before. */
    m.text.side=(dimDot([t0.x,t0.y],n)-q>=0)?1:-1;
    m.text.align=1;
    dimSplitValue(m, t0.text);
  }
  m.text.t=null;                          // null = "centre me", recomputed on demand
  m.text.gapPx=DIM_TXT_GAP_PX;
  m.odd=odd;
  m.dev=dimDeviation(m, raw);
  m.ok=(odd===0 && m.dev<=0.35);
  return m;
}
/* How far the model's redraw sits from what the file drew (mm, worst endpoint).
   A capped end may fall anywhere inside its own arrowhead: many files stop the
   dimension line at the arrow's base and let the filled solid cover the rest, so
   the ink lands in the same place either way. */
function dimDeviation(m, raw){
  const g=dimGeomOf(m), cands=[];
  const push=(s,sa,sb)=>{ if(s.hidden||!s.a) return; cands.push({a:s.a,b:s.b,sa:sa||0,sb:sb||0}); };
  g.ext.forEach(s=>push(s,0,0));
  g.segs.forEach(s=>{ const h=m.line.arrow;
    push(s, (s.arrow&&s.arrow.s)?h:0, (s.arrow&&s.arrow.e)?h:0); });
  if(!cands.length) return 1e9;
  const near=(p,S,which)=>{
    const A=S.a, B=S.b, dx=B[0]-A[0], dy=B[1]-A[1], L=Math.hypot(dx,dy)||1;
    const ux=dx/L, uy=dy/L;
    const base=(which==='a')?A:B, slack=(which==='a')?S.sa:S.sb, sgn=(which==='a')?1:-1;
    const t=((p[0]-base[0])*ux+(p[1]-base[1])*uy)*sgn;
    const off=Math.abs(-(p[0]-base[0])*uy+(p[1]-base[1])*ux);
    const along=(t>=-1e-6 && t<=slack+1e-6)?0:Math.min(Math.abs(t), Math.abs(t-slack));
    return Math.hypot(along, off);
  };
  let worst=0, count=0;
  (raw.polys||[]).forEach(p=>{ const pts=p.pts||[];
    for(let i=0;i+1<pts.length;i++){
      const a=pts[i], b=pts[i+1];
      if(Math.hypot(b[0]-a[0], b[1]-a[1])<1e-6) continue;
      count++;
      let best=1e9;
      cands.forEach(S=>{ best=Math.min(best,
        Math.max(near(a,S,'a'), near(b,S,'b')),
        Math.max(near(b,S,'a'), near(a,S,'b'))); });
      worst=Math.max(worst,best);
    }});
  return count? worst : 1e9;
}

/* ---- projecting the model into drawable primitives ------------------------ */
function dimProject(m, style, texts){
  const g=dimGeomOf(m), base=style||{};
  const mk=(s)=>({ _src:'DIMENSION', _layer:base._layer, _dim:m.id, _role:s.role,
    pts:s.hidden? [] : (s.pts? s.pts.map(q=>q.slice()) : (s.a? [s.a.slice(), s.b.slice()] : [])),
    dash:null, _section:false, _lw:DIM_LW, _dimPart:true });
  const polys=[];
  (g.ext||[]).forEach(s=>{ if(!s.hidden) polys.push(mk(s)); });
  g.segs.forEach(s=>{ if(s.hidden||(!s.a&&!s.pts)) return;
    const p=mk(s);
    if(s.arrow && (s.arrow.s||s.arrow.e)) p._arrow={s:!!s.arrow.s, e:!!s.arrow.e, h:s.arrow.h, w:s.arrow.w};
    polys.push(p); });
  const t0=(texts||[])[0], out={polys, texts:[]};
  if(g.text.str!=='' && g.text.str!=null){
    out.texts.push(Object.assign({}, t0||{}, { _dim:m.id, _role:'val', _dimPart:true,
      x:g.text.x, y:g.text.y, rot:g.text.rot||0, h:m.text.h, text:g.text.str,
      align:1, scaleRot:m.text.scaleRot }));
  }
  return out;
}
/* Re-project after the model changed (a drag, a STYLIZE pass). Roles are stable,
   so the same objects keep their identity and the selection survives. */
function dimApply(pg, m){
  const g=dimGeomOf(m), byRole={};
  (pg.objects||[]).forEach(o=>{
    (o.prims.polys||[]).forEach(p=>{ if(p._dim===m.id && p._role) byRole[p._role]={o,p}; });
    (o.prims.texts||[]).forEach(t=>{ if(t._dim===m.id && t._role==='val') byRole.val={o,t}; });
  });
  /* A piece that was not needed before (a jog appearing, an extension line coming
     back) gets a primitive made for it now, so the model can always draw itself
     in full rather than being limited by whatever the file happened to contain. */
  const host=(pg.objects||[]).find(o=>o._dim===m.id);
  const put=(s)=>{ let e=byRole[s.role];
    if(!e){ if(s.hidden || !host || (!s.a && !s.pts)) return;
      const p={_src:'DIMENSION', _dim:m.id, _role:s.role, pts:[], dash:null,
               _section:false, _lw:DIM_LW, _dimPart:true};
      /* into the DRAWING as well: a stroke that lives only in the object list is
         gone the next time the objects are rebuilt, and a dimension that had to
         make a piece for itself would lose it on reopening */
      if(pg.dxf && pg.dxf.polys) pg.dxf.polys.push(p);
      host.prims.polys.push(p); e=byRole[s.role]={o:host, p}; }
    const dx=e.o.dx||0, dy=e.o.dy||0;
    const src=s.pts || (s.a? [s.a, s.b] : null);
    e.p.pts=(s.hidden||!src)? [] : src.map(q=>[q[0]-dx, q[1]-dy]);
    if(!s.hidden && s.arrow && (s.arrow.s||s.arrow.e)) e.p._arrow={s:!!s.arrow.s,e:!!s.arrow.e,h:s.arrow.h,w:s.arrow.w};
    else delete e.p._arrow; };
  (g.ext||[]).forEach(put); g.segs.forEach(put);
  /* A piece the model no longer draws must be cleared, not just left alone. Only
     the roles present were being written, so a stub the arc once ran out to stayed
     on the paper after the value was brought back in - a stroke belonging to a
     shape that no longer exists. */
  const live=new Set([].concat(g.ext||[], g.segs||[]).map(s=>s.role));
  Object.keys(byRole).forEach(role=>{
    if(role==='val' || live.has(role)) return;
    const e=byRole[role]; if(!e || !e.p) return;
    e.p.pts=[]; delete e.p._arrow;
  });
  const V=byRole.val;
  if(V){ V.t.x=g.text.x-(V.o.dx||0); V.t.y=g.text.y-(V.o.dy||0);
         V.t.rot=g.text.rot; V.t.text=g.text.str; V.t.h=m.text.h; V.t.align=1; }
  return g;
}
/* Import-time moves (centring, cluster guard) must carry the model with them, or
   the model and the drawn lines end up in different places. */
function dimTranslate(m, dx, dy){
  if(m.kind==='angular'){
    m.centre=[m.centre[0]+dx, m.centre[1]+dy];
    m.ends=(m.ends||[]).map(p=>[p[0]+dx, p[1]+dy]);
    return;
  }
  if(m.kind==='radial'||m.kind==='diameter'){
    m.centre=[m.centre[0]+dx, m.centre[1]+dy];
    m.point =[m.point[0]+dx,  m.point[1]+dy];
    m.land.y+=dy;
    return;
  }
  const u=m.dir, n=[-u[1],u[0]];
  m.measure.p1=[m.measure.p1[0]+dx, m.measure.p1[1]+dy];
  m.measure.p2=[m.measure.p2[0]+dx, m.measure.p2[1]+dy];
  m.line.q += dimDot([dx,dy],n);
  if(m.text.t!=null) m.text.t += dimDot([dx,dy],u);
}
function dimModelsOf(pg){ return (pg && pg.dxf && pg.dxf.dims) || []; }
function dimModelById(pg, id){ const l=dimModelsOf(pg); for(const m of l) if(m.id===id && m.ok) return m; return null; }
