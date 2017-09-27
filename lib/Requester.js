const http = require('http');

module.exports = class Requester {
    constructor(host) {
        this.host = host;
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
                console.log(error.message);
                callback(undefined);
            });
        }
    }
}