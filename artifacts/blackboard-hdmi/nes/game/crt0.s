; Star Catcher startup: iNES header, reset, NMI (OAM DMA + one VRAM update
; per frame + scroll reset), vectors and CHR data.

.export __STARTUP__ : absolute = 1
.export _nmi_count, _ppu_ctrl, _upd_addr, _upd_len, _upd_buf, _oam
.import _main, zerobss, copydata
.import __RAM_START__, __RAM_SIZE__
.include "zeropage.inc"

PPUCTRL   = $2000
PPUMASK   = $2001
PPUSTATUS = $2002
OAMADDR   = $2003
PPUSCROLL = $2005
PPUADDR   = $2006
PPUDATA   = $2007
OAMDMA    = $4014

.segment "HEADER"
    .byte "NES", $1A
    .byte 1             ; 16 KB PRG
    .byte 1             ; 8 KB CHR
    .byte $00, $00      ; mapper 0, horizontal mirroring
    .res 8, 0

.segment "OAM"
_oam:       .res 256

.segment "BSS"
_nmi_count: .res 1
_ppu_ctrl:  .res 1
_upd_addr:  .res 2
_upd_len:   .res 1      ; set last; NMI clears it after copying
_upd_buf:   .res 32

.segment "STARTUP"
reset:
    sei
    cld
    ldx #$40
    stx $4017           ; no APU frame IRQ
    ldx #$FF
    txs
    inx
    stx PPUCTRL
    stx PPUMASK
    stx $4010
    bit PPUSTATUS
@vblank1:
    bit PPUSTATUS
    bpl @vblank1

    lda #0
    tax
@clear:
    sta $0000,x
    sta $0100,x
    sta $0300,x
    sta $0400,x
    sta $0500,x
    sta $0600,x
    sta $0700,x
    inx
    bne @clear
    lda #$FF            ; all sprites below the screen
@hide:
    sta _oam,x
    inx
    bne @hide

@vblank2:
    bit PPUSTATUS
    bpl @vblank2

    lda #<(__RAM_START__ + __RAM_SIZE__)
    sta sp
    lda #>(__RAM_START__ + __RAM_SIZE__)
    sta sp+1
    jsr zerobss
    jsr copydata
    jsr _main
@forever:
    jmp @forever

nmi:
    pha
    txa
    pha
    tya
    pha

    lda #0
    sta OAMADDR
    lda #>_oam
    sta OAMDMA

    ldx _upd_len
    beq @no_update
    lda _upd_addr+1
    sta PPUADDR
    lda _upd_addr
    sta PPUADDR
    ldy #0
@copy:
    lda _upd_buf,y
    sta PPUDATA
    iny
    dex
    bne @copy
    stx _upd_len
@no_update:

    lda #0
    sta PPUSCROLL
    sta PPUSCROLL
    lda _ppu_ctrl
    sta PPUCTRL
    inc _nmi_count

    pla
    tay
    pla
    tax
    pla
irq:
    rti

.segment "VECTORS"
    .word nmi, reset, irq

.segment "CHARS"
    .incbin "chr.bin"
