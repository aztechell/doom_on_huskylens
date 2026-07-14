/*
 * SPDX-FileCopyrightText: 2026 aztechell
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

#ifndef HUSKYLENS_DOOM_PORT_API_H
#define HUSKYLENS_DOOM_PORT_API_H

#include <stdint.h>

#if !defined(CMAP256)
#error "The HuskyLens Doom port requires the 8-bit indexed framebuffer"
#endif

#if !defined(DOOMGENERIC_RESX) || !defined(DOOMGENERIC_RESY)
#error "The Doom framebuffer dimensions must be supplied by the build"
#endif

typedef uint8_t pixel_t;

#ifdef __cplusplus
extern "C" {
#endif

extern pixel_t *DG_ScreenBuffer;

int doom_engine_start(int argc, char **argv);
void doomgeneric_Tick(void);

void DG_Init(void);
void DG_DrawFrame(void);
void DG_SleepMs(uint32_t milliseconds);
uint32_t DG_GetTicksMs(void);
int DG_GetKey(int *pressed, unsigned char *key);
void DG_SetWindowTitle(const char *title);
void DG_SetPalette(const uint8_t *palette);

#ifdef __cplusplus
}
#endif

#endif
