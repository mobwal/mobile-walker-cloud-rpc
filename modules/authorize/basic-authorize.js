/**
 * @file modules/authorize/basic-authorize.js
 * @project city-rpc-service
 * @author Александр
 * @todo базовый механизм авторизации. Логин и пароль шифруются как base64 строка
 */

var authorizeDb = require('./authorization-db');
var utils = require('../utils');
var Console = require('../log');
var db = require('../dbcontext');
var args = require('../conf')();
const NodeCache = require("node-cache");

const LOCK_TIME = 5;
const firstCache = new NodeCache({ stdTTL: 60, checkperiod: 30, deleteOnExpire: true });
const disableCache = new NodeCache({ stdTTL: LOCK_TIME * 60, checkperiod: 60, deleteOnExpire: true }); // блокировка пользователей на 5 минут
const AUTH_COUNT = 5; // количество попыток авторизации

/**
 * установка текущего пользователя
 * @param {boolean} skip false - пользователь не авторизован и выдавать сразу код 401
 * @returns {function}
 */
exports.user = function (skip) {
    skip = skip == undefined ? false : skip;
    return function (req, res, next) {
        var data = req.headers[utils.getAuthorizationHeader()] || req.query[utils.getAuthorizationHeader()];
        if (data) {
            var userInfo = [];
            if(data.indexOf('OpenToken ') == 0) {
                var token = data.replace('OpenToken ', '');
                userInfo = token.split(':');
            } else {
                var token = data.replace('Token ', '');
                userInfo = Buffer.from(token, 'base64').toString().split(':');
            }
            var UserName = userInfo[0];
            var Password = userInfo[1];

            authorizeDb.getUser(UserName, Password, function (user) {

                res.user = user;
                res.isAuthorize = user.id != -1;
                res.isMaster = user.c_claims.indexOf('.master.') >= 0;
                
                if (!res.isAuthorize) {
                    if (skip == true) {
                        next();
                    } else { // если пользователь не авторизован, то выдавать сразу код 401
                        res.status(401).json({
                            meta: {
                                success: false
                            }
                        });
                    }
                } else {
                    next();
                }
            });

        } else {
            if (skip == true) {
                res.user = Object.assign({
                    id: -1,
                    c_claims: '',
                    c_login: 'none'
                });
                res.isAuthorize = false;
                res.isMaster = false;
                next();
            } else {
                res.status(401).json({
                    meta: {
                        success: false
                    }
                });
            }
        }
    }
}

/**
 * проверки авторизации пользователя
 * 
 * @example
 * POST ~/auth
 * 
 * Body x-www-form-urlencoded
 * {
 *      UserName: string - Логин 
 *      Password: string - Пароль
 *      Version: string - версия устройства
 * }
 * 
 * @todo Статусы;
 * 200 - пользователь авторизован;
 * 401 - пользователь не авторизован;
 * 401 - логин заблокирован из-за частых запросов на авторизацию;
 */
exports.authorize = function (req, res) {
    var UserName = req.body.UserName;
    var Password = req.body.Password;
    var Version = req.body.Version;
    var lang = req.query.lg || args.lang;

    utils.locale(lang, (locale) => {
        var disabled = disableCache.has(UserName) ? disableCache.get(UserName) : null;

        if(disabled) {
            disableCache.set(UserName, {});

            Console.debug('Пользователь ' + UserName + " заблокирован на определенный срок.");

            return res.status(401).json({
                meta: {
                    success: false,
                    msg: locale.authorization_lock
                }
            });
        } else {
            authorizeDb.getUser(UserName, Password, function (user) {
                if (user.id == -1) {
                    var result = firstCache.has(UserName) ? firstCache.get(UserName) : {
                        count: 0
                    };
                    result.count++;
                    
                    firstCache.set(UserName, result);
                
                    if(result.count > AUTH_COUNT) {
                        disableCache.set(UserName, {});
                    }

                    Console.debug(`Пользователь ${UserName} не авторизован.`);
                    res.status(401).json({
                        meta: {
                            success: false,
                            msg: locale.authorization_failed
                        }
                    });
                } else {
                    db.provider.db().query('update core.pd_users as u set d_last_auth_date = now(), c_version = $1 where u.id = $2', [Version, user.id], function() {
                        Console.log(`Пользователь ${UserName} выполнил авторизацию.`);
                        
                        res.json({
                            token: Buffer.from(UserName + ':' + Password).toString('base64'),
                            user: {
                                id: user.id,
                                login: user.c_login,
                                claims: user.c_claims,
                                date: new Date()
                            }
                        });
                    });
                }
            });
        }
    });
}