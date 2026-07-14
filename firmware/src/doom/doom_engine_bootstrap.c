/*
 * SPDX-FileCopyrightText: 2026 aztechell
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

#include "doom_port_api.h"

#include <stddef.h>
#include <stdlib.h>

#include "m_argv.h"

void D_DoomMain(void);

pixel_t *DG_ScreenBuffer;

int doom_engine_start(int argc, char **argv)
{
    size_t pixel_count;

    if(argc < 1 || argv == NULL || DG_ScreenBuffer != NULL)
        return 0;

    pixel_count = (size_t)DOOMGENERIC_RESX * (size_t)DOOMGENERIC_RESY;
    if(pixel_count > SIZE_MAX / sizeof(*DG_ScreenBuffer))
        return 0;

    DG_ScreenBuffer = malloc(pixel_count * sizeof(*DG_ScreenBuffer));
    if(DG_ScreenBuffer == NULL)
        return 0;

    myargc = argc;
    myargv = argv;
    M_FindResponseFile();
    DG_Init();
    D_DoomMain();
    return 1;
}
