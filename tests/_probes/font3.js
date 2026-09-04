const {chromium}=require('../_pw');
const H=require('../harness'), APP=H.APP;
const fs=require('fs'), path=require('path');
const OUT=path.join(H.ROOT,'tests','out'); fs.mkdirSync(OUT,{recursive:true});
(async()=>{
  const b=await chromium.launch();
  const p=await b.newPage({viewport:{width:1500,height:950}});
  const net=[]; p.on('response',r=>{ if(/fonts\.(googleapis|gstatic)/.test(r.url())) net.push(r.status()+' '+r.url().slice(0,70)); });
  await p.goto('file://'+APP); await p.waitForTimeout(1500);
  const r=await p.evaluate(async()=>{
    try{ await document.fonts.load('700 40px Sarabun'); await document.fonts.ready; }catch(e){}
    const c=document.createElement('canvas').getContext('2d');
    const w=f=>{ c.font=`700 40px ${f}`; return +c.measureText('TITLE OF THE DRAWING').width.toFixed(1); };
    return { arial:w('Arial'), sarabun:w('Sarabun'), serif:w('serif'), consolas:w('Consolas'),
             check:document.fonts.check('700 40px Sarabun') };
  });
  console.log(JSON.stringify(r));
  console.log('network: '+(net.join(' | ')||'(nothing fetched)'));
  await b.close();
})();
