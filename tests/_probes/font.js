const {chromium}=require('../_pw');
const H=require('../harness'), APP=H.APP;
const fs=require('fs'), path=require('path');
const OUT=path.join(H.ROOT,'tests','out'); fs.mkdirSync(OUT,{recursive:true});
(async()=>{
  const b=await chromium.launch();
  const p=await b.newPage({viewport:{width:1500,height:950}});
  await p.goto('file://'+APP); await p.waitForTimeout(900);
  await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(800);
  await p.click('text=Format Config'); await p.waitForTimeout(800);
  const fonts=await p.evaluate(()=>[...document.querySelectorAll('#fFont option')].map(o=>o.value));
  console.log('choices: '+fonts.join(', '));
  for(const fnt of fonts){
    await p.selectOption('#fFont', fnt); await p.waitForTimeout(350);
    const r=await p.evaluate(()=>{
      const c=document.createElement('canvas').getContext('2d');
      const fam=window.__hook().store.format.font;   // NOTE: the sheet's font, not the draft
      const draft='(draft not exposed)';
      // what the app builds, verbatim
      const s=`700 40px ${fam},Arial`;
      c.font=s; const applied=c.font;
      const w=+c.measureText('TITLE OF THE DRAWING').width.toFixed(1);
      // and the same through the draft font the preview uses
      const cv=document.getElementById('tbPrev');
      return {asked:fam, fontStringAccepted:applied, width:w};
    });
    // the preview canvas is drawn with fmtDraft.font - measure THAT the same way
    const r2=await p.evaluate(f=>{
      const c=document.createElement('canvas').getContext('2d');
      c.font=`700 40px ${f},Arial`;
      return {accepted:c.font, width:+c.measureText('TITLE OF THE DRAWING').width.toFixed(1)};
    }, fnt);
    console.log(`${fnt.padEnd(18)} accepted="${r2.accepted}"  width=${r2.width}`);
  }
  // and a picture of the preview in the most distinctive of them
  await p.selectOption('#fFont','Courier New'); await p.waitForTimeout(500);
  let box=await p.$('.tbprevbox'); if(box) fs.writeFileSync(path.join(OUT,'ui_font_courier.png'), await box.screenshot());
  await p.selectOption('#fFont','Times New Roman'); await p.waitForTimeout(500);
  box=await p.$('.tbprevbox'); if(box) fs.writeFileSync(path.join(OUT,'ui_font_times.png'), await box.screenshot());
  await b.close();
})();
