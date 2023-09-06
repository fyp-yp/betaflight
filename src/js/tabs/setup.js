import { i18n } from '../localization';
import semver from 'semver';
import { isExpertModeEnabled } from '../utils/isExportModeEnabled';
import GUI, { TABS } from '../gui';
import { configuration_backup, configuration_restore } from '../backup_restore';
import { have_sensor, sensor_status } from '../sensor_helpers';
import { mspHelper } from '../msp/MSPHelper';
import FC from '../fc';
import MSP from '../msp';
import Model from '../model';
import MSPCodes from '../msp/MSPCodes';
import CONFIGURATOR, { API_VERSION_1_42, API_VERSION_1_43 } from '../data_storage';
import PortUsage from "../port_usage";
import { gui_log } from '../gui_log';
import EscProtocols from "../utils/EscProtocols";
import DshotCommand from "../../js/utils/DshotCommand.js";
import { bit_check } from "../bit";

const setup = {
    yaw_fix: 0.0,
};

function setResult(e, result) {
    if (result == undefined) {
        e.text("待测试");
        e.addClass("testundef").removeClass("testfail").removeClass("testpass");
    }
    else if (result) e.removeClass("testundef").removeClass("testfail").addClass("testpass");
    else e.removeClass("testundef").removeClass("testpass").addClass("testfail");
}

setup.initialize = function (callback) {
    const self = this;
    self.armed = false;
    self.numberOfValidOutputs = 4;

    if (GUI.active_tab != 'setup') {
        GUI.active_tab = 'setup';
    }

    function load_status() {
        MSP.send_message(MSPCodes.MSP_STATUS, false, false, load_mixer_config);
    }

    function load_mixer_config() {
        MSP.send_message(MSPCodes.MSP_MIXER_CONFIG, false, false, load_html);
    }

    async function load_motor() {
        await MSP.promise(MSPCodes.MSP_STATUS);
        await MSP.promise(MSPCodes.MSP_PID_ADVANCED);
        await MSP.promise(MSPCodes.MSP_FEATURE_CONFIG);
        await MSP.promise(MSPCodes.MSP_MIXER_CONFIG);
        if (FC.MOTOR_CONFIG.use_dshot_telemetry || FC.MOTOR_CONFIG.use_esc_sensor) {
            await MSP.promise(MSPCodes.MSP_MOTOR_TELEMETRY);
        }
        await MSP.promise(MSPCodes.MSP_MOTOR_CONFIG);
        await MSP.promise(MSPCodes.MSP_MOTOR_3D_CONFIG);
        await MSP.promise(MSPCodes.MSP2_MOTOR_OUTPUT_REORDERING);
        await MSP.promise(MSPCodes.MSP_ADVANCED_CONFIG);
        if (semver.gte(FC.CONFIG.apiVersion, API_VERSION_1_42)) {
            await MSP.promise(MSPCodes.MSP_FILTER_CONFIG);
        }
        await MSP.promise(MSPCodes.MSP_ARMING_CONFIG);
        FC.CONFIG.testResults["motorData"] = 0;
        FC.CONFIG.testResults["motorDataMax"] = 0;
        FC.CONFIG.testResults["motorsAMax"] = undefined;
    }

    function update_arm_status() {
        self.armed = bit_check(FC.CONFIG.mode, 0);
    }

    function load_html() {
        load_motor();
        MSP.send_message(MSPCodes.MSP_ADVANCED_CONFIG, false, false, function() {
            $('#content').load("./tabs/setup.html", process_html);
        });
    }

    function getMotorOutputs() {
        const motorData_e = $('.motorData');
        const motorsADrawing_e = $('.motorsADrawing');
        motorData_e.text(FC.CONFIG.testResults["motorData"] / 1010101);
        setResult(motorData_e, FC.CONFIG.testResults["motorDataMax"] > 0 && (FC.CONFIG.testResults["motorDataMax"] % 1010101 == 0));
        if (!FC.CONFIG.testResults["motorsAMax"] || FC.ANALOG.amperage.toFixed(2) > FC.CONFIG.testResults["motorsAMax"]) FC.CONFIG.testResults["motorsAMax"] = FC.ANALOG.amperage.toFixed(2);
        motorsADrawing_e.text(`${FC.ANALOG.amperage.toFixed(2)} A`);
        setResult(motorsADrawing_e, FC.CONFIG.testResults["motorsAMax"] > 1.1);
    }

    function updateMotor() {
        // status needed for arming flag
        MSP.send_message(MSPCodes.MSP_STATUS, false, false, function() {
            update_arm_status();
            MSP.send_message(MSPCodes.MSP_MOTOR, false, false, function () {
                if (FC.MOTOR_CONFIG.use_dshot_telemetry || FC.MOTOR_CONFIG.use_esc_sensor) {
                    MSP.send_message(MSPCodes.MSP_MOTOR_TELEMETRY, false, false, getMotorOutputs);
                } else {
                    getMotorOutputs();
                }
            });
        });
    }

    MSP.send_message(MSPCodes.MSP_ACC_TRIM, false, false, load_status);

    function experimentalBackupRestore() {
        const backupButton = $('#content .backup');
        const restoreButton = $('#content .restore');

        backupButton.on('click', () => configuration_backup(() => gui_log(i18n.getMessage('initialSetupBackupSuccess'))));

        restoreButton.on('click', () => configuration_restore(() => {
            // get latest settings
            TABS.setup.initialize();

            gui_log(i18n.getMessage('initialSetupRestoreSuccess'));
        }));

        if (CONFIGURATOR.virtualMode) {
            // saving and uploading an imaginary config to hardware is a bad idea
            backupButton.addClass('disabled');
        } else {
            restoreButton.addClass('disabled');

            if (semver.gte(FC.CONFIG.apiVersion, API_VERSION_1_43)) {
                $('.backupRestore').hide();
            }
        }
    }

    function process_html() {
        // translate to user-selected language
        i18n.localizePage();
        // update_arm_status();

        experimentalBackupRestore();

        // initialize 3D Model
        self.initModel();

        // set roll in interactive block
        $('span.roll').text(i18n.getMessage('initialSetupAttitude', [0]));
        // set pitch in interactive block
        $('span.pitch').text(i18n.getMessage('initialSetupAttitude', [0]));
        // set heading in interactive block
        $('span.heading').text(i18n.getMessage('initialSetupAttitude', [0]));

        // check if we have accelerometer and magnetometer
        if (!have_sensor(FC.CONFIG.activeSensors, 'acc')) {
            $('a.calibrateAccel').addClass('disabled');
            $('default_btn').addClass('disabled');
        }

        if (!have_sensor(FC.CONFIG.activeSensors, 'mag')) {
            $('a.calibrateMag').addClass('disabled');
            $('default_btn').addClass('disabled');
        }

        self.initializeInstruments();

        $('#arming-disable-flag').attr('title', i18n.getMessage('initialSetupArmingDisableFlagsTooltip'));

        if (isExpertModeEnabled() && false) {
            $('.initialSetupRebootBootloader').show();
        } else {
            $('.initialSetupRebootBootloader').hide();
        }

        $('a.rebootBootloader').click(function () {
            const buffer = [];
            buffer.push(FC.boardHasFlashBootloader() ? mspHelper.REBOOT_TYPES.BOOTLOADER_FLASH : mspHelper.REBOOT_TYPES.BOOTLOADER);
            MSP.send_message(MSPCodes.MSP_SET_REBOOT, buffer, false);
        });

        // UI Hooks
        $('a.calibrateAccel').on('click', function () {
            const _self = $(this);

            if (!_self.hasClass('calibrating')) {
                _self.addClass('calibrating');

                // During this period MCU won't be able to process any serial commands because its locked in a for/while loop
                // until this operation finishes, sending more commands through data_poll() will result in serial buffer overflow
                GUI.interval_pause('setup_data_pull');
                MSP.send_message(MSPCodes.MSP_ACC_CALIBRATION, false, false, function () {
                    gui_log(i18n.getMessage('initialSetupAccelCalibStarted'));
                    $('#accel_calib_running').show();
                    $('#accel_calib_rest').hide();
                    FC.CONFIG.testResults["accelCalib"] = undefined;
                });

                GUI.timeout_add('button_reset', function () {
                    GUI.interval_resume('setup_data_pull');

                    gui_log(i18n.getMessage('initialSetupAccelCalibEnded'));
                    _self.removeClass('calibrating');
                    $('#accel_calib_running').hide();
                    $('#accel_calib_rest').show();
                    FC.CONFIG.testResults["accelCalib"] = true;
                }, 2000);
            }
        });

        $('a.gyroDataTest').on('click', function () {
            const _self = $(this);

            if (!_self.hasClass('calibrating')) {
                _self.addClass('calibrating');

                $('#gyro_data_running').show();
                $('#gyro_data_rest').hide();
                FC.CONFIG.testResults["gyroRaw"] = undefined;
                FC.CONFIG.testResults["gyroData"] = undefined;

                GUI.timeout_add('button_reset', function () {
                    _self.removeClass('calibrating');
                    $('#gyro_data_running').hide();
                    $('#gyro_data_rest').show();
                }, 2000);
            }
        });

        self.motorEnabled = false;
        self.motorVal = 0;
        self.buffer_delay = false;

        function motorTest() {
            if (self.buffer_delay && self.motorVal) return;
            let bufferingSetMotor = [];
            let buffer = [];
            for (let i = 0; i < self.numberOfValidOutputs; i++) {
                let val = self.motorVal%100;
                if (val > 50) val = 100 - val;
                buffer.push16(1000 + val);
            }
            self.motorVal += 1;

            bufferingSetMotor.push(buffer);

            self.buffer_delay = setTimeout(function () {
                buffer = bufferingSetMotor.pop();

                MSP.send_message(MSPCodes.MSP_SET_MOTOR, buffer);

                bufferingSetMotor = [];
                self.buffer_delay = false;
            }, 10);
        }

        function enableMotor(enabled) {
            // Send enable extended dshot telemetry command
            if (self.motorEnabled && enabled) {
                motorTest();
                return;
            }
            self.motorVal = 0;
            if (enabled) {
                $('#motor_running').show();
                $('#motor_rest').hide();
                FC.CONFIG.testResults["motorData"] = 0;
                FC.CONFIG.testResults["motorDataMax"] = 0;
                FC.CONFIG.testResults["motorsAMax"] = undefined;

                const buffer = [];
                buffer.push8(DshotCommand.dshotCommandType_e.DSHOT_CMD_TYPE_BLOCKING);
                buffer.push8(255);  // Send to all escs
                buffer.push8(1);    // 1 command
                buffer.push8(13);   // Enable extended dshot telemetry
                MSP.send_message(MSPCodes.MSP2_SEND_DSHOT_COMMAND, buffer);
            } else {
                motorTest();
                $('#motor_running').hide();
                $('#motor_rest').show();
            }
            mspHelper.setArmingEnabled(enabled, enabled);
            self.motorEnabled = enabled;
        }

        // $('a.motorTest').on('click', function () {
        //     enableMotor(true);
        //     GUI.timeout_add('button_reset', function () {
        //         enableMotor(false);
        //     }, 1000);
        // });

        $('a.receiverTest').on('click', function () {
            const _self = $(this);

            if (!_self.hasClass('calibrating')) {
                _self.addClass('calibrating');

                // During this period MCU won't be able to process any serial commands because its locked in a for/while loop
                // until this operation finishes, sending more commands through data_poll() will result in serial buffer overflow
                GUI.interval_pause('setup_data_pull');
                $('#receiver_running').show();
                $('#receiver_rest').hide();
                FC.CONFIG.testResults["receiver"] = undefined;
                FC.CONFIG.testResults["receiverValues"] = undefined;

                GUI.timeout_add('button_reset', function () {
                    GUI.interval_resume('setup_data_pull');

                    _self.removeClass('calibrating');
                    $('#receiver_running').hide();
                    $('#receiver_rest').show();
                }, 2000);
            }
        });

        $('a.calibrateMag').on('click', function () {
            const _self = $(this);

            if (!_self.hasClass('calibrating') && !_self.hasClass('disabled')) {
                _self.addClass('calibrating');

                MSP.send_message(MSPCodes.MSP_MAG_CALIBRATION, false, false, function () {
                    gui_log(i18n.getMessage('initialSetupMagCalibStarted'));
                    $('#mag_calib_running').show();
                    $('#mag_calib_rest').hide();
                });

                GUI.timeout_add('button_reset', function () {
                    gui_log(i18n.getMessage('initialSetupMagCalibEnded'));
                    _self.removeClass('calibrating');
                    $('#mag_calib_running').hide();
                    $('#mag_calib_rest').show();
                }, 30000);
            }
        });

        const dialogConfirmReset = $('.dialogConfirmReset')[0];

        $('a.resetSettings').on('click', function () {
            dialogConfirmReset.showModal();
        });

        $('.dialogConfirmReset-cancelbtn').click(function() {
            dialogConfirmReset.close();
        });

        $('.dialogConfirmReset-confirmbtn').click(function() {
            dialogConfirmReset.close();
            MSP.send_message(MSPCodes.MSP_RESET_CONF, false, false, function () {
                gui_log(i18n.getMessage('initialSetupSettingsRestored'));

                GUI.tab_switch_cleanup(function () {
                    TABS.setup.initialize();
                });
            });
        });

        // display current yaw fix value (important during tab re-initialization)
        $('div#interactive_block > a.reset').text(i18n.getMessage('initialSetupButtonResetZaxisValue', [self.yaw_fix]));

        // reset yaw button hook
        $('div#interactive_block > a.reset').click(function () {
            self.yaw_fix = FC.SENSOR_DATA.kinematics[2] * - 1.0;
            $(this).text(i18n.getMessage('initialSetupButtonResetZaxisValue', [self.yaw_fix]));

            console.log(`YAW reset to 0 deg, fix: ${self.yaw_fix} deg`);
        });

        $(".deviceIdentifier").text(FC.CONFIG.deviceIdentifier);
        $(".buildInfo").text(FC.CONFIG.buildInfo);
        $(".versionLabelFirmware").text(FC.CONFIG.flightControllerVersion).append(" ").append(FC.CONFIG.flightControllerIdentifier);
        $(".boardName").text(FC.CONFIG.boardName);
        $(".flashFree").text(FC.CONFIG.testResults["flash"]);
        setResult($(".flashFree"), FC.CONFIG.testResults["flash"] != false);
        const escProtocols = EscProtocols.GetAvailableProtocols(FC.CONFIG.apiVersion);
        $('.protocolName').text(escProtocols[FC.PID_ADVANCED_CONFIG.fast_pwm_protocol]);
        setResult($('.protocolName'), escProtocols[FC.PID_ADVANCED_CONFIG.fast_pwm_protocol] == EscProtocols.PROTOCOL_DSHOT600);
        $('a.calibrateAccel').trigger('click');

        // cached elements
        const bat_voltage_e = $('.batteryVoltage'),
            testAccel_e = $('.testAccel'),
            testAccelCali_e = $('.testAccelCali'),
            testGyro_e = $('.testGyro'),
            testGyroData_e = $('.testGyroData'),
            testBaro_e = $('.testBaro'),
            testMag_e = $('.testMag'),
            testSonar_e = $('.testSonar'),
            testReceiver_e = $('.testReceiver'),
            bat_mah_drawn_e = $('.bat-mah-drawn'),
            bat_mah_drawing_e = $('.bat-mah-drawing'),
            rssi_e = $('.rssi'),
            arming_disable_flags_e = $('.arming-disable-flags'),
            gpsFix_e = $('.gpsFix'),
            gpsSats_e = $('.gpsSats'),
            gpsLat_e = $('.gpsLat'),
            gpsLon_e = $('.gpsLon'),
            roll_e = $('dd.roll'),
            pitch_e = $('dd.pitch'),
            heading_e = $('dd.heading');

        // DISARM FLAGS
        // We add all the arming/disarming flags available, and show/hide them if needed.
        const prepareDisarmFlags = function() {

            let disarmFlagElements = [
                'NO_GYRO',
                'FAILSAFE',
                'RX_FAILSAFE',
                'BAD_RX_RECOVERY',
                'BOXFAILSAFE',
                'THROTTLE',
                'ANGLE',
                'BOOT_GRACE_TIME',
                'NOPREARM',
                'LOAD',
                'CALIBRATING',
                'CLI',
                'CMS_MENU',
                'OSD_MENU',
                'BST',
                'MSP',
            ];

            disarmFlagElements.splice(disarmFlagElements.indexOf('THROTTLE'), 0, 'RUNAWAY_TAKEOFF');

            disarmFlagElements = disarmFlagElements.concat(['PARALYZE', 'GPS']);

            disarmFlagElements.splice(disarmFlagElements.indexOf('OSD_MENU'), 1);
            disarmFlagElements = disarmFlagElements.concat(['RESC']);
            disarmFlagElements = disarmFlagElements.concat(['RPMFILTER']);

            if (semver.gte(FC.CONFIG.apiVersion, API_VERSION_1_42)) {
                disarmFlagElements.splice(disarmFlagElements.indexOf('THROTTLE'), 0, 'CRASH');
                disarmFlagElements = disarmFlagElements.concat(['REBOOT_REQD',
                                                                'DSHOT_BBANG']);
            }

            if (semver.gte(FC.CONFIG.apiVersion, API_VERSION_1_43)) {
                disarmFlagElements = disarmFlagElements.concat(['NO_ACC_CAL', 'MOTOR_PROTO']);
            }

            // Always the latest element
            disarmFlagElements = disarmFlagElements.concat(['ARM_SWITCH']);

            // Arming allowed flag
            arming_disable_flags_e.append('<span id="initialSetupArmingAllowed" i18n="initialSetupArmingAllowed" style="display: none;"></span>');

            // Arming disabled flags
            for (let i = 0; i < FC.CONFIG.armingDisableCount; i++) {

                // All the known elements but the ARM_SWITCH (it must be always the last element)
                if (i < disarmFlagElements.length - 1) {
                    const messageKey = `initialSetupArmingDisableFlagsTooltip${disarmFlagElements[i]}`;
                    arming_disable_flags_e.append(`<span id="initialSetupArmingDisableFlags${i}" class="cf_tip disarm-flag" title="${i18n.getMessage(messageKey)}" style="display: none;">${disarmFlagElements[i]}</span>`);

                // The ARM_SWITCH, always the last element
                } else if (i == FC.CONFIG.armingDisableCount - 1) {
                    arming_disable_flags_e.append(`<span id="initialSetupArmingDisableFlags${i}" class="cf_tip disarm-flag" title="${i18n.getMessage('initialSetupArmingDisableFlagsTooltipARM_SWITCH')}" style="display: none;">ARM_SWITCH</span>`);

                // Unknown disarm flags
                } else {
                    arming_disable_flags_e.append(`<span id="initialSetupArmingDisableFlags${i}" class="disarm-flag" style="display: none;">${i + 1}</span>`);
                }
            }
        };

        prepareDisarmFlags();

        function get_slow_data() {
            MSP.send_message(MSPCodes.MSP_STATUS_EX, false, false, function() {

                $('#initialSetupArmingAllowed').toggle(FC.CONFIG.armingDisableFlags == 0);

                for (let i = 0; i < FC.CONFIG.armingDisableCount; i++) {
                    $(`#initialSetupArmingDisableFlags${i}`).css('display',(FC.CONFIG.armingDisableFlags & (1 << i)) == 0 ? 'none':'inline-block');
                }

            });

            MSP.send_message(MSPCodes.MSP_ANALOG, false, false, function () {
                bat_voltage_e.text(i18n.getMessage('initialSetupBatteryValue', [FC.ANALOG.voltage]));
                setResult(bat_voltage_e, FC.ANALOG.voltage > 17);
                bat_mah_drawn_e.text(i18n.getMessage('initialSetupBatteryMahValue', [FC.ANALOG.mAhdrawn]));
                bat_mah_drawing_e.text(i18n.getMessage('initialSetupBatteryAValue', [FC.ANALOG.amperage.toFixed(2)]));
                rssi_e.text(i18n.getMessage('initialSetupRSSIValue', [((FC.ANALOG.rssi / 1023) * 100).toFixed(0)]));
            });

            if (have_sensor(FC.CONFIG.activeSensors, 'gps')) {
                MSP.send_message(MSPCodes.MSP_RAW_GPS, false, false, function () {
                    //gpsFix_e.html((FC.GPS_DATA.fix) ? i18n.getMessage('gpsFixTrue') : i18n.getMessage('gpsFixFalse'));
                    gpsFix_e.text(FC.GPS_DATA.fix > 0);
                    setResult(gpsFix_e, FC.GPS_DATA.fix > 0);
                    gpsSats_e.text(FC.GPS_DATA.numSat);
                    setResult(gpsSats_e, FC.GPS_DATA.numSat > 0);
                    gpsLat_e.text(`${(FC.GPS_DATA.lat / 10000000).toFixed(4)} deg`);
                    gpsLon_e.text(`${(FC.GPS_DATA.lon / 10000000).toFixed(4)} deg`);
                });
            } else {
                gpsFix_e.text(FC.GPS_DATA.fix > 0);
                setResult(gpsFix_e, FC.GPS_DATA.fix > 0);
                gpsSats_e.text(FC.GPS_DATA.numSat);
                setResult(gpsSats_e, FC.GPS_DATA.numSat > 0);
            }
            MSP.send_message(MSPCodes.MSP_RC, false, false, function() {
                if (FC.RC.active_channels > 0) {
                    // update bars with latest data
                    let receiverValues = 0;
                    for (let i = 0; i < FC.RC.active_channels; i++) {
                        receiverValues += FC.RC.channels[i];
                    }
                    if (FC.CONFIG.testResults["receiverValues"]) {
                        FC.CONFIG.testResults["receiver"] = (Math.abs(FC.CONFIG.testResults["receiverValues"] - receiverValues) > 500);
                    } else {
                        if (receiverValues > 0) FC.CONFIG.testResults["receiverValues"] = receiverValues;
                    }
                }
                testReceiver_e.text(FC.CONFIG.testResults["receiverValues"]);
                setResult(testReceiver_e, FC.CONFIG.testResults["receiver"]);
            });
            $(".usageDown-text").text(PortUsage.port_usage_down).append("%");
            $(".usageUp-text").text(PortUsage.port_usage_up).append("%");
            $(".cpuLoad-text").text(FC.CONFIG.cpuload).append("%");
            testAccel_e.text(FC.CONFIG.testResults["acc"]);
            setResult(testAccel_e, FC.CONFIG.testResults["acc"]);
            testAccelCali_e.text(FC.CONFIG.testResults["accelCalib"]);
            setResult(testAccelCali_e, FC.CONFIG.testResults["accelCalib"]);
            testGyro_e.text(FC.CONFIG.testResults["gyro"]);
            setResult(testGyro_e, FC.CONFIG.testResults["gyro"]);
            testBaro_e.text(FC.CONFIG.testResults["baro"]);
            setResult(testBaro_e, FC.CONFIG.testResults["baro"]);
            testMag_e.text(FC.CONFIG.testResults["mag"]);
            setResult(testMag_e, FC.CONFIG.testResults["mag"]);
            testSonar_e.text(FC.CONFIG.testResults["sonar"]);
            setResult(testSonar_e, FC.CONFIG.testResults["sonar"]);
            updateMotor();
        }

        function get_fast_data() {
            MSP.send_message(MSPCodes.MSP_ATTITUDE, false, false, function () {
                roll_e.text(i18n.getMessage('initialSetupAttitude', [FC.SENSOR_DATA.kinematics[0]]));
                pitch_e.text(i18n.getMessage('initialSetupAttitude', [FC.SENSOR_DATA.kinematics[1]]));
                heading_e.text(i18n.getMessage('initialSetupAttitude', [FC.SENSOR_DATA.kinematics[2]]));

                self.renderModel();
                self.updateInstruments();
            });
            MSP.send_message(MSPCodes.MSP_RAW_IMU, false, false, function() {
                testGyroData_e.text(FC.CONFIG.testResults["gyroRaw"]);
                setResult(testGyroData_e, FC.CONFIG.testResults["gyroData"]);
            });
        }

        GUI.interval_add('setup_data_pull_fast', get_fast_data, 33, true); // 30 fps
        GUI.interval_add('setup_data_pull_slow', get_slow_data, 250, true); // 4 fps
        $(document).on('keydown', e => {
            switch (e.key){
                case '1':
                    $('a.calibrateAccel').trigger('click');
                    break;
                case '2':
                    $('a.gyroDataTest').trigger('click');
                    break;
                case '3':
                    enableMotor(true);
                    break;
                case '4':
                    $('a.receiverTest').trigger('click');
                    break;
            }
        });
        $(document).on('keyup', e => {
            switch (e.key){
                case '3':
                    enableMotor(false);
                    break;
            }
        });

        GUI.content_ready(callback);
    }
};

setup.initializeInstruments = function() {
    const options = {size:90, showBox : false, img_directory: 'images/flightindicators/'};
    const attitude = $.flightIndicator('#attitude', 'attitude', options);
    const heading = $.flightIndicator('#heading', 'heading', options);

    this.updateInstruments = function() {
        attitude.setRoll(FC.SENSOR_DATA.kinematics[0]);
        attitude.setPitch(FC.SENSOR_DATA.kinematics[1]);
        heading.setHeading(FC.SENSOR_DATA.kinematics[2]);
    };
};

setup.initModel = function () {
    this.model = new Model($('.model-and-info #canvas_wrapper'), $('.model-and-info #canvas'));

    $(window).on('resize', $.proxy(this.model.resize, this.model));
};

setup.renderModel = function () {
    const x = (FC.SENSOR_DATA.kinematics[1] * -1.0) * 0.017453292519943295,
        y = ((FC.SENSOR_DATA.kinematics[2] * -1.0) - this.yaw_fix) * 0.017453292519943295,
        z = (FC.SENSOR_DATA.kinematics[0] * -1.0) * 0.017453292519943295;

    this.model.rotateTo(x, y, z);
};

setup.cleanup = function (callback) {
    if (this.model) {
        $(window).off('resize', $.proxy(this.model.resize, this.model));
        this.model.dispose();
    }

    if (callback) callback();
};

TABS.setup = setup;

export { setup };
