package com.expo.yookassa

import android.app.Activity
import android.content.Intent
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import ru.yoomoney.sdk.kassa.payments.Checkout
import ru.yoomoney.sdk.kassa.payments.checkoutParameters.Amount
import ru.yoomoney.sdk.kassa.payments.checkoutParameters.PaymentParameters
import java.math.BigDecimal
import java.util.Currency

class ExpoYookassaModule : Module() {
    private var tokenizationPromise: Promise? = null
    private var currentSubscriptionId: String? = null
    
    override fun definition() = ModuleDefinition {
        Name("ExpoYookassa")
        
        // Инициализация SDK
        Function("initialize") { clientId: String, shopId: String ->
            Checkout.initialize(
                appContext.reactContext?.applicationContext!!,
                clientId,
                shopId
            )
        }
        
        // Запуск токенизации
        AsyncFunction("startTokenization") { 
            params: Map<String, Any>, 
            promise: Promise 
        ->
            tokenizationPromise = promise
            val activity = appContext.currentActivity ?: return@AsyncFunction
            
            // Сохраняем subscriptionId если есть
            currentSubscriptionId = params["subscriptionId"] as? String
            
            val amount = Amount(
                BigDecimal(params["amount"].toString()),
                Currency.getInstance(params["currency"] as String? ?: "RUB")
            )
            
            // Определяем, нужно ли сохранять платежный метод
            val savePaymentMethod = when {
                params["isRecurring"] == true -> PaymentParameters.SavePaymentMethod.ON
                params["savePaymentMethod"] == "ON" -> PaymentParameters.SavePaymentMethod.ON
                params["savePaymentMethod"] == "USER_SELECTS" -> PaymentParameters.SavePaymentMethod.USER_SELECTS
                else -> PaymentParameters.SavePaymentMethod.OFF
            }
            
            val paymentParameters = PaymentParameters(
                amount = amount,
                title = params["title"] as String? ?: "Order",
                subtitle = params["subtitle"] as String? ?: "",
                clientId = params["clientId"] as String,
                shopId = params["shopId"] as String,
                savePaymentMethod = savePaymentMethod,
                paymentMethodTypes = setOf(
                    PaymentParameters.PaymentMethodType.BANK_CARD,
                    PaymentParameters.PaymentMethodType.SBERBANK,
                    PaymentParameters.PaymentMethodType.YOO_MONEY
                ),
                gatewayId = params["gatewayId"] as? String,
                customReturnUrl = params["returnUrl"] as? String
            )
            
            Checkout.createTokenizeIntent(activity, paymentParameters).let {
                activity.startActivityForResult(it, REQUEST_CODE_TOKENIZE)
            }
        }
        
        // Метод для запуска подписки
        AsyncFunction("startSubscription") { 
            params: Map<String, Any>, 
            promise: Promise 
        ->
            tokenizationPromise = promise
            val activity = appContext.currentActivity ?: return@AsyncFunction
            
            // Сохраняем subscriptionId если есть
            currentSubscriptionId = params["subscriptionId"] as? String
            
            val amount = Amount(
                BigDecimal(params["amount"].toString()),
                Currency.getInstance(params["currency"] as String? ?: "RUB")
            )
            
            // Для подписок всегда сохраняем платежный метод
            val paymentParameters = PaymentParameters(
                amount = amount,
                title = params["title"] as String? ?: "Order",
                subtitle = params["subtitle"] as String? ?: "",
                clientId = params["clientId"] as String,
                shopId = params["shopId"] as String,
                savePaymentMethod = PaymentParameters.SavePaymentMethod.ON,
                paymentMethodTypes = setOf(
                    PaymentParameters.PaymentMethodType.BANK_CARD,
                    PaymentParameters.PaymentMethodType.SBERBANK,
                    PaymentParameters.PaymentMethodType.YOO_MONEY
                ),
                gatewayId = params["gatewayId"] as? String,
                customReturnUrl = params["returnUrl"] as? String
            )
            
            Checkout.createTokenizeIntent(activity, paymentParameters).let {
                activity.startActivityForResult(it, REQUEST_CODE_TOKENIZE)
            }
        }
        
        // Метод для отмены подписки
        AsyncFunction("cancelSubscription") { subscriptionId: String ->
            // В реальном приложении здесь должен быть вызов API для отмены подписки
            // SDK ЮКассы не предоставляет прямой метод отмены, это делается через API
            currentSubscriptionId = null
            true
        }
        
        // Метод для проверки статуса подписки
        AsyncFunction("checkSubscriptionStatus") { subscriptionId: String ->
            // В реальном приложении здесь должен быть запрос к вашему серверу
            // SDK ЮКассы не предоставляет прямой метод проверки статуса
            mapOf(
                "isActive" to true,
                "subscriptionId" to subscriptionId,
                "autoRenewalEnabled" to true
            )
        }
        
        // Обработка результата активности
        OnActivityResult { event ->
            if (event.requestCode == REQUEST_CODE_TOKENIZE) {
                Checkout.createTokenizationResult(event.intent)?.let { result ->
                    when (result) {
                        is Checkout.TokenizationResult.Success -> {
                            val resultMap = mutableMapOf<String, Any>(
                                "token" to result.paymentToken,
                                "type" to result.paymentMethodType.name
                            )
                            
                            // Добавляем subscriptionId если есть
                            currentSubscriptionId?.let {
                                resultMap["subscriptionId"] = it
                            }
                            
                            // Добавляем paymentMethodId если доступен
                            result.paymentMethodId?.let {
                                resultMap["paymentMethodId"] = it
                            }
                            
                            tokenizationPromise?.resolve(resultMap)
                        }
                        is Checkout.TokenizationResult.Failed -> {
                            tokenizationPromise?.reject(
                                "TOKENIZATION_FAILED",
                                result.error.message
                            )
                        }
                        is Checkout.TokenizationResult.Canceled -> {
                            tokenizationPromise?.reject(
                                "TOKENIZATION_CANCELED",
                                "User canceled"
                            )
                        }
                    }
                }
                tokenizationPromise = null
                currentSubscriptionId = null
            }
        }
    }
    
    companion object {
        private const val REQUEST_CODE_TOKENIZE = 1001
    }
}