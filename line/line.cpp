#include <emscripten/emscripten.h>
#include <cstdint>
#include <vector>
#include <cmath>

constexpr int WIDTH  = 800;
constexpr int HEIGHT = 600;

uint8_t pixels[WIDTH * HEIGHT * 4];

// Line class
class Line {
public:
    double x1, y1, x2, y2;
    int width;

    Line(double nx1, double ny1, double nx2, double ny2, int w=1)
        : x1(nx1), y1(ny1), x2(nx2), y2(ny2), width(w) {}

    void render(uint8_t* buf) {
        // Bresenham line with thickness
        int ix1 = static_cast<int>(x1);
        int iy1 = static_cast<int>(y1);
        int ix2 = static_cast<int>(x2);
        int iy2 = static_cast<int>(y2);

        int dx = std::abs(ix2 - ix1);
        int dy = std::abs(iy2 - iy1);
        int sx = ix1 < ix2 ? 1 : -1;
        int sy = iy1 < iy2 ? 1 : -1;
        int err = dx - dy;

        int x = ix1;
        int y = iy1;

        while (true) {
            for (int wx = -width/2; wx <= width/2; ++wx) {
                for (int wy = -width/2; wy <= width/2; ++wy) {
                    int px = x + wx;
                    int py = y + wy;
                    if (px >=0 && px < WIDTH && py >=0 && py < HEIGHT) {
                        int i = (py * WIDTH + px) * 4;
                        buf[i+0] = 0;
                        buf[i+1] = 0;
                        buf[i+2] = 0;
                        buf[i+3] = 255;
                    }
                }
            }

            if (x == ix2 && y == iy2) break;
            int e2 = 2*err;
            if (e2 > -dy) { err -= dy; x += sx; }
            if (e2 < dx)  { err += dx; y += sy; }
        }
    }
};

// Collection of lines
std::vector<Line> lines;

extern "C" {

// Pixel buffer
EMSCRIPTEN_KEEPALIVE
uint8_t* get_buffer() { return pixels; }

EMSCRIPTEN_KEEPALIVE
int get_width() { return WIDTH; }

EMSCRIPTEN_KEEPALIVE
int get_height() { return HEIGHT; }

// Add a new line
EMSCRIPTEN_KEEPALIVE
int add_line(double x1, double y1, double x2, double y2, int width) {
    lines.emplace_back(x1,y1,x2,y2,width);
    return lines.size() - 1; // return index
}

// Update line points
EMSCRIPTEN_KEEPALIVE
void set_line_points(int idx, double nx1, double ny1, double nx2, double ny2) {
    if (idx >=0 && idx < lines.size()) {
        lines[idx].x1 = nx1;
        lines[idx].y1 = ny1;
        lines[idx].x2 = nx2;
        lines[idx].y2 = ny2;
    }
}

// Update line width
EMSCRIPTEN_KEEPALIVE
void set_line_width(int idx, int w) {
    if (idx >=0 && idx < lines.size() && w > 0) lines[idx].width = w;
}

// Render all lines
EMSCRIPTEN_KEEPALIVE
void render() {
    // Clear canvas
    for (int i = 0; i < WIDTH*HEIGHT*4; ++i) pixels[i] = 255;

    for (auto& line : lines) {
        line.render(pixels);
    }
}

}
