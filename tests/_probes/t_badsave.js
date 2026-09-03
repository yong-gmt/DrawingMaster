const {chromium}=require('./_pw');
const path=require('path'), fs=require('fs');
// If ONE machine is broken and another is fine, the difference is what that
// machine has stored. So: what does the app do when the stored project is from a
// half-finished build, or is damaged?
const cases={
  'a project with no objects array':      p=>{ p.pages.forEach(x=>{ if(x.type==='sheet') delete x.objects; }); },
  'models left half-applied (pending)':   p=>{ p.pages.forEach(x=>{ if(x.dxf&&x.dxf.dims) x.dxf.dims.forEach(m=>m.pending=true); }); },
  'a model with no measure points':       p=>{ p.pages.forEach(x=>{ if(x.dxf&&x.dxf.dims) x.dxf.dims.forEach(m=>{ delete m.measure; }); }); },
  'balloons referring to nothing':        p=>{ p.pages.forEach(x=>{ if(x.dxf) x.dxf.balloons=[{id:'balX',num:'1',c:[0,0],tip:[1,1],ok:true}]; }); },
  'the drawing itself truncated':         p=>{ p.pages.forEach(x=>{ if(x.dxf&&x.dxf.polys) x.dxf.polys.length=Math.floor(x.dxf.polys.length/2); }); },
};
(async()=>{
  const b=await chromium.launch();
  // make one good save first
  const ctx=await b.newContext({viewport:{width:1400,height:900}});
  const p0=await ctx.newPage();
  await p0.goto('file://'+require('./harness').fixture(require('./harness').APP)); await p0.waitForTimeout(900);
  await p0.evaluate(()=>window.__hook().createProject()); await p0.waitForTimeout(700);
  const sh=await p0.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
  await p0.waitForTimeout(500);
  await p0.click('#btnImport');
  await p0.setInputFiles('#fileInput', require('./harness').fixture('Head-back.dxf'));
  await p0.waitForTimeout(2000);
  const good=await p0.evaluate(()=>localStorage['drawingmaster.projects.v1']);
  await ctx.close();

  for(const [name, damage] of Object.entries(cases)){
    const c=await b.newContext({viewport:{width:1400,height:900}});
    const p=await c.newPage();
    const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,150)));
    await p.goto('file://'+require('./harness').fixture(require('./harness').APP)); await p.waitForTimeout(500);
    await p.evaluate(({good, src})=>{
      const db=JSON.parse(good);
      db.forEach(proj=>{ (new Function('p', src))(proj); });
      localStorage['drawingmaster.projects.v1']=JSON.stringify(db);
    }, {good, src:'('+damage.toString()+')(p)'});
    await p.reload(); await p.waitForTimeout(1200);
    const card=await p.$('text=Project 1');
    let r={opened:false};
    if(card){ await card.click(); await p.waitForTimeout(1400);
      const s2=await p.$('text=Sheet 01'); if(s2&&await s2.isVisible()) await s2.click();
      await p.waitForTimeout(800);
      r=await p.evaluate(()=>{
        const h=window.__hook&&window.__hook();
        const P=h&&h.store&&h.store.pages&&h.store.pages.find(x=>x.id===h.store.activeId);
        const cv=document.querySelector('canvas'); let ink=0;
        if(cv){ const c2=cv.getContext('2d'); const d=c2.getImageData(0,0,cv.width,cv.height).data;
          for(let i=0;i<d.length;i+=4) if(d[i]<140) ink++; }
        return {opened:true, objects:P?(P.objects||[]).length:'no page', ink};
      });
    }
    console.log((name+'                                  ').slice(0,36),
      'card:', !!card, '| objects:', r.objects===undefined?'-':r.objects,
      '| ink:', r.ink===undefined?'-':r.ink,
      '| errors:', errs.length, errs[0]?('<'+errs[0].slice(0,60)+'>'):'');
    await c.close();
  }
  await b.close();
})();
