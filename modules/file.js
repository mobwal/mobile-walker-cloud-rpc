var fs = require('fs');
var pth = require('path');
var join = pth.join;
const args = require('./conf')();
var util = require('./rpc/util');
var storage = require('./utils').storage();

/**
 * Удаление файла
 * @param {string} c_dir директория
 * @param {string} c_name имя файла
 * @param {*} callback 
 * 
 * @todo Исключения;
 * bad path - не корректный путь в файловой системе;
 * remove file error - ошибка удаления файла из файловой системы
 */
exports.removeFile = function(c_dir, c_name, callback) {
    var file = join(storage, c_dir, c_name);

    if(file.indexOf(storage) == 0 && fs.existsSync(file)) {
        fs.unlink(file, (err) => {
            if(err) {
                Console.error(`${file} - ${err.toString()}`, 'err');

                callback('remove file error');
            } else {
                callback(null, join(c_dir, c_name));
            }
        });
    } else {
        Console.debug(`Удаление файла: ошибка пути ${file}`);

        callback('bad path');
    }
}

/**
 * удаление файлов у пользователя
 * @param {integer} orgID идентификатор организации
 * @param {integer} userID идентификатор пользователя
 * @param {*} callback 
 * 
 * @todo Исключения;
 * catalog not found - каталог не найден;
 * catalog not exists - каталог не дотупен;
 * remove file error - ошибка удаления файла из файловой системы
 */
exports.removeUser = function(orgID, userID, callback) {
    var path = orgID == userID ? orgID.toString() : join(orgID, userID);
    
    var filePath = join(storage, path);
    if(filePath.indexOf(storage) == 0) {
        if(fs.existsSync(filePath)) {
            fs.rmdir(filePath, { recursive: true }, (err) => {
                if(err) {
                    Console.error(`${file} - ${err.toString()}`, 'err');

                    callback('remove file error');
                } else {
                    callback(null, userID);
                }
            });
        } else {
            Console.debug(`Удаление каталога: каталог не доступен.`);

            callback('catalog not exists');
        }
    } else {
        Console.debug(`Удаление каталога: каталог не найден.`);

        callback('catalog not found');
    }
}