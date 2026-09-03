/* ============================================================================
   §13  BRINGING A SAVED PROJECT UP TO DATE
   ----------------------------------------------------------------------------
   A project is saved with its dimension and section MODELS inside it. Open it in a
   newer build and those models are restored exactly as they were written - by the
   older code, with the older fields and the older strings. Nothing re-reads the
   DXF, because the DXF is long gone.

   The effect is that every improvement appears to have done nothing: the values
   keep the decimals they were saved with, the markers keep the shape they were
   saved in, and pressing STYLIZE changes nothing, because STYLIZE faithfully
   redraws the stale model it was handed.

   So on opening, any model older than the current build is brought up to date.
   What is kept is what a drawing actually asserts - the points that were measured,
   the centre, the radius, the viewing direction. What is rebuilt is everything
   derived from those, which is exactly what the newer rules are about.
   ========================================================================== */
const MODEL_VERSION=3;

function dimMigrateModel(m){
  if(!m || m.v===MODEL_VERSION) return false;
  m.text=m.text||{};
  if(m.kind==='radial'||m.kind==='diameter'){
    m.land=m.land||{};
    if(m.land.len===undefined) m.land.len=null;
    if(m.land.off===undefined) m.land.off=null;
    if(m.land.side===undefined) m.land.side=1;
    if(m.land.y===undefined) m.land.y=(m.point?m.point[1]:0);
    m.run=m.run||{len:null};
    m.line=m.line||{};
    if(m.line.arrow===undefined) m.line.arrow=2.5;
    if(m.line.arrowW===undefined) m.line.arrowW=m.line.arrow/3;
  }else{
    m.ext=m.ext||{gap:[1,1], overshoot:[2.5,2.5], visible:[true,true]};
    m.line=m.line||{};
    if(m.line.stub===undefined) m.line.stub=[0,0];
    if(m.line.inside===undefined) m.line.inside=true;
    if(m.line.arrowW===undefined) m.line.arrowW=(m.line.arrow||2.5)/3;
    if(m.text.side===undefined) m.text.side=1;
    if(m.text.outSide===undefined) m.text.outSide=1;
  }
  if(m.text.gapPx===undefined) m.text.gapPx=DIM_TXT_GAP_PX;
  if(m.text.align===undefined) m.text.align=1;
  /* The number is the point of the whole exercise: split the saved string so the
     wrapper is kept and the number goes back to being measured and formatted. */
  if(m.text.prefix===undefined && m.text.suffix===undefined){
    const saved=(m.text.override!=null? m.text.override : m.text.value);
    try{ dimSplitValue(m, saved); }catch(e){}
  }
  m.v=MODEL_VERSION;
  return true;
}
function secMigrateModel(s){
  if(!s || s.v===MODEL_VERSION) return false;
  s.leg=(s.leg==null? SEC_LEG_MM : s.leg);
  s.label=s.label||{};
  if(s.label.h==null) s.label.h=3.5;
  if(s.label.gapPx==null) s.label.gapPx=SEC_LABEL_GAP_PX;
  s.arrow=s.arrow||{len:3.5, wid:1.2};
  s.v=MODEL_VERSION;
  return true;
}
/* An older save has no memory of which polylines were circles - that was only
   added later - so a radius has nothing to check itself against and cannot be
   rebuilt. The polyline still IS a circle though: every one of its points is the
   same distance from one centre. Fit that centre and the arc comes back. */
function recFitCircle(pts){
  const n=pts&&pts.length; if(!n || n<5) return null;
  let Sx=0,Sy=0,Sxx=0,Syy=0,Sxy=0,Sxz=0,Syz=0,Sz=0;
  for(let i=0;i<n;i++){ const x=pts[i][0], y=pts[i][1], z=x*x+y*y;
    Sx+=x; Sy+=y; Sxx+=x*x; Syy+=y*y; Sxy+=x*y; Sxz+=x*z; Syz+=y*z; Sz+=z; }
  const A=[[Sxx,Sxy,Sx],[Sxy,Syy,Sy],[Sx,Sy,n]], B=[-Sxz,-Syz,-Sz];
  const det=(m)=>m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1])
                -m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0])
                +m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0]);
  const D=det(A); if(Math.abs(D)<1e-9) return null;
  const rep=(k)=>{ const m=A.map(r=>r.slice()); for(let i=0;i<3;i++) m[i][k]=B[i]; return det(m)/D; };
  const a=rep(0), b=rep(1), c=rep(2);
  const cx=-a/2, cy=-b/2, r2=cx*cx+cy*cy-c;
  if(!(r2>1e-9)) return null;
  const r=Math.sqrt(r2);
  let worst=0;
  for(let i=0;i<n;i++) worst=Math.max(worst, Math.abs(Math.hypot(pts[i][0]-cx, pts[i][1]-cy)-r));
  if(worst>Math.max(0.02, r*0.002)) return null;      /* not a circle at all */
  const ang=(q)=>{ const t=Math.atan2(q[1]-cy,q[0]-cx)*180/Math.PI; return (t%360+360)%360; };
  const closed=Math.hypot(pts[0][0]-pts[n-1][0], pts[0][1]-pts[n-1][1])<Math.max(0.01,r*0.001);
  if(closed) return {cx, cy, r, a0:null, a1:null};
  const ccw=(f,t)=>((t-f)%360+360)%360;
  let a0=ang(pts[0]), a1=ang(pts[n-1]);
  const mid=ang(pts[Math.floor(n/2)]);
  if(ccw(a0,mid) > ccw(a0,a1)){ const t=a0; a0=a1; a1=t; }
  return {cx, cy, r, a0, a1};
}
/* Give an older drawing its circles back, so radii can be checked and so the
   export writes CIRCLE and ARC instead of many-sided polygons. */
function migrateRound(pg){
  const d=pg&&pg.dxf; if(!d||!d.polys) return 0;
  let n=0;
  d.polys.forEach(p=>{
    if(p._round || !p.pts || p.pts.length<5) return;
    const R=recFitCircle(p.pts);
    if(R){ p._round=R; n++; }
  });
  return n;
}
/* A project saved before models existed has NO models at all - only the lines,
   arrowheads and numbers that were drawn. There is no DXF left to re-read, but
   none is needed: those shapes are exactly what the recovery pass reads. So an old
   project is rebuilt from its own drawing, the same way a drawing that never
   declared its dimensions is. */
function migrateRebuild(pg){
  const d=pg&&pg.dxf; if(!d || !d.polys || !d.polys.length) return 0;
  let n=0;
  try{
    if(!d.secs || !d.secs.length) d.secs=v2SectionModels(d, 1)||[];
    n+=(d.secs||[]).length;
  }catch(err){ console.warn('section rebuild failed', err); }
  try{ n+=stylizeScan(pg); }catch(err){ console.warn('dimension rebuild failed', err); }
  return n;
}
/* Run over every page of a project as it is opened. */
function migrateProject(st){
  if(!st||!st.pages) return 0;
  let n=0;
  st.pages.forEach(pg=>{
    const d=pg&&pg.dxf; if(!d) return;
    (d.dims||[]).forEach(m=>{ if(dimMigrateModel(m)) n++; });
    (d.secs||[]).forEach(s=>{ if(secMigrateModel(s)) n++; });
    if(pg.type==='sheet'){ migrateRound(pg);
      if(!(d.dims||[]).length) n+=migrateRebuild(pg); }
  });
  return n;
}
