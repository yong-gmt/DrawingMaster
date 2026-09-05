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
  await p.evaluate(()=>{ const h=window.__hook(); h.store.name='acme gearbox'; }); 
  const sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
  await p.waitForTimeout(600);
  // fill every title-block field in lower case, through the panel
  const pt=await p.evaluate(()=>{ const h=window.__hook(), st=h.store, m=st.format.margin;
    const P={A4:[297,210],A3:[420,297],A2:[594,420]}[st.format.paper];
    const c=h.W2S(P[0]-m-170/2, m+24.68/2);
    const r=document.getElementById('stage').getBoundingClientRect();
    return {x:r.left+c.x, y:r.top+c.y}; });
  await p.mouse.dblclick(pt.x, pt.y); await p.waitForTimeout(700);
  for(const [id,v] of [['tbTitle','gear housing plate'],['tbPart','p-102a'],['tbVer','rev b'],
                       ['tbDraw','prj-ver-prt-07'],['tbMat','mild steel'],['tbFin','powder coat'],
                       ['tbCol','matt black']]) await p.fill('#'+id, v);
  await p.waitForTimeout(300);
  const sv=await p.$('#rpSave'); if(sv){ await sv.click(); await p.waitForTimeout(800); }
  // a BOM with lower-case cells
  await p.click('#btnBom'); await p.waitForTimeout(900);
  await p.evaluate(()=>{ const h=window.__hook();
    const pg=h.store.pages.find(x=>x.type==='sheet');
    pg.bom.rows[0]={...pg.bom.rows[0], title:'side bracket', qty:'2', material:'aluminium 6061',
                    finish:'anodised', color:'matt black', production:'cnc milled'};
    h.render(); h.persist(); });
  await p.waitForTimeout(600);
  const rp=await p.$('#rpClose'); if(rp) await rp.click(); await p.waitForTimeout(500);

  const texts=await p.evaluate(()=>{ const h=window.__hook();
    const pg=h.store.pages.find(x=>x.type==='sheet');
    return h.captureSheet(pg).filter(e=>e.t==='text').map(e=>e.text); });
  const lower=texts.filter(t=>/[a-z]/.test(t));
  console.log('what the panel holds : '+JSON.stringify(await p.evaluate(()=>({
    title:document.getElementById('tbTitle')? document.getElementById('tbTitle').value : '(closed)',
    stored:window.__hook().store.pages.find(x=>x.type==='sheet').title.title }))));
  console.log('strings drawn        : '+texts.length);
  console.log('any lower case left  : '+lower.length+(lower.length? '  '+JSON.stringify(lower):''));
  console.log('sample               : '+JSON.stringify(texts.filter(t=>/GEAR|BRACKET|ALUMIN|MATT|POWDER|P-102|REV/.test(t))));
  fs.writeFileSync(path.join(OUT,'ui_upper_all.png'), await p.locator('#stage').screenshot());
  if(errs.length) console.log('PAGE ERRORS: '+errs.join(' | '));
  await b.close();
})();
