# Настройка сервера для работы с подписками

Этот документ описывает, как настроить ваш сервер для работы с подписками через YooKassa.

## Общая схема работы

1. Клиент получает токен от YooKassa SDK
2. Клиент отправляет токен на ваш сервер
3. Сервер создает платеж через YooKassa API
4. Сервер сохраняет информацию о подписке в базе данных
5. Клиент проверяет статус подписки через ваш API

## API Endpoints

### 1. Создание платежа (POST /api/create-payment)

Принимает токен от клиента и создает платеж через YooKassa API.

**Request:**
```json
{
  "token": "payment_token_from_yookassa",
  "subscriptionId": "unique_subscription_id",
  "paymentMethodId": "payment_method_id"
}
```

**Response:**
```json
{
  "success": true,
  "paymentId": "yookassa_payment_id",
  "subscriptionId": "unique_subscription_id",
  "status": "succeeded"
}
```

**Пример реализации (Node.js):**

```javascript
const axios = require('axios');

app.post('/api/create-payment', async (req, res) => {
  const { token, subscriptionId, paymentMethodId } = req.body;
  
  try {
    // Создаем платеж через YooKassa API
    const paymentResponse = await axios.post(
      'https://api.yookassa.ru/v3/payments',
      {
        amount: {
          value: '299.00',
          currency: 'RUB'
        },
        confirmation: {
          type: 'redirect',
          return_url: 'your-app://payment-success'
        },
        capture: true,
        payment_method_id: paymentMethodId, // Для подписок
        description: `Подписка ${subscriptionId}`,
        metadata: {
          subscriptionId: subscriptionId
        }
      },
      {
        auth: {
          username: 'YOUR_SHOP_ID',
          password: 'YOUR_SECRET_KEY'
        },
        headers: {
          'Idempotence-Key': subscriptionId // Уникальный ключ
        }
      }
    );

    // Сохраняем информацию о подписке в БД
    await saveSubscription({
      subscriptionId,
      paymentId: paymentResponse.data.id,
      userId: req.user.id, // Из сессии/токена
      status: 'active',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 дней
      autoRenewalEnabled: true
    });

    res.json({
      success: true,
      paymentId: paymentResponse.data.id,
      subscriptionId,
      status: paymentResponse.data.status
    });
  } catch (error) {
    console.error('Payment creation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
```

### 2. Проверка статуса подписки (POST /api/subscription/status)

Проверяет статус подписки пользователя. **ВАЖНО:** Должен возвращать `expiresAt` и `signature` для защиты от взлома.

**Request:**
```json
{
  "subscriptionId": "unique_subscription_id",
  "userId": "user_123" // опционально
}
```

**Response (подписка активна):**
```json
{
  "isActive": true,
  "subscriptionId": "unique_subscription_id",
  "paymentId": "yookassa_payment_id",
  "expiresAt": 1234567890,
  "autoRenewalEnabled": true,
  "signature": "hmac_signature_for_security"
}
```

**Response (подписки нет):**
```json
{
  "isActive": false,
  "subscriptionNotFound": true
}
```

**Пример реализации:**

```javascript
const crypto = require('crypto');

// Секретный ключ для подписи (храните в переменных окружения!)
const SIGNATURE_SECRET = process.env.SUBSCRIPTION_SIGNATURE_SECRET || 'your-secret-key';

// Функция для создания подписи данных
function createSignature(subscriptionId, expiresAt) {
  const data = `${subscriptionId}:${expiresAt}`;
  return crypto
    .createHmac('sha256', SIGNATURE_SECRET)
    .update(data)
    .digest('hex');
}

app.post('/api/subscription/status', async (req, res) => {
  const { subscriptionId, userId } = req.body;
  
  try {
    // Если передан userId, ищем подписку по userId
    const subscription = userId 
      ? await getSubscriptionByUserId(userId)
      : await getSubscription(subscriptionId);
    
    if (!subscription) {
      return res.json({
        isActive: false,
        subscriptionNotFound: true
      });
    }

    // Проверяем, не истекла ли подписка
    const expiresAtTimestamp = subscription.expiresAt.getTime();
    const isActive = subscription.status === 'active' && 
                     expiresAtTimestamp > Date.now();

    if (!isActive) {
      return res.json({
        isActive: false,
        subscriptionNotFound: true
      });
    }

    // Создаем подпись для защиты от взлома
    const signature = createSignature(
      subscription.subscriptionId,
      expiresAtTimestamp
    );

    res.json({
      isActive: true,
      subscriptionId: subscription.subscriptionId,
      paymentId: subscription.paymentId,
      expiresAt: expiresAtTimestamp,
      autoRenewalEnabled: subscription.autoRenewalEnabled,
      signature: signature // Подпись для защиты от взлома
    });
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ 
      isActive: false,
      subscriptionNotFound: true 
    });
  }
});
```

### 3. Отмена подписки (POST /api/cancel-subscription)

Отключает автопродление подписки.

**Request:**
```json
{
  "subscriptionId": "unique_subscription_id"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Автопродление отключено"
}
```

**Пример реализации:**

```javascript
app.post('/api/cancel-subscription', async (req, res) => {
  const { subscriptionId } = req.body;
  
  try {
    // Обновляем статус в БД
    await updateSubscription(subscriptionId, {
      autoRenewalEnabled: false
    });

    // Опционально: отменяем подписку через YooKassa API
    // (если используете рекуррентные платежи через YooKassa)

    res.json({
      success: true,
      message: 'Автопродление отключено'
    });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
```

## Webhook для обработки уведомлений от YooKassa

YooKassa отправляет уведомления о статусе платежей через webhook.

**Endpoint: POST /api/yookassa-webhook**

```javascript
app.post('/api/yookassa-webhook', async (req, res) => {
  const event = req.body;
  
  // Проверяем подпись (важно для безопасности)
  // const isValid = verifySignature(req.headers, req.body);
  // if (!isValid) return res.status(401).send('Invalid signature');

  if (event.event === 'payment.succeeded') {
    const paymentId = event.object.id;
    const subscriptionId = event.object.metadata?.subscriptionId;
    
    if (subscriptionId) {
      // Обновляем статус подписки
      await updateSubscription(subscriptionId, {
        status: 'active',
        paymentId,
        lastPaymentDate: new Date()
      });
    }
  } else if (event.event === 'payment.canceled') {
    const subscriptionId = event.object.metadata?.subscriptionId;
    
    if (subscriptionId) {
      await updateSubscription(subscriptionId, {
        status: 'canceled'
      });
    }
  }

  res.status(200).send('OK');
});
```

## База данных

Пример схемы для хранения подписок:

```sql
CREATE TABLE subscriptions (
  id SERIAL PRIMARY KEY,
  subscription_id VARCHAR(255) UNIQUE NOT NULL,
  user_id INTEGER NOT NULL,
  payment_id VARCHAR(255),
  status VARCHAR(50) NOT NULL, -- 'active', 'canceled', 'expired'
  expires_at TIMESTAMP,
  auto_renewal_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## Безопасность

1. **Никогда не храните секретные ключи в клиентском приложении**
2. **Всегда проверяйте подпись webhook от YooKassa**
3. **Используйте HTTPS для всех API запросов**
4. **Валидируйте все данные от клиента**
5. **Используйте idempotence-key для предотвращения дублирования платежей**
6. **Используйте криптографическую подпись для защиты локальных данных подписки**

### Защита от взлома локальных данных

Модуль использует локальное кеширование данных подписки для работы при недоступности сервера. Для защиты от взлома:

1. **Сервер должен возвращать подпись (`signature`)** при проверке статуса подписки
2. **Подпись создается на основе `subscriptionId` и `expiresAt`** с использованием секретного ключа
3. **Локальные данные действительны только в течение `gracePeriodDays`** (по умолчанию 7 дней) без проверки сервера
4. **Если сервер явно говорит что подписки нет** - локальные данные удаляются

**Пример создания подписи на сервере:**
```javascript
const crypto = require('crypto');

function createSignature(subscriptionId, expiresAt) {
  const secret = process.env.SUBSCRIPTION_SIGNATURE_SECRET;
  const data = `${subscriptionId}:${expiresAt}`;
  return crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('hex');
}
```

## Тестирование

Для тестирования используйте тестовые данные YooKassa:
- Тестовые карты: https://yookassa.ru/developers/using-api/testing
- Тестовый режим включен по умолчанию в модуле

## Дополнительные ресурсы

- [Документация YooKassa API](https://yookassa.ru/developers/api)
- [Рекуррентные платежи](https://yookassa.ru/developers/using-api/recurring-payments)
- [Webhook уведомления](https://yookassa.ru/developers/using-api/webhooks)

