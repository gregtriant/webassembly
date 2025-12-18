#include <emscripten/emscripten.h>
#include <cstdint>

constexpr int WIDTH  = 600;
constexpr int HEIGHT = 400;

uint8_t pixels[WIDTH * HEIGHT * 4];
int frame_counter = 0;

extern "C" {

EMSCRIPTEN_KEEPALIVE
uint8_t* get_buffer() {
    return pixels;
}

EMSCRIPTEN_KEEPALIVE
int get_width() {
    return WIDTH;
}

EMSCRIPTEN_KEEPALIVE
int get_height() {
    return HEIGHT;
}

EMSCRIPTEN_KEEPALIVE
void render() {
    frame_counter++;
    for (int y = 0; y < HEIGHT; ++y) {
        for (int x = 0; x < WIDTH; ++x) {
            int i = (y * WIDTH + x) * 4;
            pixels[i + 0] = (x + frame_counter) % 256; // R
            pixels[i + 1] = (y + frame_counter) % 256; // G
            pixels[i + 2] = 128;                        // B
            pixels[i + 3] = 255;                        // A
        }
    }
}

}