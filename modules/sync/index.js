var authUtil = require('../authorize/util');
var Console = require('../log');
var stack = require('./connection-stack');
var socketUtils = require('./utilits');
var uploadHandler = require('./upload-handler');
var downloadHandler = require('./download-handler');
var synchronizationHandler = require('./synchronization-handler');
var utils = require('../utils');

/**
 * Инициализация
 * @param {*} io 
 * @param {string} authType тип авторизации
 */
exports.init = function (io, authType) { 
    authType = authType || 'basic';

    io.on('connection', function (socket) {
        socket.on('disconnect', function (reason) {
            if (socket.user != null) {
                var userName = stack.remove(socket);
                Console.debug('Отключено socket-соединение с сервером для ' + (userName ? 'пользователя ' + userName : 'socket ' + (socket.imei || socket.id)) + '. Причина: ' + reason);
            }
        });

        if (socket.handshake.query.token) {
            isAuthorize(socket, authType, function (req, res) {
                if (res.isAuthorize == true) {
                    res.claims = res.user.c_claims.replace(/^./g, '').replace(/.$/g, '').split('.');

                    res.claims.forEach(function (c) {
                        socket.join(c);
                    });

                    var userName = stack.add(socket, res.user, socket.handshake.query.imei);
                    Console.debug('Подключено socket-соединение с сервером для ' + (userName ? 'пользователя ' + userName : 'socket ' + socket.id) + '.');

                    // тут пользователь авторизован и может работать с socket данными
                    socket.on('synchronization', synchronizationHandler(req, res, socket));
                    socket.on('upload', uploadHandler(req, res, socket));
                    socket.on('download', downloadHandler(req, res, socket));

                    // информирование системы о том, что пользователь был зарегистрирован и обработчики настроены
                    socketUtils.registry(socket);
                } else {
                    Console.debug('Создание socket-подключения не авторизованным пользователем. socket_id=' + (socket.imei || socket.id));
                    socketUtils.noAuth(socket);
                }
            });
        } else {
            stack.add(socket, null, socket.handshake.query.imei);
            Console.debug('Создание socket-подключения без token.');
            socketUtils.noAuth(socket);
        }
    });
}

/**
 * проверка авторизации
 * @param {*} socket 
 * @param {*} callback 
 */
function isAuthorize(socket, authType, callback) {
    var authorization = authUtil.getAuthModule(authType);
    var res = {};
    var obj = {};

    obj[utils.getAuthorizationHeader()] = socket.handshake.query.token;

    var req = {
        headers: Object.assign({
            "user-agent": socket.request.headers["user-agent"]
        }, obj),
        ip: socket.request.connection.remoteAddress,
        socketId: socket.id
    };

    authorization.user(true)(req, res, function () {
        callback(req, res);
    });
}