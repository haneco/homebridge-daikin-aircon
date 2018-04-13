const http = require('http');

class Requester {
  constructor(host) {
    this.host = host;
  }

  /**
     * GETリクエストを送る
     * @param {string} path - 送信先のパス
     * @param {function} callback - コールバック
     * @param {boolean} useCache - デフォルトで1分間レスポンスをキャッシュする。キャッシュを使用しない場合はfalse。
     */
  get(path, callback, useCache = true) {
    const now = +new Date();
    const { lastupdate } = Requester;
    if (useCache && lastupdate[path] !== undefined && lastupdate[path].time > now - 60000) {
      const timer = setInterval(() => {
        if (Requester.lastupdate[path].body !== null) {
          clearInterval(timer);
          callback(Requester.lastupdate[path].body);
        }
      }, 10000);
    } else {
      Requester.lastupdate[path] = {
        body: null,
        time: +new Date(),
      };
      http.get(
        `http://${this.host}${path}`,
        (response) => {
          let body = '';
          response.setEncoding('utf8');

          response.on('data', (chunk) => {
            body += chunk;
          });

          response.on('end', () => {
            Requester.lastupdate[path] = {
              body,
              time: +new Date(),
            };
            callback(body);
          });
        },
      ).on('error', (error) => {
        /* eslint-disable no-console */
        console.log(error.message);
        /* eslint-enable no-console */
        callback(undefined);
      });
    }
  }
}
Requester.lastupdate = {};

module.exports = Requester;
