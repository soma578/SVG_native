/* Run nestest.nes in automation mode (PC=$C000) and compare every
 * instruction's registers and cycle count against nestest.log.
 * Usage: ./nestest nestest.nes nestest.log */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "../nes.h"

static unsigned field(const char *line, const char *key)
{
    const char *p = strstr(line, key);
    return p ? (unsigned)strtoul(p + strlen(key), NULL, 16) : 0xFFFFFFFFu;
}

int main(int argc, char **argv)
{
    if (argc < 3) { fprintf(stderr, "usage: %s rom log\n", argv[0]); return 2; }
    if (cart_load(argv[1])) return 1;
    FILE *log = fopen(argv[2], "r");
    if (!log) { perror(argv[2]); return 1; }
    nes_reset();
    cpu.pc = 0xC000;
    cpu.p = 0x24;
    cpu.cycles = 7;

    char line[256];
    int n = 0;
    while (fgets(line, sizeof line, log)) {
        ++n;
        unsigned pc = (unsigned)strtoul(line, NULL, 16);
        unsigned a = field(line, "A:"), x = field(line, "X:"), y = field(line, "Y:");
        unsigned p = field(line, "P:"), sp = field(line, "SP:");
        const char *c = strstr(line, "CYC:");
        unsigned long long cyc = c ? strtoull(c + 4, NULL, 10) : 0;
        if (pc != cpu.pc || a != cpu.a || x != cpu.x || y != cpu.y || p != cpu.p ||
            sp != cpu.s || cyc != cpu.cycles) {
            printf("MISMATCH at log line %d\n  expected: %s", n, line);
            printf("  got:      %04X A:%02X X:%02X Y:%02X P:%02X SP:%02X CYC:%llu\n",
                   cpu.pc, cpu.a, cpu.x, cpu.y, cpu.p, cpu.s,
                   (unsigned long long)cpu.cycles);
            return 1;
        }
        ppu_step(cpu_step() * 3);
    }
    printf("nestest: all %d instructions match; result codes $02=%02X $03=%02X\n",
           n, bus_read(2), bus_read(3));
    return bus_read(2) || bus_read(3);
}
