/**
 * Verwenden Sie diese Datei, um benutzerdefinierte Funktionen und Grafikblöcke zu definieren.
 * Weitere Informationen finden Sie unter https://makecode.microbit.org/blocks/custom
 */

enum Motors {
    //% block="Left"
    Left = 0x1,
    //% block="Right"
    Right = 0x2,
}

enum Servos {
    //% block="S1"
    S1 = 0x1,
    //% block="S2"
    S2 = 0x2,
}

enum Sensor {
    //% block="Left"
    Left = 0x1,
    //% block="Right"
    Right = 0x2,
}

enum Dir {
    //% block="Forward"
    forward = 0x1,
    //% block="Backward"
    backward = 0x2,
    //% block="TurnRight"
    turnRight = 0x3,
    //% block="TurnLeft"
    turnLeft = 0x4,
    //% block="stop"
    stop = 0x5,
}

/**
 * Benutzerdefinierter Grafikblock
 */
//% weight=5 color=#0fbc11 icon="\uf113"
namespace mikRobot {
    const PCA9685_ADDRESS = 0x40
    const GYRO_ADDRESS = 0x68
    const MODE1 = 0x00
    const MODE2 = 0x01
    const SUBADR1 = 0x02
    const SUBADR2 = 0x03
    const SUBADR3 = 0x04
    const PRESCALE = 0xFE // register for prescaler
    const LED0_ON_L = 0x06
    const LED0_ON_H = 0x07
    const LED0_OFF_L = 0x08
    const LED0_OFF_H = 0x09
    const ALL_LED_ON_L = 0xFA
    const ALL_LED_ON_H = 0xFB
    const ALL_LED_OFF_L = 0xFC
    const ALL_LED_OFF_H = 0xFD
    const MIN_PULSE_WIDTH = 205
    const MAX_PULSE_WIDTH = 409
    const DEFAULT_PULSE_WIDTH = 307
//    const FREQUENCY = 50 // 50Hz for servo PWM
    const FREQUENCY = 500

    const STP_CHA_L = 2047
    const STP_CHA_H = 4095

    const STP_CHB_L = 1
    const STP_CHB_H = 2047

    const STP_CHC_L = 1023
    const STP_CHC_H = 3071

    const STP_CHD_L = 3071
    const STP_CHD_H = 1023

    let initialized = false
    let gyro_init = false
    let last_value = 0; // assume initially that the line is left.
    let calibratedMax = [650, 650, 650, 650, 650];
    let calibratedMin = [100, 100, 100, 100, 100];

    function i2cwrite(addr: number, reg: number, value: number) {
        let buf = pins.createBuffer(2)
        buf[0] = reg
        buf[1] = value
        pins.i2cWriteBuffer(addr, buf)
    }

    function i2ccmd(addr: number, value: number) {
        let buf = pins.createBuffer(1)
        buf[0] = value
        pins.i2cWriteBuffer(addr, buf)
    }

    function i2cread(addr: number, reg: number) {
        pins.i2cWriteNumber(addr, reg, NumberFormat.UInt8BE);
        let val = pins.i2cReadNumber(addr, NumberFormat.UInt8BE);
        return val;
    }	
	
    function initPCA9685(): void {
        i2cwrite(PCA9685_ADDRESS, MODE1, 0x00)
        setFreq(FREQUENCY);
        setPwm(0, 0, 4095);
        for (let idx = 1; idx < 16; idx++) {
            setPwm(idx, 0, 0);
        }
        initialized = true
    }
	
    function initGyro(): void {
    	// 76543210 bit numbers
        let oldreg = i2cread(GYRO_ADDRESS, 0x6B); // RA_PWR_MGMT_1
        let newreg = (oldreg & 0xB8) | 0x01; //  PWR1_CLKSET_BIT (bits 210) = MPU6050_CLOCK_PLL_XGYRO (001)
	    // PWR1_SLEEP_BIT (bit 6) = disabled (0)
        i2cwrite(GYRO_ADDRESS, 0x6B, newreg);		         
	basic.pause(2);

	oldreg = i2cread(GYRO_ADDRESS, 0x1B); // RA_GYRO_CONFIG
        newreg = (oldreg & 0xE7) | 0x00; //  GCONFIG_FS_SEL_BIT (bits 43) = MPU6050_GYRO_FS_250 (00)
        i2cwrite(GYRO_ADDRESS, 0x1B, newreg);		         
	basic.pause(2);
	    
	oldreg = i2cread(GYRO_ADDRESS, 0x1C); // RA_ACCEL_CONFIG
        newreg = (oldreg & 0xE7) | 0x00; //  ACONFIG_AFS_SEL_BIT (bits 43) = MPU6050_ACCEL_FS_2 (00)
        i2cwrite(GYRO_ADDRESS, 0x1C, newreg);		         
	basic.pause(2);
 	    
        gyro_init = true
    }	

    function setFreq(freq: number): void {
        // Constrain the frequency
        let prescaleval = 25000000;
        prescaleval /= 4096;
        prescaleval /= freq;
        prescaleval -= 1;
        let prescale = prescaleval; //Math.Floor(prescaleval + 0.5);
        let oldmode = i2cread(PCA9685_ADDRESS, MODE1);
        let newmode = (oldmode & 0x7F) | 0x10; // sleep
        i2cwrite(PCA9685_ADDRESS, MODE1, newmode); // go to sleep
        i2cwrite(PCA9685_ADDRESS, PRESCALE, prescale); // set the prescaler
	//i2cwrite(PCA9685_ADDRESS, PRESCALE, 0x79);  // 0x79 = 121d = (25MHz/(4096*50Hz)) - 1
        i2cwrite(PCA9685_ADDRESS, MODE1, oldmode);
        control.waitMicros(5000);
        i2cwrite(PCA9685_ADDRESS, MODE1, oldmode | 0xa1);
    }

    function setPwm(channel: number, on: number, off: number): void {
        if (channel < 0 || channel > 15)
            return;

        let buf = pins.createBuffer(5);
        buf[0] = LED0_ON_L + 4 * channel;
        buf[1] = on & 0xff;
        buf[2] = (on >> 8) & 0xff;
        buf[3] = off & 0xff;
        buf[4] = (off >> 8) & 0xff;
        pins.i2cWriteBuffer(PCA9685_ADDRESS, buf);
    }

    //% blockId=mikRobot_servo block="write Servo|%index| to %pos"
    //% pos eg: 90
    //% weight=20 advanced=true
    //% pos.min=0 pos.max=180
    //% name.fieldEditor="gridpicker" name.fieldOptions.columns=4
    export function Servo(index: Servos, pos: number): void {
        if (!initialized) {
            initPCA9685()
        }
	if (pos > 180) {
            pos = 180
        }
        if (pos < 0) {
            pos = 0
        }
	    
	// map 180 to 4096 (http://wiki.sunfounder.cc/index.php?title=PCA9685_16_Channel_12_Bit_PWM_Servo_Driver)
	pos = MIN_PULSE_WIDTH + pos * (MAX_PULSE_WIDTH-MIN_PULSE_WIDTH)/180.0;
	// pos = DEFAULT_PULSE_WIDTH;
	// pos = (MIN_PULSE_WIDTH + pos * (MAX_PULSE_WIDTH-MIN_PULSE_WIDTH)/180.0)/ 1000000 * FREQUENCY * 4096;
        
        if (index == 1) {
            setPwm(8, 0, pos)
        } else if (index == 2) {
	    setPwm(9, 0, pos)
        }
    }
	
    //% blockId=mikRobot_GyroReset block="GyroReset"
    //% weight=18 advanced=true	
    export function GyroReset(): void {
        if (!gyro_init) {
            initGyro()
        }
        let oldreg = i2cread(GYRO_ADDRESS, 0x02); // MPU6050_RA_ZG_OFFS_TC
        let newreg = (oldreg & 0x81) | 0x00; // set Z gyro offset = 0 [7]PWR_Mode [6:1]ZG_OFFS_TC [0]OTP_BNK_VLD
        i2cwrite(GYRO_ADDRESS, 0x02, newreg);		         
	basic.pause(2);	
    }
	
    //% blockId=mikRobot_Gyro block="Gyro"
    //% weight=17 advanced=true
    export function Gyro(): number { 
	let z = 0;
 
        pins.i2cWriteNumber(GYRO_ADDRESS, 0x47, NumberFormat.UInt8BE);  // GYRO_ZOUT_H
        let high = pins.i2cReadNumber(GYRO_ADDRESS, NumberFormat.UInt8BE);
        basic.pause(2);
        pins.i2cWriteNumber(GYRO_ADDRESS, 0x48, NumberFormat.UInt8BE);  // GYRO_ZOUT_L
        let low = pins.i2cReadNumber(GYRO_ADDRESS, NumberFormat.UInt8BE);
        basic.pause(2);    
   
          //mpu.resetFIFO();
	  // 76543210 bit numbers
          let oldreg = i2cread(GYRO_ADDRESS, 0x6A); // RA_USER_CTRL
          let newreg = (oldreg & 0xFB) | 0x04; //  USERCTRL_FIFO_RESET_BIT (bit 2) = true (1)
          i2cwrite(GYRO_ADDRESS, 0x6B, newreg);		         
	  basic.pause(2);
  
	return (high*256+low);
    }	
	
    //% blockId=mikRobot_ultrasonic block="Ultrasonic"
    //% weight=80
    export function Ultrasonic(): number {
	// send pulse
	pins.setPull(DigitalPin.P1, PinPullMode.PullNone);
	pins.digitalWritePin(DigitalPin.P1, 0);
	control.waitMicros(2);
	pins.digitalWritePin(DigitalPin.P1, 1);
	control.waitMicros(10);
	pins.digitalWritePin(DigitalPin.P1, 0);

	// read pulse, timeout 30000us
	let d = pins.pulseIn(DigitalPin.P2, PulseValue.High, 30000);

	if (d == 0) {
		// wrong sensor value or timeout -> result hardcoded to 100cm
		return 100;
	} else {
		// hand-measured factor (instead of 58)
		return d / 37;
	}
    }
	
    //% blockId=mikRobot_motor_run block="Motor|%index|speed %speed"
    //% speed eg: 50
    //% weight=82
    //% speed.min=-255 speed.max=255 eg: 50
    //% name.fieldEditor="gridpicker" name.fieldOptions.columns=4
    export function MotorRun(index: Motors, speed: number): void {
        if (!initialized) {
            initPCA9685()
        }
        speed = speed * 16; // map 255 to 4096
        if (speed >= 4096) {
            speed = 4095
        }
        if (speed <= -4096) {
            speed = -4095
        }
        if (index == 1) {
            if (speed >= 0) {
                setPwm(2, 0, 4095)
                setPwm(3, 0, 0)
                setPwm(1, 0, speed)
            } else {
                setPwm(2, 0, 0)
                setPwm(3, 0, 4095)
                setPwm(1, 0, -speed)
            }
        } else if (index == 2) {
            if (speed >= 0) {
                setPwm(5, 0, 4095)
                setPwm(4, 0, 0)
                setPwm(6, 0, speed)
            } else {
                setPwm(5, 0, 0)
                setPwm(4, 0, 4095)
                setPwm(6, 0, -speed)
            }
        }
    }
	/**
	 * Execute single motors 
	 * @param speed [-255-255] speed of motor; eg: 50
	*/
    //% blockId=mikRobot_run block="|%index|speed %speed"
    //% speed eg: 50
    //% weight=95
    //% speed.min=-255 speed.max=255 eg: 50
    //% name.fieldEditor="gridpicker" name.fieldOptions.columns=4
    export function Run(index: Dir, speed: number): void {
        switch (index) {
            case Dir.forward:
                MotorRun(Motors.Left, speed);
                MotorRun(Motors.Right, speed);
                break;
            case Dir.backward:
                MotorRun(Motors.Left, -speed);
                MotorRun(Motors.Right, -speed);
                break;
            case Dir.turnRight:
                MotorRun(Motors.Left, speed);
                MotorRun(Motors.Right, -speed);
                break;
            case Dir.turnLeft:
                MotorRun(Motors.Left, -speed);
                MotorRun(Motors.Right, speed);
                break;
            case Dir.stop:
                MotorRun(Motors.Left, 0);
                MotorRun(Motors.Right, 0);
                break;
        }
    }

	/**
	 * Execute single motors 
	 * @param speed [-255-255] speed of motor; eg: 50
	 * @param time dalay second time; eg: 2
	*/
    //% blockId=mikRobot_run_delay block="|%index|speed %speed|for %time|sec"
    //% speed eg: 50
    //% weight=90
    //% speed.min=-255 speed.max=255 eg: 50
    //% name.fieldEditor="gridpicker" name.fieldOptions.columns=4
    export function RunDelay(index: Dir, speed: number, time: number): void {
        Run(index, speed);
        basic.pause(time * 1000);
        Run(Dir.stop, 0);
    }

    //% blockId=mikRobot_infrared block="Infrared |%index"
    //% weight=65
    export function Infrared(index: Sensor): boolean {
        let value = true;
        pins.setPull(DigitalPin.P12, PinPullMode.PullUp);
        pins.setPull(DigitalPin.P16, PinPullMode.PullUp);
        if (index == 0x01) {
            if (pins.digitalReadPin(DigitalPin.P12)) {
                value = false;
            }
        } else {
            if (pins.digitalReadPin(DigitalPin.P16)) {
                value = false;
            }
        }
        return value;
    }

    //% blockId=mikRobot_ultrasonic block="Ultrasonic"
    //% weight=80
    export function Ultrasonic(): number {
	// send pulse
	pins.setPull(DigitalPin.P1, PinPullMode.PullNone);
	pins.digitalWritePin(DigitalPin.P1, 0);
	control.waitMicros(2);
	pins.digitalWritePin(DigitalPin.P1, 1);
	control.waitMicros(10);
	pins.digitalWritePin(DigitalPin.P1, 0);

	// read pulse, timeout 30000us
	let d = pins.pulseIn(DigitalPin.P2, PulseValue.High, 30000);

	if (d == 0) {
		// wrong sensor value or timeout -> result hardcoded to 100cm
		return 100;
	} else {
		// hand-measured factor (instead of 58)
		return d / 37;
	}
    }

    //% blockId=mikRobot_AnalogRead block="AnalogRead"
    //% weight=70
    export function AnalogRead(): number[] {
        if (!initialized) {
            initPCA9685()
        }
        let i = 0;
        let j = 0;
        let channel = 0;
        let values = [0, 0, 0, 0, 0, 0];
        let sensor_values = [0, 0, 0, 0, 0];
        //pins.digitalWritePin(DigitalPin.P16, 0);
        setPwm(0, 0, 0);
        basic.pause(2);
        for (i = 0; i < 6; i++) {
            for (j = 0; j < 10; j++) {
                //0 to 4 clock transfer channel address
                if (j < 4) {
                    if ((i >> (3 - j)) & 0x01) {
                        pins.digitalWritePin(DigitalPin.P15, 1);
                    } else {
                        pins.digitalWritePin(DigitalPin.P15, 0);
                    }
                }
                //0 to 10 clock receives the previous conversion result
                values[i] <<= 1;
                if (pins.digitalReadPin(DigitalPin.P14)) {
                    values[i] |= 0x01;
                }
                pins.digitalWritePin(DigitalPin.P13, 1);
                pins.digitalWritePin(DigitalPin.P13, 0);
            }
        }
        //pins.digitalWritePin(DigitalPin.P16, 1);
        setPwm(0, 0, 4095);
        for (i = 0; i < 5; i++) {
            sensor_values[i] = values[i + 1];
        }
        return sensor_values;
    }

    //% blockId=mikRobot_SensorCalibrated block="SensorCalibrated"
    //% weight=90 advanced=true
    export function SensorCalibrated(): void {
        let i = 0;
        let j = 0;
        let k = 0;
        let max_sensor_values = [0, 0, 0, 0, 0];
        let min_sensor_values = [0, 0, 0, 0, 0];

        for (let i = 0; i < 5; i++)  // make the calibration take about 10 seconds
        {
            calibratedMax[i] = 0;
            calibratedMin[i] = 1023;
        }


        for (let i = 0; i < 100; i++)  // make the calibration take about 10 seconds
        {
            if (i < 25 || i >= 75) {
                Run(Dir.turnLeft, 70)
            }
            else {
                Run(Dir.turnRight, 70)
            }

            // reads all sensors 100 times
            for (j = 0; j < 10; j++) {
                let sensor_values = AnalogRead();
                for (k = 0; k < 5; k++) {
                    // set the max we found THIS time
                    if ((j == 0) || (max_sensor_values[k] < sensor_values[k]))
                        max_sensor_values[k] = sensor_values[k];

                    // set the min we found THIS time
                    if ((j == 0) || (min_sensor_values[k] > sensor_values[k]))
                        min_sensor_values[k] = sensor_values[k];
                }
            }

            // record the min and max calibration value
            for (k = 0; k < 5; k++) {
                if (min_sensor_values[k] > calibratedMax[k])
                    calibratedMax[k] = min_sensor_values[k];
                if (max_sensor_values[k] < calibratedMin[k])
                    calibratedMin[k] = max_sensor_values[k];
            }
        }

        Run(Dir.stop, 0);
    }
    //% blockId=mikRobot_ReadSensorMax block="ReadSensorMax"
    //% weight=60 advanced=true
    export function ReadSensorMax(): number[] {
        return calibratedMax;
    }

    //% blockId=mikRobot_ReadSensorMin block="ReadSensorMin"
    //% weight=50 advanced=true
    export function ReadSensorMin(): number[] {
        return calibratedMin;
    }

    // Returns values calibrated to a value between 0 and 1000, where
    // 0 corresponds to the minimum value read by calibrate() and 1000
    // corresponds to the maximum value.  Calibration values are
    // stored separately for each sensor, so that differences in the
    // sensors are accounted for automatically.
    //% blockId=mikRobot_ReadCalibrated block="ReadCalibrated"
    //% weight=80 advanced=true
    export function readCalibrated(): number[] {
        // read the needed values
        let sensor_values = AnalogRead();

        for (let i = 0; i < 5; i++) {
            let denominator = calibratedMax[i] - calibratedMin[i];
            let x = ((sensor_values[i] - calibratedMin[i]) * 1000 / denominator);
            if (x < 0)
                x = 0;
            else if (x > 1000)
                x = 1000;
            sensor_values[i] = x;
        }
        return sensor_values;
    }

    //% blockId=mikRobot_readLine block="ReadLine"
    //% weight=20
    export function readLine(): number {

        let i = 0;
        let on_line = 0;
        let avg = 0; // this is for the weighted total, which is long
        // before division
        let sum = 0; // this is for the denominator which is <= 64000
        let white_line = 0;

        // readCalibrated(sensor_values);
        let sensor_values = readCalibrated();

        for (i = 0; i < 5; i++) {
            let value = sensor_values[i];

            if (!white_line)
                value = 1000 - value;
            sensor_values[i] = value;
            // keep track of whether we see the line at all
            if (value > 200) {
                on_line = 1;
            }

            // only average in values that are above a noise threshold
            if (value > 50) {
                avg += (value) * (i * 1000);
                sum += value;
            }
        }

        if (!on_line) {
            // If it last read to the left of center, return 0.
            if (last_value < (4) * 1000 / 2)
                return 0;
            // If it last read to the right of center, return the max.
            else
                return 4 * 1000;
        }

        last_value = avg / sum;

        return last_value;
    }
	
    //% blockId=mikRobot_infrared2 block="Infrared2 |%index| value %limit"
    //% limit eg: 5
    //% weight=60 advanced=true
    //% limit.min=0 limit.max=10
    //% name.fieldEditor="gridpicker" name.fieldOptions.columns=4	
    export function Infrared2(index: Sensor, limit: number): boolean {
        if (!initialized) {
            initPCA9685()
        }
        let i = 0;
        let j = 0;
        let channel = 0;
        let value = true;
        let values = [0, 0, 0, 0, 0, 0, 0, 0];
        let sensor_values = [0, 0, 0, 0, 0, 0, 0];
        //pins.digitalWritePin(DigitalPin.P16, 0);
        setPwm(0, 0, 0);
        basic.pause(2);
        for (i = 0; i < 8; i++) {
            for (j = 0; j < 10; j++) {
                //0 to 4 clock transfer channel address
                if (j < 4) {
                    if ((i >> (3 - j)) & 0x01) {
                        pins.digitalWritePin(DigitalPin.P15, 1);
                    } else {
                        pins.digitalWritePin(DigitalPin.P15, 0);
                    }
                }
                //0 to 10 clock receives the previous conversion result
                values[i] <<= 1;
                if (pins.digitalReadPin(DigitalPin.P14)) {
                    values[i] |= 0x01;
                }
                pins.digitalWritePin(DigitalPin.P13, 1);
                pins.digitalWritePin(DigitalPin.P13, 0);
            }
        }
        //pins.digitalWritePin(DigitalPin.P16, 1);
        setPwm(0, 0, 4095);
        for (i = 0; i < 7; i++) {
            sensor_values[i] = values[i + 1];
        }

        if (index == 0x01) {
            if (sensor_values[5] < (limit*95+50)) {  // 0 .. 1023 (useful range ~50 to 1000)
                value = false;
            }
        } else {
            if (sensor_values[6] < (limit*95+50)) {
                value = false;
            }
        }
        return value;
    }
}   
