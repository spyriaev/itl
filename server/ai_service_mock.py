"""
Mock AI Service - эмуляция работы AI-модели для тестирования приложения.

Этот сервис имитирует работу AI API и возвращает заранее подготовленные ответы,
не требуя подключения к реальным API (DeepSeek, GigaChat).

Использование:
1. Установите переменную окружения USE_MOCK_AI=true
2. Или закомментируйте импорт реального ai_service в main.py
"""

import os
import logging
import asyncio
import random
from typing import List, AsyncGenerator, Optional

logger = logging.getLogger(__name__)


class MockAIService:
    """
    Mock AI Service для эмуляции работы AI-модели без реальных API.
    
    Этот сервис:
    - Возвращает реалистичные ответы с имитацией задержки
    - Поддерживает те же методы что и настоящий AIService
    - Полезен для разработки и тестирования
    """
    
    # База знаний с примерами ответов
    RESPONSE_TEMPLATES = {
        "greeting": [
            "Привет! Я готов помочь вам разобраться с документом. ",
            "Здравствуйте! Чем могу помочь? ",
            "Давайте изучим этот документ вместе. ",
        ],
        "explanation": [
            "Судя по документу, ",
            "Согласно тексту на странице {page}, ",
            "В этом разделе упоминается, что ",
        ],
        "detail": [
            "Более подробно, ",
            "Если углубиться в детали, ",
            "Важно отметить, что ",
        ],
        "conclusion": [
            "Таким образом, ",
            "В итоге можно сказать, что ",
            "Резюмируя вышесказанное, ",
        ]
    }
    
    # Случайные факты для генерации ответов
    RANDOM_FACTS = [
        "этот материал содержит важную информацию о ",
        "здесь рассматриваются основные принципы ",
        "в документе описывается ",
        "этот раздел посвящен ",
        "материал охватывает такие темы как ",
        "в данном контексте обсуждается ",
        "это часть более широкой темы ",
    ]
    
    # Темы для генерации контекста
    TOPICS = [
        "технические аспекты", "методологию", "принципы работы",
        "теоретические основы", "практические рекомендации",
        "ключевые концепции", "важные детали", "основные выводы",
        "сравнительный анализ", "подробное описание",
        "конкретные примеры", "общие положения"
    ]
    
    def __init__(self):
        """Инициализация Mock AI Service"""
        self.context_pages = int(os.getenv("CHAT_CONTEXT_PAGES", "2"))
        logger.info("🔧 Mock AI Service initialized (для тестирования)")
    
    async def extract_text_from_pdf(self, pdf_url: str, page_numbers: List[int]) -> str:
        """
        Эмуляция извлечения текста из PDF.
        
        Args:
            pdf_url: URL документа
            page_numbers: Список номеров страниц
            
        Returns:
            Сгенерированный текст для имитации содержимого PDF
        """
        logger.debug(f"📄 Mock: Extracting text from pages {page_numbers}")
        
        # Имитируем задержку
        await asyncio.sleep(0.1)
        
        # Генерируем реалистичное содержимое страниц
        text_parts = []
        for page_num in page_numbers:
            # Генерируем реалистичный текст для страницы
            page_text = self._generate_mock_page_content(page_num)
            text_parts.append(f"--- Page {page_num} ---\n{page_text}")
        
        return "\n\n".join(text_parts)
    
    def build_context_pages(self, current_page: int, total_pages: int, 
                           context_type: str = "page", chapter_info: Optional[dict] = None) -> List[int]:
        """
        Определение страниц для контекста (та же логика что и в реальном сервисе).
        
        Args:
            current_page: Текущая страница
            total_pages: Общее количество страниц
            context_type: Тип контекста
            chapter_info: Информация о главе
            
        Returns:
            Список номеров страниц для контекста
        """
        pages = set()
        
        if context_type == "document":
            # Включаем все страницы (с лимитом)
            max_pages = 50
            for i in range(1, min(total_pages, max_pages) + 1):
                pages.add(i)
        elif context_type in ["chapter", "section"] and chapter_info:
            # Включаем все страницы в главе/секции
            page_from = chapter_info.get("pageFrom", current_page)
            page_to = chapter_info.get("pageTo", current_page)
            for page_num in range(page_from, min(page_to + 1, total_pages + 1)):
                if page_num >= 1:
                    pages.add(page_num)
        else:
            # По умолчанию: контекст страницы (текущая + окружающие страницы)
            pages.add(current_page)
            
            # Добавляем окружающие страницы
            for i in range(1, self.context_pages + 1):
                if current_page - i >= 1:
                    pages.add(current_page - i)
                if current_page + i <= total_pages:
                    pages.add(current_page + i)
        
        return sorted(list(pages))
    
    async def generate_response_stream_no_context(
        self, 
        messages: List[dict]
    ) -> AsyncGenerator[str, None]:
        """
        Генерация стримингового ответа без контекста документа.
        
        Args:
            messages: Список сообщений для контекста
            
        Yields:
            Токены ответа по мере генерации
        """
        logger.debug(f"🤖 Mock: Generating response without context")
        
        # Имитируем задержку обработки запроса
        logger.debug("⏳ Mock: Simulating AI processing delay...")
        await asyncio.sleep(2)
        
        # Получаем последнее сообщение пользователя
        last_message = messages[-1]["content"] if messages else "Не могу понять ваш вопрос"
        
        # Генерируем ответ
        response = await self._generate_mock_response(last_message, has_context=False)
        
        # Рассчитываем токены для prompt (приблизительно)
        prompt_tokens = self._estimate_tokens(messages)
        completion_tokens = self._estimate_tokens([{"content": response}])
        
        # Имитируем стриминг (выдаем текст постепенно)
        words = response.split()
        for i, word in enumerate(words):
            yield word
            # Имитируем естественную задержку
            if i < len(words) - 1:  # Не задержка после последнего слова
                delay = random.uniform(0.01, 0.05)  # Случайная задержка 10-50ms
                await asyncio.sleep(delay)
        
        # Отправляем информацию об использовании токенов (как в реальном сервисе)
        yield {
            'type': 'usage',
            'usage': {
                'prompt_tokens': prompt_tokens,
                'completion_tokens': completion_tokens,
                'total_tokens': prompt_tokens + completion_tokens
            }
        }
    
    async def generate_response_stream(
        self, 
        messages: List[dict], 
        pdf_url: str, 
        current_page: int, 
        total_pages: int,
        context_type: str = "page",
        chapter_info: Optional[dict] = None
    ) -> AsyncGenerator[str, None]:
        """
        Генерация стримингового ответа с контекстом документа.
        
        Args:
            messages: Список сообщений
            pdf_url: URL PDF документа
            current_page: Текущая страница
            total_pages: Общее количество страниц
            context_type: Тип контекста
            chapter_info: Информация о главе
            
        Yields:
            Токены ответа по мере генерации
        """
        logger.debug(f"🤖 Mock: Generating response with context (page {current_page}, context: {context_type})")
        
        # Имитируем задержку обработки запроса
        logger.debug("⏳ Mock: Simulating AI processing delay...")
        await asyncio.sleep(2)
        
        # Получаем последнее сообщение пользователя
        last_message = messages[-1]["content"] if messages else "Не могу понять ваш вопрос"
        
        # Имитируем извлечение текста из PDF для расчета токенов контекста
        context_pages = self.build_context_pages(current_page, total_pages, context_type, chapter_info)
        pdf_text = await self.extract_text_from_pdf(pdf_url, context_pages)
        
        # Добавляем системное сообщение с контекстом (как в реальном сервисе)
        system_message = {
            "role": "system",
            "content": f"Document content from pages {', '.join(map(str, context_pages))}:\n{pdf_text}"
        }
        all_messages = [system_message] + messages
        
        # Генерируем ответ
        response = await self._generate_mock_response(
            last_message, 
            has_context=True,
            page=current_page,
            context_type=context_type
        )
        
        # Рассчитываем токены для prompt (включая контекст PDF)
        prompt_tokens = self._estimate_tokens(all_messages)
        completion_tokens = self._estimate_tokens([{"content": response}])
        
        # Имитируем стриминг
        words = response.split()
        for i, word in enumerate(words):
            yield word + " "  # Добавляем пробел между словами
            # Имитируем естественную задержку
            if i < len(words) - 1:
                delay = random.uniform(0.01, 0.05)
                await asyncio.sleep(delay)
        
        # Отправляем информацию об использовании токенов (как в реальном сервисе)
        yield {
            'type': 'usage',
            'usage': {
                'prompt_tokens': prompt_tokens,
                'completion_tokens': completion_tokens,
                'total_tokens': prompt_tokens + completion_tokens
            }
        }
    
    def _generate_mock_page_content(self, page_num: int) -> str:
        """Генерирует реалистичное содержимое страницы для имитации"""
        topic = random.choice(self.TOPICS)
        fact = random.choice(self.RANDOM_FACTS)
        
        content = f"""
Это страница {page_num} документа. Здесь рассматривается {topic}.
Материал охватывает различные аспекты темы и предоставляет подробную информацию.
В этом разделе автор {fact}связанные с основным предметом изучения.
Важно отметить, что данная информация является частью более широкого контекста.
        """
        
        return content.strip()
    
    async def _generate_mock_response(
        self, 
        user_message: str,
        has_context: bool = True,
        page: Optional[int] = None,
        context_type: Optional[str] = None
    ) -> str:
        """
        Генерация реалистичного ответа AI.
        
        Args:
            user_message: Сообщение пользователя
            has_context: Есть ли контекст документа
            page: Номер страницы
            context_type: Тип контекста
            
        Returns:
            Сгенерированный ответ
        """
        # Определяем тон ответа на основе сообщения
        message_lower = user_message.lower()
        
        # Выбираем подходящий шаблон
        if any(word in message_lower for word in ["привет", "здравствуй", "приветствую"]):
            greeting = random.choice(self.RESPONSE_TEMPLATES["greeting"])
            return f"{greeting}Я помогу вам разобраться с документом. Задайте вопрос о содержимом, и я постараюсь на него ответить."
        
        # Для вопросов генерируем детальный ответ
        response_parts = []
        
        # Вступление
        if has_context and page:
            if context_type == "chapter":
                response_parts.append(random.choice([
                    f"Согласно информации из этой главы документа, ",
                    f"Изучив содержимое главы, я могу сказать, что ",
                ]))
            elif context_type == "document":
                response_parts.append(random.choice([
                    f"На основе анализа всего документа, ",
                    f"Рассматривая документ в целом, ",
                ]))
            else:
                response_parts.append(random.choice([
                    f"На странице {page} упоминается, что ",
                    f"Согласно тексту на странице {page}, ",
                ]))
        
        # Основная часть ответа
        explanation = random.choice(self.RESPONSE_TEMPLATES["explanation"])
        topic = random.choice(self.TOPICS)
        fact = random.choice(self.RANDOM_FACTS)
        
        main_part = f"{explanation}{fact}{topic}. "
        if page:
            main_part = main_part.replace("{page}", str(page))
        
        response_parts.append(main_part)
        
        # Детализация
        if random.random() > 0.3:  # 70% вероятность добавить детали
            detail_part = random.choice(self.RESPONSE_TEMPLATES["detail"])
            more_info = random.choice([
                "важно понимать контекст применения этих принципов.",
                "существуют различные подходы к интерпретации этих данных.",
                "можно выделить несколько ключевых моментов для рассмотрения.",
            ])
            response_parts.append(f"{detail_part}{more_info} ")
        
        # Вывод
        if random.random() > 0.4:  # 60% вероятность добавить вывод
            conclusion_part = random.choice(self.RESPONSE_TEMPLATES["conclusion"])
            conclusion_text = random.choice([
                "это важная информация для понимания общей картины.",
                "данные имеют значение в контексте всего документа.",
                "это необходимо учитывать при дальнейшем изучении.",
            ])
            response_parts.append(f"{conclusion_part}{conclusion_text}")
        
        return "".join(response_parts)
    
    def clear_token_cache(self):
        """Очистка кэша токенов (для консистентности с реальным сервисом)"""
        logger.debug("Mock: Clearing token cache (no-op)")
        pass
    
    def get_token_info(self):
        """Получение информации о токене (для консистентности с реальным сервисом)"""
        logger.debug("Mock: Getting token info (no-op)")
        return None
    
    def _estimate_tokens(self, messages: List[dict]) -> int:
        """
        Приблизительная оценка количества токенов в сообщениях.
        
        Использует простое правило: примерно 4 символа = 1 токен для большинства языков.
        Для более точной оценки можно было бы использовать библиотеку tiktoken,
        но для mock сервиса достаточно приближения.
        
        Args:
            messages: Список сообщений
            
        Returns:
            Приблизительное количество токенов
        """
        total_chars = 0
        for msg in messages:
            content = msg.get("content", "")
            if isinstance(content, str):
                total_chars += len(content)
        
        # Примерно 4 символа = 1 токен (эмпирическое правило для большинства языков)
        # Добавляем небольшой запас для специальных токенов (системные сообщения, роли)
        estimated_tokens = int(total_chars / 4) + len(messages) * 3  # +3 токена на сообщение для роли и форматирования
        
        return max(estimated_tokens, 10)  # Минимум 10 токенов


# Глобальный экземпляр
mock_ai_service = MockAIService()

# Для совместимости
AIService = MockAIService
ai_service = mock_ai_service
