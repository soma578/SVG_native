ENTRY(_start)
SECTIONS {
    . = 0x10000000;
    .text : { *(.text.startup) *(.text*) }
    .rodata : { *(.rodata*) }
    .data : { *(.data*) }
    .bss : { *(.bss*) *(COMMON) }
    . = ALIGN(8);
    _end = .;
}
