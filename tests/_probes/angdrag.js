/* Can an angular dimension still be stretched and its value moved? */
const {chromium}=require('../_pw');
const H=require('../harness'), APP=H.APP;
const fs=require('fs'), path=require('path');
const OUT=path.join(H.ROOT,'tests','out'); fs.mkdirSync(OUT,{recursive:true});
(async()=>{
  const b=await chromium.launch();
  const p=await b.newPage({viewport:{width:1500,height:950}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,200)));
  await p.goto('file://'+APP); await p.waitForTimeout(1000);
  await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(700);
  const sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
  await p.waitForTimeout(400);
  await p.click('#btnImport'); await p.setInputFiles('#fileInput', H.fixture('ang_mirror.dxf'));
  await p.waitForTimeout(2200);
  await p.click('#btnStylize'); await p.waitForTimeout(2200);
  const state=()=>p.evaluate(()=>{ const h=window.__hook();
    const pg=h.store.pages.find(x=>x.id===h.store.activeId);
    const m=(h.dimModels(pg)||[]).filter(x=>x.kind==='angular')[0];
    let strokes=0, pts=0, txt=null;
    (pg.objects||[]).forEach(o=>{ (o.prims.polys||[]).forEach(q=>{ if(q._dim===m.id && q.pts.length){ strokes++; pts+=q.pts.length; } });
      (o.prims.texts||[]).forEach(t=>{ if(t._dim===m.id) txt={text:String(t.text), at:[+t.x.toFixed(2),+t.y.toFixed(2)]}; }); });
    const g=h.dimGeomOf(m);
    return {r:+m.radius.toFixed(2), userMoved:!!m.userMoved, strokes, pts, txt,
            textAt:[+g.text.x.toFixed(2), +g.text.y.toFixed(2)]};
  });
  console.log('after stylize : '+JSON.stringify(await state()));
  const S=async(wx,wy)=>{ const c=await p.evaluate(([x,y])=>{ const q=window.__hook().W2S(x,y);
    const r=document.getElementById('stage').getBoundingClientRect();
    return {x:r.left+q.x, y:r.top+q.y}; },[wx,wy]); return c; };
  // select it, then drag the ARC handle outwards
  const grips=await p.evaluate(()=>{ const h=window.__hook();
    const pg=h.store.pages.find(x=>x.id===h.store.activeId);
    const m=(h.dimModels(pg)||[]).filter(x=>x.kind==='angular')[0];
    h.setSelection((pg.objects||[]).filter(o=>(o.prims.polys||[]).some(q=>q._dim===m.id)
                                            ||(o.prims.texts||[]).some(t=>t._dim===m.id)).map(o=>o.id));
    h.render();
    const C=m.centre, am=m.a0+m.sweep/2;
    const g=h.dimGeomOf(m);
    return {arc:[C[0]+m.radius*Math.cos(am), C[1]+m.radius*Math.sin(am)], text:[g.text.x,g.text.y]}; });
  let a=await S(grips.arc[0],grips.arc[1]);
  let t=await S(grips.arc[0]*1.5, grips.arc[1]*1.5);
  await p.mouse.move(a.x,a.y); await p.mouse.down(); await p.mouse.move(t.x,t.y,{steps:10}); await p.mouse.up();
  await p.waitForTimeout(600);
  const afterArc=await state();
  console.log('after arc drag: '+JSON.stringify(afterArc));
  // now drag the VALUE
  const g2=await p.evaluate(()=>{ const h=window.__hook();
    const pg=h.store.pages.find(x=>x.id===h.store.activeId);
    const m=(h.dimModels(pg)||[]).filter(x=>x.kind==='angular')[0];
    h.setSelection((pg.objects||[]).filter(o=>(o.prims.polys||[]).some(q=>q._dim===m.id)
                                            ||(o.prims.texts||[]).some(t=>t._dim===m.id)).map(o=>o.id));
    h.render();
    return h.dimGeomOf(m).text; });
  a=await S(g2.x,g2.y); t=await S(g2.x+18, g2.y+14);
  await p.mouse.move(a.x,a.y); await p.mouse.down(); await p.mouse.move(t.x,t.y,{steps:10}); await p.mouse.up();
  await p.waitForTimeout(600);
  const afterText=await state();
  console.log('after text drag: '+JSON.stringify(afterText));
  console.log('radius changed: '+(afterArc.r!==(await state()).r || afterArc.r!==30));
  fs.writeFileSync(path.join(OUT,'ui_angdrag.png'), await p.locator('#stage').screenshot());
  if(errs.length) console.log('PAGE ERRORS: '+errs.join(' | '));
  await b.close();
})();
