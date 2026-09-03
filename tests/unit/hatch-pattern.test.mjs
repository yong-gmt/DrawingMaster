/* Runs in Node in milliseconds - no browser, no fixtures.
   This is what a component buys you. */
import assert from 'node:assert/strict';
import {hatchFamilies, hatchStep, hatchDashArray} from '../../src/lib/hatch-pattern.mjs';

let pass=0;
const it=(name, fn)=>{ fn(); pass++; console.log('  ok  '+name); };

console.log('hatch-pattern');

it('uses the pattern the file gives, untouched', ()=>{
  const fam={dir:[1,0], base:[5,7], off:[0,3], dashes:null};
  assert.deepEqual(hatchFamilies({fams:[fam]}), [fam]);
});

it('falls back to ANSI31 at 45 degrees when the file gives none', ()=>{
  const [f]=hatchFamilies({});
  assert.ok(Math.abs(Math.atan2(f.dir[1],f.dir[0]) - Math.PI/4) < 1e-9);
  assert.ok(Math.abs(Math.hypot(f.off[0],f.off[1]) - 3.175) < 1e-9);
});

it('applies the hatch scale only to the fallback', ()=>{
  const [f]=hatchFamilies({scale:2});
  assert.ok(Math.abs(Math.hypot(f.off[0],f.off[1]) - 6.35) < 1e-9);
});

it('splits the offset into spacing across and stagger along', ()=>{
  // lines run along x; offset goes 3 across and 1 along
  const s=hatchStep({dir:[1,0], off:[1,3]});
  assert.ok(Math.abs(s.spacing-3)<1e-9, 'spacing is the perpendicular part');
  assert.ok(Math.abs(s.shift-1)<1e-9,   'shift is the part along the line');
});

it('spacing is never negative, whichever way the offset points', ()=>{
  assert.ok(hatchStep({dir:[1,0], off:[0,-4]}).spacing > 0);
});

it('turns a DXF dash list into canvas pairs', ()=>{
  const d=hatchDashArray([3,-1.5], 1);
  assert.deepEqual(d, [3,1.5]);
});

it('puts a zero dash first when the pattern opens with a gap', ()=>{
  const d=hatchDashArray([-2,3], 1);
  assert.equal(d[0], 0, 'canvas always draws first; this keeps the phase right');
});

it('scales the dashes by k', ()=>{
  assert.deepEqual(hatchDashArray([2,-1], 3), [6,3]);
});

it('gives nothing back for a pattern that is all gaps', ()=>{
  assert.equal(hatchDashArray([-1,-2], 1), null);
});

it('pads to an even length, because canvas wants pairs', ()=>{
  assert.equal(hatchDashArray([1,-1,1], 1).length % 2, 0);
});

it('treats a dot (0) as the smallest visible mark, not as nothing', ()=>{
  assert.ok(hatchDashArray([0,-2], 1)[0] > 0);
});

console.log(pass+' passed\n');
