#include "input.h"

#include <errno.h>
#include <fcntl.h>
#include <linux/input.h>
#include <stdio.h>
#include <sys/stat.h>
#include <time.h>
#include <unistd.h>

#include "video.h"

#define MAX_EVENT_DEVICES 32

static int fds[MAX_EVENT_DEVICES] = { [0 ... MAX_EVENT_DEVICES - 1] = -1 };
static uint8_t keys;
static int esc;
static time_t last_check;
static struct timespec dir_mtime;

static int is_keyboard(int fd)
{
    unsigned long bits[(KEY_MAX + 8 * sizeof(long)) / (8 * sizeof(long))] = { 0 };
    if (ioctl(fd, EVIOCGBIT(EV_KEY, sizeof bits), bits) < 0) return 0;
#define HAS(k) (bits[(k) / (8 * sizeof(long))] >> ((k) % (8 * sizeof(long))) & 1)
    return HAS(KEY_Z) && HAS(KEY_X) && HAS(KEY_ENTER);
#undef HAS
}

static void scan_devices(void)
{
    for (int i = 0; i < MAX_EVENT_DEVICES; ++i) {
        if (fds[i] >= 0) continue;
        char path[32];
        snprintf(path, sizeof path, "/dev/input/event%d", i);
        int fd = open(path, O_RDONLY | O_NONBLOCK);
        if (fd < 0) continue;
        if (!is_keyboard(fd)) { close(fd); continue; }
        ioctl(fd, EVIOCGRAB, 1);
        fds[i] = fd;
        printf("keyboard: %s\n", path);
        fflush(stdout);
    }
}

static uint8_t key_bit(int code)
{
    switch (code) {
    case KEY_X: case KEY_K: return 1 << 0;              /* A */
    case KEY_Z: case KEY_J: return 1 << 1;              /* B */
    case KEY_RIGHTSHIFT: case KEY_SPACE: return 1 << 2; /* Select */
    case KEY_ENTER: case KEY_KPENTER: return 1 << 3;    /* Start */
    case KEY_UP: case KEY_W: return 1 << 4;
    case KEY_DOWN: case KEY_S: return 1 << 5;
    case KEY_LEFT: case KEY_A: return 1 << 6;
    case KEY_RIGHT: case KEY_D: return 1 << 7;
    default: return 0;
    }
}

uint8_t input_poll(int *reset)
{
    /* Hotplug: rescan only when /dev/input changes. Opening a USB HID
     * device can block for tens of milliseconds, so never poll by opening. */
    time_t now = time(NULL);
    if (now != last_check) {
        last_check = now;
        struct stat st;
        if (stat("/dev/input", &st) == 0 &&
            (st.st_mtim.tv_sec != dir_mtime.tv_sec || st.st_mtim.tv_nsec != dir_mtime.tv_nsec)) {
            dir_mtime = st.st_mtim;
            scan_devices();
        }
    }
    for (int i = 0; i < MAX_EVENT_DEVICES; ++i) {
        if (fds[i] < 0) continue;
        struct input_event ev;
        ssize_t n;
        while ((n = read(fds[i], &ev, sizeof ev)) == (ssize_t)sizeof ev) {
            if (ev.type != EV_KEY) continue;
            if (ev.code == KEY_ESC && ev.value == 1) esc = 1;
            uint8_t bit = key_bit(ev.code);
            if (ev.value) keys |= bit;      /* 1 = press, 2 = autorepeat */
            else keys &= (uint8_t)~bit;
        }
        if (n < 0 && errno != EAGAIN) {     /* unplugged */
            close(fds[i]);
            fds[i] = -1;
            keys = 0;
        }
    }
    *reset = esc;
    esc = 0;

    uint32_t b = board_buttons();
    uint8_t board = (uint8_t)(((b & 1) ? 1 << 3 : 0) | ((b & 2) ? 1 << 2 : 0) |
                              ((b & 4) ? 1 << 1 : 0) | ((b & 8) ? 1 << 0 : 0));
    uint8_t pad = keys | board;
    /* A real D-pad cannot press opposite directions at once. */
    if ((pad & 0x30) == 0x30) pad &= (uint8_t)~0x30;
    if ((pad & 0xC0) == 0xC0) pad &= (uint8_t)~0xC0;
    return pad;
}
