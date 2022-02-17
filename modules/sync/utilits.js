var utils = require('../utils');
var Console = require('../log');

var SYNC_STATUS = 'synchronization-status';
var REGISTRY = 'registry';
var NOT_AUTH = 'not_auth';
var SYNC = 'synchronization';

/**
 * отправка сообщения по socket
 * @param {any} socket соединение
 * @param {string} message текст сообщения
 */
exports.send = send;

function send(socket, message, tid) {
    if (socket) {
        socket.emit(SYNC_STATUS, socketOkResultLayout(message, tid));
    }
}

/**
 * объект для загрузки данных по socket
 * @param {string} tid
 */
exports.transfer = function(tid) {
    var data = socketOkResultLayout(Buffer.from([]), tid);
    data.meta.processed = false;
    delete data.meta.tid;
    return data;
}

/**
 * синхронизация по socket. Ошибка
 * @param {any} socket соединение
 * @param {Error} err ошибки
 * @param {string} tid идентификатор
 */
exports.error = function(socket, err, tid) {
    var data = socketFailResultLayout(err.toString(), 500, tid);
    data.result = Buffer.from([]);
    delete data.tid;
    socket.emit(SYNC, data);
}

/**
 * синхронизация по socket. Success
 * @param {any} socket соединение
 * @param {string} tid идентификатор
 */
exports.success = function(socket, obj, tid) {
    var data = socketOkResultLayout(obj, tid);
    delete data.tid;
    socket.emit(SYNC, data);
}

/**
 * регистрация socket
 * @param {any} socket соединение
 */
exports.registry = function(socket) {
    if(socket) {
        socket.emit(REGISTRY, socketOkResultLayout(''));
    }
}

/**
 * без авторизации
 * @param {any} socket соединение
 */
exports.noAuth = function(socket) {
    if(socket) {
        socket.emit(NOT_AUTH, socketFailResultLayout('Пользователь не авторизован.', 401));
    }
}

/**
 * Логирование по socket
 * @param {any} socket соединение
 * @param {string} tid идентификатор пакета. Можно не передавать
 */
exports.log = log;

function log(socket, tid) {
    return new function() {

        this.log = function(message) {
            send(socket, message, tid);
        }

        this.error = function(message) {
            send(socket, message, tid);
            Console.error(message);
            return message;
        }

        return this;
    }
}

/**
 * Положительный результат сокет сообщения
 * @param {any} obj данные для передачи
 * @param {string} tid идентификатор. Может быть пустым
 * @returns объект
 */
function socketOkResultLayout (obj, tid) {

    var data = {
        meta: {
            processed: true
        },
        data: {
            success: true,
            msg: ''
        },
        result: obj,
        code: 200,
        host: utils.getCurrentHost()
    };

    if (tid) {
        data.tid = tid;
        data.meta.tid = tid;
    }

    return data;
}

/**
 * Ошибочный результат сокет сообщения
 * @param {string} message текст ошибки
 * @param {number} code код результата, например, 200, 401 и т.д.
 * @param {string} tid идентификатор. Может быть пустым
 * @returns объект
 */
 function socketFailResultLayout (message, code, tid) {

    var data = {
        meta: {
            processed: true
        },
        data: {
            success: false,
            msg: message
        },
        code: code,
        host: utils.getCurrentHost()
    }

    if (tid) {
        data.tid = tid;
        data.meta.tid = tid;
    }

    return data;
}

/**
 * Запись файла
 * @param {any} session сессия
 */
exports.writeFile = function (session) {
    var socketLog = log(session.request.socket, session.request.tid);

    return new function () {

        this.toResponce = function (id, name, bytes) {
            if (!session.response.attachments) {
                session.response.attachments = [];
            }
            session.response.attachments.push({
                link: id,
                name: name,
                buffer: bytes
            });
        }

        this.toError = function (record, message) {
            record.__error = message;
            Console.error(record.__error);
            socketLog.log(record.__error);
        }

        return this;
    }
}

exports.fileReader = function (session) {
    return new function () {
        var files = session.request.attachments;

        this.getFile = function (name) {
            for (var i in files) {
                var file = files[i];
                if (file.name == name)
                    return file;
            }
            return null;
        }

        this.getFileByKey = function (key) {
            for (var i in files) {
                var file = files[i];
                if (file.key == key)
                    return file;
            }
            return null;
        }

        return this;
    }
}

/**
 * отслеживание прогресса обработки файлов
 * @param {any} logger socket log
 * @param {number} totalCount общее количество данных
 */
exports.progressFile = function (logger, totalCount) {
    return new function () {
        var idx = 0;
        var avg = [];
        var startDt = Date.now();

        var iterDt = 0;

        this.init = function (time) {
            Console.debug('Получено из БД ' + totalCount + ' файлов за ' + time + ' мс.');
        }

        this.beforeNext = function () {
            iterDt = Date.now();
        }

        this.next = function (message) {
            idx++;
            var time = Date.now() - iterDt;
            avg.push(time);
            //logger.log('[LOGS]' + '(' + idx + '/' + totalCount + ')');
            //logger.log('Файл ' + idx + '/' + totalCount + ' ' + message + '. Выполнено за ' + time + ' мсек.');
        }

        this.finish = function (message) {
            var sum = 0;
            for (var i in avg) {
                sum += avg[i];
            }

            var avgMessage = 'Средняя скорость обработки ' + (sum / (totalCount || 1)).toFixed(2) + ' мс.';
            logger.log(avgMessage);
            logger.log(message);

            Console.debug(avgMessage);

            idx = 0;
            avg = [];
            startDt = null;
            iterDt = null;
        }

        this.getTime = function () {
            return (Date.now() - startDt) / 1000;
        }

        this.getTotalCount = function () {
            return totalCount;
        }

        return this;
    }
}