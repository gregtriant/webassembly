#!/bin/bash
set -e

if [ ! -d "build" ]; then
    mkdir build
fi

BUILD_TYPE=Debug # Change to Release later if needed

cmake -S . -B build -DCMAKE_BUILD_TYPE=$BUILD_TYPE
cmake --build build -j$(nproc)
./build/wx_test
