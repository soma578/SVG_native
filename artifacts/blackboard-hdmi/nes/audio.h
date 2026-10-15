/* Sound out of the Blackboard's 3.5 mm jack through Real Digital's PL
 * pdm_audio IP (0x43C20000): two 1024-word ping-pong buffers per speaker,
 * 16-bit unsigned samples at 48 kHz. Without its interrupts under Linux, a
 * real-time thread polls which half is free and refills it. */
#ifndef AUDIO_H
#define AUDIO_H
#include <stdint.h>

int audio_open(void);
/* Queue signed 16-bit mono samples; the queue absorbs clock drift. */
void audio_push(const int16_t *samples, int count);
int audio_queued(void);
void audio_close(void);
/* Underruns since the last call, and samples currently queued. */
void audio_stats(int *underruns, int *queued);

#endif
