/* CPU address space: 2 KB RAM, PPU registers, controller port, cartridge.
 * The APU is not emulated yet; its registers read as zero. */
#include "nes.h"

uint8_t pad_buttons;

static uint8_t ram[0x800];
static uint8_t pad_shift, pad_strobe;

uint8_t bus_read(uint16_t addr)
{
    if (addr < 0x2000) return ram[addr & 0x7FF];
    if (addr < 0x4000) return ppu_reg_read(addr);
    if (addr == 0x4016) {
        uint8_t bit;
        if (pad_strobe) {
            bit = pad_buttons & 1;
        } else {
            bit = pad_shift & 1;
            pad_shift = (uint8_t)(pad_shift >> 1) | 0x80;
        }
        return bit | 0x40;
    }
    if (addr < 0x4020) return addr == 0x4017 ? 0x40 : 0;
    return cart_cpu_read(addr);
}

void bus_write(uint16_t addr, uint8_t val)
{
    if (addr < 0x2000) {
        ram[addr & 0x7FF] = val;
    } else if (addr < 0x4000) {
        ppu_reg_write(addr, val);
    } else if (addr == 0x4014) {
        uint8_t page[256];
        for (int i = 0; i < 256; ++i) page[i] = bus_read((uint16_t)(val << 8 | i));
        ppu_oam_dma(page);
        cpu.stall += 513 + (int)(cpu.cycles & 1);
    } else if (addr == 0x4016) {
        /* The shift register follows the buttons while strobe is high. */
        if (pad_strobe) pad_shift = pad_buttons;
        pad_strobe = val & 1;
        if (pad_strobe) pad_shift = pad_buttons;
    } else if (addr >= 0x4020) {
        cart_cpu_write(addr, val);
    }
}

void nes_reset(void)
{
    ppu_reset();
    cpu_reset();
}

void nes_run_frame(void)
{
    ppu.frame_ready = 0;
    while (!ppu.frame_ready) {
        cpu.irq = cart.irq;
        ppu_step(cpu_step() * 3);
    }
}
