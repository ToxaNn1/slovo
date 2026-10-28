# The app's own Spotlight module (ADR 0057), linked by Expo's autolinking
# from apps/mobile/modules.
Pod::Spec.new do |s|
  s.name           = 'SlovoSpotlight'
  s.version        = '1.0.0'
  s.summary        = 'Writes the Spotlight Snapshot into CoreSpotlight and opens a tapped result.'
  s.author         = 'SLOVO'
  s.homepage       = 'https://github.com/ToxaNn1/slovo'
  s.platforms      = { :ios => '17.0' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'CoreSpotlight'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = '**/*.swift'
end
