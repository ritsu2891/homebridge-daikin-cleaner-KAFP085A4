import { API, Logger, AccessoryConfig, Service } from 'homebridge';
import { setIp, getCleanerState, setCleanerState, getSensorValue } from './daikinCleaner';
import { POW, MODE, AIRVOL, HUMD, DaikinCleanerStatus } from './DaikinCleanerStatus';
import { Mutex } from 'await-semaphore';

export class DaikinCleanerAccessory {
  informationService: Service;
  cleanerService: Service;
  humidifierService: Service;
  temperatureSensorService: Service;
  humiditySensorService: Service;
  mutex = new Mutex();

  currentStatus: DaikinCleanerStatus;
  targetHumdState = 1;

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

    this.humidifierService = new this.api.hap.Service.HumidifierDehumidifier();
    this.humidifierService.getCharacteristic(this.api.hap.Characteristic.Active)
      .on('get', this.handleHumdActiveGet.bind(this))
      .on('set', this.handleHumdActiveSet.bind(this));
    this.humidifierService.getCharacteristic(this.api.hap.Characteristic.CurrentHumidifierDehumidifierState)
      .on('get', this.handleHumidifierDehumidifierStateGet.bind(this));
    this.humidifierService.getCharacteristic(this.api.hap.Characteristic.TargetHumidifierDehumidifierState)
      .on('get', this.handleTargetHumidifierDehumidifierStateGet.bind(this))
      .on('set', this.handleTargetHumidifierDehumidifierStateSet.bind(this));
    this.humidifierService.getCharacteristic(this.api.hap.Characteristic.CurrentRelativeHumidity)
      .on('get', this.handleCurrentRelativeHumidityGet.bind(this));
    this.humidifierService.getCharacteristic(this.api.hap.Characteristic.RotationSpeed)
      .on('get', this.handleHumdRotationSpeedGet.bind(this))
      .on('set', this.handleHumdRotationSpeedSet.bind(this));

    this.temperatureSensorService = new this.api.hap.Service.TemperatureSensor();
    this.temperatureSensorService.getCharacteristic(this.api.hap.Characteristic.CurrentTemperature)
      .on('get', this.handleCurrentTemperatureGet.bind(this));

    this.humiditySensorService = new this.api.hap.Service.HumiditySensor();
    this.humiditySensorService.getCharacteristic(this.api.hap.Characteristic.CurrentRelativeHumidity)
      .on('get', this.handleCurrentRelativeHumidityGet.bind(this));

    this.currentStatus = new DaikinCleanerStatus("ret=OK,pow=0,mode=0,airvol=3,humd=2", api);

    this.update();
  }

  async update() {
    this.currentStatus = await getCleanerState(this.api);
  }

  getServices() {
    if (this.config.enableSensors) {
      return [
        this.informationService,
        this.cleanerService,
        this.humidifierService,
        this.temperatureSensorService,
        this.humiditySensorService,
      ];
    } else {
      return [
        this.informationService,
        this.cleanerService,
        this.humidifierService,
      ];
    }
  }

  /* ================
        空気清浄機能
     ================ */

  // 電源
  async handleActiveGet(callback) {
    this.log.debug('Triggered GET Active');
    callback(null, this.currentStatus.charActive);
    await this.update();
    this.cleanerService.getCharacteristic(this.api.hap.Characteristic.Active).updateValue(this.currentStatus.charActive);
    this.cleanerService.getCharacteristic(this.api.hap.Characteristic.CurrentAirPurifierState).updateValue(this.currentStatus.charCurrentAirPurifierState);
  }

  async handleActiveSet(value, callback) {
    this.log.debug('Triggered SET Active:' + value);
    callback(null);
    const release = await this.mutex.acquire();
    try {
      this.currentStatus.pow = value;
      await setCleanerState(this.currentStatus);
      await this.update();
      this.cleanerService.getCharacteristic(this.api.hap.Characteristic.CurrentAirPurifierState).updateValue(this.currentStatus.charActive);
      this.humidifierService.getCharacteristic(this.api.hap.Characteristic.Active).updateValue(this.currentStatus.charCurrentHumidifierActive);
      this.humidifierService.getCharacteristic(this.api.hap.Characteristic.CurrentHumidifierDehumidifierState).updateValue(this.currentStatus.charCurrentHumidifierDehumidifierState);
    } finally {
      release();
    }
  }

  async handleCurrentAirPurifierStateGet(callback) {
    this.log.debug('Triggered GET CurrentAirPurifierState');
    callback(null, this.currentStatus.charCurrentAirPurifierState);
    await this.update();
    this.cleanerService.getCharacteristic(this.api.hap.Characteristic.CurrentAirPurifierState).updateValue(this.currentStatus.charCurrentAirPurifierState);
  }

  // 風量（空気清浄）
  async handleRotationSpeedSet(value, callback) {
    this.log.debug(`Triggered SET RotationSpeed: ${value}`);
    callback(null);
    const release = await this.mutex.acquire();
    try {
      this.currentStatus.charCurrentRotationSpeed = value;
      await setCleanerState(this.currentStatus);
    } finally {
      release();
    }
  }

  async handleRotationSpeedGet(callback) {
    this.log.debug('Triggered GET RotationSpeed');
    callback(null, this.currentStatus.charCurrentRotationSpeed);
    await this.update();
    this.cleanerService.getCharacteristic(this.api.hap.Characteristic.RotationSpeed).updateValue(this.currentStatus.charCurrentRotationSpeed);
  }

  // モード
  async handleTargetAirPurifierStateGet(callback) {
    this.log.debug('Triggered GET TargetAirPurifierState');
    callback(null, this.currentStatus.charTargetAirPurifierState);
    await this.update();
    this.cleanerService.getCharacteristic(this.api.hap.Characteristic.TargetAirPurifierState).updateValue(this.currentStatus.charTargetAirPurifierState);
  }

  async handleTargetAirPurifierStateSet(value, callback) {
    this.log.debug('Triggered SET TargetAirPurifierState:' + value);
    callback(null);
    const release = await this.mutex.acquire();
    try {
      if (value === this.api.hap.Characteristic.TargetAirPurifierState.AUTO) {
        this.currentStatus.mode = MODE.RCOMMENDED;
        await setCleanerState(this.currentStatus);
      } else if (value === this.api.hap.Characteristic.TargetAirPurifierState.MANUAL) {
        this.currentStatus.mode = MODE.MANUAL;
        await setCleanerState(this.currentStatus);
        if (this.currentStatus.humd !== HUMD.OFF) {
          this.humidifierService.getCharacteristic(this.api.hap.Characteristic.Active).updateValue(this.api.hap.Characteristic.Active.ACTIVE);
          this.humidifierService.getCharacteristic(this.api.hap.Characteristic.CurrentHumidifierDehumidifierState).updateValue(this.currentStatus.charCurrentHumdState);
        } else {
          this.humidifierService.getCharacteristic(this.api.hap.Characteristic.Active).updateValue(this.api.hap.Characteristic.Active.INACTIVE);
          this.humidifierService.getCharacteristic(this.api.hap.Characteristic.CurrentHumidifierDehumidifierState).updateValue(this.currentStatus.charCurrentHumdState);
        }
      }
    } finally {
      release();
    }
  }

  /* =============
        加湿機能
     ============= */
  async handleHumdActiveGet(callback) {
    callback(null, this.currentStatus.charCurrentHumdActive);
    await this.update();
    this.humidifierService.getCharacteristic(this.api.hap.Characteristic.Active).updateValue(this.currentStatus.charCurrentHumdActive);
    this.humidifierService.getCharacteristic(this.api.hap.Characteristic.CurrentHumidifierDehumidifierState).updateValue(this.currentStatus.charCurrentHumdState);
  }

  async handleHumdActiveSet(value, callback) {
    callback();
    const release = await this.mutex.acquire();
    try {
      await this.update();
      if (value === this.api.hap.Characteristic.Active.ACTIVE) {
        this.currentStatus.pow = POW.ON;
        this.cleanerService.getCharacteristic(this.api.hap.Characteristic.Active).updateValue(this.currentStatus.charActive);
        this.cleanerService.getCharacteristic(this.api.hap.Characteristic.CurrentAirPurifierState).updateValue(this.currentStatus.charCurrentAirPurifierState);
        this.currentStatus.humd = HUMD.HIGH;
        this.humidifierService.getCharacteristic(this.api.hap.Characteristic.Active).updateValue(this.currentStatus.charCurrentHumdActive);
        this.humidifierService.getCharacteristic(this.api.hap.Characteristic.CurrentHumidifierDehumidifierState).updateValue(this.currentStatus.charCurrentHumdState);
      } else {
        this.currentStatus.humd = HUMD.OFF;
        this.humidifierService.getCharacteristic(this.api.hap.Characteristic.Active).updateValue(this.currentStatus.charCurrentHumdActive);
        this.humidifierService.getCharacteristic(this.api.hap.Characteristic.CurrentHumidifierDehumidifierState).updateValue(this.currentStatus.charCurrentHumdState);
      }
      await setCleanerState(this.currentStatus);
    } finally {
      release();
    }
  }

  async handleHumidifierDehumidifierStateGet(callback) {
    this.log.debug('Triggered GET CurrentHumidifierDehumidifierState');
    callback(null, this.currentStatus.charCurrentHumdState);
    await this.update();
    this.humidifierService.getCharacteristic(this.api.hap.Characteristic.CurrentHumidifierDehumidifierState).updateValue(this.currentStatus.charCurrentHumdState);
  }

  async handleTargetHumidifierDehumidifierStateGet(callback) {
    callback(null, this.targetHumdState);
  }

  async handleTargetHumidifierDehumidifierStateSet(value, callback) {
    this.log.debug(value);
    callback(null);
    if (
      value == this.api.hap.Characteristic.TargetHumidifierDehumidifierState.DEHUMIDIFIER ||
      value == this.api.hap.Characteristic.TargetHumidifierDehumidifierState.HUMIDIFIER_OR_DEHUMIDIFIER
    ) {
      this.targetHumdState = this.api.hap.Characteristic.TargetHumidifierDehumidifierState.HUMIDIFIER;
      setTimeout(() => {
        this.humidifierService.getCharacteristic(this.api.hap.Characteristic.TargetHumidifierDehumidifierState).updateValue(this.api.hap.Characteristic.TargetHumidifierDehumidifierState.HUMIDIFIER);
      }, 1000);
    } else {
      this.targetHumdState = value;
    }
  }

  async handleHumdRotationSpeedGet(callback) {
    callback(null, this.currentStatus.charHumdRotationSpeed);
    await this.update();
    this.humidifierService.getCharacteristic(this.api.hap.Characteristic.RotationSpeed).updateValue(this.currentStatus.charHumdRotationSpeed);
  }

  async handleHumdRotationSpeedSet(value, callback) {
    callback(null);
    const release = await this.mutex.acquire();
    try {
      this.currentStatus.charHumdRotationSpeed = value;
      await setCleanerState(this.currentStatus);
      this.humidifierService.getCharacteristic(this.api.hap.Characteristic.RotationSpeed).updateValue(this.currentStatus.charHumdRotationSpeed);
    } finally {
      release();
    }
  }

  /* =============
      センサ機能
    ============= */
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