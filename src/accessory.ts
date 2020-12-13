import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, AccessoryConfig, Service, Characteristic } from 'homebridge';
import { setIp, getCleanerState, setCleanerState, getSensorValue } from './daikinCleaner';
import { POW, MODE } from './DaikinCleanerStatus';


export class DaikinCleanerAccessory {
  informationService: Service;
  cleanerService: Service;
  temperatureSensorService: Service;
  humiditySensorService: Service;
  targetState: number = 0;
  currentState: number = 0;

  constructor(
    public readonly log: Logger,
    public readonly config: AccessoryConfig,
    public readonly api: API
  ) {
    this.log.debug('Example Accessory Plugin Loaded');

    setIp(config.host as string);

    this.informationService = new this.api.hap.Service.AccessoryInformation()
      .setCharacteristic(this.api.hap.Characteristic.Manufacturer, "DAIKIN")
      .setCharacteristic(this.api.hap.Characteristic.Model, "KAFP085A4");

    this.cleanerService = new this.api.hap.Service.AirPurifier();
    this.cleanerService.getCharacteristic(this.api.hap.Characteristic.Active)
        .on('get', this.handleActiveGet.bind(this))
        .on('set', this.handleActiveSet.bind(this));
    this.cleanerService.getCharacteristic(this.api.hap.Characteristic.CurrentAirPurifierState)
        .on('get', this.handleCurrentAirPurifierStateGet.bind(this));
    this.cleanerService.getCharacteristic(this.api.hap.Characteristic.TargetAirPurifierState)
        .on('get', this.handleTargetAirPurifierStateGet.bind(this))
        .on('set', this.handleTargetAirPurifierStateSet.bind(this));

    this.temperatureSensorService = new this.api.hap.Service.TemperatureSensor();
    this.temperatureSensorService.getCharacteristic(this.api.hap.Characteristic.CurrentTemperature)
        .on('get', this.handleCurrentTemperatureGet.bind(this));

    this.humiditySensorService = new this.api.hap.Service.HumiditySensor();
    this.humiditySensorService.getCharacteristic(this.api.hap.Characteristic.CurrentRelativeHumidity)
        .on('get', this.handleCurrentRelativeHumidityGet.bind(this));
  }

  getServices() {
    return [
      this.informationService,
      this.cleanerService,
      this.temperatureSensorService,
      this.humiditySensorService
    ];
  }

  // 電源
  async handleActiveGet(callback) {
    this.log.debug('Triggered GET Active');
    const state = await getCleanerState();
    this.currentState = state.pow == POW.OFF ? this.api.hap.Characteristic.CurrentAirPurifierState.INACTIVE : this.api.hap.Characteristic.CurrentAirPurifierState.PURIFYING_AIR;
    this.cleanerService.getCharacteristic(this.api.hap.Characteristic.CurrentAirPurifierState).updateValue(this.currentState);
    callback(null, state.pow == POW.OFF ? this.api.hap.Characteristic.Active.INACTIVE : this.api.hap.Characteristic.Active.ACTIVE);
  }
  async handleActiveSet(value, callback) {
    this.log.debug('Triggered SET Active:' + value);
    const state = await getCleanerState();
    state.pow = value;
    await setCleanerState(state);
    this.currentState = state.pow == POW.OFF ? this.api.hap.Characteristic.CurrentAirPurifierState.INACTIVE : this.api.hap.Characteristic.CurrentAirPurifierState.PURIFYING_AIR;
    this.cleanerService.getCharacteristic(this.api.hap.Characteristic.CurrentAirPurifierState).updateValue(this.currentState);
    callback(null);
  }

  handleCurrentAirPurifierStateGet(callback) {
    this.log.debug('Triggered GET CurrentAirPurifierState');
    callback(null, this.currentState);
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
    this.targetState = value;
    const state = await getCleanerState();
    if (value == this.api.hap.Characteristic.TargetAirPurifierState.AUTO) {
      state.mode = MODE.RCOMMENDED;
      await setCleanerState(state);
    } else if (value == this.api.hap.Characteristic.TargetAirPurifierState.MANUAL) {
      state.mode = MODE.MANUAL;
      await setCleanerState(state);
    }
    callback(null);
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