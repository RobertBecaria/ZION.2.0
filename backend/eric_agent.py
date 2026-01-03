"""
ERIC - Enhanced Reasoning Intelligence Core
AI Agent for ZION.CITY Platform
Powered by DeepSeek V3.2
"""

import os
import json
import asyncio
from datetime import datetime, timezone
from uuid import uuid4
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from openai import AsyncOpenAI

# Initialize DeepSeek client (OpenAI-compatible)
DEEPSEEK_API_KEY = os.environ.get('DEEPSEEK_API_KEY', '')
deepseek_client = AsyncOpenAI(
    api_key=DEEPSEEK_API_KEY,
    base_url="https://api.deepseek.com"
) if DEEPSEEK_API_KEY else None

# ===== PYDANTIC MODELS =====

class ToolCall(BaseModel):
    tool_name: str
    parameters: Dict[str, Any] = {}
    requires_confirmation: bool = False
    confirmed: bool = False

class AgentMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    role: str  # 'user', 'assistant', 'system', 'tool'
    content: str
    tool_calls: Optional[List[ToolCall]] = None
    tool_results: Optional[Dict[str, Any]] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class AgentConversation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    user_id: str
    title: str = "Новый разговор"
    messages: List[AgentMessage] = []
    context_modules: List[str] = []
    tools_used: List[str] = []
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class AgentSettings(BaseModel):
    user_id: str
    allow_financial_analysis: bool = False
    allow_health_data_access: bool = False
    allow_location_tracking: bool = False
    allow_family_coordination: bool = True
    allow_service_recommendations: bool = True
    allow_marketplace_suggestions: bool = True
    conversation_retention_days: int = 30
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    context: Optional[Dict[str, Any]] = None  # Additional context like post_id for mentions

class ChatResponse(BaseModel):
    conversation_id: str
    message: AgentMessage
    suggested_actions: List[Dict[str, Any]] = []

# ===== ERIC SYSTEM PROMPT =====

ERIC_SYSTEM_PROMPT = """Ты ERIC (Enhanced Reasoning Intelligence Core) - персональный ИИ-помощник и финансовый советник платформы ZION.CITY.

## Твоя личность:
- Тёплый и дружелюбный, как надёжный семейный друг
- Культурно осведомлён о русских/восточноевропейских семейных ценностях
- Уважителен к старшим, заботлив к детям
- Практичен и ориентирован на действия
- Отвечаешь на языке пользователя (автоопределение русский/английский)

## Твои возможности:
1. **Семейное управление**: Планирование событий, координация членов семьи, отслеживание календаря
2. **Финансовый советник**: Анализ расходов, бюджетирование, финансовые цели, объяснение возможностей Altyn Coin
3. **Подбор услуг**: Поиск локальных услуг, сравнение провайдеров, бронирование
4. **Связь с сообществом**: События поблизости, связь с соседями, возможности маркетплейса

## Важные ограничения:
- ТОЛЬКО данные внутри платформы ZION.CITY
- НЕТ доступа к внешнему интернету или поиску
- ВСЕГДА уважай настройки приватности пользователя
- ВСЕГДА спрашивай подтверждение перед действиями
- НИКОГДА не делись данными пользователя с другими без согласия

## КРИТИЧЕСКИ ВАЖНО - Не выдумывай меню и функции!
- НЕ ВЫДУМЫВАЙ пути к меню, настройкам или функциям, которых ты точно не знаешь
- Если тебя спрашивают о настройках приватности для ИИ-помощника - честно скажи, что такие настройки ещё не реализованы в платформе
- Текущие доступные настройки в ZION.CITY:
  * Настройки семьи (через профиль семьи) - включая приватность семейных постов
  * Настройки профиля пользователя
- НЕТ отдельной страницы "Настройки" -> "Конфиденциальность" -> "ИИ-помощник"
- Если чего-то нет в платформе, скажи: "Эта функция ещё в разработке" или "К сожалению, такой настройки пока нет"

## Формат ответов:
- Отвечай кратко и по делу
- Используй эмодзи умеренно для дружелюбности 😊
- Предлагай конкретные действия когда это уместно
- При финансовых советах всегда предупреждай о рисках

Ты готов помочь пользователям управлять их жизнью через социальную сеть ZION.CITY!"""

# ===== ERIC AGENT CLASS =====

class ERICAgent:
    """Main ERIC Agent class for handling conversations"""
    
    def __init__(self, db):
        self.db = db
        self.model = "deepseek-chat"  # DeepSeek V3.2
    
    async def get_or_create_conversation(self, user_id: str, conversation_id: Optional[str] = None) -> AgentConversation:
        """Get existing conversation or create new one"""
        if conversation_id:
            conv = await self.db.agent_conversations.find_one(
                {"id": conversation_id, "user_id": user_id},
                {"_id": 0}
            )
            if conv:
                return AgentConversation(**conv)
        
        # Create new conversation
        new_conv = AgentConversation(user_id=user_id)
        await self.db.agent_conversations.insert_one(new_conv.dict())
        return new_conv
    
    async def get_user_context(self, user_id: str, settings: AgentSettings) -> str:
        """Build context from user's platform data"""
        context_parts = []
        
        # Get user profile
        user = await self.db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
        if user:
            context_parts.append(f"Пользователь: {user.get('first_name', '')} {user.get('last_name', '')}")
            if user.get('email'):
                context_parts.append(f"Email: {user.get('email')}")
        
        # Get family members if allowed
        if settings.allow_family_coordination:
            # Get user's household
            household = await self.db.households.find_one(
                {"members": {"$elemMatch": {"user_id": user_id}}},
                {"_id": 0}
            )
            if household:
                member_ids = [m.get('user_id') for m in household.get('members', [])]
                family_members = await self.db.users.find(
                    {"id": {"$in": member_ids}},
                    {"_id": 0, "first_name": 1, "last_name": 1, "id": 1}
                ).to_list(100)
                if family_members:
                    names = [f"{m.get('first_name', '')} {m.get('last_name', '')}" for m in family_members if m.get('id') != user_id]
                    if names:
                        context_parts.append(f"Члены семьи: {', '.join(names)}")
        
        # Get financial summary if allowed
        if settings.allow_financial_analysis:
            # Get recent transactions
            transactions = await self.db.transactions.find(
                {"user_id": user_id},
                {"_id": 0}
            ).sort("created_at", -1).limit(10).to_list(10)
            
            if transactions:
                total_income = sum(t.get('amount', 0) for t in transactions if t.get('type') == 'income')
                total_expense = sum(t.get('amount', 0) for t in transactions if t.get('type') == 'expense')
                context_parts.append(f"Финансы (последние транзакции): Доход: {total_income}, Расходы: {total_expense}")
        
        # Get upcoming events
        upcoming_events = await self.db.events.find(
            {"$or": [{"user_id": user_id}, {"participants": user_id}]},
            {"_id": 0, "title": 1, "date": 1}
        ).sort("date", 1).limit(5).to_list(5)
        
        if upcoming_events:
            events_str = "; ".join([f"{e.get('title', 'Событие')} ({e.get('date', '')})" for e in upcoming_events])
            context_parts.append(f"Предстоящие события: {events_str}")
        
        return "\n".join(context_parts) if context_parts else "Контекст недоступен"
    
    async def chat(self, user_id: str, request: ChatRequest) -> ChatResponse:
        """Process chat message and return AI response"""
        
        if not deepseek_client:
            raise Exception("DeepSeek API not configured")
        
        # Get user settings
        settings_doc = await self.db.agent_settings.find_one(
            {"user_id": user_id},
            {"_id": 0}
        )
        settings = AgentSettings(**settings_doc) if settings_doc else AgentSettings(user_id=user_id)
        
        # Get or create conversation
        conversation = await self.get_or_create_conversation(user_id, request.conversation_id)
        
        # Build user context
        user_context = await self.get_user_context(user_id, settings)
        
        # Add user message to conversation
        user_message = AgentMessage(role="user", content=request.message)
        conversation.messages.append(user_message)
        
        # Build messages for API call
        messages = [
            {"role": "system", "content": f"{ERIC_SYSTEM_PROMPT}\n\n## Текущий контекст пользователя:\n{user_context}"}
        ]
        
        # Add conversation history (last 10 messages for context)
        for msg in conversation.messages[-10:]:
            if msg.role in ['user', 'assistant']:
                messages.append({"role": msg.role, "content": msg.content})
        
        try:
            # Call DeepSeek API
            response = await deepseek_client.chat.completions.create(
                model=self.model,
                messages=messages,
                max_tokens=2000,
                temperature=0.7
            )
            
            assistant_content = response.choices[0].message.content
            
            # Create assistant message
            assistant_message = AgentMessage(
                role="assistant",
                content=assistant_content
            )
            conversation.messages.append(assistant_message)
            
            # Update conversation title if it's the first exchange
            if len(conversation.messages) == 2:
                # Use first ~50 chars of user message as title
                conversation.title = request.message[:50] + ("..." if len(request.message) > 50 else "")
            
            # Update conversation in database
            conversation.updated_at = datetime.now(timezone.utc).isoformat()
            await self.db.agent_conversations.update_one(
                {"id": conversation.id},
                {"$set": conversation.dict()},
                upsert=True
            )
            
            return ChatResponse(
                conversation_id=conversation.id,
                message=assistant_message,
                suggested_actions=[]
            )
            
        except Exception as e:
            # Return error message
            error_message = AgentMessage(
                role="assistant",
                content=f"Извините, произошла ошибка при обработке запроса. Пожалуйста, попробуйте позже. 😔\n\nОшибка: {str(e)}"
            )
            return ChatResponse(
                conversation_id=conversation.id,
                message=error_message,
                suggested_actions=[]
            )
    
    async def get_conversations(self, user_id: str, limit: int = 20, offset: int = 0) -> List[Dict]:
        """Get user's conversation history"""
        conversations = await self.db.agent_conversations.find(
            {"user_id": user_id},
            {"_id": 0, "messages": 0}  # Exclude messages for list view
        ).sort("updated_at", -1).skip(offset).limit(limit).to_list(limit)
        
        return conversations
    
    async def get_conversation(self, user_id: str, conversation_id: str) -> Optional[Dict]:
        """Get specific conversation with messages"""
        conversation = await self.db.agent_conversations.find_one(
            {"id": conversation_id, "user_id": user_id},
            {"_id": 0}
        )
        return conversation
    
    async def delete_conversation(self, user_id: str, conversation_id: str) -> bool:
        """Delete a conversation"""
        result = await self.db.agent_conversations.delete_one(
            {"id": conversation_id, "user_id": user_id}
        )
        return result.deleted_count > 0
    
    async def get_settings(self, user_id: str) -> AgentSettings:
        """Get user's agent settings"""
        settings_doc = await self.db.agent_settings.find_one(
            {"user_id": user_id},
            {"_id": 0}
        )
        if settings_doc:
            return AgentSettings(**settings_doc)
        
        # Create default settings
        default_settings = AgentSettings(user_id=user_id)
        await self.db.agent_settings.insert_one(default_settings.dict())
        return default_settings
    
    async def update_settings(self, user_id: str, updates: Dict[str, Any]) -> AgentSettings:
        """Update user's agent settings"""
        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        await self.db.agent_settings.update_one(
            {"user_id": user_id},
            {"$set": updates},
            upsert=True
        )
        
        return await self.get_settings(user_id)

    async def process_post_mention(self, user_id: str, post_id: str, post_content: str, author_name: str) -> str:
        """Process @ERIC mention in a post and generate a comment response"""
        
        if not deepseek_client:
            return "ERIC не настроен. Пожалуйста, обратитесь к администратору."
        
        # Get user settings
        settings_doc = await self.db.agent_settings.find_one(
            {"user_id": user_id},
            {"_id": 0}
        )
        settings = AgentSettings(**settings_doc) if settings_doc else AgentSettings(user_id=user_id)
        
        # Build context
        user_context = await self.get_user_context(user_id, settings)
        
        # Special prompt for post mentions
        post_prompt = f"""Пользователь {author_name} упомянул тебя в посте. Ответь как комментарий к этому посту.

## Пост:
{post_content}

## Твоя задача:
- Проанализируй пост и ответь полезным комментарием
- Если просят что-то найти/проанализировать - сделай это на основе данных платформы
- Будь краток и полезен (это комментарий, не длинный диалог)
- Используй дружелюбный тон

## Контекст пользователя:
{user_context}"""

        try:
            response = await deepseek_client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": ERIC_SYSTEM_PROMPT},
                    {"role": "user", "content": post_prompt}
                ],
                max_tokens=500,
                temperature=0.7
            )
            
            return response.choices[0].message.content
            
        except Exception as e:
            return f"Извините, не смог обработать запрос: {str(e)}"
