/*
 * SPDX-FileCopyrightText: 2026 aztechell
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include <syscalls.h>

#include "doom_platform.h"
#include "../hal/hal_system.h"

#include "doomtype.h"
#include "i_system.h"

#define EXIT_HANDLERS_MAX 16U
#define DOOM_HEAP_RESERVE (512U * 1024U)

typedef struct
{
    atexit_func_t function;
    boolean on_error;
} exit_handler_t;

static exit_handler_t g_exit_handlers[EXIT_HANDLERS_MAX];
static size_t g_exit_handler_count;

void I_AtExit(atexit_func_t function, boolean run_on_error)
{
    if(g_exit_handler_count < EXIT_HANDLERS_MAX)
    {
        g_exit_handlers[g_exit_handler_count].function = function;
        g_exit_handlers[g_exit_handler_count].on_error = run_on_error;
        g_exit_handler_count++;
    }
}

void I_Tactile(int on, int off, int total)
{
    (void)on;
    (void)off;
    (void)total;
}

byte *I_ZoneBase(int *size)
{
    static const int candidates[] = {4, 3, 2};
    byte *memory = NULL;
    size_t free_heap = get_free_heap_size();

    printf("[DOOM] heap before zone=%u reserve=%u\r\n", (unsigned)free_heap,
           (unsigned)DOOM_HEAP_RESERVE);
    for(size_t i = 0; i < sizeof(candidates) / sizeof(candidates[0]); i++)
    {
        *size = candidates[i] * 1024 * 1024;
        if(free_heap <= (size_t)*size + DOOM_HEAP_RESERVE)
            continue;
        memory = malloc((size_t)*size);
        if(memory)
            break;
    }
    if(!memory)
        doom_platform_fatal("ZONE ALLOC FAILED");
    doom_platform_loading_progress(25, "ALLOCATING MEMORY");
    printf("[DOOM] zone=%u heap_after=%u\r\n", (unsigned)*size,
           (unsigned)get_free_heap_size());
    return memory;
}

void I_PrintBanner(char *text)
{
    printf("[DOOM] %s\r\n", text);
}

void I_PrintDivider(void)
{
    printf("[DOOM] --------------------------------\r\n");
}

void I_PrintStartupBanner(char *description)
{
    I_PrintDivider();
    I_PrintBanner(description);
    I_PrintDivider();
}

boolean I_ConsoleStdout(void)
{
    return true;
}

void I_Init(void)
{
}

void I_BindVariables(void)
{
}

ticcmd_t *I_BaseTiccmd(void)
{
    static ticcmd_t empty;
    return &empty;
}

void I_Quit(void)
{
    printf("[DOOM] returning to WAD menu\r\n");
    doom_platform_loading_progress(100, "RETURNING TO WAD MENU");
    hal_system_reboot();
}

void I_Error(char *error, ...)
{
    char message[96];
    va_list args;

    va_start(args, error);
    vsnprintf(message, sizeof(message), error, args);
    va_end(args);
    for(size_t i = g_exit_handler_count; i > 0; i--)
        if(g_exit_handlers[i - 1U].on_error && g_exit_handlers[i - 1U].function)
            g_exit_handlers[i - 1U].function();
    doom_platform_fatal(message);
}

boolean I_GetMemoryValue(unsigned int offset, void *value, int size)
{
    static const uint8_t dos_memory[10] = {0x9E, 0x0F, 0xC9, 0x00, 0x65, 0x04, 0x70, 0x00, 0x16, 0x00};
    if(size < 0 || offset + (unsigned int)size > sizeof(dos_memory))
        return false;
    memcpy(value, &dos_memory[offset], (size_t)size);
    return true;
}
