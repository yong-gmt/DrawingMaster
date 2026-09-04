/* Playwright is a dev dependency; fall back to a global install so the suite
   still runs on a machine where only the global copy exists. */
let chromium;
try { ({chromium} = require('playwright')); }
catch(e){ ({chromium} = require(process.env.PLAYWRIGHT_PATH ||
  '/home/claude/.npm-global/lib/node_modules/playwright')); }
const fs=require('fs'), path=require('path');

const ROOT = path.resolve(__dirname, '..');
/* a test can point at another build to compare against - useful for asking
   "was this broken before my change?" without editing every test */
const APP  = process.env.DM_APP || path.join(ROOT, 'drawing-master', 'DrawingMaster.html');
/* Tests name a drawing; the harness knows where drawings are kept. */
function fixture(name){
  for(const dir of ['fixtures/drawings','fixtures/synthetic','drawing-master','.']){
    const p=path.join(ROOT, dir, name);
    if(fs.existsSync(p)) return p;
  }
  return path.resolve(name);
}

async function open(file){
  file = (!file || /DrawingMaster/.test(file)) ? APP : fixture(file);
  const b=await chromium.launch();
  const pg=await b.newPage({viewport:{width:1400,height:900}});
  pg.on('console',m=>{ if(m.type()==='error') console.log('  [console.error]',m.text().slice(0,200)); });
  pg.on('pageerror',e=>console.log('  [pageerror]',String(e).slice(0,300)));
  await pg.goto('file://'+path.resolve(file));
  await pg.waitForFunction(()=>!!window.__hook, null, {timeout:15000});
  await pg.evaluate(()=>{ const h=window.__hook(); h.createProject();
    const sh=h.store.pages.find(p=>p.type==='sheet'); if(sh) h.store.activeId=sh.id; h.render(); });
  await pg.waitForTimeout(300);
  return {b,pg};
}
async function loadDxf(pg, dxf){
  const text=fs.readFileSync(fixture(dxf),'utf8');
  await pg.evaluate(t=>{ const h=window.__hook(); h.loadDXFText(t,'test.dxf'); }, text);
  await pg.waitForTimeout(300);
}
/* The toolbar button offers a choice now - a balloon or a partition line - so
   adding one is two clicks, not one. Tests ask for the thing, not the clicks. */
async function addSpecial(pg, what){
  await pg.click('#btnSpecial');
  await pg.waitForSelector('#specialMenu [data-x="'+what+'"]', {state:'visible'});
  await pg.click('#specialMenu [data-x="'+what+'"]');
}
const addBalloon=(pg)=>addSpecial(pg,'balloon');
const addPartition=(pg)=>addSpecial(pg,'partition');
module.exports={open, loadDxf, fixture, APP, ROOT, addSpecial, addBalloon, addPartition};
