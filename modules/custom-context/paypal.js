/**
 * объект для формирования ответа
 */
 var result_layout = require('mobnius-pg-dbcontext/modules/result-layout');

 var args = require('../conf')();
 var db = require('../dbcontext');
 var util = require('../rpc/util');
 var Console = require('../log');
 const paypal = require('@paypal/checkout-server-sdk');
 var uuid = require('uuid');

/**
 * Объект с набором RPC функций
 */
exports.paypal = function (session) {
    return {
        /**
         * Создание черновика платежа
         * @param {*} data 
         * @param {*} callback 
         * @example
         * [{ action: "paypal", method: "prepay", data: [{ money: 1 }], type: "rpc", tid: 0 }]
         */
         prepay: function (data, callback) {
            var amount = parseFloat(data.money);
            var orgID = util.getOrgId(session.user);
      
            if(amount >= args.minimal_amount) {
                var id = uuid.v4();

                let environment = new paypal.core[args.paypal_mode](args.paypal_client_id, args.paypal_client_secret);
                let client = new paypal.core.PayPalHttpClient(environment);
            
                let request = new paypal.orders.OrdersCreateRequest();
                request.prefer("return=representation");
                var url = `${args.site}${args.virtual_dir_path}redirect?token=${session.request.headers['rpc-authorization'].replace('Token ', '')}&page=/${session.request.query.lg}/&hash=pay`;
                request.requestBody({
                    "intent": "CAPTURE",
                    "application_context": {
                        "return_url": url
                    },
                    "purchase_units": [
                        {
                            "amount": {
                                "currency_code": data.currency || 'USD',
                                "value": amount
                            },
                            "description": orgID.toString()
                        }
                     ]
                });
            
                client.execute(request).then(function(payment) { 
                    // сохранить платеж в системе
                    db.provider.db().query(`select blg.sf_create_payment($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, 
                    [id, amount, orgID, true, payment, payment.result.id, 'PAYPAL', data.currency || 'USD', payment.result.create_time, 'pending'], 
                    function(err, rows) { 
                        if(err) {
                            Console.error(`${err}`, 'pay');

                            var error = args.debug == true ? err : 'Payment creation error';
                            callback(result_layout.error(new Error(error)));
                        } else {
                            var links = payment.result.links;
                            var approve = null;
                            for(var i = 0; i < links.length; i++) {
                                if(links[i].rel == 'approve') {
                                    approve = links[i];
                                    break;
                                }
                            }
                            if(approve) {
                                callback(result_layout.ok([approve.href]));
                            } else {
                                Console.error(`Переход на подтверждение оплаты не указан`, 'pay');
                                callback(result_layout.error(new Error('payment no approve')));
                            }
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