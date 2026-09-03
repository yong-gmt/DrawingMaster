const {chromium}=require('./_pw');
const H=require('./harness'), APP=H.APP;
// A BOM row is the text plus 4 px of air above and below - at any text size, and
// with a cell that wraps onto two lines.
(async()=>{
  const b=await chromium.launch();
  const p=await (await b.newContext({viewport:{width:1400,height:900}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,160)));
  await p.goto('file://'+APP); await p.waitForTimeout(900);
  await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(700);
  const sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
  await p.waitForTimeout(500);
  await p.click('#btnBom'); await p.waitForTimeout(800);
  const s=await p.$('#rpSave'); if(s) await s.click(); await p.waitForTimeout(600);

  for(const pt of [8,10,14,20]){
    const r=await p.evaluate((v)=>{
      const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
      h.store.format.fontSize=v; h.render();
      const bb=h.bomBounds(P), text=h.bomFontMM(), PX=96/25.4;
      return {rowMM:+bb.rh[0].toFixed(2), textMM:+text.toFixed(2),
              padPx:+(((bb.rh[0]-text)/2)*PX).toFixed(2)};
    }, pt);
    console.log(String(pt).padStart(2)+'pt: row', String(r.rowMM).padStart(5), 'mm ·',
                'text', String(r.textMM).padStart(4), 'mm ·',
                'padding each side', r.padPx, 'px',
                Math.abs(r.padPx-4)<0.05? '' : '  <-- NOT 4');
  }

  // the heading and the column names are rows too
  const head=await p.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    h.store.format.fontSize=10; h.render();
    const bb=h.bomBounds(P), PX=96/25.4;
    const title=h.bomTitleMM(), col=h.bomFontMM();
    const headBand=bb.h - bb.rh.reduce((a,c)=>a+c,0);   // title row + column row
    return {titleRowPlusColumnRowMM:+headBand.toFixed(2),
            padEachSidePx:+(((headBand-title-col)/4)*PX).toFixed(2)};
  });
  console.log('heading rows: padding each side', head.padEachSidePx, 'px');

  // a cell that wraps: the extra height must be one line, not another 8 px of air
  const wrap=await p.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    h.store.format.fontSize=10;
    P.bom.rows=[{part:'A', title:'short'},
                {part:'B', title:'a title long enough that it has to wrap onto a second line'}];
    h.render();
    const bb=h.bomBounds(P), text=h.bomFontMM(), PX=96/25.4;
    return {oneLineMM:+bb.rh[0].toFixed(2), twoLineMM:+bb.rh[1].toFixed(2),
            extraMM:+(bb.rh[1]-bb.rh[0]).toFixed(2),
            oneLineOfTextMM:+(text*1.34).toFixed(2),
            padPx:+(((bb.rh[0]-text)/2)*PX).toFixed(2)};
  });
  console.log('wrapping row: one line', wrap.oneLineMM, 'mm · two lines', wrap.twoLineMM,
              'mm · the extra is', wrap.extraMM, 'mm, one line of text is', wrap.oneLineOfTextMM, 'mm');
  console.log('the extra height is one line, not more padding:',
              Math.abs(wrap.extraMM - wrap.oneLineOfTextMM) < 0.05);
  console.log('errors:', errs.length, errs.slice(0,2));
  await b.close();
})();
