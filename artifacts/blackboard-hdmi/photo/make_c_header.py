from pathlib import Path

pixels = [int(line, 16) for line in Path("image.mem").read_text().splitlines()]
assert len(pixels) == 256 * 240
words = [pixels[i] | (pixels[i + 1] << 16) for i in range(0, len(pixels), 2)]
with Path("photo_pixels.h").open("w") as out:
    out.write("/* Derived from the Ken On official Mei Hata profile photograph. */\n")
    out.write("#include <stdint.h>\n")
    out.write("static const uint32_t photo_words[30720] = {\n")
    for i in range(0, len(words), 8):
        out.write("    " + ", ".join(f"0x{n:08X}u" for n in words[i:i + 8]) + ",\n")
    out.write("};\n")
