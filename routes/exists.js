/**
 * @file routes/exists.js
 * @project city-rpc-service
 * @author Александр
 * @todo проверка доступности сервера
 */

var express = require("express");
var router = express.Router();
var pkg = require('../package.json');
var result_layout = require('mobnius-pg-dbcontext/modules/result-layout');

module.exports = function () {
    router.get("/", exists);

    return router;
}

/**
 * Проверка на доступность сервера
 * 
 * @example
 * GET ~/exists
 * 
 * {
 *      version: string - версия серверной службы
 *      dbVersion: string - версия БД
 *      ip: string - IP клиента
 * }
 */
function exists(req, res) {
    res.json(result_layout.ok([{
        version: pkg.version,
        ip: req.ip,
        now: new Date()
    }]));
}