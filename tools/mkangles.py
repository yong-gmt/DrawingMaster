#!/usr/bin/env python3
"""Build a sheet of angular dimensions no sample file happens to contain.

The one real example is a single 22 degree angle drawn one particular way. These
are drawn every way a CAD program might: the vertex inside and outside the
measured segments, sweeps both ways round, reflex angles, tiny and near-straight
ones, and the arc placed on either side of the vertex.
"""
import ezdxf, math

CASES = [
    # (label, first ray angle, sweep, radius, where the segments sit relative to
    #  the vertex: 'out' = the vertex lies outside both, 'in' = inside both)
    ('right angle',        0,    90,  30, 'in'),
    ('acute',             20,    35,  25, 'in'),
    ('obtuse',            10,   140,  28, 'in'),
    ('very small',        45,     7,  35, 'in'),
    ('near straight',      0,   175,  22, 'in'),
    ('reflex',            30,   240,  26, 'in'),
    ('clockwise sweep',  120,   -65,  24, 'in'),
    ('vertex outside',    15,    40,  30, 'out'),
    ('mixed ends',       200,    50,  20, 'out'),
]

def build(path):
    d = ezdxf.new('R2010', setup=True)
    msp = d.modelspace()
    for i, (label, a0, sweep, r, where) in enumerate(CASES):
        vx, vy = (i % 3) * 120.0, (i // 3) * 120.0
        A0, A1 = math.radians(a0), math.radians(a0 + sweep)
        def ray(a, near, far):
            return ((vx + far * math.cos(a), vy + far * math.sin(a)),
                    (vx + near * math.cos(a), vy + near * math.sin(a)))
        near = 0.0 if where == 'in' else 12.0
        p1, p2 = ray(A0, near, r * 1.6)
        p3, p4 = ray(A1, near, r * 1.6)
        msp.add_line(p2, p1)
        msp.add_line(p4, p3)
        mid = math.radians(a0 + sweep / 2)
        dim = msp.add_angular_dim_2l(
            base=(vx + r * math.cos(mid), vy + r * math.sin(mid)),
            line1=(p2, p1), line2=(p4, p3))
        dim.render()
        msp.add_text(label, height=3).set_placement((vx - 40, vy - 45))
    d.saveas(path)
    print('wrote', path, 'with', len(CASES), 'angular dimensions')

if __name__ == '__main__':
    build('fixtures/synthetic/angles.dxf')
