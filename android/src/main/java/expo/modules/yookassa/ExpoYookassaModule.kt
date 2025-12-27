package com.expo.yookassa

import android.app.Activity
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import ru.yoomoney.sdk.kassa.payments.Checkout
import ru.yoomoney.sdk.kassa.payments.SavePaymentMethod
import ru.yoomoney.sdk.kassa.payments.checkoutParameters.Amount
import ru.yoomoney.sdk.kassa.payments.checkoutParameters.PaymentParameters
import ru.yoomoney.sdk.kassa.payments.model.PaymentMethodType
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
            val savePaymentMethod = resolveSavePaymentMethod(params)

            val paymentMethodTypes = resolvePaymentMethodTypes(params)

            val clientApplicationKey = (params["clientApplicationKey"] ?: params["clientId"]) as? String
                ?: throw IllegalArgumentException("clientId (clientApplicationKey) is required")

            val paymentParameters = PaymentParameters(
                amount = amount,
                title = params["title"] as String? ?: "Order",
                subtitle = params["subtitle"] as String? ?: "",
                clientApplicationKey = clientApplicationKey,
                shopId = params["shopId"] as String,
                savePaymentMethod = savePaymentMethod,
                paymentMethodTypes = paymentMethodTypes,
                gatewayId = params["gatewayId"] as? String,
                customReturnUrl = params["returnUrl"] as? String,
                userPhoneNumber = params["userPhoneNumber"] as? String,
                authCenterClientId = params["authCenterClientId"] as? String,
                customerId = params["customerId"] as? String,
                googlePayParameters = null
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
            val clientApplicationKey = (params["clientApplicationKey"] ?: params["clientId"]) as? String
                ?: throw IllegalArgumentException("clientId (clientApplicationKey) is required")

            val paymentMethodTypes = resolvePaymentMethodTypes(params)

            val paymentParameters = PaymentParameters(
                amount = amount,
                title = params["title"] as String? ?: "Order",
                subtitle = params["subtitle"] as String? ?: "",
                clientApplicationKey = clientApplicationKey,
                shopId = params["shopId"] as String,
                savePaymentMethod = SavePaymentMethod.ON,
                paymentMethodTypes = paymentMethodTypes,
                gatewayId = params["gatewayId"] as? String,
                customReturnUrl = params["returnUrl"] as? String,
                userPhoneNumber = params["userPhoneNumber"] as? String,
                authCenterClientId = params["authCenterClientId"] as? String,
                customerId = params["customerId"] as? String,
                googlePayParameters = null
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
        OnActivityResult { _, (requestCode, resultCode, data) ->
            if (requestCode == REQUEST_CODE_TOKENIZE) {
                when (resultCode) {
                    Activity.RESULT_OK -> {
                        val result = data?.let { Checkout.createTokenizationResult(it) }
                        if (result != null) {
                            val resultMap = mutableMapOf<String, Any>(
                                "token" to result.paymentToken,
                                "type" to result.paymentMethodType.name
                            )

                            currentSubscriptionId?.let {
                                resultMap["subscriptionId"] = it
                            }

                            result.paymentMethodId?.let {
                                resultMap["paymentMethodId"] = it
                            }

                            tokenizationPromise?.resolve(resultMap)
                        } else {
                            tokenizationPromise?.reject(
                                "TOKENIZATION_FAILED",
                                "Empty tokenization result",
                                null
                            )
                        }
                    }

                    Activity.RESULT_CANCELED -> {
                        tokenizationPromise?.reject(
                            "TOKENIZATION_CANCELED",
                            "User canceled",
                            null
                        )
                    }

                    else -> {
                        tokenizationPromise?.reject(
                            "TOKENIZATION_FAILED",
                            "Unexpected result code $resultCode",
                            null
                        )
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

    private fun resolveSavePaymentMethod(params: Map<String, Any>): SavePaymentMethod {
        val savePaymentMethod = params["savePaymentMethod"] as? String

        return when {
            params["isRecurring"] == true -> SavePaymentMethod.ON
            savePaymentMethod.equals("ON", ignoreCase = true) -> SavePaymentMethod.ON
            savePaymentMethod.equals("USER_SELECTS", ignoreCase = true) -> SavePaymentMethod.USER_SELECTS
            else -> SavePaymentMethod.OFF
        }
    }

    private fun resolvePaymentMethodTypes(params: Map<String, Any>): Set<PaymentMethodType>? {
        val provided = params["paymentMethodTypes"] as? List<*>

        if (provided.isNullOrEmpty()) {
            return null
        }

        val mapped = provided.mapNotNull { value ->
            (value as? String)?.let { methodName ->
                runCatching { PaymentMethodType.valueOf(methodName.uppercase()) }.getOrNull()
            }
        }.toSet()

        return mapped.takeIf { it.isNotEmpty() }
    }
}