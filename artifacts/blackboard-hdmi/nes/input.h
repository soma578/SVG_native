/* USB keyboard as controller 1, read through evdev. Keyboards are picked up
 * when plugged in and grabbed so key presses do not reach the console.
 *   Arrows/WASD = D-pad, X/K = A, Z/J = B, Enter = Start,
 *   Right Shift/Space = Select, Esc = quit.
 * Board buttons also work: BTN0 Start, BTN1 Select, BTN2 B, BTN3 A. */
#ifndef INPUT_H
#define INPUT_H
#include <stdint.h>

/* Returns the NES button byte; sets *quit when Esc is pressed. */
uint8_t input_poll(int *quit);

#endif
