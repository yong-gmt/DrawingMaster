/* How long each angular dimension's extension lines are, and whether they reach
   back to the side of the angle they belong to. */
const {chromium}=require('../_pw');
const H=require('../harness'), APP=H.APP;
const fs=require('fs'), path=require('path');
const OUT=path.join(H.ROOT,'tests','out'); fs.mkdirSync(OUT,{recursive:true});
(async()=>{
  const b=await chromium.launch();
  const p=await b.newPage({viewport:{width:1500,height:950}});
  await p.goto('file://'+APP); await p.waitForTimeout(1000);
  await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(700);
  const sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
  await p.waitForTimeout(400);
  await p.click('#btnImport'); await p.setInputFiles('#fileInput', H.fixture('angles.dxf'));
  await p.waitForTimeout(2000);
  await p.click('#btnStylize'); await p.waitForTimeout(2500);
  const r=await p.evaluate(()=>{ const h=window.__hook();
    const pg=h.store.pages.find(x=>x.id===h.store.activeId);
    return (h.dimModels(pg)||[]).filter(m=>m.kind==='angular').map(m=>{
      const C=m.centre, r=m.radius;
      const d=(m.ends||[]).map(e=>+Math.hypot(e[0]-C[0], e[1]-C[1]).toFixed(2));
      const g=h.dimGeom? null : null;
      return {value:(Math.abs(m.sweep)*180/Math.PI).toFixed(1)+'°',
              radius:+r.toFixed(2), endDistances:d,
              extLengths:d.map(x=>+Math.max(0,(r+2.5)-(Math.min(x,r)+1.0)).toFixed(2))};
    }); });
  console.log('angular dimensions: '+r.length);
  r.forEach(x=>console.log('  '+x.value.padStart(8)
    +'  arc r='+String(x.radius).padStart(7)
    +'  sides reach '+JSON.stringify(x.endDistances)
    +'  -> extension lines '+JSON.stringify(x.extLengths)+' mm'));
  /* Now the case in the screenshot: the arc stands well OUTSIDE the part, so the
     sides fall short of it and the extension lines have real work to do. Measure
     the strokes that get DRAWN, not the formula. */
  const drawn=await p.evaluate(()=>{ const h=window.__hook();
    const pg=h.store.pages.find(x=>x.id===h.store.activeId);
    const ms=(h.dimModels(pg)||[]).filter(m=>m.kind==='angular');
    const m=ms[0]; if(!m) return null;
    const C=m.centre;
    const before=(pg.objects||[]).flatMap(o=>(o.prims.polys||[])
      .filter(q=>q._dim===m.id && /^ext/.test(q._role||''))
      .map(q=>+Math.hypot(q.pts[1][0]-q.pts[0][0], q.pts[1][1]-q.pts[0][1]).toFixed(2)));
    /* push the arc out to twice the reach of the sides */
    const reach=Math.hypot(m.ends[0][0]-C[0], m.ends[0][1]-C[1]);
    m.radius=reach*2;
    h.dimRelayout ? h.dimRelayout(pg) : null;
    return {before, reach:+reach.toFixed(2), newRadius:+m.radius.toFixed(2)};
  });
  await p.click('#btnStylize'); await p.waitForTimeout(2000);
  const after=await p.evaluate(()=>{ const h=window.__hook();
    const pg=h.store.pages.find(x=>x.id===h.store.activeId);
    const m=(h.dimModels(pg)||[]).filter(x=>x.kind==='angular')[0];
    return (pg.objects||[]).flatMap(o=>(o.prims.polys||[])
      .filter(q=>q._dim===m.id && /^ext/.test(q._role||''))
      .map(q=>+Math.hypot(q.pts[1][0]-q.pts[0][0], q.pts[1][1]-q.pts[0][1]).toFixed(2)));
  });
  console.log('the screenshot case - arc pushed outside the part:');
  console.log('  sides reach '+drawn.reach+', arc now at '+drawn.newRadius);
  console.log('  extension strokes drawn, before: '+JSON.stringify(drawn.before)
    +'   after: '+JSON.stringify(after));
  fs.writeFileSync(path.join(OUT,'ui_angext.png'), await p.locator('#stage').screenshot());
  await b.close();
})();
