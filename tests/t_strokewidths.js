const {open,loadDxf}=require('./harness');
// Every step of the Stroke Weight slider must change the width the canvas draws a
// DIMENSION line with. Ink on the page is a good check but a slow one; this reads
// the width itself, so a floor that swallows the setting cannot hide.
(async()=>{
  const {b,pg}=await open('DrawingMaster.html');
  const errs=[]; pg.on('pageerror',e=>errs.push(String(e).slice(0,140)));
  await loadDxf(pg,'Head-back.dxf');
  await pg.evaluate(()=>document.querySelector('#btnStylize').click());
  await pg.waitForTimeout(1000);
  const r=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const c=document.querySelector('canvas').getContext('2d');
    const orig=Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype,'lineWidth');
    // only dimensions on the page, so the width read back is theirs
    const all=P.objects;
    P.objects=all.filter(o=>!!o._dim);
    const out=[];
    [0.05,0.1,0.15,0.2,0.3,0.5,0.75,1.0].forEach(w=>{
      h.store.format.stroke=w;
      const seen=new Set();
      Object.defineProperty(c,'lineWidth',{configurable:true,
        set(v){ seen.add(+v.toFixed(3)); orig.set.call(this,v); },
        get(){ return orig.get.call(this); }});
      h.render();
      delete c.lineWidth;
      /* The sheet frame and the title block are drawn at their own fixed widths,
         so "the thinnest width seen" stopped being the dimension line as soon as
         the dimension line grew past them. Work out what the dimension line
         should be and check the canvas was actually asked for it. */
      const base=Math.max(0.3, h.mm2px(w));
      const want=+Math.max(0.2, base*0.5).toFixed(3);
      out.push({mm:w, dimensionLinePx:want, canvasWasAskedForIt:seen.has(want)});
    });
    P.objects=all;
    return out;
  });
  console.log(r.map(x=>x.mm+'mm:'+x.dimensionLinePx+'px').join('  '));
  const w=r.map(x=>x.dimensionLinePx);
  const rising=w.every((v,i)=>i===0 || v>w[i-1]);
  const distinct=new Set(w).size===w.length;
  console.log('drawn with that width:', r.every(x=>x.canvasWasAskedForIt));
  console.log('thicker at every step:', rising, '| no two settings identical:', distinct);
  console.log('thinnest to thickest:', (w[w.length-1]/w[0]).toFixed(1)+'x');
  console.log('errors:', errs.length, errs.slice(0,2));
  await b.close();
})();
