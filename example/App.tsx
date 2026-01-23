import React, { useEffect, useState } from "react";
import {
  Button,
  SafeAreaView,
  ScrollView,
  Text,
  View,
  Alert,
  ActivityIndicator,
} from "react-native";
import ExpoYookassa, { SubscriptionInfo } from "expo-yookassa";

// Замените на ваши реальные данные
const CLIENT_ID = "YOUR_CLIENT_ID";
const SHOP_ID = "YOUR_SHOP_ID";
const SERVER_URL = "https://your-server.com"; // URL вашего сервера
const APP_ID = 1;
const PLAN_ID = 2;
const DEVICE_ID = "device-abc";

export default function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [subscriptionInfo, setSubscriptionInfo] =
    useState<SubscriptionInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // В реальном приложении userId должен браться из вашей системы авторизации
  const [userId, setUserId] = useState<string | null>(null); // null = не авторизован

  useEffect(() => {
    initializeAndCheckSubscription();
  }, []);

  const initializeAndCheckSubscription = async () => {
    try {
      setIsLoading(true);

      // Инициализация модуля
      await ExpoYookassa.initialize(CLIENT_ID, SHOP_ID);
      setIsInitialized(true);

      await ExpoYookassa.saveSubscriptionIdentity({
        userId: userId || undefined,
        deviceId: DEVICE_ID,
      });

      // Проверка подписки при запуске
      // Если есть userId, передаем его для проверки подписки конкретного пользователя
      const info = await ExpoYookassa.verifySubscriptionOnStart({
        serverUrl: SERVER_URL,
        appId: APP_ID,
        userId: userId || undefined,
        deviceId: DEVICE_ID,
        requireStoredIdentity: true,
      });
      setSubscriptionInfo(info);

      if (info && info.isActive) {
        Alert.alert("Подписка активна", `ID подписки: ${info.subscriptionId}`);
      }
    } catch (error) {
      console.error("Initialization error:", error);
      Alert.alert("Ошибка", "Не удалось инициализировать модуль");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBuySubscription = async () => {
    try {
      setIsLoading(true);

      const result = await ExpoYookassa.startTokenization({
        clientId: CLIENT_ID,
        shopId: SHOP_ID,
        amount: 299.0,
        currency: "RUB",
        title: "Премиум подписка",
        subtitle: "Доступ ко всем функциям на месяц",
        savePaymentMethod: "ON",
        paymentMethodTypes: ["BANK_CARD", "SBERBANK", "SBP", "YOO_MONEY"],
        testMode: false,
      });

      Alert.alert("Успех", "Токен получен, отправляем на сервер...");

      // Отправка токена на ваш сервер
      try {
        const response = await fetch(`${SERVER_URL}/payments/sdk`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            app_id: APP_ID,
            plan_id: PLAN_ID,
            token: result.token,
            external_user_id: userId || undefined,
            device_id: DEVICE_ID,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          Alert.alert("Успех", "Подписка успешно активирована!");

          // Обновляем информацию о подписке
          const updatedInfo = await ExpoYookassa.verifySubscriptionOnStart({
            serverUrl: SERVER_URL,
            appId: APP_ID,
            userId: userId || undefined,
            deviceId: DEVICE_ID,
            requireStoredIdentity: true,
          });
          setSubscriptionInfo(updatedInfo);
        } else {
          throw new Error("Server error");
        }
      } catch (serverError) {
        console.error("Server error:", serverError);
        Alert.alert(
          "Ошибка сервера",
          "Токен получен, но не удалось создать платеж на сервере. Проверьте логи.",
        );
      }
    } catch (error: any) {
      console.error("Subscription purchase error:", error);

      if (error.message?.includes("canceled")) {
        Alert.alert("Отменено", "Покупка подписки отменена пользователем");
      } else {
        Alert.alert(
          "Ошибка",
          `Не удалось купить подписку: ${error.message || error}`,
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckSubscription = async () => {
    try {
      setIsLoading(true);
      const info = await ExpoYookassa.verifySubscriptionOnStart({
        serverUrl: SERVER_URL,
        appId: APP_ID,
        userId: userId || undefined,
        deviceId: DEVICE_ID,
        requireStoredIdentity: true,
      });
      setSubscriptionInfo(info);

      if (info && info.isActive) {
        Alert.alert(
          "Статус подписки",
          `Подписка активна\nID: ${info.subscriptionId || "—"}\nАвтопродление: ${info.autoRenewalEnabled === false ? "Отключено" : "Включено"}`,
        );
      } else {
        Alert.alert("Статус подписки", "Активная подписка не найдена");
      }
    } catch (error: any) {
      Alert.alert(
        "Ошибка",
        `Не удалось проверить подписку: ${error.message || error}`,
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!isInitialized) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Инициализация...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.container}>
        <Text style={styles.header}>YooKassa Subscription Example</Text>

        <Group name="Статус подписки">
          {subscriptionInfo && subscriptionInfo.isActive ? (
            <View>
              <Text style={styles.successText}>✓ Подписка активна</Text>
              <Text>ID: {subscriptionInfo.subscriptionId || "—"}</Text>
              <Text>
                Автопродление:{" "}
                {subscriptionInfo.autoRenewalEnabled ? "Включено" : "Отключено"}
              </Text>
              {userId && (
                <Text style={styles.userInfo}>Пользователь: {userId}</Text>
              )}
            </View>
          ) : (
            <View>
              <Text style={styles.inactiveText}>Подписка не активна</Text>
              {userId && (
                <Text style={styles.userInfo}>Пользователь: {userId}</Text>
              )}
              {!userId && (
                <Text style={styles.userInfo}>Работа без авторизации</Text>
              )}
            </View>
          )}
        </Group>

        <Group name="Действия">
          <Button
            title="Купить подписку"
            onPress={handleBuySubscription}
            disabled={isLoading}
          />
          <View style={styles.buttonSpacing} />
          <Button
            title="Проверить подписку"
            onPress={handleCheckSubscription}
            disabled={isLoading}
          />
        </Group>

        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" />
            <Text style={styles.loadingText}>Загрузка...</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Group(props: { name: string; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupHeader}>{props.name}</Text>
      {props.children}
    </View>
  );
}

const styles = {
  container: {
    flex: 1,
    backgroundColor: "#eee",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    fontSize: 30,
    margin: 20,
    fontWeight: "bold",
  },
  groupHeader: {
    fontSize: 20,
    marginBottom: 20,
    fontWeight: "600",
  },
  group: {
    margin: 20,
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 20,
  },
  buttonSpacing: {
    height: 10,
  },
  loadingContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loadingText: {
    marginLeft: 10,
    fontSize: 16,
  },
  successText: {
    color: "#4CAF50",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 10,
  },
  inactiveText: {
    color: "#999",
    fontSize: 16,
  },
  userInfo: {
    color: "#666",
    fontSize: 14,
    marginTop: 5,
    fontStyle: "italic",
  },
};
