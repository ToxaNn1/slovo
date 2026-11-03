import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { ExpoConfig } from 'expo/config';
import { compileModsAsync } from 'expo/config-plugins';
import { describe, expect, it } from 'vitest';

import { withSplashBackground } from './splash-background';

/**
 * The launch screen `expo prebuild` leaves when `expo-splash-screen` has a
 * colour and no image: its container view keeps the template's system colour.
 */
const STORYBOARD = `<?xml version="1.0" encoding="UTF-8"?>
<document type="com.apple.InterfaceBuilder3.CocoaTouch.Storyboard.XIB" version="3.0" toolsVersion="24093.7" targetRuntime="iOS.CocoaTouch" propertyAccessControl="none" useAutolayout="YES" launchScreen="YES" useTraitCollections="YES" useSafeAreas="YES" colorMatched="YES" initialViewController="EXPO-VIEWCONTROLLER-1">
    <device id="retina6_12" orientation="portrait" appearance="light"/>
    <dependencies>
        <deployment identifier="iOS"/>
        <plugIn identifier="com.apple.InterfaceBuilder.IBCocoaTouchPlugin" version="24053.1"/>
        <capability name="Named colors" minToolsVersion="9.0"/>
        <capability name="Safe area layout guides" minToolsVersion="9.0"/>
        <capability name="System colors in document resources" minToolsVersion="11.0"/>
        <capability name="documents saved in the Xcode 8 format" minToolsVersion="8.0"/>
    </dependencies>
    <scenes>
        <scene sceneID="EXPO-SCENE-1">
            <objects>
                <viewController storyboardIdentifier="SplashScreenViewController" id="EXPO-VIEWCONTROLLER-1" sceneMemberID="viewController">
                    <view key="view" userInteractionEnabled="NO" contentMode="scaleToFill" insetsLayoutMarginsFromSafeArea="NO" id="EXPO-ContainerView" userLabel="ContainerView">
                        <rect key="frame" x="0.0" y="0.0" width="393" height="852"/>
                        <autoresizingMask key="autoresizingMask" flexibleMaxX="YES" flexibleMaxY="YES"/>
                        <subviews/>
                        <viewLayoutGuide key="safeArea" id="Rmq-lb-GrQ"/>
                        <constraints>
                            <constraint firstItem="EXPO-SplashScreen" firstAttribute="centerY" secondItem="EXPO-ContainerView" secondAttribute="centerY" id="0VC-Wk-OaO"/>
                            <constraint firstItem="EXPO-SplashScreen" firstAttribute="centerX" secondItem="EXPO-ContainerView" secondAttribute="centerX" id="zR4-NK-mVN"/>
                        </constraints>
                        <color key="backgroundColor" systemColor="systemBackgroundColor"/>
                    </view>
                </viewController>
                <placeholder placeholderIdentifier="IBFirstResponder" id="EXPO-PLACEHOLDER-1" userLabel="First Responder" sceneMemberID="firstResponder"/>
            </objects>
            <point key="canvasLocation" x="0.0" y="0.0"/>
        </scene>
    </scenes>
    <resources>
        <image name="SplashScreenLogo" width="100" height="90.333335876464844"/>
        <systemColor name="systemBackgroundColor">
            <color white="1" alpha="1" colorSpace="custom" customColorSpace="genericGamma22GrayColorSpace"/>
        </systemColor>
    </resources>
</document>
`;

/** Runs the plugin's prebuild change on a native project holding `storyboard`, and returns the storyboard it leaves. */
async function prebuild(storyboard: string): Promise<string> {
  const projectRoot = mkdtempSync(join(tmpdir(), 'splash-background-'));
  mkdirSync(join(projectRoot, 'ios/SLOVO.xcodeproj'), { recursive: true });
  const file = join(projectRoot, 'ios/SLOVO/SplashScreen.storyboard');
  mkdirSync(join(projectRoot, 'ios/SLOVO'));
  writeFileSync(file, storyboard);
  const config: ExpoConfig = { name: 'SLOVO', slug: 'slovo' };
  await compileModsAsync(withSplashBackground(config), {
    projectRoot,
    platforms: ['ios'],
    assertMissingModProviders: false,
  });
  return readFileSync(file, 'utf8');
}

describe('the native launch screen', () => {
  it('is drawn in the splash colour of the asset catalog, not the system background', async () => {
    const storyboard = await prebuild(STORYBOARD);

    expect(storyboard).toContain('<color key="backgroundColor" name="SplashScreenBackground"/>');
    expect(storyboard).not.toContain('<color key="backgroundColor" systemColor=');
  });

  it('changes nothing else in the storyboard', async () => {
    const storyboard = await prebuild(STORYBOARD);

    expect(storyboard).toBe(
      STORYBOARD.replace(
        '<color key="backgroundColor" systemColor="systemBackgroundColor"/>',
        '<color key="backgroundColor" name="SplashScreenBackground"/>',
      ),
    );
  });

  it('fails clearly when the storyboard has no container view to paint', async () => {
    await expect(prebuild('<document><scenes/></document>')).rejects.toThrow(
      /SplashScreen\.storyboard has no container view/,
    );
  });
});
