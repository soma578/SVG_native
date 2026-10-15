/* Famicom/NES emulator core shared declarations. One machine per process,
 * kept in globals so the hot paths stay cheap on the Cortex-A9. */
#ifndef NES_CORE_H
#define NES_CORE_H
#include <stdint.h>

#define NES_W 256
#define NES_H 240

/* ---- cpu.c: Ricoh 2A03 (6502 without decimal mode) ---- */
struct cpu {
    uint16_t pc;
    uint8_t a, x, y, s, p;
    uint64_t cycles;
    int nmi;        /* edge latched by the PPU */
    int irq;        /* level, mirrored from the cartridge each step */
    int stall;      /* extra cycles from OAM DMA */
};
extern struct cpu cpu;
void cpu_reset(void);
int cpu_step(void);             /* runs one instruction, returns CPU cycles */

/* ---- bus.c ---- */
/* Controller 1 buttons: A B Select Start Up Down Left Right = bits 0..7 */
extern uint8_t pad_buttons;
uint8_t bus_read(uint16_t addr);
void bus_write(uint16_t addr, uint8_t val);
void nes_reset(void);
void nes_run_frame(void);

/* ---- ppu.c: 2C02, rendered a scanline at a time ---- */
struct ppu {
    uint8_t ctrl, mask, status, oam_addr;
    uint16_t v, t;
    uint8_t fine_x, w, read_buf, open_bus;
    uint8_t oam[256];
    uint8_t vram[4096];
    uint8_t palette[32];
    int scanline, dot, odd_frame;
    int frame_ready;
    int s0_dot;     /* dot on this line where sprite 0 hits, or -1 */
};
extern struct ppu ppu;
extern uint32_t ppu_frame[NES_W * NES_H];   /* 0x00RRGGBB */
extern const uint32_t nes_rgb[64];
void ppu_reset(void);
void ppu_step(int dots);
uint8_t ppu_reg_read(uint16_t addr);
void ppu_reg_write(uint16_t addr, uint8_t val);
void ppu_oam_dma(const uint8_t page[256]);

/* ---- cart.c: iNES loader and mappers 0, 1, 2, 3, 4, 7 ---- */
enum mirror { MIRROR_HORIZONTAL, MIRROR_VERTICAL, MIRROR_SINGLE0,
              MIRROR_SINGLE1, MIRROR_FOUR };
struct cart {
    uint8_t *prg, *chr;
    uint32_t prg_size, chr_size;
    int chr_is_ram, mapper, battery;
    enum mirror mirror;
    uint8_t prg_ram[0x2000];
    uint8_t *prg_map[4];    /* 8 KB windows at 0x8000 */
    uint8_t *chr_map[8];    /* 1 KB windows at 0x0000 */
    /* mapper state */
    uint8_t regs[8], bank_select, shift, shift_count, control;
    uint8_t irq_latch, irq_counter;
    int irq_reload, irq_enabled, irq;
};
extern struct cart cart;
int cart_load(const char *path);
uint8_t cart_cpu_read(uint16_t addr);
void cart_cpu_write(uint16_t addr, uint8_t val);
void cart_chr_write(uint16_t addr, uint8_t val);
void cart_scanline(void);
static inline uint8_t cart_chr_read(uint16_t addr)
{
    return cart.chr_map[addr >> 10][addr & 0x3FF];
}

#endif
