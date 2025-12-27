#include <emscripten.h>
#include <emscripten/html5.h>
#include <vector>

struct Pixel { uint8_t r, g, b, a; };
std::vector<Pixel> pixels;
int width = 0;
int height = 0;

extern "C" {

EMSCRIPTEN_KEEPALIVE
void resize(int w, int h) {
    width = w;
    height = h;
    pixels.resize(width * height, {255, 255, 255, 255});
}

EMSCRIPTEN_KEEPALIVE
void clear() {
    for(auto &p : pixels) p = {255, 255, 255, 255};
}

EMSCRIPTEN_KEEPALIVE
void set_pixel(int x, int y, int r, int g, int b) {
    if(x < 0 || x >= width || y < 0 || y >= height) return;
    pixels[y * width + x] = {uint8_t(r), uint8_t(g), uint8_t(b), 255};
}

EMSCRIPTEN_KEEPALIVE
void draw_line(int x0, int y0, int x1, int y1, int r, int g, int b) {
    // Bresenham's line algorithm
    int dx = abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    int dy = -abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    int err = dx + dy, e2;
    while(true) {
        set_pixel(x0, y0, r, g, b);
        if(x0 == x1 && y0 == y1) break;
        e2 = 2 * err;
        if(e2 >= dy) { err += dy; x0 += sx; }
        if(e2 <= dx) { err += dx; y0 += sy; }
    }
}

EMSCRIPTEN_KEEPALIVE
void render() {
    EM_ASM({
        const canvas = document.getElementById('cpp-canvas');
        const ctx = canvas.getContext('2d');
        const w = $0;
        const h = $1;
        const pixelsPtr = $2;
        const memory = Module.HEAPU8;

        const image = ctx.createImageData(w, h);
        const data = image.data;

        for(let i=0;i<w*h;i++){
            data[i*4+0] = memory[pixelsPtr + i*4 + 0];
            data[i*4+1] = memory[pixelsPtr + i*4 + 1];
            data[i*4+2] = memory[pixelsPtr + i*4 + 2];
            data[i*4+3] = memory[pixelsPtr + i*4 + 3];
        }
        ctx.putImageData(image, 0, 0);
    }, width, height, (int)pixels.data());
}

}