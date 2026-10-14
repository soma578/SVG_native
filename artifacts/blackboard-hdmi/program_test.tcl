set bitstream [file normalize "hdmi_test/hdmi_test.runs/impl_1/wrapper.bit"]
if {![file exists $bitstream]} {
    error "Bitstream not found: $bitstream"
}

open_hw_manager
connect_hw_server
set targets [get_hw_targets */Xilinx/*]
if {[llength $targets] != 1} {
    error "Expected one Xilinx JTAG target, found [llength $targets]: $targets"
}
open_hw_target [lindex $targets 0]
set devices [get_hw_devices xc7z007s_*]
if {[llength $devices] != 1} {
    error "Expected one xc7z007s device, found [llength $devices]: $devices"
}
set device [lindex $devices 0]
set_property PROGRAM.FILE $bitstream $device
program_hw_devices $device
puts "Programmed $device with $bitstream"
close_hw_target
disconnect_hw_server
close_hw_manager
