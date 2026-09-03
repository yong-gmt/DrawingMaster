/* ============================================================================
   §8  HATCH PATTERN ENGINE
   ----------------------------------------------------------------------------
   A hatch pattern is not "some lines across the shape". DXF gives each pattern
   definition line four things (groups 53/43-44/45-46/49) and all four matter:

     angle      the direction the lines run
     base       a point the family passes through - in WORLD coordinates
     offset     the vector from one line to the NEXT one, also in world
                coordinates. Its perpendicular part is the spacing; its part
                ALONG the line shifts each successive line, which is what makes
                brick and dashed patterns line up the way they do.
     dashes     the dash/gap sequence (positive = dash, negative = gap, 0 = dot)

   The old renderer used only the angle and |offset|, laid the lines out from the
   centre of each shape's bounding box, and ignored the dashes entirely.

   The pattern maths now lives in src/lib/hatch-pattern.js as a real module with
   its own unit tests; the build inlines it above this point. What is left here is
   the part that needs a canvas.
   ========================================================================== */
