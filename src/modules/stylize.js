/* ============================================================================
   §12  THE STYLIZE LOOP
   ----------------------------------------------------------------------------
   STYLIZE keeps going until there is nothing left it knows how to fix.

       repeat:
         1. scan the drawing for dimensions it has not modelled yet
         2. apply every model it has - dimensions, section markers, text
         3. if the scan found nothing new, stop
       then report what is still unresolved, and why

   Pressing it again re-scans from scratch, so anything missed the first time -
   because an earlier pass had taken a piece it needed, or because the drawing
   changed in between - gets picked up on the next press. It is never a one-shot
   pass over whatever happened to be recognised at import.
   ========================================================================== */
const STYLIZE_MAX_PASSES=6;

/* Look for dimensions the drawing has not declared and we have not yet rebuilt.
   Returns how many new ones were found. */
function stylizeScan(pg){
  const d=pg&&pg.dxf; if(!d) return 0;
  let added=0;
  try{
    const seq={n:(d.dims||[]).length+1};
    const rec=v2RecoverDims(d, 1, seq);
    rec.forEach(m=>{
      if(!m.ok) return;
      const raw=v2RecoverRaw(d, m);
      const built=dimProject(m, raw.polys[0], raw.texts);
      v2RecoverReplace(d, m, raw, built);
      (d.dims||(d.dims=[])).push(m);
      added++;
    });
    if(added) v2RecoverSweep(d);
  }catch(err){ console.warn('stylize scan failed', err); }
  return added;
}
/* A model built at import has not been drawn yet - the file's own strokes are
   still there, exactly as its author drew them. STYLIZE is where they are taken
   over, so importing shows the drawing and pressing the button changes it.

   Two kinds of model arrive here. One was read from a DIMENSION entity and every
   stroke that entity drew carries its id; the other was rebuilt from loose
   geometry and keeps a list of the pieces it claimed. A tag is the more reliable
   of the two, because indices shift and tags do not. */
/* Take one model's strokes over: the file's pieces come out, the model's go in.
   Pulled out of the loop below because a drag needs it too - an angular dimension
   keeps the file's picture until somebody moves it, and at that moment it has to
   become the model's, or the model would draw a second arc beside the first. */
function dimAdoptOne(pg, m){
  const d=pg&&pg.dxf; if(!d||!m) return false;
  let raw;
  if(m.refs) raw=v2RecoverRaw(d, m);
  else {
    raw={polys:[], solids:[], texts:[], idx:{polys:[],solids:[],texts:[]}};
    (d.polys||[]).forEach(p=>{ if(p._dim===m.id) raw.polys.push(p); });
    (d.solids||[]).forEach(x=>{ if(x._dim===m.id) raw.solids.push(x); });
    (d.texts||[]).forEach(t=>{ if(t._dim===m.id) raw.texts.push(t); });
  }
  const built=dimProject(m, raw.polys[0]||{}, raw.texts);
  v2RecoverReplace(d, m, raw, built);
  m.pending=false;
  return true;
}
function stylizeAdopt(pg){
  const d=pg&&pg.dxf; if(!d) return 0;
  let n=0;
  (d.dims||[]).forEach(m=>{
    if(!m.pending || !m.ok) return;
    try{ if(dimAdoptOne(pg, m)) n++; }
    catch(err){ console.warn('could not adopt', m.id, err); m.pending=false; }
  });
  (d.secs||[]).forEach(s=>{ if(s.ok) s.pending=false; });
  if(n){ v2RecoverSweep(d); buildObjects(pg); dimRelayout(pg); }
  return n;
}
/* Draw every model the page has, from the model - never from the strokes. */
/* The two ANSI switches in Format Config decide what STYLIZE is allowed to touch.
   They used to be wired to the old guess-from-shape passes; when those were
   removed the switches kept their place in the panel and quietly stopped meaning
   anything - the model passes ran either way. A switch that does nothing is worse
   than no switch, so each one now gates its own kind of annotation.

   Off does not mean "undo": it means LEAVE IT ALONE. Whatever the drawing already
   had stays exactly as it was. */
function stylizeApply(pg, txtH){
  const f=store.format;
  let dims=0, secs=0;
  /* One switch, one question: restyle the drawing, or only set the text size?
     Two switches asked which rules applied to which kind of annotation, which is
     not a question anybody wants to answer. Off does not mean "do nothing" - the
     text still gets the size you chose, because that is the part wanted on every
     drawing whether or not its annotation is redrawn. */
  if(!f.ansiRadius) return {dims, secs};
  dimModelsOf(pg).forEach(m=>{ if(m.ok && dimStylizeText(pg, m, txtH)) dims++; });
  secModelsOf(pg).forEach(s=>{ if(s.ok && secApply(pg, s, txtH)) secs++; });
  return {dims, secs};
}
/* What is left that really looks like an unfinished dimension. A number on its own
   is not one: the sheet is full of numbers that measure nothing - zone letters,
   sheet counts, dates. What marks a number as a dimension we failed to build is an
   ARROWHEAD next to it that nothing has claimed. */
function stylizeLeftovers(pg){
  const d=pg&&pg.dxf; if(!d) return [];
  const free=[];
  (d.solids||[]).forEach(sd=>{ if(sd._dim||sd._sec) return;
    const a=recArrowFrom(sd); if(a) free.push(a.tip); });
  (d.polys||[]).forEach(p=>{ if(p._dim||p._sec||!p.pts||p.pts.length<3||p.pts.length>5) return;
    if(Math.hypot(p.pts[0][0]-p.pts[p.pts.length-1][0],
                  p.pts[0][1]-p.pts[p.pts.length-1][1])>0.05) return;
    const a=recArrowFrom(p.pts.slice(0,-1).length>=3? p.pts.slice(0,-1) : p.pts);
    if(a) free.push(a.tip); });
  const out=[];
  (d.texts||[]).forEach(t=>{
    if(t._dim || t._sec || t._dimPart) return;
    if(dimTextRole(t.text)!=='value') return;
    const reach=Math.max(40, (t.h||2.5)*20);
    if(!free.some(q=>Math.hypot(q[0]-t.x, q[1]-t.y)<reach)) return;
    out.push(String(t.text).trim());
  });
  return out;
}
