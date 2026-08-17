;###########################################################################
;
; FILE:   DSP2803x_usDelay.asm
; TITLE:  TI C2000 delay loop used by Delay_us() in device/system.c
;
; The routine is placed in .TI.ramfunc, which the existing RAM linker file
; already maps to zero-wait-state RAM for the current compiler.
;
;###########################################################################

        .def    _DSP28x_usDelay
        .global __DSP28x_usDelay
        .sect   ".TI.ramfunc"

_DSP28x_usDelay:
        SUB     ACC,#1
        BF      _DSP28x_usDelay,GEQ
        LRETR

; Loop timing: 9/10 cycles overhead, then 5 cycles per loop.
; system.c converts microseconds to the required loop count for 60 MHz.
