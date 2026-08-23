;// 2803x_CodeStartBranch.asm
;// Boot-to-flash entry. In boot-to-flash mode the boot ROM jumps to BEGIN
;// (0x3F7FF6), where this "codestart" section performs a long branch to the
;// C runtime entry (_c_int00). Standard TI boot branch; no invented addresses.
;// Standardized (STAGE6_FLASH_STARTUP_PATH_REPAIR_V1): exposes the explicit
;// debug entry symbol `code_start` so the linker --entry_point=code_start
;// points the debugger at BEGIN, not at main.
    .global _c_int00
    .global code_start
    .sect "codestart"
code_start:
    LB _c_int00
    .end
