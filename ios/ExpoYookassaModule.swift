import ExpoModulesCore
import YooKassaPayments

public class ExpoYookassaModule: Module, TokenizationModuleOutput {
    private var resolve: RCTPromiseResolveBlock?
    private var reject: RCTPromiseRejectBlock?
    private var currentSubscriptionId: String?
    
    public func definition() -> ModuleDefinition {
        Name("ExpoYookassa")
        
        AsyncFunction("initialize") { (clientId: String, shopId: String) in
            // Инициализация уже происходит через pod
        }
        
        AsyncFunction("startTokenization") { 
            (params: [String: Any], promise: Promise) in
            DispatchQueue.main.async {
                self.resolve = promise.resolve
                self.reject = promise.reject
                
                guard let amountValue = params["amount"] as? Double,
                      let currencyString = params["currency"] as? String,
                      let title = params["title"] as? String,
                      let clientId = params["clientId"] as? String,
                      let shopId = params["shopId"] as? String else {
                    promise.reject("INVALID_PARAMS", "Missing required parameters")
                    return
                }
                
                let amount = Amount(
                    value: Decimal(amountValue),
                    currency: Currency(rawValue: currencyString) ?? .rub
                )
                
                // Определяем, нужно ли сохранять платежный метод (для подписок)
                let savePaymentMethod: SavePaymentMethod = {
                    if let saveMethod = params["savePaymentMethod"] as? String {
                        switch saveMethod {
                        case "ON": return .on
                        case "USER_SELECTS": return .userSelects
                        default: return .off
                        }
                    }
                    // Если это подписка, по умолчанию сохраняем
                    if let isRecurring = params["isRecurring"] as? Bool, isRecurring {
                        return .on
                    }
                    return .off
                }()
                
                // Сохраняем subscriptionId если есть
                if let subscriptionId = params["subscriptionId"] as? String {
                    self.currentSubscriptionId = subscriptionId
                }
                
                // Определяем тестовый режим из параметров (по умолчанию false)
                let isTestMode = params["testMode"] as? Bool ?? false
                
                let paymentParameters = PaymentParameters(
                    amount: amount,
                    title: title,
                    subtitle: params["subtitle"] as? String ?? "",
                    shopId: shopId,
                    clientId: clientId,
                    savePaymentMethod: savePaymentMethod,
                    paymentMethodTypes: [.bankCard, .sberbank, .yooMoney],
                    testModeSettings: isTestMode ? TestModeSettings(
                        isTestModeEnabled: true,
                        completePayment: true
                    ) : nil,
                    tokenizationSettings: TokenizationSettings(
                        paymentMethodTypes: .all
                    )
                )
                
                let inputData = TokenizationModuleInputData(
                    tokenizationSettings: TokenizationSettings(paymentMethodTypes: .all),
                    paymentParameters: paymentParameters,
                    isLoggingEnabled: true
                )
                
                let viewController = TokenizationAssembly.makeModule(
                    inputData: inputData,
                    moduleOutput: self
                )
                
                self.appContext?.utilities?.currentViewController()?.present(
                    viewController,
                    animated: true
                )
            }
        }
        
        // Метод для запуска подписки
        AsyncFunction("startSubscription") {
            (params: [String: Any], promise: Promise) in
            DispatchQueue.main.async {
                self.resolve = promise.resolve
                self.reject = promise.reject
                
                guard let amountValue = params["amount"] as? Double,
                      let currencyString = params["currency"] as? String,
                      let title = params["title"] as? String,
                      let clientId = params["clientId"] as? String,
                      let shopId = params["shopId"] as? String else {
                    promise.reject("INVALID_PARAMS", "Missing required parameters")
                    return
                }
                
                // Сохраняем subscriptionId если есть
                if let subscriptionId = params["subscriptionId"] as? String {
                    self.currentSubscriptionId = subscriptionId
                }
                
                let amount = Amount(
                    value: Decimal(amountValue),
                    currency: Currency(rawValue: currencyString) ?? .rub
                )
                
                // Определяем тестовый режим из параметров (по умолчанию false)
                let isTestMode = params["testMode"] as? Bool ?? false
                
                let paymentParameters = PaymentParameters(
                    amount: amount,
                    title: title,
                    subtitle: params["subtitle"] as? String ?? "",
                    shopId: shopId,
                    clientId: clientId,
                    savePaymentMethod: .on, // Для подписок всегда сохраняем
                    paymentMethodTypes: [.bankCard, .sberbank, .yooMoney],
                    testModeSettings: isTestMode ? TestModeSettings(
                        isTestModeEnabled: true,
                        completePayment: true
                    ) : nil,
                    tokenizationSettings: TokenizationSettings(
                        paymentMethodTypes: .all
                    )
                )
                
                let inputData = TokenizationModuleInputData(
                    tokenizationSettings: TokenizationSettings(paymentMethodTypes: .all),
                    paymentParameters: paymentParameters,
                    isLoggingEnabled: true
                )
                
                let viewController = TokenizationAssembly.makeModule(
                    inputData: inputData,
                    moduleOutput: self
                )
                
                self.appContext?.utilities?.currentViewController()?.present(
                    viewController,
                    animated: true
                )
            }
        }
        
        // Метод для отмены подписки
        AsyncFunction("cancelSubscription") { (subscriptionId: String) -> Bool in
            // В реальном приложении здесь должен быть вызов API для отмены подписки
            // SDK ЮКассы не предоставляет прямой метод отмены, это делается через API
            self.currentSubscriptionId = nil
            return true
        }
        
        // Метод для проверки статуса подписки
        AsyncFunction("checkSubscriptionStatus") { (subscriptionId: String) -> [String: Any] in
            // В реальном приложении здесь должен быть запрос к вашему серверу
            // SDK ЮКассы не предоставляет прямой метод проверки статуса
            return [
                "isActive": true,
                "subscriptionId": subscriptionId,
                "autoRenewalEnabled": true
            ]
        }
    }
    
    // MARK: - TokenizationModuleOutput
    
    public func tokenizationModule(
        _ module: TokenizationModuleInput,
        didTokenize token: Tokens,
        paymentMethodType: PaymentMethodType
    ) {
        var result: [String: Any] = [
            "token": token.paymentToken,
            "type": paymentMethodType.rawValue
        ]
        
        // Добавляем subscriptionId если есть
        if let subscriptionId = currentSubscriptionId {
            result["subscriptionId"] = subscriptionId
        }
        
        // Добавляем paymentMethodId если доступен
        if let paymentMethodId = token.paymentMethodId {
            result["paymentMethodId"] = paymentMethodId
        }
        
        resolve?(result)
        dismissViewController()
    }
    
    public func didFinish(
        on module: TokenizationModuleInput,
        with error: YooKassaPaymentsError?
    ) {
        reject?("TOKENIZATION_FAILED", error?.localizedDescription, error)
        dismissViewController()
    }
    
    public func didSuccessfullyPassedCardSec(on module: TokenizationModuleInput) {
        // Обработка успешного 3DS
    }
    
    private func dismissViewController() {
        self.appContext?.utilities?.currentViewController()?.dismiss(animated: true)
        resolve = nil
        reject = nil
        currentSubscriptionId = nil
    }
}