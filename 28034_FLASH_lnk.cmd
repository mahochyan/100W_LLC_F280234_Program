/* STAGE6_FLASH linker for F28034.
   Derived from the official TI F28034.cmd (CCS c2000/include, TI Release 2803x
   Internal Release 2, SHA256 DC27A81D64D9E275B6CE0443D2BEDD295C80A7E481F35725C81585A08574E47A)
   with minimal adaptation for this project:
     - combined FLASH program region (all sectors) for .text/.cinit/.econst/.switch/IQmath
     - .TI.ramfunc AND legacy "ramfuncs" (InitFlash pragma) LOAD=FLASH RUN=RAML0 with copy symbols
     - data (.ebss/.esysmem/.stack) in RAML0/L1/L2/L3 + M0/M1
     - codestart boot branch at BEGIN (boot to flash)
   No memory addresses invented; all origins/lengths from the official map. */

MEMORY
{
PAGE 0:  /* Program Memory */
   RAML0       : origin = 0x008000, length = 0x000800   /* copy/RUN target for ramfuncs */
   OTP         : origin = 0x3D7800, length = 0x000400
   /* FLASHH..FLASHA combined = full 64K flash program space */
   FLASH       : origin = 0x3E8000, length = 0x00FF80
   CSM_RSVD    : origin = 0x3F7F80, length = 0x000076
   BEGIN       : origin = 0x3F7FF6, length = 0x000002   /* boot-to-flash */
   CSM_PWL_P0  : origin = 0x3F7FF8, length = 0x000008

   IQTABLES    : origin = 0x3FE000, length = 0x000B50
   IQTABLES2   : origin = 0x3FEB50, length = 0x00008C
   IQTABLES3   : origin = 0x3FEBDC, length = 0x0000AA

   ROM         : origin = 0x3FF27C, length = 0x000D44
   RESET       : origin = 0x3FFFC0, length = 0x000002
   VECTORS     : origin = 0x3FFFC2, length = 0x00003E

PAGE 1 :  /* Data Memory */
   BOOT_RSVD   : origin = 0x000000, length = 0x000050
   RAMM0       : origin = 0x000050, length = 0x0003B0
   RAMM1       : origin = 0x000400, length = 0x000400
   RAML1       : origin = 0x008800, length = 0x000400
   RAML2       : origin = 0x008C00, length = 0x000400
   RAML3       : origin = 0x009000, length = 0x001000
}

SECTIONS
{
   codestart           : > BEGIN,       PAGE = 0
   .text               : > FLASH,       PAGE = 0
   .cinit              : > FLASH,       PAGE = 0
   .pinit              : > FLASH,       PAGE = 0
   .econst             : > FLASH,       PAGE = 0
   .switch             : > FLASH,       PAGE = 0
   IQmath              : > FLASH,       PAGE = 0
   IQmathTables        : > IQTABLES,    PAGE = 0, TYPE = NOLOAD

   .TI.ramfunc : {} LOAD = FLASH, RUN = RAML0,
       LOAD_START(_TIRamfuncsLoadStart), LOAD_END(_TIRamfuncsLoadEnd),
       RUN_START(_TIRamfuncsRunStart),   PAGE = 0
   /* legacy name used by InitFlash pragma CODE_SECTION(InitFlash,"ramfuncs") */
   ramfuncs : {} LOAD = FLASH, RUN = RAML0,
       LOAD_START(_RamfuncsLoadStart), LOAD_END(_RamfuncsLoadEnd),
       RUN_START(_RamfuncsRunStart),    PAGE = 0

   .reset              : > RESET,       PAGE = 0, TYPE = DSECT
   vectors             : > VECTORS,     PAGE = 0, TYPE = DSECT

   .stack              : > RAML1,       PAGE = 1
   .ebss               : > RAML2,       PAGE = 1
   .esysmem            : > RAML3,       PAGE = 1
   shot_ram            : > RAML3,       PAGE = 1
   /* W2_OPEN_LOOP_STEADY: experimental module RAM (RAML3). The default
       .ebss pool (RAML2, 0x400) was already at its budget; this section
       exists only in builds that define STAGE6_OPEN_LOOP_STEADY_BUILD. */
   ol_ram              : > RAML3,       PAGE = 1
   csmpasswds          : > CSM_PWL_P0,  PAGE = 0
   csm_rsvd            : > CSM_RSVD,    PAGE = 0
}
