const {open,loadDxf}=require('./harness');
const fs=require('fs');
// Push a radius centre far off the sheet and check the foreshortened form:
// the arrow end stays radial and true, a zig-zag appears, the centre mark parks
// at a false position, and the VALUE still reads the real radius.
(async()=>{
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,'Body_Demo_Drawing_Sheet1.dxf');
  const r=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const m=(P.dxf.dims||[]).filter(x=>x.kind==='radial')[0];
    const before=h.dimGeomOf(m);
    // move the centre far away along the same radial line -> big radius
    const d=[m.point[0]-m.centre[0], m.point[1]-m.centre[1]];
    const L=Math.hypot(...d); const u=[d[0]/L,d[1]/L];
    m.centre=[m.point[0]-u[0]*400, m.point[1]-u[1]*400];
    m.radius=400; m.text.value='R400.00'; m.text.override=null;
    h.dimRelayout(P); h.render();
    const g=h.dimGeomOf(m);
    const cen=g.segs.find(s=>s.role==='cen');
    // is the first leg (from the arrow) still exactly on the true radius?
    const a=cen.pts[cen.pts.length-1], b2=cen.pts[cen.pts.length-2];
    const cross=Math.abs((b2[0]-a[0])*u[1]-(b2[1]-a[1])*u[0])/Math.hypot(b2[0]-a[0],b2[1]-a[1]);
    // how far off the radial line does the zig-zag swing?
    let swing=0;
    cen.pts.forEach(p=>{ const vx=p[0]-m.point[0], vy=p[1]-m.point[1];
      swing=Math.max(swing, Math.abs(vx*u[1]-vy*u[0])); });
    return { farBefore:before.foreshortened, farAfter:g.foreshortened,
      legs:cen.pts.length, firstLegOnRadius:+cross.toFixed(6),
      jogSwingMM:+swing.toFixed(2),
      falseCentreRunMM:+Math.hypot(g.centreAt[0]-m.point[0], g.centreAt[1]-m.point[1]).toFixed(1),
      trueRunMM:400, value:g.text.str,
      markPresent:g.segs.some(s=>s.role==='mkH')&&g.segs.some(s=>s.role==='mkV') };
  });
  console.log(JSON.stringify(r));
  await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const m=(P.dxf.dims||[]).filter(x=>x.kind==='radial')[0], g=h.dimGeomOf(m);
    const xs=[g.text.x,g.centreAt[0],m.point[0]], ys=[g.text.y,g.centreAt[1],m.point[1]];
    h.zoomRect(Math.min(...xs)-8,Math.min(...ys)-8,Math.max(...xs)+8,Math.max(...ys)+8);
  });
  await pg.waitForTimeout(350);
  fs.writeFileSync(require('./harness').out('jog.png'), await pg.locator('canvas').first().screenshot());
  await b.close();
})();
