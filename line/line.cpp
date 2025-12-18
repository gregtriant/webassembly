#include <emscripten/emscripten.h>
#include <cstdint>
#include <cmath>

constexpr int WIDTH  = 800;
constexpr int HEIGHT = 600;

uint8_t pixels[WIDTH * HEIGHT * 4];

// Line points
double line_x1 = 100, line_y1 = 100;
double line_x2 = 700, line_y2 = 500;
int line_width = 1;


extern "C" {

EMSCRIPTEN_KEEPALIVE
uint8_t* get_buffer() { return pixels; }

EMSCRIPTEN_KEEPALIVE
int get_width() { return WIDTH; }

EMSCRIPTEN_KEEPALIVE
int get_height() { return HEIGHT; }

// Update line points
EMSCRIPTEN_KEEPALIVE
void set_points(double nx1, double ny1, double nx2, double ny2) {
    line_x1 = nx1;
    line_y1 = ny1;
    line_x2 = nx2;
    line_y2 = ny2;
}

// Update line width
EMSCRIPTEN_KEEPALIVE
void set_line_width(int w) {
    if (w > 0) line_width = w;
}

// Render line using Bresenham
EMSCRIPTEN_KEEPALIVE
void render() {
    // Clear canvas
    for (int i = 0; i < WIDTH*HEIGHT*4; ++i) pixels[i] = 255; // white

    int ix1 = static_cast<int>(line_x1);
    int iy1 = static_cast<int>(line_y1);
    int ix2 = static_cast<int>(line_x2);
    int iy2 = static_cast<int>(line_y2);


    int dx = std::abs(ix2 - ix1);
    int dy = std::abs(iy2 - iy1);
    int sx = ix1 < ix2 ? 1 : -1;
    int sy = iy1 < iy2 ? 1 : -1;
    int err = dx - dy;

    int x = ix1;
    int y = iy1;

    while (true) {
        // Draw thicker line
        for (int wx = -line_width/2; wx <= line_width/2; ++wx) {
            for (int wy = -line_width/2; wy <= line_width/2; ++wy) {
                int px = x + wx;
                int py = y + wy;
                if (px >= 0 && px < WIDTH && py >=0 && py < HEIGHT) {
                    int i = (py * WIDTH + px) * 4;
                    pixels[i+0] = 0;
                    pixels[i+1] = 0;
                    pixels[i+2] = 0;
                    pixels[i+3] = 255;
                }
            }
        }

        if (x == ix2 && y == iy2) break;
        int e2 = 2*err;
        if (e2 > -dy) { err -= dy; x += sx; }
        if (e2 < dx)  { err += dx; y += sy; }
    }
}

}
