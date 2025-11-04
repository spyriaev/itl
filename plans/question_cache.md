# План реализации оффлайн-режима с кешированием вопросов и тредов

## Цели

1. Кеширование вопросов и тредов в IndexedDB на клиенте
2. Оффлайн-режим: работа без интернета с кешированными данными
3. Синхронизация между устройствами: автоматическая догрузка новых данных
4. Оптимизация загрузки: загрузка всех вопросов документа сразу, а не постранично

## Архитектура

### 1. База данных IndexedDB (клиент)

Создать новую БД `questions_cache_db` с объектными хранилищами:

- `documents`: метаданные документов (lastSync, version)
- `threads`: треды (id, documentId, title, createdAt, updatedAt, userId)
- `messages`: сообщения (id, threadId, role, content, pageContext, contextType, chapterId, createdAt)
- `page_questions`: вопросы по страницам (documentId, pageNumber, questions[])

Индексы:

- `documents`: по documentId
- `threads`: по documentId, updatedAt
- `messages`: по threadId, createdAt
- `page_questions`: по documentId, pageNumber

### 2. Новый сервис `questionsCache.ts`

Создать `web/src/services/questionsCache.ts`:

- `initQuestionsCache()`: инициализация БД
- `cacheDocumentMetadata(documentId, lastSync, version)`: сохранение метаданных
- `cacheThreads(documentId, threads[])`: кеширование тредов
- `cacheMessages(threadId, messages[])`: кеширование сообщений
- `cachePageQuestions(documentId, pageNumber, questions[])`: кеширование вопросов страницы
- `getCachedThreads(documentId)`: получение тредов из кеша
- `getCachedMessages(threadId)`: получение сообщений из кеша
- `getCachedPageQuestions(documentId, pageNumber)`: получение вопросов из кеша
- `getDocumentLastSync(documentId)`: получение времени последней синхронизации
- `getNewerThreads(documentId, lastSync)`: получение тредов новее lastSync
- `getNewerMessages(threadId, lastSync)`: получение сообщений новее lastSync

### 3. Расширение API сервера

Добавить эндпоинты в `server/main.py`:

- `GET /api/documents/{document_id}/questions/all` - получить все вопросы документа (нужно создать)
- `GET /api/documents/{document_id}/chat/threads?since={timestamp}` - получить треды после timestamp
- `GET /api/chat/threads/{thread_id}/messages?since={timestamp}` - получить сообщения после timestamp

Расширить `server/repository.py`:

- `get_all_document_questions(db, document_id, user_id)` - получить все вопросы документа
- `list_chat_threads_since(db, document_id, user_id, since)` - получить треды после даты
- `get_thread_messages_since(db, thread_id, user_id, since)` - получить сообщения после даты

### 4. Модификация `chatService.ts`

Обновить `web/src/services/chatService.ts`:

- Добавить методы с поддержкой кеша:
- `getAllPageQuestions(documentId, useCache=true)` - получить все вопросы с кешированием
- `listThreads(documentId, useCache=true, since?)` - получить треды с кешированием
- `getThreadMessages(threadId, useCache=true, since?)` - получить сообщения с кешированием
- Логика: сначала проверять кеш, если есть - возвращать из кеша, параллельно проверять сервер на обновления

### 5. Обновление `ChatContext.tsx`

Модифицировать `web/src/contexts/ChatContext.tsx`:

- `loadThreads()`: сначала загружать из кеша, затем синхронизировать с сервером
- `selectThread()`: сначала загружать из кеша, затем синхронизировать с сервером
- Добавить метод `syncDocument(documentId)`: синхронизация всех данных документа

### 6. Обновление `PdfViewer.tsx`

Модифицировать `web/src/ui/components/PdfViewer.tsx`:

- При открытии документа:

1. Загружать все вопросы из кеша сразу (если есть)
2. Параллельно запрашивать все вопросы с сервера
3. Обновлять кеш и UI при получении новых данных

- Убрать постраничную загрузку вопросов при скролле
- Использовать кешированные вопросы для отображения

### 7. Стратегия синхронизации

При открытии документа:

1. Проверять кеш на наличие данных
2. Если есть кеш - загружать из него и отображать сразу
3. Параллельно проверять сервер на наличие новых данных (по `updated_at` или `since`)
4. Если есть новые данные - догружать и обновлять кеш
5. Обновлять UI инкрементально (только новые данные)

При отправке вопроса/открытии чата:

1. Проверять наличие новых данных на сервере (по `updated_at`)
2. Если есть - догружать и обновлять кеш
3. Отображать актуальные данные

### 8. Обработка оффлайн-режима

- При отсутствии интернета: работать только с кешем
- При появлении интернета: автоматически синхронизировать
- Индикация статуса синхронизации в UI

## Структура файлов

Создать:

- `web/src/services/questionsCache.ts` - сервис кеширования
- `web/src/services/syncService.ts` - сервис синхронизации (опционально, можно объединить с questionsCache)

Обновить:

- `web/src/services/chatService.ts` - добавить поддержку кеша
- `web/src/contexts/ChatContext.tsx` - использовать кеш
- `web/src/ui/components/PdfViewer.tsx` - загружать все вопросы сразу
- `server/main.py` - добавить новые эндпоинты
- `server/repository.py` - добавить методы получения данных с фильтрацией по времени

## Детали реализации

### Версионирование БД

- Версия 1: базовая структура
- При изменении схемы - увеличивать версию и мигрировать данные

### Обработка конфликтов

- Приоритет: данные с сервера всегда актуальнее
- При конфликте: перезаписывать кеш данными с сервера

### Производительность

- Batch операции для записи в IndexedDB
- Ленивая загрузка: загружать только видимые страницы из кеша
- Инкрементальные обновления: обновлять только измененные данные

## Тестирование

1. Тестирование кеширования:

- Открыть документ с вопросами
- Закрыть и открыть снова - данные должны быть из кеша
- Проверить синхронизацию при наличии новых данных

2. Тестирование мультиустройств:

- Открыть документ на устройстве A
- Добавить вопрос на устройстве B
- Открыть документ на устройстве A - должен появиться новый вопрос

3. Тестирование оффлайн:

- Отключить интернет
- Открыть документ - должен работать с кешем
- Включить интернет - должна произойти синхронизация