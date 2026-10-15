/* Count sound register writes a ROM makes in N frames (APU and FME-7 5B).
 * Built with -Wl,--wrap=apu_write,--wrap=cart_cpu_write.
 * Usage: ./apucount rom frames [press_frame buttons_hex] */
#include <stdio.h>
#include <stdlib.h>

#include "../nes.h"

static unsigned apu_counts[0x18], fme7_audio;

void __real_apu_write(uint16_t addr, uint8_t val);
void __real_cart_cpu_write(uint16_t addr, uint8_t val);

void __wrap_apu_write(uint16_t addr, uint8_t val)
{
    apu_counts[addr - 0x4000]++;
    __real_apu_write(addr, val);
}

void __wrap_cart_cpu_write(uint16_t addr, uint8_t val)
{
    if (cart.mapper == 69 && addr >= 0xC000) fme7_audio++;
    __real_cart_cpu_write(addr, val);
}

int main(int argc, char **argv)
{
    if (argc < 3 || cart_load(argv[1])) return 2;
    int frames = atoi(argv[2]);
    int press_at = argc > 4 ? atoi(argv[3]) : -1;
    uint8_t press = argc > 4 ? (uint8_t)strtoul(argv[4], NULL, 16) : 0;
    nes_reset();
    for (int i = 0; i < frames; ++i) {
        pad_buttons = (press_at >= 0 && i >= press_at && i < press_at + 10) ? press : 0;
        nes_run_frame();
        apu_sample_count = 0;
    }
    for (int i = 0; i < 0x18; ++i)
        if (apu_counts[i]) printf("$%04X: %u\n", 0x4000 + i, apu_counts[i]);
    printf("FME-7 5B audio writes: %u\n", fme7_audio);
    return 0;
}
