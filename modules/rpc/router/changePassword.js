/**
 * @file modules/rpc/router/changePassword.js
 * @project city-rpc-service
 * @author Александр
 * @todo выполняется только для авторизированных пользователей
 */

var express = require('express');
var router = express.Router();

var authorizeDb = require('../../authorize/authorization-db');
var authUtil = require('../../authorize/util');
var result_layout = require('mobnius-pg-dbcontext/modules/result-layout');

var Console = require('../../log');

module.exports = function (auth_type) {
    var authType = authUtil.getAuthModule(auth_type);
    router.use('/changePassword', authType.user(false));
    router.post('/changePassword', changePassword);

    return router;
}

/**
 * Запрос на изменение пароля у авторизованного пользователя.
 * 
 * @example
 * POST ~/changePassword
 * 
 * Headers
 * rpc-authorization: Token
 * Content-Type: application/json
 * 
 * Body x-www-form-urlencoded
 * {
 *      password: string - пароль 
 *      newPassword: string - новый пароль 
 * }
 * 
 * @todo Исключения;
 * body empty - параметры не переданы;
 * not authorized - не авторизован;
 * bad query - ошибка изменения пароля;
 */
function changePassword(req, res) {
    // логин текущего пользователя
    var login = res.user.c_login;

    var password = (req.body.password || '').trim();
    var newPassword = (req.body.newPassword || '').trim();

    if (password && newPassword) {
        authorizeDb.getUser(login, password, function (user) {
            if (user && user.id > 0) {
                authorizeDb.passwordUpdate(login, password, newPassword, function (verify) {
                    if (verify) {
                        res.json(result_layout.ok([verify]));
                    } else {
                        Console.error(`Изменение пароля: ошибка изменения пароля`, 'err');
                        res.json(result_layout.error(['bad query']));
                    }
                });
            } else {
                Console.debug(`Изменение пароля: пользователь не авторизован.`);
                res.json(result_layout.error(['not authorized']));
            }
        }); 
    } else {
        Console.debug(`Изменение пароля: новый пароль не указан.`);
        res.json(result_layout.error(['body empty']));
    }  
}