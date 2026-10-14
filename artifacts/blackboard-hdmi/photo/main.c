/* Bare-metal Zynq A9 framebuffer demo. The matching PS7 + AXI BRAM hardware
 * must be built and loaded before this application is run. */
#include <stdint.h>
#include "xil_cache.h"
#include "photo_pixels.h"

#define FRAMEBUFFER_BASE 0x40000000u
#define FRAME_WORDS (256u * 240u / 2u)

int main(void)
{
    Xil_DCacheDisable();
    volatile uint32_t *const framebuffer =
        (volatile uint32_t *)FRAMEBUFFER_BASE;

    for (uint32_t i = 0; i < FRAME_WORDS; ++i)
        framebuffer[i] = photo_words[i];

    for (;;) {
        __asm__ volatile ("nop");
    }
}
