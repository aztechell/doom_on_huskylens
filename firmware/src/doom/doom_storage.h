#ifndef DOOM_STORAGE_H
#define DOOM_STORAGE_H

#include <stddef.h>
#include <stdint.h>

#include "../storage/fat_file_entry.h"

typedef enum
{
    DOOM_STORAGE_OK = 0,
    DOOM_STORAGE_NO_SD,
    DOOM_STORAGE_BAD_FAT,
    DOOM_STORAGE_NO_DIRECTORY,
    DOOM_STORAGE_NO_WAD,
    DOOM_STORAGE_BAD_WAD,
    DOOM_STORAGE_IO_ERROR,
} doom_storage_result_t;

doom_storage_result_t doom_storage_mount_and_find(void);
size_t doom_storage_wad_count(void);
const char *doom_storage_wad_name(size_t index);
uint8_t doom_storage_select_wad(size_t index);
const char *doom_storage_selected_path(void);
const fat_file_entry_t *doom_storage_selected_entry(void);
uint8_t doom_storage_path_exists(const char *path);
const char *doom_storage_result_text(doom_storage_result_t result);

#endif
