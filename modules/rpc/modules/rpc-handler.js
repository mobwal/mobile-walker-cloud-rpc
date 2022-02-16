/**
 * @file modules/rpc/modules/rpc-handler.js
 * @project city-rpc-service
 * @author Aleksandr Krasnov
 */

 var rpcQuery = require('../modules/rpc-query');
 var accessFilter = require('../modules/access-filter');
 var rpcInjection = require('../../rpc-injection');
 var Console = require('../../log');
 var utils = require('../../utils');
 var util  = require('../util');
 var args = require('../../conf')();
 
 module.exports = function (req, res, finish) {
     var dt = new Date();
     var body = req.body;
     var results = [];
     let namespace = (req.params ? req.params.name : null) || 'PN';
     var schemas = global.schemas;
 
     var sessionState = {
         user: res.user,
         isAuthorize: res.isAuthorize,
         response: res,
         request: req
     };
 
     function next(callback) {
         var item = body[0];
         if (item) {
            Console.debug('RPC запрос пользователя ' + res.user.c_login + ': ' + JSON.stringify(item));
 
             body.shift();
             if (!item.data || (item.data && !Array.isArray(item.data))) {
                 results.push(createBadRequest(req, res, item, new Error('Требуется указать свойство data: [{}]')));
                 return next(callback);
             }
             namespace = item.schema || namespace;
             if(!req.params) {
                req.params = {};
             }
             req.params.name = namespace;
             item = securityData(sessionState.user, item, item.schema || namespace, item.action, item.method);
 
             var alias = item.data[0].alias;
             if (alias) {
                 /**
                  * псевдоним результата запроса
                  */
                 item.alias = alias;
             }
 
             accessFilter.filter(namespace, item, res.user.id, schemas, function (err, rows) {
                 if (rows && item.data && item.data.length > 0) {
                     rpcQuery.query(sessionState, item.action, item.method, item.tid, item.data[0], function (result) {
                        if (item.method != 'Query' && item.method != 'Exists' && item.method != 'Select') { // тут добавлен аудит для записей
                            var table = schemas.map[namespace] ? schemas.map[namespace][item.action] : undefined;

                            if (table) {
                                result.result.records = Array.isArray(item.data[0]) ? item.data[0] : [item.data[0]];
                                result.result.total = result.result.records.length;
                            }
                        }
 
                         result.authorizeTime = res.authorizeTime;
                         result.totalTime = new Date() - dt;
                         result.host = utils.getCurrentHost();
                         if (alias) {
                             result.action = alias;
                         }
 
                         if(!args.debug) {
                             delete result.sql;
                             delete result.time;
                             delete result.host;
                             delete result.totalTime;
                         }
 
                         results.push(result);
                         // добавлена injection
                         rpcInjection.handler(sessionState, item.action, item.method, item.data[0], result);
                         next(callback);
                     });
                 } else {
                     if (rows == null && res.user.id == -1) { // значит не авторизовался
                         return res.json([{
                             meta: {
                                 success: false,
                                 msg: 'No authorize'
                             },
                             code: 401,
                             tid: item.tid,
                             type: "rpc",
                             method: item.method,
                             action: item.action,
                             host: utils.getCurrentHost()
                         }]);
                     }
                     if (err == null && rows == null) {
                         err = new Error('Пользователь не имеет прав на выполнение операции.');
                     }
                     if (!item.data || item.data.length == 0) {
                         err = new Error('Условия запроса не указаны.');
                     }
                     var response = createBadRequest(req, res, item, err);
                     results.push(response);
 
                     next(callback);
                 }
             });
         } else {
             callback();
         }
     }
 
     if (Array.isArray(body) == true) {
         next(function () {
             finish(results);
         });
     } else {
         body = [body];
         next(function () {
             finish(results);
         });
     }
 }
 
 
 /**
  * создание ответа на запроса
  * @param {*} req 
  * @param {*} res 
  * @param {*} itemRPC запрос RPC
  * @param {*} err ошибка
  * @returns {any}
  */
 function createBadRequest(req, res, itemRPC, err) {
     var response = {
         code: 400,
         action: itemRPC.action,
         method: itemRPC.method,
         meta: {
             success: false,
             msg: 'Bad request ' + (err ? err.toString() : '') + '. Body: ' + JSON.stringify(itemRPC)
         },
         result: {
             records: [],
             total: 0
         },
         tid: itemRPC.tid,
         type: 'rpc',
         host: utils.getCurrentHost()
     };
     Console.error(response.meta.msg, 'err');
     return response;
 }
 
 function securityData(user, item, schema, tableName, method) {
     if(method == 'Add' || method == 'Update' || method == 'AddOrUpdate') { 
         var filter = util.isOrgFilter(schema, tableName);
         if(filter) {
             if(user.c_claims.indexOf('.master.') >= 0) {
                 return item;
             }
 
             var data = item.data[0];
             if(Array.isArray(data)) {
                 for(var i in data) {
                     data[i].f_org = util.getOrgId(user);
                 }
             } else {
                 data.f_org = util.getOrgId(user);
             }
 
             return item;
         }
     }
 
     return item;
 }