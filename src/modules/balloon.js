/* ============================================================================
   §14  ITEM BALLOONS
   ----------------------------------------------------------------------------
   A balloon is the callout on an assembly drawing: a circle carrying an item
   number, a leader running from it, and an arrowhead touching the part it names.

   It is built the same way as everything else here - as a MODEL that knows its
   own anatomy, with every stroke computed from it:

       num    the item number in the circle
       c      the centre of the circle
       tip    where the arrowhead touches the part

   Everything else follows: the circle sized to the number, the leader running
   along the line between the two, the arrowhead terminating it. Drag either end
   and the rest is recomputed - the leader can never come adrift from the circle,
   and the arrowhead can never drift off the end of the leader, because neither is
   stored separately from the model.
   ========================================================================== */
const BAL_MIN_R_MM=3.2;               /* small enough for "1", big enough to read */

function balTextH(){ return ((store.format.fontSize||10)+2)*PT_TO_MM; }
function balRadius(m){
  const h=m.h||balTextH();
  const w=dimTextWidth(String(m.num||'1'), h);
  return Math.max(BAL_MIN_R_MM, h*0.72, w*0.62+h*0.35);
}
function balGeomOf(m){
  const r=balRadius(m), h=m.h||balTextH();
  const dx=m.tip[0]-m.c[0], dy=m.tip[1]-m.c[1];
  const L=Math.hypot(dx,dy);
  const ring=[];
  for(let i=0;i<=48;i++){ const a=i/48*Math.PI*2;
    ring.push([m.c[0]+Math.cos(a)*r, m.c[1]+Math.sin(a)*r]); }
  const segs=[];
  if(L>r+0.5){                        /* the leader starts at the circle's edge */
    const ux=dx/L, uy=dy/L;
    segs.push({role:'lead', a:[m.c[0]+ux*r, m.c[1]+uy*r], b:m.tip.slice(),
               arrow:{s:false, e:true, h:m.arrow||2.5, w:(m.arrowW||(m.arrow||2.5)/3)}});
  }
  const ink=dimInk(h, String(m.num||'1'));
  return { ring, r, segs,
           text:{ x:m.c[0], y:m.c[1]-(ink.asc-ink.desc)/2, h,
                  str:String(m.num==null?'':m.num) } };
}
/* Draw it: one circle, one leader, one number - each a primitive the rest of the
   program already knows how to move, select and export. */
function balProject(m){
  const g=balGeomOf(m);
  const polys=[{ _src:'BALLOON', _bal:m.id, _role:'ring', _balPart:true,
                 pts:g.ring.map(p=>p.slice()), dash:null, _lw:DIM_LW,
                 _round:{cx:m.c[0], cy:m.c[1], r:g.r, a0:null, a1:null} }];
  g.segs.forEach(s=>polys.push({ _src:'BALLOON', _bal:m.id, _role:s.role, _balPart:true,
    pts:[s.a.slice(), s.b.slice()], dash:null, _lw:DIM_LW,
    _arrow:{s:!!s.arrow.s, e:!!s.arrow.e, h:s.arrow.h, w:s.arrow.w} }));
  const texts=[{ _src:'BALLOON', _bal:m.id, _role:'num', _balPart:true,
                 x:g.text.x, y:g.text.y, h:g.text.h, text:g.text.str,
                 rot:0, align:1, bold:true }];
  return {polys, texts};
}
/* Redraw after the model changed. Roles are stable, so the same primitives keep
   their identity and the selection survives a drag. */
function balApply(pg, m){
  const g=balGeomOf(m), byRole={};
  let host=null;
  (pg.objects||[]).forEach(o=>{
    (o.prims.polys||[]).forEach(p=>{ if(p._bal===m.id){ byRole[p._role]={o,p}; host=host||o; } });
    (o.prims.texts||[]).forEach(t=>{ if(t._bal===m.id){ byRole.num={o,t}; host=host||o; } });
  });
  if(!host) return false;
  const R=byRole.ring;
  if(R){ const dx=R.o.dx||0, dy=R.o.dy||0;
    R.p.pts=g.ring.map(p=>[p[0]-dx, p[1]-dy]);
    R.p._round={cx:m.c[0]-dx, cy:m.c[1]-dy, r:g.r, a0:null, a1:null}; }
  const seg=g.segs[0], LD=byRole.lead;
  if(LD){ const dx=LD.o.dx||0, dy=LD.o.dy||0;
    if(seg){ LD.p.pts=[[seg.a[0]-dx, seg.a[1]-dy],[seg.b[0]-dx, seg.b[1]-dy]];
      LD.p._arrow={s:false, e:true, h:seg.arrow.h, w:seg.arrow.w}; }
    else { LD.p.pts=[]; delete LD.p._arrow; } }
  else if(seg){ const p={_src:'BALLOON', _bal:m.id, _role:'lead', _balPart:true,
      pts:[[seg.a[0]-(host.dx||0), seg.a[1]-(host.dy||0)],
           [seg.b[0]-(host.dx||0), seg.b[1]-(host.dy||0)]],
      dash:null, _lw:DIM_LW, _arrow:{s:false, e:true, h:seg.arrow.h, w:seg.arrow.w}};
    if(pg.dxf && pg.dxf.polys) pg.dxf.polys.push(p);   /* and into the drawing */
    host.prims.polys.push(p); }
  const T=byRole.num;
  if(T){ const dx=T.o.dx||0, dy=T.o.dy||0;
    T.t.x=g.text.x-dx; T.t.y=g.text.y-dy; T.t.h=g.text.h; T.t.text=g.text.str; }
  return true;
}
function balModelsOf(pg){ return (pg && pg.dxf && pg.dxf.balloons) || []; }
function balModelById(pg,id){ for(const m of balModelsOf(pg)) if(m.id===id) return m; return null; }
/* The number belongs to the model; when it is edited on the page, put it back. */
function balSyncFromText(pg, t){
  if(!t || !t._bal) return false;
  const m=balModelById(pg, t._bal); if(!m) return false;
  const v=String(t.text==null?'':t.text).trim();
  if(v===String(m.num)) return false;
  m.num=v; balApply(pg, m); return true;
}

/* ---- adding one, and dragging it ------------------------------------------ */
function addBalloon(){
  const pg=activePage();
  if(!pg||pg.type!=='sheet'){ toast('open a sheet page first, then add a pointer'); return; }
  if(!pg.objects) buildObjects(pg);
  snapshot();
  const d=pg.dxf||(pg.dxf={polys:[],texts:[],solids:[],marks:[],hatches:[],clines:[]});
  const list=d.balloons||(d.balloons=[]);
  const {W,H}=paperDims(), mg=store.format.margin;
  const cx=W/2, cy=mg+TB_H+(H-2*mg-TB_H)/2;
  /* number the balloons in the order they are added, and step each new one clear
     of the last so it is never dropped on top of one already there */
  /* The id must never be reused. Numbering from the length of the list meant that
     deleting one and adding another gave the new balloon the id of the old: the two
     shared a model and a group, so they moved together, and neither could be
     deleted on its own. The number SHOWN still counts from what is on the page -
     that is what a person reads - but the id behind it is its own for ever. */
  let seq=(pg._balSeq||0);
  (list||[]).forEach(x=>{ const k=parseInt(String(x.id).replace(/\D+/g,''),10);
    if(isFinite(k) && k>seq) seq=k; });
  pg._balSeq=seq+1;
  const m={ id:'bal'+pg._balSeq, num:String(list.length+1),
            c:[cx-18-list.length*2, cy+12+list.length*9],
            tip:[cx+6, cy-6+list.length*9],
            h:balTextH(), arrow:2.5, arrowW:2.5/3, ok:true };
  list.push(m);
  /* Into the DRAWING, not straight into the object list: the object list is
     rebuilt from the drawing whenever anything changes, and a balloon that lived
     only there would vanish the next time STYLIZE was pressed. */
  const built=balProject(m);
  built.polys.forEach(p=>d.polys.push(p));
  built.texts.forEach(t=>d.texts.push(t));
  buildObjects(pg);
  setSelection((pg.objects||[]).filter(o=>o._bal===m.id).map(o=>o.id));
  afterMutate();
  toast('pointer '+m.num+' · double-click the number to change it · drag a handle to stretch the leader');
}
const BAL_GRIP_PX=5;
function selectedBalId(){
  let id=null;
  for(const sid of selIds){ const o=objById(sid); if(!o) continue;
    if(!o._bal) return null;
    if(id===null) id=o._bal; else if(id!==o._bal) return null; }
  return id;
}
function balGrips(pg){
  const id=selectedBalId(); if(!id) return [];
  const m=balModelById(pg,id); if(!m) return [];
  balBake(pg,m);
  return [ {m, kind:'balC', at:m.c.slice()}, {m, kind:'balTip', at:m.tip.slice()} ];
}
function balBake(pg, m){
  let dx=null, dy=null, same=true;
  (pg.objects||[]).forEach(o=>{ if(o._bal!==m.id) return;
    if(dx===null){ dx=o.dx||0; dy=o.dy||0; }
    else if((o.dx||0)!==dx || (o.dy||0)!==dy) same=false; });
  if(dx===null || (!dx && !dy) || !same) return;
  m.c=[m.c[0]+dx, m.c[1]+dy]; m.tip=[m.tip[0]+dx, m.tip[1]+dy];
  (pg.objects||[]).forEach(o=>{ if(o._bal===m.id){ o.dx=0; o.dy=0; } });
}
function balGripAt(pg, wx, wy){
  const tol=(BAL_GRIP_PX+3)/Math.max(view.s,1e-6);
  for(const g of balGrips(pg)) if(Math.hypot(g.at[0]-wx, g.at[1]-wy)<=tol) return g;
  return null;
}
let balDrag=null;
function beginBalDrag(hit){ snapshot(); balDrag={m:hit.m, kind:hit.kind, moved:false}; }
function updateBalDrag(wx,wy){
  if(!balDrag) return;
  const pg=activePage(); if(!pg) return;
  const m=balDrag.m;
  /* Either end can be dragged; the leader is recomputed between them, so it always
     starts on the circle and always ends under the arrowhead. */
  if(balDrag.kind==='balC') m.c=[wx,wy]; else m.tip=[wx,wy];
  balApply(pg, m); balDrag.moved=true; render();
}
function endBalDrag(){
  if(!balDrag) return;
  if(balDrag.moved) afterMutate(); else { history.undo.pop(); updateUndoButtons(); }
  balDrag=null;
}
function drawBalGrips(pg){
  const gs=balGrips(pg); if(!gs.length) return false;
  ctx.save(); ctx.setLineDash([]);
  gs.forEach(g=>{ const q=W2S(g.at[0], g.at[1]);
    ctx.fillStyle='#fff'; ctx.strokeStyle=(g.kind==='balTip')?'#00a37a':'#0077ff';
    ctx.lineWidth=1.5;
    ctx.fillRect(q.x-BAL_GRIP_PX, q.y-BAL_GRIP_PX, BAL_GRIP_PX*2, BAL_GRIP_PX*2);
    ctx.strokeRect(q.x-BAL_GRIP_PX, q.y-BAL_GRIP_PX, BAL_GRIP_PX*2, BAL_GRIP_PX*2); });
  ctx.restore();
  return true;
}
