# План реализации функции совместного доступа к документам

## Обзор

Реализация системы шаринга документов с уникальными ссылками. Владельцы могут делиться документами с другими пользователями. Пользователи, получившие ссылку, после обязательной авторизации получают доступ к документу. **Важно**: треды остаются приватными (каждый пользователь видит только свои треды в ChatPanel), но вопросы/ответы на страницах документа видны всем с визуальным разделением своих/чужих вопросов.

## База данных

### Новая таблица `document_shares`

Создать миграцию для таблицы хранения информации о шаринге:

- `id` (UUID, primary key)
- `document_id` (UUID, foreign key to documents)
- `share_token` (TEXT, unique, indexed) - уникальный токен для ссылки
- `created_by` (UUID, foreign key to auth.users) - владелец документа
- `created_at` (TIMESTAMPTZ)
- `revoked_at` (TIMESTAMPTZ, nullable) - дата отзыва ссылки
- `expires_at` (TIMESTAMPTZ, nullable) - опциональная дата истечения

### Новая таблица `document_share_access`

Таблица для отслеживания пользователей, получивших доступ:

- `id` (UUID, primary key)
- `share_id` (UUID, foreign key to document_shares)
- `user_id` (UUID, foreign key to auth.users)
- `accessed_at` (TIMESTAMPTZ, default now())

### Индексы и RLS

- Индекс на `share_token` для быстрого поиска
- Индекс на `document_id` и `revoked_at` для проверки активных шаров
- Индекс на `document_share_access(user_id, share_id)`
- RLS политики для обеих таблиц

## Backend (Python/FastAPI)

### Новые модели в `server/models.py`

- Добавить SQLAlchemy модель `DocumentShare`
- Добавить SQLAlchemy модель `DocumentShareAccess`
- Добавить Pydantic модели: `ShareDocumentRequest`, `ShareDocumentResponse`, `RevokeShareRequest`
- Обновить `PageQuestionResponse`: добавить `userId: str`, `isOwn: bool`, `canOpenThread: bool`

### Новые эндпоинты в `server/main.py`

1. `POST /api/documents/{document_id}/share` - создание ссылки для шаринга
2. `GET /api/documents/shared/{share_token}` - получение информации о документе по токену (без авторизации)
3. `GET /api/documents/shared/{share_token}/access` - получение доступа к документу (требует авторизации)

- Обязательная проверка авторизации пользователя
- Проверка валидности токена
- **Сохранение записи в `document_share_access`** - документ появится в списке документов пользователя
- Возврат signed URL и информации о документе

4. `DELETE /api/documents/{document_id}/share` - отзыв ссылки
5. `GET /api/documents/{document_id}/share` - получение информации о текущей ссылке

### Обновление репозитория `server/repository.py`

- Функция `create_document_share()` - создание записи о шаре
- Функция `get_document_share_by_token()` - получение по токену
- Функция `revoke_document_share()` - отзыв ссылки
- Функция `get_active_document_share()` - получение активной ссылки для документа
- Функция `check_user_has_document_access()` - проверка доступа через шаринг для пользователя
- Функция `record_share_access()` - сохранение информации о доступе
- Обновить функцию `list_documents()` для включения расшаренных документов пользователя
- **Обновить функцию `get_page_questions()`**:
- Проверить доступ через шаринг через `check_user_has_document_access()`
- Если доступ через шаринг или владелец: вернуть все вопросы всех пользователей с `userId`, `isOwn` (сравнение с текущим `user_id`), `canOpenThread` (True только если `isOwn`)
- Если обычный пользователь: вернуть только свои вопросы (текущее поведение)

## Frontend (React/TypeScript)

### Новый компонент `ShareDocumentButton.tsx`

- Кнопка/иконка в списке документов
- Модальное окно для управления ссылкой

### Обновление `DocumentList.tsx`

- Добавить кнопку для шаринга
- Пометка "Shared" / "Расшарен" для расшаренных документов
- Обновить интерфейс `DocumentMetadata` для поля `isShared`

### Новый сервис `web/src/services/shareService.ts`

- Функции для работы с API шаринга

### Обновление `web/src/services/chatService.ts`

- Обновить интерфейс `PageQuestion`: добавить `userId?: string`, `isOwn?: boolean`, `canOpenThread?: boolean`

### Новый компонент `SharedDocumentPage.tsx`

- Страница для открытия документа по ссылке
- Обязательная авторизация через `ProtectedRoute`
- PdfViewer с ChatPanel (показывает только свои треды)

### Обновление компонента `PageRelatedQuestions.tsx`

- **Визуальное разделение своих и чужих вопросов**:
- Свои вопросы: обычный цвет (#6B7280), кликабельны
- Чужие вопросы: другой цвет (#9CA3AF или пониженная непрозрачность), НЕ кликабельны
- Отключить onClick для чужих вопросов (`canOpenThread: false`)
- Убрать hover эффекты для чужих вопросов
- Возможно добавить визуальный индикатор (например, иконка или пометка)

### Обновление `ChatPanel.tsx`

- Убедиться, что показываются только свои треды (текущее поведение должно сохраниться)
- Для расшаренных документов: пользователь видит только свои треды, не видит треды других пользователей

### Обновление роутинга в `web/src/ui/App.tsx`

- Добавить маршрут `/share/:token` с обязательной авторизацией

### Локализация

- Добавить ключи для шаринга и пометок документов

## Безопасность

### RLS политики в Supabase

- **Обновить политики для `chat_threads`**:
- SELECT: пользователь может видеть ТОЛЬКО свои треды (`user_id = auth.uid()`) - треды других пользователей не видны
- INSERT: пользователь может создавать треды, если он владелец документа ИЛИ документ расшарен через активную ссылку
- **Обновить политики для `chat_messages`**:
- SELECT: пользователь может видеть сообщения ТОЛЬКО из своих тредов (через `thread.user_id = auth.uid()`)
- INSERT: пользователь может создавать сообщения только в своих тредах
- **Обновить политики для `documents`**:
- SELECT: пользователь может видеть документы, если он владелец ИЛИ документ расшарен и пользователь получил доступ (через `document_share_access`)
- **Важно**: Для отображения вопросов на страницах используется специальная функция `get_page_questions()`, которая обходит RLS и возвращает вопросы всех пользователей с пометкой принадлежности, если документ расшарен

### Проверки на backend

- Проверка владения документом перед созданием/отзывом ссылки
- Проверка валидности токена для доступа к документу
- При создании треда: проверка, что пользователь является владельцем ИЛИ документ расшарен
- При получении вопросов: проверка доступа через шаринг для показа всех вопросов

## Файлы для изменения

### База данных

- `supabase/migrations/0011_document_sharing.sql` - новая миграция с таблицами и RLS

### Backend

- `server/models.py` - модели DocumentShare, DocumentShareAccess и обновление PageQuestionResponse
- `server/repository.py` - функции для работы с шарингом и обновление get_page_questions()
- `server/main.py` - новые эндпоинты

### Frontend

- `web/src/services/shareService.ts` - новый сервис
- `web/src/services/chatService.ts` - обновление интерфейса PageQuestion
- `web/src/ui/components/ShareDocumentButton.tsx` - новый компонент
- `web/src/ui/components/DocumentList.tsx` - интеграция кнопки шаринга
- `web/src/ui/components/SharedDocumentPage.tsx` - новая страница
- `web/src/ui/components/PageRelatedQuestions.tsx` - обновление для поддержки чужих вопросов
- `web/src/ui/components/ChatPanel.tsx` - убедиться в приватности тредов
- `web/src/ui/App.tsx` - новый маршрут
- `web/src/locales/en.json` и `web/src/locales/ru.json` - локализация