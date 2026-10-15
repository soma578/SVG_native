/* Famicom on the Blackboard: 6502/PPU emulated on the ARM, shown over HDMI
 * at 640x480 (NES picture scaled 2x), USB keyboard as controller 1.
 * Usage: sudo ./nes game.nes */
#include <signal.h>
#include <stdio.h>
#include <time.h>

#include "input.h"
#include "nes.h"
#include "video.h"

#define FRAME_NS 16639267L      /* NTSC: 60.0988 Hz */

static volatile sig_atomic_t stop;
static void on_signal(int sig) { (void)sig; stop = 1; }

static double elapsed_ms(const struct timespec *a, const struct timespec *b)
{
    return (b->tv_sec - a->tv_sec) * 1e3 + (b->tv_nsec - a->tv_nsec) / 1e6;
}

int main(int argc, char **argv)
{
    if (argc < 2) { fprintf(stderr, "usage: %s game.nes\n", argv[0]); return 2; }
    if (cart_load(argv[1])) return 1;
    struct video v;
    if (video_open(&v, VIDEO_640x480)) return 1;
    signal(SIGINT, on_signal);
    signal(SIGTERM, on_signal);
    nes_reset();

    struct timespec next, t0, t1, t2, last_report;
    clock_gettime(CLOCK_MONOTONIC, &next);
    last_report = next;
    double emu_ms = 0, present_ms = 0;
    int frames = 0, late = 0, quit = 0;
    while (!stop && !quit) {
        pad_buttons = input_poll(&quit);
        clock_gettime(CLOCK_MONOTONIC, &t0);
        nes_run_frame();
        clock_gettime(CLOCK_MONOTONIC, &t1);
        video_present_nes2x(&v, ppu_frame);
        clock_gettime(CLOCK_MONOTONIC, &t2);
        emu_ms += elapsed_ms(&t0, &t1);
        present_ms += elapsed_ms(&t1, &t2);

        next.tv_nsec += FRAME_NS;
        if (next.tv_nsec >= 1000000000L) { next.tv_nsec -= 1000000000L; next.tv_sec++; }
        if (elapsed_ms(&next, &t2) > 0) {   /* behind schedule: resync */
            next = t2;
            late++;
        } else {
            clock_nanosleep(CLOCK_MONOTONIC, TIMER_ABSTIME, &next, NULL);
        }

        if (++frames == 300) {
            double secs = elapsed_ms(&last_report, &t2) / 1e3;
            printf("%.1f fps  emu %.2f ms  present %.2f ms  late %d  pad %02X\n",
                   frames / secs, emu_ms / frames, present_ms / frames, late, pad_buttons);
            fflush(stdout);
            last_report = t2;
            frames = late = 0;
            emu_ms = present_ms = 0;
        }
    }
    video_clear(&v, 0);
    return 0;
}
