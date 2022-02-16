/**
 * @file routes/yoomoney.js
 * @project city-rpc-service
 * @author Александр
 * @todo Работа с платежами yoomoney https://github.com/olegpolyakov/yookassa
 */

var express = require("express");
var router = express.Router();
var Console = require('../modules/log');
var db = require('../modules/dbcontext');
var requestIp = require('request-ip');
var ip = require('ip');
var ip6addr = require('ip6addr');
const args = require('../modules/conf')();
var moment = require('moment');
var utils = require('../modules/utils');

module.exports = function () {

   /**
    * Вывод чека за оплату
    */
   router.get('/:paymentId', function(req, res) {
      var lang = req.query.lg || args.lang;
      var paymentId = req.params.paymentId;

      utils.locale(lang, (locale) => {
         db.provider.db().query(`select 
            p.id, p.n_sum, p.f_org, u.c_login, p.b_physical, p.c_bank, p.c_currency, p.d_payment_date, p.c_notice, p.c_payment_status 
         from blg.sd_payments as p 
         inner join core.pd_users as u on p.f_org = u.id
         where p.id = $1`, 
         [paymentId], function(err, rows) {
            if(err) {
               Console.error(`Ошибка получения чека для платежа ${paymentId}. ${err}`, 'pay');

               res.render('error', {
                  message: `Receipt bad. Payment ID = ${paymentId}`,
                  error: {
                     status: 404,
                     stack: args.debug ? err.toString() : ''
                  }
               });
            } else {
               var record = rows.rows[0];
               res.render('receipt', {
                  id: record.id,
                  paymentDate: moment(record.d_payment_date).format('DD.MM.YYYY hh:mm:ss'),
                  account: record.f_org,
                  sum: record.n_sum,
                  currency: record.c_currency,
                  user: record.c_login,
                  bank: record.c_bank,
                  notice: record.c_notice,
                  status: record.c_payment_status,
                  locale: locale
               });
            }
         });
      });
   });

   /**
    * Ответ от yoomoney по статусу платежа. Тут обновляется информации в БД, что платеж прошел успешно
    */
   router.post("/", function(req, res) {
      // тут нужно добавить с каких IP разрешены запросы https://yookassa.ru/developers/using-api/webhooks
      var ipv6 = [
         {
            ip: '2a02:5180:0:1509::',
            mask: 64
         },
         {
            ip: '2a02:5180:0:2655::',
            mask: 64
         },
         {
            ip: '2a02:5180:0:1533::',
            mask: 64
         },
         {
            ip: '2a02:5180:0:2669::',
            mask: 64
         }
      ];

      var ipv4 = [
         '185.71.76.0/27',
         '185.71.77.0/27',
         '77.75.153.0/25',
         '77.75.156.11',
         '77.75.156.35',
         '77.75.154.128/25'
      ];

      var clientIp = requestIp.getClientIp(req);

      var clientIpValid = false;
      try {
         // проверяем IP v4
         for(var i in ipv4) {
            if(ipv4[i].indexOf('/') > 0 && ip.cidrSubnet(ipv4[i]).contains(clientIp)) {
               clientIpValid = true;
               break;
            } else if(ipv4[i] == clientIp) {
               clientIpValid = true;
               break;
            }
         }

         if(clientIpValid == false) {
            // проверяем IP v6
            for(var i in ipv6) {
               var sub = ip6addr.createCIDR(ipv6[i].ip, ipv6[i].mask)
               if(sub.contains(clientIp)) {
                  clientIpValid = true;
                  break;
               }
            }
         }
      } catch(err) {
         Console.error(`Ошибка проверки IP ${clientIp}`, 'pay');
         res.status(500).send('FAILURE');
      }

      if(clientIpValid == false) {
         // тут меня нужно как-то уведомлять
         Console.error(`Уведомление о платеже направлено с невалидного IP адреса ${clientIp}`, 'pay');
         res.status(500).send('FAILURE');
      }

      var payment = req.body.object;
      if(payment && req.body.event == 'payment.succeeded') {
         Console.debug(`Уведомление для платежа ${payment.id} с IP ${clientIp}`, 'pay');
         
         db.provider.db().query('update blg.sd_payments set c_payment_status = $1, d_payment_date = $2, jb_data = $3, c_from_ip = $4 where c_transaction = $5 and f_org = $6', 
         [payment.status, payment.captured_at, payment, clientIp, payment.id, payment.description], function(err, rows) {
            if(err) {
               Console.error(`Платеж с идентификатором ${payment.id} не изменил статус на ${payment.status} из-за ошибки ${err.toString()}`, 'pay');
               res.status(500).send('FAILURE');
            } else {
               if(rows.rowCount == 1) {
                  Console.log(`Платеж ${payment.id} на сумму ${payment.amount.value} ${payment.amount.currency}`, 'pay');
                  res.send('SUCCESS');
               } else {
                  Console.error(`Платеж с идентификатором ${payment.id} не изменил статус на ${payment.status} из-за ошибки обновления.`, 'pay');
                  res.status(500).send('FAILURE');
               }
            }
         });
      } else {
         // тут меня нужно как-то уведомлять
         Console.error(`Вместо события payment.succeeded пришло ${req.body.event}`, 'pay');
         res.status(500).send('FAILURE');
      }
   });

   return router;
}
