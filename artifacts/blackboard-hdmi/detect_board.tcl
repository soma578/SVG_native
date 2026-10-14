open_hw_manager
connect_hw_server
puts "JTAG targets: [get_hw_targets]"
foreach target [get_hw_targets] {
    if {[catch {open_hw_target $target} result]} {
        puts "Target $target: $result"
        continue
    }
    puts "Target $target devices: [get_hw_devices]"
    close_hw_target
}
disconnect_hw_server
close_hw_manager
