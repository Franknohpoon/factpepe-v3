#!/usr/bin/env python3
"""
토스 미니앱 제출용 썸네일 (1932 × 828) 생성.

디자인:
- 왼쪽 880px: SSG 레드 + 대각선 줄무늬 + 페페 캐릭터 (큰 1 + 작은 2)
- 오른쪽: 크림 배경 + 타이틀 + 서브카피 + 7개 기능 chip
"""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(ROOT, 'public')
OUT = os.path.join(PUBLIC, 'toss-thumbnail.png')

W, H = 1932, 828
LEFT_W = 880
ACCENT = (206, 17, 65)        # #CE1141 SSG 레드
CREAM = (255, 248, 235)       # #FFF8EB
DARK = (26, 10, 10)           # #1a0a0a
MUTED = (139, 115, 85)        # #8b7355
TAG_BG = (252, 232, 240)      # 옅은 분홍 (불투명)
WHITE_STRIPE = (255, 255, 255, 50)  # 줄무늬 반투명

FONT_REG = '/System/Library/Fonts/AppleSDGothicNeo.ttc'
FONT_BOLD = '/System/Library/Fonts/AppleSDGothicNeo.ttc'

TITLE = '팩트페페'
SUBTITLE = 'SSG 랜더스 팬을 위한 매일 데이터'
SUB2 = '인천 야구의 모든 것 한 곳에'

# 새 기능 강조 — 직관/먹거리 추가, 우선순위 7개
TAGS = [
    '⚾ 팩트 승률',
    '📋 자동 라인업',
    '🗳️ 1초 투표',
    '🏟️ 직관 기록',
    '🍽️ 먹거리 46곳',
    '💬 응원톡',
    '🏆 적중률 뱃지',
]

# 이모지는 PIL 기본 렌더링이 깨지므로 텍스트만으로 디자인
TAGS_NOEMOJI = [
    '팩트 승률',
    '자동 라인업',
    '1초 투표',
    '직관 기록',         # NEW
    '먹거리 46곳',       # NEW
    '실시간 응원톡',
    '적중률 뱃지',
]


def draw_diagonal_stripes(img, x0, y0, x1, y1, color=(255, 255, 255), alpha=18, gap=44, thick=8):
    """RGBA 오버레이를 그려서 본 이미지에 합성."""
    overlay = Image.new('RGBA', img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    w = x1 - x0
    h = y1 - y0
    c = (*color, alpha)
    # 대각선: 좌상 → 우하 방향으로 -45도
    for i in range(-h, w + h, gap):
        d.line([(x0 + i, y0), (x0 + i - h, y0 + h)], fill=c, width=thick)
    return Image.alpha_composite(img.convert('RGBA'), overlay).convert('RGB')


def load_font(size, bold=True):
    # AppleSDGothicNeo.ttc 는 collection: index 6 ≈ Bold, 4 ≈ SemiBold, 0 ≈ Regular
    try:
        return ImageFont.truetype(FONT_BOLD if bold else FONT_REG, size, index=6 if bold else 0)
    except Exception:
        return ImageFont.load_default()


def main():
    img = Image.new('RGB', (W, H), CREAM)
    d = ImageDraw.Draw(img)

    # ── 왼쪽 SSG 레드 패널 + 대각선 줄무늬 ──
    d.rectangle([0, 0, LEFT_W, H], fill=ACCENT)
    img = draw_diagonal_stripes(img, 0, 0, LEFT_W, H, color=(255, 255, 255), alpha=30, gap=44, thick=8)
    d = ImageDraw.Draw(img)

    # ── 페페 캐릭터 합성 ──
    pepe_main_path = os.path.join(PUBLIC, 'pepe', 'pepe-happy.png')
    pepe_small_path = os.path.join(PUBLIC, 'pepe', 'pepe-cool.png')
    pepe_small2_path = os.path.join(PUBLIC, 'pepe', 'pepe-excited.png')

    try:
        # 메인 페페 — 왼쪽 중앙에 크게
        pepe = Image.open(pepe_main_path).convert('RGBA')
        size = 460
        pepe = pepe.resize((size, size), Image.LANCZOS)
        img_rgba = img.convert('RGBA')
        img_rgba.paste(pepe, ((LEFT_W - size) // 2, (H - size) // 2 - 20), pepe)
        img = img_rgba.convert('RGB')
        d = ImageDraw.Draw(img)

        # 작은 페페 2개 — 우하단 코너
        for path, x, y, sz in [
            (pepe_small_path, LEFT_W - 180, H - 200, 140),
            (pepe_small2_path, LEFT_W - 320, H - 130, 100),
        ]:
            sp = Image.open(path).convert('RGBA').resize((sz, sz), Image.LANCZOS)
            img_rgba = img.convert('RGBA')
            img_rgba.paste(sp, (x, y), sp)
            img = img_rgba.convert('RGB')
            d = ImageDraw.Draw(img)
    except Exception as e:
        print(f'⚠️  Pepe 합성 실패: {e}')

    # ── 오른쪽 텍스트 영역 ──
    text_x = LEFT_W + 80
    text_max_w = W - text_x - 80

    # 타이틀
    title_font = load_font(120, bold=True)
    d.text((text_x, 110), TITLE, fill=ACCENT, font=title_font)

    # 가는 가로선 (브랜드 구분)
    d.rectangle([text_x, 250, text_x + 90, 254], fill=ACCENT)

    # 서브타이틀 1
    sub1_font = load_font(46, bold=True)
    d.text((text_x, 280), SUBTITLE, fill=DARK, font=sub1_font)

    # 서브타이틀 2 (얇게)
    sub2_font = load_font(34, bold=False)
    d.text((text_x, 342), SUB2, fill=MUTED, font=sub2_font)

    # ── 태그 chip 그리드 ──
    chip_font = load_font(32, bold=True)
    chip_y = 440
    chip_h = 64
    chip_pad_x = 26
    chip_gap_x = 16
    chip_gap_y = 18
    cur_x = text_x
    cur_y = chip_y

    for label in TAGS_NOEMOJI:
        # 텍스트 너비 측정
        bbox = d.textbbox((0, 0), label, font=chip_font)
        text_w = bbox[2] - bbox[0]
        text_h = bbox[3] - bbox[1]
        chip_w = text_w + chip_pad_x * 2

        # 다음 줄로 넘어가기
        if cur_x + chip_w > text_x + text_max_w:
            cur_x = text_x
            cur_y += chip_h + chip_gap_y

        # 칩 그리기 (둥근 사각형)
        d.rounded_rectangle(
            [cur_x, cur_y, cur_x + chip_w, cur_y + chip_h],
            radius=chip_h // 2,
            fill=TAG_BG,
        )
        # 텍스트 (수직 중앙 정렬)
        text_y = cur_y + (chip_h - text_h) // 2 - 4
        d.text((cur_x + chip_pad_x, text_y), label, fill=ACCENT, font=chip_font)

        cur_x += chip_w + chip_gap_x

    # ── 푸터: factpepe · @factpepe_ ──
    footer_font = load_font(26, bold=False)
    footer_text = 'factpepe  ·  SSG 랜더스 팬 데이터  ·  @factpepe_'
    d.text((text_x, H - 70), footer_text, fill=MUTED, font=footer_font)

    img.save(OUT, optimize=True)
    print(f'✅ {OUT}')
    print(f'   크기: {W} × {H}')


if __name__ == '__main__':
    main()
