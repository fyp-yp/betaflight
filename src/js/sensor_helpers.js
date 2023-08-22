import FC from './fc';
import { bit_check } from './bit';

export function have_sensor(sensors_detected, sensor_code) {
    switch(sensor_code) {
        case 'acc':
            return bit_check(sensors_detected, 0);
        case 'baro':
            return bit_check(sensors_detected, 1);
        case 'mag':
            return bit_check(sensors_detected, 2);
        case 'gps':
            return bit_check(sensors_detected, 3);
        case 'sonar':
            return bit_check(sensors_detected, 4);
        case 'gyro':
            return bit_check(sensors_detected, 5);
    }
    return false;
}

function set_result(sensors_detected, sensor, result)
{
    if (sensors_detected) FC.CONFIG.testResults[sensor] = result;
}

export function sensor_status(sensors_detected) {
    // initialize variable (if it wasn't)
    if (!sensor_status.previous_sensors_detected) {
        sensor_status.previous_sensors_detected = -1; // Otherwise first iteration will not be run if sensors_detected == 0
    }

    // update UI (if necessary)
    if (sensor_status.previous_sensors_detected == sensors_detected) {
        return;
    }

    // set current value
    sensor_status.previous_sensors_detected = sensors_detected;

    const eSensorStatus = $("div#sensor-status");

    if (have_sensor(sensors_detected, "acc")) {
        $(".accel", eSensorStatus).addClass("on");
        $(".accicon", eSensorStatus).addClass("active");
        $(".acc-result", eSensorStatus).addClass("pass").removeClass("fail");
        set_result(sensors_detected, "acc", "pass");
    } else {
        $(".accel", eSensorStatus).removeClass("on");
        $(".accicon", eSensorStatus).removeClass("active");
        $(".acc-result", eSensorStatus).addClass("fail").removeClass("pass");
        set_result(sensors_detected, "acc", "fail");
    }

    if (
        (FC.CONFIG.boardType == 0 || FC.CONFIG.boardType == 2) &&
        have_sensor(sensors_detected, "gyro")
    ) {
        $(".gyro", eSensorStatus).addClass("on");
        $(".gyroicon", eSensorStatus).addClass("active");
        $(".gryo-result", eSensorStatus).addClass("pass").removeClass("fail");
        set_result(sensors_detected, "gyro", "pass");
    } else {
        $(".gyro", eSensorStatus).removeClass("on");
        $(".gyroicon", eSensorStatus).removeClass("active");
        $(".gryo-result", eSensorStatus).addClass("fail").removeClass("pass");
        set_result(sensors_detected, "gyro", "fail");
    }

    if (have_sensor(sensors_detected, "baro")) {
        $(".baro", eSensorStatus).addClass("on");
        $(".baroicon", eSensorStatus).addClass("active");
        $(".baro-result", eSensorStatus).addClass("pass").removeClass("fail");
        set_result(sensors_detected, "baro", "pass");
    } else {
        $(".baro", eSensorStatus).removeClass("on");
        $(".baroicon", eSensorStatus).removeClass("active");
        $(".baro-result", eSensorStatus).addClass("fail").removeClass("pass");
        set_result(sensors_detected, "baro", "fail");
    }

    if (have_sensor(sensors_detected, "mag")) {
        $(".mag", eSensorStatus).addClass("on");
        $(".magicon", eSensorStatus).addClass("active");
        set_result(sensors_detected, "mag", "pass");
    } else {
        $(".mag", eSensorStatus).removeClass("on");
        $(".magicon", eSensorStatus).removeClass("active");
        set_result(sensors_detected, "mag", "fail");
    }
    $(".mag", eSensorStatus).hide();

    if (have_sensor(sensors_detected, "gps")) {
        $(".gps", eSensorStatus).addClass("on");
        $(".gpsicon", eSensorStatus).addClass("active");
        $(".gps-result", eSensorStatus).addClass("pass").removeClass("fail");
        set_result(sensors_detected, "gps", "pass");
    } else {
        $(".gps", eSensorStatus).removeClass("on");
        $(".gpsicon", eSensorStatus).removeClass("active");
        $(".gps-result", eSensorStatus).addClass("fail").removeClass("pass");
        set_result(sensors_detected, "gps", "fail");
    }

    if (have_sensor(sensors_detected, "sonar")) {
        $(".sonar", eSensorStatus).addClass("on");
        $(".sonaricon", eSensorStatus).addClass("active");
        set_result(sensors_detected, "sonar", "pass");
    } else {
        $(".sonar", eSensorStatus).removeClass("on");
        $(".sonaricon", eSensorStatus).removeClass("active");
        set_result(sensors_detected, "sonar", "fail");
    }
    $(".sonar", eSensorStatus).hide();
}
