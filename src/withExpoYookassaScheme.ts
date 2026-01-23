import type { ExpoConfig } from "@expo/config-types";
import type { ConfigPlugin } from "expo/config-plugins";
import { AndroidConfig, withStringsXml } from "expo/config-plugins";

const resolveScheme = (config: ExpoConfig): string | null => {
  const rawScheme = Array.isArray(config.scheme)
    ? config.scheme[0]
    : config.scheme;
  if (typeof rawScheme !== "string") {
    return null;
  }

  const trimmed = rawScheme.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.split(":")[0];
  return normalized ? normalized : null;
};

const withExpoYookassaScheme: ConfigPlugin = (config) => {
  return withStringsXml(config, (config) => {
    const scheme = resolveScheme(config);
    if (!scheme) {
      return config;
    }

    AndroidConfig.Strings.setStringItem(
      [
        AndroidConfig.Resources.buildResourceItem({
          name: "ym_app_scheme",
          value: scheme,
          translatable: false,
        }),
      ],
      config.modResults,
    );

    return config;
  });
};

export default withExpoYookassaScheme;
export { withExpoYookassaScheme };
