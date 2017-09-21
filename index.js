var inherits = require('util').inherits;
var Service, Characteristic;
var http = require('http');
var exec = require('child_process').exec;

module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    homebridge.registerAccessory('homebridge-daikin-aircon', 'DaikinAircon', DaikinAirconAccessory);
}


class DaikinAirconAccessory {
    constructor(log, config) {
        this.log = log;
        this.host = config['host'];
        this.name = config['name'];
        this.lastupdate = {};
    }

    /**
     * アダプタからのレスポンスをオブジェクトに変換する
     * @param {string} response - HTTPのレスポンスボディ
     * @return {object}
     */
	parseResponse(response) {
        const vals = {};
        if (response) {
            const items = response.split(',');
            const length = items.length;
            for (let i = 0; i < length; i++) {
                const keyVal = items[i].split('=');
                vals[keyVal[0]] = keyVal[1];
            }
        }
		return vals;
    }

    /**
     * GETリクエストを送る
     * @param {string} path - 送信先のパス
     * @param {function} callback - コールバック
     * @param {function} useCache - デフォルトで1分間レスポンスをキャッシュする。キャッシュを使用しない場合はfalse。
     */
    sendGetRequest(path, callback, useCache = true) {
        const now = +new Date();
        if (useCache && this.lastupdate[path] !== undefined && this.lastupdate[path].time > now - 60000) {
            callback(this.lastupdate[path].body);
        } else {
            const req = http.get(
                `http://${this.host}${path}`,
                (response) => {
                    let body = '';
                    response.setEncoding('utf8');
                
                    response.on('data', (chunk) => {
                        body += chunk;
                    });
                
                    response.on('end', () => {
                        this.lastupdate[path] = {
                            body: body,
                            time: +new Date()
                        };
                        callback(body);
                    });
                }
            ).on('error', (error) => {
                this.log(error.message);
                callback();
            });
        }
    }

	/**
	 * 電源の状態を取得する
     * @param {function} callback - コールバック
	 */
	getActive(callback) {
		this.sendGetRequest('/common/basic_info', (body) => {
            const responseValues = this.parseResponse(body);
            callback(null, responseValues.pow == '1' ? Characteristic.Active.ACTIVE : Characteristic.Active.INACTIVE);
        });
    }
	
	/**
	 * 電源の状態を設定する
     * @param {string} power - 設定する電源状態（0: オフ, 1:オン）
     * @param {function} callback - コールバック
	 */
	setActive(power, callback) {
        // 現在の設定内容を取得し、電源状態(pow)のみ変更して設定リクエストを投げる。
		this.sendGetRequest('/aircon/get_control_info', (body) => {
            const query = body.replace(/,/g, '&').replace(/pow=[01]/, `pow=${power}`);
            this.sendGetRequest('/aircon/set_control_info?' + query, (response) => {
                callback();
            }, false);
        }, false);
    }
	
    /**
     * 現在のエアコンの状態を返す
     * @param {function} callback - コールバック
     */
    getHeaterCoolerState(callback) {
		this.sendGetRequest('/aircon/get_control_info', (body) => {
            const responseValues = this.parseResponse(body);
            let status = Characteristic.CurrentHeaterCoolerState.INACTIVE;
            if (responseValues.pow == '1') {
                switch (responseValues.mode) {
                    case '0': // 自動
                    case '1': // 加湿
                    case '2': // 除湿
                        status = Characteristic.CurrentHeaterCoolerState.IDLE;
                        break;
                    case '3':
                        status = Characteristic.CurrentHeaterCoolerState.COOLING;
                        break;
                    case '4':
                        status = Characteristic.CurrentHeaterCoolerState.HEATING;
                        break;
                    default:
                        status = Characteristic.CurrentHeaterCoolerState.IDLE;
                }
            } 
            callback(null, status);
        });
    }
	
	/**
	 * 運転モードを返す
     * @param {function} callback - コールバック
	 */
	getTargetHeaterCoolerState(callback) {
		this.sendGetRequest('/aircon/get_control_info', (body) => {
            const responseValues = this.parseResponse(body);
            let status = Characteristic.TargetHeaterCoolerState.INACTIVE;
            if (responseValues.pow == '1') {
                switch (responseValues.mode) {
                    case '1': // 自動
                    case '2': // 除湿
                    status = Characteristic.TargetHeaterCoolerState.AUTO;
                        break;
                    case '3': // 冷房
                        status = Characteristic.TargetHeaterCoolerState.COOL;
                        break;
                    case '4': // 暖房
                        status = Characteristic.TargetHeaterCoolerState.HEAT;
                        break;
                    case '6': // 送風
                        status = Characteristic.TargetHeaterCoolerState.AUTO;
                        break;
                    case 'HUM': // 加湿
                    default:
                        status = Characteristic.TargetHeaterCoolerState.AUTO;
                }
            } 
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
		this.sendGetRequest('/aircon/get_control_info', (body) => {
            const currentValues = this.parseResponse(body);
            let mode = currentValues.mode;
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
                .replace(/,/g, '&').replace(/pow=[01]/, 'pow=1')
                .replace(/,/g, '&').replace(/mode=[01]/, `mode=${mode}`);
            this.sendGetRequest('/aircon/set_control_info?' + query, (response) => {
                callback();
            }, false);
        });
	}
    
    /**
     * 現在の室温
     * @param {function} callback - コールバック
     */
	getCurrentTemperature(callback) {
		this.sendGetRequest('/aircon/get_sensor_info', (body) => {
            const responseValues = this.parseResponse(body)
            callback(null, responseValues.htemp);
        });
    }
    
    /**
     * 冷暖房の設定温度を取得する
     * @param {function} callback - コールバック
     */
	getThresholdTemperature(callback) {
		this.sendGetRequest('/aircon/get_control_info', (body) => {
            const responseValues = this.parseResponse(body)
            if (responseValues.stemp && /^[0-9]+$/.test(responseValues.stemp)) {
                callback(null, responseValues.stemp);
            } else {
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
		this.sendGetRequest('/aircon/get_control_info', (body) => {
            const currentValues = this.parseResponse(body);
            const query = body
                .replace(/,/g, '&')
                .replace(/,/g, '&').replace(/pow=[01]/, 'pow=1')
                .replace(/,/g, '&').replace(/mode=[01]/, 'mode=3')
                .replace(/stemp=[0-9.]+/, `stemp=${temp}`)
                .replace(/dt3=[0-9.]+/, `dt3=${temp}`);
            this.sendGetRequest('/aircon/set_control_info?' + query, (response) => {
                callback();
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
		this.sendGetRequest('/aircon/get_control_info', (body) => {
            const currentValues = this.parseResponse(body);
            const query = body
                .replace(/,/g, '&')
                .replace(/,/g, '&').replace(/pow=[01]/, 'pow=1')
                .replace(/,/g, '&').replace(/mode=[01]/, 'mode=4')
                .replace(/stemp=[0-9.]+/, `stemp=${temp}`)
                .replace(/dt4=[0-9.]+/, `dt4=${temp}`);
            this.sendGetRequest('/aircon/set_control_info?' + query, (response) => {
                callback();
            }, false);
        }, false);
    }

    /**
     * 現在の湿度を取得する
     * @param {function} callback - コールバック
     */
    getCurrentRelativeHumidity(callback) {
		this.sendGetRequest('/aircon/get_sensor_info', (body) => {
            const responseValues = this.parseResponse(body);
            callback(null, responseValues.hhum);
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
                minStep: 1
            })
            .on('get', this.getThresholdTemperature.bind(this))
            .on('set', this.setCoolingTemperature.bind(this));

        heaterCoolerService
            .getCharacteristic(Characteristic.HeatingThresholdTemperature)
            .setProps({
                maxValue: 30,
                minValue: 15,
                minStep: 1
            })
            .on('get', this.getThresholdTemperature.bind(this))
            .on('set', this.setHeatingTemperature.bind(this));

        const humiditySensorService = new Service.HumiditySensor(this.name + '（湿度）')

        humiditySensorService
            .getCharacteristic(Characteristic.CurrentRelativeHumidity)
            .on('get', this.getCurrentRelativeHumidity.bind(this));
            
        return [heaterCoolerService, humiditySensorService];
    }
}

