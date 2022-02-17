
var express = require('express');
var router = express.Router();
var Console = require('../../log');

var authUtil = require('../../authorize/util');
var handler = require('../../sync/handler');

module.exports = function (auth_type) {
    var authType = authUtil.getAuthModule(auth_type);
    router.use('/synchronization/:version', authType.user());
    router.post('/synchronization/:version', post_synchronization);

    return router;
}

/**
 * Выполнение пакета синхронизации
 * @param {*} req 
 * @param {*} res 
 * @example
 * POST ~/synchronization/v0
 */
function post_synchronization(req, res) {
    var version = req.params.version;
    if (!req.files) {
        return res.status(500).send("Вложенные файлы не найдены.");
    }

    if (!req.files.synchronization) {
        return res.status(500).send("Файл с синхронизацией не найден.");
    }
    Console.debug('SYNC: Запрос тестового протокола синхронизации. userId=' + res.user.id);
    var file = req.files.synchronization;

    handler(req, res, file.data, version, function (code, bytes) {
        switch (code) {
            case 200:
                res.send(bytes);
                break;

            case 500:
                res.status(code).send(bytes);
                break;
        }
    });
}