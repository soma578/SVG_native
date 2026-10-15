/* HDMI output through the Blackboard base design's VDMA + VTC + clk_wiz,
 * driven from user space via /dev/mem. Needs root and the mem=480M boot
 * argument, which leaves 0x1E000000-0x1FFFFFFF for the framebuffer. */
#ifndef VIDEO_H
#define VIDEO_H
#include <stdint.h>

#ifndef NES_W
#define NES_W 256
#define NES_H 240
#endif

enum video_mode { VIDEO_640x480, VIDEO_1280x720 };

struct video {
    int width, height;
    volatile uint32_t *fb;   /* 0x00RRGGBB, width * height words */
};

int video_open(struct video *v, enum video_mode mode);
/* Copy a NES_W x NES_H 0x00RRGGBB frame, scaled 2x and centered. */
void video_present_nes2x(struct video *v, const uint32_t *frame);
void video_clear(struct video *v, uint32_t color);

/* Board inputs: BTN0-3 in bits 0-3, SW0-11 in bits 0-11. */
uint32_t board_buttons(void);
uint32_t board_switches(void);

#endif
