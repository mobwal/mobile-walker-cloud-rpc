/**
 * @file modules/authorize/authorization-db.js
 * @project city-rpc-service
 * @author Александр
 */

var db = require('../dbcontext');
var args = require('../conf')();
const NodeCache = require("node-cache");

/**
 * период времени для хранение ключа в кэш (секунды)
 * @type {number}
 * @default 60
 */
var user_auth_expire = args.user_auth_expire || 15;
var user_checkperiod = args.user_checkperiod || 30;

const myCache = new NodeCache({ stdTTL: user_auth_expire, checkperiod: user_checkperiod, deleteOnExpire: true });

/**
 * возвращается информация о пользователе
 * @param {string} userName имя пользователя
 * @param {string} password пароль пользователя
 * @param {function} callback функция обратного вызова
 * @example
 * getUser('user', 'password', function(user, original) {
 *      if(user.id > 0) {
 *          // пользователь авторизован
 *      }
 *      // в переменной original храниться информация о пользователе, если она есть в БД
 * });
 */
exports.getUser = function (login, password, callback) {
    if (typeof callback == 'function') {
        var user = {
            id: -1,
            c_claims: ''
        };
           
        var result = myCache.has(login) ? myCache.get(login) : null;

        // пользователь ранее был авторизован и информация в кэше о нем есть
        if(result) {
            myCache.set(login, result);
            callback(result);
        } else {
            db.func('core', 'sf_verify_user', null).Query({ params:[login, password]}, function(data) {
                var f_user = parseInt(data.meta.success ? data.result.records[0].sf_verify_user : -1);
                if (f_user > 0) {
                    db.func('core', 'sf_users', null).Select({ params: [f_user]}, function (data) {
                        var item = data.result.records[0];
                        item.id = parseInt(item.id);
                        myCache.set(login, item);
                        callback(item);
                    });
                } else {
                    callback(user, null);
                }
            });
        }
    }
}

/**
 * восстановление пароля. Будет сгенерирован новый пароль
 * @param {string} login логин
 * @param {string} password старый пароль
 * @param {string} newPassword новый пароль
 * @param {function} callback функция обратного вызова
 */
exports.passwordUpdate = function (login, password, newPassword, callback) {
    if (typeof callback == 'function') {
        db.func('core', 'sf_update_pwd', null).Query({ params: [login, password, newPassword] }, (data) => {
            var verify = data.meta.success ? data.result.records[0].sf_update_pwd : false;
            callback(verify);
        });
    }
}

/**
 * Сброс пароля. Будет сгенерирован новый пароль
 * @param {integer} f_org организация
 * @param {string} login логин
 * @param {string} newPassword новый пароль
 * @param {function} callback функция обратного вызова
 */
 exports.passwordReset = function (f_org, login, newPassword, callback) {
    if (typeof callback == 'function') {
        db.func('core', 'sf_reset_pwd', null).Query({ params: [f_org, login, newPassword] }, (data) => {
            var verify = data.meta.success ? data.result.records[0].s : false;
            callback(verify);
        });
    }
}