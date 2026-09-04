const {chromium}=require('../_pw');
const H=require('../harness'), APP=H.APP;
(async()=>{
  const b=await chromium.launch();
  const p=await b.newPage({viewport:{width:1400,height:900}});
  await p.goto('file://'+APP); await p.waitForTimeout(1500);
  const r=await p.evaluate(async()=>{
    try{ await document.fonts.ready; }catch(e){}
    const c=document.createElement('canvas').getContext('2d');
    const TH='ฝาครอบเฟืองและแหวนรอง', EN='Gear cover and washer';
    const m=(fam,txt)=>{ c.font='400 40px '+fam; return +c.measureText(txt).width.toFixed(1); };
    const body=getComputedStyle(document.body).fontFamily;
    const cands=['Inter','"Segoe UI"','system-ui','Sarabun','Tahoma','sans-serif','serif', body];
    const out={};
    cands.forEach(f=>{ out[f]={thai:m(f,TH), latin:m(f,EN)}; });
    return {body, out};
  });
  console.log('body stack: '+r.body);
  for(const k in r.out) console.log('  '+k.padEnd(28)+' thai='+String(r.out[k].thai).padStart(7)+'   latin='+r.out[k].latin);
  await b.close();
})();
