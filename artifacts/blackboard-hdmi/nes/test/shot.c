/* Headless run: emulate N frames, optionally holding buttons from a frame
 * on, then write the last frame as a binary PPM.
 * Usage: ./shot rom frames out.ppm [press_frame buttons_hex] */
#include <stdio.h>
#include <stdlib.h>
#include <time.h>

#include "../nes.h"

int main(int argc, char **argv)
{
    if (argc < 4) { fprintf(stderr, "usage: %s rom frames out.ppm [frame buttons]\n", argv[0]); return 2; }
    if (cart_load(argv[1])) return 1;
    int frames = atoi(argv[2]);
    int press_at = argc > 5 ? atoi(argv[4]) : -1;
    uint8_t press = argc > 5 ? (uint8_t)strtoul(argv[5], NULL, 16) : 0;
    nes_reset();
    struct timespec t0, t1;
    clock_gettime(CLOCK_MONOTONIC, &t0);
    for (int i = 0; i < frames; ++i) {
        pad_buttons = (press_at >= 0 && i >= press_at && i < press_at + 10) ? press : 0;
        nes_run_frame();
    }
    clock_gettime(CLOCK_MONOTONIC, &t1);
    double ms = ((t1.tv_sec - t0.tv_sec) * 1e3 + (t1.tv_nsec - t0.tv_nsec) / 1e6) / frames;
    printf("%d frames, %.2f ms/frame emulation\n", frames, ms);

    FILE *f = fopen(argv[3], "wb");
    if (!f) { perror(argv[3]); return 1; }
    fprintf(f, "P6\n%d %d\n255\n", NES_W, NES_H);
    for (int i = 0; i < NES_W * NES_H; ++i) {
        uint32_t c = ppu_frame[i];
        uint8_t rgb[3] = { (uint8_t)(c >> 16), (uint8_t)(c >> 8), (uint8_t)c };
        fwrite(rgb, 1, 3, f);
    }
    fclose(f);
    return 0;
}
