import { API, Logger, AccessoryConfig, Service } from 'homebridge';
import { setIp, getCleanerState, setCleanerState, getSensorValue } from './daikinCleaner';
import { POW, MODE, AIRVOL } from './DaikinCleanerStatus';
import { Mutex } from 'await-semaphore';

export class DaikinCleanerAccessory {
  informationService: Service;
  cleanerService: Service;
  temperatureSensorService: Service;
  humiditySensorService: Service;
  mutex = new Mutex();
  targetState = 0;
  currentState = 0;
  currentRotationSpeed = 100;

  constructor(
    public readonly log: Logger,
    public readonly config: AccessoryConfig,
    public readonly api: API,
  ) {
    this.log.debug('Example Accessory Plugin Loaded');

    setIp(config.host as string);

    this.informationService = new this.api.hap.Service.AccessoryInformation()
      .setCharacteristic(this.api.hap.Characteristic.Manufacturer, 'DAIKIN')
      .setCharacteristic(this.api.hap.Characteristic.Model, 'KAFP085A4');

    this.cleanerService = new this.api.hap.Service.AirPurifier();
    this.cleanerService.getCharacteristic(this.api.hap.Characteristic.Active)
      .on('get', this.handleActiveGet.bind(this))
      .on('set', this.handleActiveSet.bind(this));
    this.cleanerService.getCharacteristic(this.api.hap.Characteristic.CurrentAirPurifierState)
      .on('get', this.handleCurrentAirPurifierStateGet.bind(this));
    this.cleanerService.getCharacteristic(this.api.hap.Characteristic.TargetAirPurifierState)
      .on('get', this.handleTargetAirPurifierStateGet.bind(this))
      .on('set', this.handleTargetAirPurifierStateSet.bind(this));
    this.cleanerService.getCharacteristic(this.api.hap.Characteristic.RotationSpeed)
      .on('get', this.handleRotationSpeedGet.bind(this))
      .on('set', this.handleRotationSpeedSet.bind(this));

    this.temperatureSensorService = new this.api.hap.Service.TemperatureSensor();
    this.temperatureSensorService.getCharacteristic(this.api.hap.Characteristic.CurrentTemperature)
      .on('get', this.handleCurrentTemperatureGet.bind(this));

    this.humiditySensorService = new this.api.hap.Service.HumiditySensor();
    this.humiditySensorService.getCharacteristic(this.api.hap.Characteristic.CurrentRelativeHumidity)
      .on('get', this.handleCurrentRelativeHumidityGet.bind(this));
  }

  getServices() {
    if (this.config.enableSensors) {
      return [
        this.informationService,
        this.cleanerService,
        this.temperatureSensorService,
        this.humiditySensorService,
      ];
    } else {
      return [
        this.informationService,
        this.cleanerService
      ];
    }
  }

  // 電源
  async handleActiveGet(callback) {
    this.log.debug('Triggered GET Active');
    const state = await getCleanerState();
    if (state.pow === POW.OFF) {
      this.currentState = this.api.hap.Characteristic.CurrentAirPurifierState.INACTIVE;
    } else {
      this.currentState = this.api.hap.Characteristic.CurrentAirPurifierState.PURIFYING_AIR;
    }
    callback(null, state.pow === POW.OFF ? this.api.hap.Characteristic.Active.INACTIVE : this.api.hap.Characteristic.Active.ACTIVE);
    this.cleanerService.getCharacteristic(this.api.hap.Characteristic.CurrentAirPurifierState).updateValue(this.currentState);
  }

  async handleActiveSet(value, callback) {
    this.log.debug('Triggered SET Active:' + value);
    const release = await this.mutex.acquire();
    try {
      const state = await getCleanerState();
      state.pow = value;
      await setCleanerState(state);
      callback(null);
      if (state.pow === POW.OFF) {
        this.currentState = this.api.hap.Characteristic.CurrentAirPurifierState.INACTIVE;
      } else {
        this.currentState = this.api.hap.Characteristic.CurrentAirPurifierState.PURIFYING_AIR;
      }
      this.cleanerService.getCharacteristic(this.api.hap.Characteristic.CurrentAirPurifierState).updateValue(this.currentState);
    } finally {
      release();
    }
  }

  async handleCurrentAirPurifierStateGet(callback) {
    this.log.debug('Triggered GET CurrentAirPurifierState');
    const state = await getCleanerState();
    if (state.pow === POW.OFF) {
      this.currentState = this.api.hap.Characteristic.CurrentAirPurifierState.INACTIVE;
    } else {
      this.currentState = this.api.hap.Characteristic.CurrentAirPurifierState.PURIFYING_AIR;
    }
    callback(null, this.currentState);
  }

  // 風量（空気清浄）
  async handleRotationSpeedSet(value, callback) {
    console.log(`Triggered SET RotationSpeed: ${value}`);
    this.currentRotationSpeed = value;
    const release = await this.mutex.acquire();
    try {
      const state = await getCleanerState();
      if (!state.isAuto()) {
        if (value == 100) {
          state.airvol = AIRVOL.TURBO;
        } else if (value >= 50) {
          state.airvol = AIRVOL.NORMAL;
        } else if (value >= 30) {
          state.airvol = AIRVOL.WEAK;
        } else {
          state.airvol = AIRVOL.SILENT;
        }
        await setCleanerState(state);
      }
    } finally {
      release();
    }
    callback(null);
  }

  async handleRotationSpeedGet(callback) {
    console.log('Triggered GET RotationSpeed');
    const state = await getCleanerState();
    switch (state.airvol) {
      case AIRVOL.SILENT:
        this.currentRotationSpeed = 15;
        break;
      case AIRVOL.WEAK:
        this.currentRotationSpeed = 30;
        break;
      case AIRVOL.NORMAL:
        this.currentRotationSpeed = 50;
        break;
      case AIRVOL.TURBO:
        this.currentRotationSpeed = 100;
        break;
      default:
        this.currentRotationSpeed = 50;
        break;
    }
    callback(null, this.currentRotationSpeed);
  }

  // モード
  async handleTargetAirPurifierStateGet(callback) {
    this.log.debug('Triggered GET TargetAirPurifierState');
    const state = await getCleanerState();
    if (state.isAuto()) {
      this.targetState = this.api.hap.Characteristic.TargetAirPurifierState.AUTO;
    } else {
      this.targetState = this.api.hap.Characteristic.TargetAirPurifierState.MANUAL;
    }
    callback(null, this.targetState);
  }

  async handleTargetAirPurifierStateSet(value, callback) {
    this.log.debug('Triggered SET TargetAirPurifierState:' + value);
    const release = await this.mutex.acquire();
    try {
      this.targetState = value;
      const state = await getCleanerState();
      if (value === this.api.hap.Characteristic.TargetAirPurifierState.AUTO) {
        state.mode = MODE.RCOMMENDED;
        await setCleanerState(state);
      } else if (value === this.api.hap.Characteristic.TargetAirPurifierState.MANUAL) {
        state.mode = MODE.MANUAL;
        await setCleanerState(state);
      }
      callback(null);
    } finally {
      release();
    }
  }

  // 温度センサ
  async handleCurrentTemperatureGet(callback) {
    this.log.debug('Triggered GET CurrentTemperature');
    const res = await getSensorValue();
    callback(null, res['htemp']);
  }

  // 湿度センサ
  async handleCurrentRelativeHumidityGet(callback) {
    this.log.debug('Triggered GET CurrentRelativeHumidity');
    const res = await getSensorValue();
    callback(null, res['hhum']);
  }
}