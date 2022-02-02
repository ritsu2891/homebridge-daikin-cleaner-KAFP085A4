import { API } from 'homebridge';

export class DaikinCleanerStatus {
  private _pow = 0; // 電源
  private _mode = 0; // モード
  private _airvol = 0; // 風量
  private _humd = 0; // 加湿
  private api;

  constructor(res: string, api: API) {
    const parsedConfig = decodeStatusResponseStr(res);
    this._pow = parsedConfig['pow'];
    this._mode = parsedConfig['mode'];
    this._airvol = parsedConfig['airvol'];
    this._humd = parsedConfig['humd'];
    this.api = api;
  }

  public getAsDict() {
    return {
      pow: this._pow,
      mode: this._mode,
      airvol: this._airvol,
      humd: this._humd,
    };
  }

  public isAuto() {
    return this._airvol === AIRVOL.AUTO;
  }

  public set pow(newPow: number) {
    this._pow = newPow;
  }

  public get pow() {
    return this._pow;
  }

  public set mode(newMode: number) {
    this._mode = newMode;
    if (this._mode === MODE.RCOMMENDED) {
      this._airvol = AIRVOL.AUTO;
      this._humd = HUMD.AUTO;
    } else if (this._mode === MODE.MANUAL) {
      this._airvol = this._airvol !== AIRVOL.AUTO ? this._airvol : AIRVOL.NORMAL;
      this._humd = this._humd !== HUMD.AUTO ? this._humd : HUMD.HIGH;
    }
  }

  public get mode() {
    return this._mode;
  }

  public get airvol() {
    return this._airvol;
  }

  public set airvol(newAirvol) {
    this._airvol = newAirvol;
  }

  public get humd() {
    return this._humd;
  }

  public set humd(newHumd) {
    this._humd = newHumd;
  }

  public get charActive() {
    return this.pow === POW.OFF ?
      this.api.hap.Characteristic.Active.INACTIVE :
      this.api.hap.Characteristic.Active.ACTIVE;
  }

  public get charCurrentAirPurifierState() {
    return this.pow === POW.OFF ?
      this.api.hap.Characteristic.CurrentAirPurifierState.INACTIVE :
      this.api.hap.Characteristic.CurrentAirPurifierState.PURIFYING_AIR;
  }

  public get charTargetAirPurifierState() {
    if (this.isAuto()) {
      return this.api.hap.Characteristic.TargetAirPurifierState.AUTO;
    } else {
      return this.api.hap.Characteristic.TargetAirPurifierState.MANUAL;
    }
  }

  public get charCurrentHumidifierActive() {
    if (this.pow === POW.ON && this.humd !== HUMD.OFF) {
      return this.api.hap.Characteristic.Active.ACTIVE;
    } else {
      return this.api.hap.Characteristic.Active.INACTIVE;
    }
  }

  public get charCurrentHumidifierDehumidifierState() {
    if (this.pow === POW.ON && this.humd !== HUMD.OFF) {
      return this.api.hap.Characteristic.CurrentHumidifierDehumidifierState.HUMIDIFYING;
    } else {
      return this.api.hap.Characteristic.CurrentHumidifierDehumidifierState.INACTIVE;
    }
  }

  public set charCurrentRotationSpeed(value) {
    if (!this.isAuto()) {
      if (value == 100) {
        this.airvol = AIRVOL.TURBO;
      } else if (value >= 50) {
        this.airvol = AIRVOL.NORMAL;
      } else if (value >= 30) {
        this.airvol = AIRVOL.WEAK;
      } else {
        this.airvol = AIRVOL.SILENT;
      }
    }
  }

  public get charCurrentRotationSpeed() {
    switch (this.airvol) {
      case AIRVOL.SILENT:
        return 15;
      case AIRVOL.WEAK:
        return 30;
      case AIRVOL.NORMAL:
        return 50;
      case AIRVOL.TURBO:
        return 100;
      default:
        return 50;
    }
  }

  public get charCurrentHumdActive() {
    if (this.pow === POW.OFF || this.humd === HUMD.OFF) {
      return this.api.hap.Characteristic.Active.INACTIVE;
    } else {
      return this.api.hap.Characteristic.Active.ACTIVE;
    }
  }

  public get charCurrentHumdState() {
    if (this.pow === POW.OFF || this.humd === HUMD.OFF) {
      return this.api.hap.Characteristic.CurrentHumidifierDehumidifierState.INACTIVE;
    } else {
      return this.api.hap.Characteristic.CurrentHumidifierDehumidifierState.HUMIDIFYING;
    }
  }

  public set charHumdRotationSpeed(value) {
    if (value >= 70) {
      this.humd = HUMD.HIGH;
    } else if (value >= 30) {
      this.humd = HUMD.NORMAL;
    } else {
      this.humd = HUMD.MODERATE;
    }
  }

  public get charHumdRotationSpeed() {
    switch (this.humd) {
      case HUMD.HIGH:
        return 100;
      case HUMD.NORMAL:
        return 50;
      case HUMD.MODERATE:
        return 20;
      default:
        return 20;
    }
  }
}

export function decodeStatusResponseStr(res: string) {
  const parsedConfig = {};
  const resElems = res.split(',');
  resElems.forEach(resElem => {
    const resElemItems = resElem.split('=');
    if (resElemItems[0] !== 'ret') {
      parsedConfig[resElemItems[0]] = parseInt(resElemItems[1]);
    }
  });
  return parsedConfig;
}

export const POW = {
  OFF: 0, // 電源オフ
  ON: 1, // 電源オン
};

export const MODE = {
  AUTO: 0, // 自動
  MANUAL: 0, // 風量・加湿手動設定
  RCOMMENDED: 1, // おまかせ
  SAVE_POWER: 2, // 節電
  POLLEN: 3, // 花粉
  THROATAND_SKIN: 4, // のど・はだ
  CIRCULATOR: 5, // サーキュレータ
};

export const AIRVOL = {
  AUTO: 0, // 自動
  SILENT: 1, // しずか
  WEAK: 2, // 弱
  NORMAL: 3, // 標準
  TURBO: 5, // ターボ
};

export const HUMD = {
  OFF: 0, // オフ
  MODERATE: 1, // ひかえめ
  NORMAL: 2, // 標準
  HIGH: 3, // 高め
  AUTO: 4, // 自動
};