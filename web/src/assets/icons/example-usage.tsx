// Примеры использования иконок в проекте

import React from 'react'

// Вариант 1: Использование SVG через импорт (рекомендуется)
// import documentIcon from '../assets/icons/document.svg'
// import uploadIcon from '../assets/icons/upload.svg'

// Вариант 2: Использование из папки public
const IconExample = () => {
  return (
    <div>
      {/* Из папки /src/assets/icons/ */}
      {/* <img src={documentIcon} alt="document" style={{ width: 24, height: 24 }} /> */}

      {/* Из папки /public/icons/ */}
      {/* <img src="/icons/document.svg" alt="document" style={{ width: 24, height: 24 }} /> */}
      
      {/* Пример для файлов upload */}
      {/* <img src={uploadIcon} alt="upload" style={{ width: 56, height: 56, opacity: 0.6 }} /> */}
    </div>
  )
}

export default IconExample

/*
ЗАМЕНА ЭМОДЗИ НА ИКОНКИ:

Текущие эмодзи в коде:
- 📄 document (используется в App.tsx, DocumentList.tsx)
- 📤 upload arrow (используется в FileUpload.tsx)
- 👤 user (используется в UserMenu.tsx)
- 🔄 refresh (используется в DocumentList.tsx)
- ⋯ vertical dots (используется в DocumentList.tsx)

Замена:

В App.tsx:
Заменить: <span style={{ fontSize: 20 }}>📄</span>
На: <img src="/icons/document.svg" alt="" style={{ width: 20, height: 20 }} />

В FileUpload.tsx:
Заменить: <div style={{ fontSize: 56, marginBottom: 24, color: '#9CA3AF' }}>📤</div>
На: <img src="/icons/upload.svg" alt="" style={{ width: 56, height: 56, marginBottom: 24 }} />

В DocumentList.tsx:
Заменить: <div style={{ fontSize: 24, color: '#6B7280', flexShrink: 0 }}>📄</div>
На: <img src="/icons/document.svg" alt="" style={{ width: 24, height: 24, flexShrink: 0 }} />

Заменить: <span>🔄</span>
На: <img src="/icons/refresh.svg" alt="" style={{ width: 16, height: 16 }} />

Заменить: <div style={{ fontSize: 18, color: '#9CA3AF', ... }}>⋯</div>
На: <img src="/icons/menu.svg" alt="" style={{ width: 18, height: 18, color: '#9CA3AF' }} />

В UserMenu.tsx:
Заменить: <div style={{ ... }}>👤</div>
На: <img src="/icons/user.svg" alt="" style={{ width: 36, height: 36 }} />
*/
