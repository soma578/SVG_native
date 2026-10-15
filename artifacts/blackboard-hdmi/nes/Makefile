# Build on the board: make && sudo ./nes game.nes
CC ?= gcc
CFLAGS ?= -O2 -flto -Wall -Wextra -mcpu=cortex-a9 -mfpu=neon -mfloat-abi=hard
CORE = cpu.c ppu.c cart.c bus.c
HEADERS = nes.h video.h input.h

all: nes demo fbshow test/nestest test/shot

nes: main.c video.c input.c $(CORE) $(HEADERS)
	$(CC) $(CFLAGS) -o $@ main.c video.c input.c $(CORE)

demo: demo.c video.c video.h
	$(CC) $(CFLAGS) -o $@ demo.c video.c

test/nestest: test/nestest.c $(CORE) nes.h
	$(CC) $(CFLAGS) -o $@ test/nestest.c $(CORE)

test/shot: test/shot.c $(CORE) nes.h
	$(CC) $(CFLAGS) -o $@ test/shot.c $(CORE)

clean:
	rm -f nes demo fbshow test/nestest test/shot

.PHONY: all clean

fbshow: fbshow.c video.c video.h
	$(CC) $(CFLAGS) -o $@ fbshow.c video.c
