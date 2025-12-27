#!/bin/bash
set -e

rm -rf ./render.js ./render.wasm

emcc render.cpp \
  -O3 \
  -s WASM=1 \
  -s MODULARIZE=1 \
  -s EXPORT_ES6=1 \
  -s ENVIRONMENT=web \
  -s EXPORTED_FUNCTIONS='["_resize","_resize_preserve","_clear","_get_pixels","_draw_line","_draw_filled_circle"]' \
  -s EXPORTED_RUNTIME_METHODS='["cwrap","HEAPU8"]' \
  -o render.js

