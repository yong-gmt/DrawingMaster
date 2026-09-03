const {open,loadDxf}=require('./harness');
// The letter has to end up on the SAME SIDE the arrow points, past the tip -
// it names the view, so it belongs in the direction of sight.
(async()=>{
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,'Body_Demo_Drawing_Sheet3.dxf');
  await pg.evaluate(()=>{ window.__hook().store.format.fontSize=9; });
  await pg.evaluate(()=>document.querySelector('#btnStylize').click());
  const r=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const out=[];
    (P.dxf.secs||[]).forEach(s=>{
      const g=h.secGeomOf(s);
      const texts=[];
      (P.objects||[]).forEach(o=>(o.prims.texts||[]).forEach(t=>{
        if(t._sec===s.id) texts.push([t.x+(o.dx||0), t.y+(o.dy||0), t.h, t.text]); }));
      s.ends.forEach((E,k)=>{
        const tip=g.pts[k===0?0:3];
        // nearest letter to this end's arrow tip
        let L=null, bd=1e9;
        texts.forEach(t=>{ const d=Math.hypot(t[0]-tip[0], t[1]-tip[1]); if(d<bd){bd=d;L=t;} });
        // compare the VISUAL centre of the real ink box, not the baseline anchor
        const cc=document.createElement('canvas').getContext('2d');
        cc.font='100px '+h.store.format.font+',Arial';
        const mm2=cc.measureText(String(L[3]));
        const asc=mm2.actualBoundingBoxAscent*L[2]/100;
        const dsc=Math.max(0,mm2.actualBoundingBoxDescent)*L[2]/100;
        const c=[L[0], L[1]+(asc-dsc)/2];
        const v=[c[0]-tip[0], c[1]-tip[1]];
        out.push({ id:s.id, letter:L[3],
          beyondTipMM:+(v[0]*E.view[0]+v[1]*E.view[1]).toFixed(2),   // must be > 0
          sidewaysMM:+Math.abs(-v[0]*E.view[1]+v[1]*E.view[0]).toFixed(2),
          letterH:+L[2].toFixed(2) });
      });
    });
    return out;
  });
  console.log(JSON.stringify(r));
  console.log('all letters past their own arrow tip:',
    r.every(x=>x.beyondTipMM>0), ' none off to the side:', r.every(x=>x.sidewaysMM<1.5));
  await b.close();
})();
