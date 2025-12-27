#include <emscripten.h>
#include <vector>
#include <cstdint>
#include <algorithm>
#include <cmath> 

extern "C" {

uint8_t* pixels = nullptr;
int width = 0;
int height = 0;

EMSCRIPTEN_KEEPALIVE
void resize(int w, int h) {
    width = w;
    height = h;
    if (pixels) delete[] pixels;
    pixels = new uint8_t[w * h * 4]; // RGBA
    for(int i=0;i<w*h*4;i++) pixels[i]=255; // white background
}

// Resize while preserving a region of the old content
EMSCRIPTEN_KEEPALIVE
void resize_preserve(int newW, int newH, int srcX, int srcY, int srcW, int srcH) {
    // Save old data
    uint8_t* oldPixels = pixels;
    int oldWidth = width;
    int oldHeight = height;
    
    // Create new buffer
    width = newW;
    height = newH;
    pixels = new uint8_t[newW * newH * 4];
    
    // Fill with white background
    for(int i = 0; i < newW * newH * 4; i++) pixels[i] = 255;
    
    // Copy preserved region if old data exists
    if (oldPixels) {
        for (int y = 0; y < srcH && y < newH; y++) {
            for (int x = 0; x < srcW && x < newW; x++) {
                int oldX = srcX + x;
                int oldY = srcY + y;
                if (oldX >= 0 && oldX < oldWidth && oldY >= 0 && oldY < oldHeight) {
                    int oldIdx = (oldY * oldWidth + oldX) * 4;
                    int newIdx = (y * newW + x) * 4;
                    pixels[newIdx] = oldPixels[oldIdx];
                    pixels[newIdx + 1] = oldPixels[oldIdx + 1];
                    pixels[newIdx + 2] = oldPixels[oldIdx + 2];
                    pixels[newIdx + 3] = oldPixels[oldIdx + 3];
                }
            }
        }
        delete[] oldPixels;
    }
}

EMSCRIPTEN_KEEPALIVE
void clear() {
    for(int i=0;i<width*height*4;i++) pixels[i]=255;
}

EMSCRIPTEN_KEEPALIVE
uint8_t* get_pixels() {
    return pixels;
}

EMSCRIPTEN_KEEPALIVE
void get_dimensions(int* w, int* h){
    *w = width;
    *h = height;
}

EMSCRIPTEN_KEEPALIVE
void render() {
    // no-op: JS draws directly from pixels
}

// Helper to set a pixel safely
static inline void set_pixel(int x, int y, uint8_t r, uint8_t g, uint8_t b, uint8_t a) {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    int idx = (y * width + x) * 4;
    pixels[idx + 0] = r;
    pixels[idx + 1] = g;
    pixels[idx + 2] = b;
    pixels[idx + 3] = a;
}

// Draw a filled circle (simple brush) - eraseFlag = 1 uses white background
EMSCRIPTEN_KEEPALIVE
void draw_filled_circle(int cx, int cy, int radius, int r, int g, int b, int a, int eraseFlag) {
    if (radius <= 0) {
        if (eraseFlag) set_pixel(cx, cy, 255, 255, 255, 255);
        else set_pixel(cx, cy, r, g, b, a);
        return;
    }
    int rr = radius * radius;
    int y0 = std::max(0, cy - radius);
    int y1 = std::min(height - 1, cy + radius);
    for (int y = y0; y <= y1; ++y) {
        int dy = y - cy;
        int dx = (int)std::floor(std::sqrt((double)rr - dy * dy));
        int x0 = std::max(0, cx - dx);
        int x1 = std::min(width - 1, cx + dx);
        for (int x = x0; x <= x1; ++x) {
            if (eraseFlag) set_pixel(x, y, 255, 255, 255, 255);
            else set_pixel(x, y, (uint8_t)r, (uint8_t)g, (uint8_t)b, (uint8_t)a);
        }
    }
}

// Simple line rasterization which samples points along the line and stamps a filled circle
EMSCRIPTEN_KEEPALIVE
void draw_line(int x0, int y0, int x1, int y1, int r, int g, int b, int a, int thickness, int eraseFlag) {
    int dx = abs(x1 - x0);
    int dy = abs(y1 - y0);
    // sample more densely to avoid gaps at high speeds
    int steps = std::max(dx, dy) * 2 + 1;
    int radius = thickness / 2;
    if (radius < 1) radius = 1;
    for (int i = 0; i < steps; ++i) {
        float t = steps == 1 ? 0.0f : (float)i / (float)(steps - 1);
        int x = (int)std::round(x0 + (x1 - x0) * t);
        int y = (int)std::round(y0 + (y1 - y0) * t);
        draw_filled_circle(x, y, radius, r, g, b, a, eraseFlag);
    }
}

} // extern "C"
