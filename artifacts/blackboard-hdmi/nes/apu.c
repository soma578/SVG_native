/* 2A03 APU: two pulses, triangle, noise and DMC with the frame counter,
 * mixed through the console's non-linear DACs into 48 kHz mono samples.
 * Work is deferred: cycles are only accumulated until a sample, a frame
 * counter event or a register access needs the channels to be current. */
#include "nes.h"

#define CPU_HZ 1789773

static const uint8_t length_table[32] = {
    10, 254, 20, 2, 40, 4, 80, 6, 160, 8, 60, 10, 14, 12, 26, 14,
    12, 16, 24, 18, 48, 20, 96, 22, 192, 24, 72, 26, 16, 28, 32, 30,
};
static const uint8_t duty_table[4][8] = {
    { 0, 1, 0, 0, 0, 0, 0, 0 },
    { 0, 1, 1, 0, 0, 0, 0, 0 },
    { 0, 1, 1, 1, 1, 0, 0, 0 },
    { 1, 0, 0, 1, 1, 1, 1, 1 },
};
static const uint8_t triangle_table[32] = {
    15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0,
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
};
/* NTSC periods in CPU cycles */
static const uint16_t noise_periods[16] = {
    4, 8, 16, 32, 64, 96, 128, 160, 202, 254, 380, 508, 762, 1016, 2034, 4068,
};
static const uint16_t dmc_periods[16] = {
    428, 380, 340, 320, 286, 254, 226, 214, 190, 160, 142, 128, 106, 84, 72, 54,
};

struct envelope {
    uint8_t start, loop, constant, volume, divider, decay;
};

struct pulse {
    int enabled, ones_complement;
    uint8_t duty, step, length;
    uint16_t period;
    int timer;
    struct envelope env;
    uint8_t sweep_on, sweep_period, sweep_negate, sweep_shift, sweep_reload, sweep_divider;
};

static struct pulse pulse[2];

static struct {
    int enabled, control;
    uint8_t step, length, linear, linear_period, linear_reload;
    uint16_t period;
    int timer;
} tri;

static struct {
    int enabled, mode;
    uint8_t length;
    uint16_t period, shift;
    int timer;
    struct envelope env;
} noise;

static struct {
    int irq_enabled, loop, irq;
    uint16_t period, start_addr, start_length, addr, remaining;
    int timer;
    uint8_t output, buffer, buffer_full, shift, bits, silence;
} dmc;

static struct {
    int five_step, irq_inhibit, irq;
    int cycle;              /* CPU cycles into the current sequence */
} frame;

static int pending;         /* CPU cycles not yet applied to the channels */
static int to_next_event;   /* cycles until the next sample or frame event */
static uint32_t sample_acc; /* sample clock: + 48000 per cycle, wraps at CPU_HZ */
static float pulse_mix[31], tnd_mix[203];
static float hp_in, hp_out;

int16_t apu_samples[APU_MAX_SAMPLES];
int apu_sample_count;

/* ---- channel units ---- */

static void envelope_clock(struct envelope *e)
{
    if (e->start) {
        e->start = 0;
        e->decay = 15;
        e->divider = e->volume;
    } else if (e->divider == 0) {
        e->divider = e->volume;
        if (e->decay) e->decay--;
        else if (e->loop) e->decay = 15;
    } else {
        e->divider--;
    }
}

static inline uint8_t envelope_out(const struct envelope *e)
{
    return e->constant ? e->volume : e->decay;
}

static int sweep_target(const struct pulse *p)
{
    int change = p->period >> p->sweep_shift;
    if (p->sweep_negate) return p->period - change - p->ones_complement;
    return p->period + change;
}

static inline int pulse_muted(const struct pulse *p)
{
    return p->period < 8 || sweep_target(p) > 0x7FF;
}

static void sweep_clock(struct pulse *p)
{
    if (p->sweep_divider == 0 && p->sweep_on && p->sweep_shift && !pulse_muted(p)) {
        int target = sweep_target(p);
        if (target >= 0) p->period = (uint16_t)target;
    }
    if (p->sweep_divider == 0 || p->sweep_reload) {
        p->sweep_divider = p->sweep_period;
        p->sweep_reload = 0;
    } else {
        p->sweep_divider--;
    }
}

static void quarter_frame(void)
{
    envelope_clock(&pulse[0].env);
    envelope_clock(&pulse[1].env);
    envelope_clock(&noise.env);
    if (tri.linear_reload) tri.linear = tri.linear_period;
    else if (tri.linear) tri.linear--;
    if (!tri.control) tri.linear_reload = 0;
}

static void half_frame(void)
{
    for (int i = 0; i < 2; ++i) {
        if (!pulse[i].env.loop && pulse[i].length) pulse[i].length--;
        sweep_clock(&pulse[i]);
    }
    if (!tri.control && tri.length) tri.length--;
    if (!noise.env.loop && noise.length) noise.length--;
}

static void dmc_fetch(void)
{
    if (dmc.buffer_full || !dmc.remaining) return;
    dmc.buffer = bus_read(dmc.addr);
    dmc.buffer_full = 1;
    dmc.addr = dmc.addr == 0xFFFF ? 0x8000 : dmc.addr + 1;
    if (--dmc.remaining == 0) {
        if (dmc.loop) {
            dmc.addr = dmc.start_addr;
            dmc.remaining = dmc.start_length;
        } else if (dmc.irq_enabled) {
            dmc.irq = 1;
        }
    }
}

static void dmc_tick(void)
{
    if (!dmc.silence) {
        if (dmc.shift & 1) { if (dmc.output <= 125) dmc.output += 2; }
        else if (dmc.output >= 2) dmc.output -= 2;
    }
    dmc.shift >>= 1;
    if (--dmc.bits == 0) {
        dmc.bits = 8;
        dmc.silence = !dmc.buffer_full;
        if (dmc.buffer_full) {
            dmc.shift = dmc.buffer;
            dmc.buffer_full = 0;
        }
    }
    dmc_fetch();
}

/* Advance every channel timer by n CPU cycles. */
static void clock_channels(int n)
{
    for (int i = 0; i < 2; ++i) {
        struct pulse *p = &pulse[i];
        p->timer -= n;
        if (p->timer <= 0) {
            int period = (p->period + 1) * 2;
            int steps = (-p->timer) / period + 1;
            p->timer += steps * period;
            p->step = (uint8_t)((p->step + steps) & 7);
        }
    }

    tri.timer -= n;
    if (tri.timer <= 0) {
        int period = tri.period + 1;
        int steps = (-tri.timer) / period + 1;
        tri.timer += steps * period;
        /* Ultrasonic periods are left frozen, as most emulators do. */
        if (tri.length && tri.linear && tri.period >= 2)
            tri.step = (uint8_t)((tri.step + steps) & 31);
    }

    noise.timer -= n;
    while (noise.timer <= 0) {
        noise.timer += noise.period;
        uint16_t bit = noise.mode ? 6 : 1;
        uint16_t feedback = (noise.shift ^ (noise.shift >> bit)) & 1;
        noise.shift = (uint16_t)((noise.shift >> 1) | (feedback << 14));
    }

    dmc.timer -= n;
    while (dmc.timer <= 0) {
        dmc.timer += dmc.period;
        dmc_tick();
    }
}

static void emit_sample(void)
{
    const struct pulse *p0 = &pulse[0], *p1 = &pulse[1];
    int a = (p0->length && !pulse_muted(p0) && duty_table[p0->duty][p0->step]) ? envelope_out(&p0->env) : 0;
    int b = (p1->length && !pulse_muted(p1) && duty_table[p1->duty][p1->step]) ? envelope_out(&p1->env) : 0;
    int t = triangle_table[tri.step];
    int nz = (noise.length && !(noise.shift & 1)) ? envelope_out(&noise.env) : 0;
    float x = pulse_mix[a + b] + tnd_mix[3 * t + 2 * nz + dmc.output];

    /* ~37 Hz high-pass, like the console's output coupling, removes DC. */
    hp_out = 0.995f * (hp_out + x - hp_in);
    hp_in = x;
    int s = (int)(hp_out * 80000.0f);
    if (s > 32767) s = 32767;
    if (s < -32768) s = -32768;
    if (apu_sample_count < APU_MAX_SAMPLES) apu_samples[apu_sample_count++] = (int16_t)s;
}

static int frame_event_cycle(void)
{
    static const int four[] = { 7457, 14913, 22371, 29829, 29830 };
    static const int five[] = { 7457, 14913, 22371, 29829, 37281, 37282 };
    const int *ev = frame.five_step ? five : four;
    while (*ev <= frame.cycle) ++ev;
    return *ev;
}

static void frame_event(void)
{
    int c = frame.cycle;
    if (c == 7457 || c == 22371) {
        quarter_frame();
    } else if (c == 14913) {
        quarter_frame();
        half_frame();
    } else if (!frame.five_step && c == 29829) {
        quarter_frame();
        half_frame();
        if (!frame.irq_inhibit) frame.irq = 1;
    } else if (frame.five_step && c == 37281) {
        quarter_frame();
        half_frame();
    } else if (c == (frame.five_step ? 37282 : 29830)) {
        frame.cycle = 0;
    }
}

/* Bring the channels up to date with all pending CPU cycles. */
static void catch_up(void)
{
    while (pending > 0) {
        int to_sample = (int)((CPU_HZ - sample_acc + 47999) / 48000);
        int to_frame = frame_event_cycle() - frame.cycle;
        int n = pending;
        if (n > to_sample) n = to_sample;
        if (n > to_frame) n = to_frame;
        clock_channels(n);
        pending -= n;
        frame.cycle += n;
        sample_acc += (uint32_t)n * 48000u;
        if (n == to_frame) frame_event();
        if (sample_acc >= CPU_HZ) {
            sample_acc -= CPU_HZ;
            emit_sample();
        }
    }
    int to_sample = (int)((CPU_HZ - sample_acc + 47999) / 48000);
    int to_frame = frame_event_cycle() - frame.cycle;
    to_next_event = to_sample < to_frame ? to_sample : to_frame;
}

void apu_run(int cycles)
{
    pending += cycles;
    if (pending >= to_next_event) catch_up();
}

int apu_irq(void)
{
    return frame.irq || dmc.irq;
}

void apu_reset(void)
{
    for (int i = 0; i < 31; ++i) pulse_mix[i] = i ? 95.52f / (8128.0f / i + 100.0f) : 0;
    for (int i = 0; i < 203; ++i) tnd_mix[i] = i ? 163.67f / (24329.0f / i + 100.0f) : 0;
    pulse[0] = (struct pulse){ .ones_complement = 1, .timer = 2 };
    pulse[1] = (struct pulse){ .timer = 2 };
    tri.timer = 1;
    tri.length = tri.linear = 0;
    noise.shift = 1;
    noise.period = noise_periods[0];
    noise.timer = noise.period;
    noise.length = 0;
    dmc.period = dmc_periods[0];
    dmc.timer = dmc.period;
    dmc.bits = 8;
    dmc.silence = 1;
    dmc.remaining = 0;
    dmc.irq = 0;
    frame.cycle = 0;
    frame.irq = 0;
    pending = 0;
    sample_acc = 0;
    apu_sample_count = 0;
    to_next_event = 1;
}

uint8_t apu_read_status(void)
{
    catch_up();
    uint8_t r = (uint8_t)((pulse[0].length ? 0x01 : 0) | (pulse[1].length ? 0x02 : 0) |
                          (tri.length ? 0x04 : 0) | (noise.length ? 0x08 : 0) |
                          (dmc.remaining ? 0x10 : 0) | (frame.irq ? 0x40 : 0) |
                          (dmc.irq ? 0x80 : 0));
    frame.irq = 0;
    return r;
}

void apu_write(uint16_t addr, uint8_t v)
{
    catch_up();
    if (addr < 0x4008) {
        struct pulse *p = &pulse[(addr >> 2) & 1];
        switch (addr & 3) {
        case 0:
            p->duty = v >> 6;
            p->env.loop = (v >> 5) & 1;
            p->env.constant = (v >> 4) & 1;
            p->env.volume = v & 15;
            break;
        case 1:
            p->sweep_on = v >> 7;
            p->sweep_period = (v >> 4) & 7;
            p->sweep_negate = (v >> 3) & 1;
            p->sweep_shift = v & 7;
            p->sweep_reload = 1;
            break;
        case 2:
            p->period = (p->period & 0x700) | v;
            break;
        case 3:
            p->period = (uint16_t)((p->period & 0xFF) | ((v & 7) << 8));
            if (p->enabled) p->length = length_table[v >> 3];
            p->step = 0;
            p->env.start = 1;
            break;
        }
        return;
    }
    switch (addr) {
    case 0x4008:
        tri.control = v >> 7;
        tri.linear_period = v & 0x7F;
        break;
    case 0x400A:
        tri.period = (tri.period & 0x700) | v;
        break;
    case 0x400B:
        tri.period = (uint16_t)((tri.period & 0xFF) | ((v & 7) << 8));
        if (tri.enabled) tri.length = length_table[v >> 3];
        tri.linear_reload = 1;
        break;
    case 0x400C:
        noise.env.loop = (v >> 5) & 1;
        noise.env.constant = (v >> 4) & 1;
        noise.env.volume = v & 15;
        break;
    case 0x400E:
        noise.mode = v >> 7;
        noise.period = noise_periods[v & 15];
        break;
    case 0x400F:
        if (noise.enabled) noise.length = length_table[v >> 3];
        noise.env.start = 1;
        break;
    case 0x4010:
        dmc.irq_enabled = v >> 7;
        dmc.loop = (v >> 6) & 1;
        dmc.period = dmc_periods[v & 15];
        if (!dmc.irq_enabled) dmc.irq = 0;
        break;
    case 0x4011:
        dmc.output = v & 0x7F;
        break;
    case 0x4012:
        dmc.start_addr = (uint16_t)(0xC000 + v * 64);
        break;
    case 0x4013:
        dmc.start_length = (uint16_t)(v * 16 + 1);
        break;
    case 0x4015:
        pulse[0].enabled = v & 1;
        pulse[1].enabled = (v >> 1) & 1;
        tri.enabled = (v >> 2) & 1;
        noise.enabled = (v >> 3) & 1;
        if (!pulse[0].enabled) pulse[0].length = 0;
        if (!pulse[1].enabled) pulse[1].length = 0;
        if (!tri.enabled) tri.length = 0;
        if (!noise.enabled) noise.length = 0;
        dmc.irq = 0;
        if (!(v & 0x10)) {
            dmc.remaining = 0;
        } else if (!dmc.remaining) {
            dmc.addr = dmc.start_addr;
            dmc.remaining = dmc.start_length;
            dmc_fetch();
        }
        break;
    case 0x4017:
        frame.five_step = v >> 7;
        frame.irq_inhibit = (v >> 6) & 1;
        if (frame.irq_inhibit) frame.irq = 0;
        frame.cycle = 0;
        if (frame.five_step) {
            quarter_frame();
            half_frame();
        }
        break;
    }
    catch_up();     /* recompute the next event for the new state */
}
