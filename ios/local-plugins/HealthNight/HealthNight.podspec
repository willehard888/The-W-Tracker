Pod::Spec.new do |s|
  s.name = 'HealthNight'
  s.version = '1.0.0'
  s.summary = 'Night recovery metrics (sleep, resting HR, respiratory rate, SpO2) from HealthKit.'
  s.license = 'MIT'
  s.homepage = 'https://whealthfactory.app'
  s.author = 'Whealth Factory'
  s.source = { :git => 'https://example.com/healthnight.git', :tag => s.version.to_s }
  s.source_files = 'ios/Sources/**/*.swift'
  s.ios.deployment_target = '15.0'
  s.dependency 'Capacitor'
  s.swift_version = '5.1'
  s.frameworks = 'HealthKit'
end
