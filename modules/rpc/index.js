/**
 * @file modules/rpc/index.js
 * @project city-rpc-service
 * @author Александр
 */

var express = require('express');
var router = express.Router();

var authUtil = require('../authorize/util');
var shellContext = require('../custom-context/shell');
var yoomoneyContext = require('../custom-context/yoomoney');
var paypalContext = require('../custom-context/paypal');
var userContext = require('../custom-context/user');
var changePasswordRouter = require('./router/changePassword');
var rpcRouter = require('./router/rpc');
var rpcQuery = require('./modules/rpc-query');

/**
 * инициализация модуля для работы с RPC
 * @param {string} auth_type тип авторизации. По умолчанию basic
 */
module.exports = function (auth_type) {
    var contexts = [];

    contexts.push(shellContext);
    contexts.push(yoomoneyContext);
    contexts.push(paypalContext);
    contexts.push(userContext);

    rpcQuery.registryContext(contexts);

    router.use(changePasswordRouter(auth_type));

    router.use(rpcRouter(auth_type));

    var authType = authUtil.getAuthModule(auth_type);
    router.post('/auth', authType.authorize);

    return router;
}