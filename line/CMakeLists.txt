cmake_minimum_required(VERSION 3.13)
project(LineEditor)

# Tell CMake to use Emscripten
if(NOT CMAKE_TOOLCHAIN_FILE)
    set(CMAKE_TOOLCHAIN_FILE $ENV{EMSDK}/upstream/emscripten/cmake/Modules/Platform/Emscripten.cmake)
endif()

set(SRC line.cpp)

# Output name
set(OUTPUT line.js)

add_executable(line ${SRC})

# Emscripten flags
set_target_properties(line PROPERTIES
    LINK_FLAGS "-O3 -s MODULARIZE=1 -s EXPORT_ES6=1 \
    -s EXPORTED_FUNCTIONS='[\"_get_buffer\",\"_get_width\",\"_get_height\",\"_render\",\"_add_line\",\"_set_line_points\",\"_set_line_width\"]' \
    -s EXPORTED_RUNTIME_METHODS='[\"cwrap\",\"HEAPU8\"]'"
    OUTPUT_NAME "line"
)
