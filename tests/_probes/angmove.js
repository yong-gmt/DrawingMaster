/* Does STYLIZE move an angular dimension's own strokes? */
const {chromium}=require('../_pw');
const H=require('../harness'), APP=H.APP;
const fs=require('fs'), path=require('path');
const OUT=path.join(H.ROOT,'tests','out'); fs.mkdirSync(OUT,{recursive:true});
const DXF=process.argv[2]||'angles.dxf';
(async()=>{
  const b=await chromium.launch();
  const p=await b.newPage({viewport:{width:1500,height:950}});
  await p.goto('file://'+APP); await p.waitForTimeout(1000);
  await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(700);
  const sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
  await p.waitForTimeout(400);
  await p.click('#btnImport'); await p.setInputFiles('#fileInput', H.fixture(DXF));
  await p.waitForTimeout(2200);
  const strokes=()=>p.evaluate(()=>{ const h=window.__hook();
    const pg=h.store.pages.find(x=>x.id===h.store.activeId);
    const ids=new Set((h.dimModels(pg)||[]).filter(m=>m.kind==='angular').map(m=>m.id));
    const out=[];
    (pg.objects||[]).forEach(o=>(o.prims.polys||[]).forEach(q=>{ if(!ids.has(q._dim)) return;
      out.push(q.pts.map(pt=>[+(pt[0]+(o.dx||0)).toFixed(3), +(pt[1]+(o.dy||0)).toFixed(3)])); }));
    return out.map(a=>JSON.stringify(a)).sort();
  });
  const before=await strokes();
  await p.evaluate(()=>{ const h=window.__hook(); h.store.format.decimals=3; });
  await p.click('#btnStylize'); await p.waitForTimeout(2600);
  const after=await strokes();
  const gone=before.filter(x=>!after.includes(x));
  const arrived=after.filter(x=>!before.includes(x));
  console.log(DXF+':  angular strokes before '+before.length+', after '+after.length);
  console.log('  strokes STYLIZE moved or removed: '+gone.length);
  console.log('  strokes STYLIZE invented        : '+arrived.length);
  /* Is it a MOVE of the whole page, or of the dimension itself? Compare each
     stroke's own shape - its points relative to its first point. */
  const shape=j=>JSON.stringify(JSON.parse(j).map(pt=>[+(pt[0]-JSON.parse(j)[0][0]).toFixed(3),
                                                       +(pt[1]-JSON.parse(j)[0][1]).toFixed(3)]));
  const sb=before.map(shape).sort(), sa=after.map(shape).sort();
  const shapeGone=sb.filter(x=>!sa.includes(x));
  console.log('  strokes whose SHAPE changed     : '+shapeGone.length);
  if(before.length && after.length){
    const b0=JSON.parse(before[0])[0], a0=JSON.parse(after[0])[0];
    console.log('  first stroke starts at '+JSON.stringify(b0)+' -> '+JSON.stringify(a0));
  }
  fs.writeFileSync(path.join(OUT,'ui_angmove.png'), await p.locator('#stage').screenshot());
  await b.close();
})();
