/* Headless run: emulate N frames, optionally holding buttons for 10 frames
 * from a given frame, then write the last frame as a binary PPM and all the
 * sound as <out>.wav (48 kHz mono).
 * Usage: ./shot rom frames out.ppm [press_frame buttons_hex] */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#include "../nes.h"

static void put32(uint8_t *p, uint32_t v) { p[0] = v; p[1] = v >> 8; p[2] = v >> 16; p[3] = v >> 24; }

static void write_wav_header(FILE *f, uint32_t data_bytes)
{
    uint8_t h[44];
    memcpy(h, "RIFF\0\0\0\0WAVEfmt \x10\0\0\0\x01\0\x01\0", 24);
    put32(h + 4, 36 + data_bytes);
    put32(h + 24, APU_SAMPLE_RATE);
    put32(h + 28, APU_SAMPLE_RATE * 2);
    h[32] = 2; h[33] = 0; h[34] = 16; h[35] = 0;
    memcpy(h + 36, "data", 4);
    put32(h + 40, data_bytes);
    fseek(f, 0, SEEK_SET);
    fwrite(h, 1, sizeof h, f);
}

int main(int argc, char **argv)
{
    if (argc < 4) { fprintf(stderr, "usage: %s rom frames out.ppm [frame buttons]\n", argv[0]); return 2; }
    if (cart_load(argv[1])) return 1;
    int frames = atoi(argv[2]);
    int press_at = argc > 5 ? atoi(argv[4]) : -1;
    uint8_t press = argc > 5 ? (uint8_t)strtoul(argv[5], NULL, 16) : 0;
    nes_reset();
    char wav_path[4096];
    snprintf(wav_path, sizeof wav_path, "%s.wav", argv[3]);
    FILE *wav = fopen(wav_path, "wb");
    if (!wav) { perror(wav_path); return 1; }
    fseek(wav, 44, SEEK_SET);
    uint32_t wav_bytes = 0;
    struct timespec t0, t1;
    clock_gettime(CLOCK_MONOTONIC, &t0);
    for (int i = 0; i < frames; ++i) {
        pad_buttons = (press_at >= 0 && i >= press_at && i < press_at + 10) ? press : 0;
        nes_run_frame();
        fwrite(apu_samples, 2, (size_t)apu_sample_count, wav);
        wav_bytes += (uint32_t)apu_sample_count * 2;
        apu_sample_count = 0;
    }
    write_wav_header(wav, wav_bytes);
    fclose(wav);
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
