# Иконки

В этой папке размещайте файлы с иконками для использования в проекте.

## Структура папок

\`\`\`
web/src/assets/icons/
├── README.md (этот файл)
├── document.svg
├── upload.svg
├── user.svg
├── refresh.svg
└── ...
\`\`\`

## Способы использования

### 1. Импорт SVG как URL (рекомендуется)

\`\`\`tsx
import documentIcon from '../assets/icons/document.svg'

// Использование:
<img src={documentIcon} alt="document" />
\`\`\`

### 2. Импорт SVG как React компонент (если настроен SVGR)

\`\`\`tsx
import { ReactComponent as DocumentIcon } from '../assets/icons/document.svg'

// Использование:
<DocumentIcon />
\`\`\`

### 3. Использование в CSS/стилях

\`\`\`tsx
import documentIcon from '../assets/icons/document.svg'

<div style={{
  backgroundImage: `url(${documentIcon})`,
  backgroundSize: 'contain',
}}>
\`\`\`

## Альтернативный подход: папка public/

Если не хотите импортировать иконки, можете положить их в папку `web/public/icons/`

Тогда путь будет:
\`\`\`
web/public/icons/document.svg
web/public/icons/upload.svg
\`\`\`

И использовать так:
\`\`\`tsx
<img src="/icons/document.svg" alt="document" />
\`\`\`

## Рекомендации

- Для React компонентов лучше использовать `/src/assets/`
- Для статических файлов (favicon и т.д.) используйте `/public/`
- Формат SVG предпочтительнее для иконок
