const _p=require('path');
const {open,loadDxf}=require('./harness');
// Measure what the EYE sees: the real glyph box of the drawn value, its centre
// along the dimension line, and the clear gap to the nearest ink.
const MEASURE=()=>{
  const h=window.__hook(); const pg=h.store.pages.find(x=>x.id===h.store.activeId);
  const c=document.createElement('canvas').getContext('2d');
  const PXMM=96/25.4;
  const out=[];
  (pg.dxf.dims||[]).filter(m=>m.ok&&m.dir).forEach(m=>{
    // the primitive actually on screen, with its object offset
    let T=null,TO=null;
    (pg.objects||[]).forEach(o=>(o.prims.texts||[]).forEach(t=>{
      if(t._dim===m.id && t._role==='val'){ T=t; TO=o; } }));
    if(!T) return;
    const g=h.dimGeomOf(m);
    const u=m.dir, n=[-u[1],u[0]], D=(p,v)=>p[0]*v[0]+p[1]*v[1];
    const hpx=T.h;                       // text height in mm
    c.font='100px '+h.store.format.font+',Arial';
    const mt=c.measureText(String(T.text));
    const w=mt.width*hpx/100, asc=mt.actualBoundingBoxAscent*hpx/100, desc=Math.max(0,mt.actualBoundingBoxDescent)*hpx/100;
    const rr=(T.rot||0)*Math.PI/180;
    const right=[Math.cos(rr), Math.sin(rr)], up=[-Math.sin(rr), Math.cos(rr)];
    const anchor=[T.x+(TO.dx||0), T.y+(TO.dy||0)];
    // four corners of the real ink box (align=1 -> anchor is the horizontal middle)
    const x0=(T.align===1? -w/2 : T.align===2? -w : 0);
    const corners=[[x0,-desc],[x0+w,-desc],[x0,asc],[x0+w,asc]].map(([a,b])=>
      [anchor[0]+right[0]*a+up[0]*b, anchor[1]+right[1]*a+up[1]*b]);
    const qs=corners.map(p=>D(p,n)), ts=corners.map(p=>D(p,u));
    const q=m.line.q;
    const clear=Math.min(...qs.map(v=>Math.abs(v-q)));   // nearest ink to the line
    const spans=(Math.min(...qs)<q && q<Math.max(...qs)); // text sitting ON the line = bad
    const inkMid=(Math.min(...ts)+Math.max(...ts))/2;
    out.push({ id:m.id,
      gapPx:+(clear*PXMM).toFixed(3),
      offCentreMM:+Math.abs(inkMid-g.text.t).toFixed(4),
      onLine:spans, align:T.align });
  });
  return out;
};
(async()=>{
 for(const dxf of ['Body_Demo_Drawing_Sheet1.dxf','Body_Demo_Drawing_Sheet3.dxf']){
  for(const [tag,file] of [['v58',_p.join(require('./harness').ROOT,'src','base.html')],['v59',require('./harness').APP]]){
    const {b,pg}=await open(file);
    await loadDxf(pg,dxf);
    let r=[];
    try{ r=await pg.evaluate(MEASURE); }catch(e){ r=[]; }
    if(!r.length){ console.log(dxf,tag,'(no model - old version)'); await b.close(); continue; }
    const gp=r.map(x=>x.gapPx), oc=r.map(x=>x.offCentreMM);
    console.log(dxf, tag, JSON.stringify({n:r.length,
      gapPx:{min:+Math.min(...gp).toFixed(2), max:+Math.max(...gp).toFixed(2)},
      offCentreMM:{max:+Math.max(...oc).toFixed(4)},
      sittingOnLine:r.filter(x=>x.onLine).length,
      notCentred:r.filter(x=>x.align!==1).length}));
    await b.close();
  }
 }
})();
