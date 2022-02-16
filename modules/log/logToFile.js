/**
 * @file modules/log/logToFile.js
 * @project city-rpc-service
 * @author Александр Краснов
 * 
 * @todo информация храниться в файловой системе ~/log/*.log
 */

var log4js = require('log4js');
var join = require('path').join;
var args = require('../conf')();

/**
 * объект для логирования данных
 * @type {any}
 */
var logger = null;

if (!logger) {
    log4js.configure({
        appenders: {
            log: {
                type: 'file',
                filename: join(__dirname, '../', '../', 'log/log.log'),
                maxLogSize: 4 * 1024 * 1024,
                backups: 10,
                compress: true
            },
            pay: {
                type: 'file',
                filename: join(__dirname, '../', '../', 'log/pay.log'),
                maxLogSize: 4 * 1024 * 1024,
                backups: 10,
                compress: true
            },
            err: {
                type: 'file',
                filename: join(__dirname, '../', '../', 'log/err.log'),
                maxLogSize: 10 * 1024 * 1024,
                backups: 10,
                compress: true
            }
        },
        categories: {
            default: {
                appenders: ['log'],
                level: args.debug ? 'DEBUG' : 'ERROR'
            },
            pay: {
                appenders: ['pay'],
                level: args.debug ? 'DEBUG' : 'ERROR'
            },
            err: {
                appenders: ['err'],
                level: args.debug ? 'DEBUG' : 'ERROR'
            }
        }
    });

    logger = log4js;
}

/**
 * механизм логирования данных
 * подробнее см. https://www.npmjs.com/package/log4js
 * 
 * @param {any} options дополнительные опции
 * @returns {any}
 */
module.exports = logger;