# Experimental bare-metal C framebuffer hardware, from Real Digital's Rev. D
# PS7 configuration. The SD boot files are not touched.
create_project photo_c_full3 ./photo_c_full3 -part xc7z007sclg400-1
add_files -norecurse [list \
    hdmi_tx_1.0/hdl/encode.v \
    hdmi_tx_1.0/hdl/hdmi_tx_v1_0.v \
    hdmi_tx_1.0/hdl/serdes_10_to_1.v \
    hdmi_tx_1.0/hdl/srldelay.v \
    hdmi_tx_1.0/sim/clk_wiz_0/clk_wiz_0.xci \
    video_output.v \
]
add_files -fileset constrs_1 -norecurse photo.xdc
upgrade_ip [get_ips clk_wiz_0]
generate_target all [get_ips clk_wiz_0]
update_compile_order -fileset sources_1
create_bd_design system
set ps7 [create_bd_cell -type ip -vlnv xilinx.com:ip:processing_system7:5.5 ps7]
source ps7_realdigital_config.tcl
set_property CONFIG.PCW_USE_S_AXI_HP0 {0} $ps7
make_bd_intf_pins_external [get_bd_intf_pins ps7/DDR]
make_bd_intf_pins_external [get_bd_intf_pins ps7/FIXED_IO]

set reset [create_bd_cell -type ip -vlnv xilinx.com:ip:proc_sys_reset:5.0 reset]
set interconnect [create_bd_cell -type ip -vlnv xilinx.com:ip:axi_interconnect:2.1 axi_interconnect]
set_property CONFIG.NUM_MI {1} $interconnect
set ctrl [create_bd_cell -type ip -vlnv xilinx.com:ip:axi_bram_ctrl:4.1 framebuffer_ctrl]
set_property CONFIG.SINGLE_PORT_BRAM {1} $ctrl
set bram [create_bd_cell -type ip -vlnv xilinx.com:ip:blk_mem_gen:8.4 framebuffer]
set_property -dict [list \
    CONFIG.Memory_Type {True_Dual_Port_RAM} \
    CONFIG.Write_Width_A {32} \
    CONFIG.Read_Width_A {32} \
    CONFIG.Write_Width_B {32} \
    CONFIG.Read_Width_B {32} \
    CONFIG.Write_Depth_A {32768} \
    CONFIG.Enable_B {Use_ENB_Pin} \
    CONFIG.Use_Byte_Write_Enable {true} \
    CONFIG.Byte_Size {8} \
] $bram

connect_bd_intf_net [get_bd_intf_pins ps7/M_AXI_GP0] [get_bd_intf_pins axi_interconnect/S00_AXI]
connect_bd_intf_net [get_bd_intf_pins axi_interconnect/M00_AXI] [get_bd_intf_pins framebuffer_ctrl/S_AXI]
connect_bd_intf_net [get_bd_intf_pins framebuffer_ctrl/BRAM_PORTA] [get_bd_intf_pins framebuffer/BRAM_PORTA]
connect_bd_net [get_bd_pins ps7/FCLK_CLK0] \
    [get_bd_pins ps7/M_AXI_GP0_ACLK] \
    [get_bd_pins axi_interconnect/ACLK] \
    [get_bd_pins axi_interconnect/S00_ACLK] \
    [get_bd_pins axi_interconnect/M00_ACLK] \
    [get_bd_pins framebuffer_ctrl/s_axi_aclk] \
    [get_bd_pins reset/slowest_sync_clk]
connect_bd_net [get_bd_pins ps7/FCLK_RESET0_N] [get_bd_pins reset/ext_reset_in]
connect_bd_net [get_bd_pins reset/interconnect_aresetn] [get_bd_pins axi_interconnect/ARESETN]
connect_bd_net [get_bd_pins reset/peripheral_aresetn] \
    [get_bd_pins axi_interconnect/S00_ARESETN] \
    [get_bd_pins axi_interconnect/M00_ARESETN] \
    [get_bd_pins framebuffer_ctrl/s_axi_aresetn]

# The video module reads the independent BRAM B port at pixel clock rate.
set video [create_bd_cell -type module -reference video_output video_output_0]
connect_bd_net [get_bd_pins video_output_0/bram_clk] [get_bd_pins framebuffer/clkb]
connect_bd_net [get_bd_pins video_output_0/bram_en] [get_bd_pins framebuffer/enb]
connect_bd_net [get_bd_pins video_output_0/bram_addr] [get_bd_pins framebuffer/addrb]
connect_bd_net [get_bd_pins framebuffer/doutb] [get_bd_pins video_output_0/bram_data]
set zero32 [create_bd_cell -type ip -vlnv xilinx.com:ip:xlconstant:1.1 zero32]
set_property -dict [list CONFIG.CONST_WIDTH {32} CONFIG.CONST_VAL {0}] $zero32
connect_bd_net [get_bd_pins zero32/dout] [get_bd_pins framebuffer/dinb]
set zero4 [create_bd_cell -type ip -vlnv xilinx.com:ip:xlconstant:1.1 zero4]
set_property -dict [list CONFIG.CONST_WIDTH {4} CONFIG.CONST_VAL {0}] $zero4
connect_bd_net [get_bd_pins zero4/dout] [get_bd_pins framebuffer/web]
foreach pin {clk rst hdmi_tx_hpd TMDS_CLK_P TMDS_CLK_N TMDS_DATA_P TMDS_DATA_N} {
    make_bd_pins_external -name $pin [get_bd_pins video_output_0/$pin]
}
assign_bd_address
set_property offset 0x40000000 [get_bd_addr_segs ps7/Data/SEG_framebuffer_ctrl_Mem0]
set_property range 128K [get_bd_addr_segs ps7/Data/SEG_framebuffer_ctrl_Mem0]
validate_bd_design
save_bd_design
generate_target all [get_files photo_c_full3/photo_c_full3.srcs/sources_1/bd/system/system.bd]
set wrapper [make_wrapper -files [get_files photo_c_full3/photo_c_full3.srcs/sources_1/bd/system/system.bd] -top]
add_files -norecurse $wrapper
set_property top system_wrapper [get_filesets sources_1]
update_compile_order -fileset sources_1
puts "Framebuffer BD validated and wrapper generated"
