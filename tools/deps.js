/* Which names does each module USE that it does not DEFINE?
   Those are its ties to the rest of the program - the things that have to be
   untangled before it can become a component that stands on its own. */
const fs=require('fs'), path=require('path');
const DIR=path.join(__dirname,'..','src','modules');
const GLOBALS=new Set(('Math JSON Object Array String Number Boolean Date Set Map Promise '+
  'console window document navigator localStorage indexedDB requestAnimationFrame '+
  'isFinite parseFloat parseInt NaN Infinity undefined true false null Error '+
  'ResizeObserver Storage setTimeout clearTimeout encodeURIComponent').split(' '));
const KEYWORDS=new Set(('const let var function return if else for while do break continue '+
  'new typeof instanceof in of delete void try catch finally throw switch case default '+
  'class extends super this yield await async').split(' '));

const report=[];
for(const f of fs.readdirSync(DIR).filter(x=>x.endsWith('.js'))){
  const src=fs.readFileSync(path.join(DIR,f),'utf8');
  const code=src.replace(/\/\*[\s\S]*?\*\//g,' ').replace(/\/\/[^\n]*/g,' ')
                .replace(/'[^']*'|"[^"]*"|`[^`]*`/g,' ');
  const defined=new Set();
  for(const m of code.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)/g)) defined.add(m[1]);
  for(const m of code.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)) defined.add(m[1]);
  const used=new Map();
  for(const m of code.matchAll(/([A-Za-z_$][\w$]*)\s*\(/g)){
    const n=m[1];
    if(defined.has(n)||GLOBALS.has(n)||KEYWORDS.has(n)) continue;
    used.set(n,(used.get(n)||0)+1);
  }
  for(const m of code.matchAll(/\b([A-Z][A-Z0-9_]{2,})\b/g)){
    const n=m[1];
    if(defined.has(n)||GLOBALS.has(n)) continue;
    used.set(n,(used.get(n)||0)+1);
  }
  for(const n of ['store','ctx','cv','view','selIds','DB','history','fmtDraft','snapshot'])
    if(new RegExp('\\b'+n+'\\b').test(code) && !defined.has(n)) used.set(n,(used.get(n)||0)+1);
  report.push({file:f, lines:src.split('\n').length, defines:defined.size,
               needs:[...used.keys()].sort()});
}
report.sort((a,b)=>a.needs.length-b.needs.length);
console.log('module            lines  defines  outside names it needs');
console.log('─'.repeat(78));
for(const r of report)
  console.log(r.file.padEnd(17), String(r.lines).padStart(5), String(r.defines).padStart(8),
              '  '+r.needs.length+(r.needs.length?'  ['+r.needs.slice(0,7).join(' ')+
              (r.needs.length>7?' …':'')+']':''));
