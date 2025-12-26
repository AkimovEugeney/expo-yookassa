require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'ExpoYookassa'
  s.version      = "1.0.0"
  s.summary      = "YooKassa SDK integration for Expo"
  s.homepage     = "https://github.com/AkimovEugeney/expo-yookassa"
  s.license      = "MIT"
  s.author       = { "author" => "akimoveugeney@gmail.com" }
  s.homepage       = package['homepage']
  s.platforms      = {
    :ios => '15.1',
    :tvos => '15.1'
  }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://github.com/AkimovEugeney/expo-yookassa' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.dependency 'YooKassaPayments', '~> 6.0'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
