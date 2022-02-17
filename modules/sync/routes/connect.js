
var express = require('express');
var router = express.Router();

var authUtil = require('../../authorize/util');
var stack = require('../connection-stack');
const args = require('../../conf')();

module.exports = function (auth_type) {
    var authType = authUtil.getAuthModule(auth_type);
    router.use('/', authType.user(false));

    router.get('/', getUsers);

    return router;
}

/**
 * Получение списка подключенных пользователей
 * @param {*} req 
 * @param {*} res 
 * @example
 * GET ~/users
 */
function getUsers(req, res) {
    var utils = require('../../utils');

    var results = stack.getUsers();
    var users = [];
    for(var r in results) {
        var item = results[r];
        users.push({
            id: item.user.id,
            c_login: item.user.c_login,
            c_claims: item.user.c_claims,
            c_version: item.user.c_version
        });
    }

    var data = { 
        url: req.headers.host,
        token: req.query[utils.getAuthorizationHeader()], 
        vPath: args.virtual_dir_path,
        items: users };

    res.render('connect', data)
}