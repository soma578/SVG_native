/* Dump the video pipeline registers of the running PL design. Needs root. */
#include <fcntl.h>
#include <stdint.h>
#include <stdio.h>
#include <sys/mman.h>
#include <unistd.h>

static volatile uint32_t *map(int fd, uint32_t base)
{
    void *p = mmap(NULL, 0x10000, PROT_READ, MAP_SHARED, fd, base);
    if (p == MAP_FAILED) { perror("mmap"); return NULL; }
    return p;
}

static void dump(int fd, const char *name, uint32_t base, unsigned words)
{
    volatile uint32_t *r = map(fd, base);
    if (!r) return;
    printf("== %s @ %08x\n", name, base);
    for (unsigned i = 0; i < words; i += 4)
        printf("  +%03x: %08x %08x %08x %08x\n", i * 4,
               r[i], r[i + 1], r[i + 2], r[i + 3]);
    munmap((void *)r, 0x10000);
}

int main(void)
{
    int fd = open("/dev/mem", O_RDONLY | O_SYNC);
    if (fd < 0) { perror("/dev/mem"); return 1; }
    dump(fd, "VDMA", 0x43000000, 0x100 / 4);
    dump(fd, "VTC", 0x43c30000, 0x80 / 4);
    dump(fd, "CLK_WIZ status", 0x43c40000, 0x10 / 4);
    {
        volatile uint32_t *r = map(fd, 0x43c40000);
        if (r) {
            printf("== CLK_WIZ cfg @ +200\n");
            for (unsigned i = 0x200 / 4; i < 0x260 / 4; i += 4)
                printf("  +%03x: %08x %08x %08x %08x\n", i * 4,
                       r[i], r[i + 1], r[i + 2], r[i + 3]);
        }
    }
    for (uint32_t g = 0x41200000; g <= 0x41230000; g += 0x10000)
        dump(fd, "GPIO", g, 0x10 / 4);
    return 0;
}
