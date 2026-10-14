"""Build a standalone Zynq Cortex-A9 photo app in Vitis 2024.2.

Run with ``vitis.bat -s build_c_app.py`` from the Windows staging directory
after ``photo_c_hardware.xsa`` has been exported by Vivado.
"""
from pathlib import Path
import vitis

root = Path.cwd()
client = vitis.create_client()
client.set_workspace(path=str(root / "photo_c_vitis"))

platform = client.create_platform_component(
    name="blackboard_platform",
    hw_design=str(root / "photo_c_full3" / "photo_c_hardware.xsa"),
    cpu="ps7_cortexa9_0",
    os="standalone",
    domain_name="standalone_ps7_cortexa9_0",
)
print("Platform build:", platform.build())

xpfm = root / "photo_c_vitis" / "blackboard_platform" / "export" / "blackboard_platform" / "blackboard_platform.xpfm"
app = client.create_app_component(
    name="photo_app",
    platform=str(xpfm),
    domain="standalone_ps7_cortexa9_0",
    template="empty",
)
app.import_files(
    from_loc=str(root),
    files=["main.c", "photo_pixels.h"],
    dest_dir_in_cmp="src",
)
print("App build:", app.build())
