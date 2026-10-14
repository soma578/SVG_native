`timescale 1ns / 1ps

// 720p HDMI photo test. The 256x240 RGB565 ROM is scaled to 768x720.
// HDMI transmitter, clock wizard and VGA delay are Real Digital's BSD-3 code.
module photo_wrapper(
    input clk,
    input rst,
    output hdmi_tx_hpd,
    output TMDS_CLK_P,
    output TMDS_CLK_N,
    output [2:0] TMDS_DATA_P,
    output [2:0] TMDS_DATA_N
);
    wire pix_clk, pix_clkx5, locked;
    clk_wiz_0 clock_gen(.clk(pix_clk), .clk_x5(pix_clkx5),
        .reset(rst), .locked(locked), .clk_in(clk));

    reg [11:0] hcount = 0;
    reg [11:0] vcount = 0;
    always @(posedge pix_clk) begin
        if (rst || !locked) begin
            hcount <= 0;
            vcount <= 0;
        end else if (hcount == 1649) begin
            hcount <= 0;
            if (vcount == 749) vcount <= 0;
            else vcount <= vcount + 1'b1;
        end else begin
            hcount <= hcount + 1'b1;
        end
    end

    wire hsync_now = hcount < 40;
    wire vsync_now = vcount < 5;
    wire active_now = (hcount >= 516 && hcount < 1284 &&
                       vcount >= 25 && vcount < 745);
    // Small phase counters avoid a pixel-clock division path.
    reg [7:0] image_x = 0;
    reg [7:0] image_y = 0;
    reg [2:0] xphase = 0;
    reg [1:0] yphase = 0;
    always @(posedge pix_clk) begin
        if (rst || !locked) begin
            image_x <= 0;
            image_y <= 0;
            xphase <= 0;
            yphase <= 0;
        end else begin
            if (hcount == 515) begin
                image_x <= 0;
                xphase <= 0;
            end else if (hcount >= 516 && hcount < 1283) begin
                if (xphase == 2) begin
                    xphase <= 0;
                    image_x <= image_x + 1'b1;
                end else xphase <= xphase + 1'b1;
            end
            if (hcount == 1649) begin
                if (vcount == 24) begin
                    image_y <= 0;
                    yphase <= 0;
                end else if (vcount >= 25 && vcount < 744) begin
                    if (yphase == 2) begin
                        yphase <= 0;
                        image_y <= image_y + 1'b1;
                    end else yphase <= yphase + 1'b1;
                end
            end
        end
    end
    wire [15:0] image_addr = {image_y, image_x};
    (* rom_style = "block" *) reg [15:0] pixel_rom [0:61439];
    initial $readmemh("image.mem", pixel_rom);
    reg [15:0] pixel;
    reg hsync, vsync, vde;
    always @(posedge pix_clk) begin
        pixel <= pixel_rom[image_addr];
        hsync <= hsync_now;
        vsync <= vsync_now;
        vde <= active_now;
    end

    wire [7:0] red   = {pixel[15:11], pixel[15:13]};
    wire [7:0] green = {pixel[10:5], pixel[10:9]};
    wire [7:0] blue  = {pixel[4:0], pixel[4:2]};
    hdmi_tx_v1_0 #(.C_RED_WIDTH(8), .C_GREEN_WIDTH(8),
        .C_BLUE_WIDTH(8), .MODE("HDMI")) hdmi_tx_inst(
        .pix_clk(pix_clk), .pix_clkx5(pix_clkx5),
        .pix_clk_locked(locked), .rst(rst),
        .red(red), .green(green), .blue(blue),
        .hsync(hsync), .vsync(vsync), .vde(vde),
        .aux0_din(4'h0), .aux1_din(4'h0), .aux2_din(4'h0),
        .ade(1'b0), .TMDS_CLK_P(TMDS_CLK_P),
        .TMDS_CLK_N(TMDS_CLK_N),
        .TMDS_DATA_P(TMDS_DATA_P), .TMDS_DATA_N(TMDS_DATA_N));
    assign hdmi_tx_hpd = 1'b1;
endmodule
