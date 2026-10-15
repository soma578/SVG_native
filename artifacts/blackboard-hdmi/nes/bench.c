/* Measure write throughput into the /dev/mem framebuffer mapping. */
#include <fcntl.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
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
    const size_t bytes = 768 * 720 * 4; /* one NES frame scaled x3 */
    static uint32_t src[768 * 720];
    for (size_t i = 0; i < 768 * 720; ++i) src[i] = (uint32_t)i * 2654435761u;
    for (int sync = 1; sync >= 0; --sync) {
        int fd = open("/dev/mem", O_RDWR | (sync ? O_SYNC : 0));
        uint32_t *fb = mmap(NULL, 1280 * 720 * 4, PROT_READ | PROT_WRITE, MAP_SHARED, fd, 0x1E000000);
        if (fb == MAP_FAILED) { perror("mmap"); return 1; }
        double t = now();
        for (int n = 0; n < 10; ++n)
            for (int y = 0; y < 720; ++y)
                memcpy(fb + y * 1280 + 256, src + y * 768, 768 * 4);
        t = (now() - t) / 10;
        printf("O_SYNC=%d memcpy: %.2f ms/frame, %.1f MB/s\n", sync, t * 1e3, bytes / t / 1e6);
        t = now();
        for (int n = 0; n < 10; ++n)
            for (int y = 0; y < 720; ++y)
                for (int x = 0; x < 768; ++x) ((volatile uint32_t *)fb)[y * 1280 + 256 + x] = src[y * 768 + x];
        t = (now() - t) / 10;
        printf("O_SYNC=%d word loop: %.2f ms/frame\n", sync, t * 1e3);
        munmap(fb, 1280 * 720 * 4);
    }
    return 0;
}
