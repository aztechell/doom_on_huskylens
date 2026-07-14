#ifndef DOOM_PLATFORM_H
#define DOOM_PLATFORM_H

#include <stdint.h>

void doom_platform_set_palette(const uint8_t *palette);
void doom_platform_loading_progress(uint8_t percent, const char *label);
void doom_platform_fatal(const char *message) __attribute__((noreturn));
unsigned char doom_platform_next_weapon_key(void);

#endif
