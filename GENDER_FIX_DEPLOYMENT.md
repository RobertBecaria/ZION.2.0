# Исправление ошибки обновления пола (Gender Update Fix)

## Проблема
При выборе пола на `zioncity.app` появлялась ошибка:
> "Ошибка при обновлении. Попробуйте еще раз."

## Причина
В коде фронтенда была проверка:
```javascript
const backendUrl = process.env.REACT_APP_BACKEND_URL;
if (!backendUrl) throw new Error('Backend URL not configured');
```

При production сборке `REACT_APP_BACKEND_URL` устанавливается как пустая строка (`''`) для использования относительных URL. Проверка `if (!backendUrl)` считала пустую строку ошибкой и выбрасывала исключение.

## Исправления
1. **Удалена проверка** `if (!backendUrl) throw new Error(...)` из всех компонентов
2. **Добавлен fallback** `|| ''` для всех `backendUrl` присваиваний
3. **Улучшено логирование** в backend endpoint `/api/users/gender`

## Затронутые файлы
- `frontend/src/components/GenderUpdateModal.js`
- `frontend/src/components/HouseholdSection.js`
- `frontend/src/components/FamilyStatusForm.js`
- `frontend/src/components/FamilySettingsPage.js`
- `frontend/src/components/FamilyInvitationModal.js`
- `frontend/src/components/FamilyProfileList.js`
- `frontend/src/components/MyFamilyProfile.js`
- `frontend/src/components/FamilyProfilePage.js`
- `frontend/src/components/InvitationManager.js`
- `frontend/src/components/FamilyProfileCreation.js`
- `frontend/src/components/PublicFamilyProfile.js`
- `backend/server.py` (улучшено логирование)

## Как развернуть исправление на сервере

### Шаг 1: Обновите код
```bash
cd /opt/zion-city
git pull origin main
```

### Шаг 2: Пересоберите Docker образы
```bash
docker compose build --no-cache app
```

### Шаг 3: Перезапустите сервисы
```bash
docker compose up -d
```

### Шаг 4: Проверьте логи
```bash
docker compose logs -f app
```

### Шаг 5: Проверьте работу API
```bash
curl https://zioncity.app/api/health
```

## Проверка CORS (если проблема сохраняется)

Убедитесь что в вашем `.env` файле на сервере установлен правильный CORS_ORIGINS:

```bash
CORS_ORIGINS=https://zioncity.app,https://www.zioncity.app
```

Или для разрешения всех источников (не рекомендуется в production):
```bash
CORS_ORIGINS=*
```

## Проверка подключения к MongoDB

Если ошибка связана с базой данных, проверьте подключение:
```bash
docker compose exec mongodb mongosh --eval "db.runCommand({ping:1})"
```

## Проверка работы endpoint

После деплоя проверьте API:
```bash
# 1. Получите токен (залогиньтесь)
TOKEN="ваш_jwt_токен"

# 2. Обновите пол
curl -X PUT https://zioncity.app/api/users/gender \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"gender": "MALE"}'

# Ожидаемый ответ:
# {"message": "Gender updated successfully", "gender": "MALE"}
```

## Контакты
При возникновении дополнительных проблем - создайте issue в репозитории.
