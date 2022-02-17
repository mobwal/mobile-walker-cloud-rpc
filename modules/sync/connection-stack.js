
/**
 * объект для хранения списка подключений к socket
 */
 var stack = {
    sockets: {},
    socketCount: 0
};

function getUserInfo(data) {
    var userInfo = [];
    if(data.indexOf('OpenToken ') == 0) {
        var token = data.replace('OpenToken ', '');
        userInfo = token.split(':');
    } else {
        var token = data.replace('Token ', '');
        userInfo = Buffer.from(token, 'base64').toString().split(':');
    }
    
    return userInfo;
}

/**
 * добавление информации о новом соединении
 * @param {any} socket соединение
 * @param {any} user информация о пользователе
 * @param {string} IMEI
 * @returns {string} имя пользователя который был подключен.
 */
exports.add = function (socket, user, imei) {
    var data = socket.handshake.query.token;
    if (data) {
        var userInfo = getUserInfo(data);
        var UserName = userInfo[0];
        socket.user = user;
        socket.IMEI = imei;

        stack.sockets[socket.id] = socket;
        stack.socketCount++;

        return UserName;
    } else {
        socket.user = null;
        socket.IMEI = imei;

        stack.sockets[socket.id] = socket;
        stack.socketCount++;
    }

    return null;
}

/**
 * удаление информации о новом соединении
 * @param {any} socket соединение
 * @returns {string} имя пользователя который был отключен.
 */
exports.remove = function (socket) {
    var data = socket.handshake.query.token;
    if (data) {
        var userInfo = getUserInfo(data);
        var UserName = userInfo[0];

        if (stack.sockets[socket.id]) {
            delete stack.sockets[socket.id];
            stack.socketCount--;
        }

        return UserName;
    } else {
        if (stack.sockets[socket.id]) {
            delete stack.sockets[socket.id];
            stack.socketCount--;
        }
    }

    return null;
}

/**
 * возвращается информация о пользователях с логином userName
 * @param {string} userName имя пользователя
 * @returns {any[]}
 */
exports.getUsers = function (userName) {
    var results = [];
    for (var i in stack.sockets) {
        var socket = stack.sockets[i];
        if (socket.user &&
            (socket.user.c_login == userName ||
            socket.user.id == userName || userName == undefined))
            results.push(socket);

    }
    return results;
}