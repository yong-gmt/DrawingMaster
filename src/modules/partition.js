/* ============================================================================
   §15  PARTITION LINES
   ----------------------------------------------------------------------------
   A partition is a plain divider drawn across the sheet at the weight of the
   frame, to split one page into areas. It is horizontal or vertical and nothing
   else - a partition at seven degrees is a mistake, not a choice, so the drag
   cannot produce one.

   Unlike a dimension or a balloon there is no MODEL behind it, and that is
   deliberate. A straight line between two points has nothing to derive: the two
   points ARE the thing. So a partition is one ordinary poly in the drawing, with
   a tag on it, which means it is saved, moved, selected, deleted, exported and
   rebuilt by the code that already does all of that for every other stroke. The
   only thing written here is what is genuinely new: putting one on the page, and
   stretching it by its ends.

   Because it lives in pg.dxf.polys - the drawing - and not in pg.objects, it
   survives a refresh, a reopen and a STYLIZE, and it keeps where it was put.
   ========================================================================== */
const PAR_GRIP_PX=5;
const PAR_MIN_MM=3;                    /* short enough to be useful, long enough to grab */

function parPrimOf(ob){
  const ps=(ob&&ob.prims&&ob.prims.polys)||[];
  return (ps.length===1 && ps[0]._par)? ps[0] : null;
}
function parPolysOf(pg){ return ((pg&&pg.dxf&&pg.dxf.polys)||[]).filter(p=>p._par); }

/* ---- adding one ----------------------------------------------------------- */
function addPartition(){
  const pg=activePage();
  if(!pg||pg.type!=='sheet'){ toast('open a sheet page first, then add a partition'); return; }
  if(!pg.objects) buildObjects(pg);
  snapshot();
  const d=pg.dxf||(pg.dxf={polys:[],texts:[],solids:[],marks:[],hatches:[],clines:[]});
  if(!d.polys) d.polys=[];
  /* The id must be its own for ever: numbering from the count would hand a new
     line the id of one that was deleted, and the two would answer to the same
     name. The same rule the balloons learned. */
  let seq=(pg._parSeq||0);
  d.polys.forEach(p=>{ const k=parseInt(String(p._par||'').replace(/\D+/g,''),10);
    if(isFinite(k) && k>seq) seq=k; });
  pg._parSeq=seq+1;
  const {W,H}=paperDims(), mg=store.format.margin;
  /* Across the middle of the free area, and each new one stepped clear of the
     last so it is never dropped exactly on top of one already there. */
  const n=parPolysOf(pg).length;
  const x0=mg+(W-2*mg)*0.25, x1=mg+(W-2*mg)*0.75;
  const y=mg+TB_H+(H-2*mg-TB_H)/2 - (n%8)*8;
  const p={ _src:'PARTITION', _par:'par'+pg._parSeq, _frameLw:true,
            pts:[[x0,y],[x1,y]], dash:null };
  d.polys.push(p);
  /* Into the DRAWING and then rebuilt, keeping every move already made - the
     three steps anything that adds to a page has to take. */
  rebuildKeepingPlaces(pg);
  const ob=(pg.objects||[]).find(o=>(o.prims.polys||[]).indexOf(p)>=0);
  if(ob) setSelection([ob.id]);
  afterMutate();
  toast('partition line added · drag an end to stretch it, press the middle to turn it');
}

/* ---- the two ends, and dragging them -------------------------------------- */
function selectedPar(){
  if(selIds.size!==1) return null;
  let id=null; selIds.forEach(v=>id=v);
  const o=objById(id); if(!o) return null;
  const p=parPrimOf(o);
  return p? {o,p} : null;
}
function parGrips(pg){
  const s=selectedPar(); if(!s) return [];
  const dx=s.o.dx||0, dy=s.o.dy||0;
  const gs=s.p.pts.map((pt,i)=>({ o:s.o, p:s.p, kind:'end', i, at:[pt[0]+dx, pt[1]+dy] }));
  /* The end grips choose their axis by which way the end lies from the other end,
     which is honest but means a long horizontal line cannot become a vertical one
     without dragging its end the whole way back across. So the middle is a grip of
     its own: press it and the line turns through ninety degrees about its centre,
     keeping its length and its place. */
  const a=s.p.pts[0], b=s.p.pts[1];
  gs.push({ o:s.o, p:s.p, kind:'flip',
            at:[(a[0]+b[0])/2+dx, (a[1]+b[1])/2+dy] });
  return gs;
}
/* Turn it through ninety degrees about its own middle. */
function parFlip(hit){
  const {o,p}=hit, a=p.pts[0], b=p.pts[1];
  const mx=(a[0]+b[0])/2, my=(a[1]+b[1])/2;
  const half=Math.max(PAR_MIN_MM, Math.hypot(b[0]-a[0], b[1]-a[1])/2);
  snapshot();
  if(Math.abs(b[0]-a[0]) >= Math.abs(b[1]-a[1]))
    p.pts=[[mx, my-half],[mx, my+half]];          /* was horizontal, now vertical */
  else
    p.pts=[[mx-half, my],[mx+half, my]];          /* and back again */
  afterMutate();
  toast('partition turned');
}
function parGripAt(pg, wx, wy){
  const tol=(PAR_GRIP_PX+3)/Math.max(view.s,1e-6);
  const gs=parGrips(pg);
  /* Nearest wins: at a short length the two ends can be within tolerance of the
     same click, and grabbing the far one turns the line inside out. */
  let best=null, bd=tol;
  gs.forEach(g=>{ const dd=Math.hypot(g.at[0]-wx, g.at[1]-wy);
    if(dd<=bd){ bd=dd; best=g; } });
  return best;
}
let parDrag=null;
function beginParDrag(hit){
  if(hit.kind==='flip'){ parFlip(hit); return; }   /* a press, not a drag */
  snapshot(); parDrag={o:hit.o, p:hit.p, i:hit.i, moved:false};
}
function updateParDrag(wx,wy){
  if(!parDrag) return;
  const {o,p,i}=parDrag, dx=o.dx||0, dy=o.dy||0;
  const anc=p.pts[1-i];                       /* the end NOT being dragged holds still */
  const ax=anc[0]+dx, ay=anc[1]+dy;
  /* Whichever way the pointer has travelled furthest from the anchor decides the
     axis. There is no third answer, so there is no way to end up at an angle. */
  let nx, ny;
  if(Math.abs(wx-ax) >= Math.abs(wy-ay)){
    ny=ay; nx=ax + (wx>=ax? Math.max(PAR_MIN_MM, wx-ax) : Math.min(-PAR_MIN_MM, wx-ax));
  }else{
    nx=ax; ny=ay + (wy>=ay? Math.max(PAR_MIN_MM, wy-ay) : Math.min(-PAR_MIN_MM, wy-ay));
  }
  p.pts[i]=[nx-dx, ny-dy];
  p.pts[1-i]=[ax-dx, ay-dy];
  parDrag.moved=true; render();
}
function endParDrag(){
  if(!parDrag) return;
  if(parDrag.moved) afterMutate(); else { history.undo.pop(); updateUndoButtons(); }
  parDrag=null;
}
function drawParGrips(pg){
  const gs=parGrips(pg); if(!gs.length) return false;
  ctx.save(); ctx.setLineDash([]);
  gs.forEach(g=>{ const q=W2S(g.at[0], g.at[1]);
    /* the ends stretch it (blue), the middle turns it (green) - two jobs, two
       colours, so nobody presses the wrong one twice */
    ctx.fillStyle='#fff'; ctx.strokeStyle=(g.kind==='flip')?'#00a37a':'#0077ff';
    ctx.lineWidth=1.5;
    ctx.fillRect(q.x-PAR_GRIP_PX, q.y-PAR_GRIP_PX, PAR_GRIP_PX*2, PAR_GRIP_PX*2);
    ctx.strokeRect(q.x-PAR_GRIP_PX, q.y-PAR_GRIP_PX, PAR_GRIP_PX*2, PAR_GRIP_PX*2); });
  ctx.restore();
  return true;
}

/* ---- the button that offers both ------------------------------------------ */
function openSpecialMenu(){
  let m=$('#specialMenu');
  if(!m){ m=el('div'); m.id='specialMenu'; m.className='ctx-menu';
    m.innerHTML='<div class="ctx-item" data-x="balloon"><i class="bi bi-balloon-1"></i> Balloon (item pointer)</div>'
               +'<div class="ctx-item" data-x="partition"><i class="bi bi-bricks"></i> Partition line</div>';
    document.body.appendChild(m);
    m.querySelectorAll('.ctx-item').forEach(it=>it.onclick=()=>{ m.style.display='none';
      if(it.dataset.x==='balloon') addBalloon(); else addPartition(); });
    window.addEventListener('mousedown',ev=>{
      if(m.style.display==='block' && !m.contains(ev.target) && !ev.target.closest('#btnSpecial'))
        m.style.display='none'; });
    try{ paintIcons(m); }catch(e){}
  }
  const b=$('#btnSpecial').getBoundingClientRect();
  m.style.left=Math.round(b.left)+'px'; m.style.top=Math.round(b.bottom+6)+'px'; m.style.display='block';
}
