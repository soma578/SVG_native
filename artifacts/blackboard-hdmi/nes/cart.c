/* iNES cartridge loader and mappers: 0 NROM, 1 MMC1, 2 UxROM, 3 CNROM,
 * 4 MMC3, 7 AxROM, 69 Sunsoft FME-7 (without its 5B sound). Banks are exposed as 8 KB PRG / 1 KB CHR windows. */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "nes.h"

struct cart cart;

static char save_path[4096];

static int wrap(int bank, int count)
{
    bank %= count;
    return bank < 0 ? bank + count : bank;
}

static void map_prg8(int slot, int bank)
{
    cart.prg_map[slot] = cart.prg + wrap(bank, (int)(cart.prg_size / 0x2000)) * 0x2000;
}

/* Negative banks count from the end: -1 is the last bank. */
static void map_prg16(int slot, int bank)
{
    int n = (int)(cart.prg_size / 0x4000);
    bank = wrap(bank, n);
    map_prg8(slot * 2, bank * 2);
    map_prg8(slot * 2 + 1, bank * 2 + 1);
}

static void map_chr1(int slot, int bank)
{
    cart.chr_map[slot] = cart.chr + wrap(bank, (int)(cart.chr_size / 0x400)) * 0x400;
}

static void map_chr4(int slot, int bank)
{
    for (int i = 0; i < 4; ++i) map_chr1(slot * 4 + i, bank * 4 + i);
}

static void map_chr8(int bank)
{
    for (int i = 0; i < 8; ++i) map_chr1(i, bank * 8 + i);
}

static void mmc1_update(void)
{
    static const enum mirror mirrors[4] = {
        MIRROR_SINGLE0, MIRROR_SINGLE1, MIRROR_VERTICAL, MIRROR_HORIZONTAL };
    cart.mirror = mirrors[cart.control & 3];
    int prg = cart.regs[3] & 0x0F;
    switch ((cart.control >> 2) & 3) {
    case 0: case 1: map_prg16(0, prg & ~1); map_prg16(1, prg | 1); break;
    case 2: map_prg16(0, 0); map_prg16(1, prg); break;
    case 3: map_prg16(0, prg); map_prg16(1, -1); break;
    }
    if (cart.control & 0x10) {
        map_chr4(0, cart.regs[1]);
        map_chr4(1, cart.regs[2]);
    } else {
        map_chr4(0, cart.regs[1] & ~1);
        map_chr4(1, cart.regs[1] | 1);
    }
}

static void mmc3_update(void)
{
    int prg_swap = cart.bank_select & 0x40, chr_swap = cart.bank_select & 0x80;
    map_prg8(prg_swap ? 2 : 0, cart.regs[6]);
    map_prg8(1, cart.regs[7]);
    map_prg8(prg_swap ? 0 : 2, -2);
    map_prg8(3, -1);
    int two_k = chr_swap ? 4 : 0, one_k = chr_swap ? 0 : 4;
    map_chr1(two_k + 0, cart.regs[0] & 0xFE);
    map_chr1(two_k + 1, cart.regs[0] | 1);
    map_chr1(two_k + 2, cart.regs[1] & 0xFE);
    map_chr1(two_k + 3, cart.regs[1] | 1);
    for (int i = 0; i < 4; ++i) map_chr1(one_k + i, cart.regs[2 + i]);
}

int cart_load(const char *path)
{
    FILE *f = fopen(path, "rb");
    if (!f) { perror(path); return -1; }
    uint8_t h[16];
    if (fread(h, 1, 16, f) != 16 || memcmp(h, "NES\x1A", 4) != 0) {
        fprintf(stderr, "%s: not an iNES file\n", path);
        fclose(f);
        return -1;
    }
    memset(&cart, 0, sizeof cart);
    cart.prg_size = h[4] * 0x4000u;
    cart.chr_size = h[5] * 0x2000u;
    cart.mapper = h[6] >> 4;
    /* Old dumps put junk in bytes 7-15; only trust byte 7 when it is clean. */
    if ((h[7] & 0x0C) == 0x08 || (h[12] | h[13] | h[14] | h[15]) == 0)
        cart.mapper |= h[7] & 0xF0;
    cart.battery = (h[6] & 2) != 0;
    cart.mirror = (h[6] & 8) ? MIRROR_FOUR : (h[6] & 1) ? MIRROR_VERTICAL : MIRROR_HORIZONTAL;
    if (h[6] & 4) fseek(f, 512, SEEK_CUR);   /* trainer */

    cart.prg = malloc(cart.prg_size);
    cart.chr_is_ram = cart.chr_size == 0;
    if (cart.chr_is_ram) cart.chr_size = 0x2000;
    cart.chr = calloc(1, cart.chr_size);
    if (!cart.prg || !cart.chr || cart.prg_size == 0 ||
        fread(cart.prg, 1, cart.prg_size, f) != cart.prg_size ||
        (!cart.chr_is_ram && fread(cart.chr, 1, cart.chr_size, f) != cart.chr_size)) {
        fprintf(stderr, "%s: truncated ROM\n", path);
        fclose(f);
        return -1;
    }
    fclose(f);

    switch (cart.mapper) {
    case 0: case 2: case 3:
        map_prg16(0, 0);
        map_prg16(1, -1);
        map_chr8(0);
        break;
    case 1:
        cart.control = 0x0C;
        mmc1_update();
        break;
    case 4: {
        static const uint8_t init[8] = { 0, 2, 4, 5, 6, 7, 0, 1 };
        memcpy(cart.regs, init, sizeof init);
        mmc3_update();
        break;
    }
    case 7:
        map_prg16(0, 0);
        map_prg16(1, 1);
        map_chr8(0);
        cart.mirror = MIRROR_SINGLE0;
        break;
    case 69:
        for (int i = 0; i < 4; ++i) map_prg8(i, i == 3 ? -1 : i);
        map_chr8(0);
        cart.prg_ram_size = 0x8000;
        break;
    default:
        fprintf(stderr, "%s: mapper %d is not supported yet\n", path, cart.mapper);
        return -1;
    }
    if (cart.battery && !cart.prg_ram_size) cart.prg_ram_size = 0x2000;
    snprintf(save_path, sizeof save_path, "%s.sav", path);
    printf("%s: mapper %d, PRG %u KB, CHR %u KB%s\n", path, cart.mapper,
           cart.prg_size / 1024, cart.chr_size / 1024, cart.chr_is_ram ? " (RAM)" : "");
    return 0;
}

/* FME-7 command 8 decides what appears at $6000: ROM, RAM or nothing. */
static uint8_t *fme7_low_bank(void)
{
    uint8_t r = cart.regs[0];
    if (!(r & 0x40)) return cart.prg + wrap(r & 0x3F, (int)(cart.prg_size / 0x2000)) * 0x2000;
    if (r & 0x80) return cart.prg_ram + (r & 3) * 0x2000;
    return NULL;
}

uint8_t cart_cpu_read(uint16_t addr)
{
    if (addr >= 0x8000) return cart.prg_map[(addr - 0x8000) >> 13][addr & 0x1FFF];
    if (cart.mapper == 69 && addr >= 0x6000) {
        uint8_t *bank = fme7_low_bank();
        return bank ? bank[addr & 0x1FFF] : 0;
    }
    if (addr >= 0x6000) return cart.prg_ram[addr & 0x1FFF];
    return 0;
}

void cart_cpu_write(uint16_t addr, uint8_t val)
{
    if (addr < 0x6000) return;
    if (addr < 0x8000) {
        if (cart.mapper != 69) cart.prg_ram[addr & 0x1FFF] = val;
        else if ((cart.regs[0] & 0xC0) == 0xC0) cart.prg_ram[(cart.regs[0] & 3) * 0x2000 + (addr & 0x1FFF)] = val;
        return;
    }

    switch (cart.mapper) {
    case 1:
        if (val & 0x80) {
            cart.shift = cart.shift_count = 0;
            cart.control |= 0x0C;
            mmc1_update();
        } else {
            cart.shift |= (uint8_t)((val & 1) << cart.shift_count);
            if (++cart.shift_count == 5) {
                int reg = (addr >> 13) & 3;
                if (reg == 0) cart.control = cart.shift;
                else cart.regs[reg] = cart.shift;
                cart.shift = cart.shift_count = 0;
                mmc1_update();
            }
        }
        break;
    case 2:
        map_prg16(0, val);
        break;
    case 3:
        map_chr8(val);
        break;
    case 4:
        switch (addr & 0xE001) {
        case 0x8000: cart.bank_select = val; mmc3_update(); break;
        case 0x8001: cart.regs[cart.bank_select & 7] = val; mmc3_update(); break;
        case 0xA000:
            if (cart.mirror != MIRROR_FOUR)
                cart.mirror = (val & 1) ? MIRROR_HORIZONTAL : MIRROR_VERTICAL;
            break;
        case 0xC000: cart.irq_latch = val; break;
        case 0xC001: cart.irq_counter = 0; cart.irq_reload = 1; break;
        case 0xE000: cart.irq_enabled = 0; cart.irq = 0; break;
        case 0xE001: cart.irq_enabled = 1; break;
        }
        break;
    case 7:
        map_prg16(0, (val & 7) * 2);
        map_prg16(1, (val & 7) * 2 + 1);
        cart.mirror = (val & 0x10) ? MIRROR_SINGLE1 : MIRROR_SINGLE0;
        break;
    case 69:
        if (addr < 0xA000) {
            cart.bank_select = val & 0x0F;
            break;
        }
        if (addr >= 0xC000) break;      /* Sunsoft 5B audio, not emulated */
        switch (cart.bank_select) {
        case 0: case 1: case 2: case 3: case 4: case 5: case 6: case 7:
            map_chr1(cart.bank_select, val);
            break;
        case 8: cart.regs[0] = val; break;
        case 9: case 10: case 11: map_prg8(cart.bank_select - 9, val & 0x3F); break;
        case 12: {
            static const enum mirror m[4] = {
                MIRROR_VERTICAL, MIRROR_HORIZONTAL, MIRROR_SINGLE0, MIRROR_SINGLE1 };
            cart.mirror = m[val & 3];
            break;
        }
        case 13:
            cart.irq_enabled = val & 0x81;   /* bit 0 IRQ, bit 7 counting */
            cart.irq = 0;
            break;
        case 14: cart.irq_count16 = (cart.irq_count16 & 0xFF00) | val; break;
        case 15: cart.irq_count16 = (uint16_t)((cart.irq_count16 & 0x00FF) | val << 8); break;
        }
        break;
    }
}

void cart_chr_write(uint16_t addr, uint8_t val)
{
    if (cart.chr_is_ram) cart.chr_map[addr >> 10][addr & 0x3FF] = val;
}

/* MMC3 counts scanlines through PPU A12; this is called at dot 260. */
void cart_scanline(void)
{
    if (cart.mapper != 4) return;
    if (cart.irq_counter == 0 || cart.irq_reload) {
        cart.irq_counter = cart.irq_latch;
        cart.irq_reload = 0;
    } else {
        cart.irq_counter--;
    }
    if (cart.irq_counter == 0 && cart.irq_enabled) cart.irq = 1;
}

/* FME-7 counts down every CPU cycle and fires when it wraps past zero. */
void cart_cpu_cycles(int cycles)
{
    if (cart.mapper != 69 || !(cart.irq_enabled & 0x80)) return;
    if (cycles > cart.irq_count16 && (cart.irq_enabled & 0x01)) cart.irq = 1;
    cart.irq_count16 = (uint16_t)(cart.irq_count16 - cycles);
}

void cart_load_save(void)
{
    if (!cart.battery) return;
    FILE *f = fopen(save_path, "rb");
    if (!f) return;
    size_t n = fread(cart.prg_ram, 1, cart.prg_ram_size, f);
    fclose(f);
    printf("loaded %zu bytes from %s\n", n, save_path);
}

void cart_write_save(void)
{
    if (!cart.battery) return;
    FILE *f = fopen(save_path, "wb");
    if (!f) { perror(save_path); return; }
    fwrite(cart.prg_ram, 1, cart.prg_ram_size, f);
    fclose(f);
}
