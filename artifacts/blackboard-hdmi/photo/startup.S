/* Cortex-A9 standalone entry after a processor reset via JTAG. */
.syntax unified
.cpu cortex-a9
.arm
.section .text.startup, "ax"
.global _start
_start:
    cpsid if
    ldr sp, =0x10040000
    bl main
1:  b 1b
