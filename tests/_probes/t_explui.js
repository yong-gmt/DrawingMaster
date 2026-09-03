const _fs=require('fs'), _p=require('path');
const OUTDIR=_p.join(require('./harness').ROOT,'tests','out');
_fs.mkdirSync(OUTDIR,{recursive:true});
/* files a test writes go here, never into the fixture folders */
function OUT(n){ return _p.join(OUTDIR, _p.basename(n)); }
const {chromium}=require('./_pw');
const fs=require('fs'), path=require('path'), {execSync}=require('child_process');
// The exploded drawing, all the way through the real interface, and then judged
// by ezdxf: did lines-and-numbers become editable DIMENSION entities again?
(async()=>{
  const b=await chromium.launch();
  const ctx=await b.newContext({viewport:{width:1400,height:900}, acceptDownloads:true});
  const page=await ctx.newPage();
  const errs=[]; page.on('pageerror',e=>errs.push(String(e).slice(0,120)));
  await page.goto('file://'+require('./harness').fixture(require('./harness').APP));
  await page.waitForTimeout(700);
  const nb=await page.$('#btnNew'); if(nb && await nb.isVisible()) await nb.click();
  else await page.evaluate(()=>window.__hook().createProject());
  await page.waitForTimeout(600);
  const sh=await page.$('text=Sheet 01'); if(sh && await sh.isVisible()) await sh.click();
  await page.waitForTimeout(500);
  await page.waitForSelector('#btnImport',{state:'visible'});
  await page.click('#btnImport');
  await page.setInputFiles('#fileInput', require('./harness').fixture('exploded.dxf'));
  await page.waitForTimeout(1600);
  await page.click('#btnStylize');
  await page.waitForTimeout(900);
  fs.writeFileSync('explui.png', await page.locator('canvas').first().screenshot());
  await page.click('#btnExport'); await page.waitForTimeout(400);
  const dl=page.waitForEvent('download',{timeout:15000});
  const it=await page.$('[data-x="dxf"]'); if(it) await it.click();
  const d=await dl; await d.saveAs(OUT('explui.dxf'));
  console.log('javascript errors:', errs.length, errs.slice(0,2));
  console.log(execSync(`python3 - <<'PY'
import ezdxf, json, collections
truth=sorted(tuple(x) for x in json.load(open('exploded_truth.json')))
src=ezdxf.readfile('exploded.dxf')
N=ezdxf.readfile('explui.dxf')
print('the drawing that went IN  :',
      dict(collections.Counter(e.dxftype() for e in src.modelspace())))
def dims(d):
    out=[]
    for e in d.modelspace():
        if e.dxftype()!='DIMENSION': continue
        v=getattr(e.dxf,'actual_measurement',None)
        if v is None: v=e.get_measurement()
        out.append(((e.dimtype & 15), round(float(v),2)))
    return sorted(out)
got=dims(N)
print('DIMENSION entities in       : 0')
print('DIMENSION entities out      :', len(got), 'of', len(truth), 'in the original drawing')
print('measurements identical      :', got==truth)
if got!=truth:
    a,b=collections.Counter(truth),collections.Counter(got)
    print('  missing:', list((a-b).elements()), ' extra:', list((b-a).elements()))
print('values pinned as fixed text :',
      sum(1 for e in N.modelspace() if e.dxftype()=='DIMENSION' and '<>' not in e.dxf.text))
PY`).toString().trim());
  await b.close();
})();
