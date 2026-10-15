# Star Catcher, built with the cc65 package unpacked in ~/cc65 (dpkg -x).
CC65_HOME ?= $(HOME)/cc65/usr/share/cc65
BIN = $(HOME)/cc65/usr/bin
export CC65_HOME

starcatcher.nes: crt0.o main.o nes.cfg
	$(BIN)/ld65 -C nes.cfg -o $@ crt0.o main.o $(CC65_HOME)/lib/none.lib

crt0.o: crt0.s chr.bin
	$(BIN)/ca65 -I $(CC65_HOME)/asminc -o $@ crt0.s

main.o: main.c
	$(BIN)/cc65 -t none -Oirs -I $(CC65_HOME)/include -o main.s main.c
	$(BIN)/ca65 -o $@ main.s

chr.bin: mkchr.py
	python3 mkchr.py $@

clean:
	rm -f starcatcher.nes *.o main.s chr.bin

.PHONY: clean
