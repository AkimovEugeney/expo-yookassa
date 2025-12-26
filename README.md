# Expo YooKassa Module

Модуль для интеграции YooKassa SDK в Expo приложения с поддержкой подписок (recurring payments).

## Установка

### Установка из npm (после публикации)

```bash
npm install expo-yookassa expo-secure-store
```

### Локальная установка (для разработки)

#### Способ 1: Через file: (рекомендуется)

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

#### Способ 2: Через npm link

```bash
# В папке модуля
cd /path/to/expo-yookassa
npm link

# В вашем проекте
cd /path/to/your/project
npm link expo-yookassa
```

**Подробные инструкции:** [SETUP_GUIDE.md](./SETUP_GUIDE.md)

## Получение CLIENT_ID и SHOP_ID

### Быстрая инструкция:

1. **Зарегистрируйтесь** на [YooKassa](https://yookassa.ru/)
2. Войдите в [Личный кабинет](https://yookassa.ru/my)
3. Перейдите в **"Настройки"** → **"API"**
4. Найдите:
   - **Shop ID** (`shopId`) — идентификатор магазина
   - **Client ID** (`clientId`) — идентификатор для мобильных приложений

### Пример:

```typescript
// Замените на ваши реальные значения
const CLIENT_ID = '12345678-1234-1234-1234-123456789012'
const SHOP_ID = '123456'
```

**⚠️ ВАЖНО:**

- `CLIENT_ID` и `SHOP_ID` можно использовать в приложении (они не секретные)
- `SECRET_KEY` используется ТОЛЬКО на сервере, никогда не добавляйте его в код приложения!

**Подробнее:** [SETUP_GUIDE.md](./SETUP_GUIDE.md#получение-client_id-и-shop_id)

## Настройка

### iOS

1. Убедитесь, что в `ios/Podfile` добавлена зависимость:

```ruby
pod 'YooKassaPayments', '~> 6.0'
```

2. Выполните:

```bash
cd ios && pod install
```

### Android

Зависимости уже добавлены в `build.gradle`:

```gradle
implementation 'ru.yoomoney.sdk:kassa-payments:6.4.0'
```

## Использование

### Инициализация

```typescript
import ExpoYookassa from 'expo-yookassa'

// Инициализация при запуске приложения
await ExpoYookassa.initialize('YOUR_CLIENT_ID', 'YOUR_SHOP_ID')
```

### Покупка подписки

#### Без авторизации (работа по ID подписки)

```typescript
import ExpoYookassa from 'expo-yookassa'

async function buySubscription() {
  try {
    const result = await ExpoYookassa.startSubscription({
      clientId: 'YOUR_CLIENT_ID',
      shopId: 'YOUR_SHOP_ID',
      subscriptionId: 'unique_subscription_id', // Уникальный ID подписки
      amount: 299.0,
      currency: 'RUB',
      title: 'Премиум подписка',
      subtitle: 'Доступ ко всем функциям',
      testMode: false, // false для продакшена, true для тестирования
    })

    // ID подписки автоматически сохраняется в SecureStore
    console.log('Subscription purchased:', result)

    // Отправьте токен на ваш сервер для создания платежа
    const serverResponse = await fetch('https://your-server.com/api/create-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: result.token,
        subscriptionId: result.subscriptionId,
      }),
    })

    if (serverResponse.ok) {
      const serverData = await serverResponse.json()

      // Сохраняем expiresAt и подпись от сервера для защиты от взлома
      if (serverData.expiresAt) {
        await ExpoYookassa.saveSubscriptionId(
          result.subscriptionId,
          serverData.paymentId,
          undefined, // userId если есть
          serverData.expiresAt,
          serverData.signature // Подпись от сервера
        )
      }
    }
  } catch (error) {
    console.error('Subscription purchase failed:', error)
  }
}
```

#### С авторизацией (работа по ID пользователя)

```typescript
import ExpoYookassa from 'expo-yookassa'

async function buySubscription(userId: string) {
  try {
    const result = await ExpoYookassa.startSubscription({
      clientId: 'YOUR_CLIENT_ID',
      shopId: 'YOUR_SHOP_ID',
      subscriptionId: 'unique_subscription_id',
      userId: userId, // ID авторизованного пользователя
      amount: 299.0,
      currency: 'RUB',
      title: 'Премиум подписка',
      subtitle: 'Доступ ко всем функциям',
      testMode: false,
    })

    // ID подписки автоматически сохраняется в SecureStore с привязкой к userId
    console.log('Subscription purchased:', result)

    // Отправьте токен на ваш сервер
    const serverResponse = await fetch('https://your-server.com/api/create-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: result.token,
        subscriptionId: result.subscriptionId,
        userId: userId,
      }),
    })

    if (serverResponse.ok) {
      const serverData = await serverResponse.json()

      // Сохраняем expiresAt и подпись от сервера
      if (serverData.expiresAt) {
        await ExpoYookassa.saveSubscriptionId(
          result.subscriptionId,
          serverData.paymentId,
          userId,
          serverData.expiresAt,
          serverData.signature
        )
      }
    }
  } catch (error) {
    console.error('Subscription purchase failed:', error)
  }
}
```

### Проверка подписки при запуске приложения

#### Без авторизации

```typescript
import ExpoYookassa from 'expo-yookassa'

async function checkSubscriptionOnStart() {
  // Проверка с запросом на ваш сервер
  const subscriptionInfo = await ExpoYookassa.verifySubscriptionOnStart(
    'https://your-server.com'
  )

  if (subscriptionInfo && subscriptionInfo.isActive) {
    console.log('Active subscription found:', subscriptionInfo)
    // Пользователь имеет активную подписку
  } else {
    console.log('No active subscription')
    // Пользователь не имеет активной подписки
  }
}
```

#### С авторизацией

```typescript
import ExpoYookassa from 'expo-yookassa'

async function checkSubscriptionOnStart(userId: string) {
  // Проверка с запросом на ваш сервер для конкретного пользователя
  // Если сервер недоступен, будет использован локальный период подписки
  // (если прошло менее 7 дней с последней проверки)
  const subscriptionInfo = await ExpoYookassa.verifySubscriptionOnStart(
    'https://your-server.com',
    userId, // ID авторизованного пользователя
    7 // gracePeriodDays - максимальное количество дней без проверки сервера
  )

  if (subscriptionInfo && subscriptionInfo.isActive) {
    console.log('Active subscription found:', subscriptionInfo)
    console.log('Expires at:', new Date(subscriptionInfo.expiresAt!))
    console.log('Last server check:', new Date(subscriptionInfo.lastServerCheck || 0))
  } else {
    console.log('No active subscription')
  }
}
```

#### С настройкой периода grace period

```typescript
import ExpoYookassa from 'expo-yookassa'

async function checkSubscriptionOnStart() {
  // Настройка: локальные данные действительны 14 дней без проверки сервера
  const subscriptionInfo = await ExpoYookassa.verifySubscriptionOnStart(
    'https://your-server.com',
    undefined, // userId
    14 // gracePeriodDays - 14 дней
  )

  if (subscriptionInfo && subscriptionInfo.isActive) {
    // Подписка активна (либо с сервера, либо из локального кеша)
    console.log('Subscription is active')
  }
}
```

### Отключение автопродления

#### Без авторизации

```typescript
import ExpoYookassa from 'expo-yookassa'

async function cancelAutoRenewal() {
  try {
    const subscriptionId = await ExpoYookassa.getSubscriptionId()

    if (subscriptionId) {
      // Отправьте запрос на ваш сервер для отмены подписки
      await fetch('https://your-server.com/api/cancel-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionId }),
      })

      // Отключение автопродления в модуле
      await ExpoYookassa.cancelSubscription(subscriptionId)

      console.log('Auto-renewal canceled')
    }
  } catch (error) {
    console.error('Failed to cancel subscription:', error)
  }
}
```

#### С авторизацией

```typescript
import ExpoYookassa from 'expo-yookassa'

async function cancelAutoRenewal(userId: string) {
  try {
    const subscriptionId = await ExpoYookassa.getSubscriptionId(userId)

    if (subscriptionId) {
      // Отправьте запрос на ваш сервер
      await fetch('https://your-server.com/api/cancel-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionId, userId }),
      })

      // Отключение автопродления в модуле
      await ExpoYookassa.cancelSubscription(subscriptionId, userId)

      console.log('Auto-renewal canceled')
    }
  } catch (error) {
    console.error('Failed to cancel subscription:', error)
  }
}
```

### Работа с SecureStore

Модуль автоматически сохраняет ID подписки и платежа в SecureStore. Вы также можете работать с ними напрямую:

#### Без авторизации

```typescript
// Получить сохраненный ID подписки
const subscriptionId = await ExpoYookassa.getSubscriptionId()

// Получить сохраненный ID платежа
const paymentId = await ExpoYookassa.getPaymentId()

// Сохранить ID подписки вручную
await ExpoYookassa.saveSubscriptionId('subscription_123', 'payment_456')

// Очистить сохраненные данные
await ExpoYookassa.clearSubscriptionData()
```

#### С авторизацией

```typescript
const userId = 'user_123'

// Получить сохраненный ID подписки для пользователя
const subscriptionId = await ExpoYookassa.getSubscriptionId(userId)

// Получить сохраненный ID платежа для пользователя
const paymentId = await ExpoYookassa.getPaymentId(userId)

// Сохранить ID подписки вручную с привязкой к пользователю
await ExpoYookassa.saveSubscriptionId('subscription_123', 'payment_456', userId)

// Очистить сохраненные данные для пользователя
await ExpoYookassa.clearSubscriptionData(userId)
```

### Обычный платеж (без подписки)

```typescript
import ExpoYookassa from 'expo-yookassa'

async function makePayment() {
  try {
    const result = await ExpoYookassa.startTokenization({
      clientId: 'YOUR_CLIENT_ID',
      shopId: 'YOUR_SHOP_ID',
      amount: 100.0,
      currency: 'RUB',
      title: 'Оплата товара',
      subtitle: 'Описание товара',
      testMode: false, // false для продакшена, true для тестирования
    })

    console.log('Payment token:', result.token)

    // Отправьте токен на ваш сервер
    await fetch('https://your-server.com/api/create-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: result.token }),
    })
  } catch (error) {
    console.error('Payment failed:', error)
  }
}
```

## API Reference

### Методы

#### `initialize(clientId: string, shopId: string): Promise<void>`

Инициализирует YooKassa SDK.

#### `startSubscription(params: TokenizationParams & { subscriptionId: string; userId?: string }): Promise<TokenizationResult>`

Запускает процесс покупки подписки. Автоматически сохраняет ID подписки в SecureStore. Если передан `userId`, данные сохраняются с привязкой к пользователю.

#### `startTokenization(params: TokenizationParams): Promise<TokenizationResult>`

Запускает процесс обычного платежа.

#### `verifySubscriptionOnStart(serverUrl?: string, userId?: string, gracePeriodDays?: number): Promise<SubscriptionInfo | null>`

Проверяет наличие активной подписки при запуске приложения. Рекомендуется вызывать при старте приложения.

**Логика работы:**

- Если сервер доступен и подписка активна → обновляет локальные данные
- Если сервер недоступен → использует локальный `expiresAt` (если прошло менее `gracePeriodDays` дней)
- Если сервер явно говорит что подписки нет → удаляет локальные данные
- Если прошло более `gracePeriodDays` дней без проверки → требует проверку сервера

**Параметры:**

- `serverUrl` - URL сервера для проверки (опционально)
- `userId` - ID пользователя (опционально)
- `gracePeriodDays` - Максимальное количество дней без проверки сервера (по умолчанию 7)

#### `checkSubscriptionStatus(subscriptionId?: string, userId?: string): Promise<SubscriptionStatus>`

Проверяет статус подписки. Если передан `userId`, проверяет подписку для конкретного пользователя.

#### `cancelSubscription(subscriptionId?: string, userId?: string): Promise<boolean>`

Отключает автопродление подписки. Если передан `userId`, работает с подпиской конкретного пользователя.

#### `getSubscriptionId(userId?: string): Promise<string | null>`

Получает сохраненный ID подписки из SecureStore. Если передан `userId`, возвращает подписку для конкретного пользователя.

#### `getPaymentId(userId?: string): Promise<string | null>`

Получает сохраненный ID платежа из SecureStore. Если передан `userId`, возвращает платеж для конкретного пользователя.

#### `saveSubscriptionId(subscriptionId: string, paymentId?: string, userId?: string, expiresAt?: number, serverSignature?: string): Promise<void>`

Сохраняет ID подписки в SecureStore. Если передан `userId`, сохраняет с привязкой к пользователю.

**Параметры:**

- `subscriptionId` - ID подписки
- `paymentId` - ID платежа (опционально)
- `userId` - ID пользователя (опционально)
- `expiresAt` - Дата истечения подписки в миллисекундах (опционально, но рекомендуется)
- `serverSignature` - Подпись данных от сервера для защиты от взлома (опционально)

#### `clearSubscriptionData(userId?: string): Promise<void>`

Удаляет сохраненные данные подписки из SecureStore. Если передан `userId`, удаляет данные для конкретного пользователя.

## Типы

```typescript
interface TokenizationParams {
  clientId: string
  shopId: string
  amount: number
  currency?: string
  title: string
  subtitle?: string
  savePaymentMethod?: 'ON' | 'OFF' | 'USER_SELECTS'
  paymentMethodTypes?: Array<'BANK_CARD' | 'SBERBANK' | 'YOO_MONEY'>
  returnUrl?: string
  gatewayId?: string
  isRecurring?: boolean
  subscriptionId?: string
  testMode?: boolean
  userId?: string
}

interface TokenizationResult {
  token: string
  type: string
  paymentMethodId?: string
  paymentId?: string
  subscriptionId?: string
}

interface SubscriptionInfo {
  subscriptionId: string
  paymentId: string
  isActive: boolean
  expiresAt?: number
  autoRenewalEnabled: boolean
  lastServerCheck?: number // Timestamp последней успешной проверки на сервере
  serverSignature?: string // Подпись данных от сервера для защиты от взлома
}

interface SubscriptionStatus {
  isActive: boolean
  subscriptionId?: string
  expiresAt?: number
  autoRenewalEnabled?: boolean
}
```

## Важные замечания

1. **Безопасность**: Никогда не храните секретные ключи в клиентском приложении. Все операции с платежами должны проходить через ваш сервер.

2. **Проверка подписки**: После получения токена от YooKassa, отправьте его на ваш сервер для создания платежа и проверки статуса подписки.

3. **Отключение автопродления**: В соответствии с законодательством, обязательно предоставьте пользователям возможность отключить автопродление подписки.

4. **Тестовый режим**: По умолчанию `testMode: false`. Установите `testMode: true` в параметрах для тестирования.

5. **Работа с авторизацией**:
   - Если пользователь не авторизован, модуль работает по ID подписки
   - Если пользователь авторизован, передавайте `userId` в параметрах - данные будут сохраняться с привязкой к пользователю

6. **Работа при недоступности сервера**:
   - Модуль автоматически использует локально сохраненный период подписки (`expiresAt`)
   - Локальные данные действительны в течение `gracePeriodDays` (по умолчанию 7 дней) без проверки сервера
   - Если сервер явно говорит что подписки нет - локальные данные удаляются
   - Для защиты от взлома сервер должен возвращать криптографическую подпись данных

7. **Защита от взлома**:
   - Сервер должен возвращать `signature` при проверке статуса подписки
   - Подпись создается на основе `subscriptionId` и `expiresAt` с использованием секретного ключа
   - Локальные данные защищены от изменения через SecureStore и проверку подписи

## Сборка и публикация модуля

### Сборка модуля

```bash
# Установка зависимостей
npm install

# Сборка TypeScript
npm run build

# Проверка
npm run lint
```

### Локальная установка в проект

```bash
# В вашем проекте добавьте в package.json:
{
  "dependencies": {
    "expo-yookassa": "file:../expo-yookassa"
  }
}

# Затем установите
npm install
```

### Публикация в npm

```bash
# 1. Обновите версию
npm version patch  # или minor, major

# 2. Соберите модуль
npm run build

# 3. Опубликуйте
npm publish --access public
```

**Подробные инструкции:** [SETUP_GUIDE.md](./SETUP_GUIDE.md)

## Лицензия

MIT
