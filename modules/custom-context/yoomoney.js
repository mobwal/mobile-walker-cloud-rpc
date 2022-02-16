/**
 * @file modules/custom-context/yoomoney.js
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
var Console = require('../log');
const YooKassa = require('yookassa');
var uuid = require('uuid');

const yooKassa = new YooKassa({
    shopId: args.yookassa_shop_id,
    secretKey: args.yookassa_secret
 });

/**
 * Объект с набором RPC функций
 */
exports.yoomoney = function (session) {

    return {

        /**
         * Создание черновика платежа
         * @param {*} data 
         * @param {*} callback 
         * @example
         * [{ action: "yoomoney", method: "prepay", data: [{ money: 1 }], type: "rpc", tid: 0 }]
         */
        prepay: function (data, callback) {
            var amount = parseFloat(data.money);
            var orgID = util.getOrgId(session.user);
      
            if(amount >= args.minimal_amount) {
                var id = uuid.v4();
                yooKassa.createPayment({
                    amount: {
                        value: amount,
                        currency: data.currency || 'RUB'
                    },
                    capture: true,
                    payment_method_data: {
                        type: "bank_card"
                    },
                    confirmation: {
                        type: "redirect",
                        // тут нужно подумать на какой адрес перенаправлять
                        return_url: `${args.site}${args.virtual_dir_path}redirect?token=${session.request.headers['rpc-authorization'].replace('Token ', '')}&page=/${session.request.query.lg}/&hash=pay`
                    },
                    description: orgID.toString()
                }).then(function(payment) { 
                    // сохранить платеж в системе
                    db.provider.db().query(`select blg.sf_create_payment($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, 
                    [id, amount, orgID, true, payment, payment.id, 'YOOMONEY', payment.amount.currency, payment.created_at, payment.status], 
                    function(err, rows) { 
                        if(err) {
                            Console.error(`${err}`, 'pay');

                            var error = args.debug == true ? err : 'Payment creation error';
                            callback(result_layout.error(new Error(error)));
                        } else {
                            callback(result_layout.ok([payment.confirmation.confirmation_url]));
                        }
                    });
                }).catch(function(err) {
                    Console.error(`${err.toString()}`, 'pay');
                    callback(result_layout.error(err));
                });
            } else {
                // ошибка в сумме платежа
                var error = args.debug == true ? `Минимальная сумма платежа должна быть ${args.minimal_amount}` : 'Minimum amount error';
                callback(result_layout.error(new Error(error)));
            }
        }
    }
}