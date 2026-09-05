const {chromium}=require('../_pw');
const H=require('../harness'), APP=H.APP;
const fs=require('fs'), path=require('path');
const OUT=path.join(H.ROOT,'tests','out'); fs.mkdirSync(OUT,{recursive:true});
const DXF=process.argv[2]||'Head-back.dxf';
const WANT=+(process.argv[3]||2);
const look=()=>{ const h=window.__hook();
  const pg=h.store.pages.find(x=>x.id===h.store.activeId);
  const ms=h.dimModels(pg)||[];
  const rows=ms.map(m=>({id:m.id, kind:m.kind,
    prefix:m.text.prefix, suffix:m.text.suffix, override:m.text.override,
    shown:(h.captureSheet? null : null)}));
  // what is actually DRAWN for each dimension
  const drawn={};
  (pg.objects||[]).forEach(o=>(o.prims.texts||[]).forEach(t=>{ if(t._dim) drawn[t._dim]=t.text; }));
  rows.forEach(r=>r.drawn=drawn[r.id]);
  return rows;
};
(async()=>{
  const b=await chromium.launch();
  const p=await b.newPage({viewport:{width:1500,height:950}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('file://'+APP); await p.waitForTimeout(1200);
  await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(800);
  const sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
  await p.waitForTimeout(500);
  await p.click('#btnImport');
  await p.setInputFiles('#fileInput', H.fixture(DXF));
  await p.waitForTimeout(2200);
  // decimals = 2
  await p.evaluate(W=>{ const h=window.__hook(); h.store.format.decimals=W; }, WANT);
  await p.click('#btnStylize'); await p.waitForTimeout(2500);
  const rows=await p.evaluate(look);
  const dec=s=>{ const m=/(\d+)\.(\d+)/.exec(String(s||'')); return m? m[2].length : (/\d/.test(String(s||''))?0:'-'); };
  const bad=rows.filter(r=>dec(r.drawn)!==WANT);
  console.log(DXF+': '+rows.length+' dimensions, decimals set to '+WANT);
  console.log('  not at the set decimals: '+bad.length);
  bad.slice(0,12).forEach(r=>console.log('   '+r.id.padEnd(7)+(r.kind||'').padEnd(10)
    +' drawn="'+r.drawn+'"  prefix='+JSON.stringify(r.prefix)
    +' suffix='+JSON.stringify(r.suffix)+' override='+JSON.stringify(r.override)));
  console.log('  every text on the page: '+JSON.stringify(await p.evaluate(()=>{ const h=window.__hook();
    const pg=h.store.pages.find(x=>x.id===h.store.activeId);
    const out=[]; (pg.objects||[]).forEach(o=>(o.prims.texts||[]).forEach(t=>out.push(t.text)));
    return out; })));
  console.log('  models: '+JSON.stringify(rows.map(r=>({id:r.id,k:r.kind,drawn:r.drawn,
    p:r.prefix,s:r.suffix,o:r.override}))));
  if(errs.length) console.log('PAGE ERRORS: '+errs.join(' | '));
  await b.close();
})();
