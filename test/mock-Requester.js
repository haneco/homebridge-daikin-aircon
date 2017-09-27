const http = require('http');

class Requester {
    constructor() {
        this.lastupdate = {};
    }

    /**
     * GETリクエストを送る
     * @param {string} path - 送信先のパス
     * @param {function} callback - コールバック
     * @param {boolean} useCache - デフォルトで1分間レスポンスをキャッシュする。キャッシュを使用しない場合はfalse。
     */
    get(path, callback, useCache = true) {
        const now = +new Date();
        if (useCache && this.lastupdate[path] !== undefined && this.lastupdate[path].time > now - 60000) {
            callback(this.lastupdate[path].body);
        } else {
            let body;
            switch (path) {
                case '/aircon/get_control_info':
                body = 'ret=OK,pow=' + Requester.currentPower + ',mode=' + Requester.currentMode + ',adv=,stemp=26.0,shum=0,'
                    + 'dt1=M,dt2=M,dt3=26.0,dt4=14.0,dt5=14.0,dt7=M,'
                    + 'dh1=AUTO,dh2=55,dh3=0,dh4=0,dh5=0,dh7=AUTO,dhh=40,'
                    + 'b_mode=3,b_stemp=26.0,b_shum=0,alert=16,'
                    + 'stemp_a=,dt1_a=0,dt7_a=0,b_stemp_a=';
                    break;
                case '/aircon/get_sensor_info':
                    body = 'ret=OK,htemp=' + Requester.currentTemp + ',hhum=80,otemp=23.0,err=0,cmpfreq=0,mompow=1';
                    break;
                case '/common/basic_info':
                    body = 'ret=OK,type=aircon,reg=jp,dst=1,ver=3_2_0,pow=' + Requester.currentPower + ',err=0,location=0,'
                        + 'name=Aircon,icon=22,method=polling,port=30050,id=id,pw=password,'
                        + 'lpw_flag=0,adp_kind=2,pv=3.01,cpv=3,cpv_minor=01,led=1,en_setzone=0,'
                        + 'mac=00005E005300,adp_mode=run,en_hol=0,grp_name=,en_grp=0';
                        break;
                default:
                    if (/^\/aircon\/set_control_info/.test(path)) {
                        const power = path.match(/pow=([01])/);
                        if (power[1] === '0') {
                            Requester.currentPower = '0';
                        } else {
                            Requester.currentPower = '1';
                        }

                        const mode = path.match(/mode=([^&]+)/);
                        console.log(mode);
                        Requester.currentMode = mode[1];
                    }

                    break;
            }
            callback(body);
        }
    }
}

// 現在の電源状態
Requester.currentPower = '0';

// 現在の室温
Requester.currentTemp = '26.0';

// 現在の動作モード
Requester.currentMode = '1';

module.exports = Requester;
