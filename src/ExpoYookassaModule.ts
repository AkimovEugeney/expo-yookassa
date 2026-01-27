import { EventEmitter, requireNativeModule } from "expo-modules-core";

import { Platform } from "react-native";
import type {
  ExpoYookassaEventSubscription,
  ExpoYookassaModuleEvents,
  LocalSubscriptionData,
  ConfirmationParams,
  ConfirmationResult,
  PaymentError,
  SbpConfirmationParams,
  SberPayConfirmationParams,
  ThreeDsConfirmationParams,
  SavedCardTokenizationParams,
  SubscriptionIdentity,
  SubscriptionInfo,
  SubscriptionStatus,
  TokenizationParams,
  TokenizationResult,
  VerifySubscriptionOnStartOptions,
} from "./ExpoYookassa.types";

let SecureStore: typeof import("expo-secure-store");
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  SecureStore = require("expo-secure-store");
} catch (error) {
  SecureStore = undefined as unknown as typeof import("expo-secure-store");
}

// Интерфейс нативного модуля
interface NativeExpoYookassaModule {
  initialize(clientId: string, shopId: string): Promise<void>;
  startTokenization(params: any): Promise<TokenizationResult>;
  startSavedCardTokenization?(params: any): Promise<TokenizationResult>;
  startConfirmation?(params: any): Promise<ConfirmationResult>;

  // Методы для подписок
  startSubscription?(params: any): Promise<TokenizationResult>;
  cancelSubscription?(subscriptionId: string): Promise<boolean>;
  checkSubscriptionStatus?(subscriptionId: string): Promise<SubscriptionStatus>;
  // iOS специфичные методы
  confirm3DS?(
    confirmationUrl: string,
    paymentMethodType: string,
  ): Promise<boolean>;
  // Android специфичные методы
  isPaymentMethodAvailable?(methodType: string): Promise<boolean>;
  startSbpConfirmation?(params: any): Promise<ConfirmationResult>;
  startSberPayConfirmation?(params: any): Promise<ConfirmationResult>;
  start3dsConfirmation?(params: any): Promise<ConfirmationResult>;
}

// Получаем нативный модуль
const nativeModule =
  requireNativeModule<NativeExpoYookassaModule>("ExpoYookassa");
const emitter = new EventEmitter<ExpoYookassaModuleEvents>(nativeModule as any);

/**
 * Основной класс модуля YooKassa
 */
class ExpoYookassa {
  private readonly identityStorageKey = "yookassa_subscription_identity";
  /**
   * Инициализация YooKassa SDK
   * @param clientId - Client ID из личного кабинета YooKassa
   * @param shopId - Shop ID из личного кабинета YooKassa
   */
  async initialize(clientId: string, shopId: string): Promise<void> {
    if (!clientId || !shopId) {
      throw new Error("clientId and shopId are required");
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
  async startTokenization(
    params: TokenizationParams,
  ): Promise<TokenizationResult> {
    try {
      const result = await nativeModule.startTokenization({
        ...params,
        currency: params.currency || "RUB",
        savePaymentMethod: params.savePaymentMethod || "OFF",
        paymentMethodTypes: params.paymentMethodTypes || [
          "BANK_CARD",
          "SBERBANK",
          "SBP",
        ],
        testMode: params.testMode ?? false,
      });

      if (Platform.OS === "android") {
        // Android SDK does not return paymentMethodId.
        const { paymentMethodId: _omit, ...rest } =
          result as TokenizationResult & {
            paymentMethodId?: string;
          };
        return rest;
      }

      return result;
    } catch (error: any) {
      // Нормализуем ошибки
      if (error.code === "TOKENIZATION_CANCELED") {
        throw new Error("Payment was canceled by user");
      }

      if (error.code === "TOKENIZATION_FAILED") {
        throw new Error(`Payment failed: ${error.message}`);
      }

      throw error;
    }
  }

  /**
   * Запуск токенизации сохраненной карты (Android)
   * @param params - Параметры сохраненной карты
   * @returns Результат токенизации
   */
  async startSavedCardTokenization(
    params: SavedCardTokenizationParams,
  ): Promise<TokenizationResult> {
    if (Platform.OS !== "android") {
      throw new Error("Saved card tokenization is only available on Android");
    }

    if (!nativeModule.startSavedCardTokenization) {
      throw new Error(
        "Saved card tokenization is not supported by the native module",
      );
    }

    try {
      return await nativeModule.startSavedCardTokenization({
        ...params,
        currency: params.currency || "RUB",
        savePaymentMethod: params.savePaymentMethod || "OFF",
        testMode: params.testMode ?? false,
      });
    } catch (error: any) {
      if (error.code === "TOKENIZATION_CANCELED") {
        throw new Error("Payment was canceled by user");
      }

      if (error.code === "TOKENIZATION_FAILED") {
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
  async confirm3DS(
    confirmationUrl: string,
    paymentMethodType: string,
  ): Promise<boolean> {
    if (Platform.OS !== "ios") {
      throw new Error("3DS confirmation is only available on iOS");
    }

    if (!nativeModule.confirm3DS) {
      throw new Error("3DS confirmation is not supported by the native module");
    }

    try {
      return await nativeModule.confirm3DS(confirmationUrl, paymentMethodType);
    } catch (error) {
      throw new Error(`3DS confirmation failed: ${error}`);
    }
  }

  /**
   * Подтверждение оплаты через СБП (только Android)
   * @param params - Параметры подтверждения
   */
  async startSbpConfirmation(
    params: SbpConfirmationParams,
  ): Promise<ConfirmationResult> {
    if (Platform.OS !== "android") {
      throw new Error("SBP confirmation is only available on Android");
    }

    return this.startConfirmation({
      ...params,
      paymentMethodType: params.paymentMethodType || "SBP",
      testMode: params.testMode ?? false,
    });
  }

  /**
   * Подтверждение оплаты через SberPay (только Android)
   * @param params - Параметры подтверждения
   */
  async startSberPayConfirmation(
    params: SberPayConfirmationParams,
  ): Promise<ConfirmationResult> {
    if (Platform.OS !== "android") {
      throw new Error("SberPay confirmation is only available on Android");
    }

    return this.startConfirmation({
      ...params,
      paymentMethodType: params.paymentMethodType || "SBERBANK",
      testMode: params.testMode ?? false,
    });
  }

  /**
   * Подтверждение 3DS (только Android)
   * @param params - Параметры подтверждения
   */
  async start3dsConfirmation(
    params: ThreeDsConfirmationParams,
  ): Promise<ConfirmationResult> {
    if (Platform.OS !== "android") {
      throw new Error("3DS confirmation is only available on Android");
    }

    return this.startConfirmation({
      ...params,
      paymentMethodType: params.paymentMethodType || "BANK_CARD",
      testMode: params.testMode ?? false,
    });
  }

  /**
   * Универсальное подтверждение оплаты (Android)
   * @param params - Параметры подтверждения
   */
  async startConfirmation(
    params: ConfirmationParams,
  ): Promise<ConfirmationResult> {
    if (Platform.OS !== "android") {
      throw new Error("Confirmation is only available on Android");
    }

    if (!nativeModule.startConfirmation) {
      throw new Error("Confirmation is not supported by the native module");
    }

    if (!params.confirmationUrl) {
      throw new Error("confirmationUrl is required");
    }

    if (!params.paymentMethodType) {
      throw new Error("paymentMethodType is required");
    }

    return await nativeModule.startConfirmation({
      ...params,
      testMode: params.testMode ?? false,
    });
  }

  /**
   * Проверка доступности платежного метода (только Android)
   * @param methodType - Тип платежного метода
   */
  async isPaymentMethodAvailable(methodType: string): Promise<boolean> {
    if (Platform.OS !== "android") {
      throw new Error("This method is only available on Android");
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
  async startSubscription(
    params: TokenizationParams & { subscriptionId: string; userId?: string },
  ): Promise<TokenizationResult> {
    try {
      const result =
        (await nativeModule.startSubscription?.({
          ...params,
          currency: params.currency || "RUB",
          savePaymentMethod: params.savePaymentMethod || "ON", // Для подписок обычно ON
          isRecurring: true,
          testMode: params.testMode ?? false,
        })) ||
        (await this.startTokenization({
          ...params,
          isRecurring: true,
          testMode: params.testMode ?? false,
        }));

      // Сохраняем ID подписки в SecureStore
      // expiresAt будет сохранен после успешного ответа от сервера
      if (result.subscriptionId || params.subscriptionId) {
        const subscriptionId = result.subscriptionId || params.subscriptionId;

        // Если есть userId, сохраняем с привязкой к пользователю
        if (params.userId) {
          await SecureStore.setItemAsync(
            `yookassa_subscription_id_${params.userId}`,
            subscriptionId,
          );
        } else {
          // Если нет авторизации, сохраняем просто по ID подписки
          await SecureStore.setItemAsync(
            "yookassa_subscription_id",
            subscriptionId,
          );
        }
      }

      // Сохраняем payment id если есть
      if (result.paymentId) {
        if (params.userId) {
          await SecureStore.setItemAsync(
            `yookassa_payment_id_${params.userId}`,
            result.paymentId,
          );
        } else {
          await SecureStore.setItemAsync(
            "yookassa_payment_id",
            result.paymentId,
          );
        }
      }

      return result;
    } catch (error: any) {
      throw new Error(
        `Subscription purchase failed: ${error.message || error}`,
      );
    }
  }

  /**
   * Сохранение локальных данных подписки
   * @param data - Данные подписки для сохранения
   * @param identityKey - ID пользователя или устройства (опционально)
   */
  private async saveLocalSubscriptionData(
    data: LocalSubscriptionData,
    identityKey?: string,
  ): Promise<void> {
    try {
      const key = this.buildStorageKey(
        "yookassa_subscription_data",
        identityKey,
      );
      await SecureStore.setItemAsync(key, JSON.stringify(data));
    } catch (error) {
      throw new Error(`Failed to save local subscription data: ${error}`);
    }
  }

  /**
   * Получение локальных данных подписки
   * @param identityKey - ID пользователя или устройства (опционально)
   * @returns Локальные данные подписки или null
   */
  private async getLocalSubscriptionData(
    identityKey?: string,
  ): Promise<LocalSubscriptionData | null> {
    try {
      const key = this.buildStorageKey(
        "yookassa_subscription_data",
        identityKey,
      );
      const data = await SecureStore.getItemAsync(key);
      if (!data) return null;
      return JSON.parse(data) as LocalSubscriptionData;
    } catch (error) {
      return null;
    }
  }

  /**
   * Сохранение идентификатора пользователя/устройства
   */
  async saveSubscriptionIdentity(
    identity: SubscriptionIdentity,
  ): Promise<void> {
    try {
      await SecureStore.setItemAsync(
        this.identityStorageKey,
        JSON.stringify(identity),
      );
    } catch (error) {
      throw new Error(`Failed to save subscription identity: ${error}`);
    }
  }

  /**
   * Получение сохраненного идентификатора пользователя/устройства
   */
  async getSubscriptionIdentity(): Promise<SubscriptionIdentity | null> {
    try {
      const raw = await SecureStore.getItemAsync(this.identityStorageKey);
      if (!raw) return null;
      return JSON.parse(raw) as SubscriptionIdentity;
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
    serverSignature?: string,
  ): Promise<void> {
    try {
      const key = this.buildStorageKey("yookassa_subscription_id", userId);
      await SecureStore.setItemAsync(key, subscriptionId);

      if (paymentId) {
        const paymentKey = this.buildStorageKey("yookassa_payment_id", userId);
        await SecureStore.setItemAsync(paymentKey, paymentId);
      }

      // Сохраняем локальные данные подписки
      if (expiresAt) {
        await this.saveLocalSubscriptionData(
          {
            subscriptionId,
            expiresAt,
            lastServerCheck: Date.now(),
            serverSignature,
            gracePeriodDays: 7, // Резервный период, если expiresAt неизвестен
          },
          userId,
        );
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
      const key = this.buildStorageKey("yookassa_subscription_id", userId);
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
      const key = this.buildStorageKey("yookassa_payment_id", userId);
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      return null;
    }
  }

  /**
   * Удаление сохраненных данных подписки из SecureStore
   * @param identityKey - ID пользователя или устройства (опционально)
   */
  async clearSubscriptionData(identityKey?: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(
        this.buildStorageKey("yookassa_subscription_id", identityKey),
      );
      await SecureStore.deleteItemAsync(
        this.buildStorageKey("yookassa_payment_id", identityKey),
      );
      await SecureStore.deleteItemAsync(
        this.buildStorageKey("yookassa_subscription_data", identityKey),
      );
    } catch (error) {
      // Игнорируем ошибки при удалении
    }
  }

  private async clearPaymentId(identityKey?: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(
        this.buildStorageKey("yookassa_payment_id", identityKey),
      );
    } catch (error) {
      // Игнорируем ошибки при удалении
    }
  }

  private async getPaymentIdForIdentity(
    identityKey?: string,
  ): Promise<string | null> {
    try {
      if (!identityKey) return null;
      return await SecureStore.getItemAsync(
        this.buildStorageKey("yookassa_payment_id", identityKey),
      );
    } catch (error) {
      return null;
    }
  }

  /**
   * Проверка статуса подписки
   * @param subscriptionId - ID подписки (если не указан, берется из SecureStore)
   * @param userId - ID пользователя (опционально, если пользователь авторизован)
   * @returns Статус подписки
   */
  async checkSubscriptionStatus(
    subscriptionId?: string,
    userId?: string,
  ): Promise<SubscriptionStatus> {
    try {
      const id = subscriptionId || (await this.getSubscriptionId(userId));

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
  async cancelSubscription(
    subscriptionId?: string,
    userId?: string,
  ): Promise<boolean> {
    try {
      const id = subscriptionId || (await this.getSubscriptionId(userId));

      if (!id) {
        throw new Error("Subscription ID not found");
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
   * 2. Если сервер недоступен - используем локальный expiresAt до истечения подписки
   * 3. Если сервер явно говорит что подписки нет - удаляем локальные данные
   *
   * @param options - Параметры проверки подписки
   * @returns Информация о подписке
   */
  async verifySubscriptionOnStart(
    options: VerifySubscriptionOnStartOptions,
  ): Promise<SubscriptionInfo> {
    try {
      const {
        serverUrl,
        appId,
        userId,
        deviceId,
        gracePeriodDays = 7,
        requireStoredIdentity = true,
        checkRequest,
        paymentsRequest,
      } = options;

      const storedIdentity = await this.getSubscriptionIdentity();
      const hasStoredIdentity =
        !!storedIdentity?.userId || !!storedIdentity?.deviceId;
      if (requireStoredIdentity && !hasStoredIdentity) {
        return { isActive: false, source: "none" };
      }

      const identityKey =
        userId ||
        deviceId ||
        storedIdentity?.userId ||
        storedIdentity?.deviceId;
      if (!identityKey) {
        return { isActive: false, source: "none" };
      }

      const identityKeysToClear = Array.from(
        new Set(
          [userId, deviceId, storedIdentity?.userId, storedIdentity?.deviceId]
            .filter(Boolean) as string[],
        ),
      );
      const clearAllSubscriptionData = async (): Promise<void> => {
        for (const key of identityKeysToClear) {
          await this.clearSubscriptionData(key);
        }
      };

      const localData = await this.getLocalSubscriptionData(identityKey);
      const now = Date.now();
      const storedPaymentId = await this.getPaymentIdForIdentity(identityKey);

      if (serverUrl || checkRequest || paymentsRequest) {
        try {
          const fetchWithTimeout = async (
            url: string,
            options: RequestInit,
          ): Promise<Response> => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            try {
              return await fetch(url, {
                ...options,
                signal: controller.signal,
              });
            } finally {
              clearTimeout(timeoutId);
            }
          };

          const resolvePaymentUrl = (urlTemplate: string): string => {
            if (!storedPaymentId) {
              return urlTemplate;
            }

            if (urlTemplate.includes("{paymentId}")) {
              return urlTemplate.replace(
                "{paymentId}",
                encodeURIComponent(storedPaymentId),
              );
            }

            return urlTemplate;
          };

          let checkRequestConfig = checkRequest;
          if (!checkRequestConfig && serverUrl) {
            const requestBody: any = { app_id: appId };
            if (userId || storedIdentity?.userId) {
              requestBody.user_id = userId || storedIdentity?.userId;
            }
            if (deviceId || storedIdentity?.deviceId) {
              requestBody.device_id = deviceId || storedIdentity?.deviceId;
            }

            checkRequestConfig = {
              url: `${serverUrl}/subscriptions/check`,
              init: {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(requestBody),
              },
            };
          }

          if (checkRequestConfig) {
            const response = await fetchWithTimeout(
              checkRequestConfig.url,
              checkRequestConfig.init || {},
            );

            if (response.ok) {
              const data = await response.json();

            if (data.active === false) {
              await clearAllSubscriptionData();
              return {
                isActive: false,
                source: "server",
                serverResponse: data,
              };
            }

              if (data.active === true && data.subscription) {
                const subscriptionId =
                  data.subscription.id !== undefined
                    ? String(data.subscription.id)
                    : undefined;
                const expiresAt = this.parseExpiresAt(
                  data.subscription.expires_at,
                );

                const subscriptionInfo: SubscriptionInfo = {
                  subscriptionId,
                  isActive: true,
                  expiresAt,
                  autoRenewalEnabled: true,
                  lastServerCheck: now,
                  source: "server",
                  serverResponse: data,
                };

                if (expiresAt) {
                  await this.saveLocalSubscriptionData(
                    {
                      subscriptionId,
                      expiresAt,
                      lastServerCheck: now,
                      gracePeriodDays,
                    },
                    identityKey,
                  );
                }

                return subscriptionInfo;
              }

              return {
                isActive: false,
                source: "server",
                serverResponse: data,
              };
            }

            if (response.status === 400 || response.status === 403) {
              let data: any = undefined;
              try {
                data = await response.json();
              } catch (error) {
                // ignore invalid JSON
              }

              await clearAllSubscriptionData();

              return {
                isActive: false,
                source: "server",
                serverResponse: data,
              };
            }

            return {
              isActive: false,
              source: "server",
            };
          }

          if (!checkRequestConfig) {
            throw new Error("Subscription check request configuration is missing");
          }

          if (storedPaymentId && (paymentsRequest?.url || serverUrl)) {
            const paymentRequest = paymentsRequest?.url
              ? {
                  url: resolvePaymentUrl(paymentsRequest.url),
                  init: paymentsRequest.init,
                }
              : {
                  url: `${serverUrl}/payments/${storedPaymentId}`,
                  init: {
                    method: "GET",
                    headers: {
                      "Content-Type": "application/json",
                    },
                  },
                };

            const response = await fetchWithTimeout(
              paymentRequest.url,
              paymentRequest.init || {},
            );

            if (response.ok) {
              const data = await response.json();
              const status = data?.status as string | undefined;

              if (status === "pending") {
                return {
                  isActive: false,
                  paymentStatus: "pending",
                  paymentId: storedPaymentId,
                  source: "server",
                  serverResponse: data,
                };
              }

              if (status === "canceled") {
                await this.clearPaymentId(identityKey);
                await clearAllSubscriptionData();
                return {
                  isActive: false,
                  paymentStatus: "canceled",
                  source: "server",
                  serverResponse: data,
                };
              }

              if (status === "succeeded") {
                const subscriptionId = data?.subscription_id
                  ? String(data.subscription_id)
                  : undefined;
                const expiresAt = this.parseExpiresAt(data?.expires_at);
                const serverSignature =
                  typeof data?.server_signature === "string"
                    ? data.server_signature
                    : undefined;
                const recoveryCode =
                  typeof data?.recovery_code === "string"
                    ? data.recovery_code
                    : undefined;

                await this.clearPaymentId(identityKey);

                if (subscriptionId) {
                  await SecureStore.setItemAsync(
                    this.buildStorageKey(
                      "yookassa_subscription_id",
                      identityKey,
                    ),
                    subscriptionId,
                  );
                }

                if (expiresAt) {
                  await this.saveLocalSubscriptionData(
                    {
                      subscriptionId,
                      expiresAt,
                      lastServerCheck: now,
                      serverSignature,
                      recoveryCode,
                      gracePeriodDays,
                    },
                    identityKey,
                  );
                }

                return {
                  subscriptionId,
                  paymentId: storedPaymentId,
                  paymentStatus: "succeeded",
                  recoveryCode,
                  isActive: !!subscriptionId && !!expiresAt,
                  expiresAt,
                  autoRenewalEnabled: true,
                  lastServerCheck: now,
                  serverSignature,
                  source: "server",
                  serverResponse: data,
                };
              }
            }
          }

          return {
            isActive: false,
            source: "server",
          };
        } catch (error: any) {
          // Сервер недоступен или ошибка сети
          console.warn(
            "Server unavailable, using local subscription data:",
            error.message,
          );

          // Используем локальные данные если они есть
          if (localData) {
            // Используем локальный срок подписки без ограничения 7 днями
            if (localData.expiresAt > now) {
              return {
                subscriptionId: localData.subscriptionId,
                isActive: true,
                expiresAt: localData.expiresAt,
                autoRenewalEnabled: true, // По умолчанию true, если нет данных
                lastServerCheck: localData.lastServerCheck,
                serverSignature: localData.serverSignature,
                recoveryCode: localData.recoveryCode,
                source: "local",
              };
            } else {
              // Подписка истекла локально
              await this.clearSubscriptionData(identityKey);
              return { isActive: false, source: "local" };
            }
          }
        }
      }

      // Если сервер не указан или недоступен, используем только локальные данные
      if (localData) {
        if (localData.expiresAt > now) {
          return {
            subscriptionId: localData.subscriptionId,
            isActive: true,
            expiresAt: localData.expiresAt,
            autoRenewalEnabled: true,
            lastServerCheck: localData.lastServerCheck,
            serverSignature: localData.serverSignature,
            recoveryCode: localData.recoveryCode,
            source: "local",
          };
        } else {
          // Подписка истекла
          await this.clearSubscriptionData(identityKey);
          return { isActive: false, source: "local" };
        }
      }

      // Нет локальных данных
      return { isActive: false, source: "none" };
    } catch (error) {
      console.error("Failed to verify subscription:", error);
      return { isActive: false, source: "none" };
    }
  }

  /**
   * Событие успешной токенизации
   */
  addOnTokenizationSuccessListener(
    listener: (result: TokenizationResult) => void,
  ): ExpoYookassaEventSubscription {
    return emitter.addListener("onTokenizationSuccess", listener);
  }

  /**
   * Событие ошибки токенизации
   */
  addOnTokenizationErrorListener(
    listener: (error: PaymentError) => void,
  ): ExpoYookassaEventSubscription {
    return emitter.addListener("onTokenizationError", listener);
  }

  /**
   * Событие отмены платежа
   */
  addOnTokenizationCancelListener(
    listener: () => void,
  ): ExpoYookassaEventSubscription {
    return emitter.addListener("onTokenizationCancel", listener);
  }

  private buildStorageKey(base: string, identityKey?: string): string {
    return identityKey ? `${base}_${identityKey}` : base;
  }

  private parseExpiresAt(value?: string): number | undefined {
    if (!value) return undefined;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
}

// Экспортируем инстанс класса
export default new ExpoYookassa();
