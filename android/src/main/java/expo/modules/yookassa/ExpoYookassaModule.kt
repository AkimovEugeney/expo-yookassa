package expo.modules.yookassa

import android.app.Activity
import android.net.Uri
import android.util.Log

import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import ru.yoomoney.sdk.kassa.payments.Checkout
import ru.yoomoney.sdk.kassa.payments.checkoutParameters.Amount
import ru.yoomoney.sdk.kassa.payments.checkoutParameters.MockConfiguration
import ru.yoomoney.sdk.kassa.payments.checkoutParameters.PaymentMethodType
import ru.yoomoney.sdk.kassa.payments.checkoutParameters.PaymentParameters
import ru.yoomoney.sdk.kassa.payments.checkoutParameters.SavedBankCardPaymentParameters
import ru.yoomoney.sdk.kassa.payments.checkoutParameters.SavePaymentMethod
import ru.yoomoney.sdk.kassa.payments.checkoutParameters.TestParameters
import ru.yoomoney.sdk.kassa.payments.ui.color.ColorScheme

import java.math.BigDecimal
import java.util.Currency

class ExpoYookassaModule : Module() {
    private var tokenizationPromise: Promise? = null
    private var confirmationPromise: Promise? = null
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
            val testParameters = resolveTestParameters(params)

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

            val intent = if (testParameters != null) {
                Checkout.createTokenizeIntent(activity, paymentParameters, testParameters)
            } else {
                Checkout.createTokenizeIntent(activity, paymentParameters)
            }
            activity.startActivityForResult(intent, REQUEST_CODE_TOKENIZE)
        }

        // Запуск токенизации сохраненной карты (CSC)
        AsyncFunction("startSavedCardTokenization") {
            params: Map<String, Any>,
            promise: Promise
        ->
            tokenizationPromise = promise
            val activity = appContext.currentActivity ?: return@AsyncFunction

            val amount = Amount(
                BigDecimal(params["amount"].toString()),
                Currency.getInstance(params["currency"] as String? ?: "RUB")
            )

            val savePaymentMethod = resolveSavePaymentMethod(params)
            val testParameters = resolveTestParameters(params)

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

            val paymentMethodId = params["paymentMethodId"] as? String
                ?: throw IllegalArgumentException("paymentMethodId is required")

            Log.d(
                TAG,
                "startSavedCardTokenization amount=${amount.value} currency=${amount.currency.currencyCode} " +
                    "savePaymentMethod=$savePaymentMethod paymentMethodId=${mask(paymentMethodId)} " +
                    "clientKeyDefault=${defaultClientApplicationKey != null} shopIdDefault=${defaultShopId != null}"
            )

            val savedCardParameters = SavedBankCardPaymentParameters(
                amount = amount,
                title = params["title"] as String? ?: "Order",
                subtitle = params["subtitle"] as String? ?: "",
                clientApplicationKey = clientApplicationKey,
                shopId = shopId,
                paymentMethodId = paymentMethodId,
                savePaymentMethod = savePaymentMethod,
                gatewayId = params["gatewayId"] as? String
            )

            val intent = if (testParameters != null) {
                Checkout.createSavedCardTokenizeIntent(activity, savedCardParameters, testParameters)
            } else {
                Checkout.createSavedCardTokenizeIntent(activity, savedCardParameters)
            }
            activity.startActivityForResult(intent, REQUEST_CODE_TOKENIZE)
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

            val savePaymentMethod = resolveSavePaymentMethod(params)
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
            val testParameters = resolveTestParameters(params)

            Log.d(
                TAG,
                "startSubscription amount=${amount.value} currency=${amount.currency.currencyCode} " +
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

            val intent = if (testParameters != null) {
                Checkout.createTokenizeIntent(activity, paymentParameters, testParameters)
            } else {
                Checkout.createTokenizeIntent(activity, paymentParameters)
            }
            activity.startActivityForResult(intent, REQUEST_CODE_TOKENIZE)
        }

        // Универсальный запуск подтверждения оплаты (SBP / SberPay / 3DS)
        AsyncFunction("startConfirmation") {
            params: Map<String, Any>,
            promise: Promise
        ->
            val paymentMethodTypeName = params["paymentMethodType"] as? String
                ?: throw IllegalArgumentException("paymentMethodType is required")
            val paymentMethodType = runCatching {
                PaymentMethodType.valueOf(paymentMethodTypeName.uppercase())
            }.getOrNull() ?: throw IllegalArgumentException(
                "Unsupported paymentMethodType=$paymentMethodTypeName"
            )
            startConfirmation(params, promise, paymentMethodType)
        }

        // Запуск подтверждения оплаты через СБП (deprecated)
        AsyncFunction("startSbpConfirmation") {
            params: Map<String, Any>,
            promise: Promise
        ->
            startConfirmation(params, promise, PaymentMethodType.SBP)
        }

        // Запуск подтверждения оплаты через SberPay (deprecated)
        AsyncFunction("startSberPayConfirmation") {
            params: Map<String, Any>,
            promise: Promise
        ->
            startConfirmation(params, promise, PaymentMethodType.SBERBANK)
        }

        // Запуск подтверждения оплаты через 3DS (банковская карта) (deprecated)
        AsyncFunction("start3dsConfirmation") {
            params: Map<String, Any>,
            promise: Promise
        ->
            startConfirmation(params, promise, PaymentMethodType.BANK_CARD)
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
                                "Tokenization success type=${result.paymentMethodType.name} " +
                                    "subscription=${currentSubscriptionId}"
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

            if (requestCode == REQUEST_CODE_CONFIRM) {
                Log.d(
                    TAG,
                    "SBP confirmation onActivityResult resultCode=$resultCode data=$data"
                )
                when (resultCode) {
                    Activity.RESULT_OK -> {
                        Log.d(TAG, "SBP confirmation finished")
                        confirmationPromise?.resolve(
                            mapOf(
                                "status" to "OK"
                            )
                        )
                    }

                    Activity.RESULT_CANCELED -> {
                        Log.w(TAG, "SBP confirmation canceled by user")
                        confirmationPromise?.resolve(
                            mapOf(
                                "status" to "CANCELED"
                            )
                        )
                    }

                    Checkout.RESULT_ERROR -> {
                        val errorCode = data?.getStringExtra(Checkout.EXTRA_ERROR_CODE)
                        val errorDescription = data?.getStringExtra(Checkout.EXTRA_ERROR_DESCRIPTION)
                        val failingUrl = data?.getStringExtra(Checkout.EXTRA_ERROR_FAILING_URL)
                        Log.e(
                            TAG,
                            "SBP confirmation failed code=$errorCode description=$errorDescription failingUrl=$failingUrl"
                        )
                        confirmationPromise?.resolve(
                            mapOf(
                                "status" to "ERROR",
                                "errorCode" to (errorCode ?: ""),
                                "errorDescription" to (errorDescription ?: ""),
                                "failingUrl" to (failingUrl ?: "")
                            )
                        )
                    }

                    else -> {
                        Log.e(TAG, "SBP confirmation failed with resultCode=$resultCode")
                        confirmationPromise?.resolve(
                            mapOf(
                                "status" to "ERROR",
                                "errorCode" to resultCode.toString(),
                                "errorDescription" to "Unexpected result code $resultCode",
                                "failingUrl" to ""
                            )
                        )
                    }
                }

                confirmationPromise = null
            }
        }
    }

    private fun resolveSavePaymentMethod(params: Map<String, Any>): SavePaymentMethod {
        val savePaymentMethod = params["savePaymentMethod"] as? String

        val resolved = when {
            savePaymentMethod?.equals("ON", ignoreCase = true) == true -> SavePaymentMethod.ON
            savePaymentMethod?.equals("USER_SELECTS", ignoreCase = true) == true -> SavePaymentMethod.USER_SELECTS
            savePaymentMethod?.equals("OFF", ignoreCase = true) == true -> SavePaymentMethod.OFF
            params["isRecurring"] == true -> SavePaymentMethod.ON
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
        val requested = provided?.joinToString() ?: "null"

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
            Log.d(
                TAG,
                "Using provided payment methods resolved=${it.joinToString()} requested=$requested"
            )
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
            return if (isValidReturnUrl(explicit)) {
                Log.d(TAG, "Using explicit returnUrl=$explicit")
                explicit
            } else {
                Log.e(TAG, "Ignoring invalid returnUrl=$explicit. Expected a URL with a scheme (e.g. exampleapp://sbp-invoicing).")
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

    private fun startConfirmation(
        params: Map<String, Any>,
        promise: Promise,
        expectedMethodType: PaymentMethodType
    ) {
        confirmationPromise = promise
        val activity = appContext.currentActivity ?: return

        val paymentMethodTypeName = params["paymentMethodType"] as? String
        val paymentMethodType = paymentMethodTypeName?.let {
            runCatching { PaymentMethodType.valueOf(it.uppercase()) }.getOrNull()
        } ?: expectedMethodType

        if (paymentMethodType != expectedMethodType) {
            throw IllegalArgumentException(
                "startConfirmation supports only ${expectedMethodType.name}"
            )
        }

        val confirmationData = params["confirmationUrl"] as? String
            ?: throw IllegalArgumentException("confirmationUrl is required")
        if (confirmationData.isBlank()) {
            throw IllegalArgumentException("confirmationUrl must not be blank")
        }

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

        val testParameters = resolveTestParameters(params)

        Log.d(
            TAG,
            "startConfirmation confirmationData=$confirmationData method=$paymentMethodType " +
                "clientKeyDefault=${defaultClientApplicationKey != null} shopIdDefault=${defaultShopId != null}"
        )

        val intent = if (testParameters != null) {
            Checkout.createConfirmationIntent(
                activity,
                confirmationData,
                paymentMethodType,
                clientApplicationKey,
                shopId,
                ColorScheme.getDefaultScheme(),
                testParameters
            )
        } else {
            Checkout.createConfirmationIntent(
                activity,
                confirmationData,
                paymentMethodType,
                clientApplicationKey,
                shopId
            )
        }
        activity.startActivityForResult(intent, REQUEST_CODE_CONFIRM)
    }

    private fun resolveTestParameters(params: Map<String, Any>): TestParameters? {
        val isTestMode = params["testMode"] as? Boolean ?: false
        if (!isTestMode) {
            return null
        }

        val testParameters = TestParameters(
            showLogs = true,
            googlePayTestEnvironment = true,
            mockConfiguration = MockConfiguration()
        )

        Log.d(TAG, "testMode enabled. Using TestParameters=$testParameters")
        return testParameters
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

        if (!isValidReturnUrl(configured)) {
            Log.e(
                TAG,
                "ym_app_scheme must contain a valid URL with a scheme. Current value=$configured. Ignoring."
            )
            return null
        }

        return configured
    }

    private fun isValidReturnUrl(url: String): Boolean {
        val parsed = runCatching { Uri.parse(url) }.getOrNull() ?: return false
        val scheme = parsed.scheme?.trim().orEmpty()
        if (scheme.isEmpty()) {
            return false
        }
        val schemeSpecific = parsed.schemeSpecificPart?.trim().orEmpty()
        if (schemeSpecific.isEmpty()) {
            return false
        }
        if (scheme.equals("http", ignoreCase = true) || scheme.equals("https", ignoreCase = true)) {
            return !parsed.host.isNullOrEmpty()
        }
        return true
    }

    companion object {
        private const val TAG = "ExpoYookassaModule"
        private const val REQUEST_CODE_TOKENIZE = 1001
        private const val REQUEST_CODE_CONFIRM = 1002

        private fun mask(value: String?): String {
            if (value.isNullOrEmpty()) return "<empty>"
            return if (value.length <= 4) "****" else value.take(4) + "****"
        }
    }
}
