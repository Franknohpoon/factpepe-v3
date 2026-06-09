#!/usr/bin/env python3
"""
풀페이지 모바일 스크린샷을 636×1048 세로 3장으로 크롭.

Puppeteer가 캡처한 _full_portrait.png를 받아서:
1. 화면 너비를 636으로 리사이즈 (deviceScaleFactor 3x → 1179 → 636 다운샘플)
2. 토스 카드 경계에 맞춰 3개 세그먼트로 슬라이스
   - v1: 헤더 + 닉네임 카드 + 분석 카드 + 라인업 일부
   - v2: 라인업 나머지 + 투표 + 응원톡
   - v3: 직관 기록 + 먹거리 + 회고
3. 각 1048 높이로 리사이즈/크롭
"""
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(ROOT, 'public')
SRC = os.path.join(PUBLIC, '_full_portrait.png')

TARGET_W = 636
TARGET_H = 1048

def main():
    if not os.path.exists(SRC):
        print(f'❌ Source not found: {SRC}')
        print('   먼저 node scripts/capture-screenshots.mjs 실행')
        return

    img = Image.open(SRC).convert('RGB')
    w, h = img.size
    print(f'📐 Source: {w} × {h}')

    # 너비를 636으로 다운샘플
    new_h = int(h * TARGET_W / w)
    img = img.resize((TARGET_W, new_h), Image.LANCZOS)
    print(f'   리사이즈: {TARGET_W} × {new_h}')

    # 3장으로 균등 분할 - 세그먼트 시작점
    # 헤더(고정) + 첫 카드부터 시작 → 3등분 슬라이드
    if new_h < TARGET_H * 2:
        print(f'⚠️  페이지가 너무 짧음 ({new_h} < {TARGET_H * 2}). 카드 추가 후 재시도 권장.')
        # 그래도 3장 시도: 시작점만 다르게
        segments = [
            (0, TARGET_H),
            (max(0, (new_h - TARGET_H) // 2), max(0, (new_h - TARGET_H) // 2) + TARGET_H),
            (max(0, new_h - TARGET_H), new_h),
        ]
    else:
        # 균등 3분할 with 약간의 오버랩 방지
        stride = (new_h - TARGET_H) // 2  # 각 세그먼트 시작점 사이 거리
        segments = [
            (0, TARGET_H),
            (stride, stride + TARGET_H),
            (new_h - TARGET_H, new_h),
        ]

    for i, (top, bot) in enumerate(segments, start=1):
        # 안전 가드
        top = max(0, top)
        bot = min(new_h, bot)
        crop = img.crop((0, top, TARGET_W, bot))
        if crop.height < TARGET_H:
            # 부족하면 흰 배경 패딩
            canvas = Image.new('RGB', (TARGET_W, TARGET_H), '#FFF8EB')
            canvas.paste(crop, (0, 0))
            crop = canvas
        out = os.path.join(PUBLIC, f'toss-screen-v{i}.png')
        crop.save(out, optimize=True)
        print(f'   ✓ v{i}: top={top} → {out}')

    print('\n✅ 세로 3장 완료')
    print('   - public/toss-screen-v1.png (상단)')
    print('   - public/toss-screen-v2.png (중단)')
    print('   - public/toss-screen-v3.png (하단)')

    # 임시 파일 삭제
    os.remove(SRC)
    print(f'\n🧹 임시 파일 정리: {SRC}')


if __name__ == '__main__':
    main()
