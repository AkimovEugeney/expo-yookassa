# Руководство по настройке и использованию модуля

## Получение CLIENT_ID и SHOP_ID

### Шаг 1: Регистрация в YooKassa

1. Перейдите на сайт [YooKassa](https://yookassa.ru/)
2. Зарегистрируйте аккаунт или войдите в существующий
3. Перейдите в [Личный кабинет](https://yookassa.ru/my)

### Шаг 2: Получение идентификаторов

1. В личном кабинете перейдите в раздел **"Настройки"** → **"API"**
2. Найдите следующие значения:
   - **Shop ID** (shopId) — идентификатор магазина
   - **Secret Key** — секретный ключ (используется только на сервере, НЕ в приложении!)
   - **Client ID** (clientId) — идентификатор клиента для мобильных приложений

### Шаг 3: Тестовые данные

Для тестирования используйте тестовые данные:

- Тестовые карты: https://yookassa.ru/developers/using-api/testing
- В тестовом режиме можно использовать любые тестовые Shop ID и Client ID

**⚠️ ВАЖНО:**

- `CLIENT_ID` и `SHOP_ID` можно использовать в мобильном приложении (они не секретные)
- `SECRET_KEY` используется ТОЛЬКО на сервере, никогда не добавляйте его в код приложения!

## Сборка модуля

### 1. Установка зависимостей

```bash
# В корне проекта модуля
npm install
```

### 2. Сборка TypeScript

```bash
npm run build
```

Эта команда:

- Компилирует TypeScript в JavaScript
- Генерирует типы (.d.ts файлы)
- Создает файлы в папке `build/`

### 3. Проверка сборки

```bash
# Проверка линтера
npm run lint

# Запуск тестов (если есть)
npm test
```

## Установка модуля локально в проект

### Способ 1: Через file: (рекомендуется для разработки)

1. В вашем проекте добавьте зависимость в `package.json`:

```json
{
  "dependencies": {
    "expo-yookassa": "file:../expo-yookassa"
  }
}
```

Или через npm:

```bash
# Из корня вашего проекта
npm install file:../expo-yookassa
```

**Путь должен быть относительным** от вашего проекта до папки модуля.

### Способ 2: Через npm link (для активной разработки)

1. В папке модуля:

```bash
cd /Users/eugeney/learn/expo-yookassa
npm link
```

2. В вашем проекте:

```bash
cd /path/to/your/project
npm link expo-yookassa
```

3. Для Expo проектов также нужно:

```bash
# В вашем проекте
npx expo install expo-secure-store
cd ios && pod install  # для iOS
```

### Способ 3: Через относительный путь (если модуль в монорепо)

Если модуль находится в том же репозитории:

```json
{
  "dependencies": {
    "expo-yookassa": "workspace:*"
  }
}
```

## Использование в проекте

### 1. Установите зависимости

```bash
npm install
# или
yarn install
```

### 2. Для iOS (если используете Custom Dev Client)

```bash
cd ios
pod install
cd ..
```

### 3. Используйте модуль в коде

```typescript
import ExpoYookassa from 'expo-yookassa'

// Инициализация
await ExpoYookassa.initialize('YOUR_CLIENT_ID', 'YOUR_SHOP_ID')

// Использование методов
const result = await ExpoYookassa.startSubscription({
  clientId: 'YOUR_CLIENT_ID',
  shopId: 'YOUR_SHOP_ID',
  // ... остальные параметры
})
```

## Публикация модуля в npm

### 1. Подготовка к публикации

1. Убедитесь, что версия в `package.json` обновлена:

```json
{
  "version": "0.1.0" // Увеличьте версию перед публикацией
}
```

2. Проверьте, что все файлы собраны:

```bash
npm run build
```

3. Проверьте `.npmignore` или убедитесь, что в `package.json` указаны правильные файлы:

```json
{
  "files": ["build", "src", "ios", "android", "expo-module.config.json", "README.md"]
}
```

### 2. Создание аккаунта на npm (если еще нет)

```bash
npm adduser
# или
npm login
```

### 3. Проверка перед публикацией

```bash
# Проверка, что пакет готов к публикации
npm pack

# Это создаст файл expo-yookassa-0.1.0.tgz
# Распакуйте и проверьте содержимое
```

### 4. Публикация

#### Первая публикация (публичный пакет):

```bash
npm publish --access public
```

#### Обновление версии:

```bash
# Обновите версию в package.json
npm version patch  # для патча (0.1.0 -> 0.1.1)
# или
npm version minor  # для минорного обновления (0.1.0 -> 0.2.0)
# или
npm version major  # для мажорного обновления (0.1.0 -> 1.0.0)

# Затем опубликуйте
npm publish
```

### 5. Проверка публикации

После публикации проверьте:

```bash
# Проверьте, что пакет доступен
npm view expo-yookassa

# Или на сайте
# https://www.npmjs.com/package/expo-yookassa
```

## Установка опубликованного модуля

После публикации в npm, установка в проекте:

```bash
npm install expo-yookassa
# или
yarn add expo-yookassa
```

## Структура файлов для публикации

Убедитесь, что в репозитории есть:

```
expo-yookassa/
├── build/              # Скомпилированные файлы
├── src/                # Исходные TypeScript файлы
├── ios/                # iOS нативный код
├── android/            # Android нативный код
├── package.json        # Конфигурация пакета
├── expo-module.config.json
├── README.md           # Документация
└── tsconfig.json       # TypeScript конфигурация
```

## Troubleshooting

### Проблема: Модуль не найден после установки

**Решение:**

1. Убедитесь, что модуль собран: `npm run build`
2. Проверьте путь в `package.json`: `"main": "build/index.js"`
3. Переустановите зависимости: `rm -rf node_modules && npm install`

### Проблема: Ошибки при сборке iOS

**Решение:**

```bash
cd ios
pod deintegrate
pod install
cd ..
```

### Проблема: Ошибки TypeScript

**Решение:**

```bash
npm run build
# Проверьте ошибки и исправьте их
```

### Проблема: Модуль не работает в Custom Dev Client

**Решение:**

1. Убедитесь, что используете Custom Dev Client (не Expo Go)
2. Пересоберите приложение:
   ```bash
   npx expo prebuild
   npx expo run:ios  # или run:android
   ```

## Полезные команды

```bash
# Сборка
npm run build

# Очистка
npm run clean

# Линтинг
npm run lint

# Тестирование
npm test

# Подготовка к публикации
npm run prepublishOnly
```

## Дополнительные ресурсы

- [Документация YooKassa](https://yookassa.ru/developers)
- [Документация Expo Modules](https://docs.expo.dev/modules/overview/)
- [npm Publishing Guide](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry)
