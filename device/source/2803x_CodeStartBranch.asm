;// 2803x_CodeStartBranch.asm
;// Boot-to-flash entry. In boot-to-flash mode the boot ROM jumps to BEGIN
;// (0x3F7FF6), where this "codestart" section performs a long branch to the
;// C runtime entry (_c_int00). Standard TI boot branch; no invented addresses.
    .ref _c_int00
    .sect "codestart"
    LB _c_int00
    .end