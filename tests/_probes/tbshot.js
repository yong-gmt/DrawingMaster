const {chromium}=require('../_pw');
const H=require('../harness'), APP=H.APP;
const fs=require('fs'), path=require('path');
const OUT=path.join(H.ROOT,'tests','out'); fs.mkdirSync(OUT,{recursive:true});
(async()=>{
  const b=await chromium.launch();
  const p=await b.newPage({viewport:{width:1500,height:950}});
  await p.goto('file://'+APP); await p.waitForTimeout(900);
  await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(700);
  const sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
  await p.waitForTimeout(500);
  // zoom right into the tolerance block of the title block
  const box=await p.evaluate(()=>{ const h=window.__hook();
    const st=document.getElementById('stage'), rc=st.getBoundingClientRect();
    const tb=window.__tb=h.App._state? null : null;
    return null; });
  await p.evaluate(()=>{ const h=window.__hook();
    const s=h.store, f=s.format;
    /* the title block sits at the bottom right of the sheet; zoom to its middle third */
    const P=s.pages.find(x=>x.id===s.activeId);
    const W=h.App._state().view; // not used
  });
  const r=await p.evaluate(()=>{ const h=window.__hook();
    const st=h.store; const f=st.format;
    const PAPERS={A4:[297,210]}; // just to be safe if needed
    return null; });
  // use the app's own rect helper through a zoom on world coords
  await p.evaluate(()=>{ const h=window.__hook();
    const st=h.store, m=st.format.margin;
    const paper=(h.App._state().store||st);
    // title block rect: bottom-right corner of the paper
    const W=(h.App._state().view, 0);
  });
  await p.evaluate(()=>{ const h=window.__hook();
    // zoomRect takes world mm; the title block is 180 x 55 at the bottom right
    const st=h.store, m=st.format.margin;
    const sizes={A4:[297,210],A3:[420,297],A2:[594,420],A1:[841,594],A0:[1189,841]};
    const [W,H]=sizes[st.format.paper]||sizes.A4;
    const x1=W-m, y0=m;
    h.zoomRect(x1-180*0.78, y0+14, x1-180*0.48, y0+34);
  });
  await p.waitForTimeout(500);
  fs.writeFileSync(path.join(OUT,'ui_tol.png'), await p.locator('#stage').screenshot());
  console.log('shot');
  await b.close();
})();
