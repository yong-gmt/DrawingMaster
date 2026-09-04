const {chromium}=require('./_pw');
const H=require('./harness'), APP=H.APP;
const fs=require('fs');
// The interface is in English. Nothing the user can see may carry Thai - not the
// menus, not the messages that appear after an action, not the import report.
const THAI=/[\u0e00-\u0e7f]/;
(async()=>{
  const b=await chromium.launch();
  const p=await (await b.newContext({viewport:{width:1400,height:900}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,160)));
  const sweep=async(where)=>{
    const found=await p.evaluate((re)=>{
      const rx=new RegExp(re,'u'); const hits=[];
      const walk=(n)=>{
        if(n.nodeType===3){ const t=n.nodeValue.trim();
          if(t && rx.test(t)) hits.push(t.slice(0,60)); return; }
        if(n.nodeType!==1) return;
        ['title','placeholder','aria-label','value'].forEach(a=>{
          const v=n.getAttribute && n.getAttribute(a);
          if(v && rx.test(v)) hits.push(a+'="'+v.slice(0,50)+'"'); });
        n.childNodes.forEach(walk);
      };
      walk(document.body);
      return [...new Set(hits)];
    }, THAI.source);
    console.log((where+'                    ').slice(0,26), found.length? ('THAI: '+JSON.stringify(found.slice(0,3))) : 'all English');
    return found.length;
  };
  await p.goto('file://'+APP); await p.waitForTimeout(900);
  let bad=await sweep('dashboard');
  await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(700);
  const sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
  await p.waitForTimeout(500);
  bad+=await sweep('empty sheet');
  await p.click('#btnFormat'); await p.waitForTimeout(800);
  bad+=await sweep('Format Config');
  await p.click('#fSave'); await p.waitForTimeout(500);
  await p.click('#btnImport');
  await p.setInputFiles('#fileInput', H.fixture('Head-back.dxf'));
  await p.waitForTimeout(1900);
  bad+=await sweep('after import');
  await p.click('#btnStylize'); await p.waitForTimeout(1300);
  bad+=await sweep('after Stylize');
  await H.addBalloon(p); await p.waitForTimeout(700);
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  bad+=await sweep('after a pointer');
  await p.click('#btnBom'); await p.waitForTimeout(800);
  bad+=await sweep('BOM panel');
  // right-click menu
  await p.evaluate(()=>{ const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    h.setSelection((P.objects||[]).slice(0,3).map(o=>o.id)); h.render(); });
  const st=await p.$('#stage'); const bb=await st.boundingBox();
  await p.mouse.click(bb.x+bb.width/2, bb.y+bb.height/2, {button:'right'});
  await p.waitForTimeout(500);
  bad+=await sweep('right-click menu');
  console.log('total Thai found in the interface:', bad, '| errors:', errs.length);
  await b.close();
})();
