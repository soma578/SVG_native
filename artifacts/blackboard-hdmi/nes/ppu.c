/* 2C02 PPU. Each visible line is drawn in one go at dot 1 from the loopy
 * scroll registers; the scroll increments, sprite 0 hit, vblank and the
 * MMC3 scanline clock still happen at their usual dots. */
#include <string.h>

#include "nes.h"

struct ppu ppu;
uint32_t ppu_frame[NES_W * NES_H];

/* A common 2C02 RGB approximation. */
const uint32_t nes_rgb[64] = {
    0x626262, 0x001FB2, 0x2404C8, 0x5200B2, 0x730076, 0x800024, 0x730B00, 0x522800,
    0x244400, 0x005700, 0x005C00, 0x005324, 0x003C76, 0x000000, 0x000000, 0x000000,
    0xABABAB, 0x0D57FF, 0x4B30FF, 0x8A13FF, 0xBC08D6, 0xD21269, 0xC72E00, 0x9D5400,
    0x607B00, 0x209800, 0x00A300, 0x009942, 0x007DB4, 0x000000, 0x000000, 0x000000,
    0xFFFFFF, 0x53AEFF, 0x9085FF, 0xD365FF, 0xFF57FF, 0xFF5DCF, 0xFF7757, 0xFA9E00,
    0xBDC700, 0x7AE700, 0x43F611, 0x26EF7E, 0x2CD5F6, 0x4E4E4E, 0x000000, 0x000000,
    0xFFFFFF, 0xB6E1FF, 0xCED1FF, 0xE9C3FF, 0xFFBCFF, 0xFFBDF4, 0xFFC6C3, 0xFFD59A,
    0xE9E681, 0xCEF481, 0xB6FB9A, 0xA9FAC3, 0xA9F0F4, 0xB8B8B8, 0x000000, 0x000000,
};

static inline uint8_t *nametable(uint16_t addr)
{
    unsigned a = addr & 0x0FFF, table = a >> 10;
    switch (cart.mirror) {
    case MIRROR_VERTICAL: table &= 1; break;
    case MIRROR_HORIZONTAL: table >>= 1; break;
    case MIRROR_SINGLE0: table = 0; break;
    case MIRROR_SINGLE1: table = 1; break;
    case MIRROR_FOUR: break;
    }
    return &ppu.vram[table * 0x400 + (a & 0x3FF)];
}

static inline unsigned palette_index(uint16_t addr)
{
    unsigned i = addr & 0x1F;
    if ((i & 0x13) == 0x10) i &= 0x0F;   /* 0x10/14/18/1C mirror 0x00/04/08/0C */
    return i;
}

static uint8_t mem_read(uint16_t addr)
{
    addr &= 0x3FFF;
    if (addr < 0x2000) return cart_chr_read(addr);
    if (addr < 0x3F00) return *nametable(addr);
    return ppu.palette[palette_index(addr)];
}

static void mem_write(uint16_t addr, uint8_t val)
{
    addr &= 0x3FFF;
    if (addr < 0x2000) cart_chr_write(addr, val);
    else if (addr < 0x3F00) *nametable(addr) = val;
    else ppu.palette[palette_index(addr)] = val & 0x3F;
}

void ppu_reset(void)
{
    memset(&ppu, 0, sizeof ppu);
    ppu.scanline = 261;
    ppu.s0_dot = -1;
}

uint8_t ppu_reg_read(uint16_t addr)
{
    uint8_t r = ppu.open_bus;
    switch (addr & 7) {
    case 2:
        r = (ppu.status & 0xE0) | (ppu.open_bus & 0x1F);
        ppu.status &= ~0x80;
        ppu.w = 0;
        break;
    case 4:
        r = ppu.oam[ppu.oam_addr];
        break;
    case 7: {
        uint16_t a = ppu.v & 0x3FFF;
        if (a < 0x3F00) {
            r = ppu.read_buf;
            ppu.read_buf = mem_read(a);
        } else {
            r = mem_read(a);
            ppu.read_buf = mem_read(a - 0x1000);
        }
        ppu.v += (ppu.ctrl & 0x04) ? 32 : 1;
        break;
    }
    }
    ppu.open_bus = r;
    return r;
}

void ppu_reg_write(uint16_t addr, uint8_t val)
{
    ppu.open_bus = val;
    switch (addr & 7) {
    case 0:
        if ((val & 0x80) && !(ppu.ctrl & 0x80) && (ppu.status & 0x80)) cpu.nmi = 1;
        ppu.ctrl = val;
        ppu.t = (ppu.t & 0xF3FF) | (uint16_t)((val & 3) << 10);
        break;
    case 1: ppu.mask = val; break;
    case 3: ppu.oam_addr = val; break;
    case 4: ppu.oam[ppu.oam_addr++] = val; break;
    case 5:
        if (!ppu.w) {
            ppu.t = (ppu.t & 0xFFE0) | (val >> 3);
            ppu.fine_x = val & 7;
        } else {
            ppu.t = (ppu.t & 0x8C1F) | (uint16_t)((val & 7) << 12) | (uint16_t)((val & 0xF8) << 2);
        }
        ppu.w ^= 1;
        break;
    case 6:
        if (!ppu.w) {
            ppu.t = (ppu.t & 0x80FF) | (uint16_t)((val & 0x3F) << 8);
        } else {
            ppu.t = (ppu.t & 0xFF00) | val;
            ppu.v = ppu.t;
        }
        ppu.w ^= 1;
        break;
    case 7:
        mem_write(ppu.v, val);
        ppu.v += (ppu.ctrl & 0x04) ? 32 : 1;
        break;
    }
}

void ppu_oam_dma(const uint8_t page[256])
{
    for (int i = 0; i < 256; ++i) ppu.oam[(uint8_t)(ppu.oam_addr + i)] = page[i];
}

static void increment_y(void)
{
    uint16_t v = ppu.v;
    if ((v & 0x7000) != 0x7000) {
        v += 0x1000;
    } else {
        v &= ~0x7000;
        unsigned y = (v & 0x03E0) >> 5;
        if (y == 29) { y = 0; v ^= 0x0800; }
        else if (y == 31) y = 0;
        else y++;
        v = (v & ~0x03E0) | (uint16_t)(y << 5);
    }
    ppu.v = v;
}

static void render_line(int y)
{
    uint32_t *out = ppu_frame + y * NES_W;
    ppu.s0_dot = -1;
    if (!(ppu.mask & 0x18)) {
        uint32_t c = nes_rgb[ppu.palette[0]];
        for (int x = 0; x < NES_W; ++x) out[x] = c;
        return;
    }

    /* Background: 33 tiles so that fine X can shift in up to 7 pixels. */
    uint8_t bg[NES_W + 16];
    if (ppu.mask & 0x08) {
        uint16_t v = ppu.v;
        uint16_t pattern = (uint16_t)((ppu.ctrl & 0x10) << 8) | (v >> 12);
        for (int tile = 0; tile < 33; ++tile) {
            uint8_t name = *nametable(0x2000 | (v & 0x0FFF));
            uint8_t attr = *nametable(0x23C0 | (v & 0x0C00) | ((v >> 4) & 0x38) | ((v >> 2) & 0x07));
            uint8_t pal = (uint8_t)(((attr >> (((v >> 4) & 4) | (v & 2))) & 3) << 2);
            uint16_t a = pattern + (uint16_t)(name << 4);
            uint8_t lo = cart_chr_read(a), hi = cart_chr_read(a + 8);
            uint8_t *dst = bg + tile * 8;
            for (int b = 0; b < 8; ++b) {
                int px = ((lo >> (7 - b)) & 1) | (((hi >> (7 - b)) & 1) << 1);
                dst[b] = px ? (pal | (uint8_t)px) : 0;
            }
            if ((v & 0x1F) == 31) { v &= ~0x1F; v ^= 0x0400; }
            else v++;
        }
    } else {
        memset(bg, 0, sizeof bg);
    }

    /* Sprites: the first eight in OAM order on this line, lower index wins. */
    uint8_t sp[NES_W], front[NES_W], zero[NES_W];
    memset(sp, 0, sizeof sp);
    if (ppu.mask & 0x10) {
        int h = (ppu.ctrl & 0x20) ? 16 : 8, count = 0;
        for (int i = 0; i < 64; ++i) {
            const uint8_t *s = ppu.oam + i * 4;
            int row = y - 1 - s[0];
            if (row < 0 || row >= h) continue;
            if (++count > 8) { ppu.status |= 0x20; break; }
            uint8_t tile = s[1], attr = s[2];
            if (attr & 0x80) row = h - 1 - row;
            uint16_t a;
            if (h == 16) {
                a = (uint16_t)(((tile & 1) << 12) | ((tile & 0xFE) << 4));
                if (row >= 8) { a += 16; row -= 8; }
            } else {
                a = (uint16_t)(((ppu.ctrl & 0x08) << 9) | (tile << 4));
            }
            a += (uint16_t)row;
            uint8_t lo = cart_chr_read(a), hi = cart_chr_read(a + 8);
            for (int b = 0; b < 8; ++b) {
                int x = s[3] + b;
                if (x >= NES_W) break;
                int bit = (attr & 0x40) ? b : 7 - b;
                int px = ((lo >> bit) & 1) | (((hi >> bit) & 1) << 1);
                if (!px || sp[x]) continue;
                sp[x] = (uint8_t)(0x10 | ((attr & 3) << 2) | px);
                front[x] = !(attr & 0x20);
                zero[x] = i == 0;
            }
        }
    }

    const uint8_t *bgline = bg + ppu.fine_x;
    uint8_t gray = (ppu.mask & 1) ? 0x30 : 0x3F;
    int left_bg = ppu.mask & 0x02, left_sp = ppu.mask & 0x04;
    for (int x = 0; x < NES_W; ++x) {
        uint8_t b = (x >= 8 || left_bg) ? bgline[x] : 0;
        uint8_t s = (x >= 8 || left_sp) ? sp[x] : 0;
        uint8_t idx;
        if (b && s) {
            if (zero[x] && x != 255 && ppu.s0_dot < 0) ppu.s0_dot = x + 2;
            idx = front[x] ? s : b;
        } else {
            idx = s ? s : b;
        }
        out[x] = nes_rgb[ppu.palette[idx] & gray];
    }
}

/* Dots on which something happens, per line type; 341 ends the line. */
static int next_event(int line, int dot)
{
    static const int visible[] = { 1, 256, 257, 260, 341 };
    static const int prerender[] = { 1, 257, 260, 304, 341 };
    static const int vblank_start[] = { 1, 341 };
    static const int idle[] = { 341 };
    const int *ev = line < 240 ? visible : line == 241 ? vblank_start :
                    line == 261 ? prerender : idle;
    int next = 341;
    for (; *ev != 341; ++ev)
        if (*ev > dot) { next = *ev; break; }
    if (line < 240 && ppu.s0_dot > dot && ppu.s0_dot < next) next = ppu.s0_dot;
    return next;
}

static void line_event(int line, int dot)
{
    int rendering = ppu.mask & 0x18;
    if (line < 240) {
        if (dot == 1) {
            render_line(line);
            return;
        }
        if (!rendering) return;
        if (dot == ppu.s0_dot) ppu.status |= 0x40;
        if (dot == 256) increment_y();
        else if (dot == 257) ppu.v = (ppu.v & ~0x041F) | (ppu.t & 0x041F);
        else if (dot == 260) cart_scanline();
    } else if (line == 241) {
        ppu.status |= 0x80;
        if (ppu.ctrl & 0x80) cpu.nmi = 1;
        ppu.frame_ready = 1;
    } else if (line == 261) {
        if (dot == 1) ppu.status &= ~0xE0;
        else if (!rendering) return;
        else if (dot == 257) ppu.v = (ppu.v & ~0x041F) | (ppu.t & 0x041F);
        else if (dot == 260) cart_scanline();
        else if (dot == 304) ppu.v = (ppu.v & ~0x7BE0) | (ppu.t & 0x7BE0);
    }
}

/* Jumps straight from one event dot to the next instead of ticking. */
void ppu_step(int dots)
{
    while (dots > 0) {
        /* Odd frames drop the last dot of the pre-render line. */
        int line_end = (ppu.scanline == 261 && ppu.odd_frame && (ppu.mask & 0x18)) ? 340 : 341;
        int next = next_event(ppu.scanline, ppu.dot);
        if (next > line_end) next = line_end;
        int step = next - ppu.dot;
        if (step > dots) {
            ppu.dot += dots;
            return;
        }
        dots -= step;
        if (next == line_end) {
            ppu.dot = 0;
            if (++ppu.scanline > 261) {
                ppu.scanline = 0;
                ppu.odd_frame ^= 1;
            }
        } else {
            ppu.dot = next;
            line_event(ppu.scanline, next);
        }
    }
}
