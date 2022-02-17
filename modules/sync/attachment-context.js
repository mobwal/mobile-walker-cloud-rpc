
/**
 * объект для формирования ответа
 */
var result_layout = require('mobnius-pg-dbcontext/modules/result-layout');
var socketUtils = require('./utilits');
/**
 * провайдер по обработке данных
 */
var dbcontext = require('../dbcontext');
var filter = require('../rpc/modules/access-filter');

var Console = require('../log');
const args = require('../conf')();
var mime = require('mime-types');

var fs = require('fs');
var pth = require('path');
var join = pth.join;
var fx = require('mkdir-recursive');
var util = require('./catalog-util');

/**
 * обработка вложений у точки маршрута
 * @param {any} session сессия
 */
exports.attachments = function (session) {
    var userId = session.user.c_login;
    var socketLog = socketUtils.log(session.request.socket, session.request.tid);
    var writeFile = socketUtils.writeFile(session);
    var dir = args.storage;

    var self = {
        Select: function (query_param, callback) {
            if(Array.isArray(query_param.params)) {
                query_param.params.unshift(session.user);
            }
            dbcontext.provider.select('dbo', 'of_mui_cd_attachments()', query_param, filter.security(session), null, function (args) {
                var results = [];

                if (args.meta.success) {
                    var items = args.result.records;
                    var progressFile = socketUtils.progressFile(socketLog, items.length);
                    progressFile.init(args.time);

                    function next() {
                        var item = items[0];
                        if (item) {
                            items.shift();
                            if (args.return_attachment) {
                                progressFile.beforeNext();

                                var filePath = join(dir, item.c_path);
                                fs.readFile(filePath, (err, data) => {
                                    if(!err) {
                                        progressFile.next('получен');
                                        writeFile.toResponce(item.id, pth.basename(item.c_path), data);
                                        results.push(item);
                                    }
                                    next();
                                });
                            } else {
                                item.c_path = pth.basename(item.c_path);
                                results.push(item);
                                next();
                            }
                        } else {
                            progressFile.finish('Для пользователя ' + userId + ' было обработано ' + progressFile.getTotalCount() + ' файлов за ' + progressFile.getTime() + ' секунд.');
                            callback(result_layout.ok(results));
                        }
                    }
                    next();
                } else {
                    callback(result_layout.error(new Error(socketLog.error('Ошибка при выборке файлов. ' + args.meta.msg))));
                }
            });
        },
        AddOrUpdate: function (data, callback) {
            dbcontext.provider.exists('dbo', 'cd_attachments', 'id', data, null, function (result) {
                if (result.meta.success) {
                    if (result.result.records[0] == true) {
                        self.Update(data, callback);
                    } else {
                        self.Add(data, callback);
                    }
                } else {
                    callback(result_layout.error(new Error(result.meta.msg)));
                }
            });
        },
        Add: function (data, callback) {
            var items = Array.isArray(data) ? data.slice(0) : [data];
            var reader = socketUtils.fileReader(session);

            var results = [];

            var dt = Date.now();
            var totalCount = items.length;

            function next() {
                var item = items[0];
                if (item) {
                    items.shift();
                    var file = reader.getFileByKey(item.id);
                    if (file) {
                        item.n_size = file.buffer.byteLength;
                        item.c_extension = pth.extname(item.c_path);
                        item.c_mime = mime.lookup(item.c_extension);
                        item.c_path = join(util.getCatalogName(new Date(), true), item.c_path);

                        var filePath = join(dir, item.c_path);

                        var fileDir = pth.dirname(filePath);
                        if(!fs.existsSync(fileDir)) {
                            fx.mkdirSync(fileDir);
                        }

                        dbcontext.provider.insert('dbo', 'cd_attachments', item, function (args) {

                            // нужно отправлять только те файлы которые были обработаны.
                            if (!args.meta.success) {
                                var msg = "Ошибка сохранения записи в БД " + item.c_name + " " + args.meta.msg;
                                return callback(result_layout.error(new Error(msg)));
                            }

                            fs.writeFile(filePath, file.buffer, (err) => {
                                if(err) {
                                    var msg = "Ошибка сохранения файла " + item.c_path + " " + err.toString();
                                    return callback(result_layout.error(new Error(msg)));
                                } else {
                                    results.push(item);
                                    next();
                                }
                            });
                        });
                    } else {
                        dbcontext.provider.insert('dbo', 'cd_attachments', item, next);
                    }
                } else {
                    Console.debug('Добавлено ' + totalCount + ' файлов для пользователя ' + userId + ' за ' + ((Date.now() - dt) / 1000) + ' секунд.');
                    callback(result_layout.ok(results));
                }
            }

            next();
        },
        Update: function (data, callback) {
            dbcontext.provider.update('dbo', 'cd_attachments', 'id', data, null, function (results) {
                results.result.records = [];
                callback(results);
            });
        }
    };

    return self;
}