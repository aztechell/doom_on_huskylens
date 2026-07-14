/*
 * SPDX-FileCopyrightText: 2026 aztechell
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

#include "doom_storage.h"

#include <ctype.h>
#include <stdio.h>
#include <string.h>

#include "../config/sd_config.h"
#include "../core/hk_binary.h"
#include "../drivers/hk_sd.h"
#include "../storage/fat32_allocation.h"
#include "../storage/fat32_file.h"
#include "../storage/fat32_stream.h"
#include "../storage/fat32_volume.h"
#include "../storage/internal/fat32_state_private.h"
#include "doom_platform.h"

#define FAT_ATTR_DIRECTORY 0x10U
#define FAT_ATTR_VOLUME 0x08U
#define FAT_ATTR_LFN 0x0FU
#define FAT_EOC 0x0FFFFFF8UL

#define WAD_CANDIDATE_COUNT 3U

typedef struct
{
    const char *name;
    const char *engine_path;
} wad_candidate_t;

static const wad_candidate_t g_candidates[WAD_CANDIDATE_COUNT] = {
    {"DOOM.WAD", "/DOOM/DOOM.WAD"},
    {"FREEDOOM1.WAD", "/DOOM/FREEDOOM1.WAD"},
    {"FREEDOOM2.WAD", "/DOOM/FREEDOOM2.WAD"},
};

static fat_file_entry_t g_found_entries[WAD_CANDIDATE_COUNT];
static uint8_t g_found_candidates[WAD_CANDIDATE_COUNT];
static size_t g_found_count;
static fat_file_entry_t g_wad_entry;
static char g_wad_path[32];
static char g_engine_path[32];

static int ascii_casecmp(const char *a, const char *b)
{
    while(*a && *b)
    {
        int ca = tolower((unsigned char)*a++);
        int cb = tolower((unsigned char)*b++);
        if(ca != cb)
            return ca - cb;
    }
    return (unsigned char)*a - (unsigned char)*b;
}

static void short_name_decode(const uint8_t *entry, char *out, size_t out_size)
{
    size_t used = 0;
    for(uint8_t i = 0; i < 8 && entry[i] != ' ' && used + 1 < out_size; i++)
        out[used++] = (char)entry[i];
    if(entry[8] != ' ' && used + 1 < out_size)
    {
        out[used++] = '.';
        for(uint8_t i = 8; i < 11 && entry[i] != ' ' && used + 1 < out_size; i++)
            out[used++] = (char)entry[i];
    }
    out[used] = '\0';
}

static void lfn_store(const uint8_t *entry, char *lfn, size_t lfn_size)
{
    static const uint8_t positions[13] = {1, 3, 5, 7, 9, 14, 16, 18, 20, 22, 24, 28, 30};
    uint8_t sequence = entry[0] & 0x1FU;
    size_t offset;

    if(entry[0] & 0x40U)
        memset(lfn, 0, lfn_size);
    if(sequence == 0)
        return;
    offset = (size_t)(sequence - 1U) * 13U;
    for(uint8_t i = 0; i < 13 && offset + i + 1 < lfn_size; i++)
    {
        uint16_t ch = rd16(&entry[positions[i]]);
        if(ch == 0 || ch == 0xFFFFU)
        {
            lfn[offset + i] = '\0';
            break;
        }
        lfn[offset + i] = ch < 0x80U ? (char)ch : '?';
    }
}

static uint8_t find_entry(uint32_t directory_cluster, const char *wanted,
                          uint8_t want_directory, fat_file_entry_t *result)
{
    uint32_t cluster = directory_cluster;
    char lfn[64] = {0};
    uint8_t *sector = fat32_sector_scratch();

    while(cluster >= 2 && cluster < FAT_EOC)
    {
        uint32_t base = fat_cluster_lba(cluster);
        for(uint8_t s = 0; s < fat32_sectors_per_cluster(); s++)
        {
            if(!sd_read_block(base + s, sector))
                return 0;
            for(uint16_t offset = 0; offset < SD_BLOCK_SIZE; offset += 32)
            {
                const uint8_t *entry = &sector[offset];
                uint8_t attr = entry[11];
                char name[64];
                uint32_t entry_cluster;

                if(entry[0] == 0x00)
                    return 0;
                if(entry[0] == 0xE5)
                {
                    lfn[0] = '\0';
                    continue;
                }
                if(attr == FAT_ATTR_LFN)
                {
                    lfn_store(entry, lfn, sizeof(lfn));
                    continue;
                }
                if((attr & FAT_ATTR_VOLUME) || entry[0] == '.')
                {
                    lfn[0] = '\0';
                    continue;
                }

                if(lfn[0])
                    snprintf(name, sizeof(name), "%s", lfn);
                else
                    short_name_decode(entry, name, sizeof(name));
                lfn[0] = '\0';

                if(((attr & FAT_ATTR_DIRECTORY) != 0) != (want_directory != 0) ||
                   ascii_casecmp(name, wanted) != 0)
                    continue;

                entry_cluster = ((uint32_t)rd16(&entry[20]) << 16) | rd16(&entry[26]);
                memset(result, 0, sizeof(*result));
                strncpy(result->name, name, sizeof(result->name) - 1U);
                result->name[sizeof(result->name) - 1U] = '\0';
                result->attr = attr;
                result->cluster = entry_cluster;
                result->size = rd32(&entry[28]);
                return 1;
            }
        }
        cluster = fat_next_cluster(cluster);
    }
    return 0;
}

static uint8_t validate_wad(const fat_file_entry_t *entry)
{
    uint8_t header[12];
    uint8_t lump[16];
    uint32_t count;
    uint32_t directory;
    fat_stream_t stream;

    if(entry->size < sizeof(header) || !fat_file_read_at(entry, 0, header, sizeof(header)))
        return 0;
    if(memcmp(header, "IWAD", 4) != 0 && memcmp(header, "PWAD", 4) != 0)
        return 0;
    count = rd32(&header[4]);
    directory = rd32(&header[8]);
    if(count == 0 || count > 65535U ||
       (uint64_t)directory + (uint64_t)count * sizeof(lump) > entry->size)
        return 0;

    if(!fat_stream_open(&stream, entry, directory))
        return 0;
    for(uint32_t i = 0; i < count; i++)
    {
        uint32_t position;
        uint32_t size;
        if(!fat_stream_read(&stream, lump, sizeof(lump)))
            return 0;
        position = rd32(&lump[0]);
        size = rd32(&lump[4]);
        if((uint64_t)position + size > entry->size)
            return 0;
    }
    printf("[DOOM] WAD valid lumps=%u dir=%u size=%u\r\n", count, directory, entry->size);
    return 1;
}

doom_storage_result_t doom_storage_mount_and_find(void)
{
    fat_file_entry_t directory;

    g_found_count = 0;
    g_wad_path[0] = '\0';
    g_engine_path[0] = '\0';
    if(!sd_init_card())
        return DOOM_STORAGE_NO_SD;
    if(!fat32_mount())
        return DOOM_STORAGE_BAD_FAT;
    if(!find_entry(hk_fat_root_cluster(), "DOOM", 1, &directory))
        return DOOM_STORAGE_NO_DIRECTORY;

    for(size_t i = 0; i < WAD_CANDIDATE_COUNT; i++)
    {
        fat_file_entry_t entry;
        if(find_entry(directory.cluster, g_candidates[i].name, 0, &entry))
        {
            if(!validate_wad(&entry))
                return DOOM_STORAGE_BAD_WAD;
            g_found_entries[g_found_count] = entry;
            g_found_candidates[g_found_count] = (uint8_t)i;
            g_found_count++;
        }
        doom_platform_loading_progress((uint8_t)(20U + (i + 1U) * 15U), "CHECKING WADS");
    }
    if(g_found_count == 0)
        return DOOM_STORAGE_NO_WAD;
    doom_storage_select_wad(0);
    return DOOM_STORAGE_OK;
}

size_t doom_storage_wad_count(void)
{
    return g_found_count;
}

const char *doom_storage_wad_name(size_t index)
{
    if(index >= g_found_count)
        return NULL;
    return g_candidates[g_found_candidates[index]].name;
}

uint8_t doom_storage_select_wad(size_t index)
{
    uint8_t candidate;
    if(index >= g_found_count)
        return 0;
    candidate = g_found_candidates[index];
    g_wad_entry = g_found_entries[index];
    snprintf(g_wad_path, sizeof(g_wad_path), "/DOOM/%s", g_candidates[candidate].name);
    snprintf(g_engine_path, sizeof(g_engine_path), "%s", g_candidates[candidate].engine_path);
    printf("[DOOM] selected %s\r\n", g_wad_path);
    return 1;
}

const char *doom_storage_selected_path(void)
{
    return g_engine_path;
}

const fat_file_entry_t *doom_storage_selected_entry(void)
{
    return g_wad_path[0] ? &g_wad_entry : NULL;
}

uint8_t doom_storage_path_exists(const char *path)
{
    return path && g_engine_path[0] && ascii_casecmp(path, g_engine_path) == 0;
}

const char *doom_storage_result_text(doom_storage_result_t result)
{
    switch(result)
    {
    case DOOM_STORAGE_OK: return "OK";
    case DOOM_STORAGE_NO_SD: return "NO SD CARD";
    case DOOM_STORAGE_BAD_FAT: return "FAT32 REQUIRED";
    case DOOM_STORAGE_NO_DIRECTORY: return "NO /DOOM DIR";
    case DOOM_STORAGE_NO_WAD: return "NO DOOM WAD";
    case DOOM_STORAGE_BAD_WAD: return "BAD WAD";
    default: return "SD READ ERROR";
    }
}
