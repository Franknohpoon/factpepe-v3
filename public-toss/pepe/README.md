# 페페 캐릭터 이미지

운영자가 직접 제작한 페페 PNG를 여기에 넣으면 자동으로 SVG fallback 대신 사용됩니다.

## 파일명 규칙

| 파일명 | 사용 위치 |
|---|---|
| `pepe-happy.png` | 헤더 (기본 표정) |
| `pepe-excited.png` | 회고 카드 - 예측 적중 시 |
| `pepe-cool.png` | 영상 카드 (분석 영상) |
| `pepe-sad.png` | 회고 카드 - 예측 빗나감 시 |
| `pepe-sleepy.png` | 비경기일, 미등록 상태 |
| `pepe-analyzing.png` | 승률 카드 (팩트 승률) |
| `pepe-cheering.png` | 응원 톡 (응원봉 든 페페) |

## 권장 사양

- **형식**: PNG (투명 배경 권장)
- **크기**: 정사각형, 최소 256×256px, 권장 512×512px 이상
- **비율**: 1:1
- **배경**: 투명 (transparent)

## 자동 동작

- 위 파일 중 일부만 넣어도 OK (없는 건 SVG fallback 사용)
- 파일이 올바르면 즉시 적용 (Vercel 재배포 후)
- PNG 로딩 실패 시 자동으로 SVG fallback으로 전환
