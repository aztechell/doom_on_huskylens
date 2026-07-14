#ifndef HAL_SYSTEM_H
#define HAL_SYSTEM_H

void hal_system_init_clocks(void);
void hal_system_reboot(void) __attribute__((noreturn));

#endif
