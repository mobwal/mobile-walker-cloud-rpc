/**
 * @file modules/rpc-injection.js
 * @project city-rpc-service
 * @author Александр
 * @todo предназначен для добавления собственных обработчиков в RPC
 */

var injections = [];
/**
 * массив "инъекций"
 * @type {any[]}
 */
exports.injections = injections;

/** 
 * добавление injection
 * @param {string} key ключ. Требуется для удаления
 * @param {function} handler обработчик
 */
exports.add = function (key, handler) {
    injections.push({
        key: key,
        handler: handler
    });
}

/**
 * удаление injection
 * @param {string} key ключ
 */
exports.remove = function (key) {
    var items = [];
    for (var i = 0; i < injections.length; i++) {
        var item = injections[i];
        if (item.key == key) {
            continue;
        }
        items.push(item);
    }
    injections = items;
}

/**
 * обработчик
 * @param {any} state состояние
 * @param {string} action 
 * @param {string} method
 * @param {any} data данные
 * @param {any} result результат выполнения
 * @example
 * // Регистрация
 * rpcInjection.add('notification', require('../injections/notification').send);
 * // Пример реализации injections/notification
 * exports.send = function (state, action, method, data) {
 *      if (action == 'sys_notifications' && method == 'Add') {
 *          var user_id = data.user_id;
 *          if (typeof user_id == 'number' && user_id) {
 *              ...
 *          }
 *      ...
 *      }
 *  ...
 *  }
 */
exports.handler = function (state, action, method, data, result) {
    for (var i = 0; i < injections.length; i++) {
        var item = injections[i];
        if (typeof item.handler == 'function')
            item.handler(state, action, method, data, result);
    }
}