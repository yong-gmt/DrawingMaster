/* ============================================================================
   §7.2  GRIPS THAT EDIT THE MODEL  —  Dimension-Design.md §3
   ----------------------------------------------------------------------------
   AutoCAD gives a dimension several grips, each with its own job. We do the same,
   but every grip now writes ONE number into the model and lets dimApply() redraw
   the whole dimension. Nothing is bent by hand, so:
     - the extension lines cannot fail to reach the dimension line
     - the arrowheads cannot drift off the ends (they ARE the ends)
     - the value cannot change, because it is derived from `measure`
     - dragging out and back returns exactly where it started
   ========================================================================== */
const DIM_GRIP_PX=5;
/* An object dragged bodily carries a dx/dy the model knows nothing about. Fold it
   into the model before editing, so both agree on where the dimension is. */
function dimBake(pg, m){
  let dx=null, dy=null, same=true;
  (pg.objects||[]).forEach(o=>{
    if(o._dim!==m.id) return;
    if(dx===null){ dx=o.dx||0; dy=o.dy||0; }
    else if((o.dx||0)!==dx || (o.dy||0)!==dy) same=false;
  });
  if(dx===null || (!dx && !dy)) return;
  if(same){ dimTranslate(m, dx, dy);
    (pg.objects||[]).forEach(o=>{ if(o._dim===m.id){ o.dx=0; o.dy=0; } }); }
}
/* Where the grips are: one on the dimension line, one on the value, one at the
   outer end of each extension line. */
function dimModelGrips(pg){
  const id=selectedDimId(); if(!id) return [];
  const m=dimModelById(pg,id); if(!m) return [];
  dimBake(pg,m);
  const g=dimGeomOf(m), out=[];
  if(m.kind==='angular'){
    /* Two things to grab, the same two every dimension has: the ARC, which sets
       how far out the dimension stands, and the VALUE, which can be slid round
       the arc and pushed in or out. */
    const C=m.centre, am=m.a0+m.sweep/2;
    out.push({m, kind:'angarc',
              at:[C[0]+m.radius*Math.cos(am), C[1]+m.radius*Math.sin(am)]});
    out.push({m, kind:'angtext', at:[g.text.x, g.text.y]});
    return out;
  }
  if(g.radial){
    /* A radius has one place to grab: the landing carrying the value. The leader
       stays on the arc's radius whatever you do, because that is what makes it a
       radius rather than a line between two points. */
    out.push({m, kind:'radial', at:[(g.elbow[0]+g.landEnd[0])/2, g.elbow[1]]});
    /* two grips on the run in to the centre: the mark itself, and the middle of the
       run - which is easy to hit even when several dimensions share a hub centre */
    if(g.centreAt){
      out.push({m, kind:'radrun', at:g.centreAt.slice()});
      const cen=g.segs.find(s=>s.role==='cen');
      if(cen && cen.pts && cen.pts.length>=2){
        const a=cen.pts[0], b=cen.pts[cen.pts.length-1];
        out.push({m, kind:'radrun', at:[(a[0]+b[0])/2, (a[1]+b[1])/2]});
      }
    }
    return out;
  }
  /* Dimension-line grips go at the ENDS of the line, the way CAD does it. Putting
     one at the midpoint buried the value's own grip underneath it - the value sits
     barely a millimetre off the line, so the line grip swallowed every click and
     the value could not be dragged at all. */
  const u=m.dir, ends=[];
  g.segs.forEach(s=>{ if(s.hidden||!s.a) return;
    [s.a,s.b].forEach(p=>ends.push({p, t:p[0]*u[0]+p[1]*u[1]})); });
  if(ends.length){
    ends.sort((a,b)=>a.t-b.t);
    out.push({m, kind:'line', at:ends[0].p.slice()});
    if(ends.length>1) out.push({m, kind:'line', at:ends[ends.length-1].p.slice()});
  }
  out.push({m, kind:'text', at:[g.text.x, g.text.y]});
  (g.ext||[]).forEach((e,i)=>{ if(!e.hidden) out.push({m, kind:'ext', idx:i, at:e.b.slice()}); });
  return out;
}
/* Section markers use the same grip machinery as dimensions. */
let secDrag=null;
function secGripAt(pg, wx, wy){
  const tol=(DIM_GRIP_PX+3)/Math.max(view.s,1e-6);
  for(const h of secGrips(pg)) if(Math.hypot(h.at[0]-wx, h.at[1]-wy)<=tol) return h;
  return null;
}
function beginSecDrag(hit){
  snapshot();
  const s=hit.s, u=secAxis(s);
  secDrag={ s, kind:hit.kind, idx:hit.idx, u, leg0:s.leg,
    ends0:s.ends.map(e=>e.p.slice()), moved:false };
}
function updateSecDrag(wx,wy){
  if(!secDrag) return;
  const D=secDrag, s=D.s, pg=activePage(); if(!pg) return;
  const u=D.u, other=D.ends0[1-D.idx];
  if(D.kind==='end'){
    /* slide this end along the cut's own line; it can never cross the other end */
    const t=(wx-other[0])*u[0] + (wy-other[1])*u[1];
    const sign=(D.idx===0)? -1 : 1;
    const len=Math.max(4, t*sign);
    s.ends[D.idx].p=[other[0]+u[0]*len*sign, other[1]+u[1]*len*sign];
  }else{
    /* the leg: how far the arrow stands off the cut, both ends kept the same so
       the marker stays symmetrical the way a drawing office would draw it */
    const E=s.ends[D.idx], v=E.view;
    s.leg=Math.max(s.arrow.len*1.2, (wx-E.p[0])*v[0] + (wy-E.p[1])*v[1]);
  }
  secApply(pg, s, null);
  D.moved=true; render();
}
function endSecDrag(){
  if(!secDrag) return;
  if(secDrag.moved) afterMutate(); else { history.undo.pop(); updateUndoButtons(); }
  secDrag=null;
}
function drawSecGrips(pg){
  const gs=secGrips(pg); if(!gs.length) return false;
  ctx.save(); ctx.setLineDash([]);
  gs.forEach(h=>{ const q=W2S(h.at[0], h.at[1]);
    ctx.fillStyle='#fff'; ctx.strokeStyle=(h.kind==='leg')?'#00a37a':'#0077ff'; ctx.lineWidth=1.5;
    ctx.fillRect(q.x-DIM_GRIP_PX, q.y-DIM_GRIP_PX, DIM_GRIP_PX*2, DIM_GRIP_PX*2);
    ctx.strokeRect(q.x-DIM_GRIP_PX, q.y-DIM_GRIP_PX, DIM_GRIP_PX*2, DIM_GRIP_PX*2); });
  ctx.restore();
  return true;
}
function dimModelGripAt(pg, wx, wy){
  const tol=(DIM_GRIP_PX+3)/Math.max(view.s,1e-6);
  /* Nearest wins, not first-listed. Grips can sit close together - the value is
     only a millimetre off its own dimension line - so "first in the list" would
     hand every click to whichever grip happened to be built first. */
  let best=null, bd=Infinity;
  dimModelGrips(pg).forEach(h=>{ const d=Math.hypot(h.at[0]-wx, h.at[1]-wy);
    if(d<=tol && d<bd){ bd=d; best=h; } });
  return best;
}
/* Clicking anywhere along the dimension line picks it up too - same as CAD. */
function dimModelLineAt(pg, wx, wy){
  const id=selectedDimId(); if(!id) return null;
  const m=dimModelById(pg,id); if(!m) return null;
  dimBake(pg,m);
  const g=dimGeomOf(m), tol=6/Math.max(view.s,1e-6);
  /* Walk every drawn edge, including the multi-point ones (the run in to the
     centre mark, and its zig-zag). Treating those as if they were simple two-point
     segments threw inside the mousedown handler, which killed the rest of the
     click - which is why the selection could never move on to another dimension. */
  for(const seg of g.segs){
    if(seg.hidden) continue;
    const pts=seg.pts || (seg.a? [seg.a, seg.b] : null);
    if(!pts || pts.length<2) continue;
    for(let i=0;i+1<pts.length;i++){
      const a=pts[i], b=pts[i+1];
      const dx=b[0]-a[0], dy=b[1]-a[1], L=Math.hypot(dx,dy);
      if(L<1e-9) continue;
      const ux=dx/L, uy=dy/L, vx=wx-a[0], vy=wy-a[1];
      const t=vx*ux+vy*uy;
      if(t<-tol || t>L+tol) continue;
      if(Math.abs(-vx*uy+vy*ux)<=tol){
        /* Grabbing the run in to the centre mark stretches THAT, not the landing.
           Hunting for the little cross is fiddly when several dimensions share a
           hub centre, so the whole line is a handle for it. */
        if(g.radial && seg.role==='cen') return {m, kind:'radrun', at:[wx,wy]};
        return {m, kind:(g.radial?'radial':'line'), at:[wx,wy]};
      }
    }
  }
  return null;
}
let dimMDrag=null;
function beginDimModelDrag(hit, wx, wy){
  snapshot();
  const m=hit.m, u=m.dir||[1,0], n=[-u[1],u[0]];
  const g0=dimGeomOf(m);
  dimMDrag={ m, kind:hit.kind, idx:hit.idx, moved:false, u, n, start:[wx,wy],
    landY0:(m.land? m.land.y : 0),
    q0:(m.line? m.line.q : 0), t0:g0.text.t, dq0:g0.text.dq,
    over0:((m.ext&&m.ext.overshoot)||[]).slice() };
}
function updateDimModelDrag(wx,wy){
  if(!dimMDrag) return;
  const D=dimMDrag, m=D.m, pg=activePage(); if(!pg) return;
  if(D.kind==='radrun'){
    /* Only the length of the run changes: the arrowhead stays on the arc and the
       run stays on the true radius, so the dimension keeps meaning what it meant.
       Pulled back out to the real centre, the foreshortening disappears by itself. */
    const P=m.point, C=m.centre;
    const vx=C[0]-P[0], vy=C[1]-P[1], R=Math.hypot(vx,vy)||1;
    const ux=vx/R, uy=vy/R;
    const t=(wx-P[0])*ux + (wy-P[1])*uy;
    m.run.len = (t>=R-0.5) ? null : Math.max(m.line.arrow*2, t);
    dimApply(pg, m); D.moved=true; render(); return;
  }
  if(D.kind==='angarc' || D.kind==='angtext'){
    const C=m.centre;
    const r=Math.hypot(wx-C[0], wy-C[1]);
    if(D.kind==='angarc'){
      /* The arc follows the cursor outwards. The angle it measures cannot change -
         that is fixed by the two lines it was drawn between - so only the distance
         moves, and the value stays true however far it is dragged. */
      m.radius=Math.max((m.line.arrow||2.5)*1.5, r);
      m.text.tr=null;                       /* the value goes back to riding the arc */
    }else{
      /* The value goes exactly where it is dragged. Keeping it to a fraction of the
         sweep sounded tidy and was useless: on a 22 degree angle that is a few
         millimetres of travel, so the value stuck a short way from the cursor and
         would not follow. Every other kind of dimension lets its value be put
         where the draughtsman wants it, and so does this one. */
      const a=Math.atan2(wy-C[1], wx-C[0]);
      /* Home is the middle of the arc, one clear space out - the same 4 px every
         other dimension keeps between its value and its line. Dropping the value
         near there snaps it back and hands the spacing to the model again, so it
         cannot be left a hair off centre or crowding the arc. */
      const homeA=m.a0+m.sweep/2, homeR=dimArcTextR(m);
      const home=[C[0]+homeR*Math.cos(homeA), C[1]+homeR*Math.sin(homeA)];
      const snap=Math.max(1.5, (m.text.h||2.5)*0.9);
      if(Math.hypot(wx-home[0], wy-home[1])<=snap){
        /* Snapped home means PLACED home, not "decide for me". Clearing the
           placing entirely handed the choice back to the automatic rule, which
           saw there was no room and pushed the arrowheads straight back outside -
           so the stubs could never be taken in. */
        m.text.ta=homeA; m.text.tr=null;
      }
      else {
        /* Only the ANGLE follows the cursor: the value rides the arc, keeping the
           clear space the model gives it. Letting the radius follow too lifted the
           number off its own line, which is the thing the arc is there to carry. */
        m.text.ta=a; m.text.tr=null;
      }
    }
    dimApply(pg, m); D.moved=true; render(); return;
  }
  if(D.kind==='radial'){
    /* Dragging away from the arc lengthens the leader - as far as the drawing
       needs, because the leader is a LENGTH now and not the point where a ray
       happens to cross the value's height. Sideways slides the value along the
       landing, which stretches to keep carrying it; crossing the leader swaps the
       reading side. */
    const R=Math.hypot(m.centre[0]-m.point[0], m.centre[1]-m.point[1])||1;
    const ux=(m.point[0]-m.centre[0])/R, uy=(m.point[1]-m.centre[1])/R;   // outwards
    /* The value should end up UNDER THE CURSOR. The landing is horizontal, so the
       elbow has to be at the cursor's height: slide it along the radius until it
       is. Only projecting the cursor onto the radius threw away everything the
       drag did across it, and the value lagged behind by as much as 21 mm.
       When the radius runs almost horizontally there is no such point, so we fall
       back to the projection - the honest best a radial leader can do. */
    let len;
    if(Math.abs(uy)>0.05) len=(wy-m.point[1])/uy;
    else len=(wx-m.point[0])*ux + (wy-m.point[1])*uy;
    m.land.len=Math.max(-1e4, Math.min(1e4, len));
    const g=dimGeomOf(m);
    m.land.side=((wx-g.elbow[0])>=0)?1:-1;
    const off=Math.abs(wx-g.elbow[0]);
    m.land.off=(off<=dimGeomOf(m).text.offMin*1.25)? null : off;   // near home = default
    dimApply(pg, m); D.moved=true; render(); return;
  }
  const du=(wx-D.start[0])*D.u[0]+(wy-D.start[1])*D.u[1];
  const dn=(wx-D.start[0])*D.n[0]+(wy-D.start[1])*D.n[1];
  if(D.kind==='line'){
    /* Stretch: the dimension line slides away from the part. The extension lines
       are recomputed to reach it, so they can never come up short. The text keeps
       its own offset across the line, so it travels with it. */
    m.line.q=D.q0+dn;
  }else if(D.kind==='text'){
    /* The value slides along its dimension line and snaps back to the middle; a
       null `t` means "centred", so releasing on the middle restores the default
       rather than pinning a number that happens to equal it. */
    const home=dimTextHome(m);
    const S=dimSpanOf(m), mid=(S.tA+S.tB)/2, w=dimTextSize(m);
    let t=D.t0+du;
    /* Snap to the middle of the measured span whenever the value can sit there.
       Without this, a value that only just fits between the extension lines could
       be left a fraction of a millimetre out by the mouse and would flip straight
       back to the outside form. */
    if(Math.abs(t-mid)<(m.text.h||2.5)*0.9 && (S.tB-S.tA)>=w-1e-6) t=mid;
    m.text.t = (Math.abs(t-home) < (m.text.h||2.5)*0.9) ? null : t;
    /* The form follows the value, in BOTH directions. Dragged out past an
       extension line: the arrows flip outward and the line jogs out to carry the
       value. Dragged back in between them: that outside piece is cut away and the
       arrows turn back in. The drawing's original form is not privileged here -
       a dimension that arrived jogged must still be able to come home. */
    dimFitForm(m);
    /* Dragging ACROSS the line does nothing at all. The value belongs on its own
       dimension line at a fixed gap, on the side the drawing chose; letting a
       sideways drag pull it over to the other side turned a plain dimension into
       something that read like a leader, which is not what the grip is for.
       The only thing this grip moves is the value ALONG its line. */
    m.text.gapPx=DIM_TXT_GAP_PX;
  }else if(D.kind==='ext'){
    /* Only the cosmetic overhang past the dimension line moves: the end that
       touches the part stays put, so the measured value never changes. */
    const S=dimSpanOf(m), qi=(D.idx===0?S.q1:S.q2);
    const s=(m.line.q>=qi)?1:-1;
    m.ext.overshoot[D.idx]=Math.max(0.5, D.over0[D.idx]+dn*s);
  }
  dimApply(pg, m);
  D.moved=true;
  render();
}
function endDimModelDrag(){
  if(!dimMDrag) return;
  if(dimMDrag.moved) afterMutate(); else { history.undo.pop(); updateUndoButtons(); }
  dimMDrag=null;
}
function drawDimModelGrips(pg){
  const gs=dimModelGrips(pg); if(!gs.length) return false;
  ctx.save(); ctx.setLineDash([]);
  gs.forEach(h=>{ const q=W2S(h.at[0], h.at[1]);
    ctx.fillStyle=(h.kind==='text')?'#fff3cd':'#fff';
    ctx.strokeStyle=(h.kind==='ext'||h.kind==='radrun')?'#00a37a':'#0077ff'; ctx.lineWidth=1.5;
    ctx.fillRect(q.x-DIM_GRIP_PX, q.y-DIM_GRIP_PX, DIM_GRIP_PX*2, DIM_GRIP_PX*2);
    ctx.strokeRect(q.x-DIM_GRIP_PX, q.y-DIM_GRIP_PX, DIM_GRIP_PX*2, DIM_GRIP_PX*2); });
  ctx.restore();
  return true;
}

/* ---- STYLIZE, done on the model (Dimension-Design.md §5 step 5) ------------
   The old pass hunted for "the longest segment running along the text" and then
   bent whatever it found. With a model there is nothing to hunt for: the value
   goes in the middle of its own dimension line, and where the gap is too narrow
   it goes in the middle of the jog that the standard puts there for exactly this
   purpose. Because these are settings, running STYLIZE again changes nothing. */
function dimStylizeText(pg, m, txtH){
  dimBake(pg, m);
  m.text.h=txtH;
  /* One arrowhead size for every dimension on the sheet - the size the paper size
     asks for - set before the form is decided, because the form asks whether the
     value fits BETWEEN the two heads and has to be asked about the heads the
     drawing will actually have. */
  if(txtH){ const A=dimArrowFor(); m.line.arrow=A.h; m.line.arrowW=A.w; }
  if(m.kind==='radial'||m.kind==='diameter'){
    m.text.gapPx=DIM_TXT_GAP_PX; m.text.rot=0; m.text.align=1;
    m.land.off=null;                 // value back to the head of its own landing
    dimApply(pg, m); return true;
  }
  m.text.align=1;
  m.text.t=null;                       // back to centred on its own dimension line
  m.text.gapPx=DIM_TXT_GAP_PX;         // and back to the standard gap
  dimFitForm(m);                       // and to whichever form now suits it
  dimApply(pg, m);
  return true;
}
