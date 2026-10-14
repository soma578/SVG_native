# Blackboard Rev. D HDMI output test

This is a **temporary, programmable logic only** test design. It emits a
1280×720/60 Hz solid color chosen by switches SW0–SW7. It does not provide a
Linux framebuffer, NES video logic, or a replacement for the board's PetaLinux
`BOOT.BIN`.

Source: [Real Digital HDMI/DVI IP 2020](https://www.realdigital.org/downloads/f61d342e68f314e5900b476e8396af6c.zip).
The local `hdmi_tx_1.0-official.zip` is an unmodified copy (SHA-256
`cb11c268c7ea677b970702467cbf5bd8eb0e0782ec6fb43fd353fb5707e73b41`).
The archive's `sim/wrapper.v` and `example_designs/blackboardRevA/blackboard_video.xdc`
were used as supplied. Their HDMI clock and data pins match Real Digital's
[current master XDC](https://www.realdigital.org/downloads/615e6849c320c5615deeebaf0ea38e94.txt).

The project was generated with the vendor's `create_project_2017_3.tcl`, then
built with `prepare_and_build.tcl` using Windows Vivado 2024.2. Clocking Wizard
IP was upgraded from revision 5 to 15. The bitstream was generated for
`xc7z007sclg400-1` and copied here as `blackboard-hdmi-test-720p.bit`
(SHA-256 `a74c7bd929cfea51d8f96c99232587e5a0dd8c68783c9cfa8559e75210d31cc5`).

Vivado completed bitstream generation with zero DRC errors. Routed timing met
its constraints: WNS +7.903 ns, WHS +0.046 ns. The routed DRC reports one
`ZPS7-1` warning because the standalone sample has no PS7 block. HDMI output
was verified on 2026-10-14: the connected monitor showed a solid color, and
SW0–SW7 changed that color. SSH became unreachable immediately after JTAG
programming. The existing PL functions need to be integrated before this
bitstream can be used with the running PetaLinux system.
After a power cycle, SSH returned, the FPGA manager reported `operating`, and
the USB `ci_hdrc` host controller was present again. The SD boot files were not
modified.

The source is staged in
`C:\Users\somay\AppData\Local\Temp\blackboard-hdmi-test`.
`program_test.tcl` targets the observed `xc7z007s` JTAG device. Programming it
replaces the active programmable logic until the next boot; it is not part of
the build step.
