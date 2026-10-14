open_project hdmi_test/hdmi_test.xpr

set clock_ip [get_ips -quiet clk_wiz_0]
if {[llength $clock_ip] != 1} {
    error "Expected one clk_wiz_0 IP, found [llength $clock_ip]"
}

report_ip_status
upgrade_ip $clock_ip
generate_target all $clock_ip

launch_runs impl_1 -to_step write_bitstream -jobs 4
wait_on_run impl_1

set run [get_runs impl_1]
puts "Implementation status: [get_property STATUS $run]"
puts "Implementation progress: [get_property PROGRESS $run]"
set bits [glob -nocomplain hdmi_test/hdmi_test.runs/impl_1/*.bit]
if {[llength $bits] != 1} {
    error "Expected one bitstream, found [llength $bits]"
}
puts "Bitstream: [lindex $bits 0]"
