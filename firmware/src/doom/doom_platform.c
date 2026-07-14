/*
 * SPDX-FileCopyrightText: 2026 aztechell
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

#include "doom_platform.h"

#include <stdio.h>
#include <string.h>

#include "../config/display_config.h"
#include "../config/input_config.h"
#include "../drivers/hk_input.h"
#include "../drivers/hk_lcd.h"
#include "../hal/hal_time.h"

#include "doom_port_api.h"
#include "doomkeys.h"
#include "doomstat.h"
#include "d_player.h"
#include "m_menu.h"

#define DOOM_Y_OFFSET 20U
#define INPUT_QUEUE_SIZE 24U
#define CHORD_HOLD_MS 350U
#define KEY_PULSE_MS 100U
#define BACK_DOUBLE_CLICK_MS 320U
#define OK_SEQUENCE_WINDOW_MS 450U
#define OK_BACKWARD_HOLD_MS 180U
#define HUSKYLENS_JUMP_KEY ((uint8_t)'/')

typedef struct
{
    uint8_t pressed;
    uint8_t key;
} doom_key_event_t;

static uint16_t g_palette[256];
static doom_key_event_t g_queue[INPUT_QUEUE_SIZE];
static uint8_t g_queue_read;
static uint8_t g_queue_write;
static uint32_t g_last_poll_ms;
static uint32_t g_mapped_state;
static uint32_t g_chord_started_ms;
static uint8_t g_chord_kind;
static uint8_t g_chord_fired;
static uint8_t g_wait_all_released;
static uint8_t g_last_menu_active;
static uint8_t g_pulse_key;
static uint32_t g_pulse_release_ms;
static uint8_t g_back_click_armed;
static uint8_t g_jump_chord_active;
static uint32_t g_back_click_deadline_ms;
static uint8_t g_ok_tap_armed;
static uint8_t g_ok_second_press;
static uint8_t g_backward_active;
static uint32_t g_ok_tap_deadline_ms;
static uint32_t g_ok_second_started_ms;
static uint32_t g_frames;
static uint32_t g_fps_started_ms;

static void queue_event(uint8_t pressed, uint8_t key)
{
    uint8_t next = (uint8_t)((g_queue_write + 1U) % INPUT_QUEUE_SIZE);
    if(next == g_queue_read)
        return;
    g_queue[g_queue_write].pressed = pressed;
    g_queue[g_queue_write].key = key;
    g_queue_write = next;
}

static void update_key_pulse(uint32_t now)
{
    if(g_pulse_key && (int32_t)(now - g_pulse_release_ms) >= 0)
    {
        queue_event(0, g_pulse_key);
        g_pulse_key = 0;
    }
}

static void start_key_pulse(uint8_t key, uint32_t now)
{
    if(g_pulse_key)
        queue_event(0, g_pulse_key);
    queue_event(1, key);
    g_pulse_key = key;
    g_pulse_release_ms = now + KEY_PULSE_MS;
}

static uint8_t mapped_key(uint32_t button, uint8_t in_menu)
{
    if(button == BUTTON_LEFT)
        return in_menu ? KEY_UPARROW : KEY_LEFTARROW;
    if(button == BUTTON_RIGHT)
        return in_menu ? KEY_DOWNARROW : KEY_RIGHTARROW;
    if(button == BUTTON_OK)
        return in_menu ? KEY_ENTER : KEY_UPARROW;
    return KEY_FIRE;
}

static void release_mapped_state(uint8_t in_menu)
{
    static const uint32_t buttons[] = {BUTTON_LEFT, BUTTON_OK, BUTTON_RIGHT, BUTTON_BACK};
    for(size_t i = 0; i < sizeof(buttons) / sizeof(buttons[0]); i++)
        if(g_mapped_state & buttons[i])
            queue_event(0, mapped_key(buttons[i], in_menu));
    g_mapped_state = 0;
}

static void update_regular_keys(uint32_t state, uint8_t in_menu)
{
    static const uint32_t buttons[] = {BUTTON_LEFT, BUTTON_OK, BUTTON_RIGHT, BUTTON_BACK};
    for(size_t i = 0; i < sizeof(buttons) / sizeof(buttons[0]); i++)
    {
        uint32_t button = buttons[i];
        uint8_t was_down = (g_mapped_state & button) != 0;
        uint8_t is_down = (state & button) != 0;
        if(was_down != is_down)
            queue_event(is_down, mapped_key(button, in_menu));
    }
    g_mapped_state = state;
}

static void reset_backward_gesture(void)
{
    g_ok_tap_armed = 0;
    g_ok_second_press = 0;
}

static void reset_back_click_gesture(void)
{
    g_back_click_armed = 0;
    g_jump_chord_active = 0;
}

static uint8_t update_pending_back_click(uint32_t now, uint32_t state, uint8_t in_menu)
{
    if(!g_back_click_armed)
        return 0;
    if(in_menu)
    {
        reset_back_click_gesture();
        return 0;
    }
    if(!(state & BUTTON_OK) || (int32_t)(now - g_back_click_deadline_ms) >= 0)
    {
        g_back_click_armed = 0;
        start_key_pulse(KEY_USE, now);
        return 1;
    }
    return 0;
}

static uint8_t update_backward_gesture(uint32_t now, uint32_t state,
                                       uint32_t changed, uint8_t in_menu,
                                       uint8_t chord)
{
    if(in_menu || chord)
    {
        if(g_backward_active)
        {
            queue_event(0, KEY_DOWNARROW);
            g_backward_active = 0;
        }
        reset_backward_gesture();
        return 0;
    }

    if(g_ok_tap_armed && (int32_t)(now - g_ok_tap_deadline_ms) >= 0)
        g_ok_tap_armed = 0;

    if(g_backward_active)
    {
        if(!(state & BUTTON_OK))
        {
            queue_event(0, KEY_DOWNARROW);
            g_backward_active = 0;
        }
        return 1;
    }

    if(changed & BUTTON_OK)
    {
        if(state & BUTTON_OK)
        {
            if(g_ok_tap_armed)
            {
                g_ok_tap_armed = 0;
                g_ok_second_press = 1;
                g_ok_second_started_ms = now;
            }
        }
        else
        {
            g_ok_second_press = 0;
            g_ok_tap_armed = 1;
            g_ok_tap_deadline_ms = now + OK_SEQUENCE_WINDOW_MS;
        }
    }

    if(g_ok_second_press && (state & BUTTON_OK) &&
       now - g_ok_second_started_ms >= OK_BACKWARD_HOLD_MS)
    {
        release_mapped_state(0);
        queue_event(1, KEY_DOWNARROW);
        g_ok_second_press = 0;
        g_backward_active = 1;
        return 1;
    }
    return 0;
}

static void input_poll_once(uint32_t now)
{
    uint32_t state;
    uint32_t changed;
    uint8_t in_menu = menuactive ? 1U : 0U;
    uint8_t chord = 0;

    buttons_poll();
    state = hk_input_state();
    changed = hk_input_changed();
    update_key_pulse(now);

    if(in_menu != g_last_menu_active)
    {
        release_mapped_state(g_last_menu_active);
        reset_back_click_gesture();
        g_last_menu_active = in_menu;
    }

    if(g_wait_all_released)
    {
        release_mapped_state(in_menu);
        if(state == 0)
        {
            g_wait_all_released = 0;
            g_chord_kind = 0;
            g_chord_fired = 0;
            reset_back_click_gesture();
        }
        return;
    }

    if((state & (BUTTON_BACK | BUTTON_OK)) == (BUTTON_BACK | BUTTON_OK))
        chord = 1;
    else if(!in_menu && (state & (BUTTON_BACK | BUTTON_RIGHT)) == (BUTTON_BACK | BUTTON_RIGHT))
        chord = 2;

    if(update_backward_gesture(now, state, changed, in_menu, chord))
        return;

    if(update_pending_back_click(now, state, in_menu))
        return;

    if(g_jump_chord_active)
    {
        if(!(state & BUTTON_BACK))
        {
            g_jump_chord_active = 0;
            update_regular_keys(state & ~BUTTON_BACK, in_menu);
        }
        return;
    }

    if(!in_menu && g_back_click_armed &&
       (changed & BUTTON_BACK) && (state & BUTTON_BACK) && (state & BUTTON_OK) &&
       (int32_t)(now - g_back_click_deadline_ms) < 0)
    {
        g_back_click_armed = 0;
        g_jump_chord_active = 1;
        release_mapped_state(0);
        start_key_pulse(HUSKYLENS_JUMP_KEY, now);
        g_chord_kind = 0;
        g_chord_fired = 0;
        return;
    }

    if(chord != g_chord_kind)
    {
        uint8_t previous_chord = g_chord_kind;

        if(previous_chord)
        {
            release_mapped_state(in_menu);
            if(previous_chord == 1 && !in_menu && !g_chord_fired &&
               (state & BUTTON_OK) && !(state & BUTTON_BACK))
            {
                g_chord_kind = 0;
                g_back_click_armed = 1;
                g_back_click_deadline_ms = now + BACK_DOUBLE_CLICK_MS;
                update_regular_keys(state & ~BUTTON_BACK, in_menu);
                return;
            }
            reset_back_click_gesture();
            g_wait_all_released = 1;
            return;
        }
        if(chord)
            release_mapped_state(in_menu);
        g_chord_kind = chord;
        g_chord_started_ms = now;
        g_chord_fired = 0;
    }
    if(chord && !g_chord_fired && now - g_chord_started_ms >= CHORD_HOLD_MS)
    {
        release_mapped_state(in_menu);
        if(chord == 1)
        {
            queue_event(1, KEY_ESCAPE);
            queue_event(0, KEY_ESCAPE);
        }
        else
        {
            unsigned char key = doom_platform_next_weapon_key();
            if(key)
                start_key_pulse(key, now);
        }
        g_chord_fired = 1;
        g_wait_all_released = 1;
        return;
    }
    if(g_chord_fired)
        return;
    if(chord)
        return;
    update_regular_keys(state, in_menu);
}

void DG_Init(void)
{
    lcd_fill_rect(0, 0, LCD_W, DOOM_Y_OFFSET, COLOR_BLACK);
    lcd_fill_rect(0, DOOM_Y_OFFSET + DOOMGENERIC_RESY, LCD_W, DOOM_Y_OFFSET, COLOR_BLACK);
    g_last_menu_active = menuactive ? 1U : 0U;
    g_fps_started_ms = DG_GetTicksMs();
    doom_platform_loading_progress(15, "INITIALIZING");
    printf("[DOOM] DG init framebuffer=%ux%u indexed\r\n", DOOMGENERIC_RESX, DOOMGENERIC_RESY);
}

void DG_DrawFrame(void)
{
    uint8_t *line = lcd_line_buffer();
    lcd_set_window(0, DOOM_Y_OFFSET, DOOMGENERIC_RESX - 1U,
                   DOOM_Y_OFFSET + DOOMGENERIC_RESY - 1U);
    for(uint32_t y = 0; y < DOOMGENERIC_RESY; y++)
    {
        const pixel_t *source = &DG_ScreenBuffer[y * DOOMGENERIC_RESX];
        for(uint32_t x = 0; x < DOOMGENERIC_RESX; x++)
        {
            uint16_t color = g_palette[source[x]];
            line[x * 2U] = (uint8_t)(color >> 8);
            line[x * 2U + 1U] = (uint8_t)color;
        }
        lcd_write_pixels(line, DOOMGENERIC_RESX * 2U);
    }

    g_frames++;
    uint32_t now = DG_GetTicksMs();
    if(now - g_fps_started_ms >= 5000U)
    {
        printf("[DOOM] fps=%u\r\n", (unsigned)(g_frames * 1000U / (now - g_fps_started_ms)));
        g_frames = 0;
        g_fps_started_ms = now;
    }
}

void DG_SleepMs(uint32_t ms)
{
    hal_sleep_ms(ms);
}

uint32_t DG_GetTicksMs(void)
{
    return (uint32_t)(hal_time_us() / 1000U);
}

int DG_GetKey(int *pressed, unsigned char *key)
{
    uint32_t now;
    if(g_queue_read != g_queue_write)
    {
        *pressed = g_queue[g_queue_read].pressed;
        *key = g_queue[g_queue_read].key;
        g_queue_read = (uint8_t)((g_queue_read + 1U) % INPUT_QUEUE_SIZE);
        return 1;
    }

    now = DG_GetTicksMs();
    if(now != g_last_poll_ms)
    {
        g_last_poll_ms = now;
        input_poll_once(now);
    }
    if(g_queue_read == g_queue_write)
        return 0;
    return DG_GetKey(pressed, key);
}

void DG_SetWindowTitle(const char *title)
{
    (void)title;
}

void DG_SetPalette(const uint8_t *palette)
{
    doom_platform_set_palette(palette);
}

void doom_platform_set_palette(const uint8_t *palette)
{
    for(uint32_t i = 0; i < 256; i++)
    {
        uint8_t r = *palette++;
        uint8_t g = *palette++;
        uint8_t b = *palette++;
        g_palette[i] = (uint16_t)(((uint16_t)(r & 0xF8U) << 8) |
                                  ((uint16_t)(g & 0xFCU) << 3) | (b >> 3));
    }
    doom_platform_loading_progress(90, "STARTING DOOM");
}

void doom_platform_loading_progress(uint8_t percent, const char *label)
{
    uint16_t width;
    if(percent > 100U)
        percent = 100U;
    width = (uint16_t)(276U * percent / 100U);
    lcd_fill_rect(18, 180, 284, 40, COLOR_BLACK);
    lcd_draw_text_centered(183, label ? label : "LOADING", COLOR_WHITE, COLOR_BLACK);
    lcd_draw_rect(20, 204, 280, 14, 1, COLOR_WHITE);
    lcd_fill_rect(22, 206, 276, 10, COLOR_BLACK);
    if(width)
        lcd_fill_rect(22, 206, width, 10, 0xFD20U);
}

unsigned char doom_platform_next_weapon_key(void)
{
    static const weapontype_t order[] = {
        wp_fist, wp_pistol, wp_shotgun, wp_chaingun, wp_missile,
        wp_plasma, wp_bfg, wp_chainsaw, wp_supershotgun,
    };
    static const unsigned char keys[] = {'1', '2', '3', '4', '5', '6', '7', '1', '3'};
    player_t *player = &players[consoleplayer];
    size_t start = 0;

    for(size_t i = 0; i < sizeof(order) / sizeof(order[0]); i++)
        if(order[i] == player->readyweapon)
            start = i + 1U;
    for(size_t i = 0; i < sizeof(order) / sizeof(order[0]); i++)
    {
        size_t index = (start + i) % (sizeof(order) / sizeof(order[0]));
        if(player->weaponowned[order[index]])
            return keys[index];
    }
    return 0;
}

void doom_platform_fatal(const char *message)
{
    printf("[DOOM] FATAL: %s\r\n", message ? message : "UNKNOWN");
    lcd_fill_rect(0, 0, LCD_W, LCD_H, COLOR_BLACK);
    lcd_draw_text_centered(88, "DOOM ERROR", COLOR_WHITE, COLOR_BLACK);
    lcd_draw_text_centered(112, message ? message : "UNKNOWN", COLOR_WHITE, COLOR_BLACK);
    while(1)
        hal_sleep_ms(1000);
}
