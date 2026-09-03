#!/usr/bin/env python3
"""Make a drawing that states its dimensions only as lines, arrowheads and text.

A DIMENSION entity draws itself from a block; the block's contents are already in
world coordinates. Copying those contents into the drawing and deleting the
DIMENSION leaves exactly what a flattened export looks like.

virtual_entities() was tried first and silently produced nothing for two of the
three files - so the "exploded" drawings had no dimension geometry at all, and a
test against them measured nothing. Errors are raised here rather than swallowed.
"""
import sys, json, ezdxf

def explode(src, dst, truth_path):
    d = ezdxf.readfile(src)
    msp = d.modelspace()
    dims = [e for e in msp if e.dxftype() == 'DIMENSION']
    truth, copied = [], 0
    for e in dims:
        v = getattr(e.dxf, 'actual_measurement', None)
        if v is None:
            try: v = e.get_measurement()
            except Exception: v = None
        if v is not None:
            try: truth.append(round(abs(float(v)), 2))
            except Exception: pass
        name = e.dxf.get('geometry', None)
        if name and name in d.blocks:
            for part in d.blocks[name]:
                # POINT and INSERT are scaffolding a dimension block carries -
                # definition points and the like. A program that flattens a drawing
                # writes the visible geometry, so copying the scaffolding as well
                # would be testing against something no file looks like.
                if part.dxftype() in ('POINT', 'INSERT'):
                    continue
                # same document, so the entity is rebuilt from its own attributes
                # rather than "imported" - add_foreign_entity refuses a local one
                msp.add_entity(part.copy())
                copied += 1
        msp.delete_entity(e)
    if dims and not copied:
        raise SystemExit(f'{src}: {len(dims)} dimensions but nothing was copied - '
                         'the geometry blocks were not found, so this file would '
                         'test nothing')
    d.saveas(dst)
    json.dump(sorted(truth), open(truth_path, 'w'))
    print(f'{src}: {len(dims)} dimension(s) -> {copied} pieces of geometry')

if __name__ == '__main__':
    explode(sys.argv[1], sys.argv[2], sys.argv[3])
