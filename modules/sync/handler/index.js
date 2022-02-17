var v0 = require('./v0');
var v2 = require('./v2');
var Console = require('../../log');

module.exports = function (req, res, bytes, versionProtocol, callback) {
    Console.debug('Пользователем ' + res.user.c_login + ' выполняется обработка синхронизации по протоколу ' + versionProtocol);

    switch (versionProtocol) {
        case 'v0': // применяется только для тестирования
            v0(req, res, bytes, callback);
        break;

        case 'v2':
            v2(req, res, bytes, callback);
            break;
    }
}