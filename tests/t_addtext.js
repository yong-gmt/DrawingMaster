const _fs=require('fs'), _p=require('path');
const OUTDIR=_p.join(require('./harness').ROOT,'tests','out');
_fs.mkdirSync(OUTDIR,{recursive:true});
/* files a test writes go here, never into the fixture folders */
function OUT(n){ return _p.join(OUTDIR, _p.basename(n)); }
const {chromium}=require('./_pw');
const path=require('path'), fs=require('fs'), {execSync}=require('child_process');
// Add Text through the real button, type in lower case, and check the result:
// capitals, bold, and two points larger than the sheet's text size - on the
// canvas, in the model, and in the exported file.
(async()=>{
  const b=await chromium.launch();
  const ctx=await b.newContext({viewport:{width:1400,height:900}, acceptDownloads:true});
  const page=await ctx.newPage();
  const errs=[]; page.on('pageerror',e=>errs.push(String(e).slice(0,120)));
  await page.goto('file://'+require('./harness').fixture(require('./harness').APP));
  await page.waitForTimeout(800);
  const nb=await page.$('#btnNew'); if(nb && await nb.isVisible()) await nb.click();
  else await page.evaluate(()=>window.__hook().createProject());
  await page.waitForTimeout(600);
  const sh=await page.$('text=Sheet 01'); if(sh && await sh.isVisible()) await sh.click();
  await page.waitForTimeout(500);
  await page.click('#btnImport');
  await page.setInputFiles('#fileInput', require('./harness').fixture('Head-back.dxf'));
  await page.waitForTimeout(1500);

  for(const [pt,typed] of [[10,'front view'],[14,'section a-a']]){
    await page.evaluate((v)=>{ window.__hook().store.format.fontSize=v; }, pt);
    await page.click('#btnText');
    await page.waitForTimeout(500);
    // type into the inline box the app opened, in lower case
    await page.evaluate((v)=>{
      const el=document.querySelector('.inline-edit'); el.value=v;
      el.dispatchEvent(new Event('input',{bubbles:true}));
    }, typed);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    const r=await page.evaluate(()=>{
      const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
      let t=null; (P.objects||[]).forEach(o=>(o.prims.texts||[]).forEach(x=>{ if(x._user) t=x; }));
      return {text:t&&t.text, h:t&&+t.h.toFixed(4), bold:!!(t&&t.bold),
              sheetPt:h.store.format.fontSize};
    });
    const want=((pt+2)*25.4/72);
    console.log('typed "'+typed+'" with the sheet at '+pt+' pt');
    console.log('   drawn as     :', JSON.stringify(r.text));
    console.log('   upper case   :', r.text===typed.toUpperCase());
    console.log('   bold         :', r.bold);
    console.log('   height       :', r.h, 'mm  | wanted', want.toFixed(4),
                '(=' + (pt+2) + ' pt)  |', Math.abs(r.h-want)<1e-3);
  }
  // STYLIZE must not flatten it back to the sheet size
  await page.click('#btnStylize'); await page.waitForTimeout(900);
  const after=await page.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const out=[]; (P.objects||[]).forEach(o=>(o.prims.texts||[]).forEach(x=>{
      if(x._user) out.push({t:x.text, h:+x.h.toFixed(4), bold:!!x.bold}); }));
    return {labels:out, sheetPt:h.store.format.fontSize};
  });
  const wantAfter=((after.sheetPt+2)*25.4/72);
  console.log('after STYLIZE :', JSON.stringify(after.labels));
  console.log('   still bold, upper and +2pt:',
    after.labels.every(x=>x.bold && x.t===x.t.toUpperCase() && Math.abs(x.h-wantAfter)<1e-3));

  fs.writeFileSync(require('./harness').out('addtext.png'), await page.locator('canvas').first().screenshot());
  await page.click('#btnExport'); await page.waitForTimeout(400);
  const dl=page.waitForEvent('download',{timeout:15000});
  const it=await page.$('[data-x="dxf"]'); if(it) await it.click();
  const d=await dl; await d.saveAs(OUT('addtext.dxf'));
  console.log('javascript errors:', errs.length, errs.slice(0,2));
  console.log(execSync(`python3 - <<'PY'
import ezdxf
d=ezdxf.readfile(${JSON.stringify(OUT('addtext.dxf'))})
lab=[e for e in d.modelspace() if e.dxftype()=='TEXT' and e.dxf.text in ('FRONT VIEW','SECTION A-A')]
print('in the exported file:', len(lab), 'labels')
for e in lab:
    print('  ', repr(e.dxf.text), 'height', round(e.dxf.height,4),
          'style', e.dxf.style, '| bold style exists:', 'BOLD' in d.styles)
PY`).toString().trim());
  await b.close();
})();
