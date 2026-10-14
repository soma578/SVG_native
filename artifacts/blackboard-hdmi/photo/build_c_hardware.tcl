open_project photo_c_full3/photo_c_full3.xpr
launch_runs impl_1 -to_step write_bitstream -jobs 4
wait_on_run impl_1
set run [get_runs impl_1]
puts "Implementation: [get_property STATUS $run]"
if {[get_property PROGRESS $run] ne "100%"} { error "Bitstream failed" }
write_hw_platform -fixed -include_bit -force -file photo_c_full3/photo_c_hardware.xsa
puts "Exported photo_c_hardware.xsa"
