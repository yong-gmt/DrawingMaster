# Shipped builds

`DM_AX_artwork.html` is the build as it stood when this folder was packed. The one
to use is `drawing-master/DrawingMaster.html`, assembled from source:

```bash
python3 scripts/build.py && python3 scripts/artwork.py
```

Earlier builds from the development session are not kept: the source and the tests
are the record, and a folder of near-identical HTML files is only a way to open the
wrong one by mistake. Every build prints its stamp to the console and leaves it on
`window.__build`, so there is never any doubt which file is open.
