import type { StyleProp, ViewStyle } from 'react-native'

export type PaymentMethodType =
  | 'BANK_CARD'
  | 'SBERBANK'
  | 'YOO_MONEY'
  | 'APPLE_PAY'
  | 'GOOGLE_PAY';

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
  savePaymentMethod?: 'ON' | 'OFF' | 'USER_SELECTS';
  paymentMethodTypes?: Array<'BANK_CARD' | 'SBERBANK' | 'YOO_MONEY'>;
  returnUrl?: string;
  gatewayId?: string;
  /** Параметры для подписок */
  isRecurring?: boolean;
  subscriptionId?: string;
  /** Параметры для тестового режима */
  testMode?: boolean;
  /** ID пользователя (если пользователь авторизован) */
  userId?: string;
}

export interface TokenizationResult {
  token: string;
  type: PaymentMethodType;
  paymentMethodId?: string;
  paymentId?: string;
  subscriptionId?: string;
}

export interface SubscriptionInfo {
  subscriptionId: string;
  paymentId: string;
  isActive: boolean;
  expiresAt?: number;
  autoRenewalEnabled: boolean;
  lastServerCheck?: number;
  serverSignature?: string;
}

export interface LocalSubscriptionData {
  subscriptionId: string;
  expiresAt: number;
  lastServerCheck: number;
  serverSignature?: string;
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