/* Dump a window of 32-bit registers: sudo ./regdump <phys-hex> <bytes-hex> */
#include <fcntl.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <sys/mman.h>

int main(int argc, char **argv)
{
    if (argc < 3) { fprintf(stderr, "usage: %s base len\n", argv[0]); return 2; }
    uint32_t base = strtoul(argv[1], NULL, 16), len = strtoul(argv[2], NULL, 16);
    int fd = open("/dev/mem", O_RDONLY | O_SYNC);
    if (fd < 0) { perror("/dev/mem"); return 1; }
    volatile uint32_t *r = mmap(NULL, 0x10000, PROT_READ, MAP_SHARED, fd, base);
    if (r == MAP_FAILED) { perror("mmap"); return 1; }
    for (uint32_t i = 0; i < len / 4; i += 4)
        printf("+%03x: %08x %08x %08x %08x\n", i * 4, r[i], r[i + 1], r[i + 2], r[i + 3]);
    return 0;
}
