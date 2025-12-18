#!/bin/bash
set -e

# Activate Emscripten
source $EMSDK/emsdk_env.sh

# Clean and build
rm -rf build
mkdir build
cd build
cmake .. -DCMAKE_TOOLCHAIN_FILE=$EMSDK/upstream/emscripten/cmake/Modules/Platform/Emscripten.cmake
cmake --build .
cd ..

# Serve project
# emrun --no_browser --port 8080 .