const {chromium}=require('../_pw');
const H=require('../harness'), APP=H.APP;
(async()=>{
  const b=await chromium.launch();
  const p=await b.newPage({viewport:{width:1400,height:900}});
  await p.goto('file://'+APP); await p.waitForTimeout(1000);
  await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(700);
  const sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
  await p.waitForTimeout(400);
  await p.click('#btnImport'); await p.setInputFiles('#fileInput', H.fixture('ang_mirror.dxf'));
  await p.waitForTimeout(2200);
  const st=()=>p.evaluate(()=>{ const h=window.__hook();
    const pg=h.store.pages.find(x=>x.id===h.store.activeId);
    const ms=(h.dimModels(pg)||[]).filter(m=>m.kind==='angular');
    const roles=[];
    (pg.objects||[]).forEach(o=>(o.prims.polys||[]).forEach(q=>{ if(q._dim) roles.push((q._role||'-')+':'+q.pts.length); }));
    return {models:ms.map(m=>({ok:m.ok, authored:!!m.authored, userMoved:!!m.userMoved, pending:!!m.pending,
      r:+m.radius.toFixed(2), a0:+(m.a0*180/Math.PI).toFixed(1), sw:+(m.sweep*180/Math.PI).toFixed(1)})), roles};
  });
  console.log('after import : '+JSON.stringify(await st()));
  await p.click('#btnStylize'); await p.waitForTimeout(2500);
  console.log('after stylize: '+JSON.stringify(await st()));
  await b.close();
})();
