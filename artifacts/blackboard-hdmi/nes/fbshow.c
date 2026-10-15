/* Show a 1280x720 RGB888 raw image (or R/G/B/white test bars) on HDMI,
 * switching the output to 720p first.
 * Usage: sudo ./fbshow [image.rgb] */
#include <stdio.h>

#include "video.h"

int main(int argc, char **argv)
{
    struct video v;
    if (video_open(&v, VIDEO_1280x720)) return 1;
    if (argc > 1) {
        FILE *f = fopen(argv[1], "rb");
        if (!f) { perror(argv[1]); return 1; }
        static uint8_t line[1280 * 3];
        for (int y = 0; y < v.height; ++y) {
            if (fread(line, 3, (size_t)v.width, f) != (size_t)v.width) {
                fprintf(stderr, "short image\n");
                return 1;
            }
            for (int x = 0; x < v.width; ++x)
                v.fb[y * v.width + x] = (uint32_t)line[3 * x] << 16 |
                                        (uint32_t)line[3 * x + 1] << 8 | line[3 * x + 2];
        }
        fclose(f);
    } else {
        static const uint32_t bars[4] = { 0xFF0000, 0x00FF00, 0x0000FF, 0xFFFFFF };
        for (int y = 0; y < v.height; ++y)
            for (int x = 0; x < v.width; ++x)
                v.fb[y * v.width + x] = bars[x / (v.width / 4)];
    }
    return 0;
}
