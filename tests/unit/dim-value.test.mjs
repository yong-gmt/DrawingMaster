/* Runs in Node in milliseconds - no browser, no fixtures. */
import assert from 'node:assert/strict';
import {statedNumber, statedDecimals, statesValue, valueParts} from '../../src/lib/dim-value.mjs';

let pass=0;
const it=(name, fn)=>{ fn(); pass++; console.log('  ok  '+name); };

console.log('dim-value');

it('reads the number a string states', ()=>{
  assert.equal(statedNumber('24'), 24);
  assert.equal(statedNumber('24.37'), 24.37);
  assert.equal(statedNumber('24,37'), 24.37);       // a comma decimal
  assert.equal(statedNumber('R12.5'), 12.5);
  assert.equal(statedNumber('SEE NOTE'), null);
  assert.equal(statedNumber(''), null);
  assert.equal(statedNumber(null), null);
});

it('a leading repeat count is not the measurement', ()=>{
  assert.equal(statedNumber('2x 24'), 24);
  assert.equal(statedNumber('4X 6.5'), 6.5);
});

it('reads the precision the string declares', ()=>{
  assert.equal(statedDecimals('24'), 0);
  assert.equal(statedDecimals('24.4'), 1);
  assert.equal(statedDecimals('24.370'), 3);
  assert.equal(statedDecimals('2x 24.37'), 2);
  assert.equal(statedDecimals('SEE NOTE'), 0);
});

/* The bug this file exists for: a drawing prints its numbers rounded. */
it('a whole number states any span that rounds to it', ()=>{
  assert.equal(statesValue('24', 24.37), true);     // 0.37 out - the old 1% said no
  assert.equal(statesValue('24', 23.6), true);
  assert.equal(statesValue('24', 24.49), true);
  assert.equal(statesValue('24', 24.51), false);    // rounds to 25, not 24
  assert.equal(statesValue('24', 23.4), false);
});

it('a string with decimals states only what it shows', ()=>{
  assert.equal(statesValue('24.4', 24.37), true);
  assert.equal(statesValue('24.4', 24.44), true);
  assert.equal(statesValue('24.4', 24.9), false);
  assert.equal(statesValue('24.37', 24.37), true);
});

it('a nominal printed at full precision still counts', ()=>{
  assert.equal(statesValue('12.00', 12.02), true);  // within the old window
  assert.equal(statesValue('12.00', 12.9), false);
});

it('the wrapper around the number does not change the answer', ()=>{
  assert.equal(statesValue('2x 24', 24.37), true);
  assert.equal(statesValue('R12', 12.3), true);
  assert.equal(statesValue('⌀8', 8.2), true);
});

it('a note states nothing, so it contradicts nothing', ()=>{
  assert.equal(statesValue('SEE NOTE', 24.37), true);
  assert.equal(statesValue('', 24.37), true);
});

/* The old one-percent window is kept, not replaced - it is the right answer for a
   nominal printed at full precision. On a big number it is the wider of the two
   rules, and it stays as wide as it always was: this records that, so that
   tightening it later is a decision somebody makes on purpose. */
it('the old one-percent window is still there underneath', ()=>{
  assert.equal(statesValue('1200', 1200.4), true);  // rounding says yes
  assert.equal(statesValue('1200', 1204), true);    // rounding says no, one percent says yes
  assert.equal(statesValue('1200', 1220), false);   // past both
});

const parts=s=>{ const p=valueParts(s); return p? p.before+'|'+p.value+'|'+p.after : null; };

it('picks out a bare value and the wrapper around it', ()=>{
  assert.equal(parts('24'), '|24|');
  assert.equal(parts('24.37'), '|24.37|');
  assert.equal(parts('24,37'), '|24.37|');          // a comma decimal
  assert.equal(parts('2x 24'), '2x |24|');
  assert.equal(parts('R12'), 'R|12|');
  assert.equal(parts('⌀8'), '⌀|8|');
  assert.equal(parts('24 mm'), '|24| mm');
  assert.equal(parts('-3.5'), '|-3.5|');
});

it('leaves alone anything that is not just a value', ()=>{
  assert.equal(valueParts('M8'), null);             // a thread, not a measurement
  assert.equal(valueParts('4 HOLES'), null);
  assert.equal(valueParts('1:1'), null);            // a scale
  assert.equal(valueParts('SEE NOTE 3'), null);
  assert.equal(valueParts('A'), null);
  assert.equal(valueParts(''), null);
});

console.log(pass+' passed');
