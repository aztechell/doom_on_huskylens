/*
 * SPDX-FileCopyrightText: 2026 aztechell
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

#include <string.h>

#include "doom_storage.h"
#include "doom_platform.h"
#include "../config/sd_config.h"
#include "../drivers/hk_sd.h"
#include "../storage/fat32_allocation.h"
#include "../storage/fat32_volume.h"
#include "../storage/internal/fat32_state_private.h"

#include "w_file.h"
#include "z_zone.h"

#define FAT_EOC 0x0FFFFFF8UL

typedef struct
{
    wad_file_t wad;
    uint32_t *clusters;
    uint32_t cluster_count;
} huskylens_wad_file_t;

static wad_file_t *huskylens_open(char *path);
static void huskylens_close(wad_file_t *wad);
static size_t huskylens_read(wad_file_t *wad, unsigned int offset,
                             void *buffer, size_t buffer_len);

wad_file_class_t huskylens_wad_file = {
    huskylens_open,
    huskylens_close,
    huskylens_read,
};

static wad_file_t *huskylens_open(char *path)
{
    const fat_file_entry_t *entry;
    huskylens_wad_file_t *file;
    uint32_t cluster_size;
    uint32_t cluster;

    if(!doom_storage_path_exists(path))
        return NULL;
    entry = doom_storage_selected_entry();
    if(!entry)
        return NULL;

    cluster_size = fat32_cluster_size();
    if(cluster_size == 0)
        return NULL;
    file = Z_Malloc(sizeof(*file), PU_STATIC, NULL);
    memset(file, 0, sizeof(*file));
    file->cluster_count = (entry->size + cluster_size - 1U) / cluster_size;
    file->clusters = Z_Malloc(file->cluster_count * sizeof(uint32_t), PU_STATIC, NULL);

    cluster = entry->cluster;
    for(uint32_t i = 0; i < file->cluster_count; i++)
    {
        if(cluster < 2 || cluster >= FAT_EOC)
        {
            Z_Free(file->clusters);
            Z_Free(file);
            return NULL;
        }
        file->clusters[i] = cluster;
        if(i + 1U < file->cluster_count)
            cluster = fat_next_cluster(cluster);
    }

    file->wad.file_class = &huskylens_wad_file;
    file->wad.mapped = NULL;
    file->wad.length = entry->size;
    doom_platform_loading_progress(55, "INDEXING WAD");
    return &file->wad;
}

static void huskylens_close(wad_file_t *wad)
{
    huskylens_wad_file_t *file = (huskylens_wad_file_t *)wad;
    Z_Free(file->clusters);
    Z_Free(file);
}

static size_t huskylens_read(wad_file_t *wad, unsigned int offset,
                             void *buffer, size_t buffer_len)
{
    huskylens_wad_file_t *file = (huskylens_wad_file_t *)wad;
    uint8_t *destination = buffer;
    uint8_t *sector = fat32_sector_scratch();
    uint32_t cluster_size = fat32_cluster_size();
    size_t total = 0;

    if(offset >= wad->length)
        return 0;
    if(buffer_len > wad->length - offset)
        buffer_len = wad->length - offset;

    while(buffer_len)
    {
        uint32_t cluster_index = offset / cluster_size;
        uint32_t in_cluster = offset % cluster_size;
        uint32_t sector_index = in_cluster / SD_BLOCK_SIZE;
        uint16_t sector_offset = (uint16_t)(in_cluster % SD_BLOCK_SIZE);
        size_t take = SD_BLOCK_SIZE - sector_offset;
        uint32_t lba;

        if(cluster_index >= file->cluster_count)
            break;
        if(take > buffer_len)
            take = buffer_len;
        lba = fat_cluster_lba(file->clusters[cluster_index]) + sector_index;
        if(!sd_read_block(lba, sector))
            break;
        memcpy(destination, &sector[sector_offset], take);
        destination += take;
        offset += (unsigned int)take;
        buffer_len -= take;
        total += take;
    }
    return total;
}
