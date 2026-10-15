# Build on the board: make && sudo ./nes game.nes
CC ?= gcc
CFLAGS ?= -O2 -flto -Wall -Wextra -mcpu=cortex-a9 -mfpu=neon -mfloat-abi=hard
CORE = cpu.c ppu.c apu.c cart.c bus.c
HEADERS = nes.h video.h input.h audio.h

all: nes demo fbshow test/nestest test/shot test/tone

nes: main.c video.c input.c audio.c $(CORE) $(HEADERS)
	$(CC) $(CFLAGS) -o $@ main.c video.c input.c audio.c $(CORE) -lpthread

demo: demo.c video.c video.h
	$(CC) $(CFLAGS) -o $@ demo.c video.c

test/nestest: test/nestest.c $(CORE) nes.h
	$(CC) $(CFLAGS) -o $@ test/nestest.c $(CORE)

test/shot: test/shot.c $(CORE) nes.h
	$(CC) $(CFLAGS) -o $@ test/shot.c $(CORE)

clean:
	rm -f nes demo fbshow test/tone test/nestest test/shot

.PHONY: all clean

fbshow: fbshow.c video.c video.h
	$(CC) $(CFLAGS) -o $@ fbshow.c video.c

test/tone: test/tone.c
	$(CC) $(CFLAGS) -o $@ test/tone.c -lm
