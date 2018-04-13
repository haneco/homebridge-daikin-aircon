module.exports = (exportedTypes) => {
  const { Service, Characteristic, Requester } = exportedTypes;
  return class DaikinAirconAccessory {
    constructor(log, config = {}) {
      /* eslint-disable no-console */
      this.log = log || console.log;
      /* eslint-enable no-console */
      this.host = config.host || 'http://localhost';
      this.name = config.name || 'test';

      /*
       * この値-2度下回っている場合は暖房、
       * +2度上回っている場合は冷房で電源をオンする。
       * どちらでもない場合は自動モード
       */
      this.coolingHeatingThreshold = config.coolingHeatingThreshold || 25;
    }

    /**
       * アダプタからのレスポンスをオブジェクトに変換する
       * @param {string} response - HTTPのレスポンスボディ
       * @return {object}
       */
    static parseResponse(response) {
      const vals = {};
      if (response) {
        const items = response.split(',');
        const { length } = items;
        for (let i = 0; i < length; i += 1) {
          const [key, value] = items[i].split('=');
          vals[key] = value;
        }
      }
      return vals;
    }

    /**
     * 電源の状態を取得する
       * @param {function} callback - コールバック
     */
    getActive(callback) {
      const requester = new Requester(this.host);
      requester.get('/common/basic_info', (body) => {
        const responseValues = DaikinAirconAccessory.parseResponse(body);
        this.log(`DaikinAirconAccessory got state ${responseValues.pow === '1' ? 'ACTIVE' : 'INACTIVE'}`);
        callback(null, responseValues.pow === '1' ? Characteristic.Active.ACTIVE : Characteristic.Active.INACTIVE);
      });
    }

    /**
     * 電源の状態を設定する
       * @param {string} power - 設定する電源状態（0: オフ, 1:オン）
       * @param {function} callback - コールバック
     */
    setActive(power, callback) {
      // 現在の設定内容を取得し、電源状態(pow)のみ変更して設定リクエストを投げる。
      const requester = new Requester(this.host);
      requester.get('/aircon/get_control_info', (controlBody) => {
        // センサーの値を取得し、モードを決定する
        requester.get('/aircon/get_sensor_info', (sensorBody) => {
          const sensorValues = DaikinAirconAccessory.parseResponse(sensorBody);
          const { coolingHeatingThreshold } = this;
          const { htemp } = sensorValues;
          let mode = '0';

          if (htemp > coolingHeatingThreshold - 2 && htemp < coolingHeatingThreshold + 2) {
            mode = '1';
          } else if (htemp > coolingHeatingThreshold - 2) {
            mode = '3';
          } else if (htemp < coolingHeatingThreshold + 2) {
            mode = '4';
          }

          const query = controlBody
            .replace(/,/g, '&')
            .replace(/pow=[01]/, `pow=${power}`)
            .replace(/mode=[^&]+/, `mode=${mode}`);
          requester.get(`/aircon/set_control_info?${query}`, (response) => {
            const responseValues = DaikinAirconAccessory.parseResponse(response);
            const result = responseValues.ret === 'OK' ? undefined : new Error(responseValues.ret);
            callback(result);
          }, false);
        });
      }, false);
    }

    /**
       * 現在のエアコンの状態を返す
       * @param {function} callback - コールバック
       */
    getHeaterCoolerState(callback) {
      const requester = new Requester(this.host);
      requester.get('/aircon/get_control_info', (body) => {
        const responseValues = DaikinAirconAccessory.parseResponse(body);
        let status = Characteristic.CurrentHeaterCoolerState.INACTIVE;
        let logString = 'DaikinAirconAccessory got heater cooler state ';
        if (responseValues.pow === '1') {
          switch (responseValues.mode) {
            case '0': // 自動
            case '1': // 加湿
            case '2': // 除湿
              status = Characteristic.CurrentHeaterCoolerState.IDLE;
              logString += 'IDLE';
              break;
            case '3':
              status = Characteristic.CurrentHeaterCoolerState.COOLING;
              logString += 'COOLING';
              break;
            case '4':
              status = Characteristic.CurrentHeaterCoolerState.HEATING;
              logString += 'HEATING';
              break;
            case '6': // 送風
            case 'HUM': // 加湿
            default:
              status = Characteristic.CurrentHeaterCoolerState.IDLE;
              logString += 'IDLE';
              break;
          }
        } else {
          logString += 'INACTIVE';
        }
        this.log(logString);
        callback(null, status);
      });
    }

    /**
     * 運転モードを返す
       * @param {function} callback - コールバック
     */
    getTargetHeaterCoolerState(callback) {
      const requester = new Requester(this.host);
      requester.get('/aircon/get_control_info', (body) => {
        const responseValues = DaikinAirconAccessory.parseResponse(body);
        let status = Characteristic.TargetHeaterCoolerState.AUTO;
        let logString = 'DaikinAirconAccessory got target heater cooler state ';
        if (responseValues.pow === '1') {
          switch (responseValues.mode) {
            case '0': // 自動
            case '1': // 加湿
            case '2': // 除湿
              status = Characteristic.TargetHeaterCoolerState.AUTO;
              logString += 'AUTO';
              break;
            case '3': // 冷房
              status = Characteristic.TargetHeaterCoolerState.COOL;
              logString += 'COOL';
              break;
            case '4': // 暖房
              status = Characteristic.TargetHeaterCoolerState.HEAT;
              logString += 'HEAT';
              break;
            case '6': // 送風
            case 'HUM': // 加湿
            default:
              status = Characteristic.TargetHeaterCoolerState.AUTO;
              logString += 'AUTO';
              break;
          }
        } else {
          logString += 'AUTO';
        }
        this.log(logString);
        callback(null, status);
      });
    }

    /**
       * 運転モードを設定する
       * @param {number} callback - 設定する運転モード
       * @param {function} callback - コールバック
       */
    setTargetHeaterCoolerState(state, callback) {
      // 現在の設定内容を取得し、モード(mode)のみ変更して設定リクエストを投げる。
      const requester = new Requester(this.host);
      requester.get('/aircon/get_control_info', (body) => {
        const currentValues = DaikinAirconAccessory.parseResponse(body);
        let mode = currentValues;
        switch (state) {
          case Characteristic.TargetHeaterCoolerState.AUTO:
            mode = 1;
            break;
          case Characteristic.TargetHeaterCoolerState.COOL:
            mode = 3;
            break;
          case Characteristic.TargetHeaterCoolerState.HEAT:
            mode = 4;
            break;
          default:
            break;
        }

        const query = body
          .replace(/,/g, '&')
          .replace(/pow=[01]/, 'pow=1')
          .replace(/mode=[^&]+/, `mode=${mode}`);
        requester.get(`/aircon/set_control_info?${query}`, (response) => {
          const responseValues = DaikinAirconAccessory.parseResponse(response);
          const result = responseValues.ret === 'OK' ? undefined : new Error(responseValues.ret);
          callback(result);
        }, false);
      });
    }

    /**
       * 現在の室温
       * @param {function} callback - コールバック
       */
    getCurrentTemperature(callback) {
      const requester = new Requester(this.host);
      requester.get('/aircon/get_sensor_info', (body) => {
        const responseValues = DaikinAirconAccessory.parseResponse(body);
        const htemp = parseFloat(responseValues.htemp);
        this.log(`DaikinAirconAccessory got current temperature ${htemp}`);
        callback(null, parseFloat(responseValues.htemp));
      });
    }

    /**
       * 冷暖房の設定温度を取得する
       * @param {function} callback - コールバック
       */
    getThresholdTemperature(callback) {
      const requester = new Requester(this.host);
      requester.get('/aircon/get_control_info', (body) => {
        const responseValues = DaikinAirconAccessory.parseResponse(body);
        if (responseValues.stemp && /^[0-9.]+$/.test(responseValues.stemp)) {
          this.log(`DaikinAirconAccessory got threshold temperature ${responseValues.stemp}`);
          callback(null, parseFloat(responseValues.stemp));
        } else {
          this.log('DaikinAirconAccessory could not get threshold temperature');
          this.log(responseValues);
          callback(null, 0);
        }
      });
    }

    /**
       * 冷房の温度を設定する
       * @param {float} temp - 設定する冷房温度
       * @param {function} callback - コールバック
       */
    setCoolingTemperature(temp, callback) {
      // 現在の設定内容を取得し、モード(mode)のみ変更して設定リクエストを投げる。
      const requester = new Requester(this.host);
      requester.get('/aircon/get_control_info', (body) => {
        const query = body
          .replace(/,/g, '&')
          .replace(/pow=[01]/, 'pow=1')
          .replace(/mode=[^&]+/, 'mode=3')
          .replace(/stemp=[0-9.]+/, `stemp=${temp}`)
          .replace(/dt3=[0-9.]+/, `dt3=${temp}`);
        requester.get(`/aircon/set_control_info?${query}`, (response) => {
          const responseValues = DaikinAirconAccessory.parseResponse(response);
          const result = responseValues.ret === 'OK' ? undefined : new Error(responseValues.ret);
          callback(result);
        }, false);
      });
    }

    /**
       * 暖房の温度を設定する
       * @param {float} temp - 設定する冷房温度
       * @param {function} callback - コールバック
       */
    setHeatingTemperature(temp, callback) {
      // 現在の設定内容を取得し、モード(mode)のみ変更して設定リクエストを投げる。
      const requester = new Requester(this.host);
      requester.get('/aircon/get_control_info', (body) => {
        const query = body
          .replace(/,/g, '&')
          .replace(/pow=[01]/, 'pow=1')
          .replace(/mode=[^&]+/, 'mode=4')
          .replace(/stemp=[0-9.]+/, `stemp=${temp}`)
          .replace(/dt4=[0-9.]+/, `dt4=${temp}`);
        requester.get(`/aircon/set_control_info?${query}`, (response) => {
          const responseValues = DaikinAirconAccessory.parseResponse(response);
          const result = responseValues.ret === 'OK' ? undefined : new Error(responseValues.ret);
          callback(result);
        }, false);
      }, false);
    }

    /**
       * 現在の湿度を取得する
       * @param {function} callback - コールバック
       */
    getCurrentRelativeHumidity(callback) {
      const requester = new Requester(this.host);
      requester.get('/aircon/get_sensor_info', (body) => {
        const responseValues = DaikinAirconAccessory.parseResponse(body);
        const hhum = parseFloat(responseValues.hhum);
        this.log(`DaikinAirconAccessory got current relative humidity ${hhum}`);
        callback(null, hhum);
      });
    }

    /**
       * サービスの設定
       */
    getServices() {
      const heaterCoolerService = new Service.HeaterCooler(this.name);

      heaterCoolerService
        .getCharacteristic(Characteristic.Active)
        .on('get', this.getActive.bind(this))
        .on('set', this.setActive.bind(this));

      heaterCoolerService
        .getCharacteristic(Characteristic.CurrentHeaterCoolerState)
        .on('get', this.getHeaterCoolerState.bind(this));

      heaterCoolerService
        .getCharacteristic(Characteristic.TargetHeaterCoolerState)
        .on('get', this.getTargetHeaterCoolerState.bind(this))
        .on('set', this.setTargetHeaterCoolerState.bind(this));

      heaterCoolerService
        .getCharacteristic(Characteristic.CurrentTemperature)
        .on('get', this.getCurrentTemperature.bind(this));

      heaterCoolerService
        .getCharacteristic(Characteristic.CoolingThresholdTemperature)
        .setProps({
          maxValue: 32,
          minValue: 18,
          minStep: 1,
        })
        .on('get', this.getThresholdTemperature.bind(this))
        .on('set', this.setCoolingTemperature.bind(this));

      heaterCoolerService
        .getCharacteristic(Characteristic.HeatingThresholdTemperature)
        .setProps({
          maxValue: 30,
          minValue: 15,
          minStep: 1,
        })
        .on('get', this.getThresholdTemperature.bind(this))
        .on('set', this.setHeatingTemperature.bind(this));

      const humiditySensorService = new Service.HumiditySensor(`${this.name}（湿度）`);

      humiditySensorService
        .getCharacteristic(Characteristic.CurrentRelativeHumidity)
        .on('get', this.getCurrentRelativeHumidity.bind(this));

      return [heaterCoolerService, humiditySensorService];
    }
  };
};
