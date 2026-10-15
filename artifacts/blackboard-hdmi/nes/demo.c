/* NES-sized test screen: the 64-color NES palette as a grid plus a square
 * moved with BTN0-3. Prints frame timing once per second.
 * Usage: sudo ./demo [720]   (default 640x480) */
#include <stdio.h>
#include <string.h>
#include <time.h>

#include "video.h"

/* 2C02 palette (common emulator approximation). */
static const uint32_t nes_palette[64] = {
    0x626262, 0x001FB2, 0x2404C8, 0x5200B2, 0x730076, 0x800024, 0x730B00, 0x522800,
    0x244400, 0x005700, 0x005C00, 0x005324, 0x003C76, 0x000000, 0x000000, 0x000000,
    0xABABAB, 0x0D57FF, 0x4B30FF, 0x8A13FF, 0xBC08D6, 0xD21269, 0xC72E00, 0x9D5400,
    0x607B00, 0x209800, 0x00A300, 0x009942, 0x007DB4, 0x000000, 0x000000, 0x000000,
    0xFFFFFF, 0x53AEFF, 0x9085FF, 0xD365FF, 0xFF57FF, 0xFF5DCF, 0xFF7757, 0xFA9E00,
    0xBDC700, 0x7AE700, 0x43F611, 0x26EF7E, 0x2CD5F6, 0x4E4E4E, 0x000000, 0x000000,
    0xFFFFFF, 0xB6E1FF, 0xCED1FF, 0xE9C3FF, 0xFFBCFF, 0xFFBDF4, 0xFFC6C3, 0xFFD59A,
    0xE9E681, 0xCEF481, 0xB6FB9A, 0xA9FAC3, 0xA9F0F4, 0xB8B8B8, 0x000000, 0x000000,
};

static double now(void)
{
    struct timespec t;
    clock_gettime(CLOCK_MONOTONIC, &t);
    return t.tv_sec + t.tv_nsec * 1e-9;
}

int main(int argc, char **argv)
{
    static uint32_t frame[NES_W * NES_H];
    struct video v;
    int hd = argc > 1 && strcmp(argv[1], "720") == 0;
    if (video_open(&v, hd ? VIDEO_1280x720 : VIDEO_640x480)) return 1;
    printf("video %dx%d\n", v.width, v.height);

    int px = 120, py = 112, frames = 0;
    double t_last = now(), t_present = 0, next = now();
    for (;;) {
        for (int y = 0; y < NES_H; ++y)
            for (int x = 0; x < NES_W; ++x)
                frame[y * NES_W + x] = nes_palette[(y / 60) * 16 + x / 16];
        uint32_t b = board_buttons();
        if (b & 1) px += 2;
        if (b & 2) px -= 2;
        if (b & 4) py += 2;
        if (b & 8) py -= 2;
        px = (px + NES_W) % NES_W;
        py = (py + NES_H) % NES_H;
        for (int y = 0; y < 16; ++y)
            for (int x = 0; x < 16; ++x)
                frame[((py + y) % NES_H) * NES_W + (px + x) % NES_W] = 0xFFFFFF;

        double t0 = now();
        video_present_nes2x(&v, frame);
        t_present += now() - t0;

        next += 1.0 / 60;
        double wait = next - now();
        if (wait > 0) {
            struct timespec ts = { 0, (long)(wait * 1e9) };
            nanosleep(&ts, NULL);
        } else next = now();

        if (++frames == 60) {
            double t = now();
            printf("%.1f fps, present %.2f ms, buttons=%x switches=%03x\n",
                   frames / (t - t_last), t_present / frames * 1e3, b, board_switches());
            fflush(stdout);
            frames = 0; t_present = 0; t_last = t;
        }
    }
}
