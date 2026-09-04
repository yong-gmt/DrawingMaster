const {chromium}=require('../_pw');
const H=require('../harness'), APP=H.APP;
const fs=require('fs'), path=require('path');
const OUT=path.join(H.ROOT,'tests','out'); fs.mkdirSync(OUT,{recursive:true});
(async()=>{
  const b=await chromium.launch();
  const p=await b.newPage({viewport:{width:1500,height:950}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('file://'+APP); await p.waitForTimeout(1200);
  await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(800);
  const sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
  await p.waitForTimeout(600);
  await p.click('#btnBom'); await p.waitForTimeout(1000);
  console.log('chips     : '+await p.evaluate(()=>[...document.querySelectorAll('#rpBody .chip')]
    .map(c=>c.textContent.trim()+(c.classList.contains('on')?'[on]':'[off]')).join(' ')));
  // what is actually DRAWN as the header row of the table
  const drawn=await p.evaluate(()=>{ const h=window.__hook();
    const pg=h.store.pages.find(x=>x.type==='sheet');
    return h.captureSheet(pg).filter(e=>e.t==='text').map(e=>e.text); });
  const heads=['PART NO.','TITLE','QUANTITY','MATERIAL','FINISH','COLOR','PRODUCTION','PART TYPE','NOTE'];
  console.log('drawn head: '+heads.filter(x=>drawn.includes(x)).join(' | '));
  console.log('row keys  : '+await p.evaluate(()=>{ const h=window.__hook();
    const pg=h.store.pages.find(x=>x.type==='sheet'); return Object.keys(pg.bom.rows[0]).join(','); }));
  // type into the Color cell and check it reaches the paper
  await p.evaluate(()=>{ const h=window.__hook();
    const pg=h.store.pages.find(x=>x.type==='sheet');
    pg.bom.rows[0].color='ANODISED BLACK'; h.render(); h.persist(); });
  await p.waitForTimeout(500);
  const d2=await p.evaluate(()=>{ const h=window.__hook();
    const pg=h.store.pages.find(x=>x.type==='sheet');
    return h.captureSheet(pg).filter(e=>e.t==='text').map(e=>e.text).filter(t=>/ANODISED/.test(t)); });
  console.log('typed cell: '+JSON.stringify(d2));
  const bb=await p.evaluate(()=>{ const h=window.__hook();
    const pg=h.store.pages.find(x=>x.type==='sheet'); const b=h.bomBounds(pg);
    const {W}= {W:{A4:297,A3:420,A2:594}[h.store.format.paper]};
    return {x:+b.x.toFixed(1), w:+b.w.toFixed(1), rightEdge:+(b.x+b.w).toFixed(1), paperW:W,
            margin:h.store.format.margin}; });
  console.log('table fits: '+JSON.stringify(bb));
  fs.writeFileSync(path.join(OUT,'ui_bom_color.png'), await p.locator('#stage').screenshot());
  if(errs.length) console.log('PAGE ERRORS: '+errs.join(' | '));
  await b.close();
})();
