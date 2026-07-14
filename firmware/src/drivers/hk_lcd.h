#ifndef HK_LCD_H
#define HK_LCD_H

#include <stddef.h>
#include <stdint.h>


void lcd_init_original_sequence(void);
void lcd_draw_boot_logo(void);
void lcd_set_window(uint16_t x0, uint16_t y0, uint16_t x1, uint16_t y1);
void lcd_write_pixels(const uint8_t *data, size_t len);
uint8_t *lcd_line_buffer(void);
uint16_t lcd_shadow_pixel(uint16_t x, uint16_t y);
void lcd_fill_rect(uint16_t x, uint16_t y, uint16_t w, uint16_t h, uint16_t color);
void lcd_draw_rect(uint16_t x, uint16_t y, uint16_t w, uint16_t h, uint16_t thickness, uint16_t color);
const uint8_t *term_glyph(char c);
void lcd_draw_glyph_at(uint16_t x0, uint16_t y0, char c, uint16_t fg, uint16_t bg);
void lcd_draw_text_at(uint16_t x, uint16_t y, const char *text, uint16_t fg, uint16_t bg);
void lcd_draw_text_centered(uint16_t y, const char *text, uint16_t fg, uint16_t bg);

#endif
