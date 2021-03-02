export class DaikinCleanerStatus {
  private _pow = 0; // 電源
  private _mode = 0; // モード
  private _airvol = 0; // 風量
  private _humd = 0; // 加湿

  constructor(res: string) {
    const parsedConfig = decodeStatusResponseStr(res);
    this._pow = parsedConfig['pow'];
    this._mode = parsedConfig['mode'];
    this._airvol = parsedConfig['airvol'];
    this._humd = parsedConfig['humd'];
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