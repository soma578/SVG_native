/* Star Catcher: move the basket with Left/Right, catch the falling stars and
 * dodge the rocks. A dropped star or a caught rock is a miss; three misses
 * end the game. START begins a game and pauses. Built with cc65 for NROM. */

#define PPUCTRL   (*(volatile unsigned char *)0x2000)
#define PPUMASK   (*(volatile unsigned char *)0x2001)
#define PPUADDR   (*(volatile unsigned char *)0x2006)
#define PPUDATA   (*(volatile unsigned char *)0x2007)
#define JOY1      (*(volatile unsigned char *)0x4016)

/* Shared with crt0.s */
extern volatile unsigned char nmi_count;
extern unsigned char ppu_ctrl;
extern unsigned int upd_addr;
extern volatile unsigned char upd_len;
extern unsigned char upd_buf[32];
extern unsigned char oam[256];

#define PAD_A      0x80
#define PAD_B      0x40
#define PAD_SELECT 0x20
#define PAD_START  0x10
#define PAD_UP     0x08
#define PAD_DOWN   0x04
#define PAD_LEFT   0x02
#define PAD_RIGHT  0x01

#define NT(x, y)   (0x2000 + (y) * 32 + (x))

#define TILE_BASKET 0x80
#define TILE_STAR   0x84
#define TILE_ROCK   0x85
#define TILE_GROUND 0x86
#define TILE_SPARK  0x87

#define PLAYER_Y   192      /* top of the 16x16 basket */
#define GROUND_Y   208
#define MAX_OBJ    8
#define MAX_MISS   3

static const unsigned char palette[32] = {
    0x0F, 0x30, 0x10, 0x28,  0x0F, 0x1A, 0x07, 0x17,
    0x0F, 0x30, 0x10, 0x28,  0x0F, 0x30, 0x10, 0x28,
    0x0F, 0x17, 0x27, 0x37,  0x0F, 0x28, 0x30, 0x38,
    0x0F, 0x00, 0x10, 0x30,  0x0F, 0x16, 0x27, 0x30,
};

static unsigned char pad, pad_prev, pressed;
static unsigned int seed = 0xACE1;

static unsigned char player_x;
static unsigned int score, hiscore;
static unsigned char misses;
static unsigned char spawn_timer;

static unsigned char obj_on[MAX_OBJ];
static unsigned char obj_rock[MAX_OBJ];
static unsigned char obj_x[MAX_OBJ];
static unsigned int obj_y16[MAX_OBJ];    /* y in 1/16 pixel */
static unsigned char obj_speed[MAX_OBJ];

static unsigned char i, n;

static void wait_frame(void)
{
    n = nmi_count;
    while (n == nmi_count) {}
}

static void read_pad(void)
{
    pad_prev = pad;
    JOY1 = 1;
    JOY1 = 0;
    pad = 0;
    for (i = 0; i < 8; ++i) pad = (pad << 1) | (JOY1 & 1);
    pressed = pad & ~pad_prev;
}

static unsigned char rnd(void)
{
    static unsigned char k;
    for (k = 0; k < 8; ++k)
        seed = (seed >> 1) ^ (-(seed & 1u) & 0xB400u);
    return (unsigned char)seed;
}

/* ---- direct VRAM access, only while rendering and NMI are off ---- */

static void ppu_off(void)
{
    if (ppu_ctrl & 0x80) wait_frame();  /* no NMI to wait for at power-on */
    ppu_ctrl = 0;
    PPUCTRL = 0;
    PPUMASK = 0;
}

static void ppu_on(void)
{
    ppu_ctrl = 0x80;            /* NMI on, everything from pattern table 0 */
    PPUCTRL = ppu_ctrl;
    wait_frame();
    PPUMASK = 0x1E;
}

static void vram_addr(unsigned int addr)
{
    PPUADDR = (unsigned char)(addr >> 8);
    PPUADDR = (unsigned char)addr;
}

static void vram_text(unsigned int addr, const char *s)
{
    vram_addr(addr);
    while (*s) PPUDATA = *s++;
}

/* ---- queued VRAM update, copied by the NMI during vblank ---- */

static void queue_text(unsigned int addr, const char *s)
{
    while (upd_len) {}
    upd_addr = addr;
    for (n = 0; s[n]; ++n) upd_buf[n] = s[n];
    upd_len = n;
    wait_frame();
}

static char hud[] = "SCORE 0000  HI 0000  MISS 0";

static void put_number(char *dst, unsigned int v)
{
    dst[3] = '0' + v % 10; v /= 10;
    dst[2] = '0' + v % 10; v /= 10;
    dst[1] = '0' + v % 10; v /= 10;
    dst[0] = '0' + v % 10;
}

static void update_hud(void)
{
    put_number(hud + 6, score);
    put_number(hud + 15, hiscore);
    hud[26] = '0' + misses;
}

static void draw_field(void)
{
    unsigned int a;
    ppu_off();

    vram_addr(0x3F00);
    for (i = 0; i < 32; ++i) PPUDATA = palette[i];

    vram_addr(0x2000);
    for (a = 0; a < 960; ++a) PPUDATA = ' ';
    for (i = 0; i < 40; ++i) {
        a = NT(rnd() & 31, 3 + rnd() % 22);
        vram_addr(a);
        PPUDATA = TILE_SPARK;
    }
    vram_addr(NT(0, 26));
    for (a = 0; a < 4 * 32; ++a) PPUDATA = TILE_GROUND;

    /* Attributes: palette 1 for the ground rows 26-29, palette 0 elsewhere. */
    vram_addr(0x23C0);
    for (i = 0; i < 48; ++i) PPUDATA = 0x00;
    for (i = 0; i < 8; ++i) PPUDATA = 0x50;
    for (i = 0; i < 8; ++i) PPUDATA = 0x55;

    update_hud();
    vram_text(NT(2, 1), hud);
}

static void clear_objects(void)
{
    for (i = 0; i < MAX_OBJ; ++i) obj_on[i] = 0;
    for (i = 0; i < 255; ++i) oam[i] = 0xFF;
    oam[255] = 0xFF;
}

static void draw_sprites(void)
{
    /* Basket: sprites 0-3 */
    oam[0] = PLAYER_Y - 1; oam[1] = TILE_BASKET;     oam[2] = 0; oam[3] = player_x;
    oam[4] = PLAYER_Y - 1; oam[5] = TILE_BASKET + 1; oam[6] = 0; oam[7] = player_x + 8;
    oam[8] = PLAYER_Y + 7; oam[9] = TILE_BASKET + 2; oam[10] = 0; oam[11] = player_x;
    oam[12] = PLAYER_Y + 7; oam[13] = TILE_BASKET + 3; oam[14] = 0; oam[15] = player_x + 8;

    for (i = 0; i < MAX_OBJ; ++i) {
        n = 16 + i * 4;
        if (obj_on[i]) {
            oam[n] = (unsigned char)(obj_y16[i] >> 4) - 1;
            oam[n + 1] = obj_rock[i] ? TILE_ROCK : TILE_STAR;
            oam[n + 2] = obj_rock[i] ? 2 : 1;
            oam[n + 3] = obj_x[i];
        } else {
            oam[n] = 0xFF;
        }
    }
}

static void spawn(void)
{
    unsigned char level;
    for (i = 0; i < MAX_OBJ; ++i) {
        if (!obj_on[i]) break;
    }
    if (i == MAX_OBJ) return;

    n = i;
    level = score > 60 ? 30 : (unsigned char)(score / 2);
    obj_on[n] = 1;
    obj_rock[n] = (rnd() & 3) == 0;
    obj_x[n] = 8 + rnd() % 232;
    obj_y16[n] = 16 << 4;
    obj_speed[n] = 14 + level + (rnd() & 15);

    spawn_timer = 50 - level + (rnd() & 15);
}

static void miss(void)
{
    ++misses;
    update_hud();
    queue_text(NT(2, 1), hud);
}

static void update_objects(void)
{
    unsigned char y;
    for (i = 0; i < MAX_OBJ; ++i) {
        if (!obj_on[i]) continue;
        obj_y16[i] += obj_speed[i];
        y = (unsigned char)(obj_y16[i] >> 4);

        if (y + 8 > PLAYER_Y + 5 && y < PLAYER_Y + 12 &&
            obj_x[i] + 8 > player_x + 1 && obj_x[i] < player_x + 15) {
            obj_on[i] = 0;
            if (obj_rock[i]) {
                miss();
            } else {
                ++score;
                if (score > hiscore) hiscore = score;
                update_hud();
                queue_text(NT(2, 1), hud);
            }
        } else if (y + 8 >= GROUND_Y) {
            obj_on[i] = 0;
            if (!obj_rock[i]) miss();
        }
    }
}

static void wait_start(void)
{
    do {
        wait_frame();
        read_pad();
        rnd();                  /* the wait time seeds the game */
    } while (!(pressed & PAD_START));
}

static void title(void)
{
    clear_objects();
    draw_field();
    vram_text(NT(10, 9), "STAR CATCHER");
    vram_text(NT(5, 13), "CATCH STARS, AVOID ROCKS");
    vram_text(NT(10, 17), "PRESS START");
    player_x = 120;
    draw_sprites();
    ppu_on();
    wait_start();
    queue_text(NT(10, 9), "            ");
    queue_text(NT(5, 13), "                        ");
    queue_text(NT(10, 17), "           ");
}

static void play(void)
{
    score = 0;
    misses = 0;
    spawn_timer = 30;
    player_x = 120;
    clear_objects();
    update_hud();
    queue_text(NT(2, 1), hud);

    while (misses < MAX_MISS) {
        wait_frame();
        read_pad();

        if (pressed & PAD_START) {
            queue_text(NT(13, 13), "PAUSE");
            wait_start();
            queue_text(NT(13, 13), "     ");
        }

        n = (pad & PAD_B) ? 4 : 2;      /* hold B to dash */
        if ((pad & PAD_LEFT) && player_x > n) player_x -= n;
        if ((pad & PAD_RIGHT) && player_x < 240 - n) player_x += n;

        if (--spawn_timer == 0) spawn();
        update_objects();
        draw_sprites();
    }

    queue_text(NT(11, 12), "GAME OVER");
    queue_text(NT(10, 16), "PRESS START");
    wait_start();
    queue_text(NT(11, 12), "         ");
    queue_text(NT(10, 16), "           ");
}

void main(void)
{
    title();
    for (;;) play();
}
