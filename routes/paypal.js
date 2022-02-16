/**
 * @file router/paypal.js
 * @project cluster-rpc-service
 * @author Александр
 * @todo Работа с платежами PayPal
 */

var express = require("express");
var router = express.Router();
const args = require('../modules/conf')();
var Console = require('../modules/log');
var db = require('../modules/dbcontext');

module.exports = function () {
    /**
     * Ответ от PayPal по платежу
     */
    router.post("/notification", notification);

    return router;
} 

function notification(req, res) {
    if(req.body) {
        body = req.body;

        if(body.event_type != 'CHECKOUT.ORDER.APPROVED') {
            Console.error(`PAYPAL: Тип платежа ${body.event_type} не равен CHECKOUT.ORDER.APPROVED. ${JSON.stringify(body)}`, 'pay');
            return res.send('SUCCESS');
        }

        if(body.resource.purchase_units.length > 0) {
            var payment = body.resource.purchase_units[0];
            var subscr = payment.description;
            if(subscr) {
                db.provider.db().query('update blg.sd_payments set c_payment_status = $1, d_payment_date = $2, jb_data = $3, c_from_ip = $4 where c_transaction = $5 and f_org = $6', 
                ['succeeded', body.resource.create_time, body, '', body.resource.id, subscr], function(err, rows) {
                    if(err) {
                        Console.error(`PAYPAL: Платеж с идентификатором ${body.resource.id} не изменил статус на ${body.resource.status} из-за ошибки ${err.toString()}`, 'pay');
                        res.status(500).send('FAILURE');
                    } else {
                        if(rows.rowCount == 1) {
                            Console.log(`PAYPAL: Платеж ${body.resource.id} на сумму ${payment.amount.value} ${payment.amount.currency_code}`, 'pay');
                            res.send('SUCCESS');
                        } else {
                            Console.error(`PAYPAL: Платеж с идентификатором ${body.resource.id} не изменил статус на ${body.resource.status} из-за ошибки обновления.`, 'pay');
                            res.status(500).send('FAILURE');
                        }
                    }
                });
            } else {
                Console.error('PAYPAL: лицевой счет не найден.', 'pay');
                res.status(500).send('FAILURE');
            }
        } else {
            Console.error('PAYPAL: В платеже не найдена информация о позициях.', 'pay');
            res.status(500).send('FAILURE');
        }
    } else {
        Console.error('PAYPAL: Тело платежа не найдено', 'pay');
        res.status(500).send('FAILURE');
    }
}