# Compile
## render.cpp



## mandelbrot.cpp
```
emcc mandelbrot.cpp \
  -O3 \
  -s MODULARIZE=1 \
  -s EXPORT_ES6=1 \
  -s EXPORTED_FUNCTIONS='["_get_buffer","_get_width","_get_height","_render"]' \
  -s EXPORTED_RUNTIME_METHODS='["cwrap","HEAPU8"]' \
  -o mandelbrot.js
```