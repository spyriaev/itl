# AI Reader - Quick Start Guide

Быстрая инструкция по запуску проекта с файл-апло́удом PDF.

## Шаг 1: Получите Supabase креденшиалы

1. Откройте: https://supabase.com/dashboard/project/sjrfppeisxmglrozufoy
2. Перейдите в **Settings → Database**
   - Скопируйте пароль базы данных
3. Перейдите в **Settings → API**
   - Скопируйте `anon public` ключ (для веб-клиента)
   - Скопируйте `service_role` ключ (для сервера)

## Шаг 2: Настройте Backend (сервер)

```bash
cd server

# Создайте .env файл из шаблона
cp env.example .env

# Отредактируйте .env и вставьте ваши креденшиалы
nano .env  # или используйте любой редактор
```

В файле `server/.env` укажите:
```env
PORT=8080
DATABASE_URL=jdbc:postgresql://db.sjrfppeisxmglrozufoy.supabase.co:5432/postgres
DATABASE_USER=postgres
DATABASE_PASSWORD=ваш_пароль_базы_данных
SUPABASE_URL=https://sjrfppeisxmglrozufoy.supabase.co
SUPABASE_SERVICE_KEY=ваш_service_role_ключ
```

## Шаг 3: Настройте Web (клиент)

```bash
cd web

# Создайте .env файл из шаблона
cp env.example .env

# Отредактируйте .env
nano .env
```

В файле `web/.env` укажите:
```env
VITE_SUPABASE_URL=https://sjrfppeisxmglrozufoy.supabase.co
VITE_SUPABASE_ANON_KEY=ваш_anon_public_ключ
VITE_API_URL=http://localhost:8080
```

## Шаг 4: Запустите проект

### Вариант А: Все сразу (рекомендуется)

Из корня проекта:
```bash
./start-dev.sh
```

Этот скрипт запустит и сервер, и веб-клиент одновременно.

### Вариант Б: По отдельности

**Терминал 1 - Backend:**
```bash
cd server
./run-dev.sh
```

**Терминал 2 - Web Client:**
```bash
cd web
./run-dev.sh
```

## Шаг 5: Откройте приложение

Откройте браузер: **http://localhost:5173**

Вы увидите:
- ✅ Форму загрузки PDF с drag & drop
- ✅ Список загруженных документов

## Тестирование

1. Перетащите PDF файл в зону загрузки
2. Или нажмите на зону и выберите PDF файл
3. Наблюдайте прогресс загрузки
4. Документ появится в списке после загрузки

## API Endpoints

**Backend работает на http://localhost:8080:**

- `GET /health` - Проверка здоровья сервера
- `POST /api/documents` - Создать запись документа
- `GET /api/documents` - Получить список документов

**Пример:**
```bash
# Проверка сервера
curl http://localhost:8080/health

# Список документов
curl http://localhost:8080/api/documents
```

## Остановка серверов

**Если запущены через `start-dev.sh`:**
- Нажмите `Ctrl+C` в терминале

**Если запущены по отдельности:**
- Нажмите `Ctrl+C` в каждом терминале

Или убейте все процессы:
```bash
pkill -f gradle
pkill -f vite
```

## Решение проблем

### Сервер не запускается
- Проверьте, что `server/.env` файл существует
- Проверьте креденшиалы базы данных
- Убедитесь, что Java 17 установлена: `java -version`

### Веб-клиент не подключается к серверу
- Убедитесь, что сервер запущен: `curl http://localhost:8080/health`
- Проверьте `VITE_API_URL` в `web/.env`

### Файлы не загружаются
- Проверьте консоль браузера на ошибки
- Убедитесь, что `VITE_SUPABASE_ANON_KEY` корректный
- Проверьте, что бакет `pdfs` существует в Supabase Storage

### База данных не подключается
- Проверьте пароль в `server/.env`
- Убедитесь, что миграция `0003_anonymous_uploads.sql` применена:
  ```bash
  cd supabase
  supabase db push --include-all
  ```

## Следующие шаги

После успешного запуска:
1. Загрузите тестовый PDF файл
2. Проверьте базу данных в Supabase Dashboard
3. Проверьте файлы в Storage → pdfs bucket
4. Изучите код в `server/` и `web/` директориях

## Полная документация

- `SETUP_FILE_UPLOAD.md` - Детальная настройка
- `FILE_UPLOAD_IMPLEMENTATION.md` - Детали реализации
- `README.md` - Общая информация о проекте


