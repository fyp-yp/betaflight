import semver from "semver";
import { API_VERSION_1_42 } from "../data_storage";
import FC from "../fc";
import { isExpertModeEnabled } from "./isExportModeEnabled";

export function updateTabList(features) {
    if (isExpertModeEnabled()) {
        $('#tabs ul.mode-connected li.tab_failsafe').show();
        $('#tabs ul.mode-connected li.tab_adjustments').show();
        $('#tabs ul.mode-connected li.tab_servos').show();
        $('#tabs ul.mode-connected li.tab_sensors').show();
        $('#tabs ul.mode-connected li.tab_logging').show();
        $('#tabs ul.mode-connected li.tab_pid_tuning').show();
        $('#tabs ul.mode-connected li.tab_onboard_logging').show();
        $('#tabs ul.mode-connected li.tab_auxiliary').show();
        $('#tabs ul.mode-connected li.tab_ports').show();
        $('#tabs ul.mode-connected li.tab_presets').show();
        $('#tabs ul.mode-connected li.tab_configuration').show();
        $('#tabs ul.mode-connected li.tab_cli').show();
    } else {
        $('#tabs ul.mode-connected li.tab_failsafe').hide();
        $('#tabs ul.mode-connected li.tab_adjustments').hide();
        $('#tabs ul.mode-connected li.tab_servos').hide();
        $('#tabs ul.mode-connected li.tab_logging').hide();
        $('#tabs ul.mode-connected li.tab_pid_tuning').hide();
        $('#tabs ul.mode-connected li.tab_onboard_logging').hide();
        $('#tabs ul.mode-connected li.tab_auxiliary').hide();
        $('#tabs ul.mode-connected li.tab_ports').hide();
        $('#tabs ul.mode-connected li.tab_presets').hide();
        $('#tabs ul.mode-connected li.tab_configuration').hide();
        $('#tabs ul.mode-connected li.tab_cli').hide();
    }

    if (features.isEnabled('GPS')) {
        $('#tabs ul.mode-connected li.tab_gps').show();
    } else {
        $('#tabs ul.mode-connected li.tab_gps').hide();
    }

    if (features.isEnabled('LED_STRIP') && isExpertModeEnabled()) {
        $('#tabs ul.mode-connected li.tab_led_strip').show();
    } else {
        $('#tabs ul.mode-connected li.tab_led_strip').hide();
    }

    if (features.isEnabled('TRANSPONDER') && isExpertModeEnabled()) {
        $('#tabs ul.mode-connected li.tab_transponder').show();
    } else {
        $('#tabs ul.mode-connected li.tab_transponder').hide();
    }

    if (features.isEnabled('OSD') && isExpertModeEnabled()) {
        $('#tabs ul.mode-connected li.tab_osd').show();
    } else {
        $('#tabs ul.mode-connected li.tab_osd').hide();
    }

    if (isExpertModeEnabled()) {
        $('#tabs ul.mode-connected li.tab_power').show();
    } else {
        $('#tabs ul.mode-connected li.tab_power').hide();
    }

    if (semver.gte(FC.CONFIG.apiVersion, API_VERSION_1_42) && isExpertModeEnabled()) {
        $('#tabs ul.mode-connected li.tab_vtx').show();
    } else {
        $('#tabs ul.mode-connected li.tab_vtx').hide();
    }
}
