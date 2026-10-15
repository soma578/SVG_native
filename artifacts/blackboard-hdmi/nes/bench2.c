/* Compare store widths into the uncached framebuffer mapping. */
#include <arm_neon.h>
#include <fcntl.h>
#include <stdint.h>
#include <stdio.h>
#include <sys/mman.h>
#include <time.h>

static double now(void)
{
    struct timespec t;
    clock_gettime(CLOCK_MONOTONIC, &t);
    return t.tv_sec + t.tv_nsec * 1e-9;
}

int main(void)
{
    int fd = open("/dev/mem", O_RDWR);
    uint32_t *fb = mmap(NULL, 1280 * 720 * 4, PROT_READ | PROT_WRITE, MAP_SHARED, fd, 0x1E000000);
    if (fb == MAP_FAILED) { perror("mmap"); return 1; }
    const size_t words = 768 * 720;
    double t = now();
    for (int n = 0; n < 10; ++n) {
        uint32x4_t v = vdupq_n_u32(n * 0x010203);
        for (int y = 0; y < 720; ++y) {
            uint32_t *p = fb + y * 1280 + 256;
            for (int x = 0; x < 768; x += 16) {
                vst1q_u32(p + x, v); vst1q_u32(p + x + 4, v);
                vst1q_u32(p + x + 8, v); vst1q_u32(p + x + 12, v);
            }
        }
    }
    t = (now() - t) / 10;
    printf("neon q stores: %.2f ms/frame %.1f MB/s\n", t * 1e3, words * 4 / t / 1e6);
    t = now();
    for (int n = 0; n < 10; ++n) {
        for (int y = 0; y < 720; ++y) {
            uint32_t *p = fb + y * 1280 + 256;
            for (int x = 0; x < 768; x += 8)
                __asm__ volatile("stmia %0, {r4-r11}" :: "r"(p + x) : "memory");
        }
    }
    t = (now() - t) / 10;
    printf("stm 8 regs: %.2f ms/frame %.1f MB/s\n", t * 1e3, words * 4 / t / 1e6);
    return 0;
}
