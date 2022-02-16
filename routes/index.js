/**
 * @file routes/home.js
 * @project city-rpc-service
 * @author Александр
 * 
 * @todo Открытые страницы
 */

var express = require("express");
var router = express.Router();
const args = require('../modules/conf')();
var utilits = require('../modules/utils');
var pkg = require('../package.json');
var authorizeDb = require('../modules/authorize/authorization-db');
var moment = require('moment');
var db = require('../modules/dbcontext');
var result_layout = require('mobnius-pg-dbcontext/modules/result-layout');
  
module.exports = function () {
    router.get("/page/:page", page);
    router.get("/redirect", redirect);
    if(args.mode == "master") {
        router.get("/calc/currencies", currencies);
        router.get("/calc/services", services);
    }
    return router;
}
  

/**
 * Список услуг оказываемых мной
 * 
 * @example
 * GET ~/calc/services?lg=ru
 */
 function services(req, res) {
    var lang = req.query.lg || args.lang;

    db.provider.db().query('select * from blg.sf_service_prices($1, $2, $3)', [lang, null, null], function(err, rows) {
        if(err) {
            res.json(result_layout.error(new Error(err)))
        } else {
            res.json(result_layout.ok(rows.rows))
        }
    });
}

/**
 * Текущий курс обмена
 * 
 * @example
 * GET ~/calc/currencies?lg=ru
 */
function currencies(req, res) {
    db.provider.db().query('select * from blg.cf_currencies()', null, function(err, rows) {
        if(err) {
            res.json(result_layout.error(new Error(err)))
        } else {
            res.json(result_layout.ok(rows.rows))
        }
    });
}

/**
 * вывод страницы
 * 
 * @example
 * GET ~/page/:page?lg=ru
 */
function page(req, res) {
    var lang = req.query.lg || args.lang;
    var page = req.params.page;

    utilits.locale(lang, (locale) => {
        res.render('page', {
            locale: locale,
            page: page,
            title: locale[page],
            contentRead: (content) => { return utilits.content(lang, content); }
        });
    });
}

/**
 * Перенаправление на другую страницу
 * 
 * @example
 * GET ~/redirect?page=/user
 */
 function redirect(req, res) {
    var lang = req.query.lg || args.lang;
    var userInfo = Buffer.from(Array.isArray(req.query.token) ? req.query.token[0] : req.query.token, 'base64').toString().split(':');

    var UserName = userInfo[0];
    var Password = userInfo[1];

    authorizeDb.getUser(UserName, Password, function (user) {

        utilits.locale(lang, (locale) => {
            moment.locale(lang);

            res.render('redirect', {
                page: req.query.page,
                hash: '#' + req.query.hash,
                version: pkg.version,
                date: moment(new Date()).format('LLL'),
                user: user,
                locale: locale,
                token: req.query.token
            });
        });
    });
 }
