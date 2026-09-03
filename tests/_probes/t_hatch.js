const {open,loadDxf}=require('./harness');
// What the file SAYS the pattern is, versus what the renderer will actually lay
// down. ANSI31 at scale 1 = lines at 45 degrees, 3.175 mm apart, continuous.
(async()=>{
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,'Body_Demo_Drawing_Sheet3.dxf');
  const r=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const out=[];
    (P.dxf.hatches||[]).forEach((ht,i)=>{
      const fams=h.hatchFamilies(ht);
      fams.forEach(f=>{
        const S=h.hatchStep(f);
        // which line of the family passes closest to the shape? (index k)
        let k=null;
        const p0=ht.loops[0][0];
        const vx=p0[0]-f.base[0], vy=p0[1]-f.base[1];
        k=(vx*S.nx+vy*S.ny)/S.spacing;
        out.push({hatch:i, pattern:ht.pattern, loops:ht.loops.length,
          angleDeg:+(Math.atan2(f.dir[1],f.dir[0])*180/Math.PI).toFixed(3),
          spacingMM:+S.spacing.toFixed(4), shiftMM:+S.shift.toFixed(4),
          base:f.base.map(v=>+v.toFixed(3)), dashes:f.dashes,
          kAtShape:+k.toFixed(3)});
      });
    });
    return out;
  });
  console.log(JSON.stringify(r,null,1));
  await b.close();
})();
