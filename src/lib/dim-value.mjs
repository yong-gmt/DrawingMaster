/* ============================================================================
   DOES THE NUMBER A DRAWING PRINTS STATE THIS MEASUREMENT?
   ----------------------------------------------------------------------------
   Two places have to answer this. Recovery asks it to decide whether a pair of
   arrowheads and a piece of text are one dimension; the dimension model asks it
   to decide whether the string it was given wraps a number it may re-measure and
   re-format, or is a note it must leave alone.

   Both used to ask "are these two numbers within one percent of each other". A
   drawing does not print one percent - it prints ROUNDED. A 24.37 mm span is
   typed as "24" on plenty of real sheets, and one percent of 24 is 0.24, so the
   answer came back NO: the dimension was never recognised, STYLIZE never touched
   it, and the decimal places set in Format Config appeared to be ignored on
   exactly those dimensions whose source file had rounded hardest.

   The right question is not "how close" but "is this the measurement, printed to
   the places the string itself shows". "24" shows none, so it states any span
   that rounds to 24. "24.4" shows one, so it states 24.35 to 24.45. The string
   declares its own precision, and this reads it.

   The old window is kept as well, for the other case it was right about: a
   drawing that states a NOMINAL - a hole called 12.00 that measures 12.02 -
   still counts as stating it.
   ========================================================================== */

/* A leading repeat count is not the measurement: "2x 24" is two of something
   24 long, not something 2 long. */
const REPEAT = /^\s*\d+\s*[xX]\s*/;

/* The number a drawing's string states, or null if it states none. */
export function statedNumber(str){
  const s = String(str==null?'':str).replace(REPEAT,'');
  const m = s.match(/-?\d+(?:[.,]\d+)?/);
  if(!m) return null;
  const v = parseFloat(m[0].replace(',','.'));
  return isFinite(v) ? v : null;
}

/* How many decimal places the string shows - its own declared precision. */
export function statedDecimals(str){
  const s = String(str==null?'':str).replace(REPEAT,'');
  const m = s.match(/-?\d+(?:[.,](\d+))?/);
  return (m && m[1]) ? m[1].length : 0;
}

/* Does `str` state `measured`? A string with no number in it states nothing and
   therefore contradicts nothing. */
export function statesValue(str, measured){
  const stated = statedNumber(str);
  if(stated === null) return true;
  if(!isFinite(measured)) return false;
  const dec = statedDecimals(str);
  /* printed to the places it shows - the usual case, and exact */
  if(+Math.abs(measured).toFixed(dec) === Math.abs(stated)) return true;
  /* or a nominal, printed at full precision and a hair off the geometry */
  return Math.abs(measured - stated) <= Math.max(0.05, Math.abs(stated)*0.01);
}

/* ----------------------------------------------------------------------------
   A string that is nothing but a number, with the wrappers a drawing puts around
   one. This is for the values STYLIZE could NOT recognise as dimensions - a file
   drawn with architectural ticks instead of arrowheads, or at a scale, or in
   inches, leaves its numbers as plain text that no model owns. They still have to
   obey the decimal places the sheet is set to, so they are re-printed as they
   stand: the number is not re-measured, it is the one the file wrote.

   The wrappers are listed rather than guessed, because the cost of guessing wrong
   is turning "M8" into "M8.00" or a balloon's "1" into "1.00". Anything with a
   letter, a colon or a word in it is not a value and is left alone.
   -------------------------------------------------------------------------- */
const VALUE_PREFIX = /^(?:\s*\d+\s*[xX]\s*)?\s*(?:[⌀∅Øø]|%%[cCdD]|SR|R|±|\+-)?\s*$/;
const VALUE_SUFFIX = /^\s*(?:mm|MM|°|%%[dD])?\s*$/;

/* {before, value, after} for a string that is a bare value, else null. */
export function valueParts(str){
  const s = String(str==null?'':str);
  /* The count in "2x 24" is a number too, and it is not the one being measured -
     so it is taken off the front and put back into the wrapper afterwards. */
  const rep = REPEAT.exec(s);
  const head = rep ? rep[0] : '';
  const rest = s.slice(head.length);
  const m = /-?\d+(?:[.,]\d+)?/.exec(rest);
  if(!m) return null;
  const before = head + rest.slice(0, m.index), after = rest.slice(m.index + m[0].length);
  if(!VALUE_PREFIX.test(before) || !VALUE_SUFFIX.test(after)) return null;
  const value = parseFloat(m[0].replace(',','.'));
  if(!isFinite(value)) return null;
  return {before, value, after};
}
