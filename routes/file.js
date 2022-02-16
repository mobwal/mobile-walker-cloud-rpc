/**
 * @file routes/file.js
 * @project city-rpc-service
 * @author Александр
 * @todo операции для работы с файловой системой
 */

var express = require("express");
var router = express.Router();
var db = require('../modules/dbcontext');
var result_layout = require('mobnius-pg-dbcontext/modules/result-layout');
var Console = require('../modules/log');
const args = require('../modules/conf')();

var authUtil = require('../modules/authorize/util');

var fs = require('fs');
var pth = require('path');
var join = pth.join;
var util = require('../modules/rpc/util');
var fx = require('mkdir-recursive');
var uuid = require('uuid');

var file = require('../modules/file');
var storage = require('../modules/utils').storage();

module.exports = function (auth_type) {
    var authType = authUtil.getAuthModule(auth_type);
    router.use('/private', authType.user());

    router.get('/:id', getStorageItem);
    router.post('/private', uploadFile);
    router.post('/private/:id', remove);
    // удаление файлов из хранилища
    router.get('/private/user', removeUser);
    // удаление строк из БД
    router.get('/private/rows', removeRows);

    return router;
}

/**
 * Удаление всех строк из базы данных 
 * @example
 * GET ~/private/rows
 * 
 * Headers
 * rpc-authorization: Token
 * Content-Type: application/json
 * 
 * @todo Исключения;
 * bad select query - ошибка запроса select в БД
 */
 function removeRows(req, res) {
    db.provider.db().query('select core.sf_clear_data($1);', [res.user.id], function(err, row) {
        if(err) {
            Console.debug(`Удаление строк из БД. Select запрос: ${err.toString()}`);

            res.json(result_layout.error(['bad select query']));
        } else {
            res.json(result_layout.ok([res.user.id]));
        }
    });
}

/**
 * Удаление файла из хранилища
 * @example
 * GET ~/private/user
 * 
 * Headers
 * rpc-authorization: Token
 * Content-Type: application/json
 * 
 * @todo Исключения;
 * bad select query - ошибка запроса select в БД;
 * catalog not found - каталог не найден;
 * catalog not exists - каталог не дотупен;
 * remove file error - ошибка удаления файла из файловой системы
 */
 function removeUser(req, res) {
    var orgID = util.getOrgId(res.user);
    var path = orgID == res.user.id ? orgID.toString() : join(orgID, res.user.id);

    var filePath = join(storage, path);
    if(filePath.indexOf(storage) == 0) {
        if(fs.existsSync(filePath)) {
            db.provider.db().query('delete from dbo.sd_storages where ' + (orgID == res.user.id ? 'f_org' : 'f_user') + ' = $1;', [res.user.id], function(err, row) {
                if(err) {
                    Console.debug(`Удаление каталога. Select запрос: ${err.toString()}`);
    
                    res.json(result_layout.error(['bad select query']));
                } else {
                    file.removeUser(orgID, res.user.id, (errStr, userID) => {
                        if(err) {
                            Console.error(`${errStr}`, 'err');

                            res.json(result_layout.error([errStr]));
                        } else {
                            res.json(result_layout.ok([userID]));
                        }
                    });
                }
            });
        } else {
            Console.debug(`Удаление каталога: каталог не доступен.`);

            res.json(result_layout.error(['catalog not exists']));
        }
    } else {
        Console.debug(`Удаление каталога: каталог не найден.`);

        res.json(result_layout.error(['catalog not found']));
    }
}

/**
 * Удаление файла из хранилища
 * @example
 * POST ~/private/:id
 * 
 * Headers
 * rpc-authorization: Token
 * Content-Type: application/json
 * 
 * @todo Исключения;
 * id not found - идентификатор не указан;
 * select empty - записи в БД не найдено;
 * bad select query - ошибка запроса select в БД;
 * bad delete query - ошибка запроса delete в БД;
 * bad path - не корректный путь в файловой системе;
 * remove file error - ошибка удаления файла из файловой системы
 */
function remove(req, res) {
    var id = req.params.id;
    if(id) {
        var orgID = util.getOrgId(res.user);
        db.provider.db().query('select c_dir, c_name from dbo.sd_storages where ' + (orgID == res.user.id ? 'f_org' : 'f_user') + '=$1 and id = $2;', [orgID, id], function(err, row) {
            if(err) {
                Console.debug(`Удаление файла. Select запрос: ${err.toString()}`);

                res.json(result_layout.error(['bad select query']));
            } else {
                var item = row.rows[0];

                if(!item) {
                    Console.debug(`Удаление файла. Записи с идентификатором ${id} не найдено.`);

                    return res.json(result_layout.error(['select empty']));
                }

                db.table('dbo', 'sd_storages', {}).Delete({ id: id }, function(output) {
                    if(output.meta.success && output.result.records.rowCount == 1) {

                        file.removeFile(item.c_dir, item.c_name, (errStr) => {
                            if(errStr) {
                                Console.error(`${errStr}`, 'err');

                                res.json(result_layout.error(['remove file error']));
                            } else {
                                res.json(result_layout.ok([id]));
                            }
                        });
                    } else {
                        Console.debug(`Удаление файла. Delete запрос: ${output.meta.msg}`);

                        res.json(result_layout.error(['bad delete query']));
                    }
                });
            }
        });
    } else {
        Console.debug(`Удаление файла: идентификатор не указан.`);

        res.json(result_layout.error(['id not found']));
    }
}

/**
 * Получение файла из хранилища по идентификатору
 * @example
 * GET ~/file/:id
 * 
 * @todo Исключения;
 * id not found - идентификатор не указан;
 * bad query - ошибка запроса в БД;
 * file not found - файл не найден;
 */
function getStorageItem(req, res) {
    var id = req.params.id;
    if(id) {
        db.provider.db().query('select c_dir, c_name from dbo.sd_storages where id = $1;', [id], function(err, row) {
            if(err) {
                Console.error(`Получение файла: ${err.toString()}.`, 'err');

                res.json(result_layout.error(['bad query']));
            } else {
                if(row) {
                    var record = row.rows[0];
                    
                    var file = join(storage, record.c_dir, record.c_name);
                    if(file.indexOf(storage) == 0 && fs.existsSync(file)) {
                        return res.sendFile(file);
                    } 
                } else {
                    res.json(result_layout.error(['file not found']));
                }
            }
        });
    } else {
        Console.debug(`Получение файла: идентификатор не указан.`);

        res.json(result_layout.error(['id not found']));
    }
}

/**
 * Загрузка файла
 * @example
 * POST ~/file/private
 * 
 * Headers
 * rpc-authorization: Token
 * Content-Type: application/json
 * 
 * Body form-data
 * {
 *      file: bytes - вложенный файл
 *      path: string - путь для хранения, например /temp/readme.md. По умолчанию будет установлено имя вложенного файла
 *      d_date_expired: date - дата после которой требуется удалить файл, по умолчанию 2099-12-31
 * }
 * 
 * @todo Исключения;
 * file not found - файл не найден;
 * bad path - указан неверный путь;
 * file or path not found - файл или путь для хранения не указаны;
 * error write file - ошибка записи файла в файловую систему;
 * error save db - ошибка сохранения информации в базе данных;
 */
function uploadFile(req, res) {
    if(!req.files) {
        Console.debug(`Загрузка данных: файл не найден.`);
        return res.json(result_layout.error(['file not found']));
    }

    var file = req.files.file;
    var orgID = util.getOrgId(res.user);
    var path = orgID == res.user.id ? join(orgID, req.body.path || file.name) : join(orgID, res.user.id, req.body.path || file.name);

    if(file && path) {
        var filePath = join(storage, path);
        if(filePath.indexOf(storage) == 0) {
            var dirName = pth.dirname(filePath);

            if(!fs.existsSync(dirName)) {
                // если каталога нет, то он будет создан автоматически
                fx.mkdirSync(dirName);
            }

            fs.writeFile(filePath, file.data, (err) => {
                if(err) {
                    Console.error(`Загрузка данных: ${err.toString()}`, 'err');

                    fs.unlinkSync(filePath);
                    return res.json(result_layout.error(['error write file']));
                } else {
                    var id = uuid.v4();
                    // файл записали
                    var d_date_expired = null;
                    var d_max_date = '2099-12-31';
                    try {
                        d_date_expired = new Date(req.body.d_date_expired || d_max_date);
                        if(d_date_expired.getTime() > new Date(d_max_date).getTime()) {
                            d_date_expired = d_max_date;
                        } else {
                            d_date_expired = req.body.d_date_expired || d_max_date;
                        }
                    } catch (e) {
                        d_date_expired = d_max_date;
                    }

                    db.table('dbo', 'sd_storages', {}).Add({ 
                        id: id,
                        c_name: file.name,
                        c_dir: dirName.replace(storage, ''),
                        n_length: file.size,
                        d_date: new Date(),
                        f_org: orgID,
                        f_user: res.user.id,
                        c_mime: file.mimetype,
                        d_date_expired: d_date_expired
                    }, function(output) {
                        if(!output.meta.success) {
                            Console.error(`Загрузка данных: задан не корректный путь для хранения ${path}`, 'err');
                            fs.unlinkSync(filePath);

                            res.json(result_layout.error(['error save db']));
                        } else {
                            res.json(result_layout.ok([id]));
                        }
                    });
                }
            });
        } else {
            Console.debug(`Загрузка данных: задан не корректный путь для хранения ${path}`);
            res.json(result_layout.error(['bad path']));
        }
    } else {
        Console.debug(`Загрузка данных: файл или путь не указаны`);
        res.json(result_layout.error(['file or path not found']));
    }
}