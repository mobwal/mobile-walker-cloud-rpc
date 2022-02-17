var packager = require('mobnius-packager/index-v2');
var layout_result = require('mobnius-pg-dbcontext/modules/result-layout');

/**
 * Тестирование синхронизации. Выполнение происходит только при тестировании механизма синхрнизации на телефоне. Версия протокола v0
 * @param {*} res 
 * @param {*} req 
 * @param {any[]} bytes массив байтов
 * @param {function} callback функция обратного вызова
 */
module.exports = function (req, res, bytes, callback) {
    try {
        var pkgRead = packager.read(bytes);
        pkgRead.readData();
        var item = pkgRead.data.from[0];
        // проверяем обработку ошибки
        if (item.method == "error" && item.action == "server") {
            callback(500, Buffer.from("testing", 'utf-8'));
        } else {
            var obj = Object.assign(layout_result.ok([{
                "message": "Hello"
            }]), item);
            var pkg = packager.write();
            pkg.blockTo('to0', [obj]);
            callback(200, pkg.flush(0, pkgRead.type));
        }
    } catch (e) {
        callback(500, Buffer.from("Ошибка чтения пакета." + e.toString(), 'utf-8'));
    }
}