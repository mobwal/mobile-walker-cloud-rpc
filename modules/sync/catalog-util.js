
var fs = require('fs');
var rimraf = require("rimraf");
var join = require('path').join;
var fx = require('mkdir-recursive');

/**
 * создается имя каталога на основе указанной даты
 * @param {Date} dt входная дата
 * @returns {number} имя каталога
 */
function getCatalogName(dt, concat) {
    if (concat == undefined) {
        concat = false
    }
    var year = dt.getFullYear().toString();
    var month = (dt.getMonth() + 1).toString().length == 1 ? '0' + (dt.getMonth() + 1) : (dt.getMonth() + 1);
    var day = dt.getDate().toString().length == 1 ? '0' + dt.getDate() : dt.getDate();

    return concat ? parseInt(year + month + day).toString() : join(year, month.toString(), day.toString());
}

exports.getCatalogName = getCatalogName

/**
 * возвращаются директории по убыванию
 * @param {string} path каталог для просмотра
 * @param {function} callback функция обратного вызова
 */
function getDirNums(path, callback) {
    fs.readdir(path, function (err, dirs) {
        if (!err) {
            dirs = dirs.sort(function (a, b) {
                return parseInt(b) - parseInt(a);
            });
        }
        callback(err, dirs);
    });
}

exports.getDirNums = getDirNums;

/**
 * удаление "просроченных" каталогов, которые старше n - дней
 * @param {string} path путь к каталогу
 * @param {number} days количество дней
 * @param {function} callback функция обратного вызова
 */
exports.removeLastDirs = function (path, days, callback) {
    callback = callback == undefined ? function () { } : callback;

    getDirNums(path, function (err, dirs) {
        if (!err) {
            if (dirs.length == 0) {
                return callback(0);
            }
            var dates = [];
            dirs.forEach(function (dir) {
                dates.push(convertNumToDate(dir));
            });
            var maxDate = dates[0];
            var minDate = new Date(maxDate.getTime() - (days * 24 * 60 * 60 * 1000));

            var removable = dates.filter(function (i) {
                return i <= minDate;
            });

            var count = removable.length;

            function next() {
                var item = removable[0];
                if (item) {
                    removable.shift();

                    var dir = join(path, getCatalogName(item));
                    rimraf(dir, function (err) {
                        if (err) {
                            console.log(err);
                        }
                        next();
                    });
                } else {
                    callback(count);
                }
            }
            if (removable.length > 0) {
                next();
            } else {
                callback(0);
            }

        } else {
            console.log(err);
        }
    });
}

/**
 * преобразование номера в дату
 * @param {number} num номер каталога
 * @returns {Date} возвращается дата по номеру каталога
 */
function convertNumToDate(num) {
    var numStr = num.toString();
    var year = parseInt(numStr.substr(0, 4));
    var month = parseInt(numStr.substr(4, 2)) - 1;
    var day = parseInt(numStr.substr(6, 2));
    return new Date(year, month, day);
}

exports.convertNumToDate = convertNumToDate;

/**
 * запись информации в файл при загрузки на сервер
 * @param {string} dir директория
 * @param {string} tid идентификатор транзакции
 * @param {number} position позиция записи
 * @param {any[]} bytes массив байтов
 * @param {function} callback функция обратного вызова
 */
exports.upload = function (dir, tid, position, bytes, callback) {
    if (position == 0) {
        // нужно проверить наличие папки
        var exists = fs.existsSync(dir);
        if (!exists) {
            fx.mkdirSync(dir);
        }
    }

    var filePath = join(dir, tid + '.bkp');
    var fileObject = null;
    if (fs.existsSync(filePath) == false) {
        fileObject = fs.openSync(filePath, 'w');
    } else {
        fileObject = fs.openSync(filePath, 'r+');
    }
    try {
        fs.write(fileObject, bytes, 0, bytes.length, position, function (err) {
            fs.close(fileObject, function () {
                callback(err);
            });
        });
    } catch (exc) {
        callback(exc);
    }
}

/**
 * загрузка данных
 * @param {string} dir директория
 * @param {string} tid индентификатор транзакции
 * @param {number} position позиция
 * @param {number} chunk размер блока
 * @param {function} callback функция обратного вызова
 */
exports.download = function (dir, tid, position, chunk, callback) {
    var file = join(dir, tid + '.pkg');
    if (fs.existsSync(file)) {
        fs.readFile(file, function (err, buffer) {
            if (err) {
                callback(err);
            } else {
                var end = position + chunk;
                if (end > buffer.length) {
                    end = buffer.length;
                }
                callback(null, buffer.slice(position, end), buffer.length);
            }
        });
    } else {
        callback(new Error('файл ' + tid + '.pkg' + ' не найден.'));
    }
}