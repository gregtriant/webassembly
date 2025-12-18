#include <emscripten/emscripten.h>
#include <cstdint>
#include <cmath>

constexpr int WIDTH  = 800;
constexpr int HEIGHT = 600;

uint8_t pixels[WIDTH * HEIGHT * 4];

// Mandelbrot parameters (dynamic)
double centerX = -0.743643887037151;
double centerY = 0.13182590420533;
double scale = 0.003;
int maxIterations = 500;

extern "C" {

// Pixel buffer
EMSCRIPTEN_KEEPALIVE
uint8_t* get_buffer() {
    return pixels;
}

EMSCRIPTEN_KEEPALIVE
int get_width() { return WIDTH; }

EMSCRIPTEN_KEEPALIVE
int get_height() { return HEIGHT; }

// Update fractal parameters from JS
EMSCRIPTEN_KEEPALIVE
void set_parameters(double cx, double cy, double s) {
    centerX = cx;
    centerY = cy;
    scale = s;
}

// Render Mandelbrot
EMSCRIPTEN_KEEPALIVE
void render() {
    for (int y = 0; y < HEIGHT; ++y) {
        for (int x = 0; x < WIDTH; ++x) {
            double re = (x - WIDTH/2.0) * (scale / WIDTH) + centerX;
            double im = (y - HEIGHT/2.0) * (scale / HEIGHT) + centerY;

            double zx = 0.0;
            double zy = 0.0;
            int iter = 0;

            while (zx*zx + zy*zy <= 4.0 && iter < maxIterations) {
                double temp = zx*zx - zy*zy + re;
                zy = 2.0*zx*zy + im;
                zx = temp;
                iter++;
            }

            int i = (y * WIDTH + x) * 4;
            uint8_t color = static_cast<uint8_t>(255.0 * iter / maxIterations);
            pixels[i+0] = color;
            pixels[i+1] = color;
            pixels[i+2] = 255 - color;
            pixels[i+3] = 255;
        }
    }
}

}
