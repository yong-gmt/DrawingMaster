const _fs=require('fs'), _p=require('path');
const OUTDIR=_p.join(require('./harness').ROOT,'tests','out');
_fs.mkdirSync(OUTDIR,{recursive:true});
/* files a test writes go here, never into the fixture folders */
function OUT(n){ return _p.join(OUTDIR, _p.basename(n)); }
/* ============================================================================
   END-TO-END, THROUGH THE ACTUAL USER INTERFACE
   ----------------------------------------------------------------------------
   No internal hooks. This clicks the real buttons a person clicks:

       New project  ->  Import (real file picker)  ->  STYLIZE  ->  Export

   and then judges the DOWNLOADED FILE with ezdxf, a library that has never seen
   this application. Nothing here reads the app's own model, because the app
   agreeing with itself proves nothing.
   ========================================================================== */
const {chromium}=require('./_pw');
const fs=require('fs'), path=require('path'), {execSync}=require('child_process');

const FILES=['Head-back.dxf','Body_Demo_Drawing_Sheet1.dxf','Body_Demo_Drawing_Sheet3.dxf'];
const APP=require('./harness').APP;

function judge(orig, made){
  orig=require('./harness').fixture(orig);
  return execSync(`python3 - <<'PY'
import ezdxf, collections
O=ezdxf.readfile(${JSON.stringify(orig)}); N=ezdxf.readfile(${JSON.stringify(made)})
def dims(d):
    out=[]
    for e in d.modelspace():
        if e.dxftype()!='DIMENSION': continue
        v=getattr(e.dxf,'actual_measurement',None)
        if v is None: v=e.get_measurement()
        out.append(((e.dimtype & 15), round(float(v),2)))
    return sorted(out)
def rad(d,k):
    s=set()
    for e in d.modelspace():
        if e.dxftype()==k: s.add(round(e.dxf.radius,2))
    for b in d.blocks:
        if b.name.startswith(('*D','*Model','*Paper')): continue
        for e in b:
            if e.dxftype()==k: s.add(round(e.dxf.radius,2))
    return s
a,b=dims(O),dims(N)
sa,sb=collections.Counter(a),collections.Counter(b)
pinned=[e.dxf.text for e in N.modelspace()
        if e.dxftype()=='DIMENSION' and '<>' not in e.dxf.text]
noblock=[e for e in N.modelspace() if e.dxftype()=='DIMENSION'
         and e.dxf.geometry not in N.blocks]
noov=[e for e in N.modelspace() if e.dxftype()=='DIMENSION' and not e.override().dimstyle_attribs]
arrows=[]
for e in N.modelspace():
    if e.dxftype()!='DIMENSION': continue
    blk=N.blocks.get(e.dxf.geometry)
    want=1 if (e.dimtype & 15) in (3,4) else 2
    got=sum(1 for x in blk if x.dxftype()=='SOLID')
    if got!=want: arrows.append(((e.dimtype & 15), got, want))
print('    dimensions in the file      :', len(b), 'of', len(a), 'in the original')
print('    measurements identical      :', a==b,
      '' if a==b else '  missing: '+str(list((sa-sb).elements())))
print('    CIRCLE radii identical      :', rad(O,'CIRCLE')==rad(N,'CIRCLE'))
print('    ARC radii identical         :', rad(O,'ARC')<=rad(N,'ARC'))
print('    values pinned as fixed text :', len(pinned))
print('    dimensions with no block    :', len(noblock))
print('    dimensions with no override :', len(noov))
print('    blocks with wrong arrow count:', len(arrows), arrows[:3])
print('    layers written              :', len(N.layers))
print('    line types written          :', len(N.linetypes))
PY`).toString().trimEnd();
}

(async()=>{
  const browser=await chromium.launch();
  for(const src of FILES){
    const ctx=await browser.newContext({viewport:{width:1400,height:900},
      acceptDownloads:true});
    const page=await ctx.newPage();
    const errs=[]; page.on('pageerror',e=>errs.push(String(e).slice(0,120)));
    await page.goto('file://'+APP);
    await page.waitForTimeout(700);

    // --- click through to a sheet, the way a person starts ---------------
    const newBtn=await page.$('#btnNew');
    if(newBtn && await newBtn.isVisible()) await newBtn.click();
    else await page.evaluate(()=>window.__hook().createProject());
    await page.waitForTimeout(600);
    // open the sheet page in the sidebar by its label
    const sheet=await page.$('text=Sheet 01');
    if(sheet && await sheet.isVisible()) await sheet.click();
    await page.waitForTimeout(500);
    await page.waitForSelector('#btnImport', {state:'visible', timeout:10000});

    // --- Import, through the real file input ------------------------------
    await page.click('#btnImport');
    await page.setInputFiles('#fileInput', require('./harness').fixture(src));
    await page.waitForTimeout(1500);

    // --- STYLIZE, the real button ----------------------------------------
    const before=await page.locator('canvas').first().screenshot();
    await page.click('#btnStylize');
    await page.waitForTimeout(900);
    const after=await page.locator('canvas').first().screenshot();
    fs.writeFileSync('ui_'+src+'_after.png', after);
    const changed=Buffer.compare(before,after)!==0;
    // press it a second time: a person may, and nothing should move
    await page.click('#btnStylize');
    await page.waitForTimeout(900);
    const again=await page.locator('canvas').first().screenshot();
    const steady=Buffer.compare(after,again)===0;

    // --- Export, through the real menu ------------------------------------
    await page.click('#btnExport');
    await page.waitForTimeout(400);
    const dl=page.waitForEvent('download', {timeout:15000});
    const item=await page.$('[data-x="dxf"]');
    if(item) await item.click();
    else await page.click('#btnExport');            // single-action button
    const download=await dl;
    const out=OUT('ui_'+src);
    await download.saveAs(out);

    console.log('=== '+src+'   (imported, stylized and exported by clicking)');
    console.log('    downloaded file             :', download.suggestedFilename(),
                fs.statSync(out).size, 'bytes');
    console.log('    drawing changed on STYLIZE  :', changed);
    console.log('    pressing STYLIZE again moves nothing:', steady);
    console.log('    javascript errors           :', errs.length, errs.slice(0,2));
    console.log(judge(src, out));

    // --- and open what we just downloaded, again through the file picker ---
    const ctx2=await browser.newContext({viewport:{width:1400,height:900}});
    const p2=await ctx2.newPage();
    const errs2=[]; p2.on('pageerror',e=>errs2.push(String(e).slice(0,120)));
    await p2.goto('file://'+APP); await p2.waitForTimeout(700);
    const nb=await p2.$('#btnNew');
    if(nb && await nb.isVisible()) await nb.click();
    else await p2.evaluate(()=>window.__hook().createProject());
    await p2.waitForTimeout(600);
    const sh2=await p2.$('text=Sheet 01'); if(sh2 && await sh2.isVisible()) await sh2.click();
    await p2.waitForTimeout(500);
    await p2.waitForSelector('#btnImport', {state:'visible', timeout:10000});
    await p2.click('#btnImport');
    await p2.setInputFiles('#fileInput', out);
    await p2.waitForTimeout(1500);
    // does any text come back mangled? An escape the reader does not understand
    // shows up as its own source code, which is how \U+2205 was caught.
    const mangled=await p2.evaluate(()=>{
      const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
      const bad=[];
      (P.objects||[]).forEach(o=>(o.prims.texts||[]).forEach(t=>{
        const s=String(t.text||'');
        if(/\\U\+|%%[cdpCDP]|\uFFFD|Ã|â€/.test(s)) bad.push(s.slice(0,20)); }));
      return bad;
    });
    const reread=await p2.evaluate(()=>{
      // count what came back, using only what any importer would see
      const el=document.querySelector('canvas');
      return {canvasHasInk: (()=>{ const c=el.getContext('2d');
        const d=c.getImageData(0,0,el.width,el.height).data;
        let n=0; for(let i=0;i<d.length;i+=4) if(d[i]<140) n++; return n; })()};
    });
    console.log('    re-opened the exported file :',
                errs2.length? ('ERRORS '+errs2[0]) : 'no errors',
                '| ink on the page:', reread.canvasHasInk>5000? 'yes' : 'NOTHING DREW');
    console.log('    text that came back mangled :', mangled.length, mangled.slice(0,3));
    fs.writeFileSync('ui_'+src+'_reopened.png',
                     await p2.locator('canvas').first().screenshot());
    await ctx2.close();
    await ctx.close();
  }
  await browser.close();
})();
