const { AndroidConfig, withStringsXml } = require("expo/config-plugins");

const resolveScheme = (config) => {
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
  return normalized || null;
};

const withExpoYookassaScheme = (config) =>
  withStringsXml(config, (config) => {
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

module.exports = withExpoYookassaScheme;
module.exports.withExpoYookassaScheme = withExpoYookassaScheme;
