/* Famicom on the Blackboard: 6502/PPU/APU emulated on the ARM, shown over
 * HDMI (NES picture scaled 2x), sound on the 3.5 mm jack, USB
 * keyboard as controller 1.
 * Usage: sudo ./nes [-480] game.nes   (720p by default; -480 for 640x480)
 * Esc resets the game; Ctrl+C or SIGTERM quits. famicom.service runs it
 * at boot. */
#include <signal.h>
#include <string.h>
#include <stdio.h>
#include <time.h>
#include <unistd.h>

#include "audio.h"
#include "input.h"
#include "nes.h"
#include "video.h"

#define FRAME_NS 16639267L      /* NTSC: 60.0988 Hz, used when there is no audio */
#define AUDIO_LEAD 1600         /* samples (~33 ms) kept queued for the DAC */

static volatile sig_atomic_t stop;
static void on_signal(int sig) { (void)sig; stop = 1; }

static double elapsed_ms(const struct timespec *a, const struct timespec *b)
{
    return (b->tv_sec - a->tv_sec) * 1e3 + (b->tv_nsec - a->tv_nsec) / 1e6;
}

int main(int argc, char **argv)
{
    enum video_mode mode = VIDEO_1280x720;
    if (argc > 2 && strcmp(argv[1], "-480") == 0) {
        mode = VIDEO_640x480;
        argv++;
        argc--;
    }
    if (argc < 2) { fprintf(stderr, "usage: %s [-480] game.nes\n", argv[0]); return 2; }
    if (cart_load(argv[1])) return 1;
    struct video v;
    if (video_open(&v, mode)) return 1;
    int have_audio = audio_open() == 0;
    if (!have_audio) fprintf(stderr, "no audio, continuing silently\n");
    signal(SIGINT, on_signal);
    signal(SIGTERM, on_signal);
    cart_load_save();
    nes_reset();

    struct timespec next, t0, t1, t2, last_report;
    clock_gettime(CLOCK_MONOTONIC, &next);
    last_report = next;
    double emu_ms = 0, present_ms = 0;
    int frames = 0, late = 0, reset = 0;
    while (!stop) {
        pad_buttons = input_poll(&reset);
        if (reset) {
            cart_write_save();
            nes_reset();
        }
        clock_gettime(CLOCK_MONOTONIC, &t0);
        nes_run_frame();
        audio_push(apu_samples, apu_sample_count);
        apu_sample_count = 0;
        clock_gettime(CLOCK_MONOTONIC, &t1);
        video_present_nes2x(&v, ppu_frame);
        clock_gettime(CLOCK_MONOTONIC, &t2);
        emu_ms += elapsed_ms(&t0, &t1);
        present_ms += elapsed_ms(&t1, &t2);

        if (have_audio) {
            /* The DAC's 48 kHz clock paces the machine: emulate the next
             * frame once the queue drops below the lead. */
            if (audio_queued() < AUDIO_LEAD / 2) late++;
            while (!stop && audio_queued() > AUDIO_LEAD) usleep(1000);
        } else {
            next.tv_nsec += FRAME_NS;
            if (next.tv_nsec >= 1000000000L) { next.tv_nsec -= 1000000000L; next.tv_sec++; }
            if (elapsed_ms(&next, &t2) > 0) {   /* behind schedule: resync */
                next = t2;
                late++;
            } else {
                clock_nanosleep(CLOCK_MONOTONIC, TIMER_ABSTIME, &next, NULL);
            }
        }

        if (++frames == 300) {
            double secs = elapsed_ms(&last_report, &t2) / 1e3;
            int under, queued;
            audio_stats(&under, &queued);
            printf("%.1f fps  emu %.2f ms  present %.2f ms  late %d  audio underrun %d queued %d  pad %02X\n",
                   frames / secs, emu_ms / frames, present_ms / frames, late, under, queued, pad_buttons);
            fflush(stdout);
            last_report = t2;
            frames = late = 0;
            emu_ms = present_ms = 0;
            cart_write_save();     /* every ~5 s, so a power cut loses little */
        }
    }
    cart_write_save();
    audio_close();
    video_clear(&v, 0);
    return 0;
}
