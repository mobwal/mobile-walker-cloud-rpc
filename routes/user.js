/**
 * @file routes/user.js
 * @project city-rpc-service
 * @author Александр Краснов
 * @todo Открытые функции по работе с аккаунтами
 */

var express = require("express");
var router = express.Router();
var db = require('../modules/dbcontext');
var utils = require('../modules/utils');
var result_layout = require('mobnius-pg-dbcontext/modules/result-layout');
var authorizeDb = require('../modules/authorize/authorization-db');
var Console = require('../modules/log');
var generator = require('generate-password');
const args = require('../modules/conf')();
const request = require('request');

var validator = require("email-validator");

module.exports = function () {
    router.post('/account', account);
    router.post('/login', login);
    router.post('/password-instruction-reset', passwordInstructionReset);
    router.get('/pwd-reset', pwdReset);

    return router;
}

/**
 * Процедура замены пароля для пользователя по электронному адресу
 * @example
 * GET ~/user/pwd-reset?email=[адрес эл. почты]&hash=[ключ]
 * @todo Исключения;
 * data not found - в базе данных информации не найдено;
 * request empty - параметры в запросе не указаны;
 * send error - общая ошибка отравки письма;
 * email invalid - адрес эл. почты не валиден;
 */
function pwdReset(req, res) {
    var email = (req.query.email || '').trim();
    var hash = (req.query.hash || '').trim();
    var lang = req.query.lg || args.lang;

    utils.locale(lang, (locale) => {
        if(email && hash) {
            email = Buffer.from(email, 'base64').toString();
            hash = Buffer.from(hash, 'base64').toString();

            db.provider.db().query('select id, c_login, c_password, f_org, s_hash from core.pd_users where c_email = $1 and (c_password = $2 or s_hash = $3);', [email, hash, hash], function(err, row) {
                if(err) {
                    Console.error('Сброс пароля: ' + err.message, 'err');
                }
                
                if(row.rowCount == 1) {
                    var item = row.rows[0];
                    var _hash = item.s_hash || item.c_password;

                    if(hash == _hash) {
                        var password = generator.generate({
                            length: 8,
                            numbers: true
                        });

                        authorizeDb.passwordReset(item.f_org, item.c_login, password, function(verify) {

                            db.table('core', 'pd_users', { user: { id: null, c_login: 'mobwal', c_claims: '' }}).Update({ id: item.id, d_last_change_password: new Date() }, function() {});
                            
                            utils.sendMail(
                                args.name, 
                                email, 
                                `<p>${locale.accesses_restored}<br />
                                <ul><li>${locale.login}: ${item.c_login}</li><li>${locale.password}: ${password}</li></ul></p>`, 
                                function(err, info) {
                                    if(err) {
                                        Console.error('Сброс пароля. Отправка письма: ' + err.message, 'err');
                                        res.json(result_layout.error(['send error']));
                                    } else {
                                        res.redirect(args.site);
                                    }
                            });
                        });
                    } else {
                        Console.debug('Сброс пароля: ключ ' + hash + ' в базе данных не найден');

                        res.json(result_layout.error(['key not found']));
                    }
                } else {
                    Console.debug('Сброс пароля: переданные данные email=' + email + ' и hash=' + hash + ' не найден в БД.');

                    res.json(result_layout.error(['data not found']));
                }
            });
        } else {
            Console.debug('Сброс пароля: параметр email и hash не указаны');

            res.json(result_layout.error(['request empty']));
        }
    });
}

/**
 * Инструкция по сбросу пароля для пользователей. Обязательным должно быть наличие электронной почты
 * @example
 * POST ~/user/password-instruction-reset
 * 
 * Body x-www-form-urlencoded
 * {
 *      email: string - адрес электронной почты
 * }
 * @todo Исключения;
 * email not found - адрес электронной почты не найден;
 * body is empty - тело запроса не указано;
 * send error - общая ошибка отравки письма;
 * email invalid - адрес эл. почты не валиден;
 */
function passwordInstructionReset(req, res) {
    var email = req.body.email;
    var lang = req.query.lg || args.lang;

    recaptcha(req, req.body.token, (success) => {

        if(!success) {
            return res.send('You bot');
        }

        utils.locale(lang, (locale) => {
            if(email) {

                if(!validator.validate(email)) {
                    Console.error('Восстановление пароля. ' + email + ' не валиден.', 'err');
                    return res.json(result_layout.error(['email invalid']));
                }

                db.provider.db().query('select c_login, c_password, s_hash from core.pd_users where c_email = $1;', [email], function(err, row) {
                    if(err) {
                        Console.error('Восстановление пароля: ' + err.message, 'err');
                    }
                    
                    if(row.rowCount > 0) {
                        var message_text = '<ul>';

                        if(row.rowCount > 0) {
                            for(var k = 0; k < row.rows.length; k++) {
                                var kItem = row.rows[k];
                                var hash = kItem.s_hash || kItem.c_password;
                                message_text += `<li><a href="${args.site}${args.virtual_dir_path}user/pwd-reset?email=${Buffer.from(email).toString('base64')}&hash=${Buffer.from(hash).toString('base64')}">${kItem.c_login}</a></li>`;
                            }
                        }

                        message_text += '</ul>'

                        utils.sendMail(
                            args.name, 
                            email, 
                            `${locale.resore_body_message}<br />${locale.resore_body_description}
                            ${message_text}`,
                            function(err, info) {
                                if(err) {
                                    Console.error('Восстановление пароля. Отправка письма: ' + err.message, 'err');
                                    res.json(result_layout.error(['send error']));
                                } else {
                                    res.json(result_layout.ok([email]));
                                }
                        });
                    } else {
                        Console.debug('Восстановление пароля: адрес электронной почты ' + email + ' не найден.');

                        res.json(result_layout.error(['email not found']));
                    }
                });
            } else {
                Console.debug('Восстановление пароля: тело запроса не указано.');

                res.json(result_layout.error(['body is empty']));
            }
        });
    });
}

/**
 * Создание аккаунта администратора
 * @example
 * POST ~/user/account
 * 
 * Body x-www-form-urlencoded
 * {
 *      c_login: string - Логин 
 *      c_password: string - Пароль
 * }
 * @todo Исключения;
 * bad query - ошибка SQL - запроса;
 * body is empty - тело запроса не указано;
 * bad user update - ошибка обновления дополнительных данных;
 * reg user not update - не удалось обновить дополнительные данные;
 */
function account(req, res) {
    var body = req.body;
    var lang = req.query.lg || args.lang;

    recaptcha(req, body.token, (success) => {
        if(!success) {
            return res.send('You bot');
        }
        utils.locale(lang, (locale) => {
            if(body) {
                db.func('core', 'sf_create_user', {}).Query({ params: [null, body.c_login, body.c_password, '["admin"]'] }, function(output) {
                    var sf_create_user = output.result.records[0].sf_create_user;
                    if(output.meta.success) {
                        db.provider.db().query(`update core.pd_users
                                                set c_email = $1
                                                where id = $2`, [body.c_email, sf_create_user], function(err, output) {
                            if(err) {
                                Console.error('Создание аккаунта: ошибка обновления дополнительных данных.', 'err');

                                res.json(result_layout.error(['bad user update']));
                            } else {
                                if(output.rowCount == 1) {
                                    if (body.c_email) {
                                        utils.sendMail(
                                            args.name, 
                                            body.c_email, 
                                            `<p>${locale.thank_you_registry}</b><br />
                                            ${locale.account_registry_finish}<br />
                                            ${locale.link}: <a href="${args.site}">${args.site}</a>
                                            <ul><li>${locale.login}: ${body.c_login}</li><li>${locale.password}: ${body.c_password}</li></ul></p>`, 
                                            function(err, info) {
                                                if(err) {
                                                    Console.error('Создание аккаунта. Отправка письма: ' + err.message, 'err');
                                                    res.json(result_layout.error(['send error']));
                                                } else {
                                                    res.json(result_layout.ok([sf_create_user]));
                                                }
                                        });
                                    } else {
                                        res.json(result_layout.ok([sf_create_user]));
                                    }
                                } else {
                                    Console.debug('Создание аккаунта: не удалось обновить дополнительные данные.');

                                    res.json(result_layout.error(['reg user not update']));
                                }
                            }
                        });
                    } else {
                        Console.debug('Создание аккаунта: ' + output.meta.msg + '.');

                        res.json(result_layout.error(['bad query']));
                    }
                });
            } else {
                Console.debug('Создание аккаунта: тело запроса не указано.');

                res.json(result_layout.error(['body is empty']));
            }
        });
    });
}

/**
 * Проверка на наличие логина
 * @example
 * POST ~/user/login
 * 
 * Body x-www-form-urlencoded
 * {
 *      c_login: string - Логин 
 * }
 * @todo Исключения;
 * bad query - ошибка SQL - запроса;
 * body is empty - тело запроса не указано;
 */
function login(req, res) {
    var login = req.body.c_login;
    if(login) {
        db.provider.db().query('select count(*) from core.pd_users where c_login = $1;', [login], function(err, output) {
            if(err) {
                Console.error('Проверка наличия логина: ' + err);
            }
            
            res.json(result_layout.ok([output.rows[0].count == '1']));
        });
    } else {
        Console.debug('Проверка наличия логина: тело запроса не указано.');
        res.json(result_layout.error(['body is empty']));
    }
}

function recaptcha(req, token, callback) {
    const secretKey = args.grecaptcha;
 
    const verificationURL = "https://www.google.com/recaptcha/api/siteverify";

    request.post({
        headers: {'content-type' : 'application/x-www-form-urlencoded'},
        url:     verificationURL,
        body:    "secret=" + secretKey + "&response=" + token + "&remoteip=" + req.connection.remoteAddress
    }, function(error, response, body){
        body = JSON.parse(body);
        
        if (body.success !== undefined && !body.success) {
            callback(false);
        } else {
            callback(true);
        }
    });
}