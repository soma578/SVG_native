/* Play a 440 Hz tone for 3 s through the PL pdm_audio IP and count how often
 * the ping-pong buffer flips. Usage: sudo ./tone */
#include <fcntl.h>
#include <math.h>
#include <stdint.h>
#include <stdio.h>
#include <sys/mman.h>
#include <time.h>
#include <unistd.h>

#define AUDIO_BASE 0x43C20000u

static double now(void)
{
    struct timespec t;
    clock_gettime(CLOCK_MONOTONIC, &t);
    return t.tv_sec + t.tv_nsec * 1e-9;
}

int main(void)
{
    int fd = open("/dev/mem", O_RDWR | O_SYNC);
    if (fd < 0) { perror("/dev/mem"); return 1; }
    volatile uint32_t *r = mmap(NULL, 0x10000, PROT_READ | PROT_WRITE, MAP_SHARED, fd, AUDIO_BASE);
    if (r == MAP_FAILED) { perror("mmap"); return 1; }
    volatile uint32_t *left = r + 0x1000 / 4, *right = r + 0x2000 / 4;
    unsigned phase = 0;
    for (int i = 0; i < 1024; ++i) left[i] = right[i] = 32768;
    r[2] |= 0x3;                                /* interrupt enables, as Real Digital does */
    r[0] = 0x3;                                 /* speakers L+R on */
    uint32_t last = r[2] & 0x30;
    int flips = 0;
    double t0 = now();
    printf("INTR at start: %08x\n", r[2]);
    while (now() - t0 < 3.0) {
        uint32_t id = r[2] & 0x30;
        if (id != last) {
            last = id;
            ++flips;
            int half = (id & 0x10) ? 512 : 0;
            for (int i = 0; i < 512; ++i, ++phase) {
                uint32_t s = (uint32_t)(32768 + 30000 * sin(2 * M_PI * 440 * phase / 48000.0));
                left[half + i] = right[half + i] = s;
            }
        }
        usleep(1000);
    }
    r[0] = 0;
    printf("%d flips in 3 s (%.1f/s, expect 93.75 at 48 kHz)\n", flips, flips / 3.0);
    return 0;
}
