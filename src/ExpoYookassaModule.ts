import { EventEmitter, requireNativeModule } from 'expo-modules-core'

import { Platform } from 'react-native'
import type {
  ExpoYookassaEventSubscription,
  ExpoYookassaModuleEvents,
  LocalSubscriptionData,
  PaymentError,
  SubscriptionInfo,
  SubscriptionStatus,
  TokenizationParams,
  TokenizationResult,
} from './ExpoYookassa.types'

let SecureStore: typeof import('expo-secure-store');
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  SecureStore = require('expo-secure-store');
} catch (error) {
  SecureStore = undefined as unknown as typeof import('expo-secure-store');
}

// Интерфейс нативного модуля
interface NativeExpoYookassaModule {
  initialize(clientId: string, shopId: string): Promise<void>;
  startTokenization(params: any): Promise<TokenizationResult>;

  // Методы для подписок
  startSubscription?(params: any): Promise<TokenizationResult>;
  cancelSubscription?(subscriptionId: string): Promise<boolean>;
  checkSubscriptionStatus?(subscriptionId: string): Promise<SubscriptionStatus>;
  // iOS специфичные методы
  confirm3DS?(confirmationUrl: string, paymentMethodType: string): Promise<boolean>;
  // Android специфичные методы  
  isPaymentMethodAvailable?(methodType: string): Promise<boolean>;
}

// Получаем нативный модуль
const nativeModule = requireNativeModule<NativeExpoYookassaModule>('ExpoYookassa');
const emitter = new EventEmitter<ExpoYookassaModuleEvents>(nativeModule as any);

/**
 * Основной класс модуля YooKassa
 */
class ExpoYookassa {
  /**
   * Инициализация YooKassa SDK
   * @param clientId - Client ID из личного кабинета YooKassa
   * @param shopId - Shop ID из личного кабинета YooKassa
   */
  async initialize(clientId: string, shopId: string): Promise<void> {
    if (!clientId || !shopId) {
      throw new Error('clientId and shopId are required');
    }
    
    try {
      await nativeModule.initialize(clientId, shopId);
    } catch (error) {
      throw new Error(`Failed to initialize YooKassa: ${error}`);
    }
  }

  /**
   * Запуск процесса токенизации платежа
   * @param params - Параметры платежа
   * @returns Результат токенизации
   */
  async startTokenization(params: TokenizationParams): Promise<TokenizationResult> {
    try {
      const result = await nativeModule.startTokenization({
        ...params,
        currency: params.currency || 'RUB',
        savePaymentMethod: params.savePaymentMethod || 'OFF',
        paymentMethodTypes: params.paymentMethodTypes || ['BANK_CARD', 'SBERBANK'],
        testMode: params.testMode ?? false,
      });
      
      return result;
    } catch (error: any) {
      // Нормализуем ошибки
      if (error.code === 'TOKENIZATION_CANCELED') {
        throw new Error('Payment was canceled by user');
      }
      
      if (error.code === 'TOKENIZATION_FAILED') {
        throw new Error(`Payment failed: ${error.message}`);
      }
      
      throw error;
    }
  }

  /**
   * Подтверждение 3DS (только iOS)
   * @param confirmationUrl - URL для подтверждения
   * @param paymentMethodType - Тип платежного метода
   */
  async confirm3DS(confirmationUrl: string, paymentMethodType: string): Promise<boolean> {
    if (Platform.OS !== 'ios') {
      throw new Error('3DS confirmation is only available on iOS');
    }
    
    if (!nativeModule.confirm3DS) {
      throw new Error('3DS confirmation is not supported by the native module');
    }
    
    try {
      return await nativeModule.confirm3DS(confirmationUrl, paymentMethodType);
    } catch (error) {
      throw new Error(`3DS confirmation failed: ${error}`);
    }
  }

  /**
   * Проверка доступности платежного метода (только Android)
   * @param methodType - Тип платежного метода
   */
  async isPaymentMethodAvailable(methodType: string): Promise<boolean> {
    if (Platform.OS !== 'android') {
      throw new Error('This method is only available on Android');
    }
    
    if (!nativeModule.isPaymentMethodAvailable) {
      return Promise.resolve(true); // По умолчанию доступен
    }
    
    return await nativeModule.isPaymentMethodAvailable(methodType);
  }

  /**
   * Запуск процесса покупки подписки
   * @param params - Параметры подписки
   * @returns Результат токенизации с информацией о подписке
   */
  async startSubscription(params: TokenizationParams & { subscriptionId: string; userId?: string }): Promise<TokenizationResult> {
    try {
      const result = await nativeModule.startSubscription?.({
        ...params,
        currency: params.currency || 'RUB',
        savePaymentMethod: params.savePaymentMethod || 'ON', // Для подписок обычно ON
        isRecurring: true,
        testMode: params.testMode ?? false,
      }) || await this.startTokenization({
        ...params,
        isRecurring: true,
        testMode: params.testMode ?? false,
      });
      
      // Сохраняем ID подписки в SecureStore
      // expiresAt будет сохранен после успешного ответа от сервера
      if (result.subscriptionId || params.subscriptionId) {
        const subscriptionId = result.subscriptionId || params.subscriptionId;
        
        // Если есть userId, сохраняем с привязкой к пользователю
        if (params.userId) {
          await SecureStore.setItemAsync(`yookassa_subscription_id_${params.userId}`, subscriptionId);
        } else {
          // Если нет авторизации, сохраняем просто по ID подписки
          await SecureStore.setItemAsync('yookassa_subscription_id', subscriptionId);
        }
      }
      
      // Сохраняем payment id если есть
      if (result.paymentId) {
        if (params.userId) {
          await SecureStore.setItemAsync(`yookassa_payment_id_${params.userId}`, result.paymentId);
        } else {
          await SecureStore.setItemAsync('yookassa_payment_id', result.paymentId);
        }
      }
      
      return result;
    } catch (error: any) {
      throw new Error(`Subscription purchase failed: ${error.message || error}`);
    }
  }

  /**
   * Сохранение локальных данных подписки
   * @param data - Данные подписки для сохранения
   * @param userId - ID пользователя (опционально)
   */
  private async saveLocalSubscriptionData(data: LocalSubscriptionData, userId?: string): Promise<void> {
    try {
      const key = userId ? `yookassa_subscription_data_${userId}` : 'yookassa_subscription_data';
      await SecureStore.setItemAsync(key, JSON.stringify(data));
    } catch (error) {
      throw new Error(`Failed to save local subscription data: ${error}`);
    }
  }

  /**
   * Получение локальных данных подписки
   * @param userId - ID пользователя (опционально)
   * @returns Локальные данные подписки или null
   */
  private async getLocalSubscriptionData(userId?: string): Promise<LocalSubscriptionData | null> {
    try {
      const key = userId ? `yookassa_subscription_data_${userId}` : 'yookassa_subscription_data';
      const data = await SecureStore.getItemAsync(key);
      if (!data) return null;
      return JSON.parse(data) as LocalSubscriptionData;
    } catch (error) {
      return null;
    }
  }

  /**
   * Сохранение ID подписки в SecureStore
   * @param subscriptionId - ID подписки
   * @param paymentId - ID платежа (опционально)
   * @param userId - ID пользователя (опционально, если пользователь авторизован)
   * @param expiresAt - Дата истечения подписки (опционально)
   * @param serverSignature - Подпись данных от сервера для защиты от взлома (опционально)
   */
  async saveSubscriptionId(
    subscriptionId: string, 
    paymentId?: string, 
    userId?: string,
    expiresAt?: number,
    serverSignature?: string
  ): Promise<void> {
    try {
      const key = userId ? `yookassa_subscription_id_${userId}` : 'yookassa_subscription_id';
      await SecureStore.setItemAsync(key, subscriptionId);
      
      if (paymentId) {
        const paymentKey = userId ? `yookassa_payment_id_${userId}` : 'yookassa_payment_id';
        await SecureStore.setItemAsync(paymentKey, paymentId);
      }

      // Сохраняем локальные данные подписки
      if (expiresAt) {
        await this.saveLocalSubscriptionData({
          subscriptionId,
          expiresAt,
          lastServerCheck: Date.now(),
          serverSignature,
          gracePeriodDays: 7, // По умолчанию 7 дней без проверки сервера
        }, userId);
      }
    } catch (error) {
      throw new Error(`Failed to save subscription ID: ${error}`);
    }
  }

  /**
   * Получение сохраненного ID подписки из SecureStore
   * @param userId - ID пользователя (опционально, если пользователь авторизован)
   * @returns ID подписки или null
   */
  async getSubscriptionId(userId?: string): Promise<string | null> {
    try {
      const key = userId ? `yookassa_subscription_id_${userId}` : 'yookassa_subscription_id';
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      return null;
    }
  }

  /**
   * Получение сохраненного ID платежа из SecureStore
   * @param userId - ID пользователя (опционально, если пользователь авторизован)
   * @returns ID платежа или null
   */
  async getPaymentId(userId?: string): Promise<string | null> {
    try {
      const key = userId ? `yookassa_payment_id_${userId}` : 'yookassa_payment_id';
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      return null;
    }
  }

  /**
   * Удаление сохраненных данных подписки из SecureStore
   * @param userId - ID пользователя (опционально, если пользователь авторизован)
   */
  async clearSubscriptionData(userId?: string): Promise<void> {
    try {
      if (userId) {
        await SecureStore.deleteItemAsync(`yookassa_subscription_id_${userId}`);
        await SecureStore.deleteItemAsync(`yookassa_payment_id_${userId}`);
        await SecureStore.deleteItemAsync(`yookassa_subscription_data_${userId}`);
      } else {
        await SecureStore.deleteItemAsync('yookassa_subscription_id');
        await SecureStore.deleteItemAsync('yookassa_payment_id');
        await SecureStore.deleteItemAsync('yookassa_subscription_data');
      }
    } catch (error) {
      // Игнорируем ошибки при удалении
    }
  }

  /**
   * Проверка статуса подписки
   * @param subscriptionId - ID подписки (если не указан, берется из SecureStore)
   * @param userId - ID пользователя (опционально, если пользователь авторизован)
   * @returns Статус подписки
   */
  async checkSubscriptionStatus(subscriptionId?: string, userId?: string): Promise<SubscriptionStatus> {
    try {
      const id = subscriptionId || await this.getSubscriptionId(userId);
      
      if (!id) {
        return { isActive: false };
      }

      // Если есть нативный метод, используем его
      if (nativeModule.checkSubscriptionStatus) {
        return await nativeModule.checkSubscriptionStatus(id);
      }

      // Иначе возвращаем базовую информацию
      return {
        isActive: true,
        subscriptionId: id,
      };
    } catch (error) {
      throw new Error(`Failed to check subscription status: ${error}`);
    }
  }

  /**
   * Отключение автопродления подписки
   * @param subscriptionId - ID подписки (если не указан, берется из SecureStore)
   * @param userId - ID пользователя (опционально, если пользователь авторизован)
   * @returns Успешность операции
   */
  async cancelSubscription(subscriptionId?: string, userId?: string): Promise<boolean> {
    try {
      const id = subscriptionId || await this.getSubscriptionId(userId);
      
      if (!id) {
        throw new Error('Subscription ID not found');
      }

      // Если есть нативный метод, используем его
      if (nativeModule.cancelSubscription) {
        const result = await nativeModule.cancelSubscription(id);
        return result;
      }

      // Иначе просто возвращаем успех (реальная отмена должна быть на сервере)
      return true;
    } catch (error) {
      throw new Error(`Failed to cancel subscription: ${error}`);
    }
  }

  /**
   * Проверка наличия активной подписки при запуске приложения
   * Рекомендуется вызывать при старте приложения
   * 
   * Логика работы:
   * 1. Если сервер доступен и говорит что подписка активна - обновляем локальные данные
   * 2. Если сервер недоступен - используем локальный expiresAt (если прошло менее gracePeriodDays)
   * 3. Если сервер явно говорит что подписки нет - удаляем локальные данные
   * 
   * @param serverUrl - URL вашего сервера для проверки статуса (опционально)
   * @param userId - ID пользователя (опционально, если пользователь авторизован)
   * @param gracePeriodDays - Максимальное количество дней без проверки сервера (по умолчанию 7)
   * @returns Информация о подписке
   */
  async verifySubscriptionOnStart(
    serverUrl?: string, 
    userId?: string,
    gracePeriodDays: number = 7
  ): Promise<SubscriptionInfo | null> {
    try {
      const subscriptionId = await this.getSubscriptionId(userId);
      
      if (!subscriptionId) {
        return null;
      }

      // Получаем локальные данные подписки
      const localData = await this.getLocalSubscriptionData(userId);
      const now = Date.now();

      // Если указан URL сервера, пытаемся проверить на сервере
      if (serverUrl) {
        try {
          const requestBody: any = { subscriptionId };
          if (userId) {
            requestBody.userId = userId;
          }

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 секунд таймаут

          const response = await fetch(`${serverUrl}/api/subscription/status`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
          });
          
          clearTimeout(timeoutId);

          if (response.ok) {
            const data = await response.json();
            
            // Если сервер явно говорит что подписки нет
            if (data.isActive === false || data.subscriptionNotFound === true) {
              // Удаляем локальные данные
              await this.clearSubscriptionData(userId);
              return null;
            }

            // Если подписка активна - обновляем локальные данные
            if (data.isActive && data.expiresAt) {
              const subscriptionInfo: SubscriptionInfo = {
                subscriptionId,
                paymentId: data.paymentId || await this.getPaymentId(userId) || '',
                isActive: true,
                expiresAt: data.expiresAt,
                autoRenewalEnabled: data.autoRenewalEnabled !== false,
                lastServerCheck: now,
                serverSignature: data.signature, // Подпись от сервера для защиты
              };

              // Сохраняем обновленные локальные данные
              await this.saveLocalSubscriptionData({
                subscriptionId,
                expiresAt: data.expiresAt,
                lastServerCheck: now,
                serverSignature: data.signature,
                gracePeriodDays,
              }, userId);

              return subscriptionInfo;
            }
          }
        } catch (error: any) {
          // Сервер недоступен или ошибка сети
          console.warn('Server unavailable, using local subscription data:', error.message);
          
          // Используем локальные данные если они есть
          if (localData) {
            const daysSinceLastCheck = (now - localData.lastServerCheck) / (1000 * 60 * 60 * 24);
            const gracePeriod = localData.gracePeriodDays || gracePeriodDays;

            // Проверяем что не прошло слишком много времени с последней проверки
            if (daysSinceLastCheck <= gracePeriod) {
              // Проверяем что подписка еще не истекла
              if (localData.expiresAt > now) {
                return {
                  subscriptionId: localData.subscriptionId,
                  paymentId: await this.getPaymentId(userId) || '',
                  isActive: true,
                  expiresAt: localData.expiresAt,
                  autoRenewalEnabled: true, // По умолчанию true, если нет данных
                  lastServerCheck: localData.lastServerCheck,
                  serverSignature: localData.serverSignature,
                };
              } else {
                // Подписка истекла локально
                await this.clearSubscriptionData(userId);
                return null;
              }
            } else {
              // Прошло слишком много времени без проверки - требуем проверку сервера
              console.warn(`Grace period exceeded (${daysSinceLastCheck.toFixed(1)} days). Server check required.`);
              // Не удаляем данные, но возвращаем null - требуется проверка сервера
              return null;
            }
          }
        }
      }

      // Если сервер не указан или недоступен, используем только локальные данные
      if (localData) {
        if (localData.expiresAt > now) {
          return {
            subscriptionId: localData.subscriptionId,
            paymentId: await this.getPaymentId(userId) || '',
            isActive: true,
            expiresAt: localData.expiresAt,
            autoRenewalEnabled: true,
            lastServerCheck: localData.lastServerCheck,
            serverSignature: localData.serverSignature,
          };
        } else {
          // Подписка истекла
          await this.clearSubscriptionData(userId);
          return null;
        }
      }

      // Нет локальных данных
      return null;
    } catch (error) {
      console.error('Failed to verify subscription:', error);
      return null;
    }
  }

  /**
   * Событие успешной токенизации
   */
  addOnTokenizationSuccessListener(listener: (result: TokenizationResult) => void): ExpoYookassaEventSubscription {
    return emitter.addListener('onTokenizationSuccess', listener);
  }

  /**
   * Событие ошибки токенизации
   */
  addOnTokenizationErrorListener(listener: (error: PaymentError) => void): ExpoYookassaEventSubscription {
    return emitter.addListener('onTokenizationError', listener);
  }

  /**
   * Событие отмены платежа
   */
  addOnTokenizationCancelListener(listener: () => void): ExpoYookassaEventSubscription {
    return emitter.addListener('onTokenizationCancel', listener);
  }
}

// Экспортируем инстанс класса
export default new ExpoYookassa();
