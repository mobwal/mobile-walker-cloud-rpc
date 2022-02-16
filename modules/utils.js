/**
 * @file modules/utils.js
 * @project city-rpc-service
 * @author Александр Краснов
 */

var args = require('./conf')();
var db = require('./dbcontext');
const process = require('process');
const nodemailer = require('nodemailer');
var fs = require('fs');
var join = require('path').join;

const DEFAULT_LANG = 'en';

function getLangFolder(lang) {
    return lang.substr(0, 2);
}

/**
 * Файловое хранилище
 * @returns 
 */
exports.storage = function() {
    if(args.storage.indexOf('./') == 0) {
        return join(__dirname, '../', args.storage);
    } else {
        return args.storage;
    }
}

exports.getLangFolder = getLangFolder;

/**
 * Отправка почтового сообщения
 * @param {string} subject тема письма
 * @param {string} to список адресов электронной почты через запятую
 * @param {string} body текст письма
 * @param {function} callback результат отправки
 */
exports.sendMail = function(subject, to, body, callback) {
    let transporter = nodemailer.createTransport({
        auth: {
            user: args.mail_auth_user,
            pass: args.mail_auth_pwd
        },
        host: args.mail_host,
        port: args.mail_port,
        secure: args.mail_secure
    });
    transporter.sendMail({
        from: args.mail_auth_user,
        to: to,
        subject: subject,
        html: body
    }, callback);
}

/**
 * Получение текущего хоста
 * @returns {string}
 */
exports.getCurrentHost = function() {
    return 'process:' + process.pid;
}

/**
 * заголовок для авторизации
 * @returns строка
 */
exports.getAuthorizationHeader = function() {
    return "rpc-authorization";
}

/**
 * Чтение информации из контента. Не производительная функция с точки зрения асинхронности.
 * @param {string} lang язык
 * @param {string} name имя файла
 */
 exports.content = function (lang, name) {
    var mainLang = DEFAULT_LANG;
    var filePath = join(__dirname, '../', 'content', getLangFolder(lang), name + '.html');
    if (!fs.existsSync(filePath)) {
        filePath = join(__dirname, '../', 'content', DEFAULT_LANG, name + '.html');
    } else {
        mainLang = lang;
    }

    if (!fs.existsSync(filePath)) {
        return 'Not Found';
    }
    var str = fs.readFileSync(filePath).toString();
    str = str.replace(/<%=lang%>/gm, mainLang);
    return str.replace(/<%-\s*/gm, '').replace(/\s*%>/gm, '');
}

/**
 * чтение локали для отображения
 * @param {string} lang язык
 * @param {function} callback 
 */
exports.locale = function (lang, callback) {
    var filePath = join(__dirname, '../', 'content', getLangFolder(lang) + '.local.txt');
    if (!fs.existsSync(filePath)) {
        filePath = join(__dirname, '../', 'content', DEFAULT_LANG + '.local.txt');
    }

    readIgnore(join(__dirname, '../', 'translate.ignore'), (ignore) => {
        fs.readFile(filePath, (err, data) => {
            if (err) {
                console.error(err);
            }

            var array = data.toString().split('\n');
            var locale = {};
            if (array.length == 0) {
                callback(locale);
            } else {
                for (var i in array) {
                    var item = array[i];
                    if (item.trim() == '') {
                        continue;
                    }
                    var items = /\"([\s|\S]*)\"\s*=\s*\"([\s|\S]*)\"/gi.exec(item);
                    if (items.length == 3) {
                        const key = items[1];
                        const value = items[2];

                        if (ignore[lang] && ignore[lang][key] != undefined) {
                            locale[key] = ignore[lang][key];
                        } else {
                            locale[key] = value;
                        }
                    }
                }
                callback(locale);
            }
        });
    });
}

/**
 * чтение файла со стоп-листом для перевода
 * @param {string} file путь к файлу
 * @param {function} callback 
 */
function readIgnore(file, callback) {
    var result = {};
    if (fs.existsSync(file)) {
        fs.readFile(file, (err, data) => {

            if (err) {
                console.error(err);
            }

            var str = data.toString();
            var data = str.split('\n');
            for (var i in data) {
                var item = data[i];
                var array = item.split(' = ');
                if (array.length == 3) {
                    if (result[array[0]] == undefined) {
                        result[array[0]] = {};
                    }

                    result[array[0]][array[1]] = array[2];
                }
            }

            callback(result);
        });
    } else {
        callback(result);
    }
}