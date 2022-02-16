/**
 * @file modules/custom-context/shell.js
 * @project city-rpc-service
 * @author Александр
 */

/**
 * объект для формирования ответа
 */
var result_layout = require('mobnius-pg-dbcontext/modules/result-layout');

var args = require('../conf')();
var db = require('../dbcontext');
var util = require('../rpc/util');
 
/**
 * Объект с набором RPC функций
 */
exports.shell = function (session) {
 
    return {
 
        /**
         * Получение серверного времени
         * @param {*} data 
         * @param {*} callback 
         * @example
         * [{ action: "shell", method: "getServerTime", data: [{ }], type: "rpc", tid: 0 }]
         */
        getServerTime: function (data, callback) {
            callback(result_layout.ok([{ date: new Date() }]));
        },

        /**
         * Получение настройки для мобильного приложения
         * @param {*} data 
         * @param {*} callback 
         * 
         * @example
         * [{ action: "shell", method: "getMobileSettings", data: [{ }], type: "rpc", tid: 0 }]
         */
        getMobileSettings: function(data, callback) {
            db.table('core', 'sd_settings', session).Query({ filter: [
                { "property": "c_key", "operator": "ilike", "value": "MOBILE_" }
            ]}, function(output) {
                var data = {}
                var records = output.result.records;
                if (output.meta.success) {
                    for(var i = 0; i < records.length; i++) {
                        var record = records[i];

                        switch(record.c_type) {// TEXT, INT, BOOL, DATE
                            case 'INT':
                                data[record.c_key] = parseInt(record.c_value)
                                break;

                            case 'BOOL':
                                data[record.c_key] = (record.c_value || 'true').toLowerCase() == 'true'
                                break;

                            case 'DATE':
                                data[record.c_key] = new Date(record.c_value || '')
                                break;

                            default:
                                data[record.c_key] = record.c_value;
                                break;
                        }
                    }
                    callback(result_layout.ok([data]));
                } else {
                    callback(result_layout.error([]));
                }
            });
        },

        /**
         * Проверка доступности логина
         * @param {string} data переданная строка
         * @param {*} callback 
         */
        login: function(data, callback) {
            db.provider.db().query(`select 
                u.id
            from core.pd_users as u
            where u.c_login = $1`, [data ? data.trim() : null ], function(err, rows) {
                if(err) {
                    callback(result_layout.error(err.message));
                } else {
                    callback(result_layout.ok(rows.rows.length == 1));
                }
            });
        },

        /**
         * Получение уровней для организации
         * @param {*} data 
         * @param {*} callback 
         */
        levels: function(data, callback) {
            var level = data.node == 'root' ? session.user.f_level : data.node;

            db.func('core', 'pf_levels', session).Select({ params: [level, util.getOrgId(session.user)], limit: args.limit_query }, function (output) {
                var items = [];
                for(var i = 0; i < output.result.records.length; i++) {
                    var item = output.result.records[i];
                    items.push({
                        text: item.c_text,
                        leaf: item.b_leaf,
                        id: item.id,
                        parent: item.f_parent,
                        qtip: item.c_description,
                        imp: item.c_imp_id,
                        org: item.f_org
                    });
                }

                delete output.result;

                callback(Object.assign({
                    expanded: true,
                    data: items
                }, output)); 
            });
        },

        /**
         * Статистика пользователя
         * @param {*} data 
         * @param {*} callback 
         */
        userstat: function(data, callback) {
            db.func('blg', 'sf_user_stat', session).Select({ params: [session.user.id] }, function (output) {
                callback(result_layout.ok(output.result.records));
            });
        },

        /**
         * Список пользователей привязанных к уровню
         * @param {*} data 
         * @param {*} callback 
         */
        users: function(data, callback) {
            db.func('core', 'sf_level_users', session).Select(Object.assign(data, { params: [session.user.f_level, util.getOrgId(session.user)] }), function (output) {
                callback(result_layout.ok(output.result.records));
            });
        },

        /**
         * Список услуг привязанных к пользователю
         * @param {*} data 
         * @param {*} callback 
         */
        services: function(data, callback) {
            db.func('blg', 'sf_services', session).Select(Object.assign(data, { params: [session.request.query.lg, session.user.id] }), function (output) {
                callback(result_layout.ok(output.result.records));
            });
        },

        /**
         * Количественные показатели для выставления счетов
         * @param {*} data 
         * @param {*} callback 
         */
        currentinvoices: function(data, callback) {
            db.func('blg', 'sf_current_invoices', session).Select(Object.assign(data, { params: [session.request.query.lg, session.user.id] }), function (output) {
                callback(result_layout.ok(output.result.records));
            });
        },

        /**
         * Детализация счета
         * @param {*} data 
         * @param {*} callback 
         */
        invoicedetails: function(data, callback) {
            var lang = session.request.query.lg || args.lang;

            db.provider.db().query(`select 
            s.c_name#>>'{${lang}}' as f_service___c_name,
            t.c_name#>>'{${lang}}' as f_tariff___c_name,
            sid.n_period,
            sid.n_sum,
            sid.d_date_modify
            from blg.sd_invoice_details as sid 
            left join blg.cd_services as s ON s.id = sid.f_service 
            left join blg.sd_tariffs as t ON t.id = sid.f_tariff 
            WHERE sid.f_org = ${util.getOrgId(session.user)} and sid.n_period >= sid.n_period - interval '1 year'
            ORDER BY sid.n_period DESC, s.c_name ASC`, [], function(err, rows) {
                if(err) {
                    callback(result_layout.error(err.message));
                } else {
                    callback(result_layout.ok(rows.rows));
                }
            });
        },

        /**
         * Баланс на счету
         * @param {*} data 
         * @param {*} callback 
         */
        yourbalance: function(data, callback) {
            db.func('blg', 'sf_your_balance', session).Query({ params: [session.user.id] }, function (output) {
                callback(output);
            });
        },

        /**
         * Баланс на счету
         * @param {*} data 
         * @param {*} callback 
         */
        lastpay: function(data, callback) {
            db.func('blg', 'sf_last_pay', session).Query({ params: [session.user.id] }, function (output) {
                callback(output);
            });
        },

        /**
         * Список последних транзакций
         * @param {*} data 
         * @param {*} callback 
         */
        lasttransaction: function(data, callback) {
            db.func('blg', 'sf_last_transaction', session).Query({ params: [session.user.id] }, function (output) {
                callback(output);
            });
        },

        /**
         * Активация услуги
         * @param {*} data 
         * @param {*} callback 
         */
        activateservice: function(data, callback) {
            db.func('blg', 'sf_activate_service', session).Query({ params: [data.id, util.getOrgId(session.user)] }, function (output) {
                callback(output);
            });
        },

        /**
         * Деактивация услуги
         * @param {*} data 
         * @param {*} callback 
         */
        deactivateservice: function(data, callback) {
            db.func('blg', 'sf_deactivate_service', session).Query({ params: [data.id, util.getOrgId(session.user)] }, function (output) {
                callback(output);
            });
        },

        /**
         * Стоимость всех услуг
         * @param {*} data 
         * @param {*} callback 
         */
        serviceprices: function(data, callback) {
            db.func('blg', 'sf_service_prices', session).Query({ params: [session.request.query.lg, util.getOrgId(session.user), data.b_base] }, function (output) {
                callback(output);
            });
        },

        /**
         * Стоимость одной определенной услуги
         * @param {*} data 
         * @param {*} callback 
         */
        serviceprice: function(data, callback) {
            db.func('blg', 'sf_service_prices', session).Select({ params: [session.request.query.lg, util.getOrgId(session.user), null], filter: [{ property: 'f_service', value: data.id }] }, function (output) {
                callback(output);
            });
        },

        /**
         * пополнение счета через кредит
         * @param {*} data 
         * @param {*} callback 
         */
        activatecredit: function(data, callback) {
            db.func('blg', 'sf_activate_credit', session).Query({ params: [util.getOrgId(session.user), data.id] }, function (output) {
                callback(output);
            });
        }
    }
}