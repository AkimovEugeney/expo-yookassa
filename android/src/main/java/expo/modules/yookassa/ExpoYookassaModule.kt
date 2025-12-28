package expo.modules.yookassa

import android.app.Activity
import android.net.Uri
import android.util.Log

import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import ru.yoomoney.sdk.kassa.payments.Checkout
import ru.yoomoney.sdk.kassa.payments.checkoutParameters.Amount
import ru.yoomoney.sdk.kassa.payments.checkoutParameters.PaymentMethodType
import ru.yoomoney.sdk.kassa.payments.checkoutParameters.PaymentParameters
import ru.yoomoney.sdk.kassa.payments.checkoutParameters.SavePaymentMethod

import java.math.BigDecimal
import java.util.Currency

class ExpoYookassaModule : Module() {
    private var tokenizationPromise: Promise? = null
    private var currentSubscriptionId: String? = null
    private var defaultClientApplicationKey: String? = null
    private var defaultShopId: String? = null
    
    override fun definition() = ModuleDefinition {
        Name("ExpoYookassa")
        
        // Инициализация SDK (сохраняем значения по умолчанию для последующих вызовов)
        Function("initialize") { clientId: String, shopId: String ->
            defaultClientApplicationKey = clientId
            defaultShopId = shopId
            Log.d(
                TAG,
                "Initialized defaults clientId=${mask(clientId)} shopId=${mask(shopId)}"
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
            val resolvedReturnUrl = resolveReturnUrl(params)

            val clientApplicationKey = listOf(
                params["clientApplicationKey"],
                params["clientId"],
                defaultClientApplicationKey
            ).firstNotNullOfOrNull { it as? String }
                ?: throw IllegalArgumentException("clientId (clientApplicationKey) is required")

            val shopId = listOf(
                params["shopId"],
                defaultShopId
            ).firstNotNullOfOrNull { it as? String }
                ?: throw IllegalArgumentException("shopId is required")

            Log.d(
                TAG,
                "startTokenization amount=${amount.value} currency=${amount.currency.currencyCode} " +
                    "savePaymentMethod=$savePaymentMethod paymentMethods=${paymentMethodTypes.joinToString()} " +
                    "returnUrl=${resolvedReturnUrl ?: "null"} clientKeyDefault=${defaultClientApplicationKey != null} " +
                    "shopIdDefault=${defaultShopId != null}"
            )

            val paymentParameters = PaymentParameters(
                amount = amount,
                title = params["title"] as String? ?: "Order",
                subtitle = params["subtitle"] as String? ?: "",
                clientApplicationKey = clientApplicationKey,
                shopId = shopId,
                savePaymentMethod = savePaymentMethod,
                paymentMethodTypes = paymentMethodTypes,
                gatewayId = params["gatewayId"] as? String,
                customReturnUrl = resolvedReturnUrl,
                userPhoneNumber = params["userPhoneNumber"] as? String,
                authCenterClientId = params["authCenterClientId"] as? String,
                customerId = params["customerId"] as? String
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
            val clientApplicationKey = listOf(
                params["clientApplicationKey"],
                params["clientId"],
                defaultClientApplicationKey
            ).firstNotNullOfOrNull { it as? String }
                ?: throw IllegalArgumentException("clientId (clientApplicationKey) is required")

            val shopId = listOf(
                params["shopId"],
                defaultShopId
            ).firstNotNullOfOrNull { it as? String }
                ?: throw IllegalArgumentException("shopId is required")

            val paymentMethodTypes = resolvePaymentMethodTypes(params)
            val resolvedReturnUrl = resolveReturnUrl(params)

            val paymentParameters = PaymentParameters(
                amount = amount,
                title = params["title"] as String? ?: "Order",
                subtitle = params["subtitle"] as String? ?: "",
                clientApplicationKey = clientApplicationKey,
                shopId = shopId,
                savePaymentMethod = SavePaymentMethod.ON,
                paymentMethodTypes = paymentMethodTypes,
                gatewayId = params["gatewayId"] as? String,
                customReturnUrl = resolvedReturnUrl,
                userPhoneNumber = params["userPhoneNumber"] as? String,
                authCenterClientId = params["authCenterClientId"] as? String,
                customerId = params["customerId"] as? String
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

                            Log.d(
                                TAG,
                                "Tokenization success type=${result.paymentMethodType.name} subscription=${currentSubscriptionId}"
                            )

                            tokenizationPromise?.resolve(resultMap)
                        } else {
                            Log.e(TAG, "Tokenization returned empty result")
                            tokenizationPromise?.reject(
                                "TOKENIZATION_FAILED",
                                "Empty tokenization result",
                                null
                            )
                        }
                    }

                    Activity.RESULT_CANCELED -> {
                        Log.w(TAG, "Tokenization canceled by user")
                        tokenizationPromise?.reject(
                            "TOKENIZATION_CANCELED",
                            "User canceled",
                            null
                        )
                    }

                    else -> {
                        Log.e(TAG, "Tokenization failed with resultCode=$resultCode")
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
    
    private fun resolveSavePaymentMethod(params: Map<String, Any>): SavePaymentMethod {
        val savePaymentMethod = params["savePaymentMethod"] as? String

        val resolved = when {
            params["isRecurring"] == true -> SavePaymentMethod.ON
            savePaymentMethod?.equals("ON", ignoreCase = true) == true -> SavePaymentMethod.ON
            savePaymentMethod?.equals("USER_SELECTS", ignoreCase = true) == true -> SavePaymentMethod.USER_SELECTS
            else -> SavePaymentMethod.OFF
        }

        Log.d(
            TAG,
            "resolveSavePaymentMethod -> $resolved (requested=$savePaymentMethod isRecurring=${params["isRecurring"]})"
        )

        return resolved
    }

    private fun resolvePaymentMethodTypes(params: Map<String, Any>): Set<PaymentMethodType> {
        val provided = params["paymentMethodTypes"] as? List<*>

        val mapped = provided?.mapNotNull { value ->
            (value as? String)?.let { methodName ->
                runCatching { PaymentMethodType.valueOf(methodName.uppercase()) }.getOrNull()
            }
        }?.toSet()

        val defaultMethods = setOf(
            PaymentMethodType.BANK_CARD,
            PaymentMethodType.SBERBANK,
            PaymentMethodType.SBP
        )

        return mapped.takeUnless { it.isNullOrEmpty() }?.also {
            Log.d(TAG, "Using provided payment methods=${it.joinToString()}")
        } ?: run {
            if (provided != null && provided.isNotEmpty()) {
                Log.w(
                    TAG,
                    "Failed to map provided paymentMethodTypes=$provided. Falling back to default=${defaultMethods.joinToString()}"
                )
            } else {
                Log.d(
                    TAG,
                    "paymentMethodTypes not provided. Using default=${defaultMethods.joinToString()}"
                )
            }
            defaultMethods
        }
    }

    private fun resolveReturnUrl(params: Map<String, Any>): String? {
        val explicit = (params["returnUrl"] as? String)?.takeIf { it.isNotBlank() }
        if (!explicit.isNullOrEmpty()) {
            return if (isValidHttpsUrl(explicit)) {
                Log.d(TAG, "Using explicit returnUrl=$explicit")
                explicit
            } else {
                Log.e(TAG, "Ignoring invalid returnUrl=$explicit. Only https URLs are accepted by YooKassa SDK.")
                null
            }
        }

        val configured = getConfiguredReturnUrl()
        if (configured != null) {
            Log.d(TAG, "Using returnUrl from ym_app_scheme resource=$configured")
            return configured
        }

        Log.w(
            TAG,
            "No returnUrl provided and ym_app_scheme missing or invalid. Tokenization will proceed without customReturnUrl"
        )
        return null
    }

    private fun getConfiguredReturnUrl(): String? {
        val context = appContext.reactContext
        if (context == null) {
            Log.w(TAG, "React context is null, cannot resolve ym_app_scheme")
            return null
        }

        val resId = context.resources.getIdentifier("ym_app_scheme", "string", context.packageName)
        if (resId == 0) {
            Log.w(
                TAG,
                "Resource ym_app_scheme not found. Configure it via resValue or strings.xml as documented."
            )
            return null
        }

        val configured = context.getString(resId).trim()
        if (configured.isEmpty()) {
            Log.w(TAG, "ym_app_scheme resource is empty. Ignoring.")
            return null
        }

        if (!isValidHttpsUrl(configured)) {
            Log.e(
                TAG,
                "ym_app_scheme must contain a valid https URL. Current value=$configured. Ignoring."
            )
            return null
        }

        return configured
    }

    private fun isValidHttpsUrl(url: String): Boolean {
        val parsed = runCatching { Uri.parse(url) }.getOrNull() ?: return false
        return parsed.scheme.equals("https", ignoreCase = true) && !parsed.host.isNullOrEmpty()
    }

    companion object {
        private const val TAG = "ExpoYookassaModule"
        private const val REQUEST_CODE_TOKENIZE = 1001

        private fun mask(value: String?): String {
            if (value.isNullOrEmpty()) return "<empty>"
            return if (value.length <= 4) "****" else value.take(4) + "****"
        }
    }
}