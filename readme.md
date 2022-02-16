### Описание

RPC-сервис - 4 поколения для обмена данными с базой данных PostgreSQL.
Подробная инструкция по RPC на [appcode.pw](https://www.appcode.pw/?page_id=2003)

#### инициализация приложения

```
nodejs conf=/etc/path/prod.conf
```

По умолчанию используется порт 3000, но можно указать любой свободный.
При указание дополнительного аргумента debug будет сохраняться отладочная информация, но на боевом стенде лучше отключать, чтобы не засорять логи.
По умолчанию информация логируется в каталоге ~/logs.

```
# {port} - порт, на котором будет работать приложение
port=3000
# {virtual_dir_path} - виртуальный каталог, например /test (обращение будет http://my.domain.ru/test)
virtual_dir_path="/"
# {connection_string} - строка подключения к БД
connection_string="host:IP;port:PORT;user:user-name;password:password;database:db"
# {debug} - ставить true если нужна информация для отладки приложения
debug=true 
# {thread} - количество потоков, если передать 0, то равно количеству ядер 
thread=0
# {access_buffer_expire} - период времени для хранение ключа безопасности в кэше (секунды)
access_buffer_expire=30
# {access_checkperiod} - период времени для проверки истекших ключей безопасности (секунды)
access_checkperiod=60
```

#### соглашение об назначении версии приложения

В файле package.json есть свойство birthday в котором указывать "дата рождения приложения" на основе этой даты генерируется значение свойства version.
Дле генерации требуется установить расширение [node-version-1.0.1.vsix](https://1drv.ms/u/s!AnBjlQFDvsIT731gHXGyySlxy0VB?e=DIpfjT)

#### настройка в VSCode

```
.vscode/launch.json

{
    // Используйте IntelliSense, чтобы узнать о возможных атрибутах.
    // Наведите указатель мыши, чтобы просмотреть описания существующих атрибутов.
    // Для получения дополнительной информации посетите: https://go.microsoft.com/fwlink/?linkid=830387
    "version": "0.2.0",
    "configurations": [
        {
            "type": "pwa-node",
            "request": "launch",
            "name": "Launch Program",
            "skipFiles": [
                "<node_internals>/**"
            ],
            "program": "${workspaceFolder}\\bin\\www",
            "args": ["conf=/city-rpc-service/dev.conf"]
        }
    ]
}
```

#### работа с файловой системой

GET ~/file/:id - получение файла, где id - это идентификатор из таблицы core.sd_storage
POST ~/file/private - создание файла
```
file: [bytes]
{
    path: '/install.md'
}
```
DELETE ~/file/private/:id - удаление файла, где id - это идентификатор записи в core.sd_storage

