const {chromium}=require('../_pw');
const H=require('../harness'), APP=H.APP;
(async()=>{
  const b=await chromium.launch();
  const p=await b.newPage({viewport:{width:1500,height:950}});
  await p.goto('file://'+APP); await p.waitForTimeout(1200);
  const r=await p.evaluate(()=>{
    const c=document.createElement('canvas').getContext('2d');
    const w=f=>{ c.font=`700 40px ${f}`; return +c.measureText('TITLE OF THE DRAWING').width.toFixed(1); };
    const links=[...document.querySelectorAll('link[rel=stylesheet]')].map(l=>l.href);
    return { arial:w('Arial'), sarabun:w('Sarabun'), consolas:w('Consolas'),
             serif:w('serif'), inter:w('Inter'),
             sarabunLoaded: document.fonts? document.fonts.check('40px Sarabun') : null,
             interLoaded: document.fonts? document.fonts.check('40px Inter') : null,
             stylesheets: links };
  });
  console.log(JSON.stringify(r,null,1));
  await b.close();
})();
