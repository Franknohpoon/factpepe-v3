#!/usr/bin/env node
/**
 * 토스 미니앱 제출용 스크린샷 자동 캡처
 *
 * - 세로 3장 (636 × 1048): 모바일 393px 너비 풀페이지 → 3등분 크롭
 * - 가로 1장 (1504 × 741): 태블릿 너비 풀스크린
 *
 * [실행]
 *   node scripts/capture-screenshots.mjs
 *
 * 결과는 public/toss-screen-*.png 에 저장.
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const URL = 'https://factpepe-v3.vercel.app/toss';
const OUT_DIR = path.resolve(process.cwd(), 'public');
const TARGET_VW = 636;       // 토스 가이드 세로 너비
const TARGET_VH = 1048;      // 토스 가이드 세로 높이
const TARGET_HW = 1504;      // 토스 가이드 가로 너비
const TARGET_HH = 741;       // 토스 가이드 가로 높이
const SCALE = 3;             // 모바일 캡처 픽셀 비율 (Retina급)

async function capturePortrait(browser) {
  const page = await browser.newPage();
  await page.setViewport({
    width: 393,
    height: TARGET_VH,
    deviceScaleFactor: SCALE,
    isMobile: true,
    hasTouch: true,
  });
  await page.setUserAgent(
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  );

  console.log(`📱 [세로] ${URL} 로딩...`);
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });

  // Firebase 실시간 데이터 로드 대기
  await new Promise((r) => setTimeout(r, 4000));

  // 풀페이지 전체 캡처
  const fullPath = path.join(OUT_DIR, '_full_portrait.png');
  await page.screenshot({ path: fullPath, fullPage: true });

  // 페이지 실제 높이 측정
  const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  const realWidth = 393 * SCALE;
  console.log(`   풀페이지 크기: ${realWidth}px × ${pageHeight * SCALE}px (${pageHeight}px logical)`);

  await page.close();
  return { fullPath, pageHeight, realWidth };
}

async function captureLandscape(browser) {
  const page = await browser.newPage();
  // 토스 가이드 가로형은 1504×741 (PC 화면 일부). 데스크탑 viewport로 캡처.
  await page.setViewport({
    width: TARGET_HW,
    height: TARGET_HH,
    deviceScaleFactor: 1,
  });

  console.log(`🖥️  [가로] ${URL} 로딩...`);
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 4000));

  const outPath = path.join(OUT_DIR, 'toss-screen-h1.png');
  await page.screenshot({ path: outPath, fullPage: false }); // viewport만
  await page.close();
  console.log(`   ✓ ${outPath}`);
  return outPath;
}

async function main() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    // 세로 풀페이지 (Python에서 크롭 처리)
    const portraitInfo = await capturePortrait(browser);
    console.log(`\n   📐 다음 단계: Python으로 ${portraitInfo.fullPath} 를 3등분 크롭`);

    // 가로 1장 (그대로 사용 가능)
    await captureLandscape(browser);

    console.log('\n✅ Puppeteer 캡처 완료');
    console.log('   다음 단계: python3 scripts/crop-screenshots.py');
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
