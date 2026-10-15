/* 6502 core: official opcodes plus the stable unofficial ones that games and
 * nestest use. Cycle counts include page-crossing and branch penalties. */
#include "nes.h"

struct cpu cpu;

enum { FC = 1, FZ = 2, FI = 4, FD = 8, FB = 0x10, FU = 0x20, FV = 0x40, FN = 0x80 };
enum { ABS = 1, ABX, ABY, ACC, IMM, IMP, IZX, IND, IZY, REL, ZP, ZPX, ZPY };

static const uint8_t modes[256] = {
    6, 7, 6, 7, 11, 11, 11, 11, 6, 5, 4, 5, 1, 1, 1, 1,
    10, 9, 6, 9, 12, 12, 12, 12, 6, 3, 6, 3, 2, 2, 2, 2,
    1, 7, 6, 7, 11, 11, 11, 11, 6, 5, 4, 5, 1, 1, 1, 1,
    10, 9, 6, 9, 12, 12, 12, 12, 6, 3, 6, 3, 2, 2, 2, 2,
    6, 7, 6, 7, 11, 11, 11, 11, 6, 5, 4, 5, 1, 1, 1, 1,
    10, 9, 6, 9, 12, 12, 12, 12, 6, 3, 6, 3, 2, 2, 2, 2,
    6, 7, 6, 7, 11, 11, 11, 11, 6, 5, 4, 5, 8, 1, 1, 1,
    10, 9, 6, 9, 12, 12, 12, 12, 6, 3, 6, 3, 2, 2, 2, 2,
    5, 7, 5, 7, 11, 11, 11, 11, 6, 5, 6, 5, 1, 1, 1, 1,
    10, 9, 6, 9, 12, 12, 13, 13, 6, 3, 6, 3, 2, 2, 3, 3,
    5, 7, 5, 7, 11, 11, 11, 11, 6, 5, 6, 5, 1, 1, 1, 1,
    10, 9, 6, 9, 12, 12, 13, 13, 6, 3, 6, 3, 2, 2, 3, 3,
    5, 7, 5, 7, 11, 11, 11, 11, 6, 5, 6, 5, 1, 1, 1, 1,
    10, 9, 6, 9, 12, 12, 12, 12, 6, 3, 6, 3, 2, 2, 2, 2,
    5, 7, 5, 7, 11, 11, 11, 11, 6, 5, 6, 5, 1, 1, 1, 1,
    10, 9, 6, 9, 12, 12, 12, 12, 6, 3, 6, 3, 2, 2, 2, 2,
};

static const uint8_t base_cycles[256] = {
    7, 6, 2, 8, 3, 3, 5, 5, 3, 2, 2, 2, 4, 4, 6, 6,
    2, 5, 2, 8, 4, 4, 6, 6, 2, 4, 2, 7, 4, 4, 7, 7,
    6, 6, 2, 8, 3, 3, 5, 5, 4, 2, 2, 2, 4, 4, 6, 6,
    2, 5, 2, 8, 4, 4, 6, 6, 2, 4, 2, 7, 4, 4, 7, 7,
    6, 6, 2, 8, 3, 3, 5, 5, 3, 2, 2, 2, 3, 4, 6, 6,
    2, 5, 2, 8, 4, 4, 6, 6, 2, 4, 2, 7, 4, 4, 7, 7,
    6, 6, 2, 8, 3, 3, 5, 5, 4, 2, 2, 2, 5, 4, 6, 6,
    2, 5, 2, 8, 4, 4, 6, 6, 2, 4, 2, 7, 4, 4, 7, 7,
    2, 6, 2, 6, 3, 3, 3, 3, 2, 2, 2, 2, 4, 4, 4, 4,
    2, 6, 2, 6, 4, 4, 4, 4, 2, 5, 2, 5, 5, 5, 5, 5,
    2, 6, 2, 6, 3, 3, 3, 3, 2, 2, 2, 2, 4, 4, 4, 4,
    2, 5, 2, 5, 4, 4, 4, 4, 2, 4, 2, 4, 4, 4, 4, 4,
    2, 6, 2, 8, 3, 3, 5, 5, 2, 2, 2, 2, 4, 4, 6, 6,
    2, 5, 2, 8, 4, 4, 6, 6, 2, 4, 2, 7, 4, 4, 7, 7,
    2, 6, 2, 8, 3, 3, 5, 5, 2, 2, 2, 2, 4, 4, 6, 6,
    2, 5, 2, 8, 4, 4, 6, 6, 2, 4, 2, 7, 4, 4, 7, 7,
};

/* Reads that take an extra cycle when the indexed address crosses a page. */
static const uint8_t page_penalty[256] = {
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 1, 1, 1, 1,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0,
};

#define RD(a) bus_read(a)
#define WR(a, v) bus_write((a), (v))

static inline uint16_t rd16(uint16_t a)
{
    uint16_t lo = RD(a);
    return lo | (uint16_t)RD((uint16_t)(a + 1)) << 8;
}

static inline uint16_t rd16_zp(uint8_t a)
{
    uint16_t lo = RD(a);
    return lo | (uint16_t)RD((uint8_t)(a + 1)) << 8;
}

static inline void push(uint8_t v) { WR(0x100 | cpu.s, v); cpu.s--; }
static inline uint8_t pull(void) { cpu.s++; return RD(0x100 | cpu.s); }

static inline void setzn(uint8_t v)
{
    cpu.p = (cpu.p & ~(FZ | FN)) | (v ? 0 : FZ) | (v & FN);
}

static inline void setc(int c) { cpu.p = (cpu.p & ~FC) | (c ? FC : 0); }

static inline void compare(uint8_t r, uint8_t m)
{
    setzn((uint8_t)(r - m));
    setc(r >= m);
}

static inline void adc(uint8_t m)
{
    unsigned sum = cpu.a + m + (cpu.p & FC);
    uint8_t r = (uint8_t)sum;
    cpu.p &= ~(FC | FV);
    if (sum > 0xFF) cpu.p |= FC;
    if (~(cpu.a ^ m) & (cpu.a ^ r) & 0x80) cpu.p |= FV;
    cpu.a = r;
    setzn(r);
}

static inline uint8_t asl(uint8_t v) { setc(v & 0x80); v <<= 1; setzn(v); return v; }
static inline uint8_t lsr(uint8_t v) { setc(v & 1); v >>= 1; setzn(v); return v; }
static inline uint8_t rol(uint8_t v)
{
    uint8_t c = cpu.p & FC;
    setc(v & 0x80);
    v = (uint8_t)(v << 1) | c;
    setzn(v);
    return v;
}
static inline uint8_t ror(uint8_t v)
{
    uint8_t c = cpu.p & FC;
    setc(v & 1);
    v = (uint8_t)(v >> 1) | (uint8_t)(c << 7);
    setzn(v);
    return v;
}

static void interrupt(uint16_t vector, int brk)
{
    push(cpu.pc >> 8);
    push(cpu.pc & 0xFF);
    push((cpu.p | FU | (brk ? FB : 0)) & (brk ? 0xFF : ~FB));
    cpu.p |= FI;
    cpu.pc = rd16(vector);
}

void cpu_reset(void)
{
    cpu.pc = rd16(0xFFFC);
    cpu.a = cpu.x = cpu.y = 0;
    cpu.s = 0xFD;
    cpu.p = FI | FU;
    cpu.cycles = 7;
    cpu.nmi = cpu.irq = cpu.stall = 0;
}

int cpu_step(void)
{
    int cyc;
    if (cpu.nmi) {
        cpu.nmi = 0;
        interrupt(0xFFFA, 0);
        cpu.cycles += 7;
        return 7;
    }
    if (cpu.irq && !(cpu.p & FI)) {
        interrupt(0xFFFE, 0);
        cpu.cycles += 7;
        return 7;
    }

    uint8_t op = RD(cpu.pc++);
    uint16_t addr = 0, base;
    int crossed = 0;
    cyc = base_cycles[op];

    switch (modes[op]) {
    case ABS: addr = rd16(cpu.pc); cpu.pc += 2; break;
    case ABX:
        base = rd16(cpu.pc); cpu.pc += 2;
        addr = base + cpu.x;
        crossed = (base ^ addr) & 0xFF00;
        break;
    case ABY:
        base = rd16(cpu.pc); cpu.pc += 2;
        addr = base + cpu.y;
        crossed = (base ^ addr) & 0xFF00;
        break;
    case IMM: addr = cpu.pc++; break;
    case IZX: addr = rd16_zp((uint8_t)(RD(cpu.pc++) + cpu.x)); break;
    case IND: {
        uint16_t p = rd16(cpu.pc);
        cpu.pc += 2;
        /* The 6502 never carries into the high byte of the pointer. */
        uint16_t lo = RD(p);
        addr = lo | (uint16_t)RD((p & 0xFF00) | ((p + 1) & 0xFF)) << 8;
        break;
    }
    case IZY:
        base = rd16_zp(RD(cpu.pc++));
        addr = base + cpu.y;
        crossed = (base ^ addr) & 0xFF00;
        break;
    case REL: {
        int8_t off = (int8_t)RD(cpu.pc++);
        addr = cpu.pc + off;
        break;
    }
    case ZP: addr = RD(cpu.pc++); break;
    case ZPX: addr = (uint8_t)(RD(cpu.pc++) + cpu.x); break;
    case ZPY: addr = (uint8_t)(RD(cpu.pc++) + cpu.y); break;
    default: break; /* IMP, ACC */
    }
    if (crossed && page_penalty[op]) cyc++;

#define BRANCH(cond) \
    if (cond) { cyc += 1 + (((cpu.pc ^ addr) & 0xFF00) != 0); cpu.pc = addr; } break

    uint8_t m;
    switch (op) {
    /* loads and stores */
    case 0xA9: case 0xA5: case 0xB5: case 0xAD: case 0xBD: case 0xB9: case 0xA1: case 0xB1:
        cpu.a = RD(addr); setzn(cpu.a); break;
    case 0xA2: case 0xA6: case 0xB6: case 0xAE: case 0xBE:
        cpu.x = RD(addr); setzn(cpu.x); break;
    case 0xA0: case 0xA4: case 0xB4: case 0xAC: case 0xBC:
        cpu.y = RD(addr); setzn(cpu.y); break;
    case 0x85: case 0x95: case 0x8D: case 0x9D: case 0x99: case 0x81: case 0x91:
        WR(addr, cpu.a); break;
    case 0x86: case 0x96: case 0x8E: WR(addr, cpu.x); break;
    case 0x84: case 0x94: case 0x8C: WR(addr, cpu.y); break;

    /* transfers and stack */
    case 0xAA: cpu.x = cpu.a; setzn(cpu.x); break;
    case 0xA8: cpu.y = cpu.a; setzn(cpu.y); break;
    case 0xBA: cpu.x = cpu.s; setzn(cpu.x); break;
    case 0x8A: cpu.a = cpu.x; setzn(cpu.a); break;
    case 0x9A: cpu.s = cpu.x; break;
    case 0x98: cpu.a = cpu.y; setzn(cpu.a); break;
    case 0x48: push(cpu.a); break;
    case 0x08: push(cpu.p | FB | FU); break;
    case 0x68: cpu.a = pull(); setzn(cpu.a); break;
    case 0x28: cpu.p = (pull() & ~FB) | FU; break;

    /* arithmetic and logic */
    case 0x09: case 0x05: case 0x15: case 0x0D: case 0x1D: case 0x19: case 0x01: case 0x11:
        cpu.a |= RD(addr); setzn(cpu.a); break;
    case 0x29: case 0x25: case 0x35: case 0x2D: case 0x3D: case 0x39: case 0x21: case 0x31:
        cpu.a &= RD(addr); setzn(cpu.a); break;
    case 0x49: case 0x45: case 0x55: case 0x4D: case 0x5D: case 0x59: case 0x41: case 0x51:
        cpu.a ^= RD(addr); setzn(cpu.a); break;
    case 0x69: case 0x65: case 0x75: case 0x6D: case 0x7D: case 0x79: case 0x61: case 0x71:
        adc(RD(addr)); break;
    case 0xE9: case 0xEB: case 0xE5: case 0xF5: case 0xED: case 0xFD: case 0xF9: case 0xE1: case 0xF1:
        adc(~RD(addr)); break;
    case 0xC9: case 0xC5: case 0xD5: case 0xCD: case 0xDD: case 0xD9: case 0xC1: case 0xD1:
        compare(cpu.a, RD(addr)); break;
    case 0xE0: case 0xE4: case 0xEC: compare(cpu.x, RD(addr)); break;
    case 0xC0: case 0xC4: case 0xCC: compare(cpu.y, RD(addr)); break;
    case 0x24: case 0x2C:
        m = RD(addr);
        cpu.p = (cpu.p & ~(FZ | FV | FN)) | (m & (FV | FN)) | ((cpu.a & m) ? 0 : FZ);
        break;

    /* increments and decrements */
    case 0xE6: case 0xF6: case 0xEE: case 0xFE:
        m = RD(addr) + 1; WR(addr, m); setzn(m); break;
    case 0xC6: case 0xD6: case 0xCE: case 0xDE:
        m = RD(addr) - 1; WR(addr, m); setzn(m); break;
    case 0xE8: cpu.x++; setzn(cpu.x); break;
    case 0xC8: cpu.y++; setzn(cpu.y); break;
    case 0xCA: cpu.x--; setzn(cpu.x); break;
    case 0x88: cpu.y--; setzn(cpu.y); break;

    /* shifts */
    case 0x0A: cpu.a = asl(cpu.a); break;
    case 0x4A: cpu.a = lsr(cpu.a); break;
    case 0x2A: cpu.a = rol(cpu.a); break;
    case 0x6A: cpu.a = ror(cpu.a); break;
    case 0x06: case 0x16: case 0x0E: case 0x1E: WR(addr, asl(RD(addr))); break;
    case 0x46: case 0x56: case 0x4E: case 0x5E: WR(addr, lsr(RD(addr))); break;
    case 0x26: case 0x36: case 0x2E: case 0x3E: WR(addr, rol(RD(addr))); break;
    case 0x66: case 0x76: case 0x6E: case 0x7E: WR(addr, ror(RD(addr))); break;

    /* jumps and returns */
    case 0x4C: case 0x6C: cpu.pc = addr; break;
    case 0x20:
        cpu.pc--;
        push(cpu.pc >> 8); push(cpu.pc & 0xFF);
        cpu.pc = addr;
        break;
    case 0x60: {
        uint16_t lo = pull();
        cpu.pc = (lo | (uint16_t)pull() << 8) + 1;
        break;
    }
    case 0x40: {
        cpu.p = (pull() & ~FB) | FU;
        uint16_t lo = pull();
        cpu.pc = lo | (uint16_t)pull() << 8;
        break;
    }
    case 0x00: cpu.pc++; interrupt(0xFFFE, 1); break;

    /* branches */
    case 0x10: BRANCH(!(cpu.p & FN));
    case 0x30: BRANCH(cpu.p & FN);
    case 0x50: BRANCH(!(cpu.p & FV));
    case 0x70: BRANCH(cpu.p & FV);
    case 0x90: BRANCH(!(cpu.p & FC));
    case 0xB0: BRANCH(cpu.p & FC);
    case 0xD0: BRANCH(!(cpu.p & FZ));
    case 0xF0: BRANCH(cpu.p & FZ);

    /* flags */
    case 0x18: cpu.p &= ~FC; break;
    case 0x38: cpu.p |= FC; break;
    case 0x58: cpu.p &= ~FI; break;
    case 0x78: cpu.p |= FI; break;
    case 0xB8: cpu.p &= ~FV; break;
    case 0xD8: cpu.p &= ~FD; break;
    case 0xF8: cpu.p |= FD; break;

    /* unofficial opcodes */
    case 0xA3: case 0xA7: case 0xAF: case 0xB3: case 0xB7: case 0xBF: case 0xAB:
        cpu.a = cpu.x = RD(addr); setzn(cpu.a); break;                  /* LAX */
    case 0x83: case 0x87: case 0x8F: case 0x97:
        WR(addr, cpu.a & cpu.x); break;                                 /* SAX */
    case 0xC3: case 0xC7: case 0xCF: case 0xD3: case 0xD7: case 0xDB: case 0xDF:
        m = RD(addr) - 1; WR(addr, m); compare(cpu.a, m); break;        /* DCP */
    case 0xE3: case 0xE7: case 0xEF: case 0xF3: case 0xF7: case 0xFB: case 0xFF:
        m = RD(addr) + 1; WR(addr, m); adc(~m); break;                  /* ISB */
    case 0x03: case 0x07: case 0x0F: case 0x13: case 0x17: case 0x1B: case 0x1F:
        m = asl(RD(addr)); WR(addr, m); cpu.a |= m; setzn(cpu.a); break; /* SLO */
    case 0x23: case 0x27: case 0x2F: case 0x33: case 0x37: case 0x3B: case 0x3F:
        m = rol(RD(addr)); WR(addr, m); cpu.a &= m; setzn(cpu.a); break; /* RLA */
    case 0x43: case 0x47: case 0x4F: case 0x53: case 0x57: case 0x5B: case 0x5F:
        m = lsr(RD(addr)); WR(addr, m); cpu.a ^= m; setzn(cpu.a); break; /* SRE */
    case 0x63: case 0x67: case 0x6F: case 0x73: case 0x77: case 0x7B: case 0x7F:
        m = ror(RD(addr)); WR(addr, m); adc(m); break;                  /* RRA */
    case 0x0B: case 0x2B:
        cpu.a &= RD(addr); setzn(cpu.a); setc(cpu.a & 0x80); break;     /* ANC */
    case 0x4B: cpu.a = lsr(cpu.a & RD(addr)); break;                    /* ALR */
    case 0x6B:                                                          /* ARR */
        cpu.a &= RD(addr);
        cpu.a = (uint8_t)(cpu.a >> 1) | (uint8_t)((cpu.p & FC) << 7);
        setzn(cpu.a);
        setc(cpu.a & 0x40);
        cpu.p = (cpu.p & ~FV) | ((((cpu.a >> 6) ^ (cpu.a >> 5)) & 1) ? FV : 0);
        break;
    case 0xCB: {                                                        /* AXS */
        uint8_t ax = cpu.a & cpu.x;
        m = RD(addr);
        setc(ax >= m);
        cpu.x = ax - m;
        setzn(cpu.x);
        break;
    }
    default: break; /* NOPs (official and unofficial), KIL, unstable stores */
    }
#undef BRANCH

    cyc += cpu.stall;
    cpu.stall = 0;
    cpu.cycles += (uint64_t)cyc;
    return cyc;
}
