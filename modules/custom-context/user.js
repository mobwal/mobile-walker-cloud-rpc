/**
 * @file modules/custom-context/user.js
 * @project city-rpc-service
 * @author Александр
 */

/**
 * объект для формирования ответа
 */
var result_layout = require('mobnius-pg-dbcontext/modules/result-layout');
var db = require('../dbcontext');
var util = require('../rpc/util');
var authorizeDb = require('../authorize/authorization-db');
const args = require('../conf')();
var Console = require('../log');
var utils = require('../utils');

/**
 * Объект с набором RPC функций
 */
exports.user = function (session) {
    return {
        /**
         * Создание пользователя
         * @param {*} data 
         * @param {*} callback 
         * 
         * @example
         * [{"action":"user","method":"create","data":[{ "c_login": "user", "c_password": "******"}],"type":"rpc"}]
         */
        create: function(data, callback) {
            var orgID = util.getOrgId(session.user);
            var login = data.c_login;
            var password = data.c_password;
            var lang = session.request.query.lg || args.lang;

            utils.locale(lang, (locale) => {
                db.func('core', 'sf_create_user', session).Query({ params: [orgID, data.c_login, data.c_password, '["user"]']}, function(output) {
                    if(output.meta.success && output.result.total == 1) {
                        delete data.c_password;
                        delete data.s_hash;
                        delete data.c_login;
                        delete data.f_org;

                        var userID = parseInt(output.result.records[0].sf_create_user);
                        data.id = userID;

                        db.table('core', 'pd_users', session).Update(data, function (output) { 
                            if (output.meta.success == true) {
                                if (data.c_email) {
                                    utils.sendMail(
                                        args.name, 
                                        data.c_email, 
                                        `<p>${locale.your_registry} <b>${args.name}!!!</b><br />
                                        ${locale.account_registry_finish}<br />${locale.link} <a href="${args.site}">${args.site}</a>
                                        <ul><li>${locale.login}: ${login}</li><li>${locale.password}: ${password}</li></ul></p>`, 
                                        function(err, info) {
                                            if(err) {
                                                Console.error(`${err.message}`, 'err');
                                                callback(result_layout.error(new Error(err.message)));
                                            } else {
                                                callback(result_layout.ok([output.result.records.rowCount == 1]));
                                            }
                                    });
                                } else {
                                    callback(result_layout.ok([output.result.records.rowCount == 1]));
                                }
                            } else {
                                Console.error(output.meta.msg, 'err');
                                callback(result_layout.error(new Error(output.meta.msg)));
                            }
                        });
                    } else {
                        Console.error(output.meta.msg, 'err');
                        callback(result_layout.error(new Error(args.debug ? output.meta.msg : 'no create')));
                    }
                });
            });
        },

        /**
         * получение информации о пользователе
         * @param {*} data 
         * @param {*} callback
         * @example
         * [{"action":"user","method":"getUser","data":[{}],"type":"rpc"}]
         */
        getUser: function (data, callback) {
            if (session.isAuthorize == true) {
                db.func('core', 'sf_users', session).Query({
                    params: [session.user.id]
                }, function (result) {
                    if (result.meta.success == true) {
                        var items = result.result.records;
                        if (items.length == 1) {
                            var item = items[0];
                            callback(result_layout.ok([item]));
                        } else {
                            callback(result_layout.error(new Error("Информация о пользователе не найдена.")));
                        }
                    } else {
                        callback(result_layout.error(new Error(result.meta.msg)));
                    }
                })
            } else {
                callback(result_layout.error(new Error('Получение профиля по не авторизованному пользователю.')));
            }
        },

        /**
         * обновление пользователя
         * @param {any} data 
         * @param {function} callback  
         * @example
         * [{"action":"user","method":"updateCurrentUser","data":[{ "c_first_name": "test" }],"type":"rpc"}]
         */
        updateCurrentUser: function (data, callback) {
            if (session.isAuthorize == true) {
                delete data.c_password;
                delete data.s_hash;
                delete data.c_login;
                delete data.f_org;

                data.id = session.user.id;
                db.table('core', 'pd_users', session).Update(data, function (result) {
                    if (result.meta.success == true) {
                        callback(result_layout.ok([true]));
                    } else {
                        Console.error(result.meta.msg, 'err');
                        callback(result_layout.error(new Error(result.meta.msg)));
                    }
                });
            } else {
                callback(result_layout.error(new Error('Обновление не авторизованным пользователем.')));
            }
        },

        /**
         * обновление другого пользователя
         * @param {any} data 
         * @param {function} callback  
         * @example
         * [{"action":"user","method":"updateOtherUser","data":[{ "id":1, "c_first_name": "test"}],"type":"rpc"}]
         */
        updateOtherUser: function (data, callback) {
            if (session.isAuthorize == true) {
                delete data.c_password;
                delete data.s_hash;
                delete data.c_login;
                delete data.f_org;

                if(data.id == null || data.id == undefined || data.id == '') {
                    callback(result_layout.error(new Error('Идентификатор пользователя не найден')));
                } else {
                    db.table('core', 'pd_users', session).Update(data, function (result) {
                        if (result.meta.success == true) {
                            callback(result_layout.ok([true]));
                        } else {
                            Console.error(result.meta.msg, 'err');
                            callback(result_layout.error(new Error(result.meta.msg)));
                        }
                    });
                }
            } else {
                callback(result_layout.error(new Error('Обновление не авторизованным пользователем.')));
            }
        },

        /**
         * Сбросить пароль для пользователя
         * @param {*} data 
         * @param {*} callback 
         * 
         * @example
         * [{"action":"user","method":"passwordReset","data":[{ "c_login": "user", "c_password": "******"}],"type":"rpc"}]
         */
        passwordReset: function(data, callback) {
            authorizeDb.passwordReset(util.getOrgId(session.user), data.c_login, data.c_password, function(verify) {
                callback(result_layout.ok([verify]));
            });
        },

        /**
         * Удаление пользователя
         * @param {*} data 
         * @param {*} callback 
         */
        removeUser: function(data, callback) {
            db.func('core', 'sf_del_user', session).Query({ params: [util.getOrgId(session.user), data.id] }, function (output) {
                callback(output);
            });
        }
    }
}