/**
 * @file bin/run.js
 * @project city-rpc-service
 * @author Александр Краснов
 */

const Console = require('../modules/log');
const argv = require("args-parser")(process.argv);
const args = require('../modules/conf')();

const file = require('../modules/file');
const fs = require('fs');
const join = require('path').join;
var storage = require('../modules/utils').storage();

const db = require('mobnius-pg-dbcontext/modules/connection-db');
db.init(args.connection_string);

/**
 * Выполнение команд
 * @example
 * 
 * node conf=./portal.conf cmd=rm-users - удаление файлов пользователей
 * node conf=./portal.conf cmd=rm-expired-file - удаление старых файлов
 */
function run() {
    return new Promise(resolve => {
        switch(argv.cmd) {
            // node cmd=rm-users
            case 'rm-users':
                console.log(`${new Date().toISOString()}: Запуск удаление файлов пользователя.`);

                db.query('select * from core.pd_users where sn_delete = true', [], (err, res, time, e) => {
                    var rows = res.rows;

                    function next() {
                        var row = rows[0];
                        if(row) {
                            rows.shift();

                            var orgID = row.f_org;
                            var userID = row.id;
    
                            var path = orgID == userID ? orgID.toString() : join(orgID, userID);
                            var filePath = join(storage, path);
                            if(fs.existsSync(filePath)) {
                                fs.rmdir(filePath, { recursive: true }, (err) => {
                                    if(err) {
                                        console.error(`${err}`);
                                    } else {
                                        console.log(`${new Date().toISOString()}: Удаление файлов пользователя ${orgID} завершено.`);
                                    }
    
                                    next();
                                });
                            } else {
                                console.error(`Путь ${filePath} не найден.`);
                                next();
                            }
                        } else {
                            console.log(`${new Date().toISOString()}: Удаление файлов пользователей завершено.`);
                            resolve('SUCCESS');
                        }
                    }
                    
                    next();
                });
                break;

            // node cmd=rm-expired-file
            case 'rm-expired-file':
                console.log(`${new Date().toISOString()}: Запуск удаление старых файлов.`);

                db.query('select * from dbo.sf_expired_storages()', null, (err, res, time, e) => {
                    var rows = res.rows;

                    function next(callback) {
                        var row = rows[0];
                        if(row) {
                            rows.shift();

                            for(var i in rows) {
                                file.removeFile(row.c_dir, row.c_name, next);
                            }
                        } else {
                            callback();
                        }
                    }

                    next(() => {
                        console.log(`${new Date().toISOString()}: Удаление старых файлов завершено.`);
                        resolve('SUCCESS');
                    });
                });
                break;

            default:
                Console.error(`Команда ${argv.cmd} не найдена или неизвестна.`, 'err');
                break;
        }
    });
}

(async () => {
    const status = await run();
    console.log(status);
})()