/**
 * Обработка базы данных для инициализации подключения
 * @file bin/init.js
 * @project city-rpc-service
 * @author Aleksandr Krasnov
 */

 var join = require('path').join;

 var args = require('../modules/conf')();
 var reader = require('mobnius-schema-reader/index.v3');
 const Console = require('../modules/log');
 var moment = require('moment');
 
 /**
  * Генерация схемы для NodeJS.
  * Вызов данного метода может происходит и при помощи ~/update/schema
  * @param {boolean} readOnly true - чтение из ранее созданного каталога
  * @param {function} callback 
  */
 module.exports = function (readOnly, callback) {
     reader({
         connectionString: args.connection_string,
         autoRemove: true,
         schemaList: ["'public'", "'pg_catalog'", "'information_schema'"],
         schemaReference: join(__dirname, '../', 'schema.reference'),
         output: join(__dirname, '../', 'schema', args.port.toString()),
         readOnly: readOnly
     }, function (schemas) {
        Date.prototype.toJSON = function () { 
            return moment.utc(new Date()).format(); 
        }
        global.schemas = schemas;
        global.schemas.map = {};
        global.schemas.jrnl = {};
        global.schemas.org = {};

        for(var t in schemas.tables) {
            var table = schemas.tables[t];
            if(!global.schemas.map[table.TABLE_SCHEMA]) {
                global.schemas.map[table.TABLE_SCHEMA] = {};
            }

            global.schemas.map[table.TABLE_SCHEMA][table.TABLE_NAME] = table;
        }
        if(readOnly == false) {
            Console.debug('генерация завершена.');
        }
        if (typeof callback == 'function')
            callback();
     });
 }