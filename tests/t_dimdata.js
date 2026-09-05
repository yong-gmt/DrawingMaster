const {chromium}=require('./_pw');
const H=require('./harness'), APP=H.APP;
/* STYLIZE changes the FORMAT of a dimension. It must never change its DATA.
 *
 * The numbers on an imported drawing were checked by whoever made it. Deriving
 * them again from the vectors looks equivalent and is not: a sheet drawn to a
 * scale, or edited after it was dimensioned, has geometry that does not match its
 * own figures, and re-measuring silently rewrote them. On one file every angular
 * dimension came back a different angle - 105 as 285 - and on another a 24 became
 * 24.37, both without a word.
 *
 * So this reads every value the file prints, presses STYLIZE, and reads them
 * again. Decimal places may change, a degree sign may be added: those are format.
 * The NUMBER may not move.
 */
/* Three real drawings, and one built on purpose to disagree with itself:
   decimals.dxf prints "24" beside a span that is really 24.37, which is what a
   sheet drawn to a scale looks like. On the real files re-measuring moves a value
   by five thousandths of a millimetre and nobody would ever see it; on that one it
   moves it by 0.37, and the drawing would be stating something it never said. */
const FILES=['Head-back.dxf','Body_Demo_Drawing_Sheet1.dxf','Body_Demo_Drawing_Sheet3.dxf',
             'decimals.dxf'];
const MOVED_MM=0.02;                 /* past honest rounding, short of real drift */
const num=s=>{
  const m=/-?\d+(?:[.,]\d+)?/.exec(String(s).replace(/^\s*\d+\s*[xX]\s*/,''));
  return m? parseFloat(m[0].replace(',','.')) : null;
};
(async()=>{
  const b=await chromium.launch();
  let worstOff=0, changed=0, checked=0;
  for(const f of FILES){
    const p=await (await b.newContext({viewport:{width:1400,height:900}})).newPage();
    const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,160)));
    await p.goto('file://'+APP); await p.waitForTimeout(900);
    await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(700);
    const sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
    await p.waitForTimeout(400);
    await p.click('#btnImport'); await p.setInputFiles('#fileInput', H.fixture(f));
    await p.waitForTimeout(2000);
    const read=()=>p.evaluate(()=>{ const h=window.__hook();
      const pg=h.store.pages.find(x=>x.id===h.store.activeId); const o=[];
      (pg.objects||[]).forEach(ob=>(ob.prims.texts||[]).forEach(t=>o.push(String(t.text))));
      return o; });
    const before=await read();
    await p.evaluate(()=>{ const h=window.__hook(); h.store.format.decimals=3; });
    await p.click('#btnStylize'); await p.waitForTimeout(2400);
    const after=await read();
    /* Compare the BAGS of numbers - STYLIZE rebuilds the object list, so position
       by position means nothing. Every number that comes out must be one that went
       in, to within a rounding nobody could see. */
    const B=before.map(num).filter(v=>v!=null).sort((x,y)=>x-y);
    const A=after.map(num).filter(v=>v!=null).sort((x,y)=>x-y);
    const stray=[];
    A.forEach(v=>{
      const near=B.reduce((best,w)=>Math.abs(w-v)<Math.abs(best-v)?w:best, B[0]);
      const off=Math.abs(near-v);
      if(off>worstOff) worstOff=off;
      if(off>MOVED_MM) stray.push(v+' (nearest the file printed: '+near+')');
    });
    checked+=A.length; changed+=stray.length;
    console.log((f+'                             ').slice(0,32)
      +' values '+String(A.length).padStart(3)
      +'   numbers STYLIZE moved: '+stray.length
      +(stray.length? '  '+JSON.stringify(stray.slice(0,6)) : '')
      +(errs.length? '   PAGE ERRORS '+errs.length : ''));
    await p.close();
  }
  console.log('values checked:', checked,
              '| numbers STYLIZE changed:', changed,
              '| largest move:', worstOff.toFixed(4), 'mm');
  await b.close();
})();
