import type { StyleProp, ViewStyle } from "react-native";

export type PaymentMethodType =
  | "BANK_CARD"
  | "SBERBANK"
  | "SBP"
  | "YOO_MONEY"
  | "APPLE_PAY"
  | "GOOGLE_PAY";

export interface PaymentToken {
  token: string;
  type: PaymentMethodType;
  paymentMethodId?: string;
}

export interface PaymentError {
  code: string;
  message: string;
  details?: unknown;
}

export interface TokenizationParams {
  clientId: string;
  shopId: string;
  amount: number;
  currency?: string;
  title: string;
  subtitle?: string;
  savePaymentMethod?: "ON" | "OFF" | "USER_SELECTS";
  paymentMethodTypes?: Array<"BANK_CARD" | "SBERBANK" | "SBP" | "YOO_MONEY">;
  returnUrl?: string;
  gatewayId?: string;
  /** Уникальный идентификатор покупателя в вашей системе */
  customerId?: string;
  /** Параметры для подписок */
  isRecurring?: boolean;
  subscriptionId?: string;
  /** Параметры для тестового режима */
  testMode?: boolean;
  /** ID пользователя (если пользователь авторизован) */
  userId?: string;
}

export interface SavedCardTokenizationParams {
  clientId: string;
  shopId: string;
  paymentMethodId: string;
  amount: number;
  currency?: string;
  title: string;
  subtitle?: string;
  savePaymentMethod?: "ON" | "OFF" | "USER_SELECTS";
  gatewayId?: string;
  /** Параметры для тестового режима */
  testMode?: boolean;
}

export interface TokenizationResult {
  token: string;
  type: PaymentMethodType;
  paymentMethodId?: string;
  paymentId?: string;
  subscriptionId?: string;
}

export interface SbpConfirmationParams {
  confirmationUrl: string;
  paymentMethodType?: PaymentMethodType;
  clientId?: string;
  clientApplicationKey?: string;
  shopId?: string;
  testMode?: boolean;
}

export interface SberPayConfirmationParams {
  confirmationUrl: string;
  paymentMethodType?: PaymentMethodType;
  clientId?: string;
  clientApplicationKey?: string;
  shopId?: string;
  testMode?: boolean;
}

export interface ThreeDsConfirmationParams {
  confirmationUrl: string;
  paymentMethodType?: PaymentMethodType;
  clientId?: string;
  clientApplicationKey?: string;
  shopId?: string;
  testMode?: boolean;
}

export type SbpConfirmationResult = ConfirmationResult;
export type SberPayConfirmationResult = ConfirmationResult;
export type ThreeDsConfirmationResult = ConfirmationResult;

export interface ConfirmationResult {
  status: "OK" | "CANCELED" | "ERROR";
  errorCode?: string;
  errorDescription?: string;
  failingUrl?: string;
}

export interface ConfirmationParams {
  confirmationUrl: string;
  paymentMethodType: PaymentMethodType;
  clientId?: string;
  clientApplicationKey?: string;
  shopId?: string;
  testMode?: boolean;
}

export interface SubscriptionInfo {
  subscriptionId?: string;
  paymentId?: string;
  isActive: boolean;
  paymentStatus?: "pending" | "succeeded" | "canceled";
  recoveryCode?: string;
  expiresAt?: number;
  autoRenewalEnabled?: boolean;
  lastServerCheck?: number;
  serverSignature?: string;
  /** Источник данных для статуса подписки */
  source?: "server" | "local" | "none";
  /** Сырые данные ответа сервера, если проверка была через сеть */
  serverResponse?: unknown;
}

export interface SubscriptionIdentity {
  userId?: string;
  deviceId?: string;
}

export interface SubscriptionRequestConfig {
  url: string;
  init?: RequestInit;
}

export interface VerifySubscriptionOnStartOptions {
  serverUrl?: string;
  appId: number;
  userId?: string;
  deviceId?: string;
  gracePeriodDays?: number;
  requireStoredIdentity?: boolean;
  checkRequest?: SubscriptionRequestConfig;
  paymentsRequest?: SubscriptionRequestConfig;
}

export interface LocalSubscriptionData {
  subscriptionId?: string;
  expiresAt: number;
  lastServerCheck: number;
  serverSignature?: string;
  recoveryCode?: string;
  gracePeriodDays?: number;
}

export interface SubscriptionStatus {
  isActive: boolean;
  subscriptionId?: string;
  expiresAt?: number;
  autoRenewalEnabled?: boolean;
}

interface ExpoYookassaBaseEvents {
  [eventName: string]: (...args: any[]) => void;
}

export interface ExpoYookassaModuleEvents extends ExpoYookassaBaseEvents {
  onTokenizationSuccess(result: TokenizationResult): void;
  onTokenizationError(error: PaymentError): void;
  onTokenizationCancel(): void;
}

export type ExpoYookassaEventSubscription = { remove(): void };

export interface ExpoYookassaViewOnLoadEvent {
  nativeEvent: {
    url?: string;
  };
}

export interface ExpoYookassaViewProps {
  url?: string;
  onLoad?: (event: ExpoYookassaViewOnLoadEvent) => void;
  style?: StyleProp<ViewStyle>;
}
