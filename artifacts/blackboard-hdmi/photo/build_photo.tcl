open_project hdmi_test/hdmi_test.xpr
set wrapper [get_files -quiet *sim/wrapper.v]
if {[llength $wrapper] == 1} { remove_files $wrapper }
set existing_photo [get_files -quiet *photo_wrapper.v]
if {[llength $existing_photo] == 0} {
    add_files -norecurse [file normalize photo_wrapper.v]
}
set existing_mem [get_files -quiet *image.mem]
if {[llength $existing_mem] == 0} {
    add_files -norecurse [file normalize image.mem]
}
set old_xdc [get_files -quiet *blackboard_video.xdc]
if {[llength $old_xdc] == 1} { remove_files $old_xdc }
set existing_xdc [get_files -quiet *photo.xdc]
if {[llength $existing_xdc] == 0} {
    add_files -fileset constrs_1 -norecurse [file normalize photo.xdc]
}
set_property top photo_wrapper [get_filesets sources_1]
update_compile_order -fileset sources_1
reset_run synth_1
launch_runs impl_1 -to_step write_bitstream -jobs 4
wait_on_run impl_1
set run [get_runs impl_1]
puts "Implementation: [get_property STATUS $run]"
if {[get_property PROGRESS $run] ne "100%"} { error "Bitstream failed" }
