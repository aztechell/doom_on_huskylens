/*
 * SPDX-FileCopyrightText: 2026 aztechell
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

#include <stdio.h>

#include "board/board_hackylens.h"
#include "config/display_config.h"
#include "config/input_config.h"
#include "doom/doom_platform.h"
#include "doom/doom_storage.h"
#include "drivers/hk_input.h"
#include "drivers/hk_lcd.h"
#include "drivers/hk_lights.h"
#include "hal/hal_system.h"
#include "hal/hal_time.h"

#include "doom_port_api.h"
#include "m_menu.h"
#include "doom_loading_rgb565.h"

#define MENU_PANEL_X 8U
#define MENU_PANEL_Y 106U
#define MENU_PANEL_W 304U
#define MENU_PANEL_H 106U
#define MENU_ROW_Y 135U
#define MENU_ROW_STEP 24U
#define MENU_VISIBLE_ROWS 3U
#define COLOR_DOOM_ORANGE 0xFD20U
#define COLOR_DOOM_RED 0xB800U
#define WAD_MENU_IDLE_SLEEP_US (60ULL * 1000000ULL)

static void show_loading_screen(void)
{
    uint8_t *line = lcd_line_buffer();

    lcd_fill_rect(0, 0, LCD_W, LCD_H, COLOR_BLACK);
    lcd_set_window(0, 20, DOOM_LOADING_WIDTH - 1U, 20U + DOOM_LOADING_HEIGHT - 1U);
    for(uint32_t y = 0; y < DOOM_LOADING_HEIGHT; y++)
    {
        const uint8_t *source = &g_doom_loading_rgb565_pixels[y * DOOM_LOADING_WIDTH];
        for(uint32_t x = 0; x < DOOM_LOADING_WIDTH; x++)
        {
            uint16_t color = g_doom_loading_rgb565_palette[source[x]];
            line[x * 2U] = (uint8_t)(color >> 8);
            line[x * 2U + 1U] = (uint8_t)color;
        }
        lcd_write_pixels(line, DOOM_LOADING_WIDTH * 2U);
    }
}

static void draw_wad_menu_row(size_t wad_index,
                              size_t visible_row,
                              uint8_t selected)
{
    char label[32];
    uint16_t y = (uint16_t)(MENU_ROW_Y + visible_row * MENU_ROW_STEP);

    lcd_fill_rect(18, y - 3U, LCD_W - 36U, 22, COLOR_BLACK);
    if(selected)
        lcd_draw_rect(18, y - 3U, LCD_W - 36U, 22, 1, COLOR_DOOM_RED);

    snprintf(label, sizeof(label), selected ? ">  %s  <" : "%s",
             doom_storage_wad_name(wad_index));
    lcd_draw_text_centered(y, label,
                           selected ? COLOR_DOOM_ORANGE : COLOR_WHITE,
                           COLOR_BLACK);
}

static void draw_wad_menu_panel(size_t selected, size_t first_visible)
{
    size_t count = doom_storage_wad_count();

    lcd_fill_rect(MENU_PANEL_X, MENU_PANEL_Y, MENU_PANEL_W, MENU_PANEL_H,
                  COLOR_BLACK);
    lcd_draw_rect(MENU_PANEL_X, MENU_PANEL_Y, MENU_PANEL_W, MENU_PANEL_H, 2,
                  COLOR_DOOM_RED);
    lcd_draw_text_centered(111, "SELECT GAME", COLOR_DOOM_ORANGE, COLOR_BLACK);

    for(size_t row = 0; row < MENU_VISIBLE_ROWS; row++)
    {
        size_t wad_index = first_visible + row;
        if(wad_index >= count)
            break;

        draw_wad_menu_row(wad_index, row, wad_index == selected);
    }
}

static void draw_wad_menu(size_t selected, size_t first_visible)
{
    show_loading_screen();
    draw_wad_menu_panel(selected, first_visible);
}

static void wad_menu_enter_sleep(void)
{
    lights_screen_backlight_off();
    lcd_fill_rect(0, 0, LCD_W, LCD_H, COLOR_BLACK);
    printf("[WAD] sleep after 60s idle\r\n");
}

static void wad_menu_wake(size_t selected, size_t first_visible)
{
    draw_wad_menu(selected, first_visible);
    lights_screen_backlight_set(100);
    printf("[WAD] wake\r\n");
}

static size_t select_wad_menu(void)
{
    size_t selected = 0;
    size_t first_visible = 0;
    size_t count = doom_storage_wad_count();
    uint64_t last_activity_us;
    uint8_t sleeping = 0;

    buttons_sync();
    while(hk_input_state() != 0)
    {
        buttons_poll();
        hal_sleep_ms(10);
    }

    draw_wad_menu(selected, first_visible);
    last_activity_us = hal_time_us();

    while(1)
    {
        uint64_t now;
        uint32_t state;
        uint32_t pressed;
        uint8_t selection_changed = 0;

        buttons_poll();
        now = hal_time_us();
        state = hk_input_state();
        pressed = hk_input_pressed();

        if(state)
            last_activity_us = now;

        if(sleeping)
        {
            if(pressed)
            {
                sleeping = 0;
                last_activity_us = now;
                wad_menu_wake(selected, first_visible);
            }
            hal_sleep_ms(10);
            continue;
        }

        if(pressed & BUTTON_LEFT)
        {
            selected = selected == 0 ? count - 1U : selected - 1U;
            selection_changed = 1;
        }
        else if(pressed & BUTTON_RIGHT)
        {
            selected = (selected + 1U) % count;
            selection_changed = 1;
        }
        else if(pressed & BUTTON_OK)
        {
            return selected;
        }

        if(selection_changed)
        {
            if(selected < first_visible)
            {
                first_visible = selected;
            }
            else if(selected >= first_visible + MENU_VISIBLE_ROWS)
            {
                first_visible = selected - MENU_VISIBLE_ROWS + 1U;
            }

            draw_wad_menu_panel(selected, first_visible);
        }

        if(!state && now - last_activity_us >= WAD_MENU_IDLE_SLEEP_US)
        {
            sleeping = 1;
            wad_menu_enter_sleep();
        }

        hal_sleep_ms(10);
    }
}

int main(void)
{
    doom_storage_result_t storage;
    size_t selected;
    char loading_label[32];
    char *argv[5];

    hal_system_init_clocks();
    board_lcd_init_original();
    board_buttons_init();
    buttons_sync();
    lcd_init_original_sequence();
    lights_screen_backlight_set(100);
    show_loading_screen();
    doom_platform_loading_progress(5, "SCANNING SD CARD");

    storage = doom_storage_mount_and_find();
    if(storage != DOOM_STORAGE_OK)
        doom_platform_fatal(doom_storage_result_text(storage));
    selected = select_wad_menu();
    if(!doom_storage_select_wad(selected))
        doom_platform_fatal("WAD SELECTION FAILED");
    show_loading_screen();
    snprintf(loading_label, sizeof(loading_label), "LOADING %s",
             doom_storage_wad_name(selected));
    doom_platform_loading_progress(10, loading_label);

    argv[0] = "doomgeneric";
    argv[1] = "-iwad";
    argv[2] = (char *)doom_storage_selected_path();
    argv[3] = "-nosound";
    argv[4] = "-nomusic";
    if(!doom_engine_start(5, argv))
        doom_platform_fatal("DOOM ENGINE START FAILED");
    M_StartControlPanel();
    while(1)
        doomgeneric_Tick();
}
