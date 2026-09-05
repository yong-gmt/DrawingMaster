import os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.makedirs(os.path.join(ROOT,'drawing-master'), exist_ok=True)
import sys, shutil
SRC = os.path.join(ROOT, 'src', 'base.html')
# The finished app, in a folder named after the thing rather than after the
# step that made it: anyone opening the repo can see which file to open.
DST = os.path.join(ROOT, 'drawing-master', 'DrawingMaster.html')
shutil.copy(SRC,DST)
s=open(DST).read()
mod=open(os.path.join(ROOT,'src','modules','dimmodel.js')).read()

def rep(old,new,n=1):
    global s
    assert s.count(old)==n, (s.count(old), old[:80])
    s=s.replace(old,new)

# ---- 1. insert module -------------------------------------------------------
rep("function convertDXF_v2(parsed, text){", mod+"\nfunction convertDXF_v2(parsed, text){")

# ---- 2. out carries the models ---------------------------------------------
rep("  const out={polys:[], texts:[], hatches:[], solids:[], marks:[], clines:[]};\n  const skipped={}; let hatchIssues=0;",
    "  const out={polys:[], texts:[], hatches:[], solids:[], marks:[], clines:[], dims:[]};\n  const skipped={}; let hatchIssues=0;")

# ---- 3. build a model for every DIMENSION -----------------------------------
rep("""            const prev=curDim; curDim='dim'+(dimSeq++);
            const prevRot=curDimTextRot; curDimTextRot=v2DimTextRot(e);
            walk(b.entities, M, depth+1);
            curDim=prev; curDimTextRot=prevRot;""",
"""            const prev=curDim; curDim='dim'+(dimSeq++);
            const prevRot=curDimTextRot; curDimTextRot=v2DimTextRot(e);
            const i0=out.polys.length, s0=out.solids.length, x0=out.texts.length;
            walk(b.entities, M, depth+1);
            // Build the dimension MODEL from the entity's own definition points
            // (groups 10/13/14) rather than guessing which drawn line is which.
            // If the model redraws the block faithfully we replace the loose lines
            // with model-driven ones; if not, the original geometry is left alone.
            const raw={polys:out.polys.slice(i0), solids:out.solids.slice(s0), texts:out.texts.slice(x0)};
            let md=null;
            try{ md=v2DimModel(e, T, mm, curDim, raw); }catch(err){ md=null; console.warn('dim model failed', curDim, err); }
            if(md){
              // Read the model; do NOT draw it. Importing shows the file the way
              // its author drew it. Nothing changes until STYLIZE is pressed.
              md.pending=md.ok;
              out.dims.push(md);
            }
            curDim=prev; curDimTextRot=prevRot;""")

# ---- 4. centring must carry the models --------------------------------------
rep("  (d.clines||[]).forEach(c=>{ c.x+=dx; c.y+=dy; });\n}\nfunction fitToDXF(pg){",
    "  (d.clines||[]).forEach(c=>{ c.x+=dx; c.y+=dy; });\n  (d.dims||[]).forEach(m=>dimTranslate(m,dx,dy));\n  // A hatch pattern is anchored to a base point in the drawing, so that point has\n  // to travel with the drawing - otherwise the fill crawls across its own shape.\n  (d.hatches||[]).forEach(ht=>(ht.fams||[]).forEach(f=>{ f.base=[f.base[0]+dx, f.base[1]+dy]; }));\n}\nfunction fitToDXF(pg){")

# ---- 5. the cluster guard must not drop the models --------------------------
rep("""  ['polys','texts','solids','marks','hatches','clines'].forEach(list=>{
    sub[list]=(d[list]||[]).filter((_,i)=>keep[list].has(i));
  });
  return sub;""",
"""  ['polys','texts','solids','marks','hatches','clines'].forEach(list=>{
    sub[list]=(d[list]||[]).filter((_,i)=>keep[list].has(i));
  });
  // Dimension models are not primitives, so they are not clustered - carry the
  // ones whose lines survived, otherwise their geometry loses its source of truth.
  const live=new Set(sub.polys.map(p=>p._dim).filter(Boolean));
  sub.dims=(d.dims||[]).filter(m=>live.has(m.id));
  return sub;""")

# ---- 6. arrowheads keep the drawing's own 3:1 proportions ------------------
rep("  const size=(A.h||2.5);", "  const size=(A.h||2.5), halfW=(A.w? A.w/2 : size/6);   // ASME/ISO 3:1")
rep("    const w=size*0.32;", "    const w=halfW;")

# ---- 7. model-driven grips --------------------------------------------------
grips=open(os.path.join(ROOT,'src','modules','dimgrips.js')).read()
rep("function dimStretchAt(wx,wy){", grips+"""function dimStretchAt(wx,wy){
  // A modelled dimension is edited through its model, never by bending its lines.
  const pg=activePage();
  if(pg && pg.type==='sheet'){
    const g=dimModelGripAt(pg,wx,wy);  if(g) return {kind:'model', g};
    const l=dimModelLineAt(pg,wx,wy);  if(l) return {kind:'model', g:l};
  }
""")
rep("""function dimStretchAt(wx,wy){
  // A modelled dimension is edited through its model, never by bending its lines.
  const pg=activePage();
  if(pg && pg.type==='sheet'){
    const g=dimModelGripAt(pg,wx,wy);  if(g) return {kind:'model', g};
    const l=dimModelLineAt(pg,wx,wy);  if(l) return {kind:'model', g:l};
  }

  const h=dimHandleAt(wx,wy);""",
"""function dimStretchAt(wx,wy){
  // A modelled dimension is edited through its model, never by bending its lines.
  //
  // ONLY the small grip squares reshape anything. Everywhere else on a selected
  // dimension stays free for dragging the whole thing about - which is what a
  // person expects, and which was impossible while the entire dimension line
  // counted as a handle: every attempt to move a dimension slid its value instead.
  const pg=activePage();
  if(pg && pg.type==='sheet'){
    const g=dimModelGripAt(pg,wx,wy);  if(g) return {kind:'model', g};
  }
  const h=dimHandleAt(wx,wy);""")

# grips are drawn instead of the old handle boxes when a model is in charge
rep("""function drawDimHandles(){
  const pg=activePage(); if(!pg||pg.type!=='sheet') return;
  const hs=dimHandles(pg); if(!hs.length) return;""",
"""function drawDimHandles(){
  const pg=activePage(); if(!pg||pg.type!=='sheet') return;
  if(drawDimModelGrips(pg)) return;
  const hs=dimHandles(pg); if(!hs.length) return;""")

# mouse wiring
rep("""      if(dhit){ if(dhit.kind==='end') beginDimDrag(dhit.h);
                else beginDimLineDrag(dhit.l, w.x, w.y);""",
"""      if(dhit){ if(dhit.kind==='model') beginDimModelDrag(dhit.g, w.x, w.y);
                else if(dhit.kind==='end') beginDimDrag(dhit.h);
                else beginDimLineDrag(dhit.l, w.x, w.y);""")
rep("    if(dimDrag){ if(dimDrag.mode==='line') updateDimLineDrag(w.x,w.y); else updateDimDrag(w.x,w.y); return; }",
    "    if(dimMDrag){ updateDimModelDrag(w.x,w.y); return; }\n    if(dimDrag){ if(dimDrag.mode==='line') updateDimLineDrag(w.x,w.y); else updateDimDrag(w.x,w.y); return; }")
rep("    if(dimDrag){ endDimDrag(); }", "    if(dimMDrag){ endDimModelDrag(); }\n    if(dimDrag){ endDimDrag(); }")
rep("    stage.style.cursor = dhz ? (dhit.kind==='end'?'crosshair':'move')",
    "    stage.style.cursor = dhz ? ((dhit.kind==='end'||(dhit.g&&dhit.g.kind==='ext'))?'crosshair':'move')")

# test hooks
rep("  updateDimDrag:(x,y)=>updateDimDrag(x,y), endDimDrag:()=>endDimDrag(),",
    """  updateDimDrag:(x,y)=>updateDimDrag(x,y), endDimDrag:()=>endDimDrag(),
  dimModels:(pg)=>dimModelsOf(pg), dimModelById:(pg,id)=>dimModelById(pg,id),
  dimGeomOf:(m)=>dimGeomOf(m), S2W:(x,y)=>S2W(x,y), buildObjects:(pg)=>buildObjects(pg),
  stylizeLeftovers:(pg)=>stylizeLeftovers(pg), stylizeScan:(pg)=>stylizeScan(pg), recArrows:(o)=>recCollectArrows(o), recDims:(o,mm)=>v2RecoverDims(o,mm,{n:900}), dimTextRole:(s)=>dimTextRole(s), hatchFamilies:(h)=>hatchFamilies(h), hatchStep:(f)=>hatchStep(f), hatchDashArray:(d,k)=>hatchDashArray(d,k), dimTextWidth:(s,h)=>dimTextWidth(s,h), dimFitForm:(m)=>dimFitForm(m), dimFitForm:(m)=>dimFitForm(m), dimModelGrips:(pg)=>dimModelGrips(pg),
  dimApply:(pg,m)=>dimApply(pg,m), activePage:()=>activePage(),""")

# ---- 8. a grip is a precise target: it wins over the title-block zone -------
rep("""    const tb=tbRect(); if(w.x>=tb.x&&w.x<=tb.x+TB_W&&w.y>=tb.y&&w.y<=tb.y+TB_H) return;  // title block handled by dblclick
    { const dhit=dimStretchAt(w.x,w.y);              // stretch a dimension""",
"""    // A dimension grip, or a dimension lying over the title block area, is an exact
    // target the user is aiming at, so it outranks the title-block zone. Without
    // this a dimension that overlaps the block could never be selected at all.
    const dpre=dimStretchAt(w.x,w.y);
    const tb=tbRect();
    if(!dpre && w.x>=tb.x&&w.x<=tb.x+TB_W&&w.y>=tb.y&&w.y<=tb.y+TB_H){
      const over=objAtPoint(w.x,w.y);
      if(!over || !over._dim) return;                // the block itself: dblclick edits it
    }
    { const dhit=dpre;                               // stretch a dimension""")

# ---- 9. STYLIZE and arrow attachment defer to the model --------------------
rep("""  let moved=0;
  Object.values(byDim).forEach(g=>{
    if(g.texts.length!==1 || !g.lines.length) return;      // only simple, unambiguous cases""",
"""  let moved=0;
  // Modelled dimensions are placed from their model - no guessing which line is
  // which, and no cumulative bending when STYLIZE is pressed again.
  dimModelsOf(pg).forEach(m=>{ if(m.ok && dimStylizeText(pg, m, txtH)){ moved++; delete byDim[m.id]; } });
  Object.values(byDim).forEach(g=>{
    if(g.texts.length!==1 || !g.lines.length) return;      // only simple, unambiguous cases""")

rep("""  dimIds.forEach(id=>{
    const an=dimAnalyse(pg,id); if(!an) return;""",
"""  const modelled=new Set(dimModelsOf(pg).filter(m=>m.ok).map(m=>m.id));
  dimIds.forEach(id=>{
    if(modelled.has(id)) return;        // its arrows are already caps of its line
    const an=dimAnalyse(pg,id); if(!an) return;""")

# ---- 10. the ANSI passes leave modelled dimensions alone -------------------
# A modelled radius already draws the correct ANSI form (one arrow on the arc, a
# radial leader, a horizontal landing carrying the value). Letting the old pass
# hunt for "the leader's shoulder" among those primitives would style it twice.
rep("""function isAnnotationPrim(p){
  if(!p) return false;""",
"""function isAnnotationPrim(p){
  if(!p) return false;
  if(p._dimPart) return false;          // owned by a dimension model, not up for grabs""")
rep("    pg.objects.forEach(o=>(o.prims.texts||[]).forEach(t=>{ if(isRadT(t)) radTexts.push({o,t,ax:t.x+(o.dx||0),ay:t.y+(o.dy||0)}); }));",
    "    pg.objects.forEach(o=>(o.prims.texts||[]).forEach(t=>{ if(!t._dimPart && isRadT(t)) radTexts.push({o,t,ax:t.x+(o.dx||0),ay:t.y+(o.dy||0)}); }));")
rep("  pg.objects.forEach(ob=>{ (ob.prims.texts||[]).forEach(t=>{ if(!t._ansiDone) t.h=txtH; textN++; }); });",
    "  pg.objects.forEach(ob=>{ (ob.prims.texts||[]).forEach(t=>{ if(!t._ansiDone && !t._dimPart) t.h=txtH; textN++; }); });")

# ---- 11. re-lay-out dimensions once the sheet position is final ------------
# Whether a radius is "far" depends on where the centre lands ON THE SHEET, which
# is only known after centring and the cluster guard have had their say.
rep("""function dimModelsOf(pg){""",
"""function dimRelayout(pg){
  let n=0;
  dimModelsOf(pg).forEach(m=>{ if(m.ok && !m.pending){ try{ dimApply(pg,m); n++; }catch(e){} } });
  return n;
}
function dimModelsOf(pg){""")
rep("  centerDXF(pg); buildObjects(pg); afterMutate(); fitToDXF(pg);",
    "  centerDXF(pg); buildObjects(pg); dimRelayout(pg); afterMutate(); fitToDXF(pg);")
rep("  snapshot(); pg.dxf=pg._allDxf; pg._allDxf=null; pg._clusterGuard=null;",
    "  snapshot(); pg.dxf=pg._allDxf; pg._allDxf=null; pg._clusterGuard=null;\n  buildObjects(pg); dimRelayout(pg);")
rep("  dimModels:(pg)=>dimModelsOf(pg),", "  dimModels:(pg)=>dimModelsOf(pg), dimRelayout:(pg)=>dimRelayout(pg),")

# ---- 12. picking: an annotation wins a tie against the part underneath -----
# Extension lines and leaders deliberately sit on top of the geometry they point
# at. When both are under the cursor, the one being aimed at is the annotation:
# the part edge can still be reached anywhere else along its length.
rep("""function objAtPoint(wx,wy){
  const objs=selectableObjs(); const tolW=6/view.s;
  for(let i=objs.length-1;i>=0;i--){ if(objHit(objs[i],wx,wy,tolW)) return objs[i]; }
  return null;
}""",
"""function objAtPoint(wx,wy){
  const objs=selectableObjs(); const tolW=6/view.s;
  let plain=null;
  for(let i=objs.length-1;i>=0;i--){
    if(!objHit(objs[i],wx,wy,tolW)) continue;
    if(objs[i]._dim) return objs[i];        // a dimension part is what you aimed at
    if(!plain) plain=objs[i];
  }
  return plain;
}""")

# ---- 13. hatch pattern engine ----------------------------------------------
def lib(name):
    """Inline a real ES module into the single-file build.

    src/lib/*.js are components: they import nothing, export their functions, and
    are unit-tested in Node without a browser. The app is still one global scope,
    so the export keywords come off on the way in. When base.html is finally split
    up this step disappears and the imports become real."""
    p=os.path.join(ROOT,'src','lib',name)
    return open(p).read().replace('export function','function')

hatch=lib('hatch-pattern.mjs')+'\n'+open(os.path.join(ROOT,'src','modules','hatch.js')).read()
rep("function drawHatchOff(h,lw,dx,dy){", hatch+"function drawHatchOff(h,lw,dx,dy){")

# carry the pattern's base, offset and dashes through the import, in world mm
rep("""            lines:(e.definitionLines||[]).map(L=>({ angle:L.angle||0,
              bx:(L.base&&L.base.x)||0, by:(L.base&&L.base.y)||0,
              ox:(L.offset&&L.offset.x)||0, oy:(L.offset&&L.offset.y)||0 })) });""",
"""            lines:(e.definitionLines||[]).map(L=>({ angle:L.angle||0,
              bx:(L.base&&L.base.x)||0, by:(L.base&&L.base.y)||0,
              ox:(L.offset&&L.offset.x)||0, oy:(L.offset&&L.offset.y)||0 })),
            // The pattern lives in the same space as the geometry, so its base
            // point, its offset and its dash lengths all have to come through the
            // block transform and the unit factor too. Leaving them in raw file
            // units made the spacing wrong on any drawing that was not 1:1 in mm.
            fams:(e.definitionLines||[]).map(L=>{
              const O0=m2Apply(T,[0,0]);
              const VEC=(v)=>{ const q=m2Apply(T,v); return [(q[0]-O0[0])*mm, (q[1]-O0[1])*mm]; };
              const a=L.angle||0;
              const dir=VEC([Math.cos(a), Math.sin(a)]);
              const k=Math.hypot(...VEC([1,0]))||1;         // uniform scale of the transform
              return { dir, base:P([(L.base&&L.base.x)||0, (L.base&&L.base.y)||0]),
                       off:VEC([(L.offset&&L.offset.x)||0, (L.offset&&L.offset.y)||0]),
                       dashes:(L.dashes&&L.dashes.length)? L.dashes.map(v=>v*mm*k) : null };
            }) });""")

# ---- 14. draw from the pattern's own frame ---------------------------------
rep("""  const cx=(mnx+mxx)/2, cy=(mny+mxy)/2, diag=Math.hypot(mxx-mnx,mxy-mny)+2;
  const scale=(h.scale&&h.scale>0)?h.scale:1;
  // draw each pattern definition line family from the file; fall back to ANSI31 (45 deg)
  // The parser already converts both the pattern angle (group 52) and each pattern
  // definition line angle (group 53) to RADIANS. Converting again turned a 45 degree
  // ANSI31 section fill into an almost horizontal one, so use them as they arrive.
  const fams=(h.lines&&h.lines.length)?h.lines:[{angle:Math.PI/4, ox:0, oy:3.18}];
  fams.forEach(f=>{
    const ang=(f.angle||0)+(h.angle||0);
    const off=Math.hypot(f.ox||0, f.oy||0) || 3.18;          // spacing between lines (pattern units)
    const gap=Math.max(3, mm2px(off*scale));
    const ddx=Math.cos(ang), ddy=-Math.sin(ang);             // screen Y is flipped
    const nx=-ddy, ny=ddx;
    for(let t=-diag;t<=diag;t+=gap){ const px=cx+nx*t, py=cy+ny*t;
      ctx.beginPath(); ctx.moveTo(px-ddx*diag,py-ddy*diag); ctx.lineTo(px+ddx*diag,py+ddy*diag); ctx.stroke(); }
  });
  ctx.restore();""",
"""  // Work in WORLD millimetres and let the pattern's own base point decide where
  // the lines fall, so neighbouring regions with the same pattern line up and the
  // fill does not crawl when the shape is moved.
  let wx0=1e9, wy0=1e9, wx1=-1e9, wy1=-1e9;
  h.loops.forEach(L=>L.forEach(pt=>{ const x=pt[0]+dx, y=pt[1]+dy;
    if(x<wx0)wx0=x; if(y<wy0)wy0=y; if(x>wx1)wx1=x; if(y>wy1)wy1=y; }));
  const corners=[[wx0,wy0],[wx1,wy0],[wx0,wy1],[wx1,wy1]];
  const oldCap=ctx.lineCap; ctx.lineCap='butt';
  hatchFamilies(h).forEach(f=>{
    const S=hatchStep(f);
    if(!(S.spacing>1e-9)) return;
    // how many lines of this family cross the shape, and how far along each one
    let k0=1e9, k1=-1e9, s0=1e9, s1=-1e9;
    corners.forEach(c=>{
      const vx=c[0]-f.base[0], vy=c[1]-f.base[1];
      const kk=(vx*S.nx+vy*S.ny)/S.spacing, ss=vx*S.ux+vy*S.uy;
      if(kk<k0)k0=kk; if(kk>k1)k1=kk; if(ss<s0)s0=ss; if(ss>s1)s1=ss; });
    k0=Math.floor(k0)-1; k1=Math.ceil(k1)+1;
    // Thin the family out rather than stretch it when it would be denser than the
    // screen can show: the lines that DO get drawn stay on the true family, so the
    // pattern never drifts off its own grid.
    const px=mm2px(S.spacing);
    let step=1; if(px<1.2) step=Math.ceil(1.2/Math.max(px,1e-6));
    if((k1-k0)/step > 4000) step=Math.ceil((k1-k0)/4000);
    const pad=Math.max(2, mm2px(1));
    const dash=hatchDashArray(f.dashes, 1);
    for(let k=Math.ceil(k0/step)*step; k<=k1; k+=step){
      const px0=f.base[0]+f.off[0]*k, py0=f.base[1]+f.off[1]*k;
      const A=W2S(px0+S.ux*s0, py0+S.uy*s0), B=W2S(px0+S.ux*s1, py0+S.uy*s1);
      const len=Math.hypot(B.x-A.x, B.y-A.y);
      if(len<0.5) continue;
      if(dash){
        // the dash pattern is measured from the family's own reference point, so
        // successive lines stagger exactly as the pattern intends
        ctx.setLineDash(dash.map(v=>Math.max(0.1, mm2px(v))));
        ctx.lineDashOffset=mm2px(s0);
      } else { ctx.setLineDash([]); ctx.lineDashOffset=0; }
      const ex=(B.x-A.x)/len, ey=(B.y-A.y)/len;
      ctx.beginPath();
      ctx.moveTo(A.x-ex*pad, A.y-ey*pad);
      ctx.lineTo(B.x+ex*pad, B.y+ey*pad);
      ctx.stroke();
    }
  });
  ctx.setLineDash([]); ctx.lineDashOffset=0; ctx.lineCap=oldCap;
  ctx.restore();""")

# ---- 15. section markers ---------------------------------------------------
sec=open(os.path.join(ROOT,'src','modules','section.js')).read()
rep("function convertDXF_v2(parsed, text){", sec+"function convertDXF_v2(parsed, text){")
rep("  const out={polys:[], texts:[], hatches:[], solids:[], marks:[], clines:[], dims:[]};",
    "  const out={polys:[], texts:[], hatches:[], solids:[], marks:[], clines:[], dims:[], secs:[]};")
rep("  walk(roots, m2Id(), 0);\n  return {out, skipped, hatchIssues, spaceInfo, mm};",
    "  walk(roots, m2Id(), 0);\n  // Tie each cutting-plane marker together - its strokes, its arrowheads and its\n  // letters - so it can be selected and restyled as the one thing it is.\n  try{ out.secs=v2SectionModels(out, mm); }catch(err){ out.secs=[]; console.warn('section scan failed', err); }\n  return {out, skipped, hatchIssues, spaceInfo, mm};")
rep("  (d.dims||[]).forEach(m=>dimTranslate(m,dx,dy));",
    "  (d.dims||[]).forEach(m=>dimTranslate(m,dx,dy));\n  (d.secs||[]).forEach(m=>secTranslate(m,dx,dy));")
rep("  const live=new Set(sub.polys.map(p=>p._dim).filter(Boolean));\n  sub.dims=(d.dims||[]).filter(m=>live.has(m.id));",
    "  const live=new Set(sub.polys.map(p=>p._dim).filter(Boolean));\n  sub.dims=(d.dims||[]).filter(m=>live.has(m.id));\n  const liveSec=new Set(sub.polys.map(p=>p._sec).filter(Boolean));\n  sub.secs=(d.secs||[]).filter(m=>liveSec.has(m.id));")

# a section marker selects and moves as one piece, letters included
rep("""    const dim=o&&o._dim;
    let grp=null;
    if(dim){ grp=dimGroups[dim] || (dimGroups[dim]='g'+(_gidSeq++)); }
    objs.push({ id:'o'+(_oidSeq++), dx:0, dy:0, group:grp, _dim:dim||null, prims }); };""",
"""    const dim=o&&o._dim, sec=o&&o._sec, bal=o&&o._bal;
    let grp=null;
    if(dim){ grp=dimGroups[dim] || (dimGroups[dim]='g'+(_gidSeq++)); }
    else if(sec){ grp=dimGroups[sec] || (dimGroups[sec]='g'+(_gidSeq++)); }
    else if(bal){ grp=dimGroups[bal] || (dimGroups[bal]='g'+(_gidSeq++)); }
    objs.push({ id:'o'+(_oidSeq++), dx:0, dy:0, group:grp, _dim:dim||null, _sec:sec||null,
                _bal:bal||null, prims }); };""")

# STYLIZE: drive the markers from the model instead of hunting for their pieces
rep("""  if(f.ansiSection){
    const abs=(o,p)=>[p[0]+(o.dx||0),p[1]+(o.dy||0)];""",
"""  if(f.ansiSection){
    // Modelled markers know their own viewing direction, so they are restyled
    // straight from the model. Only markers we could not read fall through to the
    // old geometry hunt below.
    const modelled=new Set();
    secModelsOf(pg).forEach(sm=>{ if(sm.ok && secApply(pg, sm, txtH)){ modelled.add(sm.id); sectionN++; } });
    const abs=(o,p)=>[p[0]+(o.dx||0),p[1]+(o.dy||0)];""")
rep("    pg.objects.forEach(o=>(o.prims.polys||[]).forEach(p=>{ if(!p._ansi && p.pts.length>=2 && isAnnotationPrim(p))\n      allLines.push({o,p, a:abs(o,p.pts[0]), b:abs(o,p.pts[p.pts.length-1]), sec:!!p._section}); }));",
    "    pg.objects.forEach(o=>(o.prims.polys||[]).forEach(p=>{ if(p._sec) return;\n      if(!p._ansi && p.pts.length>=2 && isAnnotationPrim(p))\n      allLines.push({o,p, a:abs(o,p.pts[0]), b:abs(o,p.pts[p.pts.length-1]), sec:!!p._section}); }));")
rep("    pg.objects.forEach(o=>(o.prims.texts||[]).forEach(t=>{ const s=String(t.text).trim();\n      if(/^[A-H]$/.test(s)) (byLetter[s]||(byLetter[s]=[])).push({o,t,x:t.x+(o.dx||0),y:t.y+(o.dy||0)}); }));",
    "    pg.objects.forEach(o=>(o.prims.texts||[]).forEach(t=>{ const s=String(t.text).trim();\n      if(t._sec) return;                       // already handled from its model\n      if(/^[A-H]$/.test(s)) (byLetter[s]||(byLetter[s]=[])).push({o,t,x:t.x+(o.dx||0),y:t.y+(o.dy||0)}); }));")

rep("  dimModels:(pg)=>dimModelsOf(pg),", "  dimModels:(pg)=>dimModelsOf(pg), secModels:(pg)=>secModelsOf(pg),\n  secGeomOf:(s)=>secGeomOf(s), secApply:(pg,s,h)=>secApply(pg,s,h),")

# ---- 16. attaching arrows must not shrink them on a second press -----------
# The size is measured from the arrowhead SOLIDs, which the first press consumes.
# On the second press there is nothing left to measure and the size fell back to
# the default, so the arrows quietly changed size every other press.
rep("""    let size=2.5;
    if(found.length){ const sd=found[0].sd;""",
"""    let size=(line._arrow&&line._arrow.h)||2.5;
    if(found.length){ const sd=found[0].sd;""")

# ---- 17. moving the drawing must not strip tags off the arrowheads ---------
# Re-mapping a solid built a brand-new array and left its _dim / _sec tags behind,
# so after centring nobody could tell which dimension or marker an arrowhead
# belonged to any more - which is why the file's original section arrows survived
# STYLIZE and sat on top of the new ones.
rep("  (d.solids||[]).forEach((sd,i)=>d.solids[i]=sd.map(M));",
    """  (d.solids||[]).forEach((sd,i)=>{ const n=sd.map(M);
    if(sd._dim) n._dim=sd._dim; if(sd._sec) n._sec=sd._sec; d.solids[i]=n; });""")
rep("  (d.solids||[]).forEach((sd,i)=>d.solids[i]=sd.map(pt=>[pt[0]+dx,pt[1]+dy]));",
    """  (d.solids||[]).forEach((sd,i)=>{ const n=sd.map(pt=>[pt[0]+dx,pt[1]+dy]);
    if(sd._dim) n._dim=sd._dim; if(sd._sec) n._sec=sd._sec; d.solids[i]=n; });""")

# ---- 18. section grips into the mouse handling ------------------------------
rep("""    const g=dimModelGripAt(pg,wx,wy);  if(g) return {kind:'model', g};""",
    """    const sg=secGripAt(pg,wx,wy);      if(sg) return {kind:'sec', g:sg};
    const g=dimModelGripAt(pg,wx,wy);  if(g) return {kind:'model', g};""")
rep("      if(dhit){ if(dhit.kind==='model') beginDimModelDrag(dhit.g, w.x, w.y);",
    "      if(dhit){ if(dhit.kind==='sec') beginSecDrag(dhit.g);\n                else if(dhit.kind==='model') beginDimModelDrag(dhit.g, w.x, w.y);")
rep("    if(dimMDrag){ updateDimModelDrag(w.x,w.y); return; }",
    "    if(secDrag){ updateSecDrag(w.x,w.y); return; }\n    if(dimMDrag){ updateDimModelDrag(w.x,w.y); return; }")
rep("    if(dimMDrag){ endDimModelDrag(); }", "    if(secDrag){ endSecDrag(); }\n    if(dimMDrag){ endDimModelDrag(); }")
rep("""function drawDimHandles(){
  const pg=activePage(); if(!pg||pg.type!=='sheet') return;
  if(drawDimModelGrips(pg)) return;""",
"""function drawDimHandles(){
  const pg=activePage(); if(!pg||pg.type!=='sheet') return;
  if(drawSecGrips(pg)) return;
  if(drawDimModelGrips(pg)) return;""")
rep("  secGeomOf:(s)=>secGeomOf(s),", "  secGeomOf:(s)=>secGeomOf(s), secGrips:(pg)=>secGrips(pg), secAxis:(s)=>secAxis(s),")

# ---- 19. STYLIZE only resizes ITS OWN annotation ---------------------------
# It was setting every imported text to the sheet font size - notes, view labels,
# the drawing frame's zone letters and the title block along with the dimension
# values. On a drawing whose own text is 1.75 mm that turned all 44 of them into
# 7 mm and buried the sheet. Dimension values and section letters are STYLIZE's to
# format; everything else belongs to the drawing.
rep("  pg.objects.forEach(ob=>{ (ob.prims.texts||[]).forEach(t=>{ if(!t._ansiDone && !t._dimPart) t.h=txtH; textN++; }); });",
    """  pg.objects.forEach(ob=>{ (ob.prims.texts||[]).forEach(t=>{
    if(!t._dim && !t._sec) return;                 // the drawing's own text: leave it
    if(!t._ansiDone && !t._dimPart) t.h=txtH;      // modelled ones size themselves
    textN++; }); });""")

# ---- 20. a drawing-office default text size --------------------------------
# 20 pt is 7.06 mm. ISO 3098 / ASME Y14.2 put dimension figures at about 3.5 mm,
# and the drawings coming in use 1.75-2.5 mm, so the old default buried every
# sheet the moment STYLIZE ran. 10 pt is 3.53 mm - the standard height - and the
# field stays there to be changed.
rep("    paper:'A4', margin:10, font:'Arial', fontSize:20, decimals:2, stroke:0.2,",
    "    paper:'A4', margin:10, font:'Arial', fontSize:10, decimals:2, stroke:0.2,")
rep("""<div class="with-u"><input class="inp2" id="fSize" type="number" min="4" step="1" value="${f.fontSize}"><span class="u">pt</span></div></div>""",
    """<div class="with-u"><input class="inp2" id="fSize" type="number" min="4" step="1" value="${f.fontSize}"><span class="u">pt</span></div>
              <div class="hint" style="font-size:11px;color:#6b7178;margin-top:4px">10 pt &asymp; 3.5 mm (ISO)</div></div>""")
rep("  on('fSize','input',e=>{ f.fontSize=+e.target.value||20; updateFormatPreviews(); });",
    "  on('fSize','input',e=>{ f.fontSize=+e.target.value||10; updateFormatPreviews(); });")
rep("  const h=(store.format.fontSize||20)*PT_TO_MM;", "  const h=(store.format.fontSize||10)*PT_TO_MM;")
rep("  const txtH=(f.fontSize||20)*PT_TO_MM;         // all text -> Format Config size (pt -> mm)",
    "  const txtH=(f.fontSize||10)*PT_TO_MM;         // dimension text -> Format Config size (pt -> mm)")

# ---- 21. tell annotation text from the sheet's own furniture ---------------
# Notes and view labels ARE annotation and should end up in one house style with
# the dimensions. The drawing frame and the title block are not: they are the
# sheet's furniture, drawn to a fixed size, and resizing them wrecks the sheet.
# The layer says which is which, and the title-block area is a second check for
# files that name their layers something else.
rep("""          out.texts.push({ _dim:curDim, x:q[0], y:q[1], h:hgt, text:str,""",
    """          out.texts.push({ _dim:curDim, _layer:e.layer, x:q[0], y:q[1], h:hgt, text:str,""")
rep("""function isAnnotationPrim(p){""",
"""/* Text that belongs to the sheet rather than to the drawing: the border with its
   zone letters, and the title block. Never restyled.
   The layer name catches most of it, but a title block is usually a block whose
   attributes carry some other layer, so the area the title-block text occupies is
   worked out from the file itself and anything sitting inside it is left alone. */
function sheetFurnitureBox(pg){
  let a=1e9,b=1e9,c=-1e9,d=-1e9, any=false;
  (pg.objects||[]).forEach(o=>(o.prims.texts||[]).forEach(t=>{
    if(!/^title|title\\s*block/i.test(String(t._layer||''))) return;
    const x=t.x+(o.dx||0), y=t.y+(o.dy||0);
    any=true; if(x<a)a=x; if(y<b)b=y; if(x>c)c=x; if(y>d)d=y; }));
  if(!any) return null;
  const pad=6;
  const box={x0:a-pad, y0:b-pad, x1:c+pad, y1:d+pad};
  /* One stray text on a title layer, out on the drawing, stretches this box across
     the sheet. A title block does not cover a quarter of the page, so when the box
     grows that large it is measuring the wrong thing and the sheet's own title
     block is the better answer. */
  try{
    const {W,H}=paperDims();
    if((box.x1-box.x0)*(box.y1-box.y0) > W*H*0.25) return null;
  }catch(e){}
  return box;
}
function isSheetFurniture(t, o, box){
  if(!t) return false;
  if(/border|frame|title\\s*block|^title/i.test(String(t._layer||''))) return true;
  const x=t.x+((o&&o.dx)||0), y=t.y+((o&&o.dy)||0);
  if(box && x>=box.x0 && x<=box.x1 && y>=box.y0 && y<=box.y1) return true;
  try{ const tb=tbRect();
    if(x>=tb.x && x<=tb.x+TB_W && y>=tb.y && y<=tb.y+TB_H) return true; }catch(e){}
  return false;
}
function isAnnotationPrim(p){""")
rep("""  pg.objects.forEach(ob=>{ (ob.prims.texts||[]).forEach(t=>{
    if(!t._dim && !t._sec) return;                 // the drawing's own text: leave it
    if(!t._ansiDone && !t._dimPart) t.h=txtH;      // modelled ones size themselves
    textN++; }); });""",
"""  const furniture=sheetFurnitureBox(pg);
  pg.objects.forEach(ob=>{ (ob.prims.texts||[]).forEach(t=>{
    if(isSheetFurniture(t, ob, furniture)) return; // border and title block: not ours
    if(!t._ansiDone && !t._dimPart) t.h=txtH;      // modelled ones size themselves
    textN++; }); });""")

rep("  updateDimDrag:(x,y)=>updateDimDrag(x,y), endDimDrag:()=>endDimDrag(),",
    "  updateDimDrag:(x,y)=>updateDimDrag(x,y), endDimDrag:()=>endDimDrag(), entsToDXF:(e)=>entsToDXF(e),")

# ---- 22. a DXF that another CAD can edit -----------------------------------
dxfex=open(os.path.join(ROOT,'src','modules','dxfexport.js')).read()
rep("function entsToDXF(ents){", dxfex+"function entsToDXF(ents){")
rep("""function captureSheet(page){
  const rec=makeRecorder(); const oCtx=ctx,oView=view,oAct=store.activeId,oCv=cv;
  try{ ctx=rec; cv=rec.canvas; view={s:1,tx:0,ty:0,zoom:1,dpr:1}; store.activeId=page.id;
    drawFrame(); drawEntities(page); if(page.bom) drawBOM(page); drawTitleBlock(page);""",
"""function captureSheet(page, opts){
  const rec=makeRecorder(); const oCtx=ctx,oView=view,oAct=store.activeId,oCv=cv;
  try{ ctx=rec; cv=rec.canvas; view={s:1,tx:0,ty:0,zoom:1,dpr:1}; store.activeId=page.id;
    drawFrame(); if(!(opts&&opts.skipEntities)) drawEntities(page);
    if(page.bom) drawBOM(page); drawTitleBlock(page);""")
rep("""  const ents=captureSheet(pg); if(!ents.length){ toast('ไม่มีข้อมูลให้ส่งออก'); return; }
  const dxf=entsToDXF(ents);
  const name=(store.name||'drawing').replace(/[^\\w\\-]+/g,'_')+'_'+(pg.name||'sheet').replace(/[^\\w\\-]+/g,'_')+'.dxf';
  downloadBlob(dxf, name, 'application/dxf'); toast('ส่งออก DXF แล้ว ('+ents.length+' entity)');""",
"""  const R=buildDXF(pg);
  const name=(store.name||'drawing').replace(/[^\\w\\-]+/g,'_')+'_'+(pg.name||'sheet').replace(/[^\\w\\-]+/g,'_')+'.dxf';
  downloadBlob(R.text, name, 'application/dxf');
  toast('exported DXF · '+R.dimensions+' editable dimensions · '+R.layers.length+' layers');""")
rep("convertDXF_v2:(p,t)=>convertDXF_v2(p,t), exportDXF:()=>exportDXF(),",
    "convertDXF_v2:(p,t)=>convertDXF_v2(p,t), exportDXF:()=>exportDXF(), buildDXF:(pg)=>buildDXF(pg),")

# ---- 23. keep circles round -------------------------------------------------
# Arcs and circles were flattened into polylines at import and there was nothing
# left to write them back out with, so every hole in the exported file came out as
# a many-sided polygon instead of a CIRCLE. Remember what the entity WAS, so it can
# leave as the same thing it arrived as.
rep("""  const emitPoly=(pts, M, e, dash)=>{
    if(!pts||pts.length<2) return;
    const O=v2Ocs(e); const T=O? m2Mul(M,O) : M;
    out.polys.push({ _src:e.type, _layer:e.layer, _dim:curDim, pts:pts.map(p=>{ const q=m2Apply(T,p); return [q[0]*mm, q[1]*mm]; }),
      dash:(dash!==undefined?dash:dashFor({name:e.layer, lineTypeName:e.lineType})),
      _section:_secLayer({name:e.layer}) });
  };""",
"""  const emitPoly=(pts, M, e, dash, round)=>{
    if(!pts||pts.length<2) return;
    const O=v2Ocs(e); const T=O? m2Mul(M,O) : M;
    const p={ _src:e.type, _layer:e.layer, _dim:curDim, pts:pts.map(p=>{ const q=m2Apply(T,p); return [q[0]*mm, q[1]*mm]; }),
      dash:(dash!==undefined?dash:dashFor({name:e.layer, lineTypeName:e.lineType})),
      _section:_secLayer({name:e.layer}) };
    if(round){
      // The true circle behind the polygon, in world millimetres. The centre and
      // radius come through the transform, but the START and END ANGLES are read
      // back off the drawn points instead: a block that mirrors its contents
      // reverses the sweep, and adding the transform's rotation to the original
      // angles got that backwards - by as much as 180 degrees on 96 arcs across
      // the sample drawings. The drawn points cannot be wrong about themselves.
      const c=m2Apply(T,[round.cx, round.cy]);
      const r0=m2Apply(T,[round.cx+round.r, round.cy]);
      const rr=Math.hypot(r0[0]-c[0], r0[1]-c[1])*mm;
      const C=[c[0]*mm, c[1]*mm];
      if(rr>1e-6){
        let a0=null, a1=null;
        if(round.a0!=null && p.pts.length>2){
          const ang=(q)=>{ const a=Math.atan2(q[1]-C[1], q[0]-C[0])*180/Math.PI; return (a%360+360)%360; };
          const first=ang(p.pts[0]), last=ang(p.pts[p.pts.length-1]);
          const midA=ang(p.pts[Math.floor(p.pts.length/2)]);
          const ccw=(from,to)=>((to-from)%360+360)%360;
          // DXF arcs always sweep counter-clockwise from 50 to 51, so put the ends
          // in whichever order actually contains the middle of the drawn arc
          a0=first; a1=last;
          if(ccw(first,midA) > ccw(first,last)){ a0=last; a1=first; }
        }
        p._round={cx:C[0], cy:C[1], r:rr, a0, a1};
      }
    }
    out.polys.push(p);
  };""")
rep("""          emitPoly(v2Arc(c.x||0,c.y||0, e.radius||0, a0, a1), M, e);""",
    """          emitPoly(v2Arc(c.x||0,c.y||0, e.radius||0, a0, a1), M, e, undefined,
                   {cx:c.x||0, cy:c.y||0, r:e.radius||0, a0, a1});""")
rep("""          emitPoly(v2Arc(c.x||0,c.y||0, e.radius||0, 0, 360), M, e);""",
    """          emitPoly(v2Arc(c.x||0,c.y||0, e.radius||0, 0, 360), M, e, undefined,
                   {cx:c.x||0, cy:c.y||0, r:e.radius||0, a0:null, a1:null});""")
rep("  d.polys.forEach(p=>p.pts=p.pts.map(pt=>[pt[0]+dx,pt[1]+dy]));",
    """  d.polys.forEach(p=>{ p.pts=p.pts.map(pt=>[pt[0]+dx,pt[1]+dy]);
    if(p._round){ p._round.cx+=dx; p._round.cy+=dy; } });""")

# ---- 24. a diameter reads on ONE side only ---------------------------------
# Drawing the line right across the circle put an arrowhead on the far side, away
# from the value, where it says nothing. The dimension is read from the side the
# value is on, so that is the only side that needs a line.
rep("""      if(m.kind==='diameter' && userRun==null){
        /* a diameter reads right across the circle, and the far side gets its own
           arrowhead - also standing outside the circle, also pointing in */
        segs.push({role:'cen', pts:[at(2*run), P.slice()], arrow:null});
        const tail=m.line.arrow*1.8;
        segs.push({role:'dimO', a:at(2*run+tail), b:at(2*run),
          arrow:{s:false, e:true, h:m.line.arrow, w:m.line.arrowW}});
      }else{
        segs.push({role:'cen', pts:[at(L), P.slice()], arrow:null});
      }""",
"""      segs.push({role:'cen', pts:[at(L), P.slice()], arrow:null});""")

# ---- 25. previews that show what you actually set ---------------------------
# The stroke preview was a grey bar with no ends, and the type preview guessed at
# a pixel size. Both are now drawn to scale from the settings themselves, with the
# arrowheads a dimension really has, so what you set is what you see.
rep("""            <div class="body"><div id="strokePrevWrap">
              <span id="strokePrevTxt">1.25 mm</span><div id="strokePrevLine"></div></div></div></div>""",
"""            <div class="body"><canvas id="strokePrev" style="width:100%;height:64px"></canvas></div></div>""")
rep("""  const st2=$('#strokePrevTxt'); if(st2) st2.textContent=fmtNum(f.stroke,f.decimals)+' mm';
  const sv=$('#fStrokeVal'); if(sv) sv.textContent=(+f.stroke).toFixed(2).replace(/0$/,'')+'mm';
  const ln=$('#strokePrevLine'); if(ln) ln.style.height=Math.max(1,f.stroke*12)+'px';
  const st=$('#strokePrevTxt'); if(st) st.style.fontFamily=f.font+',Arial';""",
"""  const sv=$('#fStrokeVal'); if(sv) sv.textContent=(+f.stroke).toFixed(2).replace(/0$/,'')+'mm';
  drawStrokePreview();""")
rep("""/* live title-block preview — drawn with the very same renderer as the sheet */""",
"""/* A dimension drawn to the settings themselves: the stroke weight you chose, the
   font and text height you chose, and real arrowheads at 3:1 - so the preview is
   the thing, not a picture of the thing. */
function drawStrokePreview(){
  const cvs=$('#strokePrev'); const f=fmtDraft; if(!cvs||!f) return;
  const wcss=cvs.clientWidth||420, hcss=64, dpr=window.devicePixelRatio||1;
  cvs.width=Math.round(wcss*dpr); cvs.height=Math.round(hcss*dpr);
  const c=cvs.getContext('2d'); c.setTransform(dpr,0,0,dpr,0,0);
  c.clearRect(0,0,wcss,hcss);
  const spanMM=60, px=(wcss-24)/spanMM;            // millimetres to preview pixels
  const y=Math.round(hcss*0.66)+0.5, x0=12, x1=wcss-12;
  const lw=Math.max(1, f.stroke*px), ah=Math.max(4, 2.5*px), aw=ah/3;
  c.strokeStyle='#111'; c.fillStyle='#111'; c.lineWidth=lw; c.lineCap='butt';
  c.beginPath(); c.moveTo(x0,y); c.lineTo(x1,y); c.stroke();
  [[x0,1],[x1,-1]].forEach(([x,d])=>{                // the arrowheads it really has
    c.beginPath(); c.moveTo(x,y);
    c.lineTo(x+d*ah, y-aw/2); c.lineTo(x+d*ah, y+aw/2); c.closePath(); c.fill(); });
  const th=Math.max(9, (f.fontSize||10)*PT_TO_MM*px);
  c.font=th+'px '+f.font+',Arial';
  c.textAlign='center'; c.textBaseline='alphabetic';
  // the same clear space the sheet uses: 4 px at paper scale, measured to the ink
  const gap=(4/PX_PER_MM)*px;
  c.fillText(fmtNum(spanMM,f.decimals), (x0+x1)/2, y-gap-lw/2);
}

/* live title-block preview — drawn with the very same renderer as the sheet */""")

# ---- 26. the previews fit, and say the height in millimetres ---------------
rep("""  const spanMM=60, px=(wcss-24)/spanMM;            // millimetres to preview pixels
  const y=Math.round(hcss*0.66)+0.5, x0=12, x1=wcss-12;
  const lw=Math.max(1, f.stroke*px), ah=Math.max(4, 2.5*px), aw=ah/3;""",
    """  const spanMM=60;
  let px=(wcss-24)/spanMM;                         // millimetres to preview pixels
  // a big text height must not run off the top of the box: shrink the whole
  // preview to fit rather than clip the number, which is the one thing being shown
  const need=()=>(f.fontSize||10)*PT_TO_MM*px + (4/PX_PER_MM)*px + f.stroke*px + 8;
  if(need()>hcss*0.92) px*=hcss*0.92/need();
  const w2=spanMM*px, x0=(wcss-w2)/2, x1=x0+w2;
  const y=Math.round(hcss-14)+0.5;
  const lw=Math.max(1, f.stroke*px), ah=Math.max(4, 2.5*px), aw=ah/3;""")

# ---- 27. the two previews must agree, and show the extension lines ---------
# The typography preview sized its text with a CSS pixel guess (fontSize x 1.15)
# that had no relation to millimetres: at 10 pt it drew 8 px of ink where the sheet
# draws 3.53 mm. The stroke preview was the honest one. Both now draw on a canvas
# at the SAME millimetres-per-pixel, so they cannot disagree.
rep("""            <div class="body"><span id="typoPrev">&#216; 24.5 &middot; A-A &middot; M8&times;1.25</span></div></div>""",
    """            <div class="body"><canvas id="typoPrev" style="width:100%;height:64px"></canvas></div></div>""")
rep("""  const tp=$('#typoPrev');
  if(tp){ tp.style.fontFamily=f.font+',Arial'; tp.style.fontSize=Math.max(10,f.fontSize*1.15)+'px';
    const d=f.decimals;
    tp.innerHTML='&#216; '+fmtNum(24.5,d)+' &middot; A-A &middot; M8&times;'+fmtNum(1.25,d); }""",
    """  drawTypoPreview();""")
rep("""/* A dimension drawn to the settings themselves: the stroke weight you chose, the
   font and text height you chose, and real arrowheads at 3:1 - so the preview is
   the thing, not a picture of the thing. */""",
    """/* One scale for every preview, so they show the same millimetre as the same
   number of pixels and can never contradict each other. */
function previewScale(wcss, hcss, spanMM){
  const f=fmtDraft;
  let px=(wcss-24)/spanMM;
  const need=()=>(f.fontSize||10)*PT_TO_MM*px + (4/PX_PER_MM)*px + (f.stroke||0.2)*px + 10;
  if(need()>hcss*0.92) px*=hcss*0.92/need();
  return px;
}
/* The type sample, drawn at its true height on the sheet - not at a pixel size
   that merely looks about right. */
function drawTypoPreview(){
  const cvs=$('#typoPrev'); const f=fmtDraft; if(!cvs||!f) return;
  const wcss=cvs.clientWidth||420, hcss=64, dpr=window.devicePixelRatio||1;
  cvs.width=Math.round(wcss*dpr); cvs.height=Math.round(hcss*dpr);
  const c=cvs.getContext('2d'); c.setTransform(dpr,0,0,dpr,0,0);
  c.clearRect(0,0,wcss,hcss);
  let px=previewScale(wcss,hcss,60);
  const d=f.decimals;
  const sample='\\u2300 '+fmtNum(24.5,d)+'  \\u00B7  A-A  \\u00B7  M8\\u00D7'+fmtNum(1.25,d);
  let th=(f.fontSize||10)*PT_TO_MM*px;
  c.font=th+'px '+f.font+',Arial';
  /* previewScale only ever shrank for HEIGHT; at a large text size the sample ran
     off both ends of its box and came out clipped and smeared. Shrink for WIDTH
     too, and leave a margin, rather than clip the one thing being shown. */
  const room=wcss-24, wide=c.measureText(sample).width;
  if(wide>room){ px*=room/wide; th=(f.fontSize||10)*PT_TO_MM*px; c.font=th+'px '+f.font+',Arial'; }
  c.fillStyle='#111'; c.textAlign='center'; c.textBaseline='middle';
  c.fillText(sample, wcss/2, hcss/2-4);
  c.font='12px '+f.font+',Arial'; c.fillStyle='#8a8f96';
  c.fillText((f.fontSize*PT_TO_MM).toFixed(2)+' mm', wcss/2, hcss-10);
}

/* A dimension drawn to the settings themselves: the stroke weight you chose, the
   font and text height you chose, and real arrowheads at 3:1 - so the preview is
   the thing, not a picture of the thing. */""")
rep("""  const spanMM=60;
  let px=(wcss-24)/spanMM;                         // millimetres to preview pixels
  // a big text height must not run off the top of the box: shrink the whole
  // preview to fit rather than clip the number, which is the one thing being shown
  const need=()=>(f.fontSize||10)*PT_TO_MM*px + (4/PX_PER_MM)*px + f.stroke*px + 8;
  if(need()>hcss*0.92) px*=hcss*0.92/need();
  const w2=spanMM*px, x0=(wcss-w2)/2, x1=x0+w2;
  const y=Math.round(hcss-14)+0.5;""",
    """  const spanMM=60, px=previewScale(wcss,hcss,spanMM);
  const w2=spanMM*px, x0=(wcss-w2)/2, x1=x0+w2;
  const y=Math.round(hcss-14)+0.5;""")
rep("""  [[x0,1],[x1,-1]].forEach(([x,d])=>{                // the arrowheads it really has
    c.beginPath(); c.moveTo(x,y);
    c.lineTo(x+d*ah, y-aw/2); c.lineTo(x+d*ah, y+aw/2); c.closePath(); c.fill(); });""",
    """  [[x0,1],[x1,-1]].forEach(([x,d])=>{                // the arrowheads it really has
    c.beginPath(); c.moveTo(x,y);
    c.lineTo(x+d*ah, y-aw/2); c.lineTo(x+d*ah, y+aw/2); c.closePath(); c.fill(); });
  // ...and the extension lines the arrowheads point at, which is what tells you
  // the weight applies to a dimension and not just to a stroke
  const ext=2.5*px;
  [x0,x1].forEach(x=>{ c.beginPath();
    c.moveTo(x+0.5, y-ext); c.lineTo(x+0.5, y+ext*0.55); c.stroke(); });""")

# ---- 28. the old control codes are text, not literals ----------------------
# %%c %%d %%p are how DXF has written the diameter sign, the degree sign and the
# plus-minus sign since forever. Left undecoded they print as "4x %%c16" instead
# of "4x \u230016" - and any file from a CAD that still uses them reads as garbage.
rep("function v2MtextPlain(s){ return (typeof mtextPlain==='function')?mtextPlain(s||''):String(s||''); }",
    """function v2CtrlCodes(s){
  return String(s==null?'':s)
    .replace(/%%[cC]/g,'\\u2300').replace(/%%[dD]/g,'\\u00B0').replace(/%%[pP]/g,'\\u00B1')
    .replace(/%%%/g,'%').replace(/%%(\\d{3})/g, (_,n)=>String.fromCharCode(+n));
}
function v2MtextPlain(s){ return v2CtrlCodes((typeof mtextPlain==='function')?mtextPlain(s||''):String(s||'')); }""")
rep("          const str=(e.type==='MTEXT')? v2MtextPlain(raw) : String(raw||'');",
    "          const str=(e.type==='MTEXT')? v2MtextPlain(raw) : v2CtrlCodes(raw);")

# ---- 28. a dimension with no block is still a dimension --------------------
# Some writers leave the DIMENSION entity to be regenerated and store no block for
# it. We were dropping those on the floor: no geometry, no model, nothing drawn.
# The definition points are all we actually need, so author the dimension from
# them instead of discarding it.
rep("""          } else skipped['DIMENSION']=(skipped['DIMENSION']||0)+1;
          break; }""",
"""          } else {
            const prev=curDim; curDim='dim'+(dimSeq++);
            let md=null;
            try{ md=v2DimModel(e, T, mm, curDim, {polys:[],solids:[],texts:[]}); }
            catch(err){ md=null; }
            if(md && md.ok){
              md.pending=true;             // waiting for STYLIZE
              out.dims.push(md);
            } else skipped['DIMENSION']=(skipped['DIMENSION']||0)+1;
            curDim=prev;
          }
          break; }""")

# ---- 28. rebuild dimensions in drawings that never declared any ------------
rec=open(os.path.join(ROOT,'src','modules','recover.js')).read()
rep("function convertDXF_v2(parsed, text){", rec+"function convertDXF_v2(parsed, text){")
rep("""  try{ out.secs=v2SectionModels(out, mm); }catch(err){ out.secs=[]; console.warn('section scan failed', err); }""",
"""  // Section markers are identified FIRST. Their signature is unmistakable - two
  // arrowheads looking the same way with a pair of letters - so claiming them
  // early stops the dimension rebuild from mistaking one of their arrowheads for
  // part of a measurement.
  try{ out.secs=v2SectionModels(out, mm); }catch(err){ out.secs=[]; console.warn('section scan failed', err); }
  // A drawing that never declared its dimensions still HAS them - as lines,
  // arrowheads and numbers. Rebuild those so the rest of the program cannot tell
  // the difference between a drawing that labelled itself and one that did not.
  try{
    const seq={n:1};
    const rec=v2RecoverDims(out, mm, seq);
    rec.forEach(m=>{
      // A rebuilt dimension is NOT re-fitted against the raw strokes: the fit test
      // exists to catch a DIMENSION entity we read wrongly, and here there is no
      // entity to read - the strokes ARE the source. Re-fitting would only measure
      // our own reconstruction against itself.
      if(!m.ok) return;
      m.pending=true;                      // read now, drawn when STYLIZE is pressed
      out.dims.push(m);
    });
  }catch(err){ console.warn('dimension recovery failed', err); }""")

# ---- 29. remove the guessing fallback --------------------------------------
# With dimensions rebuilt from geometry, the old guess-from-shape passes have
# nothing left to contribute - and on a drawing whose dimensions had been exploded
# they actively did harm: seven imaginary "section markers" invented out of stray
# letters, arrowheads planted in the middle of the part, values doubled up. The
# rule was already written down: what cannot be read is left alone. This deletes
# the code that broke it.
i=s.index("  // ---- RADIUS/DIAMETER -> ANSI")
j=s.index("  // normalise every text size (all texts)")
s = s[:i] + """  // A radius is drawn from its model (see the radial branch of dimGeomOf).
  // There is deliberately no guess-from-geometry pass any more.
""" + s[j:]

i=s.index("    const abs=(o,p)=>[p[0]+(o.dx||0),p[1]+(o.dy||0)];")
j=s.index("  // snapDimLineEnds removed:")
s = s[:i] + """  }
""" + s[j:]

rep("""  attachDimArrows(pg);                 // arrows become part of the dimension line
  placeDimensionText(pg, txtH);""",
"""  // attachDimArrows / placeDimensionText removed with the rest of the guessing:
  // both hunted for "the dimension line" among loose strokes, and both were wrong
  // often enough that the whole model was built to replace them.""")

# ---- 28. decode the MTEXT unicode escape on the way IN ---------------------
# A file may spell a diameter sign as \\U+2205. Without decoding it the text reads
# as "\\U+22055.00", which is not a number, so the whole dimension was invisible to
# the recovery pass - five diameters lost on the exploded test drawing.
rep("""function v2CtrlCodes(s){
  return String(s==null?'':s)""",
"""function v2CtrlCodes(s){
  return String(s==null?'':s)
    .replace(/\\\\U\\+([0-9A-Fa-f]{4})/g, (_,h)=>String.fromCharCode(parseInt(h,16)))""")

rep("  dimModels:(pg)=>dimModelsOf(pg),", "  dimModels:(pg)=>dimModelsOf(pg), recoverReport:(pg)=>((pg.dxf&&pg.dxf.recoverReport)||[]),")
rep("  try{ out.secs=v2SectionModels(out, mm); }", "  try{ out.secs=v2SectionModels(out, mm); }")

# ---- 30. STYLIZE becomes a loop --------------------------------------------
sty=open(os.path.join(ROOT,'src','modules','stylize.js')).read()
rep("function stylizeANSI(){", sty+"function stylizeANSI(){")
i=s.index("function stylizeANSI(){")
j=s.index("\n}\n", s.index("toast('STYLIZE \u2192 ANSI'", i))+3
s=s[:i]+"""function stylizeANSI(){
  const pg=activePage();
  if(!pg||pg.type!=='sheet'||!pg.objects||!pg.objects.length){ toast('open a sheet page with an imported drawing, then press Stylize'); return; }
  const f=store.format;
  snapshot();
  const txtH=(f.fontSize||10)*PT_TO_MM;
  let dims=0, secs=0, found=0, passes=0;
  // Keep going while each pass still turns up something new. A drawing whose
  // dimensions were not declared may need more than one look: the first pass can
  // take a stroke a later value needed, and the rescan puts that right.
  // take over the strokes of everything that was only READ at import\n  stylizeAdopt(pg);\n  for(; passes<STYLIZE_MAX_PASSES; passes++){
    const add=stylizeScan(pg);
    if(add){ found+=add; buildObjects(pg); dimRelayout(pg); }
    const r=stylizeApply(pg, txtH);
    dims=r.dims; secs=r.secs;
    if(!add) break;
  }
  // text that belongs to nobody: sized to the sheet, never moved
  const furniture=sheetFurnitureBox(pg);
  let textN=0;
  pg.objects.forEach(ob=>{ (ob.prims.texts||[]).forEach(t=>{
    if(isSheetFurniture(t, ob, furniture)) return;
    if(!t._dimPart && !t._sec) t.h=txtH;
    textN++; }); });
  afterMutate();
  const left=stylizeLeftovers(pg);
  const parts=['dimensions '+dims];
  if(secs) parts.push('sections '+secs);
  if(found) parts.push('rebuilt from geometry '+found);
  parts.push('texts '+textN);
  toast('STYLIZE \u2192 ANSI ('+parts.join(' · ')+')'
    + (left.length? (' — values still unmatched: '+left.length+'') : ' — nothing left over'));
}
"""+s[j:]

# ---- 31. a saved project is brought up to date when it is opened -----------
mig=open(os.path.join(ROOT,'src','modules','migrate.js')).read()
rep("function openProject(id){", mig+"function openProject(id){")
rep("""function openProject(id){
  store=DB.find(p=>p.id===id); if(!store) return;
  if(!store.activeId) store.activeId=store.pages[0].id;""",
"""function openProject(id){
  store=DB.find(p=>p.id===id); if(!store) return;
  if(!store.activeId) store.activeId=store.pages[0].id;
  // A project saved by an older build carries older models. Bring them up to date
  // and redraw from them, or every rule added since will appear to do nothing.
  try{
    store.pages.forEach(pg=>{ if(pg.type==='sheet' && pg.dxf && !pg.objects) buildObjects(pg); });
    const n=migrateProject(store);
    if(n){ store.pages.forEach(pg=>{ if(pg.type==='sheet' && pg.dxf){
      buildObjects(pg); dimRelayout(pg); } }); persist();
      console.log('project brought up to date:', n, 'models'); }
  }catch(err){ console.warn('project migration failed', err); }""")

# ---- 32. Add Text: upper case, bold, two points larger ---------------------
# A label a person adds is a title on the drawing, not another dimension value, so
# it is set apart deliberately: capitals, bold, and two points above the sheet's
# text size. The rule lives in one place so the drawn text, the box you type into
# and the exported file all agree.
rep("function addTextLabel(){", """/* The house style for a label the user adds. */
const USER_TEXT_PT_UP=2;                       /* points above the sheet text size */
function userTextHeightMM(){
  return ((store.format.fontSize||10)+USER_TEXT_PT_UP)*PT_TO_MM;
}
function userTextValue(s){ return String(s==null?'':s).toUpperCase(); }
function isUserText(t){ return !!(t && t._user); }
function addTextLabel(){""")
rep("""  const h=(store.format.fontSize||10)*PT_TO_MM;
  const t={ text:'TEXT', x:cx, y:cy, h, rot:0, align:1, _ruled:true, _user:true };""",
"""  const h=userTextHeightMM();
  // a second label must not land exactly on the first, where it would be hidden
  let ly=cy;
  (pg.objects||[]).forEach(o=>(o.prims.texts||[]).forEach(x=>{
    if(x._user && Math.abs((x.x+(o.dx||0))-cx)<h*8 && Math.abs((x.y+(o.dy||0))-ly)<h*1.6)
      ly=(x.y+(o.dy||0))-h*2.2; }));
  const t={ text:userTextValue('Text'), x:cx, y:ly, h, rot:0, align:1,
            bold:true, _ruled:true, _user:true };""")

# drawn in bold
rep("  ctx.font=`${hpx}px ${store.format.font},Arial`;\n  ctx.textBaseline='alphabetic'; ctx.textAlign=(t.align===1?'center':t.align===2?'right':'left');",
    "  ctx.font=`${t.bold?'700 ':''}${hpx}px ${store.format.font},Arial`;\n  ctx.textBaseline='alphabetic'; ctx.textAlign=(t.align===1?'center':t.align===2?'right':'left');")

# the box you type into matches what will be drawn, and what you type is capitalised
rep("  let tw; try{ ctx.save(); ctx.font=`${hpx}px ${store.format.font},Arial`; tw=ctx.measureText(String(t.text||'')||'M').width; ctx.restore(); }",
    "  const FW=t.bold?'700 ':'';\n  let tw; try{ ctx.save(); ctx.font=`${FW}${hpx}px ${store.format.font},Arial`; tw=ctx.measureText(String(t.text||'')||'M').width; ctx.restore(); }")
rep("  el.style.font=`${hpx}px ${store.format.font},Arial`;",
    "  el.style.font=`${FW}${hpx}px ${store.format.font},Arial`;\n  if(isUserText(t)) el.style.textTransform='uppercase';")
rep("    if(save && v!==String(t.text)){ snapshot(); t.text=v; afterMutate(); } else render(); };",
    "    const nv=isUserText(t)? userTextValue(v) : v;\n    if(save && nv!==String(t.text)){ snapshot(); t.text=nv; afterMutate(); } else render(); };")
rep("    try{ ctx.save(); ctx.font=`${hpx}px ${store.format.font},Arial`; const nw=ctx.measureText(el.value||'M').width; ctx.restore();",
    "    if(isUserText(t)) el.value=userTextValue(el.value);\n    try{ ctx.save(); ctx.font=`${FW}${hpx}px ${store.format.font},Arial`; const nw=ctx.measureText(el.value||'M').width; ctx.restore();")

# STYLIZE keeps a user label at its own size instead of pulling it down
rep("""    if(!t._dimPart && !t._sec) t.h=txtH;
    textN++; }); });""",
"""    // a label the user added keeps its own house style: capitals, bold, and two
    // points above the sheet size - STYLIZE re-applies it rather than flattening it
    if(isUserText(t)){ t.h=userTextHeightMM(); t.bold=true; t.text=userTextValue(t.text); }
    else if(!t._dimPart && !t._sec) t.h=txtH;
    textN++; }); });

  /* A guarantee, not a chain of conditions.
     Size used to be settled in several places - a model here, this pass there,
     a balloon somewhere else - so a value could be restyled by one path and never
     sized by another. That is exactly what a drawing looks like when its circle
     dimensions change shape but keep the file's own text height.
     From here on, everything that is not the sheet's own frame or title block
     leaves this pass at the size Format Config asks for. Section letters keep
     their 1.4x, which ISO 128 asks for. */
  let sizedN=0, fixedN=0;
  pg.objects.forEach(ob=>{ (ob.prims.texts||[]).forEach(t=>{
    if(isSheetFurniture(t, ob, furniture)) return;
    if(isUserText(t) || t._balPart) return;        // these carry their own size
    const want = t._sec ? txtH*SEC_LETTER_SCALE : txtH;
    if(Math.abs((t.h||0)-want)>0.005){ t.h=want; fixedN++; }
    sizedN++; }); });
  // and back into the models, so a later redraw cannot undo it
  dimModelsOf(pg).forEach(m=>{ if(m.ok && m.text) m.text.h=txtH; });
  secModelsOf(pg).forEach(s=>{ if(s.ok && s.label) s.label.h=txtH*SEC_LETTER_SCALE; });
  if(fixedN) console.log('text size: '+fixedN+' of '+sizedN+
    ' item(s) only reached '+txtH.toFixed(2)+' mm in the final pass');

  /* And say which text the size pass was not allowed to touch, and why. On most
     drawings this is the frame and title block, correctly. On a drawing whose
     dimension layer happens to be named after the title block, it is the whole
     reason some values are resized and some are not - so it is named, not left
     silent. */
  const heldBack={};
  pg.objects.forEach(ob=>{ (ob.prims.texts||[]).forEach(t=>{
    if(!isSheetFurniture(t, ob, furniture)) return;
    if(Math.abs((t.h||0)-txtH)<0.005) return;
    heldBack[String(t._layer||'(no layer)')]=(heldBack[String(t._layer||'(no layer)')]||0)+1; }); });
  const heldList=Object.entries(heldBack);
  if(heldList.length) console.log('kept at their own size as part of the sheet: '+
    heldList.map(([k,v])=>k+' x'+v).join(', ')+
    '   -- if any of those are really annotation, tell me that layer name');""")

# ---- 33. the bold flag has to survive the trip to the canvas ---------------
# drawObject copies a fixed list of fields into the drawing call. "bold" was not on
# that list, so the flag was set, saved and exported correctly - and then dropped
# on the one step that actually puts ink on the page.
rep("  (P.texts||[]).forEach(t=>drawImportedText({x:t.x+dx,y:t.y+dy,h:t.h,text:t.text,rot:t.rot,align:t.align,scaleRot:t.scaleRot,_ruled:t._ruled}));",
    "  (P.texts||[]).forEach(t=>drawImportedText({x:t.x+dx,y:t.y+dy,h:t.h,text:t.text,rot:t.rot,align:t.align,scaleRot:t.scaleRot,_ruled:t._ruled,bold:t.bold}));")

# ---- 34. item balloons ------------------------------------------------------
bal=open(os.path.join(ROOT,'src','modules','balloon.js')).read()
rep("function addTextLabel(){", bal+"function addTextLabel(){")
rep("""      <button class="tool-sq" id="btnText" title="Text / Label (T)"><i class="bi bi-fonts"></i></button>""",
    """      <button class="tool-sq" id="btnText" title="Text / Label (T)"><i class="bi bi-fonts"></i></button>
      <button class="tool-sq" id="btnBalloon" title="Add Pointer"><i class="bi bi-1-circle"></i></button>""")
rep("  { const bt=$('#btnText'); if(bt) bt.onclick=addTextLabel; }",
    "  { const bt=$('#btnText'); if(bt) bt.onclick=addTextLabel; }\n  { const bb=$('#btnBalloon'); if(bb) bb.onclick=addBalloon; }")

# grips: a balloon is checked before dimensions, since it owns its own object
rep("""    const sg=secGripAt(pg,wx,wy);      if(sg) return {kind:'sec', g:sg};""",
    """    const bg=balGripAt(pg,wx,wy);      if(bg) return {kind:'bal', g:bg};
    const sg=secGripAt(pg,wx,wy);      if(sg) return {kind:'sec', g:sg};""")
rep("      if(dhit){ if(dhit.kind==='sec') beginSecDrag(dhit.g);",
    "      if(dhit){ if(dhit.kind==='bal') beginBalDrag(dhit.g);\n                else if(dhit.kind==='sec') beginSecDrag(dhit.g);")
rep("    if(secDrag){ updateSecDrag(w.x,w.y); return; }",
    "    if(balDrag){ updateBalDrag(w.x,w.y); return; }\n    if(secDrag){ updateSecDrag(w.x,w.y); return; }")
rep("    if(secDrag){ endSecDrag(); }", "    if(balDrag){ endBalDrag(); }\n    if(secDrag){ endSecDrag(); }")
rep("""function drawDimHandles(){
  const pg=activePage(); if(!pg||pg.type!=='sheet') return;
  if(drawSecGrips(pg)) return;""",
"""function drawDimHandles(){
  const pg=activePage(); if(!pg||pg.type!=='sheet') return;
  if(drawBalGrips(pg)) return;
  if(drawSecGrips(pg)) return;""")

# editing the number writes back to the model, so the circle resizes to fit it
rep("    const nv=isUserText(t)? userTextValue(v) : v;\n    if(save && nv!==String(t.text)){ snapshot(); t.text=nv; afterMutate(); } else render(); };",
    """    const nv=isUserText(t)? userTextValue(v) : v;
    if(save && nv!==String(t.text)){ snapshot(); t.text=nv;
      // a balloon's number lives in its model: put it back, and let the circle
      // grow or shrink to fit what was typed
      try{ if(t._bal) balSyncFromText(activePage(), t); }catch(e){}
      afterMutate(); } else render(); };""")

# STYLIZE keeps balloons to the house size
rep("    if(isUserText(t)){ t.h=userTextHeightMM(); t.bold=true; t.text=userTextValue(t.text); }",
    """    if(t._balPart){ /* sized by its own model, below */ }
    else if(isUserText(t)){ t.h=userTextHeightMM(); t.bold=true; t.text=userTextValue(t.text); }""")
rep("""  dimModelsOf(pg).forEach(m=>{ if(m.ok && dimStylizeText(pg, m, txtH)) dims++; });""",
    """  dimModelsOf(pg).forEach(m=>{ if(m.ok && dimStylizeText(pg, m, txtH)) dims++; });
  balModelsOf(pg).forEach(m=>{ m.h=balTextH(); balApply(pg, m); });""")
rep("  dimModels:(pg)=>dimModelsOf(pg),",
    "  dimModels:(pg)=>dimModelsOf(pg), balModels:(pg)=>balModelsOf(pg),\n  dimStretchAt:(x,y)=>dimStretchAt(x,y), expandGroup:(ids)=>expandGroup(ids), secReport:()=>secReport(),\n  usingIDB:()=>_useIDB, storageReport:()=>storageReport(), idbAll:()=>idbAll(), tbRect:()=>tbRect(),\n  projSymAt:()=>{ const t=tbRect(); const X=(f)=>t.x+TB_W*f, Y=(f)=>t.y+TB_H*f;\n    return [(X(FX.scl)+X(FX.tol))/2, (Y(FY.t2)+Y(FY.t3))/2]; },\n  bomFontMM:()=>bomFontMM(), bomTitleMM:()=>bomTitleMM(), bomBounds:(pg)=>bomBounds(pg), computeSnap:(bb,a,c)=>computeSnap(bb,a,c), viewInfo:()=>({s:view.s}), dragState:()=>({dimMDrag:!!dimMDrag, secDrag:!!secDrag, balDrag:!!balDrag, objDrag:!!objDrag, marquee:!!marquee}),\n  addBalloon:()=>addBalloon(), balGrips:(pg)=>balGrips(pg), balGeomOf:(m)=>balGeomOf(m),\n  balSyncFromText:(pg,t)=>balSyncFromText(pg,t), balApply:(pg,m)=>balApply(pg,m),")

# ---- 35. the BOM: its own size, and something you can select and delete -----
# Two points size the table. The heading "BILL OF MATERIAL" names the table and
# stays at the sheet size; everything inside it is TWO POINTS SMALLER, because a
# parts list is read close up and should not compete with the drawing.
rep("const BOM_TITLE_H=6.4, BOM_HEAD_H=6.0, BOM_ROW_MIN=6.0, BOM_PAD=1.4, BOM_FONT=2.5, BOM_MINCOL=10;",
    """const BOM_TITLE_H=6.4, BOM_HEAD_H=6.0, BOM_ROW_MIN=6.0, BOM_PAD=1.4, BOM_MINCOL=10;
const BOM_PT_DOWN=2;                            /* points below the sheet text size */
function bomFontMM(){ return Math.max(1.2, ((store.format.fontSize||10)-BOM_PT_DOWN)*PT_TO_MM); }
function bomTitleMM(){ return (store.format.fontSize||10)*PT_TO_MM; }""")

rep("  rect(x0,y,tot,BOM_TITLE_H); bomText('BILL OF MATERIAL', x0+tot/2, y-BOM_TITLE_H/2, BOM_FONT*1.15,'center','middle',true); y-=BOM_TITLE_H;",
    "  rect(x0,y,tot,BOM_TITLE_H); bomText('BILL OF MATERIAL', x0+tot/2, y-BOM_TITLE_H/2, bomTitleMM(),'center','middle',true); y-=BOM_TITLE_H;")
# everything else inside the table follows the smaller size
for _old, _new in [
  ("function bomRowHeights(b){ const {vis,ws}=bomColWidths(b); const fpx=mm2px(BOM_FONT); const lh=BOM_FONT*1.34;",
   "function bomRowHeights(b){ const {vis,ws}=bomColWidths(b); const BF=bomFontMM(); const fpx=mm2px(BF); const lh=BF*1.34;"),
  ("  let cx=x0; vis.forEach((d,i)=>{ rect(cx,y,ws[i],BOM_HEAD_H); bomText(d.label,cx+ws[i]/2,y-BOM_HEAD_H/2,BOM_FONT,'center','middle',true); cx+=ws[i]; }); y-=BOM_HEAD_H;",
   "  const BF=bomFontMM();\n  let cx=x0; vis.forEach((d,i)=>{ rect(cx,y,ws[i],BOM_HEAD_H); bomText(d.label,cx+ws[i]/2,y-BOM_HEAD_H/2,BF,'center','middle',true); cx+=ws[i]; }); y-=BOM_HEAD_H;"),
  ("  const lh=BOM_FONT*1.34;", "  const lh=BF*1.34;"),
  ("      if(d.auto){ bomText(String(ri+1),cx+ws[i]/2,y-h/2,BOM_FONT,'center','middle',false); }",
   "      if(d.auto){ bomText(String(ri+1),cx+ws[i]/2,y-h/2,BF,'center','middle',false); }"),
  ("      else { const lines=wrapCell(r[d.key], mm2px(ws[i]-BOM_PAD*2), mm2px(BOM_FONT));",
   "      else { const lines=wrapCell(r[d.key], mm2px(ws[i]-BOM_PAD*2), mm2px(BF));"),
  ("        lines.forEach((ln,li)=>bomText(ln, cx+BOM_PAD, y-BOM_PAD-li*lh, BOM_FONT,'left','top',false)); }",
   "        lines.forEach((ln,li)=>bomText(ln, cx+BOM_PAD, y-BOM_PAD-li*lh, BF,'left','top',false)); }"),
]:
    rep(_old, _new)

# ---- 36. the BOM is a thing on the page, so it can be selected and deleted --
# It was a special case: dragged by its own code, never selectable, and impossible
# to remove once added. Now clicking it selects it like anything else, and Delete
# removes it - while the drag inside the table and the column handles still work.
rep("""    if(pg.bom){ const bb=bomBounds(pg);               // drag inside the table = move it
      if(bb && w.x>=bb.x && w.x<=bb.x+bb.w && w.y<=bb.y && w.y>=bb.y-bb.h){ snapshot();
        bomDrag={ type:'move', startX:w.x, startY:w.y, x0:pg.bom.x, y0:pg.bom.y, moved:false }; e.preventDefault(); return; } }""",
"""    if(pg.bom){ const bb=bomBounds(pg);               // drag inside the table = move it
      if(bb && w.x>=bb.x && w.x<=bb.x+bb.w && w.y<=bb.y && w.y>=bb.y-bb.h){ snapshot();
        // selecting it as well is what makes Delete work on it, and what draws the
        // usual selection outline so it reads as a thing on the page
        selIds=new Set(['bom']); updateSelToolbar();
        bomDrag={ type:'move', startX:w.x, startY:w.y, x0:pg.bom.x, y0:pg.bom.y, moved:false }; e.preventDefault(); render(); return; } }""")
rep("""function deleteSelection(){ if(!selIds.size) return; snapshot(); const pg=activePage();
  pg.objects=pg.objects.filter(o=>!selIds.has(o.id)); selIds=new Set(); afterMutate(); toast('Deleteชิ้นที่เลือกแล้ว'); }""",
"""function deleteSelection(){ if(!selIds.size) return; snapshot(); const pg=activePage();
  let n=0;
  if(selIds.has('bom') && pg.bom){ pg.bom=null; n++;
    const rp=$('#rpanel'); if(rp) rp.classList.remove('open'); }
  const before=pg.objects.length;
  const removedObjects=pg.objects.filter(o=>selIds.has(o.id));
  pg.objects=pg.objects.filter(o=>!selIds.has(o.id));
  n+=before-pg.objects.length;
  // a dimension, a marker or a balloon whose drawing is gone must not leave its
  // model behind, or STYLIZE would faithfully redraw something nobody can see
  const live=new Set();
  pg.objects.forEach(o=>{ if(o._dim) live.add(o._dim); if(o._sec) live.add(o._sec); if(o._bal) live.add(o._bal); });
  if(pg.dxf){
    pg.dxf.dims=(pg.dxf.dims||[]).filter(m=>live.has(m.id));
    pg.dxf.secs=(pg.dxf.secs||[]).filter(m=>live.has(m.id));
    pg.dxf.balloons=(pg.dxf.balloons||[]).filter(m=>live.has(m.id));
  }
  selIds=new Set(); afterMutate(); toast('deleted '+n+' item(s)'); }""")
# the selection outline has to know where the table is
rep("""function selectionBBox(){""",
"""function bomSelBBox(){
  const pg=activePage(); if(!pg||!pg.bom||!selIds.has('bom')) return null;
  const bb=bomBounds(pg); if(!bb) return null;
  return {minx:bb.x, miny:bb.y-bb.h, maxx:bb.x+bb.w, maxy:bb.y};
}
function selectionBBox(){""")

# ---- 37. the title-block guard must not swallow clicks on the BOM ----------
# The guard drops any click inside the title-block band unless it lands on a
# dimension. A parts list sitting in that band was therefore unclickable: the
# click never reached the code that selects it.
rep("""function bomBounds(page){""",
"""/* Is this point inside the parts list? Asked before the title-block guard, so a
   table drawn over that band can still be picked up. */
function bomHitAt(pg, wx, wy){
  if(!pg||!pg.bom) return false;
  const bb=bomBounds(pg); if(!bb) return false;
  return wx>=bb.x && wx<=bb.x+bb.w && wy<=bb.y && wy>=bb.y-bb.h;
}
function bomBounds(page){""")
rep("""    if(!dpre && w.x>=tb.x&&w.x<=tb.x+TB_W&&w.y>=tb.y&&w.y<=tb.y+TB_H){
      const over=objAtPoint(w.x,w.y);
      if(!over || !over._dim) return;                // the block itself: dblclick edits it
    }""",
"""    if(!dpre && !bomHitAt(pg,w.x,w.y) && w.x>=tb.x&&w.x<=tb.x+TB_W&&w.y>=tb.y&&w.y<=tb.y+TB_H){
      const over=objAtPoint(w.x,w.y);
      if(!over || !over._dim) return;                // the block itself: dblclick edits it
    }""")

rep("""    if(rh){ const b=pg.bom; snapshot();
      bomDrag={ ...rh, startX:w.x, colW0:JSON.parse(JSON.stringify(b.colW)), moved:false }; e.preventDefault(); return; }""",
"""    if(rh){ const b=pg.bom; snapshot();
      selIds=new Set(['bom']); updateSelToolbar();   // grabbing a divider selects it too
      bomDrag={ ...rh, startX:w.x, colW0:JSON.parse(JSON.stringify(b.colW)), moved:false }; e.preventDefault(); render(); return; }""")

# ---- grouping on import: dimensions, markers and balloons only -------------
# An earlier version also grouped the imported GEOMETRY into 'views' by walking
# bounding boxes that nearly touch, so one click picked up a whole drawing. It
# guessed wrong often enough to be a nuisance - parts that merely passed close to
# each other ended up welded together - so it is gone. Geometry arrives as
# separate pieces and the user groups what they want with Ctrl+Shift+G.
#
# A dimension, a section marker and a balloon are each still ONE object: those
# are not guesses, the drawing says so.

# ---- 41. saving must not fail in silence, and must not waste room ----------
# The browser gives a page about 5 MB of storage. One imported drawing was taking
# 830 KB of it, so the sixth import filled it - and from then on every save threw
# an error that was caught and thrown away. Work looked saved and was not: reopen
# the app and the last projects are simply gone.
#
# Two things fix it. Coordinates are written to four decimal places, which is a
# ten-thousandth of a millimetre and far finer than any drawing needs - most of the
# space was going on digits like 116.55000000000001. And when the store really is
# full, the person is told, instead of finding out later.
rep("""function persist(){ if(store){ store.updated=Date.now(); const i=DB.findIndex(p=>p.id===store.id); if(i>=0)DB[i]=store; }
  try{ localStorage.setItem(LS_KEY, JSON.stringify(DB)); }catch(e){} }""",
"""let _storageWarned=false;
/* Four decimal places is a ten-thousandth of a millimetre - finer than any drawing
   tolerance, and it stops a coordinate costing seventeen digits. */
function _slim(k,v){ return (typeof v==='number' && isFinite(v)) ? +v.toFixed(4) : v; }
function persist(){ if(store){ store.updated=Date.now(); const i=DB.findIndex(p=>p.id===store.id); if(i>=0)DB[i]=store; }
  try{ localStorage.setItem(LS_KEY, JSON.stringify(DB, _slim)); _storageWarned=false; }
  catch(e){
    // Out of room. Say so plainly - work that is not saved must never look saved.
    if(!_storageWarned){ _storageWarned=true;
      try{ toast('\\u0e1e\\u0e37\\u0e49\\u0e19\\u0e17\\u0e35\\u0e48\\u0e40\\u0e01\\u0e47\\u0e1a\\u0e07\\u0e32\\u0e19\\u0e40\\u0e15\\u0e47\\u0e21 \\u2014 \\u0e25\\u0e1a\\u0e42\\u0e1b\\u0e23\\u0e40\\u0e08\\u0e01\\u0e15\\u0e4c\\u0e40\\u0e01\\u0e48\\u0e32\\u0e2d\\u0e2d\\u0e01\\u0e01\\u0e48\\u0e2d\\u0e19 \\u0e21\\u0e34\\u0e09\\u0e30\\u0e19\\u0e31\\u0e49\\u0e19\\u0e07\\u0e32\\u0e19\\u0e43\\u0e2b\\u0e21\\u0e48\\u0e08\\u0e30\\u0e44\\u0e21\\u0e48\\u0e16\\u0e39\\u0e01\\u0e1a\\u0e31\\u0e19\\u0e17\\u0e36\\u0e01'); }catch(_){}
      console.warn('storage full - nothing was saved', e);
    }
  } }""")

# ---- SAFETY: a drawing error must never leave a blank page ------------------
# If anything throws part-way through drawing, the canvas is left half-finished or
# empty and the app looks dead - with nothing on screen to say why. Drawing is
# wrapped so a failure is reported instead of swallowed, and the projection symbol
# gets back the guard that stops it throwing on a degenerate view.
rep("function projSym(cx,cy,wmm){\n  const u=mm2px(wmm)/15;",
    """function projSym(cx,cy,wmm){
  const u=Math.abs(mm2px(wmm))/15;
  /* a zero-width or back-to-front view gives a negative radius, which throws and
     takes the whole render down with it; nothing can be drawn that small anyway */
  if(!isFinite(u) || u<=0.01) return;""")

_i=s.index("function render(){")
_j=s.index("\n}\n", _i)
rep("function render(){", """let _renderFailed=false;
function render(){
  try{ _render(); _renderFailed=false; }
  catch(err){
    if(!_renderFailed){ _renderFailed=true; console.error('render failed', err);
      try{ toast('could not draw the sheet: '+(err&&err.message||err)); }catch(e){} }
  }
}
function _render(){""")

# ---- a build stamp, so there is never any doubt which file is open ---------
import datetime as _dt
_STAMP='build '+_dt.datetime.now().strftime('%d %b %H:%M')
rep("""  { const bt=$('#btnText'); if(bt) bt.onclick=addTextLabel; }""",
    """  { const bt=$('#btnText'); if(bt) bt.onclick=addTextLabel; }
  // The build stamp, somewhere it can be checked without being in the way: the
  // console, and window.__build. The tab says the name of the program, nothing else.
  try{ window.__build='"""+_STAMP+"""';
       console.log('DrawingMaster \u2014 """+_STAMP+"""'); }catch(e){}""")

# ---- STORAGE: stop saving what can be rebuilt ------------------------------
# 56% of every saved project was the object list, which is built FROM the drawing
# and is rebuilt on opening anyway. Storing it filled the browser's 5 MB after
# about eight drawings, after which nothing was saved at all - work looked kept
# and was not. What is saved now is the drawing; the objects come back from it.
rep("function persist(){ if(store){ store.updated=Date.now(); const i=DB.findIndex(p=>p.id===store.id); if(i>=0)DB[i]=store; }\n  try{ localStorage.setItem(LS_KEY, JSON.stringify(DB, _slim)); _storageWarned=false; }",
    """function _saveShape(k,v){
  if(k==='objects') return undefined;          // rebuilt from the drawing on open
  return _slim(k,v);
}
function storageUsed(){ try{ return (localStorage.getItem(LS_KEY)||'').length; }catch(e){ return 0; } }
function persist(){ if(store){ store.updated=Date.now(); const i=DB.findIndex(p=>p.id===store.id); if(i>=0)DB[i]=store; }
  try{ localStorage.setItem(LS_KEY, JSON.stringify(DB, _saveShape)); _storageWarned=false; }""")

# whatever is opened must have its objects again
rep("""    store.pages.forEach(pg=>{ if(pg.type==='sheet' && pg.dxf && !pg.objects) buildObjects(pg); });""",
    """    store.pages.forEach(pg=>{ if(pg.type==='sheet' && pg.dxf && !(pg.objects&&pg.objects.length)) buildObjects(pg); });""")

# ---- STORAGE: move the projects into IndexedDB ------------------------------
idb=open(os.path.join(ROOT,'src','modules','idb.js')).read()
rep("function load(){", idb+"function load(){")

# loading: IndexedDB first, with whatever is in localStorage carried across once
rep("function load(){ try{ DB = JSON.parse(localStorage.getItem(LS_KEY))||[]; }catch(e){ DB=[]; } }",
"""function loadLegacy(){ try{ return JSON.parse(localStorage.getItem(LS_KEY))||[]; }catch(e){ return []; } }
function load(){ DB = loadLegacy(); }          /* immediate, so the page can draw */
/* ...then the real load, which may bring in a bigger store and takes a moment */
function loadAsync(){
  return idbAll().then(rows=>{
    if(rows==null) return false;               // no IndexedDB here: keep using localStorage
    const legacy=loadLegacy();
    if(!rows.length && legacy.length){
      // first run on the new store: carry everything across, then let go of the
      // 5 MB copy so the old limit stops being the limit
      return Promise.all(legacy.map(p=>idbPut(p))).then(oks=>{
        if(oks.every(Boolean)){
          try{ localStorage.removeItem(LS_KEY); }catch(e){}
          console.log('moved '+legacy.length+' project(s) into IndexedDB');
        }
        DB=legacy; _useIDB=true; return true;
      });
    }
    DB=rows; _useIDB=true; return true;
  }).catch(err=>{ console.warn('IndexedDB load failed', err); return false; });
}
let _useIDB=false;""")

# saving: one record, not the whole library
rep("""function persist(){ if(store){ store.updated=Date.now(); const i=DB.findIndex(p=>p.id===store.id); if(i>=0)DB[i]=store; }
  try{ localStorage.setItem(LS_KEY, JSON.stringify(DB, _saveShape)); _storageWarned=false; }""",
"""function persist(){ if(store){ store.updated=Date.now(); const i=DB.findIndex(p=>p.id===store.id); if(i>=0)DB[i]=store; }
  if(_useIDB){
    // save only the project being worked on; the rest are already on disk
    const one=store||null;
    (one? idbPut(one) : Promise.all(DB.map(p=>idbPut(p))).then(a=>a.every(Boolean)))
      .then(ok=>{ if(!ok && !_storageWarned){ _storageWarned=true;
        try{ toast('\\u0e1a\\u0e31\\u0e19\\u0e17\\u0e36\\u0e01\\u0e44\\u0e21\\u0e48\\u0e2a\\u0e33\\u0e40\\u0e23\\u0e47\\u0e08 \\u2014 \\u0e07\\u0e32\\u0e19\\u0e25\\u0e48\\u0e32\\u0e2a\\u0e38\\u0e14\\u0e22\\u0e31\\u0e07\\u0e44\\u0e21\\u0e48\\u0e16\\u0e39\\u0e01\\u0e40\\u0e01\\u0e47\\u0e1a'); }catch(_){}
      } else if(ok) _storageWarned=false; });
    return;
  }
  try{ localStorage.setItem(LS_KEY, JSON.stringify(DB, _saveShape)); _storageWarned=false; }""")

# deleting: from wherever the projects actually live
rep("""  const i=DB.findIndex(x=>x.id===id); if(i>=0) DB.splice(i,1);
  try{ localStorage.setItem(LS_KEY, JSON.stringify(DB)); }catch(_){}
  renderDashboard();""",
"""  const i=DB.findIndex(x=>x.id===id); if(i>=0) DB.splice(i,1);
  if(_useIDB) idbDelete(id).then(()=>renderDashboard());
  else { try{ localStorage.setItem(LS_KEY, JSON.stringify(DB, _saveShape)); }catch(_){} }
  renderDashboard();""")

# boot: draw at once from whatever is to hand, then load the real store
rep("  load(); renderDashboard();",
"""  load(); renderDashboard();
  loadAsync().then(moved=>{ if(moved) renderDashboard(); });""")

# ---- the ANSI switches: the app's own accent, not a hard-coded black --------
rep(".switch.on{background:#111}", ".switch.on{background:var(--ink)}")

# ---- a cutting plane covers the centre line it is drawn along ---------------
# A section is drawn ON the part's centre line, and the cutting plane replaces it
# over that span - that is how the drawing office does it. The old chain line was
# left showing through the new phantom line, two lines along one path.
#
# It is HIDDEN, not deleted: the stroke stays in the drawing, so deleting the
# marker brings it back and the exported file still carries the centre line
# outside the marker's span. Deleting the drawing to tidy up our own annotation is
# the mistake this project already made once.
rep("""  (P.polys||[]).forEach(p=>{
    ctx.setLineDash(p.dash? p.dash.map(v=>v*u):[]);""",
"""  (P.polys||[]).forEach(p=>{
    if(p._secUnder) return;                 // covered by a cutting plane
    ctx.setLineDash(p.dash? p.dash.map(v=>v*u):[]);""")

# ---- Shift while dragging keeps the move straight ---------------------------
# Holding Shift locks the drag to whichever axis it has travelled further along,
# so a part can be moved sideways without drifting up, or up without drifting
# sideways - the way it works in every drawing program. Smart snapping is skipped
# on the locked axis, since being pulled to a neighbour is exactly the drift the
# key was pressed to prevent.
rep("""    if(objDrag){ let ddx=w.x-objDrag.startW.x, ddy=w.y-objDrag.startW.y;
      if(Math.abs(ddx)+Math.abs(ddy)>0.001) objDrag.moved=true;
      const sn=computeSnap(objDrag.bb0, ddx, ddy);        // Illustrator-style smart snapping
      ddx=sn.ddx; ddy=sn.ddy; snapGuides=sn.guides;""",
"""    if(objDrag){ let ddx=w.x-objDrag.startW.x, ddy=w.y-objDrag.startW.y;
      if(Math.abs(ddx)+Math.abs(ddy)>0.001) objDrag.moved=true;
      const lock=e.shiftKey && (Math.abs(ddx)>0.001 || Math.abs(ddy)>0.001)
        ? (Math.abs(ddx)>=Math.abs(ddy) ? 'x' : 'y') : null;
      if(lock==='x') ddy=0; else if(lock==='y') ddx=0;
      const sn=computeSnap(objDrag.bb0, ddx, ddy);        // Illustrator-style smart snapping
      ddx=sn.ddx; ddy=sn.ddy; snapGuides=sn.guides;
      // snapping must not undo the lock
      if(lock==='x') ddy=0; else if(lock==='y') ddx=0;""")

# ---- markers must be redrawn from their models too, not only dimensions -----
for _old, _new in [
  ("  centerDXF(pg); buildObjects(pg); dimRelayout(pg); afterMutate(); fitToDXF(pg);",
   "  centerDXF(pg); buildObjects(pg); dimRelayout(pg); secRelayout(pg); afterMutate(); fitToDXF(pg);"),
  ("  buildObjects(pg); dimRelayout(pg);",
   "  buildObjects(pg); dimRelayout(pg); secRelayout(pg);"),
  ("    if(add){ found+=add; buildObjects(pg); dimRelayout(pg); }",
   "    if(add){ found+=add; buildObjects(pg); dimRelayout(pg); secRelayout(pg); }"),
  ("      buildObjects(pg); dimRelayout(pg); } }); persist();",
   "      buildObjects(pg); dimRelayout(pg); secRelayout(pg); } }); persist();"),
]:
    rep(_old, _new, s.count(_old))

# a label the user adds must live in the drawing too, for the same reason
rep("""  const ob={ id:'o'+(_oidSeq++), dx:0, dy:0, group:null,
             prims:{polys:[],texts:[t],solids:[],marks:[],hatches:[],clines:[]} };
  pg.objects.push(ob);
  setSelection([ob.id]);
  afterMutate();
  startTextEdit(ob, t);                                    // let the user type right away""",
"""  const d=pg.dxf||(pg.dxf={polys:[],texts:[],solids:[],marks:[],hatches:[],clines:[]});
  d.texts.push(t);
  buildObjects(pg);
  const ob=(pg.objects||[]).find(o=>(o.prims.texts||[]).indexOf(t)>=0);
  if(ob) setSelection([ob.id]);
  afterMutate();
  if(ob) startTextEdit(ob, t);                             // let the user type right away""")

# ---- text that STYLIZE skipped, and why ------------------------------------
# When a sheet comes back half-resized, this says which text was skipped and on
# what grounds - the answer is a list, not a guess about which rule missed.
rep("""function isSheetFurniture(t, o, box){
  if(!t) return false;
  if(/border|frame|title\\s*block|^title/i.test(String(t._layer||''))) return true;
  const x=t.x+((o&&o.dx)||0), y=t.y+((o&&o.dy)||0);
  if(box && x>=box.x0 && x<=box.x1 && y>=box.y0 && y<=box.y1) return true;
  try{ const tb=tbRect();
    if(x>=tb.x && x<=tb.x+TB_W && y>=tb.y && y<=tb.y+TB_H) return true; }catch(e){}
  return false;
}""",
"""function isSheetFurniture(t, o, box){
  if(!t) return false;
  /* A value that belongs to a dimension is never furniture, wherever it sits.
     The title-block area is worked out from where the block's own text happens to
     be, and on some drawings that area reaches out over the views - every value
     inside it was then left at the file's size, which is how a sheet came back
     with half its numbers resized and half not. What a dimension owns is not a
     question of position. */
  if(t._dim || t._dimPart) return false;
  const x=t.x+((o&&o.dx)||0), y=t.y+((o&&o.dy)||0);
  if(box && x>=box.x0 && x<=box.x1 && y>=box.y0 && y<=box.y1) return true;
  try{ const tb=tbRect();
    if(x>=tb.x && x<=tb.x+TB_W && y>=tb.y && y<=tb.y+TB_H) return true; }catch(e){}
  /* The layer name is trusted on its own. Requiring the text to ALSO sit at the
     edge of the sheet looked tighter and was worse: zone letters belong to the
     drawing's own frame, which does not line up with this sheet's margins, so
     seventeen of them were blown up to annotation size. */
  if(/border|frame|title\\s*block|^title/i.test(String(t._layer||''))) return true;
  return false;
}
/* Say what STYLIZE did to every piece of text and why - run __hook().textReport()
   in the console. A sheet that comes back half-resized is answered by this list,
   not by guessing which rule missed. */
function textReport(){
  const pg=activePage(); if(!pg||!pg.objects) return 'open a sheet first';
  const want=+((store.format.fontSize||10)*PT_TO_MM).toFixed(3);
  const box=sheetFurnitureBox(pg), rows=[];
  pg.objects.forEach(o=>(o.prims.texts||[]).forEach(t=>{
    const furniture=isSheetFurniture(t,o,box);
    rows.push({ text:String(t.text||'').slice(0,22), heightMM:+(+t.h).toFixed(2),
      layer:t._layer||'', 
      treatedAs: t._dim? 'dimension value' : t._sec? 'section letter'
               : t._user? 'label you added' : furniture? 'sheet furniture - left alone'
               : 'note',
      /* A section letter is deliberately 1.4x the sheet size - ISO 128 asks for a
         larger letter than a dimension value - so it is at ITS wanted size, not
         at the plain one. */
      atWantedSize: Math.abs(t.h - (t._sec? want*SEC_LETTER_SCALE : want)) < 0.01 });
  }));
  const missed=rows.filter(r=>!r.atWantedSize && r.treatedAs!=='sheet furniture - left alone'
                              && r.treatedAs!=='label you added');
  if(console.table) console.table(rows); else console.log(rows);
  console.log(rows.length+' text item(s) · wanted '+want+' mm · '+
              missed.length+' not at that size and not furniture');
  if(missed.length) console.log('missed:', missed);
  return rows;
}""")
rep("  dimStretchAt:(x,y)=>dimStretchAt(x,y), expandGroup:(ids)=>expandGroup(ids), secReport:()=>secReport(),",
    "  dimStretchAt:(x,y)=>dimStretchAt(x,y), expandGroup:(ids)=>expandGroup(ids), insideGroup:()=>insideGroup(), secReport:()=>secReport(), textReport:()=>textReport(), selectionBBox:()=>selectionBBox(), bakeOffsets:(pg)=>bakeOffsets(pg), deleteSelection:()=>deleteSelection(), mm2px:(v)=>mm2px(v), persist:()=>persist(), defaultFormat:()=>loadDefaultFormat(), projects:()=>DB,\n  sheetFurnitureBox:(pg)=>sheetFurnitureBox(pg),")

# ---- Shift on an object already selected means "keep it straight" -----------
# Shift+click adds to the selection, which is right for an object that is NOT yet
# selected. On one that IS already selected it removed it - and so a person who
# held Shift down before grabbing something lost the selection and moved nothing.
# Ctrl/Cmd still toggles, so nothing is lost.
rep("""    const additive=(e.shiftKey||e.ctrlKey||e.metaKey);      // Shift or Ctrl/Cmd add to the selection
    const hit=objAtPoint(w.x,w.y);
    if(hit){
      const ids=expandGroup(new Set([hit.id]));
      if(additive){                                         // toggle this object in/out of the selection""",
"""    const hit=objAtPoint(w.x,w.y);
    // Shift on something already selected = "drag me straight", not "deselect me"
    const holdingSelected=(e.shiftKey && hit && selIds.has(hit.id));
    const additive=((e.shiftKey && !holdingSelected)||e.ctrlKey||e.metaKey);
    if(hit){
      const ids=expandGroup(new Set([hit.id]));
      if(additive){                                         // toggle this object in/out of the selection""")

# ---- a second import lands BESIDE the first, it does not replace it ---------
# Importing put the new drawing straight into pg.dxf, so whatever was already on
# the sheet was gone. A sheet is a sheet of paper: a second drawing goes next to
# the first, and only a sheet that is still empty gets the drawing centred on it.
rep("""  const pg=activePage();
  pg.dxf=d; pg.entities=[];""",
"""  const pg=activePage();
  const had=pg.dxf && ((pg.dxf.polys||[]).length || (pg.dxf.texts||[]).length ||
                       (pg.dxf.hatches||[]).length || (pg.dxf.solids||[]).length);
  // Anything already moved stays where it was put: fold those moves into the
  // drawing before the objects are rebuilt, or they spring back to where they
  // first landed and the new file arrives on top of them.
  if(had){ bakeOffsets(pg); mergeDXF(pg, d); } else pg.dxf=d;
  pg.entities=[];""")
rep("  centerDXF(pg); buildObjects(pg); dimRelayout(pg); secRelayout(pg); afterMutate(); fitToDXF(pg);",
    """  if(!had) centerDXF(pg);          // the first drawing is centred; later ones are placed
  buildObjects(pg); dimRelayout(pg); secRelayout(pg); afterMutate(); fitToDXF(pg);""")

rep("function centerDXF(pg){", """/* Put a second drawing on the sheet without disturbing the first.
   It is moved clear of what is already there - to the right if there is room, or
   below if there is not - so nothing lands on top of anything. Ids are renumbered
   as it comes in, because two files that both call a dimension "dim1" would
   otherwise silently share a model. */
function mergeDXF(pg, d){
  const cur=pg.dxf, bbA=dxfBBox(pg);
  const bbB=dxfBBoxOf(d);
  let dx=0, dy=0;
  if(bbA && bbB){
    /* Always to the RIGHT of what is already there, tops aligned. Trying to fit
       inside the page and dropping below when it would not fit put drawings off
       the bottom of the sheet, where they are harder to find than off the side.
       A row is predictable: the newest is always to the right, and it can be
       dragged wherever it is wanted. */
    const gap=10;
    dx=(bbA.maxx+gap)-bbB.minx;
    dy=bbA.maxy-bbB.maxy;
  }
  const tag=(pg.dxf._merges=(pg.dxf._merges||0)+1);
  const rid=(id)=>id? (id+'m'+tag) : id;
  (d.dims||[]).forEach(m=>{ m.id=rid(m.id); });
  (d.secs||[]).forEach(s=>{ s.id=rid(s.id); });
  (d.balloons||[]).forEach(b2=>{ b2.id=rid(b2.id); });
  const fix=(o)=>{ if(!o) return; if(o._dim) o._dim=rid(o._dim);
                   if(o._sec) o._sec=rid(o._sec); if(o._bal) o._bal=rid(o._bal); };
  (d.polys||[]).forEach(p=>{ fix(p); p.pts=p.pts.map(q=>[q[0]+dx,q[1]+dy]);
    if(p._round){ p._round.cx+=dx; p._round.cy+=dy; } });
  (d.texts||[]).forEach(t=>{ fix(t); t.x+=dx; t.y+=dy; });
  (d.hatches||[]).forEach(h=>h.loops=h.loops.map(l=>l.map(q=>[q[0]+dx,q[1]+dy])));
  (d.solids||[]).forEach((sd,i)=>{ const n=sd.map(q=>[q[0]+dx,q[1]+dy]);
    n._dim=sd._dim?rid(sd._dim):null; n._sec=sd._sec?rid(sd._sec):null; d.solids[i]=n; });
  (d.marks||[]).forEach((q,i)=>d.marks[i]=[q[0]+dx,q[1]+dy]);
  (d.clines||[]).forEach(c=>{ c.x+=dx; c.y+=dy; });
  (d.dims||[]).forEach(m=>dimTranslate(m,dx,dy));
  (d.secs||[]).forEach(s=>secTranslate(s,dx,dy));
  ['polys','texts','hatches','solids','marks','clines','dims','secs','balloons']
    .forEach(k=>{ if(d[k]&&d[k].length){ cur[k]=(cur[k]||[]).concat(d[k]); } });
}
/* The bounding box of a drawing that is not on a page yet. */
function dxfBBoxOf(d){
  let a=1e9,b=1e9,c=-1e9,e=-1e9, any=false;
  const at=(x,y)=>{ any=true; if(x<a)a=x; if(y<b)b=y; if(x>c)c=x; if(y>e)e=y; };
  (d.polys||[]).forEach(p=>(p.pts||[]).forEach(q=>at(q[0],q[1])));
  (d.texts||[]).forEach(t=>at(t.x,t.y));
  (d.solids||[]).forEach(s=>s.forEach(q=>at(q[0],q[1])));
  (d.hatches||[]).forEach(h=>(h.loops||[]).forEach(l=>l.forEach(q=>at(q[0],q[1]))));
  return any? {minx:a,miny:b,maxx:c,maxy:e} : null;
}
function centerDXF(pg){""")

# ---- Shift-drag follows the CENTRE of what is selected ----------------------
# Holding Shift already froze one axis. What it did not do was decide what the
# move follows: snapping still worked from the edges of the selection, so a large
# marquee could be pulled sideways by one of its own edges lining up with
# something. While the axis is locked the only point that matters is the CENTRE of
# what is selected - so the group behaves the same however big it is - and a guide
# is drawn through that centre so the locked axis is visible.
rep("function computeSnap(bb0, ddx, ddy){\n  const out={ddx, ddy, guides:[]};\n  if(!bb0) return out;",
"""function computeSnap(bb0, ddx, ddy, lock){
  const out={ddx, ddy, guides:[]};
  if(!bb0) return out;""")
rep("  const mXs=[['min',mv.minx],['c',mcx],['max',mv.maxx]];",
    "  const mXs = lock ? [['c',mcx]] : [['min',mv.minx],['c',mcx],['max',mv.maxx]];")
rep("  const mYs=[['min',mv2.miny],['c',mcy2],['max',mv2.maxy]];",
    "  const mYs = lock ? [['c',mcy2]] : [['min',mv2.miny],['c',mcy2],['max',mv2.maxy]];")

rep("""      const lock=e.shiftKey && (Math.abs(ddx)>0.001 || Math.abs(ddy)>0.001)
        ? (Math.abs(ddx)>=Math.abs(ddy) ? 'x' : 'y') : null;
      if(lock==='x') ddy=0; else if(lock==='y') ddx=0;
      const sn=computeSnap(objDrag.bb0, ddx, ddy);        // Illustrator-style smart snapping
      ddx=sn.ddx; ddy=sn.ddy; snapGuides=sn.guides;
      // snapping must not undo the lock
      if(lock==='x') ddy=0; else if(lock==='y') ddx=0;""",
"""      /* Shift locks the move to whichever axis it has travelled further along.
         The axis is held EXACTLY - the value the drag started with, not a snapped
         one - so the centre of the selection stays on its line however far it is
         pushed, and however many objects are in it. */
      const lock=e.shiftKey && (Math.abs(ddx)>0.001 || Math.abs(ddy)>0.001)
        ? (Math.abs(ddx)>=Math.abs(ddy) ? 'x' : 'y') : null;
      if(lock==='x') ddy=0; else if(lock==='y') ddx=0;
      const sn=computeSnap(objDrag.bb0, ddx, ddy, lock);   // Illustrator-style smart snapping
      ddx=sn.ddx; ddy=sn.ddy; snapGuides=sn.guides;
      if(lock==='x') ddy=0; else if(lock==='y') ddx=0;     // snapping must not undo the lock
      if(lock){
        // show the line the centre is travelling along
        const b0=objDrag.bb0;
        const cx=(b0.minx+b0.maxx)/2+ddx, cy=(b0.miny+b0.maxy)/2+ddy;
        const {W,H}=paperDims();
        snapGuides=(snapGuides||[]).concat(lock==='x'
          ? [{x0:0, y0:cy, x1:W, y1:cy, lock:true}]
          : [{x0:cx, y0:0, x1:cx, y1:H, lock:true}]);
      }""")

# the axis-lock guide is a different thing from a snap guide, so it looks different
rep("""  snapGuides.forEach(g=>{ const a=W2S(g.x0,g.y0), b=W2S(g.x1,g.y1);
    ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke(); });""",
"""  snapGuides.forEach(g=>{ const a=W2S(g.x0,g.y0), b=W2S(g.x1,g.y1);
    if(g.lock){ ctx.save(); ctx.strokeStyle='#0077ff'; ctx.setLineDash([9,4,2,4]); }
    ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
    if(g.lock) ctx.restore(); });""")

# The stray-content guard is for ONE imported file: it hides a minority cluster
# that is usually junk left in a corner. On a sheet the user is assembling it saw
# the drawing already there as a stray cluster and threw it away - which is why a
# moved drawing appeared to snap back and then vanish under the new one.
rep("  const guard=applyClusterGuard(pg);",
    "  const guard = had ? null : applyClusterGuard(pg);   // only ever on a fresh sheet")

# ---- one switch, and three fonts -------------------------------------------
# Two switches for two kinds of annotation asked the user to think about which
# rules apply to what. There is only one question worth asking: should STYLIZE
# restyle the drawing, or only set the text to the size you chose? So there is one
# switch. Off does not mean "do nothing" - text still gets the size, which is the
# part everybody wants on every drawing.
rep("""          <div class="tg-row"><div class="tl"><b>ANSI Radius Dimension</b><span>Horizontal radius dimension landing</span></div>
            <div class="switch${f.ansiRadius?' on':''}" id="fAnsiR"></div></div>
          <div class="tg-row"><div class="tl"><b>ANSI Section Dimension</b><span>Horizontal section line landing</span></div>
            <div class="switch${f.ansiSection?' on':''}" id="fAnsiS"></div></div>""",
"""          <div class="tg-row"><div class="tl"><b>ANSI Radius &amp; Section Dimension</b><span>On: Stylize restyles the drawing &middot; Off: only the text size changes</span></div>
            <div class="switch${f.ansiRadius?' on':''}" id="fAnsiR"></div></div>""")
rep("""  on('fAnsiR','click',e=>{ f.ansiRadius=!f.ansiRadius; e.currentTarget.classList.toggle('on',f.ansiRadius); });
  on('fAnsiS','click',e=>{ f.ansiSection=!f.ansiSection; e.currentTarget.classList.toggle('on',f.ansiSection); });""",
"""  on('fAnsiR','click',e=>{ f.ansiRadius=!f.ansiRadius; f.ansiSection=f.ansiRadius;
    e.currentTarget.classList.toggle('on',f.ansiRadius); });""")

# with the switch off, STYLIZE leaves the drawing alone and only sets the size


# and the file's own strokes are only taken over when the switch is on
rep("  // take over the strokes of everything that was only READ at import\n  stylizeAdopt(pg);",
    """  // Take over the file's own strokes only when the switch says to restyle. With
  // it off the drawing is left exactly as the file drew it, and only the text
  // size changes - which is what "off" has to mean for that to be reversible.
  if(store.format.ansiRadius) stylizeAdopt(pg);""")

rep("const FONTS=['Arial','Helvetica','Times New Roman','Courier New','Tahoma','Verdana'];",
    "const FONTS=['Arial','Sarabun','Consolas'];   /* one sans, one Thai, one monospace */")

# ---- adding a label, a balloon or a BOM must not disturb the page -----------
# All three rebuilt the object list so their new pieces would appear. Rebuilding
# reads the DRAWING, and everything that had been moved carried its move in the
# OBJECT - so the whole page sprang back to where it was first imported, and every
# section marker lost the strokes it had taken over. Bake the moves in first, then
# rebuild, then redraw the models: the same three steps importing needs.
rep("""  const built=balProject(m);
  built.polys.forEach(p=>d.polys.push(p));
  built.texts.forEach(t=>d.texts.push(t));
  buildObjects(pg);""",
"""  const built=balProject(m);
  built.polys.forEach(p=>d.polys.push(p));
  built.texts.forEach(t=>d.texts.push(t));
  rebuildKeepingPlaces(pg);""")
rep("""  const d=pg.dxf||(pg.dxf={polys:[],texts:[],solids:[],marks:[],hatches:[],clines:[]});
  d.texts.push(t);
  buildObjects(pg);
  const ob=(pg.objects||[]).find(o=>(o.prims.texts||[]).indexOf(t)>=0);""",
"""  const d=pg.dxf||(pg.dxf={polys:[],texts:[],solids:[],marks:[],hatches:[],clines:[]});
  d.texts.push(t);
  rebuildKeepingPlaces(pg);
  const ob=(pg.objects||[]).find(o=>(o.prims.texts||[]).indexOf(t)>=0);""")

rep("function bakeOffsets(pg){",
"""/* Rebuild the object list without losing where anything was put or how anything
   was styled. Anything that adds to the drawing needs all three steps, in order. */
function rebuildKeepingPlaces(pg){
  try{ bakeOffsets(pg); }catch(e){}
  buildObjects(pg);
  try{ dimRelayout(pg); }catch(e){}
  try{ secRelayout(pg); }catch(e){}
}
function bakeOffsets(pg){""")

# a deleted balloon must take its strokes with it, or the next rebuild brings it back
rep("""  const live=new Set();
  pg.objects.forEach(o=>{ if(o._dim) live.add(o._dim); if(o._sec) live.add(o._sec); if(o._bal) live.add(o._bal); });
  if(pg.dxf){
    pg.dxf.dims=(pg.dxf.dims||[]).filter(m=>live.has(m.id));
    pg.dxf.secs=(pg.dxf.secs||[]).filter(m=>live.has(m.id));
    pg.dxf.balloons=(pg.dxf.balloons||[]).filter(m=>live.has(m.id));
  }""",
"""  const live=new Set();
  pg.objects.forEach(o=>{ if(o._dim) live.add(o._dim); if(o._sec) live.add(o._sec); if(o._bal) live.add(o._bal); });
  if(pg.dxf){
    pg.dxf.dims=(pg.dxf.dims||[]).filter(m=>live.has(m.id));
    pg.dxf.secs=(pg.dxf.secs||[]).filter(m=>live.has(m.id));
    pg.dxf.balloons=(pg.dxf.balloons||[]).filter(m=>live.has(m.id));
    /* And the strokes of the pieces that were deleted - taken from those pieces
       themselves, collected before they were dropped.
       Keeping "everything still referenced" and throwing away the rest looked
       equivalent and was not: a stroke the object list does not happen to carry -
       one hidden under a cutting plane, one belonging to a page the rebuild groups
       differently - is not deleted, it is merely unreferenced, and that filter
       wiped the drawing. Only what was actually selected goes. */
    const doomed=new Set();
    removedObjects.forEach(o=>{
      (o.prims.polys||[]).forEach(p=>doomed.add(p));
      (o.prims.texts||[]).forEach(t=>doomed.add(t));
      (o.prims.solids||[]).forEach(x=>doomed.add(x));
      (o.prims.hatches||[]).forEach(h=>doomed.add(h));
      (o.prims.clines||[]).forEach(c=>doomed.add(c));
    });
    if(doomed.size){
      pg.dxf.polys=(pg.dxf.polys||[]).filter(p=>!doomed.has(p));
      pg.dxf.texts=(pg.dxf.texts||[]).filter(t=>!doomed.has(t));
      pg.dxf.solids=(pg.dxf.solids||[]).filter(x=>!doomed.has(x));
      pg.dxf.hatches=(pg.dxf.hatches||[]).filter(h=>!doomed.has(h));
      pg.dxf.clines=(pg.dxf.clines||[]).filter(c=>!doomed.has(c));
    }
  }""")

# ---- opening a project shows what was saved, it does not re-derive it -------
# Opening redrew every model. That is how a marker survived before its strokes
# were saved properly - and it is also how anything a person had nudged, that no
# model records, was quietly undone. Now the saved drawing IS the drawing; only a
# model still WAITING for STYLIZE is drawn on opening.
rep("""    store.pages.forEach(pg=>{ if(pg.type==='sheet' && pg.dxf && !(pg.objects&&pg.objects.length)) buildObjects(pg); });""",
"""    store.pages.forEach(pg=>{ if(pg.type==='sheet' && pg.dxf && !(pg.objects&&pg.objects.length)) buildObjects(pg); });
    store.pages.forEach(pg=>{ if(pg.type!=='sheet' || !pg.dxf) return;
      const waiting=((pg.dxf.dims||[]).some(m=>m.pending) ||
                     (pg.dxf.secs||[]).some(s=>s.pending));
      if(waiting){ dimRelayout(pg); secRelayout(pg); } });""")

# ---- filled shapes must survive being saved ---------------------------------
# A filled shape (an arrowhead) is stored as an ARRAY of points with its tags hung
# on the side: which dimension or marker owns it, whether the file called it a
# section line. JSON keeps an array's numbers and throws away everything else, so
# every one of those tags was lost the moment a project was written out - 59 of
# them on a single drawing. On reopening, no marker could find its own arrowheads:
# the sections vanished, and pressing STYLIZE could not bring them back because by
# then nothing was tagged.
#
# So they go out as objects and come back as arrays. The shape in memory does not
# change; only the way it is written down.
rep("function _saveShape(k,v){", """function _packSolid(sd){
  if(!Array.isArray(sd)) return sd;
  const o={ _pts:sd.map(q=>[q[0], q[1]]) };
  ['_dim','_sec','_bal','_section','_layer'].forEach(k=>{ if(sd[k]!=null) o[k]=sd[k]; });
  return o;
}
function _unpackSolid(o){
  if(Array.isArray(o) || !o || !o._pts) return o;
  const a=o._pts.map(q=>[q[0], q[1]]);
  ['_dim','_sec','_bal','_section','_layer'].forEach(k=>{ if(o[k]!=null) a[k]=o[k]; });
  return a;
}
/* Written-down form of a project: filled shapes packed so their tags survive. */
function packProject(proj){
  const out=JSON.parse(JSON.stringify(proj, _saveShape));
  (out.pages||[]).forEach((pg,i)=>{
    const src=(proj.pages||[])[i];
    if(!src || !src.dxf || !src.dxf.solids) return;
    pg.dxf.solids=src.dxf.solids.map(_packSolid);
  });
  return out;
}
function unpackProject(proj){
  (proj && proj.pages || []).forEach(pg=>{
    if(pg && pg.dxf && pg.dxf.solids) pg.dxf.solids=pg.dxf.solids.map(_unpackSolid);
  });
  return proj;
}
function _saveShape(k,v){""")

rep("        const plain=JSON.parse(JSON.stringify(proj, _saveShape));",
    "        const plain=packProject(proj);")
rep("    return new Promise(res=>{\n      let out=[];",
    "    return new Promise(res=>{\n      let out=[];")
rep("        rq.onsuccess=()=>res(rq.result||[]);",
    "        rq.onsuccess=()=>res((rq.result||[]).map(unpackProject));")
rep("function loadLegacy(){ try{ return JSON.parse(localStorage.getItem(LS_KEY))||[]; }catch(e){ return []; } }",
    "function loadLegacy(){ try{ return (JSON.parse(localStorage.getItem(LS_KEY))||[]).map(unpackProject); }catch(e){ return []; } }")
rep("  try{ localStorage.setItem(LS_KEY, JSON.stringify(DB, _saveShape)); _storageWarned=false; }",
    "  try{ localStorage.setItem(LS_KEY, JSON.stringify(DB.map(packProject))); _storageWarned=false; }")

# ---- line styles: the four a drawing actually uses --------------------------
# "Section line" is not a line style a person picks - a cutting plane is drawn by
# the section marker itself, from its model. Offering it here invited someone to
# make a stroke that looks like a marker but is not one, which nothing downstream
# would understand.
rep("""  section: {label:'Section line', icon:'bi-scissors',      dash:[12,2,3,2,3,2],  w:1.4,  _section:true},
""", "")

# the menu shows what each style looks like, not a stand-in icon
rep("""    lt='<div class="ctitle">Line style</div>';
    Object.entries(LINE_TYPES).forEach(([k,d])=>{
      lt+='<div class="ci" data-lt="'+k+'"><i class="bi '+d.icon+'"></i> '+d.label
        + (cur===k?'<span class="k"><i class="bi bi-check-lg"></i></span>':'') + '</div>';
    });""",
"""    lt='<div class="ctitle">Line style</div>';
    Object.entries(LINE_TYPES).forEach(([k,d])=>{
      /* Draw the line itself rather than name it: a chain line and a phantom line
         are told apart by their pattern, and no icon carries that. */
      const W=54, Y=9, arr=(d.dash||[]).map(v=>v*1.6);
      const svg='<svg width="'+W+'" height="18" viewBox="0 0 '+W+' 18" style="vertical-align:middle;flex:0 0 auto">'
        + '<line x1="1" y1="'+Y+'" x2="'+(W-1)+'" y2="'+Y+'" stroke="currentColor" '
        + 'stroke-width="'+Math.max(1, d.w*1.4).toFixed(1)+'"'
        + (arr.length? ' stroke-dasharray="'+arr.join(' ')+'"':'') + ' stroke-linecap="butt"/></svg>';
      lt+='<div class="ci" data-lt="'+k+'" style="display:flex;align-items:center;gap:10px">'
        + svg + '<span style="flex:1">' + d.label + '</span>'
        + (cur===k?'<span class="k"><i class="bi bi-check-lg"></i></span>':'') + '</div>';
    });""")

# ---- the description page shows a hidden line too ---------------------------
# The legend named four things and drew three lines and a hatch; a hidden line is
# as much a part of reading a drawing as a centre line, and it was missing.
rep("const LEGEND_DEF=['OBJECT LINE','CENTER LINE','SECTION LINE','SECTION PLASTIC'];",
    "const LEGEND_DEF=['OBJECT LINE','HIDDEN LINE','CENTER LINE','SECTION LINE','SECTION PLASTIC'];")
rep("  if(!d.legend||d.legend.length!==4) d.legend=LEGEND_DEF.slice();",
    "  if(!d.legend||d.legend.length!==5) d.legend=LEGEND_DEF.slice();")
rep("""  const lineY=[97.76*k,87.15*k,76.54*k], baseL=[95.11*k,84.50*k,73.90*k,62.58*k];""",
"""  /* Five rows where there were four, evenly spaced. The label of the last row
     sits beside the hatched box, which is taller than a line - spacing the labels
     as if every row were a line put the last two on top of each other. */
  const yTop=80.5*k, yGap=8.5*k;      /* lowered: the description needs the space */
  const lineY=[0,1,2,3].map(i=>yTop-i*yGap);
  const boxTop=lineY[3]-4.5*k, boxBot=boxTop-8.8*k;
  const baseL=lineY.map(y=>y-2.65*k).concat([(boxTop+boxBot)/2-1.9*k]);""")
rep("""  dashRow(lineY[0],[[0,49.03]]);                                           // OBJECT: solid
  dashRow(lineY[1],[[0,17.64],[20.46,28.93],[31.75,49.03]]);               // CENTER: long-short-long
  dashRow(lineY[2],[[0,11.99],[14.81,23.28],[26.10,34.57],[37.39,49.03]]); // SECTION: dashes
  const c1=W2S(xS0,68.95*k), c2=W2S(xS1,60.11*k);                          // SECTION PLASTIC: hatched box""",
"""  dashRow(lineY[0],[[0,49.03]]);                                           // OBJECT: solid
  /* Seven dashes with six gaps, chosen to end exactly at 49.03 like every other
     sample. Spacing them by a round number instead left a stub of a dash at the
     far end, which reads as a mistake rather than a line type. */
  dashRow(lineY[1],[[0,4.86],[7.36,12.22],[14.72,19.58],[22.08,26.94],
                    [29.44,34.30],[36.80,41.66],[44.16,49.03]]);
  dashRow(lineY[2],[[0,17.64],[20.46,28.93],[31.75,49.03]]);               // CENTER: long-short-long
  dashRow(lineY[3],[[0,11.99],[14.81,23.28],[26.10,34.57],[37.39,49.03]]); // SECTION: dashes
  const c1=W2S(xS0,boxTop), c2=W2S(xS1,boxBot);                            // SECTION PLASTIC: hatched box""")

# ---- the switch says what it governs ----------------------------------------
rep("<span>On: Stylize restyles the drawing &middot; Off: only the text size changes</span>",
    "<span>Horizontal radius &amp; section dimension landing</span>")

# ---- BOM rows: 4 px of air above and below the text, no more ----------------
# A row was a fixed 6 mm whatever the text height, which at the current size left
# 6 px of space above and below - a table twice as tall as it needs to be. The row
# is now the text plus a fixed 4 px, so it stays tight at any text size.
rep("const BOM_TITLE_H=6.4, BOM_HEAD_H=6.0, BOM_ROW_MIN=6.0, BOM_PAD=1.4, BOM_MINCOL=10;",
    """const BOM_TITLE_H=6.4, BOM_HEAD_H=6.0, BOM_PAD=1.4, BOM_MINCOL=10;
const BOM_ROW_PAD_PX=4;                       /* air above and below the text */
function bomRowPadMM(){ return BOM_ROW_PAD_PX*25.4/96; }
function bomRowMinMM(){ return bomFontMM() + bomRowPadMM()*2; }""")
rep("    return Math.max(BOM_ROW_MIN, mx*lh+BOM_PAD*1.1); }); }",
    """    /* The row is the TEXT plus the padding. Using the line height instead
       of the text height smuggled its leading in as extra air - a row asked for
       4 px of padding and got nearly 6. Leading belongs BETWEEN lines only. */
    const BF=bomFontMM();
    return Math.max(bomRowMinMM(), BF + (mx-1)*lh + bomRowPadMM()*2); }); }""")

# ---- the BOM header rows get the same 4 px as the body rows -----------------
rep("const BOM_TITLE_H=6.4, BOM_HEAD_H=6.0, BOM_PAD=1.4, BOM_MINCOL=10;",
    """const BOM_PAD=1.4, BOM_MINCOL=10;""")
for _old, _new in [
  ("function bomRowMinMM(){ return bomFontMM() + bomRowPadMM()*2; }",
   """function bomRowMinMM(){ return bomFontMM() + bomRowPadMM()*2; }
/* The heading and the column names are rows too, and a row is its text plus 4 px.
   Fixing them at 6.4 and 6.0 mm made the top of the table twice as deep as the
   body once the body learned to fit its text. */
function bomTitleRowMM(){ return bomTitleMM() + bomRowPadMM()*2; }
function bomHeadRowMM(){  return bomFontMM()  + bomRowPadMM()*2; }"""),
]:
    rep(_old, _new)
_s = s
s = s.replace("BOM_TITLE_H", "bomTitleRowMM()").replace("BOM_HEAD_H", "bomHeadRowMM()")

# ---- stroke weight must move the dimension lines too ------------------------
# Both widths were floored in PIXELS before the setting was applied: below about
# 0.26 mm the object line sat pinned at 1 px and the dimension line at 0.6 px, so
# a third of the slider did nothing at all, and the dimension line barely moved
# across the rest. The weights now come from the setting in millimetres - a
# dimension line staying the thinner of the two, as a drawing office draws it.
rep("  const lw=Math.max(1, mm2px(store.format.stroke||0.2));",
    """  /* The floor is only there to stop a line vanishing; set high it swallows the
     setting instead. At 0.75 px everything below about 0.2 mm - a third of the
     slider, and the default sits right on the edge of it - came out identical, so
     the dimension lines never appeared to respond at all. Canvas draws a
     sub-pixel line as a lighter one, which is what a hairline should look like. */
  const lw=Math.max(0.3, mm2px(store.format.stroke||0.2));""")
rep("    ctx.lineWidth = p._lw ? Math.max(0.6, lw*p._lw) : lw;   // line type carries its own weight",
    "    ctx.lineWidth = p._lw ? Math.max(0.2, lw*p._lw) : lw;   // line type carries its own weight")

# ---- the Add Pointer button needs an icon that exists -----------------------
# The button asked for "bi-1-circle", which is a Bootstrap name and not one of the
# icons this app draws - so the painter marked it data-ic="none" and the button
# came out blank. An item balloon IS a circle with a number in it, so that is what
# it shows: drawn here rather than named, so it cannot go missing again.
rep(" 'table':'<rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\"/><path d=\"M3 9h18\"/><path d=\"M3 15h18\"/><path d=\"M9 3v18\"/>',",
""" 'table':'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/>',
 /* An item balloon: a ring with a 1 in it, centred and nothing else.
    With the leader tail drawn as well it read as a magnifying glass. */
 'balloon-1':'<circle cx="12" cy="12" r="8.5"/>'
   + '<path d="M10.4 9.3 12.3 7.7"/><path d="M12.3 7.7v8.6"/><path d="M10.2 16.3h4.2"/>',""")
rep('<button class="tool-sq" id="btnBalloon" title="Add Pointer"><i class="bi bi-1-circle"></i></button>',
    '<button class="tool-sq" id="btnBalloon" title="Add Pointer"><i class="bi bi-balloon-1"></i></button>')

# ---- the gear on the dashboard sets the DEFAULT format ----------------------
# The same panel, but editing the settings a NEW project starts from. Projects
# already made keep whatever they were given: a person who has tuned one drawing
# does not want that undone because they changed what the next drawing should
# start as.
rep('      <button class="icon-circle" title="Settings"><i class="bi bi-gear"></i></button>',
    '      <button class="icon-circle" id="btnDefaults" title="Default format for new projects"><i class="bi bi-gear"></i></button>')

rep("""function blankFormat(){
  return {""",
"""const DEFAULTS_KEY='drawingmaster.defaultFormat.v1';
/* What a new project starts from. Saved separately from the projects, so it
   survives them and none of them is touched when it changes. */
function loadDefaultFormat(){
  try{ const raw=localStorage.getItem(DEFAULTS_KEY);
       return raw? JSON.parse(raw) : null; }catch(e){ return null; }
}
function saveDefaultFormat(f){
  try{ localStorage.setItem(DEFAULTS_KEY, JSON.stringify(f)); return true; }
  catch(e){ console.warn('could not save the default format', e); return false; }
}
function factoryFormat(){
  return {""")
rep("""  };
}
function newProject(name){""",
"""  };
}
/* A new project starts from the saved defaults where there are any, and from the
   factory settings where there are not. The two are merged rather than swapped,
   so a defaults file written by an older build still gets any new field. */
function blankFormat(){
  const f=factoryFormat(), d=loadDefaultFormat();
  if(!d) return f;
  const out=Object.assign({}, f, d);
  out.approvals=Object.assign({}, f.approvals, d.approvals||{});
  return out;
}
function newProject(name){""")

# the panel needs to know which of the two it is editing
rep("""function openFormat(){
  fmtDraft=JSON.parse(JSON.stringify(store.format));""",
"""function openFormat(defaults){
  fmtEditingDefaults=!!defaults;
  /* The panel draws its previews from the open project. On the dashboard there is
     none, so it is given a throwaway one to look at - discarded on the way out,
     which is why nothing here can reach a real project. */
  if(fmtEditingDefaults){
    /* ALWAYS a throwaway, not only when no project is open. goDashboard leaves
       the last project in `store`, so borrowing only when there was none meant
       the defaults panel showed - and previewed - whatever project had been
       opened last. The defaults belong to no project, so they are shown against
       one that does not exist. It is never in DB, so persist can never write it. */
    fmtPrevStore=store; fmtBorrowedStore=true;
    store=newProject('Project');
    store.format=blankFormat();
  }
  fmtDraft=JSON.parse(JSON.stringify(
    fmtEditingDefaults ? blankFormat() : store.format));""")
rep("""function closeFormat(save){
  if(save){ snapshot();
    const pj=fmtDraft.__project; delete fmtDraft.__project;
    store.format=fmtDraft;
    if(pj!=null && pj!==store.name){ store.name=pj; syncNavName(); }
    afterMutate(); fitView(); }
  if(fmtDraft) delete fmtDraft.__project;
  fmtDraft=null; $('#formatView').classList.add('hide');
  const bd=$('#editor .body'); if(bd) bd.style.visibility='';
  render();
}""",
"""function closeFormat(save){
  if(save && fmtEditingDefaults){
    delete fmtDraft.__project;
    /* Only what a new drawing should start as. The project name belongs to one
       drawing, not to every drawing that follows it. */
    const keep=['paper','margin','font','fontSize','decimals','stroke',
                'ansiRadius','ansiSection','docType','company','version','scale'];
    const out={}; keep.forEach(k=>{ if(fmtDraft[k]!==undefined) out[k]=fmtDraft[k]; });
    /* The people who sign the drawings are the same people next time, so the
       approval NAMES carry to the next project. The dates are that drawing's own
       and start empty. Projects already made keep what they were given. */
    out.approvals={};
    ['design','drawn','approved'].forEach(k=>{
      out.approvals[k]={ name:((fmtDraft.approvals||{})[k]||{}).name||'', date:'' }; });
    if(saveDefaultFormat(out)) toast('saved as the default for new projects');
    else toast('could not save the default format');
  }
  else if(save){ snapshot();
    const pj=fmtDraft.__project; delete fmtDraft.__project;
    store.format=fmtDraft;
    if(pj!=null && pj!==store.name){ store.name=pj; syncNavName(); }
    afterMutate(); fitView(); }
  if(fmtDraft) delete fmtDraft.__project;
  fmtDraft=null; fmtEditingDefaults=false;
  if(fmtBorrowedStore){ store=fmtPrevStore||null; fmtPrevStore=null; fmtBorrowedStore=false; }
  $('#formatView').classList.add('hide');
  const bd=$('#editor .body'); if(bd) bd.style.visibility='';
  const onDash=!$('#dashboard').classList.contains('hide');
  if(!onDash) render();
}""")
rep("let fmtDraft=null;", "let fmtDraft=null, fmtEditingDefaults=false, fmtBorrowedStore=false, fmtPrevStore=null;")

rep("  $('#btnCreate').onclick=createProject;",
    """  $('#btnCreate').onclick=createProject;
  { const g=$('#btnDefaults'); if(g) g.onclick=()=>openFormat(true); }""")

# say which of the two the panel is editing, so nobody saves the wrong one
rep('    <div class="fmt-h1">Format Config</div>',
    '    <div class="fmt-h1">${fmtEditingDefaults? \'Default Format\' : \'Format Config\'}</div>')

# openFormat now takes a flag, and a click handler passes the EVENT as its first
# argument - which is truthy, so every Format Config button opened the defaults.
rep("  $('#btnFormat').onclick=openFormat;", "  $('#btnFormat').onclick=()=>openFormat(false);")

# ---- what was moved is written down where it was moved to -------------------
# An object carries its move as dx/dy while the object list is alive, and that
# list is NOT saved - it is thrown away and rebuilt from the drawing whenever a
# project is opened. So a move that only ever reached dx/dy did not survive a
# refresh: every part sprang back to where the imported file had put it, and a
# label the user had added and dragged went back to the middle of the sheet.
#
# Baking folds the moves into the drawing itself, and the drawing is what is
# saved. Doing it here - in the one function that writes a project down - covers
# every way out of the program: refresh, closing the tab, going back to the
# dashboard, switching pages. tests/t_keepplace.js measures it.
rep("""function persist(){ if(store){ store.updated=Date.now(); const i=DB.findIndex(p=>p.id===store.id); if(i>=0)DB[i]=store; }
  if(_useIDB){""",
"""function bakePlaces(){
  if(!store || !store.pages) return;
  store.pages.forEach(pg=>{
    if(pg.type!=='sheet' || !pg.objects || !pg.objects.length) return;
    try{ bakeOffsets(pg); }catch(e){ console.warn('could not bake positions', e); }
  });
}
function persist(){ bakePlaces();
  if(store){ store.updated=Date.now(); const i=DB.findIndex(p=>p.id===store.id); if(i>=0)DB[i]=store; }
  if(_useIDB){""")

# ---- a group the user made is remembered too ---------------------------------
# The same root cause as the moves above: grouping lives on the object, the object
# list is thrown away and rebuilt from the drawing, so every group a person made
# by hand was gone on the next open. Only the groups the program works out for
# itself - the parts of a dimension - came back, which is why it looked as though
# grouping "sometimes" survived.
#
# The group is written on the PIECES, which are saved, and read back when the
# objects are rebuilt. Its id is random rather than counted: a counter starts at 1
# again in the next session, and the second group anyone made would have taken the
# id of the first and swallowed it.
rep("""function groupSelection(){ if(selIds.size<2) return; const gid='g'+(_grpSeq++); snapshot();
  selIds.forEach(id=>{ const o=objById(id); if(o) o.group=gid; }); afterMutate(); toast('grouped'); }
function ungroupSelection(){ let any=false; snapshot();
  selIds.forEach(id=>{ const o=objById(id); if(o&&o.group){ o.group=null; any=true; } });
  if(any){ afterMutate(); toast('ungrouped'); } else history.undo.pop(); }""",
"""function primsOf(o){ const P=(o&&o.prims)||{}, out=[];
  ['polys','texts','solids','marks','hatches','clines'].forEach(k=>(P[k]||[]).forEach(x=>{ if(x) out.push(x); }));
  return out; }
function groupSelection(){ if(selIds.size<2) return;
  const gid='u'+Math.random().toString(36).slice(2,10); snapshot();
  selIds.forEach(id=>{ const o=objById(id); if(!o) return; o.group=gid; o.ug=true;
    primsOf(o).forEach(x=>{ x._grp=gid; }); });
  afterMutate(); toast('grouped'); }
function ungroupSelection(){ let any=false; snapshot();
  selIds.forEach(id=>{ const o=objById(id); if(o&&o.group){ o.group=null; o.ug=false;
    primsOf(o).forEach(x=>{ if(x._grp!=null) delete x._grp; }); any=true; } });
  if(any){ afterMutate(); toast('ungrouped'); } else history.undo.pop(); }""")

# and read back when the object list is built again
rep("""    const dim=o&&o._dim, sec=o&&o._sec, bal=o&&o._bal;
    let grp=null;
    if(dim){ grp=dimGroups[dim] || (dimGroups[dim]='g'+(_gidSeq++)); }""",
"""    const dim=o&&o._dim, sec=o&&o._sec, bal=o&&o._bal;
    let grp=null;
    /* A group the user made outranks the one the program would work out: they
       grouped these pieces on purpose, and said so on the pieces themselves. */
    if(o&&o._grp){ grp=o._grp; }
    else if(dim){ grp=dimGroups[dim] || (dimGroups[dim]='g'+(_gidSeq++)); }""")

# a filled shape is an ARRAY: its group has to be packed with the rest of its tags
rep("  ['_dim','_sec','_bal','_section','_layer'].forEach(k=>{ if(sd[k]!=null) o[k]=sd[k]; });",
    "  ['_dim','_sec','_bal','_section','_layer','_grp'].forEach(k=>{ if(sd[k]!=null) o[k]=sd[k]; });")
rep("  ['_dim','_sec','_bal','_section','_layer'].forEach(k=>{ if(o[k]!=null) a[k]=o[k]; });",
    "  ['_dim','_sec','_bal','_section','_layer','_grp'].forEach(k=>{ if(o[k]!=null) a[k]=o[k]; });")

# so is a point mark, and for the same reason
rep("""/* Written-down form of a project: filled shapes packed so their tags survive. */""",
"""function _packMark(m){ return (Array.isArray(m) && m._grp!=null)? {_p:[m[0],m[1]], _grp:m._grp} : m; }
function _unpackMark(o){ if(Array.isArray(o) || !o || !o._p) return o;
  const a=[o._p[0], o._p[1]]; if(o._grp!=null) a._grp=o._grp; return a; }
/* Written-down form of a project: filled shapes packed so their tags survive. */""")
rep("""    pg.dxf.solids=src.dxf.solids.map(_packSolid);
  });""",
"""    pg.dxf.solids=src.dxf.solids.map(_packSolid);
    if(src.dxf.marks) pg.dxf.marks=src.dxf.marks.map(_packMark);
  });""")
rep("""    if(pg && pg.dxf && pg.dxf.solids) pg.dxf.solids=pg.dxf.solids.map(_unpackSolid);""",
"""    if(pg && pg.dxf && pg.dxf.solids) pg.dxf.solids=pg.dxf.solids.map(_unpackSolid);
    if(pg && pg.dxf && pg.dxf.marks) pg.dxf.marks=pg.dxf.marks.map(_unpackMark);""")

# ---- undo must hand back a drawing that is still joined up -------------------
# A snapshot was a plain JSON copy of the pages, and that copy contains BOTH the
# drawing and the object list - as two separate copies of what were the same
# pieces. After an undo, moving something wrote into the object list's copy while
# the drawing kept the old numbers, and saving wrote down the drawing: the move
# was lost on the next open, and only ever after an undo, which is what made it
# look random. Plain JSON also drops the tags carried on filled shapes, so an undo
# could take a marker's arrowheads away from it.
#
# So a snapshot is written the same way a saved project is - tags packed, object
# list left out - and reading one back rebuilds the objects from the drawing.
rep("""function snapshot(){ history.undo.push(JSON.stringify({pages:store.pages,format:store.format,name:store.name}));""",
"""function _snapText(){ return JSON.stringify(packProject({pages:store.pages, format:store.format, name:store.name})); }
function snapshot(){ history.undo.push(_snapText());""")
rep("""function applySnap(s){ const o=JSON.parse(s); store.pages=o.pages; store.format=o.format; store.name=o.name;
  if(!store.pages.find(p=>p.id===store.activeId)) store.activeId=store.pages[0].id; }""",
"""function applySnap(s){ const o=unpackProject(JSON.parse(s));
  store.pages=o.pages; store.format=o.format; store.name=o.name;
  if(!store.pages.find(p=>p.id===store.activeId)) store.activeId=store.pages[0].id;
  /* Build the objects from the drawing that just came back, so the two are the
     same pieces again and everything drawn from a model is drawn once more. */
  store.pages.forEach(pg=>{ if(pg.type==='sheet' && pg.dxf) rebuildKeepingPlaces(pg); });
  if(typeof selIds!=='undefined'){ selIds=new Set(); if(typeof updateSelToolbar==='function') updateSelToolbar(); } }""")
rep("""function undo(){ if(!history.undo.length)return; history.redo.push(JSON.stringify({pages:store.pages,format:store.format,name:store.name}));""",
"""function undo(){ if(!history.undo.length)return; history.redo.push(_snapText());""")
rep("""function redo(){ if(!history.redo.length)return; history.undo.push(JSON.stringify({pages:store.pages,format:store.format,name:store.name}));""",
"""function redo(){ if(!history.redo.length)return; history.undo.push(_snapText());""")

# ---- the box you type in is big enough to type in ---------------------------
# Every click-to-edit box was cut to the exact size of the DRAWN text: at the size
# a label is really drawn that is a sliver ten pixels tall and as wide as the word
# already in it - hard to hit, with no room for the caret and nowhere to put a
# longer line. The text inside still sits exactly where it is drawn; the box grows
# around it, and very small text is typed at a readable size instead of a 9 px one.
rep("function startTextEdit(ob,t){", """/* One place that decides the shape of an inline editor, used by both of them:
   the labels on a sheet and the fields on the cover and description pages. */
const EDIT_PAD_X=12, EDIT_PAD_Y=9, EDIT_BORDER=2, EDIT_MIN_FONT=15, EDIT_MIN_W=200;
function inlineTextWidth(v, fontPx, bold){
  try{ ctx.save(); ctx.font=(bold?'700 ':'400 ')+fontPx+'px '+store.format.font+',Arial';
       const w=ctx.measureText(String(v||'')||'M').width; ctx.restore(); return w; }
  catch(_){ return String(v||'').length*fontPx*0.6; }
}
/* o: {fontPx, bold, align:'left'|'center'|'right', anchorX, textMidY, textW, minW}
   anchorX is the screen x of the text's OWN anchor - its left edge, centre or
   right edge, whichever the alignment says - so the box is placed from the text
   rather than the text from the box, and nothing appears to jump when clicked. */
function layoutInlineEdit(el, o){
  const f=Math.max(EDIT_MIN_FONT, o.fontPx);
  const lh=Math.round(f*1.3);
  const h=lh+EDIT_PAD_Y*2+EDIT_BORDER*2;
  const w=Math.max(o.minW||EDIT_MIN_W, o.textW+f*1.5)+EDIT_PAD_X*2+EDIT_BORDER*2;
  el.style.boxSizing='border-box';
  el.style.font=(o.bold?'700 ':'400 ')+f+'px '+store.format.font+',Arial';
  el.style.lineHeight=lh+'px';
  el.style.padding='0 '+EDIT_PAD_X+'px';
  el.style.borderWidth=EDIT_BORDER+'px';
  el.style.width=w+'px'; el.style.height=h+'px';
  el.style.textAlign=o.align;
  let left=o.anchorX;
  if(o.align==='center') left-=w/2;
  else if(o.align==='right') left-=w-EDIT_PAD_X-EDIT_BORDER;
  else left-=EDIT_PAD_X+EDIT_BORDER;
  /* and never off the edge of the stage, where it could not be typed into */
  const sw=(stage&&stage.clientWidth)||0;
  if(sw){ left=Math.min(left, sw-w-8); left=Math.max(left, 8); }
  el.style.left=Math.round(left)+'px';
  el.style.top=Math.round(o.textMidY-h/2)+'px';
  return {w:w, h:h, font:f};
}
function startTextEdit(ob,t){""")

# the sheet labels
rep("""  const padX=Math.max(2,hpx*0.06), bd=1.5;
  const wpx=Math.max(hpx*0.9, tw)+padX*2+bd*2+2;
  const H=hpx*1.18;
  let left; if(t.align===1) left=p.x-wpx/2; else if(t.align===2) left=p.x-wpx; else left=p.x-padX-bd;
  const top=p.y - hpx*0.94;                                  // align input's text baseline with p.y
  el.style.boxSizing='border-box';
  el.style.left=left+'px'; el.style.top=top+'px';
  el.style.width=wpx+'px'; el.style.height=H+'px'; el.style.lineHeight=H+'px';
  el.style.padding='0 '+padX+'px'; el.style.borderWidth=bd+'px';
  el.style.font=`${FW}${hpx}px ${store.format.font},Arial`;
  if(isUserText(t)) el.style.textTransform='uppercase';
  el.style.textAlign=(t.align===1?'center':t.align===2?'right':'left');""",
"""  const ALIGN=(t.align===1?'center':t.align===2?'right':'left');
  /* p.y is the baseline; the middle of the letters sits a third of the height
     above it, and that is the point the box is centred on. */
  const box=()=>layoutInlineEdit(el, {fontPx:hpx, bold:!!t.bold, align:ALIGN,
    anchorX:p.x, textMidY:p.y-hpx*0.35,
    textW:inlineTextWidth(el.value, Math.max(EDIT_MIN_FONT,hpx), !!t.bold)});
  box();
  if(isUserText(t)) el.style.textTransform='uppercase';""")
rep("""    try{ ctx.save(); ctx.font=`${FW}${hpx}px ${store.format.font},Arial`; const nw=ctx.measureText(el.value||'M').width; ctx.restore();
      const W2=Math.max(hpx*0.9,nw)+padX*2+bd*2+2; el.style.width=W2+'px';
      if(t.align===1) el.style.left=(p.x-W2/2)+'px'; else if(t.align===2) el.style.left=(p.x-W2)+'px'; }catch(_){}""",
"""    try{ box(); }catch(_){}                                  // grow around the text""")

# the cover and description pages
rep("""  const tl=W2S(zone.x,zone.y+zone.h), br=W2S(zone.x+zone.w,zone.y);
  const el=document.createElement(zone.multiline?'textarea':'input');
  el.className='inline-edit'; el.value=zone.val||'';
  if(zone.multiline){ el.style.lineHeight=mm2px(zone.lh)+'px'; el.rows=3; }
  el.style.left=tl.x+'px'; el.style.top=tl.y+'px';
  el.style.width=Math.max(60,br.x-tl.x)+'px'; el.style.height=(br.y-tl.y)+'px';
  el.style.font=(zone.bold?'700 ':'400 ')+mm2px(zone.em)+'px '+store.format.font+',Arial';
  el.style.textAlign=zone.align==='c'?'center':zone.align==='r'?'right':'left';
  stage.appendChild(el);""",
"""  const el=document.createElement(zone.multiline?'textarea':'input');
  el.className='inline-edit'; el.value=zone.val||'';
  const ALIGN=zone.align==='c'?'center':zone.align==='r'?'right':'left';
  const fontPx=mm2px(zone.em);
  /* The anchor is the edge the text is drawn from, and the middle of the box is
     the middle of the letters - zone.y is their foot, zone.h their height. */
  const anchorX=(ALIGN==='center') ? W2S(zone.x+zone.w/2, 0).x
              : (ALIGN==='right')  ? W2S(zone.x+zone.w, 0).x
                                   : W2S(zone.x, 0).x;
  const midY=W2S(0, zone.y+zone.h/2).y;
  /* A sentence needs somewhere to write a sentence; a one-word field does not. */
  const minW=(zone.key==='body') ? 460 : EDIT_MIN_W;
  const box=()=>layoutInlineEdit(el, {fontPx:fontPx, bold:!!zone.bold, align:ALIGN,
    anchorX:anchorX, textMidY:midY, minW:minW,
    textW:inlineTextWidth(el.value, Math.max(EDIT_MIN_FONT,fontPx), !!zone.bold)});
  box();
  if(zone.multiline){ el.style.lineHeight=mm2px(zone.lh)+'px'; el.rows=3; }
  el.addEventListener('input',()=>{ try{ box(); }catch(_){} });
  stage.appendChild(el);""")

# ---- the description legend: 4 px more air between the rows ------------------
# The five rows were 8.5 mm apart, which at the scale the page is read at (about
# 2.6 px per mm at 100%) leaves the labels almost touching. 4 px is 1.5 mm, and
# the hatched box moves down with them so the rhythm stays even.
rep("""  const yTop=80.5*k, yGap=8.5*k;      /* lowered: the description needs the space */""",
"""  /* 4.6 mm more than the 8.5 it was drawn at = 12 px at the scale the page is
     read at (about 2.59 px per mm at 100%). */
  const yTop=80.5*k, yGap=(8.5+4.6)*k;""")
rep("""  const boxTop=lineY[3]-4.5*k, boxBot=boxTop-8.8*k;""",
"""  const boxTop=lineY[3]-(4.5+4.6)*k, boxBot=boxTop-8.8*k;""")

# ---- a short field is as wide as what is in it ------------------------------
# A minimum width that suits a sentence is a nuisance on a dimension value: the
# box covered the drawing around what was being typed. The floor is now only what
# a caret and a couple of characters need; the box still grows as you type.
rep("const EDIT_PAD_X=12, EDIT_PAD_Y=9, EDIT_BORDER=2, EDIT_MIN_FONT=15, EDIT_MIN_W=200;",
    "const EDIT_PAD_X=12, EDIT_PAD_Y=9, EDIT_BORDER=2, EDIT_MIN_FONT=15, EDIT_MIN_W=56;")
rep("  const w=Math.max(o.minW||EDIT_MIN_W, o.textW+f*1.5)+EDIT_PAD_X*2+EDIT_BORDER*2;",
    """  /* Width follows the text. A fixed width covers whatever is beside it, and on a
     sheet that is the drawing itself. */
  const w=(o.fixedW!=null) ? o.fixedW+EDIT_PAD_X*2+EDIT_BORDER*2
        : Math.max(o.minW||EDIT_MIN_W, o.textW+f*1.5)+EDIT_PAD_X*2+EDIT_BORDER*2;
  const rows=Math.max(1, o.rows||1), lhBox=o.lineH||lh;""")
rep("""  el.style.width=w+'px'; el.style.height=h+'px';""",
    """  const hh=(rows>1)? (rows*lhBox+EDIT_PAD_Y*2+EDIT_BORDER*2) : h;
  el.style.width=w+'px'; el.style.height=hh+'px';
  if(rows>1) el.style.lineHeight=lhBox+'px';""")
rep("""  el.style.left=Math.round(left)+'px';
  el.style.top=Math.round(o.textMidY-h/2)+'px';
  return {w:w, h:h, font:f};""",
"""  el.style.left=Math.round(left)+'px';
  /* One line is centred on the letters it replaces. Several lines are hung from
     the FIRST line, so line one lands on line one and the block grows downwards
     exactly as the drawn text does. */
  el.style.top=Math.round((rows>1)
      ? o.textMidY-lhBox/2-EDIT_PAD_Y-EDIT_BORDER
      : o.textMidY-h/2)+'px';
  return {w:w, h:hh, font:f};""")

# ---- the description text wraps, and stops where the project name stops ------
# It was one line that ran on for ever, off the paper and past anything else on
# the page. A description is a paragraph: it is given the width of the line above
# it - from its own left edge to the right end of the project name - and wraps.
rep("""function drawTextMM(x,baseY,txt,em,bold,al){""",
"""/* Break a paragraph into lines that fit a width, in the page's own millimetres.
   Newlines the user typed are kept as their own paragraphs; a single word too
   long to fit is broken rather than allowed to run off the sheet. */
function wrapTextMM(txt, em, bold, maxW){
  const out=[];
  const fitWord=(w)=>{
    if(measureMM(w,em,bold)<=maxW) return [w];
    const parts=[]; let cur='';
    for(const ch of w){ if(cur && measureMM(cur+ch,em,bold)>maxW){ parts.push(cur); cur=ch; } else cur+=ch; }
    if(cur) parts.push(cur);
    return parts;
  };
  String(txt==null?'':txt).split('\\n').forEach(para=>{
    const words=para.split(/\\s+/).filter(w=>w.length);
    if(!words.length){ out.push(''); return; }
    let line='';
    words.forEach(w0=>{ fitWord(w0).forEach(w=>{
      const t=line? line+' '+w : w;
      if(!line || measureMM(t,em,bold)<=maxW) line=t;
      else { out.push(line); line=w; } }); });
    out.push(line);
  });
  return out.length? out : [''];
}
function drawTextMM(x,baseY,txt,em,bold,al){""")
rep("""  const emB=5.0*k, byB=120.25*k, body=d.body||'';
  drawTextMM(xL,byB,body,emB,false,'l');
  const bw=Math.max(measureMM(body,emB,false),45*u);
  page._zones.push({key:'body',val:body,x:xL,y:byB,w:bw,h:emB*0.716,em:emB,bold:false,align:'l'});""",
"""  const emB=5.0*k, byB=120.25*k, body=d.body||'';
  /* As wide as the line above it and no wider: the project name is right-aligned
     to xR, so the paragraph runs from its own left edge to that same edge. */
  const bw=xR-xL, lhB=emB*1.55;
  const bodyLines=wrapTextMM(body, emB, false, bw);
  bodyLines.forEach((ln,i)=>drawTextMM(xL, byB-i*lhB, ln, emB, false, 'l'));
  page._bodyLines=bodyLines.length; page._bodyWidthMM=bw;
  page._zones.push({key:'body', val:body, x:xL, y:byB-(bodyLines.length-1)*lhB,
                    w:bw, h:emB*0.716+(bodyLines.length-1)*lhB,
                    em:emB, bold:false, align:'l', multiline:true, lh:lhB});""")

# the editor for it is the same shape: the same width, wrapping the same way
rep("""  /* A sentence needs somewhere to write a sentence; a one-word field does not. */
  const minW=(zone.key==='body') ? 460 : EDIT_MIN_W;
  const box=()=>layoutInlineEdit(el, {fontPx:fontPx, bold:!!zone.bold, align:ALIGN,
    anchorX:anchorX, textMidY:midY, minW:minW,
    textW:inlineTextWidth(el.value, Math.max(EDIT_MIN_FONT,fontPx), !!zone.bold)});
  box();
  if(zone.multiline){ el.style.lineHeight=mm2px(zone.lh)+'px'; el.rows=3; }""",
"""  /* A wrapping field keeps the width it wraps at, so what is typed breaks where
     it will break on the paper. Everything else is as wide as its own text. */
  /* When the drawn text is smaller than the smallest comfortable typing size the
     box is a SCALED copy of the block on the paper - width and line height in the
     same proportion as the font - so the words break in the editor exactly where
     they will break when drawn. Widening the box alone would not do it: a bigger
     font in the same width wraps a word earlier. */
  const zoomUp=Math.max(1, EDIT_MIN_FONT/Math.max(fontPx,0.01));
  const wrapW=zone.multiline? mm2px(zone.w)*zoomUp : null;
  const lineH=zone.multiline? mm2px(zone.lh)*zoomUp : null;
  /* the top line of the block is the one to hang the box from */
  const topMidY=zone.multiline? W2S(0, zone.y+zone.h-zone.em*0.716/2).y : midY;
  const box=()=>{
    const rows=zone.multiline
      ? Math.max(1, wrapTextMM(el.value, zone.em, !!zone.bold, zone.w).length) : 1;
    layoutInlineEdit(el, {fontPx:fontPx, bold:!!zone.bold, align:ALIGN,
      anchorX:anchorX, textMidY:topMidY, fixedW:wrapW, rows:rows, lineH:lineH,
      textW:inlineTextWidth(el.value, Math.max(EDIT_MIN_FONT,fontPx), !!zone.bold)});
  };
  box();""")

# ---- the padding follows the size of the type -------------------------------
# 12 and 9 px are right for a title and far too much around a dimension value:
# on the small type most of this app is set in, the padding was wider than the
# letters. It is now a quarter of the font size, and never less than 4 px - which
# is what everything at the minimum typing size gets.
rep("const EDIT_PAD_X=12, EDIT_PAD_Y=9, EDIT_BORDER=2, EDIT_MIN_FONT=15, EDIT_MIN_W=56;",
    """const EDIT_PAD_MIN=4, EDIT_BORDER=2, EDIT_MIN_FONT=15, EDIT_MIN_W=56;
function editPad(fontPx){ return Math.max(EDIT_PAD_MIN, Math.round(fontPx*0.25)); }""")
rep("""  const lh=Math.round(f*1.3);""",
    """  const lh=Math.round(f*1.3);
  const EDIT_PAD_X=editPad(f), EDIT_PAD_Y=EDIT_PAD_X;   // the same air all round""")

# ---- the description page sits in the middle of the paper -------------------
# The reference layout was drawn for a sheet that had something below it; on its
# own it sat high on the page with a band of empty paper under the legend. The
# block is measured between its two FIXED ends - the cap of the project name and
# the bottom of the hatched box - so that a description growing to several lines
# moves nothing: the page must not shift about while it is being typed.
rep("  const xR=260.32*u, xL=131.22*u, xS0=130.51*u, xS1=179.54*u, xLab=188.71*u;",
"""  const xR=260.32*u, xL=131.22*u, xS0=130.51*u, xS1=179.54*u, xLab=188.71*u;
  const emP=18.36*k, byP0=133.99*k;                    /* project name */
  const yTop0=80.5*k, yGap=(8.5+4.6)*k;                /* legend rows */
  const boxTop0=yTop0-3*yGap-(4.5+4.6)*k, boxBot0=boxTop0-8.8*k;
  const dyC=H/2-((byP0+emP*0.716)+boxBot0)/2;          /* what centres the block */""")
rep("  const emP=18.36*k, byP=133.99*k;\n  drawTextMM(xR,byP,proj,emP,true,'r');",
    "  const byP=byP0+dyC;\n  drawTextMM(xR,byP,proj,emP,true,'r');")
rep("  const emB=5.0*k, byB=120.25*k, body=d.body||'';",
    "  const emB=5.0*k, byB=120.25*k+dyC, body=d.body||'';")
rep("""  const yTop=80.5*k, yGap=(8.5+4.6)*k;
  const lineY=[0,1,2,3].map(i=>yTop-i*yGap);
  const boxTop=lineY[3]-(4.5+4.6)*k, boxBot=boxTop-8.8*k;""",
"""  const lineY=[0,1,2,3].map(i=>yTop0+dyC-i*yGap);
  const boxTop=boxTop0+dyC, boxBot=boxBot0+dyC;""")

# ---- double-click steps INTO a group ----------------------------------------
# A group is there so a view moves as one piece. But the moment one dimension in
# it is wrong, the only way in was to ungroup, fix, and group again - and after
# that the group is a different group. Double-clicking a group now steps inside
# it: the piece under the cursor is selected on its own, and everything else in
# the group is left alone. Esc, or a click outside, steps back out.
#
# Inside a group a dimension is still a dimension: clicking any part of one takes
# the whole of it - line, arrows, extension lines and value - because a stray
# extension line on its own is not a thing anyone means to select. Double-click
# again on the value to edit the text, as before.
rep("let selIds=new Set();",
"""let selIds=new Set();
/* the group we have stepped into, if any - only ever a group the user made */
let _inGroup=null;
function insideGroup(){ return _inGroup; }
function leaveGroup(){ if(_inGroup){ _inGroup=null; return true; } return false; }""")

# a group the user made is marked as such, so stepping in applies only to those
rep("""    objs.push({ id:'o'+(_oidSeq++), dx:0, dy:0, group:grp, _dim:dim||null, _sec:sec||null,
                _bal:bal||null, prims }); };""",
"""    objs.push({ id:'o'+(_oidSeq++), dx:0, dy:0, group:grp, _dim:dim||null, _sec:sec||null,
                _bal:bal||null, ug:!!(o&&o._grp), prims }); };""")

rep("""function expandGroup(ids){
  const objs=selectableObjs(); const groups=new Set();
  ids.forEach(id=>{ const o=objById(id); if(o&&o.group) groups.add(o.group); });
  const out=new Set(ids);
  objs.forEach(o=>{ if(o.group&&groups.has(o.group)) out.add(o.id); });
  return out;
}""",
"""function expandGroup(ids){
  const objs=selectableObjs(); const groups=new Set(), parts=new Set();
  ids.forEach(id=>{ const o=objById(id); if(!o) return;
    if(o.group && o.group!==_inGroup) groups.add(o.group);
    else { const tag=o._dim||o._sec||o._bal; if(tag) parts.add(tag); } });
  const out=new Set(ids);
  objs.forEach(o=>{
    if(o.group && groups.has(o.group)){ out.add(o.id); return; }
    /* inside the group, the unit is the dimension or the marker, not one of its
       strokes */
    if(_inGroup && o.group===_inGroup){
      const tag=o._dim||o._sec||o._bal; if(tag && parts.has(tag)) out.add(o.id); }
  });
  return out;
}""")

rep("function clearSelection(){ selIds=new Set(); marquee=null; updateSelToolbar(); render(); }",
    "function clearSelection(){ selIds=new Set(); marquee=null; _inGroup=null; updateSelToolbar(); render(); }")

# stepping in
rep("""      const ht=textAtPoint(w.x,w.y); if(ht){ startTextEdit(ht.ob,ht.t); return; } }""",
"""      /* Step into a group before anything else - but only from outside it, so a
         second double-click on a value still opens the text for editing. */
      { const hit=objAtPoint(w.x,w.y);
        if(hit && hit.ug && hit.group && hit.group!==_inGroup){
          _inGroup=hit.group;
          selIds=expandGroup(new Set([hit.id])); updateSelToolbar(); render();
          toast('inside the group \u2014 Esc to leave');
          return; } }
      const ht=textAtPoint(w.x,w.y); if(ht){ startTextEdit(ht.ob,ht.t); return; } }""")

# stepping back out: a click on anything that is not part of it
rep("""    const hit=objAtPoint(w.x,w.y);
    // Shift on something already selected = "drag me straight", not "deselect me"
    const holdingSelected=(e.shiftKey && hit && selIds.has(hit.id));""",
"""    const hit=objAtPoint(w.x,w.y);
    // clicking anything outside the group we stepped into puts us back outside it
    if(_inGroup && (!hit || hit.group!==_inGroup)) _inGroup=null;
    // Shift on something already selected = "drag me straight", not "deselect me"
    const holdingSelected=(e.shiftKey && hit && selIds.has(hit.id));""")

# Esc leaves the group first, and only then drops the selection
rep("    if(e.key==='Escape'){ clearSelection(); hideCtxMenu(); }",
"""    if(e.key==='Escape'){
      /* one step at a time: out of the group first, keeping what is selected, so
         Esc undoes exactly what the double-click did */
      if(leaveGroup()){ selIds=expandGroup(selIds); updateSelToolbar(); render(); hideCtxMenu(); }
      else { clearSelection(); hideCtxMenu(); } }""")

# ---- the tolerance table lines up on one left edge --------------------------
# "+-  x.x" was one string starting further left than "x.xx"/"x.xxx", so the
# three tolerance labels each began at a different place. The sign is now drawn
# on its own and all three labels share the same left edge. The values are the
# usual one-decimal-per-place run: 0.1 / 0.05 / 0.02.
rep("""  [['+-  x.x',0.327,0.306],['x.xx',0.341,0.382],['x.xxx',0.341,0.452]].forEach(([txt,fx,fy])=>
    T(X(fx), Y(fy), txt,1.20,false,'l'));
  [['0.2',0.306],['0.05',0.382],['0.02',0.452]].forEach(([v,fy])=>
    T(X(0.372), Y(fy), v,1.20,false,'l'));""",
"""  T(X(0.327), Y(0.306), '+-',1.20,false,'l');
  [['x.x',0.306],['x.xx',0.382],['x.xxx',0.452]].forEach(([txt,fy])=>
    T(X(0.341), Y(fy), txt,1.20,false,'l'));
  [['0.1',0.306],['0.05',0.382],['0.02',0.452]].forEach(([v,fy])=>
    T(X(0.372), Y(fy), v,1.20,false,'l'));""")

# ---- Drawing No. says what shape it wants ----------------------------------
# The field's placeholder repeated its own label, which told the user nothing.
# It now shows the pattern itself, and an info mark beside the label spells the
# pattern out on hover for anyone who cannot read PRJ-VER-PRT-XX at a glance.
rep(" 'bullseye':'<circle cx=\"12\" cy=\"12\" r=\"9\"/><circle cx=\"12\" cy=\"12\" r=\"5\"/><circle cx=\"12\" cy=\"12\" r=\"1.5\"/>'\n};",
    " 'bullseye':'<circle cx=\"12\" cy=\"12\" r=\"9\"/><circle cx=\"12\" cy=\"12\" r=\"5\"/><circle cx=\"12\" cy=\"12\" r=\"1.5\"/>',\n"
    " 'info-circle':'<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 11.2v5\"/>'\n"
    "   + '<circle cx=\"12\" cy=\"7.9\" r=\"0.9\" fill=\"currentColor\" stroke=\"none\"/>'\n};")

rep(".rp-inp::placeholder{color:#aeb8c6}",
    """.rp-inp::placeholder{color:#aeb8c6}
/* the info mark that follows a field label - hover for what the field expects */
.lab-info{display:inline-flex;vertical-align:-2px;margin-left:5px;font-size:.92em;color:#9aa3b0;cursor:help}
.lab-info:hover{color:#5b6472}""")

rep("""    <div class="grp"><label>Drawing No.</label>
      <input class="rp-inp" id="tbDraw" placeholder="Drawing No." value="${esc(t.drawingNo)}"></div>""",
"""    <div class="grp"><label>Drawing No.<i class="bi bi-info-circle lab-info" title="Project-Version-Part(Title)-Number"></i></label>
      <input class="rp-inp" id="tbDraw" placeholder="PRJ-VER-PRT-XX" value="${esc(t.drawingNo)}"></div>""")

rep("""<div class="f-field"><label>Drawing No.</label><input class="inp2" disabled placeholder="PRJ-VER-PRT-XX"></div>""",
    """<div class="f-field"><label>Drawing No.<i class="bi bi-info-circle lab-info" title="Project-Version-Part(Title)-Number"></i></label><input class="inp2" disabled placeholder="PRJ-VER-PRT-XX"></div>""")

# ---- the defaults panel locks what belongs to one drawing ------------------
# The gear on the dashboard edits what the NEXT project starts from. Project,
# Title, Version, Scale and the approval dates describe one drawing, not every
# drawing that follows it - closeFormat already refuses to save the names, and
# the fields now say so instead of taking typing that goes nowhere. The same
# panel opened from inside a project still edits all of them.
rep("  const dd=k=>splitDate((ap[k]||{}).date);",
    """  const dd=k=>splitDate((ap[k]||{}).date);
  /* per-drawing fields: editable in a project, shown but locked in the defaults */
  const perDwg=fmtEditingDefaults? ' disabled' : '';""")

rep("""        <div class="f-field"><label>Project</label><input class="inp2" id="fProject" placeholder="Working Drawing" value="${(store.name||'')}"></div>
        <div class="f-field"><label>Title</label><input class="inp2" id="fTitle" placeholder="Title" value="${f.title||''}"></div>""",
"""        <div class="f-field"><label>Project</label><input class="inp2" id="fProject"${perDwg} placeholder="Working Drawing" value="${(store.name||'')}"></div>
        <div class="f-field"><label>Title</label><input class="inp2" id="fTitle"${perDwg} placeholder="Title" value="${f.title||''}"></div>""")

rep("""        <div class="f-field"><label>Version</label><input class="inp2" id="fVersion" placeholder="Version" value="${f.version||''}"></div>
        <div class="f-field"><label>Scale</label>
          <div class="scale-pair"><input class="inp2" id="fScale1" value="${sc1}"><span>:</span><input class="inp2" id="fScale2" value="${sc2}"></div></div>""",
"""        <div class="f-field"><label>Version</label><input class="inp2" id="fVersion"${perDwg} placeholder="Version" value="${f.version||''}"></div>
        <div class="f-field"><label>Scale</label>
          <div class="scale-pair"><input class="inp2" id="fScale1"${perDwg} value="${sc1}"><span>:</span><input class="inp2" id="fScale2"${perDwg} value="${sc2}"></div></div>""")

rep("""        <input class="inp2" data-ap="${k}" data-fld="d" placeholder="DD" value="${t.d}">
        <input class="inp2" data-ap="${k}" data-fld="m" placeholder="MM" value="${t.m}">
        <input class="inp2" data-ap="${k}" data-fld="y" placeholder="YYYY" value="${t.y}">""",
"""        <input class="inp2" data-ap="${k}" data-fld="d"${perDwg} placeholder="DD" value="${t.d}">
        <input class="inp2" data-ap="${k}" data-fld="m"${perDwg} placeholder="MM" value="${t.m}">
        <input class="inp2" data-ap="${k}" data-fld="y"${perDwg} placeholder="YYYY" value="${t.y}">""")

# ---- the frame margin follows the sheet size -------------------------------
# It was a free number, so the same office could end up with a different frame on
# every drawing. It is now decided by the paper: 5 mm on A4, 10 mm on anything
# larger. One function decides it, the field shows what it decided, and a project
# saved before this rule is brought into line when it is opened - otherwise the
# locked field would sit there disagreeing with the frame drawn beside it.
rep("function paperDims(){ const p=PAPERS[store.format.paper]||PAPERS.A4; return { W:p[0], H:p[1] }; }",
"""function paperDims(){ const p=PAPERS[store.format.paper]||PAPERS.A4; return { W:p[0], H:p[1] }; }
/* The frame margin is not a setting any more - it is a function of the paper. */
const FRAME_MARGIN={A4:5};
function frameMargin(paper){
  const m=FRAME_MARGIN[paper]; return m===undefined? 10 : m;
}""")

rep("    paper:'A4', margin:10, font:'Arial', fontSize:10, decimals:2, stroke:0.2,",
    "    paper:'A4', margin:frameMargin('A4'), font:'Arial', fontSize:10, decimals:2, stroke:0.2,")

rep("""            <div class="f-field"><label>Frame Margin</label>
              <div class="with-u"><input class="inp2" id="fMargin" type="number" min="0" step="1" value="${f.margin}"><span class="u">mm</span></div></div>""",
"""            <div class="f-field"><label>Frame Margin</label>
              <div class="with-u"><input class="inp2" id="fMargin" type="number" disabled value="${frameMargin(f.paper)}"><span class="u">mm</span></div></div>""")

rep("""  on('fPaper','change',e=>{ f.paper=e.target.value; updateFormatPreviews(); });
  on('fMargin','input',e=>{ f.margin=Math.max(0,+e.target.value||0); updateFormatPreviews(); });""",
"""  on('fPaper','change',e=>{ f.paper=e.target.value; f.margin=frameMargin(f.paper);
    const mi=$('#fMargin'); if(mi) mi.value=f.margin; updateFormatPreviews(); });""")

# the draft is brought into line before it is drawn, so the preview and the field agree
rep("""  fmtDraft=JSON.parse(JSON.stringify(
    fmtEditingDefaults ? blankFormat() : store.format));""",
"""  fmtDraft=JSON.parse(JSON.stringify(
    fmtEditingDefaults ? blankFormat() : store.format));
  fmtDraft.margin=frameMargin(fmtDraft.paper);""")

# and so is a project saved while the margin was still something a person typed
rep("""  }catch(err){ console.warn('project migration failed', err); }""",
"""  }catch(err){ console.warn('project migration failed', err); }
  if(store.format){ const fm=frameMargin(store.format.paper);
    if(store.format.margin!==fm){ store.format.margin=fm; persist(); } }""")

# ---- the heading spells the thing it heads ---------------------------------
rep("      <h3>Title Bolck</h3>", "      <h3>Title Block</h3>")

# ---- the title reads as a title ---------------------------------------------
# Every other value in the block is drawn in capitals - PROJECT already forced
# them - so a title typed in lower case was the one thing that came out looking
# like a note. The typing is left alone; only what is drawn is capitalised, which
# is the same text the PDF and the exported DXF are made from.
rep("  LB(FX.tol,0,'TITLE');    VAL(FX.tol,FX.part,0,FY.b1,t.title||'TITLE',3.34,true);",
    "  LB(FX.tol,0,'TITLE');    VAL(FX.tol,FX.part,0,FY.b1,(t.title||'TITLE').toUpperCase(),3.34,true);")

# ---- partition lines, and one button that offers them or a balloon ---------
# A partition is a divider across the sheet at the frame's weight, horizontal or
# vertical only. It is one ordinary poly in the DRAWING with a tag on it, so
# saving, moving, deleting, exporting and rebuilding are already written; the
# module adds only what is new - putting one down, and stretching it by an end.
par=open(os.path.join(ROOT,'src','modules','partition.js')).read()
rep("function addTextLabel(){", par+"function addTextLabel(){")

# the frame's weight in one place, so a partition can never drift away from it
rep("""function drawFrame(){
  const {W,H}=paperDims(); const m=store.format.margin;
  const a=W2S(m,H-m), b=W2S(W-m,m);
  ctx.strokeStyle=INK; ctx.lineWidth=Math.max(1,mm2px(0.3));""",
"""const FRAME_LW_MM=0.3;                 /* the frame's weight - partitions match it */
function frameLwPx(){ return Math.max(1, mm2px(FRAME_LW_MM)); }
function drawFrame(){
  const {W,H}=paperDims(); const m=store.format.margin;
  const a=W2S(m,H-m), b=W2S(W-m,m);
  ctx.strokeStyle=INK; ctx.lineWidth=frameLwPx();""")
# a stroke asking for the frame's weight gets it - unless a line type has since
# been applied to it by hand, which is the user overruling this on purpose
rep("    ctx.lineWidth = p._lw ? Math.max(0.2, lw*p._lw) : lw;   // line type carries its own weight",
    "    ctx.lineWidth = p._lw ? Math.max(0.2, lw*p._lw)\n                 : (p._frameLw ? frameLwPx() : lw);   // line type carries its own weight")

# the toolbar: one button, two choices, the way Export offers PDF or DXF
rep('      <button class="tool-sq" id="btnBalloon" title="Add Pointer"><i class="bi bi-balloon-1"></i></button>',
    '      <button class="tool-sq" id="btnSpecial" title="Add Special"><i class="bi bi-plus-square"></i></button>')
rep("  { const bb=$('#btnBalloon'); if(bb) bb.onclick=addBalloon; }",
    "  { const bs=$('#btnSpecial'); if(bs) bs.onclick=openSpecialMenu; }")
rep(""" 'info-circle':'<circle cx="12" cy="12" r="9"/><path d="M12 11.2v5"/>'""",
""" /* A brick wall: what a partition is, in the smallest number of strokes that
    still reads as one at 16 pixels. */
 'bricks':'<rect x="3" y="4.5" width="18" height="15" rx="1"/>'
   + '<path d="M3 9.5h18"/><path d="M3 14.5h18"/>'
   + '<path d="M9 4.5v5"/><path d="M15 9.5v5"/><path d="M9 14.5v5"/>',
 'plus-square':'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M12 8v8"/><path d="M8 12h8"/>',
 'info-circle':'<circle cx="12" cy="12" r="9"/><path d="M12 11.2v5"/>'""")

# grips: an end of a partition is checked first - it owns its own object, and the
# click that grabs it must not be read as the start of a drag of the whole line
rep("""    const bg=balGripAt(pg,wx,wy);      if(bg) return {kind:'bal', g:bg};""",
"""    const pgp=parGripAt(pg,wx,wy);     if(pgp) return {kind:'par', g:pgp};
    const bg=balGripAt(pg,wx,wy);      if(bg) return {kind:'bal', g:bg};""")
rep("      if(dhit){ if(dhit.kind==='bal') beginBalDrag(dhit.g);",
    "      if(dhit){ if(dhit.kind==='par') beginParDrag(dhit.g);\n                else if(dhit.kind==='bal') beginBalDrag(dhit.g);")
rep("    if(balDrag){ updateBalDrag(w.x,w.y); return; }",
    "    if(parDrag){ updateParDrag(w.x,w.y); return; }\n    if(balDrag){ updateBalDrag(w.x,w.y); return; }")
rep("    if(balDrag){ endBalDrag(); }", "    if(parDrag){ endParDrag(); }\n    if(balDrag){ endBalDrag(); }")
rep("""function drawDimHandles(){
  const pg=activePage(); if(!pg||pg.type!=='sheet') return;
  if(drawBalGrips(pg)) return;""",
"""function drawDimHandles(){
  const pg=activePage(); if(!pg||pg.type!=='sheet') return;
  if(drawParGrips(pg)) return;
  if(drawBalGrips(pg)) return;""")

rep("  addBalloon:()=>addBalloon(), balGrips:(pg)=>balGrips(pg), balGeomOf:(m)=>balGeomOf(m),",
    """  addBalloon:()=>addBalloon(), balGrips:(pg)=>balGrips(pg), balGeomOf:(m)=>balGeomOf(m),
  addPartition:()=>addPartition(), parPolys:(pg)=>parPolysOf(pg), parGrips:(pg)=>parGrips(pg),
  parGripAt:(pg,x,y)=>parGripAt(pg,x,y), beginParDrag:(g)=>beginParDrag(g),
  updateParDrag:(x,y)=>updateParDrag(x,y), endParDrag:()=>endParDrag(),""")

# ---- a balloon must move when it is dragged --------------------------------
# Dragging a balloon by its ring looked as though it worked and did nothing. Two
# bakes existed: bakeOffsets, which moves the STROKES and the model together, and
# balBake, which moved only the model. balBake ran from balGrips - that is, from
# every render - so during a drag it fired on every mouse move, walked the model
# off by the accumulated offset, zeroed the offset it had just read, and never
# touched a single stroke. The balloon stayed exactly where it was while its model
# ran off the sheet.
#
# So: one baking implementation, and none of it while a drag is still in flight -
# the offset IS the drag. The handles follow the offset until it is over.
rep("""function balBake(pg, m){
  let dx=null, dy=null, same=true;
  (pg.objects||[]).forEach(o=>{ if(o._bal!==m.id) return;
    if(dx===null){ dx=o.dx||0; dy=o.dy||0; }
    else if((o.dx||0)!==dx || (o.dy||0)!==dy) same=false; });
  if(dx===null || (!dx && !dy) || !same) return;
  m.c=[m.c[0]+dx, m.c[1]+dy]; m.tip=[m.tip[0]+dx, m.tip[1]+dy];
  (pg.objects||[]).forEach(o=>{ if(o._bal===m.id){ o.dx=0; o.dy=0; } });
}""",
"""function balBake(pg, m){
  if(objDrag) return;                 /* mid-drag the offset is the drag itself */
  try{ bakeOffsets(pg); }catch(e){}   /* strokes and model together, or neither */
}
/* Where the balloon is RIGHT NOW: its model, plus whatever offset a drag in
   progress is carrying. Without this the handles sit at the old place while the
   balloon is being moved under them. */
function balLiveOffset(pg, m){
  let dx=0, dy=0;
  (pg.objects||[]).forEach(o=>{ if(o._bal===m.id && !dx && !dy){ dx=o.dx||0; dy=o.dy||0; } });
  return [dx,dy];
}""")
rep("""  balBake(pg,m);
  return [ {m, kind:'balC', at:m.c.slice()}, {m, kind:'balTip', at:m.tip.slice()} ];""",
"""  balBake(pg,m);
  const [ox,oy]=balLiveOffset(pg,m);
  return [ {m, kind:'balC', at:[m.c[0]+ox, m.c[1]+oy]},
           {m, kind:'balTip', at:[m.tip[0]+ox, m.tip[1]+oy]} ];""")

# ---- the defaults panel names no project ------------------------------------
# Belt as well as braces: the field is told what to say outright, so it cannot
# follow a project name by any route at all.
rep("""        <div class="f-field"><label>Project</label><input class="inp2" id="fProject"${perDwg} placeholder="Working Drawing" value="${(store.name||'')}"></div>""",
    """        <div class="f-field"><label>Project</label><input class="inp2" id="fProject"${perDwg} placeholder="Working Drawing" value="${fmtEditingDefaults? 'Project' : esc(store.name||'')}"></div>""")

# ---- Title and Version reach the sheet the way Scale already did -----------
# Scale was already a project-wide default that each sheet could override; Title
# and Version were not, so a title typed into Format Config went nowhere and the
# sheet panel opened blank. All three now behave alike: the panel opens showing
# what the project says, and typing there sets THAT SHEET only - the project's own
# value is never written back.
rep("""    <div class="grp"><label>Title</label>
      <input class="rp-inp" id="tbTitle" placeholder="Title" value="${esc(t.title)}"></div>""",
"""    <div class="grp"><label>Title</label>
      <input class="rp-inp" id="tbTitle" placeholder="Title" value="${esc(t.title||f.title||'')}"></div>""")
rep("""      <div><label>Version</label><input class="rp-inp" id="tbVer" placeholder="Version" value="${esc(t.version)}"></div>""",
"""      <div><label>Version</label><input class="rp-inp" id="tbVer" placeholder="Version" value="${esc(t.version||f.version||'')}"></div>""")
# the panel needs the project's settings in scope to fall back to them
rep("""function openTitlePanel(){
  const pg=activePage(); if(pg.type!=='sheet') return;
  const t=pg.title||(pg.title={});""",
"""function openTitlePanel(){
  const pg=activePage(); if(pg.type!=='sheet') return;
  const t=pg.title||(pg.title={});
  const f=store.format||{};""")

# and the sheet itself falls back the same way, so a title typed into Format
# Config appears on every sheet that has not been given one of its own
rep("  LB(FX.tol,0,'TITLE');    VAL(FX.tol,FX.part,0,FY.b1,(t.title||'TITLE').toUpperCase(),3.34,true);",
    "  LB(FX.tol,0,'TITLE');    VAL(FX.tol,FX.part,0,FY.b1,(t.title||f.title||'TITLE').toUpperCase(),3.34,true);")

# ---- Format Config shows the title only while the sheets agree on one -------
# It is the PROJECT's title. Once the sheets have been given titles of their own
# and those titles differ, there is no project title any more, and a box still
# showing one of them would be claiming something untrue. So it goes back to
# empty - the state it was in before anybody typed.
rep("""function renderFormatView(){
  const f=fmtDraft, ap=f.approvals;""",
"""function renderFormatView(){
  const f=fmtDraft, ap=f.approvals;
  {
    /* The project's title is never taken FROM a sheet - editing a sheet's title
       must not rewrite the project's. But once several sheets have been given
       titles of their own and those titles disagree, there is no project title
       left to state, and a box still showing the old one would be claiming
       something untrue. In that one case it goes back to empty. */
    const own=((store&&store.pages)||[]).filter(p=>p.type==='sheet')
      .map(p=>(p.title&&p.title.title)||'');
    const diverged = own.length>1 && !own.every(v=>v===own[0]);
    if(diverged) f.title='';
  }""")

# ---- the font list must contain fonts the page actually has ----------------
# Sarabun was offered in Typography and never fetched: measuring it gave exactly
# the width of the default serif, which is what a missing family falls back to.
# Every drawing set to Sarabun was therefore drawn in something else, and the
# preview disagreed with the choice above it - not because the preview was wrong,
# but because the font was never there. It is fetched now, alongside Inter.
rep("""<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">""",
    """<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Sarabun:wght@400;500;600;700&display=swap">""")
# A web font arrives after the first paint, and canvas text does not re-flow when
# it does - the sheet would keep the fallback until something else forced a redraw.
rep("""function boot(){
  cv=$('#cv'); ctx=cv.getContext('2d'); stage=$('#stage');""",
"""function boot(){
  cv=$('#cv'); ctx=cv.getContext('2d'); stage=$('#stage');
  /* canvas text does not re-flow when a web font finally arrives - redraw it */
  try{ if(document.fonts && document.fonts.ready)
    document.fonts.ready.then(()=>{ try{ render(); if(fmtDraft) updateFormatPreviews(); }catch(e){} }); }
  catch(e){}""")
# and when the choice is changed, wait for that family before redrawing the preview
rep("  on('fFont','change',e=>{ f.font=e.target.value; updateFormatPreviews(); });",
    """  on('fFont','change',e=>{ f.font=e.target.value; updateFormatPreviews();
    /* the first preview after a change can still be the fallback: ask for the
       family, then draw again once it is really there */
    try{ if(document.fonts) document.fonts.load('700 40px "'+f.font+'"')
      .then(()=>{ if(fmtDraft) updateFormatPreviews(); }).catch(()=>{}); }catch(err){} });""")

# ---- you type in the app's font, not the drawing's --------------------------
# The boxes you type into - the label editor over the canvas and the cover /
# description zones - were set to the DRAWING's font. Choose Consolas for the
# sheet and Thai went to whatever the browser could find instead, because a
# monospace face meant for code carries no Thai: the text being typed was
# unreadable while the same text on the paper was fine. What is DRAWN keeps
# following the choice in Typography; the interface keeps its own font.
rep("function measureMM(text,hmm,bold){",
"""/* The interface's own font, read back from the page so the two cannot drift. */
function uiFont(){
  try{ return getComputedStyle(document.body).fontFamily || "'Inter',sans-serif"; }
  catch(e){ return "'Inter',sans-serif"; }
}
function measureMM(text,hmm,bold){""")

# both editors go through these two, so this is the whole of it
rep("  try{ ctx.save(); ctx.font=(bold?'700 ':'400 ')+fontPx+'px '+store.format.font+',Arial';",
    "  try{ ctx.save(); ctx.font=(bold?'700 ':'400 ')+fontPx+'px '+uiFont();")
rep("  el.style.font=(o.bold?'700 ':'400 ')+f+'px '+store.format.font+',Arial';",
    "  el.style.font=(o.bold?'700 ':'400 ')+f+'px '+uiFont();")
rep("  let tw; try{ ctx.save(); ctx.font=`${FW}${hpx}px ${store.format.font},Arial`; tw=ctx.measureText(String(t.text||'')||'M').width; ctx.restore(); }",
    "  let tw; try{ ctx.save(); ctx.font=`${FW}${hpx}px ${uiFont()}`; tw=ctx.measureText(String(t.text||'')||'M').width; ctx.restore(); }")

# ---- Sarabun is a DRAWING font, not an interface one ------------------------
# It was named in the interface's own stack as well. That did nothing while the
# family was never fetched, but now that it is, Chrome walks the declared list for
# a Thai character - Inter has no Thai, and it does not use Windows' font linking
# to give "Segoe UI" any - so it reached Sarabun and drew every Thai label,
# placeholder and typing box in it. Thai in the interface belongs to the interface,
# so the list ends at sans-serif and the platform decides, exactly as it does for
# every other Thai app. Sarabun stays a choice for the DRAWING, where it is loaded
# and where somebody asked for it on purpose.
rep("""  font-family:'Inter','Segoe UI',system-ui,-apple-system,'Sarabun',sans-serif;-webkit-font-smoothing:antialiased}""",
    """  font-family:'Inter','Segoe UI',system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased}""")

# ---- the parts list carries Colour too -------------------------------------
# It sits beside Material and Finish in the title block and it belongs beside them
# in the parts list, on by default like the rest of that group. A table already on
# a page keeps the columns it was given - turning a new one on would widen it
# without being asked, possibly off the paper - and the chip in the panel switches
# it on for those.
rep("""  {key:'finish',    label:'FINISH',     short:'Finish',     w:26},""",
    """  {key:'finish',    label:'FINISH',     short:'Finish',     w:26},
  {key:'color',     label:'COLOR',      short:'Color',      w:24},""")
rep("function bomRow(){ return {title:'',qty:'',material:'',finish:'',production:'',parttype:'',note:''}; }",
    "function bomRow(){ return {title:'',qty:'',material:'',finish:'',color:'',production:'',parttype:'',note:''}; }")

# ---- the decimals you set must reach the dimensions the file rounded --------
# "does this printed number state this measurement" is a pure question, so it is a
# component: no DOM, no globals, unit-tested in Node in milliseconds. Recovery and
# the dimension model both ask it, so it is spliced in ahead of both.
rep("function convertDXF_v2(parsed, text){",
    lib('dim-value.mjs')+"\nfunction convertDXF_v2(parsed, text){")

# ---- the title block and the parts list are drawn in capitals --------------
# A drawing office writes them in capitals, and a value typed in lower case in a
# panel should not be the one thing on the sheet that is not. Both blocks put
# every string they draw through one function, so the rule goes in those two
# places and cannot be forgotten by the next field somebody adds. What is TYPED
# is left as typed - only what is DRAWN is capitalised, and since the canvas, the
# PDF and the exported DXF are all made from these same two functions, all three
# agree. The company logo draws its own lettering and keeps its own case.
rep("""  const T=(x,yBase,txt,em,bold,al,maxW)=>{
    txt=(txt==null?'':String(txt)); if(!txt) return;""",
"""  const T=(x,yBase,txt,em,bold,al,maxW)=>{
    txt=(txt==null?'':String(txt)).toUpperCase(); if(!txt) return;""")
rep("""function bomText(txt,x,y,em,align,base,bold){ if(txt==null||txt==='')return; const p=W2S(x,y);""",
"""function bomText(txt,x,y,em,align,base,bold){ if(txt==null||txt==='')return;
  txt=String(txt).toUpperCase(); const p=W2S(x,y);""")
# the cells are wrapped before they are drawn, so they must be measured in capitals too
rep("""function wrapCell(txt, maxWpx, fpx){
  txt=String(txt==null?'':txt); if(!txt) return [''];""",
"""function wrapCell(txt, maxWpx, fpx){
  txt=String(txt==null?'':txt).toUpperCase(); if(!txt) return [''];""")

# ---- decimals reach the values STYLIZE could not claim ----------------------
# Recognising a dimension needs its arrowheads, and its printed number has to
# agree with what its geometry measures. A file drawn with architectural ticks,
# at a scale, or in inches fails one of those, so no model owns its numbers and
# nothing reformats them: set two decimals and those values sat there as whole
# numbers, which is exactly what was reported.
#
# Recognising every one of those shapes is a long road. Printing the number the
# file already wrote to the places the sheet asks for is a short one, and it is
# honest about what it is doing: it does NOT re-measure - a value no model owns is
# a value nothing has verified - it only re-prints. A dimension that IS recognised
# still takes its number from the geometry, as it always did.
#
# The first value is remembered on the text itself, so going 2 -> 0 -> 2 comes
# back to what the file wrote instead of to the rounding of a rounding.
rep("""    else if(!t._dimPart && !t._sec) t.h=txtH;
    textN++; }); });""",
"""    else if(!t._dimPart && !t._sec) t.h=txtH;
    textN++; }); });

  /* Values no model claimed: printed to the sheet's decimals, not re-measured. */
  let paddedN=0;
  {
    const dec=dimDecimals();
    pg.objects.forEach(ob=>{ (ob.prims.texts||[]).forEach(t=>{
      if(isSheetFurniture(t, ob, furniture)) return;
      if(t._dim || t._dimPart || t._sec || t._balPart || t._bal) return;  // owned already
      if(isUserText(t)) return;                                           // a label, not a value
      const P=valueParts(t.text); if(!P) return;
      if(t._num0==null) t._num0=P.value;      // what the file wrote, kept for good
      const next=P.before + Number(t._num0).toFixed(dec) + P.after;
      if(next!==String(t.text)){ t.text=next; paddedN++; }
    }); });
  }""")
rep("""  parts.push('texts '+textN);""",
    """  parts.push('texts '+textN);
  if(paddedN) parts.push('values re-printed '+paddedN);""")

open(DST,'w').write(s)
print('patched ok')
