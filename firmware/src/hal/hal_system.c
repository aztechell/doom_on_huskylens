/*
 * SPDX-FileCopyrightText: 2026 aztechell
 * SPDX-License-Identifier: MIT
 */

#include "hal_system.h"

#include <sysctl.h>
#include <wdt.h>

extern volatile wdt_t *const wdt[2];

void hal_system_init_clocks(void)
{
    sysctl_pll_set_freq(SYSCTL_PLL0, 800000000);
}

void hal_system_reboot(void)
{
    sysctl_reset(SYSCTL_RESET_WDT0);
    sysctl_clock_set_threshold(SYSCTL_THRESHOLD_WDT0, 0);
    sysctl_clock_enable(SYSCTL_CLOCK_WDT0);
    sysctl->power_sel.power_mode_sel6 = WDT_RESET_ALL;
    wdt[WDT_DEVICE_0]->cr = 0;
    wdt[WDT_DEVICE_0]->torr = WDT_TORR_TOP(0);
    wdt[WDT_DEVICE_0]->crr = WDT_CRR_MASK;
    wdt[WDT_DEVICE_0]->cr = WDT_CR_RMOD_RESET | WDT_CR_ENABLE;
    while(1)
        __asm__ volatile("nop");
}
