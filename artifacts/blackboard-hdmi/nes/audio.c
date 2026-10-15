#include "audio.h"

#include <fcntl.h>
#include <pthread.h>
#include <sched.h>
#include <stdio.h>
#include <sys/mman.h>
#include <unistd.h>

#define AUDIO_BASE   0x43C20000u
#define REG_CTRL     (0x00 / 4)
#define REG_INTR     (0x08 / 4)
#define SPKL_BUF     (0x1000 / 4)
#define SPKR_BUF     (0x2000 / 4)
#define HALF         512
#define RING         8192           /* power of two */
#define TARGET_FILL  1600           /* ~33 ms queued ahead of the hardware */

static volatile uint32_t *regs;
static int16_t ring[RING];
static volatile unsigned ring_head, ring_tail;  /* head: producer, tail: consumer */
static volatile int running;
static pthread_t thread;
static int16_t last_sample;
static volatile int underruns;

static unsigned ring_fill(void) { return (ring_head - ring_tail) & (RING - 1); }

static void fill_half(int half)
{
    volatile uint32_t *l = regs + SPKL_BUF + half * HALF;
    volatile uint32_t *r = regs + SPKR_BUF + half * HALF;
    unsigned fill = ring_fill();
    /* Too much queued (emulator ran ahead): skip a sample to catch up. */
    if (fill > TARGET_FILL * 2) ring_tail = (ring_tail + 1) & (RING - 1);
    for (int i = 0; i < HALF; ++i) {
        if (ring_fill()) {          /* on underrun, hold the last level */
            last_sample = ring[ring_tail];
            __sync_synchronize();
            ring_tail = (ring_tail + 1) & (RING - 1);
        } else {
            underruns++;
        }
        uint32_t v = (uint32_t)(last_sample + 32768);
        l[i] = v;
        r[i] = v;
    }
}

static void *audio_thread(void *arg)
{
    (void)arg;
    uint32_t last = regs[REG_INTR] & 0x10;
    while (running) {
        uint32_t id = regs[REG_INTR] & 0x10;
        if (id != last) {
            last = id;
            fill_half(id ? 1 : 0);
        }
        usleep(1000);
    }
    return NULL;
}

int audio_open(void)
{
    int fd = open("/dev/mem", O_RDWR | O_SYNC);
    if (fd < 0) { perror("/dev/mem"); return -1; }
    regs = mmap(NULL, 0x10000, PROT_READ | PROT_WRITE, MAP_SHARED, fd, AUDIO_BASE);
    if (regs == MAP_FAILED) { perror("mmap audio"); return -1; }
    for (int i = 0; i < 2 * HALF; ++i) regs[SPKL_BUF + i] = regs[SPKR_BUF + i] = 32768;
    regs[REG_INTR] |= 0x3;          /* as Real Digital's driver does */
    regs[REG_CTRL] = 0x3;           /* left and right speakers on */

    running = 1;
    pthread_attr_t attr;
    struct sched_param prio = { .sched_priority = 50 };
    pthread_attr_init(&attr);
    pthread_attr_setinheritsched(&attr, PTHREAD_EXPLICIT_SCHED);
    pthread_attr_setschedpolicy(&attr, SCHED_FIFO);
    pthread_attr_setschedparam(&attr, &prio);
    if (pthread_create(&thread, &attr, audio_thread, NULL) != 0 &&
        pthread_create(&thread, NULL, audio_thread, NULL) != 0) {
        perror("audio thread");
        return -1;
    }
    return 0;
}

void audio_push(const int16_t *samples, int count)
{
    for (int i = 0; i < count; ++i) {
        unsigned next = (ring_head + 1) & (RING - 1);
        if (next == ring_tail) break;           /* full: drop the rest */
        ring[ring_head] = samples[i];
        __sync_synchronize();
        ring_head = next;
    }
}

int audio_queued(void)
{
    return (int)ring_fill();
}

void audio_stats(int *under, int *queued)
{
    *under = underruns;
    underruns = 0;
    *queued = (int)ring_fill();
}

void audio_close(void)
{
    if (!regs) return;
    running = 0;
    pthread_join(thread, NULL);
    regs[REG_CTRL] = 0;
}
