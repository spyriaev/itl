# Иконки (Статические файлы)

В этой папке размещайте статические иконки, которые будут доступны напрямую по URL.

## Использование

Все файлы из этой папки доступны по пути `/icons/filename.svg`

### Пример использования в коде:

\`\`\`tsx
// В React компоненте
<img src="/icons/document.svg" alt="document" style={{ width: 24, height: 24 }} />

// В HTML
<img src="/icons/document.svg" alt="document" />

// В CSS
.icon {
  background-image: url('/icons/document.svg');
}
\`\`\`

## Пути

- Файлы здесь: `web/public/icons/document.svg`
- URL в браузере: `http://localhost:5173/icons/document.svg`

## В чем разница с /src/assets/icons/?

- `/public/icons/` - статические файлы, доступны по прямому URL
- `/src/assets/icons/` - импортируются в код, обрабатываются Vite
