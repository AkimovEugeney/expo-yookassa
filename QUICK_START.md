# Быстрый старт

## 1. Получение CLIENT_ID и SHOP_ID

1. Зайдите на https://yookassa.ru/
2. Войдите в личный кабинет: https://yookassa.ru/my
3. Настройки → API
4. Скопируйте:
   - **Shop ID** → это ваш `SHOP_ID`
   - **Client ID** → это ваш `CLIENT_ID`

## 2. Сборка модуля

```bash
# В папке модуля
npm install
npm run build
```

## 3. Установка в проект (локально)

### Вариант A: Через file:

В `package.json` вашего проекта:
```json
{
  "dependencies": {
    "expo-yookassa": "file:../expo-yookassa"
  }
}
```

Затем:
```bash
npm install
```

### Вариант B: Через npm link

```bash
# В папке модуля
npm link

# В вашем проекте
npm link expo-yookassa
```

## 4. Использование

```typescript
import ExpoYookassa from 'expo-yookassa'

// Инициализация
await ExpoYookassa.initialize('YOUR_CLIENT_ID', 'YOUR_SHOP_ID')

// Покупка подписки
const result = await ExpoYookassa.startSubscription({
  clientId: 'YOUR_CLIENT_ID',
  shopId: 'YOUR_SHOP_ID',
  subscriptionId: 'unique_id',
  amount: 299.0,
  currency: 'RUB',
  title: 'Подписка',
  testMode: false, // true для тестирования
})
```

## 5. Публикация в npm

```bash
# 1. Обновите версию
npm version patch

# 2. Соберите
npm run build

# 3. Опубликуйте
npm publish --access public
```

## Полезные ссылки

- [Полное руководство](./SETUP_GUIDE.md)
- [Документация API](./README.md)
- [Настройка сервера](./SERVER_SETUP.md)

