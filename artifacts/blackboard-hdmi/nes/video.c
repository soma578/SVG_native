#include "video.h"

#include <fcntl.h>
#include <stdio.h>
#include <string.h>
#include <sys/mman.h>
#include <unistd.h>

#define FB_PHYS   0x1E000000u
#define FB_BYTES  (1280u * 720u * 4u)

static volatile uint32_t *vdma, *vtc, *clkwiz, *gpio_btn, *gpio_sw;

static volatile uint32_t *map(int fd, uint32_t phys, uint32_t len)
{
    void *p = mmap(NULL, len, PROT_READ | PROT_WRITE, MAP_SHARED, fd, phys);
    if (p == MAP_FAILED) { perror("mmap /dev/mem"); return NULL; }
    return p;
}

/* Clocking Wizard dynamic reconfiguration (PG065). Input is 100 MHz;
 * CLKOUT0 is the pixel clock and CLKOUT1 the 5x serializer clock. */
static int set_pixel_clock(uint32_t cfg0, uint32_t out0_div, uint32_t out1_div)
{
    clkwiz[0x200 / 4] = cfg0;
    clkwiz[0x208 / 4] = out0_div;
    clkwiz[0x214 / 4] = out1_div;
    clkwiz[0x25C / 4] = 0x3;          /* load from registers */
    for (int i = 0; i < 1000; ++i) {
        usleep(1000);
        if (clkwiz[0x04 / 4] & 1) return 0;
    }
    fprintf(stderr, "clk_wiz did not lock\n");
    return -1;
}

struct timing {
    int hact, hfp, hsync, hbp, vact, vfp, vsync, vbp;
    uint32_t polarity;
};

/* Video Timing Controller generator registers (PG016). */
static void set_timing(const struct timing *t)
{
    int htotal = t->hact + t->hfp + t->hsync + t->hbp;
    int vtotal = t->vact + t->vfp + t->vsync + t->vbp;
    uint32_t hs = (uint32_t)(t->hact + t->hfp);
    uint32_t vs = (uint32_t)(t->vact + t->vfp - 1);
    uint32_t act = (uint32_t)t->vact << 16 | (uint32_t)t->hact;
    uint32_t hblank = (uint32_t)t->hact << 16 | (uint32_t)t->hact;

    vtc[0x60 / 4] = act;
    vtc[0x6C / 4] = t->polarity;
    vtc[0x70 / 4] = (uint32_t)htotal;
    vtc[0x74 / 4] = (uint32_t)vtotal << 16 | (uint32_t)vtotal;
    vtc[0x78 / 4] = (hs + (uint32_t)t->hsync) << 16 | hs;
    vtc[0x7C / 4] = hblank;
    vtc[0x80 / 4] = (vs + (uint32_t)t->vsync) << 16 | vs;
    vtc[0x84 / 4] = hblank;
    vtc[0x88 / 4] = hblank;
    vtc[0x8C / 4] = (vs + (uint32_t)t->vsync) << 16 | vs;
    vtc[0x90 / 4] = hblank;
    vtc[0x94 / 4] = act;
    /* Enable the generator with every value taken from these registers. */
    vtc[0] = 0x03FFFF07;
}

static void start_vdma(int width, int height)
{
    vdma[0x00 / 4] = 1u << 2;                     /* reset */
    while (vdma[0x00 / 4] & (1u << 2)) {}
    vdma[0x00 / 4] = (1u << 1) | 1u;              /* circular, run */
    vdma[0x5C / 4] = FB_PHYS;
    vdma[0x58 / 4] = (uint32_t)width * 4u;        /* stride */
    vdma[0x54 / 4] = (uint32_t)width * 4u;        /* hsize */
    vdma[0x50 / 4] = (uint32_t)height;            /* vsize: starts DMA */
}

int video_open(struct video *v, enum video_mode mode)
{
    int fd = open("/dev/mem", O_RDWR | O_SYNC);
    if (fd < 0) { perror("/dev/mem"); return -1; }
    vdma = map(fd, 0x43000000, 0x10000);
    vtc = map(fd, 0x43C30000, 0x10000);
    clkwiz = map(fd, 0x43C40000, 0x10000);
    gpio_btn = map(fd, 0x41200000, 0x10000);
    gpio_sw = map(fd, 0x41220000, 0x10000);
    v->fb = map(fd, FB_PHYS, FB_BYTES);
    if (!vdma || !vtc || !clkwiz || !gpio_btn || !gpio_sw || !v->fb) return -1;

    if (mode == VIDEO_640x480) {
        /* 100 / 5 * 50.375 = 1007.5 MHz VCO; /40 = 25.19 MHz, /8 = 5x. */
        static const struct timing t = { 640, 16, 96, 48, 480, 10, 2, 33, 0x67 };
        v->width = 640; v->height = 480;
        if (set_pixel_clock(0x05773205, 40, 8)) return -1;
        set_timing(&t);
    } else {
        /* 100 / 5 * 37.125 = 742.5 MHz VCO; /10 = 74.25 MHz, /2 = 5x. */
        static const struct timing t = { 1280, 110, 40, 220, 720, 5, 5, 20, 0x7F };
        v->width = 1280; v->height = 720;
        if (set_pixel_clock(0x047D2505, 10, 2)) return -1;
        set_timing(&t);
    }
    video_clear(v, 0);
    start_vdma(v->width, v->height);
    return 0;
}

void video_clear(struct video *v, uint32_t color)
{
    for (int i = 0; i < v->width * v->height; ++i) v->fb[i] = color;
}

/* Uncached stores are slow one by one; 8-register STMs go out as bursts. */
static void copy_burst(volatile uint32_t *dst, const uint32_t *src, int words)
{
    for (int i = 0; i < words; i += 8) {
        __asm__ volatile(
            "ldmia %1, {r4-r11}\n\t"
            "stmia %0, {r4-r11}\n\t"
            :: "r"(dst + i), "r"(src + i)
            : "r4", "r5", "r6", "r7", "r8", "r9", "r10", "r11", "memory");
    }
}

/* Lines identical to the previous frame are skipped: writes to the
 * uncached framebuffer cost far more than comparing in cached RAM. */
void video_present_nes2x(struct video *v, const uint32_t *frame)
{
    static uint32_t shown[NES_W * NES_H];
    static int valid;
    static uint32_t line[NES_W * 2] __attribute__((aligned(32)));
    int x0 = (v->width - NES_W * 2) / 2, y0 = (v->height - NES_H * 2) / 2;
    for (int y = 0; y < NES_H; ++y) {
        const uint32_t *s = frame + y * NES_W;
        uint32_t *prev = shown + y * NES_W;
        if (valid && memcmp(prev, s, NES_W * 4) == 0) continue;
        memcpy(prev, s, NES_W * 4);
        for (int x = 0; x < NES_W; ++x) line[2 * x] = line[2 * x + 1] = s[x];
        volatile uint32_t *d = v->fb + (y0 + 2 * y) * v->width + x0;
        copy_burst(d, line, NES_W * 2);
        copy_burst(d + v->width, line, NES_W * 2);
    }
    valid = 1;
}

uint32_t board_buttons(void) { return gpio_btn[0] & 0xF; }
uint32_t board_switches(void) { return gpio_sw[0] & 0xFFF; }
